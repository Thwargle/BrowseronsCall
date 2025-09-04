const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

// Import modular systems
const { 
    generateDeathMessage, 
    savePlayerData, 
    loadPlayerData, 
    deletePlayerData, 
    dropMostValuableItem 
} = require('./player');
const { 
    getRandomEnemyName, 
    generateNPCColors, 
    createEnemy 
} = require('./enemy');
const { 
    generateLoot, 
    createTestSword 
} = require('./loot');
const LevelLoader = require('./level-loader');

// Player data directory is now managed in player.js

// Death message generation is now handled in player.js

// Player data functions are now handled in player.js

// Initialize level loader
const levelLoader = new LevelLoader();

// Create HTTP server
const httpServer = http.createServer((req, res) => {
    // Serve static files
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, '..', 'Index.html'), (err, data) => {
            if (err) {
                console.error('Error loading game file:', err);
                res.writeHead(500);
                res.end('Error loading game');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/level-editor.html') {
        // Serve level editor
        fs.readFile(path.join(__dirname, '..', 'level-editor.html'), (err, data) => {
            if (err) {
                console.error('Error loading level editor:', err);
                res.writeHead(500);
                res.end('Error loading level editor');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url.startsWith('/js/')) {
        // Serve JavaScript files
        const filePath = path.join(__dirname, req.url.substring(4));
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error('Error loading JS file:', req.url, err);
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(data);
            }
        });
    } else if (req.url === '/api/levels') {
        // API endpoint to list available levels
        const levels = levelLoader.listAvailableLevels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(levels));
    } else if (req.url.startsWith('/api/level/')) {
        // API endpoint to get level data
        const levelName = req.url.substring('/api/level/'.length);
        const levelData = levelLoader.loadLevel(levelName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(levelData));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create HTTPS server (with auto self-signed fallback)
let httpsServer = null;
let httpsWss = null;

try {
    let keyPath = path.join(__dirname, '..', '..', 'server-key.pem');
    let certPath = path.join(__dirname, '..', '..', 'server-cert.pem');

    let key; let cert;
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        key = fs.readFileSync(keyPath);
        cert = fs.readFileSync(certPath);
    } else {
        console.log('PEM certificates not found, generating self-signed certs at runtime...');
        const selfsigned = require('selfsigned');
        const attrs = [{ name: 'commonName', value: 'localhost' }];
        const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048, algorithm: 'sha256' });
        key = pems.private;
        cert = pems.cert;
    }

    const httpsOptions = { key, cert };
    
    httpsServer = https.createServer(httpsOptions, (req, res) => {
        // Same file serving logic as HTTP
        if (req.url === '/' || req.url === '/index.html') {
            fs.readFile(path.join(__dirname, '..', 'Index.html'), (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading game');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        } else if (req.url === '/level-editor.html') {
            // Serve level editor
            fs.readFile(path.join(__dirname, '..', 'level-editor.html'), (err, data) => {
                if (err) {
                    console.error('Error loading level editor:', err);
                    res.writeHead(500);
                    res.end('Error loading level editor');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        } else if (req.url.startsWith('/js/')) {
            const filePath = path.join(__dirname, req.url.substring(4));
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/javascript' });
                    res.end(data);
                }
            });
        } else if (req.url === '/api/levels') {
            // API endpoint to list available levels
            const levels = levelLoader.listAvailableLevels();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(levels));
        } else if (req.url.startsWith('/api/level/')) {
            // API endpoint to get level data
            const levelName = req.url.substring('/api/level/'.length);
            const levelData = levelLoader.loadLevel(levelName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(levelData));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    
    httpsWss = new WebSocket.Server({ server: httpsServer });
} catch (error) {
    console.log('HTTPS server not available (certificate error):', error.message);
    console.log('Only HTTP server will run');
}

// Create WebSocket servers
const httpWss = new WebSocket.Server({ 
    server: httpServer,
    perMessageDeflate: false,
    clientTracking: true
});

// Log WebSocket server events
httpWss.on('listening', () => {
    // HTTP WebSocket server ready
});

httpWss.on('error', (error) => {
    console.error('HTTP WebSocket server error:', error);
});

if (httpsWss) {
    httpsWss.on('listening', () => {
        // HTTPS WebSocket server ready
    });

    httpsWss.on('error', (error) => {
        console.error('HTTPS WebSocket server error:', error);
    });
}

// Game state
const WORLD_W = 3600;
const GROUND_Y = 550;

// Loot tables are now managed in loot.js

// Enemy names and rarity functions are now managed in enemy.js

// Item naming system is now managed in loot.js

// NPC color generation is now managed in enemy.js

// Load default level
const defaultLevel = levelLoader.loadLevel('default');
levelLoader.applyLevelToGameState({}, defaultLevel);

const gameState = {
    players: new Map(),
    enemies: [],
    worldDrops: [],
    nextEnemyId: 1,
    vendor: defaultLevel.vendors[0] ? {
        id: defaultLevel.vendors[0].id,
        x: defaultLevel.vendors[0].x,
        y: defaultLevel.vendors[0].y,
        w: defaultLevel.vendors[0].width,
        h: defaultLevel.vendors[0].height,
        vy: 0,
        colors: generateNPCColors()
    } : { id: 'vendor_1', x: 600, y: 200, w: 48, h: 64, vy: 0, colors: generateNPCColors() },
    spawners: defaultLevel.spawners || [],
    levelData: defaultLevel
};

// Debug: Log vendor colors at startup
console.log('Server starting with vendor colors:', gameState.vendor.colors);
console.log('Loaded level:', defaultLevel.name);
console.log('Spawners configured:', gameState.spawners.length);

// Loot generation functions are now managed in loot.js

// Handle WebSocket connections
function handleWebSocketConnection(ws, req, isSecure = false) {
    let playerId = null;
    let playerName = 'Player';
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Set up ping/pong to detect disconnections
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // Generate unique player ID if no name provided
                    if (data.name && data.name.trim()) {
                        playerName = data.name.trim();
                        // Reject default names
                        if (playerName.toLowerCase() === 'player') {
                            ws.send(JSON.stringify({ type: 'joinRejected', reason: 'Name invalid. Please choose a different name.' }));
                            try { ws.close(1000, 'Name invalid'); } catch(_){}
                            return;
                        }
                        
                        // Check if name exists and handle reconnection
                        if (gameState.players.has(playerName)) {
                            const existingPlayer = gameState.players.get(playerName);
                            // Player with this name is still connected, reject
                            ws.send(JSON.stringify({ type: 'joinRejected', reason: 'Name taken by another player. Please choose a different name.' }));
                            try { ws.close(1000, 'Name taken'); } catch(_){}
                            return;
                        }
                        
                        // Check if we have stored data for this player from a previous session
                        const hasStoredData = loadPlayerData(playerName) !== null;
                        if (hasStoredData) {
                            console.log(`${playerName} reconnecting (has stored data)`);
                        }
                        
                        playerId = playerName;
                    } else {
                        ws.send(JSON.stringify({ type: 'joinRejected', reason: 'Name required. Please enter a name before connecting.' }));
                        try { ws.close(1000, 'Name required'); } catch(_){}
                        return;
                    }
                    
                    // Store playerId on the WebSocket connection for broadcasting
                    ws.playerId = playerId;
                    
                    // If this is the first player joining, clear any accumulated world drops for a clean start
                    const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
                    if (totalClients === 1 && gameState.worldDrops.length > 0) {
                        console.log('First player joining, clearing accumulated world drops for clean start');
                        gameState.worldDrops.length = 0;
                    }
                    
                    // Check if we have stored data for this player (reconnection)
                    let storedPlayerData = loadPlayerData(playerName);
                    if (storedPlayerData) {
                        console.log(`${playerName} restoring data from persistent storage`);
                    }
                    
                    // Add player to game state (restore data if available, otherwise use defaults)
                    let initialInventory = storedPlayerData ? storedPlayerData.inventory : new Array(12).fill(null);
                    
                    // If this is a new player (no stored data), add a training sword to the first inventory slot
                    if (!storedPlayerData && initialInventory[0] === null) {
                        const testSword = createTestSword();
                        initialInventory[0] = testSword;
                        console.log(`Adding training sword to new player ${playerName}:`, testSword);
                    }
                    
                    // Get visual data from join message or use stored data
                    const shirtColor = data.shirtColor || (storedPlayerData ? storedPlayerData.shirtColor : null);
                    const pantColor = data.pantColor || (storedPlayerData ? storedPlayerData.pantColor : null);
                    const equipmentColors = data.equipmentColors || (storedPlayerData ? storedPlayerData.equipmentColors : {});
                    
                    gameState.players.set(playerId, {
                        id: playerId,
                        name: playerName,
                        x: storedPlayerData ? storedPlayerData.x : 80,
                        y: storedPlayerData ? storedPlayerData.y : 0,
                        health: storedPlayerData ? storedPlayerData.health : 100,
                        maxHealth: storedPlayerData ? storedPlayerData.maxHealth : 100,
                        pyreals: storedPlayerData ? storedPlayerData.pyreals : 0,
                        justConnected: true, // Flag to prevent immediate saving
                        equip: storedPlayerData ? storedPlayerData.equip : {
                            head: null, neck: null, shoulders: null, chest: null,
                            waist: null, legs: null, feet: null, wrists: null,
                            hands: null, mainhand: null, offhand: null, trinket: null
                        },
                        inventory: initialInventory,
                        shirtColor: shirtColor,
                        pantColor: pantColor,
                        equipmentColors: equipmentColors,
                        reach: 70 // Default base reach
                    });

                    // Notify all players
                    broadcastToAll({
                        type: 'playerJoined',
                        name: playerName,
                        id: playerId,
                        shirtColor: shirtColor,
                        pantColor: pantColor,
                        equipmentColors: equipmentColors,
                        equip: storedPlayerData ? storedPlayerData.equip : {
                            head: null, neck: null, shoulders: null, chest: null,
                            waist: null, legs: null, feet: null, wrists: null,
                            hands: null, mainhand: null, offhand: null, trinket: null
                        },
                        reach: 70 // Default base reach
                    });

                    // Always send current world drops to ensure consistency
                    // The stored snapshot can become outdated when other players pick up items
                    let groundLootToSend = gameState.worldDrops;
                    if (storedPlayerData) {
                        console.log(`${playerName} reconnecting: sending current ground loot (${groundLootToSend.length} items)`);
                    } else {
                        console.log(`${playerName} new player: sending current ground loot (${groundLootToSend.length} items)`);
                    }

                    // Send current game state to new player
                    const gameStateMsg = {
                        type: 'gameState',
                        players: Array.from(gameState.players.values()),
                        enemies: gameState.enemies,
                         worldDrops: groundLootToSend,
                         vendor: gameState.vendor,
                         spawners: gameState.spawners
                    };
                    
                    // Debug: Log vendor data being sent
                    console.log(`Sending vendor to ${playerName} - hasColors: ${!!gameState.vendor.colors}`);
                    
                    // Send player's own equipment and inventory data
                    const currentPlayerData = gameState.players.get(playerId);
                    console.log(`Sending initial inventory data to ${playerName}:`, currentPlayerData.inventory);
                    console.log(`Sending initial equipment data to ${playerName}:`, currentPlayerData.equip);
                    console.log(`Equipment mainhand:`, currentPlayerData.equip.mainhand);
                    console.log(`Equipment offhand:`, currentPlayerData.equip.offhand);
                    console.log(`Full equipment object being sent:`, JSON.stringify(currentPlayerData.equip, null, 2));
                    ws.send(JSON.stringify({
                        type: 'playerData',
                        equip: currentPlayerData.equip,
                        inventory: currentPlayerData.inventory
                    }));
                    
                    ws.send(JSON.stringify(gameStateMsg));

                    // Log the reconnection details for debugging
                    if (storedPlayerData) {
                        console.log(`${playerName} reconnected successfully with ${groundLootToSend.length} ground loot items (stored snapshot)`);
                    } else {
                        console.log(`${playerName} joined the game as new player with ${groundLootToSend.length} ground loot items (current state)`);
                    }
                    break;

                case 'chat':
                    // Broadcast chat message to other players (exclude sender)
                    broadcastToOthers(playerId, {
                        type: 'chat',
                        name: playerName,
                        msg: data.msg,
                        id: playerId
                    });
                    
                    // Send chat message back to sender (so they see it once)
                    ws.send(JSON.stringify({
                        type: 'chat',
                        name: playerName,
                        msg: data.msg,
                        id: playerId
                    }));
                    break;

                case 'rename':
                    if (playerId && gameState.players.has(playerId)) {
                        const oldName = playerName;
                        playerName = data.name || 'Player';
                        gameState.players.get(playerId).name = playerName;
                        
                        // Broadcast rename to other players
                        broadcastToOthers(playerId, {
                            type: 'playerRenamed',
                            oldName: oldName,
                            name: playerName,
                            id: playerId
                        });
                        
                        // Send rename confirmation back to sender
                        ws.send(JSON.stringify({
                            type: 'playerRenamed',
                            oldName: oldName,
                            name: playerName,
                            id: playerId
                        }));
                    }
                    break;

                case 'spawnEnemy':
                    // Create new enemy
                    const enemy = {
                        id: gameState.nextEnemyId++,
                        x: typeof data.x === 'number' ? data.x : 500,
                        y: GROUND_Y - 64,
                        level: data.level || 1,
                        health: 20 + (data.level || 1) * 12,
                        maxHealth: 20 + (data.level || 1) * 12,
                        homeX: typeof data.x === 'number' ? data.x : 500,
                        homeY: GROUND_Y - 64,
                        visibilityRange: 400,
                        name: getRandomEnemyName(),
                        colors: generateNPCColors()
                    };
                    
                    gameState.enemies.push(enemy);
                    
                    // Broadcast enemy spawn to all players - only send necessary properties
                    broadcastToAll({
                        type: 'spawnEnemy',
                        id: enemy.id,
                        x: enemy.x,
                        y: enemy.y,
                        level: enemy.level,
                        health: enemy.health,
                        maxHealth: enemy.maxHealth,
                        name: enemy.name,
                        colors: enemy.colors
                    });
                    break;

                case 'playerUpdate':
                    // Update player position/stats
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        Object.assign(player, {
                            x: data.x || player.x,
                            y: data.y || player.y,
                            health: data.health || player.health,
                            maxHealth: data.maxHealth || player.maxHealth,
                            pyreals: data.pyreals || player.pyreals
                        });
                        
                        // Also update visual data if provided
                        if (data.shirtColor !== undefined) player.shirtColor = data.shirtColor;
                        if (data.pantColor !== undefined) player.pantColor = data.pantColor;
                        if (data.equipmentColors !== undefined) player.equipmentColors = data.equipmentColors;
                        if (data.reach !== undefined) player.reach = data.reach;
                        
                        // Broadcast player update to other players
                        broadcastToOthers(playerId, {
                            type: 'playerUpdate',
                            id: playerId,
                            ...player
                        });
                    }
                    break;

                case 'equipUpdate':
                    // Equipment updates are now handled server-side via moveItem operations
                    // Clients should not send equipUpdate messages - server is authoritative
                    console.log(`Ignoring equipUpdate from ${playerName} - server is authoritative for equipment state`);
                    break;

                case 'inventoryUpdate':
                    if (playerId && gameState.players.has(playerId) && data.inventory) {
                        const player = gameState.players.get(playerId);
                        console.log(`Player ${playerName} updating inventory:`, data.inventory);
                        player.inventory = data.inventory;
                        // broadcast to all players so they can render current inventory
                        broadcastToAll({ type: 'inventoryUpdate', id: playerId, inventory: player.inventory });
                    }
                    break;

                case 'visualUpdate':
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        if (data.shirtColor !== undefined) player.shirtColor = data.shirtColor;
                        if (data.pantColor !== undefined) player.pantColor = data.pantColor;
                        if (data.equipmentColors !== undefined) player.equipmentColors = data.equipmentColors;
                        
                        // Broadcast visual update to all players
                        broadcastToAll({ 
                            type: 'visualUpdate', 
                            id: playerId, 
                            shirtColor: player.shirtColor,
                            pantColor: player.pantColor,
                            equipmentColors: player.equipmentColors
                        });
                    }
                    break;

                case 'enemyUpdate':
                    // Update enemy state
                    const enemyIndex = gameState.enemies.findIndex(e => e.id === data.id);
                    if (enemyIndex !== -1) {
                        Object.assign(gameState.enemies[enemyIndex], data);
                        
                        // Broadcast enemy update to other players - include colors for visual consistency
                        broadcastToOthers(playerId, {
                            type: 'enemyUpdate',
                            id: data.id,
                            x: data.x,
                            y: data.y,
                            health: data.health,
                            maxHealth: data.maxHealth,
                            level: data.level,
                            type: data.type,
                            dead: data.dead,
                            name: data.name,
                            colors: gameState.enemies[enemyIndex].colors
                        });
                    }
                    break;

                case 'attackEnemy':
                    const targetEnemy = gameState.enemies.find(e => e.id === data.id);
                    if (targetEnemy && !targetEnemy.dead) {
                        targetEnemy.health -= data.damage;
                        if (targetEnemy.health <= 0) {
                            targetEnemy.dead = true;
                            // Remove dead enemy from array
                            const enemyIndex = gameState.enemies.findIndex(e => e.id === targetEnemy.id);
                            if (enemyIndex !== -1) {
                                gameState.enemies.splice(enemyIndex, 1);
                            }
                            // Spawn loot when enemy dies using loot tables
                            const enemyType = targetEnemy.type || 'basic';
                            const lootItems = generateLoot(enemyType, targetEnemy.level || 1);
                            
                            for (const lootItem of lootItems) {
                                const dropX = targetEnemy.x + (Math.random() - 0.5) * 100;
                                const dropY = targetEnemy.y + 10;
                                const drop = {
                                    id: `enemy-loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    x: dropX,
                                    y: dropY,
                                    item: lootItem,
                                    vx: (Math.random() - 0.5) * 140,
                                    vy: -Math.random() * 120 - 260,
                                    pickRadius: 40,
                                    grounded: false,
                                    noPickupUntil: Date.now() + 1000
                                };
                                gameState.worldDrops.push(drop);
                                // Broadcasting loot drop
                                broadcastToAll({ type: 'dropItem', ...drop });
                            }
                            // Schedule respawn
                            const spawner = gameState.spawners.find(s => s.id === targetEnemy.spawnerId);
                            if (spawner) {
                                spawner.currentEnemyId = null;
                                spawner.respawnAt = Date.now() + 8000; // 8 seconds respawn
                            }
                            broadcastToAll({ type: 'enemyDeath', id: targetEnemy.id });
                        } else {
                            broadcastToAll({ 
                                type: 'enemyUpdate', 
                                id: targetEnemy.id, 
                                health: targetEnemy.health,
                                colors: targetEnemy.colors
                            });
                        }
                    }
                    break;

                case 'dropItem':
                    // Add item drop to world with proper physics
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        
                        // Find the item in the player's inventory or equipment
                        let item = null;
                        if (data.fromWhere === 'bag' && data.fromIndex !== null) {
                            item = player.inventory[data.fromIndex];
                            // Remove item from inventory
                            player.inventory[data.fromIndex] = null;
                        } else if (data.fromWhere === 'equip' && data.fromSlot) {
                            item = player.equip[data.fromSlot];
                            // Remove item from equipment
                            player.equip[data.fromSlot] = null;
                        }
                        
                        if (item) {
                                                    const drop = {
                            id: `drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            x: data.x,
                            y: data.y,
                            item: item,
                            vx: 0, // Initial horizontal velocity
                            vy: 0, // Initial vertical velocity
                            pickRadius: 40,
                            grounded: false,
                            noPickupUntil: Date.now() + 1000
                        };
                            
                            gameState.worldDrops.push(drop);
                            
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
                            
                            // Send updated inventory to the player
                            ws.send(JSON.stringify({
                                type: 'inventoryUpdated',
                                inventory: player.inventory
                            }));
                            
                                                           // Send updated equipment to the player
                               ws.send(JSON.stringify({
                                   type: 'equipmentUpdated',
                                   equip: player.equip
                               }));
                            
                            console.log(`Player ${playerName} dropped ${item.name} to world at (${data.x}, ${data.y})`);
                        }
                    }
                    break;

                case 'pickupItem':
                    // Handle picking up items from the world and placing them in inventory
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { dropId, slotIndex } = data;
                        
                        console.log(`Player ${playerName} picking up item from drop ${dropId} to slot ${slotIndex}`);
                        
                        // Find the world drop
                        const dropIndex = gameState.worldDrops.findIndex(d => d.id === dropId);
                        if (dropIndex !== -1) {
                            const drop = gameState.worldDrops[dropIndex];
                            const item = drop.item;
                            
                            if (item && slotIndex !== null && slotIndex < player.inventory.length) {
                                // Check if destination slot is occupied
                                if (player.inventory[slotIndex]) {
                                    // Swap items - put the equipped item back in the world
                                    const displacedItem = player.inventory[slotIndex];
                                    player.inventory[slotIndex] = item;
                                    
                                    // Create a new world drop for the displaced item
                                    const newDrop = {
                                        id: `displaced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        x: drop.x,
                                        y: drop.y,
                                        item: displacedItem,
                                        vx: 0,
                                        vy: 0,
                                        pickRadius: 40,
                                        grounded: false,
                                        noPickupUntil: Date.now() + 1000
                                    };
                                    
                                    gameState.worldDrops.push(newDrop);
                                    
                                    // Broadcast the new drop to all players
                                    broadcastToAll({
                                        type: 'dropItem',
                                        ...newDrop
                                    });
                                } else {
                                    // Empty slot, just place the item
                                    player.inventory[slotIndex] = item;
                                }
                                
                                // Remove the original drop from the world
                                gameState.worldDrops.splice(dropIndex, 1);
                                
                                // Broadcast item pickup to all players
                                broadcastToAll({
                                    type: 'pickupItem',
                                    dropId: dropId,
                                    playerId: playerId
                                });
                                
                                // Send updated inventory to the player
                                console.log(`Sending inventoryUpdated to ${playerName} for pickup:`, player.inventory);
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                                
                                // Save player data immediately after pickup
                                savePlayerData(playerName, player);
                            }
                        }
                    }
                    break;

                case 'moveItem':
                    // Handle moving items between inventory slots, equipment slots, or from world to inventory
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { itemId, fromWhere, fromIndex, fromSlot, toWhere, toIndex, toSlot } = data;
                        
                        console.log(`Player ${playerName} moving item ${itemId} from ${fromWhere} to ${toWhere}`);
                        console.log(`Move details: fromWhere=${fromWhere}, fromIndex=${fromIndex}, fromSlot=${fromSlot}, toWhere=${toWhere}, toIndex=${toIndex}, toSlot=${toSlot}`);
                        
                        let sourceItem = null;
                        
                        // Find the source item
                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                            sourceItem = player.inventory[fromIndex];
                            if (sourceItem && sourceItem.id === itemId) {
                                player.inventory[fromIndex] = null;
                            } else {
                                sourceItem = null;
                            }
                        } else if (fromWhere === 'equip' && fromSlot) {
                            sourceItem = player.equip[fromSlot];
                            if (sourceItem && sourceItem.id === itemId) {
                                player.equip[fromSlot] = null;
                            } else {
                                sourceItem = null;
                            }
                        } else if (fromWhere === 'world') {
                            // Find item in world drops
                            const worldDropIndex = gameState.worldDrops.findIndex(d => d.item && d.item.id === itemId);
                            if (worldDropIndex !== -1) {
                                sourceItem = gameState.worldDrops[worldDropIndex].item;
                                gameState.worldDrops.splice(worldDropIndex, 1);
                                // Broadcast removal of world drop
                                broadcastToAll({ type: 'pickupItem', dropId: gameState.worldDrops[worldDropIndex]?.id, playerId: playerId });
                            }
                        }
                        
                        if (sourceItem) {
                            // Place the item in the destination
                            if (toWhere === 'bag' && toIndex !== null && toIndex < player.inventory.length) {
                                // Check if destination slot is occupied
                                if (player.inventory[toIndex]) {
                                    // Swap items
                                    const tempItem = player.inventory[toIndex];
                                    player.inventory[toIndex] = sourceItem;
                                    
                                    // Put the displaced item back in the source location
                                    if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                        player.inventory[fromIndex] = tempItem;
                                    } else if (fromWhere === 'equip' && fromSlot) {
                                        player.equip[fromSlot] = tempItem;
                                    } else if (fromWhere === 'world') {
                                        // If picking up from world with a swap, drop the displaced item to world
                                        const displacedDrop = {
                                            id: `move-displaced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                            x: data.x || player.x,
                                            y: data.y || player.y,
                                            item: tempItem,
                                            vx: 0,
                                            vy: 0,
                                            pickRadius: 40,
                                            grounded: false,
                                            noPickupUntil: Date.now() + 1000
                                        };
                                        gameState.worldDrops.push(displacedDrop);
                                        // Broadcast the new world drop
                                        broadcastToAll({
                                            type: 'dropItem',
                                            ...displacedDrop
                                        });
                                    }
                                } else {
                                    player.inventory[toIndex] = sourceItem;
                                }
                                
                                // Send updated inventory to the player
                                console.log(`Sending inventoryUpdated to ${playerName}:`, player.inventory);
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                                
                                // Also send equipment update if item came from equipment (for swaps)
                                if (fromWhere === 'equip') {
                                    ws.send(JSON.stringify({
                                        type: 'equipmentUpdated',
                                        equip: player.equip
                                    }));
                                }
                                
                            } else if (toWhere === 'equip' && toSlot) {
                                // Check if the item can be equipped in this slot
                                if (sourceItem.type === 'armor' && (sourceItem.slot === toSlot || toSlot === 'head' || toSlot === 'neck' || toSlot === 'shoulders' || toSlot === 'chest' || toSlot === 'waist' || toSlot === 'legs' || toSlot === 'feet' || toSlot === 'wrists' || toSlot === 'hands')) {
                                    // Check if destination slot is occupied
                                    if (player.equip[toSlot]) {
                                        // Swap items
                                        const tempItem = player.equip[toSlot];
                                        player.equip[toSlot] = sourceItem;
                                        
                                        // Put the displaced item back in the source location
                                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                            player.inventory[fromIndex] = tempItem;
                                        } else if (fromWhere === 'equip' && fromSlot) {
                                            player.equip[fromSlot] = tempItem;
                                        }
                                    } else {
                                        player.equip[toSlot] = sourceItem;
                                    }
                                    
                                    console.log(`Player ${player.name} equipped ${sourceItem.name} to ${toSlot}`);
                                    // Save player data immediately when equipment changes
                                    savePlayerData(player.name, player);
                                    
                                    // Send updated equipment to the player
                                    ws.send(JSON.stringify({
                                        type: 'equipmentUpdated',
                                        equip: player.equip
                                    }));
                                    
                                    // Broadcast equipment update to all other players so they can render current equipment
                                    broadcastToOthers(playerId, {
                                        type: 'equipUpdate',
                                        id: playerId,
                                        equip: player.equip
                                    });
                                    
                                    // Save player data immediately after equipment change
                                    savePlayerData(playerName, player);
                                    
                                    // Also send inventory update if item came from bag
                                    if (fromWhere === 'bag') {
                                        console.log(`Sending inventoryUpdated to ${playerName} for armor equip from bag:`, player.inventory);
                                        ws.send(JSON.stringify({
                                            type: 'inventoryUpdated',
                                            inventory: player.inventory
                                        }));
                                    }
                                    
                                } else if (sourceItem.type === 'weapon' && (toSlot === 'mainhand' || toSlot === 'offhand')) {
                                    // Check if destination slot is occupied
                                    if (player.equip[toSlot]) {
                                        // Swap items
                                        const tempItem = player.equip[toSlot];
                                        player.equip[toSlot] = sourceItem;
                                        
                                        // Put the displaced item back in the source location
                                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                            player.inventory[fromIndex] = tempItem;
                                        } else if (fromWhere === 'equip' && fromSlot) {
                                            player.equip[fromSlot] = tempItem;
                                        }
                                    } else {
                                        player.equip[toSlot] = sourceItem;
                                    }
                                    
                                    console.log(`Player ${player.name} equipped ${sourceItem.name} to ${toSlot}`);
                                    // Save player data immediately when equipment changes
                                    savePlayerData(player.name, player);
                                    
                                    // Send updated equipment to the player
                                    ws.send(JSON.stringify({
                                        type: 'equipmentUpdated',
                                        equip: player.equip
                                    }));
                                    
                                    // Broadcast equipment update to all other players so they can render current equipment
                                    broadcastToOthers(playerId, {
                                        type: 'equipUpdate',
                                        id: playerId,
                                        equip: player.equip
                                    });
                                    
                                    // Save player data immediately after equipment change
                                    savePlayerData(playerName, player);
                                    
                                    // Also send inventory update if item came from bag
                                    if (fromWhere === 'bag') {
                                        console.log(`Sending inventoryUpdated to ${playerName} for weapon equip from bag:`, player.inventory);
                                        ws.send(JSON.stringify({
                                            type: 'inventoryUpdated',
                                            inventory: player.inventory
                                        }));
                                    }
                                }
                                
                                // Also send updated inventory if item came from bag (for other cases)
                                if (fromWhere === 'bag') {
                                    console.log(`Sending inventoryUpdated to ${playerName} for other cases from bag:`, player.inventory);
                                    ws.send(JSON.stringify({
                                        type: 'inventoryUpdated',
                                        inventory: player.inventory
                                    }));
                                }
                                
                                // Always send equipment update if item came from equipment
                                if (fromWhere === 'equip') {
                                    ws.send(JSON.stringify({
                                        type: 'equipmentUpdated',
                                        equip: player.equip
                                    }));
                                    
                                    // Broadcast equipment update to all other players so they can render current equipment
                                    broadcastToOthers(playerId, {
                                        type: 'equipUpdate',
                                        id: playerId,
                                        equip: player.equip
                                    });
                                    
                                    // Save player data immediately after equipment change
                                    savePlayerData(playerName, player);
                                }
                            }
                        }
                    }
                    break;

                case 'dropItem':
                    // Handle dropping items from inventory or equipment to the world
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { itemId, fromWhere, fromIndex, fromSlot, x, y } = data;
                        
                        console.log(`Player ${playerName} dropping item ${itemId} from ${fromWhere}`);
                        
                        let droppedItem = null;
                        
                        // Remove item from source location
                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                            droppedItem = player.inventory[fromIndex];
                            if (droppedItem && droppedItem.id === itemId) {
                                player.inventory[fromIndex] = null;
                            } else {
                                droppedItem = null;
                            }
                        } else if (fromWhere === 'equip' && fromSlot) {
                            droppedItem = player.equip[fromSlot];
                            if (droppedItem && droppedItem.id === itemId) {
                                player.equip[fromSlot] = null;
                            } else {
                                droppedItem = null;
                            }
                        }
                        
                        if (droppedItem) {
                            // Create world drop
                            const drop = {
                                id: `sell-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: x || player.x,
                                y: y || player.y,
                                item: droppedItem,
                                vx: 0,
                                vy: 0,
                                pickRadius: 40,
                                grounded: false,
                                noPickupUntil: Date.now() + 1000
                            };
                            
                            gameState.worldDrops.push(drop);
                            
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
                            
                            // Send updated inventory/equipment to the player
                            if (fromWhere === 'bag') {
                                console.log(`Sending inventoryUpdated to ${playerName} for drop from bag:`, player.inventory);
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                            } else if (fromWhere === 'equip') {
                                ws.send(JSON.stringify({
                                    type: 'equipmentUpdated',
                                    equip: player.equip
                                }));
                                
                                // Broadcast equipment update to all other players so they can render current equipment
                                broadcastToOthers(playerId, {
                                    type: 'equipUpdate',
                                    id: playerId,
                                    equip: player.equip
                                });
                                
                                // Save player data immediately after equipment change
                                savePlayerData(playerName, player);
                            }
                        }
                    }
                    break;

                case 'sellItem':
                    // Handle selling items to vendor
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { itemId, fromWhere, fromIndex, fromSlot } = data;
                        
                        console.log(`Player ${playerName} selling item ${itemId} from ${fromWhere}`);
                        
                        let soldItem = null;
                        
                        // Remove item from source location
                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                            soldItem = player.inventory[fromIndex];
                            if (soldItem && soldItem.id === itemId) {
                                player.inventory[fromIndex] = null;
                            } else {
                                soldItem = null;
                            }
                        } else if (fromWhere === 'equip' && fromSlot) {
                            soldItem = player.equip[fromSlot];
                            if (soldItem && soldItem.id === itemId) {
                                player.equip[fromSlot] = null;
                            } else {
                                soldItem = null;
                            }
                        }
                        
                        if (soldItem) {
                            // Add pyreals to player
                            const itemValue = soldItem.value || 0;
                            player.pyreals = (player.pyreals || 0) + itemValue;
                            
                            console.log(`Player ${playerName} sold ${soldItem.name} for ${itemValue} pyreals. New total: ${player.pyreals}`);
                            
                            // Send updated inventory/equipment to the player
                            if (fromWhere === 'bag') {
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                            } else if (fromWhere === 'equip') {
                                ws.send(JSON.stringify({
                                    type: 'equipmentUpdated',
                                    equip: player.equip
                                }));
                                
                                // Broadcast equipment update to all other players so they can render current equipment
                                broadcastToOthers(playerId, {
                                    type: 'equipUpdate',
                                    id: playerId,
                                    equip: player.equip
                                });
                                
                                // Save player data immediately after equipment change
                                savePlayerData(playerName, player);
                            }
                            
                            // Send updated pyreals to the player
                            ws.send(JSON.stringify({
                                type: 'pyrealsUpdated',
                                pyreals: player.pyreals
                            }));
                            
                            // Broadcast player update to others (for pyreals change)
                            broadcastToOthers(playerId, {
                                type: 'playerUpdate',
                                id: playerId,
                                pyreals: player.pyreals
                            });
                        }
                    }
                    break;

                case 'sellAllInventory':
                    // Handle selling all inventory items to vendor at once
                    console.log('Received sellAllInventory message:', data);
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { fromWhere } = data;
                        
                        console.log(`Player ${playerName} selling all inventory items from ${fromWhere}`);
                        console.log('Player inventory before:', JSON.stringify(player.inventory));
                        console.log('Player pyreals before:', player.pyreals);
                        
                        let totalValue = 0;
                        let itemsSold = 0;
                        
                        if (fromWhere === 'bag' && player.inventory && player.inventory.length > 0) {
                            // Sell all inventory items
                            player.inventory.forEach((item, idx) => {
                                if (item && item.value) {
                                    totalValue += item.value;
                                    itemsSold++;
                                    player.inventory[idx] = null;
                                    console.log(`Selling item ${idx}: ${item.name} for ${item.value} pyreals`);
                                }
                            });
                            
                            if (itemsSold > 0) {
                                // Add pyreals to player
                                player.pyreals = (player.pyreals || 0) + totalValue;
                                
                                console.log(`Player ${playerName} sold ${itemsSold} items for ${totalValue} pyreals total. New total: ${player.pyreals}`);
                                console.log('Player inventory after:', JSON.stringify(player.inventory));
                                
                                // Send updated inventory to the player
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                                
                                // Send updated pyreals to the player
                                ws.send(JSON.stringify({
                                    type: 'pyrealsUpdated',
                                    pyreals: player.pyreals
                                }));
                                
                                // Broadcast player update to others (for pyreals change)
                                broadcastToOthers(playerId, {
                                    type: 'playerUpdate',
                                    id: playerId,
                                    pyreals: player.pyreals
                                });
                            } else {
                                console.log('No items were sold - inventory was empty or had no valuable items');
                            }
                        } else {
                            console.log('Invalid fromWhere or empty inventory:', fromWhere, player.inventory);
                        }
                    } else {
                        console.log('Player not found or invalid playerId:', playerId, gameState.players.has(playerId));
                    }
                    break;

                case 'playerDeath':
                    // Handle player death notification
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        console.log(`Player ${playerName} has died`);
                        
                        // Update player state to indicate death
                        player.isDead = true;
                        player.health = 0;
                        
                        // Drop the most valuable item from inventory/equipment
                        const droppedItem = dropMostValuableItem(player);
                        if (droppedItem) {
                            // Create world drop at player's position
                            const drop = {
                                id: `death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: player.x + 24, // Center of player
                                y: player.y + 32,
                                item: droppedItem,
                                vx: (Math.random() - 0.5) * 100,
                                vy: -Math.random() * 100 - 200,
                                pickRadius: 40,
                                grounded: false,
                                noPickupUntil: Date.now() + 3000 // 3 seconds delay to prevent immediate pickup after death
                            };
                            
                            gameState.worldDrops.push(drop);
                            
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
                            
                            console.log(`Player ${playerName} dropped ${droppedItem.name} due to death`);
                        }
                        
                        // Broadcast death to all other players
                        broadcastToOthers(playerId, {
                            type: 'playerDeath',
                            playerId: playerId,
                            playerName: playerName
                        });
                    }
                    break;

                case 'playerRespawn':
                    // Handle player respawn notification
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { x, y, health, maxHealth } = data;
                        
                        console.log(`Player ${playerName} has respawned at (${x}, ${y})`);
                        
                        // Update player state
                        player.isDead = false;
                        player.x = x;
                        player.y = y;
                        player.health = health;
                        player.maxHealth = maxHealth;
                        player.vx = 0;
                        player.vy = 0;
                        
                        // Broadcast respawn to all other players
                        broadcastToOthers(playerId, {
                            type: 'playerRespawn',
                            playerId: playerId,
                            playerName: playerName,
                            x: x,
                            y: y,
                            health: health,
                            maxHealth: maxHealth
                        });
                    }
                    break;

                case 'currencyPickup':
                    // Handle currency pickup from world drops
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const { amount, dropId } = data;
                        
                        console.log(`Player ${playerName} picked up ${amount} pyreals from drop ${dropId}`);
                        
                        // Remove the currency drop from world drops
                        const dropIndex = gameState.worldDrops.findIndex(d => d.id === dropId);
                        if (dropIndex !== -1) {
                            gameState.worldDrops.splice(dropIndex, 1);
                            
                            // Broadcast item pickup to all players
                            broadcastToAll({
                                type: 'pickupItem',
                                dropId: dropId,
                                playerId: playerId
                            });
                        }
                        
                        // Add pyreals to player
                        player.pyreals = (player.pyreals || 0) + amount;
                        
                        // Send updated pyreals to the player
                        ws.send(JSON.stringify({
                            type: 'pyrealsUpdated',
                            pyreals: player.pyreals
                        }));
                        
                        // Save player data immediately after currency pickup
                        savePlayerData(playerName, player);
                        
                        // Broadcast player update to others (for pyreals change)
                        broadcastToOthers(playerId, {
                            type: 'playerUpdate',
                            id: playerId,
                            pyreals: player.pyreals
                        });
                        
                        console.log(`Player ${playerName} now has ${player.pyreals} pyreals`);
                    }
                    break;

                case 'shootProjectile':
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const weaponType = data.weaponType;
                        const direction = data.direction; // 'left' or 'right'
                        const playerX = player.x;
                        const playerY = player.y;
                        
                        let projectile = null;
                        
                        if (weaponType === 'Bow') {
                            // Create arrow projectile
                            projectile = {
                                id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                type: 'arrow',
                                x: playerX + (direction === 'right' ? 32 : -8),
                                y: playerY + 16,
                                vx: direction === 'right' ? 600 : -600,
                                vy: -100, // Initial upward velocity for arc
                                damage: data.damage || 10,
                                playerId: playerId,
                                weaponType: weaponType,
                                createdAt: Date.now(),
                                lifeTime: 5000 // 5 seconds max life
                            };
                        } else if (weaponType === 'Wand') {
                            // Create fireball projectile
                            projectile = {
                                id: `fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                type: 'fireball',
                                x: playerX + (direction === 'right' ? 32 : -8),
                                y: playerY + 16,
                                vx: direction === 'right' ? 800 : -800,
                                vy: 0, // Straight line
                                damage: data.damage || 15,
                                playerId: playerId,
                                weaponType: weaponType,
                                createdAt: Date.now(),
                                lifeTime: 4000 // 4 seconds max life
                            };
                        }
                        
                        if (projectile) {
                            // Add to game state
                            if (!gameState.projectiles) gameState.projectiles = [];
                            gameState.projectiles.push(projectile);
                            
                            // Broadcast projectile creation to all players
                            broadcastToAll({
                                type: 'projectileCreated',
                                ...projectile
                            });
                        }
                    }
                    break;

                case 'loadLevel':
                    // Admin command to load a different level
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        // Only allow certain players to load levels (you can add admin check here)
                        if (data.levelName) {
                            console.log(`Loading level: ${data.levelName} requested by ${playerName}`);
                            const newLevel = levelLoader.loadLevel(data.levelName);
                            if (newLevel) {
                                // Apply new level to game state
                                levelLoader.applyLevelToGameState(gameState, newLevel);
                                
                                // Update game state with new level data
                                gameState.levelData = newLevel;
                                gameState.vendor = newLevel.vendors[0] ? {
                                    id: newLevel.vendors[0].id,
                                    x: newLevel.vendors[0].x,
                                    y: newLevel.vendors[0].y,
                                    w: newLevel.vendors[0].width,
                                    h: newLevel.vendors[0].height,
                                    vy: 0,
                                    colors: generateNPCColors()
                                } : gameState.vendor;
                                gameState.spawners = newLevel.spawners || [];
                                
                                // Clear existing enemies and world drops
                                gameState.enemies = [];
                                gameState.worldDrops = [];
                                
                                // Broadcast level change to all players
                                broadcastToAll({
                                    type: 'levelChanged',
                                    levelData: levelLoader.getLevelInfo()
                                });
                                
                                console.log(`Level changed to: ${newLevel.name}`);
                            } else {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: `Level '${data.levelName}' not found`
                                }));
                            }
                        }
                    }
                    break;

                default:
                    console.log('Unknown message type:', data.type, 'from', playerName);
            }
        } catch (error) {
            console.error('Error parsing message from', playerName, ':', error);
            console.error('Raw message:', message.toString());
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`${playerName} disconnected`);
        
        if (playerId && gameState.players.has(playerId)) {
            // Store player data before removing them
            const playerData = gameState.players.get(playerId);
            
            // Save player data to persistent storage
            savePlayerData(playerName, playerData);
            
            // Notify other players
            broadcastToOthers(playerId, {
                type: 'playerLeft',
                name: playerName,
                id: playerId
            });
            
            // Remove disconnected player to allow reconnection
            gameState.players.delete(playerId);
            console.log(`${playerName} data saved to persistent storage`);
            
            // If this was the last player, clear world drops to prevent accumulation
            const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
            if (totalClients === 0 && gameState.worldDrops.length > 0) {
                console.log('Last player disconnected, clearing all world drops to prevent accumulation');
                gameState.worldDrops.length = 0;
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error for', playerName, 'from', clientIp, ':', error);
    });
}

// Wire up WebSocket connections
httpWss.on('connection', (ws, req) => handleWebSocketConnection(ws, req, false));
if (httpsWss) {
    httpsWss.on('connection', (ws, req) => handleWebSocketConnection(ws, req, true));
}

// Ping all clients every 30 seconds to detect disconnections
const interval = setInterval(() => {
    const httpClients = Array.from(httpWss.clients);
    const httpsClients = httpsWss ? Array.from(httpsWss.clients) : [];
    const totalClients = httpClients.length + httpsClients.length;
    
    // Ping HTTP clients
    httpClients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
    
    // Ping HTTPS clients
    httpsClients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// High-frequency projectile updates for smoothness (60 FPS)
setInterval(() => {
    if (gameState.projectiles && gameState.projectiles.length > 0) {
        const now = Date.now();
        const dt = 0.016; // 60 FPS
        
        for (let i = 0; i < gameState.projectiles.length; i++) {
            const projectile = gameState.projectiles[i];
            
            // Check if projectile has expired
            if (now - projectile.createdAt > projectile.lifeTime) {
                continue;
            }
            
            // Apply physics
            if (projectile.type === 'arrow') {
                // Arrow has parabolic arc (gravity)
                projectile.vy += 800 * dt; // gravity
            }
            // Fireball goes straight (no gravity)
            
            // Update position
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
        }
        
        // Broadcast projectile updates to all clients
        if (gameState.projectiles.length > 0) {
            for (const projectile of gameState.projectiles) {
                broadcastToAll({
                    type: 'projectileUpdate',
                    id: projectile.id,
                    x: projectile.x,
                    y: projectile.y,
                    vx: projectile.vx,
                    vy: projectile.vy
                });
            }
        }
    }
}, 16); // 60 FPS updates

// Save player positions every 5 seconds for persistence
const positionSaveInterval = setInterval(() => {
    const now = Date.now();
    
                        // Periodically save player data to persistent storage
        for (const [playerId, playerData] of gameState.players) {
            // Skip saving if player just connected (to prevent overwriting loaded data)
            if (playerData.justConnected) {
                // Clear the flag after first save cycle
                playerData.justConnected = false;
                continue;
            }
            // Save current player data to persistent storage every 30 seconds
            savePlayerData(playerData.name, playerData);
        }
    
    // Note: Player data is now stored persistently in files, no cleanup needed
    
    // Clean up old world drops (older than 5 minutes) to prevent accumulation
    const worldDropCleanupTime = 5 * 60 * 1000; // 5 minutes
    for (let i = gameState.worldDrops.length - 1; i >= 0; i--) {
        const drop = gameState.worldDrops[i];
        if (drop.noPickupUntil && (now - drop.noPickupUntil) > worldDropCleanupTime) {
            gameState.worldDrops.splice(i, 1);
            console.log(`Cleaned up old world drop: ${drop.item?.name || 'unknown'}`);
        }
    }
    
    // If no players are connected, clear all world drops to prevent accumulation
    const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
    if (totalClients === 0 && gameState.worldDrops.length > 0) {
        console.log('No players connected, clearing all world drops to prevent accumulation');
        gameState.worldDrops.length = 0;
    }
}, 5000);

// Clean up on server close
httpWss.on('close', () => {
    clearInterval(interval);
    clearInterval(positionSaveInterval);
    clearInterval(gameLoopInterval);
});

if (httpsWss) {
    httpsWss.on('close', () => {
        clearInterval(interval);
        clearInterval(positionSaveInterval);
        clearInterval(gameLoopInterval);
    });
}

// Simple server-authoritative enemy AI + spawn tick
let lastEnemyTick = Date.now();
const gameLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.016, (now - lastEnemyTick) / 1000);
    lastEnemyTick = now;

    // Handle respawns
    for (const sp of gameState.spawners) {
        if (!sp.currentEnemyId && now >= sp.respawnAt) {
            // Only spawn enemies if there are players connected
            const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
            if (totalClients > 0) {
                const enemy = {
                    id: gameState.nextEnemyId++,
                    x: sp.x,
                    y: sp.y,
                    level: 1 + Math.floor(Math.random()*3),
                    health: 20 + (1 + Math.floor(Math.random()*3)) * 12,
                    maxHealth: 20 + (1 + Math.floor(Math.random()*3)) * 12,
                    spawnerId: sp.id,
                    homeX: sp.x,
                    homeY: sp.y,
                    visibilityRange: sp.visibilityRange,
                    type: sp.type || 'basic',
                    dead: false,
                    attackCooldown: 0,
                    name: getRandomEnemyName(),
                    colors: generateNPCColors()
                };
                gameState.enemies.push(enemy);
                sp.currentEnemyId = enemy.id;
                broadcastToAll({ 
                    type: 'enemySpawned', 
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    level: enemy.level,
                    health: enemy.health,
                    maxHealth: enemy.maxHealth,
                    type: enemy.type,
                    name: enemy.name,
                    colors: enemy.colors
                });
            }
        }
    }

    // Apply physics to vendor (gravity and ground collision)
    if (gameState.vendor) {
        if (typeof gameState.vendor.vy !== 'number') gameState.vendor.vy = 0;
        gameState.vendor.vy += 1200 * dt; // gravity
        gameState.vendor.y += gameState.vendor.vy * dt;
        
        // Ground collision at GROUND_Y (ground level)
        const groundY = GROUND_Y;
        if (gameState.vendor.y > groundY - gameState.vendor.h) {
            gameState.vendor.y = groundY - gameState.vendor.h;
            gameState.vendor.vy = 0;
        }
    }

    if (!gameState.enemies.length) return;
    const playersArr = Array.from(gameState.players.values());
    if (!playersArr.length) return;

    const speedBase = 120; // px/s
    for (const enemy of gameState.enemies) {
        // Determine nearest player
        let nearest = playersArr[0];
        let bestDist = Math.hypot((nearest?.x || 0) - (enemy.x || 0), (nearest?.y || 0) - (enemy.y || 0));
        for (let i = 1; i < playersArr.length; i++) {
            const p = playersArr[i];
            const d = Math.hypot((p.x || 0) - (enemy.x || 0), (p.y || 0) - (enemy.y || 0));
            if (d < bestDist) { bestDist = d; nearest = p; }
        }
        const inRange = bestDist <= (enemy.visibilityRange || 400);
        const targetX = inRange ? (nearest.x || enemy.homeX || enemy.x) : (enemy.homeX || enemy.x);
        const speed = speedBase + (enemy.level || 1) * 6;
        const dir = Math.sign(targetX - (enemy.x || 0));
        if (Math.abs(targetX - (enemy.x || 0)) > 2) {
            enemy.x = (enemy.x || 0) + dir * speed * dt;
            enemy.vx = dir * speed;
        } else {
            enemy.vx = 0;
        }
        // Apply simple gravity to settle to ground/homeY
        const groundY = typeof enemy.homeY === 'number' ? enemy.homeY : (GROUND_Y - 64);
        if (typeof enemy.vy !== 'number') enemy.vy = 0;
        enemy.vy += 1200 * dt; // gravity
        enemy.y = (enemy.y || groundY) + enemy.vy * dt;
        if (enemy.y > groundY) { enemy.y = groundY; enemy.vy = 0; }

        // Attack if close enough and cooldown elapsed
        enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
        if (inRange && enemy.attackCooldown <= 0 && nearest) {
            const dx = (nearest.x || 0) - (enemy.x || 0);
            const dy = (nearest.y || 0) - (enemy.y || 0);
            const dist = Math.hypot(dx, dy);
            
            // Spellcaster behavior - cast spells at range instead of melee
            if (enemy.type === 'spellcaster') {
                // Cast spell if player is within spell range (200-400 pixels)
                if (dist >= 200 && dist <= 400) {
                    const p = gameState.players.get(nearest.id);
                    if (p) {
                        // Create enemy fireball projectile
                        const direction = dx > 0 ? 'right' : 'left';
                        const projectile = {
                            id: `enemy-fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            type: 'fireball',
                            x: enemy.x + (direction === 'right' ? 32 : -8),
                            y: enemy.y + 16,
                            vx: direction === 'right' ? 600 : -600, // Slightly slower than player fireballs
                            vy: 0,
                            damage: 15 + (enemy.level || 1) * 3, // Higher damage than player fireballs
                            playerId: enemy.id, // Use enemy ID to identify enemy projectiles
                            weaponType: 'Wand',
                            createdAt: Date.now(),
                            lifeTime: 5000, // 5 seconds max life
                            isEnemyProjectile: true // Flag to identify enemy projectiles
                        };
                        
                        // Add to game state
                        if (!gameState.projectiles) gameState.projectiles = [];
                        gameState.projectiles.push(projectile);
                        
                        // Broadcast projectile creation to all players
                        broadcastToAll({
                            type: 'projectileCreated',
                            ...projectile
                        });
                        
                        enemy.attackCooldown = 2.0; // Longer cooldown for spells
                        console.log(`Spellcaster ${enemy.name} cast fireball at player ${p.name}`);
                    }
                }
            } else {
                // Regular melee attack for other enemy types
                if (dist <= 80) { // Increased attack range - use <= for edge case
                    const dmg = 12 + (enemy.level || 1) * 2;
                    const p = gameState.players.get(nearest.id);
                    if (p) {
                        p.health = Math.max(0, (p.health || p.maxHealth || 100) - dmg);
                        enemy.attackCooldown = 0.6; // seconds
                    
                        // Check if player died from this attack
                    if (p.health <= 0) {
                        p.isDead = true;
                        p.health = 0;
                        
                        // Drop the most valuable item from inventory/equipment
                        const droppedItem = dropMostValuableItem(p);
                        if (droppedItem) {
                            // Create world drop at player's position
                            const drop = {
                                id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: p.x + 24, // Center of player
                                y: p.y + 32,
                                item: droppedItem,
                                vx: (Math.random() - 0.5) * 100,
                                vy: -Math.random() * 100 - 200,
                                pickRadius: 40,
                                grounded: false,
                                noPickupUntil: Date.now() + 3000 // 3 seconds delay to prevent immediate pickup after death
                            };
                            gameState.worldDrops.push(drop);
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
                            console.log(`Player ${p.name} dropped ${droppedItem.name} due to death`);
                        }
                        
                        // Generate and broadcast death message
                        const deathMessage = generateDeathMessage(p.name, enemy.name, enemy.weaponType || 'Claw');
                        broadcastToAll({
                            type: 'chatMessage',
                            message: deathMessage,
                            color: '#ffa500' // Light orange color
                        });
                        
                        // Broadcast death to all players
                        broadcastToAll({
                            type: 'playerDeath',
                            playerId: p.id,
                            playerName: p.name
                        });
                    }
                    
                        // Notify all clients
                        broadcastToAll({ type: 'playerHit', id: p.id, health: p.health, byEnemyId: enemy.id, damage: dmg });
                        // Also broadcast playerUpdate for consistency
                        broadcastToAll({ type: 'playerUpdate', id: p.id, x: p.x, y: p.y, health: p.health, maxHealth: p.maxHealth, pyreals: p.pyreals });
                    }
                }
            }
        }
    }

    // Handle projectile collision detection and cleanup (position updates handled by high-frequency loop)
    if (gameState.projectiles && gameState.projectiles.length > 0) {
        const now = Date.now();
        const projectilesToRemove = [];
        
        for (let i = 0; i < gameState.projectiles.length; i++) {
            const projectile = gameState.projectiles[i];
            
            // Check if projectile has expired
            if (now - projectile.createdAt > projectile.lifeTime) {
                projectilesToRemove.push(i);
                continue;
            }
            
            // Check collision with enemies (only for player projectiles)
            if (!projectile.isEnemyProjectile) {
                for (const enemy of gameState.enemies) {
                    if (enemy.dead) continue;
                    
                    const dx = projectile.x - enemy.x;
                    const dy = projectile.y - enemy.y;
                    const distance = Math.hypot(dx, dy);
                    
                    if (distance < 32) { // Enemy hit radius
                    // Deal damage
                    enemy.health -= projectile.damage;
                    
                    if (enemy.health <= 0) {
                        enemy.dead = true;
                        // Remove dead enemy from array
                        const enemyIndex = gameState.enemies.findIndex(e => e.id === enemy.id);
                        if (enemyIndex !== -1) {
                            gameState.enemies.splice(enemyIndex, 1);
                        }
                        
                        // Spawn loot when enemy dies
                        const enemyType = enemy.type || 'basic';
                        const lootItems = generateLoot(enemyType, enemy.level || 1);
                        
                        for (const lootItem of lootItems) {
                            const dropX = enemy.x + (Math.random() - 0.5) * 100;
                            const dropY = enemy.y + 10;
                            const drop = {
                                id: `enemy-loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: dropX,
                                y: dropY,
                                item: lootItem,
                                vx: (Math.random() - 0.5) * 140,
                                vy: -Math.random() * 120 - 260,
                                pickRadius: 40,
                                grounded: false,
                                noPickupUntil: Date.now() + 1000
                            };
                            gameState.worldDrops.push(drop);
                            broadcastToAll({ type: 'dropItem', ...drop });
                        }
                        
                        // Schedule respawn
                        const spawner = gameState.spawners.find(s => s.id === enemy.spawnerId);
                        if (spawner) {
                            spawner.currentEnemyId = null;
                            spawner.respawnAt = Date.now() + 8000; // 8 seconds respawn
                        }
                        
                        broadcastToAll({ type: 'enemyDeath', id: enemy.id });
                    } else {
                        broadcastToAll({ 
                            type: 'enemyUpdate', 
                            id: enemy.id, 
                            health: enemy.health,
                            colors: enemy.colors
                        });
                    }
                    
                    // Destroy projectile on hit
                    projectilesToRemove.push(i);
                    break;
                }
            }
            }
            
            // Check collision with players (for enemy projectiles)
            if (projectile.isEnemyProjectile) {
                for (const [playerId, player] of gameState.players) {
                    if (player.isDead) continue;
                    
                    const dx = projectile.x - (player.x + 24); // Player center
                    const dy = projectile.y - (player.y + 32); // Player center
                    const distance = Math.hypot(dx, dy);
                    
                    if (distance < 32) { // Player hit radius
                        // Deal damage to player
                        player.health = Math.max(0, (player.health || player.maxHealth || 100) - projectile.damage);
                        
                        // Check if player died from this attack
                        if (player.health <= 0) {
                            player.isDead = true;
                            player.health = 0;
                            
                            // Drop the most valuable item from inventory/equipment
                            const droppedItem = dropMostValuableItem(player);
                            if (droppedItem) {
                                // Create world drop at player's position
                                const drop = {
                                    id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    x: player.x + 24, // Center of player
                                    y: player.y + 32,
                                    item: droppedItem,
                                    vx: (Math.random() - 0.5) * 100,
                                    vy: -Math.random() * 100 - 200,
                                    pickRadius: 40,
                                    grounded: false,
                                    noPickupUntil: Date.now() + 3000 // 3 seconds delay
                                };
                                gameState.worldDrops.push(drop);
                                // Broadcast item drop to all players
                                broadcastToAll({
                                    type: 'dropItem',
                                    ...drop
                                });
                                console.log(`Player ${player.name} dropped ${droppedItem.name} due to enemy spell`);
                            }
                            
                            // Generate and broadcast death message
                            const deathMessage = generateDeathMessage(player.name, 'Enemy Spellcaster', 'Fireball');
                            broadcastToAll({
                                type: 'chatMessage',
                                message: deathMessage,
                                color: '#ffa500' // Light orange color
                            });
                            
                            // Broadcast death to all players
                            broadcastToAll({
                                type: 'playerDeath',
                                playerId: player.id,
                                playerName: player.name
                            });
                        }
                        
                        // Notify all clients
                        broadcastToAll({ type: 'playerHit', id: player.id, health: player.health, byEnemyId: projectile.playerId, damage: projectile.damage });
                        // Also broadcast playerUpdate for consistency
                        broadcastToAll({ type: 'playerUpdate', id: player.id, x: player.x, y: player.y, health: player.health, maxHealth: player.maxHealth, pyreals: player.pyreals });
                        
                        // Destroy projectile on hit
                        projectilesToRemove.push(i);
                        console.log(`Enemy fireball hit player ${player.name} for ${projectile.damage} damage`);
                        break;
                    }
                }
            }
            
            // Check collision with environment (ground/platforms)
            if (projectile.y > GROUND_Y) {
                projectilesToRemove.push(i);
            }
        }
        
        // Remove destroyed projectiles (in reverse order to maintain indices)
        for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
            const index = projectilesToRemove[i];
            const destroyedProjectile = gameState.projectiles[index];
            gameState.projectiles.splice(index, 1);
            
            // Broadcast projectile destruction
            broadcastToAll({
                type: 'projectileDestroyed',
                id: destroyedProjectile.id
            });
        }
    }

    // Broadcast consolidated updates (only when there are clients connected)
    const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
    if (totalClients > 0) {
        for (const enemy of gameState.enemies) {
            broadcastToAll({ 
                type: 'enemyUpdate', 
                id: enemy.id, 
                x: enemy.x, 
                y: enemy.y, 
                vx: enemy.vx || 0, 
                health: enemy.health, 
                maxHealth: enemy.maxHealth, 
                level: enemy.level,
                colors: enemy.colors
            });
        }
        
        // Broadcast vendor position updates to all clients
        if (gameState.vendor) {
            broadcastToAll({ 
                type: 'vendorUpdate', 
                x: gameState.vendor.x, 
                y: gameState.vendor.y,
                colors: gameState.vendor.colors // Include colors to ensure they're preserved
            });
        }
    }
}, 16.67); // End of main game loop - 60 ticks per second

// Helper functions are now managed in their respective modules

// Function to handle enemy death and loot generation
function handleEnemyDeath(enemy, gameState, broadcastToAll) {
    // Generate loot for the enemy
    const loot = generateLoot(enemy.type, enemy.level);
    
    // Create world drops for each loot item
    loot.forEach(item => {
        const drop = {
            id: `enemy-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: enemy.x + 16, // Center of enemy
            y: enemy.y + 24,
            item: item,
            vx: (Math.random() - 0.5) * 100,
            vy: -Math.random() * 100 - 200,
            pickRadius: 40,
            grounded: false,
            noPickupUntil: Date.now() + 2000 // 2 seconds delay
        };
        
        gameState.worldDrops.push(drop);
        
        // Broadcast item drop to all players
        broadcastToAll({
            type: 'dropItem',
            ...drop
        });
    });
    
    console.log(`Enemy ${enemy.name} (L${enemy.level}) died and dropped ${loot.length} items`);
    
    // Mark enemy for respawn
    enemy.respawnAt = Date.now() + 10000; // 10 seconds
    enemy.health = 0;
    enemy.dead = true;
}

function broadcastToAll(message) {
    // Broadcast to HTTP WebSocket clients
    const httpClients = Array.from(httpWss.clients);
    let httpSentCount = 0;
    
    httpClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
                httpSentCount++;
            } catch (error) {
                console.error('Error broadcasting message to HTTP client:', error);
            }
        }
    });
    
    // Broadcast to HTTPS WebSocket clients
    let httpsSentCount = 0;
    if (httpsWss) {
        const httpsClients = Array.from(httpsWss.clients);
        httpsClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(message));
                    httpsSentCount++;
                } catch (error) {
                    console.error('Error broadcasting message to HTTPS client:', error);
                }
            }
        });
    }
    
    const totalSent = httpSentCount + httpsSentCount;
    const totalClients = httpClients.length + (httpsWss ? httpsWss.clients.size : 0);
}

function broadcastToOthers(excludePlayerId, message) {
    let totalSentCount = 0;
    
    // Broadcast to HTTP WebSocket clients
    const httpClients = Array.from(httpWss.clients);
    httpClients.forEach((client) => {
        // Skip the client that should be excluded
        if (client.playerId === excludePlayerId) {
            return;
        }
        
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
                totalSentCount++;
            } catch (error) {
                console.error('Error broadcasting message to HTTP client:', error);
            }
        }
    });
    
    // Broadcast to HTTPS WebSocket clients
    if (httpsWss) {
        const httpsClients = Array.from(httpsWss.clients);
        httpsClients.forEach((client) => {
            // Skip the client that should be excluded
            if (client.playerId === excludePlayerId) {
                return;
            }
            
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(message));
                    totalSentCount++;
                } catch (error) {
                    console.error('Error broadcasting message to HTTPS client:', error);
                }
            }
        });
    }
}

// Start server
const HTTP_PORT = process.env.HTTP_PORT || 8081;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const HOST = '0.0.0.0';

httpServer.listen(HTTP_PORT, HOST, () => {
    console.log(`Browseron's Call HTTP server running on port ${HTTP_PORT}`);
    console.log(`Game available at: http://localhost:${HTTP_PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${HTTP_PORT}`);
});

if (httpsWss) {
    httpsServer.listen(HTTPS_PORT, HOST, () => {
        console.log(`Browseron's Call HTTPS server running on port ${HTTPS_PORT}`);
        console.log(`Game available at: https://localhost:${HTTPS_PORT}`);
        console.log(`WebSocket endpoint: wss://localhost:${HTTPS_PORT}`);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server gracefully...');
    clearInterval(interval);
    httpWss.close(() => {
        if (httpsWss) {
            httpsWss.close(() => {
                console.log('HTTPS server shut down successfully');
            });
        }
        console.log('HTTP server shut down successfully');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    clearInterval(interval);
    httpWss.close(() => {
        if (httpsWss) {
            httpsWss.close(() => {
                console.log('HTTPS server shut down successfully');
            });
        }
        console.log('HTTP server shut down successfully');
        process.exit(0);
    });
});

