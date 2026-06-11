import axios from 'axios';
import yts from 'yt-search';
import * as APIs from '../lib/api.js';
import fs from 'fs';
import path from 'path';

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'xbps-install-Syu';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const downloadWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: '360', url },
                timeout: 90000
            });
            if (data?.data?.downloadUrl)
                return data.data;
            throw new Error('No download URL');
        }
        catch (err) {
            if (i === retries - 1)
                throw err;
            await wait(5000);
        }
    }
    throw new Error('All download attempts failed');
};

export default {
    command: 'video2',
    aliases: ['mp4', 'vida'],
    category: 'download',
    description: 'Download YouTube videos by link or search',
    usage: '.video <youtube link | search query>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();
        
        if (!query) {
            return sock.sendMessage(chatId, { 
                text: '🎥 *Video Downloader*\n\nUsage: .video <song name | YouTube link>\nExample: .video Alan Walker Faded' 
            }, { quoted: message });
        }
        
        try {
            let videoUrl;
            let videoTitle;
            let videoThumbnail;
            
            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            } else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: '❌ No videos found!' }, { quoted: message });
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            }
            
            const validYT = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
            if (!validYT)
                return sock.sendMessage(chatId, { text: '❌ Not a valid YouTube link!' }, { quoted: message });
            
            const ytId = validYT[1];
            const thumb = videoThumbnail || `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`;
            
            await sock.sendMessage(chatId, {
                image: { url: thumb },
                caption: `🎬 *${videoTitle || query}*\n🔄 *Downloading video...*`
            }, { quoted: message });
            
            let videoData = null;
            let videoBuffer = null;
            let downloadSuccess = false;
            
            try {
                videoData = await downloadWithRetry(videoUrl);
                const videoResponse = await axios.get(videoData.downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                videoBuffer = Buffer.from(videoResponse.data);
                if (videoBuffer && videoBuffer.length > 500000) {
                    downloadSuccess = true;
                }
            } catch (ownApiErr) {
                const apiMethods = [
                    { name: 'EliteProTech', method: () => APIs.getEliteProTechVideoByUrl(videoUrl) },
                    { name: 'Yupra', method: () => APIs.getYupraVideoByUrl(videoUrl) },
                    { name: 'Okatsu', method: () => APIs.getOkatsuVideoByUrl(videoUrl) }
                ];
                
                for (const apiMethod of apiMethods) {
                    try {
                        const result = await apiMethod.method();
                        const videoUrl_result = result.download;
                        
                        if (!videoUrl_result) continue;
                        
                        const videoResponse = await axios.get(videoUrl_result, {
                            responseType: 'arraybuffer',
                            timeout: 120000
                        });
                        videoBuffer = Buffer.from(videoResponse.data);
                        
                        if (videoBuffer && videoBuffer.length > 500000) {
                            videoData = result;
                            downloadSuccess = true;
                            break;
                        }
                    } catch (apiErr) {
                        continue;
                    }
                }
            }
            
            if (!downloadSuccess || !videoBuffer) {
                throw new Error('All download sources failed');
            }
            
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                fileName: `${(videoData?.title || videoTitle || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
                caption: `🎬 *${videoData?.title || videoTitle || 'Video'}*\n\n📥 *DOWNLOADED BY AMON-MD*`
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
                                if (file.endsWith('.mp4') || file.endsWith('.mp3')) {
                                    fs.unlinkSync(filePath);
                                }
                            }
                        } catch (e) {}
                    });
                }
            } catch (cleanupErr) {}
            
        } catch (err) {
            console.error('[VIDEO] Error:', err.message);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to download video. Try again later.` 
            }, { quoted: message });
        }
    }
};