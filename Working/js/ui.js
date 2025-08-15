// ui.js — keybinds, inventory, tooltip, shop, stats, chat
(function(){
'use strict';

// Keybind management
window.DEFAULT_BINDS = { left:'a', right:'d', jump:'w', attack:'e' };

function loadBinds(){ 
    try{ 
        const s=localStorage.getItem('binds1'); 
        let b=s?JSON.parse(s):window.DEFAULT_BINDS; 
        delete b.slide; 
        for(const k of Object.keys(window.DEFAULT_BINDS)) 
            if(!b[k]) b[k]=window.DEFAULT_BINDS[k]; 
        return b; 
    }catch(e){
        return window.DEFAULT_BINDS;
    } 
}

window.saveBinds=function(b){ 
    localStorage.setItem('binds1', JSON.stringify(b)); 
}

window.binds = loadBinds();
window.keys = {}; 

window.addEventListener('keydown', e=>{ 
    window.keys[e.key.toLowerCase()] = true; 
}); 

window.addEventListener('keyup', e=>{ 
    window.keys[e.key.toLowerCase()] = false; 
});

window.buildKeybindUI=function(){ 
    const root=document.getElementById('keybinds'); 
    root.innerHTML=''; 
    for(const action of Object.keys(window.binds)){ 
        const box=document.createElement('div'); 
        box.className='kb'; 
        box.tabIndex=0; 
        box.dataset.action=action; 
        box.innerText = `${action}: ${window.binds[action]}`; 
        box.addEventListener('click', ()=>{ 
            box.innerText = `${action}: [press a key]`; 
            const onKey = (e)=>{ 
                e.preventDefault(); 
                window.binds[action] = e.key.toLowerCase(); 
                saveBinds(window.binds); 
                box.innerText = `${action}: ${window.binds[action]}`; 
                window.removeEventListener('keydown', onKey); 
            }; 
            window.addEventListener('keydown', onKey); 
        }); 
        root.appendChild(box); 
    } 
}

window.buildKeybindUI();

// Tooltip system
const TOOLTIP = document.getElementById('tooltip'); 
window.TOOLTIP=TOOLTIP;

window.showTooltipForItem=function(it,ev){ 
    if(!it) return; 
    
    // Check if RARITY_CLASS is available
    if (!window.RARITY_CLASS) {
        console.warn('RARITY_CLASS not available yet');
        return;
    }
    
    // Check if TOOLTIP element is available
    if (!window.TOOLTIP) {
        console.warn('TOOLTIP element not available yet');
        return;
    }
    
    let tooltipHTML = `<div class="name ${window.RARITY_CLASS[it.rarity]||''}">${it.name}</div>`;
    tooltipHTML += `<div class="desc">${it.type} ${it.short ? ('- ' + it.short) : ''}</div>`;
    
    // Add weapon damage if it's a weapon
    if(it.type === 'weapon' && it.dmgMin && it.dmgMax) {
        tooltipHTML += `<div class="statline">Damage: ${it.dmgMin} - ${it.dmgMax}</div>`;
    }
    
    // Add stats if they exist
    if(it.stats && Object.keys(it.stats).length > 0) {
        const statLines = Object.entries(it.stats)
            .filter(([k,v]) => v && v !== 0)
            .map(([k,v]) => `${k}: +${v}`)
            .join('<br>');
        
        if(statLines) {
            tooltipHTML += `<div class="statline">${statLines}</div>`;
        }
    }
    
    // Add value
    tooltipHTML += `<div class="statline">Value: ${it.value || 0} Pyreals</div>`;
    
    TOOLTIP.innerHTML = tooltipHTML;
    TOOLTIP.style.display='block'; 
    
    // Force a small delay to ensure DOM is updated before positioning
    setTimeout(() => positionTooltip(ev), 10);
}

function positionTooltip(ev){
    // Start near the cursor
    let x = (ev.clientX || ev.pageX) + 12;
    let y = (ev.clientY || ev.pageY) + 12;

    // After content is set, we can measure it
    const pad = 8;
    
    // Ensure tooltip dimensions are available
    if (TOOLTIP.offsetWidth === 0 || TOOLTIP.offsetHeight === 0) {
        // Force a reflow to get proper dimensions
        TOOLTIP.style.visibility = 'hidden';
        TOOLTIP.style.display = 'block';
        TOOLTIP.offsetHeight; // Force reflow
        TOOLTIP.style.visibility = 'visible';
    }
    
    const maxX = window.innerWidth  - TOOLTIP.offsetWidth  - pad;
    const maxY = window.innerHeight - TOOLTIP.offsetHeight - pad;

    x = Math.max(pad, Math.min(x, maxX));
    y = Math.max(pad, Math.min(y, maxY));

    TOOLTIP.style.left = x + 'px';
    TOOLTIP.style.top  = y + 'px';
}

window.hideTooltip=function(){ 
    TOOLTIP.style.display='none'; 
}

document.addEventListener('mousemove',e=>{ 
    if(TOOLTIP.style.display==='block') positionTooltip(e); 
});

// Inventory system
window.BAG_SLOTS=12; 
window.bag = new Array(window.BAG_SLOTS).fill(null);
window.equip={head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};

// Ensure inventory data is properly structured
window.ensureInventoryStructure = function() {

    
    // Check if bag already has items - if so, don't reset it
    const hasItems = window.bag && Array.isArray(window.bag) && window.bag.some(item => item !== null);
    if (hasItems) {

        // Only resize if absolutely necessary, preserving all items
        if (window.bag.length !== window.BAG_SLOTS) {
            console.warn(`Bag length is ${window.bag.length}, expected ${window.BAG_SLOTS}. Resizing without losing data.`);
            const oldBag = [...window.bag];
            window.bag = new Array(window.BAG_SLOTS).fill(null);
            // Copy existing items to new array
            for (let i = 0; i < Math.min(oldBag.length, window.BAG_SLOTS); i++) {
                if (oldBag[i]) {
                    window.bag[i] = oldBag[i];
                }
            }
        }

        return; // Exit early to preserve existing items
    }
    
    // Only reset bag if it's completely missing or empty
    if (!Array.isArray(window.bag)) {
        console.warn('Bag is not an array, creating new one');
        window.bag = new Array(window.BAG_SLOTS).fill(null);
    } else if (window.bag.length !== window.BAG_SLOTS) {
        console.warn(`Bag length is ${window.bag.length}, expected ${window.BAG_SLOTS}. Resizing without losing data.`);
        // Preserve existing items when resizing
        const oldBag = [...window.bag];
        window.bag = new Array(window.BAG_SLOTS).fill(null);
        // Copy existing items to new array
        for (let i = 0; i < Math.min(oldBag.length, window.BAG_SLOTS); i++) {
            if (oldBag[i]) {
                window.bag[i] = oldBag[i];
            }
        }
    }
    
    if (!window.equip || typeof window.equip !== 'object') {
        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
    }
    
    // Ensure all equipment slots exist
    const defaultSlots = ['head','neck','shoulders','chest','waist','legs','feet','wrists','hands','mainhand','offhand','trinket'];
    defaultSlots.forEach(slot => {
        if (!(slot in window.equip)) {
            window.equip[slot] = null;
        }
    });
    
    
};

// Build the inventory UI slots
window.buildInventoryUI = function() {
    const inv = document.getElementById('inventory');
    if (!inv) return;
    
    // Clear existing content
    inv.innerHTML = '';
    
    // Create inventory slots
    for (let i = 0; i < window.BAG_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.style.cssText = `
            width: var(--slot-size);
            height: var(--slot-size);
            border: 2px solid var(--muted);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.05);
            cursor: pointer;
            transition: border-color 0.2s;
        `;
        
        // Add hover effect
        slot.addEventListener('mouseenter', () => {
            slot.style.borderColor = '#4a9eff';
        });
        
        slot.addEventListener('mouseleave', () => {
            slot.style.borderColor = 'var(--muted)';
        });
        
        inv.appendChild(slot);
    }
};

window.itemToIconHtml=function(it){ 
    if(!it) return ''; 

    
    // Check if required functions are available
    if (typeof window.getItemIconDataURLForItem !== 'function') {
        console.warn('getItemIconDataURLForItem function not available yet');
        return '';
    }
    
    try {
        const iconSrc = window.getItemIconDataURLForItem(it);
    
        const html = `<img class="itemIcon" src="${iconSrc}" draggable="true" data-id="${it.id}">`;
    
        return html;
    } catch (error) {
        console.error('Error generating item HTML:', error);
        return '';
    }
}

window.findItemById=function(id){ 
    // Check bag slots
    for(let i=0;i<window.bag.length;i++) 
        if(window.bag[i] && window.bag[i].id===id) 
            return {item:window.bag[i],where:'bag',idx:i}; 
    
    // Check equipped items
    for(const k in window.equip) 
        if(window.equip[k] && window.equip[k].id===id) 
            return {item:window.equip[k],where:'equip',slot:k}; 
    
    // Check world drops
    for(let i=0;i<window.worldDrops.length;i++) {
        const drop = window.worldDrops[i];
        if(drop.item && drop.item.id===id) 
            return {item:drop.item,where:'world',idx:i};
        if(drop.id===id) // Handle case where drop itself has the id
            return {item:drop,where:'world',idx:i};
    }
    
    return null; 
}

window.swapEquipWithBag=function(slotIdx){ 
    const it = window.bag[slotIdx]; 
    if(!it) return; 
    
    
    
    // Send request to server instead of modifying local state
    if (typeof window.isConnected === 'function' && window.isConnected()) {
        let targetSlot = null;
        
        if(it.type==='armor'){ 
            targetSlot = it.slot;
        } else if(it.type==='weapon'){ 
            // Try mainhand first, then offhand if mainhand is occupied
            if(!window.equip['mainhand']) {
                targetSlot = 'mainhand';
            } else if(!window.equip['offhand']) {
                targetSlot = 'offhand';
            } else {
                // Both hands occupied, use mainhand
                targetSlot = 'mainhand';
            }
        } else if(it.type==='currency'){ 
            if (window.log) {
                window.log('Cannot equip currency');
            } else {
                console.warn('Cannot equip currency');
            }
            return;
        }
        
        if (targetSlot) {
            const request = {
                type: 'moveItem',
                itemId: it.id,
                fromWhere: 'bag',
                fromIndex: slotIdx,
                fromSlot: null,
                toWhere: 'equip',
                toIndex: null,
                toSlot: targetSlot
            };
            
            console.log('Sending moveItem request to server:', request);
            if (typeof window.wsSend === 'function') {
                window.wsSend(request);
            } else {
                console.warn('wsSend function not available yet');
            }
            
            // Don't update local state - wait for server confirmation
            return;
        }
    }
    
    // Fallback for offline mode
    if(it.type==='armor'){ 
        const targetSlot = it.slot; 
        const prev = window.equip[targetSlot]; 
        window.equip[targetSlot] = it; 
        window.bag[slotIdx] = prev || null; 
        console.log('Equipped armor:', { item: it.name, slot: targetSlot, prevItem: prev?.name || 'none' });
        
        // Only refresh UI if we're not connected to server, otherwise let the server handle it
        if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
            window.refreshInventoryUI(); 
        }
        // Note: No need to sync with server since we're now server-authoritative
    } else if(it.type==='weapon'){ 
        // Try mainhand first, then offhand if mainhand is occupied
        if(!window.equip['mainhand']) {
            window.equip['mainhand'] = it;
            window.bag[slotIdx] = null;
            console.log('Equipped weapon to mainhand:', { item: it.name });
        } else if(!window.equip['offhand']) {
            window.equip['offhand'] = it;
            window.bag[slotIdx] = null;
            console.log('Equipped weapon to offhand:', { item: it.name });
        } else {
            // Both hands occupied, swap with mainhand
            const prev = window.equip['mainhand']; 
            window.equip['mainhand'] = it; 
            window.bag[slotIdx] = prev;
            console.log('Swapped weapon with mainhand:', { newItem: it.name, prevItem: prev.name });
        }
        
        // Only refresh UI if we're not connected to server, otherwise let the server handle it
        if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
            window.refreshInventoryUI(); 
        }
        // Note: No need to sync with server since we're now server-authoritative
    } else if(it.type==='currency'){ 
        window.log('Cannot equip currency'); 
    } 
}

window.swapUnequip=function(slot){ 
    const prev = window.equip[slot]; 
    if(!prev) return; 
    
    console.log('swapUnequip called:', { slot, item: prev.name });
    
    // Send request to server instead of modifying local state
    if (typeof window.isConnected === 'function' && window.isConnected()) {
        // Find empty bag slot
        const idx = window.bag.findIndex(x=>!x); 
        const targetIndex = idx >= 0 ? idx : 0; // Use first slot if no empty slots
        
        const request = {
            type: 'moveItem',
            itemId: prev.id,
            fromWhere: 'equip',
            fromIndex: null,
            fromSlot: slot,
            toWhere: 'bag',
            toIndex: targetIndex,
            toSlot: null
        };
        
        console.log('Sending moveItem request to server:', request);
        if (typeof window.wsSend === 'function') {
            window.wsSend(request);
        } else {
            console.warn('wsSend function not available yet');
        }
        
        // Don't update local state - wait for server confirmation
        return;
    }
    
    // Fallback for offline mode
    // Find empty bag slot
    const idx = window.bag.findIndex(x=>!x); 
    if(idx>=0){ 
        window.bag[idx]=prev; 
        window.equip[slot]=null; 
        console.log('Unequipped item to empty bag slot:', { item: prev.name, bagSlot: idx });
    } else { 
        // No empty slots, swap with first slot
        const tmp = window.bag[0]; 
        window.bag[0]=prev; 
        window.equip[slot]=tmp;
        console.log('Unequipped item by swapping with first bag slot:', { unequipped: prev.name, equipped: tmp?.name || 'none' });
    } 
    
    // Only refresh UI if we're not connected to server, otherwise let the server handle it
    if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
        window.refreshInventoryUI(); 
    }
    // Note: No need to sync with server since we're now server-authoritative
}

window.handleDropToBag=function(id,slotIdx){ 
    const found=window.findItemById(id); 
    if(!found) return; 
    
    console.log('handleDropToBag called:', { id, slotIdx, found });
    
    // Send request to server instead of modifying local state
    if (typeof window.isConnected === 'function' && window.isConnected()) {
        const request = {
            type: 'moveItem',
            itemId: id,
            fromWhere: found.where,
            fromIndex: found.idx,
            fromSlot: found.slot,
            toWhere: 'bag',
            toIndex: slotIdx,
            toSlot: null
        };
        
        console.log('Sending moveItem request to server:', request);
        if (typeof window.wsSend === 'function') {
            window.wsSend(request);
        } else {
            console.warn('wsSend function not available yet');
        }
        
        // Don't update local state - wait for server confirmation
        return;
    }
    
    // Fallback for offline mode
    if(found.where==='bag'){ 
        // Swap items between bag slots
        const tmp=window.bag[slotIdx]; 
        window.bag[slotIdx]=found.item; 
        window.bag[found.idx]=tmp; 
        console.log('Swapped bag items:', { from: found.idx, to: slotIdx, item: found.item.name });
    } else if(found.where==='equip'){ 
        // Unequip item and place in bag slot
        const tmp=window.bag[slotIdx]; 
        window.bag[slotIdx]=found.item; 
        window.equip[found.slot]=tmp||null; 
        console.log('Unequipped item to bag:', { slot: found.slot, item: found.item.name, bagSlot: slotIdx });
    } else if(found.where==='world'){ 
        if(!window.bag[slotIdx]){ 
            // Empty slot - just move the item
            window.bag[slotIdx]=found.item; 
            window.worldDrops.splice(found.idx,1);
            console.log('Moved world item to bag:', { item: found.item.name, slot: slotIdx });
        } else { 
            // Slot has item - swap them
            const tmp=window.bag[slotIdx]; 
            window.bag[slotIdx]=found.item; 
            
            // Put the bag item back in the world
            const player = window.player;
            if(player && window.spawnDrop) {
                window.spawnDrop(player.x + 50, player.y - 20, tmp);
            }
            
            // Remove the original world drop
            window.worldDrops.splice(found.idx,1);
            console.log('Swapped world item with bag item:', { worldItem: found.item.name, bagItem: tmp.name });
        } 
    } 
    
    // Only refresh UI if we're not connected to server, otherwise let the server handle it
    if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
        window.refreshInventoryUI(); 
    }
    // Note: No need to sync with server since we're now server-authoritative
}

window.handleEquipDrop=function(id,slot){ 
    const found=window.findItemById(id); 
    if(!found) return; 
    
    console.log('handleEquipDrop called:', { id, slot, found });
    
    // Check if the item can be equipped in this slot
    if(found.item.type==='armor' && slot!==found.item.slot){ 
        if (window.log) {
            window.log('That armor does not belong to that slot.');
        } else {
            console.warn('That armor does not belong to that slot.');
        } 
        return; 
    } 
    
    if(found.item.type==='currency'){ 
        window.log('Cannot equip currency'); 
        return; 
    } 
    
    // For weapons, allow mainhand and offhand
    if(found.item.type==='weapon' && slot!=='mainhand' && slot!=='offhand'){ 
        if (window.log) {
            window.log('Weapons can only be equipped in mainhand or offhand.');
        } else {
            console.warn('Weapons can only be equipped in mainhand or offhand.');
        } 
        return; 
    }
    
    // Send request to server instead of modifying local state
    if (typeof window.isConnected === 'function' && window.isConnected()) {
        const request = {
            type: 'moveItem',
            itemId: id,
            fromWhere: found.where,
            fromIndex: found.idx,
            fromSlot: found.slot,
            toWhere: 'equip',
            toIndex: null,
            toSlot: slot
        };
        
        console.log('Sending moveItem request to server:', request);
        if (typeof window.wsSend === 'function') {
            window.wsSend(request);
        } else {
            console.warn('wsSend function not available yet');
        }
        
        // Don't update local state - wait for server confirmation
        return;
    }
    
    // Fallback for offline mode
    if(found.where==='bag'){ 
        // Equip item from bag
        const prev = window.equip[slot]; 
        window.equip[slot]=found.item; 
        window.bag[found.idx]=prev||null; 
        console.log('Equipped item from bag:', { item: found.item.name, slot: slot, prevItem: prev?.name || 'none' });
    } else if(found.where==='equip'){ 
        // Swap equipped items
        const prev=window.equip[slot]; 
        window.equip[slot]=found.item; 
        window.equip[found.slot]=prev||null; 
        console.log('Swapped equipped items:', { from: found.slot, to: slot, item: found.item.name, prevItem: prev?.name || 'none' });
    } else if(found.where==='world'){ 
        // Equip item from world
        const prev = window.equip[slot]; 
        window.equip[slot]=found.item; 
        
        // Remove the item from world drops
        window.worldDrops.splice(found.idx,1); 
        
        // If there was a previously equipped item, drop it to the world
        if(prev) {
            // Get player position for drop location
            const player = window.player;
            if(window.spawnDrop) {
                window.spawnDrop(player.x + 50, player.y - 20, prev);
            }
        } 
        console.log('Equipped item from world:', { item: found.item.name, slot: slot, prevItem: prev?.name || 'none' });
    } 
    
    // Only refresh UI if we're not connected to server, otherwise let the server handle it
    if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
        window.refreshInventoryUI(); 
    }
    // Note: No need to sync with server since we're now server-authoritative
}

window.initInventoryUI=function(){ 
    // Prevent initialization if we're connected to server and have inventory data
    // But allow it when called from the network layer to fix UI initialization issues
    if (window.connectionStatus && window.connectionStatus.initialConnectionComplete && 
        window.bag && window.bag.some(item => item !== null)) {
        console.log('Skipping initInventoryUI - already connected to server with inventory data');
        return;
    }
    
    // Ensure inventory structure is initialized
    window.ensureInventoryStructure();
    
    const inv=document.getElementById('inventory'); 
    if (!inv) {
        console.error('Inventory element not found');
        return;
    }
    
    inv.innerHTML=''; 
    for(let i=0;i<window.BAG_SLOTS;i++){ 
        const d=document.createElement('div'); 
        d.className='slot'; 
        d.dataset.idx=i; 
        d.addEventListener('dragover',e=>{
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
        }); 
        d.addEventListener('drop',ev=>{
            ev.preventDefault(); 
            const id=ev.dataTransfer.getData('text'); 
            window.handleDropToBag(id,i);
        }); 
        d.addEventListener('dblclick',()=>window.swapEquipWithBag(i)); 
        
        inv.appendChild(d);
    } 
    
    console.log('Inventory slots created:', inv.children.length);
    console.log('Current bag contents:', window.bag);
    
    // Test items are now created on the server side for new players
    // No need to add test items locally anymore
    console.log('Inventory UI initialized - test items will be provided by server if needed');
}

window.initPaperDollUI=function(){ 
    document.querySelectorAll('.pd-slot').forEach(el=>{ 
        el.addEventListener('dragover',e=>{
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
        }); 
        el.addEventListener('drop',ev=>{
            ev.preventDefault(); 
            const id=ev.dataTransfer.getData('text'); 
            window.handleEquipDrop(id, el.dataset.slot); 
        }); 
        el.addEventListener('dblclick',()=>window.swapUnequip(el.dataset.slot)); 
    }); 
}

// Add a flag to prevent rapid successive calls
window._lastRefreshTime = 0;
window._refreshInProgress = false;

window.refreshInventoryUI=function(){ 
    const now = Date.now();
    const timeSinceLastRefresh = now - window._lastRefreshTime;
    

    
    // Prevent rapid successive calls (less than 100ms apart)
    if (timeSinceLastRefresh < 100) {
        console.warn('Skipping refreshInventoryUI - called too soon after last refresh');
        return;
    }
    
    // Prevent concurrent refreshes
    if (window._refreshInProgress) {
        console.warn('Skipping refreshInventoryUI - already in progress');
        return;
    }
    
    // Prevent refresh if we're connected to server and have inventory data
    // This prevents interference with server inventory data during initial setup
    // But allow it to run when called from user actions (equipping, moving items, etc.)
    if (window.connectionStatus && window.connectionStatus.initialConnectionComplete) {
        // Check if this is a user-initiated action by looking at the call stack
        const callStack = new Error().stack || '';
        const isUserAction = callStack.includes('swapEquipWithBag') || 
                           callStack.includes('swapUnequip') || 
                           callStack.includes('handleDropToBag') || 
                           callStack.includes('handleEquipDrop') ||
                           callStack.includes('dropItemFromInventory') ||
                           callStack.includes('dropEquippedItem') ||
                           callStack.includes('handleDropToWorld');
        
        if (!isUserAction) {

            return;
        } else {

        }
    }
    
    window._refreshInProgress = true;
    
    try {
        // Only ensure inventory structure if this is NOT a user action
        // User actions should preserve the existing inventory structure
        if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
            // Ensure inventory structure is correct for initial setup
            window.ensureInventoryStructure();
        } else {

        }
    
        // Check if all required elements and data are available
        if (!window.bag || !window.equip) {
            console.error('Bag or equip not available:', { bag: window.bag, equip: window.equip });
            return;
        }
        

    
    const inv=document.getElementById('inventory'); 
    if(inv){ 

        
        inv.childNodes.forEach((el,i)=>{ 
            if (i >= window.bag.length) return; // Safety check
            
            const item = window.bag[i];

            
            if (item) {
                const itemHtml = window.itemToIconHtml(item);

                el.innerHTML = itemHtml || '';
            } else {
                el.innerHTML = '';
            }
            
            // Only add drag and drop handlers if they don't already exist
            if (!el.dataset.dragHandlersAdded) {
                el.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                
                el.addEventListener('drop', function(e) {
                    e.preventDefault();
                    console.log('Inventory slot drop event on slot', i);
                    const itemId = e.dataTransfer.getData('text');
                    console.log('Dropped item ID:', itemId);
                    if (itemId) {
                        // Find the source item and slot
                        const sourceItem = window.findItemById(itemId);
                        if (sourceItem) {
                            console.log('Source item found:', sourceItem);
                            // Handle the drop based on source location
                            if (sourceItem.where === 'bag') {
                                // Swap items between bag slots
                                const temp = window.bag[sourceItem.idx];
                                window.bag[sourceItem.idx] = window.bag[i];
                                window.bag[i] = temp;
                                
                                // Send to server if connected
                                if (typeof window.isConnected === 'function' && window.isConnected()) {
                                    const request = {
                                        type: 'moveItem',
                                        itemId: itemId,
                                        fromWhere: 'bag',
                                        fromIndex: sourceItem.idx,
                                        fromSlot: null,
                                        toWhere: 'bag',
                                        toIndex: i,
                                        toSlot: null
                                    };
                                    if (typeof window.wsSend === 'function') {
                                        window.wsSend(request);
                                    }
                                }
                            } else if (sourceItem.where === 'equip') {
                                // Unequip and move to bag
                                const temp = window.equip[sourceItem.slot];
                                window.equip[sourceItem.slot] = null;
                                window.bag[i] = temp;
                                
                                // Send to server if connected
                                if (typeof window.isConnected === 'function' && window.isConnected()) {
                                    const request = {
                                        type: 'moveItem',
                                        itemId: itemId,
                                        fromWhere: 'equip',
                                        fromIndex: null,
                                        fromSlot: sourceItem.slot,
                                        toWhere: 'bag',
                                        toIndex: i,
                                        toSlot: null
                                    };
                                    if (typeof window.wsSend === 'function') {
                                        window.wsSend(request);
                                    }
                                }
                            }
                            
                            // Only refresh UI if we're not connected to server, otherwise let the server handle it
                            if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
                                window.refreshInventoryUI();
                            }
                        }
                    }
                });
                
                // Mark that handlers have been added
                el.dataset.dragHandlersAdded = 'true';
            }
            
            const img = el.querySelector('.itemIcon'); 
            if(img && item){ 
                // Remove existing event listeners to prevent duplicates
                const newImg = img.cloneNode(true);
                img.parentNode.replaceChild(newImg, img);
                
                // Add event listeners directly to the new image
                newImg.addEventListener('dragstart',e=>{
                    console.log('Drag start on inventory item:', newImg.dataset.id);
                    e.dataTransfer.setData('text', newImg.dataset.id);
                    e.dataTransfer.effectAllowed = 'move';
                }); 
                newImg.addEventListener('mouseenter',e=>{ 
                    window.showTooltipForItem(item, e); 
                }); 
                newImg.addEventListener('mouseleave',window.hideTooltip); 
                newImg.addEventListener('dblclick',()=>window.swapEquipWithBag(i)); 
                
                // Add right-click context menu for dropping items
                newImg.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if(confirm('Drop ' + item.name + ' to the world?')) {
                        window.dropItemFromInventory(i);
                    }
                });
            } 
        }); 
    }
    
    document.querySelectorAll('.pd-slot').forEach(el=>{ 
        const s=el.dataset.slot; 
        const equippedItem = window.equip[s];
        
        // Only render if we have a valid equipped item
        if (equippedItem && typeof equippedItem === 'object' && equippedItem.id) {
            try {
                const iconSrc = window.getItemIconDataURLForItem(equippedItem);
                if (iconSrc) {
                    el.innerHTML = `<img class="itemIcon" src="${iconSrc}" data-id="${equippedItem.id}" draggable="true">`;
                } else {
                    el.innerHTML = '';
                }
            } catch (error) {
                console.error('Error rendering equipment slot:', error);
                el.innerHTML = '';
            }
        } else {
            el.innerHTML = '';
        }
        
        // Only add drag and drop handlers if they don't already exist
        if (!el.dataset.dragHandlersAdded) {
            el.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            el.addEventListener('drop', function(e) {
                e.preventDefault();
                const itemId = e.dataTransfer.getData('text');
                if (itemId) {
                    window.handleEquipDrop(itemId, s);
                }
            });
            
            // Mark that handlers have been added
            el.dataset.dragHandlersAdded = 'true';
        }
        
        const img = el.querySelector('.itemIcon'); 
        if(img && equippedItem){ 
            // Remove existing event listeners to prevent duplicates
            const newImg = img.cloneNode(true);
            img.parentNode.replaceChild(newImg, img);
            
            // Add event listeners directly to the new image
            newImg.addEventListener('dragstart',e=>{
                console.log('Drag start on equipment item:', newImg.dataset.id);
                e.dataTransfer.setData('text', newImg.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
            }); 
            newImg.addEventListener('mouseenter',e=>{ 
                window.showTooltipForItem(equippedItem, e); 
            }); 
            newImg.addEventListener('mouseleave',window.hideTooltip); 
            newImg.addEventListener('dblclick',()=>window.swapUnequip(s)); 
            
            // Add right-click context menu for dropping equipped items
            newImg.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if(confirm('Drop ' + equippedItem.name + ' to the world?')) {
                    window.dropEquippedItem(s);
                }
            });
        }
    }); 
    
        window.updatePlayerStatsUI(true); 
        window.recreateDragItems(); 
        
        // Update scrollbars for panels after UI refresh
        if (typeof window.managePanelScrollbars === 'function') {
            try {
                window.managePanelScrollbars();
            } catch (error) {
                // Silently handle scrollbar update errors
            }
        }
        
        // Update timestamp and mark as complete
        window._lastRefreshTime = now;

    } catch (error) {
        console.error('Error in refreshInventoryUI:', error);
    } finally {
        window._refreshInProgress = false;
    }
}

window.recreateDragItems=function(){ 
    document.querySelectorAll('.slot .itemIcon, .pd-slot .itemIcon').forEach(it=>{ 
        it.setAttribute('draggable','true'); 
    }); 
}

window.updatePlayerStatsUI=function(force=false){ 
    const el=document.getElementById('pstats'); 
    const p=window.player; 
    if(!p) return; 
    if(!force && p._lastHealthShown===Math.round(p.health) && p._lastMaxHealthShown===Math.round(p.maxHealth)) return; 
    el.innerHTML=''; 
    p.applyEquipment(); 
    for(const k of Object.keys(p.stats)){ 
        const div=document.createElement('div'); 
        div.className='stat'; 
        if(k==='Health'){ 
            div.innerHTML=`<div>${k}</div><div>${Math.round(p.health)}/${Math.round(p.maxHealth)}</div>`; 
        } else { 
            div.innerHTML=`<div>${k}</div><div>${Math.round(p.stats[k])}</div>`; 
        } 
        el.appendChild(div); 
    } 
    document.getElementById('goldAmt').innerText = p.pyreals; 
    p._lastHealthShown=Math.round(p.health); 
    p._lastMaxHealthShown=Math.round(p.maxHealth);
    
    // Update scrollbars after stats update
    if (typeof window.managePanelScrollbars === 'function') {
        try {
            window.managePanelScrollbars();
        } catch (error) {
            // Silently handle scrollbar update errors
        }
    } 
}

// Item dropping functions
window.dropItemFromInventory=function(slotIdx) {
    const item = window.bag[slotIdx];
    if(!item) return;
    
    // Get player position for drop location
    const player = window.player;
    if(player) {
        // Remove item from inventory first
        window.bag[slotIdx] = null;
        
        // Send drop to server instead of spawning locally
        if (typeof window.isConnected === 'function' && window.isConnected()) {
            if (typeof window.wsSend === 'function') {
                window.wsSend({
                    type: 'dropItem',
                    itemId: item.id,
                    fromWhere: 'bag',
                    fromIndex: slotIdx,
                    fromSlot: null,
                    x: player.x + 50,
                    y: player.y - 20
                });
            } else {
                console.warn('wsSend function not available yet');
            }
        } else {
            // Offline mode - spawn drop locally
            if (window.spawnDrop) {
                window.spawnDrop(player.x + 50, player.y - 20, item);
            }
        }
        
        window.refreshInventoryUI();
        // Note: No need to sync with server since we're now server-authoritative
        if (window.log) {
            window.log('Dropped ' + item.name + ' to the world');
        } else {
            console.log('Dropped ' + item.name + ' to the world');
        }
    }
}

window.dropEquippedItem=function(slot) {
    const item = window.equip[slot];
    if(!item) return;
    
    // Get player position for drop location
    const player = window.player;
    if(player) {
        // Remove item from equipment first
        window.equip[slot] = null;
        
        // Send drop to server instead of spawning locally
        if (typeof window.isConnected === 'function' && window.isConnected()) {
            if (typeof window.wsSend === 'function') {
                window.wsSend({
                    type: 'dropItem',
                    itemId: item.id,
                    fromWhere: 'equip',
                    fromIndex: null,
                    fromSlot: slot,
                    x: player.x + 50,
                    y: player.y - 20
                });
            } else {
                console.warn('wsSend function not available yet');
            }
        } else {
            // Offline mode - spawn drop locally
            if (window.spawnDrop) {
                window.spawnDrop(player.x + 50, player.y - 20, item);
            }
        }
        
        window.refreshInventoryUI();
        // Note: No need to sync with server since we're now server-authoritative
        if (window.log) {
            window.log('Dropped ' + item.name + ' to the world');
        } else {
            console.log('Dropped ' + item.name + ' to the world');
        }
    }
}

// Handle dropping items to the world via drag and drop
window.handleDropToWorld=function(itemId) {
    try {
        console.log('handleDropToWorld called with itemId:', itemId);
        const found = window.findItemById(itemId);
        if(!found) {
            console.warn('Item not found for ID:', itemId);
            return;
        }
        
        console.log('Found item:', found);
        const item = found.item;
        
        // Remove item from its current location
        if(found.where === 'bag') {
            window.bag[found.idx] = null;
            console.log('Removed item from bag slot', found.idx);
        } else if(found.where === 'equip') {
            window.equip[found.slot] = null;
            console.log('Removed item from equip slot', found.slot);
        } else if(found.where === 'world') {
            window.worldDrops.splice(found.idx, 1);
            console.log('Removed item from world drops');
        }
        
        // Send drop to server instead of spawning locally
        const player = window.player;
        
        if(player && typeof window.isConnected === 'function' && window.isConnected()) {
            if (typeof window.wsSend === 'function') {
                const dropRequest = {
                    type: 'dropItem',
                    itemId: item.id,
                    fromWhere: found.where,
                    fromIndex: found.idx,
                    fromSlot: found.slot,
                    x: player.x + 50,
                    y: player.y - 20
                };
                console.log('Sending drop request to server:', dropRequest);
                window.wsSend(dropRequest);
            } else {
                console.warn('wsSend function not available yet');
            }
        } else if (player && window.spawnDrop) {
            // Offline mode - spawn drop locally
            console.log('Spawning drop locally (offline mode)');
            window.spawnDrop(player.x + 50, player.y - 20, item);
        }
        
        // Note: No need to sync with server since we're now server-authoritative
        
        // Refresh the UI
        window.refreshInventoryUI();
    } catch (error) {
        console.error('Error in handleDropToWorld:', error);
    }
}

// Initialize canvas drag and drop for dropping items to world
window.initCanvasDragAndDrop = function() {
    const canvas = document.getElementById('game');
    if (!canvas) {
        console.warn('Canvas not found for drag and drop initialization');
        return;
    }
    
    console.log('Initializing canvas drag and drop on canvas:', canvas);
    
    // Remove existing event listeners by cloning and replacing the canvas
    const originalCanvas = canvas;
    const newCanvas = canvas.cloneNode(true);
    
    // Copy the canvas context and properties
    newCanvas.width = originalCanvas.width;
    newCanvas.height = originalCanvas.height;
    newCanvas.style.cssText = originalCanvas.style.cssText;
    
    // Replace in DOM but keep reference
    originalCanvas.parentNode.replaceChild(newCanvas, originalCanvas);
    
    // Update the global canvas reference
    window.gameCanvas = newCanvas;
    
    // Handle dragover on canvas
    newCanvas.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        console.log('Canvas dragover event');
    });
    
    // Handle drop on canvas
    newCanvas.addEventListener('drop', function(e) {
        e.preventDefault();
        console.log('Canvas drop event');
        const itemId = e.dataTransfer.getData('text');
        console.log('Dropped item ID:', itemId);
        if (itemId) {
            window.handleDropToWorld(itemId);
        }
    });
    
    console.log('Canvas drag and drop initialized successfully');
}

// Function to initialize canvas drag and drop when ready
window.initCanvasDragAndDropWhenReady = function() {
    // Wait for canvas to be ready and inventory data to be available
    const checkReady = () => {
        const canvas = document.getElementById('game');
        const hasInventoryData = window.bag && window.equip;
        const hasPlayer = window.player;
        
        if (canvas && canvas.width > 0 && hasInventoryData && hasPlayer) {
            window.initCanvasDragAndDrop();
        } else {
            setTimeout(checkReady, 200);
        }
    };
    checkReady();
}

// Function to display inventory items without triggering a full refresh
window.displayInventoryItems=function() {
    // Comprehensive check to ensure everything is ready
    const isFullyReady = () => {
        // Check if DOM is ready
        if (!document.body || document.readyState !== 'complete') {
            return false;
        }
        
        // Check if inventory element exists and has slots
        const inventory = document.getElementById('inventory');
        if (!inventory || inventory.children.length === 0) {
            return false;
        }
        
        // Check if bag data exists
        if (!window.bag || !Array.isArray(window.bag)) {
            return false;
        }
        
        // Check if required functions are available
        if (typeof window.getItemIconDataURLForItem !== 'function') {
            return false;
        }
        
        // Check if equipment slots exist
        let equipmentSlots = document.querySelectorAll('.pd-slot');
        if (equipmentSlots.length === 0) {
            equipmentSlots = document.querySelectorAll('.equipSlot');
        }
        if (equipmentSlots.length === 0) {
            equipmentSlots = document.querySelectorAll('[data-slot]');
        }
        if (equipmentSlots.length === 0) {
            return false;
        }
        
        return true;
    };
    
    // If not ready, schedule retry
    if (!isFullyReady()) {
        console.log(`[${Date.now()}] Inventory not fully ready, scheduling retry`);
        setTimeout(() => window.displayInventoryItems(), 100);
        return;
    }
    
    const inv = document.getElementById('inventory');
    console.log(`[${Date.now()}] Displaying inventory items in ${inv.children.length} slots, bag has ${window.bag.length} items`);
    
    // Display inventory items
    inv.childNodes.forEach((el, i) => {
        if (i >= window.bag.length) return;
        
        const item = window.bag[i];
        if (item) {
            const itemHtml = window.itemToIconHtml(item);
            el.innerHTML = itemHtml || '';
            
            // Add event listeners to the new image if it doesn't have them
            const img = el.querySelector('.itemIcon');
            if (img && !img.dataset.eventHandlersAdded) {
                img.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('text', img.dataset.id);
                    e.dataTransfer.effectAllowed = 'move';
                });
                img.addEventListener('mouseenter', e => {
                    window.showTooltipForItem(item, e);
                });
                img.addEventListener('mouseleave', window.hideTooltip);
                img.addEventListener('dblclick', () => window.swapEquipWithBag(i));
                img.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm('Drop ' + item.name + ' to the world?')) {
                        window.dropItemFromInventory(i);
                    }
                });
                img.dataset.eventHandlersAdded = 'true';
            }
        } else {
            el.innerHTML = '';
        }
    });
    
    // Display equipment items
    let equipmentSlots = document.querySelectorAll('.pd-slot');
    if (equipmentSlots.length === 0) {
        equipmentSlots = document.querySelectorAll('.equipSlot');
    }
    if (equipmentSlots.length === 0) {
        equipmentSlots = document.querySelectorAll('[data-slot]');
    }
    
    console.log(`Found ${equipmentSlots.length} equipment slots`);
    
    // Check if window.equip is properly initialized
    if (!window.equip) {
        console.error(`[${Date.now()}] window.equip is not initialized!`);
        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
    }
    
    equipmentSlots.forEach(el => {
        const s = el.dataset.slot;
        
        if (!s) {
            console.error(`[${Date.now()}] Equipment slot element missing data-slot attribute:`, el);
            return;
        }
        
        const equippedItem = window.equip[s];
        
        if (equippedItem && typeof equippedItem === 'object' && equippedItem.id) {
            try {
                const iconSrc = window.getItemIconDataURLForItem(equippedItem);
                
                if (!iconSrc) {
                    console.error(`[${Date.now()}] Failed to generate icon for item:`, equippedItem);
                    return;
                }
                
                const html = `<img class="itemIcon" src="${iconSrc}" data-id="${equippedItem.id}" draggable="true">`;
                el.innerHTML = html;
                
            } catch (error) {
                console.error(`[${Date.now()}] Error generating icon for equipment slot ${s}:`, error);
                el.innerHTML = '';
            }
        } else {
            el.innerHTML = '';
        }
        
        // Add event listeners to equipped items
        const img = el.querySelector('.itemIcon');
        if (img && equippedItem && !img.dataset.eventHandlersAdded) {
            img.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text', img.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
            });
            img.addEventListener('mouseenter', e => {
                window.showTooltipForItem(equippedItem, e);
            });
            img.addEventListener('mouseleave', window.hideTooltip);
            img.addEventListener('dblclick', () => window.swapUnequip(s));
            img.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Drop ' + equippedItem.name + ' to the world?')) {
                    window.dropEquippedItem(s);
                }
            });
            img.dataset.eventHandlersAdded = 'true';
        }
    });
    
    console.log(`[${Date.now()}] Inventory display completed successfully`);
};

// Note: syncInventoryWithServer function removed - we're now server-authoritative
// All inventory changes go through the server via moveItem requests

// Chat system
function escapeHtml(s){ 
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); 
}

window.appendChat=function(name,msg){ 
    const d=document.createElement('div'); 
    d.innerHTML=`<strong>${escapeHtml(name)}:</strong> ${escapeHtml(msg)}`; 
    const box=document.getElementById('chatBox'); 
    box.appendChild(d); 
    box.scrollTop = box.scrollHeight; 
}

// Shop UI
const shopPanel=document.getElementById('shopPanel'); 
const shopList=document.getElementById('shopList'); 

document.getElementById('closeShop').addEventListener('click', ()=>{ 
    shopPanel.style.display='none'; 
});

window.openShop=function(){ 
    shopList.innerHTML=''; 
    
    // Add Sell All Inventory button at the top right
    const sellAllHeader = document.createElement('div');
    sellAllHeader.style.display = 'flex';
    sellAllHeader.style.justifyContent = 'space-between';
    sellAllHeader.style.alignItems = 'center';
    sellAllHeader.style.marginBottom = '15px';
    sellAllHeader.style.paddingBottom = '10px';
    sellAllHeader.style.borderBottom = '1px solid #234';
    
    const title = document.createElement('h3');
    title.innerText = 'Vendor';
    title.style.margin = '0';
    
    const sellAllButton = document.createElement('button');
    sellAllButton.innerText = 'Sell All Inventory';
    sellAllButton.className = 'sell-all-button';
    
    sellAllButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to sell ALL items in your inventory? This cannot be undone!')) {
            window.sellAllInventory();
        }
    });
    
    sellAllHeader.appendChild(title);
    sellAllHeader.appendChild(sellAllButton);
    shopList.appendChild(sellAllHeader);
    
    // Add inventory items
    if (window.bag && window.bag.length > 0) {
        const inventoryHeader = document.createElement('div');
        inventoryHeader.className = 'shop-section-header';
        inventoryHeader.innerText = 'Inventory Items';
        inventoryHeader.style.fontWeight = 'bold';
        inventoryHeader.style.marginTop = '10px';
        inventoryHeader.style.marginBottom = '5px';
        shopList.appendChild(inventoryHeader);
        
        window.bag.forEach((it,idx)=>{ 
            if(!it) return; 
            const row=document.createElement('div'); 
            row.className='row'; 
            const left=document.createElement('div'); 
            left.innerText = `${it.name} (${it.rarity})`; 
            const right=document.createElement('div'); 
            right.innerHTML = `${it.value||0} <button>Sell</button>`; 
            right.querySelector('button').addEventListener('click', ()=>{ 
                if (window.isConnected && window.isConnected()) {
                    // Send sell request to server
                    if (typeof window.wsSend === 'function') {
                        window.wsSend({
                            type: 'sellItem',
                            itemId: it.id,
                            fromWhere: 'bag',
                            fromIndex: idx,
                            fromSlot: null
                        });
                    } else {
                        console.warn('wsSend function not available');
                    }
                } else {
                    // Offline mode - update local inventory
                    window.player.pyreals += (it.value||0); 
                    window.bag[idx]=null; 
                    window.refreshInventoryUI(); 
                    if (window.log) {
                        window.log('Sold '+it.name+' for '+(it.value||0)+' Pyreals');
                    } else {
                        console.log('Sold '+it.name+' for '+(it.value||0)+' Pyreals');
                    } 
                }
                shopPanel.style.display='none'; 
            }); 
            row.appendChild(left); 
            row.appendChild(right); 
            shopList.appendChild(row); 
        });
    }
    
    // Add equipped items
    if (window.equip && typeof window.equip === 'object') {
        const equipHeader = document.createElement('div');
        equipHeader.className = 'shop-section-header';
        equipHeader.innerText = 'Equipped Items';
        equipHeader.style.fontWeight = 'bold';
        equipHeader.style.marginTop = '20px';
        equipHeader.style.marginBottom = '5px';
        shopList.appendChild(equipHeader);
        
        Object.entries(window.equip).forEach(([slot, it]) => {
            if (!it) return;
            const row = document.createElement('div');
            row.className = 'row';
            const left = document.createElement('div');
            left.innerText = `${it.name} (${it.rarity}) - ${slot}`;
            const right = document.createElement('div');
            right.innerHTML = `${it.value||0} <button>Sell</button>`;
            right.querySelector('button').addEventListener('click', () => {
                if (window.isConnected && window.isConnected()) {
                    // Send sell request to server
                    if (typeof window.wsSend === 'function') {
                        window.wsSend({
                            type: 'sellItem',
                            itemId: it.id,
                            fromWhere: 'equip',
                            fromIndex: null,
                            fromSlot: slot
                        });
                    } else {
                        console.warn('wsSend function not available');
                    }
                } else {
                    // Offline mode - update local equipment
                    window.player.pyreals += (it.value||0);
                    window.equip[slot] = null;
                    window.refreshInventoryUI();
                    if (window.log) {
                        window.log('Sold '+it.name+' for '+(it.value||0)+' Pyreals');
                    } else {
                        console.log('Sold '+it.name+' for '+(it.value||0)+' Pyreals');
                    }
                }
                shopPanel.style.display='none';
            });
            row.appendChild(left);
            row.appendChild(right);
            shopList.appendChild(row);
        });
    }
    
    shopPanel.style.display='block'; 
}

// Function to sell all inventory items at once
window.sellAllInventory = function() {
    let totalValue = 0;
    let itemsSold = 0;
    
    // Calculate total value and count items
    if (window.bag && window.bag.length > 0) {
        window.bag.forEach((item, idx) => {
            if (item && item.value) {
                totalValue += item.value;
                itemsSold++;
            }
        });
    }
    
    if (itemsSold === 0) {
        alert('No items to sell in inventory!');
        return;
    }
    
    if (window.isConnected && window.isConnected()) {
        // Send sell all request to server
        console.log('Sending sellAllInventory request to server...');
        if (typeof window.wsSend === 'function') {
            const result = window.wsSend({
                type: 'sellAllInventory',
                fromWhere: 'bag'
            });
            console.log('wsSend result:', result);
        } else {
            console.warn('wsSend function not available');
        }
    } else {
        // Offline mode - sell all items locally
        if (window.bag && window.bag.length > 0) {
            window.bag.forEach((item, idx) => {
                if (item && item.value) {
                    window.player.pyreals += item.value;
                    window.bag[idx] = null;
                }
            });
            
            window.refreshInventoryUI();
            
            if (window.log) {
                window.log(`Sold ${itemsSold} items for ${totalValue} Pyreals total`);
            } else {
                console.log(`Sold ${itemsSold} items for ${totalValue} Pyreals total`);
            }
        }
    }
    
    // Close the shop panel
    shopPanel.style.display = 'none';
};

// Panel scrollbar management
window.managePanelScrollbars = function() {
    // Safety check - ensure DOM is ready
    if (!document.body || !document.readyState === 'complete') {
        return;
    }
    
    try {
        const panels = document.querySelectorAll('.panel');
        
        if (!panels || panels.length === 0) {
            return; // No panels found, exit safely
        }
        
        panels.forEach((panel, index) => {
            try {
                // Ensure panel is a valid DOM element
                if (!panel || !(panel instanceof Element)) {
                    return;
                }
                
                // Check if panel content is taller than available space
                const panelRect = panel.getBoundingClientRect();
                const panelContent = panel.scrollHeight;
                const panelHeight = panelRect.height;
                
                // Only proceed if we have valid dimensions
                if (panelRect.height === 0 || panelContent === 0) {
                    return;
                }
                
                // If content is taller than panel, add scrollbar
                if (panelContent > panelHeight + 5) { // +5 for small tolerance
                    if (!panel.classList.contains('scrollable')) {
                        panel.classList.add('scrollable');
                        
                        // Add scrollwheel functionality for this panel
                        if (!panel.hasAttribute('data-scrollwheel-bound')) {
                            panel.setAttribute('data-scrollwheel-bound', 'true');
                            
                            // Add wheel event listener
                            panel.addEventListener('wheel', (event) => {
                                event.preventDefault();
                                
                                // Get scroll direction and amount
                                const delta = event.deltaY;
                                const scrollAmount = Math.abs(delta) > 50 ? 50 : Math.abs(delta);
                                
                                // Scroll the panel
                                if (delta > 0) {
                                    // Scroll down
                                    panel.scrollTop += scrollAmount;
                                } else {
                                    // Scroll up
                                    panel.scrollTop -= scrollAmount;
                                }
                            }, { passive: false });
                        }
                    }
                } else {
                    if (panel.classList.contains('scrollable')) {
                        panel.classList.remove('scrollable');
                        
                        // Remove scrollwheel functionality if panel is no longer scrollable
                        if (panel.hasAttribute('data-scrollwheel-bound')) {
                            panel.removeAttribute('data-scrollwheel-bound');
                            // Note: We can't easily remove the event listener without storing a reference
                            // The panel will be recreated if needed, so this is acceptable
                        }
                    }
                }
            } catch (panelError) {
                // Silently handle panel errors
            }
        });
        
    } catch (error) {
        // Silently handle any errors
    }
};

// Initialize scrollbar management
window.addEventListener('load', () => {
    // Wait for DOM to be fully ready and stable
    const initializeScrollbars = () => {
        // Check if all required elements are available
        const uiContainer = document.getElementById('ui');
        const panels = document.querySelectorAll('.panel');
        
        if (!uiContainer) {
            setTimeout(initializeScrollbars, 100);
            return;
        }
        
        if (panels.length === 0) {
            setTimeout(initializeScrollbars, 100);
            return;
        }
        
        // Initial check
        try {
            window.managePanelScrollbars();
        } catch (error) {
            // Silently handle errors
        }
        
        // Check on window resize
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(window._resizeTimer);
            window._resizeTimer = setTimeout(() => {
                try {
                    if (typeof window.managePanelScrollbars === 'function') {
                        window.managePanelScrollbars();
                    }
                } catch (error) {
                    // Silently handle errors
                }
            }, 150);
        });
        
        // Check when content changes (like inventory updates)
        try {
            const observer = new MutationObserver((mutations) => {
                // Only process if we have mutations and they're relevant
                if (mutations.length > 0) {
                    const hasRelevantChanges = mutations.some(mutation => 
                        mutation.type === 'childList' || 
                        (mutation.type === 'attributes' && 
                         (mutation.attributeName === 'style' || mutation.attributeName === 'class'))
                    );
                    
                    if (hasRelevantChanges) {
                        // Debounce mutation events
                        clearTimeout(window._mutationTimer);
                        window._mutationTimer = setTimeout(() => {
                            try {
                                if (typeof window.managePanelScrollbars === 'function') {
                                    window.managePanelScrollbars();
                                }
                            } catch (error) {
                                // Silently handle errors
                            }
                        }, 100);
                    }
                }
            });
            
            // Observe the UI container for changes
            if (uiContainer) {
                observer.observe(uiContainer, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }
        } catch (error) {
            // Silently handle observer errors
        }
    };
    
    // Start initialization after a short delay to ensure DOM is stable
    setTimeout(initializeScrollbars, 300);
});

})();

