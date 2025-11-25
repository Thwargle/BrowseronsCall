// enemy.js - Enemy management and NPC color generation
const { RARITY_BONUSES, determineRarity } = require('./rarity');
const { determinePhysicalDamageType } = require('./loot');

function computeWeaponValue(level, rarity) {
    const rarityMultiplier = rarity === 'Legendary' ? 7 :
        rarity === 'Epic' ? 3.5 :
        rarity === 'Rare' ? 2.5 :
        rarity === 'Uncommon' ? 1.8 : 1;
    return Math.max(5, Math.round(level * 20 * rarityMultiplier));
}

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

// Function to generate equipment for enemies based on type
function generateEnemyEquipment(enemyType, enemyLevel) {
    const equip = {
        head: null, neck: null, shoulders: null, chest: null,
        waist: null, legs: null, feet: null, wrists: null,
        hands: null, mainhand: null, offhand: null, trinket: null
    };
    
    // Base stats for enemy equipment (scaled to level)
    const baseStatValue = Math.round(enemyLevel * 1.5);
    const baseDamage = enemyLevel * 3;
    
    if (enemyType === 'basic') {
        // Basic enemies use hands (unarmed) - no weapon equipped
        // They fight with their bare hands
        equip.mainhand = null;
        equip.offhand = null;
    } else if (enemyType === 'elite') {
        // Elite enemies use a single 1-handed weapon
        const oneHandedWeapons = ['Sword', 'Dagger', 'Axe', 'Mace', 'Rapier', 'Saber'];
        const weaponName = oneHandedWeapons[Math.floor(Math.random() * oneHandedWeapons.length)];
        
        equip.mainhand = {
            id: `enemy-weapon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${weaponName} of the Elite`,
            type: 'weapon',
            level: enemyLevel,
            rarity: 'Uncommon',
            subtype: weaponName,
            stats: { Strength: baseStatValue, Quickness: Math.round(baseStatValue * 0.6) },
            dmgMin: baseDamage,
            dmgMax: Math.round(baseDamage * 1.3),
            twoHanded: false,
            physicalDamageType: determinePhysicalDamageType(weaponName),
            elementalDamageType: null,
            value: computeWeaponValue(enemyLevel, 'Uncommon')
        };
    } else if (enemyType === 'spellcaster') {
        // Spellcasters use a wand to shoot projectiles
        equip.mainhand = {
            id: `enemy-wand-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `Wand of the Caster`,
            type: 'weapon',
            level: enemyLevel,
            rarity: 'Uncommon',
            subtype: 'Wand',
            stats: { Focus: baseStatValue, Mana: Math.round(baseStatValue * 0.8) },
            dmgMin: baseDamage,
            dmgMax: Math.round(baseDamage * 1.2),
            twoHanded: true,
            physicalDamageType: determinePhysicalDamageType('Wand'),
            elementalDamageType: null,
            value: computeWeaponValue(enemyLevel, 'Uncommon')
        };
    } else if (enemyType === 'waterwisp' || enemyType === 'firewisp' || enemyType === 'earthwisp' || enemyType === 'windwisp') {
        // Wisp enemies don't use equipment - they're sprite-based
        // They attack with water magic
        equip.mainhand = null;
        equip.offhand = null;
    } else if (enemyType === 'boss') {
        // Boss monsters use a 2-handed weapon
        const twoHandedWeapons = ['Spear', 'Staff', 'Wand', 'Halberd', 'Warhammer', 'Battleaxe'];
        const weaponName = twoHandedWeapons[Math.floor(Math.random() * twoHandedWeapons.length)];
        
        equip.mainhand = {
            id: `enemy-weapon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${weaponName} of the Boss`,
            type: 'weapon',
            level: enemyLevel,
            rarity: 'Rare',
            subtype: weaponName,
            stats: { Strength: Math.round(baseStatValue * 1.2), Endurance: Math.round(baseStatValue * 0.8) },
            dmgMin: Math.round(baseDamage * 1.3),
            dmgMax: Math.round(baseDamage * 1.6),
            twoHanded: true,
            physicalDamageType: determinePhysicalDamageType(weaponName),
            elementalDamageType: null,
            value: computeWeaponValue(enemyLevel, 'Rare')
        };
        // Two-handed weapons occupy both slots
        equip.offhand = equip.mainhand;
    }
    
    return equip;
}

// Function to calculate enemy speed based on level and equipment
function calculateEnemySpeed(enemyLevel, enemyEquip) {
    // Base speed with randomization (80% to 120% of base)
    const baseSpeed = 180 + (enemyLevel * 20); // Base speed scales with level
    const randomMultiplier = 0.8 + (Math.random() * 0.4); // Random between 0.8 and 1.2
    let speed = baseSpeed * randomMultiplier;
    
    // Equipment bonuses to speed
    if (enemyEquip && enemyEquip.mainhand && enemyEquip.mainhand.stats) {
        const stats = enemyEquip.mainhand.stats;
        // Quickness increases speed
        if (stats.Quickness) {
            speed += stats.Quickness * 8;
        }
        // Two-handed weapons are slower
        if (enemyEquip.mainhand.twoHanded) {
            speed *= 0.85; // 15% slower
        }
    }
    
    return Math.round(speed);
}

// Function to calculate enemy damage based on level and equipment
function calculateEnemyDamage(enemyLevel, enemyType, enemyEquip) {
    let baseDamage = 10 + (enemyLevel * 5);
    
    if (enemyEquip && enemyEquip.mainhand) {
        const weapon = enemyEquip.mainhand;
        if (weapon.dmgMin && weapon.dmgMax) {
            // Use weapon damage range
            baseDamage = weapon.dmgMin + Math.floor(Math.random() * (weapon.dmgMax - weapon.dmgMin + 1));
        }
        
        // Add stat bonuses
        if (weapon.stats) {
            if (weapon.stats.Strength) {
                baseDamage += Math.round(weapon.stats.Strength * 0.5);
            }
            if (weapon.stats.Focus && enemyType === 'spellcaster') {
                baseDamage += Math.round(weapon.stats.Focus * 0.6);
            }
        }
    }
    
    return Math.round(baseDamage);
}

// Function to create a new enemy
function createEnemy(x, y, level = 1, type = 'basic') {
    // Wisp enemies always use the fixed name based on type
    const name = type === 'waterwisp' ? 'Water Wisp' : 
                 type === 'firewisp' ? 'Fire Wisp' : 
                 type === 'earthwisp' ? 'Earth Wisp' : 
                 type === 'windwisp' ? 'Wind Wisp' : 
                 getRandomEnemyName();
    const colors = generateNPCColors();
    const equip = generateEnemyEquipment(type, level);
    const speed = calculateEnemySpeed(level, equip);
    const attackPower = calculateEnemyDamage(level, type, equip);
    
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
        attackPower: attackPower,
        attackCooldown: 0,
        attackAnimTime: 0, // Track attack animation
        facing: 'right', // Track facing direction
        colors: (type === 'waterwisp' || type === 'firewisp' || type === 'earthwisp' || type === 'windwisp') ? null : colors, // Wisp doesn't use colors
        equip: equip,
        speed: speed, // Store speed for movement
        weaponType: type === 'spellcaster' ? 'Fireball' : 
                    type === 'waterwisp' ? 'Water' : 
                    type === 'firewisp' ? 'Fire' : 
                    type === 'earthwisp' ? 'Earth' : 
                    type === 'windwisp' ? 'Wind' : 
                    (equip.mainhand ? equip.mainhand.subtype : 'Claw'),
        respawnAt: Date.now() + 10000,
        visibilityRange: 500
    };
    
    // Wisp specific properties
    if (type === 'waterwisp' || type === 'firewisp' || type === 'earthwisp' || type === 'windwisp') {
        enemy.attackRange = 100; // Attack range for wisp (slightly larger than stop distance)
        enemy.hurtAnimTime = 0; // Track hurt animation
        enemy.dieAnimProgress = 0; // Track death animation
        enemy._attackDamageApplied = false; // Track if damage has been applied for current attack
        enemy._pendingAttackDamage = null; // Store pending damage to apply at end of animation
        enemy._pendingAttackTarget = null; // Store target player for pending attack
    }
    
    return enemy;
}

// Enemy death handling is now managed in server.js to avoid circular dependencies

module.exports = {
    ENEMY_NAMES,
    RARITY_BONUSES,
    getRandomEnemyName,
    determineRarity,
    generateNPCColors,
    createEnemy,
    generateEnemyEquipment,
    calculateEnemySpeed,
    calculateEnemyDamage
};
