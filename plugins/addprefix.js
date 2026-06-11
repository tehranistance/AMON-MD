import config from '../config.js';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env');

export default {
    command: 'addprefix',
    aliases: ['addpre'],
    category: 'owner',
    description: 'Add a new command prefix',
    usage: '.addprefix @',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        
        if (!args.length) {
            return sock.sendMessage(chatId, {
                text: `🔧 *Current Prefixes:* ${config.prefixes.join(', ')}\n\n📌 *Usage:* .addprefix ?`
            }, { quoted: message });
        }
        
        const newPrefix = args[0].trim();
        
        if (config.prefixes.includes(newPrefix)) {
            return sock.sendMessage(chatId, {
                text: `❌ Prefix "${newPrefix}" already exists!`
            }, { quoted: message });
        }
        
        // Update runtime config
        config.prefixes.push(newPrefix);
        
        // Update .env file
        let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
        if (envContent.match(/^PREFIXES=/m)) {
            envContent = envContent.replace(/^PREFIXES=.*$/m, `PREFIXES=${config.prefixes.join(',')}`);
        } else {
            envContent += `\nPREFIXES=${config.prefixes.join(',')}\n`;
        }
        fs.writeFileSync(ENV_PATH, envContent);
        
        await sock.sendMessage(chatId, {
            text: `✅ *Prefix Added*\n\n➕ Added: ${newPrefix}\n📋 All prefixes: ${config.prefixes.join(', ')}`
        }, { quoted: message });
    }
};