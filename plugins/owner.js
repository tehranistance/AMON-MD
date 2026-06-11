export default {
    command: 'owner',
    aliases: ['creator'],
    category: 'info',
    description: 'Get the contact of the bot owner',
    usage: '.owner',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:Bot Owner
TEL;waid=254759006509:254759006509
END:VCARD
      `.trim();
            await sock.sendMessage(chatId, {
                contacts: { displayName: 'Bot Owner', contacts: [{ vcard }] },
            }, { quoted: message });
        }
        catch (error) {
            console.error('Owner Command Error:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to fetch owner contact.'
            }, { quoted: message });
        }
    }
};