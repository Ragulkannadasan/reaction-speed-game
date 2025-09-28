
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

// --- Network & User State ---
const switches = [
    { id: 'S1', name: 'S1', x: 150, y: 200 },
    { id: 'S2', name: 'S2', x: 300, y: 100 },
    { id: 'S3', name: 'S3', x: 300, y: 300 },
    { id: 'S4', name: 'S4', x: 450, y: 100 },
    { id: 'S5', name: 'S5', x: 450, y: 300 },
];

const switchConnections = {
    'S1': ['S2', 'S3'],
    'S2': ['S1', 'S4', 'S5'],
    'S3': ['S1', 'S4'],
    'S4': ['S2', 'S3', 'S5'],
    'S5': ['S2', 'S4'],
};

const edgeStates = {};
for (const s1 in switchConnections) {
    for (const s2 of switchConnections[s1]) {
        const edgeKey = [s1, s2].sort().join('-');
        edgeStates[edgeKey] = 'free';
    }
}

let users = {}; // Store user data: { userId: { socketId, switchId } }
let pendingCalls = {}; // { receiverId: { callerId, path } }
let activeCircuits = []; // { id, callerId, receiverId, path }

// --- Helper Functions ---

function findPath(source, destination) {
    if (!source || !destination) return null;
    const queue = [[source, [source]]];
    const visited = new Set([source]);
    while (queue.length > 0) {
        const [current, path] = queue.shift();
        if (current === destination) return path;
        for (const neighbor of switchConnections[current]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([neighbor, [...path, neighbor]]);
            }
        }
    }
    return null;
}

function isPathFree(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i + 1]].sort().join('-');
        if (edgeStates[edgeKey] === 'occupied') return false;
    }
    return true;
}

function reservePath(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i + 1]].sort().join('-');
        edgeStates[edgeKey] = 'occupied';
    }
}

function releasePath(path) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = [path[i], path[i + 1]].sort().join('-');
        edgeStates[edgeKey] = 'free';
    }
}

function broadcastNetworkUpdate() {
    const connectedUsers = {};
    for (const userId in users) {
        connectedUsers[userId] = users[userId].switchId;
    }

    io.emit('network-update', {
        switches,
        switchConnections,
        edgeStates,
        activeCircuits,
        connectedUsers, // Send the user-to-switch mapping
    });
}


// --- Socket.IO Logic ---

io.on('connection', (socket) => {
    socket.on('register', (userId) => {
        const assignedSwitch = switches[Math.floor(Math.random() * switches.length)].id;
        users[userId] = { socketId: socket.id, switchId: assignedSwitch };
        socket.emit('registered', { userId, switchId: assignedSwitch });
        console.log(`User ${userId} registered, connected to ${assignedSwitch}`);
        broadcastNetworkUpdate();
    });

    socket.on('call-user', ({ callerId, receiverId }) => {
        if (!users[receiverId]) {
            return socket.emit('call-failed', { message: `User ${receiverId} is not online.` });
        }

        const caller = users[callerId];
        const receiver = users[receiverId];
        const path = findPath(caller.switchId, receiver.switchId);

        if (path && isPathFree(path)) {
            pendingCalls[receiverId] = { callerId, path };
            io.to(receiver.socketId).emit('incoming-call', { callerId });
        } else {
            socket.emit('call-failed', { message: 'No free path to the destination.' });
        }
    });

    socket.on('call-accepted', ({ callerId, receiverId }) => {
        const pending = pendingCalls[receiverId];
        if (!pending || pending.callerId !== callerId) return; // Stale acceptance
        
        const { path } = pending;
        if (isPathFree(path)) {
            reservePath(path);
            const newCircuit = { id: uuidv4(), callerId, receiverId, path };
            activeCircuits.push(newCircuit);
            delete pendingCalls[receiverId];

            const callerSocket = users[callerId]?.socketId;
            const receiverSocket = users[receiverId]?.socketId;
            if (callerSocket) io.to(callerSocket).emit('call-established', newCircuit);
            if (receiverSocket) io.to(receiverSocket).emit('call-established', newCircuit);

            broadcastNetworkUpdate();
        } else {
             const callerSocket = users[callerId]?.socketId;
            if(callerSocket) io.to(callerSocket).emit('call-failed', { message: 'Path became busy. Please try again.' });
        }
    });

    socket.on('call-rejected', ({ callerId, receiverId }) => {
        delete pendingCalls[receiverId];
        const callerSocket = users[callerId]?.socketId;
        if (callerSocket) {
            io.to(callerSocket).emit('call-rejected', { receiverId });
        }
    });

    socket.on('end-call', ({ circuitId }) => {
        const circuitIndex = activeCircuits.findIndex(c => c.id === circuitId);
        if (circuitIndex > -1) {
            const circuit = activeCircuits[circuitIndex];
            releasePath(circuit.path);
            activeCircuits.splice(circuitIndex, 1);

            const callerSocket = users[circuit.callerId]?.socketId;
            const receiverSocket = users[circuit.receiverId]?.socketId;

            if(callerSocket) io.to(callerSocket).emit('call-ended', { message: 'The call has been terminated.' });
            if(receiverSocket) io.to(receiverSocket).emit('call-ended', { message: 'The call has been terminated.' });

            broadcastNetworkUpdate();
        }
    });

    socket.on('disconnect', () => {
        const userId = Object.keys(users).find(key => users[key].socketId === socket.id);
        if (userId) {
            // End any active calls for this user
            const userCircuit = activeCircuits.find(c => c.callerId === userId || c.receiverId === userId);
            if(userCircuit) {
                 const circuitIndex = activeCircuits.findIndex(c => c.id === userCircuit.id);
                 const circuit = activeCircuits[circuitIndex];
                 releasePath(circuit.path);
                 activeCircuits.splice(circuitIndex, 1);
                 const otherUserId = circuit.callerId === userId ? circuit.receiverId : circuit.callerId;
                 const otherUserSocket = users[otherUserId]?.socketId;
                 if(otherUserSocket) io.to(otherUserSocket).emit('call-ended', { message: `User ${userId} disconnected.` });
            }

            delete users[userId];
            console.log(`User ${userId} disconnected.`);
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
