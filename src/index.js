import pkg from 'matrix-bot-sdk';
const { MatrixClient, AutojoinRoomsMixin, SimpleFsStorageProvider, Appservice: AppService } = pkg;
import axios from 'axios';
import NodeCache from 'node-cache';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

dotenv.config();

const homeserverUrl = process.env.HOMESERVER_URL;
const homeserverName = process.env.HOMESERVER_NAME || "matrix.org";
const accessToken = process.env.ACCESS_TOKEN;
const port = process.env.PORT || 3000;

// Setup Scryfall Cache
const cardCache = new NodeCache({ 
    stdTTL: parseInt(process.env.CACHE_TTL) || 3600,
    checkperiod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600
});

async function startBot() {
    let client;
    let appservice;

    // Check if we're running as an AppService
    const registrationPath = path.resolve('registration.yaml');
    if (fs.existsSync(registrationPath)) {
        console.log(`[BOT] Loading registration from ${registrationPath}...`);
        const registration = yaml.load(fs.readFileSync(registrationPath, 'utf8'));
        const storage = new SimpleFsStorageProvider(path.resolve('appservice.json'));
        console.log(`[BOT] Initializing AppService for homeserver: ${homeserverName} (${homeserverUrl})`);
        appservice = new AppService({
            homeserverName: homeserverName,
            homeserverUrl: homeserverUrl,
            port: port,
            bindAddress: "0.0.0.0",
            registration: registration,
            storage: storage
        });
        
        // This is a bit simplified; AppService logic differs slightly
        // For simplicity, we'll get a client for the bot user
        client = appservice.botClient;
        
        AutojoinRoomsMixin.setupOnClient(client);

        // Start the AppService server
        try {
            console.log('[BOT] Starting AppService...');
            await appservice.begin();
            console.log('[BOT] AppService server started successfully.');
        } catch (error) {
            console.error('[BOT] Error starting AppService:', error);
            throw error;
        }
    } else {
        console.log('[BOT] No registration.yaml found, starting as simple Matrix bot...');
        if (!homeserverUrl || !accessToken) {
            const error = new Error('HOMESERVER_URL or ACCESS_TOKEN is not defined in environment variables.');
            console.error(`[BOT] Initialization failed: ${error.message}`);
            throw error;
        }
        
        const storage = new SimpleFsStorageProvider(path.resolve('bot.json'));
        client = new MatrixClient(homeserverUrl, accessToken, storage);
        AutojoinRoomsMixin.setupOnClient(client);
        
        try {
            console.log('[BOT] Starting simple Matrix bot client...');
            await client.start();
            console.log('[BOT] Matrix bot client started successfully.');
        } catch (error) {
            console.error('[BOT] Error starting Matrix bot:', error);
            throw error;
        }
    }

    // Bot Logic
    client.on('room.invite', async (roomId, event) => {
        try {
            console.log(`Received invitation for room: ${roomId}`);
            await client.joinRoom(roomId);
            console.log(`Successfully joined room: ${roomId}`);
        } catch (error) {
            console.error(`Failed to join room ${roomId}:`, error);
        }
    });

    client.on('room.message', async (roomId, event) => {
        if (!event['content']) return;
        if (event['content']['msgtype'] !== 'm.text') return;
        
        // Avoid responding to ourselves
        const botUserId = await client.getUserId();
        if (event['sender'] === botUserId) return;

        const body = event['content']['body'];
        if (body.startsWith('!card ')) {
            const cardName = body.substring(6).trim();
            await handleCardLookup(client, roomId, event, cardName);
        }
    });

    console.log('[BOT] Core bot logic handlers registered.');
    return { client, appservice };
}

async function handleCardLookup(client, roomId, event, cardName) {
    try {
        const cardData = await fetchCardData(cardName);
        if (cardData) {
            const message = `Found card: ${cardData.name}\nSet: ${cardData.set_name}\nPrice: $${cardData.prices.usd || 'N/A'}\nLink: ${cardData.scryfall_uri}`;
            await client.sendMessage(roomId, {
                msgtype: 'm.text',
                body: message,
                formatted_body: `<strong>Found card:</strong> ${cardData.name}<br/><strong>Set:</strong> ${cardData.set_name}<br/><strong>Price:</strong> $${cardData.prices.usd || 'N/A'}<br/><a href="${cardData.scryfall_uri}">Scryfall Link</a>`,
                format: 'org.matrix.custom.html',
                'm.relates_to': {
                    'm.in_reply_to': {
                        'event_id': event['event_id']
                    }
                }
            });
        } else {
            await client.replyText(roomId, event, "Sorry, I couldn't find that card.");
        }
    } catch (error) {
        console.error('Error looking up card:', error);
        await client.sendMessage(roomId, {
            msgtype: 'm.text',
            body: 'An error occurred while looking up the card.'
        });
    }
}

async function fetchCardData(cardName) {
    const cachedCard = cardCache.get(cardName.toLowerCase());
    if (cachedCard) {
        console.log(`Cache hit for: ${cardName}`);
        return cachedCard;
    }

    console.log(`Cache miss for: ${cardName}. Fetching from Scryfall...`);
    try {
        const response = await axios.get(`${process.env.SCRYFALL_API_URL}/cards/named`, {
            params: { fuzzy: cardName }
        });
        const cardData = response.data;
        cardCache.set(cardName.toLowerCase(), cardData);
        return cardData;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
}

// API Server Setup
const app = express();
app.get('/api/card/:name', async (req, res) => {
    try {
        const cardData = await fetchCardData(req.params.name);
        if (cardData) {
            res.json(cardData);
        } else {
            res.status(404).json({ error: 'Card not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Bot and API
(async () => {
    try {
        console.log('[APP] Starting Scryfall Matrix bot...');
        const { client, appservice } = await startBot();
        
        if (appservice) {
            console.log('[API] Attaching API to AppService Express instance...');
            appservice.expressAppInstance.use(app);
            console.log(`[API] API is available on AppService port ${port}`);
        } else {
            console.log(`[API] Starting standalone API server on port ${port}...`);
            app.listen(port, () => {
                console.log(`[API] Standalone API server listening on port ${port}`);
            });
        }
        console.log('[APP] Scryfall Matrix bot is ready and running!');
    } catch (err) {
        console.error('[APP] CRITICAL: Failed to start application:', err);
        process.exit(1);
    }
})();
