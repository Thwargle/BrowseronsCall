const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('Creating minimal game server...');

// Create HTTP server
const httpServer = http.createServer((req, res) => {
    // Serve static files
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'Index.html'), (err, data) => {
            if (err) {
                console.error('Error loading game file:', err);
                res.writeHead(500);
                res.end('Error loading game');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

console.log('Creating WebSocket server...');

// Create WebSocket servers
const httpWss = new WebSocket.Server({ 
    server: httpServer,
    perMessageDeflate: false,
    clientTracking: true
});

console.log('Setting up WebSocket handlers...');

// Handle WebSocket connections
httpWss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);
            
            // Send a simple response
            ws.send(JSON.stringify({
                type: 'gameState',
                players: [],
                enemies: [],
                worldDrops: [],
                floors: [
                    { x: 0, y: 550, width: 3600, height: 50, material: 'dirt' }
                ],
                vendor: null,
                spawners: [],
                portals: []
            }));
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('Starting server...');

// Start server
const HTTP_PORT = process.env.HTTP_PORT || 8081;
const HOST = '0.0.0.0';

httpServer.listen(HTTP_PORT, HOST, () => {
    console.log(`Minimal game server running on port ${HTTP_PORT}`);
    console.log(`Game available at: http://localhost:${HTTP_PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${HTTP_PORT}`);
});

console.log('Server startup completed');
