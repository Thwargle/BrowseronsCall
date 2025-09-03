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
        window.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
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
    
    console.log('Player initialized:', window.player);
    console.log('Player properties:', {x: window.player.x, y: window.player.y, w: window.player.w, h: window.player.h});
    
    // Local enemies are only used when offline; when connected, we render server enemies from window.remoteEnemies
    window.enemies=[];
    console.log('Initialized local enemies array:', window.enemies);

    // Initialize projectiles array for network-synchronized projectiles
    window.projectiles = [];

    // Initialize vendor with a placeholder - will be overwritten by server data when connected
    // This ensures server-authoritative vendor appearance
    window.vendor = {
        x: 200,
        y: 486,
        w: 48,
        h: 64,
        anim: {timer: 0, index: 0},
        // Don't set colors here - they should come from the server
        colors: null
    };

    // Initialize WebSocket functions if not already set
    if (!window.wsSend) {
        window.wsSend = function(data) {
            console.log('wsSend called (no-op):', data);
            // No-op when not connected
        };
        console.log('Initialized window.wsSend function');
    }

    if (!window.wsDisconnect) {
        window.wsDisconnect = function() {
            console.log('wsDisconnect called (no-op)');
            // No-op when not connected
        };
        console.log('Initialized window.wsDisconnect function');
    }

    if (!window.wsConnect) {
        window.wsConnect = function(url) {
            console.log('wsConnect called (no-op):', url);
            // No-op when not connected
        };
        console.log('Initialized window.wsConnect function');
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
        console.log('Setting SHEET_READY to false');
        window.SHEET_READY = false;
    }
    if (!window.baseSheetImg) {
        console.log('Setting baseSheetImg to null');
        window.baseSheetImg = null;
    }
    if (!window.FW) {
        console.log('Setting FW to 48');
        window.FW = 48;
    }
    if (!window.FH) {
        console.log('Setting FH to 64');
        window.FH = 64;
    }

    // Initialize view dimensions if not already set
    if (!window.VIEW_W) {
        console.log('Setting VIEW_W to 800');
        window.VIEW_W = 800;
    }
    if (!window.VIEW_H) {
        console.log('Setting VIEW_H to 600');
        window.VIEW_H = 600;
    }

    // Initialize world dimensions if not already set
    if (!window.WORLD_W) {
        console.log('Setting WORLD_W to 3600');
        window.WORLD_W = 3600;
    }

    if (!window.GROUND_Y) {
        console.log('Setting GROUND_Y to 550');
        window.GROUND_Y = 550;
    }

    // Ensure worldDrops is initialized globally
    if (!window.worldDrops) {
        window.worldDrops = [];
        console.log('Initialized window.worldDrops:', window.worldDrops);
    } else {
        console.log('Using existing worldDrops:', window.worldDrops.length, 'items');
    }

    // Initialize platforms if not already set
    if (!window.platforms) {
        console.log('Creating default platforms');
        window.platforms = [
            {x: 0, y: 550, w: 3600, h: 50}
        ];
    } else {
        console.log('Using existing platforms:', window.platforms);
    }

    // Initialize camera position
    if (!window.cameraX) {
        console.log('Setting cameraX to 0');
        window.cameraX = 0;
    } else {
        console.log('Using existing cameraX:', window.cameraX);
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
            if(!text) return; 
            window.wsSend({type:'chat',msg:text}); 
            chatInput.value=''; 
            
            // Return focus to the game canvas after sending chat (with small delay)
            setTimeout(() => {
                document.getElementById('game').focus();
            }, 10);
        } 
    });

    // Global Enter key listener for focusing chat when in game
    document.addEventListener('keydown', function(e) {
        // Only handle Enter key when the game canvas is focused and when connected
        if (e.key === 'Enter' && document.activeElement === document.getElementById('game') && window.isConnected && window.isConnected()) {
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
            // Only initialize inventory UI if we're not connected to server
            // This prevents interference with server inventory data
            if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
                window.initInventoryUI(); 
            } else {
                console.log('Skipping initInventoryUI - already connected to server with inventory data');
            }
            
            window.initPaperDollUI(); 
            
            // Only refresh inventory UI if we're not connected to server
            if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
                window.refreshInventoryUI(); 
            } else {
                console.log('Skipping refreshInventoryUI - already connected to server with inventory data');
            }
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
        
        console.log('Canvas event listeners set up successfully');
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
                    console.log('Using existing Enemy class');
                    const e=new window.Enemy(randInt(300,Math.min(WORLD_W-150,850)),0,randInt(1,5)); 
                    window.enemies.push(e);
                } else {
                    console.log('Enemy class not found, cannot spawn local enemies');
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
            console.log('Skipping refreshInventoryUI for clearDrops - connected to server with inventory data');
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

    // Function to check if any input field is focused
    function checkInputActive() {
        const chatInput = document.getElementById('chatInput');
        return chatInput && chatInput === document.activeElement;
    }

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
        } 
        // When online, enemy AI is server-authoritative; do not run local AI
        // Only update local enemies when offline
        if (!window.isConnected || !window.isConnected()) {
            for(const e of window.enemies) {
                if (e && typeof e.update === 'function') {
                    e.update(dt);
                } else if (e && typeof e.update === 'undefined') {
                    console.warn('Enemy missing update method:', e);
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
                
                // Ground collision
                if (d.y >= (window.GROUND_Y || 550) - 16) {
                    d.y = (window.GROUND_Y || 550) - 16;
                    d.vy = 0;
                    d.grounded = true;
                }
                
                // Platform collision detection
                if (Array.isArray(window.platforms)) {
                    for (const platform of window.platforms) {
                        // Check if drop is above the platform and within its horizontal bounds
                        if (d.y + 16 >= platform.y && d.y < platform.y + platform.h &&
                            d.x + 16 > platform.x && d.x < platform.x + platform.w) {
                            
                            // Land on the platform
                            d.y = platform.y - 16;
                            d.vy = 0;
                            d.grounded = true;
                            break;
                        }
                    }
                }
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
                console.log('Picking up:', d.item.name, 'at distance:', dist);
                
                if (d.item.type === 'currency') {
                    const amt = d.item.amount || d.item.value || 0;
                    window.player.pyreals += amt;
                    window.worldDrops.splice(i, 1);
                    console.log('Picked up ' + amt + ' Pyreals');
                    
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
                    console.log('No space in bag for item:', d.item.name);
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
            window.drawAllEquipment(ctx, X, Y, otherPlayer.equip, false);
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
                window.drawWeapon(ctx, X, Y, false, otherPlayer.equip.mainhand, ang);
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
        const frame = window.advanceAnim(anim, dt, isAir, isMoving); 
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
            window.drawAllEquipment(ctx,X,Y,window.equip,true);
            // Draw mainhand weapon with swing angle if needed
            if (window.equip.mainhand) {
                const ang = (opts.swingAngle||0); 
                window.drawWeapon(ctx,X,Y,flip,window.equip.mainhand,ang);
                
                // Draw attack range indicator when attacking
                if (opts.swingAngle !== undefined && opts.swingAngle !== 0) {
                    drawAttackRangeIndicator(ctx, X, Y, W, H, flip, window.player._reach || 60);
                }
            }
        } 
        ctx.restore(); 
    }
    
    // Draw attack range indicator to show how far the player can hit
    function drawAttackRangeIndicator(ctx, x, y, w, h, flip, reach) {
        ctx.save();
        
        // Calculate the center of the character
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        
        // Convert reach from game units to pixels (reach of 70 = ~100 pixels)
        const reachPixels = (reach / 70) * 100;
        
        // Draw a semi-transparent arc showing the attack range
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        
        // Draw the range indicator as a semi-circle in the direction the player is facing
        ctx.beginPath();
        if (flip) {
            // Facing left - draw arc on the left side
            ctx.arc(centerX, centerY, reachPixels, Math.PI/2, -Math.PI/2, true);
        } else {
            // Facing right - draw arc on the right side
            ctx.arc(centerX, centerY, reachPixels, -Math.PI/2, Math.PI/2, false);
        }
        ctx.stroke();
        
        // Draw a small dot at the maximum reach distance
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ff4444';
        if (flip) {
            ctx.fillRect(centerX - reachPixels - 2, centerY - 2, 4, 4);
        } else {
            ctx.fillRect(centerX + reachPixels - 2, centerY - 2, 4, 4);
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
        
        if (Array.isArray(window.platforms)) {
            for(const p of window.platforms){ 
                currentCtx.fillStyle='#394b59'; 
                currentCtx.fillRect(p.x,p.y,p.w,p.h); 
                currentCtx.strokeStyle='#2b3b43'; 
                currentCtx.strokeRect(p.x,p.y,p.w,p.h); 
            }
        }
        
        if (window.vendor) {
            // Draw vendor as NPC with server-provided colors for consistent appearance
            if (window.drawNPCBody && window.vendor.colors) {
                window.drawNPCBody(currentCtx, window.vendor.x, window.vendor.y, window.vendor.colors, 0, false);
            } else {
                // Fallback to basic character drawing if no colors from server
                // Don't use equipment to avoid making vendor look like player
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
                
                // Draw enemy with damage flash effect
                currentCtx.save();
                if (enemy.damageFlashTimer > 0) {
                    // Flash red when taking damage
                    currentCtx.globalCompositeOperation = 'multiply';
                    currentCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    currentCtx.fillRect(enemy.x||0, enemy.y||0, 48, 64);
                }
                
                // Draw enemy as NPC with server-provided colors for consistent appearance
                if (window.drawNPCBody && enemy.colors) {
                    window.drawNPCBody(currentCtx, enemy.x||0, enemy.y||0, enemy.colors, 0, moving);
                } else {
                    // Fallback to basic character drawing if no colors from server
                    drawCharacter(currentCtx,{timer:0,index:0},enemy.x||0,enemy.y||0,48,64,dt,(enemy.vx||0)<0,moving,air,{}); 
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
                
                // Draw enemy with damage flash effect
                currentCtx.save();
                if (e.damageFlashTimer > 0) {
                    // Flash red when taking damage
                    currentCtx.globalCompositeOperation = 'multiply';
                    currentCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    currentCtx.fillRect(e.x, e.y, e.w, e.h);
                }
                
                // Draw enemy as NPC with consistent colors
                if (window.drawNPCBody && e.colors) {
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
                    console.log('Unknown projectile type:', projectile.type, 'drawing fallback');
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
                        const playerAttackX = window.player.facing > 0 ? 
                            window.player.x + window.player.w : // Right side when facing right
                            window.player.x; // Left side when facing left
                        
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
                        const playerAttackX = window.player.facing > 0 ? 
                            window.player.x + window.player.w : // Right side when facing right
                            window.player.x; // Left side when facing left
                        
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
        
        currentCtx.restore(); 
    }

    function loop(now){
        try{
            if (typeof window.last === 'undefined') {
                window.last = now;
            }
            const dt = Math.min(0.033, (now - window.last) / 1000); 
            window.last = now; 
            
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
                    console.log('Player x:', window.player.x, 'Camera X:', window.cameraX, 'Target:', targetCameraX);
                }
            } 
            
            render(dt);
            
            if (typeof window.bootLogged === 'undefined') {
                window.bootLogged = false;
            }
            if(!window.bootLogged){ 
                window.bootLogged=true; 
                console.log('Engine started.'); 
                
                if (!window.connectionStatus || !window.connectionStatus.initialConnectionComplete) {
                    if (typeof window.refreshInventoryUI === 'function' && window.player) {
                        window.refreshInventoryUI(); 
                    } else if (!window.player) {
                        // Player not available yet, skip inventory refresh
                    } else {
                        console.warn('refreshInventoryUI function not available yet');
                    }
                } else {
                    console.log('Skipping refreshInventoryUI for engine startup - connected to server with inventory data');
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
            console.log('Waiting for required functions to be available...');
            setTimeout(startGameWhenReady, 100);
            return;
        }
        
        console.log('All required functions available, starting game loop');
        
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
                    console.log('[test] regen step at 30 Endurance', g2>g1);
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
