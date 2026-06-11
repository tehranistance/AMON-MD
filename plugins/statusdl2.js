import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
    command: 'ss2',
    aliases: ['🙂', 'okay', 'hi','status2'],
    category: 'owner',
    description: 'Download quoted Status updates and send to owner DM',
    usage: 'Reply to a status and type .status3',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const ownerNumber = await sock.decodeJid(sock.user.id);
        const m = message.message;
        const type = Object.keys(m)[0];
        const contextInfo = m[type]?.contextInfo;
        
        if (!contextInfo || contextInfo.remoteJid !== 'status@broadcast') {
            return;
        }
        
        const quotedMsg = contextInfo.quotedMessage;
        if (!quotedMsg) return;
        
        try {
            const quotedType = Object.keys(quotedMsg)[0];
            const mediaData = quotedMsg[quotedType];
            
            if (quotedType === 'conversation' || quotedType === 'extendedTextMessage') {
                const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
                await sock.sendMessage(ownerNumber, { 
                    text: `📝 *Status Text*\n\n${text}` 
                });
            }
            else {
                const stream = await downloadContentFromMessage(mediaData, quotedType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                
                if (quotedType === 'imageMessage') {
                    await sock.sendMessage(ownerNumber, { 
                        image: buffer, 
                        caption: mediaData.caption || '' 
                    });
                }
                else if (quotedType === 'videoMessage') {
                    await sock.sendMessage(ownerNumber, { 
                        video: buffer, 
                        caption: mediaData.caption || '' 
                    });
                }
            }
        }
        catch (e) {
            // Silent fail
        }
    }
};