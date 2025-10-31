const http = require('http');
const WebSocket = require('ws');

console.log('Creating minimal server...');

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Minimal Server Test</h1>');
});

const httpWss = new WebSocket.Server({ 
    server: httpServer,
    perMessageDeflate: false,
    clientTracking: true
});

console.log('Starting server on port 8082...');

httpServer.listen(8082, '0.0.0.0', () => {
    console.log('Minimal server running on port 8082');
    console.log('Test at: http://localhost:8082');
});

console.log('Server startup code completed');
