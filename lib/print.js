import chalk from 'chalk';
import PhoneNumber, { parsePhoneNumber } from 'awesome-phonenumber';
import config from '../config.js';

function extractPhoneNumber(jid) {
    if (!jid) return null;
    const number = jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '').split(':')[0];
    if (number.length < 10 && jid.includes('@lid')) return null;
    return number;
}

async function getNameWithFallback(jid, sock, pushName) {
    try {
        if (pushName && pushName.trim()) return pushName.trim();
        if (sock.store?.contacts?.[jid]) {
            const contact = sock.store.contacts[jid];
            if (contact.name || contact.notify) return contact.name || contact.notify;
        }
        const phone = extractPhoneNumber(jid);
        if (phone && phone.length >= 10) {
            const pn = PhoneNumber(`+${phone}`);
            if (pn.valid) return null;
        }
        return jid.split('@')[0].split(':')[0];
    } catch (e) {
        return jid.split('@')[0].split(':')[0];
    }
}

async function printMessage(message, sock) {
    try {
        if (!message?.key) return;
        
        const m = message;
        const chatId = m.key.remoteJid;
        const senderId = m.key.participant || m.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const fromMe = m.key.fromMe;
        
        let senderName = '', senderPhone = '';
        
        try {
            if (fromMe) {
                senderName = sock.user?.name || 'Owner';
                const botNumber = extractPhoneNumber(sock.user?.id || sock.user?.jid);
                if (botNumber) {
                    const pn = parsePhoneNumber(`+${botNumber}`);
                    senderPhone = pn.valid ? pn.number?.international || botNumber : botNumber;
                }
            } else {
                senderName = await getNameWithFallback(senderId, sock, m.pushName);
                const phone = extractPhoneNumber(senderId);
                if (phone && phone.length >= 10) {
                    const pn = PhoneNumber(`+${phone}`);
                    senderPhone = pn.valid ? pn.getNumber('international') : phone;
                } else {
                    senderPhone = senderId.split('@')[0].split(':')[0];
                }
            }
        } catch (e) {
            senderName = m.pushName || senderId.split('@')[0];
            senderPhone = senderId.split('@')[0].split(':')[0];
        }
        
        let chatName = null;
        try {
            if (isGroup) {
                const metadata = await sock.groupMetadata(chatId).catch(() => null);
                chatName = metadata?.subject || null;
            }
        } catch (e) { chatName = null; }
        
        const messageType = Object.keys(m.message || {})[0];
        let messageText = '', fileSize = 0;
        let shouldSkipLog = false;
        
        if (messageType === 'senderKeyDistributionMessage' || messageType === 'protocolMessage' || messageType === 'reactionMessage') {
            shouldSkipLog = true;
        }
        if (shouldSkipLog) return;
        
        const messageTypeLabels = {
            conversation: 'TEXT', extendedTextMessage: 'TEXT', imageMessage: 'IMAGE',
            videoMessage: 'VIDEO', audioMessage: 'AUDIO', documentMessage: 'DOCUMENT',
            stickerMessage: 'STICKER', contactMessage: 'CONTACT', locationMessage: 'LOCATION'
        };
        
        if (m.message) {
            if (messageType === 'conversation') {
                messageText = m.message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                messageText = m.message.extendedTextMessage?.text || '';
            } else if (messageType === 'imageMessage') {
                messageText = m.message.imageMessage?.caption || '[Image]';
                fileSize = m.message.imageMessage?.fileLength || 0;
            } else if (messageType === 'videoMessage') {
                messageText = m.message.videoMessage?.caption || '[Video]';
                fileSize = m.message.videoMessage?.fileLength || 0;
            } else if (messageType === 'audioMessage') {
                const duration = m.message.audioMessage?.seconds || 0;
                messageText = `[Audio ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}]`;
                fileSize = m.message.audioMessage?.fileLength || 0;
            } else if (messageType === 'documentMessage') {
                const fileName = m.message.documentMessage?.fileName || 'Document';
                messageText = `[📄 ${fileName}]`;
                fileSize = m.message.documentMessage?.fileLength || 0;
            } else if (messageType === 'stickerMessage') {
                messageText = '[Sticker]';
                fileSize = m.message.stickerMessage?.fileLength || 0;
            } else if (messageType === 'contactMessage') {
                messageText = `[👤 ${m.message.contactMessage?.displayName || 'Contact'}]`;
            } else if (messageType === 'locationMessage') {
                messageText = '[📍 Location]';
            } else {
                messageText = `[${messageType.replace('Message', '')}]`;
            }
        }
        
        let fileSizeStr = '';
        if (fileSize > 0) {
            const units = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(fileSize) / Math.log(1024));
            fileSizeStr = ` (${(fileSize / Math.pow(1024, i)).toFixed(1)} ${units[i]})`;
        }
        
        const timestamp = m.messageTimestamp ? new Date((m.messageTimestamp.low || m.messageTimestamp) * 1000) : new Date();
        const timeStr = timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: config.timeZone || 'Africa/Nairobi'
        });
        
        const isCommand = messageText.startsWith('.') || messageText.startsWith('!') || messageText.startsWith('#') || messageText.startsWith('/');
        const displayType = messageTypeLabels[messageType] || messageType.replace('Message', '').toUpperCase();
        
        // Minimized menu style
        const line = chalk.hex('#00D9FF');
        console.log(line('╭─────────────────────────────────────'));
        console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Time')} ${chalk.white(':')} ${chalk.green(timeStr)}`);
        console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Type')} ${chalk.white(':')} ${chalk.magenta(displayType)}${chalk.gray(fileSizeStr)}`);
        console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim(fromMe ? 'From' : 'Sender')} ${chalk.white(':')} ${fromMe ? chalk.green(`ME (${senderPhone})`) : chalk.yellow(senderName && senderName !== senderPhone ? `${senderName} (${senderPhone})` : senderPhone)}`);
        
        if (isGroup && chatName) {
            console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Group')} ${chalk.white(':')} ${chalk.blue(chatName)}`);
        } else if (!isGroup) {
            console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Chat')} ${chalk.white(':')} ${chalk.magenta('Private Chat')}`);
        }
        
        if (messageText) {
            const maxLen = 60;
            const displayText = messageText.length > maxLen ? `${messageText.substring(0, maxLen)}...` : messageText;
            const isBotRes = messageText.includes('AMON-MD') || messageText.includes('Pinging...') || messageText.includes('*🤖') || (fromMe && messageText.includes('*'));
            console.log(line('┣─────────────────────────────────────'));
            console.log(`${line('┃')} ${chalk.yellow('◉')} ${chalk.dim('MSG')} ${chalk.white(':')}`);
            console.log(`${line('┃')}   ${isCommand ? chalk.greenBright(displayText) : isBotRes ? chalk.cyan(displayText) : fromMe ? chalk.blueBright(displayText) : chalk.white(displayText)}`);
        }
        
        console.log(line('╰─────────────────────────────────────'));
        console.log();
        
    } catch (error) {
        console.log(chalk.red('❌'), error.message);
    }
}

function printLog(type, message) {
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: config.timeZone || 'Africa/Nairobi'
    });
    
    const colors = { info: chalk.blue, success: chalk.green, warning: chalk.yellow, error: chalk.red, connection: chalk.cyan, store: chalk.magenta };
    const icons = { info: '💡', success: '✅', warning: '⚠️', error: '❌', connection: '🔌', store: '🗄️' };
    const color = colors[type] || chalk.white;
    const icon = icons[type] || '◉';
    const line = chalk.hex('#00D9FF');
    
    console.log(line('╭─────────────────────────────────────'));
    console.log(`${line('┃')} ${color(icon)} ${color(type.toUpperCase())}`);
    console.log(line('┣─────────────────────────────────────'));
    console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Time')} ${chalk.white(':')} ${chalk.green(timestamp)}`);
    console.log(`${line('┃')} ${chalk.cyan('◉')} ${chalk.dim('Msg')} ${chalk.white(':')} ${color(message)}`);
    console.log(line('╰─────────────────────────────────────'));
}

export { printMessage, printLog };