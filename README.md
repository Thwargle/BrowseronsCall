# Browseron's Call - Multiplayer Game

A comprehensive multiplayer 2D RPG game built with Node.js, WebSockets, and HTML5 Canvas. Features real-time multiplayer gameplay, inventory management, equipment systems, and server-authoritative game mechanics.

## Features

### Core Gameplay
- **Real-time Multiplayer**: WebSocket-based networking for smooth multiplayer experience
- **2D Platformer**: Jump, move, and explore a wide world with multiple platforms
- **Combat System**: Attack enemies with weapons and armor that provide stat bonuses
- **Inventory Management**: 12-slot bag system with drag-and-drop functionality
- **Equipment System**: Paper doll interface with 12 equipment slots (head, chest, hands, etc.)
- **Item System**: Weapons, armor, and currency with rarity levels (Common to Legendary)

### Multiplayer Features
- **Server Authority**: All critical game logic runs on the server for fair gameplay
- **Player Persistence**: Equipment and inventory saved between sessions
- **Real-time Synchronization**: Player positions, health, and equipment updates
- **Chat System**: In-game communication between players
- **Player Reconnection**: Seamless reconnection with preserved character data

### Technical Features
- **Responsive Design**: UI adapts to various screen sizes and resolutions
- **Canvas Rendering**: Smooth 60 FPS gameplay with optimized rendering
- **WebSocket Communication**: Real-time client-server communication
- **HTTPS Support**: Secure connections with auto-generated certificates
- **Cross-platform**: Works on Windows, Mac, and Linux

## Architecture

### Server (`Working/js/server.js`)
- **Game State Management**: Centralized management of players, enemies, and world state
- **WebSocket Server**: Handles client connections and message routing
- **Enemy AI**: Server-controlled enemy spawning, movement, and combat
- **Loot System**: Configurable drop tables for different enemy types
- **Player Persistence**: Stores and restores player data on disconnect/reconnect

### Client Components
- **Network Layer** (`Working/js/network.js`): WebSocket communication and reconnection logic
- **Game Engine** (`Working/js/engine.js`): Rendering, input handling, and game loop
- **UI Management** (`Working/js/ui.js`): Inventory, tooltips, and drag-and-drop
- **Game Logic** (`Working/js/methods.js`): Item generation, physics, and entity classes

### Key Systems
- **Inventory System**: Drag-and-drop between bag, equipment, and world
- **Equipment Rendering**: Visual representation of equipped items on character
- **Tooltip System**: Detailed item information display
- **Physics Engine**: Gravity, collision detection, and movement
- **Animation System**: Procedural sprite generation and frame-based animation

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd BrowseronsCall
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the game:**
   - Open your browser and go to: `http://localhost:8081`
   - Enter a unique player name and connect

### Development Mode
```bash
npm run dev
```
Runs with nodemon for automatic server restart on file changes.

## Game Controls

### Movement
- **W**: Jump
- **A**: Move left
- **D**: Move right
- **E**: Attack

### Inventory
- **Double-click**: Equip/unequip items
- **Drag & Drop**: Move items between slots
- **Right-click**: Drop items to world
- **Drag to Canvas**: Drop items to world

### Other
- **F**: Open shop (when near vendor)
- **Enter**: Focus chat input
- **Escape**: Various UI actions

## Multiplayer Setup

### Local Network (LAN)
1. Start the server on your computer
2. Other players connect using your IP address: `http://YOUR_IP:8081`
3. Find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### Internet (Public)
1. **Port Forwarding**: Forward port 8081 on your router
2. **Firewall**: Allow Node.js through Windows Firewall
3. **Dynamic DNS**: Use a service like No-IP for changing IP addresses

### Alternative: ngrok
```bash
npm install -g ngrok
ngrok http 8081
```
Share the ngrok URL with other players.

## Configuration

### Server Settings
- **Port**: 8081 (configurable via `HTTP_PORT` environment variable)
- **HTTPS Port**: 8443 (configurable via `HTTPS_PORT` environment variable)
- **Host**: 0.0.0.0 (binds to all network interfaces)

### Game Settings
- **World Width**: 3600 pixels
- **Ground Level**: 550 pixels
- **Enemy Spawn Rate**: 8 seconds per spawner
- **Physics Update Rate**: 60 FPS

### Loot Tables
```javascript
LOOT_TABLES = {
    basic: {
        currency: { chance: 0.4, amount: [5, 15] },
        weapon: { chance: 0.35, level: [1, 3] },
        armor: { chance: 0.25, level: [1, 2] }
    },
    elite: {
        currency: { chance: 0.3, amount: [15, 30] },
        weapon: { chance: 0.4, level: [2, 5] },
        armor: { chance: 0.3, level: [2, 4] }
    },
    boss: {
        currency: { chance: 0.2, amount: [30, 60] },
        weapon: { chance: 0.5, level: [4, 8] },
        armor: { chance: 0.3, level: [4, 6] }
    }
}
```

## Troubleshooting

### Common Issues

1. **Port Already in Use:**
   ```bash
   # Find and kill existing process
   netstat -ano | findstr :8081
   taskkill /PID <PID> /F
   ```

2. **Firewall Blocking Connections:**
   - Allow Node.js through Windows Firewall
   - Check router port forwarding settings

3. **Players Can't Connect:**
   - Verify server is running on port 8081
   - Check IP address and port
   - Ensure firewall/router allows connections

4. **Game Performance Issues:**
   - Check browser console for errors
   - Ensure hardware acceleration is enabled
   - Close other browser tabs/applications

### Getting Your IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your network adapter.

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```

## Development

### Project Structure
```
├── Working/
│   ├── Index.html          # Main game interface
│   └── js/
│       ├── server.js       # Main server logic
│       ├── network.js      # Client networking
│       ├── engine.js       # Game engine and rendering
│       ├── ui.js          # User interface management
│       └── methods.js     # Helper functions and classes
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

### Key Development Concepts

1. **Server Authority**: All critical game logic runs on the server
2. **Message Broadcasting**: Changes are broadcast to all connected clients
3. **Item Normalization**: Consistent item structures across client and server
4. **Real-time Synchronization**: Continuous updates for smooth multiplayer experience
5. **State Management**: Centralized game state with client-side rendering

### Adding New Features
- Add new message types in the `ws.on('message')` handler in `server.js`
- Implement corresponding client-side handlers in `network.js`
- Update the game state structure as needed
- Ensure proper broadcasting of state changes

### Code Style
- **Consistent Naming**: All functions use camelCase, prefixed with `window.` when global
- **Error Handling**: Try-catch blocks around critical operations
- **Logging**: Use `window.log()` for game messages, `console.log` for debugging
- **Modularity**: Each file has a specific responsibility and clear interface

## Performance Considerations

- **Server Loop**: 60 FPS update rate for smooth gameplay
- **Message Optimization**: Only send necessary data updates
- **Client Rendering**: Local rendering with server validation
- **Memory Management**: Proper cleanup of disconnected players and dead entities
- **Canvas Optimization**: Efficient rendering with proper context management

## Recent Improvements

### Code Quality
- **Refactored Functions**: Consistent naming and scope across all files
- **Removed Duplicate Code**: Eliminated redundant functions and variables
- **Improved Error Handling**: Better try-catch blocks and validation
- **Cleaner Logging**: Reduced verbose logging, focused on important messages

### Bug Fixes
- **Inventory Persistence**: Fixed issues with equipment not saving between sessions
- **Canvas Rendering**: Resolved world rendering inconsistencies
- **Drag and Drop**: Improved item movement between inventory and equipment
- **Player Reconnection**: Better handling of disconnects and reconnects

### UI Improvements
- **Responsive Design**: UI adapts to various screen sizes
- **Better Tooltips**: Improved item information display
- **Consistent Styling**: Unified visual appearance across all elements

## License

MIT License - feel free to modify and distribute!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check server logs for connection issues
4. Create an issue in the repository with detailed information
