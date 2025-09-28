const socket = io();

// UI Elements
const sourceSelect = document.getElementById('source-select');
const destinationSelect = document.getElementById('destination-select');
const establishCallBtn = document.getElementById('establish-call-btn');
const activeCircuitsList = document.getElementById('active-circuits-list');
const statusLog = document.getElementById('status-log');

// Canvas and network state
let canvas, ctx;
let switches = [];
let switchConnections = {};
let edgeStates = {};
let activeCircuits = [];

function initCanvas() {
    canvas = document.getElementById('network-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;
}

function drawNetwork() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    for (const s1 in switchConnections) {
        for (const s2 of switchConnections[s1]) {
            if (s1 < s2) { // Avoid drawing edges twice
                const startSwitch = switches.find(s => s.id === s1);
                const endSwitch = switches.find(s => s.id === s2);
                if (startSwitch && endSwitch) {
                    const edgeKey = [s1, s2].sort().join('-');
                    const state = edgeStates[edgeKey];
                    
                    ctx.beginPath();
                    ctx.moveTo(startSwitch.x, startSwitch.y);
                    ctx.lineTo(endSwitch.x, endSwitch.y);
                    
                    if (state === 'occupied') {
                        ctx.strokeStyle = '#28a745'; // Green
                        ctx.lineWidth = 3;
                    } else {
                        ctx.strokeStyle = '#ccc'; // Gray
                        ctx.lineWidth = 1;
                    }
                    ctx.stroke();
                }
            }
        }
    }

    // Draw switches
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

function updateUI() {
    // Populate dropdowns
    if (sourceSelect.options.length === 0 && switches.length > 0) {
        switches.forEach(s => {
            const option1 = document.createElement('option');
            option1.value = s.id;
            option1.textContent = s.name;
            sourceSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = s.id;
            option2.textContent = s.name;
            destinationSelect.appendChild(option2);
        });
    }

    // Update active circuits list
    activeCircuitsList.innerHTML = '';
    activeCircuits.forEach(circuit => {
        const li = document.createElement('li');
        li.textContent = `${circuit.source} → ${circuit.destination} (Path: ${circuit.path.join('-')})`;
        const releaseBtn = document.createElement('button');
        releaseBtn.textContent = 'Release';
        releaseBtn.onclick = () => {
            socket.emit('release-call', { circuitId: circuit.id });
        };
        li.appendChild(releaseBtn);
        activeCircuitsList.appendChild(li);
    });
}

function logStatus(message, color) {
    const li = document.createElement('li');
    li.textContent = message;
    li.style.color = color;
    statusLog.insertBefore(li, statusLog.firstChild);
}

// --- Event Listeners ---

establishCallBtn.addEventListener('click', () => {
    const source = sourceSelect.value;
    const destination = destinationSelect.value;
    if (source && destination && source !== destination) {
        socket.emit('establish-call', { source, destination });
    }
});


// --- Socket Handlers ---

socket.on('network-update', (data) => {
    switches = data.switches;
    switchConnections = data.switchConnections;
    edgeStates = data.edgeStates;
    activeCircuits = data.activeCircuits;

    drawNetwork();
    updateUI();
});

socket.on('call-established', ({ source, destination, path }) => {
    logStatus(`Call ${source} → ${destination} established via ${path.join('-')}`, 'green');
});

socket.on('call-blocked', ({ source, destination }) => {
    logStatus(`Call ${source} → ${destination} blocked (no free path)`, 'red');
});

// --- Initialization ---

initCanvas();
