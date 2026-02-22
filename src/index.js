import pkg from 'matrix-bot-sdk';
const { MatrixClient, SimpleFsStorageProvider, Appservice: AppService } = pkg;
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

async function joinExistingInvites(client) {
    console.log('[BOT] Checking for existing invitations...');
    try {
        const sync = await client.doRequest("GET", "/_matrix/client/v3/sync", {
            filter: JSON.stringify({
                room: {
                    timeline: { limit: 0 },
                    state: { limit: 0 },
                    ephemeral: { limit: 0 },
                    account_data: { limit: 0 }
                },
                presence: { limit: 0 },
                account_data: { limit: 0 }
            }),
            timeout: 0
        });

        if (sync && sync.rooms && sync.rooms.invite) {
            const invitedRoomIds = Object.keys(sync.rooms.invite);
            if (invitedRoomIds.length > 0) {
                console.log(`[BOT] Found ${invitedRoomIds.length} existing invitation(s). Joining...`);
                for (const roomId of invitedRoomIds) {
                    try {
                        await client.joinRoom(roomId);
                        console.log(`[BOT] Successfully joined room: ${roomId}`);
                    } catch (e) {
                        console.error(`[BOT] Failed to join room ${roomId}:`, e);
                    }
                }
            } else {
                console.log("[BOT] No existing invitations found.");
            }
        }
    } catch (err) {
        console.error("[BOT] Error checking for existing invitations:", err);
    }
}

async function startBot() {
    let client;
    let appservice;

    // Check if we're running as an AppService
    const registrationPath = path.resolve('registration.yaml');
    if (fs.existsSync(registrationPath)) {
        console.log(`[BOT] Loading registration from ${registrationPath}...`);
        if (!homeserverUrl) {
            const error = new Error('HOMESERVER_URL is not defined in environment variables. This is required even for AppService mode.');
            console.error(`[BOT] Initialization failed: ${error.message}`);
            throw error;
        }
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
            let errorMessage = 'Missing required environment variables for simple bot mode: ';
            const missing = [];
            if (!homeserverUrl) missing.push('HOMESERVER_URL');
            if (!accessToken) missing.push('ACCESS_TOKEN');
            errorMessage += missing.join(' and ');

            if (process.env.AS_TOKEN || process.env.HS_TOKEN) {
                errorMessage += '. It looks like you might have intended to run as an AppService. If so, please ensure that "registration.yaml" exists. You can generate it by running "npm run generate-registration".';
            }
            
            const error = new Error(errorMessage);
            console.error(`[BOT] Initialization failed: ${error.message}`);
            throw error;
        }
        
        const storage = new SimpleFsStorageProvider(path.resolve('bot.json'));
        client = new MatrixClient(homeserverUrl, accessToken, storage);
        
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

    // Check for any invites we might have missed while offline
    await joinExistingInvites(client);

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
