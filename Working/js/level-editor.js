class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('levelCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 32;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Editor state
        this.selectedTool = 'floor';
        this.selectedMaterial = 'dirt';
        this.brushSize = 3;
        this.isPlacing = false;
        this.isErasing = false;
        this.isSpacePressed = false;
        this.selectedObject = null; // Currently selected vendor or spawner
        this.selectionMode = false; // Whether we're in selection mode
        this.isSpaceDragging = false; // Whether we're dragging with spacebar
        
        // Undo system
        this.changeBuffer = []; // Array to store previous states
        this.maxUndoSteps = 50; // Maximum number of undo steps
        this.currentChangeIndex = -1; // Current position in change buffer
        
        // Level data
        this.levelData = {
            name: 'Custom Level',
            width: 3600,
            height: 600,
            floors: [],
            vendors: [],
            spawners: [],
            portals: []
        };
        
        // Material definitions
        this.materials = {
            dirt: { color: '#8B4513', pattern: 'dirt' },
            grass: { color: '#228B22', pattern: 'grass' },
            stone: { color: '#696969', pattern: 'stone' },
            rock: { color: '#2F4F4F', pattern: 'rock' }, // Dark gray for rock
            sand: { color: '#F4A460', pattern: 'sand' },
            water: { color: '#4169E1', pattern: 'water' }
        };
        
        this.initializeEventListeners();
        this.initializeCanvas();
        this.render();
        this.saveState(); // Save initial state
    }
    
    initializeEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTool(e.target);
            });
        });
        
        // Brush size
        const brushSizeSlider = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        brushSizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            brushSizeValue.textContent = this.brushSize;
        });
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable right-click menu
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Action buttons
        document.getElementById('saveLevel').addEventListener('click', () => this.saveLevel());
        document.getElementById('loadLevel').addEventListener('click', () => this.loadLevel());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('clearLevel').addEventListener('click', () => this.clearLevel());
        
        // Selected object buttons
        document.getElementById('updateSelectedObject').addEventListener('click', () => this.updateSelectedObject());
        document.getElementById('deleteSelectedObject').addEventListener('click', () => this.deleteSelectedObject());
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoomReset').addEventListener('click', () => this.zoomReset());
        
        // Initialize spawner and portal configs as hidden
        document.getElementById('spawnerConfig').classList.add('hidden');
        document.getElementById('portalConfig').classList.add('hidden');
        
        // Keyboard shortcuts (Ctrl+Z for undo)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
        });
    }
    
    initializeCanvas() {
        // Set canvas size
        this.canvas.width = 3600;
        this.canvas.height = 600;
        
        // Initialize with default ground
        this.addFloorSegment(0, 550, 3600, 50, 'dirt');
    }
    
    selectTool(button) {
        // Remove active class from all buttons
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        button.classList.add('active');
        
        if (button.dataset.material) {
            this.selectedTool = 'floor';
            this.selectedMaterial = button.dataset.material;
            document.getElementById('selectedTool').textContent = `Floor: ${this.selectedMaterial}`;
        } else if (button.dataset.object) {
            this.selectedTool = button.dataset.object;
            if (this.selectedTool === 'select') {
                this.selectionMode = true;
                document.getElementById('selectedTool').textContent = `Tool: Select`;
                document.getElementById('spawnerConfig').classList.add('hidden');
            } else {
                this.selectionMode = false;
                this.selectedObject = null;
                this.clearSelectedObjectUI();
                document.getElementById('selectedTool').textContent = `Object: ${this.selectedTool}`;
                if (this.selectedTool === 'spawner') {
                    document.getElementById('spawnerConfig').classList.remove('hidden');
                    document.getElementById('portalConfig').classList.add('hidden');
                } else if (this.selectedTool === 'portal') {
                    document.getElementById('portalConfig').classList.remove('hidden');
                    document.getElementById('spawnerConfig').classList.add('hidden');
                } else {
                    document.getElementById('spawnerConfig').classList.add('hidden');
                    document.getElementById('portalConfig').classList.add('hidden');
                }
            }
        }
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panX) / this.zoom;
        const y = (e.clientY - rect.top - this.panY) / this.zoom;
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        if (e.button === 0) { // Left click
            if (this.selectionMode) {
                this.selectObjectAt(x, y);
            } else if (this.isSpacePressed) {
                this.isDragging = true; // Start dragging when spacebar + left click
            } else {
                this.isPlacing = true;
                this.placeAt(x, y);
            }
        } else if (e.button === 2) { // Right click
            this.isErasing = true;
            this.eraseAt(x, y);
        } else if (e.button === 1) { // Middle click
            this.isDragging = true;
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panX) / this.zoom;
        const y = (e.clientY - rect.top - this.panY) / this.zoom;
        
        // Update mouse position display
        document.getElementById('mousePos').textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        
        // Update cursor based on spacebar state
        if (this.isSpacePressed) {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
        
        if (this.isDragging) {
            // Pan the canvas (middle click or left click with spacebar)
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            this.panX += deltaX;
            this.panY += deltaY;
            this.render();
        } else if (this.isPlacing) {
            this.placeAt(x, y);
        } else if (this.isErasing) {
            this.eraseAt(x, y);
        }
        
        // Update mouse position after processing
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        this.isPlacing = false;
        this.isErasing = false;
        this.isSpaceDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom));
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }
    
    handleKeyDown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            this.isSpacePressed = true;
            this.canvas.style.cursor = 'grab';
        }
    }
    
    handleKeyUp(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            this.isSpacePressed = false;
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    placeAt(x, y) {
        if (this.selectedTool === 'floor') {
            this.placeFloor(x, y);
        } else if (this.selectedTool === 'vendor') {
            this.placeVendor(x, y);
        } else if (this.selectedTool === 'spawner') {
            this.placeSpawner(x, y);
        } else if (this.selectedTool === 'portal') {
            this.placePortal(x, y);
        }
    }
    
    selectObjectAt(x, y) {
        // Check vendors first
        for (const vendor of this.levelData.vendors) {
            if (x >= vendor.x && x <= vendor.x + vendor.width &&
                y >= vendor.y && y <= vendor.y + vendor.height) {
                this.selectedObject = { type: 'vendor', data: vendor };
                this.showSelectedObjectUI();
                this.render();
                return;
            }
        }
        
        // Check spawners
        for (const spawner of this.levelData.spawners) {
            if (x >= spawner.x && x <= spawner.x + 32 &&
                y >= spawner.y && y <= spawner.y + 32) {
                this.selectedObject = { type: 'spawner', data: spawner };
                this.showSelectedObjectUI();
                this.render();
                return;
            }
        }
        
        // Check portals
        for (const portal of this.levelData.portals) {
            if (x >= portal.x && x <= portal.x + portal.width &&
                y >= portal.y && y <= portal.y + portal.height) {
                this.selectedObject = { type: 'portal', data: portal };
                this.showSelectedObjectUI();
                this.render();
                return;
            }
        }
        
        // No object selected
        this.selectedObject = null;
        this.clearSelectedObjectUI();
        this.render();
    }
    
    showSelectedObjectUI() {
        if (!this.selectedObject) return;
        
        const obj = this.selectedObject.data;
        document.getElementById('selectedObjectType').value = this.selectedObject.type;
        document.getElementById('selectedObjectId').value = obj.id;
        
        if (this.selectedObject.type === 'vendor') {
            document.getElementById('selectedVendorConfig').style.display = 'block';
            document.getElementById('selectedVendorName').value = obj.name || 'Merchant';
            
            // Hide spawner configs
            document.getElementById('selectedSpawnerConfig').style.display = 'none';
            document.getElementById('selectedSpawnerConfig2').style.display = 'none';
            document.getElementById('selectedSpawnerConfig3').style.display = 'none';
            document.getElementById('selectedSpawnerConfig4').style.display = 'none';
            document.getElementById('selectedSpawnerConfig5').style.display = 'none';
        } else if (this.selectedObject.type === 'spawner') {
            document.getElementById('selectedSpawnerConfig').style.display = 'block';
            document.getElementById('selectedSpawnerConfig2').style.display = 'block';
            document.getElementById('selectedSpawnerConfig3').style.display = 'block';
            document.getElementById('selectedSpawnerConfig4').style.display = 'block';
            document.getElementById('selectedSpawnerConfig5').style.display = 'block';
            
            document.getElementById('selectedSpawnerType').value = obj.type;
            document.getElementById('selectedRespawnTime').value = obj.respawnTime;
            document.getElementById('selectedVisibilityRange').value = obj.visibilityRange;
            document.getElementById('selectedMinLevel').value = obj.minLevel;
            document.getElementById('selectedMaxLevel').value = obj.maxLevel;
            
            // Hide vendor and portal configs
            document.getElementById('selectedVendorConfig').style.display = 'none';
            document.getElementById('selectedPortalConfig').style.display = 'none';
        } else if (this.selectedObject.type === 'portal') {
            document.getElementById('selectedPortalConfig').style.display = 'block';
            document.getElementById('selectedPortalTargetLevel').value = obj.targetLevel;
            
            // Hide vendor and spawner configs
            document.getElementById('selectedVendorConfig').style.display = 'none';
            document.getElementById('selectedSpawnerConfig').style.display = 'none';
            document.getElementById('selectedSpawnerConfig2').style.display = 'none';
            document.getElementById('selectedSpawnerConfig3').style.display = 'none';
            document.getElementById('selectedSpawnerConfig4').style.display = 'none';
            document.getElementById('selectedSpawnerConfig5').style.display = 'none';
        }
        
        document.getElementById('updateSelectedObject').style.display = 'block';
        document.getElementById('deleteSelectedObject').style.display = 'block';
    }
    
    clearSelectedObjectUI() {
        document.getElementById('selectedObjectType').value = '';
        document.getElementById('selectedObjectId').value = '';
        document.getElementById('selectedVendorConfig').style.display = 'none';
        document.getElementById('selectedSpawnerConfig').style.display = 'none';
        document.getElementById('selectedSpawnerConfig2').style.display = 'none';
        document.getElementById('selectedSpawnerConfig3').style.display = 'none';
        document.getElementById('selectedSpawnerConfig4').style.display = 'none';
        document.getElementById('selectedSpawnerConfig5').style.display = 'none';
        document.getElementById('selectedPortalConfig').style.display = 'none';
        document.getElementById('updateSelectedObject').style.display = 'none';
        document.getElementById('deleteSelectedObject').style.display = 'none';
    }
    
    updateSelectedObject() {
        if (!this.selectedObject) return;
        
        const obj = this.selectedObject.data;
        
        if (this.selectedObject.type === 'vendor') {
            obj.name = document.getElementById('selectedVendorName').value;
        } else if (this.selectedObject.type === 'spawner') {
            obj.type = document.getElementById('selectedSpawnerType').value;
            obj.respawnTime = parseInt(document.getElementById('selectedRespawnTime').value);
            obj.visibilityRange = parseInt(document.getElementById('selectedVisibilityRange').value);
            obj.minLevel = parseInt(document.getElementById('selectedMinLevel').value);
            obj.maxLevel = parseInt(document.getElementById('selectedMaxLevel').value);
        } else if (this.selectedObject.type === 'portal') {
            obj.targetLevel = document.getElementById('selectedPortalTargetLevel').value;
        }
        
        this.render();
        console.log('Updated object:', obj);
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        if (confirm(`Are you sure you want to delete this ${this.selectedObject.type}?`)) {
            if (this.selectedObject.type === 'vendor') {
                this.levelData.vendors = this.levelData.vendors.filter(v => v.id !== this.selectedObject.data.id);
            } else if (this.selectedObject.type === 'spawner') {
                this.levelData.spawners = this.levelData.spawners.filter(s => s.id !== this.selectedObject.data.id);
            } else if (this.selectedObject.type === 'portal') {
                this.levelData.portals = this.levelData.portals.filter(p => p.id !== this.selectedObject.data.id);
            }
            
            this.selectedObject = null;
            this.clearSelectedObjectUI();
            this.saveState(); // Save state after deleting object
            this.render();
        }
    }
    
    placeFloor(x, y) {
        const gridX = Math.floor(x / this.gridSize) * this.gridSize;
        const gridY = Math.floor(y / this.gridSize) * this.gridSize;
        
        // Remove existing floor at this position
        this.levelData.floors = this.levelData.floors.filter(floor => 
            !(floor.x <= gridX && floor.x + floor.width >= gridX + this.gridSize &&
              floor.y <= gridY && floor.y + floor.height >= gridY + this.gridSize)
        );
        
        // Add new floor segment
        this.addFloorSegment(gridX, gridY, this.gridSize, this.gridSize, this.selectedMaterial);
        this.saveState(); // Save state after placing floor
        this.render();
    }
    
    placeVendor(x, y) {
        const vendorId = document.getElementById('vendorId').value || 'vendor_1';
        const vendorName = document.getElementById('vendorName').value || 'Merchant';
        
        // Remove existing vendor
        this.levelData.vendors = [];
        
        // Add new vendor
        this.levelData.vendors.push({
            id: vendorId,
            name: vendorName,
            x: Math.round(x),
            y: Math.round(y),
            width: 48,
            height: 64
        });
        
        this.saveState(); // Save state after placing vendor
        this.render();
    }
    
    placeSpawner(x, y) {
        // Auto-generate spawner ID based on existing spawners
        const existingSpawners = this.levelData.spawners.length;
        const spawnerId = `sp_${existingSpawners + 1}`;
        
        const spawnerType = document.getElementById('spawnerType').value;
        const respawnTime = parseInt(document.getElementById('respawnTime').value);
        const visibilityRange = parseInt(document.getElementById('visibilityRange').value);
        const minLevel = parseInt(document.getElementById('minLevel').value);
        const maxLevel = parseInt(document.getElementById('maxLevel').value);
        
        // Add new spawner
        this.levelData.spawners.push({
            id: spawnerId,
            x: Math.round(x),
            y: Math.round(y),
            type: spawnerType,
            respawnTime: respawnTime,
            visibilityRange: visibilityRange,
            minLevel: minLevel,
            maxLevel: maxLevel,
            currentEnemyId: null,
            respawnAt: Date.now() + respawnTime
        });
        
        // Update the spawner ID input for next spawner
        document.getElementById('spawnerId').value = `sp_${existingSpawners + 2}`;
        
        this.saveState(); // Save state after placing spawner
        this.render();
    }
    
    placePortal(x, y) {
        // Auto-generate portal ID based on existing portals
        const existingPortals = this.levelData.portals.length;
        const portalId = `portal_${existingPortals + 1}`;
        
        const targetLevel = document.getElementById('portalTargetLevel').value || 'sample_level';
        
        // Add new portal
        this.levelData.portals.push({
            id: portalId,
            x: Math.round(x),
            y: Math.round(y),
            width: 64,
            height: 64,
            targetLevel: targetLevel
        });
        
        // Update the portal ID input for next portal
        document.getElementById('portalId').value = `portal_${existingPortals + 2}`;
        
        this.saveState(); // Save state after placing portal
        this.render();
    }
    
    eraseAt(x, y) {
        const gridX = Math.floor(x / this.gridSize) * this.gridSize;
        const gridY = Math.floor(y / this.gridSize) * this.gridSize;
        
        // Remove floor segments at this position
        this.levelData.floors = this.levelData.floors.filter(floor => 
            !(floor.x <= gridX && floor.x + floor.width >= gridX + this.gridSize &&
              floor.y <= gridY && floor.y + floor.height >= gridY + this.gridSize)
        );
        
        // Remove vendors at this position
        this.levelData.vendors = this.levelData.vendors.filter(vendor => 
            !(vendor.x <= x && vendor.x + vendor.width >= x &&
              vendor.y <= y && vendor.y + vendor.height >= y)
        );
        
        // Remove spawners at this position
        this.levelData.spawners = this.levelData.spawners.filter(spawner => 
            !(spawner.x <= x && spawner.x + 32 >= x &&
              spawner.y <= y && spawner.y + 32 >= y)
        );
        
        // Remove portals at this position
        this.levelData.portals = this.levelData.portals.filter(portal => 
            !(portal.x <= x && portal.x + portal.width >= x &&
              portal.y <= y && portal.y + portal.height >= y)
        );
        
        this.saveState(); // Save state after erasing
        this.render();
    }
    
    addFloorSegment(x, y, width, height, material) {
        this.levelData.floors.push({
            x: x,
            y: y,
            width: width,
            height: height,
            material: material
        });
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        this.ctx.save();
        
        // Apply zoom and pan
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(this.panX / this.zoom, this.panY / this.zoom);
        
        // Draw floors
        this.levelData.floors.forEach(floor => {
            this.drawFloor(floor);
        });
        
        // Draw grid
        this.drawGrid();
        
        // Draw vendors
        this.levelData.vendors.forEach(vendor => {
            this.drawVendor(vendor);
        });
        
        // Draw spawners
        this.levelData.spawners.forEach(spawner => {
            this.drawSpawner(spawner);
        });
        
        // Draw portals
        this.levelData.portals.forEach(portal => {
            this.drawPortal(portal);
        });
        
        // Restore context
        this.ctx.restore();
        
        // Update object count
        const totalObjects = this.levelData.vendors.length + this.levelData.spawners.length + this.levelData.portals.length;
        document.getElementById('objectCount').textContent = `Vendors: ${this.levelData.vendors.length} | Spawners: ${this.levelData.spawners.length} | Portals: ${this.levelData.portals.length}`;
    }
    
    drawFloor(floor) {
        const material = this.materials[floor.material];
        this.ctx.fillStyle = material.color;
        this.ctx.fillRect(floor.x, floor.y, floor.width, floor.height);
        
        // Add texture pattern
        this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(floor.x, floor.y, floor.width, floor.height);
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawVendor(vendor) {
        // Check if this vendor is selected
        const isSelected = this.selectedObject && 
                          this.selectedObject.type === 'vendor' && 
                          this.selectedObject.data.id === vendor.id;
        
        // Vendor body
        this.ctx.fillStyle = isSelected ? '#FFE55C' : '#FFD700';
        this.ctx.fillRect(vendor.x, vendor.y, vendor.width, vendor.height);
        
        // Vendor border
        this.ctx.strokeStyle = isSelected ? '#FFD700' : '#FFA500';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(vendor.x, vendor.y, vendor.width, vendor.height);
        
        // Selection highlight
        if (isSelected) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(vendor.x - 2, vendor.y - 2, vendor.width + 4, vendor.height + 4);
            this.ctx.setLineDash([]);
        }
        
        // Vendor label
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('V', vendor.x + vendor.width/2, vendor.y + vendor.height/2 + 4);
        
        // Vendor ID
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(vendor.id, vendor.x + vendor.width/2, vendor.y - 5);
    }
    
    drawSpawner(spawner) {
        // Check if this spawner is selected
        const isSelected = this.selectedObject && 
                          this.selectedObject.type === 'spawner' && 
                          this.selectedObject.data.id === spawner.id;
        
        // Spawner body
        this.ctx.fillStyle = isSelected ? '#FF4444' : '#DC143C';
        this.ctx.fillRect(spawner.x, spawner.y, 32, 32);
        
        // Spawner border
        this.ctx.strokeStyle = isSelected ? '#FF8888' : '#FF6347';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(spawner.x, spawner.y, 32, 32);
        
        // Selection highlight
        if (isSelected) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(spawner.x - 2, spawner.y - 2, 36, 36);
            this.ctx.setLineDash([]);
        }
        
        // Spawner type
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(spawner.type.charAt(0).toUpperCase(), spawner.x + 16, spawner.y + 20);
        
        // Spawner ID
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '8px Arial';
        this.ctx.fillText(spawner.id, spawner.x + 16, spawner.y - 5);
        
        // Visibility range circle
        this.ctx.strokeStyle = isSelected ? 'rgba(255, 200, 200, 0.5)' : 'rgba(255, 100, 100, 0.3)';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.beginPath();
        this.ctx.arc(spawner.x + 16, spawner.y + 16, spawner.visibilityRange, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawPortal(portal) {
        // Check if this portal is selected
        const isSelected = this.selectedObject && 
                          this.selectedObject.type === 'portal' && 
                          this.selectedObject.data.id === portal.id;
        
        // Portal body (simplified version for editor)
        this.ctx.fillStyle = isSelected ? '#FFE55C' : '#8A2BE2';
        this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);
        
        // Portal border
        this.ctx.strokeStyle = isSelected ? '#FFD700' : '#9370DB';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);
        
        // Selection highlight
        if (isSelected) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(portal.x - 2, portal.y - 2, portal.width + 4, portal.height + 4);
            this.ctx.setLineDash([]);
        }
        
        // Portal label
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('P', portal.x + portal.width/2, portal.y + portal.height/2 + 4);
        
        // Portal ID
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(portal.id, portal.x + portal.width/2, portal.y - 5);
        
        // Target level
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '8px Arial';
        this.ctx.fillText(portal.targetLevel, portal.x + portal.width/2, portal.y + portal.height + 12);
    }
    
    drawErasePreview() {
        // Get current mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (this.lastMouseX - rect.left - this.panX) / this.zoom;
        const mouseY = (this.lastMouseY - rect.top - this.panY) / this.zoom;
        
        // Draw red X at mouse position
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(mouseX - 10, mouseY - 10);
        this.ctx.lineTo(mouseX + 10, mouseY + 10);
        this.ctx.moveTo(mouseX + 10, mouseY - 10);
        this.ctx.lineTo(mouseX - 10, mouseY + 10);
        this.ctx.stroke();
    }
    
    zoomIn() {
        this.zoom *= 1.2;
        this.zoom = Math.min(5, this.zoom);
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }
    
    zoomOut() {
        this.zoom *= 0.8;
        this.zoom = Math.max(0.1, this.zoom);
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }
    
    zoomReset() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        document.getElementById('zoomLevel').textContent = '100%';
        this.render();
    }
    
    saveLevel() {
        const levelName = prompt('Enter level name:', this.levelData.name);
        if (!levelName) return;
        
        this.levelData.name = levelName;
        this.levelData.lastModified = new Date().toISOString();
        
        const dataStr = JSON.stringify(this.levelData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${levelName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        link.click();
        
        console.log('Level saved:', this.levelData);
    }
    
    loadLevel() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.levelData = JSON.parse(e.target.result);
                    this.render();
                    console.log('Level loaded:', this.levelData);
                } catch (error) {
                    alert('Error loading level: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    clearLevel() {
        if (confirm('Are you sure you want to clear the entire level?')) {
            this.levelData = {
                name: 'Custom Level',
                width: 3600,
                height: 600,
                floors: [],
                vendors: [],
                spawners: [],
                portals: []
            };
            
            // Add default ground
            this.addFloorSegment(0, 550, 3600, 50, 'dirt');
            this.saveState(); // Save state after clearing
            this.render();
        }
    }
    
    // Undo system methods
    saveState() {
        // Create a deep copy of the current level data
        const state = JSON.parse(JSON.stringify(this.levelData));
        
        // Remove any states after current index (when undoing and then making new changes)
        this.changeBuffer = this.changeBuffer.slice(0, this.currentChangeIndex + 1);
        
        // Add new state
        this.changeBuffer.push(state);
        this.currentChangeIndex++;
        
        // Limit buffer size
        if (this.changeBuffer.length > this.maxUndoSteps) {
            this.changeBuffer.shift();
            this.currentChangeIndex--;
        }
        
        this.updateUndoUI();
    }
    
    undo() {
        if (this.currentChangeIndex > 0) {
            this.currentChangeIndex--;
            this.levelData = JSON.parse(JSON.stringify(this.changeBuffer[this.currentChangeIndex]));
            this.clearSelectedObjectUI();
            this.render();
            this.updateUndoUI();
            this.showUndoFeedback();
        }
    }
    
    updateUndoUI() {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.disabled = this.currentChangeIndex <= 0;
            undoBtn.title = this.currentChangeIndex > 0 ? 
                `Undo (${this.currentChangeIndex} steps available)` : 
                'No changes to undo';
        }
    }
    
    showUndoFeedback() {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.textContent = 'Undo applied';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(feedback);
        
        // Remove after 2 seconds
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }
}

// Initialize the level editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LevelEditor();
});
