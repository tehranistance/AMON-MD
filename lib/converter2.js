import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

/**
 * Convert audio buffer to MP3 format
 * @param {Buffer} buffer - Input audio buffer
 * @param {string} inputFormat - Format of input audio (m4a, ogg, wav, etc.)
 * @returns {Promise<Buffer>} - MP3 audio buffer
 */
export async function toAudio(buffer, inputFormat = 'm4a') {
    return new Promise((resolve, reject) => {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const inputPath = path.join(tempDir, `input_${Date.now()}.${inputFormat}`);
        const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);
        
        // Write input buffer to file
        fs.writeFileSync(inputPath, buffer);
        
        ffmpeg(inputPath)
            .toFormat('mp3')
            .audioBitrate(128)
            .audioFrequency(44100)
            .on('end', () => {
                try {
                    const outputBuffer = fs.readFileSync(outputPath);
                    // Cleanup temp files
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                    resolve(outputBuffer);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                // Cleanup on error
                try {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                } catch (e) {}
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Convert audio buffer to Opus format (for voice notes)
 * @param {Buffer} buffer - Input audio buffer
 * @param {string} inputFormat - Format of input audio
 * @returns {Promise<Buffer>} - Opus audio buffer
 */
export async function toOpus(buffer, inputFormat = 'm4a') {
    return new Promise((resolve, reject) => {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const inputPath = path.join(tempDir, `input_${Date.now()}.${inputFormat}`);
        const outputPath = path.join(tempDir, `output_${Date.now()}.opus`);
        
        fs.writeFileSync(inputPath, buffer);
        
        ffmpeg(inputPath)
            .toFormat('opus')
            .audioBitrate(32)
            .audioFrequency(24000)
            .on('end', () => {
                try {
                    const outputBuffer = fs.readFileSync(outputPath);
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                    resolve(outputBuffer);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', reject)
            .save(outputPath);
    });
}

export default { toAudio, toOpus };