
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// --- Network State ---

// 1. Model the network as a graph (adjacency list)
const switches = [
    { id: 'S1', name: 'S1', x: 100, y: 200 },
    { id: 'S2', name: 'S2', x: 300, y: 100 },
    { id: 'S3', name: 'S3', x: 300, y: 300 },
    { id: 'S4', name: 'S4', x: 500, y: 100 },
    { id: 'S5', name: 'S5', x: 500, y: 300 },
    { id: 'S6', name: 'S6', x: 200, y: 400 },
    { id: 'S7', name: 'S7', x: 400, y: 200 },
];

const switchConnections = {
    'S1': ['S2', 'S3'],
    'S2': ['S1', 'S4', 'S5', 'S7'],
    'S3': ['S1', 'S4', 'S6'],
    'S4': ['S2', 'S3', 'S5', 'S7'],
    'S5': ['S2', 'S4', 'S6'],
    'S6': ['S3', 'S5'],
    'S7': ['S2', 'S4'],
};


// Edge state: free or occupied
const edgeStates = {};
for (const s1 in switchConnections) {
    for (const s2 of switchConnections[s1]) {
        // Use a consistent key for each edge pair
        const edgeKey = [s1, s2].sort().join('-');
        edgeStates[edgeKey] = 'free';
    }
}

let activeCircuits = [];

// --- Helper Functions ---

// BFS to find a path
function findPath(source, destination) {
    const queue = [[source, [source]]];
    const visited = new Set([source]);

    while (queue.length > 0) {
        const [current, path] = queue.shift();

        if (current === destination) {
            return path;
        }

        for (const neighbor of switchConnections[current]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newPath = [...path, neighbor];
                queue.push([neighbor, newPath]);
            }
        }
    }
    return null;
}

function isPathFree(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i+1]].sort().join('-');
        if (edgeStates[edgeKey] === 'occupied') {
            return false;
        }
    }
    return true;
}

function reservePath(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i+1]].sort().join('-');
        edgeStates[edgeKey] = 'occupied';
    }
}

function releasePath(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i+1]].sort().join('-');
        edgeStates[edgeKey] = 'free';
    }
}


function broadcastNetworkUpdate() {
    const networkState = {
        switches,
        switchConnections,
        edgeStates,
        activeCircuits
    };
    io.emit('network-update', networkState);
}


// --- Socket.IO Logic ---

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send initial state
    broadcastNetworkUpdate();

    socket.on('establish-call', ({ source, destination }) => {
        const path = findPath(source, destination);

        if (path && isPathFree(path)) {
            reservePath(path);
            const newCircuit = { id: uuidv4(), source, destination, path };
            activeCircuits.push(newCircuit);
            
            socket.emit('call-established', { source, destination, path });
            broadcastNetworkUpdate();
        } else {
            socket.emit('call-blocked', { source, destination });
        }
    });

    socket.on('release-call', ({ circuitId }) => {
        const circuitIndex = activeCircuits.findIndex(c => c.id === circuitId);
        if (circuitIndex > -1) {
            const circuit = activeCircuits[circuitIndex];
            releasePath(circuit.path);
            activeCircuits.splice(circuitIndex, 1);
            broadcastNetworkUpdate();
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
