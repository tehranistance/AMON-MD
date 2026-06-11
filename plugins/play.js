import yts from 'yt-search';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as APIs from '../lib/api.js';
import { toAudio } from '../lib/converter2.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export default {
    command: 'play',
    aliases: ['plays', 'music'],
    category: 'music',
    description: 'Download song from YouTube as MP3 document',
    usage: '.play <song name | youtube link>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();
        
        if (!query) {
            return sock.sendMessage(chatId, { 
                text: '🎵 *Play Downloader*\n\nUsage: .play <song name | YouTube link>' 
            }, { quoted: message });
        }
        
        try {
            let video;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                const search = await yts(query);
                if (!search || !search.videos.length)
                    return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                video = search.videos[0];
            } else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                video = videos[0];
            }
            
            await sock.sendMessage(chatId, {
                image: { url: video.thumbnail },
                caption: `🎵 *${video.title}*\n⏱ *Duration:* ${video.timestamp}\n👤 *Channel:* ${video.author?.name || 'Unknown'}\n\n🔄 *Downloading full audio...*`
            }, { quoted: message });
            
            let audioData = null;
            let audioBuffer = null;
            let downloadSuccess = false;
            
            const apiMethods = [
                { name: 'EliteProTech', method: () => APIs.getEliteProTechDownloadByUrl(video.url) },
                { name: 'Yupra', method: () => APIs.getYupraDownloadByUrl(video.url) },
                { name: 'Okatsu', method: () => APIs.getOkatsuDownloadByUrl(video.url) },
                { name: 'Izumi', method: () => APIs.getIzumiDownloadByUrl(video.url) }
            ];
            
            for (const apiMethod of apiMethods) {
                try {
                    audioData = await apiMethod.method();
                    const audioUrl = audioData.download;
                    
                    if (!audioUrl) continue;
                    
                    const audioResponse = await axios.get(audioUrl, {
                        responseType: 'arraybuffer',
                        timeout: 120000
                    });
                    audioBuffer = Buffer.from(audioResponse.data);
                    
                    if (audioBuffer && audioBuffer.length > 1000000) {
                        downloadSuccess = true;
                        break;
                    }
                } catch (apiErr) {
                    continue;
                }
            }
            
            if (!downloadSuccess || !audioBuffer) {
                throw new Error('All download sources failed');
            }
            
            const isMp3 = audioBuffer.toString('ascii', 0, 3) === 'ID3' || 
                         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0);
            
            let finalBuffer = audioBuffer;
            if (!isMp3) {
                try {
                    finalBuffer = await toAudio(audioBuffer, 'm4a');
                } catch (convErr) {
                    finalBuffer = audioBuffer;
                }
            }
            
            await sock.sendMessage(chatId, {
                document: finalBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${(audioData?.title || video.title).replace(/[^\w\s-]/g, '')}.mp3`,
                caption: `📁 *${audioData?.title || video.title}*\n📦 Size: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB\n📥 *DOWNLOADED BY AMON-MD*`
            }, { quoted: message });
            
            try {
                const tempDir = path.join(process.cwd(), 'temp');
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    const now = Date.now();
                    files.forEach(file => {
                        const filePath = path.join(tempDir, file);
                        try {
                            const stats = fs.statSync(filePath);
                            if (now - stats.mtimeMs > 10000) {
                                if (file.endsWith('.mp3') || file.endsWith('.m4a')) {
                                    fs.unlinkSync(filePath);
                                }
                            }
                        } catch (e) {}
                    });
                }
            } catch (cleanupErr) {}
            
        } catch (err) {
            console.error('Play error:', err.message);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to download full song. Try again later.` 
            }, { quoted: message });
        }
    }
};