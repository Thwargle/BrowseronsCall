console.log('Testing server startup...');

try {
    console.log('1. Loading modules...');
    const WebSocket = require('ws');
    const http = require('http');
    const path = require('path');
    const fs = require('fs');
    console.log('2. Modules loaded successfully');
    
    console.log('3. Loading level loader...');
    const LevelLoader = require('./js/level-loader');
    console.log('4. Level loader loaded successfully');
    
    console.log('5. Creating level loader instance...');
    const levelLoader = new LevelLoader();
    console.log('6. Level loader instance created successfully');
    
    console.log('7. Creating HTTP server...');
    const httpServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Server Test</h1>');
    });
    console.log('8. HTTP server created successfully');
    
    console.log('9. Creating WebSocket server...');
    const httpWss = new WebSocket.Server({ 
        server: httpServer,
        perMessageDeflate: false,
        clientTracking: true
    });
    console.log('10. WebSocket server created successfully');
    
    console.log('11. Starting server...');
    httpServer.listen(8083, '0.0.0.0', () => {
        console.log('12. Server started successfully on port 8083');
        console.log('Test at: http://localhost:8083');
    });
    
    console.log('13. Server startup code completed');
    
} catch (error) {
    console.error('Error during startup:', error);
}
