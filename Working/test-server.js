console.log('Starting server test...');

try {
    console.log('Loading level loader...');
    const LevelLoader = require('./js/level-loader');
    console.log('Level loader loaded successfully');
    
    console.log('Creating level loader instance...');
    const levelLoader = new LevelLoader();
    console.log('Level loader instance created successfully');
    
    console.log('Loading default level...');
    const defaultLevel = levelLoader.loadLevel('sample_level');
    console.log('Default level loaded:', defaultLevel ? 'Yes' : 'No');
    
    console.log('Test completed successfully!');
} catch (error) {
    console.error('Test failed:', error);
}
