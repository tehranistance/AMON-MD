import config from '../config.js';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');

export default {
    command: 'setprefix',
    aliases: ['changeprefix'],
    category: 'owner',
    description: 'Set new command prefixes (replaces all)',
    usage: '.setprefix .,!,/,#',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        
        if (!args.length) {
            return sock.sendMessage(chatId, {
                text: `🔧 *Current Prefixes:* ${config.prefixes.join(', ')}\n\n📌 *Usage:* .setprefix .,!,/`
            }, { quoted: message });
        }
        
        let newPrefixes = args.join(' ').split(',');
        newPrefixes = newPrefixes.map(p => p.trim()).filter(p => p.length > 0);
        
        if (newPrefixes.length === 0) {
            return sock.sendMessage(chatId, { text: '❌ Invalid format. Use: .setprefix .,!,/' }, { quoted: message });
        }
        
        // Update runtime config
        config.prefixes = newPrefixes;
        config.prefix = newPrefixes[0];
        
        // Update .env file
        let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
        if (envContent.match(/^PREFIXES=/m)) {
            envContent = envContent.replace(/^PREFIXES=.*$/m, `PREFIXES=${newPrefixes.join(',')}`);
        } else {
            envContent += `\nPREFIXES=${newPrefixes.join(',')}\n`;
        }
        fs.writeFileSync(ENV_PATH, envContent);
        
        await sock.sendMessage(chatId, {
            text: `✅ *Prefixes Updated*\n\nOld: ${config.prefixes.join(', ')}\nNew: ${newPrefixes.join(', ')}`
        }, { quoted: message });
    }
};