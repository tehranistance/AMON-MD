import config from '../config.js';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');

export default {
    command: 'delprefix',
    aliases: ['removeprefix', 'rmprefix'],
    category: 'owner',
    description: 'Remove a command prefix',
    usage: '.delprefix !',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        
        if (!args.length) {
            return sock.sendMessage(chatId, {
                text: `🔧 *Current Prefixes:* ${config.prefixes.join(', ')}\n\n📌 *Usage:* .delprefix /`
            }, { quoted: message });
        }
        
        const removePrefix = args[0].trim();
        
        if (!config.prefixes.includes(removePrefix)) {
            return sock.sendMessage(chatId, {
                text: `❌ Prefix "${removePrefix}" not found!`
            }, { quoted: message });
        }
        
        if (config.prefixes.length === 1) {
            return sock.sendMessage(chatId, {
                text: `❌ Cannot delete the last prefix! At least one prefix is required.`
            }, { quoted: message });
        }
        
        // Update runtime config
        config.prefixes = config.prefixes.filter(p => p !== removePrefix);
        config.prefix = config.prefixes[0];
        
        // Update .env file
        let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
        if (envContent.match(/^PREFIXES=/m)) {
            envContent = envContent.replace(/^PREFIXES=.*$/m, `PREFIXES=${config.prefixes.join(',')}`);
        } else {
            envContent += `\nPREFIXES=${config.prefixes.join(',')}\n`;
        }
        fs.writeFileSync(ENV_PATH, envContent);
        
        await sock.sendMessage(chatId, {
            text: `✅ *Prefix Removed*\n\n❌ Removed: ${removePrefix}\n📋 Remaining: ${config.prefixes.join(', ')}`
        }, { quoted: message });
    }
};