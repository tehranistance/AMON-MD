import commandHandler from '../lib/commandHandler.js';
import path from 'path';
import fs from 'fs';
import config from '../config.js';

export default {
    command: 'list',
    aliases: ['cmdlist', 'commandslist', 'allcmds'],
    category: 'general',
    description: 'List all commands with descriptions and aliases',
    usage: '.list',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const prefix = config.prefixes[0];
        const imagePath = path.join(process.cwd(), 'assets/thumb.png');
        
        try {
            // Get all commands
            const commands = commandHandler.commands;
            const categories = {};
            
            // Group commands by category
            for (const [cmdName, cmd] of commands) {
                const category = cmd.category || 'general';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push({
                    name: cmd.command || cmdName,
                    aliases: cmd.aliases || [],
                    description: cmd.description || 'No description',
                    usage: cmd.usage || `${prefix}${cmd.command || cmdName}`
                });
            }
            
            // Category display order
            const categoryOrder = {
                'general': 1,
                'ai': 2,
                'group': 3,
                'admin': 4,
                'owner': 5,
                'music': 6,
                'download': 7,
                'fun': 8,
                'utility': 9,
                'tools': 10,
                'anime': 11,
                'media': 12,
                'converter': 13,
                'search': 14,
                'other': 99
            };
            
            // Sort categories
            const orderedCats = Object.keys(categories).sort((a, b) => {
                const orderA = categoryOrder[a.toLowerCase()] || 99;
                const orderB = categoryOrder[b.toLowerCase()] || 99;
                return orderA - orderB;
            });
            
            // Category emoji mapping
            const categoryEmojis = {
                'general': '📌',
                'ai': '🧠',
                'group': '👥',
                'admin': '🛡️',
                'owner': '👑',
                'music': '🎵',
                'download': '📥',
                'fun': '🎮',
                'utility': '🔧',
                'tools': '🔨',
                'anime': '🎌',
                'media': '🎬',
                'converter': '🔄',
                'search': '🔍',
                'other': '📁'
            };
            
            // Fancy text functions (same as menu)
            function toFancyUppercase(text) {
                const fonts = {
                    'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌',
                    'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙'
                };
                return text.split('').map(char => fonts[char] || char).join('');
            }
            
            function toFancyLowercase(text) {
                const fonts = {
                    "a": "ᴀ", "b": "ʙ", "c": "ᴄ", "d": "ᴅ", "e": "ᴇ", "f": "ꜰ", "g": "ɢ", "h": "ʜ", "i": "ɪ", "j": "ᴊ", "k": "ᴋ", "l": "ʟ", "m": "ᴍ", 
                    "n": "ɴ", "o": "ᴏ", "p": "ᴘ", "q": "ϙ", "r": "ʀ", "s": "ꜱ", "t": "ᴛ", "u": "ᴜ", "v": "ᴠ", "w": "ᴡ", "x": "x", "y": "ʏ", "z": "ᴢ"
                };
                return text.split('').map(char => fonts[char.toLowerCase()] || fonts[char] || char).join('');
            }
            
            // Build menu text with fancy styling
            let menuText = `╭━━━  ⟮  ${config.botName || 'AMON-MD'} COMMANDS ⟯━━━━━━┈⊷\n`;
            menuText += `┃✵╭──────────────\n`;
            menuText += `┃✵│ ◆ ᴘʀᴇғɪx: ${prefix}\n`;
            menuText += `┃✵│ ◆ ᴛᴏᴛᴀʟ: ${commands.size} ᴄᴏᴍᴍᴀɴᴅs\n`;
            menuText += '┃✵╰──────────────\n';
            menuText += '╰━━━━━━━━━━━━━━━━━━┈⊷\n\n';
            
            menuText += '━━━━━━━━━━━━━━━━━━━━\n';
            menuText += '*┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃:*\n\n';
            
            for (const cat of orderedCats) {
                const emoji = categoryEmojis[cat.toLowerCase()] || '📁';
                const fancyCat = toFancyUppercase(cat.toUpperCase());
                menuText += ` ╭─────「 ${emoji} ${fancyCat} 」───┈⊷ \n`;
                
                for (const cmd of categories[cat]) {
                    const fancyCmd = toFancyLowercase(cmd.name);
                    const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.map(a => prefix + a).join(', ')})` : '';
                    const desc = cmd.description;
                    
                    menuText += ` ││◦➛  *${prefix}${fancyCmd}*${aliases}\n`;
                    menuText += ` ││    └─ ${desc}\n`;
                    menuText += ` ││\n`;
                }
                
                menuText += ' ╰──────────────┈⊷ \n\n';
            }
            
            menuText += '━━━━━━━━━━━━━━━━━━━━\n';
            menuText += '*┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃𒊹┃:*\n\n';
            menuText += ` ╭─────「 💡 TIP 」───┈⊷ \n`;
            menuText += ` ││◦➛  Use ${prefix}help <command>\n`;
            menuText += ` ││    └─ Get detailed command info\n`;
            menuText += ' ╰──────────────┈⊷ \n\n';
            
            menuText += `╭━━━  ⟮  POWERED BY ⟯━━━━━━┈⊷\n`;
            menuText += `┃✵╭──────────────\n`;
            menuText += `┃✵│ ✨ ${(config.botName || 'AMON-MD').toUpperCase()} ✨\n`;
            menuText += '┃✵╰──────────────\n';
            menuText += '╰━━━━━━━━━━━━━━━━━━┈⊷';
            
            // Send as document if too long
            if (menuText.length > 32000) {
                await sock.sendMessage(chatId, {
                    document: Buffer.from(menuText),
                    fileName: 'commands_list.txt',
                    mimetype: 'text/plain',
                    caption: `📋 *${config.botName} Commands List*\nTotal: ${commands.size} commands`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
            }
            
        } catch (error) {
            console.error('List command error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to load commands list. Please try again later.' 
            }, { quoted: message });
        }
    }
};