// equipment.js - Equipment management system
// Handles all equipment-related operations including equipping, unequipping, and server synchronization

// Core equipment functions
window.swapEquipWithBag = function(slotIdx) { 
    const it = window.bag[slotIdx]; 
    if(!it) return; 
    
    console.log('swapEquipWithBag called:', { slotIdx, item: it.name });
    
    // Send request to server instead of modifying local state
    if (typeof window.isConnected === 'function' && window.isConnected()) {
        // Determine target equipment slot based on item type
        let targetSlot = null;
        if (it.type === 'armor' && it.slot) {
            targetSlot = it.slot;
        } else if (it.type === 'weapon') {
            // Try mainhand first, then offhand if mainhand is occupied
            if (!window.equip['mainhand']) {
                targetSlot = 'mainhand';
            } else if (!window.equip['offhand']) {
                targetSlot = 'offhand';
            } else {
                targetSlot = 'mainhand'; // Will swap with mainhand
            }
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
    if(it.type==='armor' && it.slot){ 
        if(!window.equip[it.slot]) {
            window.equip[it.slot] = it;
            window.bag[slotIdx] = null;
            console.log('Equipped armor to slot:', { item: it.name, slot: it.slot });
        } else {
            // Swap with equipped item
            const prev = window.equip[it.slot];
            window.equip[it.slot] = it;
            window.bag[slotIdx] = prev;
            console.log('Swapped armor with equipped item:', { newItem: it.name, prevItem: prev.name });
        }
        
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

window.swapUnequip = function(slot) { 
    const prev = window.equip[slot]; 
    if(!prev) return; 
    
    // Prevent duplicate calls within a short time window
    const now = Date.now();
    const lastCallKey = `swapUnequip_${slot}`;
    if (window[lastCallKey] && (now - window[lastCallKey]) < 500) {
        console.log('Preventing duplicate swapUnequip call for slot:', slot);
        return;
    }
    window[lastCallKey] = now;
    
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

window.handleEquipDrop = function(id, slot) { 
    const found = window.findItemById(id); 
    if(!found) return; 
    
    // Prevent duplicate calls within a short time window
    const now = Date.now();
    const lastCallKey = `handleEquipDrop_${id}_${slot}`;
    if (window[lastCallKey] && (now - window[lastCallKey]) < 500) {
        console.log('Preventing duplicate handleEquipDrop call for item:', id, 'slot:', slot);
        return;
    }
    window[lastCallKey] = now;
    
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
        // Swap items between bag slots
        const tmp=window.bag[slotIdx]; 
        window.bag[slotIdx]=found.item; 
        window.bag[found.idx]=tmp; 
        console.log('Swapped bag items:', { from: found.idx, to: slotIdx, item: found.item.name });
    } else if(found.where==='equip'){ 
        // Unequip item and place in bag slot
        const tmp=window.bag[slotIdx];
        window.bag[slotIdx]=found.item;
        window.equip[found.slot]=tmp;
        console.log('Swapped equipment with bag item:', { equipped: found.item.name, bagItem: tmp?.name || 'none' });
    }
    
    // Only refresh UI if we're not connected to server, otherwise let the server handle it
    if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
        window.refreshInventoryUI(); 
    }
    // Note: No need to sync with server since we're now server-authoritative
}

// Equipment utility functions
window.getEquipmentColors = function() {
    const colors = {};
    if (window.equip) {
        Object.keys(window.equip).forEach(slot => {
            const item = window.equip[slot];
            if (item && item.color) {
                colors[slot] = item.color;
            }
        });
    }
    return colors;
}

window.calculateEquipmentStats = function() {
    const stats = {
        Strength: 0,
        Endurance: 0,
        Coordination: 0,
        Quickness: 0,
        Focus: 0,
        Mana: 0,
        Health: 0
    };
    
    if (window.equip) {
        Object.keys(window.equip).forEach(slot => {
            const item = window.equip[slot];
            if (item && item.stats) {
                Object.keys(item.stats).forEach(stat => {
                    if (stats.hasOwnProperty(stat)) {
                        stats[stat] += item.stats[stat];
                    }
                });
            }
        });
    }
    
    return stats;
}

// Server synchronization wrappers (from methods.js)
if (typeof window !== 'undefined') {
    // Wrap swapEquipWithBag to add server synchronization
    const origSwapEquipWithBag = window.swapEquipWithBag;
    window.swapEquipWithBag = function(slotIdx) {
        const res = origSwapEquipWithBag.apply(this, arguments);
        try { 
            // Don't send equipUpdate here - let the server handle equipment updates via moveItem
            // The server is authoritative for equipment state
            if (window.isConnected && window.isConnected()) {
                // Only send visual updates, not equipment updates
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

    // Wrap swapUnequip to add server synchronization
    const origSwapUnequip = window.swapUnequip;
    window.swapUnequip = function(slot) {
        const res = origSwapUnequip.apply(this, arguments);
        try { 
            // Update reach calculation immediately when equipment changes
            if (window.player && typeof window.player.calculateReach === 'function') {
                window.player.calculateReach();
            }
            
            // Don't send equipUpdate here - let the server handle equipment updates via moveItem
            // The server is authoritative for equipment state
            if (window.isConnected && window.isConnected()) {
                // Only send visual updates, not equipment updates
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

    // Wrap handleEquipDrop to add server synchronization
    const origHandleEquipDrop = window.handleEquipDrop;
    window.handleEquipDrop = function(id, slot) {
        const res = origHandleEquipDrop.apply(this, arguments);
        try { 
            // Update reach calculation immediately when equipment changes
            if (window.player && typeof window.player.calculateReach === 'function') {
                window.player.calculateReach();
            }
            
            // Don't send equipUpdate here - let the server handle equipment updates via moveItem
            // The server is authoritative for equipment state
            if (window.isConnected && window.isConnected()) {
                // Only send visual updates, not equipment updates
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
