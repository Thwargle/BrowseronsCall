// enemy.js - Enemy management and NPC color generation
const { RARITY_BONUSES, determineRarity } = require('./rarity');

// Human first names for enemies
const ENEMY_NAMES = [
    'Aiden', 'Aria', 'Blake', 'Caleb', 'Chloe', 'Dylan', 'Emma', 'Ethan', 'Faith', 'Gavin',
    'Grace', 'Hunter', 'Isabella', 'Jackson', 'Jade', 'Kai', 'Lily', 'Logan', 'Maya', 'Mason',
    'Nora', 'Oliver', 'Olivia', 'Parker', 'Quinn', 'Riley', 'Sage', 'Scarlett', 'Theo', 'Violet',
    'Wyatt', 'Zoe', 'Asher', 'Aurora', 'Bennett', 'Brooklyn', 'Carter', 'Charlotte', 'Declan', 'Eva',
    'Felix', 'Hazel', 'Isaac', 'Ivy', 'Jasper', 'Luna', 'Max', 'Nova', 'Owen', 'Penelope'
];

// Function to get random enemy name
function getRandomEnemyName() {
    return ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
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

// Function to create a new enemy
function createEnemy(x, y, level = 1, type = 'basic') {
    const name = getRandomEnemyName();
    const colors = generateNPCColors();
    
    const enemy = {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        x: x,
        y: y,
        w: 32,
        h: 48,
        vx: 0,
        vy: 0,
        level: level,
        type: type,
        health: 50 + (level * 25),
        maxHealth: 50 + (level * 25),
        attackPower: 10 + (level * 5),
        attackCooldown: 0,
        colors: colors,
        weaponType: type === 'spellcaster' ? 'Fireball' : 'Claw',
        respawnAt: Date.now() + 10000,
        visibilityRange: 500
    };
    
    return enemy;
}

// Enemy death handling is now managed in server.js to avoid circular dependencies

module.exports = {
    ENEMY_NAMES,
    RARITY_BONUSES,
    getRandomEnemyName,
    determineRarity,
    generateNPCColors,
    createEnemy
};
