// engine.js — game setup, input wiring, loop, render
(function(){
'use strict';

    // Debug flag for camera centering - set to true to see camera logs
    window.debugCamera = false;
    
    // Wait for all dependencies to be loaded before initializing
    function waitForDependencies() {
    const requiredFunctions = [
        'Player', 'Enemy', 'advanceAnim', 'normalizeItem', 'getIconImg',
        'drawChest', 'drawGloves', 'drawBoots', 'drawHelmet', 'drawWeapon',
        'swingAngle', 'spawnDrop', 'placeVendor'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => !window[func]);
    
    if (missingFunctions.length > 0) {

        setTimeout(waitForDependencies, 100);
        return;
    }
    
    
    initializeEngine();
}

// Initialize the engine once all dependencies are available
function initializeEngine() {
    // Constants
    const WORLD_W = 3600;
    const VIEW_W = 800;
    const VIEW_H = 600;
    const GROUND_Y = 550;

    // Utility functions
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Animation function - removed duplicate, using the one from methods.js

    let canvas = document.getElementById('game');
    let ctx = null;
    if (canvas) {
        ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font='12px monospace';
        }
    }
    

    // Function to get the current canvas (handles canvas replacement)
    function getCanvas() {
        // First try to get the canvas from window.gameCanvas
        if (window.gameCanvas && window.gameCanvas instanceof HTMLCanvasElement) {
            return window.gameCanvas;
        }
        
        // Fallback to getting from DOM
        const canvas = document.getElementById('game');
        if (canvas && canvas instanceof HTMLCanvasElement) {
            // Set the global canvas reference if it's not set
            if (!window.gameCanvas) {
                window.gameCanvas = canvas;
        
            }
            return canvas;
        }
        
        // If still no canvas, return null
        console.warn('No canvas available');
        return null;
    }

    // Function to get the current context
    function getContext() {
        const currentCanvas = getCanvas();
        if (!currentCanvas) {
            console.warn('No canvas available for context');
            return null;
        }
        
        // Always get a fresh context to prevent smearing
        ctx = currentCanvas.getContext('2d');
        if (ctx) {
            ctx.font='12px monospace';
            // Reset all context state to prevent smearing
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ctx.imageSmoothingEnabled = false;
            // Ensure proper canvas clearing
            ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
        }
        return ctx;
    }

    // Player + world
    if (!window.binds) {

        window.binds = {
            left: 'a',
            right: 'd',
            jump: ' ',
            attack: 'j'
        };
    } else {

    }

    if (!window.keys) {

        window.keys = {};
    } else {

    }

    // Set up key event listeners for player movement
    window.addEventListener('keydown', (e) => {
        // Don't capture movement keys when typing in chat or other input fields
        if (window.checkInputActive && window.checkInputActive()) {
            return;
        }
        window.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
        // Don't capture movement keys when typing in chat or other input fields
        if (window.checkInputActive && window.checkInputActive()) {
            return;
        }
        window.keys[e.key.toLowerCase()] = false;
    });

    if (window.Player) {

        window.player = new window.Player('Player',80,0,window.binds,'#4aa3ff');
    } else {

        // Create a minimal player object if Player class doesn't exist
        window.player = {
            id: 'Player',
            x: 80,
            y: 0,
            w: 48,
            h: 64,
            vx: 0,
            vy: 0,
            onGround: false,
            facing: 1,
            health: 100,
            maxHealth: 100,
            pyreals: 0,
            attackAnimTime: 0,
            _attackApplied: false,
            _reach: 60,
            stats: { Strength: 10 },
            anim: {timer: 0, index: 0},
            update: function(dt) {
                // Basic player movement logic
                if (window.keys && window.keys[window.binds.left]) this.vx = -200;
                else if (window.keys && window.keys[window.binds.right]) this.vx = 200;
                else this.vx = 0;
                
                if (window.keys && window.keys[window.binds.jump] && this.onGround) {
                    this.vy = -400;
                    this.onGround = false;
                }
                
                // Apply gravity
                this.vy += 1500 * dt;
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                
                // Ground collision
                if (this.y >= 486) {
                    this.y = 486;
                    this.vy = 0;
                    this.onGround = true;
                }
            },
            takeDamage: function(amount) {
                this.health = Math.max(0, this.health - amount);
            }
        };
    }
    
    // Calculate initial reach based on starting equipment
    if (window.player && typeof window.player.calculateReach === 'function') {
        window.player.calculateReach();
    }
    
    
    // Local enemies are only used when offline; when connected, we render server enemies from window.remoteEnemies
    window.enemies=[];

    // Initialize projectiles array for network-synchronized projectiles
    window.projectiles = [];

    // Vendor will be initialized from gameState (either offline sample data or server data)

    // Initialize WebSocket functions if not already set
    if (!window.wsSend) {
        window.wsSend = function(data) {
            // No-op when not connected
        };
    }

    if (!window.wsDisconnect) {
        window.wsDisconnect = function() {
            // No-op when not connected
        };
    }

    if (!window.wsConnect) {
        window.wsConnect = function(url) {
            // No-op when not connected
        };
    }

    // Initialize drawing functions if not already set
    if (!window.drawChest) {
        window.drawChest = function() {};
    }
    if (!window.drawGloves) {
        window.drawGloves = function() {};
    }
    if (!window.drawBoots) {
        window.drawBoots = function() {};
    }
    if (!window.drawHelmet) {
        window.drawHelmet = function() {};
    }
    if (!window.drawWeapon) {
        window.drawWeapon = function() {};
    }
    if (!window.swingAngle) {
        window.swingAngle = function(progress) {
            return (-Math.PI/3) + progress*(2*Math.PI/3);
        };
    }

    // Initialize sprite sheet variables if not already set
    if (!window.SHEET_READY) {
        window.SHEET_READY = false;
    }
    if (!window.baseSheetImg) {
        window.baseSheetImg = null;
    }
    if (!window.FW) {
        window.FW = 48;
    }
    if (!window.FH) {
        window.FH = 64;
    }

    // Initialize view dimensions if not already set
    if (!window.VIEW_W) {
        window.VIEW_W = 800;
    }
    if (!window.VIEW_H) {
        window.VIEW_H = 600;
    }

    // Initialize world dimensions if not already set
    if (!window.WORLD_W) {
        window.WORLD_W = 3600;
    }

    if (!window.GROUND_Y) {
        window.GROUND_Y = 550;
    }

    // Ensure worldDrops is initialized globally
    if (!window.worldDrops) {
        window.worldDrops = [];
    } else {
    }

    // Platform system removed - using floor tiles from level JSON instead

    // Initialize camera position
    if (!window.cameraX) {
        window.cameraX = 0;
    } else {
    }

    // Initialize basic gameState for offline mode if not connected to server
    if (!window.gameState) {
        
        // Sample level data (from sample_level.json)
        const sampleLevelData = {
            floors: [
                { x: 0, y: 550, width: 1200, height: 50, material: 'dirt' },
                { x: 1200, y: 550, width: 800, height: 50, material: 'grass' },
                { x: 2000, y: 550, width: 600, height: 50, material: 'stone' },
                { x: 2600, y: 550, width: 1000, height: 50, material: 'sand' }
            ],
            vendors: [
                { id: 'vendor_1', name: 'Merchant', x: 600, y: 486, w: 48, h: 64, colors: null }
            ],
            spawners: [
                { id: 'sp_1', x: 1200, y: 486, type: 'basic', respawnTime: 5000, visibilityRange: 400, minLevel: 1, maxLevel: 3, currentEnemyId: null, respawnAt: 0 },
                { id: 'sp_2', x: 1800, y: 486, type: 'elite', respawnTime: 8000, visibilityRange: 400, minLevel: 2, maxLevel: 4, currentEnemyId: null, respawnAt: 0 },
                { id: 'sp_3', x: 2400, y: 486, type: 'spellcaster', respawnTime: 10000, visibilityRange: 500, minLevel: 3, maxLevel: 5, currentEnemyId: null, respawnAt: 0 },
                { id: 'sp_4', x: 3000, y: 486, type: 'boss', respawnTime: 15000, visibilityRange: 600, minLevel: 4, maxLevel: 6, currentEnemyId: null, respawnAt: 0 }
            ],
            portals: [
                { id: 'portal_1', x: 3473, y: 412, w: 64, h: 64, targetLevel: 'watertest' }
            ]
        };
        
        window.gameState = {
            players: [],
            enemies: [],
            worldDrops: [],
            floors: sampleLevelData.floors,
            vendor: sampleLevelData.vendors[0], // Set the vendor
            spawners: sampleLevelData.spawners,
            portals: sampleLevelData.portals
        };
        
        // Also set global references for compatibility
        window.vendor = window.gameState.vendor;
        window.spawners = window.gameState.spawners;
        window.portals = window.gameState.portals;
        
    }

    // Connection screen management
    window.showConnectionScreen = function() {
        document.getElementById('connectionScreen').classList.remove('hidden');
        document.getElementById('gameWrap').classList.add('hidden');
        
        // Focus the player name input for convenience
        document.getElementById('loginPlayerName').focus();
    };

    window.hideConnectionScreen = function() {
        document.getElementById('connectionScreen').classList.add('hidden');
        document.getElementById('gameWrap').classList.remove('hidden');
        
        // Focus the game canvas so Enter key works immediately
        document.getElementById('game').focus();
        
        // Initialize scrollbars after connection screen is hidden
        setTimeout(() => {
            try {
                if (typeof window.managePanelScrollbars === 'function') {
                    window.managePanelScrollbars();
                }
            } catch (error) {
                // Silently handle scrollbar initialization errors
            }
        }, 100);
    };

    window.updateConnectionUI = function(connected) {
        const connectedElements = document.querySelectorAll('.connected-only');
        connectedElements.forEach(el => {
            if (connected) {
                el.classList.add('visible');
            } else {
                el.classList.remove('visible');
            }
        });
        
        // Update player name display
        if (connected) {
            document.getElementById('playerNameDisplay').textContent = window.player.id;
        }
    };

    // Initialize connection screen
    window.showConnectionScreen();

    function resizeCanvas(){
        const currentCanvas = getCanvas();
        const dpr = window.devicePixelRatio || 1;
        const rect = currentCanvas.getBoundingClientRect();
        const cssW = Math.max(320, Math.floor(rect.width));
        const cssH = Math.max(360, Math.floor(rect.height));

        currentCanvas.width  = Math.floor(cssW * dpr);
        currentCanvas.height = Math.floor(cssH * dpr);
        const currentCtx = getContext();
        currentCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        window.VIEW_W = cssW;
        window.VIEW_H = cssH;

        if (window.player) {
            window.cameraX = clamp(
                window.player.x + window.player.w/2 - window.VIEW_W/2,
                0,
                WORLD_W - window.VIEW_W
            );
        }
    }

    window.addEventListener('resize', resizeCanvas);

    // Initialize canvas size after DOM is ready
    setTimeout(() => {
        resizeCanvas();
    }, 100);

    // Connection screen event listeners
    document.getElementById('loginConnectBtn').addEventListener('click', function() {
        const playerName = document.getElementById('loginPlayerName').value.trim();
        const serverUrl = document.getElementById('loginServerUrl').value.trim();
        
        if (!playerName || playerName.toLowerCase() === 'player') {
            alert('Please enter a unique name before connecting.');
            return;
        }
        
        if (!serverUrl) {
            alert('Please enter a server URL.');
            return;
        }
        
        // Update player name
        window.player.id = playerName;
        
        // Connect to server
        window.wsConnect(serverUrl);
        
        // Hide connection screen and show game using proper CSS classes
        window.hideConnectionScreen();
    });

    // Add Enter key support for login inputs
    document.getElementById('loginPlayerName').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('loginConnectBtn').click();
        }
    });

    document.getElementById('loginServerUrl').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('loginConnectBtn').click();
        }
    });

    // Chat input
    const chatInput=document.getElementById('chatInput');
    chatInput.addEventListener('keydown', e=>{ 
        if(e.key==='Enter'){ 
            const text=chatInput.value.trim(); 
            if(!text) {
                // If no text, just remove focus
                chatInput.blur();
                document.getElementById('game').focus();
                return;
            }
            window.wsSend({type:'chat',msg:text}); 
            chatInput.value=''; 
            
            // Return focus to the game canvas after sending chat (with small delay)
            setTimeout(() => {
                chatInput.blur();
                document.getElementById('game').focus();
            }, 10);
        } else if(e.key==='Escape') {
            // Clear the input and remove focus
            chatInput.value='';
            chatInput.blur();
            document.getElementById('game').focus();
        }
    });

    // Global Enter key listener for focusing chat when in game
    document.addEventListener('keydown', function(e) {
        // Handle Enter key when connected
        if (e.key === 'Enter' && window.isConnected && window.isConnected()) {
            // Only prevent chat focus if we're in a text input field (not just any input)
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'INPUT' && 
                (activeElement.type === 'text' || activeElement.type === 'search' || !activeElement.type)) {
                return; // Don't focus chat if we're typing in a text input
            }
            e.preventDefault();
            chatInput.focus();
        }
    });

    // Disconnect only button (shown when connected)
    const disconnectBtnOnly=document.getElementById('disconnectBtnOnly'); 
    disconnectBtnOnly.addEventListener('click', ()=>{
        window.wsDisconnect();
        
        // Show connection screen and focus player name input
        window.showConnectionScreen();
    });

    // Init UI after DOM is loaded
    window.addEventListener('DOMContentLoaded', function() {
        try{ 
            // CRITICAL: Do NOT initialize inventory/equipment UI slots yet
            // Wait until after player logs in and we receive playerData
            // This ensures we know which player's inventory to load
            
            // DO NOT call initInventoryUI or initPaperDollUI here
            // DO NOT call refreshInventoryUI here - wait until after player connects and receives playerData
        }catch(e){ 
            window.log('UI init error: '+e.message); 
        } 
    });

    // Initialize canvas drag and drop when ready
    setTimeout(() => {
        if (window.initCanvasDragAndDropWhenReady) {
            window.initCanvasDragAndDropWhenReady();
        }
    }, 800);

    // Tooltip over world drops
    let hoveredDrop=-1; 

    function setupCanvasEventListeners() {
        const currentCanvas = getCanvas();
        if (!currentCanvas) {
            console.warn('No canvas available for event listeners');
            return;
        }
        
        // Add event listeners to the current canvas
        currentCanvas.addEventListener('mousemove', e=>{ 
            const wx = (window.cameraX || 0) + e.offsetX; 
            const wy = e.offsetY; 
            hoveredDrop=-1; 
            
            for(let i=window.worldDrops.length-1;i>=0;i--){ 
                const d=window.worldDrops[i]; 
                if(!d || !d.item) continue; // Skip drops without valid items
                if(Math.hypot(wx-d.x, wy-d.y) < 20){ 
                    hoveredDrop=i; 
                    if (typeof window.showTooltipForItem === 'function') {
                        window.showTooltipForItem(d.item, e); 
                    }
                    break; 
                } 
            } 
            if(hoveredDrop===-1 && typeof window.hideTooltip === 'function') {
                window.hideTooltip();
            } 
        }); 
        if (typeof window.hideTooltip === 'function') {
            currentCanvas.addEventListener('mouseleave', window.hideTooltip);
        }
        
    }

    // Initialize canvas event listeners when ready
    setTimeout(() => {
        setupCanvasEventListeners();
    }, 2000);

    // Shop open/close on F or Escape
    window.addEventListener('keydown', e=>{ 
        const shopPanel = document.getElementById('shopPanel');
        const isShopOpen = shopPanel && shopPanel.style.display === 'block';
        
        // Close shop on Escape or F when shop is open
        if ((e.key === 'Escape' || e.key.toLowerCase() === 'f') && isShopOpen) {
            shopPanel.style.display = 'none';
            return;
        }
        
        // Open shop on F when near vendor and shop is closed
        if(e.key.toLowerCase()==='f' && window.vendor && window.player && !isShopOpen){ 
            const px=window.player.x+window.player.w/2, py=window.player.y+window.player.h/2; 
            const vx=window.vendor.x+window.vendor.w/2, vy=window.vendor.y+window.vendor.h/2; 
            if(Math.hypot(px-vx, py-vy) < 80){ 
                if (typeof window.openShop === 'function') {
                    window.openShop(); 
                }
            } 
        } 
    });

    // Controls
    let last=performance.now(); 
    let statsUITimer=0; 
    let bootLogged=false;

    const spawnEnemyBtn = document.getElementById('spawnEnemy');
    if (spawnEnemyBtn) {
        spawnEnemyBtn.addEventListener('click', ()=>{
            if (window.isConnected && window.isConnected()) {
                const x = randInt(300, Math.min(WORLD_W-150, 850));
                const lvl = randInt(1,5);
                window.wsSend({ type:'spawnEnemy', x, level: lvl });
            } else {
                if (window.Enemy) {
                    const e=new window.Enemy(randInt(300,Math.min(WORLD_W-150,850)),0,randInt(1,5)); 
                    window.enemies.push(e);
                } else {
                }
            }
        });
    }

    const clearDropsBtn = document.getElementById('clearDrops');
    if (clearDropsBtn) {
        clearDropsBtn.addEventListener('click', ()=>{ 
        window.worldDrops=[]; 
        
        // Only refresh inventory UI if we're not connected to server
        if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
            if (typeof window.refreshInventoryUI === 'function' && window.player) {
                window.refreshInventoryUI(); 
            } else if (!window.player) {
                // Player not available yet, skip inventory refresh
            } else {
                console.warn('refreshInventoryUI function not available yet');
            }
        } else {
        }
        });
    }

    function drawParallax(){ 
        const baseY = 260; 
        const currentCtx = getContext();
        if (!currentCtx) return;
        
        currentCtx.save(); 
        currentCtx.translate(-(window.cameraX || 0)*0.3,0); 
        for(let i=-200;i<WORLD_W+400;i+=300){ 
            currentCtx.fillStyle='#7bb0e8'; 
            currentCtx.beginPath(); 
            currentCtx.arc(i, baseY, 180, 0, Math.PI, true); 
            currentCtx.fill(); 
        } 
        currentCtx.restore(); 
    }

    // Add input handling to suspend player movement
    let inputActive = false;

    // Function to check if any input field is focused - make it globally accessible
    window.checkInputActive = function() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        // Check if the active element is an input field, textarea, or select
        const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTypes.includes(activeElement.tagName);
    };

    // Add event listeners to input fields
    document.addEventListener('DOMContentLoaded', () => {
        const chatInput = document.getElementById('chatInput');
        
        if (chatInput) {
            chatInput.addEventListener('focus', () => { inputActive = true; });
            chatInput.addEventListener('blur', () => { inputActive = false; });
        }
    });

    function advance(dt){ 
        if (window.player) {
            window.player.update(dt);
            
            // Check portal collisions
            if (window.gameState && window.gameState.portals) {
                for (const portal of window.gameState.portals) {
                    // Use w/h or width/height properties
                    const portalW = portal.w || portal.width || 64;
                    const portalH = portal.h || portal.height || 64;
                    
                    if (window.player.x < portal.x + portalW &&
                        window.player.x + window.player.w > portal.x &&
                        window.player.y < portal.y + portalH &&
                        window.player.y + window.player.h > portal.y) {
                        
                        // Player is touching portal, trigger level change (with cooldown to prevent spam)
                        if (window.wsSend && !window.player.portalCooldown) {
                            window.player.portalCooldown = 2000; // 2 second cooldown
                            window.wsSend({
                                type: 'portalEnter',
                                targetLevel: portal.targetLevel
                            });
                        }
                    }
                }
            }
            
            // Update portal cooldown
            if (window.player.portalCooldown) {
                window.player.portalCooldown = Math.max(0, window.player.portalCooldown - dt * 1000);
            }
        }
        // When online, enemy AI is server-authoritative; do not run local AI.
        // Only update locally simulated enemies when offline and they expose an update function.
        const offlineMode = (!window.isConnected || !window.isConnected());
        if (offlineMode && Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (e && typeof e.update === 'function') {
                    e.update(dt);
                }
            }
        }
        
        // Send player position update to server every few frames
        if (window.isConnected && window.isConnected() && window.player) {
            if (!window.playerUpdateCounter) window.playerUpdateCounter = 0;
            window.playerUpdateCounter++;
            if (window.playerUpdateCounter >= 10) { // Send update every 10 frames (roughly 3 times per second)
                window.playerUpdateCounter = 0;
                window.wsSend({
                    type: 'playerUpdate',
                    x: window.player.x,
                    y: window.player.y,
                    health: window.player.health,
                    maxHealth: window.player.maxHealth,
                    pyreals: window.player.pyreals,
                    shirtColor: window.BASE ? window.BASE.shirtColor : null,
                    pantColor: window.BASE ? window.BASE.pantColor : null,
                    equipmentColors: window.getEquipmentColors ? window.getEquipmentColors() : {},
                    reach: window.player._reach || 70
                });
            }
        }
        
        // Update world drops physics
        for (let i = window.worldDrops.length - 1; i >= 0; i--) {
            const d = window.worldDrops[i];
            
            // Apply gravity and update position
            if (d.vy !== undefined) {
                d.vy += (window.GRAV || 1500) * dt;
                d.y += d.vy * dt;
                
                // Floor collision using level data
                const floors = window.gameState && window.gameState.floors ? window.gameState.floors : [];
                let onFloor = false;
                for (const floor of floors) {
                    if (d.x > floor.x && 
                        d.x < floor.x + floor.width && 
                        d.y > floor.y - 16 && 
                        d.y < floor.y + floor.height) {
                        d.y = floor.y - 16;
                        d.vy = 0;
                        d.grounded = true;
                        onFloor = true;
                        break;
                    }
                }
                
                // Fallback to old ground collision if no floor collision
                if (!onFloor && d.y >= (window.GROUND_Y || 550) - 16) {
                    d.y = (window.GROUND_Y || 550) - 16;
                    d.vy = 0;
                    d.grounded = true;
                }
                
                // Old platform collision removed - only floor tiles from level JSON are used
            }
            
            // Apply horizontal velocity
            if (d.vx !== undefined) {
                d.x += d.vx * dt;
                // Apply friction
                d.vx *= 0.98;
                
                // Stop horizontal movement when grounded
                if (d.grounded) {
                    d.vx *= 0.9; // Extra friction when on ground
                }
            }
            
            // Bounce off walls
            if (d.x < 0) {
                d.x = 0;
                d.vx = Math.abs(d.vx) * 0.5; // Bounce with reduced velocity
            } else if (d.x > (window.WORLD_W || 3600) - 32) {
                d.x = (window.WORLD_W || 3600) - 32;
                d.vx = -Math.abs(d.vx) * 0.5; // Bounce with reduced velocity
            }
        }
        
        // Separate loop for pickup detection to avoid interference with physics
        for (let i = window.worldDrops.length - 1; i >= 0; i--) {
            const d = window.worldDrops[i];
            
            // Skip drops without valid items
            if (!d || !d.item) {
                continue;
            }
            
            // Check if drop is ready for pickup
            if (d.noPickupUntil && performance.now() < d.noPickupUntil) {
                continue;
            }
            
            if (!window.player) continue; // Skip if player is not available
            
            const dx = (window.player.x + window.player.w / 2) - d.x;
            const dy = (window.player.y + window.player.h / 2) - d.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < d.pickRadius) {
                
                if (d.item.type === 'currency') {
                    const amt = d.item.amount || d.item.value || 0;
                    window.player.pyreals += amt;
                    window.worldDrops.splice(i, 1);
                    
                    // Notify server about currency pickup so it can persist the change
                    if (window.isConnected && window.isConnected()) {
                        window.wsSend({
                            type: 'currencyPickup',
                            amount: amt,
                            dropId: d.id
                        });
                    }
                    
                    if (typeof window.refreshInventoryUI === 'function' && window.player) {
                        window.refreshInventoryUI();
                    }
                } else {
                    const idx = window.bag.findIndex(x => !x);
                                    if (idx >= 0) {
                    // Normalize the item to ensure consistent structure
                    const normalizedItem = window.normalizeItem(d.item);
                    
                    if (window.isConnected && window.isConnected()) {
                        // Connected to server - let server handle inventory update
                        window.wsSend({
                            type: 'pickupItem',
                            dropId: d.id || Date.now() + Math.random(),
                            slotIndex: idx
                        });
                        
                        // Remove from world drops immediately for visual feedback
                        window.worldDrops.splice(i, 1);
                    } else {
                        // Not connected - handle locally
                        window.bag[idx] = normalizedItem;
                        window.worldDrops.splice(i, 1);
                        
                        if (typeof window.refreshInventoryUI === 'function' && window.player) {
                            window.refreshInventoryUI();
                        }
                    }
                } else {
                }
                }
            }
        }

        // Suspend player movement if input is active
        if (inputActive && window.player) {
            window.player.vx = 0;
            window.player.vy = 0;
            return;
        }
    }

    function drawOtherPlayer(ctx, otherPlayer, dt) {
        const X = otherPlayer.x;
        const Y = otherPlayer.y;
        const W = 48;
        const H = 64;
        
        // No need to temporarily modify window.equip - drawAllEquipment works with passed equipment
        
        // Draw the other player's character
        const moving = false;
        const air = false;
        const swing = 0;
        
        // Use custom visual data if available, otherwise fall back to default
        if (otherPlayer.shirtColor && otherPlayer.pantColor && window.drawNPCBody) {
            // Draw with custom colors
            const colors = {
                shirt: otherPlayer.shirtColor,
                pants: otherPlayer.pantColor,
                belt: '#8b4513', // Default belt color
                accessory: '#ffd700' // Default accessory color
            };
            window.drawNPCBody(ctx, X, Y, colors, 0, moving);
        } else {
            // Fall back to default character drawing
            drawCharacter(ctx, {timer:0,index:0}, X, Y, W, H, dt, false, moving, air, {swingAngle:swing});
        }
        
        // Draw equipment for other players (armor, weapons, etc.)
        if (otherPlayer.equip) {
            // Use drawAllEquipment for consistent z-order and no flickering
            window.drawAllEquipment(ctx, X, Y, otherPlayer.equip, false, false);
            // Draw mainhand weapon with swing angle if needed
            if (otherPlayer.equip.mainhand) {
                const ang = 0; // No swing angle for other players
                // Temporarily set the player's reach for weapon rendering
                const originalReach = window.player ? window.player._reach : 70;
                if (otherPlayer.reach) {
                    if (window.player) {
                        window.player._reach = otherPlayer.reach;
                    }
                }
                window.drawWeapon(ctx, X, Y, false, otherPlayer.equip.mainhand, ang, otherPlayer.equip, 'mainhand');
                // Restore original reach
                if (window.player) {
                    window.player._reach = originalReach;
                }
            }
        }
        
        // Equipment restoration no longer needed
        
        // Draw player name
        ctx.fillStyle = '#000';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(otherPlayer.name || otherPlayer.id, X + W/2, Y - 10);
        ctx.textAlign = 'left';
        
        // Draw health bar
        const hpw = clamp(W * (otherPlayer.health / otherPlayer.maxHealth), 0, W);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(X, Y - 10, hpw, 4);
        
        // Draw mana bar for other players (below health bar)
        if (otherPlayer.maxMana && otherPlayer.maxMana > 0) {
            const currentMana = otherPlayer.mana !== undefined ? otherPlayer.mana : otherPlayer.maxMana;
            const manaBarWidth = clamp(W * (currentMana / otherPlayer.maxMana), 0, W);
            ctx.fillStyle = '#00f';
            ctx.fillRect(X, Y - 6, manaBarWidth, 3);
            // Draw background for mana bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(X, Y - 6, W, 3);
            // Draw mana fill again on top
            ctx.fillStyle = '#00f';
            ctx.fillRect(X, Y - 6, manaBarWidth, 3);
        }
        
        // Show death indicator for other players
        if (otherPlayer.isDead) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillRect(X, Y - 30, W, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DEAD', X + W/2, Y - 15);
            ctx.restore();
        }
    }

    function drawCharacter(ctx,anim,X,Y,W,H,dt,flip,isMoving,isAir,opts={}){ 
        // Ensure anim object has required properties
        if (!anim || typeof anim !== 'object') {
            console.warn('Invalid anim object passed to drawCharacter:', anim);
            anim = {timer: 0, index: 0};
        }
        if (typeof anim.timer === 'undefined') {
            anim.timer = 0;
        }
        if (typeof anim.index === 'undefined') {
            anim.index = 0;
        }
        
        const frame = window.advanceAnim ? window.advanceAnim(anim, dt, isAir, isMoving) : 0; 
        ctx.save(); 
        if(flip){ 
            ctx.translate(X+W,Y); 
            ctx.scale(-1,1); 
            X=0; 
            Y=0; 
        } 
        ctx.imageSmoothingEnabled=false; 
        if(window.SHEET_READY && window.baseSheetImg){ 
            ctx.drawImage(window.baseSheetImg, frame*window.FW, 0, window.FW, window.FH, X, Y, W, H); 
        } else { 
            ctx.fillStyle='#4aa3ff'; 
            ctx.fillRect(X,Y,W,H); 
        } 
        if (window.equip) {
            // Use drawAllEquipment for consistent z-order and no flickering
            // Pass swing angle so offhand weapon also swings
            const ang = (opts.swingAngle||0);
            window.drawAllEquipment(ctx,X,Y,window.equip,true,flip,ang);
            // Draw mainhand weapon with swing angle if needed (drawn last so it appears on top)
            if (window.equip.mainhand) {
                window.drawWeapon(ctx,X,Y,flip,window.equip.mainhand,ang,window.equip,'mainhand');
            }
        } 
        ctx.restore(); 
    }
    
    // Draw attack range indicator to show how far the player can hit
    function drawAttackRangeIndicator(ctx, x, y, w, h, flip, reach, swingAngle = 0) {
        ctx.save();
        
        // Position indicator relative to where the weapon actually is
        // Note: When flip=true, the coordinate system is already flipped by drawCharacter
        // drawCharacter does: translate(X+W, Y), scale(-1, 1), then X=0, Y=0
        // In flipped coords: x=0 is right edge in world (player's right), x=W is left edge in world
        // In normal coords: x is left edge, x+W is right edge
        // Weapon positioning in drawWeapon matches exactly:
        //   - When flip=true: px = W + 15 (in flipped coords, this is player's left edge + offset)
        //   - When flip=false: px = x + W - 5 (in normal coords, this is player's right edge - offset)
        // After drawCharacter transform: when flip=true, x=0, so weapon is at W+15 in flipped coords
        // When flip=false, x is unchanged, so weapon is at W-5 in normal coords (since x=0 after transform)
        // Match drawWeapon's px and py calculation exactly
        // When flip=true: px = W + 15 (in flipped coords)
        // When flip=false: px = x + W - 5 (in normal coords, x is original value)
        const weaponHandleX = flip ? (w + 15) : (x + w - 5); // Weapon handle position in current coordinate system (matches drawWeapon's px)
        const baseVerticalPos = y + 43; // Base vertical position for mainhand (matches drawWeapon)
        const mainhandVerticalPos = baseVerticalPos - 16; // Mainhand moved 16 pixels higher (matches drawWeapon)
        const weaponY = mainhandVerticalPos; // Same vertical position as mainhand weapon (matches drawWeapon's py)
        
        // Translate to weapon handle position (same as drawWeapon does with ctx.translate(px, py))
        // This puts us in the weapon's local coordinate system where the handle is at (0, 0)
        ctx.translate(weaponHandleX, weaponY);
        
        // Get actual weapon image width - try to get from equipped weapon
        let weaponImageWidth = 70; // Default fallback
        if (window.equip && window.equip.mainhand && window.equip.mainhand.name) {
            const weapon = window.equip.mainhand;
            const kind = (window.weaponKindFromName && window.weaponKindFromName(weapon.name)) || weapon.subtype || 'Sword';
            
            // Try to get the actual image width from the loaded weapon image
            if (window.loadWeaponImage) {
                const weaponImg = window.loadWeaponImage(kind, weapon);
                if (weaponImg && weaponImg.complete && weaponImg.naturalWidth > 0) {
                    weaponImageWidth = weaponImg.naturalWidth;
                } else {
                    // Image not loaded yet, use reach as fallback
                    weaponImageWidth = reach;
                }
            } else {
                // loadWeaponImage not available, use reach as fallback
                weaponImageWidth = reach;
            }
        }
        
        // Apply the same rotation as the weapon (swing angle)
        ctx.rotate(swingAngle);
        
        // Weapon tip position in weapon's local coordinate system (after rotation is applied)
        // When facing right: tip is at +weaponImageWidth from handle (0)
        // When facing left: tip is at -weaponImageWidth from handle (0) - visually extends left
        const localTipX = flip ? -weaponImageWidth : weaponImageWidth;
        const localTipY = 0;
        
        // The weapon tip is now at (localTipX, localTipY) in the rotated coordinate system
        // Since we've already translated and rotated, we can use these coordinates directly
        const weaponTipX = localTipX;
        const weaponTipY = localTipY;
        
        // Convert reach from game units to pixels (reach of 70 = ~100 pixels)
        const reachPixels = (reach / 70) * 100;
        
        // Draw a semi-transparent arc showing the attack range
        // Arc should be centered at the weapon tip where attacks originate
        // We're now in the weapon's local coordinate system (translated and rotated)
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        
        // Draw the range indicator as a semi-circle in the direction the player is facing
        // Center the arc at the weapon tip position (localTipX, localTipY)
        ctx.beginPath();
        if (flip) {
            // Facing left - draw arc on the left side, centered at weapon tip
            ctx.arc(weaponTipX, weaponTipY, reachPixels, Math.PI/2, -Math.PI/2, true);
        } else {
            // Facing right - draw arc on the right side, centered at weapon tip
            ctx.arc(weaponTipX, weaponTipY, reachPixels, -Math.PI/2, Math.PI/2, false);
        }
        ctx.stroke();
        
        // Draw a small dot at the maximum reach distance from the weapon tip
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ff4444';
        if (flip) {
            ctx.fillRect(weaponTipX - reachPixels - 2, weaponTipY - 2, 4, 4);
        } else {
            ctx.fillRect(weaponTipX + reachPixels - 2, weaponTipY - 2, 4, 4);
        }
        
        ctx.restore();
    }

    function render(dt){ 
        // Check if player is available
        if (!window.player) {
            console.warn('Player not available yet, skipping render');
            return;
        }
        
        const currentCtx = getContext();
        if (!currentCtx) {
            console.warn('No context available for rendering');
            return;
        }
        
        // Reset transform completely to prevent smearing
        currentCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Clear the entire canvas with proper dimensions
        const currentCanvas = getCanvas();
        if (currentCanvas) {
            currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
        } else {
            currentCtx.clearRect(0, 0, VIEW_W, VIEW_H);
        }
        
        // Fill background
        currentCtx.fillStyle='#9bd3ff'; 
        currentCtx.fillRect(0,0,VIEW_W,VIEW_H); 
        
        // Draw parallax background
        drawParallax();
        
        // Save context state before applying camera transform
        currentCtx.save();
        
        // Apply camera transform - player is centered on screen
        const cameraX = (typeof window.cameraX !== 'undefined') ? window.cameraX : 0;
        currentCtx.translate(-cameraX, 0);
        
        // Debug: Log camera position
        if (window.debugCamera) {
        }
        
        // Draw floors from level data (AFTER camera transform - floors move with world)
        if (window.gameState && window.gameState.floors && Array.isArray(window.gameState.floors)) {
            // Define material colors (matching level editor)
            const materials = {
                dirt: { color: '#8B4513', pattern: 'dirt' },
                grass: { color: '#228B22', pattern: 'grass' },
                stone: { color: '#696969', pattern: 'stone' },
                rock: { color: '#2F4F4F', pattern: 'rock' }, // Dark gray for rock
                sand: { color: '#F4A460', pattern: 'sand' },
                water: { color: '#4169E1', pattern: 'water' }
            };
            
            for (const floor of window.gameState.floors) {
                if (floor && floor.material && materials[floor.material]) {
                    const material = materials[floor.material];
                    currentCtx.fillStyle = material.color;
                    currentCtx.fillRect(floor.x, floor.y, floor.width, floor.height);
                    
                    // Add texture pattern for better visual distinction
                    currentCtx.strokeStyle = 'rgba(0,0,0,0.2)';
                    currentCtx.lineWidth = 1;
                    currentCtx.strokeRect(floor.x, floor.y, floor.width, floor.height);
                } else {
                }
            }
        } else {
            
            // Fallback: Draw a basic ground floor if no gameState floors are available
            currentCtx.fillStyle = '#228B22'; // Grass green
            currentCtx.fillRect(0, 486, WORLD_W, 64);
            currentCtx.strokeStyle = 'rgba(0,0,0,0.2)';
            currentCtx.lineWidth = 1;
            currentCtx.strokeRect(0, 486, WORLD_W, 64);
        }
        
        // Debug: Draw a test floor to verify rendering is working (temporarily disabled)
        // currentCtx.fillStyle = '#ff0000'; // Bright red for visibility
        // currentCtx.fillRect(0, 500, 200, 50); // Test floor at y=500
        // currentCtx.strokeStyle = '#000000';
        // currentCtx.lineWidth = 2;
        // currentCtx.strokeRect(0, 500, 200, 50); 
        
        // Old platform rendering removed - only floor tiles from level JSON are rendered
        
        if (window.vendor) {
            // Draw vendor as NPC with server-provided colors for consistent appearance
            if (window.drawNPCBody && window.vendor.colors) {
                window.drawNPCBody(currentCtx, window.vendor.x, window.vendor.y, window.vendor.colors, 0, false);
            } else {
                // Fallback to basic character drawing if no colors from server
                // Don't use equipment to avoid making vendor look like player
                // Ensure vendor has anim property before accessing it
                if (!window.vendor.anim) {
                    window.vendor.anim = {timer: 0, index: 0};
                }
                const frame = window.advanceAnim ? window.advanceAnim(window.vendor.anim, dt, false, false) : 0;
                currentCtx.save();
                currentCtx.imageSmoothingEnabled = false;
                if (window.SHEET_READY && window.baseSheetImg) {
                    currentCtx.drawImage(window.baseSheetImg, frame * (window.FW || 48), 0, window.FW || 48, window.FH || 64, window.vendor.x, window.vendor.y, window.vendor.w, window.vendor.h);
                } else {
                    // Simple fallback - draw a distinct vendor shape
                    currentCtx.fillStyle = '#8b4513'; // Brown color to distinguish from player
                    currentCtx.fillRect(window.vendor.x, window.vendor.y, window.vendor.w, window.vendor.h);
                    currentCtx.strokeStyle = '#654321';
                    currentCtx.lineWidth = 2;
                    currentCtx.strokeRect(window.vendor.x, window.vendor.y, window.vendor.w, window.vendor.h);
                }
                currentCtx.restore();
            }
            currentCtx.fillStyle='#000'; 
            currentCtx.fillText('Vendor', window.vendor.x, window.vendor.y-8);
        } 
        
        // Draw spawners as purple squares
        if (Array.isArray(window.spawners)) {
            for (const sp of window.spawners) {
                currentCtx.fillStyle = '#7a00ff';
                currentCtx.fillRect((sp.x||0)-8, (sp.y||0)-8, 16, 16);
            }
        }
        
        // Spawners are now invisible but functional
        
        const nearVendor = window.vendor && window.player && Math.hypot((window.player.x+window.player.w/2)-(window.vendor.x+window.vendor.w/2),(window.player.y+window.player.h/2)-(window.vendor.y+window.vendor.h/2)) < 80; 
        
        // Auto-close shop if player moves out of vendor range
        if (!nearVendor && window.vendor) {
            const shopPanel = document.getElementById('shopPanel');
            if (shopPanel && shopPanel.style.display === 'block') {
                shopPanel.style.display = 'none';
            }
        }
        
        if(nearVendor && window.vendor){ 
            currentCtx.save(); 
            currentCtx.globalAlpha=0.85; 
            currentCtx.fillStyle='#9fe7ff'; 
            currentCtx.font = '14px monospace';
            currentCtx.textAlign = 'center';
            
            const tradeText = 'Press F to trade…';
            const textMetrics = currentCtx.measureText(tradeText);
            const textWidth = textMetrics.width;
            const textHeight = 20;
            const padding = 16; // 8px padding on each side
            
            // Calculate vendor center position (vendor is 48x64)
            const vendorCenterX = window.vendor.x + (window.vendor.w / 2);
            const vendorCenterY = window.vendor.y + (window.vendor.h / 2);
            
            // Draw background box with width fitting text length, centered above vendor
            currentCtx.fillStyle='#04151f'; 
            currentCtx.fillRect(vendorCenterX - (textWidth/2) - padding/2, window.vendor.y-45, textWidth + padding, textHeight); 
            currentCtx.strokeStyle='#2c6a7a'; 
            currentCtx.strokeRect(vendorCenterX - (textWidth/2) - padding/2, window.vendor.y-45, textWidth + padding, textHeight); 
            
            // Draw centered text above vendor with equal top/bottom padding
            currentCtx.fillStyle='#9fe7ff'; 
            currentCtx.fillText(tradeText, vendorCenterX, window.vendor.y-35); 
            currentCtx.restore(); 
        } 
        
        if (Array.isArray(window.worldDrops)) {
            for(const d of window.worldDrops){ 
                if (!d || !d.item) {
                    // Skip drops without valid items
                    continue;
                }
                
                if (typeof window.getIconImg === 'function') {
                    const img = window.getIconImg(d.item); 
                    if(img && (img.complete || img.width)) {
                        currentCtx.drawImage(img,d.x-16,d.y-16,32,32); 
                    } else {
                        currentCtx.fillStyle = '#ff0000';
                        currentCtx.fillRect(d.x-16, d.y-16, 32, 32);
                        currentCtx.strokeStyle = '#000';
                        currentCtx.strokeRect(d.x-16, d.y-16, 32, 32);
                    }
                } else {
                    currentCtx.fillStyle = '#ff0000';
                    currentCtx.fillRect(d.x-16, d.y-16, 32, 32);
                    currentCtx.strokeStyle = '#000';
                    currentCtx.strokeRect(d.x-16, d.y-16, 32, 32);
                }
            }
        }
      
        // Draw other players from game state with their equipment and visual data
        if (window.gameState && typeof window.gameState === 'object' && window.gameState.players && Array.isArray(window.gameState.players)) {
            for (const otherPlayer of window.gameState.players) {
                if (otherPlayer.id && window.player.id && otherPlayer.id === window.player.id) continue;
                
                // Draw other player with their own visual data
                drawOtherPlayer(currentCtx, otherPlayer, dt);
            }
        }
      
        // Render enemies: when connected, draw remote enemies; otherwise draw local ones
        if (typeof window.isConnected === 'function' && window.isConnected() && window.remoteEnemies && window.remoteEnemies instanceof Map) {
            for (const enemy of window.remoteEnemies.values()) {
                // Skip dead enemies UNLESS they're still playing death animation (wisp)
                // This ensures the death animation is visible before the enemy is removed
                if ((enemy.dead || enemy.isDead || (enemy.health !== undefined && enemy.health <= 0)) && 
                    !((enemy.type === 'waterwisp' || enemy.type === 'firewisp' || enemy.type === 'earthwisp' || enemy.type === 'windwisp') && enemy.dieAnimProgress !== undefined && enemy.dieAnimProgress < 1.1)) {
                    continue;
                }
                // Update attack animation timer on client for smoother animation
                if (enemy.attackAnimTime !== undefined && enemy.attackAnimTime > 0) {
                    enemy.attackAnimTime = Math.max(0, enemy.attackAnimTime - dt);
                }
                
                const moving = Math.abs(enemy.vx||0)>5; 
                const air = false; 
                
                // Initialize damage feedback properties if they don't exist
                if (typeof enemy.damageFlashTimer === 'undefined') {
                    enemy.damageFlashTimer = 0;
                }
                
                // Update damage flash timer
                if (enemy.damageFlashTimer > 0) {
                    enemy.damageFlashTimer -= dt;
                }
                
                // Draw enemy with damage flash effect (skip for Wisp - it uses hurt sprites)
                currentCtx.save();
                if (enemy.damageFlashTimer > 0 && enemy.type !== 'waterwisp' && enemy.type !== 'firewisp' && enemy.type !== 'earthwisp' && enemy.type !== 'windwisp') {
                    // Flash red when taking damage (not for Wisp)
                    currentCtx.globalCompositeOperation = 'multiply';
                    currentCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    currentCtx.fillRect(enemy.x||0, enemy.y||0, 48, 64);
                }
                
                // Check if this is a Wisp enemy (sprite-based)
                if (enemy.type === 'waterwisp' && window.drawWaterWisp) {
                    window.drawWaterWisp(currentCtx, enemy, dt);
                } else if (enemy.type === 'firewisp' && window.drawFireWisp) {
                    window.drawFireWisp(currentCtx, enemy, dt);
                } else if (enemy.type === 'earthwisp' && window.drawEarthWisp) {
                    window.drawEarthWisp(currentCtx, enemy, dt);
                } else if (enemy.type === 'windwisp' && window.drawWindWisp) {
                    window.drawWindWisp(currentCtx, enemy, dt);
                }
                // Draw enemy as NPC with server-provided colors and equipment
                else if (window.drawNPCBody && enemy.colors) {
                    window.drawNPCBody(currentCtx, enemy.x||0, enemy.y||0, enemy.colors, 0, moving);
                    // Draw enemy equipment if available
                    if (enemy.equip) {
                        // Use facing direction if available, otherwise fall back to vx
                        const flip = enemy.facing === 'left' || (enemy.facing === undefined && (enemy.vx||0) < 0);
                        
                        // Calculate swing angle from attack animation (same as player)
                        let enemySwingAngle = 0;
                        if (enemy.attackAnimTime && enemy.attackAnimTime > 0) {
                            const progress = 1 - (enemy.attackAnimTime / 0.25);
                            if (typeof window.swingAngle === 'function') {
                                enemySwingAngle = window.swingAngle(progress);
                            }
                        }
                        
                        const enemyX = enemy.x || 0;
                        const enemyY = enemy.y || 0;
                        const W = 48; // Character width
                        
                        // Draw armor without transformation (drawNPCBody doesn't flip, so armor shouldn't either)
                        if (window.drawAllEquipment) {
                            // Draw armor parts only (not weapons) - we'll draw weapons separately with transformation
                            if (enemy.equip.chest && window.drawChest) window.drawChest(currentCtx, enemyX, enemyY, enemy.equip.chest);
                            if (enemy.equip.legs && window.drawLegs) window.drawLegs(currentCtx, enemyX, enemyY, enemy.equip.legs);
                            if (enemy.equip.waist && window.drawWaist) window.drawWaist(currentCtx, enemyX, enemyY, enemy.equip.waist);
                            if (enemy.equip.feet && window.drawBoots) window.drawBoots(currentCtx, enemyX, enemyY, enemy.equip.feet);
                            if (enemy.equip.shoulders && window.drawShoulders) window.drawShoulders(currentCtx, enemyX, enemyY, enemy.equip.shoulders);
                            if (enemy.equip.wrists && window.drawWrists) window.drawWrists(currentCtx, enemyX, enemyY, enemy.equip.wrists);
                            if (enemy.equip.hands && window.drawGloves) window.drawGloves(currentCtx, enemyX, enemyY, enemy.equip.hands);
                            if (enemy.equip.neck && window.drawNeck) window.drawNeck(currentCtx, enemyX, enemyY, enemy.equip.neck);
                            if (enemy.equip.head && window.drawHelmet) window.drawHelmet(currentCtx, enemyX, enemyY, enemy.equip.head);
                        }
                        
                        // Draw weapons with coordinate transformation when facing left (same as drawCharacter does)
                        // drawWeapon expects the coordinate system to be flipped when flip=true
                        if (window.drawWeapon) {
                            if (flip) {
                                // Save context and apply the same transformation as drawCharacter
                                currentCtx.save();
                                currentCtx.translate(enemyX + W, enemyY);
                                currentCtx.scale(-1, 1);
                                // Now draw at (0, 0) in the flipped coordinate system
                                
                                // Draw offhand weapon first (if exists and not two-handed)
                                if (enemy.equip.offhand && enemy.equip.mainhand) {
                                    const isSameWeapon = enemy.equip.offhand === enemy.equip.mainhand || 
                                        (enemy.equip.offhand.id && enemy.equip.mainhand.id && enemy.equip.offhand.id === enemy.equip.mainhand.id);
                                    const isMainhandTwoHanded = enemy.equip.mainhand.twoHanded || 
                                        (enemy.equip.mainhand.subtype && typeof window.checkIfTwoHanded === 'function' && window.checkIfTwoHanded(enemy.equip.mainhand.subtype));
                                    if (!isSameWeapon && !isMainhandTwoHanded) {
                                        window.drawWeapon(currentCtx, 0, 0, flip, enemy.equip.offhand, enemySwingAngle, enemy.equip, 'offhand');
                                    }
                                } else if (enemy.equip.offhand) {
                                    window.drawWeapon(currentCtx, 0, 0, flip, enemy.equip.offhand, enemySwingAngle, enemy.equip, 'offhand');
                                }
                                
                                // Draw mainhand weapon
                                if (enemy.equip.mainhand) {
                                    window.drawWeapon(currentCtx, 0, 0, flip, enemy.equip.mainhand, enemySwingAngle, enemy.equip, 'mainhand');
                                }
                                
                                currentCtx.restore();
                            } else {
                                // Facing right: no transformation needed
                                
                                // Draw offhand weapon first (if exists and not two-handed)
                                if (enemy.equip.offhand && enemy.equip.mainhand) {
                                    const isSameWeapon = enemy.equip.offhand === enemy.equip.mainhand || 
                                        (enemy.equip.offhand.id && enemy.equip.mainhand.id && enemy.equip.offhand.id === enemy.equip.mainhand.id);
                                    const isMainhandTwoHanded = enemy.equip.mainhand.twoHanded || 
                                        (enemy.equip.mainhand.subtype && typeof window.checkIfTwoHanded === 'function' && window.checkIfTwoHanded(enemy.equip.mainhand.subtype));
                                    if (!isSameWeapon && !isMainhandTwoHanded) {
                                        window.drawWeapon(currentCtx, enemyX, enemyY, flip, enemy.equip.offhand, enemySwingAngle, enemy.equip, 'offhand');
                                    }
                                } else if (enemy.equip.offhand) {
                                    window.drawWeapon(currentCtx, enemyX, enemyY, flip, enemy.equip.offhand, enemySwingAngle, enemy.equip, 'offhand');
                                }
                                
                                // Draw mainhand weapon
                                if (enemy.equip.mainhand) {
                                    window.drawWeapon(currentCtx, enemyX, enemyY, flip, enemy.equip.mainhand, enemySwingAngle, enemy.equip, 'mainhand');
                                }
                            }
                        }
                    }
                } else {
                    // Fallback to basic character drawing if no colors from server
                    const flip = enemy.facing === 'left' || (enemy.facing === undefined && (enemy.vx||0) < 0);
                    drawCharacter(currentCtx,{timer:0,index:0},enemy.x||0,enemy.y||0,48,64,dt,flip,moving,air,{}); 
                }
                
                // Add spellcaster visual effects
                if (enemy.type === 'spellcaster') {
                    // Add magical aura around spellcaster
                    const time = Date.now() * 0.005;
                    const auraSize = 8 + Math.sin(time * 2) * 3;
                    
                    // Magical glow effect
                    currentCtx.shadowColor = '#8A2BE2'; // Blue-violet
                    currentCtx.shadowBlur = 15;
                    currentCtx.globalCompositeOperation = 'screen';
                    
                    // Draw magical particles around the spellcaster
                    for (let i = 0; i < 6; i++) {
                        const angle = (time * 0.5 + i * Math.PI / 3) % (Math.PI * 2);
                        const radius = 35 + Math.sin(time * 3 + i) * 5;
                        const particleX = enemy.x + Math.cos(angle) * radius;
                        const particleY = enemy.y + Math.sin(angle) * radius;
                        
                        currentCtx.fillStyle = `rgba(138, 43, 226, ${0.6 + Math.sin(time * 4 + i) * 0.3})`;
                        currentCtx.beginPath();
                        currentCtx.arc(particleX, particleY, auraSize * 0.3, 0, Math.PI * 2);
                        currentCtx.fill();
                    }
                    
                    // Add spellcasting indicator if attack cooldown is low (about to cast)
                    if (enemy.attackCooldown !== undefined && enemy.attackCooldown < 0.5) {
                        // Draw spellcasting charge effect
                        const chargeIntensity = 1 - (enemy.attackCooldown / 0.5);
                        currentCtx.fillStyle = `rgba(255, 255, 0, ${chargeIntensity * 0.8})`;
                        currentCtx.beginPath();
                        currentCtx.arc(enemy.x + 24, enemy.y - 10, 15 + chargeIntensity * 10, 0, Math.PI * 2);
                        currentCtx.fill();
                        
                        // Draw wand glow
                        currentCtx.strokeStyle = `rgba(255, 255, 0, ${chargeIntensity})`;
                        currentCtx.lineWidth = 3;
                        currentCtx.beginPath();
                        currentCtx.moveTo(enemy.x + 24, enemy.y + 10);
                        currentCtx.lineTo(enemy.x + 24 + (enemy.vx < 0 ? -20 : 20), enemy.y + 10);
                        currentCtx.stroke();
                    }
                    
                    // Reset composite operation
                    currentCtx.globalCompositeOperation = 'source-over';
                    currentCtx.shadowBlur = 0;
                }
                
                currentCtx.restore();
                
                currentCtx.fillStyle='#000'; 
                currentCtx.fillText('L'+(enemy.level||1), enemy.x||0, (enemy.y||0)-8); 
                const hpw=clamp(40*((enemy.health||1)/(enemy.maxHealth||1)),0,40); 
                currentCtx.fillStyle='#0f0'; 
                currentCtx.fillRect(enemy.x||0,(enemy.y||0)-8,hpw,4); 
                
                // Display enemy name
                if (enemy.name) {
                    currentCtx.fillStyle='#000'; 
                    currentCtx.font='10px monospace';
                    currentCtx.textAlign='center';
                    
                    // Special styling for spellcaster enemies
                    if (enemy.type === 'spellcaster') {
                        currentCtx.fillStyle='#8A2BE2'; // Purple for spellcasters
                        currentCtx.font='bold 11px monospace';
                        currentCtx.fillText('🧙 ' + enemy.name, enemy.x||0, (enemy.y||0)-20);
                    } else {
                        currentCtx.fillText(enemy.name, enemy.x||0, (enemy.y||0)-20);
                    }
                    
                    currentCtx.textAlign='left'; // Reset alignment
                }
            } 
                } else if (Array.isArray(window.enemies)) {
            for(const e of window.enemies){
                if(!e || e.dead) continue; 
                // Safety check for required properties
                if(typeof e.vx === 'undefined' || typeof e.vy === 'undefined' || 
                   typeof e.x === 'undefined' || typeof e.y === 'undefined' || 
                   typeof e.w === 'undefined' || typeof e.h === 'undefined' ||
                   typeof e.level === 'undefined' || typeof e.health === 'undefined' || 
                   typeof e.maxHealth === 'undefined') {
                    console.warn('Enemy missing required properties:', e);
                    continue;
                }
                
                const moving = Math.abs(e.vx)>5; 
                const air = e.vy<-5 || e.vy>5; 
                
                // Initialize damage feedback properties if they don't exist
                if (typeof e.damageFlashTimer === 'undefined') {
                    e.damageFlashTimer = 0;
                }
                
                // Update damage flash timer
                if (e.damageFlashTimer > 0) {
                    e.damageFlashTimer -= dt;
                }
                
                // Draw enemy with damage flash effect (skip for Water Wisp - it uses hurt sprites)
                currentCtx.save();
                if (e.damageFlashTimer > 0 && e.type !== 'waterwisp') {
                    // Flash red when taking damage (not for Water Wisp)
                    currentCtx.globalCompositeOperation = 'multiply';
                    currentCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    currentCtx.fillRect(e.x, e.y, e.w, e.h);
                }
                
                // Check if this is a Water Wisp enemy (sprite-based)
                if (e.type === 'waterwisp' && window.drawWaterWisp) {
                    window.drawWaterWisp(currentCtx, e, dt);
                }
                // Draw enemy as NPC with consistent colors
                else if (window.drawNPCBody && e.colors) {
                    window.drawNPCBody(currentCtx, e.x, e.y, e.colors, e.anim ? e.anim.index : 0, moving);
                } else {
                    // Fallback to basic character drawing
                    let eSwing=0; 
                    if(e.state==='attack' && typeof e.t !== 'undefined' && typeof e.attackSwing !== 'undefined'){ 
                        const progress = 1 - (e.t/e.attackSwing); 
                        if (typeof window.swingAngle === 'function') {
                            eSwing = window.swingAngle(progress); 
                        } else {
                            eSwing = 0;
                        }
                    } 
                    drawCharacter(currentCtx,e.anim||{timer:0,index:0},e.x,e.y,e.w,e.h,dt,(e.facing||0)<0,moving,air,{swingAngle:eSwing});
                }
                currentCtx.restore(); 
                if(e.state==='windup'){ 
                    currentCtx.save(); 
                    currentCtx.globalAlpha=0.35; 
                    currentCtx.fillStyle='red'; 
                    currentCtx.fillRect(e.x-2,e.y-2,e.w+4,e.h+4); 
                    currentCtx.restore(); 
                } 
                currentCtx.fillStyle='#000'; 
                currentCtx.fillText('L'+(e.level||1), e.x, e.y-8); 
                const hpw=clamp(40*((e.health||1)/(e.maxHealth||1)),0,48); 
                currentCtx.fillStyle='#0f0'; 
                currentCtx.fillRect(e.x,e.y-8,hpw,4); 
                
                // Display enemy name
                if (e.name) {
                    currentCtx.fillStyle='#000'; 
                    currentCtx.font='10px monospace';
                    currentCtx.textAlign='center';
                    currentCtx.fillText(e.name, e.x, e.y-20);
                    currentCtx.textAlign='left'; // Reset alignment
                }
            } 
        } 
        
        // Draw projectiles
        if (window.projectiles && Array.isArray(window.projectiles)) {
            // Clean up projectiles that are off-screen or expired
            const cameraLeft = window.player.x - window.CAM_W / 2;
            const cameraRight = window.player.x + window.CAM_W / 2;
            const cameraTop = window.player.y - window.CAM_H / 2;
            const cameraBottom = window.player.y + window.CAM_H / 2;
            const margin = 500; // Remove if beyond this margin outside camera
            
            for (let i = window.projectiles.length - 1; i >= 0; i--) {
                const projectile = window.projectiles[i];
                if (!projectile || projectile.destroyed) {
                    window.projectiles.splice(i, 1);
                    continue;
                }
                
                // Remove projectiles that are way off-screen
                if (projectile.x < cameraLeft - margin || 
                    projectile.x > cameraRight + margin || 
                    projectile.y > cameraBottom + margin ||
                    projectile.y < cameraTop - margin) {
                    window.projectiles.splice(i, 1);
                    continue;
                }
                
                // Remove enemy projectiles that have expired (if they have createdAt and lifeTime)
                if (projectile.isEnemyProjectile && projectile.createdAt && projectile.lifeTime) {
                    const now = Date.now();
                    if (now - projectile.createdAt > projectile.lifeTime) {
                        window.projectiles.splice(i, 1);
                        continue;
                    }
                }
            }
            
            for (const projectile of window.projectiles) {
                if (!projectile || projectile.destroyed) continue;
                
                currentCtx.save();
                
                if (projectile.type === 'arrow') {
                    // Draw arrow
                    currentCtx.strokeStyle = '#8B4513'; // Brown shaft
                    currentCtx.lineWidth = 2;
                    currentCtx.beginPath();
                    currentCtx.moveTo(projectile.x, projectile.y);
                    currentCtx.lineTo(projectile.x - projectile.vx * 0.02, projectile.y - projectile.vy * 0.02);
                    currentCtx.stroke();
                    
                    // Arrow head
                    currentCtx.fillStyle = '#696969'; // Gray arrowhead
                    currentCtx.beginPath();
                    currentCtx.moveTo(projectile.x, projectile.y);
                    currentCtx.lineTo(projectile.x - 8, projectile.y - 4);
                    currentCtx.lineTo(projectile.x - 8, projectile.y + 4);
                    currentCtx.closePath();
                    currentCtx.fill();
                } else if (projectile.type === 'fireball') {
                    // Draw enhanced animated fireball with better visibility
                    const time = Date.now() * 0.01;
                    const baseSize = 12; // Increased base size
                    const size = baseSize + Math.sin(time * 4) * 3; // More dramatic pulsing
                    
                    // Outer glow effect for better visibility
                    currentCtx.shadowColor = '#FF4500';
                    currentCtx.shadowBlur = 15;
                    currentCtx.shadowOffsetX = 0;
                    currentCtx.shadowOffsetY = 0;
                    
                    // Bright yellow-white core
                    currentCtx.fillStyle = '#FFFF00';
                    currentCtx.beginPath();
                    currentCtx.arc(projectile.x, projectile.y, size * 0.4, 0, Math.PI * 2);
                    currentCtx.fill();
                    
                    // Orange-red middle layer
                    currentCtx.fillStyle = '#FF4500';
                    currentCtx.beginPath();
                    currentCtx.arc(projectile.x, projectile.y, size * 0.7, 0, Math.PI * 2);
                    currentCtx.fill();
                    
                    // Dark red outer layer
                    currentCtx.fillStyle = '#CC0000';
                    currentCtx.beginPath();
                    currentCtx.arc(projectile.x, projectile.y, size, 0, Math.PI * 2);
                    currentCtx.fill();
                    
                    // Reset shadow for particles
                    currentCtx.shadowBlur = 0;
                    
                    // Enhanced fire particles with trail effect
                    currentCtx.fillStyle = '#FFFF00';
                    for (let i = 0; i < 5; i++) {
                        const angle = time * 2 + i * Math.PI * 2 / 5;
                        const radius = size + 6 + Math.sin(time * 6 + i) * 2;
                        const px = projectile.x + Math.cos(angle) * radius;
                        const py = projectile.y + Math.sin(angle) * radius;
                        
                        // Draw particle with slight trail
                        currentCtx.globalAlpha = 0.8;
                        currentCtx.beginPath();
                        currentCtx.arc(px, py, 3, 0, Math.PI * 2);
                        currentCtx.fill();
                        
                        // Trail effect
                        currentCtx.globalAlpha = 0.4;
                        currentCtx.beginPath();
                        currentCtx.arc(px - Math.cos(angle) * 2, py - Math.sin(angle) * 2, 2, 0, Math.PI * 2);
                        currentCtx.fill();
                    }
                    
                    // Reset alpha
                    currentCtx.globalAlpha = 1.0;
                } else {
                    // Fallback for unknown projectile types - draw a simple circle
                    currentCtx.fillStyle = '#FF0000'; // Red fallback
                    currentCtx.beginPath();
                    currentCtx.arc(projectile.x, projectile.y, 6, 0, Math.PI * 2);
                    currentCtx.fill();
                }
                
                currentCtx.restore();
            }
        }
        
        const moving = Math.abs(window.player.vx)>2;
        const air = !window.player.onGround;
        let pSwing=0;
        if(window.player.attackAnimTime>0){
            const progress = 1 - (window.player.attackAnimTime/0.25);
            if (typeof window.swingAngle === 'function') {
                pSwing = window.swingAngle(progress);
            } else {
                pSwing = 0;
            }
            if(!window.player._attackApplied && progress>0.4 && progress<0.7){
                const damage = 8 + (window.equip && window.equip.mainhand? window.equip.mainhand.level*2 : 0) + (window.player.stats && window.player.stats.Strength ? window.player.stats.Strength*1.2 : 0); 
                let hitEnemy = false;
                
                if (typeof window.isConnected === 'function' && window.isConnected() && window.remoteEnemies && window.remoteEnemies instanceof Map){
                    // Hit remote (server) enemies
                    for (const e of window.remoteEnemies.values()){ 
                        // Calculate player attack origin based on facing direction
                        // Attack point should be at the weapon tip
                        const reach = window.player._reach || 60;
                        const playerAttackX = window.player.facing > 0 ? 
                            window.player.x + window.player.w + reach : // Right side + reach when facing right
                            window.player.x - reach; // Left side - reach when facing left
                        
                        const dx=( (e.x||0)+24 )-playerAttackX; 
                        const dy=( (e.y||0)+32 )-(window.player.y+window.player.h/2); 
                        const dist=Math.hypot(dx,dy); 
                        if(dist <= (window.player._reach || 60)){ 
                            if (typeof window.wsSend === 'function') {
                                window.wsSend({ type:'attackEnemy', id: e.id, damage: Math.round(damage) }); 
                            } else {
                                console.warn('wsSend function not available yet');
                            }
                            hitEnemy = true;
                            break; 
                        } 
                    } 
                } else if (Array.isArray(window.enemies)) { 
                    // Offline/local enemies
                    for(const e of window.enemies){ 
                        if(!e || e.dead) continue; 
                        // Safety check for required properties
                        if(typeof e.x === 'undefined' || typeof e.y === 'undefined' || 
                           typeof e.w === 'undefined' || typeof e.h === 'undefined') {
                            console.warn('Enemy missing required properties for attack:', e);
                            continue;
                        }
                        
                        // Calculate player attack origin based on facing direction
                        // Attack point should be at the weapon tip
                        const reach = window.player._reach || 60;
                        const playerAttackX = window.player.facing > 0 ? 
                            window.player.x + window.player.w + reach : // Right side + reach when facing right
                            window.player.x - reach; // Left side - reach when facing left
                        
                        const dx=(e.x+e.w/2)-playerAttackX; 
                        const dy=(e.y+e.h/2)-(window.player.y+window.player.h/2); 
                        const dist=Math.hypot(dx,dy); 
                        if(dist<=(window.player._reach || 60)){ 
                            if(typeof e.takeDamage === 'function') {
                                e.takeDamage(damage); 
                            } else {
                                console.warn('Enemy missing takeDamage method:', e);
                            }
                            hitEnemy = true;
                        } 
                    } 
                } 
                
                // Mark attack as applied if we hit an enemy
                if (hitEnemy) {
                    window.player._attackApplied = true;
                }
            } 
        } 
        if (window.player) {
            // Initialize damage feedback properties if they don't exist
            if (typeof window.player.damageFlashTimer === 'undefined') {
                window.player.damageFlashTimer = 0;
            }
            
            // Update damage flash timer
            if (window.player.damageFlashTimer > 0) {
                window.player.damageFlashTimer -= dt;
            }
            
            // Draw player with damage flash effect
            currentCtx.save();
            if (window.player.damageFlashTimer > 0) {
                // Flash red when taking damage
                currentCtx.globalCompositeOperation = 'multiply';
                currentCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                currentCtx.fillRect(window.player.x, window.player.y, window.player.w, window.player.h);
            }
            
            drawCharacter(currentCtx,window.player.anim,window.player.x,window.player.y,window.player.w,window.player.h,dt,window.player.facing<0,moving,air,{swingAngle:pSwing}); 
            currentCtx.restore();
            
            currentCtx.fillStyle='#000'; 
            currentCtx.fillText(window.player.id, window.player.x, window.player.y-10); 
            currentCtx.fillStyle='#0f0'; 
            currentCtx.fillRect(window.player.x, window.player.y-10, clamp(48*(window.player.health/window.player.maxHealth),0,48),4);
            
            // Draw mana bar (blue) below health bar
            if (window.player.maxMana && window.player.maxMana > 0) {
                const currentMana = window.player.mana !== undefined ? window.player.mana : window.player.maxMana;
                const manaBarWidth = clamp(48 * (currentMana / window.player.maxMana), 0, 48);
                currentCtx.fillStyle = window.player._insufficientManaFlash ? '#ff0088' : '#00f'; // Flash magenta if insufficient mana
                currentCtx.fillRect(window.player.x, window.player.y - 6, manaBarWidth, 3);
                // Draw background for mana bar
                currentCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                currentCtx.fillRect(window.player.x, window.player.y - 6, 48, 3);
                // Draw mana fill again on top
                currentCtx.fillStyle = window.player._insufficientManaFlash ? '#ff0088' : '#00f';
                currentCtx.fillRect(window.player.x, window.player.y - 6, manaBarWidth, 3);
            }
        } 
        
        // Show death indicator and respawn countdown
        if (window.player && window.player.isDead) {
            currentCtx.save();
            currentCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            currentCtx.fillRect(window.player.x, window.player.y - 30, window.player.w, 20);
            currentCtx.fillStyle = '#fff';
            currentCtx.font = '12px monospace';
            currentCtx.textAlign = 'center';
            currentCtx.fillText('DEAD', window.player.x + window.player.w/2, window.player.y - 15);
            
            // Show "You have died!" message for 3 seconds
            if (window.player.deathMessageTimer > 0) {
                currentCtx.fillStyle = '#ff0000';
                currentCtx.font = '16px monospace';
                currentCtx.fillText('You have died!', window.player.x + window.player.w/2, window.player.y - 35);
            }
            
            // Show respawn countdown
            if (window.player.respawnTimer > 0) {
                const countdown = Math.ceil(window.player.respawnTimer);
                currentCtx.fillStyle = '#fff';
                currentCtx.font = '12px monospace';
                currentCtx.fillText(`Respawn in ${countdown}s`, window.player.x + window.player.w/2, window.player.y - 5);
            }
            currentCtx.restore();
        }
        
        // Render portals
        if (window.gameState && window.gameState.portals) {
            // Maintain persistent portal objects to preserve rotation state
            if (!window.portalObjects) {
                window.portalObjects = new Map();
            }
            
            for (const portal of window.gameState.portals) {
                if (window.Portal) {
                    // Get or create portal object
                    let portalObj = window.portalObjects.get(portal.id);
                    if (!portalObj) {
                        portalObj = new window.Portal(portal.id, portal.x, portal.y, portal.targetLevel);
                        portalObj.w = portal.w || portal.width || 64;
                        portalObj.h = portal.h || portal.height || 64;
                        window.portalObjects.set(portal.id, portalObj);
                    } else {
                        // Update position and size from server data (in case it changed)
                        portalObj.x = portal.x;
                        portalObj.y = portal.y;
                        portalObj.w = portal.w || portal.width || 64;
                        portalObj.h = portal.h || portal.height || 64;
                        if (portal.targetLevel) {
                            portalObj.targetLevel = portal.targetLevel;
                        }
                    }
                    
                    // Update rotation and animation
                    portalObj.update(dt);
                    portalObj.draw(currentCtx);
                }
            }
            
            // Clean up portal objects that no longer exist
            const activePortalIds = new Set(window.gameState.portals.map(p => p.id));
            for (const [id, portalObj] of window.portalObjects.entries()) {
                if (!activePortalIds.has(id)) {
                    window.portalObjects.delete(id);
                }
            }
        }
        
        currentCtx.restore(); 
    }

    function loop(now){
        try{
            if (typeof window.last === 'undefined') {
                window.last = now;
            }
            // Cap delta time to prevent large jumps (60fps = 16.67ms, allow up to 33ms for frame drops)
            const dt = Math.min(0.033, (now - window.last) / 1000); 
            window.last = now;
            
            // Process any pending network messages (non-blocking)
            if (typeof window._processMessageQueue === 'function') {
                window._processMessageQueue();
            } 
            
            advance(dt); 
            
            if (!window.player) {
                console.warn('Player not available yet');
                return;
            }
            
            if (typeof window.cameraX === 'undefined') {
                window.cameraX = 0;
            }
            if (window.player) {
                // Always center the player on the camera (canvas width)
                // The player should be at VIEW_W/2 (center of screen)
                const targetCameraX = window.player.x + window.player.w/2 - VIEW_W/2;
                
                // Clamp to world boundaries to prevent showing empty space
                window.cameraX = clamp(targetCameraX, 0, WORLD_W - VIEW_W);
                
                // Debug: Log camera and player positions to verify centering
                if (window.debugCamera) {
                }
            } 
            
            render(dt);
            
            if (typeof window.bootLogged === 'undefined') {
                window.bootLogged = false;
            }
            if(!window.bootLogged){ 
                window.bootLogged=true; 
                
                if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
                    if (typeof window.refreshInventoryUI === 'function' && window.player) {
                        window.refreshInventoryUI(); 
                    } else if (!window.player) {
                        // Player not available yet, skip inventory refresh
                    } else {
                        console.warn('refreshInventoryUI function not available yet');
                    }
                } else {
                }
                
                if (typeof window.updatePlayerStatsUI === 'function' && window.player) {
                    window.updatePlayerStatsUI(true);
                } else if (!window.player) {
                    // Player not available yet, skip stats update
                } else {
                    console.warn('updatePlayerStatsUI function not available yet');
                } 
            } 
            if (typeof window.statsUITimer === 'undefined') {
                window.statsUITimer = 0.5;
            }
            window.statsUITimer -= dt; 
            if (window.statsUITimer <= 0) { 
                if (typeof window.updatePlayerStatsUI === 'function' && window.player) {
                    window.updatePlayerStatsUI(); 
                } else if (!window.player) {
                    // Player not available yet, skip stats update
                } else {
                    console.warn('updatePlayerStatsUI function not available yet');
                }
                window.statsUITimer = 0.5; 
            } 
            
            // Schedule next frame
            requestAnimationFrame(loop);

        } catch (e) { 
            console.error('Loop error: ' + e.message); 
            // Even if there's an error, try to continue the loop
            requestAnimationFrame(loop);
        } 
    }

    // Wait for DOM and required functions to be ready before starting the game loop
    function startGameWhenReady() {
        // Check if required functions and classes are available
        const gameCanvas = document.getElementById('game');
        if (typeof window.Player !== 'function' || 
            typeof window.advanceAnim !== 'function' || 
            !window.binds || 
            !gameCanvas) {
            setTimeout(startGameWhenReady, 100);
            return;
        }
        
        
        // Start the game loop
        requestAnimationFrame(loop);
        
        // Initialize scrollbars after game starts
        setTimeout(() => {
            try {
                if (typeof window.managePanelScrollbars === 'function') {
                    window.managePanelScrollbars();
                }
            } catch (error) {
                // Silently handle scrollbar initialization errors
            }
        }, 200);
        
        // Test item spawning removed to prevent interference with pickup system
        (function(){ 
            try{
                if (window.binds && window.Player && typeof window.Player === 'function') {
                    const r1=new window.Player('R1',0,0,window.binds,'#4aa3ff'); 
                    r1.baseStats.Endurance=29; 
                    r1.applyEquipment(); 
                    r1.health=r1.maxHealth-50; 
                    r1._damageTimer=31; 
                    r1.update(1.0); 
                    const g1=r1.health-(r1.maxHealth-50);
                    const r2=new window.Player('R2',0,0,window.binds,'#4aa3ff'); 
                    r2.baseStats.Endurance=30; 
                    r2.applyEquipment(); 
                    r2.health=r2.maxHealth-50; 
                    r2._damageTimer=31; 
                    r2.update(1.0); 
                    const g2=r2.health-(r1.maxHealth-50);
                }
            }catch(e){ 
                console.warn('tests skipped',e);
            } 
        })();
    }

    // Start the game when ready
    startGameWhenReady();
} // Close initializeEngine function

// Start waiting for dependencies when the script loads
waitForDependencies();

})();
