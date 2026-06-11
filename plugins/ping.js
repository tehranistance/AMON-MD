import config from '../config.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

export default {
    command: 'ping',
    aliases: ['pong', 'latency'],
    category: 'general',
    description: 'Check bot response time',
    usage: '.ping',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const imagePath = path.join(process.cwd(), 'assets/thumb.png');
        
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '🏓 Pinging...' }, { quoted: message });
        const latency = Date.now() - start;
        
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        let statusEmoji = '🟢';
        if (latency > 500) statusEmoji = '🟡';
        if (latency > 1000) statusEmoji = '🔴';
        
        const responseText = `╭━━━ ⟮ PONG! ⟯━━━━━━┈⊷
┃✵│ ${statusEmoji} Latency: ${latency}ms
┃✵│ 💾 RAM: ${usedMem}/${totalMem}MB
┃✵│ ⏰ Uptime: ${hours}h ${minutes}m
┃✵│ 🤖 ${config.botName || 'AMON-MD'}
╰━━━━━━━━━━━━━━━━━━┈⊷`;
        
        if (fs.existsSync(imagePath)) {
            await sock.sendMessage(chatId, {
                image: { url: imagePath },
                caption: responseText,
                ...channelInfo
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: responseText, ...channelInfo }, { quoted: message });
        }
    }
};