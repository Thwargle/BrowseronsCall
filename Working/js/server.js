const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

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

// Loot tables for different enemy types
const LOOT_TABLES = {
    basic: {
        currency: { chance: 0.4, amount: [5, 15] },
        weapon: { chance: 0.35, level: [1, 3] },
        armor: { chance: 0.25, level: [1, 2] }
    },
    elite: {
        currency: { chance: 0.3, amount: [15, 30] },
        weapon: { chance: 0.4, level: [2, 5] },
        armor: { chance: 0.3, level: [2, 4] }
    },
    boss: {
        currency: { chance: 0.2, amount: [30, 60] },
        weapon: { chance: 0.5, level: [4, 8] },
        armor: { chance: 0.3, level: [4, 6] }
    }
};

// Human first names for enemies
const ENEMY_NAMES = [
    'Aiden', 'Aria', 'Blake', 'Caleb', 'Chloe', 'Dylan', 'Emma', 'Ethan', 'Faith', 'Gavin',
    'Grace', 'Hunter', 'Isabella', 'Jackson', 'Jade', 'Kai', 'Lily', 'Logan', 'Maya', 'Mason',
    'Nora', 'Oliver', 'Olivia', 'Parker', 'Quinn', 'Riley', 'Sage', 'Scarlett', 'Theo', 'Violet',
    'Wyatt', 'Zoe', 'Asher', 'Aurora', 'Bennett', 'Brooklyn', 'Carter', 'Charlotte', 'Declan', 'Eva',
    'Felix', 'Hazel', 'Isaac', 'Ivy', 'Jasper', 'Luna', 'Max', 'Nova', 'Owen', 'Penelope'
];

// Rarity-based stat bonus ranges
const RARITY_BONUSES = {
    Common: { min: 1, max: 2 },
    Uncommon: { min: 2, max: 4 },
    Rare: { min: 4, max: 6 },
    Epic: { min: 6, max: 8 },
    Legendary: { min: 8, max: 10 }
};

// Function to get random enemy name
function getRandomEnemyName() {
    return ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
}

// Function to determine rarity based on enemy level and type
function determineRarity(enemyLevel, enemyType) {
    const roll = Math.random();
    
    // Level 1 enemies can only drop Common and Uncommon
    if (enemyLevel === 1) {
        if (roll > 0.8) return 'Uncommon';
        return 'Common';
    }
    
    // Level 2 enemies can drop Common to Rare
    if (enemyLevel === 2) {
        if (roll > 0.9) return 'Rare';
        else if (roll > 0.6) return 'Uncommon';
        return 'Common';
    }
    
    // Level 3+ enemies can drop all rarities
    if (roll > 0.95) return 'Legendary';
    else if (roll > 0.85) return 'Epic';
    else if (roll > 0.7) return 'Rare';
    else if (roll > 0.4) return 'Uncommon';
    return 'Common';
}

// Item naming system
const ITEM_NAMES = {
            weapon: {
            prefixes: {
                Common: ['Rusty', 'Worn', 'Simple', 'Basic', 'Plain', 'Crude', 'Cheap'],
                Uncommon: ['Sturdy', 'Reliable', 'Well-made', 'Solid', 'Durable', 'Quality', 'Trusted'],
                Epic: ['Masterwork', 'Exquisite', 'Superior', 'Exceptional', 'Refined', 'Pristine', 'Perfect'],
                Legendary: ['Ancient', 'Mythical', 'Divine', 'Eternal', 'Transcendent', 'Immortal', 'Sacred']
            },
            suffixes: {
                Common: ['of the Commoner', 'of the Peasant', 'of the Novice', 'of the Beginner'],
                Uncommon: ['of the Warrior', 'of the Fighter', 'of the Soldier', 'of the Veteran'],
                Epic: ['of the Champion', 'of the Hero', 'of the Master', 'of the Elite'],
                Legendary: ['of the Legend', 'of the Myth', 'of the Gods', 'of the Ancients']
            }
        },
            armor: {
            prefixes: {
                Common: ['Simple', 'Basic', 'Plain', 'Rough', 'Crude', 'Cheap', 'Worn'],
                Uncommon: ['Sturdy', 'Reinforced', 'Solid', 'Durable', 'Reliable', 'Quality', 'Trusted'],
                Epic: ['Masterwork', 'Exquisite', 'Superior', 'Exceptional', 'Refined', 'Pristine', 'Perfect'],
                Legendary: ['Ancient', 'Mythical', 'Divine', 'Eternal', 'Transcendent', 'Immortal', 'Sacred']
            },
            suffixes: {
                Common: ['of the Commoner', 'of the Peasant', 'of the Novice', 'of the Beginner'],
                Uncommon: ['of the Warrior', 'of the Fighter', 'of the Soldier', 'of the Veteran'],
                Epic: ['of the Champion', 'of the Hero', 'of the Master', 'of the Elite'],
                Legendary: ['of the Legend', 'of the Myth', 'of the Gods', 'of the Ancients']
            }
        }
};

// Function to generate item name based on rarity and type
function generateItemName(itemType, rarity, baseName, slot = null) {
    const prefixes = ITEM_NAMES[itemType]?.prefixes[rarity] || [];
    const suffixes = ITEM_NAMES[itemType]?.suffixes[rarity] || [];
    
    const prefix = prefixes.length > 0 ? prefixes[Math.floor(Math.random() * prefixes.length)] : '';
    const suffix = suffixes.length > 0 ? suffixes[Math.floor(Math.random() * suffixes.length)] : '';
    
    let name = baseName;
    if (slot && itemType === 'armor') {
        // For armor, just use the slot name (e.g., "Head", "Chest", "Legs")
        const slotNames = {
            'head': 'Head',
            'chest': 'Chest', 
            'legs': 'Legs',
            'feet': 'Feet',
            'hands': 'Hands',
            'wrists': 'Wrists',
            'waist': 'Waist',
            'neck': 'Neck',
            'shoulders': 'Shoulders'
        };
        name = slotNames[slot] || slot.charAt(0).toUpperCase() + slot.slice(1);
    }
    
    if (prefix && suffix) {
        return `${prefix} ${name} ${suffix}`;
    } else if (prefix) {
        return `${prefix} ${name}`;
    } else if (suffix) {
        return `${name} ${suffix}`;
    }
    
    return name;
}

// Function to generate consistent colors for NPCs (vendors and enemies)
function generateNPCColors() {
    // Expanded shirt colors - more variety including warm, cool, and neutral tones
    const shirtColors = [
        '#3f506a', '#4a5568', '#2d3748', '#1a202c', '#2d3748', '#4a5568', // Original blues
        '#8b4513', '#a0522d', '#cd853f', '#daa520', '#b8860b', // Browns and golds
        '#556b2f', '#6b8e23', '#9acd32', '#32cd32', '#228b22', // Greens
        '#8b0000', '#dc143c', '#b22222', '#ff6347', '#ff4500', // Reds and oranges
        '#4b0082', '#8a2be2', '#9370db', '#ba55d3', '#9932cc', // Purples
        '#2f4f4f', '#696969', '#808080', '#a9a9a9', '#c0c0c0', // Grays
        '#f5deb3', '#deb887', '#f4a460', '#daa520', '#bdb76b'  // Tans and beiges
    ];
    
    // Expanded pant colors - more variety including dark and light tones
    const pantColors = [
        '#2b2b35', '#2d3748', '#1a202c', '#2d3748', '#2b2b35', '#1a202c', // Original darks
        '#191970', '#000080', '#00008b', '#0000cd', '#0000ff', // Blues
        '#800000', '#8b0000', '#a0522d', '#8b4513', '#654321', // Browns
        '#228b22', '#006400', '#008000', '#32cd32', '#228b22', // Greens
        '#4b0082', '#483d8b', '#6a5acd', '#7b68ee', '#9370db', // Purples
        '#2f4f4f', '#696969', '#808080', '#a9a9a9', '#c0c0c0', // Grays
        '#8b7355', '#a0522d', '#cd853f', '#deb887', '#f5deb3'  // Tans
    ];
    
    // New belt colors for variety
    const beltColors = [
        '#8b4513', '#a0522d', '#cd853f', '#daa520', '#b8860b', // Browns and golds
        '#2f4f4f', '#696969', '#808080', '#a9a9a9', '#c0c0c0', // Grays
        '#4b0082', '#8a2be2', '#9370db', '#ba55d3', '#9932cc', // Purples
        '#8b0000', '#dc143c', '#b22222', '#ff6347', '#ff4500', // Reds and oranges
        '#556b2f', '#6b8e23', '#9acd32', '#32cd32', '#228b22'  // Greens
    ];
    
    // New accessory colors (for necklaces, etc.)
    const accessoryColors = [
        '#ffd700', '#ffed4e', '#ffb347', '#ff8c00', '#ff6347', // Golds and oranges
        '#c0c0c0', '#e5e4e2', '#f5f5f5', '#d3d3d3', '#a9a9a9', // Silvers and whites
        '#ff69b4', '#ff1493', '#db7093', '#ffb6c1', '#ffc0cb', // Pinks
        '#00ced1', '#40e0d0', '#48d1cc', '#7fffd4', '#66cdaa', // Cyans
        '#dda0dd', '#ee82ee', '#d8bfd8', '#e6e6fa', '#f0f8ff'  // Lavenders
    ];
    
    return {
        shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        pants: pantColors[Math.floor(Math.random() * pantColors.length)],
        belt: beltColors[Math.floor(Math.random() * beltColors.length)],
        accessory: accessoryColors[Math.floor(Math.random() * accessoryColors.length)]
    };
}

const gameState = {
    players: new Map(),
    disconnectedPlayers: new Map(),
    enemies: [],
    worldDrops: [],
    nextEnemyId: 1,
    vendor: { id: 'vendor_1', x: 600, y: 200, w: 48, h: 64, vy: 0, colors: generateNPCColors() }
};

// Debug: Log vendor colors at startup
console.log('Server starting with vendor colors:', gameState.vendor.colors);

// Debug: Set up a periodic check to see if vendor colors are still present
// Removed logging to reduce console spam

// Define enemy spawners to the right side of the world
gameState.spawners = [
    { id: 'sp_1', x: 2600, y: GROUND_Y - 64, currentEnemyId: null, respawnAt: Date.now() + 5000, visibilityRange: 400, type: 'basic' },
    { id: 'sp_2', x: 3000, y: GROUND_Y - 64, currentEnemyId: null, respawnAt: Date.now() + 8000, visibilityRange: 400, type: 'elite' },
    { id: 'sp_3', x: 3300, y: GROUND_Y - 64, currentEnemyId: null, respawnAt: Date.now() + 12000, visibilityRange: 400, type: 'elite' },
    { id: 'sp_4', x: 3500, y: GROUND_Y - 64, currentEnemyId: null, respawnAt: Date.now() + 15000, visibilityRange: 400, type: 'boss' }
];

// Function to generate loot based on enemy type and level
function generateLoot(enemyType, enemyLevel) {
    const lootTable = LOOT_TABLES[enemyType] || LOOT_TABLES.basic;
    const dropCount = Math.floor(Math.random() * 2) + 1;
    const drops = [];
    
    for (let i = 0; i < dropCount; i++) {
        const roll = Math.random();
        let dropType = 'currency';
        
        // Determine drop type based on chances
        if (roll < lootTable.currency.chance) {
            dropType = 'currency';
        } else if (roll < lootTable.currency.chance + lootTable.weapon.chance) {
            dropType = 'weapon';
        } else {
            dropType = 'armor';
        }
        
        // Create the item based on type
        let dropItem;
        if (dropType === 'currency') {
            const amount = Math.floor(Math.random() * (lootTable.currency.amount[1] - lootTable.currency.amount[0] + 1)) + lootTable.currency.amount[0];
            dropItem = {
                id: `currency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: 'Pyreals',
                type: 'currency',
                amount: amount * enemyLevel,
                value: amount * enemyLevel,
                icon: null,
                short: 'Currency used for trading',
                rarity: 'Common'
            };
        } else if (dropType === 'weapon') {
            const level = Math.floor(Math.random() * (lootTable.weapon.level[1] - lootTable.weapon.level[0] + 1)) + lootTable.weapon.level[0];
            const weaponNames = ['Sword', 'Axe', 'Mace', 'Dagger', 'Spear', 'Hammer', 'Bow', 'Crossbow', 'Staff', 'Wand', 'Katana', 'Rapier', 'Warhammer', 'Battleaxe', 'Halberd'];
            const weaponName = weaponNames[Math.floor(Math.random() * weaponNames.length)];
            
            // Use new rarity determination system
            const rarity = determineRarity(level, enemyType);
            const rarityBonus = RARITY_BONUSES[rarity];
            
            const fullName = generateItemName('weapon', rarity, weaponName);
            
            // Calculate base stats with rarity bonuses
            const baseStatValue = Math.round(level * 1.5);
            const bonusStatValue = Math.floor(Math.random() * (rarityBonus.max - rarityBonus.min + 1)) + rarityBonus.min;
            
            // Determine weapon type and primary stats
            let primaryStats = {};
            let secondaryStats = {};
            
            if (['Sword', 'Axe', 'Mace', 'Hammer', 'Warhammer', 'Battleaxe', 'Halberd'].includes(weaponName)) {
                // Heavy weapons - focus on Strength
                primaryStats = { Strength: baseStatValue + bonusStatValue };
                secondaryStats = { Endurance: Math.round(baseStatValue * 0.8) };
            } else if (['Dagger', 'Rapier', 'Katana'].includes(weaponName)) {
                // Light weapons - focus on Quickness
                primaryStats = { Quickness: baseStatValue + bonusStatValue };
                secondaryStats = { Coordination: Math.round(baseStatValue * 0.8) };
            } else if (['Bow', 'Crossbow'].includes(weaponName)) {
                // Ranged weapons - focus on Coordination
                primaryStats = { Coordination: baseStatValue + bonusStatValue };
                secondaryStats = { Quickness: Math.round(baseStatValue * 0.8) };
            } else if (['Staff', 'Wand'].includes(weaponName)) {
                // Magic weapons - focus on Focus
                primaryStats = { Focus: baseStatValue + bonusStatValue };
                secondaryStats = { Mana: Math.round(baseStatValue * 0.8) };
            } else {
                // Balanced weapons (Spear) - balanced stats
                primaryStats = { 
                    Strength: Math.round(baseStatValue * 0.8) + Math.floor(bonusStatValue / 2), 
                    Quickness: Math.round(baseStatValue * 0.8) + Math.floor(bonusStatValue / 2)
                };
            }
            
            // Calculate damage based on rarity and level
            const baseDamage = level * 3;
            const rarityDamageMultiplier = rarity === 'Legendary' ? 2.5 : rarity === 'Epic' ? 1.8 : rarity === 'Rare' ? 1.5 : rarity === 'Uncommon' ? 1.2 : 1;
            const dmgMin = Math.round(baseDamage * rarityDamageMultiplier);
            const dmgMax = Math.round(baseDamage * rarityDamageMultiplier * 1.5);
            
            dropItem = {
                id: `weapon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: fullName,
                type: 'weapon',
                level: level,
                rarity: rarity,
                short: `${rarity} ${weaponName.toLowerCase()} with enhanced properties`,
                stats: { ...primaryStats, ...secondaryStats },
                dmgMin: dmgMin,
                dmgMax: dmgMax,
                value: Math.round(level * 15 * (rarity === 'Legendary' ? 7 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : rarity === 'Uncommon' ? 1.5 : 1)),
                icon: null,
                subtype: weaponName
            };
        } else {
            const level = Math.floor(Math.random() * (lootTable.armor.level[1] - lootTable.armor.level[0] + 1)) + lootTable.armor.level[0];
            const slots = ['head', 'chest', 'legs', 'feet', 'hands', 'wrists', 'waist', 'neck', 'shoulders'];
            const slot = slots[Math.floor(Math.random() * slots.length)];
            const armorNames = ['Leather', 'Chain', 'Plate', 'Cloth', 'Silk', 'Steel', 'Mithril', 'Adamantine', 'Dragonhide', 'Shadowweave', 'Celestial', 'Void-touched'];
            const armorName = armorNames[Math.floor(Math.random() * armorNames.length)];
            
            // Use new rarity determination system
            const rarity = determineRarity(level, enemyType);
            const rarityBonus = RARITY_BONUSES[rarity];
            
            const fullName = generateItemName('armor', rarity, armorName, slot);
            
            // Calculate base stats with rarity bonuses
            const baseStatValue = Math.round(level * 1.2);
            const bonusStatValue = Math.floor(Math.random() * (rarityBonus.max - rarityBonus.min + 1)) + rarityBonus.min;
            
            // Determine armor type and primary stats
            let primaryStats = {};
            let secondaryStats = {};
            
            if (['Leather', 'Cloth', 'Silk'].includes(armorName)) {
                // Light armor - focus on Quickness and Coordination
                primaryStats = { 
                    Endurance: baseStatValue + bonusStatValue,
                    Quickness: Math.round(baseStatValue * 0.8) + Math.floor(bonusStatValue / 2)
                };
                secondaryStats = { Coordination: Math.round(baseStatValue * 0.6) };
            } else if (['Chain', 'Steel'].includes(armorName)) {
                // Medium armor - balanced stats
                primaryStats = { 
                    Endurance: baseStatValue + bonusStatValue,
                    Coordination: Math.round(baseStatValue * 0.8)
                };
            } else if (['Plate', 'Mithril', 'Adamantine'].includes(armorName)) {
                // Heavy armor - focus on Endurance and Health
                primaryStats = { 
                    Endurance: baseStatValue + bonusStatValue,
                    Health: Math.round(baseStatValue * 1.2)
                };
                secondaryStats = { Coordination: Math.round(baseStatValue * 0.6) };
            } else if (['Dragonhide', 'Shadowweave', 'Celestial', 'Void-touched'].includes(armorName)) {
                // Special armor - focus on Focus and Mana
                primaryStats = { 
                    Focus: baseStatValue + bonusStatValue,
                    Mana: Math.round(baseStatValue * 1.2)
                };
                secondaryStats = { Endurance: Math.round(baseStatValue * 0.8) };
            }
            
            dropItem = {
                id: `armor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: fullName,
                type: 'armor',
                level: level,
                rarity: rarity,
                short: `${rarity} ${slot} armor piece with enhanced protection`,
                slot: slot,
                stats: { ...primaryStats, ...secondaryStats },
                value: Math.round(level * 12 * (rarity === 'Legendary' ? 7 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : rarity === 'Uncommon' ? 1.5 : 1)),
                icon: null
            };
        }
        
        drops.push(dropItem);
    }
    
    return drops;
}

// Function to create a test sword for new players
function createTestSword() {
    const rarity = 'Common';
    const rarityBonus = RARITY_BONUSES[rarity];
    const baseStatValue = 3;
    const bonusStatValue = Math.floor(Math.random() * (rarityBonus.max - rarityBonus.min + 1)) + rarityBonus.min;
    
    return {
        id: 'test-sword-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: 'Simple Sword of the Novice',
        type: 'weapon',
        level: 1,
        rarity: rarity,
        short: 'A basic training sword',
        value: 10,
        stats: { Strength: baseStatValue + bonusStatValue, Quickness: Math.round(baseStatValue * 0.8) },
        dmgMin: 5,
        dmgMax: 8,
        subtype: 'Sword',
        icon: null
    };
}

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
                        
                        // Check if we have stored data for this player from a previous disconnection
                        if (gameState.disconnectedPlayers.has(playerName)) {
                            console.log(`${playerName} reconnecting (was disconnected)`);
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
                    let storedPlayerData = null;
                    if (gameState.disconnectedPlayers.has(playerName)) {
                        storedPlayerData = gameState.disconnectedPlayers.get(playerName);
                        console.log(`${playerName} restoring data from previous session`);
                        // Remove from disconnected players since they're now connected
                        gameState.disconnectedPlayers.delete(playerName);
                    }
                    
                    // Add player to game state (restore data if available, otherwise use defaults)
                    let initialInventory = storedPlayerData ? storedPlayerData.inventory : new Array(12).fill(null);
                    
                    // If this is a new player (no stored data), add a test sword to the first inventory slot
                    if (!storedPlayerData && initialInventory[0] === null) {
                        const testSword = createTestSword();
                        initialInventory[0] = testSword;
                        console.log(`Adding test sword to new player ${playerName}:`, testSword);
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
                    if (playerId && gameState.players.has(playerId) && data.equip) {
                        const player = gameState.players.get(playerId);
                        player.equip = data.equip;
                        // broadcast to all players so they can render current equipment
                        broadcastToAll({ type: 'equipUpdate', id: playerId, equip: player.equip, reach: player.reach });
                    }
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
                            const { type: projectileType, ...projectileData } = projectile;
                            broadcastToAll({
                                type: 'projectileCreated',
                                ...projectileData
                            });
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
            
            // Store player data for reconnection (no need to store world drop snapshots)
            gameState.disconnectedPlayers.set(playerName, {
                id: playerData.id,
                name: playerData.name,
                x: playerData.x,
                y: playerData.y,
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                pyreals: playerData.pyreals,
                equip: playerData.equip,
                inventory: playerData.inventory,
                shirtColor: playerData.shirtColor,
                pantColor: playerData.pantColor,
                equipmentColors: playerData.equipmentColors,
                lastSaved: Date.now()
            });
            
            // Notify other players
            broadcastToOthers(playerId, {
                type: 'playerLeft',
                name: playerName,
                id: playerId
            });
            
            // Remove disconnected player to allow reconnection
            gameState.players.delete(playerId);
            console.log(`${playerName} data stored for reconnection`);
            
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
    
            // Update stored data for currently active players (for when they disconnect)
        for (const [playerId, playerData] of gameState.players) {
            // Store current position in case they disconnect
            if (!gameState.disconnectedPlayers.has(playerData.name)) {
                
                
                gameState.disconnectedPlayers.set(playerData.name, {
                    id: playerData.id,
                    name: playerData.name,
                    x: playerData.x,
                    y: playerData.y,
                    health: playerData.health,
                    maxHealth: playerData.maxHealth,
                    pyreals: playerData.pyreals,
                    equip: playerData.equip,
                    inventory: playerData.inventory,
                    shirtColor: playerData.shirtColor,
                    pantColor: playerData.pantColor,
                    equipmentColors: playerData.equipmentColors,
                                    lastSaved: now
                });
            } else {
                // Update existing stored data
                const stored = gameState.disconnectedPlayers.get(playerData.name);
                stored.x = playerData.x;
                stored.y = playerData.y;
                stored.health = playerData.health;
                stored.maxHealth = playerData.maxHealth;
                stored.pyreals = playerData.pyreals;
                stored.equip = playerData.equip;
                stored.inventory = playerData.inventory;
                stored.shirtColor = playerData.shirtColor;
                stored.pantColor = playerData.pantColor;
                stored.equipmentColors = playerData.equipmentColors;
                stored.lastSaved = now;
            }
        }
    
    // Clean up old disconnected player data (older than 1 hour)
    for (const [playerName, playerData] of gameState.disconnectedPlayers) {
        if (now - playerData.lastSaved > 3600000) { // 1 hour
            gameState.disconnectedPlayers.delete(playerName);
        }
    }
    
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
});

if (httpsWss) {
    httpsWss.on('close', () => {
        clearInterval(interval);
        clearInterval(positionSaveInterval);
    });
}

// Simple server-authoritative enemy AI + spawn tick
let lastEnemyTick = Date.now();
setInterval(() => {
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
            
            // Check collision with enemies
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
}, 16.67); // 60 ticks per second (1000ms / 60 = 16.67ms)

// Helper functions
function dropMostValuableItem(player) {
    let mostValuableItem = null;
    let highestValue = 0;
    let itemSource = null; // 'inventory' or 'equipment'
    let itemIndex = -1;
    let itemSlot = null;
    
    // Check inventory for most valuable item
    if (player.inventory && Array.isArray(player.inventory)) {
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.value && item.value > highestValue) {
                highestValue = item.value;
                mostValuableItem = item;
                itemSource = 'inventory';
                itemIndex = i;
                itemSlot = null;
            }
        }
    }
    
    // Check equipment for most valuable item
    if (player.equip && typeof player.equip === 'object') {
        for (const slot in player.equip) {
            const item = player.equip[slot];
            if (item && item.value && item.value > highestValue) {
                highestValue = item.value;
                mostValuableItem = item;
                itemSource = 'equipment';
                itemIndex = -1;
                itemSlot = slot;
            }
        }
    }
    
    // If we found a valuable item, remove it from the player
    if (mostValuableItem && highestValue > 0) {
        if (itemSource === 'inventory') {
            player.inventory[itemIndex] = null;
        } else if (itemSource === 'equipment') {
            player.equip[itemSlot] = null;
        }
        
        console.log(`Removed ${mostValuableItem.name} (value: ${highestValue}) from player ${player.name} due to death`);
        return mostValuableItem;
    }
    
    return null;
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

