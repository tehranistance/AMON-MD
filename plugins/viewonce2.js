import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
    command: 'vv2',
    aliases: ['wah', 'ohh', 'oho', 'nice', 'ok'],
    category: 'owner',
    description: 'Owner Only - retrieve quoted view once message to bot DM',
    usage: '.vv2 (reply to view once message)',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const botNumber = await sock.decodeJid(sock.user.id);
        
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedImage = quoted?.imageMessage;
            const quotedVideo = quoted?.videoMessage;
            const quotedAudio = quoted?.audioMessage;
            
            if (quotedImage && quotedImage.viewOnce) {
                const stream = await downloadContentFromMessage(quotedImage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream)
                    buffer = Buffer.concat([buffer, chunk]);
                
                await sock.sendMessage(botNumber, {
                    image: buffer,
                    fileName: 'media.jpg'
                });
            }
            else if (quotedVideo && quotedVideo.viewOnce) {
                const stream = await downloadContentFromMessage(quotedVideo, 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream)
                    buffer = Buffer.concat([buffer, chunk]);
                
                await sock.sendMessage(botNumber, {
                    video: buffer,
                    fileName: 'media.mp4'
                });
            }
            else if (quotedAudio && quotedAudio.viewOnce) {
                const stream = await downloadContentFromMessage(quotedAudio, 'audio');
                let buffer = Buffer.from([]);
                for await (const chunk of stream)
                    buffer = Buffer.concat([buffer, chunk]);
                
                await sock.sendMessage(botNumber, {
                    audio: buffer,
                    mimetype: 'audio/mp4',
                    ptt: false
                });
            }
        }
        catch (error) {
            // Silent fail
        }
    }
};