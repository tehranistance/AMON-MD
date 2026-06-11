import config from '../config.js';
import CommandHandler from '../lib/commandHandler.js';
import fs from 'fs';
import path from 'path';

const menuEmojis = ['✨', '🌟', '⭐', '💫', '🎯', '🎨', '🎪', '🎭'];
const activeEmojis = ['✅', '🟢', '💚', '✔️', '☑️'];
const disabledEmojis = ['❌', '🔴', '⛔', '🚫', '❎'];
const fastEmojis = ['⚡', '🚀', '💨', '⏱️', '🔥'];
const slowEmojis = ['🐢', '🐌', '⏳', '⌛', '🕐'];

const categoryEmojis = {
    general: ['📱', '🔧', '⚙️', '🛠️'],
    owner: ['👑', '🔱', '💎', '🎖️'],
    admin: ['🛡️', '⚔️', '🔐', '👮'],
    group: ['👥', '👫', '🧑‍🤝‍🧑', '👨‍👩‍👧‍👦'],
    download: ['📥', '⬇️', '💾', '📦'],
    ai: ['🤖', '🧠', '💭', '🎯'],
    search: ['🔍', '🔎', '🕵️', '📡'],
    apks: ['📲', '📦', '💿', '🗂️'],
    info: ['ℹ️', '📋', '📊', '📄'],
    fun: ['🎮', '🎲', '🎰', '🎪'],
    stalk: ['👀', '🔭', '🕵️', '🎯'],
    games: ['🎮', '🕹️', '🎯', '🏆'],
    images: ['🖼️', '📸', '🎨', '🌄'],
    menu: ['📜', '📋', '📑', '📚'],
    tools: ['🔨', '🔧', '⚡', '🛠️'],
    stickers: ['🎭', '😀', '🎨', '🖼️'],
    quotes: ['💬', '📖', '✍️', '💭'],
    music: ['🎵', '🎶', '🎧', '🎤'],
    utility: ['📂', '🔧', '⚙️', '🛠️']
};

function getRandomEmoji(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getCategoryEmoji(category) {
    const emojis = categoryEmojis[category.toLowerCase()] || ['📂', '📁', '🗂️', '📋'];
    return getRandomEmoji(emojis);
}

function formatTime() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: config.timeZone || 'UTC'
    };
    return now.toLocaleTimeString('en-US', options);
}

export default {
    command: 'smenu',
    aliases: ['shelp', 'smart', 'help2'],
    category: 'general',
    description: 'Interactive smart menu with live status',
    usage: '.smenu',
    isPrefixless: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        
        try {
            const imagePath = path.join(process.cwd(), 'assets/thumb.png');
            const thumbnail = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
            
            const categories = Array.from(CommandHandler.categories.keys());
            const stats = CommandHandler.getDiagnostics();
            
            const menuEmoji = getRandomEmoji(menuEmojis);
            const activeEmoji = getRandomEmoji(activeEmojis);
            const disabledEmoji = getRandomEmoji(disabledEmojis);
            const fastEmoji = getRandomEmoji(fastEmojis);
            const slowEmoji = getRandomEmoji(slowEmojis);
            
            // UNIQUE STYLE 1 - Neon Gothic
            let menuText = `◢◤◢◤◢◤ ${menuEmoji} *${config.botName || 'AMON-MD'}* ${menuEmoji} ◢◤◢◤◢◤\n\n`;
            menuText += `◈╭━━━━━━━━━━━━━━━━╮◈\n`;
            menuText += `◈┃ 📱 ${config.botName || 'AMON-MD'}\n`;
            menuText += `◈┃ 🔖 v${config.version || '6.0.0'}\n`;
            menuText += `◈┃ 👤 ${config.botOwner || 'Unknown'}\n`;
            menuText += `◈┃ ⏰ ${formatTime()}\n`;
            menuText += `◈┃ ℹ️ ${config.prefixes ? config.prefixes.join(', ') : '.'}\n`;
            menuText += `◈┃ 📊 ${CommandHandler.commands.size} plugins\n`;
            menuText += `◈╰━━━━━━━━━━━━━━━━╯◈\n\n`;
            
            const topCmds = stats.slice(0, 3).filter(s => s.usage > 0);
            if (topCmds.length > 0) {
                menuText += `▀▄▀▄ *TOP COMMANDS* ▄▀▄▀\n`;
                topCmds.forEach((c, i) => {
                    const rank = i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉';
                    menuText += `  ${rank} .${c.command} • ${c.usage} uses\n`;
                });
                menuText += `\n`;
            }
            
            for (const cat of categories) {
                const catEmoji = getCategoryEmoji(cat);
                menuText += `⫸⫷ ${catEmoji} *${cat.toUpperCase()}* ⫸⫷\n`;
                menuText += `┏━━━━━━━━━━━━━━━━━━┓\n`;
                const catCmds = CommandHandler.getCommandsByCategory(cat);
                catCmds.forEach((cmdName, index) => {
                    const isLast = index === catCmds.length - 1;
                    const prefix = isLast ? '┗' : '┃';
                    const isOff = CommandHandler.disabledCommands.has(cmdName.toLowerCase());
                    const cmdStats = stats.find(s => s.command === cmdName.toLowerCase());
                    const statusIcon = isOff ? disabledEmoji : activeEmoji;
                    let speedTag = '';
                    if (cmdStats && !isOff) {
                        const ms = parseFloat(cmdStats.average_speed);
                        if (ms > 0 && ms < 100)
                            speedTag = ` ${fastEmoji}`;
                        else if (ms > 1000)
                            speedTag = ` ${slowEmoji}`;
                    }
                    menuText += `${prefix}  ${statusIcon} .${cmdName}${speedTag}\n`;
                });
                menuText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            }
            
            menuText += `◈✧━━━━━━ *LEGEND* ━━━━━✧◈\n`;
            menuText += `◈┃ ${activeEmoji} Active\n`;
            menuText += `◈┃ ${disabledEmoji} Disabled\n`;
            menuText += `◈┃ ${fastEmoji} Fast\n`;
            menuText += `◈┃ ${slowEmoji} Slow\n`;
            menuText += `◈┗━━━━━━━━━━━━━━━━┛◈`;
            
            const contextInfo = {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363406476499117@newsletter',
                    newsletterName: 'AmonTech',
                    serverMessageId: -1
                }
            };
            
            const messageOptions = thumbnail
                ? { image: thumbnail, caption: menuText, contextInfo }
                : { text: menuText, contextInfo };
            
            await sock.sendMessage(chatId, messageOptions, { quoted: message });
        } catch (error) {
            console.error('Menu Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Menu Error*\n\n${error.message}`
            }, { quoted: message });
        }
    }
};