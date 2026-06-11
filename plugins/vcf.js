import fs from 'fs';
import path from 'path';

export default {
    command: 'vcf',
    aliases: ['exportgroup', 'groupcontacts'],
    category: 'group',
    description: 'Export all group members to VCF contacts file',
    usage: '.vcf',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            return sock.sendMessage(chatId, {
                text: '❌ This command can only be used in groups.'
            }, { quoted: message });
        }
        
        try {
            await sock.sendMessage(chatId, {
                text: '📥 *Exporting group members...*'
            }, { quoted: message });
            
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;
            
            let vcfData = '';
            for (const participant of participants) {
                const number = participant.id.split('@')[0];
                const name = participant.name || number;
                vcfData += `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;TYPE=CELL:${number}
END:VCARD\n`;
            }
            
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            const fileName = `${groupMetadata.subject.replace(/[^a-zA-Z0-9]/g, '_')}_contacts.vcf`;
            const filePath = path.join(tempDir, fileName);
            fs.writeFileSync(filePath, vcfData);
            
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(filePath),
                mimetype: 'text/vcard',
                fileName: fileName,
                caption: `👥 *Group Contacts Exported*\n\n📛 Group: ${groupMetadata.subject}\n👤 Members: ${participants.length}\n📁 File: ${fileName}`
            }, { quoted: message });
            
            fs.unlinkSync(filePath);
            
        } catch (error) {
            console.error('VCF Error:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to export group contacts.'
            }, { quoted: message });
        }
    }
};