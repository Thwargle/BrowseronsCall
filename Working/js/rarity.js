// rarity.js - Rarity determination and bonuses system

// Rarity-based stat bonus ranges
const RARITY_BONUSES = {
    Common: { min: 1, max: 2 },
    Uncommon: { min: 2, max: 4 },
    Rare: { min: 4, max: 6 },
    Epic: { min: 6, max: 8 },
    Legendary: { min: 8, max: 10 }
};

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

module.exports = {
    RARITY_BONUSES,
    determineRarity
};
