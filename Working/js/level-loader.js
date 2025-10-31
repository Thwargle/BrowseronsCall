const fs = require('fs');
const path = require('path');

class LevelLoader {
    constructor() {
        this.levelsDirectory = path.join(__dirname, '..', 'levels');
        this.currentLevel = null;
        this.ensureLevelsDirectory();
    }
    
    ensureLevelsDirectory() {
        if (!fs.existsSync(this.levelsDirectory)) {
            fs.mkdirSync(this.levelsDirectory, { recursive: true });
            console.log('Created levels directory:', this.levelsDirectory);
        }
    }
    
    loadLevel(levelName) {
        try {
            const levelPath = path.join(this.levelsDirectory, `${levelName}.json`);
            
            if (!fs.existsSync(levelPath)) {
                console.log(`Level file not found: ${levelPath}`);
                return this.getDefaultLevel();
            }
            
            const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
            this.currentLevel = levelData;
            
            console.log(`Loaded level: ${levelData.name}`);
            console.log(`- Floors: ${levelData.floors.length}`);
            console.log(`- Vendors: ${levelData.vendors.length}`);
            console.log(`- Spawners: ${levelData.spawners.length}`);
            
            return levelData;
        } catch (error) {
            console.error('Error loading level:', error);
            return this.getDefaultLevel();
        }
    }
    
    getDefaultLevel() {
        return {
            name: 'Default Level',
            width: 3600,
            height: 600,
            floors: [
                { x: 0, y: 550, width: 3600, height: 50, material: 'dirt' }
            ],
            vendors: [
                { 
                    id: 'vendor_1', 
                    name: 'Merchant', 
                    x: 600, 
                    y: 200, 
                    width: 48, 
                    height: 64 
                }
            ],
            spawners: [
                { 
                    id: 'sp_1', 
                    x: 2600, 
                    y: 486, 
                    type: 'basic', 
                    respawnTime: 5000, 
                    visibilityRange: 400, 
                    minLevel: 1, 
                    maxLevel: 3,
                    currentEnemyId: null, 
                    respawnAt: Date.now() + 5000 
                },
                { 
                    id: 'sp_2', 
                    x: 3000, 
                    y: 486, 
                    type: 'elite', 
                    respawnTime: 8000, 
                    visibilityRange: 400, 
                    minLevel: 2, 
                    maxLevel: 4,
                    currentEnemyId: null, 
                    respawnAt: Date.now() + 8000 
                },
                { 
                    id: 'sp_3', 
                    x: 3300, 
                    y: 486, 
                    type: 'elite', 
                    respawnTime: 12000, 
                    visibilityRange: 400, 
                    minLevel: 3, 
                    maxLevel: 5,
                    currentEnemyId: null, 
                    respawnAt: Date.now() + 12000 
                },
                { 
                    id: 'sp_4', 
                    x: 3500, 
                    y: 486, 
                    type: 'boss', 
                    respawnTime: 15000, 
                    visibilityRange: 500, 
                    minLevel: 4, 
                    maxLevel: 6,
                    currentEnemyId: null, 
                    respawnAt: Date.now() + 15000 
                },
                { 
                    id: 'sp_5', 
                    x: 2800, 
                    y: 486, 
                    type: 'spellcaster', 
                    respawnTime: 10000, 
                    visibilityRange: 500, 
                    minLevel: 2, 
                    maxLevel: 4,
                    currentEnemyId: null, 
                    respawnAt: Date.now() + 10000 
                }
            ],
            portals: [
                {
                    id: 'portal_1',
                    x: 3550,
                    y: 486,
                    width: 64,
                    height: 64,
                    targetLevel: 'sample_level'
                }
            ]
        };
    }
    
    getCurrentLevel() {
        return this.currentLevel;
    }
    
    listAvailableLevels() {
        try {
            const files = fs.readdirSync(this.levelsDirectory);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
        } catch (error) {
            console.error('Error listing levels:', error);
            return [];
        }
    }
    
    saveLevel(levelData) {
        try {
            const levelPath = path.join(this.levelsDirectory, `${levelData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
            fs.writeFileSync(levelPath, JSON.stringify(levelData, null, 2));
            console.log(`Level saved: ${levelPath}`);
            return true;
        } catch (error) {
            console.error('Error saving level:', error);
            return false;
        }
    }
    
    // Convert level data to game state format
    applyLevelToGameState(gameState, levelData) {
        // Clear existing data
        gameState.worldDrops = [];
        gameState.enemies = [];
        gameState.nextEnemyId = 1;
        
        // Apply vendor data
        if (levelData.vendors && levelData.vendors.length > 0) {
            const vendor = levelData.vendors[0]; // Use first vendor
            gameState.vendor = {
                id: vendor.id,
                x: vendor.x,
                y: vendor.y,
                w: vendor.width,
                h: vendor.height,
                vy: 0,
                colors: this.generateNPCColors()
            };
        }
        
        // Apply spawner data
        if (levelData.spawners && levelData.spawners.length > 0) {
            gameState.spawners = levelData.spawners.map(spawner => ({
                id: spawner.id,
                x: spawner.x,
                y: spawner.y,
                currentEnemyId: spawner.currentEnemyId,
                respawnAt: spawner.respawnAt,
                visibilityRange: spawner.visibilityRange,
                type: spawner.type,
                minLevel: spawner.minLevel,
                maxLevel: spawner.maxLevel,
                respawnTime: spawner.respawnTime
            }));
        }
        
        // Apply portal data
        if (levelData.portals && levelData.portals.length > 0) {
            gameState.portals = levelData.portals.map(portal => ({
                id: portal.id,
                x: portal.x,
                y: portal.y,
                w: portal.width,
                h: portal.height,
                targetLevel: portal.targetLevel
            }));
        }
        
        console.log('Applied level data to game state');
    }
    
    // Generate NPC colors (moved from enemy.js for level loader)
    generateNPCColors() {
        const shirtColors = ['#696969', '#556b2f', '#8b4513', '#2f4f4f', '#228b22'];
        const pantColors = ['#2f4f4f', '#cd853f', '#8b4513', '#228b22', '#696969'];
        const beltColors = ['#228b22', '#8b4513', '#2f4f4f', '#696969', '#cd853f'];
        const accessoryColors = ['#ee82ee', '#ff8c00', '#ff6347', '#20b2aa', '#9370db'];
        
        return {
            shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
            pants: pantColors[Math.floor(Math.random() * pantColors.length)],
            belt: beltColors[Math.floor(Math.random() * beltColors.length)],
            accessory: accessoryColors[Math.floor(Math.random() * accessoryColors.length)]
        };
    }
    
    // Get level information for client
    getLevelInfo() {
        if (!this.currentLevel) {
            return null;
        }
        
        return {
            name: this.currentLevel.name,
            width: this.currentLevel.width,
            height: this.currentLevel.height,
            floors: this.currentLevel.floors,
            vendors: this.currentLevel.vendors,
            spawners: this.currentLevel.spawners
        };
    }
}

module.exports = LevelLoader;
