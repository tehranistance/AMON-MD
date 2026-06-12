import express from 'express';
import 'dotenv/config';

import fs, { existsSync, mkdirSync, rmSync } from 'fs';
import path, { dirname } from 'path';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { parsePhoneNumber as PhoneNumber } from 'awesome-phonenumber';
import readline from 'readline';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { smsg } from './lib/myfunc.js';
import { compileAll } from './lib/compile.js';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, jidDecode, jidNormalizedUser, makeCacheableSignalKeyStore, delay } from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';
import config from './config.js';
import store from './lib/lightweight_store.js';
import SaveCreds from './lib/session.js';
import { server, PORT } from './lib/server.js';
import { printLog } from './lib/print.js';
import { writeErrorLog } from './lib/logger.js';
import { handleMessages, handleGroupParticipantUpdate, handleStatus, handleCall } from './lib/messageHandler.js';
import commandHandler from './lib/commandHandler.js';

// ========== MULTI-USER PAIRING API ==========
const pairingApp = express();
const PAIRING_PORT = process.env.PAIRING_PORT || 3001;

// Store multi-user sessions
global.userSessions = new Map();
global.startTime = Date.now();

// Middleware
pairingApp.use(express.json());
pairingApp.use(express.urlencoded({ extended: true }));
pairingApp.use(express.static('.')); // Serve HTML files

// Create sessions directory for multi-users
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions', { recursive: true });
}

// ========== PAIRING API ENDPOINTS ==========

// Serve dashboard HTML
pairingApp.get('/', (req, res) => {
    const dashboardPath = path.join(process.cwd(), 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>AMON-MD Pairing</title></head>
            <body>
                <h1>AMON-MD Pairing API</h1>
                <p>API is running. Use POST /api/pair with { "phoneNumber": "1234567890" }</p>
            </body>
            </html>
        `);
    }
});

// Pairing endpoint
pairingApp.post('/api/pair', async (req, res) => {
    const { phoneNumber, serverId } = req.body;
    
    if (!phoneNumber) {
        return res.json({ success: false, error: "Phone number required" });
    }
    
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const sessionPath = `./sessions/${cleanNumber}`;
    
    try {
        // Check if already connected
        if (global.userSessions.has(cleanNumber) && global.userSessions.get(cleanNumber).connected) {
            return res.json({ success: true, alreadyConnected: true, message: "Bot already connected!" });
        }
        
        // Create session directory
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: true,
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Request pairing code
        const code = await sock.requestPairingCode(cleanNumber);
        
        // Store session
        global.userSessions.set(cleanNumber, {
            socket: sock,
            connected: false,
            phoneNumber: cleanNumber,
            serverId: serverId || 1,
            connectedAt: null
        });
        
        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                const session = global.userSessions.get(cleanNumber);
                if (session) {
                    session.connected = true;
                    session.connectedAt = Date.now();
                    global.userSessions.set(cleanNumber, session);
                }
                printLog('success', `✅ User ${cleanNumber} connected!`);
                
                // Send welcome message
                const welcomeMsg = `🤖 *AMON-MD Bot Active*\n\n✅ Successfully connected!\n📱 Your number: +${cleanNumber}\n🕐 Time: ${new Date().toLocaleString()}\n\n📝 *Available Commands:*\n• .menu - Show all commands\n• .ping - Check bot status\n• .owner - Bot information\n\n_Powered by AMON-MD_`;
                
                await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, {
                    text: welcomeMsg
                }).catch(console.error);
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut && statusCode !== 401) {
                    printLog('warning', `🔄 Reconnecting ${cleanNumber}...`);
                } else {
                    printLog('info', `🚪 User ${cleanNumber} logged out`);
                    global.userSessions.delete(cleanNumber);
                }
            }
        });
        
        // Handle messages from this user (simple commands)
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;
            if (msg.key.remoteJid === 'status@broadcast') return;
            
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const fromJid = msg.key.remoteJid;
            
            if (text === '.menu' || text === '.help') {
                await sock.sendMessage(fromJid, {
                    text: `╭━━━⟮ AMON-MD ⟯━━━┈⊷\n` +
                          `┃✵ 🤖 *Bot Active*\n` +
                          `┃✵ 📱 *Your Number:* +${cleanNumber}\n` +
                          `┃✵ 🕐 *Status:* Connected\n` +
                          `┣━━━━━━━━━━━━━━━\n` +
                          `┃✵ 📝 *Commands:*\n` +
                          `┃✵ • .menu - Show this menu\n` +
                          `┃✵ • .ping - Check bot status\n` +
                          `┃✵ • .owner - Bot information\n` +
                          `┣━━━━━━━━━━━━━━━\n` +
                          `┃✵ 🚀 *Bot Features:*\n` +
                          `┃✵ • 250+ Commands\n` +
                          `┃✵ • Group Management\n` +
                          `┃✵ • Media Downloader\n` +
                          `┃✵ • AI Chatbot\n` +
                          `┗━━━━━━━━━━━━━━━\n\n` +
                          `_Powered by AMON-MD_`
                });
            } else if (text === '.ping') {
                await sock.sendMessage(fromJid, { text: '🏓 Pong! Bot is active and running.' });
            } else if (text === '.owner') {
                await sock.sendMessage(fromJid, { 
                    text: `👑 *Bot Owner*\n\n🤖 Bot: AMON-MD\n📱 WhatsApp Bot\n⚡ High Performance\n\n_Powered by GlobalTechInfo_`
                });
            }
        });
        
        res.json({ success: true, code: code });
        
    } catch (error) {
        printLog('error', `Pairing error for ${cleanNumber}: ${error.message}`);
        res.json({ success: false, error: error.message });
    }
});

// Status endpoint
pairingApp.get('/api/status/:phoneNumber', (req, res) => {
    const { phoneNumber } = req.params;
    const session = global.userSessions.get(phoneNumber);
    
    res.json({
        connected: session ? session.connected : false,
        exists: session ? true : false,
        phoneNumber: session?.phoneNumber || null
    });
});

// Stats endpoint
pairingApp.get('/api/stats', (req, res) => {
    const connectedUsers = Array.from(global.userSessions.values()).filter(s => s.connected).length;
    
    res.json({
        totalUsers: connectedUsers,
        totalSessions: global.userSessions.size,
        version: 'v6.0',
        uptime: process.uptime(),
        startTime: global.startTime
    });
});

// Users list endpoint
pairingApp.get('/api/users', (req, res) => {
    const users = Array.from(global.userSessions.entries()).map(([id, data]) => ({
        phoneNumber: id,
        connected: data.connected,
        connectedAt: data.connectedAt
    }));
    res.json({ users });
});

// Start pairing API server
pairingApp.listen(PAIRING_PORT, () => {
    printLog('success', `📱 Multi-User Pairing API: http://localhost:${PAIRING_PORT}`);
    printLog('info', `🌐 Dashboard: http://localhost:${PAIRING_PORT}`);
});

// Clean up old sessions (older than 7 days)
setInterval(() => {
    const sessionsDir = './sessions';
    if (!fs.existsSync(sessionsDir)) return;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    fs.readdir(sessionsDir, (err, folders) => {
        if (err) return;
        for (const folder of folders) {
            const folderPath = path.join(sessionsDir, folder);
            fs.stat(folderPath, (err, stats) => {
                if (!err && stats.mtimeMs < sevenDaysAgo) {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    printLog('info', `🧹 Cleaned up old session: ${folder}`);
                }
            });
        }
    });
}, 24 * 60 * 60 * 1000);

// ========== NEWSLETTER CONTEXT INFO (to be added to all messages) ==========
const NEWSLETTER_CONTEXT = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363406476499117@newsletter',
        newsletterName: 'AmonTech',
        serverMessageId: -1
    }
};

// ========== FANCY STYLE FUNCTIONS (same as menu) ==========
function getCurrentTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Africa/Nairobi'
    });
}

function getCurrentDate() {
    return new Date().toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Nairobi'
    });
}

function getRandomStartupQuote() {
    const quotes = [
        "Ready to serve! 🚀",
        "System online and operational! 💪",
        "Bot is alive and kicking! ✨",
        "Ready for action! ⚡",
        "Your assistant is here! 🤖",
        "All systems operational! 🟢",
        "Ready to process commands! 📝",
        "Awaiting your instructions! 🎯",
        "Bot at your service! 🌟",
        "Connection established! 🔗"
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function buildConnectionMessage(botName, ghostStatus = '') {
    const currentTime = getCurrentTime();
    const currentDate = getCurrentDate();
    const randomQuote = getRandomStartupQuote();
    
    let message = `╭━━━  ⟮  ${botName || 'AMON-MD'} ⟯━━━━━━┈⊷\n`;
    message += `┃✵╭──────────────\n`;
    message += `┃✵│ 🟢 *STATUS:* CONNECTED\n`;
    message += `┃✵│ 🕐 *TIME:* ${currentTime}\n`;
    message += `┃✵│ 📅 *DATE:* ${currentDate}\n`;
    message += `┃✵│ 🤖 *BOT:* ${botName || 'AMON-MD'}\n`;
    message += `┃✵│ ✅ *STATUS:* Online and Ready!\n`;
    if (ghostStatus) {
        message += `┃✵│ 👻 *STEALTH:* ${ghostStatus}\n`;
    }
    message += '┃✵╰──────────────\n';
    message += '╰━━━━━━━━━━━━━━━━━━┈⊷\n\n';
      
    message += ` ╭─────「 ✨ STATUS 」───┈⊷ \n`;
    message += ` ││◦➛  ${randomQuote}\n`;
    message += ' ╰──────────────┈⊷ \n\n';

    message += `╭━━━  ⟮  BOT ONLINE ⟯━━━━━━┈⊷\n`;
    message += `┃✵╭──────────────\n`;
    message += `┃✵│ 🌟 *Thank you for choosing ${botName || 'AMON-MD'}*\n`;
    message += `┃✵│ 💪 *Ready to serve you 24/7*\n`;
    message += '┃✵╰──────────────\n';
    message += '╰━━━━━━━━━━━━━━━━━━┈⊷';
    
    return message;
}

// ========== WRAPPER FUNCTION TO ADD NEWSLETTER CONTEXT TO ALL MESSAGES ==========
function wrapWithNewsletter(sendFunction, sock, chatId, content, options = {}) {
    const originalSendMessage = sock.sendMessage.bind(sock);
    
    // Override sendMessage to always include newsletter context
    sock.sendMessage = async (jid, messageContent, extraOptions = {}) => {
        // Don't add newsletter context to status messages or internal messages
        if (jid === 'status@broadcast') {
            return originalSendMessage(jid, messageContent, extraOptions);
        }
        
        // Add newsletter context to the message content
        if (messageContent.text && !messageContent.contextInfo) {
            messageContent.contextInfo = NEWSLETTER_CONTEXT;
        } else if (messageContent.text && messageContent.contextInfo) {
            messageContent.contextInfo = { ...messageContent.contextInfo, ...NEWSLETTER_CONTEXT };
        } else if (messageContent.caption && !messageContent.contextInfo) {
            messageContent.contextInfo = NEWSLETTER_CONTEXT;
        } else if (messageContent.caption && messageContent.contextInfo) {
            messageContent.contextInfo = { ...messageContent.contextInfo, ...NEWSLETTER_CONTEXT };
        }
        
        return originalSendMessage(jid, messageContent, extraOptions);
    };
    
    return sendFunction;
}

store.readFromFile();
setInterval(() => store.writeToFile(), config.storeWriteInterval || 10000);

setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection completed');
    }
}, 60000);

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        printLog('warning', '[AMON-MD] RAM too high (>400MB), restarting bot...');
        process.exit(1);
    }
}, 30000);

const phoneNumber = config.pairingNumber || config.ownerNumber || "254759006509";

// Auto-create data directory and default files on startup
const DATA_DEFAULTS = {
    'owner.json': [],
    'banned.json': [],
    'premium.json': [],
    'warnings.json': {},
    'notes.json': {},
    'autoAi.json': {},
    'messageCount.json': { isPublic: true, messageCount: {} },
    'userGroupData.json': { users: [], groups: [], antilink: {}, antibadword: {}, warnings: {}, sudo: [], welcome: {}, goodbye: {}, chatbot: {}, autoReaction: false },
    'autoStatus.json': { enabled: false },
    'autoread.json': { enabled: false },
    'autotyping.json': { enabled: false },
    'pmblocker.json': { enabled: false },
    'anticall.json': { enabled: false },
    'stealthMode.json': { enabled: false },
    'autoBio.json': { enabled: false, customBio: null },
    'autoReaction.json': { enabled: false },
    'antidelete.json': { enabled: false },
    'antilink.json': {},
    'antibadword.json': {},
};

fs.mkdirSync('./data', { recursive: true });
for (const [file, def] of Object.entries(DATA_DEFAULTS)) {
    const fp = `./data/${file}`;
    if (!fs.existsSync(fp))
        fs.writeFileSync(fp, JSON.stringify(def, null, 2));
}

let owner = [];
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
}
catch {
    owner = [];
}

global.botname = config.botName || "AMON-MD";
global.themeemoji = "•";

const pairingCode = !process.argv.includes("--qr-code");
const useMobile = process.argv.includes("--mobile");

let rl = null;
let rlClosed = false;

if (process.stdin.isTTY && !config.pairingNumber) {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('close', () => { rlClosed = true; });
}

const question = (text) => {
    if (rl && !rlClosed) {
        return new Promise((resolve) => rl.question(text, resolve));
    }
    else {
        return Promise.resolve(config.ownerNumber || phoneNumber);
    }
};

process.on('exit', () => {
    if (rl && !rlClosed)
        rl.close();
});

process.on('SIGINT', () => {
    if (rl && !rlClosed)
        rl.close();
    process.exit(0);
});

function ensureSessionDirectory() {
    const sessionPath = path.join(__dirname, 'session');
    if (!existsSync(sessionPath)) {
        mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
}

function hasValidSession() {
    try {
        const credsPath = path.join(__dirname, 'session', 'creds.json');
        if (!existsSync(credsPath))
            return false;
        const fileContent = fs.readFileSync(credsPath, 'utf8');
        if (!fileContent || fileContent.trim().length === 0) {
            printLog('warning', '[AMON-MD] creds.json exists but is empty');
            return false;
        }
        try {
            const creds = JSON.parse(fileContent);
            if (!creds.noiseKey || !creds.signedIdentityKey || !creds.signedPreKey) {
                printLog('warning', '[AMON-MD] creds.json is missing required fields');
                return false;
            }
            if (creds.registered === false) {
                printLog('warning', '[AMON-MD] Session not registered. Clearing for fresh pairing...');
                try {
                    rmSync(path.join(__dirname, 'session'), { recursive: true, force: true });
                }
                catch (_e) { /* ignore */ }
                return false;
            }
            printLog('success', '[AMON-MD] Valid and registered session credentials found');
            return true;
        }
        catch (_parseError) {
            printLog('warning', '[AMON-MD] creds.json contains invalid JSON');
            return false;
        }
    }
    catch (error) {
        printLog('error', `[AMON-MD] Error checking session validity: ${error.message}`);
        return false;
    }
}

async function initializeSession() {
    ensureSessionDirectory();
    const txt = config.sessionId;
    if (!txt) {
        if (hasValidSession()) {
            printLog('success', '[AMON-MD] Existing session found. Using saved credentials');
            return true;
        }
        return false;
    }
    if (hasValidSession())
        return true;
    try {
        await SaveCreds(txt);
        await delay(2000);
        if (hasValidSession()) {
            printLog('success', '[AMON-MD] Session file verified and valid');
            await delay(1000);
            return true;
        }
        else {
            printLog('error', '[AMON-MD] Session file not valid after download');
            return false;
        }
    }
    catch (error) {
        printLog('error', `[AMON-MD] Error downloading session: ${error.message}`);
        return false;
    }
}

server.listen(PORT, () => {
    printLog('success', `[AMON-MD] Server listening on port ${PORT}`);
});

async function startQasimDev() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        ensureSessionDirectory();
        await delay(1000);
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const _saveCreds = async () => {
            ensureSessionDirectory();
            await saveCreds();
        };
        const msgRetryCounterCache = new NodeCache();
        const ghostMode = await store.getSetting('global', 'stealthMode');
        const isGhostActive = ghostMode && ghostMode.enabled;
        const QasimDev = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: !isGhostActive,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        QasimDev.store = store;

        // ========== WRAP SEND MESSAGE WITH NEWSLETTER CONTEXT ==========
        const originalSendMessage = QasimDev.sendMessage.bind(QasimDev);
        QasimDev.sendMessage = async (jid, content, options = {}) => {
            // Don't add newsletter context to status messages
            if (jid === 'status@broadcast') {
                return originalSendMessage(jid, content, options);
            }
            
            // Add newsletter context to the message content
            if (content.text && !content.contextInfo) {
                content.contextInfo = NEWSLETTER_CONTEXT;
            } else if (content.text && content.contextInfo) {
                content.contextInfo = { ...content.contextInfo, ...NEWSLETTER_CONTEXT };
            } else if (content.caption && !content.contextInfo) {
                content.contextInfo = NEWSLETTER_CONTEXT;
            } else if (content.caption && content.contextInfo) {
                content.contextInfo = { ...content.contextInfo, ...NEWSLETTER_CONTEXT };
            }
            
            return originalSendMessage(jid, content, options);
        };

        const originalSendPresenceUpdate = QasimDev.sendPresenceUpdate;
        const originalReadMessages = QasimDev.readMessages;
        const originalSendReceipt = QasimDev.sendReceipt;

        QasimDev.sendPresenceUpdate = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                printLog('info', '[AMON-MD] 👻 Blocked presence update (stealth mode)');
                return;
            }
            return originalSendPresenceUpdate.apply(this, args);
        };

        QasimDev.readMessages = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled)
                return;
            return originalReadMessages.apply(this, args);
        };

        if (originalSendReceipt) {
            QasimDev.sendReceipt = async function (...args) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled)
                    return;
                return originalSendReceipt.apply(this, args);
            };
        }

        const originalQuery = QasimDev.query;
        QasimDev.query = async function (node, ...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                if (node && node.tag === 'receipt')
                    return;
                if (node && node.attrs && (node.attrs.type === 'read' || node.attrs.type === 'read-self'))
                    return;
            }
            return originalQuery.apply(this, [node, ...args]);
        };

        QasimDev.isGhostMode = async () => {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            return ghostMode && ghostMode.enabled;
        };

        QasimDev.ev.on('creds.update', _saveCreds);
        store.bind(QasimDev.ev);

        QasimDev.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.message)
                    return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(QasimDev, chatUpdate);
                    return;
                }
                if (!QasimDev.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup)
                        return;
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16)
                    return;
                if (QasimDev?.msgRetryCounterCache) {
                    QasimDev.msgRetryCounterCache.clear();
                }
                try {
                    await handleMessages(QasimDev, chatUpdate);
                }
                catch (err) {
                    printLog('error', `[AMON-MD] Error in handleMessages: ${err.message}`);
                    if (mek.key && mek.key.remoteJid) {
                        await QasimDev.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.',
                            contextInfo: NEWSLETTER_CONTEXT
                        }).catch(console.error);
                    }
                }
            }
            catch (err) {
                printLog('error', `[AMON-MD] Error in messages.upsert: ${err.message}`);
            }
        });

        QasimDev.decodeJid = (jid) => {
            if (!jid)
                return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return decode.user && decode.server && `${decode.user }@${ decode.server}` || jid;
            }
            else
                return jid;
        };

        QasimDev.ev.on('contacts.update', (update) => {
            for (const contact of update) {
                const id = QasimDev.decodeJid(contact.id);
                if (store && store.contacts)
                    store.contacts[id] = { id, name: contact.notify };
            }
        });

        QasimDev.getName = (jid, withoutContact = false) => {
            const id = QasimDev.decodeJid(jid);
            withoutContact = QasimDev.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us"))
                return new Promise(async (resolve) => {
                    v = store.contacts[id] || {};
                    if (!(v.name || v.subject))
                        v = QasimDev.groupMetadata(id) || {};
                    resolve(v.name || v.subject || PhoneNumber(`+${ id.replace('@s.whatsapp.net', '')}`).number?.international);
                });
            else
                v = id === '0@s.whatsapp.net' ? {
                    id,
                    name: 'WhatsApp'
                } : id === QasimDev.decodeJid(QasimDev.user.id) ?
                    QasimDev.user :
                    (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber(`+${ jid.replace('@s.whatsapp.net', '')}`).number?.international;
        };

        QasimDev.public = true;
        QasimDev.serializeM = (m) => smsg(QasimDev, m, store);

        const isRegistered = state.creds?.registered === true;

        if (pairingCode && !isRegistered) {
            if (useMobile)
                throw new Error('[AMON-MD] Cannot use pairing code with mobile api');
            let phoneNumberInput;
            if (config.pairingNumber) {
                phoneNumberInput = config.pairingNumber;
            }
            else if (process.env.PAIRING_NUMBER) {
                phoneNumberInput = process.env.PAIRING_NUMBER;
            }
            else if (rl && !rlClosed) {
                phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`📱 [AMON-MD] Please type your WhatsApp number:\n➤ Format: 254759XXXXXX (without + or spaces): `)));
            }
            else {
                phoneNumberInput = phoneNumber;
                printLog('info', `[AMON-MD] Using default phone number: ${phoneNumberInput}`);
            }
            phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '');
            const pn = PhoneNumber(`+${ phoneNumberInput}`);
            if (!pn.valid) {
                printLog('error', '[AMON-MD] Invalid phone number format');
                if (rl && !rlClosed)
                    rl.close();
                process.exit(1);
            }
            const doPairing = async (num, attempt = 1) => {
                try {
                    let code = await QasimDev.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
                    printLog('success', `[AMON-MD] Pairing code generated: ${code}`);
                    if (rl && !rlClosed) {
                        rl.close();
                        rl = null;
                    }
                }
                catch (error) {
                    if (attempt < 3) {
                        try {
                            rmSync('./session', { recursive: true, force: true });
                        }
                        catch (_e) { /* ignore */ }
                        await delay(3000);
                        startQasimDev();
                    }
                    else {
                        printLog('error', '[AMON-MD] All 3 pairing attempts failed. Please restart manually.');
                    }
                }
            };
            setTimeout(() => doPairing(phoneNumberInput), 3000);
        }
        else if (isRegistered) {
            if (rl && !rlClosed) {
                rl.close();
                rl = null;
            }
        }
        else {
            printLog('warning', '[AMON-MD] Waiting for connection to establish...');
            if (rl && !rlClosed) {
                rl.close();
                rl = null;
            }
        }

        QasimDev.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;
            if (qr) {
                if (!pairingCode) {
                    try {
                        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
                    }
                    catch (_e) {
                        console.log('QR:', qr);
                    }
                }
            }
            if (connection === "open") {
                printLog('success', '[AMON-MD] Bot connected successfully!');
                try {
                    const setbioModule = await import('./plugins/setbio.js');
                    const startAutoBio = setbioModule.startAutoBio || setbioModule.default?.startAutoBio;
                    if (typeof startAutoBio === 'function')
                        startAutoBio(QasimDev);
                }
                catch (e) {
                    printLog('error', `[AMON-MD] Failed to start auto bio: ${e.message}`);
                }
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    printLog('info', '[AMON-MD] 👻 STEALTH MODE ACTIVE');
                }
                printLog('success', `[AMON-MD] Connected to => ${ JSON.stringify(QasimDev.user, null, 2)}`);
                
                try {
                    const botNumber = `${QasimDev.user.id.split(':')[0] }@s.whatsapp.net`;
                    const ghostStatus = (ghostMode && ghostMode.enabled) ? 'ACTIVE' : '';
                    const connectionMessage = buildConnectionMessage(config.botName || 'AMON-MD', ghostStatus);
                    
                    const imagePath = path.join(process.cwd(), 'assets/thumb.png');
                    if (fs.existsSync(imagePath)) {
                        await QasimDev.sendMessage(botNumber, {
                            image: { url: imagePath },
                            caption: connectionMessage,
                            contextInfo: NEWSLETTER_CONTEXT
                        });
                    } else {
                        await QasimDev.sendMessage(botNumber, {
                            text: connectionMessage,
                            contextInfo: NEWSLETTER_CONTEXT
                        });
                    }
                }
                catch (error) {
                    printLog('error', `[AMON-MD] Failed to send connection message: ${error.message}`);
                }
                
                await delay(1999);
                try {
                    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
                }
                catch (_e) { }
                printLog('info', `[ ${config.botName || 'AMON-MD'} ]`);
                printLog('info', `WA NUMBER  : ${owner[0] || config.ownerNumber || ''}`);
                printLog('success', `[AMON-MD] Bot Connected Successfully!`);
                printLog('info', `[AMON-MD] Plugins   : ${commandHandler.commands.size}`);
                printLog('info', `[AMON-MD] Prefixes   : ${config.prefixes.join(', ')}`);
                printLog('store', `[AMON-MD] Backend    : ${store.getStats().backend}`);
                console.log();
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync('./session', { recursive: true, force: true });
                    }
                    catch (_e) { /* ignore */ }
                    await delay(3000);
                    startQasimDev();
                    return;
                }
                if (shouldReconnect) {
                    printLog('connection', '[AMON-MD] Reconnecting in 5 seconds...');
                    await delay(5000);
                    startQasimDev();
                }
            }
        });

        QasimDev.ev.on('call', async (calls) => {
            await handleCall(QasimDev, calls);
        });

        QasimDev.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(QasimDev, update);
        });

        QasimDev.ev.on('status.update', async (status) => {
            await handleStatus(QasimDev, status);
        });

        QasimDev.ev.on('messages.reaction', async (reaction) => {
            await handleStatus(QasimDev, reaction);
        });

        return QasimDev;
    }
    catch (error) {
        printLog('error', `[AMON-MD] Error in startQasimDev: ${error.message}`);
        if (rl && !rlClosed) {
            rl.close();
            rl = null;
        }
        await delay(5000);
        startQasimDev();
    }
}

async function main() {
    await compileAll();
    await commandHandler.loadCommands();
    printLog('info', '[AMON-MD] Starting AMON MD BOT...');
    await initializeSession();
    await delay(3000);
    startQasimDev().catch((error) => {
        printLog('error', `[AMON-MD] Fatal error: ${error.message}`);
        if (rl && !rlClosed)
            rl.close();
        process.exit(1);
    });
}

main();

// Session cleanup interval
const sessionDir = path.join(process.cwd(), 'session');
setInterval(() => {
    if (!fs.existsSync(sessionDir))
        return;
    fs.readdir(sessionDir, (err, files) => {
        if (err)
            return;
        for (const file of files) {
            if (file === 'creds.json')
                continue;
            if (file.startsWith('app-state-sync-key-'))
                continue;
            fs.unlink(path.join(sessionDir, file), () => { });
        }
    });
}, 3 * 60 * 1000);

// Temp folder setup
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp))
    fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Temp folder cleanup
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err)
            return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
}, 1 * 60 * 60 * 1000);

// Syntax check dist files
const folders = [
    path.join(__dirname, './lib'),
    path.join(__dirname, './plugins')
];

folders.forEach(folder => {
    if (!fs.existsSync(folder))
        return;
    fs.readdirSync(folder)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
        const filePath = path.join(folder, file);
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            const err = syntaxerror(code, file, {
                sourceType: 'module',
                allowAwaitOutsideFunction: true
            });
            if (err) {
                console.error(chalk.red(`❌ [AMON-MD] Syntax error in ${filePath}:\n${err}`));
            }
        }
        catch (e) {
            console.error(chalk.yellow(`⚠️ [AMON-MD] Cannot read file ${filePath}:\n${e}`));
        }
    });
});

// Error handlers
process.on('uncaughtException', (err) => {
    printLog('error', `[AMON-MD] Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'uncaughtException',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});

process.on('unhandledRejection', (err) => {
    printLog('error', `[AMON-MD] Unhandled Rejection: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'unhandledRejection',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        printLog('error', `[AMON-MD] Address localhost:${PORT} in use`);
        writeErrorLog({
            type: 'serverError',
            error: `Address localhost:${PORT} in use`,
            timestamp: new Date().toISOString()
        });
        server.close();
    }
    else {
        printLog('error', `[AMON-MD] Server error: ${error.message}`);
        writeErrorLog({
            type: 'serverError',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});
