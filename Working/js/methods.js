// methods.js — utilities, items, physics, sprites, entities
(function(){
'use strict';

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
        el.innerHTML = `<div>${new Date().toLocaleTimeString()} - ${msg}</div>` + el.innerHTML; 
        
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
window.RARITIES=['Common','Uncommon','Epic','Legendary'];
window.RARITY_CLASS={ 'Common':'r-common','Uncommon':'r-uncommon','Epic':'r-epic','Legendary':'r-legendary' };
window.STAT_NAMES=['Strength','Endurance','Quickness','Coordination','Focus','Health','Stamina','Mana'];
const namePrefixes=['Worn','Ancient','Copper','Iron','Glinting','Shadow','Brass','Elder'];
const weaponNames=['Blade','Sword','Dagger','Axe','Saber','Mace','Spear','Hammer','Bow','Crossbow','Staff','Wand','Katana','Rapier','Warhammer','Battleaxe','Halberd'];
window.armorSlotName={ head:['Helmet','Cap','Helm','Crown','Circlet'], chest:['Cuirass','Chestplate','Tunic','Robe','Vest'], legs:['Greaves','Leggings','Pants','Chausses','Breeches'], feet:['Boots','Sabatons','Shoes','Sandals','Greaves'], hands:['Gauntlets','Gloves','Mittens'], wrists:['Bracers','Wristguards','Vambraces'], waist:['Belt','Girdle','Sash'], neck:['Amulet','Pendant','Collar'], shoulders:['Pauldrons','Shoulderpads','Mantle'] };
const nameSuffixes=['of Healing','of Quickness','of Might','of Focus','of the Fox','of Fortitude','of Sparks'];
window.weaponKindFromName=function(name){ 
    if(!name) return null; 
    const n=name.toLowerCase(); 
    if(n.includes('blade')) return 'Blade'; 
    if(n.includes('sword')) return 'Sword'; 
    if(n.includes('dagger')) return 'Dagger'; 
    if(n.includes('axe')) return 'Axe'; 
    if(n.includes('saber')) return 'Saber'; 
    if(n.includes('mace')) return 'Mace'; 
    if(n.includes('spear')) return 'Spear'; 
    if(n.includes('hammer')) return 'Hammer'; 
    if(n.includes('bow')) return 'Bow'; 
    if(n.includes('crossbow')) return 'Crossbow'; 
    if(n.includes('staff')) return 'Staff'; 
    if(n.includes('wand')) return 'Wand'; 
    if(n.includes('katana')) return 'Katana'; 
    if(n.includes('rapier')) return 'Rapier'; 
    if(n.includes('warhammer')) return 'Warhammer'; 
    if(n.includes('battleaxe')) return 'Battleaxe'; 
    if(n.includes('halberd')) return 'Halberd'; 
    return null; 
}

// icon painter
const ICON_CACHE=new Map(), ICON_IMG_CACHE=new Map();
function metal(){ return {base:'#d5dceb',edge:'#9eb0c8',hi:'#edf1f8'}; }
function leather(){ return {base:'#a57544',edge:'#6b4423',hi:'#c9925f'}; }
function cloth(){ return {base:'#6ea2d6',edge:'#3d688d',hi:'#9bc4ed'}; }
function special(){ return {base:'#8b5cf6',edge:'#6d28d9',hi:'#a78bfa'}; }
function dragonhide(){ return {base:'#dc2626',edge:'#991b1b',hi:'#ef4444'}; }
function shadowweave(){ return {base:'#1f2937',edge:'#111827',hi:'#374151'}; }
function celestial(){ return {base:'#fbbf24',edge:'#d97706',hi:'#fcd34d'}; }
function voidTouched(){ return {base:'#7c3aed',edge:'#5b21b6',hi:'#a78bfa'}; }
function rarityFrame(g,rar){ g.fillStyle = rar==='Legendary'? '#ff9a1c' : rar==='Epic'? '#b37bff' : rar==='Uncommon'? '#3da5ff' : '#ffffff'; g.fillRect(0,0,64,64); }
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
        
        if(it.type==='weapon'){
            const kind=weaponKindFromName(it.name)||it.subtype||'melee'; 
            const m=metal(r);
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
    
        return dataURL;
        
    } catch (error) {
        console.error(`[${Date.now()}] Error in drawIcon:`, error);
        return '';
    }
}
function iconKey(it){ 
    if(!it || typeof it !== 'object' || !it.type || !it.rarity || !it.name) return 'empty'; 
    const b=it.type==='armor'? it.slot: it.type==='weapon'? (weaponKindFromName(it.name)||it.subtype): it.type; 
    return `${it.type}|${b}|${it.rarity}|${(it.name||'').split(' ')[1]||''}`; 
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
        

        const url = drawIcon(it); 

        
        ICON_CACHE.set(key,url); 
        return url; 
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

// Normalize items to ensure consistent structure for both local and server items
window.normalizeItem = function(item) {
    if (!item) return null;
    
    // Ensure all required properties exist
    const normalized = {
        id: item.id || window.randId(),
        name: item.name || 'Unknown Item',
        type: item.type || 'unknown',
        rarity: item.rarity || 'Common',
        short: item.short || item.name || 'An item',
        value: item.value || 0,
        icon: null, // Will be generated below
        stats: item.stats || {},
        level: item.level || 1
    };
    
    // Add type-specific properties
    if (item.type === 'weapon') {
        normalized.dmgMin = item.dmgMin || 1;
        normalized.dmgMax = item.dmgMax || 2;
        normalized.subtype = item.subtype || window.weaponKindFromName(item.name);
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
        const item = {id:randId(),name,rarity,short:`${subtype} (L${level})`,type:'weapon',subtype,level,stats,dmgMin,dmgMax,value}; 
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
function strokeRect(ctx,x,y,w,h,c){ ctx.strokeStyle=c; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); }

// Draw helmet with proper head alignment and expanded colors
window.drawHelmet=function(ctx,x,y,it){ 
    if(!it) return; 
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Determine helmet style based on name
    if(nm.includes('crown') || nm.includes('royal')) {
        // Crown style - positioned on top of head with 2px wider border
        // Head zone: y+2 to y+14 (12px height), so crown should be y+0 to y+16 (16px height)
        // Width: 20px + 4px border = 24px, centered on x+12
        box(ctx,x+12,y+0,24,16,fill,edge); 
        strokeRect(ctx,x+12,y+0,24,16,'#1b2430'); 
        
        // Crown jewels
        ctx.fillStyle = edge;
        ctx.fillRect(x+18,y+1,4,2); // Center jewel
        ctx.fillRect(x+22,y+1,4,2); // Right jewel
        ctx.fillRect(x+14,y+1,4,2); // Left jewel
        
    } else if(nm.includes('circlet') || nm.includes('band')) {
        // Circlet style - positioned around head with 2px wider border
        // Width: 16px + 4px border = 20px, centered on x+14
        box(ctx,x+14,y+0,20,6,fill,edge); 
        strokeRect(ctx,x+14,y+0,20,6,'#1b2430'); 
        
        // Circlet gem
        ctx.fillStyle = edge;
        ctx.fillRect(x+22,y+1,4,4); // Center gem
        
    } else {
        // Standard helmet - positioned on head with 2px wider border
        // Width: 20px + 4px border = 24px, centered on x+12
        box(ctx,x+12,y+0,24,12,fill,edge); 
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Left shoulder (character's left, screen right when facing right) - positioned higher and more outward
    // Shoulder zone: y+16 to y+22 (6px height), so shoulders should be y+14 to y+24 (10px height)
    // Width: 10px + 4px border = 14px, positioned at x+7 (moved 3px to the right)
    box(ctx,x+7,y+14,14,10,fill,edge); 
    // Right shoulder (character's right, screen left when facing right) - positioned higher and more outward
    // Positioned at x+29 (moved 3px to the right)
    box(ctx,x+29,y+14,14,10,fill,edge); 
    
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Left wrist (character's left, screen right when facing right) - positioned on left arm
    // Width: 7px + 4px border = 11px, positioned at x+4 (moved 3.5px toward center to maintain balance)
    // Moved down 3px from y+18 to y+21
    box(ctx,x+7.5,y+21,11,10,fill,edge); 
    // Right wrist (character's right, screen left when facing right) - positioned on right arm
    // Positioned at x+30.5 (moved 3.5px toward center to maintain balance)
    // Moved down 3px from y+18 to y+21
    box(ctx,x+30.5,y+21,11,10,fill,edge); 
    
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Main belt around waist - positioned at waist level with 2px wider border
    // Waist zone: y+32 to y+36 (4px height), so belt should be y+30 to y+36 (6px height)
    // Width: 13px + 4px border = 17px, centered on x+15 (moved 7px toward center to maintain balance)
    box(ctx,x+15,y+30,17,6,fill,edge); 
    
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else if(nm.includes('pearl') || nm.includes('gem')) {
        fill = '#f0f8ff'; edge = '#e6e6fa';
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
         // Main necklace/neck item - positioned at bottom of head, much smaller
     // Head ends at y+14, so neck item should be y+14 to y+20 (6px height)
     // Width: 8px + 2px border = 10px, centered on x+19
     box(ctx,x+19,y+14,10,6,fill,edge); 
     
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Left leg armor (character's left, screen right when facing right)
    // Leg zone: y+36 to y+54 (18px height), so leg armor should be y+34 to y+52 (18px height)
    // Width: 8px + 4px border = 12px, positioned at x+11
    box(ctx,x+11,y+34,12,18,fill,edge); 
    // Right leg armor (character's right, screen left when facing right)
    // Positioned at x+25
    box(ctx,x+25,y+34,12,18,fill,edge); 
    
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
window.drawAllEquipment=function(ctx,x,y,equip,isPlayer=false){
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
    
    // Draw weapons last (on top) - mainhand is drawn separately in drawCharacter for swing angle
    if(equip.offhand) window.drawWeapon(ctx,x,y,false,equip.offhand);
}

// Draw chest armor with proper alignment and expanded colors
window.drawChest=function(ctx,x,y,it){ 
    if(!it) return; 
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Main chest armor - moved down 2px and 4px shorter
    // Chest zone: y+14 to y+34 (20px height), so armor should be y+14 to y+28 (14px height)
    // Width: 16px + 4px border = 20px, centered on x+14 (center of 48px character)
    box(ctx,x+14,y+14,20,14,fill,edge); 
    
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Left hand glove (character's left, screen right when facing right) - moved toward center 5px total, half as tall, and moved up 7px total
    // Arm zone: y+20 to y+36 (16px height), so gloves should be y+31 to y+41 (10px height - half of 20px, moved up 7px total)
    // Width: 4px + 4px border = 8px, positioned at x+8 (moved 5px toward center from x+3)
    box(ctx,x+8,y+31,8,10,fill,edge); 
    // Right hand glove (character's right, screen left when facing right) - positioned at x+32 (moved 5px toward center from x+37)
    box(ctx,x+32,y+31,8,10,fill,edge); 
    
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
    const nm=(it.name||'').toLowerCase();
    let fill, edge;
    
    // Expanded material detection with more color variety
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
    } else {
        fill = '#d5dceb'; edge = '#9eb0c8';
    }
    
    // Left foot boot (character's left, screen right when facing right)
    // Foot zone: y+54 to y+64 (10px height), so boots should be y+54 to y+64 (10px height)
    // Width: 8px + 4px border = 12px, positioned at x+10
    box(ctx,x+10,y+54,12,10,fill,edge); 
    // Right foot boot (character's right, screen left when facing right)
    // Positioned at x+26
    box(ctx,x+26,y+54,12,10,fill,edge); 
    
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
window.drawWeapon=function(ctx,x,y,flip,it,angle=0){ 
    if(!it) return; 
    const kind=weaponKindFromName(it.name)||it.subtype; 
    ctx.save(); 
    
    // Determine which hand to draw the weapon in with proper positioning
    let px, py;
    if(it.slot === 'offhand') {
        // Offhand weapon goes in left hand (character's left, screen right when facing right)
        // Position at same horizontal as mainhand but 15px lower vertically (increased from 10px)
        px = flip ? x+8 : x+40; // Same horizontal position as mainhand, moved 10px further from center
        py = y+43; // 15px lower than mainhand (y+28 + 15)
    } else {
        // Mainhand weapon goes in right hand (character's right, screen left when facing right)
        // Position at the edge of the character, moved 10px further from center
        px = flip ? x+8 : x+40; // At the edge of the character (x+8 for left edge, x+40 for right edge)
        py = y+28; // Center of hand zone for proper animation movement
    }
    
    ctx.translate(px,py); 
    ctx.rotate(angle * (flip?-1:1)); 
    
    // Get material color based on rarity
    const r = it.rarity || 'Common';
    const m = metal(r);
    
    // Calculate dynamic weapon length based on current attack reach
    // The weapon should visually extend exactly to the attack range
    // Convert reach directly to pixels: reach value = weapon length in pixels
    let weaponLength = 70; // Default base length (matches base reach)
    
    if (window.player && window.player._reach) {
        // Weapon length directly equals attack reach in pixels
        weaponLength = Math.round(window.player._reach);
        
        // Apply weapon type-specific visual adjustments while maintaining reach-based length
        if(kind==='Blade'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.fillStyle=m.edge; ctx.fillRect(0,-2,weaponLength,1); 
        } else if(kind==='Sword'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Dagger'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Axe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.fillRect(weaponLength-4,-8,8,12); 
        } else if(kind==='Spear'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,3); 
            ctx.beginPath(); ctx.moveTo(weaponLength,-4); ctx.lineTo(weaponLength+6,0); ctx.lineTo(weaponLength,4); ctx.closePath(); ctx.fill(); 
        } else if(kind==='Mace'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.beginPath(); ctx.arc(weaponLength+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Saber'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Hammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.beginPath(); ctx.arc(weaponLength+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Bow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.beginPath(); ctx.arc(weaponLength,0,12,0,Math.PI*2); ctx.stroke(); 
        } else if(kind==='Crossbow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.fillRect(-8,8,weaponLength+16,4); 
        } else if(kind==='Staff'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Wand'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Katana'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Rapier'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        } else if(kind==='Warhammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.beginPath(); ctx.arc(weaponLength+2,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Battleaxe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.fillRect(weaponLength-4,-8,8,12); 
        } else if(kind==='Halberd'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
            ctx.fillRect(-8,8,weaponLength+10,4); 
        } else { 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,weaponLength,4); 
        }
    } else {
        // Fallback to original fixed lengths if no reach data available
        if(kind==='Blade'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,22,4); 
            ctx.fillStyle=m.edge; ctx.fillRect(0,-2,22,1); 
        } else if(kind==='Sword'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
        } else if(kind==='Dagger'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,10,4); 
        } else if(kind==='Axe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
            ctx.fillRect(12,-8,8,12); 
        } else if(kind==='Spear'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,22,3); 
            ctx.beginPath(); ctx.moveTo(22,-4); ctx.lineTo(28,0); ctx.lineTo(22,4); ctx.closePath(); ctx.fill(); 
        } else if(kind==='Mace'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,10,4); 
            ctx.beginPath(); ctx.arc(12,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Saber'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,18,3); 
        } else if(kind==='Hammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,10,4); 
            ctx.beginPath(); ctx.arc(12,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Bow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
            ctx.beginPath(); ctx.arc(16,0,12,0,Math.PI*2); ctx.stroke(); 
        } else if(kind==='Crossbow'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
            ctx.fillRect(-8,8,32,4); 
        } else if(kind==='Staff'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,22,4); 
        } else if(kind==='Wand'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,8,4); 
        } else if(kind==='Katana'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,18,3); 
        } else if(kind==='Rapier'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,18,3); 
        } else if(kind==='Warhammer'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,10,4); 
            ctx.beginPath(); ctx.arc(12,0,6,0,Math.PI*2); ctx.fill(); 
        } else if(kind==='Battleaxe'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
            ctx.fillRect(12,-8,8,12); 
        } else if(kind==='Halberd'){ 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,22,4); 
            ctx.fillRect(-8,8,32,4); 
        } else { 
            ctx.fillStyle=m.base; ctx.fillRect(0,-2,16,4); 
        }
    } 
    ctx.restore(); 
}

window.swingAngle=function(progress){ return (-Math.PI/3) + progress*(2*Math.PI/3); }

// world drops physics (with pickup delay)
window.worldDrops = [];

window.spawnDrop = function (x, y, item, vx = 0, vy = 0) {
  const d = { 
    id: Date.now() + Math.random(), // Unique ID for server sync
    x, y, vx, vy, item, pickRadius: 40, grounded: false, noPickup: 0.5 
  };
  // Default time-based guard too (either can be used by callers)
  d.noPickupUntil = performance.now() + 500;
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

// Notify server when equipment changes so other clients can render it
if (typeof window !== 'undefined') {
  const origSwapEquipWithBag = window.swapEquipWithBag;
  window.swapEquipWithBag = function(slotIdx){
    const res = origSwapEquipWithBag.apply(this, arguments);
    try { 
      if (window.isConnected && window.isConnected()) {
        wsSend({ type: 'equipUpdate', equip: window.equip });
        // Also send visual update
        wsSend({ 
          type: 'visualUpdate', 
          shirtColor: window.BASE ? window.BASE.shirtColor : null,
          pantColor: window.BASE ? window.BASE.pantColor : null,
          equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {}
        });
        // Send reach update since equipment affects reach
        if (window.player && window.player._reach) {
          wsSend({ 
            type: 'playerUpdate', 
            reach: window.player._reach 
          });
        }
      }
    } catch(_){}
    return res;
  };
  const origSwapUnequip = window.swapUnequip;
  window.swapUnequip = function(slot){
    const res = origSwapUnequip.apply(this, arguments);
    try { 
      // Update reach calculation immediately when equipment changes
      if (window.player && typeof window.player.calculateReach === 'function') {
        window.player.calculateReach();
      }
      
      if (window.isConnected && window.isConnected()) {
        wsSend({ type: 'equipUpdate', equip: window.equip });
        // Also send visual update
        wsSend({ 
          type: 'visualUpdate', 
          shirtColor: window.BASE ? window.BASE.shirtColor : null,
          pantColor: window.BASE ? window.BASE.pantColor : null,
          equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {}
        });
        // Send reach update since equipment affects reach
        if (window.player && window.player._reach) {
          wsSend({ 
            type: 'playerUpdate', 
            reach: window.player._reach 
          });
        }
      }
    } catch(_){}
    return res;
  };
  const origHandleEquipDrop = window.handleEquipDrop;
  window.handleEquipDrop = function(id,slot){
    const res = origHandleEquipDrop.apply(this, arguments);
    try { 
      // Update reach calculation immediately when equipment changes
      if (window.player && typeof window.player.calculateReach === 'function') {
        window.player.calculateReach();
      }
      
      if (window.isConnected && window.isConnected()) {
        wsSend({ type: 'equipUpdate', equip: window.equip });
        // Also send visual update
        wsSend({ 
          type: 'visualUpdate', 
          shirtColor: window.BASE ? window.BASE.shirtColor : null,
          pantColor: window.BASE ? window.BASE.pantColor : null,
          equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {}
        });
        // Send reach update since equipment affects reach
        if (window.player && window.player._reach) {
          wsSend({ 
            type: 'playerUpdate', 
            reach: window.player._reach 
          });
        }
      }
    } catch(_){}
    return res;
  };
}


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
    this.maxHealth = Math.max(1, s.Health + s.Endurance*8); 
    if(this.health>this.maxHealth) this.health=this.maxHealth; 
    
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
    
    // Platform collision detection
    for(const p of platforms){ 
        if(this.x+this.w > p.x && this.x < p.x + p.w && this.y + this.h > p.y && this.y < p.y+p.h){ 
            const overlapX=Math.min(this.x+this.w - p.x, p.x+p.w - this.x); 
            const overlapY=Math.min(this.y+this.h - p.y, p.y+p.h - this.y); 
            if(overlapY < overlapX){ 
                if(this.vy>0){ 
                    this.y = p.y - this.h; 
                    this.vy=0; 
                    this.onGround=true; 
                    this.jumpCount=0; 
                } else { 
                    this.y = p.y + p.h; 
                    this.vy = 0; 
                } 
            } else { 
                if(this.x < p.x) this.x = p.x - this.w; 
                else this.x = p.x + p.w; 
                this.vx = 0; 
                this.wallTouchTicks = 6; 
            } 
        } 
    } 
    
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
        const weaponKind = window.weaponKindFromName(window.equip.mainhand.name);
        
        if (weaponKind === 'Bow' || weaponKind === 'Wand') {
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
    
    if (weaponType === 'Bow') {
        // Bow damage scales with Coordination
        damage += (window.player.stats.Coordination - 5) * 1.5;
    } else if (weaponType === 'Wand') {
        // Wand damage scales with Focus
        damage += (window.player.stats.Focus - 5) * 2;
    }
    
    // Send projectile creation message to server
    window.wsSend({
        type: 'shootProjectile',
        weaponType: weaponType,
        direction: window.player.facing > 0 ? 'right' : 'left',
        damage: Math.round(damage)
    });
    
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
            // Update server
            if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
                window.wsSend({
                    type: 'equipUpdate',
                    equip: window.equip
                });
            }
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
            noPickupUntil: performance.now() + 3000 // 3 seconds delay to prevent immediate pickup after death
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
