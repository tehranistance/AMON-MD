import config from '../config.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

export default {
    command: 'alive',
    aliases: ['status', 'bot', 'health'],
    category: 'general',
    description: 'Check bot status',
    usage: '.alive',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const imagePath = path.join(process.cwd(), 'assets/thumb.png');
        
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
        
        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Nairobi'
        });
        
        const responseText = `╭━━━ ⟮ ${config.botName || 'AMON-MD'} ⟯━━━━━━┈⊷
┃✵│ 🟢 Bot is alive
┃✵│ 🕐 Time: ${time}
┃✵│ ⏱️ Uptime: ${hours}h ${minutes}m
┃✵│ 💾 RAM: ${usedMem}/${totalMem}MB
┃✵│ 📦 Node: ${process.version}
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