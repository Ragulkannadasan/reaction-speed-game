const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// --- Network State ---
const users = new Map();
const calls = new Map(); // Use a map for easier management

// Static definition of switches
const switches = [
    { id: 'switch-1', name: 'Switch 1', x: 200, y: 300 },
    { id: 'switch-2', name: 'Switch 2', x: 350, y: 150 },
    { id: 'switch-3', name: 'Switch 3', x: 400, y: 500 },
    { id: 'switch-4', name: 'Switch 4', x: 550, y: 250 },
    { id: 'switch-5', name: 'Switch 5', x: 650, y: 400 },
    { id: 'switch-6', name: 'Switch 6', x: 300, y: 600 },
    { id: 'switch-7', name: 'Switch 7', x: 500, y: 50 },
];

// Define the connections between switches (Adjacency List)
const switchConnections = {
    'switch-1': ['switch-2', 'switch-3', 'switch-6'],
    'switch-2': ['switch-1', 'switch-7', 'switch-4'],
    'switch-3': ['switch-1', 'switch-6', 'switch-5'],
    'switch-4': ['switch-2', 'switch-5', 'switch-7'],
    'switch-5': ['switch-3', 'switch-4', 'switch-6'],
    'switch-6': ['switch-1', 'switch-3', 'switch-5'],
    'switch-7': ['switch-2', 'switch-4']
};


// --- Helper Functions ---

function findClosestSwitch(user, allSwitches) {
    let closestSwitch = null;
    let minDistance = Infinity;
    for (const s of allSwitches) {
        const distance = Math.sqrt(Math.pow(user.x - s.x, 2) + Math.pow(user.y - s.y, 2));
        if (distance < minDistance) {
            minDistance = distance;
            closestSwitch = s;
        }
    }
    return closestSwitch;
}

function findPath(startSwitchId, endSwitchId, connections) {
    const queue = [[startSwitchId, [startSwitchId]]]; // Queue stores [currentSwitchId, pathArray]
    const visited = new Set([startSwitchId]);

    while (queue.length > 0) {
        const [currentSwitchId, path] = queue.shift();

        if (currentSwitchId === endSwitchId) {
            return path; // Path found
        }

        const neighbors = connections[currentSwitchId] || [];
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                const newPath = [...path, neighborId];
                queue.push([neighborId, newPath]);
            }
        }
    }
    return null; // No path found
}


function broadcastNetworkUpdate() {
    const networkState = {
        users: Array.from(users.values()),
        switches: switches,
        calls: Array.from(calls.values())
    };
    io.emit('network-update', networkState);
}

// --- Socket.IO Logic ---

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Automatically create a new user on connection
    const userId = uuidv4();
    const username = `User-${socket.id.substring(0, 4)}`;
    const newUser = {
        id: userId,
        socketId: socket.id,
        username,
        x: Math.floor(Math.random() * 800) + 50,
        y: Math.floor(Math.random() * 600) + 50,
    };
    users.set(userId, newUser);
    socket.userId = userId;

    socket.emit('login-success', newUser);
    broadcastNetworkUpdate();

    socket.on('initiate-call', ({ callerId, calleeId }) => {
        const caller = users.get(callerId);
        const callee = users.get(calleeId);

        if (!caller || !callee) {
            console.error("Caller or callee not found for call initiation");
            return; // Exit if users don't exist
        }

        const callerSwitch = findClosestSwitch(caller, switches);
        const calleeSwitch = findClosestSwitch(callee, switches);

        if (!callerSwitch || !calleeSwitch) {
            console.error("Could not find a switch for caller or callee");
            return; // Exit if switches aren't found
        }

        const path = findPath(callerSwitch.id, calleeSwitch.id, switchConnections);

        if (path) {
            const callId = uuidv4();
            const newCall = {
                id: callId,
                callerId,
                calleeId,
                path, // Array of switch IDs
            };
            calls.set(callId, newCall);
            console.log(`Call initiated via path: ${path.join(' -> ')}`);
            broadcastNetworkUpdate(); // Broadcast the new state and exit
            return;
        } else {
            console.log(`No path found between ${callerSwitch.id} and ${calleeSwitch.id}`);
            // No broadcast needed, as no state changed
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.userId) {
            users.delete(socket.userId);
            
            const callsToRemove = [];
            for (const [callId, call] of calls.entries()) {
                if (call.callerId === socket.userId || call.calleeId === socket.userId) {
                    callsToRemove.push(callId);
                }
            }
            callsToRemove.forEach(id => calls.delete(id));

            broadcastNetworkUpdate();
        }
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});