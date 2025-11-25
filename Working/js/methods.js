// methods.js — utilities, items, physics, sprites, entities
(function(){
'use strict';

const DROP_PICKUP_DELAY_MS = 800;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
window.VIEW_W = canvas.width; 
window.VIEW_H = canvas.height;
window.cameraX = 0; 
window.WORLD_W = 3600; // wide world
window.GRAV = 1500;

window.log = function(msg){ 
    const el=document.getElementById('log'); 
    if(el){ 
        // Create new message div
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `${new Date().toLocaleTimeString()} - ${msg}`;
        
        // Add to the beginning of the log (newest messages at top)
        el.insertBefore(messageDiv, el.firstChild);
        
        // Auto-scroll to show the newest message (at top)
        el.scrollTop = 0;
        
        // Limit the number of messages to prevent memory issues
        const maxMessages = 50;
        while (el.children.length > maxMessages) {
            el.removeChild(el.lastChild);
        }
        
        // Update scrollbars after log update
        if (typeof window.managePanelScrollbars === 'function') {
            try {
                setTimeout(() => window.managePanelScrollbars(), 10);
            } catch (error) {
                // Silently handle scrollbar update errors
            }
        }
    } 
}

function randInt(a,b){
    return Math.floor(Math.random()*(b-a+1))+a;
}

function clamp(v,a,b){
    return Math.max(a,Math.min(b,v));
}

window.randInt=randInt; 
window.clamp=clamp;

// platforms
window.platforms = [
    {x:0,y:550,w:WORLD_W,h:50},
    {x:220,y:430,w:200,h:24},{x:520,y:360,w:160,h:24},{x:760,y:480,w:160,h:24},
    {x:1100,y:420,w:220,h:24},{x:1450,y:360,w:220,h:24},{x:1820,y:300,w:180,h:24},
    {x:2100,y:460,w:180,h:24},{x:2400,y:380,w:220,h:24},{x:2800,y:320,w:180,h:24}
];

// vendor placement not on platforms
window.placeVendor=function(){ 
    const v={x:0,y:0,w:48,h:64,anim:{timer:0,index:0}}; 
    let tries=0; 
    while(tries++<50){ 
        v.x = randInt(200, WORLD_W-200); 
        // Spawn vendor above ground level and let gravity handle the rest
        v.y = 200; // Spawn well above ground level
        let bad=false; 
        for(const p of platforms){ 
            if(v.x+v.w>p.x && v.x<p.x+p.w && v.y+v.h>p.y && v.y<p.y+p.h){ 
                bad=true; 
                break; 
            } 
        } 
        if(!bad) return v; 
    } 
    // Fallback position - spawn above ground
    return {x:100,y:200,w:48,h:64,anim:{timer:0,index:0}}; 
}

// naming / rarities
window.RARITIES=['Common','Uncommon','Rare','Epic','Legendary'];
window.RARITY_CLASS={ 'Common':'r-common','Uncommon':'r-uncommon','Rare':'r-rare','Epic':'r-epic','Legendary':'r-legendary' };
window.STAT_NAMES=['Strength','Endurance','Quickness','Coordination','Focus','Health','Stamina','Mana'];
const namePrefixes=['Worn','Ancient','Copper','Iron','Glinting','Shadow','Brass','Elder'];
// Updated weapon names with better distribution across damage types
const weaponNames=[
    // Slashing
    'Blade','Sword','Axe','Saber','Katana','Battleaxe','Halberd','Scimitar','Longsword','Greatsword',
    // Bludgeoning
    'Mace','Hammer','Warhammer','Club','Maul','Flail',
    // Piercing
    'Dagger','Spear','Rapier','Bow','Crossbow','Javelin','Trident',
    // Magic
    'Staff','Wand'
];
window.armorSlotName={ head:['Helmet','Cap','Helm','Crown','Circlet'], chest:['Cuirass','Chestplate','Tunic','Robe','Vest'], legs:['Greaves','Leggings','Pants','Chausses','Breeches'], feet:['Boots','Sabatons','Shoes','Sandals','Greaves'], hands:['Gauntlets','Gloves','Mittens'], wrists:['Bracers','Wristguards','Vambraces'], waist:['Belt','Girdle','Sash'], neck:['Amulet','Pendant','Collar'], shoulders:['Pauldrons','Shoulderpads','Mantle'] };
const nameSuffixes=['of Healing','of Quickness','of Might','of Focus','of the Fox','of Fortitude','of Sparks'];
window.weaponKindFromName=function(name){ 
    if(!name) return null; 
    const n=name.toLowerCase(); 
    // Check in order of specificity (longer/more specific names first)
    if(n.includes('warhammer')) return 'Warhammer'; 
    if(n.includes('battleaxe')) return 'Battleaxe'; 
    if(n.includes('crossbow')) return 'Crossbow'; 
    if(n.includes('longsword')) return 'Longsword';
    if(n.includes('greatsword')) return 'Greatsword';
    if(n.includes('scimitar')) return 'Scimitar';
    if(n.includes('halberd')) return 'Halberd'; 
    if(n.includes('blade')) return 'Blade'; 
    if(n.includes('sword')) return 'Sword'; 
    if(n.includes('dagger')) return 'Dagger'; 
    if(n.includes('axe')) return 'Axe'; 
    if(n.includes('saber')) return 'Saber'; 
    if(n.includes('mace')) return 'Mace'; 
    if(n.includes('spear')) return 'Spear'; 
    if(n.includes('hammer')) return 'Hammer'; 
    if(n.includes('bow')) return 'Bow'; 
    if(n.includes('staff')) return 'Staff'; 
    if(n.includes('wand')) return 'Wand'; 
    if(n.includes('katana')) return 'Katana'; 
    if(n.includes('rapier')) return 'Rapier'; 
    if(n.includes('club')) return 'Club';
    if(n.includes('maul')) return 'Maul';
    if(n.includes('flail')) return 'Flail';
    if(n.includes('javelin')) return 'Javelin';
    if(n.includes('trident')) return 'Trident';
    if(n.includes('pike')) return 'Pike';
    return null; 
}

// Check if a weapon is two-handed (client-side version)
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

window.checkIfTwoHanded = function(itemOrName) {
    if (!itemOrName) return false;
    
    // If it's a string, check directly
    if (typeof itemOrName === 'string') {
        return TWO_HANDED_WEAPON_TYPES.includes(itemOrName);
    }
    
    // If it's an item object, check properties
    if (itemOrName.twoHanded !== undefined) {
        return itemOrName.twoHanded === true;
    }
    
    if (itemOrName.subtype) {
        return TWO_HANDED_WEAPON_TYPES.includes(itemOrName.subtype);
    }
    
    if (itemOrName.name) {
        const weaponKind = window.weaponKindFromName(itemOrName.name);
        if (weaponKind) {
            return TWO_HANDED_WEAPON_TYPES.includes(weaponKind);
        }
    }
    
    return false;
};

// icon painter
const ICON_CACHE=new Map(), ICON_IMG_CACHE=new Map();

// Weapon image cache
const WEAPON_IMAGE_CACHE = new Map();
const WAND_IMAGE_CACHE = new Map();
const WEAPON_SPRITE_CACHE = new Map();

const WEAPON_IMAGE_VARIANTS = {
    'Sword': ['Sword_1', 'Sword_2', 'Sword_3', 'Sword_4', 'Sword_5', 'Sword_6'],
    'Longsword': ['Sword_8', 'Sword_9', 'Sword_10', 'Sword_12'],
    'Rapier': ['Sword_7'],
    'Saber': ['Sword_11', 'Sword_13'],
    'Scimitar': ['Sword_14'],
    'Axe': ['Axe'],
    'Mace': ['Mace_1', 'Mace_2', 'Mace_3'],
    'Club': ['Mace_2'],
    'Hammer': ['Hammer_1', 'Hammer_2'],
    'Warhammer': ['Hammer_1', 'Hammer_2'],
    'Maul': ['Hammer_1', 'Hammer_2'],
    'Dagger': ['Dagger_1', 'Dagger_2', 'Dagger_3', 'Dagger_4', 'Dagger_5'],
    'Bow': ['Bow_1', 'Bow_2', 'Bow_3', 'Bow_4'],
    'Spear': ['Shovel', 'Spear_2', 'Spear_3', 'Spear_4'],
    'Halberd': ['Spear_1'],
    'Javelin': ['Spear_4'],
    'Trident': ['Spear_5'],
    'Pike': ['Spear_2']
};

const WEAPON_TYPE_FALLBACKS = {
    'Blade': 'Sword',
    'Greatsword': 'Sword',
    'Katana': 'Sword',
    'Battleaxe': 'Axe',
    'Flail': 'Mace',
    'Crossbow': 'Bow',
    'Staff': 'Wand'
};

const WAND_RARITY_VARIANTS = {
    'Common': ['Blue_1', 'Blue_2', 'Blue_3', 'Blue_4', 'Green_1', 'Green_2', 'Green_3', 'Green_4', 'Red_1', 'Red_2', 'Red_3', 'Red_4'],
    'Uncommon': ['Blue_5', 'Blue_6', 'Blue_7', 'Blue_8', 'Green_5', 'Green_6', 'Green_7', 'Green_8', 'Red_5', 'Red_6', 'Red_7', 'Red_8'],
    'Rare': ['Blue_9', 'Blue_10', 'Blue_11', 'Green_9', 'Green_10', 'Green_11', 'Red_9', 'Red_10', 'Red_11'],
    'Epic': ['Blue_12', 'Green_12', 'Red_12'],
    'Legendary': ['Blue_13', 'Green_13', 'Red_13']
};

function resolveWeaponVariants(type, seen = new Set()) {
    if (!type) return WEAPON_IMAGE_VARIANTS['Sword'];
    if (WEAPON_IMAGE_VARIANTS[type]) return WEAPON_IMAGE_VARIANTS[type];
    if (seen.has(type)) return WEAPON_IMAGE_VARIANTS['Sword'];
    seen.add(type);
    const fallback = WEAPON_TYPE_FALLBACKS[type];
    if (fallback) {
        return resolveWeaponVariants(fallback, seen);
    }
    return WEAPON_IMAGE_VARIANTS['Sword'];
}

function getWandVariants(rarity) {
    return WAND_RARITY_VARIANTS[rarity] || WAND_RARITY_VARIANTS['Common'];
}

function loadWeaponImage(weaponType, item = null) {
    let variantNum = 1;
    let variantHash = 0;
    
    if (item && typeof item === 'object') {
        variantNum = item.level || 1;
        if (item.name) {
            for (let i = 0; i < item.name.length; i++) {
                variantHash += item.name.charCodeAt(i);
            }
        }
    } else if (typeof item === 'number') {
        variantNum = item;
    }
    
    const cacheKey = `${weaponType}_${variantNum}_${variantHash}`;
    
    if (WEAPON_IMAGE_CACHE.has(cacheKey)) {
        const cached = WEAPON_IMAGE_CACHE.get(cacheKey);
        if (cached && cached.complete && cached.naturalWidth > 0) {
            return cached;
        }
    }
    
    const variantSeed = Math.abs(variantNum + variantHash);
    const weaponTypeString = (typeof weaponType === 'string' && weaponType.trim().length) ? weaponType.trim() : '';
    const subtype = item && typeof item === 'object' && item.subtype ? item.subtype.trim() : '';
    const normalizedType = weaponTypeString || subtype || 'Sword';
    const treatAsWand = normalizedType === 'Wand' || normalizedType === 'Staff' || subtype === 'Wand' || subtype === 'Staff';
    let imagePath = '';
    
    const getCachedSprite = () => {
        // First check if item already has sprite stored
        if (item && item.weaponSprite) {
            return { fileName: item.weaponSprite, isWand: item.weaponSpriteType === 'wand' };
        }
        // Then check cache by item ID and restore to item if found
        if (item && item.id && WEAPON_SPRITE_CACHE.has(item.id)) {
            const cached = WEAPON_SPRITE_CACHE.get(item.id);
            // Restore sprite to item object for consistency
            if (item && typeof item === 'object') {
                item.weaponSprite = cached.fileName;
                item.weaponSpriteType = cached.isWand ? 'wand' : 'weapon';
            }
            return cached;
        }
        return null;
    };
    
    let spriteInfo = getCachedSprite();
    
    if (!spriteInfo) {
        const variants = treatAsWand ? getWandVariants(item && typeof item === 'object' && item.rarity ? item.rarity : 'Common')
            : resolveWeaponVariants(normalizedType);
        
        // For wands, use a better randomization to ensure all color variants (Blue, Green, Red) are available
        let variantIndex;
        if (treatAsWand) {
            // Use the random part of item ID for well-distributed variant selection
            // Item IDs are like: "weapon-1234567890-abc123xyz" where the last part is a base-36 random string
            let wandSeed = 0;
            if (item && item.id) {
                const idParts = item.id.split('-');
                // The last part is the random alphanumeric string generated with Math.random().toString(36)
                // Parse it as a base-36 number for direct, well-distributed seed
                if (idParts.length > 0) {
                    const randomPart = idParts[idParts.length - 1];
                    if (randomPart && randomPart.length > 0) {
                        try {
                            // Parse the base-36 string directly - this gives us the random value
                            // that was used to generate it, providing excellent distribution
                            wandSeed = parseInt(randomPart, 36);
                        } catch (e) {
                            // Fallback: convert character by character if parseInt fails
                            for (let i = 0; i < randomPart.length; i++) {
                                const char = randomPart[i];
                                const charValue = /[0-9]/.test(char) ? parseInt(char, 10) : 
                                                 /[a-z]/.test(char) ? char.charCodeAt(0) - 87 : 0;
                                wandSeed = wandSeed * 36 + charValue;
                            }
                        }
                    }
                }
                // Add timestamp for additional variation (use last few digits to avoid overflow)
                if (idParts.length > 1) {
                    const timestampPart = idParts[idParts.length - 2];
                    if (timestampPart && /^\d+$/.test(timestampPart)) {
                        const timestamp = parseInt(timestampPart, 10);
                        // Use last 6 digits of timestamp to add variation without overflow
                        wandSeed = wandSeed + (timestamp % 1000000);
                    }
                }
            }
            // Use the seed to select variant - should give excellent distribution
            variantIndex = variants.length ? Math.abs(wandSeed) % variants.length : 0;
        } else {
            variantIndex = variants.length ? variantSeed % variants.length : 0;
        }
        
        const variantName = variants[variantIndex] || variants[0];
        const fileName = variantName.endsWith('.png') ? variantName : `${variantName}.png`;
        spriteInfo = { fileName, isWand: treatAsWand };
        if (item && typeof item === 'object') {
            item.weaponSprite = fileName;
            item.weaponSpriteType = treatAsWand ? 'wand' : 'weapon';
            if (item.id) {
                WEAPON_SPRITE_CACHE.set(item.id, spriteInfo);
            }
        }
    }
    
    if (spriteInfo.isWand) {
        imagePath = `assets/Wands/${spriteInfo.fileName}`;
    } else {
        imagePath = `assets/Weapons/${spriteInfo.fileName}`;
    }
    
    const img = new Image();
    img.src = imagePath;
    img.onerror = () => {
        WEAPON_IMAGE_CACHE.set(cacheKey, null);
    };
    WEAPON_IMAGE_CACHE.set(cacheKey, img);
    WAND_IMAGE_CACHE.set(cacheKey, img);
    return img;
}

// Expose loadWeaponImage on window for use in other modules
window.loadWeaponImage = loadWeaponImage;

function preloadWeaponImages() {
    Object.keys(WEAPON_IMAGE_VARIANTS).forEach(type => {
        const variants = WEAPON_IMAGE_VARIANTS[type];
        variants.forEach((_, idx) => {
            loadWeaponImage(type, { level: idx + 1, name: `${type}_${idx}`, subtype: type });
        });
    });
    
    Object.keys(WAND_RARITY_VARIANTS).forEach((rarity, idx) => {
        loadWeaponImage('Wand', { level: idx + 1, name: `Wand_${rarity}_${idx}`, rarity, subtype: 'Wand' });
    });
}

// Initialize weapon image preloading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadWeaponImages);
} else {
    preloadWeaponImages();
}
function metal(rarity = 'Common'){ 
    // Standard metal color (not rarity-based)
    return {base:'#d5dceb',edge:'#9eb0c8',hi:'#edf1f8'}; // Silver metal
}

// Get weapon color based on elemental type
function getWeaponColor(elementalType) {
    if (!elementalType) {
        return {base:'#d5dceb',edge:'#9eb0c8',hi:'#edf1f8'}; // Default silver
    }
    
    switch(elementalType) {
        case 'Fire':
            return {base:'#ff6347',edge:'#ff4500',hi:'#ffd700'}; // Red-orange with gold highlights
        case 'Acid':
            return {base:'#32cd32',edge:'#228b22',hi:'#90ee90'}; // Green
        case 'Lightning':
            return {base:'#87ceeb',edge:'#4682b4',hi:'#ffffff'}; // Sky blue with white highlights
        case 'Frost':
            return {base:'#b0e0e6',edge:'#4682b4',hi:'#e0f6ff'}; // Light blue/cyan
        default:
            return {base:'#d5dceb',edge:'#9eb0c8',hi:'#edf1f8'}; // Default silver
    }
}
function leather(){ return {base:'#a57544',edge:'#6b4423',hi:'#c9925f'}; }
function cloth(){ return {base:'#6ea2d6',edge:'#3d688d',hi:'#9bc4ed'}; }
function special(){ return {base:'#8b5cf6',edge:'#6d28d9',hi:'#a78bfa'}; }
function dragonhide(){ return {base:'#dc2626',edge:'#991b1b',hi:'#ef4444'}; }
function shadowweave(){ return {base:'#1f2937',edge:'#111827',hi:'#374151'}; }
function celestial(){ return {base:'#fbbf24',edge:'#d97706',hi:'#fcd34d'}; }
function voidTouched(){ return {base:'#7c3aed',edge:'#5b21b6',hi:'#a78bfa'}; }
function rarityFrame(g,rar){ 
    if(rar==='Legendary') g.fillStyle = '#ff9a1c';
    else if(rar==='Epic') g.fillStyle = '#b37bff';
    else if(rar==='Rare') g.fillStyle = '#3da5ff'; // Blue for Rare
    else if(rar==='Uncommon') g.fillStyle = '#4caf50'; // Green for Uncommon
    else g.fillStyle = '#ffffff'; // Common - white
    g.fillRect(0,0,64,64); 
}
function shade(g,x,y,w,h,base,edge){ g.fillStyle=base; g.fillRect(x,y,w,h); g.fillStyle=edge; g.fillRect(x,y,w,2); g.fillRect(x,y,2,h); }
function outline(g,x,y,w,h,color){ g.strokeStyle=color; g.lineWidth=2; g.strokeRect(x+0.5,y+0.5,w-1,h-1); }
function drawIcon(it){ 

    
    if (!it) {
        console.error(`[${Date.now()}] drawIcon called with null/undefined item`);
        return '';
    }
    
    try {
        const c=document.createElement('canvas'); 
        c.width=64;c.height=64; 
        const g=c.getContext('2d'); 
        
        if (!g) {
            console.error(`[${Date.now()}] Failed to get 2D context from canvas`);
            return '';
        }
        
        g.imageSmoothingEnabled=false; 
        rarityFrame(g,it.rarity||'Common'); 
        g.fillStyle='#081018'; 
        g.fillRect(4,4,56,56); 
        const r=it.rarity||'Common';
        
        let usedPlaceholder = false;
        
        if(it.type==='weapon'){
            const kind=weaponKindFromName(it.name)||it.subtype||'melee'; 
            
            // Try to use weapon image for icon
            const weaponImg = loadWeaponImage(kind, it);
            let imageDrawn = false;
            
            if (weaponImg && weaponImg.complete && weaponImg.naturalWidth > 0) {
                // Draw weapon image scaled to fit icon (64x64 with 4px padding = 56x56)
                const imgWidth = weaponImg.naturalWidth;
                const imgHeight = weaponImg.naturalHeight;
                const maxDim = Math.max(imgWidth, imgHeight);
                const scale = 48 / maxDim; // Scale to fit in 48x48 area (with some padding)
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;
                
                // Center the image in the icon
                const iconX = 32 - scaledWidth / 2;
                const iconY = 32 - scaledHeight / 2;
                g.drawImage(weaponImg, iconX, iconY, scaledWidth, scaledHeight);
                imageDrawn = true;
            } else if (weaponImg && !weaponImg.complete && typeof window !== 'undefined') {
                const scheduleRefresh = () => {
                    if (window._iconRefreshScheduled) return;
                    window._iconRefreshScheduled = true;
                    setTimeout(() => {
                        window._iconRefreshScheduled = false;
                        if (typeof window.displayInventoryItems === 'function') {
                            window.displayInventoryItems();
                        } else if (typeof window.refreshInventoryUI === 'function') {
                            window.refreshInventoryUI();
                        }
                    }, 0);
                };
                weaponImg.addEventListener('load', () => scheduleRefresh(), { once: true });
                weaponImg.addEventListener('error', () => scheduleRefresh(), { once: true });
            }
            
            // Fallback to rectangle drawing if image not available
            if (!imageDrawn) {
                usedPlaceholder = true;
                // Use elemental color instead of rarity
                const elementalType = it.elementalDamageType;
                const m = getWeaponColor(elementalType);
                if(kind==='Blade'){ shade(g,30,10,6,40,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,12,2,36); g.fillStyle=m.base; g.fillRect(24,40,18,4); g.fillRect(28,36,10,4); outline(g,22,8,20,46,'#1b2430'); }
                else if(kind==='Sword'){ shade(g,30,16,6,30,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,18,2,26); g.fillStyle=m.base; g.fillRect(26,40,14,4); g.fillRect(29,36,8,4); outline(g,24,14,18,34,'#1b2430'); }
                else if(kind==='Dagger'){ shade(g,32,22,4,18,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(33,24,2,14); g.fillStyle=m.base; g.fillRect(28,36,12,4); outline(g,26,20,20,22,'#1b2430'); }
                else if(kind==='Axe'){ shade(g,30,20,6,26,m.base,m.edge); g.fillStyle=m.base; g.fillRect(18,18,18,12); g.fillRect(20,30,16,8); g.fillStyle=m.hi; g.fillRect(20,20,8,2); outline(g,16,16,24,24,'#1b2430'); }
                else if(kind==='Saber'){ shade(g,30,14,6,34,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,16,2,30); g.fillStyle=m.base; g.fillRect(24,40,18,3); outline(g,22,12,22,36,'#1b2430'); }
                else if(kind==='Mace'){ shade(g,30,18,6,28,m.base,m.edge); g.fillStyle=m.hi; g.beginPath(); g.arc(33,16,6,0,Math.PI*2); g.fill(); outline(g,24,12,18,36,'#1b2430'); }
                else if(kind==='Spear'){ shade(g,30,10,6,40,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,12,2,36); g.beginPath(); g.moveTo(33,6); g.lineTo(40,14); g.lineTo(26,14); g.closePath(); g.fill(); outline(g,24,8,18,44,'#1b2430'); }
                else if(kind==='Hammer'){ shade(g,30,18,6,28,m.base,m.edge); g.fillStyle=m.hi; g.beginPath(); g.arc(33,16,6,0,Math.PI*2); g.fill(); g.fillStyle=m.base; g.fillRect(28,40,10,4); outline(g,24,12,18,36,'#1b2430'); }
                else if(kind==='Bow'){ shade(g,30,16,6,30,m.base,m.edge); g.fillStyle=m.hi; g.beginPath(); g.arc(33,16,12,0,Math.PI*2); g.stroke(); g.fillStyle=m.base; g.fillRect(24,40,18,4); outline(g,22,12,22,36,'#1b2430'); }
                else if(kind==='Crossbow'){ shade(g,30,16,6,30,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,18,2,26); g.fillStyle=m.base; g.fillRect(18,40,28,4); g.fillRect(20,36,24,4); outline(g,16,12,28,36,'#1b2430'); }
                else if(kind==='Staff'){ shade(g,30,10,6,40,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,12,2,36); g.fillStyle=m.base; g.fillRect(24,40,18,4); g.fillRect(28,36,10,4); outline(g,22,8,20,46,'#1b2430'); }
                else if(kind==='Wand'){ shade(g,32,20,4,20,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(33,22,2,16); g.fillStyle=m.base; g.fillRect(28,40,12,4); outline(g,26,18,20,26,'#1b2430'); }
                else if(kind==='Katana'){ shade(g,30,14,6,34,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,16,2,30); g.fillStyle=m.base; g.fillRect(24,40,18,3); outline(g,22,12,22,36,'#1b2430'); }
                else if(kind==='Rapier'){ shade(g,30,14,6,34,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,16,2,30); g.fillStyle=m.base; g.fillRect(24,40,18,3); outline(g,22,12,22,36,'#1b2430'); }
                else if(kind==='Warhammer'){ shade(g,30,18,6,28,m.base,m.edge); g.fillStyle=m.hi; g.beginPath(); g.arc(33,16,6,0,Math.PI*2); g.fill(); g.fillStyle=m.base; g.fillRect(28,40,10,4); outline(g,24,12,18,36,'#1b2430'); }
                else if(kind==='Battleaxe'){ shade(g,30,20,6,26,m.base,m.edge); g.fillStyle=m.base; g.fillRect(18,18,18,12); g.fillRect(20,30,16,8); g.fillStyle=m.hi; g.fillRect(20,20,8,2); outline(g,16,16,24,24,'#1b2430'); }
                else if(kind==='Halberd'){ shade(g,30,10,6,40,m.base,m.edge); g.fillStyle=m.hi; g.fillRect(32,12,2,36); g.fillStyle=m.base; g.fillRect(18,40,28,4); g.fillRect(20,36,24,4); outline(g,16,8,28,44,'#1b2430'); }
                else { shade(g,30,14,6,34,m.base,m.edge); outline(g,24,12,18,38,'#1b2430'); }
            }
        } else if(it.type==='armor'){
            const slot=it.slot; 
            // Determine material based on name
            const nm=(it.name||'').toLowerCase();
            let material = 'metal';
            let materialFunc = metal;
            if(nm.includes('leather') || nm.includes('hide')) { material = 'leather'; materialFunc = leather; }
            else if(nm.includes('cloth') || nm.includes('silk') || nm.includes('robe')) { material = 'cloth'; materialFunc = cloth; }
            else if(nm.includes('dragonhide')) { material = 'dragonhide'; materialFunc = dragonhide; }
            else if(nm.includes('shadowweave')) { material = 'shadowweave'; materialFunc = shadowweave; }
            else if(nm.includes('celestial')) { material = 'celestial'; materialFunc = celestial; }
            else if(nm.includes('void-touched')) { material = 'voidTouched'; materialFunc = voidTouched; }
            
            if(slot==='head'){ 
                const style = nm.includes('helm')? 'helm' : nm.includes('cap')? 'cap' : nm.includes('crown')? 'crown' : nm.includes('circlet')? 'circlet' : 'hood'; 
                if(style==='helm'){ 
                    const m=metal(r); 
                    shade(g,22,14,20,12,m.base,m.edge); 
                    g.fillStyle=m.hi; 
                    g.fillRect(28,16,8,2); 
                    g.fillStyle=m.base; 
                    g.fillRect(18,26,28,18); 
                    g.fillStyle='#111'; 
                    g.fillRect(22,22,4,4); 
                    g.fillRect(36,22,4,4); 
                    outline(g,18,14,28,30,'#1b2430'); 
                } else if(style==='cap'){ 
                    const l=leather(r); 
                    shade(g,20,18,24,10,l.base,l.edge); 
                    g.fillStyle=l.hi; 
                    g.fillRect(22,20,20,2); 
                    g.fillStyle=l.base; 
                    g.fillRect(20,28,24,14); 
                    outline(g,18,16,28,28,'#1b2430'); 
                } else if(style==='crown'){ 
                    const m=metal(r); 
                    shade(g,20,16,28,8,m.base,m.edge); 
                    g.fillStyle=m.hi; 
                    g.fillRect(22,18,24,2); 
                    g.fillStyle=m.base; 
                    g.fillRect(20,24,28,20); 
                    outline(g,18,14,28,30,'#1b2430'); 
                } else if(style==='circlet'){ 
                    const m=metal(r); 
                    shade(g,20,18,28,6,m.base,m.edge); 
                    g.fillStyle=m.hi; 
                    g.fillRect(22,20,24,2); 
                    g.fillStyle=m.base; 
                    g.fillRect(20,24,28,20); 
                    outline(g,18,16,28,26,'#1b2430'); 
                } else { 
                    const ccol=cloth(r); 
                    shade(g,18,16,28,12,ccol.base,ccol.edge); 
                    g.fillStyle=ccol.hi; 
                    g.fillRect(20,18,24,2); 
                    g.fillStyle=ccol.base; 
                    g.fillRect(20,28,24,18); 
                    outline(g,18,14,28,32,'#1b2430'); 
                } 
            }
            else if(slot==='chest'){ 
                const m=materialFunc(r); 
                shade(g,20,20,24,22,m.base,m.edge); 
                g.fillStyle=m.hi; 
                g.fillRect(22,22,20,2); 
                g.fillStyle=m.base; 
                g.fillRect(24,42,16,10); 
                outline(g,18,18,28,36,'#1b2430'); 
            }
            else if(slot==='legs'){ 
                const m=materialFunc(r); 
                shade(g,24,34,8,20,m.base,m.edge); 
                shade(g,34,34,8,20,m.base,m.edge); 
                g.fillStyle=m.hi; 
                g.fillRect(26,36,4,2); 
                g.fillRect(36,36,4,2); 
                outline(g,22,32,22,24,'#1b2430'); 
            }
            else if(slot==='feet'){ 
                const m=materialFunc(r); 
                shade(g,20,46,10,8,m.base,m.edge); 
                shade(g,34,46,10,8,m.base,m.edge); 
                g.fillStyle=m.hi; 
                g.fillRect(22,48,6,2); 
                g.fillRect(36,48,6,2); 
                outline(g,18,44,28,12,'#1b2430'); 
            }
            else if(slot==='hands'){ 
                const m=materialFunc(r); 
                shade(g,18,28,10,8,m.base,m.edge); 
                shade(g,36,28,10,8,m.base,m.edge); 
                g.fillStyle=m.hi; 
                g.fillRect(20,30,6,2); 
                g.fillRect(38,30,6,2); 
                outline(g,16,26,30,14,'#1b2430'); 
            }
            else if(slot==='wrists'){ 
                const m=materialFunc(r); 
                shade(g,18,30,10,6,m.base,m.edge); 
                shade(g,36,30,10,6,m.base,m.edge); 
                outline(g,16,28,32,12,'#1b2430'); 
            }
            else if(slot==='waist'){ 
                const m=materialFunc(r); 
                shade(g,18,36,28,6,m.base,m.edge); 
                outline(g,16,34,32,10,'#1b2430'); 
            }
            else if(slot==='shoulders'){ 
                const m=materialFunc(r); 
                shade(g,16,22,12,8,m.base,m.edge); 
                shade(g,36,22,12,8,m.base,m.edge); 
                outline(g,14,20,36,12,'#1b2430'); 
            }
            else if(slot==='neck'){ 
                const m=materialFunc(r); 
                shade(g,26,24,12,8,m.base,m.edge); 
                outline(g,24,22,16,12,'#1b2430'); 
            }
        } else if(it.type==='currency'){
            g.fillStyle='#e7c76b'; g.beginPath(); g.arc(32,32,14,0,Math.PI*2); g.fill(); g.fillStyle='#b4932c'; g.fillRect(18,28,28,4); g.fillRect(20,36,24,4); outline(g,16,18,32,32,'#1b2430');
        }
        
        const dataURL = c.toDataURL();
    
        return { dataURL, placeholder: usedPlaceholder };
        
    } catch (error) {
        console.error(`[${Date.now()}] Error in drawIcon:`, error);
        return { dataURL: '', placeholder: true };
    }
}
function iconKey(it){ 
    if(!it || typeof it !== 'object' || !it.type || !it.rarity || !it.name) return 'empty'; 
    let base;
    if (it.type === 'armor') {
        base = it.slot || 'armor';
    } else if (it.type === 'weapon') {
        if (it.weaponSprite) {
            base = `sprite:${it.weaponSpriteType || 'weapon'}:${it.weaponSprite}`;
        } else {
            base = weaponKindFromName(it.name)||it.subtype||'melee';
        }
    } else {
        base = it.type;
    }
    const secondary = it.weaponSprite ? it.weaponSprite : (it.name||'').split(' ')[1]||'';
    return `${it.type}|${base}|${it.rarity}|${secondary}`;
}
window.getItemIconDataURLForItem=function(it){ 

    
    if (!it || typeof it !== 'object') {
        console.error(`[${Date.now()}] getItemIconDataURLForItem called with invalid item:`, it);
        return '';
    }
    
    if (!it.id || !it.name) {
        console.error(`[${Date.now()}] getItemIconDataURLForItem called with incomplete item:`, it);
        return '';
    }
    
    try {
        const key=iconKey(it); 

        
        if(ICON_CACHE.has(key)) {

            return ICON_CACHE.get(key); 
        }
        

        const { dataURL, placeholder } = drawIcon(it); 

        
        if (!placeholder && dataURL) {
            ICON_CACHE.set(key,dataURL); 
        } else {
            ICON_CACHE.delete(key);
        }
        return dataURL; 
    } catch (error) {
        console.error(`[${Date.now()}] Error in getItemIconDataURLForItem:`, error);
        return '';
    }
}
window.getIconImg=function(it){ 
    if (!it || typeof it !== 'object' || !it.id || !it.name) {
        console.error(`[${Date.now()}] getIconImg called with invalid item:`, it);
        return null;
    }
    const key=iconKey(it); 
    if(ICON_IMG_CACHE.has(key)) return ICON_IMG_CACHE.get(key); 
    const img=new Image(); 
    img.src=getItemIconDataURLForItem(it); 
    ICON_IMG_CACHE.set(key,img); 
    return img; 
}

// items
function computeItemValue(level, rarity, stats){ const base = Math.max(1, level*12); const statSum = Object.values(stats).reduce((a,b)=>a+b,0); const rarityMult = rarity==='Legendary'?7:rarity==='Epic'?3:rarity==='Uncommon'?1.5:1.0; return Math.round((base + statSum*4) * rarityMult); }
window.computeItemValue=computeItemValue;
window.randId=function(){return Math.random().toString(36).slice(2,9)}

// Helper function to determine damage type from weapon subtype
function determinePhysicalDamageTypeFromSubtype(subtype) {
    if (!subtype) return 'Slashing';
    
    const subtypeUpper = subtype.charAt(0).toUpperCase() + subtype.slice(1).toLowerCase();
    
    // Bludgeoning weapons
    const bludgeoningWeapons = ['Mace', 'Hammer', 'Warhammer', 'Club', 'Maul', 'Flail'];
    if (bludgeoningWeapons.includes(subtypeUpper) || bludgeoningWeapons.some(w => subtype.toLowerCase().includes(w.toLowerCase()))) {
        return 'Bludgeoning';
    }
    // Piercing weapons
    const piercingWeapons = ['Dagger', 'Rapier', 'Spear', 'Bow', 'Crossbow', 'Javelin', 'Trident', 'Pike'];
    if (piercingWeapons.includes(subtypeUpper) || piercingWeapons.some(w => subtype.toLowerCase().includes(w.toLowerCase()))) {
        return 'Piercing';
    }
    // Default to slashing (includes Sword, Axe, Katana, Battleaxe, Halberd, Scimitar, Longsword, Greatsword, Staff, Wand, etc.)
    return 'Slashing';
}

// Normalize items to ensure consistent structure for both local and server items
window.normalizeItem = function(item) {
    if (!item) return null;
    
    // Start with a copy of the original item to preserve all properties (including locked and weaponSprite)
    const normalized = { ...item };
    
    // Preserve weaponSprite and weaponSpriteType if they exist - these must be consistent
    const existingWeaponSprite = item.weaponSprite;
    const existingWeaponSpriteType = item.weaponSpriteType;
    
    // Ensure all required properties exist (override if missing, but preserve existing values)
    normalized.id = normalized.id || window.randId();
    normalized.name = normalized.name || 'Unknown Item';
    normalized.type = normalized.type || 'unknown';
    normalized.rarity = normalized.rarity || 'Common';
    normalized.short = normalized.short || normalized.name || 'An item';
    normalized.value = normalized.value || 0;
    normalized.icon = normalized.icon || null; // Will be generated below if needed
    normalized.stats = normalized.stats || {};
    normalized.level = normalized.level || 1;
    // Preserve lock status explicitly - convert to boolean if needed
    // Handle string "true"/"false" cases and preserve boolean true
    if ('locked' in normalized) {
        if (normalized.locked === 'true' || normalized.locked === true) {
            normalized.locked = true;
        } else {
            normalized.locked = false;
        }
    } else {
        // Only set to false if property doesn't exist at all
        normalized.locked = false;
    }
    
    // Add type-specific properties
    if (item.type === 'weapon') {
        normalized.dmgMin = item.dmgMin || 1;
        normalized.dmgMax = item.dmgMax || 2;
        // Try to preserve subtype, or infer it from name
        normalized.subtype = item.subtype || window.weaponKindFromName(item.name);
        
        // Preserve damage types - prioritize existing physicalDamageType
        if (item.physicalDamageType) {
            normalized.physicalDamageType = item.physicalDamageType;
        } else if (normalized.subtype) {
            // Infer from subtype if physicalDamageType is missing
            const inferredType = determinePhysicalDamageTypeFromSubtype(normalized.subtype);
            normalized.physicalDamageType = inferredType;
            console.log(`[normalizeItem] Weapon "${item.name}" missing physicalDamageType, inferred ${inferredType} from subtype "${normalized.subtype}"`);
        } else if (item.name) {
            // Last resort: try to infer from name directly
            const weaponType = window.weaponKindFromName(item.name);
            if (weaponType) {
                normalized.subtype = weaponType;
                normalized.physicalDamageType = determinePhysicalDamageTypeFromSubtype(weaponType);
                console.log(`[normalizeItem] Weapon "${item.name}" inferred subtype "${weaponType}" and damage type "${normalized.physicalDamageType}" from name`);
            } else {
                normalized.physicalDamageType = 'Slashing'; // Absolute last resort
                console.warn(`[normalizeItem] Weapon "${item.name}" could not determine damage type, defaulting to Slashing`);
            }
        } else {
            normalized.physicalDamageType = 'Slashing'; // Absolute last resort
        }
        normalized.elementalDamageType = item.elementalDamageType !== undefined ? item.elementalDamageType : null;
        // Set twoHanded property if not already set
        if (normalized.twoHanded === undefined && normalized.subtype) {
            if (typeof window.checkIfTwoHanded === 'function') {
                normalized.twoHanded = window.checkIfTwoHanded(normalized.subtype);
            } else {
                // Fallback: check against known two-handed weapons
                normalized.twoHanded = TWO_HANDED_WEAPON_TYPES.includes(normalized.subtype);
            }
        } else if (normalized.twoHanded === undefined) {
            normalized.twoHanded = false; // Default to one-handed if can't determine
        }
        
        // Ensure weapon sprite is determined and stored for consistency across all rendering contexts
        // This ensures ground drops, inventory icons, and equipped weapons all use the same sprite
        // Always restore existing sprite if it was present, otherwise determine it now
        if (existingWeaponSprite && existingWeaponSpriteType) {
            // Preserve existing sprite to maintain consistency
            normalized.weaponSprite = existingWeaponSprite;
            normalized.weaponSpriteType = existingWeaponSpriteType;
        } else if (!normalized.weaponSprite && normalized.subtype && typeof window.loadWeaponImage === 'function') {
            // Determine the sprite immediately so it's consistent
            const weaponKind = normalized.subtype || window.weaponKindFromName(normalized.name) || 'Sword';
            window.loadWeaponImage(weaponKind, normalized);
            // loadWeaponImage will set normalized.weaponSprite and normalized.weaponSpriteType
        }
    } else if (item.type === 'armor') {
        normalized.slot = item.slot || 'chest';
    } else if (item.type === 'currency') {
        normalized.amount = item.amount || item.value || 0;
    } else if (item.type === 'unknown') {
        // Try to infer type from other properties
        if (item.dmgMin && item.dmgMax) {
            normalized.type = 'weapon';
            normalized.dmgMin = item.dmgMin;
            normalized.dmgMax = item.dmgMax;
            normalized.subtype = item.subtype || window.weaponKindFromName(item.name);
        } else if (item.slot) {
            normalized.type = 'armor';
            normalized.slot = item.slot;
        } else if (item.amount || (item.name && item.name.toLowerCase().includes('pyreal'))) {
            normalized.type = 'currency';
            normalized.amount = item.amount || item.value || 0;
        } else {
            // Default to weapon if we can't determine
            normalized.type = 'weapon';
            normalized.dmgMin = 1;
            normalized.dmgMax = 2;
            normalized.subtype = 'Unknown';
        }
    }
    
    // Generate icon if not present
    if (!item.icon) {
        try {
            normalized.icon = window.getItemIconDataURLForItem(normalized);
        } catch (error) {
            console.error('Error generating icon for normalized item:', error);
            normalized.icon = '';
        }
    } else {
        normalized.icon = item.icon;
    }
    
    return normalized;
};

window.makeItem=function(type,level){ 
    const roll=Math.random(); 
    let rarity; 
    if(level>6) rarity = roll>0.5? 'Legendary' : roll>0.1? 'Epic' : roll>0.03? 'Uncommon' : 'Common'; 
    else if(level>3) rarity = roll>0.5? 'Epic' : roll>0.2? 'Uncommon' : 'Common'; 
    else if(level>1) rarity = roll>0.4? 'Uncommon' : 'Common'; 
    else rarity='Common'; 
    
    const base=Math.max(1, Math.floor(level*(Math.random()*0.7+0.6))); 
    const stats={}; 
    STAT_NAMES.forEach(s=>stats[s]=0);
    
    if(type==='weapon'){
        stats['Strength']=Math.round(base*(Math.random()*0.6+0.6)); 
        stats['Quickness']=Math.round(base*(Math.random()*0.4+0.3)); 
        const core = weaponNames[randInt(0,weaponNames.length-1)]; 
        const name = `${namePrefixes[randInt(0,namePrefixes.length-1)]} ${core} ${nameSuffixes[randInt(0,nameSuffixes.length-1)]}`; 
        const subtype = core; 
        const dmgMin=Math.max(1,Math.round((stats['Strength']||1)*1.0)); 
        const dmgMax=dmgMin+randInt(2,6)+level; 
        const value=computeItemValue(level,rarity,stats);
        
        // Determine physical damage type based on weapon subtype
        let physicalDamageType = 'Slashing'; // default
        if (['Mace', 'Hammer', 'Warhammer', 'Club', 'Maul', 'Flail'].includes(core)) {
            physicalDamageType = 'Bludgeoning';
        } else if (['Dagger', 'Rapier', 'Spear', 'Bow', 'Crossbow', 'Javelin', 'Trident', 'Pike'].includes(core)) {
            physicalDamageType = 'Piercing';
        }
        // Staff and Wand default to Slashing but are magic weapons
        
        // Determine if weapon should have elemental damage (increased chances for more variety)
        let elementalDamageType = null;
        const elementalRoll = Math.random();
        let elementalChance = 0.25; // Base 25% chance for Common (increased from 10%)
        if (rarity === 'Legendary') elementalChance = 0.75; // 75% for Legendary (increased from 50%)
        else if (rarity === 'Epic') elementalChance = 0.60; // 60% for Epic (increased from 40%)
        else if (rarity === 'Rare') elementalChance = 0.50; // 50% for Rare (increased from 30%)
        else if (rarity === 'Uncommon') elementalChance = 0.35; // 35% for Uncommon (increased from 20%)
        
        if (elementalRoll < elementalChance) {
            const ELEMENTAL_TYPES = ['Fire', 'Acid', 'Lightning', 'Frost'];
            elementalDamageType = ELEMENTAL_TYPES[randInt(0, ELEMENTAL_TYPES.length - 1)];
        }
        
        const item = {
            id:randId(),
            name,
            rarity,
            short:`${subtype} (L${level})`,
            type:'weapon',
            subtype,
            level,
            stats,
            dmgMin,
            dmgMax,
            value,
            physicalDamageType: physicalDamageType,
            elementalDamageType: elementalDamageType
        }; 
        try {
            item.icon = getItemIconDataURLForItem(item); 
        } catch (error) {
            console.error('Error generating icon for weapon item:', error);
            item.icon = '';
        }
        return item; 
    }
    
    if(type==='armor'){
        stats['Endurance']=Math.round(base*(Math.random()*0.8+0.7)); 
        stats['Coordination']=Math.round(base*(Math.random()*0.4+0.2)); 
        const slots=['head','chest','legs','feet','hands','wrists','waist','neck','shoulders']; 
        const slot=slots[randInt(0,slots.length-1)]; 
        const slotBases = armorSlotName[slot]; 
        const baseName = slotBases[randInt(0,slotBases.length-1)]; 
        const name=`${namePrefixes[randInt(0,namePrefixes.length-1)]} ${baseName} ${nameSuffixes[randInt(0,nameSuffixes.length-1)]}`; 
        const value=computeItemValue(level,rarity,stats); 
        const item = {id:randId(),name,rarity,short:`${slot} (L${level})`,type:'armor',slot,level,stats,value}; 
        try {
            item.icon = getItemIconDataURLForItem(item); 
        } catch (error) {
            console.error('Error generating icon for armor item:', error);
            item.icon = '';
        }
        return item; 
    }
    
    const item = {id:randId(),name:`Pyreals`,type:'currency',amount:level*10,value:level*10}; 
    try {
        item.icon = getItemIconDataURLForItem(item); 
    } catch (error) {
        console.error('Error generating icon for currency item:', error);
        item.icon = '';
    }
    return item; 
}

// sprite sheet (procedural medieval base)
window.buildBaseBodySheet=function(){
  const fw=48, fh=64; const runFrames=8, idleFrames=6, jumpFrames=2; const total=idleFrames+runFrames+jumpFrames;
  const sheet=document.createElement('canvas'); sheet.width=fw*total; sheet.height=fh; const g=sheet.getContext('2d');
  let x=0; 
  
  // Generate random colors for shirt and pants (for enemies/vendors) with expanded ranges
  const shirtColors = [
      '#3f506a', '#4a5568', '#2d3748', '#1a202c', '#2d3748', '#4a5568', // Original blues
      '#8b4513', '#a0522d', '#cd853f', '#daa520', '#b8860b', // Browns and golds
      '#556b2f', '#6b8e23', '#9acd32', '#32cd32', '#228b22', // Greens
      '#8b0000', '#dc143c', '#b22222', '#ff6347', '#ff4500', // Reds and oranges
      '#4b0082', '#8a2be2', '#9370db', '#ba55d3', '#9932cc', // Purples
      '#2f4f4f', '#696969', '#808080', '#a9a9a9', '#c0c0c0', // Grays
      '#f5deb3', '#deb887', '#f4a460', '#daa520', '#bdb76b'  // Tans and beiges
  ];
  const pantColors = [
      '#2b2b35', '#2d3748', '#1a202c', '#2d3748', '#2b2b35', '#1a202c', // Original darks
      '#191970', '#000080', '#00008b', '#0000cd', '#0000ff', // Blues
      '#800000', '#8b0000', '#a0522d', '#8b4513', '#654321', // Browns
      '#228b22', '#006400', '#008000', '#32cd32', '#228b22', // Greens
      '#4b0082', '#483d8b', '#6a5acd', '#7b68ee', '#9370db', // Purples
      '#2f4f4f', '#696969', '#808080', '#a9a9a9', '#c0c0c0', // Grays
      '#8b7355', '#a0522d', '#cd853f', '#deb887', '#f5deb3'  // Tans
  ];
  const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
  const pantColor = pantColors[Math.floor(Math.random() * pantColors.length)];

  

// Function to draw NPC body with custom colors (no equipment) and expanded variety
window.drawNPCBody = function(ctx, x, y, colors, animIndex=0, isMoving=false) {
    // Colors should be provided by the server for consistent appearance
    if (!colors) {
        console.warn('drawNPCBody called without colors - should come from server');
        return; // Don't draw without colors to ensure consistency
    }
    
         // Base body removed - no more black background 
    
    // Draw head
    ctx.fillStyle='#e9c6a7'; 
    ctx.fillRect(x+16, y+2, 16, 12); 
    ctx.fillStyle='#1a1a1a'; 
    ctx.fillRect(x+20, y+8, 2, 2); 
    ctx.fillRect(x+26, y+8, 2, 2); 
    ctx.fillStyle='#3a3125'; 
    ctx.fillRect(x+14, y+0, 20, 6); 
    
    // Draw shirt with custom color
    const grad = ctx.createLinearGradient(0, 0, 0, 24); 
    grad.addColorStop(0, colors.shirt); 
    grad.addColorStop(1, colors.shirt.replace('#', '#').replace(/[0-9a-f]{2}/gi, (match) => {
        const num = parseInt(match, 16);
        return Math.max(0, num - 20).toString(16).padStart(2, '0');
    })); 
    ctx.fillStyle = grad; 
    ctx.fillRect(x+12, y+14, 24, 20); 
    ctx.fillStyle = colors.shirt; 
    ctx.fillRect(x+10, y+14, 6, 6); 
    ctx.fillRect(x+34, y+14, 6, 6); 
    
    // Draw belt with custom color
    ctx.fillStyle = colors.belt; 
    ctx.fillRect(x+10, y+32, 28, 4); 
    
    // Draw pants with custom color
    ctx.fillStyle = colors.pants; 
    ctx.fillRect(x+10, y+34, 28, 4); 
    ctx.fillStyle='#bca677'; 
    ctx.fillRect(x+26, y+34, 4, 4); 
    
    // Draw legs with animation
    let legShift = 0, armShift = 0; 
    if (isMoving) { 
        const s = (animIndex / 8) * Math.PI * 2; 
        armShift = Math.sin(s) * 5; 
        legShift = Math.sin(s + Math.PI) * 4; 
    } 
    ctx.fillStyle = colors.pants; 
    ctx.fillRect(x+14, y+36, 8, 18+legShift); 
    ctx.fillRect(x+26, y+36, 8, 18-legShift); 
    ctx.fillStyle='#3b2c1e'; 
    ctx.fillRect(x+14, y+54, 8, 6); 
    ctx.fillRect(x+26, y+54, 8, 6); 
    
    // Draw arms
    ctx.fillStyle='#e9c6a7'; 
    ctx.fillRect(x+8, y+20+armShift, 6, 16); 
    ctx.fillRect(x+34, y+20-armShift, 6, 16); 
    
    // Draw shirt bottom during jump
    if (animIndex >= 16) { 
        ctx.fillStyle = colors.shirt; 
        ctx.fillRect(x+12, y+34, 24, 10); 
    } 
    
         // Random accessory details removed to prevent flashing
};

// Water Wisp sprite cache
const WATER_WISP_SPRITES = {
    idle: [],
    move: [],
    attack: [],
    hurt: [],
    die: []
};

// Load Water Wisp sprites
function loadWaterWispSprites() {
    const basePath = 'assets/Water Wisp/Individual Sprites/';
    
    // Clear existing sprites
    WATER_WISP_SPRITES.idle = [];
    WATER_WISP_SPRITES.move = [];
    WATER_WISP_SPRITES.attack = [];
    WATER_WISP_SPRITES.hurt = [];
    WATER_WISP_SPRITES.die = [];
    
    // Load idle sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}water-idle-${String(i).padStart(2, '0')}.png`;
        WATER_WISP_SPRITES.idle.push(img);
    }
    
    // Load move sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}water-move-${String(i).padStart(2, '0')}.png`;
        WATER_WISP_SPRITES.move.push(img);
    }
    
    // Load attack sprites (10 frames)
    for (let i = 0; i < 10; i++) {
        const img = new Image();
        img.src = `${basePath}water-attack-${String(i).padStart(2, '0')}.png`;
        WATER_WISP_SPRITES.attack.push(img);
    }
    
    // Load hurt sprites (3 frames)
    for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = `${basePath}water-hurt-${String(i).padStart(2, '0')}.png`;
        WATER_WISP_SPRITES.hurt.push(img);
    }
    
    // Load die sprites (7 frames)
    for (let i = 0; i < 7; i++) {
        const img = new Image();
        img.src = `${basePath}water-die-${String(i).padStart(2, '0')}.png`;
        WATER_WISP_SPRITES.die.push(img);
    }
}

// Initialize sprite loading on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', loadWaterWispSprites);
}

// Fire Wisp sprite storage
const FIRE_WISP_SPRITES = {
    idle: [],
    move: [],
    attack: [],
    hurt: [],
    die: []
};

// Load Fire Wisp sprites
function loadFireWispSprites() {
    const basePath = 'assets/Fire Wisp/Individual Sprites/';
    
    // Clear existing sprites
    FIRE_WISP_SPRITES.idle = [];
    FIRE_WISP_SPRITES.move = [];
    FIRE_WISP_SPRITES.attack = [];
    FIRE_WISP_SPRITES.hurt = [];
    FIRE_WISP_SPRITES.die = [];
    
    // Load idle sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}fire-idle-${String(i).padStart(2, '0')}.png`;
        FIRE_WISP_SPRITES.idle.push(img);
    }
    
    // Load move sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}fire-move-${String(i).padStart(2, '0')}.png`;
        FIRE_WISP_SPRITES.move.push(img);
    }
    
    // Load attack sprites (10 frames)
    for (let i = 0; i < 10; i++) {
        const img = new Image();
        img.src = `${basePath}fire-attack-${String(i).padStart(2, '0')}.png`;
        FIRE_WISP_SPRITES.attack.push(img);
    }
    
    // Load hurt sprites (3 frames)
    for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = `${basePath}fire-hurt-${String(i).padStart(2, '0')}.png`;
        FIRE_WISP_SPRITES.hurt.push(img);
    }
    
    // Load die sprites (7 frames)
    for (let i = 0; i < 7; i++) {
        const img = new Image();
        img.src = `${basePath}fire-die-${String(i).padStart(2, '0')}.png`;
        FIRE_WISP_SPRITES.die.push(img);
    }
}

// Initialize sprite loading on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', loadFireWispSprites);
}

// Earth Wisp sprite storage
const EARTH_WISP_SPRITES = {
    idle: [],
    move: [],
    attack: [],
    hurt: [],
    die: []
};

// Load Earth Wisp sprites
function loadEarthWispSprites() {
    const basePath = 'assets/Earth Wisp/Individual Sprite/';
    
    // Clear existing sprites
    EARTH_WISP_SPRITES.idle = [];
    EARTH_WISP_SPRITES.move = [];
    EARTH_WISP_SPRITES.attack = [];
    EARTH_WISP_SPRITES.hurt = [];
    EARTH_WISP_SPRITES.die = [];
    
    // Load idle sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}earth-idle-${String(i).padStart(2, '0')}.png`;
        EARTH_WISP_SPRITES.idle.push(img);
    }
    
    // Load move sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}earth-move-${String(i).padStart(2, '0')}.png`;
        EARTH_WISP_SPRITES.move.push(img);
    }
    
    // Load attack sprites (10 frames)
    for (let i = 0; i < 10; i++) {
        const img = new Image();
        img.src = `${basePath}earth-attack-${String(i).padStart(2, '0')}.png`;
        EARTH_WISP_SPRITES.attack.push(img);
    }
    
    // Load hurt sprites (3 frames)
    for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = `${basePath}earth-hurt-${String(i).padStart(2, '0')}.png`;
        EARTH_WISP_SPRITES.hurt.push(img);
    }
    
    // Load die sprites (7 frames)
    for (let i = 0; i < 7; i++) {
        const img = new Image();
        img.src = `${basePath}earth-die-${String(i).padStart(2, '0')}.png`;
        EARTH_WISP_SPRITES.die.push(img);
    }
}

// Initialize sprite loading on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', loadEarthWispSprites);
}

// Wind Wisp sprite storage
const WIND_WISP_SPRITES = {
    idle: [],
    move: [],
    attack: [],
    hurt: [],
    die: []
};

// Load Wind Wisp sprites
function loadWindWispSprites() {
    const basePath = 'assets/Wind Wisp/Individual Sprites/';
    
    // Clear existing sprites
    WIND_WISP_SPRITES.idle = [];
    WIND_WISP_SPRITES.move = [];
    WIND_WISP_SPRITES.attack = [];
    WIND_WISP_SPRITES.hurt = [];
    WIND_WISP_SPRITES.die = [];
    
    // Load idle sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}wind-idle-${String(i).padStart(2, '0')}.png`;
        WIND_WISP_SPRITES.idle.push(img);
    }
    
    // Load move sprites (4 frames)
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${basePath}wind-move-${String(i).padStart(2, '0')}.png`;
        WIND_WISP_SPRITES.move.push(img);
    }
    
    // Load attack sprites (10 frames)
    for (let i = 0; i < 10; i++) {
        const img = new Image();
        img.src = `${basePath}wind-attack-${String(i).padStart(2, '0')}.png`;
        WIND_WISP_SPRITES.attack.push(img);
    }
    
    // Load hurt sprites (3 frames)
    for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = `${basePath}wind-hurt-${String(i).padStart(2, '0')}.png`;
        WIND_WISP_SPRITES.hurt.push(img);
    }
    
    // Load die sprites (7 frames)
    for (let i = 0; i < 7; i++) {
        const img = new Image();
        img.src = `${basePath}wind-die-${String(i).padStart(2, '0')}.png`;
        WIND_WISP_SPRITES.die.push(img);
    }
}

// Initialize sprite loading on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', loadWindWispSprites);
}

// Draw Fire Wisp enemy with sprite animations
window.drawFireWisp = function(ctx, enemy, dt) {
    if (!enemy) return;
    
    const x = enemy.x || 0;
    const y = enemy.y || 0;
    const w = enemy.w || 32;
    const h = enemy.h || 48;
    
    // Determine animation state
    let state = 'idle';
    let frameIndex = 0;
    // Animation speeds (doubled speed - halved time per frame)
    const idleAnimSpeed = 0.25; // Time per frame for idle (seconds)
    const moveAnimSpeed = 0.15; // Time per frame for move (seconds)
    const attackAnimSpeed = 0.025; // Time per frame for attack (seconds)
    const hurtAnimSpeed = 0.05; // Time per frame for hurt (seconds)
    const dieAnimSpeed = 0.075; // Time per frame for die (seconds)
    
    // Check if enemy is dead
    if (enemy.health <= 0 || enemy.isDead || enemy.dead) {
        state = 'die';
        // Use die animation progress from server (don't update it client-side)
        // Server is authoritative for dieAnimProgress
        if (enemy.dieAnimProgress === undefined) {
            enemy.dieAnimProgress = 0;
        }
        // Don't increment dieAnimProgress client-side - server handles this
        const dieFrames = FIRE_WISP_SPRITES.die.length;
        frameIndex = Math.min(Math.floor(enemy.dieAnimProgress / dieAnimSpeed), dieFrames - 1);
    }
    // Check if enemy is hurt (recently took damage)
    else if (enemy.hurtAnimTime && enemy.hurtAnimTime > 0) {
        state = 'hurt';
        const hurtFrames = FIRE_WISP_SPRITES.hurt.length;
        const progress = 1 - (enemy.hurtAnimTime / 0.3); // 0.3 second hurt animation
        frameIndex = Math.min(Math.floor(progress * hurtFrames), hurtFrames - 1);
    }
    // Check if enemy is attacking
    else if (enemy.attackAnimTime && enemy.attackAnimTime > 0) {
        state = 'attack';
        const attackFrames = FIRE_WISP_SPRITES.attack.length;
        const progress = 1 - (enemy.attackAnimTime / 0.5); // 0.5 second attack animation
        frameIndex = Math.min(Math.floor(progress * attackFrames), attackFrames - 1);
    }
    // Check if enemy is moving
    else if (Math.abs(enemy.vx || 0) > 5) {
        state = 'move';
        // Animate move frames based on time
        if (!enemy.moveAnimTime) enemy.moveAnimTime = 0;
        enemy.moveAnimTime += dt;
        const moveFrames = FIRE_WISP_SPRITES.move.length;
        frameIndex = Math.floor((enemy.moveAnimTime / moveAnimSpeed) % moveFrames);
    }
    // Otherwise idle
    else {
        state = 'idle';
        // Animate idle frames based on time
        if (!enemy.idleAnimTime) enemy.idleAnimTime = 0;
        enemy.idleAnimTime += dt;
        const idleFrames = FIRE_WISP_SPRITES.idle.length;
        frameIndex = Math.floor((enemy.idleAnimTime / idleAnimSpeed) % idleFrames);
    }
    
    // Get the sprite for current state and frame
    const sprites = FIRE_WISP_SPRITES[state];
    if (!sprites || !sprites[frameIndex]) {
        // Fallback: draw a simple rectangle if sprite not loaded
        ctx.fillStyle = '#ff4a4a';
        ctx.fillRect(x, y, w, h);
        return;
    }
    
    const sprite = sprites[frameIndex];
    
    // Wait for image to load before drawing
    if (!sprite.complete || sprite.naturalWidth === 0) {
        // Image not loaded yet, draw placeholder
        ctx.fillStyle = '#ff4a4a';
        ctx.fillRect(x, y, 32, 48);
        return;
    }
    
    // Use original image dimensions (no scaling)
    const spriteWidth = sprite.naturalWidth;
    const spriteHeight = sprite.naturalHeight;
    
    // Determine if we should flip horizontally (for facing right)
    const flip = enemy.facing === 'right' || (enemy.facing === undefined && (enemy.vx || 0) > 0);
    
    // Draw the sprite at original size
    ctx.save();
    
    if (flip) {
        // Flip horizontally for right-facing (all states: idle, move, attack, hurt, die)
        ctx.translate(x + spriteWidth, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);
    } else {
        // Draw normally (left-facing) at original size
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, x, y, spriteWidth, spriteHeight);
    }
    
    ctx.restore();
};

// Draw Earth Wisp enemy with sprite animations
window.drawEarthWisp = function(ctx, enemy, dt) {
    if (!enemy) return;
    
    const x = enemy.x || 0;
    const y = enemy.y || 0;
    const w = enemy.w || 32;
    const h = enemy.h || 48;
    
    // Determine animation state
    let state = 'idle';
    let frameIndex = 0;
    // Animation speeds (doubled speed - halved time per frame)
    const idleAnimSpeed = 0.25; // Time per frame for idle (seconds)
    const moveAnimSpeed = 0.15; // Time per frame for move (seconds)
    const attackAnimSpeed = 0.025; // Time per frame for attack (seconds)
    const hurtAnimSpeed = 0.05; // Time per frame for hurt (seconds)
    const dieAnimSpeed = 0.075; // Time per frame for die (seconds)
    
    // Check if enemy is dead
    if (enemy.health <= 0 || enemy.isDead || enemy.dead) {
        state = 'die';
        // Use die animation progress from server (don't update it client-side)
        // Server is authoritative for dieAnimProgress
        if (enemy.dieAnimProgress === undefined) {
            enemy.dieAnimProgress = 0;
        }
        // Don't increment dieAnimProgress client-side - server handles this
        const dieFrames = EARTH_WISP_SPRITES.die.length;
        frameIndex = Math.min(Math.floor(enemy.dieAnimProgress / dieAnimSpeed), dieFrames - 1);
    }
    // Check if enemy is hurt (recently took damage)
    else if (enemy.hurtAnimTime && enemy.hurtAnimTime > 0) {
        state = 'hurt';
        const hurtFrames = EARTH_WISP_SPRITES.hurt.length;
        const progress = 1 - (enemy.hurtAnimTime / 0.3); // 0.3 second hurt animation
        frameIndex = Math.min(Math.floor(progress * hurtFrames), hurtFrames - 1);
    }
    // Check if enemy is attacking
    else if (enemy.attackAnimTime && enemy.attackAnimTime > 0) {
        state = 'attack';
        const attackFrames = EARTH_WISP_SPRITES.attack.length;
        const progress = 1 - (enemy.attackAnimTime / 0.5); // 0.5 second attack animation
        frameIndex = Math.min(Math.floor(progress * attackFrames), attackFrames - 1);
    }
    // Check if enemy is moving
    else if (Math.abs(enemy.vx || 0) > 5) {
        state = 'move';
        // Animate move frames based on time
        if (!enemy.moveAnimTime) enemy.moveAnimTime = 0;
        enemy.moveAnimTime += dt;
        const moveFrames = EARTH_WISP_SPRITES.move.length;
        frameIndex = Math.floor((enemy.moveAnimTime / moveAnimSpeed) % moveFrames);
    }
    // Otherwise idle
    else {
        state = 'idle';
        // Animate idle frames based on time
        if (!enemy.idleAnimTime) enemy.idleAnimTime = 0;
        enemy.idleAnimTime += dt;
        const idleFrames = EARTH_WISP_SPRITES.idle.length;
        frameIndex = Math.floor((enemy.idleAnimTime / idleAnimSpeed) % idleFrames);
    }
    
    // Get the sprite for current state and frame
    const sprites = EARTH_WISP_SPRITES[state];
    if (!sprites || !sprites[frameIndex]) {
        // Fallback: draw a simple rectangle if sprite not loaded
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(x, y, w, h);
        return;
    }
    
    const sprite = sprites[frameIndex];
    
    // Wait for image to load before drawing
    if (!sprite.complete || sprite.naturalWidth === 0) {
        // Image not loaded yet, draw placeholder
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(x, y, 32, 48);
        return;
    }
    
    // Use original image dimensions (no scaling)
    const spriteWidth = sprite.naturalWidth;
    const spriteHeight = sprite.naturalHeight;
    
    // Determine if we should flip horizontally (for facing right)
    const flip = enemy.facing === 'right' || (enemy.facing === undefined && (enemy.vx || 0) > 0);
    
    // Draw the sprite at original size
    ctx.save();
    
    if (flip) {
        // Flip horizontally for right-facing (all states: idle, move, attack, hurt, die)
        ctx.translate(x + spriteWidth, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);
    } else {
        // Draw normally (left-facing) at original size
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, x, y, spriteWidth, spriteHeight);
    }
    
    ctx.restore();
};

// Draw Wind Wisp enemy with sprite animations
window.drawWindWisp = function(ctx, enemy, dt) {
    if (!enemy) return;
    
    const x = enemy.x || 0;
    const y = enemy.y || 0;
    const w = enemy.w || 32;
    const h = enemy.h || 48;
    
    // Determine animation state
    let state = 'idle';
    let frameIndex = 0;
    // Animation speeds (doubled speed - halved time per frame)
    const idleAnimSpeed = 0.25; // Time per frame for idle (seconds)
    const moveAnimSpeed = 0.15; // Time per frame for move (seconds)
    const attackAnimSpeed = 0.025; // Time per frame for attack (seconds)
    const hurtAnimSpeed = 0.05; // Time per frame for hurt (seconds)
    const dieAnimSpeed = 0.075; // Time per frame for die (seconds)
    
    // Check if enemy is dead
    if (enemy.health <= 0 || enemy.isDead || enemy.dead) {
        state = 'die';
        // Use die animation progress from server (don't update it client-side)
        // Server is authoritative for dieAnimProgress
        if (enemy.dieAnimProgress === undefined) {
            enemy.dieAnimProgress = 0;
        }
        // Don't increment dieAnimProgress client-side - server handles this
        const dieFrames = WIND_WISP_SPRITES.die.length;
        frameIndex = Math.min(Math.floor(enemy.dieAnimProgress / dieAnimSpeed), dieFrames - 1);
    }
    // Check if enemy is hurt (recently took damage)
    else if (enemy.hurtAnimTime && enemy.hurtAnimTime > 0) {
        state = 'hurt';
        const hurtFrames = WIND_WISP_SPRITES.hurt.length;
        const progress = 1 - (enemy.hurtAnimTime / 0.3); // 0.3 second hurt animation
        frameIndex = Math.min(Math.floor(progress * hurtFrames), hurtFrames - 1);
    }
    // Check if enemy is attacking
    else if (enemy.attackAnimTime && enemy.attackAnimTime > 0) {
        state = 'attack';
        const attackFrames = WIND_WISP_SPRITES.attack.length;
        const progress = 1 - (enemy.attackAnimTime / 0.5); // 0.5 second attack animation
        frameIndex = Math.min(Math.floor(progress * attackFrames), attackFrames - 1);
    }
    // Check if enemy is moving
    else if (Math.abs(enemy.vx || 0) > 5) {
        state = 'move';
        // Animate move frames based on time
        if (!enemy.moveAnimTime) enemy.moveAnimTime = 0;
        enemy.moveAnimTime += dt;
        const moveFrames = WIND_WISP_SPRITES.move.length;
        frameIndex = Math.floor((enemy.moveAnimTime / moveAnimSpeed) % moveFrames);
    }
    // Otherwise idle
    else {
        state = 'idle';
        // Animate idle frames based on time
        if (!enemy.idleAnimTime) enemy.idleAnimTime = 0;
        enemy.idleAnimTime += dt;
        const idleFrames = WIND_WISP_SPRITES.idle.length;
        frameIndex = Math.floor((enemy.idleAnimTime / idleAnimSpeed) % idleFrames);
    }
    
    // Get the sprite for current state and frame
    const sprites = WIND_WISP_SPRITES[state];
    if (!sprites || !sprites[frameIndex]) {
        // Fallback: draw a simple rectangle if sprite not loaded
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(x, y, w, h);
        return;
    }
    
    const sprite = sprites[frameIndex];
    
    // Wait for image to load before drawing
    if (!sprite.complete || sprite.naturalWidth === 0) {
        // Image not loaded yet, draw placeholder
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(x, y, 32, 48);
        return;
    }
    
    // Use original image dimensions (no scaling)
    const spriteWidth = sprite.naturalWidth;
    const spriteHeight = sprite.naturalHeight;
    
    // Determine if we should flip horizontally (for facing right)
    const flip = enemy.facing === 'right' || (enemy.facing === undefined && (enemy.vx || 0) > 0);
    
    // Draw the sprite at original size
    ctx.save();
    
    if (flip) {
        // Flip horizontally for right-facing (all states: idle, move, attack, hurt, die)
        ctx.translate(x + spriteWidth, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);
    } else {
        // Draw normally (left-facing) at original size
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, x, y, spriteWidth, spriteHeight);
    }
    
    ctx.restore();
};

// Draw Water Wisp enemy with sprite animations
window.drawWaterWisp = function(ctx, enemy, dt) {
    if (!enemy) return;
    
    const x = enemy.x || 0;
    const y = enemy.y || 0;
    const w = enemy.w || 32;
    const h = enemy.h || 48;
    
    // Determine animation state
    let state = 'idle';
    let frameIndex = 0;
    // Animation speeds (doubled speed - halved time per frame)
    const idleAnimSpeed = 0.25; // Time per frame for idle (seconds)
    const moveAnimSpeed = 0.15; // Time per frame for move (seconds)
    const attackAnimSpeed = 0.025; // Time per frame for attack (seconds)
    const hurtAnimSpeed = 0.05; // Time per frame for hurt (seconds)
    const dieAnimSpeed = 0.075; // Time per frame for die (seconds)
    
    // Check if enemy is dead
    if (enemy.health <= 0 || enemy.isDead || enemy.dead) {
        state = 'die';
        // Use die animation progress from server (don't update it client-side)
        // Server is authoritative for dieAnimProgress
        if (enemy.dieAnimProgress === undefined) {
            enemy.dieAnimProgress = 0;
        }
        // Don't increment dieAnimProgress client-side - server handles this
        const dieFrames = WATER_WISP_SPRITES.die.length;
        frameIndex = Math.min(Math.floor(enemy.dieAnimProgress / dieAnimSpeed), dieFrames - 1);
    }
    // Check if enemy is hurt (recently took damage)
    else if (enemy.hurtAnimTime && enemy.hurtAnimTime > 0) {
        state = 'hurt';
        const hurtFrames = WATER_WISP_SPRITES.hurt.length;
        const progress = 1 - (enemy.hurtAnimTime / 0.3); // 0.3 second hurt animation
        frameIndex = Math.min(Math.floor(progress * hurtFrames), hurtFrames - 1);
    }
    // Check if enemy is attacking
    else if (enemy.attackAnimTime && enemy.attackAnimTime > 0) {
        state = 'attack';
        const attackFrames = WATER_WISP_SPRITES.attack.length;
        const progress = 1 - (enemy.attackAnimTime / 0.5); // 0.5 second attack animation
        frameIndex = Math.min(Math.floor(progress * attackFrames), attackFrames - 1);
    }
    // Check if enemy is moving
    else if (Math.abs(enemy.vx || 0) > 5) {
        state = 'move';
        // Animate move frames based on time
        if (!enemy.moveAnimTime) enemy.moveAnimTime = 0;
        enemy.moveAnimTime += dt;
        const moveFrames = WATER_WISP_SPRITES.move.length;
        frameIndex = Math.floor((enemy.moveAnimTime / moveAnimSpeed) % moveFrames);
    }
    // Otherwise idle
    else {
        state = 'idle';
        // Animate idle frames based on time
        if (!enemy.idleAnimTime) enemy.idleAnimTime = 0;
        enemy.idleAnimTime += dt;
        const idleFrames = WATER_WISP_SPRITES.idle.length;
        frameIndex = Math.floor((enemy.idleAnimTime / idleAnimSpeed) % idleFrames);
    }
    
    // Get the sprite for current state and frame
    const sprites = WATER_WISP_SPRITES[state];
    if (!sprites || !sprites[frameIndex]) {
        // Fallback: draw a simple rectangle if sprite not loaded
        ctx.fillStyle = '#4aa3ff';
        ctx.fillRect(x, y, w, h);
        return;
    }
    
    const sprite = sprites[frameIndex];
    
    // Wait for image to load before drawing
    if (!sprite.complete || sprite.naturalWidth === 0) {
        // Image not loaded yet, draw placeholder
        ctx.fillStyle = '#4aa3ff';
        ctx.fillRect(x, y, 32, 48);
        return;
    }
    
    // Use original image dimensions (no scaling)
    const spriteWidth = sprite.naturalWidth;
    const spriteHeight = sprite.naturalHeight;
    
    // Determine if we should flip horizontally (for facing right)
    const flip = enemy.facing === 'right' || (enemy.facing === undefined && (enemy.vx || 0) > 0);
    
    // Draw the sprite at original size
    ctx.save();
    
    if (flip) {
        // Flip horizontally for right-facing (all states: idle, move, attack, hurt, die)
        ctx.translate(x + spriteWidth, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);
    } else {
        // Draw normally (left-facing) at original size
        ctx.drawImage(sprite, 0, 0, spriteWidth, spriteHeight, x, y, spriteWidth, spriteHeight);
    }
    
    ctx.restore();
    
    // Draw damage flash overlay if taking damage (use actual sprite dimensions)
    if (enemy.damageFlashTimer && enemy.damageFlashTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(x, y, spriteWidth, spriteHeight);
        ctx.restore();
    }
};
  
     function drawBody(kind,idx){ 
     // Base body removed - no more black background 
    g.fillStyle='#e9c6a7'; g.fillRect(x+16,2,16,12); 
    g.fillStyle='#1a1a1a'; g.fillRect(x+20,8,2,2); g.fillRect(x+26,8,2,2); 
    g.fillStyle='#3a3125'; g.fillRect(x+14,0,20,6); 
    
    // Shirt with randomized color
    const grad=g.createLinearGradient(0,0,0,24); 
    grad.addColorStop(0,shirtColor); 
    grad.addColorStop(1,shirtColor.replace('#', '#').replace(/[0-9a-f]{2}/gi, (match) => {
      const num = parseInt(match, 16);
      return Math.max(0, num - 20).toString(16).padStart(2, '0');
    })); 
    g.fillStyle=grad; g.fillRect(x+12,14,24,20); 
    g.fillStyle=shirtColor; g.fillRect(x+10,14,6,6); g.fillRect(x+34,14,6,6); 
    
    // Pants with randomized color
    g.fillStyle=pantColor; g.fillRect(x+10,32,28,4); 
    g.fillStyle='#bca677'; g.fillRect(x+26,32,4,4); 
    
    let legShift=0, armShift=0; 
    if(kind===1){ 
      const s=(idx/runFrames)*Math.PI*2; 
      armShift=Math.sin(s)*5; 
      legShift=Math.sin(s+Math.PI)*4; 
    } 
    g.fillStyle=pantColor; g.fillRect(x+14,36,8,18+legShift); g.fillRect(x+26,36,8,18-legShift); 
    g.fillStyle='#3b2c1e'; g.fillRect(x+14,54,8,6); g.fillRect(x+26,54,8,6); 
    g.fillStyle='#e9c6a7'; g.fillRect(x+8,20+armShift,6,16); g.fillRect(x+34,20-armShift,6,16); 
         if(kind===2){ 
         // Shirt bottom during jump removed - no more rectangle in front of character
     }  
  }
  
  for(let i=0;i<idleFrames;i++){ drawBody(0,i); x+=fw; } 
  for(let i=0;i<runFrames;i++){ drawBody(1,i); x+=fw; } 
  for(let i=0;i<jumpFrames;i++){ drawBody(2,i); x+=fw; }
  
  return {url:sheet.toDataURL(),fw,fh,idleFrames,runFrames,jumpFrames,shirtColor,pantColor}; 
}

window.BASE = buildBaseBodySheet(); 
window.baseSheetImg = new Image(); 
baseSheetImg.src = BASE.url; 
window.SHEET_READY=false; 
baseSheetImg.onload=()=>window.SHEET_READY=true;
window.FW=BASE.fw; window.FH=BASE.fh; window.IDLE_N=BASE.idleFrames; window.RUN_N=BASE.runFrames; window.JUMP_N=BASE.jumpFrames; window.IDLE_O=0; window.RUN_O=IDLE_N; window.JUMP_O=IDLE_N+RUN_N; window.IDLE_RATE=0.16; window.RUN_RATE=0.08; window.JUMP_RATE=0.18;
window.advanceAnim=function(anim, dt, isAir, isMoving){ 
    // Prioritize movement over jumping - if moving on ground, show run animation
    // If in air and moving, show jump animation
    // If in air and not moving, show jump animation
    // If on ground and not moving, show idle animation
    
    let rate, count, offset;
    
    if (isMoving && !isAir) {
        // Moving on ground - run animation
        rate = RUN_RATE;
        count = RUN_N;
        offset = RUN_O;
    } else if (isAir) {
        // In air - jump animation (regardless of movement)
        rate = JUMP_RATE;
        count = JUMP_N;
        offset = JUMP_O;
    } else {
        // On ground and not moving - idle animation
        rate = IDLE_RATE;
        count = IDLE_N;
        offset = IDLE_O;
    }
    
    anim.timer += dt;
    if(anim.timer>=rate){
        anim.timer-=rate;
        anim.index=(anim.index+1)%count;
    }
    
    return offset + (isAir?0:anim.index);
}

// equipment draw helpers
function box(ctx,x,y,w,h,fill,edge){ ctx.fillStyle=fill; ctx.fillRect(x,y,w,h); ctx.fillStyle=edge; ctx.fillRect(x,y,w,2); ctx.fillRect(x,y,2,h); }

// Helper function to extract colors from an item
function getItemColors(it) {
    // Get colors from item if available, otherwise use material detection
    if(it.colors && it.colors.fill && it.colors.edge) {
        return {
            fill: it.colors.fill,
            edge: it.colors.edge,
            isLegendary: it.colors.legendary || false,
            gradientColors: it.colors.gradient || null
        };
    } else {
        // Fallback to material detection
        const nm=(it.name||'').toLowerCase();
        let fill, edge;
        if(nm.includes('leather') || nm.includes('hide')) {
            fill = '#a57544'; edge = '#6b4423';
        } else if(nm.includes('cloth') || nm.includes('silk') || nm.includes('robe')) {
            fill = '#6ea2d6'; edge = '#3d688d';
        } else if(nm.includes('dragonhide')) {
            fill = '#dc2626'; edge = '#991b1b';
        } else if(nm.includes('shadowweave')) {
            fill = '#1f2937'; edge = '#111827';
        } else if(nm.includes('celestial')) {
            fill = '#fbbf24'; edge = '#d97706';
        } else if(nm.includes('void-touched')) {
            fill = '#7c3aed'; edge = '#5b21b6';
        } else if(nm.includes('gold') || nm.includes('royal')) {
            fill = '#ffd700'; edge = '#b8860b';
        } else if(nm.includes('silver') || nm.includes('mithril')) {
            fill = '#c0c0c0'; edge = '#a9a9a9';
        } else if(nm.includes('crystal') || nm.includes('prismatic')) {
            fill = '#e6e6fa'; edge = '#d8bfd8';
        } else if(nm.includes('fire') || nm.includes('flame')) {
            fill = '#ff4500'; edge = '#dc143c';
        } else if(nm.includes('ice') || nm.includes('frost')) {
            fill = '#87ceeb'; edge = '#4682b4';
        } else if(nm.includes('chain') || nm.includes('mail')) {
            fill = '#a9a9a9'; edge = '#696969';
        } else if(nm.includes('pearl') || nm.includes('gem')) {
            fill = '#f0f8ff'; edge = '#e6e6fa';
        } else {
            fill = '#d5dceb'; edge = '#9eb0c8';
        }
        return { fill: fill, edge: edge, isLegendary: false, gradientColors: null };
    }
}

// Function to draw box with optional legendary gradient
function boxWithGradient(ctx,x,y,w,h,fill,edge,isLegendary,gradientColors){
    if(isLegendary && gradientColors && gradientColors.color1 && gradientColors.color2){
        // Create radial gradient for legendary items (top-left to bottom-right)
        const gradient = ctx.createLinearGradient(x, y, x+w, y+h);
        gradient.addColorStop(0, gradientColors.color1);
        gradient.addColorStop(1, gradientColors.color2);
        ctx.fillStyle = gradient;
        ctx.fillRect(x,y,w,h);
        // Add edge in darker color
        ctx.fillStyle=edge; 
        ctx.fillRect(x,y,w,2); 
        ctx.fillRect(x,y,2,h);
    } else {
        // Standard box drawing
        ctx.fillStyle=fill; 
        ctx.fillRect(x,y,w,h); 
        ctx.fillStyle=edge; 
        ctx.fillRect(x,y,w,2); 
        ctx.fillRect(x,y,2,h);
    }
}

function strokeRect(ctx,x,y,w,h,c){ ctx.strokeStyle=c; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); }

// Draw helmet with proper head alignment and expanded colors
window.drawHelmet=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    const nm=(it.name||'').toLowerCase();
    
    // Determine helmet style based on name
    if(nm.includes('crown') || nm.includes('royal')) {
        // Crown style - positioned on top of head with 2px wider border
        // Head zone: y+2 to y+14 (12px height), so crown should be y+0 to y+16 (16px height)
        // Width: 20px + 4px border = 24px, centered on x+12
        boxWithGradient(ctx,x+12,y+0,24,16,fill,edge,colors.isLegendary,colors.gradientColors); 
        strokeRect(ctx,x+12,y+0,24,16,'#1b2430'); 
        
        // Crown jewels
        ctx.fillStyle = edge;
        ctx.fillRect(x+18,y+1,4,2); // Center jewel
        ctx.fillRect(x+22,y+1,4,2); // Right jewel
        ctx.fillRect(x+14,y+1,4,2); // Left jewel
        
    } else if(nm.includes('circlet') || nm.includes('band')) {
        // Circlet style - positioned around head with 2px wider border
        // Width: 16px + 4px border = 20px, centered on x+14
        boxWithGradient(ctx,x+14,y+0,20,6,fill,edge,colors.isLegendary,colors.gradientColors); 
        strokeRect(ctx,x+14,y+0,20,6,'#1b2430'); 
        
        // Circlet gem
        ctx.fillStyle = edge;
        ctx.fillRect(x+22,y+1,4,4); // Center gem
        
    } else {
        // Standard helmet - positioned on head with 2px wider border
        // Width: 20px + 4px border = 24px, centered on x+12
        boxWithGradient(ctx,x+12,y+0,24,12,fill,edge,colors.isLegendary,colors.gradientColors); 
        strokeRect(ctx,x+12,y+0,24,12,'#1b2430'); 
        
        // Helmet visor
        ctx.fillStyle = edge;
        ctx.fillRect(x+18,y+2,8,4); // Visor slit
        
        // Helmet crest
        ctx.fillStyle = fill;
        ctx.fillRect(x+22,y+0,2,4); // Top crest (moved to stay within bounds)
    }
}

// Draw other armor slots
window.drawShoulders=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Left shoulder (character's left, screen right when facing right) - positioned higher and more outward
    // Shoulder zone: y+16 to y+22 (6px height), so shoulders should be y+14 to y+24 (10px height)
    // Width: 10px + 4px border = 14px, positioned at x+7 (moved 3px to the right)
    boxWithGradient(ctx,x+7,y+14,14,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    // Right shoulder (character's right, screen left when facing right) - positioned higher and more outward
    // Positioned at x+29 (moved 3px to the right)
    boxWithGradient(ctx,x+29,y+14,14,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add shoulder pad details
    strokeRect(ctx,x+7,y+14,14,10,'#1b2430'); 
    strokeRect(ctx,x+29,y+14,14,10,'#1b2430'); 
    
    // Add shoulder strap connecting to chest
    ctx.fillStyle = edge;
    ctx.fillRect(x+21,y+20,8,2); // Center strap (moved 3px to the right to match shoulder positions)
}

// Draw wrists with proper positioning on character's arms
window.drawWrists=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Left wrist (character's left, screen right when facing right) - positioned on left arm
    // Width: 7px + 4px border = 11px, positioned at x+4 (moved 3.5px toward center to maintain balance)
    // Moved down 3px from y+18 to y+21
    boxWithGradient(ctx,x+7.5,y+21,11,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    // Right wrist (character's right, screen left when facing right) - positioned on right arm
    // Positioned at x+30.5 (moved 3.5px toward center to maintain balance)
    // Moved down 3px from y+18 to y+21
    boxWithGradient(ctx,x+30.5,y+21,11,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add wrist band details
    strokeRect(ctx,x+7.5,y+21,11,10,'#1b2430'); 
    strokeRect(ctx,x+30.5,y+21,11,10,'#1b2430'); 
    
    // Add wrist strap details (adjusted for new width and position, moved down 3px)
    ctx.fillStyle = edge;
    ctx.fillRect(x+9.5,y+23,4,2); // Left wrist strap (adjusted for narrower width, moved down 3px)
    ctx.fillRect(x+32.5,y+23,4,2); // Right wrist strap (adjusted for narrower width, moved down 3px)
}

// Draw waist/belt with proper positioning around character's waist
window.drawWaist=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Main belt around waist - positioned at waist level with 2px wider border
    // Waist zone: y+32 to y+36 (4px height), so belt should be y+30 to y+36 (6px height)
    // Width: 13px + 4px border = 17px, centered on x+15 (moved 7px toward center to maintain balance)
    boxWithGradient(ctx,x+15,y+30,17,6,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Belt buckle in center
    ctx.fillStyle = edge;
    ctx.fillRect(x+18,y+32,8,2);
    
    // Belt straps hanging down
    ctx.fillStyle = fill;
    ctx.fillRect(x+16,y+36,4,4); // Left strap
    ctx.fillRect(x+23,y+36,4,4); // Right strap
    
    // Main belt outline
    strokeRect(ctx,x+15,y+30,17,6,'#1b2430'); 
    
    // Belt buckle outline
    ctx.strokeStyle = '#1b2430';
    ctx.lineWidth = 1;
    ctx.strokeRect(x+18,y+32,8,2);
}

// Draw neck items with proper positioning around character's neck
window.drawNeck=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
         // Main necklace/neck item - positioned at bottom of head, much smaller
     // Head ends at y+14, so neck item should be y+14 to y+20 (6px height)
     // Width: 8px + 2px border = 10px, centered on x+19
     boxWithGradient(ctx,x+19,y+14,10,6,fill,edge,colors.isLegendary,colors.gradientColors); 
     
     // Necklace chain/string
     ctx.fillStyle = edge;
     ctx.fillRect(x+21,y+13,6,1); // Top chain
     ctx.fillRect(x+21,y+20,6,1); // Bottom chain
     
     // Pendant or gem in center
     ctx.fillStyle = fill;
     ctx.fillRect(x+22,y+16,2,2);
     
     // Main item outline
     strokeRect(ctx,x+19,y+14,10,6,'#1b2430'); 
     
     // Pendant outline
     ctx.strokeStyle = '#1b2430';
     ctx.lineWidth = 1;
     ctx.strokeRect(x+22,y+16,2,2);
}

// Draw leg armor with proper positioning on character's legs
window.drawLegs=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Left leg armor (character's left, screen right when facing right)
    // Leg zone: y+36 to y+54 (18px height), so leg armor should be y+34 to y+52 (18px height)
    // Width: 8px + 4px border = 12px, positioned at x+11
    boxWithGradient(ctx,x+11,y+34,12,18,fill,edge,colors.isLegendary,colors.gradientColors); 
    // Right leg armor (character's right, screen left when facing right)
    // Positioned at x+25
    boxWithGradient(ctx,x+25,y+34,12,18,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add leg armor details
    strokeRect(ctx,x+11,y+34,12,18,'#1b2430'); 
    strokeRect(ctx,x+25,y+34,12,18,'#1b2430'); 
    
    // Add knee protection details
    ctx.fillStyle = edge;
    ctx.fillRect(x+11,y+42,12,4); // Left knee
    ctx.fillRect(x+25,y+42,12,4); // Right knee
    
    // Add thigh protection details
    ctx.fillStyle = fill;
    ctx.fillRect(x+13,y+36,8,6); // Left thigh
    ctx.fillRect(x+27,y+36,8,6); // Right thigh
}

// Draw all equipment for a character (for both player and other players)
window.drawAllEquipment=function(ctx,x,y,equip,isPlayer=false,flip=false,swingAngle=0){
    if(!equip) return;
    
    // Draw equipment in proper order (underneath to on top)
    if(equip.chest) window.drawChest(ctx,x,y,equip.chest);
    if(equip.legs) window.drawLegs(ctx,x,y,equip.legs);
    if(equip.waist) window.drawWaist(ctx,x,y,equip.waist);
    if(equip.feet) window.drawBoots(ctx,x,y,equip.feet);
    if(equip.shoulders) window.drawShoulders(ctx,x,y,equip.shoulders);
    if(equip.wrists) window.drawWrists(ctx,x,y,equip.wrists);
    if(equip.hands) window.drawGloves(ctx,x,y,equip.hands);
    if(equip.neck) window.drawNeck(ctx,x,y,equip.neck);
    if(equip.head) window.drawHelmet(ctx,x,y,equip.head);
    
    // Draw offhand weapon first (so mainhand appears on top)
    // Offhand is drawn here so it appears below mainhand when mainhand is drawn in drawCharacter
    // Don't draw offhand if mainhand is a two-handed weapon (offhand will be the same weapon reference)
    if(equip.offhand && equip.mainhand) {
        // Check if offhand is the same weapon as mainhand (two-handed weapon occupying both slots)
        const isSameWeapon = equip.offhand === equip.mainhand || 
            (equip.offhand.id && equip.mainhand.id && equip.offhand.id === equip.mainhand.id);
        const isMainhandTwoHanded = equip.mainhand.twoHanded || 
            (equip.mainhand.subtype && typeof window.checkIfTwoHanded === 'function' && window.checkIfTwoHanded(equip.mainhand.subtype));
        
        // Only draw offhand if it's a different weapon and mainhand is not two-handed
        if (!isSameWeapon && !isMainhandTwoHanded) {
            window.drawWeapon(ctx,x,y,flip,equip.offhand,swingAngle,equip,'offhand');
        }
    } else if(equip.offhand) {
        // No mainhand, so draw offhand normally
        window.drawWeapon(ctx,x,y,flip,equip.offhand,swingAngle,equip,'offhand');
    }
}

// Draw chest armor with proper alignment and expanded colors
window.drawChest=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Main chest armor - moved down 2px and 4px shorter
    // Chest zone: y+14 to y+34 (20px height), so armor should be y+14 to y+28 (14px height)
    // Width: 16px + 4px border = 20px, centered on x+14 (center of 48px character)
    boxWithGradient(ctx,x+14,y+14,20,14,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add chest armor details
    strokeRect(ctx,x+14,y+14,20,14,'#1b2430'); 
    
    // Add chest plate details (scaled down and centered, adjusted for new position)
    ctx.fillStyle = edge;
    ctx.fillRect(x+18,y+18,12,2); // Upper chest detail (shorter)
    ctx.fillRect(x+19,y+21,10,3); // Center chest detail (shorter)
    
    // Add shoulder connection points (scaled down and centered)
    ctx.fillStyle = fill;
    ctx.fillRect(x+11,y+12,3,3); // Left shoulder connection (moved down 2px)
    ctx.fillRect(x+34,y+12,3,3); // Right shoulder connection (moved down 2px)
}

// Draw gloves with proper hand alignment and expanded colors
window.drawGloves=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Left hand glove (character's left, screen right when facing right) - moved toward center 5px total, half as tall, and moved up 7px total
    // Arm zone: y+20 to y+36 (16px height), so gloves should be y+31 to y+41 (10px height - half of 20px, moved up 7px total)
    // Width: 4px + 4px border = 8px, positioned at x+8 (moved 5px toward center from x+3)
    boxWithGradient(ctx,x+8,y+31,8,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    // Right hand glove (character's right, screen left when facing right) - positioned at x+32 (moved 5px toward center from x+37)
    boxWithGradient(ctx,x+32,y+31,8,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add glove details
    strokeRect(ctx,x+8,y+31,8,10,'#1b2430'); 
    strokeRect(ctx,x+32,y+31,8,10,'#1b2430'); 
    
    // Add finger details (scaled down for shorter gloves, moved up 7px total, moved 2px toward center)
    ctx.fillStyle = edge;
    ctx.fillRect(x+9,y+33,2,3); // Left thumb (shorter, moved up 7px total, moved 2px toward center)
    ctx.fillRect(x+33,y+33,2,3); // Right thumb (shorter, moved up 7px total, moved 2px toward center)
    
    // Add palm details (scaled down for shorter gloves, moved up 7px total, moved 2px toward center)
    ctx.fillStyle = fill;
    ctx.fillRect(x+10,y+35,3,2); // Left palm (shorter, moved up 7px total, moved 2px toward center)
    ctx.fillRect(x+34,y+35,3,2); // Right palm (shorter, moved up 7px total, moved 2px toward center)
}

// Draw boots with proper foot alignment and expanded colors
window.drawBoots=function(ctx,x,y,it){ 
    if(!it) return; 
    
    // Get colors from item
    const colors = getItemColors(it);
    const fill = colors.fill;
    const edge = colors.edge;
    
    // Left foot boot (character's left, screen right when facing right)
    // Foot zone: y+54 to y+64 (10px height), so boots should be y+54 to y+64 (10px height)
    // Width: 8px + 4px border = 12px, positioned at x+10
    boxWithGradient(ctx,x+10,y+54,12,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    // Right foot boot (character's right, screen left when facing right)
    // Positioned at x+26
    boxWithGradient(ctx,x+26,y+54,12,10,fill,edge,colors.isLegendary,colors.gradientColors); 
    
    // Add boot details
    strokeRect(ctx,x+10,y+54,12,10,'#1b2430'); 
    strokeRect(ctx,x+26,y+54,12,10,'#1b2430'); 
    
    // Add boot sole details
    ctx.fillStyle = edge;
    ctx.fillRect(x+10,y+64,12,2); // Left sole
    ctx.fillRect(x+26,y+64,12,2); // Right sole
    
    // Add boot top details
    ctx.fillStyle = fill;
    ctx.fillRect(x+12,y+52,8,4); // Left boot top
    ctx.fillRect(x+28,y+52,8,4); // Right boot top
}

// Draw weapon with proper hand alignment and all weapon types
// equip parameter can be used to determine if this is mainhand or offhand
window.drawWeapon=function(ctx,x,y,flip,it,angle=0,equip=null,slotHint=null){ 
    if(!it) return; 
    const kind=weaponKindFromName(it.name)||it.subtype; 
    ctx.save(); 
    
    // Get weapon color based on elemental type (not rarity)
    const elementalType = it.elementalDamageType;
    const m = getWeaponColor(elementalType);
    
    // Get animation time for elemental effects
    const animTime = (Date.now() / 16) % 100; // Animation cycle based on time (16ms = ~60fps)
    
    // Calculate dynamic weapon length based on current attack reach
    let weaponLength = 70; // Default base length (matches base reach)
    if (window.player && window.player._reach) {
        weaponLength = Math.round(window.player._reach);
    }
    
    // Try to load and draw weapon image
    let imageDrawn = false;
    let scaledWidth = 0;
    let scaledHeight = 0;
    const weaponImg = loadWeaponImage(kind, it);
    
    if (weaponImg && weaponImg.complete && weaponImg.naturalWidth > 0) {
        // Image is loaded, use original dimensions (no scaling)
        const imgWidth = weaponImg.naturalWidth;
        const imgHeight = weaponImg.naturalHeight;
        
        // Use original image dimensions - no scaling applied
        scaledWidth = imgWidth;
        scaledHeight = imgHeight;
    } else {
        // Fallback height for rectangle weapons
        scaledHeight = 4;
    }
    
    // Get mainhand weapon image height for vertical positioning
    // Offhand will be positioned below mainhand by mainhand's height
    let mainhandImageHeight = 20; // Default fallback height (reasonable default)
    
    // Determine if this is offhand - check slotHint, it.slot, or if it matches equip.offhand
    let isOffhandForHeightCalc = false;
    if (slotHint === 'offhand') {
        isOffhandForHeightCalc = true;
    } else if (it.slot === 'offhand') {
        isOffhandForHeightCalc = true;
    } else if (equip && equip.offhand && (equip.offhand === it || equip.offhand.id === it.id)) {
        isOffhandForHeightCalc = true;
    }
    
    if (isOffhandForHeightCalc && equip && equip.mainhand) {
        // This is offhand, get mainhand height for vertical spacing
        // Use the same weapon length calculation for consistency
        let mainhandWeaponLength = weaponLength;
        if (window.player && window.player._reach) {
            mainhandWeaponLength = Math.round(window.player._reach);
        }
        
        const mainhandKind = weaponKindFromName(equip.mainhand.name) || equip.mainhand.subtype;
        const mainhandImg = loadWeaponImage(mainhandKind, equip.mainhand);
        if (mainhandImg && mainhandImg.complete && mainhandImg.naturalWidth > 0) {
            // Use original image height - no scaling
            mainhandImageHeight = mainhandImg.naturalHeight;
        } else {
            // Image not loaded or not available, use a reasonable estimate
            mainhandImageHeight = 20;
        }
    }
    
    // Determine which hand to draw the weapon in with proper positioning
    // Character is 48px wide (x to x+48)
    // flip parameter represents player's facing direction: false = facing right, true = facing left
    // IMPORTANT: When flip=true, drawCharacter already applied: translate(X+W, Y), scale(-1, 1), then X=0, Y=0
    // So we're in a flipped coordinate system where x=0 is the right edge in world coords
    let px, py;
    const W = 48; // Character width
    const baseVerticalPos = y + 43; // Base vertical position for mainhand
    
    // Both weapons align their edges with the player model based on player's facing direction
    // When flip=false (normal coords): x is the left edge of character, x+W is right edge
    // When flip=true (flipped coords): after drawCharacter's transform, x=0 is right edge in world, x=W is left edge
    if (flip) {
        // Player facing left: coordinate system is flipped by drawCharacter
        // drawCharacter does: translate(X+W, Y), scale(-1, 1), then X=0, Y=0
        // So x=0 is the right edge in world coordinates
        // We want weapons' right edges at player's left edge, but extend further left
        // In flipped coords, player's left edge is at x=W (which is x=48)
        // To move weapons closer to the player, decrease x in flipped coords
        // (smaller x in flipped coords = further right in world = closer to player)
        px = W - 6; // Position 6 pixels closer to player (moved from W-3 to W-6)
    } else {
        // Player facing right: normal coordinate system, x is left edge of character
        // We want weapons' left edges at player's right edge (x+W)
        // Move weapons closer to the player (reduced from -5 to -10)
        px = x + W - 10; // Position 10 pixels to the left of right edge (5 pixels closer)
    }
    
    // Vertical positioning: mainhand is above, offhand is below by mainhand height
    // Ensure mainhand is always higher (lower y value = higher on screen)
    // Increase mainhand vertical placement by 16 pixels (move it 16 pixels higher = decrease y by 16)
    const mainhandVerticalPos = baseVerticalPos - 16; // Mainhand moved 16 pixels higher
    
    // Determine if this is offhand weapon - check slotHint first, then it.slot, then check if it matches equip.offhand
    let isOffhand = false;
    if (slotHint === 'offhand') {
        isOffhand = true;
    } else if (it.slot === 'offhand') {
        isOffhand = true;
    } else if (equip && equip.offhand && equip.offhand === it) {
        isOffhand = true;
    } else if (equip && equip.offhand && equip.offhand.id === it.id) {
        isOffhand = true;
    }
    
    if(isOffhand) {
        // Offhand weapon - positioned exactly 16 pixels lower than mainhand
        py = mainhandVerticalPos + 16; // Exactly 16 pixels below mainhand
    } else {
        // Mainhand weapon - base vertical position moved 16 pixels higher
        py = mainhandVerticalPos; // Move 16 pixels higher (decrease y)
    }
    
    // Rotation origin should always be at the player position (where weapon attaches)
    // Regardless of facing direction, rotation should begin from the player
    // When facing right: weapon extends right from player, base is at 0
    // When facing left: coordinate system is flipped, but base should still be at 0 relative to player
    
    // Note: The coordinate system is already flipped by drawCharacter if flip=true
    // When drawCharacter flips, it does: translate(X+W, Y), scale(-1, 1), then X=0, Y=0
    // So we're already in a flipped coordinate system when flip=true
    // We need to mirror the image itself, but NOT flip the coordinate system again
    // To mirror the image, we use negative width in drawImage
    
    // Determine if weapon image needs to be mirrored
    // When facing right (flip=false): normal orientation, no mirror needed
    // When facing left (flip=true): image needs to be mirrored horizontally
    const needsImageMirror = flip; // Use player's facing direction directly
    
    // Rotation origin: should always be at 0 (the player position where weapon attaches)
    // This is the same regardless of facing direction because:
    // - When facing right: 0 is the left edge of weapon (base/handle at player)
    // - When facing left: after coordinate flip, 0 is still the base/handle at player
    // The key is that rotation always happens from the player's position (0)
    
    // Translate to weapon position first
    ctx.translate(px, py);
    
    // Apply rotation at the weapon position (which is relative to player position)
    // Both mainhand and offhand use the same swing angle, so they swing together
    // The rotation angle should be the same regardless of facing direction
    // When facing left, the coordinate system is flipped, so we don't need to reverse the angle
    ctx.rotate(angle);
    
    // Draw weapon image if loaded
    // Rotation is already applied at origin (0), so we just need to draw the image
    // When facing right: draw from 0 (base/handle) extending right
    // When facing left: need to offset so handle (left edge of image) aligns with rotation origin (0)
    // The key: rotation happens at 0 (player position), then we draw the image
    if (weaponImg && weaponImg.complete && weaponImg.naturalWidth > 0) {
        if (needsImageMirror) {
            // Facing left: draw with negative width to mirror the image
            // When using negative width, the RIGHT edge of image data is at the x coordinate
            // To get the handle (left edge of image) at 0, we need to draw from scaledWidth
            // This positions: right edge at scaledWidth, left edge (handle) at 0
            ctx.drawImage(weaponImg, scaledWidth, -scaledHeight / 2, -scaledWidth, scaledHeight);
        } else {
            // Facing right: normal orientation, draw extending right from base (0)
            // Handle (left edge of image) is at 0, tip extends to scaledWidth
            ctx.drawImage(weaponImg, 0, -scaledHeight / 2, scaledWidth, scaledHeight);
        }
        imageDrawn = true;
    } else if (weaponImg && weaponImg.src && !weaponImg.complete) {
        // Image is loading, draw a placeholder rectangle
        // Rotation is already applied, so draw from 0 (base) extending in the correct direction
        ctx.fillStyle = m.base;
        if (needsImageMirror) {
            // Facing left: draw from 0 extending left (negative width)
            ctx.fillRect(0, -2, -weaponLength, 4);
        } else {
            // Facing right: draw from 0 (base) extending right to weaponLength (tip)
            ctx.fillRect(0, -2, weaponLength, 4);
        }
    }
    
    // Fallback to rectangle drawing if image not available
    if (!imageDrawn) {
        // Use original rectangle drawing as fallback
        if (window.player && window.player._reach) {
            weaponLength = Math.round(window.player._reach);
        }
        
        // Handle edge alignment for rectangle fallback
        // Rotation origin: base always at 0 (closest edge to player)
        // When facing right: base at 0, tip at weaponLength
        // When facing left: base at 0, tip at -weaponLength (using negative width)
        // The base is always where the weapon attaches to the player
        let drawX = 0; // Base is always at 0 (rotation origin)
        let drawWidth = needsImageMirror ? -weaponLength : weaponLength;
        
        // Weapon tip calculation
        // When facing right: drawX=0, drawWidth=weaponLength, tip is at 0+weaponLength = weaponLength
        // When facing left: drawX=0, drawWidth=-weaponLength, tip is at 0-weaponLength = -weaponLength
        const weaponTip = drawX + drawWidth; // End of weapon
        
        if(kind==='Blade'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            ctx.fillStyle=m.edge; ctx.fillRect(drawX,-2,drawWidth,1); 
        } else if(kind==='Sword'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Dagger'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Axe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Axe head at tip of weapon
            if (needsImageMirror) {
                ctx.fillRect(weaponTip+4,-8,8,12); // Tip is at weaponTip (negative), so add 4 to get to tip
            } else {
                ctx.fillRect(weaponTip-4,-8,8,12); // Tip is at weaponTip, subtract 4 to center
            }
        } else if(kind==='Spear'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,3); 
            // Spear tip at end of weapon
            ctx.beginPath(); ctx.moveTo(weaponTip,-4); ctx.lineTo(weaponTip+6,0); ctx.lineTo(weaponTip,4); ctx.closePath(); ctx.fill(); 
        } else if(kind==='Mace'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Mace head at tip of weapon
            ctx.beginPath(); ctx.arc(weaponTip+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Saber'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Hammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Hammer head at tip of weapon
            ctx.beginPath(); ctx.arc(weaponTip+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Bow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Bow arc at tip of weapon
            ctx.beginPath(); ctx.arc(weaponTip,0,12,0,Math.PI*2); ctx.stroke(); 
        } else if(kind==='Crossbow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            ctx.fillRect(drawX-8,8,drawWidth+16,4); 
        } else if(kind==='Staff'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Wand'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Katana'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Rapier'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        } else if(kind==='Warhammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Warhammer head at tip of weapon
            ctx.beginPath(); ctx.arc(weaponTip+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Battleaxe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            // Battleaxe head at tip of weapon
            ctx.fillRect(weaponTip-4,-8,8,12); 
        } else if(kind==='Halberd'){ 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
            ctx.fillRect(drawX-8,8,drawWidth+10,4); 
        } else { 
            ctx.fillStyle=m.base; ctx.fillRect(drawX,-2,drawWidth,4); 
        }
    }
    
    // Draw elemental effects after the weapon base
    // Note: Effects are drawn in local coordinate system after transform
    // Need to account for weapon direction (flipped or not)
    if (elementalType) {
        ctx.save();
        const particleCount = 8;
        const particleSpeed = 0.3;
        
        // Determine effect positioning based on weapon image position
        // When facing right: weapon image drawn from 0 (handle) to scaledWidth (tip)
        // When facing left: weapon image drawn from scaledWidth to 0 with negative width
        // After negative width mirroring: handle (left edge of image) is at 0, tip extends to -scaledWidth
        // Effects should overlay exactly where the weapon image appears visually
        // Use scaledWidth for image-based weapons, weaponLength for fallback
        const weaponDisplayLength = (weaponImg && weaponImg.complete && weaponImg.naturalWidth > 0) ? scaledWidth : weaponLength;
        
        // Effects should match the weapon image visual position
        // When facing right: effects from 0 (handle) to weaponDisplayLength (tip)
        // When facing left: effects from 0 (handle) to -weaponDisplayLength (tip) - mirror the same way
        const effectStart = 0; // Always at handle (rotation origin)
        const effectEnd = needsImageMirror ? -weaponDisplayLength : weaponDisplayLength;
        const effectLength = Math.abs(effectEnd - effectStart); // Calculate once for all effects
        
        if (elementalType === 'Fire') {
            // Fire effect - orange/red/yellow particles that flicker upward
            for (let i = 0; i < particleCount; i++) {
                // Calculate offset along the weapon - particles use positive offsets (effectLength)
                const offset = effectStart + (i / particleCount) * effectLength;
                const yOffset = (animTime * particleSpeed + i * 0.5) % 10;
                const size = 2 + Math.sin(animTime * 0.1 + i) * 1;
                
                // Create gradient for fire
                const gradient = ctx.createLinearGradient(offset, -size, offset, size * 2);
                gradient.addColorStop(0, `rgba(255, 165, 0, ${0.8 - yOffset * 0.1})`); // Orange
                gradient.addColorStop(0.5, `rgba(255, 69, 0, ${0.6 - yOffset * 0.08})`); // Red-orange
                gradient.addColorStop(1, `rgba(255, 215, 0, ${0.4 - yOffset * 0.06})`); // Gold
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(offset, -yOffset, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Add glowing base glow
            ctx.globalAlpha = 0.4 + Math.sin(animTime * 0.2) * 0.2;
            ctx.shadowColor = '#ff4500';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ff6347';
            // Draw glow along the weapon - match particle positioning exactly
            // Particles use effectLength (always positive), and coordinate system is already flipped when facing left
            // So glow should always use positive width to match particles
            ctx.fillRect(effectStart, -scaledHeight / 2, effectLength, scaledHeight);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        } else if (elementalType === 'Acid') {
            // Acid effect - green bubbling particles
            for (let i = 0; i < particleCount; i++) {
                // Calculate offset along the weapon - particles use positive offsets (effectLength)
                const offset = effectStart + (i / particleCount) * effectLength;
                const yOffset = (Math.sin(animTime * 0.1 + i) * 3);
                const size = 1.5 + Math.cos(animTime * 0.15 + i) * 0.8;
                
                ctx.fillStyle = `rgba(50, 205, 50, ${0.7 + Math.sin(animTime * 0.1 + i) * 0.3})`; // Lime green
                ctx.beginPath();
                ctx.arc(offset, yOffset, size, 0, Math.PI * 2);
                ctx.fill();
                
                // Add darker core
                ctx.fillStyle = `rgba(34, 139, 34, 0.8)`; // Forest green
                ctx.beginPath();
                ctx.arc(offset, yOffset, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Acid dripping effect
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#32cd32';
            // Draw effect along the weapon - match particle positioning exactly
            // Particles use effectLength (always positive), and coordinate system is already flipped when facing left
            // So glow should always use positive width to match particles
            ctx.fillRect(effectStart, -scaledHeight / 2, effectLength, scaledHeight);
            ctx.globalAlpha = 1.0;
        } else if (elementalType === 'Lightning') {
            // Lightning effect - blue/white crackling electricity
            const sparks = 12;
            for (let i = 0; i < sparks; i++) {
                // Calculate offset along the weapon - particles use positive offsets (effectLength)
                const offset = effectStart + (i / sparks) * effectLength;
                const sparkOffset = (Math.sin(animTime * 0.3 + i * 0.5) * 4);
                const sparkSize = 1 + (Math.sin(animTime * 0.2 + i * 0.7) * 0.5 + 0.5) * 2; // Deterministic size
                
                // Bright white/blue sparks
                ctx.fillStyle = `rgba(135, 206, 250, ${0.9})`; // Light sky blue
                ctx.beginPath();
                ctx.arc(offset, sparkOffset, sparkSize, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = `rgba(255, 255, 255, ${0.7})`; // White core
                ctx.beginPath();
                ctx.arc(offset, sparkOffset, sparkSize * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Electric glow along the weapon
            ctx.globalAlpha = 0.3 + Math.sin(animTime * 0.5) * 0.2;
            ctx.shadowColor = '#00bfff';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#87ceeb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Draw line along weapon - from handle to tip
            ctx.moveTo(effectStart, 0);
            ctx.lineTo(effectEnd, 0);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        } else if (elementalType === 'Frost') {
            // Frost effect - blue/white ice crystals
            for (let i = 0; i < particleCount; i++) {
                // Calculate offset along the weapon - particles use positive offsets (effectLength)
                const offset = effectStart + (i / particleCount) * effectLength;
                const yOffset = (Math.cos(animTime * 0.08 + i * 0.7) * 2);
                const size = 1.5 + Math.sin(animTime * 0.12 + i) * 0.8;
                const rotation = animTime * 0.05 + i;
                
                ctx.save();
                ctx.translate(offset, yOffset);
                ctx.rotate(rotation);
                
                // Ice crystal - hexagon shape
                ctx.fillStyle = `rgba(173, 216, 230, ${0.8})`; // Light blue
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const angle = (Math.PI / 3) * j;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                
                // Bright white center
                ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
            
            // Frosty glow
            ctx.globalAlpha = 0.4 + Math.cos(animTime * 0.15) * 0.1;
            ctx.shadowColor = '#b0e0e6';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#add8e6';
            // Draw glow along the weapon - match particle positioning exactly
            // Particles use effectLength (always positive), and coordinate system is already flipped when facing left
            // So glow should always use positive width to match particles
            ctx.fillRect(effectStart, -scaledHeight / 2, effectLength, scaledHeight);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    }
    
    ctx.restore(); 
}

window.swingAngle=function(progress){ return (-Math.PI/3) + progress*(2*Math.PI/3); }

// Portal class for level transitions
window.Portal=function(id, x, y, targetLevel) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = 64;
    this.h = 64;
    this.targetLevel = targetLevel || 'sample_level';
    this.rotation = 0;
    this.rotationSpeed = 3.5; // radians per second (increased for more noticeable spin)
    this.pulsePhase = 0;
    this.pulseSpeed = 3; // pulses per second
};

Portal.prototype.update = function(dt) {
    // Faster rotation for cool spinning effect (3.5 radians per second = ~200 degrees per second)
    this.rotation += this.rotationSpeed * dt;
    // Keep rotation within 0-2π range to prevent overflow
    if (this.rotation > Math.PI * 2) {
        this.rotation -= Math.PI * 2;
    }
    this.pulsePhase += this.pulseSpeed * dt;
};

Portal.prototype.draw = function(ctx) {
    ctx.save();
    
    // Move to portal center
    ctx.translate(this.x + this.w/2, this.y + this.h/2);
    
    // Calculate pulse effect
    const pulseScale = 1 + Math.sin(this.pulsePhase * Math.PI * 2) * 0.15;
    ctx.scale(pulseScale, pulseScale);
    
    // Draw glowing background (rotates with portal)
    ctx.save();
    ctx.rotate(this.rotation);
    ctx.shadowColor = '#8A2BE2';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#4B0082';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Reset shadow for rings
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    
    // Draw outer ring - bright purple (rotates)
    ctx.save();
    ctx.rotate(this.rotation);
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // Draw middle ring - medium purple (rotates in opposite direction for cool effect)
    ctx.save();
    ctx.rotate(-this.rotation * 0.7);
    ctx.strokeStyle = '#8A2BE2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // Draw inner ring - light purple (rotates)
    ctx.save();
    ctx.rotate(this.rotation * 1.3);
    ctx.strokeStyle = '#DA70D6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // Draw center - bright white (rotates)
    ctx.save();
    ctx.rotate(this.rotation * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw animated sparkles (already positioned based on rotation)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + this.rotation;
        const radius = 26 + Math.sin(this.pulsePhase * Math.PI * 2 + i) * 6;
        const sparkleX = Math.cos(angle) * radius;
        const sparkleY = Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw "PORTAL" text (doesn't rotate, stays readable)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PORTAL', 0, -40);
    
    ctx.restore();
};

Portal.prototype.checkCollision = function(player) {
    return player.x < this.x + this.w &&
           player.x + player.w > this.x &&
           player.y < this.y + this.h &&
           player.y + player.h > this.y;
};

// world drops physics (with pickup delay)
window.worldDrops = [];

window.spawnDrop = function (x, y, item, vx = 0, vy = 0) {
  const d = { 
    id: Date.now() + Math.random(), // Unique ID for server sync
    x, y, vx, vy, item, pickRadius: 40, grounded: false, noPickup: 0.5 
  };
  // Default time-based guard too (either can be used by callers)
  d.noPickupUntil = performance.now() + DROP_PICKUP_DELAY_MS;
  worldDrops.push(d);
  
  // Send drop to server if connected
  if (window.isConnected && window.isConnected()) {
    wsSend({
      type: 'dropItem',
      x: x,
      y: y,
      item: item
    });
  }
  
  return d;
};

// Equipment management moved to equipment.js


// Player & Enemy classes
window.Player=function(id,x,y,binds,color){ 
    this.id=id;
    this.x=x;
    this.y=y;
    this.w=48;
    this.h=64;
    this.vx=0;
    this.vy=0;
    this.onGround=false;
    this.facing=1;
    this.color=color;
    this.binds=binds; 
    this.baseStats={Strength:5,Endurance:5,Quickness:5,Coordination:5,Focus:5,Health:100,Stamina:100,Mana:50}; 
    this.stats=Object.assign({},this.baseStats); 
    this.maxHealth=this.stats.Health; 
    this.health=this.maxHealth; 
    this.maxMana=this.stats.Mana;
    this.mana=this.stats.Mana; 
    this.jumpCount=0; 
    this.canWallJumpExtra=2; 
    this.wallTouchTicks=0; 
    this.attackCooldown=0; 
    this.attackAnimTime=0; 
    this.pyreals=0; 
    this.anim={timer:0,index:0}; 
    this._lastHealthShown=-1; 
    this._lastMaxHealthShown=-1; 
    this._damageTimer=0; 
    this._regenActive=false;
    
    // Default spawn location
    this.defaultSpawnX = 80;
    this.defaultSpawnY = 0;
    
    // Respawn state
    this.isDead = false;
    this.respawnTimer = 0;
    this.respawnDelay = 1.5; // 1.5 seconds to respawn (reduced from 3.0)
    this.deathMessageTimer = 0; // Timer for showing death message
};

Player.prototype.applyEquipment=function(){ 
    const s=Object.assign({},this.baseStats); 
    for(const k in window.equip){ 
        const it=window.equip[k]; 
        if(it && it.stats){ 
            for(const st in it.stats) s[st]+=it.stats[st]; 
        }
    } 
    this.stats=s; 
    
    // Store old maxHealth to preserve health percentage if needed
    const oldMaxHealth = this.maxHealth;
    this.maxHealth = Math.max(1, s.Health + s.Endurance*8);
    
    // Ensure health is valid after maxHealth changes
    // If health exceeds new maxHealth, cap it. Otherwise preserve current health.
    if(this.health > this.maxHealth) {
        this.health = this.maxHealth;
    } else if(oldMaxHealth > 0 && this.maxHealth > oldMaxHealth) {
        // If maxHealth increased, preserve health percentage for better UX
        const healthPercent = this.health / oldMaxHealth;
        const newHealth = Math.floor(this.maxHealth * healthPercent);
        // Only apply if it results in more health (don't reduce health when gaining better armor)
        if(newHealth > this.health) {
            this.health = newHealth;
        }
    }
    
    // Update maxMana from stats.Mana (similar to maxHealth)
    // Store old maxMana to preserve mana percentage if needed
    const oldMaxMana = this.maxMana || s.Mana;
    this.maxMana = Math.max(1, s.Mana);
    
    // Ensure mana is valid after maxMana changes
    // If mana exceeds new maxMana, cap it. Otherwise preserve current mana.
    if(this.mana !== undefined && this.mana > this.maxMana) {
        this.mana = this.maxMana;
    } else if(oldMaxMana > 0 && this.maxMana > oldMaxMana && this.mana !== undefined) {
        // If maxMana increased, preserve mana percentage for better UX
        const manaPercent = this.mana / oldMaxMana;
        const newMana = Math.floor(this.maxMana * manaPercent);
        // Only apply if it results in more mana (don't reduce mana when gaining better equipment)
        if(newMana > this.mana) {
            this.mana = newMana;
        }
    } else if(this.mana === undefined) {
        // Initialize mana to maxMana if not set
        this.mana = this.maxMana;
    }
    
    // Update weapon info when equipment changes
    if (typeof window.updateWeaponInfo === 'function') {
        window.updateWeaponInfo();
    }
};

Player.prototype.takeDamage=function(a){ 
    this.health=Math.max(0,this.health-a); 
    this._damageTimer=0; 
    this._regenActive=false; 
    
    // Trigger damage flash effect
    this.damageFlashTimer = 0.3; // Flash for 0.3 seconds
    
    // Check if player should die (health reaches 0)
    if (this.health <= 0) {
        this.die();
    }
};

Player.prototype.die = function() {
    if (this.isDead) return; // Prevent multiple death calls
    
    this.isDead = true;
    this.respawnTimer = this.respawnDelay;
    this.deathMessageTimer = 3.0; // Show death message for 3 seconds
    this.health = 0;
    
    // Stop all movement
    this.vx = 0;
    this.vy = 0;
    
    // Find and drop the most valuable item from inventory
    this.dropMostValuableItem();
    
    // Log death
    if (window.log) {
        window.log(this.id + ' has died! Respawning in ' + this.respawnDelay + ' seconds...');
    } else {
        console.log(this.id + ' has died! Respawning in ' + this.respawnDelay + ' seconds...');
    }
    
    // Send death notification to server if connected
    if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
        window.wsSend({
            type: 'playerDeath',
            playerId: this.id
        });
    }
};

Player.prototype.respawn = function() {
    this.isDead = false;
    this.respawnTimer = 0;
    this.deathMessageTimer = 0; // Reset death message timer
    this.health = this.maxHealth;
    
    // Always respawn at the starting location
    this.x = this.defaultSpawnX;
    this.y = this.defaultSpawnY;
    
    // Reset all movement and state
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpCount = 0;
    this.wallTouchTicks = 0;
    this.attackCooldown = 0;
    this.attackAnimTime = 0;
    
    // Initialize health regeneration system for respawn
    // Set damage timer to 31 seconds to allow immediate health regeneration
    // (health regeneration starts after 30 seconds of no damage)
    this._damageTimer = 31;
    this._regenActive = true;
    
    // Log respawn
    if (window.log) {
        window.log(this.id + ' has respawned at the starting location (x: ' + this.x + ', y: ' + this.y + ').');
    } else {
        console.log(this.id + ' has respawned at the starting location (x: ' + this.x + ', y: ' + this.y + ').');
    }
    
    // Send respawn notification to server if connected
    if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
        window.wsSend({
            type: 'playerRespawn',
            playerId: this.id,
            x: this.x,
            y: this.y,
            health: this.health,
            maxHealth: this.maxHealth
        });
    }
};

Player.prototype.update=function(dt){ 
    // Handle death and respawn
    if (this.isDead) {
        this.respawnTimer -= dt;
        this.deathMessageTimer = Math.max(0, this.deathMessageTimer - dt); // Decrease death message timer
        if (this.respawnTimer <= 0) {
            this.respawn();
        } else {
            // Don't process normal movement while dead
            return;
        }
    }
    
    this.applyEquipment(); 
    const left=window.keys[window.binds.left], right=window.keys[window.binds.right], jump=window.keys[window.binds.jump], attackKey=window.keys[window.binds.attack]; 
    const dir=(right?1:0)-(left?1:0); 
    if(dir!==0) this.facing = dir>0?1:-1; 
    const accel=this.onGround?3000:2000; 
    const baseSpeed = 240; 
    const speed = baseSpeed * (1 + (this.stats.Quickness-5)*0.06); 
    const desired = dir*speed; 
    const dv = desired - this.vx; 
    const maxCh = accel*dt; 
    this.vx += clamp(dv,-maxCh,maxCh);
    
    if(jump && !this._prevJump){ 
        if(this.onGround){ 
            // Base jump velocity + Strength bonus (each point of Strength adds 8 to jump velocity - reduced from 20)
            const baseJumpVelocity = -620;
            const strengthBonus = (this.stats.Strength - 5) * 8;
            this.vy = baseJumpVelocity - strengthBonus; 
            this.jumpCount=0; 
        } else if(this.wallTouchTicks>0 && this.jumpCount < this.canWallJumpExtra){ 
            // Wall jump also benefits from Strength (reduced bonus)
            const baseWallJumpVelocity = -540;
            const strengthBonus = (this.stats.Strength - 5) * 6;
            this.vy = baseWallJumpVelocity - strengthBonus; 
            this.vx=-this.facing*360; 
            this.jumpCount++; 
            this.wallTouchTicks=0; 
        } 
    } 
    this._prevJump = jump; 
    this.vy += GRAV*dt; 
    this.x += this.vx*dt; 
    this.y += this.vy*dt; 
    this.onGround=false; 
    this.wallTouchTicks=0; 
    
    // Floor tile collision detection (using level data)
    const floors = window.gameState && window.gameState.floors ? window.gameState.floors : [];
    let onFloor = false;
    for(const floor of floors){ 
        if(this.x+this.w > floor.x && this.x < floor.x + floor.width && this.y + this.h > floor.y && this.y < floor.y + floor.height){ 
            const overlapX=Math.min(this.x+this.w - floor.x, floor.x+floor.width - this.x); 
            const overlapY=Math.min(this.y+this.h - floor.y, floor.y+floor.height - this.y); 
            if(overlapY < overlapX){ 
                if(this.vy>0){ 
                    this.y = floor.y - this.h; 
                    this.vy=0; 
                    this.onGround=true; 
                    this.jumpCount=0; 
                    onFloor = true;
                } else { 
                    this.y = floor.y + floor.height; 
                    this.vy = 0; 
                } 
            } else { 
                if(this.x < floor.x) this.x = floor.x - this.w; 
                else this.x = floor.x + floor.width; 
                this.vx = 0; 
                this.wallTouchTicks = 6; 
            } 
        } 
    }
    
    // Fallback to old ground collision if no floor collision and floors aren't loaded yet
    if (!onFloor && (!window.gameState || !window.gameState.floors || window.gameState.floors.length === 0)) {
        const groundY = window.GROUND_Y || 550;
        if (this.y >= groundY - this.h) {
            this.y = groundY - this.h;
            this.vy = 0;
            this.onGround = true;
            this.jumpCount = 0;
        }
    }
    
    // Old platform collision removed - only floor tiles from level JSON are used 
    
    if(this.wallTouchTicks>0) this.wallTouchTicks--; 
    this.x = clamp(this.x,0,WORLD_W-this.w); 
    
    // Fall damage and respawn at default location
    if(this.y > VIEW_H+200){ 
        this.x=this.defaultSpawnX; 
        this.y=this.defaultSpawnY; 
        this.vx=0; 
        this.vy=0; 
        this.takeDamage(10); 
        if(this.health<1) this.health=1; 
        if (window.log) {
            window.log(this.id+' fell. Respawned at default location.'); 
        } else {
            console.log(this.id+' fell. Respawned at default location.'); 
        }
    } 
    
    this.attackCooldown = Math.max(0,this.attackCooldown-dt); 
    if(attackKey && this.attackCooldown<=0){ 
        this.performAttack(); 
        this.attackCooldown = Math.max(0.2, 0.35 - (this.stats.Quickness-5)*0.01); 
    } 
    if(this.attackAnimTime>0) this.attackAnimTime = Math.max(0,this.attackAnimTime - dt);
    
    this._damageTimer += dt; 
    if(this.health < this.maxHealth && this._damageTimer > 30){ 
        const steps = Math.floor(this.stats.Endurance / 10); 
        const pctPerSec = 1 + (0.1 * steps); 
        const rate = (pctPerSec/100) * this.maxHealth; 
        this.health = Math.min(this.maxHealth, this.health + rate*dt); 
        if(this.health >= this.maxHealth){ 
            this._regenActive=false; 
        } 
    } 
};

Player.prototype.calculateReach = function() {
    // Calculate reach based on weapon type and level
    let baseReach = 23; // Base reach for unarmed (1/3 of 70)
    
    if (window.equip && window.equip.mainhand) {
        const weapon = window.equip.mainhand;
        const weaponType = window.weaponKindFromName(weapon.name) || weapon.subtype || 'Sword';
        
        // Weapon type-specific base reach values (1/3 of original values)
        switch (weaponType) {
            case 'Spear':
            case 'Halberd':
                baseReach = 40; // Longest reach for polearms (1/3 of 120)
                break;
            case 'Staff':
                baseReach = 37; // Long staff reach (1/3 of 110)
                break;
            case 'Sword':
            case 'Katana':
            case 'Rapier':
            case 'Saber':
            case 'Blade':
                baseReach = 28; // Standard sword reach (1/3 of 85)
                break;
            case 'Axe':
            case 'Battleaxe':
            case 'Warhammer':
            case 'Hammer':
            case 'Mace':
                baseReach = 25; // Shorter reach for heavy weapons (1/3 of 75)
                break;
            case 'Dagger':
                baseReach = 18; // Shortest reach for daggers (1/3 of 55)
                break;
            case 'Bow':
            case 'Crossbow':
            case 'Wand':
                baseReach = 23; // Ranged weapons use base reach (1/3 of 70)
                break;
            default:
                baseReach = 27; // Default for unknown weapons (1/3 of 80)
        }
        
        // No bonuses - just use base reach for weapon type
        this._reach = baseReach;
    } else {
        // Unarmed - just base reach
        this._reach = baseReach;
    }
};

Player.prototype.performAttack=function(){ 
    // Check if we have a ranged weapon equipped
    if (window.equip && window.equip.mainhand) {
        // Try to get weapon kind from name first, then fall back to subtype
        const weaponKind = window.weaponKindFromName(window.equip.mainhand.name) || 
                          window.equip.mainhand.subtype ||
                          (window.equip.mainhand.name ? window.equip.mainhand.name.split(' ')[0] : null);
        
        if (weaponKind === 'Bow' || weaponKind === 'Crossbow' || weaponKind === 'Wand') {
            // Ranged weapons shoot projectiles instead of melee attacks
            this.shootProjectile(weaponKind);
            return;
        }
    }
    
    // Melee weapons use normal attack
    this.attackAnimTime = 0.25; 
    this._attackApplied=false; 
    
    // Calculate reach based on current equipment
    this.calculateReach();
    
    // Weapon info display removed - no longer showing reach information
};

Player.prototype.shootProjectile = function(weaponType) {
    if (!window.isConnected || !window.isConnected() || !window.wsSend) {
        console.warn('Cannot shoot projectile - not connected to server');
        return;
    }
    
    // Calculate damage based on weapon level and stats
    const baseDamage = 8 + (window.equip.mainhand ? window.equip.mainhand.level * 2 : 0);
    let damage = baseDamage;
    
    if (weaponType === 'Bow' || weaponType === 'Crossbow') {
        // Bow and Crossbow damage scales with Coordination
        damage += (window.player.stats.Coordination - 5) * 1.5;
    } else if (weaponType === 'Wand') {
        // Wand damage scales with Focus
        damage += (window.player.stats.Focus - 5) * 2;
    }
    
    // Send projectile creation message to server
    const message = {
        type: 'shootProjectile',
        weaponType: weaponType,
        direction: window.player.facing > 0 ? 'right' : 'left',
        damage: Math.round(damage)
    };
    
    window.wsSend(message);
    
    // Set a short cooldown for ranged attacks
    this.attackCooldown = Math.max(0.3, 0.5 - (this.stats.Quickness - 5) * 0.01);
};

Player.prototype.dropMostValuableItem = function() {
    // Check if we have access to inventory and equipment
    if (!window.bag && !window.equip) {
        console.log('No inventory or equipment available for item drop');
        return;
    }
    
    let mostValuableItem = null;
    let highestValue = 0;
    let itemSource = null; // 'inventory' or 'equipment'
    let itemIndex = -1;
    let itemSlot = null;
    
    // Check inventory for most valuable item
    if (window.bag && Array.isArray(window.bag)) {
        for (let i = 0; i < window.bag.length; i++) {
            const item = window.bag[i];
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
    if (window.equip && typeof window.equip === 'object') {
        for (const slot in window.equip) {
            const item = window.equip[slot];
            if (item && item.value && item.value > highestValue) {
                highestValue = item.value;
                mostValuableItem = item;
                itemSource = 'equipment';
                itemIndex = -1;
                itemSlot = slot;
            }
        }
    }
    
    // If we found a valuable item, drop it
    if (mostValuableItem && highestValue > 0) {
        console.log(`Dropping most valuable item: ${mostValuableItem.name} (value: ${highestValue})`);
        
        // Remove item from source
        if (itemSource === 'inventory') {
            window.bag[itemIndex] = null;
            // Update server
            if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
                window.wsSend({
                    type: 'inventoryUpdate',
                    inventory: window.bag
                });
            }
        } else if (itemSource === 'equipment') {
            window.equip[itemSlot] = null;
            // Don't send equipUpdate here - let the server handle equipment updates
            // The server is authoritative for equipment state
        }
        
        // Create world drop at player's current position
        const drop = {
            id: Date.now() + Math.random(),
            x: this.x + this.w/2,
            y: this.y + this.h/2,
            item: mostValuableItem,
            vx: (Math.random() - 0.5) * 100,
            vy: -Math.random() * 100 - 200,
            pickRadius: 40,
            grounded: false,
            noPickupUntil: performance.now() + DROP_PICKUP_DELAY_MS
        };
        
        // Add to world drops
        if (!window.worldDrops) window.worldDrops = [];
        window.worldDrops.push(drop);
        
        // Send drop to server if connected
        if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
            window.wsSend({
                type: 'dropItem',
                x: drop.x,
                y: drop.y,
                item: mostValuableItem
            });
        }
        
        // Log the drop
        if (window.log) {
            window.log(`Dropped ${mostValuableItem.name} due to death!`);
        } else {
            console.log(`Dropped ${mostValuableItem.name} due to death!`);
        }
    } else {
        console.log('No valuable items to drop on death');
    }
};

window.Enemy=function(x,y,level){ 
  this.id = Date.now() + Math.random(); // Unique ID for server sync
  this.x=x;this.y=y;this.level=level;this.w=48;this.h=64;this.maxHealth=20+level*12;this.health=this.maxHealth;this.vx=0;this.vy=0;this.dead=false; 
  this.state='chase'; this.t=0; this.facing=1; this.attackWind=0.35; this.attackSwing=0.18; this.cool=0; this.anim={timer:0,index:0}; 
  
  // Give each enemy unique colors for their appearance
  if (window.generateNPCColors) {
    this.colors = window.generateNPCColors();
  }
};
Enemy.prototype.update=function(dt){ if(this.dead) return; const dx=window.player.x-this.x; this.facing = dx>0?1:-1; this.vy += GRAV*dt; this.y += this.vy*dt; for(const p of platforms){ if(this.x+this.w > p.x && this.x < p.x+p.w && this.y+this.h > p.y && this.y < p.y+p.h){ if(this.vy>0){ this.y = p.y - this.h; this.vy=0; } } }
  if(this.state==='chase'){
    const speed = 120 + this.level*6; this.vx = clamp(this.vx + Math.sign(dx)*60*dt, -speed, speed); this.x += this.vx*dt;
    if(Math.abs(dx)<120 && Math.abs(window.player.y-this.y)<30 && this.cool<=0){ this.state='windup'; this.t=this.attackWind; this.vx=0; }
  } else if(this.state==='windup'){
    this.vx *= 0.8; this.x += this.vx*dt; this.t -= dt; if(this.t<=0){ this.state='attack'; this.t=this.attackSwing; this._hit=false; }
  } else if(this.state==='attack'){
    this.t -= dt; const progress = 1 - (this.t/this.attackSwing); if(!this._hit && progress>0.45){ if(Math.hypot((this.x+this.w/2)-(window.player.x+window.player.w/2),(this.y+this.h/2)-(window.player.y+window.player.h/2)) < 60){ window.player.takeDamage(12 + this.level*2); this._hit=true; } }
    if(this.t<=0){ this.state='recover'; this.t=0.25; this.cool=0.6; }
  } else if(this.state==='recover'){
    this.t -= dt; if(this.t<=0) this.state='chase';
  }
  if(this.cool>0) this.cool-=dt;
};
Enemy.prototype.takeDamage=function(a){ 
    this.health -= a; 
    // Trigger damage flash effect
    this.damageFlashTimer = 0.3; // Flash for 0.3 seconds
    if(this.health<=0) this.die(); 
};
Enemy.prototype.die=function(){ 
  this.dead=true; 
  const dropCount = randInt(1,2); 
  for(let i=0;i<dropCount;i++){ 
    const t = Math.random()<0.6? 'weapon': Math.random()<0.85? 'armor':'currency'; 
    const it = window.makeItem(t,this.level); 
    const vx = randInt(-140,140); 
    const vy = -randInt(260,380); 
    window.spawnDrop(this.x+this.w/2, this.y+10, it, vx, vy); 
  } 
  window.log('Enemy L'+this.level+' died and dropped loot');
  
  // Send enemy death to server if connected
  if (window.isConnected && window.isConnected()) {
    wsSend({
      type: 'enemyDeath',
      id: this.id || Date.now() + Math.random()
    });
  }
};

// Function to generate random colors for NPCs with expanded color ranges
window.generateNPCColors = function() {
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
};

// Function to get current equipment colors for the player
window.getEquipmentColors = function() {
    if (!window.equip) return {};
    
    const colors = {};
    
    // Check each equipment slot for items and extract their colors
    for (const [slot, item] of Object.entries(window.equip)) {
        if (item && item.type) {
            // Generate color based on item rarity and type
            if (item.type === 'weapon') {
                colors[slot] = {
                    type: 'weapon',
                    rarity: item.rarity || 'Common',
                    material: window.weaponKindFromName ? window.weaponKindFromName(item.name) : 'Sword'
                };
            } else if (item.type === 'armor') {
                colors[slot] = {
                    type: 'armor',
                    rarity: item.rarity || 'Common',
                    slot: item.slot || 'chest',
                    material: window.getArmorMaterial ? window.getArmorMaterial(item.name) : 'metal'
                };
            }
        }
    }
    
    return colors;
};

// Function to get armor material type from item name
window.getArmorMaterial = function(itemName) {
    if (!itemName) return 'metal';
    
    const nm = itemName.toLowerCase();
    if (nm.includes('leather') || nm.includes('hide')) return 'leather';
    if (nm.includes('cloth') || nm.includes('silk') || nm.includes('robe')) return 'cloth';
    if (nm.includes('dragonhide')) return 'dragonhide';
    if (nm.includes('shadowweave')) return 'shadowweave';
    if (nm.includes('celestial')) return 'celestial';
    if (nm.includes('void-touched')) return 'voidTouched';
    if (nm.includes('gold') || nm.includes('royal')) return 'gold';
    if (nm.includes('silver') || nm.includes('mithril')) return 'silver';
    if (nm.includes('crystal') || nm.includes('prismatic')) return 'crystal';
    if (nm.includes('fire') || nm.includes('flame')) return 'fire';
    if (nm.includes('ice') || nm.includes('frost')) return 'ice';
    if (nm.includes('chain') || nm.includes('mail')) return 'chain';
    
    return 'metal'; // Default
};

})();
