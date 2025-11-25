const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

// Global error handlers to catch and log crashes
process.on('uncaughtException', (error) => {
    console.error('=== UNCAUGHT EXCEPTION - SERVER CRASH ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('=========================================');
    // Keep server running for debugging, but log the error
    // In production, you might want to exit here
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED REJECTION ===');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('===========================');
});

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
    createEnemy,
    generateEnemyEquipment,
    calculateEnemySpeed,
    calculateEnemyDamage 
} = require('./enemy');
const { 
    generateLoot, 
    createTestSword,
    checkIfTwoHanded,
    determinePhysicalDamageType
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
    } else if (req.url.startsWith('/assets/')) {
        // Serve static assets (weapons, wands, etc.)
        // Decode URL-encoded paths (e.g., %20 for spaces)
        const decodedUrl = decodeURIComponent(req.url);
        const filePath = path.join(__dirname, '..', decodedUrl);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                // Determine content type based on file extension
                let contentType = 'application/octet-stream';
                if (req.url.endsWith('.png')) contentType = 'image/png';
                else if (req.url.endsWith('.jpg') || req.url.endsWith('.jpeg')) contentType = 'image/jpeg';
                else if (req.url.endsWith('.gif')) contentType = 'image/gif';
                else if (req.url.endsWith('.svg')) contentType = 'image/svg+xml';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
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
        } else if (req.url.startsWith('/assets/')) {
            // Serve static assets (weapons, wands, etc.)
            // Decode URL-encoded paths (e.g., %20 for spaces)
            const decodedUrl = decodeURIComponent(req.url);
            const filePath = path.join(__dirname, '..', decodedUrl);
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    // Determine content type based on file extension
                    let contentType = 'application/octet-stream';
                    if (req.url.endsWith('.png')) contentType = 'image/png';
                    else if (req.url.endsWith('.jpg') || req.url.endsWith('.jpeg')) contentType = 'image/jpeg';
                    else if (req.url.endsWith('.gif')) contentType = 'image/gif';
                    else if (req.url.endsWith('.svg')) contentType = 'image/svg+xml';
                    
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                }
            });
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    
    httpsWss = new WebSocket.Server({ server: httpsServer });
} catch (error) {
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
const DROP_PICKUP_DELAY_MS = 800;

function inferWeaponSubtype(name = '') {
    const lower = name.toLowerCase();
    const pairs = [
        ['warhammer', 'Warhammer'],
        ['battleaxe', 'Battleaxe'],
        ['crossbow', 'Crossbow'],
        ['longsword', 'Longsword'],
        ['greatsword', 'Greatsword'],
        ['scimitar', 'Scimitar'],
        ['halberd', 'Halberd'],
        ['blade', 'Blade'],
        ['sword', 'Sword'],
        ['dagger', 'Dagger'],
        ['axe', 'Axe'],
        ['saber', 'Saber'],
        ['mace', 'Mace'],
        ['spear', 'Spear'],
        ['hammer', 'Hammer'],
        ['bow', 'Bow'],
        ['staff', 'Staff'],
        ['wand', 'Wand'],
        ['katana', 'Katana'],
        ['rapier', 'Rapier'],
        ['club', 'Club'],
        ['maul', 'Maul'],
        ['flail', 'Flail'],
        ['javelin', 'Javelin'],
        ['trident', 'Trident'],
        ['pike', 'Pike']
    ];
    for (const [needle, subtype] of pairs) {
        if (lower.includes(needle)) return subtype;
    }
    return null;
}

function cloneItem(item) {
    return item ? JSON.parse(JSON.stringify(item)) : item;
}

function computeItemValue(item) {
    if (!item) return 5;
    const level = item.level || 1;
    const base = item.type === 'armor' ? 16 : 20;
    const rarity = item.rarity || 'Common';
    const multiplier = rarity === 'Legendary' ? 7 :
        rarity === 'Epic' ? 3.5 :
        rarity === 'Rare' ? 2.5 :
        rarity === 'Uncommon' ? 1.8 : 1;
    return Math.max(5, Math.round(level * base * multiplier));
}

function normalizeDropItem(item) {
    if (!item) return item;
    const normalized = cloneItem(item);
    // Explicitly preserve locked property - always preserve it if it exists (including false)
    if ('locked' in item) {
        normalized.locked = item.locked === true || item.locked === 'true';
    }
    // Explicitly preserve weaponSprite and weaponSpriteType - these must be consistent across all rendering
    if (item.weaponSprite) {
        normalized.weaponSprite = item.weaponSprite;
    }
    if (item.weaponSpriteType) {
        normalized.weaponSpriteType = item.weaponSpriteType;
    }
    if (normalized.type === 'weapon') {
        if (!normalized.subtype && normalized.name) {
            normalized.subtype = inferWeaponSubtype(normalized.name);
        }
        const weaponType = normalized.subtype || normalized.name;
        if (weaponType && !normalized.physicalDamageType) {
            normalized.physicalDamageType = determinePhysicalDamageType(weaponType);
        }
        if (normalized.twoHanded === undefined) {
            normalized.twoHanded = !!checkIfTwoHanded(normalized);
        }
    }
    if ((normalized.type === 'weapon' || normalized.type === 'armor') && (!normalized.value || normalized.value <= 0)) {
        normalized.value = computeItemValue(normalized);
    }
    return normalized;
}

function applyPickupDelay(drop, delay = DROP_PICKUP_DELAY_MS) {
    if (drop && drop.item) {
        drop.item = normalizeDropItem(drop.item);
    }
    drop.noPickupUntil = Date.now() + delay;
    return drop;
}

function ensureTwoHandedEquipConsistency(equip) {
    if (!equip) return;
    const isTwoHanded = (item) => item && (item.twoHanded || checkIfTwoHanded(item));
    const mainhand = equip.mainhand;
    const offhand = equip.offhand;
    
    if (mainhand && isTwoHanded(mainhand)) {
        equip.offhand = mainhand;
    } else {
        if (offhand && offhand === mainhand) {
            equip.offhand = null;
        } else if (offhand && mainhand && offhand.id && mainhand.id && offhand.id === mainhand.id) {
            equip.offhand = null;
        }
        if (!mainhand && offhand && isTwoHanded(offhand)) {
            equip.offhand = null;
        }
    }
}

// Loot tables are now managed in loot.js

// Enemy names and rarity functions are now managed in enemy.js

// Item naming system is now managed in loot.js

// NPC color generation is now managed in enemy.js

// Load default level
const defaultLevel = levelLoader.loadLevel('sample_level');
levelLoader.applyLevelToGameState({}, defaultLevel);

// Per-level game states
const levelGameStates = new Map();
const globalPlayers = new Map(); // Global player registry
const vendorBuyback = []; // Last 10 items sold to vendor by any player (shared across all players)
const MAX_BUYBACK_ITEMS = 10;

// Helper functions for level-specific game state
function getLevelGameState(levelName) {
    if (!levelGameStates.has(levelName)) {
        // Load level data and create game state
        const levelData = levelLoader.loadLevel(levelName);
        if (levelData) {
            const levelState = {
                enemies: [],
                worldDrops: [],
                projectiles: [], // Initialize projectiles array
                nextEnemyId: 1,
                vendor: levelData.vendors[0] ? (() => {
                    const vendorData = levelData.vendors[0];
                    // Calculate vendor Y position on top of the floor
                    let vendorY = vendorData.y;
                    const floors = levelData.floors || [];
                    for (const floor of floors) {
                        // Check if vendor X position is over this floor
                        if (vendorData.x >= floor.x && vendorData.x < floor.x + floor.width) {
                            // Position vendor on top of floor (floor.y - vendor height)
                            vendorY = floor.y - vendorData.height;
                            break;
                        }
                    }
                    return {
                        id: vendorData.id,
                        x: vendorData.x,
                        y: vendorY,
                        w: vendorData.width,
                        h: vendorData.height,
                        vy: 0,
                        colors: generateNPCColors(),
                        anim: {timer: 0, index: 0}
                    };
                })() : null,
                spawners: (levelData.spawners || []).map(spawner => {
                    // Ensure all spawner properties are preserved, especially type
                    const mappedSpawner = {
                        id: spawner.id,
                        x: spawner.x,
                        y: spawner.y,
                        type: spawner.type || 'basic', // Preserve type, default to basic if missing
                        respawnTime: spawner.respawnTime || 5000,
                        visibilityRange: spawner.visibilityRange || 400,
                        minLevel: spawner.minLevel || 1,
                        maxLevel: spawner.maxLevel || 3,
                        currentEnemyId: spawner.currentEnemyId || null,
                        respawnAt: Date.now() + 2000 // Start respawning after 2 seconds
                    };
                    return mappedSpawner;
                }),
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

function finalizeEnemyDeath(levelName, levelState, enemy) {
    if (!levelState || !enemy) return;

    // Remove from active enemies list if still present
    const enemyIndex = levelState.enemies.findIndex(e => e && e.id === enemy.id);
    if (enemyIndex !== -1) {
        levelState.enemies.splice(enemyIndex, 1);
    }

    // First, broadcast enemy death immediately so client removes it from rendering
    // This ensures the enemy disappears right when animation completes
    broadcastToLevel(levelName, { type: 'enemyDeath', id: enemy.id });
    
    // Then immediately generate and spawn loot (no delay)
    const enemyType = enemy.type || 'basic';
    const lootItems = generateLoot(enemyType, enemy.level || 1);
    for (const lootItem of lootItems) {
        const drop = {
            id: `enemy-loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: enemy.x + (Math.random() - 0.5) * 100,
            y: enemy.y + 10,
            item: lootItem,
            vx: (Math.random() - 0.5) * 140,
            vy: -Math.random() * 120 - 260,
            pickRadius: 40,
            grounded: false
        };
        applyPickupDelay(drop);
        levelState.worldDrops.push(drop);
        // Broadcast loot immediately after enemy death
        broadcastToLevel(levelName, { type: 'dropItem', ...drop });
    }

    // Schedule respawn for the originating spawner
    const spawner = levelState.spawners && levelState.spawners.find(s => s && s.id === enemy.spawnerId);
    if (spawner) {
        spawner.currentEnemyId = null;
        spawner.respawnAt = Date.now() + 8000;
    }
}

// Initialize default level game state
const defaultLevelState = {
    enemies: [],
    worldDrops: [],
    nextEnemyId: 1,
    vendor: defaultLevel.vendors[0] ? (() => {
        const vendorData = defaultLevel.vendors[0];
        // Calculate vendor Y position on top of the floor
        let vendorY = vendorData.y;
        const floors = defaultLevel.floors || [];
        for (const floor of floors) {
            // Check if vendor X position is over this floor
            if (vendorData.x >= floor.x && vendorData.x < floor.x + floor.width) {
                // Position vendor on top of floor (floor.y - vendor height)
                vendorY = floor.y - vendorData.height;
                break;
            }
        }
        return {
            id: vendorData.id,
            x: vendorData.x,
            y: vendorY,
            w: vendorData.width,
            h: vendorData.height,
            vy: 0,
            colors: generateNPCColors(),
            anim: {timer: 0, index: 0}
        };
    })() : null,
    spawners: (defaultLevel.spawners || []).map(spawner => ({
        ...spawner,
        respawnAt: Date.now() + 2000, // Start respawning after 2 seconds
        currentEnemyId: null // Initialize currentEnemyId
    })),
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

if (gameState.portals.length > 0) {
}

// Per-player level tracking
const playerLevels = new Map(); // playerId -> levelName

// Debug: Log vendor colors at startup

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
            const rawMessage = message.toString();
            const data = JSON.parse(rawMessage);
            
            // Log ALL getBuybackItems messages immediately (before switch) - VERY PROMINENT
            if (data.type === 'getBuybackItems') {
            }
            
            // Also log if the raw message contains 'buyback' anywhere
            if (rawMessage.includes('buyback') || rawMessage.includes('Buyback')) {
            }
            
            // Debug logging for shootProjectile messages
            if (data.type === 'shootProjectile' && data.weaponType === 'Crossbow') {
            }
            
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
                    }
                    
                    // Add player to game state (restore data if available, otherwise use defaults)
                    let initialInventory = storedPlayerData ? storedPlayerData.inventory : new Array(12).fill(null);
                    
                    // Normalize all inventory items to ensure they have all required properties while preserving locked status
                    if (initialInventory && Array.isArray(initialInventory)) {
                        initialInventory = initialInventory.map(item => {
                            if (!item) return null;
                            return normalizeDropItem(item);
                        });
                    }
                    
                    // If this is a new player (no stored data), add a training sword to the first inventory slot
                    if (!storedPlayerData && initialInventory[0] === null) {
                        const testSword = createTestSword();
                        initialInventory[0] = testSword;
                    }
                    
                    // Get visual data from join message or use stored data
                    const shirtColor = data.shirtColor || (storedPlayerData ? storedPlayerData.shirtColor : null);
                    const pantColor = data.pantColor || (storedPlayerData ? storedPlayerData.pantColor : null);
                    const equipmentColors = data.equipmentColors || (storedPlayerData ? storedPlayerData.equipmentColors : {});
                    
                    // Get equipment from stored data or default
                    let playerEquip = storedPlayerData ? storedPlayerData.equip : {
                        head: null, neck: null, shoulders: null, chest: null,
                        waist: null, legs: null, feet: null, wrists: null,
                        hands: null, mainhand: null, offhand: null, trinket: null
                    };
                    
                    // Normalize all equipment items to ensure they have all required properties while preserving locked status
                    if (playerEquip && typeof playerEquip === 'object') {
                        const normalizedEquip = {};
                        for (const [slot, item] of Object.entries(playerEquip)) {
                            if (!item) {
                                normalizedEquip[slot] = null;
                            } else {
                                normalizedEquip[slot] = normalizeDropItem(item);
                            }
                        }
                        playerEquip = normalizedEquip;
                    }
                    
                    // Calculate maxHealth from equipment (same formula as client: Health + Endurance*8)
                    // Base stats: Health=0, Endurance=5 (default player stats)
                    const baseHealth = 0;
                    const baseEndurance = 5;
                    let totalHealth = baseHealth;
                    let totalEndurance = baseEndurance;
                    
                    // Sum stats from all equipment
                    Object.keys(playerEquip).forEach(slot => {
                        const item = playerEquip[slot];
                        if (item && item.stats) {
                            if (item.stats.Health) totalHealth += item.stats.Health;
                            if (item.stats.Endurance) totalEndurance += item.stats.Endurance;
                        }
                    });
                    
                    // Calculate maxHealth: Health stat + Endurance*8
                    const calculatedMaxHealth = Math.max(1, totalHealth + totalEndurance * 8);
                    
                    // Get stored health (preserve it, but cap at new maxHealth)
                    const storedHealth = storedPlayerData ? storedPlayerData.health : 100;
                    const restoredHealth = Math.min(storedHealth, calculatedMaxHealth);
                    
                    // Calculate maxMana from equipment (base Mana stat)
                    // Base stats: Mana=50 (default player stats)
                    const baseMana = 50;
                    let totalMana = baseMana;
                    
                    // Sum Mana stat from all equipment
                    Object.keys(playerEquip).forEach(slot => {
                        const item = playerEquip[slot];
                        if (item && item.stats && item.stats.Mana) {
                            totalMana += item.stats.Mana;
                        }
                    });
                    
                    const calculatedMaxMana = Math.max(1, totalMana);
                    
                    // Get stored mana (preserve it, but cap at new maxMana)
                    const storedMana = storedPlayerData ? (storedPlayerData.mana !== undefined ? storedPlayerData.mana : calculatedMaxMana) : calculatedMaxMana;
                    const restoredMana = Math.min(storedMana, calculatedMaxMana);
                    
                    // Calculate Focus stat from equipment (for mana regeneration bonus)
                    const baseFocus = 5;
                    let totalFocus = baseFocus;
                    Object.keys(playerEquip).forEach(slot => {
                        const item = playerEquip[slot];
                        if (item && item.stats && item.stats.Focus) {
                            totalFocus += item.stats.Focus;
                        }
                    });
                    
                    // Ensure pyreals are properly restored, defaulting to 0 if missing
                    const restoredPyreals = storedPlayerData ? (storedPlayerData.pyreals !== undefined && storedPlayerData.pyreals !== null ? storedPlayerData.pyreals : 0) : 0;
                    
                    globalPlayers.set(playerId, {
                        id: playerId,
                        name: playerName,
                        x: storedPlayerData ? storedPlayerData.x : 80,
                        y: storedPlayerData ? storedPlayerData.y : 0,
                        health: restoredHealth,
                        maxHealth: calculatedMaxHealth,
                        mana: restoredMana,
                        maxMana: calculatedMaxMana,
                        stats: { Focus: totalFocus, Mana: calculatedMaxMana }, // Store stats for easy access
                        pyreals: restoredPyreals,
                        justConnected: true, // Flag to prevent immediate saving
                        equip: playerEquip,
                        inventory: initialInventory,
                        shirtColor: shirtColor,
                        pantColor: pantColor,
                        equipmentColors: equipmentColors,
                        reach: 70, // Default base reach
                        manaLockUntil: 0 // Mana regeneration lock timer
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

                    // Get level-specific game state (must be declared before use)
                    const playerLevel = playerLevels.get(playerId) || 'sample_level';
                    const levelState = getLevelGameState(playerLevel);
                    const playersInLevel = getPlayersInLevel(playerLevel);

                    // Get level-specific world drops
                    let groundLootToSend = levelState.worldDrops;
                    if (storedPlayerData) {
                    } else {
                    }
                    
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
                    
                    // Ensure vendor is properly initialized with correct position from level data
                    let vendorToSend = levelState.vendor;
                    if (!vendorToSend && levelState.levelData && levelState.levelData.vendors && levelState.levelData.vendors.length > 0) {
                        // Vendor not initialized, create it from level data
                        const vendorData = levelState.levelData.vendors[0];
                        // Calculate vendor Y position on top of the floor
                        let vendorY = vendorData.y;
                        const floors = levelState.levelData.floors || [];
                        for (const floor of floors) {
                            // Check if vendor X position is over this floor
                            if (vendorData.x >= floor.x && vendorData.x < floor.x + floor.width) {
                                // Position vendor on top of floor (floor.y - vendor height)
                                vendorY = floor.y - vendorData.height;
                                break;
                            }
                        }
                        vendorToSend = {
                            id: vendorData.id,
                            x: vendorData.x,
                            y: vendorY,
                            w: vendorData.width,
                            h: vendorData.height,
                            vy: 0,
                            colors: generateNPCColors(),
                            anim: {timer: 0, index: 0}
                        };
                        // Update levelState with the vendor
                        levelState.vendor = vendorToSend;
                    } else if (vendorToSend && levelState.levelData && levelState.levelData.vendors && levelState.levelData.vendors.length > 0) {
                        // Ensure vendor position matches level data and is on the floor
                        const vendorData = levelState.levelData.vendors[0];
                        vendorToSend.x = vendorData.x;
                        vendorToSend.w = vendorData.width;
                        vendorToSend.h = vendorData.height;
                        // Calculate vendor Y position on top of the floor
                        let vendorY = vendorData.y;
                        const floors = levelState.levelData.floors || [];
                        for (const floor of floors) {
                            // Check if vendor X position is over this floor
                            if (vendorData.x >= floor.x && vendorData.x < floor.x + floor.width) {
                                // Position vendor on top of floor (floor.y - vendor height)
                                vendorY = floor.y - vendorData.height;
                                break;
                            }
                        }
                        vendorToSend.y = vendorY;
                    }
                    
                    // Send current game state to new player (level-specific)
                    const gameStateMsg = {
                        type: 'gameState',
                        players: playersInLevel,
                        enemies: levelState.enemies,
                        worldDrops: levelState.worldDrops,
                        vendor: vendorToSend,
                        portals: levelState.portals || [],
                        spawners: levelState.spawners,
                        floors: floorsToSend
                    };
                    
                    // Debug: Log vendor and floor data being sent
                    if (gameStateMsg.floors.length > 0) {
                    } else {
                        console.warn(`WARNING: No floors found for level ${playerLevel}! levelData:`, !!levelState.levelData, 'floors:', levelState.levelData?.floors);
                    }
                    
                    // Send player's own equipment and inventory data FIRST, before gameState
                    // This ensures inventory is loaded before the game renders
                    const currentPlayerData = globalPlayers.get(playerId);
                    const inventoryItemCount = currentPlayerData.inventory ? currentPlayerData.inventory.filter(i => i !== null).length : 0;
                    const equippedItemCount = currentPlayerData.equip ? Object.values(currentPlayerData.equip).filter(i => i !== null).length : 0;
                    const playerDataMsg = {
                        type: 'playerData',
                        equip: currentPlayerData.equip,
                        inventory: currentPlayerData.inventory,
                        pyreals: currentPlayerData.pyreals || 0, // Ensure pyreals are sent to client
                        mana: currentPlayerData.mana || currentPlayerData.maxMana || 50,
                        maxMana: currentPlayerData.maxMana || 50
                    };
                    ws.send(JSON.stringify(playerDataMsg));
                    
                    // Send gameState after playerData so inventory is ready
                    ws.send(JSON.stringify(gameStateMsg));

                    // Log the reconnection details for debugging
                    if (storedPlayerData) {
                    } else {
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        // Update position if provided
                        if (data.x !== undefined) player.x = data.x;
                        if (data.y !== undefined) player.y = data.y;
                        // Update other stats
                        if (data.health !== undefined) player.health = data.health;
                        if (data.maxHealth !== undefined) player.maxHealth = data.maxHealth;
                        if (data.pyreals !== undefined) player.pyreals = data.pyreals;
                        
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
                    break;

                case 'inventoryUpdate':
                    if (playerId && gameState.players.has(playerId) && data.inventory) {
                        const player = gameState.players.get(playerId);
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
                        const enemy = enemyUpdateLevelState.enemies[enemyIndex];
                        const updateData = {
                            type: 'enemyUpdate',
                            id: data.id,
                            x: data.x,
                            y: data.y,
                            health: data.health,
                            maxHealth: data.maxHealth,
                            level: data.level,
                            enemyType: enemy.type || data.type, // Always include enemy type (as enemyType to avoid conflict with message type)
                            dead: data.dead,
                            name: data.name
                        };
                        // Only include colors for non-sprite-based enemies
                        if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp' && enemy.colors) {
                            updateData.colors = enemy.colors;
                        }
                        // Include Water Wisp and Fire Wisp specific properties
                        if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                            updateData.hurtAnimTime = enemy.hurtAnimTime;
                            updateData.dieAnimProgress = enemy.dieAnimProgress;
                            updateData.attackAnimTime = enemy.attackAnimTime;
                            updateData.facing = enemy.facing;
                        }
                        broadcastToLevel(enemyUpdatePlayerLevel, updateData);
                    }
                    break;

                case 'attackEnemy':
                    // Find enemy in the player's current level
                    const attackPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                    const attackLevelState = getLevelGameState(attackPlayerLevel);
                    const targetEnemy = attackLevelState.enemies.find(e => e.id === data.id);
                    if (targetEnemy && !targetEnemy.dead) {
                        targetEnemy.health -= data.damage;
                        targetEnemy._healthChanged = true; // Mark health change for immediate update
                        
                        // Set hurt animation for Water Wisp and Fire Wisp
                        if (targetEnemy.type === 'waterwisp' || targetEnemy.type === 'firewisp' || targetEnemy.type === 'earthwisp' || targetEnemy.type === 'windwisp') {
                            targetEnemy.hurtAnimTime = 0.3; // 0.3 second hurt animation
                        }
                        
                        if (targetEnemy.health <= 0) {
                            targetEnemy.dead = true;
                            targetEnemy.isDead = true;
                            targetEnemy.health = 0;
                            // Set death animation progress for Water Wisp and Fire Wisp
                            if (targetEnemy.type === 'waterwisp' || targetEnemy.type === 'firewisp' || targetEnemy.type === 'earthwisp' || targetEnemy.type === 'windwisp') {
                                targetEnemy.dieAnimProgress = 0;
                                // Broadcast death state immediately so client can play death animation
                                const deathUpdateData = {
                                    type: 'enemyUpdate',
                                    id: targetEnemy.id,
                                    health: 0,
                                    maxHealth: targetEnemy.maxHealth,
                                    dead: true,
                                    isDead: true,
                                    dieAnimProgress: 0,
                                    enemyType: targetEnemy.type
                                };
                                broadcastToLevel(attackPlayerLevel, deathUpdateData);
                                // Don't finalize death immediately - wait for animation to complete
                            } else {
                                // For non-wisp enemies, finalize death immediately
                                finalizeEnemyDeath(attackPlayerLevel, attackLevelState, targetEnemy);
                            }
                        } else {
                            const updateData = { 
                                type: 'enemyUpdate', 
                                id: targetEnemy.id, 
                                health: targetEnemy.health,
                                colors: targetEnemy.colors
                            };
                            // Include hurt animation for Water Wisp and Fire Wisp
                            if (targetEnemy.type === 'waterwisp' || targetEnemy.type === 'firewisp' || targetEnemy.type === 'earthwisp' || targetEnemy.type === 'windwisp') {
                                updateData.hurtAnimTime = targetEnemy.hurtAnimTime;
                                updateData.facing = targetEnemy.facing;
                            }
                            broadcastToLevel(attackPlayerLevel, updateData);
                        }
                    }
                    break;

                case 'portalEnter':
                    // Handle portal collision and level switching per player
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        const targetLevel = data.targetLevel;
                        
                        if (targetLevel) {
                            
                            // Load the target level
                            const newLevelData = levelLoader.loadLevel(targetLevel);
                            if (newLevelData) {
                                
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
                                }
                                
                                
                                ws.send(JSON.stringify(levelChangeMsg));
                                
                            } else {
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
                            // Calculate direction away from player based on drop position
                            // If drop is to the right of player, throw right; otherwise left
                            // If at same position, randomly choose direction
                            const playerCenterX = player.x + 24; // Player center
                            const dropX = data.x || playerCenterX;
                            let direction = dropX > playerCenterX ? 'right' : 'left';
                            if (Math.abs(dropX - playerCenterX) < 10) {
                                // If very close to player center, randomly choose direction
                                direction = Math.random() > 0.5 ? 'right' : 'left';
                            }
                            
                            // Create arc motion away from player
                            const horizontalVelocity = direction === 'right' ? 200 : -200;
                            const verticalVelocity = -150; // Upward initial velocity for arc
                            
                            const drop = {
                                id: `drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: data.x || playerCenterX,
                                y: data.y || (player.y + 16),
                                item: item,
                                vx: horizontalVelocity,
                                vy: verticalVelocity,
                                pickRadius: 40,
                                grounded: false
                            };
                            applyPickupDelay(drop);
                            
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
                            
                            ensureTwoHandedEquipConsistency(player.equip);
                            ws.send(JSON.stringify({
                                type: 'equipmentUpdated',
                                equip: player.equip
                            }));
                            
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
                        
                        
                        // Find the world drop
                        const dropIndex = pickupLevelState.worldDrops.findIndex(d => d.id === dropId);
                        if (dropIndex !== -1) {
                            const drop = pickupLevelState.worldDrops[dropIndex];
                            const item = drop.item ? normalizeDropItem(drop.item) : null;
                            
                            if (item && slotIndex !== null && slotIndex < player.inventory.length) {
                                // Check if destination slot is occupied
                                if (player.inventory[slotIndex]) {
                                    // Swap items - put the equipped item back in the world
                                    const displacedItem = normalizeDropItem(player.inventory[slotIndex]);
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
                                        grounded: false
                                    };
                                    applyPickupDelay(newDrop);
                                    
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
                                
                                // If unequipping a two-handed weapon from mainhand, also clear offhand
                                if (fromSlot === 'mainhand') {
                                    const isTwoHanded = sourceItem.twoHanded || checkIfTwoHanded(sourceItem);
                                    if (isTwoHanded && player.equip.offhand && 
                                        (player.equip.offhand === sourceItem || player.equip.offhand.id === sourceItem.id)) {
                                        // Clear offhand if it's the same weapon (two-handed)
                                        player.equip.offhand = null;
                                    }
                                }
                                // If unequipping from offhand and it's a two-handed weapon, also clear mainhand
                                else if (fromSlot === 'offhand') {
                                    const isTwoHanded = sourceItem.twoHanded || checkIfTwoHanded(sourceItem);
                                    if (isTwoHanded && player.equip.mainhand && 
                                        (player.equip.mainhand === sourceItem || player.equip.mainhand.id === sourceItem.id)) {
                                        // Clear mainhand if it's the same weapon (two-handed)
                                        player.equip.mainhand = null;
                                    }
                                }
                            } else {
                                sourceItem = null;
                            }
                        } else if (fromWhere === 'world') {
                            // Find item in world drops
                            const worldDropIndex = moveLevelState.worldDrops.findIndex(d => d.item && d.item.id === itemId);
                            if (worldDropIndex !== -1) {
                                const worldDrop = moveLevelState.worldDrops.splice(worldDropIndex, 1)[0];
                                sourceItem = worldDrop.item;
                                // Broadcast removal of world drop to players in this level only
                                broadcastToLevel(movePlayerLevel, { type: 'pickupItem', dropId: worldDrop.id, playerId: playerId });
                            }
                        }
                        
                        if (sourceItem) {
                            sourceItem = normalizeDropItem(sourceItem);
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
                                        // Calculate direction away from player for arc motion
                                        const playerCenterX = player.x + 24;
                                        const dropX = data.x || playerCenterX;
                                        let direction = dropX > playerCenterX ? 'right' : 'left';
                                        if (Math.abs(dropX - playerCenterX) < 10) {
                                            direction = Math.random() > 0.5 ? 'right' : 'left';
                                        }
                                        const horizontalVelocity = direction === 'right' ? 200 : -200;
                                        const verticalVelocity = -150;
                                        
                                        const displacedDrop = {
                                            id: `move-displaced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                            x: data.x || playerCenterX,
                                            y: data.y || (player.y + 16),
                                            item: normalizeDropItem(tempItem),
                                            vx: horizontalVelocity,
                                            vy: verticalVelocity,
                                            pickRadius: 40,
                                            grounded: false
                                        };
                                        applyPickupDelay(displacedDrop);
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
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                                
                                // Also send equipment update if item came from equipment (for swaps)
                                if (fromWhere === 'equip') {
                                    ensureTwoHandedEquipConsistency(player.equip);
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
                                    
                                    // Save player data immediately when equipment changes
                                    ensureTwoHandedEquipConsistency(player.equip);
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
                                    ensureTwoHandedEquipConsistency(player.equip);
                                    savePlayerData(playerName, player);
                                    
                                    // Also send inventory update if item came from bag
                                    if (fromWhere === 'bag') {
                                        ws.send(JSON.stringify({
                                            type: 'inventoryUpdated',
                                            inventory: player.inventory
                                        }));
                                    }
                                    
                                } else if (sourceItem.type === 'weapon' && (toSlot === 'mainhand' || toSlot === 'offhand')) {
                                    // Check if weapon is two-handed
                                    const isTwoHanded = sourceItem.twoHanded || checkIfTwoHanded(sourceItem);
                                    
                                    // Two-handed weapons always occupy mainhand; reroute offhand drops
                                    if (isTwoHanded && toSlot === 'offhand') {
                                        toSlot = 'mainhand';
                                    }
                                    
                                    // Prevent equipping two-handed weapons to offhand
                                    if (isTwoHanded && toSlot === 'offhand') {
                                        // Reject the move - two-handed weapons must go to mainhand
                                        // Put the item back where it came from
                                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                            player.inventory[fromIndex] = sourceItem;
                                        } else if (fromWhere === 'equip' && fromSlot) {
                                            player.equip[fromSlot] = sourceItem;
                                        } else if (fromWhere === 'world') {
                                            // Put it back in world drops
                                            const drop = {
                                                id: `rejected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                x: player.x + (Math.random() - 0.5) * 100,
                                                y: player.y + 10,
                                                item: sourceItem,
                                                vx: (Math.random() - 0.5) * 140,
                                                vy: -Math.random() * 120 - 260,
                                                pickRadius: 40,
                                                grounded: false
                                            };
                                            applyPickupDelay(drop);
                                            moveLevelState.worldDrops.push(drop);
                                            broadcastToLevel(movePlayerLevel, { type: 'dropItem', ...drop });
                                        }
                                        
                                        // Send error message to client
                                        ws.send(JSON.stringify({
                                            type: 'moveItemRejected',
                                            reason: 'Two-handed weapons cannot be equipped to offhand',
                                            itemId: sourceItem.id
                                        }));
                                        
                                        // Send updated inventory/equipment to sync state
                                        if (fromWhere === 'bag') {
                                            ws.send(JSON.stringify({
                                                type: 'inventoryUpdated',
                                                inventory: player.inventory
                                            }));
                                        } else if (fromWhere === 'equip') {
                                            ensureTwoHandedEquipConsistency(player.equip);
                                            ws.send(JSON.stringify({
                                                type: 'equipmentUpdated',
                                                equip: player.equip
                                            }));
                                        }
                                        
                                        // Skip the rest of the weapon equipping logic
                                        break;
                                    }
                                    
                                    // Prevent equipping to offhand when mainhand has a two-handed weapon
                                    if (toSlot === 'offhand' && player.equip.mainhand) {
                                        const mainhandIsTwoHanded = player.equip.mainhand.twoHanded || checkIfTwoHanded(player.equip.mainhand);
                                        if (mainhandIsTwoHanded) {
                                            // Reject the move - cannot equip to offhand when mainhand has two-handed weapon
                                            // Put the item back where it came from
                                            if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                                player.inventory[fromIndex] = sourceItem;
                                            } else if (fromWhere === 'equip' && fromSlot) {
                                                player.equip[fromSlot] = sourceItem;
                                            } else if (fromWhere === 'world') {
                                                // Put it back in world drops
                                                const drop = {
                                                    id: `rejected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                    x: player.x + (Math.random() - 0.5) * 100,
                                                    y: player.y + 10,
                                                    item: sourceItem,
                                                    vx: (Math.random() - 0.5) * 140,
                                                    vy: -Math.random() * 120 - 260,
                                                    pickRadius: 40,
                                                    grounded: false
                                                };
                                                applyPickupDelay(drop);
                                                moveLevelState.worldDrops.push(drop);
                                                broadcastToLevel(movePlayerLevel, { type: 'dropItem', ...drop });
                                            }
                                            
                                            // Send error message to client
                                            ws.send(JSON.stringify({
                                                type: 'moveItemRejected',
                                                reason: 'Cannot equip to offhand while mainhand has a two-handed weapon',
                                                itemId: sourceItem.id
                                            }));
                                            
                                            // Send updated inventory/equipment to sync state
                                            if (fromWhere === 'bag') {
                                                ws.send(JSON.stringify({
                                                    type: 'inventoryUpdated',
                                                    inventory: player.inventory
                                                }));
                                            } else if (fromWhere === 'equip') {
                                                ensureTwoHandedEquipConsistency(player.equip);
                                                ws.send(JSON.stringify({
                                                    type: 'equipmentUpdated',
                                                    equip: player.equip
                                                }));
                                            }
                                            
                                            // Skip the rest of the weapon equipping logic
                                            break;
                                        }
                                    }
                                    
                                    // Check if destination slot is occupied
                                    if (player.equip[toSlot]) {
                                        // Swap items
                                        const tempItem = player.equip[toSlot];
                                        
                                        // If equipping a two-handed weapon to mainhand, replace both mainhand and offhand
                                        if (isTwoHanded && toSlot === 'mainhand') {
                                            // Collect all weapons that need to be moved to inventory
                                            // We need to collect BEFORE clearing anything
                                            const weaponsToMove = [];
                                            
                                            // Add mainhand weapon (being swapped out)
                                            if (tempItem) {
                                                weaponsToMove.push(tempItem);
                                            }
                                            
                                            // Add offhand weapon if it exists and is different from mainhand
                                            // Collect it BEFORE we clear it
                                            if (player.equip.offhand && 
                                                player.equip.offhand !== tempItem && 
                                                player.equip.offhand !== sourceItem &&
                                                (!tempItem || player.equip.offhand.id !== tempItem.id)) {
                                                weaponsToMove.push(player.equip.offhand);
                                            }
                                            
                                            // Track which inventory slots we use for displaced weapons
                                            // (so we don't accidentally clear them when clearing the source slot)
                                            const usedInventorySlots = new Set();
                                            
                                            // Move all weapons to inventory or world
                                            for (const weapon of weaponsToMove) {
                                                let emptySlot = player.inventory.findIndex(slot => slot === null);
                                                if (emptySlot !== -1) {
                                                    player.inventory[emptySlot] = weapon;
                                                    usedInventorySlots.add(emptySlot);
                                                } else {
                                                    // Drop to world if inventory is full
                                                    const drop = {
                                                        id: `twohand-replace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                        x: player.x + (Math.random() - 0.5) * 100,
                                                        y: player.y + 10,
                                                        item: weapon,
                                                        vx: (Math.random() - 0.5) * 140,
                                                        vy: -Math.random() * 120 - 260,
                                                        pickRadius: 40,
                                                        grounded: false
                                                    };
                                                    applyPickupDelay(drop);
                                                    moveLevelState.worldDrops.push(drop);
                                                    broadcastToLevel(movePlayerLevel, { type: 'dropItem', ...drop });
                                                }
                                            }
                                            
                                            // Set both mainhand and offhand to the new two-handed weapon
                                            player.equip[toSlot] = sourceItem;
                                            player.equip.offhand = sourceItem;
                                            
                                            // Put the source item location (if it came from inventory, clear that slot)
                                            // BUT only if we didn't already use that slot for a displaced weapon
                                            if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                                // Only clear the slot if we didn't put a displaced weapon there
                                                if (!usedInventorySlots.has(fromIndex)) {
                                                    player.inventory[fromIndex] = null;
                                                }
                                                // If we used this slot for a displaced weapon, it's already filled, so do nothing
                                            } else if (fromWhere === 'equip' && fromSlot) {
                                                player.equip[fromSlot] = null;
                                            }
                                        } else {
                                            // Normal swap (not two-handed weapon)
                                            // Also check if the item being swapped out is a two-handed weapon
                                            const tempItemIsTwoHanded = tempItem && (tempItem.twoHanded || checkIfTwoHanded(tempItem));
                                            if (tempItemIsTwoHanded && toSlot === 'mainhand') {
                                                // Clear offhand if it's the same as the two-handed weapon being swapped out
                                                if (player.equip.offhand && (player.equip.offhand === tempItem || player.equip.offhand.id === tempItem.id)) {
                                                    player.equip.offhand = null;
                                                }
                                            }
                                            
                                            player.equip[toSlot] = sourceItem;
                                            
                                            // Put the displaced item back in the source location
                                            if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                                player.inventory[fromIndex] = tempItem;
                                            } else if (fromWhere === 'equip' && fromSlot) {
                                                player.equip[fromSlot] = tempItem;
                                            }
                                        }
                                    } else {
                                        // Mainhand slot is empty
                                        player.equip[toSlot] = sourceItem;
                                        
                                        // If equipping a two-handed weapon to mainhand, also set offhand
                                        if (isTwoHanded && toSlot === 'mainhand') {
                                            // Clear offhand if it exists (it will be replaced by the two-handed weapon)
                                            if (player.equip.offhand && player.equip.offhand !== sourceItem) {
                                                const offhandItem = player.equip.offhand;
                                                
                                                // When finding an empty slot, exclude the source slot (fromIndex) if the item came from inventory
                                                // to avoid overwriting it before we clear it
                                                let emptySlot = -1;
                                                if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                                    // Find empty slot, but prefer slots other than fromIndex
                                                    emptySlot = player.inventory.findIndex((slot, idx) => slot === null && idx !== fromIndex);
                                                    // If no other empty slot found, can use fromIndex since we're about to clear it anyway
                                                    if (emptySlot === -1 && player.inventory[fromIndex] === null) {
                                                        emptySlot = fromIndex;
                                                    }
                                                } else {
                                                    // Item came from equipment or world, can use any empty slot
                                                    emptySlot = player.inventory.findIndex(slot => slot === null);
                                                }
                                                
                                                if (emptySlot !== -1) {
                                                    player.inventory[emptySlot] = offhandItem;
                                                } else {
                                                    // Drop to world if inventory is full
                                                    const drop = {
                                                        id: `twohand-replace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                        x: player.x + (Math.random() - 0.5) * 100,
                                                        y: player.y + 10,
                                                        item: offhandItem,
                                                        vx: (Math.random() - 0.5) * 140,
                                                        vy: -Math.random() * 120 - 260,
                                                        pickRadius: 40,
                                                        grounded: false
                                                    };
                                                    applyPickupDelay(drop);
                                                    moveLevelState.worldDrops.push(drop);
                                                    broadcastToLevel(movePlayerLevel, { type: 'dropItem', ...drop });
                                                }
                                            }
                                            // Two-handed weapon occupies both slots (for UI display)
                                            player.equip.offhand = sourceItem;
                                        }
                                        
                                        // Clear the source inventory slot if item came from inventory
                                        // (but only if we didn't use it for the offhand item above)
                                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                                            // Only clear if we didn't use this slot for the offhand item
                                            // Check if we put offhand item in this slot
                                            if (!(isTwoHanded && toSlot === 'mainhand' && 
                                                  player.equip.offhand !== sourceItem && 
                                                  player.inventory[fromIndex] !== null)) {
                                                player.inventory[fromIndex] = null;
                                            }
                                        } else if (fromWhere === 'equip' && fromSlot) {
                                            player.equip[fromSlot] = null;
                                        }
                                    }
                                    
                                    // Save player data immediately when equipment changes
                                    ensureTwoHandedEquipConsistency(player.equip);
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
                                        ws.send(JSON.stringify({
                                            type: 'inventoryUpdated',
                                            inventory: player.inventory
                                        }));
                                    }
                                }
                                
                                // Also send updated inventory if item came from bag (for other cases)
                                if (fromWhere === 'bag') {
                                    ws.send(JSON.stringify({
                                        type: 'inventoryUpdated',
                                        inventory: player.inventory
                                    }));
                                }
                                
                                    // Always send equipment update if item came from equipment
                                    if (fromWhere === 'equip') {
                                        ensureTwoHandedEquipConsistency(player.equip);
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
                            // Calculate direction away from player based on drop position
                            const playerCenterX = player.x + 24; // Player center
                            const dropX = x || playerCenterX;
                            let direction = dropX > playerCenterX ? 'right' : 'left';
                            if (Math.abs(dropX - playerCenterX) < 10) {
                                // If very close to player center, randomly choose direction
                                direction = Math.random() > 0.5 ? 'right' : 'left';
                            }
                            
                            // Create arc motion away from player
                            const horizontalVelocity = direction === 'right' ? 200 : -200;
                            const verticalVelocity = -150; // Upward initial velocity for arc
                            
                            // Create world drop
                            const drop = {
                                id: `sell-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: x || playerCenterX,
                                y: y || (player.y + 16),
                                item: droppedItem,
                                vx: horizontalVelocity,
                                vy: verticalVelocity,
                                pickRadius: 40,
                                grounded: false
                            };
                            applyPickupDelay(drop);
                            
                            dropLevelState.worldDrops.push(drop);
                            
                            // Broadcast item drop to players in this level only
                            broadcastToLevel(dropPlayerLevel, {
                                type: 'dropItem',
                                ...drop
                            });
                            
                            // Send updated inventory/equipment to the player
                            if (fromWhere === 'bag') {
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                            } else if (fromWhere === 'equip') {
                                ensureTwoHandedEquipConsistency(player.equip);
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
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const sellPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                        const { itemId, fromWhere, fromIndex, fromSlot } = data;
                        
                        
                        let soldItem = null;
                        
                        // Remove item from source location
                        if (fromWhere === 'bag' && fromIndex !== null && fromIndex < player.inventory.length) {
                            soldItem = player.inventory[fromIndex];
                            if (soldItem && soldItem.id === itemId) {
                                // Check if item is locked
                                if (soldItem.locked) {
                                    ws.send(JSON.stringify({
                                        type: 'error',
                                        message: 'Cannot sell locked items!'
                                    }));
                                    return;
                                }
                                player.inventory[fromIndex] = null;
                            } else {
                                soldItem = null;
                            }
                        } else if (fromWhere === 'equip' && fromSlot) {
                            soldItem = player.equip[fromSlot];
                            if (soldItem && soldItem.id === itemId) {
                                // Check if item is locked
                                if (soldItem.locked) {
                                    ws.send(JSON.stringify({
                                        type: 'error',
                                        message: 'Cannot sell locked items!'
                                    }));
                                    return;
                                }
                                player.equip[fromSlot] = null;
                            } else {
                                soldItem = null;
                            }
                        }
                        
                        if (soldItem) {
                            // Add pyreals to player
                            const itemValue = soldItem.value || 0;
                            player.pyreals = (player.pyreals || 0) + itemValue;
                            
                            
                            // Add item to vendor buyback list (shared across all players)
                            // Create a copy of the item to avoid reference issues
                            const buybackItem = JSON.parse(JSON.stringify(soldItem));
                            buybackItem.buybackId = `buyback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            buybackItem.soldBy = playerName;
                            buybackItem.soldAt = Date.now();
                            
                            // Add to front of array (most recent first)
                            vendorBuyback.unshift(buybackItem);
                            
                            // Keep only the last MAX_BUYBACK_ITEMS items
                            if (vendorBuyback.length > MAX_BUYBACK_ITEMS) {
                                vendorBuyback.splice(MAX_BUYBACK_ITEMS);
                            }
                            
                            
                            // Send updated buyback list to the player if they have the shop open
                            ws.send(JSON.stringify({
                                type: 'buybackItems',
                                items: vendorBuyback.slice(0, MAX_BUYBACK_ITEMS)
                            }));
                            
                            // Send updated inventory/equipment to the player
                            if (fromWhere === 'bag') {
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                            } else if (fromWhere === 'equip') {
                                ensureTwoHandedEquipConsistency(player.equip);
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
                            
                            // Save player data immediately after any sale (inventory or equipment) to ensure pyreals persist
                            ensureTwoHandedEquipConsistency(player.equip);
                            savePlayerData(playerName, player);
                        }
                    }
                    break;

                case 'getBuybackItems':
                    // Send current buyback items to the player
                    // Allow this even if player isn't fully logged in yet (for early shop access)
                    
                    // Send buyback items regardless of player login status (vendor is shared)
                    const itemsToSend = vendorBuyback.slice(0, MAX_BUYBACK_ITEMS);
                    const response = {
                        type: 'buybackItems',
                        items: itemsToSend // Send up to 10 items
                    };
                    try {
                        ws.send(JSON.stringify(response));
                    } catch (error) {
                        console.error(`[SERVER] [getBuybackItems] Error sending response:`, error);
                    }
                    break;

                case 'buybackItem':
                    // Handle buying back an item from vendor
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const { buybackId } = data;
                        
                        // Find the item in buyback list
                        const buybackIndex = vendorBuyback.findIndex(item => item.buybackId === buybackId);
                        
                        if (buybackIndex !== -1) {
                            const buybackItem = vendorBuyback[buybackIndex];
                            const itemValue = buybackItem.value || 0;
                            
                            // Check if player has enough pyreals
                            if (player.pyreals >= itemValue) {
                                // Remove pyreals
                                player.pyreals = (player.pyreals || 0) - itemValue;
                                
                                // Find empty inventory slot
                                let addedToInventory = false;
                                for (let i = 0; i < player.inventory.length; i++) {
                                    if (!player.inventory[i]) {
                                        // Create a copy of the item without buyback metadata
                                        const purchasedItem = JSON.parse(JSON.stringify(buybackItem));
                                        delete purchasedItem.buybackId;
                                        delete purchasedItem.soldBy;
                                        delete purchasedItem.soldAt;
                                        
                                        player.inventory[i] = purchasedItem;
                                        addedToInventory = true;
                                        
                                        // Remove from buyback list
                                        vendorBuyback.splice(buybackIndex, 1);
                                        
                                        
                                        // Send updated inventory
                                        ws.send(JSON.stringify({
                                            type: 'inventoryUpdated',
                                            inventory: player.inventory
                                        }));
                                        
                                        // Send updated pyreals
                                        ws.send(JSON.stringify({
                                            type: 'pyrealsUpdated',
                                            pyreals: player.pyreals
                                        }));
                                        
                                        // Broadcast player update
                                        const buybackPlayerLevel = playerLevels.get(playerId) || 'sample_level';
                                        broadcastToLevel(buybackPlayerLevel, {
                                            type: 'playerUpdate',
                                            id: playerId,
                                            pyreals: player.pyreals
                                        });
                                        
                                        // Save player data
                                        savePlayerData(playerName, player);
                                        
                                        // Send success message
                                        ws.send(JSON.stringify({
                                            type: 'buybackSuccess',
                                            message: `Purchased ${buybackItem.name}`
                                        }));
                                        
                                        break;
                                    }
                                }
                                
                                if (!addedToInventory) {
                                    // No empty inventory slot
                                    ws.send(JSON.stringify({
                                        type: 'buybackError',
                                        message: 'Inventory is full'
                                    }));
                                }
                            } else {
                                // Not enough pyreals
                                ws.send(JSON.stringify({
                                    type: 'buybackError',
                                    message: 'Not enough pyreals'
                                }));
                            }
                        } else {
                            // Item not found in buyback
                            ws.send(JSON.stringify({
                                type: 'buybackError',
                                message: 'Item no longer available'
                            }));
                        }
                    }
                    break;

                case 'toggleItemLock':
                    // Handle toggling item lock status
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const { itemId, locked } = data;
                        
                        // Find the item in inventory or equipment
                        let item = null;
                        let foundInInventory = false;
                        let foundInEquip = false;
                        let itemIndex = -1;
                        let itemSlot = null;
                        
                        // Check inventory
                        if (player.inventory && player.inventory.length > 0) {
                            for (let i = 0; i < player.inventory.length; i++) {
                                if (player.inventory[i] && player.inventory[i].id === itemId) {
                                    item = player.inventory[i];
                                    foundInInventory = true;
                                    itemIndex = i;
                                    break;
                                }
                            }
                        }
                        
                        // Check equipment if not found in inventory
                        if (!item && player.equip) {
                            for (const [slot, equipItem] of Object.entries(player.equip)) {
                                if (equipItem && equipItem.id === itemId) {
                                    item = equipItem;
                                    foundInEquip = true;
                                    itemSlot = slot;
                                    break;
                                }
                            }
                        }
                        
                        if (item) {
                            // Update lock status
                            item.locked = locked === true;
                            
                            // Save player data to persist lock status
                            savePlayerData(playerName, player);
                            
                            // Send updated inventory or equipment back to client
                            if (foundInInventory) {
                                ws.send(JSON.stringify({
                                    type: 'inventoryUpdated',
                                    inventory: player.inventory
                                }));
                            } else if (foundInEquip) {
                                ws.send(JSON.stringify({
                                    type: 'equipmentUpdated',
                                    equip: player.equip
                                }));
                            }
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Item not found!'
                            }));
                        }
                    }
                    break;

                case 'sellAllInventory':
                    // Handle selling all inventory items to vendor at once
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const { fromWhere } = data;
                        
                        
                        let totalValue = 0;
                        let itemsSold = 0;
                        
                        if (fromWhere === 'bag' && player.inventory && player.inventory.length > 0) {
                            // Sell all inventory items (excluding locked items)
                            // Explicitly check for locked === true to handle undefined/false cases
                            player.inventory.forEach((item, idx) => {
                                if (item && item.value) {
                                    // Check if item is locked - be very explicit about this
                                    const isLocked = item.locked === true || item.locked === 'true';
                                    if (isLocked) {
                                        return; // Skip this item
                                    }
                                    
                                    totalValue += item.value;
                                    itemsSold++;
                                    
                                    // Add item to vendor buyback list
                                    const buybackItem = JSON.parse(JSON.stringify(item));
                                    buybackItem.buybackId = `buyback-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`;
                                    buybackItem.soldBy = playerName;
                                    buybackItem.soldAt = Date.now();
                                    
                                    // Add to front of array (most recent first)
                                    vendorBuyback.unshift(buybackItem);
                                    
                                    // Keep only the last MAX_BUYBACK_ITEMS items
                                    if (vendorBuyback.length > MAX_BUYBACK_ITEMS) {
                                        vendorBuyback.splice(MAX_BUYBACK_ITEMS);
                                    }
                                    
                                    player.inventory[idx] = null;
                                }
                            });
                            
                            if (itemsSold > 0) {
                                
                                // Send updated buyback list to the player
                                ws.send(JSON.stringify({
                                    type: 'buybackItems',
                                    items: vendorBuyback.slice(0, MAX_BUYBACK_ITEMS)
                                }));
                                // Add pyreals to player
                                player.pyreals = (player.pyreals || 0) + totalValue;
                                
                                
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
                                
                                // Save player data immediately after selling all items to ensure pyreals persist
                                savePlayerData(playerName, player);
                            } else {
                            }
                        } else {
                        }
                    } else {
                    }
                    break;

                case 'playerDeath':
                    // Handle player death notification
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        
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
                                grounded: false
                            };
                            applyPickupDelay(drop);
                            
                            gameState.worldDrops.push(drop);
                            
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
                            
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
                        
                    }
                    break;

                case 'shootProjectile':
                    if (playerId && globalPlayers.has(playerId)) {
                        const player = globalPlayers.get(playerId);
                        const playerLevel = playerLevels.get(playerId) || 'sample_level';
                        const levelState = getLevelGameState(playerLevel);
                        
                        // Safety check: ensure levelState exists
                        if (!levelState) {
                            console.error(`Failed to get level state for level: ${playerLevel}`);
                            break;
                        }
                        
                        const weaponType = data.weaponType;
                        const direction = data.direction; // 'left' or 'right'
                        const playerX = player.x;
                        const playerY = player.y;
                        
                        // Debug logging for Crossbow
                        if (weaponType === 'Crossbow') {
                        }
                        
                        let projectile = null;
                        
                        if (weaponType === 'Bow' || weaponType === 'Crossbow') {
                            // Create arrow projectile (both Bow and Crossbow shoot arrows)
                            const startX = playerX + (direction === 'right' ? 32 : -8);
                            const startY = playerY + 16;
                            projectile = {
                                id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                type: 'arrow',
                                x: startX,
                                y: startY,
                                prevX: startX, // Initialize for swept collision detection
                                prevY: startY,
                                vx: direction === 'right' ? 1800 : -1800, // Doubled horizontal velocity for much longer range
                                vy: -100, // Initial upward velocity for arc
                                damage: data.damage || 10,
                                playerId: playerId,
                                weaponType: weaponType,
                                createdAt: Date.now(),
                                lifeTime: 5000 // 5 seconds max life
                            };
                            
                            // Debug logging for Crossbow projectile creation
                            if (weaponType === 'Crossbow') {
                            }
                        } else if (weaponType === 'Wand') {
                            // Check mana before casting
                            const MANA_COST = 5;
                            const currentMana = player.mana || 0;
                            const maxMana = player.maxMana || player.stats?.Mana || 50;
                            
                            // Initialize mana if not set
                            if (player.mana === undefined) {
                                player.mana = maxMana;
                            }
                            
                            // Check if player has enough mana
                            if (currentMana < MANA_COST) {
                                // Not enough mana, send error message to player
                                ws.send(JSON.stringify({
                                    type: 'insufficientMana',
                                    message: 'Not enough mana to cast spell!',
                                    currentMana: currentMana,
                                    requiredMana: MANA_COST
                                }));
                                break;
                            }
                            
                            // Deduct mana
                            player.mana = Math.max(0, currentMana - MANA_COST);
                            
                            // Set mana lock time (regeneration starts 1.5 seconds after casting)
                            player.manaLockUntil = Date.now() + 1500;
                            
                            // Create fireball projectile
                            const startX = playerX + (direction === 'right' ? 32 : -8);
                            const startY = playerY + 16;
                            projectile = {
                                id: `fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                type: 'fireball',
                                x: startX,
                                y: startY,
                                prevX: startX, // Initialize for swept collision detection
                                prevY: startY,
                                vx: direction === 'right' ? 800 : -800,
                                vy: 0, // Straight line
                                damage: data.damage || 15,
                                playerId: playerId,
                                weaponType: weaponType,
                                createdAt: Date.now(),
                                lifeTime: 4000 // 4 seconds max life
                            };
                            
                            // Broadcast mana update to player
                            ws.send(JSON.stringify({
                                type: 'manaUpdated',
                                mana: player.mana,
                                maxMana: maxMana
                            }));
                            
                        }
                        
                        if (projectile) {
                            // Add to level-specific game state
                            if (!levelState.projectiles) levelState.projectiles = [];
                            levelState.projectiles.push(projectile);
                            
                            // Debug logging for Crossbow
                            if (projectile.weaponType === 'Crossbow') {
                            }
                            
                            // Broadcast projectile creation to players in this level only
                            broadcastToLevel(playerLevel, {
                                type: 'projectileCreated',
                                ...projectile
                            });
                        } else if (weaponType === 'Crossbow') {
                            console.error('Crossbow projectile was not created! Check weaponType:', weaponType);
                        }
                    }
                    break;

                case 'loadLevel':
                    // Admin command to load a different level
                    if (playerId && gameState.players.has(playerId)) {
                        const player = gameState.players.get(playerId);
                        // Only allow certain players to load levels (you can add admin check here)
                        if (data.levelName) {
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
                    // Log unknown message types - this will help us see if getBuybackItems is being received but not matched
                    if (data.type === 'getBuybackItems' || (data.type && data.type.toLowerCase && data.type.toLowerCase().includes('buyback'))) {
                        console.error(`[SERVER] ERROR: getBuybackItems message reached default case! This should not happen!`);
                        console.error(`[SERVER] Message type: "${data.type}" (length: ${data.type ? data.type.length : 0})`);
                        console.error(`[SERVER] Full message:`, JSON.stringify(data));
                        // Try to handle it anyway
                        const itemsToSend = vendorBuyback.slice(0, MAX_BUYBACK_ITEMS);
                        ws.send(JSON.stringify({
                            type: 'buybackItems',
                            items: itemsToSend
                        }));
                    } else {
                    }
            }
        } catch (error) {
            console.error('Error parsing message from', playerName, ':', error);
            console.error('Raw message:', message.toString());
            // If it's a getBuybackItems message that failed to parse, log it specially
            if (message.toString().includes('getBuybackItems') || message.toString().includes('buyback')) {
                console.error('[SERVER] ERROR: Failed to parse what looks like a buyback message!');
                console.error('[SERVER] Raw message:', message.toString());
            }
        }
    });

    ws.on('close', (code, reason) => {
        
        if (playerId && globalPlayers.has(playerId)) {
            // Store player data before removing them - get the latest position from globalPlayers
            const playerData = globalPlayers.get(playerId);
            
            // Ensure we have the latest position data before saving
            
            // Save player data to persistent storage (includes x, y position)
            savePlayerData(playerName, playerData);
            
            // Notify other players
            broadcastToOthers(playerId, {
                type: 'playerLeft',
                name: playerName,
                id: playerId
            });
            
            // Remove disconnected player to allow reconnection
            globalPlayers.delete(playerId);
            gameState.players.delete(playerId);
            playerLevels.delete(playerId);
            
            // If this was the last player, clear world drops to prevent accumulation
            const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
            if (totalClients === 0 && gameState.worldDrops.length > 0) {
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
            
            // Safety check: ensure projectile has required properties
            if (!projectile || !projectile.id) {
                levelState.projectiles.splice(i, 1);
                continue;
            }
            
            // Check if projectile has expired (with safety check)
            if (projectile.createdAt && projectile.lifeTime && 
                (now - projectile.createdAt > projectile.lifeTime)) {
                levelState.projectiles.splice(i, 1);
                // Broadcast destruction to players
                broadcastToLevel(levelName, {
                    type: 'projectileDestroyed',
                    id: projectile.id
                });
                continue;
            }
            
            // Ensure projectile has position and velocity properties
            if (typeof projectile.x !== 'number' || typeof projectile.y !== 'number' ||
                typeof projectile.vx !== 'number' || typeof projectile.vy !== 'number') {
                console.warn('Invalid projectile data, removing:', projectile.id);
                levelState.projectiles.splice(i, 1);
                continue;
            }
            
            // Store previous position for swept collision detection
            projectile.prevX = projectile.x;
            projectile.prevY = projectile.y;
            
            // Use sub-stepping for fast projectiles to prevent passing through enemies
            // Calculate how far the projectile will move this frame (before applying physics)
            const currentVx = projectile.vx;
            const currentVy = projectile.vy;
            
            // Apply physics
            if (projectile.type === 'arrow') {
                // Arrow has parabolic arc (gravity)
                projectile.vy += 800 * dt; // gravity
            }
            // Fireball goes straight (no gravity)
            
            // Calculate move distance after physics
            const moveDistance = Math.hypot(projectile.vx * dt, projectile.vy * dt);
            const maxStepSize = 8; // Maximum pixels to move per collision check (reduced for better detection)
            
            if (moveDistance > maxStepSize) {
                // Fast projectile - use sub-stepping with collision checks
                const numSteps = Math.ceil(moveDistance / maxStepSize);
                const stepDt = dt / numSteps;
                
                // Store initial velocity before physics
                const initialVy = currentVy;
                
                // Reset velocity for sub-stepping (will apply physics per step)
                projectile.vx = currentVx;
                projectile.vy = initialVy;
                
                let stepPrevX = projectile.x;
                let stepPrevY = projectile.y;
                
                for (let step = 0; step < numSteps; step++) {
                    // Apply physics for this sub-step
                    if (projectile.type === 'arrow') {
                        projectile.vy += 800 * stepDt; // gravity per step
                    }
                    
                    // Update position for this sub-step
                    projectile.x += projectile.vx * stepDt;
                    projectile.y += projectile.vy * stepDt;
                    
                    // Check collision during sub-stepping (inline collision check)
                    if (!projectile.isEnemyProjectile && levelState.enemies) {
                        for (const enemy of levelState.enemies) {
                            if (!enemy || enemy.dead) continue;
                            if (typeof enemy.x !== 'number' || typeof enemy.y !== 'number') continue;
                            
                            const enemyW = enemy.w || 48;
                            const enemyH = enemy.h || 64;
                            const projectileRadius = 4;
                            const expandedLeft = enemy.x - projectileRadius;
                            const expandedRight = enemy.x + enemyW + projectileRadius;
                            const expandedTop = enemy.y - projectileRadius;
                            const expandedBottom = enemy.y + enemyH + projectileRadius;
                            
                            // Check if projectile intersects enemy bounding box at this sub-step
                            if (projectile.x >= expandedLeft && projectile.x <= expandedRight &&
                                projectile.y >= expandedTop && projectile.y <= expandedBottom) {
                                // Hit detected - mark projectile for removal and damage enemy
                                projectile.hitEnemy = enemy.id;
                                projectile.hitDamage = projectile.damage || 10;
                                break;
                            }
                            // Also check previous position in this sub-step
                            else if (stepPrevX >= expandedLeft && stepPrevX <= expandedRight &&
                                     stepPrevY >= expandedTop && stepPrevY <= expandedBottom) {
                                projectile.hitEnemy = enemy.id;
                                projectile.hitDamage = projectile.damage || 10;
                                break;
                            }
                        }
                    }
                    
                    // Update step previous position for next iteration
                    stepPrevX = projectile.x;
                    stepPrevY = projectile.y;
                    
                    // If hit detected, stop sub-stepping
                    if (projectile.hitEnemy) break;
                }
            } else {
                // Slow projectile - normal update
                projectile.x += projectile.vx * dt;
                projectile.y += projectile.vy * dt;
            }
            
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
        if (levelState.projectiles && levelState.projectiles.length > 0) {
            for (const projectile of levelState.projectiles) {
                // Safety check: ensure projectile has all required properties before broadcasting
                if (!projectile || !projectile.id || 
                    typeof projectile.x !== 'number' || typeof projectile.y !== 'number' ||
                    typeof projectile.vx !== 'number' || typeof projectile.vy !== 'number') {
                    console.warn('Skipping invalid projectile in broadcast:', projectile);
                    continue;
                }
                
                try {
                    broadcastToLevel(levelName, {
                        type: 'projectileUpdate',
                        id: projectile.id,
                        x: projectile.x,
                        y: projectile.y,
                        vx: projectile.vx,
                        vy: projectile.vy
                    });
                } catch (error) {
                    console.error('Error broadcasting projectile update:', error, projectile);
                }
            }
        }
    }
}, 16); // 60 FPS updates

// Save player positions every 30 seconds for persistence
const positionSaveInterval = setInterval(() => {
    const now = Date.now();
    
                        // Periodically save player data to persistent storage (use globalPlayers for latest data)
        for (const [playerId, playerData] of globalPlayers) {
            // Skip saving if player just connected (to prevent overwriting loaded data)
            if (playerData.justConnected) {
                // Clear the flag after first save cycle
                playerData.justConnected = false;
                continue;
            }
            // Save current player data to persistent storage every 30 seconds (includes position, pyreals, inventory, equipment)
            // Ensure pyreals are included in the save
            if (playerData.pyreals === undefined || playerData.pyreals === null) {
                playerData.pyreals = 0;
            }
            savePlayerData(playerData.name, playerData);
        }
    
    // Note: Player data is now stored persistently in files, no cleanup needed
    
    // Clean up old world drops (older than 5 minutes) to prevent accumulation
    const worldDropCleanupTime = 5 * 60 * 1000; // 5 minutes
    for (let i = gameState.worldDrops.length - 1; i >= 0; i--) {
        const drop = gameState.worldDrops[i];
        if (drop.noPickupUntil && (now - drop.noPickupUntil) > worldDropCleanupTime) {
            gameState.worldDrops.splice(i, 1);
        }
    }
    
    // If no players are connected, clear all world drops to prevent accumulation
    const totalClients = httpWss.clients.size + (httpsWss ? httpsWss.clients.size : 0);
    if (totalClients === 0 && gameState.worldDrops.length > 0) {
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
let enemyUpdateFrameCounter = 0; // Throttle enemy position updates to 20fps (every 3 frames)
const gameLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.016, (now - lastEnemyTick) / 1000);
    lastEnemyTick = now;
    enemyUpdateFrameCounter++;

    // Process mana regeneration for all players
    for (const [playerId, player] of globalPlayers) {
        if (!player || player.isDead) continue;
        
        // Initialize mana if not set
        if (player.mana === undefined) {
            player.mana = player.maxMana || 50;
        }
        if (player.maxMana === undefined) {
            // Recalculate maxMana from equipment if needed
            const baseMana = 50;
            let totalMana = baseMana;
            if (player.equip) {
                Object.keys(player.equip).forEach(slot => {
                    const item = player.equip[slot];
                    if (item && item.stats && item.stats.Mana) {
                        totalMana += item.stats.Mana;
                    }
                });
            }
            player.maxMana = Math.max(1, totalMana);
            if (player.mana > player.maxMana) {
                player.mana = player.maxMana;
            }
        }
        
        // Initialize stats if not set
        if (!player.stats) {
            const baseFocus = 5;
            let totalFocus = baseFocus;
            if (player.equip) {
                Object.keys(player.equip).forEach(slot => {
                    const item = player.equip[slot];
                    if (item && item.stats && item.stats.Focus) {
                        totalFocus += item.stats.Focus;
                    }
                });
            }
            player.stats = { Focus: totalFocus };
        }
        
        // Check if mana regeneration is locked
        const manaRegenLocked = player.manaLockUntil && (now < player.manaLockUntil);
        
        // Regenerate mana if not locked and not at max
        if (!manaRegenLocked && player.mana < player.maxMana) {
            // Base regeneration rate: 2 mana per second
            const baseRegenRate = 2;
            // Focus attribute augments regeneration: +0.1 mana/second per Focus point
            const focusBonus = (player.stats.Focus || 5) * 0.1;
            const regenRate = baseRegenRate + focusBonus;
            
            // Regenerate mana (dt is in seconds, so multiply by dt)
            const oldMana = player.mana;
            player.mana = Math.min(player.maxMana, player.mana + regenRate * dt);
            
            // Broadcast mana update if mana changed significantly (to avoid spam, only send when crossing integer thresholds)
            if (Math.floor(oldMana) !== Math.floor(player.mana)) {
                // Find the WebSocket for this player to send update
                const httpClients = Array.from(httpWss.clients);
                const httpsClients = httpsWss ? Array.from(httpsWss.clients) : [];
                const allClients = [...httpClients, ...httpsClients];
                const clientWs = allClients.find(ws => ws.playerId === playerId);
                
                if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: 'manaUpdated',
                        mana: player.mana,
                        maxMana: player.maxMana
                    }));
                }
            }
        }
    }
    
    // Process each level separately
    for (const [levelName, levelState] of levelGameStates) {
        // Only process levels that have players
        const playersInLevel = getPlayersInLevel(levelName);
        if (playersInLevel.length === 0) continue;

        // Handle enemy AI for this level
        for (let i = levelState.enemies.length - 1; i >= 0; i--) {
            const enemy = levelState.enemies[i];
            // Skip dead enemies, but keep Water Wisp and Fire Wisp in list until death animation completes
            let isDeadWispAnimating = false;
            if (enemy.dead) {
                // For Water Wisp and Fire Wisp, check if death animation is complete before removing
                if ((enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') && enemy.dieAnimProgress !== undefined) {
                    if (enemy.dieAnimProgress < 1.1) {
                        // Death animation still playing, keep in list but skip normal updates
                        isDeadWispAnimating = true;
                    } else {
                        // Wisp death animation complete - finalizeEnemyDeath should have been called
                        // But if it wasn't (safety check), call it now and remove the enemy
                        if (levelState.enemies.findIndex(e => e && e.id === enemy.id) !== -1 && !enemy._finalized) {
                            finalizeEnemyDeath(levelName, levelState, enemy);
                        }
                        // Remove from list (finalizeEnemyDeath already did this, but ensure it's gone)
                        const enemyIndex = levelState.enemies.findIndex(e => e && e.id === enemy.id);
                        if (enemyIndex !== -1) {
                            levelState.enemies.splice(enemyIndex, 1);
                        }
                        i--; // Adjust index after removal
                        continue;
                    }
                } else if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp') {
                    // Non-wisp enemies are removed immediately
                    levelState.enemies.splice(i, 1);
                    i--; // Adjust index after removal
                    continue;
                } else {
                    // Wisp with undefined dieAnimProgress - shouldn't happen, but handle it
                    levelState.enemies.splice(i, 1);
                    i--; // Adjust index after removal
                    continue;
                }
            }

            // Skip normal AI updates for dead Wisp that's still animating
            if (isDeadWispAnimating) {
                // Dead Wisp is still animating - only update death animation progress
                // Update death animation progress for Water Wisp and Fire Wisp (server-authoritative)
                if (enemy.dead && enemy.dieAnimProgress !== undefined) {
                    const previousProgress = enemy.dieAnimProgress;
                    enemy.dieAnimProgress += dt;
                    // Check if death animation has completed (7 frames * 0.15s = 1.05 seconds)
                    // Add small buffer to ensure all frames are shown (1.1 seconds = 1.05 + buffer)
                    // Only finalize once when crossing the threshold
                    if (previousProgress < 1.1 && enemy.dieAnimProgress >= 1.1) {
                        // Death animation complete, now finalize death immediately
                        // Make sure enemy is still in the list before finalizing
                        const enemyStillInList = levelState.enemies.findIndex(e => e && e.id === enemy.id) !== -1;
                        if (enemyStillInList) {
                            // Immediately remove from list, spawn loot, and broadcast death
                            // Do this synchronously to avoid any delays
                            finalizeEnemyDeath(levelName, levelState, enemy);
                            // Mark that we've finalized so the main loop doesn't try again
                            enemy._finalized = true;
                        }
                    }
                } else if (enemy.dead && (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') && enemy.dieAnimProgress === undefined) {
                    // Initialize death animation progress if not set
                    enemy.dieAnimProgress = 0;
                }
                
                // Broadcast position update for death animation visibility
                const positionUpdate = {
                    type: 'enemyUpdate',
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    health: enemy.health,
                    maxHealth: enemy.maxHealth,
                    level: enemy.level,
                    enemyType: enemy.type,
                    dead: enemy.dead,
                    name: enemy.name,
                    dieAnimProgress: enemy.dieAnimProgress
                };
                broadcastToLevel(levelName, positionUpdate);
            } else {
                // Find nearest player in this level
            let nearest = null;
            let nearestDistance = Infinity;
            let nearestHorizontalDistance = Infinity;
            for (const player of playersInLevel) {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const horizontalDistance = Math.abs(dx); // Horizontal distance only
                if (distance < nearestDistance) {
                    nearest = player;
                    nearestDistance = distance;
                    nearestHorizontalDistance = horizontalDistance;
                }
            }

            const inRange = nearest && nearestDistance < (enemy.visibilityRange || 400);
            
            // Determine attack range based on enemy type
            let attackRange = 80; // Default melee range
            if (enemy.type === 'spellcaster') {
                attackRange = 200; // Spellcasters stop at minimum spell range
            } else if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                attackRange = enemy.attackRange || 100; // Wisp attack range (slightly larger than stop distance)
            }
            
            // Calculate minimum distance to prevent model intersection
            // Characters are 48 pixels wide, so we need at least 48 pixels center-to-center horizontally
            // Plus a buffer for visual separation (30 pixels)
            const characterWidth = 48;
            const visualBuffer = 30;
            const minHorizontalDistanceForNoIntersection = characterWidth + visualBuffer; // 78 pixels minimum
            
            // Stop distance should be the larger of: attack range or minimum distance for no intersection
            // Use horizontal distance for stop check to prevent model intersection
            // Add a small buffer to prevent oscillation at the boundary
            // Wisp should get closer before stopping (slightly less than attack range)
            let stopHorizontalDistance;
            if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                // Wisp stops slightly before attack range (95 pixels) so it can attack when stopped
                stopHorizontalDistance = Math.max(95, minHorizontalDistanceForNoIntersection) + 5; // ~100 pixels, but attack range is 100 so it can attack
            } else {
                stopHorizontalDistance = Math.max(attackRange, minHorizontalDistanceForNoIntersection) + 5; // At least 83 pixels for melee (reduced from 88)
            }
            
            // Enemy movement AI - use stored speed (calculated with randomization and equipment)
            // Stop moving if within stop distance (use horizontal distance to prevent model intersection)
            const shouldMove = inRange && nearestHorizontalDistance > stopHorizontalDistance;
            
            // Use stored speed, or recalculate if missing (for backwards compatibility)
            let speed = enemy.speed;
            if (!speed) {
                speed = calculateEnemySpeed(enemy.level || 1, enemy.equip);
                enemy.speed = speed;
            }
            
            // Update vx for rendering and movement
            if (shouldMove && nearest) {
                // Only move if we should move (not within stop distance)
                // Calculate direction toward player
                const dx = (nearest.x || 0) - (enemy.x || 0);
                const dy = (nearest.y || 0) - (enemy.y || 0);
                
                // Normalize direction and move toward player
                if (Math.abs(dx) > 0.1) { // Only move if there's significant horizontal distance
                    if (dx > 0) {
                        enemy.x += speed * dt;
                        enemy.vx = speed;
                        enemy.facing = 'right';
                    } else {
                        enemy.x -= speed * dt;
                        enemy.vx = -speed;
                        enemy.facing = 'left';
                    }
                } else {
                    // Very close horizontally, stop moving
                    enemy.vx = 0;
                    enemy.facing = dx > 0 ? 'right' : 'left';
                }
            } else {
                // Stop moving - we're within stop distance or not in range at all
                enemy.vx = 0;
                // Update facing direction toward target if in range
                if (inRange && nearest) {
                    const dx = (nearest.x || 0) - (enemy.x || 0);
                    enemy.facing = dx > 0 ? 'right' : 'left';
                } else {
                    // Keep last facing direction when stationary
                    if (!enemy.facing) enemy.facing = 'right';
                }
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

            // Update attack animation timer
            if (enemy.attackAnimTime !== undefined && enemy.attackAnimTime > 0) {
                // Store previous value for frame detection
                if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                    enemy._lastAttackAnimTime = enemy.attackAnimTime;
                }
                enemy.attackAnimTime = Math.max(0, enemy.attackAnimTime - dt);
                
                // Wisp: Apply damage at frame 06 of attack animation (wisp-attack-06.png)
                // Attack animation is 0.5 seconds with 10 frames (0.05s per frame)
                // Frame 06 (index 6) is at progress 0.6, which means attackAnimTime = 0.5 * (1 - 0.6) = 0.2 seconds remaining
                // Check when we cross the 0.2 threshold (frame 06)
                const wasAboveFrame06 = (enemy._lastAttackAnimTime !== undefined && enemy._lastAttackAnimTime > 0.2);
                const isAtOrBelowFrame06 = enemy.attackAnimTime <= 0.2;
                if ((enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') && wasAboveFrame06 && isAtOrBelowFrame06 && enemy._pendingAttackDamage !== null && enemy._pendingAttackTarget && !enemy._attackDamageApplied) {
                    const p = enemy._pendingAttackTarget;
                    const dmg = enemy._pendingAttackDamage;
                    
                    // Apply damage
                    p.health = Math.max(0, (p.health || p.maxHealth || 100) - dmg);
                    
                    // Check if player died
                    if (p.health <= 0) {
                        p.isDead = true;
                        p.health = 0;
                        
                        // Drop the most valuable item from inventory/equipment
                        const droppedItem = dropMostValuableItem(p);
                        if (droppedItem) {
                            const drop = {
                                id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                x: p.x + 24,
                                y: p.y + 32,
                                item: droppedItem,
                                vx: (Math.random() - 0.5) * 100,
                                vy: -Math.random() * 100 - 200,
                                pickRadius: 40,
                                grounded: false
                            };
                            applyPickupDelay(drop);
                            levelState.worldDrops.push(drop);
                            broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                        }
                        
                        // Generate and broadcast death message
                        const weaponName = 'Water';
                        const deathMessage = generateDeathMessage(p.name, enemy.name, weaponName);
                        broadcastToLevel(levelName, {
                            type: 'chatMessage',
                            message: deathMessage,
                            color: '#ffa500'
                        });
                        
                        broadcastToLevel(levelName, {
                            type: 'playerDeath',
                            playerId: p.id,
                            playerName: p.name
                        });
                    }
                    
                    // Notify all clients with playerHit message (causes flash effect)
                    broadcastToLevel(levelName, { 
                        type: 'playerHit', 
                        id: p.id, 
                        health: p.health, 
                        byEnemyId: enemy.id, 
                        damage: dmg 
                    });
                    broadcastToLevel(levelName, { 
                        type: 'playerUpdate', 
                        id: p.id, 
                        x: p.x, 
                        y: p.y, 
                        health: p.health, 
                        maxHealth: p.maxHealth, 
                        pyreals: p.pyreals 
                    });
                    
                    // Mark damage as applied and clear pending attack
                    enemy._attackDamageApplied = true;
                    enemy._pendingAttackDamage = null;
                    enemy._pendingAttackTarget = null;
                    enemy._lastAttackAnimTime = undefined;
                }
                
                // Reset damage applied flag when attack animation completes
                if (enemy.attackAnimTime <= 0 && enemy._attackDamageApplied) {
                    enemy._attackDamageApplied = false;
                    if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                        enemy._lastAttackAnimTime = undefined;
                    }
                }
            } else if (enemy.attackAnimTime === undefined) {
                enemy.attackAnimTime = 0;
            }
            
            // Update hurt animation timer for Water Wisp and Fire Wisp
            if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                if (enemy.hurtAnimTime !== undefined && enemy.hurtAnimTime > 0) {
                    enemy.hurtAnimTime = Math.max(0, enemy.hurtAnimTime - dt);
                } else if (enemy.hurtAnimTime === undefined) {
                    enemy.hurtAnimTime = 0;
                }
                
                // Note: Death animation progress for dead Wisp is handled in the isDeadWispAnimating block above
                // This section only handles initialization if needed (shouldn't happen, but safety check)
                if (enemy.dead && (enemy.type === 'waterwisp' || enemy.type === 'firewisp') && enemy.dieAnimProgress === undefined && !isDeadWispAnimating) {
                    // Initialize death animation progress if not set
                    enemy.dieAnimProgress = 0;
                }
            }
            
            // Attack if close enough and cooldown elapsed
            enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
            // Only allow attack if cooldown is exactly 0 (not negative) to prevent spam
            // Also check that attack animation is not currently playing
            if (inRange && enemy.attackCooldown === 0 && (enemy.attackAnimTime === undefined || enemy.attackAnimTime <= 0) && nearest) {
                const dx = (nearest.x || 0) - (enemy.x || 0);
                const dy = (nearest.y || 0) - (enemy.y || 0);
                const dist = Math.hypot(dx, dy);
                
                // Update facing direction based on target
                enemy.facing = dx > 0 ? 'right' : 'left';
                
                // Wisp attack logic - damage applied at end of animation
                if ((enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') && dist <= attackRange) {
                    const p = getPlayersInLevel(levelName).find(p => p.id === nearest.id);
                    if (p && !p.isDead) {
                        // Calculate damage (level is already factored in calculateEnemyDamage)
                        const dmg = calculateEnemyDamage(enemy.level || 1, enemy.type, enemy.equip);
                        
                        // Store pending damage and target to apply at end of animation
                        enemy._pendingAttackDamage = dmg;
                        enemy._pendingAttackTarget = p;
                        enemy._attackDamageApplied = false;
                        
                        // Start attack animation (0.5 seconds for full attack animation)
                        enemy.attackAnimTime = 0.5;
                        
                        // Set attack cooldown
                        enemy.attackCooldown = 1.5; // 1.5 second cooldown between attacks
                        
                        // Broadcast enemy attack animation
                        broadcastToLevel(levelName, {
                            type: 'enemyUpdate',
                            id: enemy.id,
                            x: enemy.x,
                            y: enemy.y,
                            health: enemy.health,
                            maxHealth: enemy.maxHealth,
                            attackAnimTime: enemy.attackAnimTime,
                            facing: enemy.facing
                        });
                        // Note: Damage will be applied at the end of animation in the update loop above
                    }
                }
                // Only spellcasters shoot projectiles
                else if (enemy.type === 'spellcaster') {
                    // Cast spell if player is within spell range (200-400 pixels)
                    if (dist >= 200 && dist <= 400) {
                        const p = getPlayersInLevel(levelName).find(p => p.id === nearest.id);
                        if (p) {
                            // Start attack animation for spellcasters too
                            enemy.attackAnimTime = 0.25; // Same duration as player attacks
                            
                            // Calculate damage from equipment
                            const damage = calculateEnemyDamage(enemy.level || 1, enemy.type, enemy.equip);
                            
                            // Create enemy fireball projectile
                            const direction = dx > 0 ? 'right' : 'left';
                            const projectile = {
                                id: `enemy-fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                type: 'fireball',
                                x: enemy.x + (direction === 'right' ? 32 : -8),
                                y: enemy.y + 16,
                                vx: direction === 'right' ? 600 : -600,
                                vy: 0,
                                damage: damage,
                                playerId: enemy.id,
                                weaponType: 'Wand',
                                createdAt: Date.now(),
                                lifeTime: 5000,
                                isEnemyProjectile: true
                            };
                            
                            levelState.projectiles = levelState.projectiles || [];
                            levelState.projectiles.push(projectile);
                            broadcastToLevel(levelName, { type: 'projectileCreated', ...projectile });
                            enemy.attackCooldown = 2.0; // Longer cooldown for spells
                        }
                    }
                } else {
                    // Melee attack for other enemy types (basic, elite, boss)
                    if (dist <= 80) {
                        const p = getPlayersInLevel(levelName).find(p => p.id === nearest.id);
                        if (p) {
                            // Calculate damage from equipment
                            const dmg = calculateEnemyDamage(enemy.level || 1, enemy.type, enemy.equip);
                            p.health = Math.max(0, (p.health || p.maxHealth || 100) - dmg);
                            
                            // Start attack animation
                            enemy.attackAnimTime = 0.25; // Same duration as player attacks
                            
                            // Attack cooldown based on weapon type
                            if (enemy.equip && enemy.equip.mainhand && enemy.equip.mainhand.twoHanded) {
                                enemy.attackCooldown = 0.8; // Slower for 2-handed weapons
                            } else {
                                enemy.attackCooldown = 0.6; // Faster for 1-handed or unarmed
                            }
                            
                            // Check if player died
                            if (p.health <= 0) {
                                p.isDead = true;
                                p.health = 0;
                                
                                // Drop the most valuable item from inventory/equipment
                                const droppedItem = dropMostValuableItem(p);
                                if (droppedItem) {
                                const drop = {
                                        id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        x: p.x + 24,
                                        y: p.y + 32,
                                        item: droppedItem,
                                        vx: (Math.random() - 0.5) * 100,
                                        vy: -Math.random() * 100 - 200,
                                        pickRadius: 40,
                                        grounded: false
                                    };
                                    applyPickupDelay(drop);
                                    levelState.worldDrops.push(drop);
                                    broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                                }
                                
                                // Generate and broadcast death message
                                const weaponName = enemy.equip && enemy.equip.mainhand ? enemy.equip.mainhand.subtype : 'Claw';
                                const deathMessage = generateDeathMessage(p.name, enemy.name, weaponName);
                                broadcastToLevel(levelName, {
                                    type: 'chatMessage',
                                    message: deathMessage,
                                    color: '#ffa500'
                                });
                                
                                broadcastToLevel(levelName, {
                                    type: 'playerDeath',
                                    playerId: p.id,
                                    playerName: p.name
                                });
                            }
                            
                            // Notify all clients
                            broadcastToLevel(levelName, { 
                                type: 'playerHit', 
                                id: p.id, 
                                health: p.health, 
                                byEnemyId: enemy.id, 
                                damage: dmg 
                            });
                            broadcastToLevel(levelName, { 
                                type: 'playerUpdate', 
                                id: p.id, 
                                x: p.x, 
                                y: p.y, 
                                health: p.health, 
                                maxHealth: p.maxHealth, 
                                pyreals: p.pyreals 
                            });
                        }
                    }
                }
            }

            // Broadcast enemy position updates to players in this level
            // Throttle to 20fps (every 3 frames) to reduce network congestion
            // Always send updates for dead wisps animating, attack animations, or if health changed
            const shouldSendUpdate = (enemyUpdateFrameCounter % 3 === 0) || 
                                     (enemy.dead && (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp')) ||
                                     (enemy.attackAnimTime && enemy.attackAnimTime > 0) ||
                                     (enemy._healthChanged !== undefined && enemy._healthChanged);
            
            if (shouldSendUpdate) {
                const positionUpdate = {
                    type: 'enemyUpdate',
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    vx: enemy.vx || 0,
                    health: enemy.health,
                    maxHealth: enemy.maxHealth,
                    level: enemy.level,
                    enemyType: enemy.type, // Always include enemy type (as enemyType to avoid conflict with message type)
                    attackAnimTime: enemy.attackAnimTime || 0, // Include attack animation
                    facing: enemy.facing || 'right' // Include facing direction
                };
                // Only include colors for non-sprite-based enemies
                if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp' && enemy.colors) {
                    positionUpdate.colors = enemy.colors;
                }
                // Include equipment for non-sprite-based enemies
                if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp' && enemy.equip) {
                    positionUpdate.equip = enemy.equip;
                }
                // Include Wisp specific properties
                if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                    positionUpdate.hurtAnimTime = enemy.hurtAnimTime;
                    positionUpdate.dieAnimProgress = enemy.dieAnimProgress;
                }
                broadcastToLevel(levelName, positionUpdate);
                enemy._healthChanged = false; // Reset health change flag
            }
            } // End of else block for non-dead-waterwisp enemies
        }

        // Handle projectile collision detection for this level
        if (levelState.projectiles && levelState.projectiles.length > 0) {
            const projectilesToRemove = [];
            
            for (let i = 0; i < levelState.projectiles.length; i++) {
                const projectile = levelState.projectiles[i];
                
                // Safety check: ensure projectile exists and has required properties
                if (!projectile || !projectile.id) {
                    projectilesToRemove.push(i);
                    continue;
                }
                
                // Check if projectile has expired (with safety check)
                if (projectile.createdAt && projectile.lifeTime && 
                    (now - projectile.createdAt > projectile.lifeTime)) {
                    projectilesToRemove.push(i);
                    continue;
                }
                
                // Check collision with enemies (only for player projectiles)
                // First check if hit was already detected during sub-stepping
                if (projectile.hitEnemy) {
                    // Hit was already detected during sub-stepping, process it now
                    const hitEnemy = levelState.enemies.find(e => e && e.id === projectile.hitEnemy);
                    if (hitEnemy && !hitEnemy.dead) {
                        const damage = projectile.hitDamage || projectile.damage || 10;
                        hitEnemy.health = Math.max(0, hitEnemy.health - damage);
                        
                        // Trigger damage flash (not for Wisp - it uses hurt sprites)
                        if (hitEnemy.type !== 'waterwisp' && hitEnemy.type !== 'firewisp' && hitEnemy.type !== 'earthwisp' && hitEnemy.type !== 'windwisp') {
                            hitEnemy.damageFlashTimer = 0.3;
                        } else {
                            // Set hurt animation for Wisp
                            hitEnemy.hurtAnimTime = 0.3; // 0.3 second hurt animation
                        }
                        
                        // Check if enemy died
                        if (hitEnemy.health <= 0) {
                            hitEnemy.dead = true;
                            hitEnemy.isDead = true;
                            hitEnemy.health = 0;
                            
                            // Set death animation progress for Wisp
                            if (hitEnemy.type === 'waterwisp' || hitEnemy.type === 'firewisp' || hitEnemy.type === 'earthwisp' || hitEnemy.type === 'windwisp') {
                                hitEnemy.dieAnimProgress = 0;
                                // Broadcast death state immediately so client can play death animation
                                const deathUpdateData = {
                                    type: 'enemyUpdate',
                                    id: hitEnemy.id,
                                    health: 0,
                                    maxHealth: hitEnemy.maxHealth,
                                    dead: true,
                                    isDead: true,
                                    dieAnimProgress: 0,
                                    enemyType: hitEnemy.type
                                };
                                broadcastToLevel(levelName, deathUpdateData);
                            }
                            
                            // Drop equipped weapon, then finalize
                            if (hitEnemy.equip && hitEnemy.equip.mainhand) {
                                const drop = {
                                    id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    x: hitEnemy.x + 24,
                                    y: hitEnemy.y + 32,
                                    item: hitEnemy.equip.mainhand,
                                    vx: (Math.random() - 0.5) * 100,
                                    vy: -Math.random() * 100 - 200,
                                    pickRadius: 40,
                                    grounded: false
                                };
                                applyPickupDelay(drop);
                                levelState.worldDrops.push(drop);
                                broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                            }
                            
                            // For Wisp, delay finalization until death animation completes
                            if (hitEnemy.type === 'waterwisp' || hitEnemy.type === 'firewisp' || hitEnemy.type === 'earthwisp' || hitEnemy.type === 'windwisp') {
                                // Don't finalize yet - wait for animation
                            } else {
                                finalizeEnemyDeath(levelName, levelState, hitEnemy);
                            }
                        } else {
                            // Broadcast enemy update
                            broadcastToLevel(levelName, {
                                type: 'enemyUpdate',
                                id: hitEnemy.id,
                                x: hitEnemy.x,
                                y: hitEnemy.y,
                                vx: hitEnemy.vx || 0,
                                health: hitEnemy.health,
                                maxHealth: hitEnemy.maxHealth,
                                level: hitEnemy.level,
                                colors: hitEnemy.colors,
                                equip: hitEnemy.equip,
                                attackAnimTime: hitEnemy.attackAnimTime || 0,
                                facing: hitEnemy.facing || 'right'
                            });
                        }
                    }
                    
                    // Mark projectile for removal
                    projectilesToRemove.push(i);
                    continue;
                }
                
                if (!projectile.isEnemyProjectile) {
                    // Ensure projectile has valid position properties
                    if (typeof projectile.x !== 'number' || typeof projectile.y !== 'number') {
                        continue;
                    }
                    
                    for (const enemy of levelState.enemies) {
                        if (!enemy || enemy.dead) continue;
                        
                        // Safety check: ensure enemy has valid position properties
                        if (typeof enemy.x !== 'number' || typeof enemy.y !== 'number') {
                            console.warn('Enemy missing position data:', enemy.id);
                            continue;
                        }
                        
                        // Get enemy bounds (actual dimensions from enemy object)
                        const enemyW = enemy.w || 48; // Use 48 for consistency with character width
                        const enemyH = enemy.h || 64; // Use 64 for consistency with character height
                        const enemyCenterX = enemy.x + enemyW / 2;
                        const enemyCenterY = enemy.y + enemyH / 2;
                        const enemyLeft = enemy.x;
                        const enemyRight = enemy.x + enemyW;
                        const enemyTop = enemy.y;
                        const enemyBottom = enemy.y + enemyH;
                        
                        // Get projectile's previous position (or current if first check)
                        const prevX = projectile.prevX !== undefined ? projectile.prevX : projectile.x;
                        const prevY = projectile.prevY !== undefined ? projectile.prevY : projectile.y;
                        
                        // Use bounding box intersection for reliable hits with full enemy body
                        // Projectile has a small hit radius, but we check if it intersects the enemy bounding box
                        const projectileRadius = 4; // Small hit radius for projectile
                        
                        // Expand enemy bounding box by projectile radius for intersection check
                        // This ensures projectiles hit if they intersect anywhere with the enemy body
                        const expandedLeft = enemyLeft - projectileRadius;
                        const expandedRight = enemyRight + projectileRadius;
                        const expandedTop = enemyTop - projectileRadius;
                        const expandedBottom = enemyBottom + projectileRadius;
                        
                        let hit = false;
                        
                        // First check: if projectile is currently intersecting enemy bounding box (expanded by projectile radius)
                        // This is the primary check - uses full enemy body dimensions
                        if (projectile.x >= expandedLeft && projectile.x <= expandedRight &&
                            projectile.y >= expandedTop && projectile.y <= expandedBottom) {
                            hit = true;
                        }
                        // Second check: if projectile was previously intersecting enemy bounding box
                        else if (prevX >= expandedLeft && prevX <= expandedRight &&
                                 prevY >= expandedTop && prevY <= expandedBottom) {
                            hit = true;
                        }
                        // Fourth check: sample multiple points along projectile path for fast-moving projectiles
                        else {
                            const lineDx = projectile.x - prevX;
                            const lineDy = projectile.y - prevY;
                            const lineLength = Math.hypot(lineDx, lineDy);
                            
                            if (lineLength > 0) {
                                // Sample points along the path (more samples for faster projectiles)
                                const numSamples = Math.max(5, Math.ceil(lineLength / 5)); // Sample every 5 pixels for better detection
                                for (let s = 0; s <= numSamples; s++) {
                                    const t = s / numSamples;
                                    const sampleX = prevX + lineDx * t;
                                    const sampleY = prevY + lineDy * t;
                                    
                                    // Check if sample point intersects expanded enemy bounding box
                                    // This uses the full enemy body dimensions, not just a radius
                                    if (sampleX >= expandedLeft && sampleX <= expandedRight &&
                                        sampleY >= expandedTop && sampleY <= expandedBottom) {
                                        hit = true;
                                        break;
                                    }
                                }
                                
                                // Fallback: line-rectangle intersection for edge cases
                                if (!hit) {
                                    const lineDirX = lineDx / lineLength;
                                    const lineDirY = lineDy / lineLength;
                                    const tMin = 0;
                                    const tMax = lineLength;
                                    
                                    // Check intersection with each edge
                                    if (lineDirX !== 0) {
                                        const tLeft = (enemyLeft - prevX) / lineDirX;
                                        if (tLeft >= tMin && tLeft <= tMax) {
                                            const yIntersect = prevY + lineDirY * tLeft;
                                            if (yIntersect >= enemyTop && yIntersect <= enemyBottom) {
                                                hit = true;
                                            }
                                        }
                                    }
                                    
                                    if (!hit && lineDirX !== 0) {
                                        const tRight = (enemyRight - prevX) / lineDirX;
                                        if (tRight >= tMin && tRight <= tMax) {
                                            const yIntersect = prevY + lineDirY * tRight;
                                            if (yIntersect >= enemyTop && yIntersect <= enemyBottom) {
                                                hit = true;
                                            }
                                        }
                                    }
                                    
                                    if (!hit && lineDirY !== 0) {
                                        const tTop = (enemyTop - prevY) / lineDirY;
                                        if (tTop >= tMin && tTop <= tMax) {
                                            const xIntersect = prevX + lineDirX * tTop;
                                            if (xIntersect >= enemyLeft && xIntersect <= enemyRight) {
                                                hit = true;
                                            }
                                        }
                                    }
                                    
                                    if (!hit && lineDirY !== 0) {
                                        const tBottom = (enemyBottom - prevY) / lineDirY;
                                        if (tBottom >= tMin && tBottom <= tMax) {
                                            const xIntersect = prevX + lineDirX * tBottom;
                                            if (xIntersect >= enemyLeft && xIntersect <= enemyRight) {
                                                hit = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (hit) {
                            // Deal damage
                            enemy.health -= projectile.damage;
                            enemy._healthChanged = true; // Mark health change for immediate update
                            
                        if (enemy.health <= 0) {
                            enemy.dead = true;
                            
                            if (enemy.equip && enemy.equip.mainhand) {
                                const drop = {
                                    id: `enemy-death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    x: enemy.x + 24,
                                    y: enemy.y + 32,
                                    item: enemy.equip.mainhand,
                                    vx: (Math.random() - 0.5) * 100,
                                    vy: -Math.random() * 100 - 200,
                                    pickRadius: 40,
                                    grounded: false
                                };
                                applyPickupDelay(drop);
                                levelState.worldDrops.push(drop);
                                broadcastToLevel(levelName, { type: 'dropItem', ...drop });
                            }
                            
                            finalizeEnemyDeath(levelName, levelState, enemy);
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
                    // Ensure projectile has valid position properties
                    if (typeof projectile.x !== 'number' || typeof projectile.y !== 'number') {
                        continue;
                    }
                    
                    for (const player of playersInLevel) {
                        if (!player || player.isDead) continue;
                        
                        // Safety check: ensure player has valid position properties
                        if (typeof player.x !== 'number' || typeof player.y !== 'number') {
                            console.warn('Player missing position data:', player.name || player.id);
                            continue;
                        }
                        
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
                                        grounded: false
                                    };
                                    applyPickupDelay(drop);
                                    levelState.worldDrops.push(drop);
                                    broadcastToLevel(levelName, { type: 'dropItem', ...drop });
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
                            break;
                        }
                    }
                }
                
                // Check collision with environment (floor tiles)
                // Ensure projectile has valid position properties before checking floor collision
                if (typeof projectile.x === 'number' && typeof projectile.y === 'number') {
                    const floors = levelState.levelData ? levelState.levelData.floors || [] : [];
                    let hitFloor = false;
                    for (const floor of floors) {
                        // Safety check: ensure floor has valid properties
                        if (!floor || typeof floor.x !== 'number' || typeof floor.y !== 'number' ||
                            typeof floor.width !== 'number' || typeof floor.height !== 'number') {
                            continue;
                        }
                        
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
    }
}, 16); // ~60 FPS for projectiles

// Enemy spawning interval (separate from projectile updates and enemy AI)
setInterval(() => {
    const now = Date.now();
    
    // Process each level separately
    for (const [levelName, levelState] of levelGameStates) {
        // Only spawn enemies in levels that have players
        const playersInLevel = getPlayersInLevel(levelName);
        if (playersInLevel.length === 0) continue;
        
        // Debug: Log spawner status
        if (levelState.spawners && levelState.spawners.length > 0) {
            const readySpawners = levelState.spawners.filter(sp => !sp.currentEnemyId && now >= sp.respawnAt);
            if (readySpawners.length > 0) {
            }
        }
        
        // Handle respawns for this level
        if (!levelState.spawners || levelState.spawners.length === 0) {
        }
        for (const sp of levelState.spawners || []) {
            if (!sp) continue;
            if (!sp.currentEnemyId && now >= (sp.respawnAt || 0)) {
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
                
                // Use createEnemy function to properly initialize enemy with equipment and stats
                const enemyType = sp.type || 'basic';
                const enemy = createEnemy(sp.x, enemyY, enemyLevel, enemyType);
                // Override spawn-specific properties
                enemy.id = levelState.nextEnemyId++;
                enemy.spawnerId = sp.id; // CRITICAL: Set spawnerId so respawn works
                enemy.homeX = sp.x;
                enemy.homeY = enemyY;
                enemy.visibilityRange = sp.visibilityRange;
                enemy.dead = false;
                enemy.attackCooldown = 0;
                // Health is already set by createEnemy, but we can adjust if needed
                enemy.health = 20 + enemyLevel * 12;
                enemy.maxHealth = 20 + enemyLevel * 12;
                levelState.enemies.push(enemy);
                sp.currentEnemyId = enemy.id;
                
                // Broadcast to players in this level only
                const spawnData = { 
                    type: 'enemySpawned', 
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    level: enemy.level,
                    health: enemy.health,
                    maxHealth: enemy.maxHealth,
                    enemyType: enemy.type, // Use enemyType to avoid conflict with message type
                    name: enemy.name,
                    attackAnimTime: enemy.attackAnimTime || 0, // Include attack animation
                    facing: enemy.facing || 'right' // Include facing direction
                };
                // Only include colors for non-sprite-based enemies
                if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp' && enemy.colors) {
                    spawnData.colors = enemy.colors;
                }
                // Include equipment for non-sprite-based enemies
                if (enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp' && enemy.equip) {
                    spawnData.equip = enemy.equip;
                }
                // Include Wisp specific properties
                if (enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') {
                    spawnData.attackRange = enemy.attackRange;
                    spawnData.hurtAnimTime = enemy.hurtAnimTime || 0;
                    spawnData.dieAnimProgress = enemy.dieAnimProgress || 0;
                }
                broadcastToLevel(levelName, spawnData);
            }
        }
    }
}, 1000); // Check for enemy spawns every second

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
                                grounded: false
                            };
                            applyPickupDelay(drop);
                            gameState.worldDrops.push(drop);
                            // Broadcast item drop to all players
                            broadcastToAll({
                                type: 'dropItem',
                                ...drop
                            });
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
            grounded: false
        };
        applyPickupDelay(drop);
        
        gameState.worldDrops.push(drop);
        
        // Broadcast item drop to all players
        broadcastToAll({
            type: 'dropItem',
            ...drop
        });
    });
    
    
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
});

if (httpsWss) {
    httpsServer.listen(HTTPS_PORT, HOST, () => {
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    clearInterval(interval);
    httpWss.close(() => {
        if (httpsWss) {
            httpsWss.close(() => {
            });
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    clearInterval(interval);
    httpWss.close(() => {
        if (httpsWss) {
            httpsWss.close(() => {
            });
        }
        process.exit(0);
    });
});

