function normalizeEquipmentTwoHandedState(equip) {
    if (!equip) return equip;
    const isTwoHanded = (item) => {
        if (!item) return false;
        if (item.twoHanded) return true;
        const subtype = item.subtype || item.type || item.name;
        if (typeof window.checkIfTwoHanded === 'function') {
            return window.checkIfTwoHanded(subtype || item);
        }
        return false;
    };
    
    if (equip.mainhand && isTwoHanded(equip.mainhand)) {
        equip.offhand = equip.mainhand;
    } else {
        if (equip.offhand && equip.offhand === equip.mainhand) {
            equip.offhand = null;
        } else if (equip.offhand && equip.mainhand && equip.offhand.id && equip.mainhand.id && equip.offhand.id === equip.mainhand.id) {
            equip.offhand = null;
        }
        if (!equip.mainhand && equip.offhand && isTwoHanded(equip.offhand)) {
            equip.offhand = null;
        }
    }
    return equip;
}

window.normalizeEquipmentTwoHandedState = normalizeEquipmentTwoHandedState;
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
            const joinMessage = {
                type: 'join',
                name: playerName,
                shirtColor: window.BASE ? window.BASE.shirtColor : null,
                pantColor: window.BASE ? window.BASE.pantColor : null,
                equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {}
            };
            socket.send(JSON.stringify(joinMessage));
            
            // Don't send equipment snapshot on connection - let server send authoritative equipment data
            // The server will send playerData with equipment after connection
            
            // Update UI to show connected state
            updateConnectionUI();
            
            // Hide connection screen and show game
            if (window.hideConnectionScreen) {
                window.hideConnectionScreen();
            }
        };
        
        // Message queue for async processing to prevent blocking render loop
        window._messageQueue = window._messageQueue || [];
        window._processingMessages = window._processingMessages || false;
        
        // Process messages asynchronously to avoid blocking render loop
        function processMessageQueue() {
            if (window._processingMessages || window._messageQueue.length === 0) return;
            window._processingMessages = true;
            
            // Process up to 10 messages per frame to maintain 60fps
            const maxMessagesPerFrame = 10;
            let processed = 0;
            
            while (window._messageQueue.length > 0 && processed < maxMessagesPerFrame) {
                const msg = window._messageQueue.shift();
                try {
                    handleServerMessage(msg);
                } catch (e) {
                    console.error('Error processing server message:', e);
                }
                processed++;
            }
            
            window._processingMessages = false;
            
            // Schedule next batch if queue is not empty
            if (window._messageQueue.length > 0) {
                requestAnimationFrame(processMessageQueue);
            }
        }
        
        socket.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                // Add to queue for async processing
                window._messageQueue.push(msg);
                // Start processing if not already running
                if (!window._processingMessages) {
                    requestAnimationFrame(processMessageQueue);
                }
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
            const messageStr = JSON.stringify(obj);
            socket.send(messageStr);
            
            return true;
        } catch (e) {
            window.log('Failed to send message: ' + e.message);
            if (obj.type === 'shootProjectile' && obj.weaponType === 'Crossbow') {
                console.error('wsSend: Error sending Crossbow shootProjectile:', e);
            }
            if (obj.type === 'getBuybackItems') {
                console.error('[CLIENT] Error sending getBuybackItems:', e);
            }
            return false;
        }
    } else {
        // If not connected, try to reconnect
        if (obj.type === 'getBuybackItems') {
            console.error('[CLIENT] Cannot send getBuybackItems - socket not ready. State:', socket ? socket.readyState : 'null');
        }
        if (obj.type === 'shootProjectile' && obj.weaponType === 'Crossbow') {
            console.error('wsSend: Cannot send Crossbow shootProjectile - socket not ready. State:', socket ? socket.readyState : 'null');
        }
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
            case 'spellcaster':
                // Ensure enemy list exists and track by id
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                const enemyData = { ...msg };
                // Use server-provided colors for consistent appearance across all clients
                // Wisp enemies don't need colors (they're sprite-based)
                const enemyType = enemyData.type || msg.enemyType;
                if (!enemyData.colors && enemyType !== 'waterwisp' && enemyType !== 'firewisp' && enemyType !== 'earthwisp' && enemyType !== 'windwisp') {
                    console.warn('Enemy spawned without colors from server:', msg.id);
                }
                window.remoteEnemies.set(msg.id, enemyData);
                break;
            case 'playerJoined':
                window.log((msg.name || 'Player') + ' joined');
                
                // If this is our player joining, initialize inventory/equipment IMMEDIATELY from playerJoined
                // playerJoined has equipment data, so use it right away - don't wait for playerData
                if (window.player && window.player.id === msg.id) {
                    // Initialize equipment from playerJoined immediately
                    if (msg.equip) {
                        const defaultEquip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                        window.equip = { ...defaultEquip, ...msg.equip };
                    } else {
                        // Initialize empty equipment
                        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    }
                    
                    // Initialize inventory (will be updated by playerData if it arrives)
                    // BUT: If playerData doesn't arrive, we need to request it or use stored data
                    if (!window.bag || !Array.isArray(window.bag)) {
                        window.bag = new Array(12).fill(null);
                    }
                    
                    
                    // Initialize UI and display IMMEDIATELY
                    if (window.initInventoryUI) {
                        window.initInventoryUI();
                    }
                    if (window.initPaperDollUI) {
                        window.initPaperDollUI();
                    }
                    
                    // Force display immediately and with retries
                    const forceDisplay = () => {
                        if (window.displayInventoryItems) {
                            window.displayInventoryItems();
                        }
                    };
                    
                    forceDisplay();
                    setTimeout(forceDisplay, 100);
                    setTimeout(forceDisplay, 300);
                    setTimeout(forceDisplay, 500);
                    
                    // If playerData doesn't arrive within 2 seconds, log a warning
                    setTimeout(() => {
                        if (!window.connectionStatus.initialConnectionComplete) {
                            console.warn('[CLIENT] [playerJoined] playerData message not received after 2 seconds. Inventory may be empty.');
                            console.warn('[CLIENT] [playerJoined] Current bag state:', window.bag ? window.bag.filter(i => i !== null).length + ' items' : 'null');
                        }
                    }, 2000);
                    
                    // Mark as complete if we have equipment to show
                    if (window.equip && Object.values(window.equip).some(v => v !== null)) {
                        setTimeout(() => {
                            window.connectionStatus.initialConnectionComplete = true;
                        }, 600);
                    }
                }
                
                if (!window.gameState) window.gameState = { players: [], enemies: [], worldDrops: [] };
                if (!window.gameState.players.some(p => p.id === msg.id)) {
                    window.gameState.players.push({
                        id: msg.id,
                        name: msg.name || msg.id,
                        x: 80,
                        y: 0,
                        health: 100,
                        maxHealth: 100,
                        mana: msg.mana || 50,
                        maxMana: msg.maxMana || 50,
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
                        if (msg.mana !== undefined) window.gameState.players[idx].mana = msg.mana;
                        if (msg.maxMana !== undefined) window.gameState.players[idx].maxMana = msg.maxMana;
                    }
                }
                
                // Initialize local player mana if this is our player
                if (window.player && window.player.id === msg.id) {
                    if (window.player.mana === undefined) {
                        window.player.mana = msg.mana || window.player.stats?.Mana || 50;
                        window.player.maxMana = msg.maxMana || window.player.stats?.Mana || 50;
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
                            // Different message for level change vs leaving the game
                            const message = msg.levelChange ? 
                                (msg.name + ' left the level') : 
                                (msg.name + ' left the game');
                            window.log(message);
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
                if (msg.pyreals !== undefined) {
                    if (window.player) {
                        window.player.pyreals = msg.pyreals;
                    }
                    // Update UI display immediately
                    const goldAmtElement = document.getElementById('goldAmt');
                    if (goldAmtElement) {
                        goldAmtElement.innerText = msg.pyreals || 0;
                    }
                    // Refresh inventory UI to show updated pyreals
                    if (typeof window.refreshInventoryUI === 'function') {
                        window.refreshInventoryUI();
                    }
                }
                break;
                
            case 'buybackItems':
                // Update buyback list in vendor window
                if (msg.items && Array.isArray(msg.items)) {
                    let buybackList = document.getElementById('buybackList');
                    
                    // If element doesn't exist, try to find it in the buyback tab content
                    if (!buybackList) {
                        const buybackTabContent = document.getElementById('tabContentBuyback');
                        if (buybackTabContent) {
                            buybackList = buybackTabContent.querySelector('#buybackList');
                            if (!buybackList) {
                                // Create the element if it doesn't exist
                                buybackList = document.createElement('div');
                                buybackList.id = 'buybackList';
                                buybackTabContent.appendChild(buybackList);
                            }
                        }
                    }
                    
                    if (buybackList) {
                        buybackList.innerHTML = '';
                        
                        // Always show 10 slots to maintain consistent height
                        const MAX_BUYBACK_DISPLAY = 10;
                        for (let i = 0; i < MAX_BUYBACK_DISPLAY; i++) {
                            const item = msg.items[i];
                            const row = document.createElement('div');
                            row.className = 'row';
                            
                            const left = document.createElement('div');
                            const right = document.createElement('div');
                            
                            if (item) {
                                // Item exists - show it with buy button
                                // Use getRarityColor from ui.js if available, otherwise use default
                                const getRarityColor = window.getRarityColor || function(rarity) {
                                    if (!rarity) return '#ffffff';
                                    const rar = rarity.toLowerCase();
                                    if (rar === 'legendary') return '#ff9a1c';
                                    if (rar === 'epic') return '#b37bff';
                                    if (rar === 'rare') return '#3da5ff';
                                    if (rar === 'uncommon') return '#4caf50';
                                    return '#ffffff';
                                };
                                const rarityColor = getRarityColor(item.rarity);
                                const soldByText = item.soldBy ? ` (sold by ${item.soldBy})` : '';
                                left.innerHTML = `<span style="color: ${rarityColor}">${item.name}${soldByText}</span>`;
                                
                                right.innerHTML = `${item.value||0} <button>Buy</button>`;
                                
                                right.querySelector('button').addEventListener('click', () => {
                                    if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
                                        window.wsSend({
                                            type: 'buybackItem',
                                            buybackId: item.buybackId
                                        });
                                    }
                                });
                            } else {
                                // Empty slot - show placeholder to maintain window size
                                left.innerHTML = `<span style="color: #666; font-style: italic;">Empty slot</span>`;
                                right.innerHTML = `- <button style="visibility: hidden; pointer-events: none;">Buy</button>`;
                            }
                            
                            row.appendChild(left);
                            row.appendChild(right);
                            buybackList.appendChild(row);
                        }
                    }
                }
                break;
                
            case 'buybackSuccess':
                // Show success message and refresh
                if (msg.message) {
                    window.log(msg.message);
                }
                // Refresh buyback list after purchase
                if (window.isConnected && window.isConnected() && typeof window.wsSend === 'function') {
                    window.wsSend({ type: 'getBuybackItems' });
                }
                // Refresh inventory UI
                if (typeof window.refreshInventoryUI === 'function') {
                    window.refreshInventoryUI();
                }
                // Refresh shop if open, but stay on buyback tab
                const shopPanel = document.getElementById('shopPanel');
                if (shopPanel && shopPanel.style.display === 'block') {
                    if (typeof window.openShop === 'function') {
                        window.openShop('buyback'); // Explicitly stay on buyback tab
                    }
                }
                break;
                
            case 'buybackError':
                // Show error message
                if (msg.message) {
                    window.log('Buyback error: ' + msg.message);
                    alert(msg.message);
                }
                break;
                
            case 'playerData':
                // Handle player data from server (inventory, equipment, etc.)
                
                // IMPORTANT: Update data first, then display UI - don't display until both are ready
                let inventoryUpdated = false;
                let equipmentUpdated = false;
                
                // Update mana from server (restore persisted value)
                if (msg.mana !== undefined && window.player) {
                    window.player.mana = msg.mana;
                    window.player.maxMana = msg.maxMana || 50;
                    // Update stats UI to reflect mana change
                    if (window.updatePlayerStatsUI) {
                        window.updatePlayerStatsUI(true);
                    }
                } else if (window.player && window.player.mana === undefined) {
                    // Initialize mana if not set
                    window.player.mana = window.player.maxMana || window.player.stats?.Mana || 50;
                    window.player.maxMana = window.player.maxMana || window.player.stats?.Mana || 50;
                }
                
                // Update pyreals from server (restore persisted value)
                if (msg.pyreals !== undefined) {
                    if (window.player) {
                        window.player.pyreals = msg.pyreals || 0;
                    }
                    // Update UI display immediately
                    const goldAmtElement = document.getElementById('goldAmt');
                    if (goldAmtElement) {
                        goldAmtElement.innerText = (window.player && window.player.pyreals) || 0;
                    }
                    // Update UI display
                    if (typeof window.refreshInventoryUI === 'function') {
                        window.refreshInventoryUI();
                    }
                }
                
                // Update equipment from server
                if (msg.equip) {
                    // Ensure all equipment slots exist and restore from server data
                    const defaultEquip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    // Normalize all equipment items to ensure locked property is preserved
                    const normalizedEquip = {};
                    for (const [slot, item] of Object.entries(msg.equip)) {
                        if (item && typeof window.normalizeItem === 'function') {
                            normalizedEquip[slot] = window.normalizeItem(item);
                        } else {
                            normalizedEquip[slot] = item;
                        }
                    }
                    // For reconnections, always use server data to ensure consistency
                    window.equip = { ...defaultEquip, ...normalizedEquip };
                    equipmentUpdated = true;
                } else {
                    // Ensure equipment object exists even if not provided
                    if (!window.equip) {
                        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    }
                }
                
                // Update inventory from server
                if (msg.inventory) {
                    // Server is authoritative - always use server data for reconnections
                    if (Array.isArray(msg.inventory)) {
                        // Normalize items in inventory to ensure they have all required properties
                        window.bag = msg.inventory.map(item => {
                            if (item && typeof window.normalizeItem === 'function') {
                                return window.normalizeItem(item);
                            }
                            return item;
                        });
                        while (window.bag.length < 12) window.bag.push(null);
                        if (window.bag.length > 12) window.bag = window.bag.slice(0, 12);
                        inventoryUpdated = true;
                        const itemCount = window.bag.filter(i => i !== null).length;
                    } else {
                        window.bag = new Array(12).fill(null);
                        inventoryUpdated = true;
                    }
                } else {
                    // Ensure bag exists even if not provided
                    if (!window.bag || !Array.isArray(window.bag)) {
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
                    } else if (msg.health >= window.player.maxHealth) {
                        // Player is at full health, reset regeneration state
                        window.player._damageTimer = 0;
                        window.player._regenActive = false;
                    }
                }
                
                // Ensure inventory UI is fully ready before displaying items
                // This function ensures UI is initialized and data is displayed correctly
                const ensureInventoryReady = () => {
                    // Check if all required elements exist and are properly initialized
                    const inventory = document.getElementById('inventory');
                    
                    // Initialize inventory UI if it doesn't exist or has no slots
                    if (!inventory || inventory.children.length === 0) {
                        if (window.initInventoryUI) {
                            window.initInventoryUI();
                        }
                    }
                    
                    // Initialize equipment UI if needed
                    let equipmentSlots = document.querySelectorAll('.pd-slot');
                    if (equipmentSlots.length === 0) {
                        equipmentSlots = document.querySelectorAll('.equipSlot');
                    }
                    if (equipmentSlots.length === 0) {
                        equipmentSlots = document.querySelectorAll('[data-slot]');
                    }
                    if (equipmentSlots.length === 0) {
                        if (window.initPaperDollUI) {
                            window.initPaperDollUI();
                        }
                        // Re-check after initialization
                        equipmentSlots = document.querySelectorAll('.pd-slot');
                        if (equipmentSlots.length === 0) {
                            equipmentSlots = document.querySelectorAll('.equipSlot');
                        }
                        if (equipmentSlots.length === 0) {
                            equipmentSlots = document.querySelectorAll('[data-slot]');
                        }
                    }
                    
                    // Re-check inventory after potential initialization
                    const hasInventoryElement = inventory && inventory.children.length > 0;
                    const hasEquipmentSlots = equipmentSlots.length > 0;
                    
                    // Check if required functions are available
                    const hasRequiredFunctions = typeof window.getItemIconDataURLForItem === 'function' && 
                                              typeof window.displayInventoryItems === 'function';
                    
                    // Check if DOM is fully ready
                    const isDOMReady = document.readyState === 'complete' && 
                                     document.body && 
                                     document.getElementById('ui');
                    
                    // Ensure data exists
                    const hasData = window.bag && Array.isArray(window.bag) && window.equip && typeof window.equip === 'object';
                    
                    if (hasInventoryElement && hasEquipmentSlots && hasRequiredFunctions && isDOMReady && hasData) {
                        
                        // Display inventory items with multiple attempts to ensure success
                        const displayWithRetry = (attempt = 1) => {
                            try {
                                if (window.displayInventoryItems) {
                                    window.displayInventoryItems();
                                } else {
                                    throw new Error('displayInventoryItems function not available');
                                }
                            } catch (error) {
                                if (attempt < 5) {
                                    setTimeout(() => displayWithRetry(attempt + 1), 200 * attempt);
                                } else {
                                    console.error('Failed to display inventory items after 5 attempts');
                                }
                            }
                        };
                        
                        // Start display process with a small delay to ensure DOM is ready
                        setTimeout(() => {
                            displayWithRetry();
                            // Force an immediate additional refresh after a short delay to ensure equipment shows
                            setTimeout(() => {
                                if (window.displayInventoryItems) {
                                    window.displayInventoryItems();
                                }
                            }, 200);
                        }, 50);
                        
                        return true; // Success
                    } else {
                        return false; // Not ready
                    }
                };
                
                // CRITICAL: playerData has arrived - update inventory and refresh display
                // playerJoined already initialized equipment, but playerData has the full inventory
                const forceDisplayInventory = () => {
                    // Ensure UI is initialized (might have been done by playerJoined, but do it again to be sure)
                    if (window.initInventoryUI && typeof window.initInventoryUI === 'function') {
                        const inventory = document.getElementById('inventory');
                        if (!inventory || inventory.children.length === 0) {
                            window.initInventoryUI();
                        }
                    }
                    
                    if (window.initPaperDollUI && typeof window.initPaperDollUI === 'function') {
                        let equipmentSlots = document.querySelectorAll('.pd-slot');
                        if (equipmentSlots.length === 0) {
                            window.initPaperDollUI();
                        }
                    }
                    
                    // Force display immediately - equipment should already be set from playerJoined
                    if (window.displayInventoryItems && typeof window.displayInventoryItems === 'function') {
                        try {
                            window.displayInventoryItems();
                            setTimeout(() => {
                                window.displayInventoryItems();
                            }, 100);
                            setTimeout(() => {
                                window.displayInventoryItems();
                            }, 500);
                            setTimeout(() => {
                                window.displayInventoryItems();
                            }, 300);
                        } catch (error) {
                            console.error('Error force displaying inventory:', error);
                        }
                    }
                };
                
                // Always attempt to display inventory - don't skip if already displayed
                // The displayInventoryItems function itself handles whether it should display
                const attemptDisplay = () => {
                    try {
                        if (window.displayInventoryItems && typeof window.displayInventoryItems === 'function') {
                            window.displayInventoryItems();
                        }
                    } catch (error) {
                        console.error('Error displaying inventory:', error);
                    }
                };
                
                // Trigger display immediately
                attemptDisplay();
                
                // Retry with reasonable delays to ensure display works even if DOM isn't ready
                const retryDelays = [50, 100, 200, 500, 1000];
                retryDelays.forEach((delay) => {
                    setTimeout(() => {
                        attemptDisplay();
                    }, delay);
                });
                
                // Mark connection as complete after retries
                setTimeout(() => {
                    window.connectionStatus.initialConnectionComplete = true;
                }, 1500);
                
                // Ensure worldDrops exists
                if (!window.worldDrops) {
                    window.worldDrops = [];
                }
                
                break;
                
            case 'gameState':
                // If we received gameState but haven't received playerData yet, try to get it from gameState
                if (!window.connectionStatus.initialConnectionComplete && (!window.bag || window.bag.length === 0)) {
                    // Try to find our player in gameState.players and initialize inventory from there
                    if (window.player && window.player.id && msg.players && Array.isArray(msg.players)) {
                        const ourPlayer = msg.players.find(p => p.id === window.player.id);
                        if (ourPlayer) {
                            if (ourPlayer.inventory) {
                                window.bag = [...(ourPlayer.inventory || [])];
                                while (window.bag.length < 12) window.bag.push(null);
                                if (window.bag.length > 12) window.bag = window.bag.slice(0, 12);
                            }
                            if (ourPlayer.equip) {
                                const defaultEquip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                                window.equip = { ...defaultEquip, ...(ourPlayer.equip || {}) };
                            }
                            
                            // Trigger inventory initialization and display
                            setTimeout(() => {
                                if (window.displayInventoryItems) {
                                    window.displayInventoryItems();
                                }
                            }, 100);
                        }
                    }
                }
                
                // ALWAYS process floors, vendor, spawners, and portals regardless of players
                // Initialize gameState if it doesn't exist
                if (!window.gameState) {
                    window.gameState = {
                        players: [],
                        enemies: [],
                        worldDrops: [],
                        floors: [],
                        vendor: null,
                        spawners: [],
                        portals: []
                    };
                }
                
                // Always set floors, vendor, spawners, and portals from server data
                if (Array.isArray(msg.floors)) {
                    window.gameState.floors = msg.floors;
                }
                
                if (msg.vendor) {
                    window.gameState.vendor = {
                        ...msg.vendor,
                        anim: msg.vendor.anim || {timer: 0, index: 0}
                    };
                    window.vendor = window.gameState.vendor;
                }
                
                if (Array.isArray(msg.spawners)) {
                    window.gameState.spawners = msg.spawners;
                    window.spawners = msg.spawners;
                }
                
                if (Array.isArray(msg.portals)) {
                    window.gameState.portals = msg.portals;
                    window.portals = msg.portals;
                }
                
                // Handle initial game state
                if (msg.players && Array.isArray(msg.players)) {
                    // Update local game state with players from server, ensuring visual data is included
                    const playersWithVisualData = msg.players.map(player => ({
                        ...player,
                        shirtColor: player.shirtColor || null,
                        pantColor: player.pantColor || null,
                        equipmentColors: player.equipmentColors || {}
                    }));
                    
                    // Update players in gameState (floors, vendor, spawners, portals already set above)
                    window.gameState.players = playersWithVisualData;
                    window.gameState.enemies = msg.enemies || [];
                    window.gameState.worldDrops = msg.worldDrops || [];
                    
                    
                    // Update global rendering variables used by engine.js
                    window.enemies = window.gameState.enemies;
                    window.worldDrops = window.gameState.worldDrops;
                    window.vendor = window.gameState.vendor;
                    window.spawners = window.gameState.spawners;
                    window.portals = window.gameState.portals;
                    
                    
                    // If we have a local player, update their position from server data
                    if (window.player && window.player.id) {
                        const serverPlayer = playersWithVisualData.find(p => p.id === window.player.id);
                        if (serverPlayer) {
                            window.player.x = serverPlayer.x;
                            window.player.y = serverPlayer.y;
                            window.player.health = serverPlayer.health;
                            window.player.maxHealth = serverPlayer.maxHealth;
                            window.player.pyreals = serverPlayer.pyreals;
                        } else {
                            console.warn('Local player not found in server players list. Player ID:', window.player.id, 'Available players:', playersWithVisualData.map(p => p.id));
                        }
                    } else {
                        console.warn('Local player not initialized when gameState received. window.player:', !!window.player, 'window.player.id:', window.player?.id);
                    }
                } else {
                }
                // Server-authoritative enemies
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                if (Array.isArray(msg.enemies)) {
                    window.remoteEnemies.clear();
                    for (const e of msg.enemies) window.remoteEnemies.set(e.id, { ...e });
                }
                                 if (msg.worldDrops) {
                    // Server is always authoritative for world drops
                    
                    // Always replace world drops completely on gameState messages (initial connection/reconnection)
                    // This prevents accumulation and ensures consistency with server state
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
                            normalizedDrop.noPickupUntil = performance.now() + 300;
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
                    // Always ensure anim property exists
                    const newVendor = { 
                        ...(window.vendor||{}), 
                        ...msg.vendor, 
                        anim: msg.vendor.anim || (window.vendor && window.vendor.anim) || {timer:0,index:0},
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
                
                // Portals from server
                if (Array.isArray(msg.portals)) {
                    if (!window.gameState) window.gameState = {};
                    window.gameState.portals = msg.portals.map(p => ({...p}));
                }
                break;
                
            case 'levelChange':
                // Handle level change - completely reload the level
                
                // CRITICAL: Clear ALL old level data completely before loading new level
                // Clear remote enemies map (server-authoritative enemies)
                if (window.remoteEnemies) {
                    window.remoteEnemies.clear();
                }
                
                // Clear all projectiles from previous level
                if (window.projectiles) {
                    window.projectiles.length = 0;
                }
                
                // Clear world drops from previous level
                if (window.worldDrops) {
                    window.worldDrops.length = 0;
                }
                
                // Clear local enemies array (for offline mode, shouldn't exist when connected but clear anyway)
                if (window.enemies && Array.isArray(window.enemies)) {
                    window.enemies.length = 0;
                }
                
                if (msg.levelData) {
                    // Clear existing level data completely and use server-provided data
                    window.gameState = {
                        name: msg.levelData.name,
                        width: msg.levelData.width,
                        height: msg.levelData.height,
                        floors: msg.floors || msg.levelData.floors || [],
                        vendors: msg.levelData.vendors || [],
                        spawners: msg.spawners || msg.levelData.spawners || [],
                        portals: msg.portals || msg.levelData.portals || [],
                        enemies: [], // Start with empty enemies - will be populated by server spawners
                        worldDrops: msg.worldDrops || [], // Use server-provided world drops (should be empty for new level)
                        players: msg.players || [], // Use server-provided players
                        vendor: msg.vendor ? {
                            ...msg.vendor,
                            anim: msg.vendor.anim || {timer: 0, index: 0}
                        } : null // Use server-provided vendor
                    };
                    
                    // Update global variables used by engine.js for rendering
                    window.spawners = window.gameState.spawners || [];
                    window.portals = window.gameState.portals || [];
                    window.vendor = window.gameState.vendor;
                    window.worldDrops = window.gameState.worldDrops || [];
                    window.enemies = window.gameState.enemies || [];
                    
                    // Ensure remoteEnemies map exists and is ready for new enemies
                    // IMPORTANT: Clear it again here to ensure no enemies from previous level remain
                    if (!window.remoteEnemies) {
                        window.remoteEnemies = new Map();
                    } else {
                        // Double-check: clear any remaining enemies
                        window.remoteEnemies.clear();
                    }
                    
                    
                    // Reset player position to spawn point
                    if (window.player) {
                        window.player.x = 80; // Default spawn X
                        window.player.y = 0;  // Default spawn Y
                        window.player.portalCooldown = 0; // Reset portal cooldown
                    }
                    
                    
                    // Log that enemies will spawn from spawners after floors render
                    if (window.spawners && window.spawners.length > 0) {
                    }
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
                        equipmentColors: msg.equipmentColors || window.gameState.players[idxPU].equipmentColors,
                        mana: msg.mana,
                        maxMana: msg.maxMana
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
                        equipmentColors: msg.equipmentColors || {},
                        mana: msg.mana,
                        maxMana: msg.maxMana
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
                    } else if (msg.health >= window.player.maxHealth) {
                        // Player is at full health, reset regeneration state
                        window.player._damageTimer = 0;
                        window.player._regenActive = false;
                    }
                }
                break;
                
            case 'manaUpdated':
                // Update player mana from server
                // manaUpdated is sent to the player who cast the spell (us), so update local player
                if (window.player) {
                    // Update local player mana
                    window.player.mana = msg.mana;
                    window.player.maxMana = msg.maxMana;
                    // Force update stats UI immediately to reflect mana change
                    if (window.updatePlayerStatsUI) {
                        // Force update by resetting tracking values first
                        window.player._lastManaShown = -1;
                        window.player._lastMaxManaShown = -1;
                        window.updatePlayerStatsUI(true);
                    }
                }
                
                // Also update other players' mana if id is provided
                if (msg.id && window.gameState && window.gameState.players) {
                    const playerIdx = window.gameState.players.findIndex(p => p.id === msg.id);
                    if (playerIdx !== -1) {
                        window.gameState.players[playerIdx].mana = msg.mana;
                        window.gameState.players[playerIdx].maxMana = msg.maxMana;
                    }
                }
                break;
                
            case 'insufficientMana':
                // Show message when player tries to cast without enough mana
                if (window.log) {
                    window.log(msg.message || 'Not enough mana to cast spell!');
                }
                // Visual feedback - flash mana bar or show error message
                if (window.player) {
                    window.player._insufficientManaFlash = true;
                    setTimeout(() => {
                        if (window.player) window.player._insufficientManaFlash = false;
                    }, 1000);
                }
                break;
            case 'enemyUpdate':
                if (!window.remoteEnemies) window.remoteEnemies = new Map();
                if (typeof msg.id !== 'undefined') {
                    const existing = window.remoteEnemies.get(msg.id) || {};
                    // Store previous health to detect damage
                    const previousHealth = existing.health || 0;
                    
                    // Preserve existing enemy type before spreading message (message.type is 'enemyUpdate', not enemy type)
                    const existingType = existing.type;
                    // Preserve existing colors when updating enemy data, but update equipment
                    // Don't spread msg.type as it's the message type, not the enemy type
                    const { type: messageType, ...msgWithoutType } = msg;
                    const updatedEnemy = { ...existing, ...msgWithoutType };
                    // Set enemy type from enemyType field in message, or preserve existing type
                    updatedEnemy.type = msg.enemyType || existingType;
                    // Colors should come from server, don't generate client-side
                    // Wisp enemies don't need colors (they're sprite-based)
                    const enemyType = updatedEnemy.type;
                    if (!updatedEnemy.colors && enemyType && enemyType !== 'waterwisp' && enemyType !== 'firewisp' && enemyType !== 'earthwisp' && enemyType !== 'windwisp') {
                        console.warn('Enemy updated without colors from server:', msg.id, 'enemyType:', enemyType);
                    }
                    
                    // Trigger damage flash if health decreased (not for Wisp - it uses hurt sprites)
                    if (updatedEnemy.health < previousHealth && updatedEnemy.health > 0) {
                        if (updatedEnemy.type !== 'waterwisp' && updatedEnemy.type !== 'firewisp' && updatedEnemy.type !== 'earthwisp' && updatedEnemy.type !== 'windwisp') {
                            updatedEnemy.damageFlashTimer = 0.3; // Flash for 0.3 seconds
                        }
                        // Water Wisp uses hurtAnimTime which is set by the server
                    }
                    
                    // Initialize dieAnimProgress for Water Wisp if it's dead and progress is set
                    if ((updatedEnemy.type === 'waterwisp' || updatedEnemy.type === 'firewisp' || updatedEnemy.type === 'earthwisp' || updatedEnemy.type === 'windwisp') && updatedEnemy.dead && updatedEnemy.dieAnimProgress !== undefined) {
                        updatedEnemy.dieAnimProgress = updatedEnemy.dieAnimProgress || 0;
                    }
                    
                    window.remoteEnemies.set(msg.id, updatedEnemy);
                }
                break;
            case 'enemyDeath':
                if (window.remoteEnemies && typeof msg.id !== 'undefined') {
                    window.remoteEnemies.delete(msg.id);
                }
                // Also remove from gameState.enemies if it exists there
                if (window.gameState && window.gameState.enemies && Array.isArray(window.gameState.enemies)) {
                    const index = window.gameState.enemies.findIndex(e => e && e.id === msg.id);
                    if (index !== -1) {
                        window.gameState.enemies.splice(index, 1);
                    }
                }
                break;
            case 'enemySpawned':
                if (window.gameState && window.gameState.enemies) {
                    // Add to remote enemies map for server-authoritative enemies
                    if (window.remoteEnemies) {
                        const enemyData = { ...msg };
                        // Update type if provided in message (enemyType is used in server broadcasts to avoid conflict with message type)
                        if (msg.enemyType) {
                            enemyData.type = msg.enemyType;
                        }
                        // Use server-provided colors for consistent appearance across all clients
                        // Wisp enemies don't need colors (they're sprite-based)
                        const enemyType = enemyData.type || msg.enemyType;
                        if (!enemyData.colors && enemyType !== 'waterwisp' && enemyType !== 'firewisp' && enemyType !== 'earthwisp' && enemyType !== 'windwisp') {
                            console.warn('Enemy spawned without colors from server:', msg.id);
                        }
                        window.remoteEnemies.set(msg.id, enemyData);
                    }
                }
                break;
                
            case 'basic':
                // Handle enemy data with type 'basic' (appears to be enemy spawn/update data)
                if (msg.id && typeof msg.x === 'number' && typeof msg.y === 'number') {
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
                                // Wisp enemies don't need colors (they're sprite-based)
                                if (!enemyData.colors && enemyData.type !== 'waterwisp' && enemyData.type !== 'firewisp' && enemyData.type !== 'earthwisp' && enemyData.type !== 'windwisp') {
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
                    break;
                         case 'pickupItem':
                 // Remove drop locally for immediate visual feedback, but server remains authoritative
                 if (!window.worldDrops) window.worldDrops = [];
                 if (typeof msg.dropId !== 'undefined') {
                     const i = window.worldDrops.findIndex(d => d.id === msg.dropId);
                     if (i !== -1) {
                         window.worldDrops.splice(i, 1);
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
                     
                     // Check if player died from this hit
                     if (window.player.health <= 0) {
                         window.player.die();
                     }
                 }
                 break;
             case 'inventoryUpdated':
                 // Server confirms inventory change - update local state
                 console.log('Received inventoryUpdated from server');
                 
                 if (msg.inventory && Array.isArray(msg.inventory)) {
                     // Always update from server - server is authoritative
                     window.bag = msg.inventory.map(item => {
                         if (item && typeof window.normalizeItem === 'function') {
                             return window.normalizeItem(item);
                         }
                         return item;
                     });
                     console.log('Updated window.bag');
                     while (window.bag.length < 12) window.bag.push(null);
                     if (window.bag.length > 12) window.bag = window.bag.slice(0, 12);
                     
                    // Throttle inventory display updates to prevent excessive calls
                    if (!window._inventoryDisplayThrottle) {
                        window._inventoryDisplayThrottle = null;
                    }
                    clearTimeout(window._inventoryDisplayThrottle);
                    window._inventoryDisplayThrottle = setTimeout(() => {
                        if (window.displayInventoryItems) {
                            try {
                                window.displayInventoryItems();
                            } catch (error) {
                                console.error('Error refreshing inventory display:', error);
                            }
                        }
                        window._inventoryDisplayThrottle = null;
                    }, 50); // Small delay to batch rapid updates
                     
                     // Refresh shop if it's currently open to show updated inventory
                     // Preserve current tab
                     const shopPanel = document.getElementById('shopPanel');
                     if (shopPanel && shopPanel.style.display === 'block') {
                         if (typeof window.openShop === 'function') {
                             const currentTab = window._shopActiveTab || 'inventory';
                             window.openShop(currentTab);
                         }
                     }
                 }
                 break;
                         case 'equipmentUpdated':
                // Server confirms equipment change - update local state
                console.log('Received equipmentUpdated from server');
                
                if (msg.equip) {
                    
                    // Ensure window.equip exists with all slots
                    if (!window.equip) {
                        window.equip = {head:null,neck:null,shoulders:null,chest:null,waist:null,legs:null,feet:null,wrists:null,hands:null,mainhand:null,offhand:null,trinket:null};
                    }
                    
                    // Server is authoritative - replace entire equipment object
                    // This ensures consistency with server state
                    // Deep clone to preserve all properties including locked
                    const clonedEquip = JSON.parse(JSON.stringify(msg.equip));
                    
                    // Normalize all equipment items to ensure locked property is preserved
                    const normalizedEquip = {};
                    for (const [slot, item] of Object.entries(clonedEquip)) {
                        if (item && typeof window.normalizeItem === 'function') {
                            normalizedEquip[slot] = window.normalizeItem(item);
                        } else {
                            normalizedEquip[slot] = item;
                        }
                    }
                    
                    window.equip = normalizeEquipmentTwoHandedState(normalizedEquip);
                    
                    
                    // Update reach calculation immediately when equipment changes
                    if (window.player && typeof window.player.calculateReach === 'function') {
                        window.player.calculateReach();
                    }
                    
                    // Throttle equipment display updates to prevent excessive calls
                    // Use the same throttle as inventory to batch updates together
                    if (!window._inventoryDisplayThrottle) {
                        window._inventoryDisplayThrottle = null;
                    }
                    clearTimeout(window._inventoryDisplayThrottle);
                    window._inventoryDisplayThrottle = setTimeout(() => {
                        if (window.displayInventoryItems) {
                            try {
                                console.log('Refreshing inventory/equipment display after equipmentUpdated');
                                window.displayInventoryItems();
                            } catch (error) {
                                console.error('Error refreshing equipment display:', error);
                            }
                        }
                        window._inventoryDisplayThrottle = null;
                    }, 50); // Small delay to batch rapid updates
                    
                    // Refresh shop if it's currently open to show updated equipment
                    // Preserve current tab
                    const shopPanel = document.getElementById('shopPanel');
                    if (shopPanel && shopPanel.style.display === 'block') {
                        if (typeof window.openShop === 'function') {
                            const currentTab = window._shopActiveTab || 'inventory';
                            window.openShop(currentTab);
                        }
                    }
                }
                break;
                
            case 'moveItemRejected':
                // Server rejected an item move - show error and refresh inventory/equipment
                console.warn('Item move rejected by server:', msg.reason);
                
                // Show user-friendly error message
                if (msg.reason) {
                    window.log(msg.reason);
                }
                
                // Force refresh inventory and equipment to sync with server state
                if (window.displayInventoryItems) {
                    setTimeout(() => {
                        if (window.displayInventoryItems) {
                            window.displayInventoryItems();
                        }
                    }, 100);
                }
                break;
                
             case 'projectileCreated':
                 // Initialize projectiles array if it doesn't exist
                 if (!window.projectiles) window.projectiles = [];
                 
                 // Add new projectile to local state (exclude the message type, keep projectile type)
                 const { type: messageType, ...projectileData } = msg;
                 const newProjectile = { ...projectileData };
                 
                 // Ensure enemy projectiles have proper metadata for cleanup
                 if (newProjectile.isEnemyProjectile) {
                     // Ensure createdAt and lifeTime are set for proper expiration
                     if (!newProjectile.createdAt) {
                         newProjectile.createdAt = Date.now();
                     }
                     if (!newProjectile.lifeTime) {
                         newProjectile.lifeTime = 5000; // Default 5 seconds
                     }
                 }
                 
                 window.projectiles.push(newProjectile);
                 break;
                 
             case 'arrow':
                 // Fallback handler for direct arrow messages (shouldn't happen with fixed server)
                 if (!window.projectiles) window.projectiles = [];
                 const arrowProjectile = { ...msg };
                 window.projectiles.push(arrowProjectile);
                 break;
                 
             case 'fireball':
                 // Fallback handler for direct fireball messages (shouldn't happen with fixed server)
                 if (!window.projectiles) window.projectiles = [];
                 const fireballProjectile = { ...msg };
                 window.projectiles.push(fireballProjectile);
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
