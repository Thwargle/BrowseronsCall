// network.js — improved websocket client with reconnection and error handling
(function(){
'use strict';

let socket = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000; // Start with 1 second
let isConnecting = false;
let serverUrl = '';

// Connection status
window.connectionStatus = {
    connected: false,
    connecting: false,
    lastError: null,
    initialConnectionComplete: false
};

window.wsConnect = function(url) {
    if (isConnecting) return; // Prevent multiple connection attempts
    
    serverUrl = url;
    isConnecting = true;
    window.connectionStatus.connecting = true;
    
    try {
        window.log('Connecting to ' + url);
        socket = new WebSocket(url);
        
        socket.onopen = () => {
            window.log('Connected to ' + url);
            isConnecting = false;
            reconnectAttempts = 0;
            reconnectDelay = 1000;
            window.connectionStatus.connected = true;
            window.connectionStatus.connecting = false;
            window.connectionStatus.lastError = null;
            window.connectionStatus.initialConnectionComplete = false;
            
            // Send join message - get name from login screen
            const playerName = document.getElementById('loginPlayerName').value.trim() || 'Player';
            socket.send(JSON.stringify({
                type: 'join',
                name: playerName,
                shirtColor: window.BASE ? window.BASE.shirtColor : null,
                pantColor: window.BASE ? window.BASE.pantColor : null,
                equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {}
            }));
            
            // Don't send equipment snapshot on connection - let server send authoritative equipment data
            // The server will send playerData with equipment after connection
            
            // Update UI to show connected state
            updateConnectionUI();
            
            // Hide connection screen and show game
            if (window.hideConnectionScreen) {
                window.hideConnectionScreen();
            }
        };
        
        socket.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                handleServerMessage(msg);
            } catch (e) {
                console.error('Error parsing server message:', e);
                window.log('Error parsing server message');
            }
        };
        
        socket.onclose = (event) => {
            window.log('Disconnected from server');
            isConnecting = false;
            window.connectionStatus.connected = false;
            window.connectionStatus.connecting = false;
            
            // Update UI to show disconnected state
            updateConnectionUI();
            
            // Show connection screen again
            if (window.showConnectionScreen) {
                window.showConnectionScreen();
            }
            
            // Attempt reconnection if it wasn't a clean close
            if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                window.log('Attempting to reconnect... (Attempt ' + (reconnectAttempts + 1) + '/' + maxReconnectAttempts + ')');
                setTimeout(() => {
                    reconnectAttempts++;
                    reconnectDelay = Math.min(reconnectDelay * 1.5, 10000); // Exponential backoff, max 10 seconds
                    wsConnect(serverUrl);
                }, reconnectDelay);
            } else if (reconnectAttempts >= maxReconnectAttempts) {
                window.log('Max reconnection attempts reached. Please refresh the page or check your connection.');
                window.connectionStatus.lastError = 'Max reconnection attempts reached';
            }
        };
        
        socket.onerror = (error) => {
            window.log('Socket error: ' + (error.message || 'Unknown error'));
            window.connectionStatus.lastError = error.message || 'Unknown error';
            isConnecting = false;
            window.connectionStatus.connecting = false;
        };
        
    } catch (e) {
        window.log('Failed to connect: ' + e.message);
        window.connectionStatus.lastError = e.message;
        isConnecting = false;
        window.connectionStatus.connecting = false;
    }
};

window.wsSend = function(obj) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(JSON.stringify(obj));
            return true;
        } catch (e) {
            window.log('Failed to send message: ' + e.message);
            return false;
        }
    } else {
        // If not connected, try to reconnect
        if (!isConnecting && serverUrl) {
            window.log('Not connected, attempting to reconnect...');
            wsConnect(serverUrl);
        }
        return false;
    }
};

// Manual reconnection function
window.wsReconnect = function() {
    if (serverUrl && !isConnecting) {
        reconnectAttempts = 0;
        reconnectDelay = 1000;
        wsConnect(serverUrl);
    }
};

// Manual disconnect function
window.wsDisconnect = function() {
    if (socket) {
        socket.close(1000, 'User disconnected');
        socket = null;
        window.connectionStatus.connected = false;
        window.connectionStatus.connecting = false;
        window.log('Manually disconnected from server');
        
        // Show connection screen again
        if (window.showConnectionScreen) {
            window.showConnectionScreen();
        }
    }
};

// Update connection UI (button colors and states)
function updateConnectionUI() {
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (!connectBtn || !disconnectBtn) return; // Elements might not exist yet
    
    if (window.connectionStatus.connected) {
        connectBtn.style.backgroundColor = '#0a5a0a';
        connectBtn.style.borderColor = '#0f8f0f';
        connectBtn.style.color = '#ffffff';
        connectBtn.textContent = 'Connected';
        connectBtn.disabled = true;
        
        disconnectBtn.style.backgroundColor = '#8a0a0a';
        disconnectBtn.style.borderColor = '#8f0f0f';
        disconnectBtn.style.color = '#ffffff';
        disconnectBtn.disabled = false;
    } else if (window.connectionStatus.connecting) {
        connectBtn.style.backgroundColor = '#5a5a0a';
        connectBtn.style.borderColor = '#8f8f0f';
        connectBtn.style.color = '#ffffff';
        connectBtn.textContent = 'Connecting...';
        connectBtn.disabled = true;
        
        disconnectBtn.style.backgroundColor = '#5a5a5a';
        disconnectBtn.style.borderColor = '#8f8f8f';
        disconnectBtn.style.color = '#cccccc';
        disconnectBtn.disabled = true;
    } else {
        connectBtn.style.backgroundColor = '#0a0a5a';
        connectBtn.style.borderColor = '#0f0f8f';
        connectBtn.style.color = '#ffffff';
        connectBtn.textContent = 'Connect';
        connectBtn.disabled = false;
        
        disconnectBtn.style.backgroundColor = '#5a5a5a';
        disconnectBtn.style.borderColor = '#8f8f8f';
        disconnectBtn.style.color = '#cccccc';
        disconnectBtn.disabled = true;
    }
    
    // Update the global connection UI state
    if (window.updateConnectionUI) {
        window.updateConnectionUI(window.connectionStatus.connected);
    }
}

// Initialize connection UI when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateConnectionUI);
} else {
    updateConnectionUI();
}

// Check connection status
window.isConnected = function() {
    return socket && socket.readyState === WebSocket.OPEN;
};

window.handleServerMessage = function(msg) {
    try {
        switch(msg.type) {
            case 'chat':
                window.appendChat(msg.name || msg.id, msg.msg || msg.text || '');
                break;
            case 'chatMessage':
                // Handle death messages and other server-generated chat messages
                window.appendChat('', msg.message || '', msg.color || '#ffffff');
                break;
            case 'joinRejected':
                window.log('Server rejected join: ' + (msg.reason || 'Unknown reason'));
                alert(msg.reason || 'Join rejected. Please choose a unique name.');
                // Ensure UI resets to disconnected state
                try { socket && socket.close(1000, 'Join rejected'); } catch(_){}
                break;
            case 'spawnEnemy':
                // Ensure enemy list exists and track by id
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                const enemyData = { ...msg };
                // Use server-provided colors for consistent appearance across all clients
                if (!enemyData.colors) {
                    console.warn('Enemy spawned without colors from server:', msg.id);
                }
                window.remoteEnemies.set(msg.id, enemyData);
                break;
            case 'playerJoined':
                window.log((msg.name || 'Player') + ' joined');
                if (!window.gameState) window.gameState = { players: [], enemies: [], worldDrops: [] };
                if (!window.gameState.players.some(p => p.id === msg.id)) {
                    window.gameState.players.push({
                        id: msg.id,
                        name: msg.name || msg.id,
                        x: 80,
                        y: 0,
                        health: 100,
                        maxHealth: 100,
                        pyreals: 0,
                        equip: msg.equip || null,
                        shirtColor: msg.shirtColor || null,
                        pantColor: msg.pantColor || null,
                        equipmentColors: msg.equipmentColors || {},
                        reach: msg.reach || 70
                    });
                } else {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) {
                        if (msg.name) window.gameState.players[idx].name = msg.name;
                        if (msg.equip) window.gameState.players[idx].equip = msg.equip;
                        if (msg.shirtColor) window.gameState.players[idx].shirtColor = msg.shirtColor;
                        if (msg.pantColor) window.gameState.players[idx].pantColor = msg.pantColor;
                        if (msg.equipmentColors) window.gameState.players[idx].equipmentColors = msg.equipmentColors;
                    }
                }
                break;
            case 'playerRenamed':
                window.log('Player renamed to ' + msg.name);
                if (window.gameState && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) window.gameState.players[idx].name = msg.name;
                }
                break;
            case 'playerLeft':
                // Remove player from game state
                if (msg.id) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) {
                        window.gameState.players.splice(idx, 1);
                        if (window.log) {
                            window.log(msg.name + ' left the game');
                        } else {
                            console.log(msg.name + ' left the game');
                        }
                    }
                }
                break;

            case 'playerDeath':
                // Handle player death
                if (msg.playerId && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.playerId);
                    if (idx !== -1) {
                        window.gameState.players[idx].isDead = true;
                        window.gameState.players[idx].health = 0;
                        
                        if (window.log) {
                            window.log(msg.playerName + ' has died!');
                        } else {
                            console.log(msg.playerName + ' has died!');
                        }
                    }
                }
                break;

            case 'playerRespawn':
                // Handle player respawn
                if (msg.playerId && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.playerId);
                    if (idx !== -1) {
                        window.gameState.players[idx].isDead = false;
                        window.gameState.players[idx].x = msg.x;
                        window.gameState.players[idx].y = msg.y;
                        window.gameState.players[idx].health = msg.health;
                        window.gameState.players[idx].maxHealth = msg.maxHealth;
                        window.gameState.players[idx].vx = 0;
                        window.gameState.players[idx].vy = 0;
                        
                        if (window.log) {
                            window.log(msg.playerName + ' has respawned!');
                        } else {
                            console.log(msg.playerName + ' has respawned!');
                        }
                    }
                }
                break;

            case 'equipUpdate':
                // Update another player's equipment
                if (window.gameState && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) {
                        const cur = window.gameState.players[idx];
                        window.gameState.players[idx] = { ...cur, equip: msg.equip, reach: msg.reach };
                    }
                }
                break;
                
            case 'inventoryUpdate':
                // Update another player's inventory
                if (window.gameState && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) {
                        const cur = window.gameState.players[idx];
                        window.gameState.players[idx] = { ...cur, inventory: msg.inventory };
                    }
                }
                break;

            case 'visualUpdate':
                // Update another player's visual appearance
                if (window.gameState && window.gameState.players) {
                    const idx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (idx !== -1) {
                        const cur = window.gameState.players[idx];
                        window.gameState.players[idx] = { 
                            ...cur, 
                            shirtColor: msg.shirtColor || cur.shirtColor,
                            pantColor: msg.pantColor || cur.pantColor,
                            equipmentColors: msg.equipmentColors || cur.equipmentColors
                        };
                    }
                }
                break;
                
            case 'pyrealsUpdated':
                // Update player's pyreals
                console.log('Received pyrealsUpdated message:', msg.pyreals);
                if (msg.pyreals !== undefined) {
                    if (window.player) {
                        window.player.pyreals = msg.pyreals;
                    }
                    if (window.log) {
                        window.log(`Pyreals updated to: ${msg.pyreals}`);
                    } else {
                        console.log(`Pyreals updated to: ${msg.pyreals}`);
                    }
                }
                break;
                
            case 'playerData':
                // Handle player data from server (inventory, equipment, etc.)
                if (msg.equip) {
                    // Ensure all equipment slots exist and restore from server data
                    const defaultEquip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    // For reconnections, always use server data to ensure consistency
                    window.equip = { ...defaultEquip, ...msg.equip };
                    console.log('Restoring equipment from server data:', window.equip);
                }
                
                if (msg.inventory) {
                    // Server is authoritative - always use server data for reconnections
                    if (Array.isArray(msg.inventory)) {
                        console.log('Restoring inventory from server data:', msg.inventory);
                        window.bag = [...msg.inventory];
                        while (window.bag.length < 12) window.bag.push(null);
                        if (window.bag.length > 12) window.bag = window.bag.slice(0, 12);
                    } else {
                        console.log('Server inventory data is not an array, creating empty bag');
                        window.bag = new Array(12).fill(null);
                    }
                }
                
                // Ensure health regeneration system is properly initialized on reconnection
                if (window.player && msg.health !== undefined) {
                    // If player has less than max health and hasn't been attacked recently, 
                    // set damage timer to allow health regeneration to begin
                    if (msg.health < window.player.maxHealth && msg.health > 0) {
                        // Set damage timer to 31 seconds to allow immediate health regeneration
                        // (health regeneration starts after 30 seconds of no damage)
                        window.player._damageTimer = 31;
                        window.player._regenActive = true;
                        console.log('Health regeneration enabled on reconnection - player has', msg.health, '/', window.player.maxHealth, 'health');
                    } else if (msg.health >= window.player.maxHealth) {
                        // Player is at full health, reset regeneration state
                        window.player._damageTimer = 0;
                        window.player._regenActive = false;
                        console.log('Player at full health on reconnection, regeneration disabled');
                    }
                }
                
                // Ensure inventory UI is fully ready before displaying items
                const ensureInventoryReady = () => {
                    // Check if all required elements exist and are properly initialized
                    const inventory = document.getElementById('inventory');
                    const hasInventoryElement = inventory && inventory.children.length > 0;
                    
                    // Check if equipment slots exist
                    let equipmentSlots = document.querySelectorAll('.pd-slot');
                    if (equipmentSlots.length === 0) {
                        equipmentSlots = document.querySelectorAll('.equipSlot');
                    }
                    if (equipmentSlots.length === 0) {
                        equipmentSlots = document.querySelectorAll('[data-slot]');
                    }
                    const hasEquipmentSlots = equipmentSlots.length > 0;
                    
                    // Check if required functions are available
                    const hasRequiredFunctions = typeof window.getItemIconDataURLForItem === 'function' && 
                                              typeof window.displayInventoryItems === 'function';
                    
                    // Check if DOM is fully ready
                    const isDOMReady = document.readyState === 'complete' && 
                                     document.body && 
                                     document.getElementById('ui');
                    
                    console.log('Inventory readiness check:', {
                        hasInventoryElement,
                        inventorySlots: inventory?.children?.length || 0,
                        hasEquipmentSlots,
                        equipmentSlotsCount: equipmentSlots.length,
                        hasRequiredFunctions,
                        isDOMReady,
                        readyState: document.readyState
                    });
                    
                    if (hasInventoryElement && hasEquipmentSlots && hasRequiredFunctions && isDOMReady) {
                        console.log('Inventory UI is fully ready, displaying items');
                        // Initialize UI if needed
                        if (window.initInventoryUI) {
                            window.initInventoryUI();
                        }
                        if (window.initPaperDollUI) {
                            window.initPaperDollUI();
                        }
                        
                        // Display inventory items with multiple attempts to ensure success
                        const displayWithRetry = (attempt = 1) => {
                            try {
                                if (window.displayInventoryItems) {
                                    window.displayInventoryItems();
                                    console.log('Successfully displayed inventory items on attempt', attempt);
                                } else {
                                    throw new Error('displayInventoryItems function not available');
                                }
                            } catch (error) {
                                console.warn(`Error displaying inventory items on attempt ${attempt}:`, error);
                                if (attempt < 5) {
                                    setTimeout(() => displayWithRetry(attempt + 1), 200 * attempt);
                                } else {
                                    console.error('Failed to display inventory items after 5 attempts');
                                }
                            }
                        };
                        
                        // Start display process
                        setTimeout(displayWithRetry, 100);
                        
                        return true; // Success
                    } else {
                        console.log('Inventory UI not ready yet, scheduling retry');
                        return false; // Not ready
                    }
                };
                
                // Try to display inventory immediately, with fallback retries
                if (!ensureInventoryReady()) {
                    // Schedule multiple retries with increasing delays
                    const retryDelays = [200, 500, 1000, 2000, 3000];
                    retryDelays.forEach((delay, index) => {
                        setTimeout(() => {
                            if (!ensureInventoryReady()) {
                                console.log(`Retry ${index + 1} failed, will retry in ${retryDelays[index + 1] || 'no more'}ms`);
                            }
                        }, delay);
                    });
                }
                
                // Ensure worldDrops exists
                if (!window.worldDrops) {
                    window.worldDrops = [];
                }
                
                // Mark initial connection as complete
                window.connectionStatus.initialConnectionComplete = true;
                
                break;
                
            case 'gameState':
                
                // Handle initial game state
                if (msg.players) {
                    // Update local game state with players from server, ensuring visual data is included
                    const playersWithVisualData = msg.players.map(player => ({
                        ...player,
                        shirtColor: player.shirtColor || null,
                        pantColor: player.pantColor || null,
                        equipmentColors: player.equipmentColors || {}
                    }));
                    
                    if (window.gameState) {
                        window.gameState.players = playersWithVisualData;
                    } else {
                        window.gameState = { players: playersWithVisualData, enemies: msg.enemies || [], worldDrops: msg.worldDrops || [] };
                    }
                    
                    // If we have a local player, update their position from server data
                    if (window.player && window.player.id) {
                        const serverPlayer = playersWithVisualData.find(p => p.id === window.player.id);
                        if (serverPlayer) {
                            window.player.x = serverPlayer.x;
                            window.player.y = serverPlayer.y;
                            window.player.health = serverPlayer.health;
                            window.player.maxHealth = serverPlayer.maxHealth;
                            window.player.pyreals = serverPlayer.pyreals;
                        }
                    }
                }
                // Server-authoritative enemies
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                if (Array.isArray(msg.enemies)) {
                    window.remoteEnemies.clear();
                    for (const e of msg.enemies) window.remoteEnemies.set(e.id, { ...e });
                }
                                 if (msg.worldDrops) {
                    // Server is always authoritative for world drops
                    console.log('Received world drops from server:', msg.worldDrops.length, 'items');
                    
                    // Always replace world drops completely on gameState messages (initial connection/reconnection)
                    // This prevents accumulation and ensures consistency with server state
                    console.log('Replacing world drops with server data');
                    window.worldDrops.length = 0;
                    
                    // Process all drops from server
                    msg.worldDrops.forEach(dropData => {
                        // Normalize the drop data to ensure it has all required properties
                        const normalizedDrop = { ...dropData };
                        
                        // Ensure the drop has required properties for pickup
                        if (!normalizedDrop.pickRadius) normalizedDrop.pickRadius = 40;
                        if (!normalizedDrop.grounded) normalizedDrop.grounded = false;
                        
                        // Handle pickup timing - convert server timestamp to client timestamp
                        if (normalizedDrop.noPickupUntil && normalizedDrop.noPickupUntil > 1000000000000) {
                            // Server timestamp is in milliseconds since epoch, convert to relative time
                            const serverTime = normalizedDrop.noPickupUntil;
                            const currentTime = Date.now();
                            const timeDiff = serverTime - currentTime;
                            normalizedDrop.noPickupUntil = performance.now() + timeDiff;
                        } else if (!normalizedDrop.noPickupUntil && normalizedDrop.noPickup) {
                            // Convert old noPickup countdown to noPickupUntil timestamp
                            normalizedDrop.noPickupUntil = performance.now() + (normalizedDrop.noPickup * 1000);
                            delete normalizedDrop.noPickup; // Remove old property
                        } else if (!normalizedDrop.noPickupUntil) {
                            // Default pickup delay if neither property exists
                            normalizedDrop.noPickupUntil = performance.now() + 1000;
                        }
                        
                        // Normalize the item if it exists
                        if (normalizedDrop.item && window.normalizeItem) {
                            normalizedDrop.item = window.normalizeItem(normalizedDrop.item);
                        }
                        
                        window.worldDrops.push(normalizedDrop);
                    });
                }
                
                // Vendor position and colors from server - ALWAYS process this
                if (msg.vendor) {
                    // Ensure we preserve the colors from the server and don't override them
                    const newVendor = { 
                        ...(window.vendor||{}), 
                        ...msg.vendor, 
                        anim: (window.vendor && window.vendor.anim) || {timer:0,index:0},
                        // Explicitly ensure colors are preserved from server data
                        colors: msg.vendor.colors || null
                    };
                    
                    // Set the vendor object
                    window.vendor = newVendor;
                }
                // Spawners for debug visuals
                if (Array.isArray(msg.spawners)) {
                    window.spawners = msg.spawners.map(s => ({...s}));
                }
                break;
            case 'playerUpdate':
                // Update or create moving player in replicated state
                if (!window.gameState) window.gameState = { players: [], enemies: [], worldDrops: [] };
                const idxPU = window.gameState.players.findIndex(p => p.id === msg.id);
                if (idxPU !== -1) {
                    window.gameState.players[idxPU] = { 
                        ...window.gameState.players[idxPU], 
                        x: msg.x, 
                        y: msg.y, 
                        health: msg.health, 
                        maxHealth: msg.maxHealth, 
                        pyreals: msg.pyreals,
                        shirtColor: msg.shirtColor || window.gameState.players[idxPU].shirtColor,
                        pantColor: msg.pantColor || window.gameState.players[idxPU].pantColor,
                        equipmentColors: msg.equipmentColors || window.gameState.players[idxPU].equipmentColors
                    };
                } else {
                    window.gameState.players.push({ 
                        id: msg.id, 
                        name: msg.name || msg.id, 
                        x: msg.x, 
                        y: msg.y, 
                        health: msg.health, 
                        maxHealth: msg.maxHealth, 
                        pyreals: msg.pyreals,
                        shirtColor: msg.shirtColor || null,
                        pantColor: msg.pantColor || null,
                        equipmentColors: msg.equipmentColors || {}
                    });
                }
                
                // If this is the local player, ensure health regeneration is properly initialized
                if (window.player && window.player.id === msg.id && msg.health !== undefined) {
                    // If player has less than max health and hasn't been attacked recently, 
                    // set damage timer to allow health regeneration to begin
                    if (msg.health < window.player.maxHealth && msg.health > 0) {
                        // Set damage timer to 31 seconds to allow immediate health regeneration
                        // (health regeneration starts after 30 seconds of no damage)
                        window.player._damageTimer = 31;
                        window.player._regenActive = true;
                        console.log('Health regeneration enabled from playerUpdate - player has', msg.health, '/', window.player.maxHealth, 'health');
                    } else if (msg.health >= window.player.maxHealth) {
                        // Player is at full health, reset regeneration state
                        window.player._damageTimer = 0;
                        window.player._regenActive = false;
                        console.log('Player at full health from playerUpdate, regeneration disabled');
                    }
                }
                break;
            case 'enemyUpdate':
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                if (typeof msg.id !== 'undefined') {
                    const existing = window.remoteEnemies.get(msg.id) || {};
                    // Store previous health to detect damage
                    const previousHealth = existing.health || 0;
                    
                    // Preserve existing colors when updating enemy data
                    const updatedEnemy = { ...existing, ...msg };
                    // Colors should come from server, don't generate client-side
                    if (!updatedEnemy.colors) {
                        console.warn('Enemy updated without colors from server:', msg.id);
                    }
                    
                    // Trigger damage flash if health decreased
                    if (updatedEnemy.health < previousHealth && updatedEnemy.health > 0) {
                        updatedEnemy.damageFlashTimer = 0.3; // Flash for 0.3 seconds
                    }
                    
                    window.remoteEnemies.set(msg.id, updatedEnemy);
                }
                break;
            case 'enemyDeath':
                if (window.remoteEnemies && typeof msg.id !== 'undefined') {
                    window.remoteEnemies.delete(msg.id);
                }
                break;
            case 'enemySpawned':
                if (window.gameState && window.gameState.enemies) {
                    // Add to remote enemies map for server-authoritative enemies
                    if (window.remoteEnemies) {
                        const enemyData = { ...msg };
                        // Use server-provided colors for consistent appearance across all clients
                        if (!enemyData.colors) {
                            console.warn('Enemy spawned without colors from server:', msg.id);
                        }
                        window.remoteEnemies.set(msg.id, enemyData);
                    }
                }
                break;
                
            case 'basic':
                // Handle enemy data with type 'basic' (appears to be enemy spawn/update data)
                if (msg.id && typeof msg.x === 'number' && typeof msg.y === 'number') {
                    console.log('Received enemy data with type "basic":', msg);
                    // This appears to be enemy data, treat it as an enemy spawn
                    if (window.gameState && window.gameState.enemies) {
                        if (window.remoteEnemies) {
                            // Check if enemy already exists
                            if (window.remoteEnemies.has(msg.id)) {
                                // Update existing enemy
                                const existing = window.remoteEnemies.get(msg.id);
                                Object.assign(existing, msg);
                            } else {
                                // Add new enemy
                                const enemyData = { ...msg };
                                // Use server-provided colors for consistent appearance across all clients
                                if (!enemyData.colors) {
                                    console.warn('Enemy data without colors from server:', msg.id);
                                }
                                window.remoteEnemies.set(msg.id, enemyData);
                            }
                        }
                    }
                }
                break;
            case 'vendorUpdate':
                // Update vendor position from server while preserving other properties like colors
                if (window.vendor && typeof msg.x === 'number' && typeof msg.y === 'number') {
                    // Preserve existing properties (especially colors) when updating position
                    window.vendor = { ...window.vendor, x: msg.x, y: msg.y };
                }
                break;
            case 'elite':
            case 'boss':
                // Handle elite and boss spawner messages
                if (msg.id && typeof msg.x === 'number' && typeof msg.y === 'number') {
                    // This is a spawner message, not an enemy message
                    if (!window.spawners) window.spawners = [];
                    
                    // Check if spawner already exists
                    const existingSpawnerIndex = window.spawners.findIndex(s => s.id === msg.id);
                    if (existingSpawnerIndex !== -1) {
                        // Update existing spawner
                        window.spawners[existingSpawnerIndex] = { ...window.spawners[existingSpawnerIndex], ...msg };
                    } else {
                        // Add new spawner
                        window.spawners.push({ ...msg });
                    }
                }
                break;
                         case 'dropItem':
                    // Add drop locally for immediate visual feedback, but server remains authoritative
                    // Ensure worldDrops array exists
                    if (!window.worldDrops) window.worldDrops = [];
                    
                    // Check if this drop already exists to prevent duplicates
                    const existingDropIndex = window.worldDrops.findIndex(d => d.id === msg.id);
                    if (existingDropIndex !== -1) {
                        console.log('Drop already exists locally, skipping duplicate:', msg.id);
                        break;
                    }
                    
                    // Normalize the drop data to ensure consistent structure
                    const normalizedDrop = { ...msg };
                    if (normalizedDrop.item) {
                        normalizedDrop.item = window.normalizeItem(normalizedDrop.item);
                    }
                    
                    // Ensure the drop has required properties for pickup
                    if (!normalizedDrop.pickRadius) normalizedDrop.pickRadius = 40;
                    if (!normalizedDrop.grounded) normalizedDrop.grounded = false;
                    
                    // Handle pickup timing - convert server timestamp to client timestamp
                    if (normalizedDrop.noPickupUntil && normalizedDrop.noPickupUntil > 1000000000000) {
                        // Server timestamp is in milliseconds since epoch, convert to relative time
                        const serverTime = normalizedDrop.noPickupUntil;
                        const currentTime = Date.now();
                        const timeDiff = serverTime - currentTime;
                        normalizedDrop.noPickupUntil = performance.now() + timeDiff;
                    } else if (!normalizedDrop.noPickupUntil && normalizedDrop.noPickup) {
                        // Convert old noPickup countdown to noPickupUntil timestamp
                        normalizedDrop.noPickupUntil = performance.now() + (normalizedDrop.noPickup * 1000);
                        delete normalizedDrop.noPickup; // Remove old property
                    } else if (!normalizedDrop.noPickupUntil) {
                        // Default pickup delay if neither property exists
                        normalizedDrop.noPickupUntil = performance.now() + 1000;
                    }
                    
                    // Add to local world drops for immediate display
                    window.worldDrops.push(normalizedDrop);
                    console.log('Added drop locally for immediate display:', normalizedDrop.id);
                    break;
                         case 'pickupItem':
                 // Remove drop locally for immediate visual feedback, but server remains authoritative
                 if (!window.worldDrops) window.worldDrops = [];
                 if (typeof msg.dropId !== 'undefined') {
                     const i = window.worldDrops.findIndex(d => d.id === msg.dropId);
                     if (i !== -1) {
                         window.worldDrops.splice(i, 1);
                         console.log('Removed drop locally for immediate display:', msg.dropId);
                     }
                 }
                 break;
                         case 'playerHit':
                 // Update local player hp if we were hit
                 if (msg && msg.id && window.player && window.player.id === msg.id) {
                     window.player.health = Math.max(0, Math.min(window.player.maxHealth, msg.health));
                     
                     // Trigger damage flash effect
                     window.player.damageFlashTimer = 0.3; // Flash for 0.3 seconds
                     
                     // Reset damage timer to prevent health regeneration when hit
                     window.player._damageTimer = 0;
                     window.player._regenActive = false;
                     console.log('Player hit, health regeneration disabled - health:', window.player.health);
                     
                     // Check if player died from this hit
                     if (window.player.health <= 0) {
                         window.player.die();
                     }
                 }
                 break;
             case 'inventoryUpdated':
                 // Server confirms inventory change - update local state
                 console.log('Received inventoryUpdated message:', msg.inventory);
                 
                 if (msg.inventory && Array.isArray(msg.inventory)) {
                     // Only update if the server inventory actually has changes
                     const hasChanges = !window.bag || window.bag.length !== msg.inventory.length || 
                                      window.bag.some((item, i) => JSON.stringify(item) !== JSON.stringify(msg.inventory[i]));
                     
                     if (hasChanges) {
                         console.log('Updating inventory from server confirmation');
                         window.bag = [...msg.inventory];
                         while (window.bag.length < 12) window.bag.push(null);
                         if (window.bag.length > 12) window.bag = window.bag.slice(0, 12);
                     } else {
                         console.log('Inventory already up to date, skipping update');
                     }
                     
                     // Update UI to reflect server state
                     if (window.displayInventoryItems) {

                         window.displayInventoryItems();
                     } else {
                         console.warn('displayInventoryItems function not available');
                     }
                 }
                 break;
                         case 'equipmentUpdated':
                // Server confirms equipment change - update local state
                
                if (msg.equip) {
                    console.log('Received equipmentUpdated from server:', msg.equip);
                    
                    // Ensure window.equip exists with all slots
                    if (!window.equip) {
                        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    }
                    
                    // Server is authoritative - replace entire equipment object
                    // This ensures consistency with server state
                    window.equip = { ...msg.equip };
                    
                    console.log('Updated local equipment from server:', window.equip);
                    
                    // Update reach calculation immediately when equipment changes
                    if (window.player && typeof window.player.calculateReach === 'function') {
                        window.player.calculateReach();
                    }
                    
                    // Update equipment UI
                    if (window.displayInventoryItems) {
                        window.displayInventoryItems();
                    } else {
                        console.warn('displayInventoryItems function not available');
                    }
                }
                break;
             case 'projectileCreated':
                 // Initialize projectiles array if it doesn't exist
                 if (!window.projectiles) window.projectiles = [];
                 
                 // Add new projectile to local state (exclude the message type, keep projectile type)
                 const { type: messageType, ...projectileData } = msg;
                 const newProjectile = { ...projectileData };
                 window.projectiles.push(newProjectile);
                 
                 console.log('Added projectile to local array:', newProjectile.type, 'Total projectiles:', window.projectiles.length);
                 break;
                 
             case 'arrow':
                 // Fallback handler for direct arrow messages (shouldn't happen with fixed server)
                 console.log('Received direct arrow message (fallback handler)');
                 if (!window.projectiles) window.projectiles = [];
                 const arrowProjectile = { ...msg };
                 window.projectiles.push(arrowProjectile);
                 console.log('Added arrow projectile via fallback:', arrowProjectile.type, 'Total projectiles:', window.projectiles.length);
                 break;
                 
             case 'fireball':
                 // Fallback handler for direct fireball messages (shouldn't happen with fixed server)
                 console.log('Received direct fireball message (fallback handler)');
                 if (!window.projectiles) window.projectiles = [];
                 const fireballProjectile = { ...msg };
                 window.projectiles.push(fireballProjectile);
                 console.log('Added fireball projectile via fallback:', fireballProjectile.type, 'Total projectiles:', window.projectiles.length);
                 break;
                 
             case 'projectileUpdate':
                 // Update existing projectile position
                 if (window.projectiles && Array.isArray(window.projectiles)) {
                     const projectile = window.projectiles.find(p => p.id === msg.id);
                     if (projectile) {
                         projectile.x = msg.x;
                         projectile.y = msg.y;
                         projectile.vx = msg.vx;
                         projectile.vy = msg.vy;
                     }
                 }
                 break;
                 
             case 'projectileDestroyed':
                 // Remove destroyed projectile from local state
                 if (window.projectiles && Array.isArray(window.projectiles)) {
                     const index = window.projectiles.findIndex(p => p.id === msg.id);
                     if (index !== -1) {
                         window.projectiles.splice(index, 1);
                     }
                 }
                 break;
                 
             default:
                 console.log('Unhandled server message:', msg.type, msg);
        }
    } catch (e) {
        console.error('Error handling server message:', e);
        window.log('Error handling server message');
    }
};

// Export connection status for UI
window.getConnectionStatus = function() {
    return {
        ...window.connectionStatus,
        readyState: socket ? socket.readyState : -1
    };
};

})();
