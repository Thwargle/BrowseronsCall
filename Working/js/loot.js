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
                value: Math.round(level * 12 * (rarity === 'Legendary' ? 7 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : rarity === 'Uncommon' ? 1.5 : 1)),
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
        icon: null
    };
}

module.exports = {
    LOOT_TABLES,
    ITEM_NAMES,
    generateItemName,
    generateLoot,
    createTestSword
};
