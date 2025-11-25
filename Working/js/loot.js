// loot.js - Item and loot generation system
const { determineRarity, RARITY_BONUSES } = require('./rarity');

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
    },
    spellcaster: {
        currency: { chance: 0.3, amount: [20, 40] },
        weapon: { chance: 0.4, level: [3, 6] },
        armor: { chance: 0.3, level: [3, 5] }
    }
};

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

// Damage type constants
const PHYSICAL_DAMAGE_TYPES = ['Bludgeoning', 'Slashing', 'Piercing'];
const ELEMENTAL_DAMAGE_TYPES = ['Fire', 'Acid', 'Lightning', 'Frost'];

// Elemental name prefixes
const ELEMENTAL_PREFIXES = {
    'Fire': ['Fiery', 'Burning', 'Flaming', 'Blazing'],
    'Acid': ['Corrosive', 'Venomous', 'Toxic', 'Acidic'],
    'Lightning': ['Shocking', 'Crackling', 'Electric', 'Thunderous'],
    'Frost': ['Freezing', 'Icy', 'Frostbitten', 'Glacial']
};

const TWO_HANDED_WEAPON_TYPES = [
    'Spear',
    'Javelin',
    'Trident',
    'Pike',
    'Staff',
    'Wand',
    'Halberd',
    'Bow',
    'Crossbow',
    'Longsword',
    'Greatsword',
    'Warhammer',
    'Battleaxe',
    'Maul'
];

function isTwoHandedWeapon(weaponName) {
    if (!weaponName) return false;
    return TWO_HANDED_WEAPON_TYPES.includes(weaponName);
}

// Helper function to check if an item is two-handed (works with item objects or weapon names)
function checkIfTwoHanded(itemOrName) {
    if (!itemOrName) return false;
    if (typeof itemOrName === 'string') {
        return isTwoHandedWeapon(itemOrName);
    }
    // Check item properties
    if (itemOrName.twoHanded !== undefined) {
        return itemOrName.twoHanded === true;
    }
    if (itemOrName.subtype) {
        return isTwoHandedWeapon(itemOrName.subtype);
    }
    if (itemOrName.name) {
        const weaponKind = typeof window !== 'undefined' && window.weaponKindFromName ? 
            window.weaponKindFromName(itemOrName.name) : null;
        return weaponKind ? isTwoHandedWeapon(weaponKind) : false;
    }
    return false;
}

// Function to determine physical damage type based on weapon subtype
function determinePhysicalDamageType(weaponName) {
    if (!weaponName) {
        console.warn('determinePhysicalDamageType called with null/undefined weaponName');
        return 'Slashing';
    }
    
    // Bludgeoning weapons - check first
    const bludgeoningWeapons = ['Mace', 'Hammer', 'Warhammer', 'Club', 'Maul', 'Flail'];
    if (bludgeoningWeapons.includes(weaponName)) {
        return 'Bludgeoning';
    }
    
    // Piercing weapons - check second
    const piercingWeapons = ['Dagger', 'Rapier', 'Spear', 'Bow', 'Crossbow', 'Javelin', 'Trident', 'Pike'];
    if (piercingWeapons.includes(weaponName)) {
        return 'Piercing';
    }
    
    // Slashing weapons (default for most)
    // Sword, Axe, Katana, Battleaxe, Halberd, Staff (can be slashing), Wand (can be slashing), Scimitar, Longsword, Greatsword, Falchion
    // Explicitly list slashing weapons for clarity
    const slashingWeapons = ['Sword', 'Axe', 'Katana', 'Battleaxe', 'Halberd', 'Scimitar', 'Longsword', 'Greatsword', 'Blade', 'Saber', 'Staff', 'Wand'];
    if (slashingWeapons.includes(weaponName)) {
        return 'Slashing';
    }
    
    // Default to slashing if weapon type not recognized
    console.warn(`Unknown weapon type: ${weaponName}, defaulting to Slashing`);
    return 'Slashing';
}

// Function to generate item name based on rarity and type
function generateItemName(itemType, rarity, baseName, slot = null, elementalType = null) {
    const prefixes = ITEM_NAMES[itemType]?.prefixes[rarity] || [];
    const suffixes = ITEM_NAMES[itemType]?.suffixes[rarity] || [];
    
    let prefix = prefixes.length > 0 ? prefixes[Math.floor(Math.random() * prefixes.length)] : '';
    
    // Add elemental prefix if weapon has elemental damage
    if (elementalType && itemType === 'weapon') {
        const elementalPrefixes = ELEMENTAL_PREFIXES[elementalType] || [];
        if (elementalPrefixes.length > 0) {
            const elemPrefix = elementalPrefixes[Math.floor(Math.random() * elementalPrefixes.length)];
            prefix = `${elemPrefix} ${prefix}`;
        }
    }
    
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

// Function to generate random colors for armor items
function generateArmorColors(rarity) {
    if (rarity === 'Legendary') {
        // For legendary items, generate two random colors for radiant gradient
        const colorSets = [
            { fill: '#ff4500', edge: '#dc143c' }, // Red
            { fill: '#4169E1', edge: '#000080' }, // Blue
            { fill: '#32CD32', edge: '#228B22' }, // Green
            { fill: '#FFD700', edge: '#FFA500' }, // Gold
            { fill: '#9370DB', edge: '#4B0082' }, // Purple
            { fill: '#FF69B4', edge: '#C71585' }, // Pink
            { fill: '#00CED1', edge: '#008B8B' }, // Cyan
            { fill: '#FF6347', edge: '#8B0000' }, // Orange
            { fill: '#1f2937', edge: '#111827' }, // Dark
            { fill: '#DC143C', edge: '#191970' }  // Red-Blue
        ];
        
        // Pick two random color sets
        const set1 = colorSets[Math.floor(Math.random() * colorSets.length)];
        const set2 = colorSets[Math.floor(Math.random() * colorSets.length)];
        
        return {
            fill: set1.fill,
            edge: set1.edge,
            legendary: true,
            gradient: {
                color1: set1.fill,
                color2: set2.fill
            }
        };
    } else {
        // For non-legendary items, generate a single random color
        const colorSet = [
            { fill: '#a57544', edge: '#6b4423' }, // Brown/Leather
            { fill: '#6ea2d6', edge: '#3d688d' }, // Light Blue
            { fill: '#a9a9a9', edge: '#696969' }, // Gray/Metal
            { fill: '#dc2626', edge: '#991b1b' }, // Red
            { fill: '#1f2937', edge: '#111827' }, // Dark Gray
            { fill: '#fbbf24', edge: '#d97706' }, // Gold
            { fill: '#7c3aed', edge: '#5b21b6' }, // Purple
            { fill: '#c0c0c0', edge: '#a9a9a9' }, // Silver
            { fill: '#e6e6fa', edge: '#d8bfd8' }, // Light Purple
            { fill: '#ff4500', edge: '#dc143c' }, // Orange
            { fill: '#87ceeb', edge: '#4682b4' }, // Light Blue
            { fill: '#228b22', edge: '#006400' }  // Green
        ];
        
        return colorSet[Math.floor(Math.random() * colorSet.length)];
    }
}

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
            
            // Expanded weapon pool with better distribution
            // Organized by damage type for easier balancing
            const slashingWeapons = ['Sword', 'Axe', 'Katana', 'Battleaxe', 'Halberd', 'Scimitar', 'Longsword', 'Greatsword'];
            const bludgeoningWeapons = ['Mace', 'Hammer', 'Warhammer', 'Club', 'Maul', 'Flail'];
            const piercingWeapons = ['Dagger', 'Rapier', 'Spear', 'Bow', 'Crossbow', 'Javelin', 'Trident'];
            const allWeapons = [...slashingWeapons, ...bludgeoningWeapons, ...piercingWeapons, 'Wand']; // Wand is special
            
            // Weight weapons more evenly across damage types (33% each for better balance)
            const typeRoll = Math.random();
            let weaponName;
            let selectedType = '';
            if (typeRoll < 0.33) {
                // 33% chance for slashing
                weaponName = slashingWeapons[Math.floor(Math.random() * slashingWeapons.length)];
                selectedType = 'slashing';
            } else if (typeRoll < 0.66) {
                // 33% chance for bludgeoning
                weaponName = bludgeoningWeapons[Math.floor(Math.random() * bludgeoningWeapons.length)];
                selectedType = 'bludgeoning';
            } else {
                // 34% chance for piercing (includes Wand which is special)
                // 90% of piercing pool is actual piercing, 10% is Wand
                if (typeRoll < 0.97) {
                    weaponName = piercingWeapons[Math.floor(Math.random() * piercingWeapons.length)];
                    selectedType = 'piercing';
                } else {
                    // 3% chance (10% of 30%) for Wand
                    weaponName = 'Wand';
                    selectedType = 'magic';
                }
            }
            
            // Use new rarity determination system
            const rarity = determineRarity(level, enemyType);
            const rarityBonus = RARITY_BONUSES[rarity];
            
            // Determine physical damage type based on weapon subtype
            const physicalDamageType = determinePhysicalDamageType(weaponName);
            
            // Debug log to verify weapon selection is working
            console.log(`Generated weapon: ${weaponName} (selected from ${selectedType} pool, detected as ${physicalDamageType})`);
            
            // Determine if weapon should have elemental damage (increased chances for more variety)
            // Higher rarity = higher chance of elemental damage
            let elementalDamageType = null;
            const elementalRoll = Math.random();
            let elementalChance = 0.25; // Base 25% chance for Common (increased from 10%)
            if (rarity === 'Legendary') elementalChance = 0.75; // 75% for Legendary (increased from 50%)
            else if (rarity === 'Epic') elementalChance = 0.60; // 60% for Epic (increased from 40%)
            else if (rarity === 'Rare') elementalChance = 0.50; // 50% for Rare (increased from 30%)
            else if (rarity === 'Uncommon') elementalChance = 0.35; // 35% for Uncommon (increased from 20%)
            
            if (elementalRoll < elementalChance) {
                // Randomly assign one elemental type
                elementalDamageType = ELEMENTAL_DAMAGE_TYPES[Math.floor(Math.random() * ELEMENTAL_DAMAGE_TYPES.length)];
            }
            
            const fullName = generateItemName('weapon', rarity, weaponName, null, elementalDamageType);
            
            // Calculate base stats with rarity bonuses
            const baseStatValue = Math.round(level * 1.5);
            const bonusStatValue = Math.floor(Math.random() * (rarityBonus.max - rarityBonus.min + 1)) + rarityBonus.min;
            
            // Determine weapon type and primary stats
            let primaryStats = {};
            let secondaryStats = {};
            
            // Heavy/Strength weapons
            if (['Sword', 'Axe', 'Mace', 'Hammer', 'Warhammer', 'Battleaxe', 'Halberd', 'Club', 'Maul', 'Flail', 'Greatsword', 'Longsword'].includes(weaponName)) {
                primaryStats = { Strength: baseStatValue + bonusStatValue };
                secondaryStats = { Endurance: Math.round(baseStatValue * 0.8) };
            } 
            // Light/Quickness weapons
            else if (['Dagger', 'Rapier', 'Katana', 'Scimitar'].includes(weaponName)) {
                primaryStats = { Quickness: baseStatValue + bonusStatValue };
                secondaryStats = { Coordination: Math.round(baseStatValue * 0.8) };
            } 
            // Ranged/Coordination weapons
            else if (['Bow', 'Crossbow', 'Javelin'].includes(weaponName)) {
                primaryStats = { Coordination: baseStatValue + bonusStatValue };
                secondaryStats = { Quickness: Math.round(baseStatValue * 0.8) };
            } 
            // Magic/Focus weapons
            else if (weaponName === 'Wand') {
                primaryStats = { Focus: baseStatValue + bonusStatValue };
                secondaryStats = { Mana: Math.round(baseStatValue * 0.8) };
            } 
            // Balanced/Piercing weapons (Spear, Trident, Pike)
            else {
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
                value: Math.max(5, Math.round(level * 20 * (rarity === 'Legendary' ? 7 : rarity === 'Epic' ? 3.5 : rarity === 'Rare' ? 2.5 : rarity === 'Uncommon' ? 1.8 : 1))),
                icon: null,
                subtype: weaponName,
                physicalDamageType: physicalDamageType, // Ensure physical damage type is set
                elementalDamageType: elementalDamageType || null, // Store elemental type if present
                twoHanded: isTwoHandedWeapon(weaponName) // Mark if weapon is two-handed
            };
            
            // Verify damage type was set correctly (Wand is special - it's magic type but has Slashing physical damage)
            if (!dropItem.physicalDamageType) {
                console.error(`ERROR: Weapon ${weaponName} missing physicalDamageType`);
            } else if (dropItem.physicalDamageType === 'Slashing' && selectedType !== 'slashing' && selectedType !== 'magic') {
                console.error(`ERROR: Weapon ${weaponName} selected from ${selectedType} pool but damage type is ${dropItem.physicalDamageType}`);
            }
            
            // Log final item for debugging
            console.log(`Created weapon item: ${dropItem.name}, Damage Type: ${dropItem.physicalDamageType}${dropItem.elementalDamageType ? ' + ' + dropItem.elementalDamageType : ''}`);
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
            
            // Generate colors for this armor piece
            const colors = generateArmorColors(rarity);
            
            dropItem = {
                id: `armor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: fullName,
                type: 'armor',
                level: level,
                rarity: rarity,
                short: `${rarity} ${slot} armor piece with enhanced protection`,
                slot: slot,
                stats: { ...primaryStats, ...secondaryStats },
                value: Math.max(5, Math.round(level * 16 * (rarity === 'Legendary' ? 7 : rarity === 'Epic' ? 3.5 : rarity === 'Rare' ? 2.5 : rarity === 'Uncommon' ? 1.8 : 1))),
                icon: null,
                colors: colors
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
        icon: null,
        physicalDamageType: 'Slashing', // Swords are slashing
        elementalDamageType: null, // No elemental damage for starter weapon
        twoHanded: false // Starter sword is one-handed
    };
}

module.exports = {
    LOOT_TABLES,
    ITEM_NAMES,
    generateItemName,
    generateLoot,
    createTestSword,
    isTwoHandedWeapon,
    checkIfTwoHanded,
    determinePhysicalDamageType
};
