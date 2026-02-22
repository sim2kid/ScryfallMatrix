import pkg from 'matrix-bot-sdk';
const { MatrixClient, SimpleFsStorageProvider, Appservice: AppService } = pkg;
import axios from 'axios';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { scryfall } from './scryfall.js';
import { formatter } from './formatter.js';

dotenv.config();

const homeserverUrl = process.env.HOMESERVER_URL;
const homeserverName = process.env.HOMESERVER_NAME || "matrix.org";
const accessToken = process.env.ACCESS_TOKEN;
const port = process.env.PORT || 3000;
const botIconUrl = process.env.BOT_ICON_URL || "https://scryfall.com/icon-512.png";
const debugMode = process.env.DEBUG_MODE === 'true';

const HELP_BLURB = "Surround [[card names]] with braces and the bot will post Oracle text to your channel. Also supports [[!images]], [[$prices]], [[?rulings]], and [[#legality]]";

async function updateBotProfilePicture(client) {
    console.log('[BOT] Checking and updating bot profile picture and status...');
    try {
        // Update display name to "Unofficial Scryfall"
        try {
            const currentProfile = await client.getUserProfile(await client.getUserId());
            if (currentProfile.displayname !== "Unofficial Scryfall") {
                console.log('[BOT] Setting bot display name to "Unofficial Scryfall"...');
                await client.setDisplayName("Unofficial Scryfall");
            } else {
                console.log('[BOT] Bot display name is already correct.');
            }
        } catch (err) {
            console.warn('[BOT] Failed to set bot display name:', err.message);
        }

        // Update presence/status
        try {
            console.log('[BOT] Setting bot status/presence...');
            await client.setPresence('online', HELP_BLURB);
        } catch (err) {
            console.warn('[BOT] Failed to set bot presence:', err.message);
        }

        // First, check if the profile already has an avatar
        const userId = await client.getUserId();
        const profile = await client.getUserProfile(userId);
        
        if (profile && profile.avatar_url) {
            console.log('[BOT] Bot already has an avatar set. Skipping update.');
            return;
        }

        console.log(`[BOT] Fetching bot icon from: ${botIconUrl}`);
        const response = await axios.get(botIconUrl, { responseType: 'arraybuffer' });
        const contentType = response.headers['content-type'] || 'image/png';
        const imageData = Buffer.from(response.data, 'binary');

        console.log('[BOT] Uploading icon to homeserver...');
        const mxcUri = await client.uploadContent(imageData, contentType, "icon.png");
        
        console.log(`[BOT] Setting bot avatar to: ${mxcUri}`);
        await client.setAvatarUrl(mxcUri);
        console.log('[BOT] Bot profile picture updated successfully.');
    } catch (err) {
        console.error('[BOT] Failed to update bot profile picture:', err.message);
        // We don't throw here to avoid stopping the bot if only the icon fails
    }
}

async function validateHomeserver(client) {
    console.log('[BOT] Validating homeserver connectivity...');
    try {
        // GET /_matrix/client/versions is a standard, unauthenticated call
        // that all homeservers MUST support.
        const versions = await client.doRequest("GET", "/_matrix/client/versions");
        console.log(`[BOT] Homeserver connection validated. Supported Matrix versions: ${versions.versions.join(', ')}`);
        return true;
    } catch (err) {
        console.error('[BOT] CRITICAL: Failed to connect to homeserver at startup.');
        console.error(`[BOT] Check your HOMESERVER_URL (${homeserverUrl}) and network connectivity.`);
        if (err.body) {
            console.error('[BOT] Error details:', JSON.stringify(err.body));
        } else {
            console.error('[BOT] Error message:', err.message);
        }
        return false;
    }
}

async function joinExistingInvites(client) {
    // Add a small delay to allow the homeserver to settle after bot startup
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[BOT] Checking for existing invitations...');
    try {
        // Try to get the bot's user ID to use in the request if needed
        let botUserId = null;
        try {
            botUserId = await client.getUserId();
        } catch (e) {
            // Ignore failure to get user ID
        }

        // Some homeservers fail with complex filters or limit: 0 on initial sync.
        // We'll use a very simple filter that still minimizes data, and add a fallback.
        const filter = {
            room: {
                timeline: { limit: 1 },
                state: { types: ["m.room.member"] }
            }
        };

        const syncParams = {
            filter: JSON.stringify(filter),
            timeout: 0
        };

        // For AppServices, explicitly providing the user_id can sometimes resolve internal HS issues
        if (botUserId) {
            syncParams.user_id = botUserId;
        }

        let sync;
        try {
            console.log('[BOT] Attempting initial sync to catch up on invitations...');
            sync = await client.doRequest("GET", "/_matrix/client/v3/sync", syncParams);
        } catch (e) {
            const errCode = e.body?.errcode || e.statusCode || 'unknown';
            const errMsg = e.message;
            
            console.warn(`[BOT] Initial sync with filter failed (code: ${errCode}). Error: ${errMsg}`);
            
            // Specifically detect Synapse's NotImplementedError (often 500 M_UNKNOWN)
            if (e.statusCode === 500 || (e.body && e.body.errcode === 'M_UNKNOWN')) {
                console.warn("[BOT] This homeserver may not support filtered sync for this user (NotImplementedError).");
            }

            console.warn("[BOT] Retrying without filter...");
            const fallbackParams = { timeout: 0 };
            if (botUserId) fallbackParams.user_id = botUserId;

            try {
                sync = await client.doRequest("GET", "/_matrix/client/v3/sync", fallbackParams);
            } catch (e2) {
                const errCode2 = e2.body?.errcode || e2.statusCode || 'unknown';
                console.error(`[BOT] Initial sync without filter also failed (code: ${errCode2}). Error: ${e2.message}`);
                
                // If the HS just won't /sync, we can't find historic invites.
                // We'll throw only if it's a critical error (like 401/403), otherwise we'll just log and continue.
                if (e2.statusCode === 401 || e2.statusCode === 403) {
                    throw e2;
                }
                
                console.error("[BOT] Could not retrieve historic invitations due to homeserver errors. The bot will only respond to new invitations.");
                return;
            }
        }

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
        if (err.statusCode === 500 || (err.body && err.body.errcode === 'M_UNKNOWN')) {
            console.error("[BOT] The homeserver returned an internal error (500) when checking for existing invitations.");
            console.error("[BOT] This is likely a server-side issue on the homeserver. The bot will continue, but may have missed some previous invitations.");
            
            // Fallback: If we can't sync, at least check for joined rooms to warm up.
            // Note: joinRoom on an already joined room is usually fine and ensures we're listening.
            try {
                const joinedRooms = await client.getJoinedRooms();
                console.log(`[BOT] Fallback check: Currently joined in ${joinedRooms.length} room(s).`);
            } catch (fallbackErr) {
                console.error("[BOT] Fallback check failed too:", fallbackErr.message);
            }
        } else {
            console.error("[BOT] Error checking for existing invitations:", err);
            if (err.body) {
                console.error("[BOT] Error details:", JSON.stringify(err.body));
            }
        }
    }
}

async function startBot() {
    let client;
    let appservice;
    let botUserId;

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

        // Use BOT_USER_ID from environment if provided, otherwise default to @scryfall:homeserverName
        botUserId = process.env.BOT_USER_ID || `@${registration.sender_localpart}:${homeserverName}`;
        console.log(`[BOT] Bot user ID: ${botUserId}`);

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

        // Validate homeserver connectivity before proceeding
        if (!await validateHomeserver(client)) {
            throw new Error("Could not connect to homeserver.");
        }

        // Ensure bot user is registered
        try {
            console.log(`[BOT] Ensuring bot user ${botUserId} is registered...`);
            // We use the botIntent to ensure the bot user is registered
            try {
                await appservice.botIntent.ensureRegistered();
            } catch (error) {
                if (error.body && error.body.errcode === 'M_USER_IN_USE') {
                    console.log(`[BOT] Bot user ${botUserId} already registered.`);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('[BOT] CRITICAL: Failed to register or start AppService.');
            if (error.body) {
                console.error('[BOT] Error details:', JSON.stringify(error.body));
            }
            throw error; // This will cause process.exit(1) in the main wrapper
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

        // Validate homeserver connectivity before proceeding
        if (!await validateHomeserver(client)) {
            throw new Error("Could not connect to homeserver.");
        }

        botUserId = await client.getUserId();
        console.log(`[BOT] Bot user ID: ${botUserId}`);
    }

    // Bot Logic - Register Handlers
    const eventEmitter = appservice || client;
    console.log(`[BOT] Registering event handlers for ${botUserId}...`);

    eventEmitter.on('room.invite', async (roomId, event) => {
        // In AppService mode, the appservice emits invitations for ALL users in its namespace.
        // We MUST check if the invite is for our bot user.
        if (event['state_key'] !== botUserId) return;

        console.log(`[BOT] Received invitation for room: ${roomId}`);
        try {
            if (appservice) {
                await appservice.botIntent.joinRoom(roomId);
            } else {
                await client.joinRoom(roomId);
            }
            console.log(`[BOT] Successfully joined room: ${roomId}`);
        } catch (error) {
            console.error(`[BOT] Failed to join room ${roomId}:`, error);
        }
    });

    eventEmitter.on('room.message', async (roomId, event) => {
        if (!event['content']) return;
        if (event['content']['msgtype'] !== 'm.text') return;

        // Avoid responding to ourselves
        if (event['sender'] === botUserId) return;

        const body = event['content']['body'];
        const cardRegex = /\[\[([!$?#])?([^\]]+)\]\]/g;
        let match;

        while ((match = cardRegex.exec(body)) !== null) {
            const prefix = match[1]; // !, $, ?, # or undefined
            const cardName = match[2].trim();
            
            if (!cardName) continue;
            
            let requestedSubset = 'Generic';
            if (prefix === '!') requestedSubset = 'Image';
            else if (prefix === '$') requestedSubset = 'Prices';
            else if (prefix === '?') requestedSubset = 'Rulings';
            else if (prefix === '#') requestedSubset = 'Legality';

            if (debugMode) {
                console.log(`[DEBUG] Detected card: "${cardName}", Subset: ${requestedSubset}`);
            } else {
                await handleCardLookup(client, roomId, event, cardName, requestedSubset);
            }
        }
    });

    // Start the bot/appservice
    if (appservice) {
        try {
            console.log('[BOT] Starting AppService...');
            await appservice.begin();
            console.log('[BOT] AppService server started successfully.');
        } catch (error) {
            console.error('[BOT] CRITICAL: Failed to start AppService.');
            throw error;
        }
    } else {
        try {
            console.log('[BOT] Starting simple Matrix bot client...');
            await client.start();
            console.log('[BOT] Matrix bot client started successfully.');
        } catch (error) {
            console.error('[BOT] Error starting Matrix bot:', error);
            throw error;
        }
    }

    // Check for any invites we might have missed while offline
    await joinExistingInvites(client);

    // Update bot profile picture
    await updateBotProfilePicture(client);

    console.log('[BOT] Core bot logic handlers registered.');
    return { client, appservice };
}

async function handleCardLookup(client, roomId, event, cardName, subset = 'Generic') {
    try {
        const cardData = await scryfall.getCardByName(cardName);
        if (cardData) {
            let formatted;
            switch (subset) {
                case 'Image':
                    formatted = await formatter.formatImage(cardData);
                    break;
                case 'Prices':
                    formatted = await formatter.formatPrices(cardData);
                    break;
                case 'Rulings':
                    formatted = await formatter.formatRulings(cardData);
                    break;
                case 'Legality':
                    formatted = await formatter.formatLegality(cardData);
                    break;
                case 'Generic':
                default:
                    formatted = await formatter.formatGeneral(cardData);
                    break;
            }

            await client.sendMessage(roomId, {
                msgtype: 'm.text',
                body: formatted.plainText,
                formatted_body: formatted.html,
                format: 'org.matrix.custom.html',
                'm.relates_to': {
                    'm.in_reply_to': {
                        'event_id': event['event_id']
                    }
                }
            });
        } else {
            await client.replyText(roomId, event, `Sorry, I couldn't find a card named "${cardName}".`);
        }
    } catch (error) {
        console.error('Error looking up card:', error);
        await client.sendMessage(roomId, {
            msgtype: 'm.text',
            body: 'An error occurred while looking up the card.'
        });
    }
}

// API Server Setup
const app = express();
app.get('/api/card/:name', async (req, res) => {
    try {
        const cardData = await scryfall.getCardByName(req.params.name);
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
        console.log('[APP] Starting Unofficial Scryfall Matrix bot...');
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
        console.log('[APP] Unofficial Scryfall Matrix bot is ready and running!');
    } catch (err) {
        console.error('[APP] CRITICAL: Failed to start application:', err);
        process.exit(1);
    }
})();
