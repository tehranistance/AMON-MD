import express from 'express';
import { createServer } from 'http';
import config from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageInfo = {
    name: config.botName || 'MEGA-MD',
    version: config.version || '6.0.0',
    description: config.description || 'WhatsApp Bot',
    author: config.author || 'GlobalTechInfo'
};

const app = express();
const server = createServer(app);
const PORT = config.port || 5000;

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ORIGINAL STATUS PAGE ==========
app.get('/', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`;
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${packageInfo.name.toUpperCase()} Status</title>
        <style>
            :root { --primary: #25d366; --bg: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); }
            body { 
                margin: 0; padding: 0; background: var(--bg); color: white; 
                font-family: 'Inter', system-ui, sans-serif;
                display: flex; justify-content: center; align-items: center; min-height: 100vh;
            }
            .container {
                background: var(--card-bg); backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1); padding: 30px;
                border-radius: 24px; width: 90%; max-width: 400px; text-align: center;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .status-badge {
                display: inline-flex; align-items: center; background: rgba(37, 211, 102, 0.1);
                color: var(--primary); padding: 5px 15px; border-radius: 50px;
                font-size: 0.8rem; font-weight: bold; margin-bottom: 20px;
            }
            .dot { height: 8px; width: 8px; background: var(--primary); border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px var(--primary); }
            h1 { margin: 0; font-size: 1.8rem; letter-spacing: 1px; }
            .desc { color: #94a3b8; margin: 10px 0 25px 0; font-size: 0.9rem; }
            .grid { display: grid; gap: 12px; }
            .item { 
                background: rgba(0,0,0,0.2); padding: 12px 18px; border-radius: 12px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .label { color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; }
            .val { font-weight: 600; font-family: monospace; color: #f1f5f9; }
            .pair-btn {
                margin-top: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 12px;
                cursor: pointer;
                font-weight: bold;
                width: 100%;
            }
            .pair-btn:hover {
                transform: scale(1.02);
            }
            footer { margin-top: 25px; font-size: 0.7rem; color: #475569; letter-spacing: 1px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status-badge"><span class="dot"></span> SYSTEM ONLINE</div>
            <h1>${packageInfo.name.toUpperCase()}</h1>
            <p class="desc">${packageInfo.description}</p>
            
            <div class="grid">
                <div class="item"><span class="label">Version</span><span class="val">${packageInfo.version}</span></div>
                <div class="item"><span class="label">Author</span><span class="val">${packageInfo.author}</span></div>
                <div class="item"><span class="label">Uptime</span><span class="val">${uptimeString}</span></div>
            </div>

            <button class="pair-btn" onclick="window.location.href='/pair'">🔐 Pair WhatsApp Device</button>

            <footer>POWERED BY GLOBALTECHINFO</footer>
        </div>
    </body>
    </html>
    `);
});

// ========== PAIRING DASHBOARD PAGE ==========
app.get('/pair', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AMON-MD - Pair WhatsApp Device</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 {
            font-size: 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .header p { color: #888; font-size: 18px; }
        .system-status {
            display: inline-block;
            background: rgba(76,175,80,0.2);
            color: #4caf50;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            margin-top: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            text-align: center;
        }
        .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { color: #888; font-size: 14px; margin-top: 5px; }
        .servers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .server-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        }
        .server-card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.15); }
        .server-card.selected { border-color: #667eea; background: rgba(102,126,234,0.2); }
        .server-name { font-size: 20px; font-weight: bold; color: white; margin-bottom: 10px; }
        .server-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-bottom: 15px;
        }
        .status-online { background: #4caf50; color: white; }
        .server-region { color: #aaa; font-size: 14px; margin: 5px 0; }
        .server-latency { color: #aaa; font-size: 14px; margin-top: 10px; }
        .server-latency span { color: #4caf50; font-weight: bold; }
        .pairing-section {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
        }
        .pairing-title { font-size: 24px; color: white; margin-bottom: 20px; text-align: center; }
        .input-group { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; }
        .phone-input {
            flex: 1;
            min-width: 250px;
            padding: 15px 20px;
            font-size: 16px;
            border: 2px solid #667eea;
            border-radius: 10px;
            background: rgba(0,0,0,0.3);
            color: white;
            outline: none;
        }
        .phone-input::placeholder { color: #888; }
        .pair-btn {
            padding: 15px 40px;
            font-size: 18px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .pair-btn:hover { transform: scale(1.05); }
        .pair-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .code-display {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            display: none;
        }
        .code-label { color: #aaa; font-size: 14px; margin-bottom: 10px; }
        .code-value {
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 10px;
            color: #667eea;
            font-family: monospace;
        }
        .code-instruction { color: #888; font-size: 12px; margin-top: 15px; }
        .status-message {
            margin-top: 20px;
            padding: 12px;
            border-radius: 10px;
            text-align: center;
            display: none;
        }
        .status-success { background: rgba(76,175,80,0.2); color: #4caf50; border: 1px solid #4caf50; }
        .status-error { background: rgba(244,67,54,0.2); color: #f44336; border: 1px solid #f44336; }
        .status-loading { background: rgba(102,126,234,0.2); color: #667eea; border: 1px solid #667eea; }
        .users-section {
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
        }
        .users-title { color: white; margin-bottom: 15px; font-size: 18px; }
        .users-list { max-height: 200px; overflow-y: auto; }
        .user-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            color: #ccc;
            font-size: 14px;
        }
        .user-online { color: #4caf50; font-weight: bold; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            color: #666;
            font-size: 12px;
        }
        .back-btn {
            display: inline-block;
            margin-bottom: 20px;
            color: #667eea;
            text-decoration: none;
        }
        @media (max-width: 768px) {
            .header h1 { font-size: 32px; }
            .code-value { font-size: 28px; letter-spacing: 5px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Status</a>
        <div class="header">
            <h1>⚡ AMON-MD</h1>
            <p>Pair your WhatsApp device to the bot</p>
            <div class="system-status" id="systemStatus">🟢 SYSTEM ONLINE</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="totalUsers">0</div><div class="stat-label">Connected Users</div></div>
            <div class="stat-card"><div class="stat-value" id="uptime">0h</div><div class="stat-label">Uptime</div></div>
            <div class="stat-card"><div class="stat-value" id="version">v6.0</div><div class="stat-label">Version</div></div>
            <div class="stat-card"><div class="stat-value" id="serverCount">0</div><div class="stat-label">Active Servers</div></div>
        </div>
        
        <div class="servers-grid" id="serversGrid"></div>
        
        <div class="pairing-section">
            <div class="pairing-title">🔐 GENERATE PAIRING CODE</div>
            <div class="input-group">
                <input type="tel" id="phoneNumber" class="phone-input" placeholder="+123456789012 (with country code)" value="">
                <button id="pairBtn" class="pair-btn" onclick="generateCode()">Get Code</button>
            </div>
            <div class="code-display" id="codeDisplay">
                <div class="code-label">YOUR PAIRING CODE</div>
                <div class="code-value" id="codeValue">XXXX-XXXX</div>
                <div class="code-instruction">Enter this code in WhatsApp → Linked Devices → Link with phone number</div>
            </div>
            <div id="statusMessage" class="status-message"></div>
        </div>
        
        <div class="users-section">
            <div class="users-title">📱 Connected Devices</div>
            <div class="users-list" id="usersList"><div style="text-align: center; color: #666;">Loading...</div></div>
        </div>
        
        <div class="footer"><p>POWERED BY GLOBALTECHINFO | AMON-MD | © 2024</p></div>
    </div>
    
    <script>
        let selectedServer = null;
        let startTime = Date.now();
        let pairingInterval = null;
        
        const servers = [
            { id: 1, name: "SERVER 01", region: "US East", latency: 2242, status: "online", load: "45%" },
            { id: 2, name: "SERVER 02", region: "US East", latency: 1197, status: "online", load: "32%" },
            { id: 3, name: "SERVER 03", region: "EU West", latency: 1203, status: "online", load: "28%" }
        ];
        
        const API_BASE = window.location.origin;
        
        function renderServers() {
            const grid = document.getElementById('serversGrid');
            grid.innerHTML = servers.map(server => \`
                <div class="server-card \${selectedServer === server.id ? 'selected' : ''}" onclick="selectServer(\${server.id})">
                    <div class="server-name">\${server.name}</div>
                    <div class="server-status status-\${server.status}">\${server.status.toUpperCase()}</div>
                    <div class="server-region">📍 Region: \${server.region}</div>
                    <div class="server-latency">⚡ Latency: <span>\${server.latency}ms</span></div>
                    <div class="server-latency">📊 Load: <span>\${server.load}</span></div>
                </div>
            \`).join('');
            document.getElementById('serverCount').innerText = servers.filter(s => s.status === 'online').length;
        }
        
        function selectServer(id) {
            selectedServer = id;
            renderServers();
            showStatus(\`✅ Connected to \${servers.find(s => s.id === id).name}\`, 'success');
        }
        
        async function generateCode() {
            const phoneNumber = document.getElementById('phoneNumber').value.trim();
            
            if (!selectedServer) {
                showStatus('⚠️ Please select a server first', 'error');
                return;
            }
            if (!phoneNumber) {
                showStatus('⚠️ Please enter your phone number', 'error');
                return;
            }
            
            let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
            
            if (cleanNumber.length < 10) {
                showStatus('⚠️ Please enter a valid phone number (10-15 digits)', 'error');
                return;
            }
            
            document.getElementById('pairBtn').disabled = true;
            showStatus('🔄 Requesting pairing code...', 'loading');
            
            try {
                const response = await fetch(\`\${API_BASE}/api/pair\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: cleanNumber, serverId: selectedServer })
                });
                const data = await response.json();
                if (data.success) {
                    const formattedCode = data.code.match(/.{1,4}/g)?.join("-") || data.code;
                    document.getElementById('codeValue').innerText = formattedCode;
                    document.getElementById('codeDisplay').style.display = 'block';
                    showStatus('✅ Code generated! Check your WhatsApp', 'success');
                    checkConnection(cleanNumber);
                } else {
                    showStatus(data.error || 'Failed to generate code', 'error');
                }
            } catch (error) {
                showStatus('❌ Network error. Try again.', 'error');
            } finally {
                document.getElementById('pairBtn').disabled = false;
            }
        }
        
        async function checkConnection(phoneNumber) {
            if (pairingInterval) clearInterval(pairingInterval);
            pairingInterval = setInterval(async () => {
                try {
                    const response = await fetch(\`\${API_BASE}/api/status/\${phoneNumber}\`);
                    const data = await response.json();
                    if (data.connected) {
                        clearInterval(pairingInterval);
                        showStatus('✅ Bot connected successfully!', 'success');
                        loadUsers();
                        loadStats();
                    }
                } catch (error) {}
            }, 3000);
            setTimeout(() => { if (pairingInterval) clearInterval(pairingInterval); }, 120000);
        }
        
        function showStatus(message, type) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.className = 'status-message status-' + type;
            statusDiv.style.display = 'block';
            setTimeout(() => { if (type !== 'loading') setTimeout(() => { statusDiv.style.display = 'none'; }, 5000); }, 1000);
        }
        
        async function loadStats() {
            try {
                const response = await fetch(\`\${API_BASE}/api/stats\`);
                const data = await response.json();
                document.getElementById('totalUsers').innerText = data.totalUsers || 0;
                document.getElementById('version').innerText = data.version || 'v6.0';
            } catch (error) {}
        }
        
        async function loadUsers() {
            try {
                const response = await fetch(\`\${API_BASE}/api/users\`);
                const data = await response.json();
                if (data.users && data.users.length > 0) {
                    const connectedUsers = data.users.filter(u => u.connected);
                    document.getElementById('usersList').innerHTML = connectedUsers.map(user => \`
                        <div class="user-item"><span class="user-online">🟢</span><strong>+\${user.phoneNumber}</strong><span>Connected</span></div>
                    \`).join('');
                    if (connectedUsers.length === 0) document.getElementById('usersList').innerHTML = '<div style="text-align:center;color:#666;">No users connected</div>';
                } else {
                    document.getElementById('usersList').innerHTML = '<div style="text-align:center;color:#666;">No users connected</div>';
                }
            } catch (error) {}
        }
        
        setInterval(() => { loadStats(); loadUsers(); }, 10000);
        renderServers();
        selectServer(2);
        loadStats();
        loadUsers();
        document.getElementById('phoneNumber').addEventListener('keypress', function(e) { if (e.key === 'Enter') generateCode(); });
    </script>
</body>
</html>
    `);
});

// ========== HEALTH ENDPOINTS ==========
app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        memory: {
            rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
        },
        version: packageInfo.version,
        bot: packageInfo.name,
        timestamp: new Date().toISOString()
    });
});

app.get('/process', (req, res) => {
    const { send } = req.query;
    if (!send) return res.status(400).json({ error: 'Missing send query' });
    res.json({ status: 'Received', data: send });
});

app.get('/chat', (req, res) => {
    const { message, to } = req.query;
    if (!message || !to) return res.status(400).json({ error: 'Missing message or to query' });
    res.json({ status: 200, info: 'Message received (integration not implemented)' });
});

// Create sessions directory if not exists
const sessionsDir = path.join(process.cwd(), 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

export { app, server, PORT };
