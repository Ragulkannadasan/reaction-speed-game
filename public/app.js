const socket = io();

// UI Elements
const mainContainer = document.getElementById('main-container');
const userNameElement = document.getElementById('current-user-name');
const calleeSelect = document.getElementById('callee-select');
const initiateCallBtn = document.getElementById('initiate-call-btn');
const onlineUsersList = document.getElementById('online-users-list');

// Canvas and network state
let canvas, ctx;
let currentUser = null;
let users = [];
let switches = [];
let calls = [];


// --- Event Listeners ---

initiateCallBtn.addEventListener('click', () => {
    const calleeId = calleeSelect.value;
    if (calleeId && currentUser) {
        socket.emit('initiate-call', { callerId: currentUser.id, calleeId });
    }
});


// --- Socket Handlers ---

socket.on('login-success', (user) => {
    currentUser = user;
    userNameElement.textContent = user.username;
    initCanvas();
});

socket.on('network-update', (data) => {
    users = data.users;
    switches = data.switches;
    calls = data.calls;

    updateUsersUI();
    drawNetwork();
});

// --- Functions ---

function initCanvas() {
    canvas = document.getElementById('network-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 700;
}


function updateUsersUI() {
    if (!currentUser) return; 

    onlineUsersList.innerHTML = '';
    users.forEach(user => {
        if (user.id !== currentUser.id) {
            const li = document.createElement('li');
            li.textContent = user.username;
            onlineUsersList.appendChild(li);
        }
    });

    calleeSelect.innerHTML = '<option value="">Select User</option>';
    users.forEach(user => {
        if (user.id !== currentUser.id) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            calleeSelect.appendChild(option);
        }
    });
}

function drawNetwork() {
    if (!ctx || !currentUser) return; 

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw switches
    switches.forEach(s => {
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(s.x, s.y, 40, 20);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(s.name, s.x + 20, s.y + 35);
    });

    // Draw users
    users.forEach(user => {
        ctx.fillStyle = user.id === currentUser.id ? '#007bff' : '#28a745';
        ctx.beginPath();
        ctx.arc(user.x, user.y, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(user.username, user.x, user.y - 20);
    });

    // --- RADICALLY SIMPLIFIED DRAWING LOGIC ---
    if (calls.length > 0) {
        console.log(`CLIENT: Attempting to draw ${calls.length} calls.`);
    }

    calls.forEach(call => {
        const caller = users.find(u => u.id === call.callerId);
        const callee = users.find(u => u.id === call.calleeId);

        if (!caller || !callee) {
            console.error("CLIENT: Cannot draw call. Could not find caller or callee in users array.");
            return;
        }

        console.log("CLIENT: Found caller and callee. Drawing a direct, solid line.");

        ctx.save();
        ctx.beginPath();

        ctx.strokeStyle = '#FF00FF'; // Bright pink
        ctx.lineWidth = 5;         // Very thick
        ctx.setLineDash([]);       // Solid line

        ctx.moveTo(caller.x, caller.y);
        ctx.lineTo(callee.x, callee.y);

        ctx.stroke();
        ctx.restore();
    });
}
