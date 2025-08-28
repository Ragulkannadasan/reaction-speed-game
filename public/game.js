class BrainReactionGameRoom {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.gameStartTime = null;
        this.colorChangeTime = null;
        this.isGameActive = false;
        
        this.init();
    }
    
    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.connectToServer();
        
        // Start with lobby screen
        this.showScreen('game-lobby-screen');
    }
    
    loadUserData() {
        // Get user data from URL parameters or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        const userToken = localStorage.getItem('userToken');
        
        if (!userToken) {
            // Redirect back to main page if no token
            window.location.href = '/';
            return;
        }
        
        try {
            // Decode JWT to get user info
            const payload = JSON.parse(atob(userToken.split('.')[1]));
            this.currentUser = {
                userId: payload.userId,
                username: payload.username,
                token: userToken
            };
            
            this.currentRoom = roomId;
            document.getElementById('current-username').textContent = this.currentUser.username;
        } catch (error) {
            console.error('Failed to load user data:', error);
            window.location.href = '/';
        }
    }
    
    setupEventListeners() {
        // Lobby controls
        document.getElementById('ready-btn').addEventListener('click', () => this.toggleReady());
        document.getElementById('leave-lobby-btn').addEventListener('click', () => this.leaveLobby());
        
        // Game controls
        document.getElementById('reaction-btn').addEventListener('click', () => this.handleReactionClick());
        document.getElementById('forfeit-btn').addEventListener('click', () => this.forfeitGame());
        
        // Result screen controls
        document.getElementById('play-again-btn').addEventListener('click', () => this.playAgain());
        document.getElementById('back-to-main-btn').addEventListener('click', () => this.backToMainMenu());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.backToMainMenu());
        
        // Keyboard controls for game
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' && this.isGameActive) {
                this.handleReactionClick();
            }
        });
        
        // Handle browser back button
        window.addEventListener('beforeunload', () => {
            if (this.currentRoom) {
                this.socket.emit('leave-room', { roomId: this.currentRoom });
            }
        });
    }
    
    connectToServer() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected to server', 'connected');
            
            // Join the room if we have one
            if (this.currentRoom && this.currentUser) {
                this.socket.emit('join-room', {
                    roomId: this.currentRoom,
                    user: this.currentUser
                });
            }
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected from server', 'disconnected');
        });
        
        this.socket.on('room-joined', (data) => {
            this.currentRoom = data.roomId;
            this.showGameLobby(data.players);
        });
        
        this.socket.on('player-ready-update', (data) => {
            this.updateLobbyStatus(data);
        });
        
        this.socket.on('game-started', () => {
            this.startGame();
        });
        
        this.socket.on('color-change', (data) => {
            this.triggerColorChange(data.changeTime);
        });
        
        this.socket.on('game-ended', (data) => {
            this.showGameResult(data);
        });
        
        this.socket.on('opponent-disconnected', () => {
            alert('Your opponent disconnected.');
            this.backToMainMenu();
        });
        
        this.socket.on('room-not-found', () => {
            alert('Game room not found. Returning to main menu.');
            this.backToMainMenu();
        });
    }
    
    updateConnectionStatus(text, status) {
        const statusEl = document.getElementById('connection-status');
        const textEl = document.getElementById('connection-text');
        
        textEl.textContent = text;
        statusEl.className = `status-bar ${status}`;
    }
    
    showGameLobby(players) {
        this.showScreen('game-lobby-screen');
        
        const player1 = players.find(p => p.userId === this.currentUser.userId);
        const player2 = players.find(p => p.userId !== this.currentUser.userId);
        
        if (player1 && player2) {
            document.getElementById('player1-name').textContent = `${player1.username} (You)`;
            document.getElementById('player2-name').textContent = player2.username;
            
            this.updatePlayerStatus('player1-status', player1.ready);
            this.updatePlayerStatus('player2-status', player2.ready);
        }
        
        // Reset ready button
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.textContent = 'Ready';
        readyBtn.disabled = false;
    }
    
    updatePlayerStatus(elementId, isReady) {
        const statusEl = document.getElementById(elementId);
        statusEl.textContent = isReady ? 'Ready!' : 'Waiting...';
        statusEl.className = `status ${isReady ? 'ready' : 'waiting'}`;
    }
    
    toggleReady() {
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.disabled = true;
        readyBtn.textContent = 'Ready!';
        
        this.socket.emit('player-ready', { roomId: this.currentRoom });
    }
    
    updateLobbyStatus(data) {
        data.players.forEach(player => {
            if (player.userId === this.currentUser.userId) {
                this.updatePlayerStatus('player1-status', player.ready);
            } else {
                this.updatePlayerStatus('player2-status', player.ready);
            }
        });
        
        const lobbyStatus = document.getElementById('lobby-status');
        if (data.allReady) {
            lobbyStatus.textContent = 'Game starting soon...';
        } else {
            lobbyStatus.textContent = 'Waiting for players to be ready...';
        }
    }
    
    leaveLobby() {
        if (this.currentRoom) {
            this.socket.emit('leave-room', { roomId: this.currentRoom });
        }
        this.backToMainMenu();
    }
    
    startGame() {
        this.showScreen('game-screen');
        this.isGameActive = true;
        this.gameStartTime = Date.now();
        this.colorChangeTime = null;
        
        // Reset game state
        document.body.classList.remove('color-changed');
        const reactionBtn = document.getElementById('reaction-btn');
        reactionBtn.disabled = false;
        reactionBtn.textContent = 'Wait for color change...';
        reactionBtn.style.background = '';
        
        document.getElementById('game-timer').textContent = 'Game in progress...';
    }
    
    triggerColorChange(changeTime) {
        this.colorChangeTime = changeTime;
        document.body.classList.add('color-changed');
        
        const reactionBtn = document.getElementById('reaction-btn');
        reactionBtn.textContent = 'CLICK NOW!';
        reactionBtn.style.background = '#e53e3e';
    }
    
    handleReactionClick() {
        if (!this.isGameActive) return;
        
        const clickTime = Date.now();
        this.isGameActive = false;
        
        // Disable button
        const reactionBtn = document.getElementById('reaction-btn');
        reactionBtn.disabled = true;
        reactionBtn.textContent = 'Clicked!';
        
        this.socket.emit('button-click', {
            roomId: this.currentRoom,
            clickTime: clickTime
        });
    }
    
    forfeitGame() {
        if (confirm('Are you sure you want to forfeit the game?')) {
            this.socket.emit('forfeit-game', { roomId: this.currentRoom });
            this.backToMainMenu();
        }
    }
    
    showGameResult(data) {
        this.showScreen('result-screen');
        
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const resultStats = document.getElementById('result-stats');
        
        const isWinner = data.winnerId === this.currentUser.userId;
        
        if (isWinner) {
            resultTitle.textContent = '🎉 YOU WIN! 🎉';
            resultMessage.textContent = `Congratulations! You won the match!`;
            resultMessage.className = 'result-message win';
        } else {
            resultTitle.textContent = '😔 YOU LOSE';
            resultMessage.textContent = `${data.winner} won this round. Better luck next time!`;
            resultMessage.className = 'result-message loss';
        }
        
        // Show reason
        let reasonText = '';
        switch (data.reason) {
            case 'valid_click':
                reasonText = isWinner ? 'You clicked first after the color change!' : 'Your opponent clicked first after the color change.';
                break;
            case 'early_click':
                reasonText = isWinner ? 'Your opponent clicked before the color change!' : 'You clicked before the color change.';
                break;
            case 'forfeit':
                reasonText = isWinner ? 'Your opponent forfeited the game!' : 'You forfeited the game.';
                break;
        }
        
        resultMessage.textContent += ` ${reasonText}`;
        
        // Show updated stats
        if (data.stats && data.stats[this.currentUser.userId]) {
            const myStats = data.stats[this.currentUser.userId];
            resultStats.innerHTML = `
                <h3>Your Stats</h3>
                <p>Total Games: ${myStats.gamesPlayed}</p>
                <p>Games Won: ${myStats.gamesWon}</p>
                <p>Win Rate: ${myStats.gamesPlayed > 0 ? ((myStats.gamesWon / myStats.gamesPlayed) * 100).toFixed(1) : 0}%</p>
            `;
        }
        
        // Reset game state
        document.body.classList.remove('color-changed');
        this.isGameActive = false;
    }
    
    playAgain() {
        // Reset to lobby and wait for new opponent
        this.showScreen('game-lobby-screen');
        
        // Reset lobby state
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.disabled = false;
        readyBtn.textContent = 'Ready';

        document.getElementById('player2-name').textContent = 'Waiting for opponent...';
        this.updatePlayerStatus('player2-status', false);
        
        document.getElementById('lobby-status').textContent = 'Waiting for new opponent...';
    }
    
    backToMainMenu() {
        // Clean up current room
        if (this.currentRoom) {
            this.socket.emit('leave-room', { roomId: this.currentRoom });
            this.currentRoom = null;
        }
        
        // Redirect to main page
        window.location.href = '/';
    }
    
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');
    }
}

// Initialize the game room when page loads
document.addEventListener('DOMContentLoaded', () => {
    new BrainReactionGameRoom();
});