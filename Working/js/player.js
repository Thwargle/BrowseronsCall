// player.js - Player data management and death message system
const path = require('path');
const fs = require('fs');

// Create player data directory if it doesn't exist
const PLAYER_DATA_DIR = path.join(__dirname, '..', 'player_data');
if (!fs.existsSync(PLAYER_DATA_DIR)) {
    fs.mkdirSync(PLAYER_DATA_DIR, { recursive: true });
    console.log('Created player data directory:', PLAYER_DATA_DIR);
}

// Death message generation function
function generateDeathMessage(playerName, killerName, weaponType) {
    const messages = [
        // Classic combat messages
        `${playerName} was slain by ${killerName}.`,
        `${playerName} fell to ${killerName}'s ${weaponType}.`,
        `${killerName} struck down ${playerName} with a ${weaponType}.`,
        `${playerName} was defeated by ${killerName} using a ${weaponType}.`,
        `${killerName} eliminated ${playerName} with a ${weaponType}.`,
        `${playerName} met their end at the hands of ${killerName} and their ${weaponType}.`,
        `${killerName} claimed victory over ${playerName} with a ${weaponType}.`,
        `${playerName} was vanquished by ${killerName}'s ${weaponType}.`,
        `${killerName} brought down ${playerName} with a ${weaponType}.`,
        `${playerName} was bested by ${killerName} and their ${weaponType}.`,
        
        // Dramatic/Epic messages
        `${playerName}'s corpse crumbles before ${killerName}.`,
        `${playerName}'s credit score went down because of ${killerName}.`,
        `${playerName} has been sent to the shadow realm by ${killerName}.`,
        `${playerName} was yeeted into oblivion by ${killerName}.`,
        `${playerName} got absolutely demolished by ${killerName}.`,
        `${playerName} was turned into a fine red mist by ${killerName}.`,
        `${killerName} made ${playerName} regret their life choices.`,
        `${playerName} learned the hard way not to mess with ${killerName}.`,
        `${killerName} sent ${playerName} to meet their maker.`,
        `${playerName} was reduced to a pile of bones by ${killerName}.`,
        
        // Humorous messages
        `${playerName} got rekt by ${killerName}.`,
        `${playerName} was absolutely bodied by ${killerName}.`,
        `${killerName} gave ${playerName} a one-way ticket to the afterlife.`,
        `${playerName} was clapped by ${killerName}.`,
        `${killerName} made ${playerName} their personal punching bag.`,
        `${playerName} was folded like a lawn chair by ${killerName}.`,
        `${killerName} turned ${playerName} into a cautionary tale.`,
        `${playerName} was sent to the gulag by ${killerName}.`,
        `${killerName} made ${playerName} question their life decisions.`,
        `${playerName} was absolutely styled on by ${killerName}.`,
        
        // Creative/Unique messages
        `${playerName} was converted to fertilizer by ${killerName}.`,
        `${killerName} made ${playerName} part of the landscape.`,
        `${playerName} was turned into a modern art installation by ${killerName}.`,
        `${killerName} gave ${playerName} a permanent nap.`,
        `${playerName} was sent to the shadow realm by ${killerName}.`,
        `${killerName} made ${playerName} into a cautionary tale.`,
        `${playerName} was reduced to a fine powder by ${killerName}.`,
        `${killerName} turned ${playerName} into a lesson for others.`,
        `${playerName} was made into an example by ${killerName}.`,
        `${killerName} gave ${playerName} a one-way trip to the void.`
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
}

// Persistent storage functions for player data
function savePlayerData(playerName, playerData) {
    try {
        const fileName = `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(PLAYER_DATA_DIR, fileName);
        
        const dataToSave = {
            id: playerData.id,
            name: playerData.name,
            x: playerData.x,
            y: playerData.y,
            health: playerData.health,
            maxHealth: playerData.maxHealth,
            pyreals: playerData.pyreals !== undefined && playerData.pyreals !== null ? playerData.pyreals : 0, // Ensure pyreals are always saved, defaulting to 0
            equip: playerData.equip,
            inventory: playerData.inventory,
            shirtColor: playerData.shirtColor,
            pantColor: playerData.pantColor,
            equipmentColors: playerData.equipmentColors,
            lastSaved: Date.now()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`Saved player data for ${playerName} to ${fileName}`);
        console.log(`Pyreals saved: ${dataToSave.pyreals}`);
        console.log(`Equipment data saved:`, JSON.stringify(dataToSave.equip, null, 2));
        console.log(`Inventory data saved:`, JSON.stringify(dataToSave.inventory, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving player data for ${playerName}:`, error);
        return false;
    }
}

function loadPlayerData(playerName) {
    try {
        const fileName = `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(PLAYER_DATA_DIR, fileName);
        
        if (!fs.existsSync(filePath)) {
            console.log(`No saved data found for ${playerName}`);
            return null;
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        const playerData = JSON.parse(data);
        console.log(`Loaded player data for ${playerName} from ${fileName}`);
        console.log(`Pyreals loaded: ${playerData.pyreals !== undefined ? playerData.pyreals : 'undefined (will default to 0)'}`);
        return playerData;
    } catch (error) {
        console.error(`Error loading player data for ${playerName}:`, error);
        return null;
    }
}

function deletePlayerData(playerName) {
    try {
        const fileName = `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(PLAYER_DATA_DIR, fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted player data for ${playerName}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting player data for ${playerName}:`, error);
        return false;
    }
}

// Function to drop the most valuable item from a player's inventory/equipment
function dropMostValuableItem(player) {
    let mostValuableItem = null;
    let mostValuableValue = 0;
    let itemSource = null;
    let itemIndex = null;
    let itemSlot = null;
    
    // Check equipment for most valuable item
    if (player.equip) {
        for (const slot in player.equip) {
            const item = player.equip[slot];
            if (item && item.value && item.value > mostValuableValue) {
                mostValuableItem = item;
                mostValuableValue = item.value;
                itemSource = 'equip';
                itemSlot = slot;
            }
        }
    }
    
    // Check inventory for most valuable item
    if (player.inventory) {
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.value && item.value > mostValuableValue) {
                mostValuableItem = item;
                mostValuableValue = item.value;
                itemSource = 'inventory';
                itemIndex = i;
            }
        }
    }
    
    // Remove the item from the player
    if (mostValuableItem) {
        if (itemSource === 'equip') {
            player.equip[itemSlot] = null;
        } else if (itemSource === 'inventory') {
            player.inventory[itemIndex] = null;
        }
        
        console.log(`Player ${player.name} dropped most valuable item: ${mostValuableItem.name} (value: ${mostValuableValue})`);
        return mostValuableItem;
    }
    
    return null;
}

module.exports = {
    generateDeathMessage,
    savePlayerData,
    loadPlayerData,
    deletePlayerData,
    dropMostValuableItem,
    PLAYER_DATA_DIR
};
