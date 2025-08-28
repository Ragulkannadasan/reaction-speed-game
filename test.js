const http = require('http');

// Simple test to check if server starts correctly
const testServer = () => {
    console.log('Testing Brain Reaction Game Server...');
    
    // Test server startup
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        console.log(`✅ Server responded with status: ${res.statusCode}`);
        if (res.statusCode === 200) {
            console.log('✅ Game server is running successfully!');
            console.log('🎮 Open http://localhost:3000 in your browser to play');
        }
    });
    
    req.on('error', (e) => {
        console.log('❌ Server not running:', e.message);
        console.log('💡 Start the server with: npm start');
    });
    
    req.setTimeout(5000, () => {
        console.log('❌ Connection timeout - server may not be running');
        req.destroy();
    });
    
    req.end();
};

// Test API endpoints
const testAPI = () => {
    console.log('\nTesting API endpoints...');
    
    // Test users endpoint
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/users',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`✅ Users API responded with status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                console.log('✅ API endpoints working correctly!');
            }
        });
    });
    
    req.on('error', () => {
        console.log('❌ API test failed - server not running');
    });
    
    req.end();
};

// Run tests after a delay to allow server startup
setTimeout(() => {
    testServer();
    setTimeout(testAPI, 1000);
}, 2000);

console.log('🔄 Starting tests in 2 seconds...');