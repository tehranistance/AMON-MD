import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import axios from 'axios';
import zlib from 'zlib';

const GITHUB_USERNAME = 'stormfiber';

/**
 * Download from Mega using fileID#key format
 */
async function downloadFromMega(megaIdWithKey) {
    let fileId, key;
    
    if (megaIdWithKey.includes('#')) {
        const hashIndex = megaIdWithKey.indexOf('#');
        fileId = megaIdWithKey.substring(0, hashIndex);
        key = megaIdWithKey.substring(hashIndex + 1);
        fileId = fileId.replace(/\.+$/, '');
    } else if (megaIdWithKey.includes('mega.nz')) {
        const urlMatch = megaIdWithKey.match(/\/file\/([^#]+)#(.+)/);
        if (urlMatch) {
            fileId = urlMatch[1];
            key = urlMatch[2];
        }
    }
    
    if (!fileId || !key) {
        throw new Error('Invalid Mega format');
    }
    
    try {
        const megaModule = await import('megajs');
        const megaUrl = `https://mega.nz/file/${fileId}#${key}`;
        const file = megaModule.File.fromURL(megaUrl);
        const data = await file.downloadBuffer();
        return data;
    } catch (error) {
        throw new Error(`Mega download failed: ${error.message}`);
    }
}

/**
 * Extract session ID from various formats
 */
function extractSessionId(txt) {
    let cleanId = txt;
    
    if (cleanId.startsWith('AMON-MD~')) {
        cleanId = cleanId.substring(8);
    }
    
    if (cleanId.startsWith('NovaMd~')) {
        cleanId = cleanId.substring(7);
    }
    
    if (cleanId.includes('#')) {
        return cleanId;
    }
    
    const prefixes = ['gist:', 'github:', 'session:', 'id:'];
    for (const prefix of prefixes) {
        if (cleanId.toLowerCase().startsWith(prefix.toLowerCase())) {
            cleanId = cleanId.substring(prefix.length);
        }
    }
    
    if (!cleanId.includes('#')) {
        if (cleanId.includes('?')) {
            cleanId = cleanId.split('?')[0];
        }
    }
    
    return cleanId.trim();
}

/**
 * Main function to save credentials
 */
async function SaveCreds(txt) {
    const sessionDir = path.join(process.cwd(), 'session');
    const credsPath = path.join(sessionDir, 'creds.json');
    
    console.log('\n🔐 Session:', txt.substring(0, 30) + '...');
    
    try {
        let data = null;
        let source = 'unknown';
        
        const sessionKey = extractSessionId(txt);
        
        // Mega format
        if (sessionKey.includes('#')) {
            console.log('📡 Downloading from Mega...');
            data = await downloadFromMega(sessionKey);
            source = 'mega';
        }
        // Mega URL
        else if (sessionKey.includes('mega.nz')) {
            console.log('📡 Downloading from Mega...');
            data = await downloadFromMega(sessionKey);
            source = 'mega';
        }
        // Base64 compressed
        else if (sessionKey.match(/^[A-Za-z0-9+/=]+$/) && sessionKey.length > 50) {
            console.log('📡 Decoding session...');
            try {
                const compressedData = Buffer.from(sessionKey, 'base64');
                data = zlib.gunzipSync(compressedData);
                source = 'base64';
            } catch (e) {
                data = Buffer.from(sessionKey, 'base64').toString('utf-8');
                source = 'base64';
            }
        }
        // GitHub Gist
        else {
            console.log('📡 Fetching from GitHub...');
            const urls = [
                `https://gist.githubusercontent.com/${GITHUB_USERNAME}/${sessionKey}/raw/creds.json`,
                `https://gist.githubusercontent.com/${GITHUB_USERNAME}/${sessionKey}/raw/creds`,
                `https://api.github.com/gists/${sessionKey}`
            ];
            
            for (const url of urls) {
                try {
                    const response = await axios.get(url, { timeout: 10000 });
                    
                    if (url.includes('api.github.com')) {
                        const files = response.data.files;
                        const credsFile = files['creds.json'] || files['creds'];
                        if (credsFile && credsFile.content) {
                            data = credsFile.content;
                            source = 'github';
                            break;
                        }
                    } else {
                        data = response.data;
                        source = 'github';
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        if (!data) {
            throw new Error('Failed to retrieve credentials');
        }
        
        if (typeof data === 'string') {
            data = Buffer.from(data);
        }
        
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        fs.writeFileSync(credsPath, data);
        
        console.log('✅ Session connected successfully!');
        console.log(`📊 Size: ${(data.length / 1024).toFixed(2)} KB\n`);
        
        return { success: true, path: credsPath, size: data.length, source: source };
        
    } catch (error) {
        console.error('❌ Session error:', error.message);
        throw error;
    }
}

/**
 * Load existing credentials
 */
async function LoadCreds() {
    const credsPath = path.join(process.cwd(), 'session', 'creds.json');
    
    if (!fs.existsSync(credsPath)) {
        throw new Error('No credentials found');
    }
    
    const data = fs.readFileSync(credsPath, 'utf-8');
    console.log('✅ Session loaded');
    return JSON.parse(data);
}

/**
 * Check if credentials exist
 */
function hasCredentials() {
    const credsPath = path.join(process.cwd(), 'session', 'creds.json');
    return fs.existsSync(credsPath);
}

export default SaveCreds;
export { SaveCreds, LoadCreds, hasCredentials, downloadFromMega, extractSessionId };