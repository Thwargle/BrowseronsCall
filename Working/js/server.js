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
console.log('Attempting to load sample_level...');
const defaultLevel = levelLoader.loadLevel('sample_level');
console.log('Loaded level data:', defaultLevel.name);
console.log('Level has portals:', !!defaultLevel.portals, 'count:', (defaultLevel.portals || []).length);
levelLoader.applyLevelToGameState({}, defaultLevel);

// Per-level game states
const levelGameStates = new Map();
const globalPlayers = new Map(); // Global player registry

// Helper functions for level-specific game state
function getLevelGameState(levelName) {
    if (!levelGameStates.has(levelName)) {
        // Load level data and create game state
        const levelData = levelLoader.loadLevel(levelName);
        if (levelData) {
            const levelState = {
                enemies: [],
                worldDrops: [],
                nextEnemyId: 1,
                vendor: levelData.vendors[0] ? {
                    id: levelData.vendors[0].id,
                    x: levelData.vendors[0].x,
                    y: levelData.vendors[0].y,
                    w: levelData.vendors[0].width,
                    h: levelData.vendors[0].height,
                    vy: 0,
                    colors: generateNPCColors(),
                    anim: {timer: 0, index: 0}
                } : null,
                spawners: (levelData.spawners || []).map(spawner => ({
                    ...spawner,
                    respawnAt: Date.now() + 2000 // Start respawning after 2 seconds
                })),
                portals: levelData.portals || [],
                levelData: levelData
            };
            levelGameStates.set(levelName, levelState);
        }
    }
    return levelGameStates.get(levelName);
}

function getPlayersInLevel(levelName) {
    const players = [];
    for (const [playerId, player] of globalPlayers) {
        if (playerLevels.get(playerId) === levelName) {
            players.push(player);
        }
    }
    return players;
}

function broadcastToLevel(levelName, message) {
    const playersInLevel = getPlayersInLevel(levelName);
    for (const player of playersInLevel) {
        // Find the WebSocket connection for this player
        const httpClients = Array.from(httpWss.clients);
        const httpsClients = httpsWss ? Array.from(httpsWss.clients) : [];
        const allClients = [...httpClients, ...httpsClients];
        
        for (const ws of allClients) {
            if (ws.playerId === player.id) {
                ws.send(JSON.stringify(message));
                break;
            }
        }
    }
}

// Initialize default level game state
const defaultLevelState = {
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
        colors: generateNPCColors(),
        anim: {timer: 0, index: 0}
    } : null,
    spawners: defaultLevel.spawners || [],
    portals: defaultLevel.portals || [],
    levelData: defaultLevel
};

levelGameStates.set('sample_level', defaultLevelState);

// Legacy gameState for backward compatibility (will be removed)
const gameState = {
    players: globalPlayers,
    enemies: defaultLevelState.enemies,
    worldDrops: defaultLevelState.worldDrops,
    nextEnemyId: defaultLevelState.nextEnemyId,
    vendor: defaultLevelState.vendor,
    spawners: defaultLevelState.spawners,
    portals: defaultLevelState.portals,
    levelData: defaultLevelState.levelData
};

console.log('Game state initialized with portals:', gameState.portals.length);
if (gameState.portals.length > 0) {
    console.log('Portal details:', gameState.portals);
}

// Per-player level tracking
const playerLevels = new Map(); // playerId -> levelName

// Debug: Log vendor colors at startup
console.log('Server starting with vendor colors:', gameState.vendor ? gameState.vendor.colors : 'No vendor');
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
                    
                    // World drops are now managed per-level, so no need to clear global drops
                    
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
                    
                    globalPlayers.set(playerId, {
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
                    
                    // Initialize player with sample level
                    playerLevels.set(playerId, 'sample_level');

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

                    // Get level-specific world drops
                    let groundLootToSend = levelState.worldDrops;
                    if (storedPlayerData) {
                        console.log(`${playerName} reconnecting: sending current ground loot (${groundLootToSend.length} items)`);
                    } else {
                        console.log(`${playerName} new player: sending current ground loot (${groundLootToSend.length} items)`);
                    }

                    // Get level-specific game state
                    const playerLevel = playerLevels.get(playerId) || 'sample_level';
                    const levelState = getLevelGameState(playerLevel);
                    const playersInLevel = getPlayersInLevel(playerLevel);
                    
                    // IMPORTANT: Add the current player to playersInLevel so they receive their own player data
                    const currentPlayer = globalPlayers.get(playerId);
                    if (currentPlayer && !playersInLevel.find(p => p.id === playerId)) {
                        playersInLevel.push(currentPlayer);
                    }
                    
                    // Ensure floors are always available - check multiple sources
                    let floorsToSend = [];
                    if (levelState.levelData && levelState.levelData.floors) {
                        floorsToSend = levelState.levelData.floors;
                    } else if (levelState.levelData && Array.isArray(levelState.levelData.floors)) {
                        floorsToSend = levelState.levelData.floors;
                    }
                    
                    // Send current game state to new player (level-specific)
                    const gameStateMsg = {
                        type: 'gameState',
                        players: playersInLevel,
                        enemies: levelState.enemies,
                        worldDrops: levelState.worldDrops,
                        vendor: levelState.vendor,
                        portals: levelState.portals || [],
                        spawners: levelState.spawners,
                        floors: floorsToSend
                    };
                    
                    // Debug: Log vendor and floor data being sent
                    console.log(`Sending vendor to ${playerName} - hasVendor: ${!!levelState.vendor}, hasColors: ${!!(levelState.vendor && levelState.vendor.colors)}`);
                    console.log(`Sending floors to ${playerName} - floors count: ${gameStateMsg.floors.length}`);
                    if (gameStateMsg.floors.length > 0) {
                        console.log(`First floor being sent:`, gameStateMsg.floors[0]);
                    } else {
                        console.warn(`WARNING: No floors found for level ${playerLevel}! levelData:`, !!levelState.levelData, 'floors:', levelState.levelData?.floors);
                    }
                    
                    // Send player's own equipment and inventory data FIRST, before gameState
                    // This ensures inventory is loaded before the game renders
                    const currentPlayerData = globalPlayers.get(playerId);
                    const playerDataMsg = {
                        type: 'playerData',
                        equip: currentPlayerData.equip,
                        inventory: currentPlayerData.inventory
                    };
                    ws.send(JSON.stringify(playerDataMsg));
                    
                    // Send gameState after playerData so inventory is ready
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
                    // Create new enemy with floor collision
                    const spawnX = typeof data.x === 'number' ? data.x : 500;
                    let spawnY = GROUND_Y - 64;
                    
                    // Get level state first for enemy ID generation
                    const currentPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                    const spawnLevelState = getLevelGameState(currentPlayerLevel);
                    
                    // Calculate proper Y position using floor collision
                    const floors = spawnLevelState.levelData ? spawnLevelState.levelData.floors || [] : [];
                    for (const floor of floors) {
                        if (spawnX + 48 > floor.x && 
                            spawnX < floor.x + floor.width && 
                            spawnY + 64 > floor.y && 
                            spawnY < floor.y + floor.height) {
                            // Place enemy on top of floor
                            spawnY = floor.y - 64;
                            break;
                        }
                    }
                    
                    const enemy = {
                        id: spawnLevelState.nextEnemyId++,
                        x: spawnX,
                        y: spawnY,
                        level: data.level || 1,
                        health: 20 + (data.level || 1) * 12,
                        maxHealth: 20 + (data.level || 1) * 12,
                        homeX: spawnX,
                        homeY: spawnY,
                        visibilityRange: 400,
                        name: getRandomEnemyName(),
                        colors: generateNPCColors()
                    };
                    
                    // Add enemy to the appropriate level's game state
                    spawnLevelState.enemies.push(enemy);
                    
                    // Broadcast enemy spawn to players in the same level only
                    broadcastToLevel(currentPlayerLevel, {
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
                        
                        // Broadcast player update to other players in the same level only
                        const currentLevel = playerLevels.get(playerId) || 'sample_level';
                        broadcastToLevel(currentLevel, {
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
                        // broadcast to players in the same level so they can render current inventory
                        const inventoryLevel = playerLevels.get(playerId) || 'sample_level';
                        broadcastToLevel(inventoryLevel, { type: 'inventoryUpdate', id: playerId, inventory: player.inventory });
                    }
                    break;

                case 'visualUpdate':
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        if (data.shirtColor !== undefined) player.shirtColor = data.shirtColor;
                        if (data.pantColor !== undefined) player.pantColor = data.pantColor;
                        if (data.equipmentColors !== undefined) player.equipmentColors = data.equipmentColors;
                        
                        // Broadcast visual update to players in the same level
                        const visualLevel = playerLevels.get(playerId) || 'sample_level';
                        broadcastToLevel(visualLevel, { 
                            type: 'visualUpdate', 
                            id: playerId, 
                            shirtColor: player.shirtColor,
                            pantColor: player.pantColor,
                            equipmentColors: player.equipmentColors
                        });
                    }
                    break;

                case 'enemyUpdate':
                    // Update enemy state in the player's current level
                    const enemyUpdatePlayerLevel = playerLevels.get(playerId) || 'sample_level';
                    const enemyUpdateLevelState = getLevelGameState(enemyUpdatePlayerLevel);
                    const enemyIndex = enemyUpdateLevelState.enemies.findIndex(e => e.id === data.id);
                    if (enemyIndex !== -1) {
                        Object.assign(enemyUpdateLevelState.enemies[enemyIndex], data);
                        
                        // Broadcast enemy update to other players in the same level
                        broadcastToLevel(enemyUpdatePlayerLevel, {
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
                            colors: enemyUpdateLevelState.enemies[enemyIndex].colors
                        });
                    }
                    break;

                case 'attackEnemy':
                    // Find enemy in the player's current level
                    const attackPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                    const attackLevelState = getLevelGameState(attackPlayerLevel);
                    const targetEnemy = attackLevelState.enemies.find(e => e.id === data.id);
                    if (targetEnemy && !targetEnemy.dead) {
                        targetEnemy.health -= data.damage;
                        if (targetEnemy.health <= 0) {
                            targetEnemy.dead = true;
                            // Remove dead enemy from level's array
                            const enemyIndex = attackLevelState.enemies.findIndex(e => e.id === targetEnemy.id);
                            if (enemyIndex !== -1) {
                                attackLevelState.enemies.splice(enemyIndex, 1);
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
                                attackLevelState.worldDrops.push(drop);
                                // Broadcasting loot drop to players in this level
                                broadcastToLevel(attackPlayerLevel, { type: 'dropItem', ...drop });
                            }
                            // Schedule respawn using level-specific spawners
                            const spawner = attackLevelState.spawners.find(s => s.id === targetEnemy.spawnerId);
                            if (spawner) {
                                spawner.currentEnemyId = null;
                                spawner.respawnAt = Date.now() + 8000; // 8 seconds respawn
                            }
                            broadcastToLevel(attackPlayerLevel, { type: 'enemyDeath', id: targetEnemy.id });
                        } else {
                            broadcastToLevel(attackPlayerLevel, { 
                                type: 'enemyUpdate', 
                                id: targetEnemy.id, 
                                health: targetEnemy.health,
                                colors: targetEnemy.colors
                            });
                        }
                    }
                    break;

                case 'portalEnter':
                    // Handle portal collision and level switching per player
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const targetLevel = data.targetLevel;
                        
                        if (targetLevel) {
                            console.log(`Player ${player.name} attempting to enter portal to level: ${targetLevel}`);
                            
                            // Load the target level
                            const newLevelData = levelLoader.loadLevel(targetLevel);
                            if (newLevelData) {
                                console.log(`Loaded level: ${newLevelData.name}`);
                                console.log(`- Floors: ${newLevelData.floors ? newLevelData.floors.length : 0}`);
                                console.log(`- Vendors: ${newLevelData.vendors ? newLevelData.vendors.length : 0}`);
                                console.log(`- Spawners: ${newLevelData.spawners ? newLevelData.spawners.length : 0}`);
                                console.log(`- Portals: ${newLevelData.portals ? newLevelData.portals.length : 0}`);
                                
                                // Get the old level before updating
                                const oldLevel = playerLevels.get(playerId) || 'sample_level';
                                
                                // Update player's current level
                                playerLevels.set(playerId, targetLevel);
                                
                                // Broadcast playerLeft to players in the old level (with levelChange flag)
                                broadcastToLevel(oldLevel, {
                                    type: 'playerLeft',
                                    name: player.name,
                                    id: playerId,
                                    levelChange: true
                                });
                                
                                // Get or create the level-specific game state
                                // If level state already exists, ensure it's fresh (enemies and drops cleared for this player)
                                const levelState = getLevelGameState(targetLevel);
                                
                                // NOTE: We don't clear levelState.enemies or levelState.worldDrops here because
                                // other players might be in this level. Each level maintains its own state.
                                // The client will receive the current state of the level.
                                
                                // Move player to spawn position in new level
                                player.x = newLevelData.spawn ? newLevelData.spawn.x : 80;
                                player.y = newLevelData.spawn ? newLevelData.spawn.y : 0;
                                
                                // Get players in the new level
                                const playersInNewLevel = getPlayersInLevel(targetLevel);
                                
                                // Ensure floors are always available
                                let floorsToSend = [];
                                if (newLevelData && newLevelData.floors && Array.isArray(newLevelData.floors)) {
                                    floorsToSend = newLevelData.floors;
                                } else if (levelState.levelData && levelState.levelData.floors && Array.isArray(levelState.levelData.floors)) {
                                    floorsToSend = levelState.levelData.floors;
                                }
                                
                                // Send level change only to this player with level-specific data
                                // IMPORTANT: Send empty enemies array initially - enemies will spawn from spawners after floors render
                                // This ensures enemies appear on top of floors, not inside them
                                const levelChangeMsg = {
                                    type: 'levelChange',
                                    levelName: newLevelData.name,
                                    levelData: newLevelData,
                                    players: playersInNewLevel,
                                    enemies: [], // Start with empty - enemies spawn from spawners after client loads floors
                                    worldDrops: levelState.worldDrops || [], // Only send drops that belong to this level
                                    vendor: levelState.vendor,
                                    portals: levelState.portals || [],
                                    spawners: levelState.spawners,
                                    floors: floorsToSend
                                };
                                
                                // Reset spawner respawn timers to ensure enemies spawn soon after level loads
                                // This gives time for floors to render on client first
                                if (levelState.spawners) {
                                    levelState.spawners.forEach(spawner => {
                                        // Reset respawn timer to spawn enemies 2 seconds after level change
                                        // This ensures floors render first
                                        spawner.respawnAt = Date.now() + 2000;
                                        spawner.currentEnemyId = null; // Clear any existing enemy references
                                    });
                                    console.log(`Reset ${levelState.spawners.length} spawners for level ${targetLevel} - enemies will spawn in 2 seconds`);
                                }
                                
                                console.log('Level change data being sent:');
                                console.log('- Vendor:', levelState.vendor ? `${levelState.vendor.id} at (${levelState.vendor.x}, ${levelState.vendor.y})` : 'None');
                                console.log('- Spawners:', levelState.spawners.length);
                                console.log('- Enemies:', levelState.enemies.length);
                                console.log('- World Drops:', levelState.worldDrops.length);
                                console.log('- Floors:', floorsToSend.length);
                                
                                console.log('Sending levelChange message:', JSON.stringify(levelChangeMsg, null, 2));
                                ws.send(JSON.stringify(levelChangeMsg));
                                
                                console.log(`Player ${player.name} successfully entered portal to level: ${targetLevel}`);
                            } else {
                                console.log(`Failed to load level: ${targetLevel}`);
                                // Send error message to player
                                ws.send(JSON.stringify({
                                    type: 'chatMessage',
                                    message: `Level ${targetLevel} not found!`
                                }));
                            }
                        }
                    }
                    break;

                case 'dropItem':
                    // Add item drop to world with proper physics
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const dropPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                        const dropLevelState = getLevelGameState(dropPlayerLevel);
                        
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
                            
                            dropLevelState.worldDrops.push(drop);
                            
                            // Broadcast item drop to players in this level only
                            broadcastToLevel(dropPlayerLevel, {
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const pickupPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                        const pickupLevelState = getLevelGameState(pickupPlayerLevel);
                        const { dropId, slotIndex } = data;
                        
                        console.log(`Player ${playerName} picking up item from drop ${dropId} to slot ${slotIndex}`);
                        
                        // Find the world drop
                        const dropIndex = pickupLevelState.worldDrops.findIndex(d => d.id === dropId);
                        if (dropIndex !== -1) {
                            const drop = pickupLevelState.worldDrops[dropIndex];
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
                                    
                                    pickupLevelState.worldDrops.push(newDrop);
                                    
                                    // Broadcast the new drop to players in this level only
                                    broadcastToLevel(pickupPlayerLevel, {
                                        type: 'dropItem',
                                        ...newDrop
                                    });
                                } else {
                                    // Empty slot, just place the item
                                    player.inventory[slotIndex] = item;
                                }
                                
                                // Remove the original drop from the world
                                pickupLevelState.worldDrops.splice(dropIndex, 1);
                                
                                // Broadcast item pickup to players in this level only
                                broadcastToLevel(pickupPlayerLevel, {
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const movePlayerLevel = playerLevels.get(playerId) || 'sample_level';
                        const moveLevelState = getLevelGameState(movePlayerLevel);
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
                            const worldDropIndex = moveLevelState.worldDrops.findIndex(d => d.item && d.item.id === itemId);
                            if (worldDropIndex !== -1) {
                                sourceItem = moveLevelState.worldDrops[worldDropIndex].item;
                                moveLevelState.worldDrops.splice(worldDropIndex, 1);
                                // Broadcast removal of world drop to players in this level only
                                broadcastToLevel(movePlayerLevel, { type: 'pickupItem', dropId: moveLevelState.worldDrops[worldDropIndex]?.id, playerId: playerId });
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
                                        moveLevelState.worldDrops.push(displacedDrop);
                                        // Broadcast the new world drop to players in this level only
                                        broadcastToLevel(movePlayerLevel, {
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
                                    
                                    // Broadcast equipment update to players in the same level only
                                    broadcastToLevel(movePlayerLevel, {
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
                                    
                                    // Broadcast equipment update to players in the same level only
                                    broadcastToLevel(movePlayerLevel, {
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
                                    
                                    // Broadcast equipment update to players in the same level only
                                    broadcastToLevel(movePlayerLevel, {
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const dropPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                        const dropLevelState = getLevelGameState(dropPlayerLevel);
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
                            
                            dropLevelState.worldDrops.push(drop);
                            
                            // Broadcast item drop to players in this level only
                            broadcastToLevel(dropPlayerLevel, {
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
                                
                                // Broadcast equipment update to players in the same level only
                                broadcastToLevel(dropPlayerLevel, {
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
                        const sellPlayerLevel = playerLevels.get(playerId) || 'sample_level';
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
                                
                                // Broadcast equipment update to players in the same level only
                                broadcastToLevel(sellPlayerLevel, {
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
                            
                            // Broadcast player update to players in the same level only (for pyreals change)
                            broadcastToLevel(sellPlayerLevel, {
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const playerLevel = playerLevels.get(playerId) || 'sample_level';
                        const levelState = getLevelGameState(playerLevel);
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
                            // Add to level-specific game state
                            if (!levelState.projectiles) levelState.projectiles = [];
                            levelState.projectiles.push(projectile);
                            
                            // Broadcast projectile creation to players in this level only
                            broadcastToLevel(playerLevel, {
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
                                } : null;
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
            playerLevels.delete(playerId);
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

// High-frequency projectile updates for smoothness (60 FPS) - level-based
setInterval(() => {
    const now = Date.now();
    const dt = 0.016; // 60 FPS
    
    // Process projectiles for each level separately
    for (const [levelName, levelState] of levelGameStates) {
        if (!levelState.projectiles || levelState.projectiles.length === 0) continue;
        
        const playersInLevel = getPlayersInLevel(levelName);
        if (playersInLevel.length === 0) continue;
        
        for (let i = levelState.projectiles.length - 1; i >= 0; i--) {
            const projectile = levelState.projectiles[i];
            
            // Check if projectile has expired
            if (now - projectile.createdAt > projectile.lifeTime) {
                levelState.projectiles.splice(i, 1);
                // Broadcast destruction to players
                broadcastToLevel(levelName, {
                    type: 'projectileDestroyed',
                    id: projectile.id
                });
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
            
            // Remove projectiles that go off-screen (beyond reasonable bounds)
            // Check if projectile is way off-screen to the left, right, or below
            const levelWidth = levelState.levelData ? (levelState.levelData.width || 3600) : 3600;
            const levelHeight = levelState.levelData ? (levelState.levelData.height || 600) : 600;
            const margin = 500; // Remove if beyond this margin outside level bounds
            
            if (projectile.x < -margin || 
                projectile.x > levelWidth + margin || 
                projectile.y > levelHeight + margin ||
                projectile.y < -margin) {
                // Projectile is off-screen, remove it
                const destroyedProjectile = levelState.projectiles.splice(i, 1)[0];
                // Broadcast destruction to players
                broadcastToLevel(levelName, {
                    type: 'projectileDestroyed',
                    id: destroyedProjectile.id
                });
                continue;
            }
        }
        
        // Broadcast projectile updates to players in this level only
        if (levelState.projectiles.length > 0) {
            for (const projectile of levelState.projectiles) {
                broadcastToLevel(levelName, {
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

// Level-based game loop - processes each level separately
let lastEnemyTick = Date.now();
const gameLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.016, (now - lastEnemyTick) / 1000);
    lastEnemyTick = now;

    // Process each level separately
    for (const [levelName, levelState] of levelGameStates) {
        // Only process levels that have players
        const playersInLevel = getPlayersInLevel(levelName);
        if (playersInLevel.length === 0) continue;

        // Handle enemy AI for this level
        for (let i = levelState.enemies.length - 1; i >= 0; i--) {
            const enemy = levelState.enemies[i];
            if (enemy.dead) {
                levelState.enemies.splice(i, 1);
                continue;
            }

            // Find nearest player in this level
            let nearest = null;
            let nearestDistance = Infinity;
            for (const player of playersInLevel) {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                    nearest = player;
                    nearestDistance = distance;
                }
            }

            const inRange = nearest && nearestDistance < (enemy.visibilityRange || 400);
            
            // Enemy movement AI
            const targetX = inRange ? (nearest.x || enemy.homeX || enemy.x) : (enemy.homeX || enemy.x);
            const speedBase = 120;
            const speed = speedBase + (enemy.level || 1) * 6;
            
            if (enemy.x < targetX) {
                enemy.x += speed * dt;
            } else if (enemy.x > targetX) {
                enemy.x -= speed * dt;
            }

            // Apply gravity and floor collision
            if (typeof enemy.vy !== 'number') enemy.vy = 0;
            enemy.vy += 1200 * dt; // gravity
            enemy.y = (enemy.y || 0) + enemy.vy * dt;
            
            // Floor collision using level data
            const floors = levelState.levelData ? levelState.levelData.floors || [] : [];
            let onFloor = false;
            for (const floor of floors) {
                if (enemy.x + 48 > floor.x && 
                    enemy.x < floor.x + floor.width && 
                    enemy.y + 64 > floor.y && 
                    enemy.y < floor.y + floor.height) {
                    // Check if landing on top of floor
                    if (enemy.vy > 0 && enemy.y < floor.y) {
                        enemy.y = floor.y - 64;
                        enemy.vy = 0;
                        onFloor = true;
                        break;
                    }
                }
            }
            
            // Fallback to old ground collision if no floor collision
            if (!onFloor) {
                const groundY = typeof enemy.homeY === 'number' ? enemy.homeY : (GROUND_Y - 64);
                if (enemy.y > groundY) { 
                    enemy.y = groundY; 
                    enemy.vy = 0; 
                }
            }

            // Attack if close enough and cooldown elapsed
            enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
            if (inRange && enemy.attackCooldown === 0) {
                // Perform attack (e.g., spawn projectile)
                const direction = (nearest.x || 0) > (enemy.x || 0) ? 'right' : 'left';
                const projectile = {
                    id: `enemy-fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'fireball',
                    x: enemy.x + (direction === 'right' ? 32 : -8),
                    y: enemy.y + 16,
                    vx: direction === 'right' ? 600 : -600, // Slightly slower than player fireballs
                    vy: 0,
                    damage: 15 + (enemy.level || 1) * 3, // Higher damage than player fireballs
                    playerId: enemy.id, // Use enemy ID to identify enemy projectiles
                    isEnemyProjectile: true,
                    createdAt: Date.now(),
                    lifeTime: 4000 // 4 seconds max life
                };
                levelState.projectiles = levelState.projectiles || [];
                levelState.projectiles.push(projectile);
                broadcastToLevel(levelName, { type: 'projectileCreated', ...projectile });
                enemy.attackCooldown = 2; // 2 second cooldown
            }

            // Broadcast enemy position updates to players in this level
            broadcastToLevel(levelName, {
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

        // Handle projectile collision detection for this level
        if (levelState.projectiles && levelState.projectiles.length > 0) {
            const projectilesToRemove = [];
            
            for (let i = 0; i < levelState.projectiles.length; i++) {
                const projectile = levelState.projectiles[i];
                
                // Check if projectile has expired
                if (now - projectile.createdAt > projectile.lifeTime) {
                    projectilesToRemove.push(i);
                    continue;
                }
                
                // Check collision with enemies (only for player projectiles)
                if (!projectile.isEnemyProjectile) {
                    for (const enemy of levelState.enemies) {
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
                                const enemyIndex = levelState.enemies.findIndex(e => e.id === enemy.id);
                                if (enemyIndex !== -1) {
                                    levelState.enemies.splice(enemyIndex, 1);
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
                                    levelState.worldDrops.push(drop);
                                    broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                                }
                                
                                // Schedule respawn
                                const spawner = levelState.spawners.find(s => s.id === enemy.spawnerId);
                                if (spawner) {
                                    spawner.currentEnemyId = null;
                                    spawner.respawnAt = Date.now() + 8000; // 8 seconds respawn
                                }
                                
                                broadcastToLevel(levelName, { type: 'enemyDeath', id: enemy.id });
                            } else {
                                broadcastToLevel(levelName, { 
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
                    for (const player of playersInLevel) {
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
                                    levelState.worldDrops.push(drop);
                                    broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                                    console.log(`Player ${player.name} dropped ${droppedItem.name} due to enemy spell`);
                                }
                                
                                // Generate and broadcast death message
                                const deathMessage = generateDeathMessage(player.name, 'Enemy Spellcaster', 'Fireball');
                                broadcastToLevel(levelName, {
                                    type: 'chatMessage',
                                    message: deathMessage,
                                    color: '#ffa500' // Light orange color
                                });
                                
                                // Broadcast death to players in this level
                                broadcastToLevel(levelName, {
                                    type: 'playerDeath',
                                    playerId: player.id,
                                    playerName: player.name
                                });
                            }
                            
                            // Notify clients in this level
                            broadcastToLevel(levelName, { 
                                type: 'playerHit', 
                                id: player.id, 
                                health: player.health, 
                                byEnemyId: projectile.playerId, 
                                damage: projectile.damage 
                            });
                            broadcastToLevel(levelName, { 
                                type: 'playerUpdate', 
                                id: player.id, 
                                x: player.x, 
                                y: player.y, 
                                health: player.health, 
                                maxHealth: player.maxHealth, 
                                pyreals: player.pyreals 
                            });
                            
                            // Destroy projectile on hit
                            projectilesToRemove.push(i);
                            console.log(`Enemy fireball hit player ${player.name} for ${projectile.damage} damage`);
                            break;
                        }
                    }
                }
                
                // Check collision with environment (floor tiles)
                const floors = levelState.levelData ? levelState.levelData.floors || [] : [];
                let hitFloor = false;
                for (const floor of floors) {
                    if (projectile.x > floor.x && 
                        projectile.x < floor.x + floor.width && 
                        projectile.y > floor.y && 
                        projectile.y < floor.y + floor.height) {
                        projectilesToRemove.push(i);
                        hitFloor = true;
                        break;
                    }
                }
                
                // Fallback to old ground collision if no floor collision
                if (!hitFloor && projectile.y > GROUND_Y) {
                    projectilesToRemove.push(i);
                }
            }
            
            // Remove destroyed projectiles (in reverse order to maintain indices)
            for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
                const index = projectilesToRemove[i];
                const destroyedProjectile = levelState.projectiles[index];
                levelState.projectiles.splice(index, 1);
                
                // Broadcast projectile destruction to players in this level
                broadcastToLevel(levelName, {
                    type: 'projectileDestroyed',
                    id: destroyedProjectile.id
                });
            }
        }

        // Handle respawns for this level
        for (const sp of levelState.spawners) {
            if (!sp.currentEnemyId && now >= sp.respawnAt) {
                // Calculate proper Y position using floor collision
                // Find the floor that the spawner X position is over
                // Spawners should be placed ON TOP of floors, not inside them
                let enemyY = null;
                const floors = levelState.levelData ? levelState.levelData.floors || [] : [];
                
                // First, find any floor that horizontally contains the spawner X position
                // Spawner X is the spawn position, enemy is 48 pixels wide
                for (const floor of floors) {
                    // Check if spawner X position (center of enemy) is over this floor
                    // Enemy center will be at sp.x + 24 (half of 48 width)
                    const enemyCenterX = sp.x + 24;
                    if (enemyCenterX >= floor.x && enemyCenterX < floor.x + floor.width) {
                        // Place enemy on top of this floor (floor top minus enemy height of 64)
                        enemyY = floor.y - 64;
                        break;
                    }
                }
                
                // If no floor found directly, try finding the nearest floor below the spawner
                if (enemyY === null) {
                    let bestFloor = null;
                    let bestScore = Infinity; // Lower is better (closest and below)
                    
                    for (const floor of floors) {
                        // Check if spawner X position overlaps with floor horizontally
                        const spawnerLeft = sp.x;
                        const spawnerRight = sp.x + 48;
                        const floorLeft = floor.x;
                        const floorRight = floor.x + floor.width;
                        
                        // Check if there's horizontal overlap
                        if (!(spawnerRight < floorLeft || spawnerLeft > floorRight)) {
                            // There's horizontal overlap - check if floor is below spawner
                            // We want the floor that's closest below the spawner
                            if (floor.y >= sp.y) {
                                const verticalDistance = floor.y - sp.y;
                                // Prefer floors that are closer
                                if (verticalDistance < bestScore) {
                                    bestScore = verticalDistance;
                                    bestFloor = floor;
                                }
                            }
                        }
                    }
                    
                    if (bestFloor) {
                        enemyY = bestFloor.y - 64;
                    } else {
                        // Fallback: find any floor that the spawner is near (within reasonable distance)
                        for (const floor of floors) {
                            if (sp.x + 48 > floor.x && sp.x < floor.x + floor.width) {
                                // Use this floor even if spawner Y doesn't match
                                enemyY = floor.y - 64;
                                break;
                            }
                        }
                        
                        // Final fallback to old ground collision
                        if (enemyY === null) {
                            enemyY = GROUND_Y - 64;
                        }
                    }
                }

                // Use spawner's minLevel and maxLevel for enemy generation
                const minLevel = sp.minLevel || 1;
                const maxLevel = sp.maxLevel || 3;
                const enemyLevel = minLevel + Math.floor(Math.random() * (maxLevel - minLevel + 1));
                
                const enemy = {
                    id: levelState.nextEnemyId++,
                    x: sp.x,
                    y: enemyY,
                    level: enemyLevel,
                    health: 20 + enemyLevel * 12,
                    maxHealth: 20 + enemyLevel * 12,
                    spawnerId: sp.id,
                    homeX: sp.x,
                    homeY: enemyY,
                    visibilityRange: sp.visibilityRange,
                    type: sp.type || 'basic',
                    dead: false,
                    attackCooldown: 0,
                    name: getRandomEnemyName(),
                    colors: generateNPCColors()
                };
                levelState.enemies.push(enemy);
                sp.currentEnemyId = enemy.id;
                
                // Broadcast to players in this level only
                broadcastToLevel(levelName, { 
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
}, 100); // 10 FPS for enemy AI

// Apply physics to vendor (gravity and floor collision) - this should be per-level too
const vendorPhysicsInterval = setInterval(() => {
    for (const [levelName, levelState] of levelGameStates) {
        const playersInLevel = getPlayersInLevel(levelName);
        if (playersInLevel.length === 0) continue;
        
        if (levelState.vendor) {
            if (typeof levelState.vendor.vy !== 'number') levelState.vendor.vy = 0;
            levelState.vendor.vy += 1200 * 0.016; // gravity
            levelState.vendor.y += levelState.vendor.vy * 0.016;
        
            // Floor collision using level data
            const floors = levelState.levelData ? levelState.levelData.floors || [] : [];
            let onFloor = false;
            for (const floor of floors) {
                if (levelState.vendor.x + levelState.vendor.w > floor.x && 
                    levelState.vendor.x < floor.x + floor.width && 
                    levelState.vendor.y + levelState.vendor.h > floor.y && 
                    levelState.vendor.y < floor.y + floor.height) {
                    // Check if landing on top of floor
                    if (levelState.vendor.vy > 0 && levelState.vendor.y < floor.y) {
                        levelState.vendor.y = floor.y - levelState.vendor.h;
                        levelState.vendor.vy = 0;
                        onFloor = true;
                        break;
                    }
                }
            }
            
            // Fallback to old ground collision if no floor collision
            if (!onFloor) {
                const groundY = GROUND_Y;
                if (levelState.vendor.y > groundY - levelState.vendor.h) {
                    levelState.vendor.y = groundY - levelState.vendor.h;
                    levelState.vendor.vy = 0;
                }
            }
        }
    }
}, 16); // 60 FPS for vendor physics

// Old enemy AI code removed - now using level-based enemy AI in gameLoopInterval
        // OLD ENEMY AI CODE - DISABLED - Using level-based AI instead
        /*
        const targetX = inRange ? (nearest.x || enemy.homeX || enemy.x) : (enemy.homeX || enemy.x);
        const speed = speedBase + (enemy.level || 1) * 6;
        const dir = Math.sign(targetX - (enemy.x || 0));
        if (Math.abs(targetX - (enemy.x || 0)) > 2) {
            enemy.x = (enemy.x || 0) + dir * speed * dt;
            enemy.vx = dir * speed;
        } else {
            enemy.vx = 0;
        }
        */
        /*
        // OLD ENEMY AI CODE COMPLETELY DISABLED - Using level-based AI instead
        // Apply gravity and floor collision
        if (typeof enemy.vy !== 'number') enemy.vy = 0;
        enemy.vy += 1200 * dt; // gravity
        enemy.y = (enemy.y || 0) + enemy.vy * dt;
        
        // Floor collision using level data
        const floors = gameState.levelData ? gameState.levelData.floors || [] : [];
        let onFloor = false;
        for (const floor of floors) {
            if (enemy.x + 48 > floor.x && 
                enemy.x < floor.x + floor.width && 
                enemy.y + 64 > floor.y && 
                enemy.y < floor.y + floor.height) {
                // Check if landing on top of floor
                if (enemy.vy > 0 && enemy.y < floor.y) {
                    enemy.y = floor.y - 64;
                    enemy.vy = 0;
                    onFloor = true;
                    break;
                }
            }
        }
        
        // Fallback to old ground collision if no floor collision
        if (!onFloor) {
            const groundY = typeof enemy.homeY === 'number' ? enemy.homeY : (GROUND_Y - 64);
            if (enemy.y > groundY) { 
                enemy.y = groundY; 
                enemy.vy = 0; 
            }
        }

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

    // Projectile collision detection is now handled in the level-based gameLoopInterval

    // Enemy and vendor updates are now handled in the level-based gameLoopInterval
    */
    // OLD ENEMY AI BLOCK COMPLETELY DISABLED - Using level-based AI in gameLoopInterval instead

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

