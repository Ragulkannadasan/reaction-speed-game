const socket = io();

// UI Elements
const userIdDisplay = document.getElementById('user-id-display');
const switchIdDisplay = document.getElementById('switch-id-display');
const receiverIdInput = document.getElementById('receiver-id-input');
const callBtn = document.getElementById('call-btn');
const activeCallDisplay = document.getElementById('active-call-display');
const statusLog = document.getElementById('status-log');
const onlineUsersList = document.getElementById('online-users-list');

// Popup Elements
const incomingCallPopup = document.getElementById('incoming-call-popup');
const incomingCallFrom = document.getElementById('incoming-call-from');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

// Canvas and network state
let canvas, ctx;
let switches = [];
let switchConnections = {};
let edgeStates = {};
let activeCircuits = [];
let connectedUsers = {}; // { userId: switchId }

// User state
let myUserId = localStorage.getItem('tel-userId');
let mySwitchId = localStorage.getItem('tel-switchId');
let pendingCallerId = null;

// --- Initialization and User Setup ---

function init() {
    initCanvas();
    if (!myUserId) {
        myUserId = `U${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('tel-userId', myUserId);
    }
    socket.emit('register', myUserId);

    userIdDisplay.textContent = `Your ID: ${myUserId}`;

    setupEventListeners();
}

function initCanvas() {
    canvas = document.getElementById('network-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = 800; 
    canvas.height = 500;
}

function setupEventListeners() {
    callBtn.addEventListener('click', () => {
        const receiverId = receiverIdInput.value.trim();
        if (receiverId && receiverId !== myUserId) {
            logStatus(`Calling ${receiverId}...`, 'cyan');
            socket.emit('call-user', { callerId: myUserId, receiverId });
        }
    });

    acceptCallBtn.addEventListener('click', () => {
        if (pendingCallerId) {
            socket.emit('call-accepted', { callerId: pendingCallerId, receiverId: myUserId });
            incomingCallPopup.style.display = 'none';
        }
    });

    rejectCallBtn.addEventListener('click', () => {
        if (pendingCallerId) {
            socket.emit('call-rejected', { callerId: pendingCallerId, receiverId: myUserId });
            incomingCallPopup.style.display = 'none';
        }
    });
}

// --- Drawing Functions ---

function getUserNodePosition(userId, switchId) {
    const s = switches.find(s => s.id === switchId);
    if (!s) return { x: 0, y: 0 };

    // Create a deterministic but unique-ish offset for each user
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const angle = (hash % 12) * 30 * (Math.PI / 180);
    const x = s.x + 60 * Math.cos(angle);
    const y = s.y + 60 * Math.sin(angle);
    return { x, y };
}

function isEdgeInPath(path, s1, s2) {
    for (let i = 0; i < path.length - 1; i++) {
        if ((path[i] === s1 && path[i+1] === s2) || (path[i] === s2 && path[i+1] === s1)) {
            return true;
        }
    }
    return false;
}

function drawNetwork() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get the active circuit for the current user to highlight the full path
    const myActiveCircuit = activeCircuits.find(c => c.callerId === myUserId || c.receiverId === myUserId);

    // Draw switch-to-switch edges
    for (const s1 in switchConnections) {
        for (const s2 of switchConnections[s1]) {
            if (s1 < s2) {
                const start = switches.find(s => s.id === s1);
                const end = switches.find(s => s.id === s2);
                if (start && end) {
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    
                    const isEdgeInActivePath = myActiveCircuit && isEdgeInPath(myActiveCircuit.path, s1, s2);
                    ctx.strokeStyle = isEdgeInActivePath ? '#28a745' : '#555';
                    ctx.lineWidth = isEdgeInActivePath ? 3 : 2;
                    ctx.stroke();
                }
            }
        }
    }
    
    // Draw users and their connections to switches
    for (const userId in connectedUsers) {
        const switchId = connectedUsers[userId];
        const userPos = getUserNodePosition(userId, switchId);
        const switchPos = switches.find(s => s.id === switchId);

        if (switchPos) {
             // Draw line from user to switch
            ctx.beginPath();
            ctx.moveTo(userPos.x, userPos.y);
            ctx.lineTo(switchPos.x, switchPos.y);
            const isUserInActiveCall = myActiveCircuit && 
                ((myActiveCircuit.callerId === userId && myActiveCircuit.path[0] === switchId) || 
                 (myActiveCircuit.receiverId === userId && myActiveCircuit.path[myActiveCircuit.path.length - 1] === switchId));
            ctx.strokeStyle = isUserInActiveCall ? '#28a745' : '#aaa';
            ctx.lineWidth = isUserInActiveCall ? 3 : 1;
            ctx.setLineDash(isUserInActiveCall ? [] : [5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw user node (phone icon)
            ctx.fillStyle = userId === myUserId ? '#ffc107' : '#17a2b8';
            ctx.fillRect(userPos.x - 15, userPos.y - 10, 30, 20); 
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(userId, userPos.x, userPos.y + 20);
        }
    }

    // Draw switches on top
    switches.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#007bff';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.name, s.x, s.y);
    });
}


// --- UI Update Functions ---

function logStatus(message, color) {
    const li = document.createElement('li');
    li.textContent = message;
    li.style.color = color;
    statusLog.insertBefore(li, statusLog.firstChild);
}

function updateActiveCallDisplay() {
    const myActiveCircuit = activeCircuits.find(c => c.callerId === myUserId || c.receiverId === myUserId);
    if (myActiveCircuit) {
        const otherUser = myActiveCircuit.callerId === myUserId ? myActiveCircuit.receiverId : myActiveCircuit.callerId;
        const fullPath = [myActiveCircuit.callerId, ...myActiveCircuit.path, myActiveCircuit.receiverId].join(' -> ');
        activeCallDisplay.innerHTML = `
            <p>In call with: <strong>${otherUser}</strong></p>
            <p>Path: ${fullPath}</p>
            <button id="end-call-btn">End Call</button>
        `;
        document.getElementById('end-call-btn').addEventListener('click', () => {
            socket.emit('end-call', { circuitId: myActiveCircuit.id });
        });
    } else {
        activeCallDisplay.innerHTML = 'No active call.';
    }
}

function updateOnlineUsers() {
    onlineUsersList.innerHTML = '';
    for (const userId in connectedUsers) {
        const li = document.createElement('li');
        li.textContent = userId === myUserId ? `${userId} (You)` : userId;
        onlineUsersList.appendChild(li);
    }
}

// --- Socket Handlers ---

socket.on('registered', ({ userId, switchId }) => {
    mySwitchId = switchId;
    localStorage.setItem('tel-switchId', mySwitchId);
    switchIdDisplay.textContent = `Connected to Switch: ${mySwitchId}`;
    logStatus(`Successfully registered with switch ${mySwitchId}`, 'lime');
});

socket.on('network-update', (data) => {
    switches = data.switches;
    switchConnections = data.switchConnections;
    edgeStates = data.edgeStates;
    activeCircuits = data.activeCircuits;
    connectedUsers = data.connectedUsers;
    
    drawNetwork();
    updateActiveCallDisplay();
    updateOnlineUsers();
});

socket.on('incoming-call', ({ callerId }) => {
    pendingCallerId = callerId;
    incomingCallFrom.textContent = `Incoming Call from ${callerId}`;
    incomingCallPopup.style.display = 'flex';
});

socket.on('call-established', (circuit) => {
    logStatus(`Call established with ${circuit.callerId === myUserId ? circuit.receiverId : circuit.callerId}`, 'green');
});

socket.on('call-failed', ({ message }) => {
    logStatus(`Call failed: ${message}`, 'red');
});

socket.on('call-rejected', ({ receiverId }) => {
    logStatus(`Call to ${receiverId} was rejected.`, 'orange');
});

socket.on('call-ended', ({ message }) => {
    logStatus(message, 'gray');
});

// --- Start the App ---

init();
