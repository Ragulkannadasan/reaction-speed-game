class BrainReactionGame {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.gameStartTime = null;
        this.colorChangeTime = null;
        this.isGameActive = false;
        this.pendingRequest = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.connectToServer();
        
        // Check for existing login token
        const savedToken = localStorage.getItem('userToken');
        if (savedToken) {
            // Try to validate the token and auto-login
            this.validateAndRestoreSession(savedToken);
        } else {
            this.showScreen('auth-screen');
        }
    }
    
    setupEventListeners() {
        // Auth form
        document.getElementById('auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });
        
        // Tab switching
        document.getElementById('login-tab').addEventListener('click', () => this.switchTab('login'));
        document.getElementById('register-tab').addEventListener('click', () => this.switchTab('register'));
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // Game request responses
        document.getElementById('accept-request').addEventListener('click', () => this.acceptGameRequest());
        document.getElementById('reject-request').addEventListener('click', () => this.rejectGameRequest());
    }
    
    connectToServer() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected to server', 'connected');
            if (this.currentUser) {
                this.socket.emit('user-login', this.currentUser);
            }
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected from server', 'disconnected');
        });
        
        this.socket.on('users-update', (users) => {
            this.updatePlayersList(users);
        });
        
        this.socket.on('game-request-received', (data) => {
            this.showGameRequest(data);
        });
        
        this.socket.on('game-request-rejected', () => {
            alert('Your game request was rejected.');
        });
        
        this.socket.on('game-room-joined', (data) => {
            this.currentRoom = data.roomId;
            // Navigate to game page with room ID
            window.location.href = `/game.html?room=${data.roomId}`;
        });
    }
    
    updateConnectionStatus(text, status) {
        const statusEl = document.getElementById('connection-status');
        const textEl = document.getElementById('connection-text');
        
        textEl.textContent = text;
        statusEl.className = `status-bar ${status}`;
    }
    
    switchTab(tab) {
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');
        const submitBtn = document.getElementById('auth-submit');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            submitBtn.textContent = 'Login';
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            submitBtn.textContent = 'Register';
        }
    }
    
    async handleAuth() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const isLogin = document.getElementById('login-tab').classList.contains('active');
        
        // Clear any previous error messages
        document.getElementById('auth-error').textContent = '';
        
        // Validate input
        if (!username || username.length < 3) {
            document.getElementById('auth-error').textContent = 'Username must be at least 3 characters long';
            return;
        }
        
        if (!password || password.length < 6) {
            document.getElementById('auth-error').textContent = 'Password must be at least 6 characters long';
            return;
        }
        
        // Disable submit button during processing
        const submitBtn = document.getElementById('auth-submit');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? 'Logging in...' : 'Registering...';
        
        const endpoint = isLogin ? '/api/login' : '/api/register';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = {
                    userId: data.userId,
                    username: data.username,
                    token: data.token
                };
                
                localStorage.setItem('userToken', data.token);
                
                // Ensure socket is connected before proceeding
                if (this.socket && this.socket.connected) {
                    this.socket.emit('user-login', this.currentUser);
                } else {
                    // Wait for socket connection
                    this.socket.once('connect', () => {
                        this.socket.emit('user-login', this.currentUser);
                    });
                }
                
                this.loadUserStats();
                this.showScreen('player-selection-screen');
                
                document.getElementById('current-username').textContent = username;
                document.getElementById('auth-error').textContent = '';
                
                // Clear form
                document.getElementById('auth-form').reset();
            } else {
                document.getElementById('auth-error').textContent = data.error || 'Authentication failed';
            }
        } catch (error) {
            console.error('Authentication error:', error);
            document.getElementById('auth-error').textContent = 'Connection error - please check your internet connection';
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
    
    async loadUserStats() {
        try {
            const response = await fetch(`/api/user/${this.currentUser.userId}/stats`);
            const stats = await response.json();
            
            document.getElementById('user-games').textContent = stats.gamesPlayed;
            document.getElementById('user-wins').textContent = stats.gamesWon;
            document.getElementById('user-winrate').textContent = stats.winRate + '%';
        } catch (error) {
            console.error('Failed to load user stats:', error);
        }
    }
    
    async validateAndRestoreSession(token) {
        try {
            // Decode JWT to get user info (simple approach)
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Check if token is expired
            if (payload.exp && payload.exp < Date.now() / 1000) {
                localStorage.removeItem('userToken');
                this.showScreen('auth-screen');
                return;
            }
            
            // Restore user session
            this.currentUser = {
                userId: payload.userId,
                username: payload.username,
                token: token
            };
            
            // Emit user login when socket connects
            if (this.socket && this.socket.connected) {
                this.socket.emit('user-login', this.currentUser);
            } else {
                this.socket.once('connect', () => {
                    this.socket.emit('user-login', this.currentUser);
                });
            }
            
            // Update UI
            document.getElementById('current-username').textContent = this.currentUser.username;
            this.loadUserStats();
            this.showScreen('player-selection-screen');
            
        } catch (error) {
            console.error('Session validation failed:', error);
            localStorage.removeItem('userToken');
            this.showScreen('auth-screen');
        }
    }

    logout() {
        this.currentUser = null;
        this.currentRoom = null;
        localStorage.removeItem('userToken');
        this.showScreen('auth-screen');
        document.getElementById('auth-form').reset();
    }
    
    updatePlayersList(users) {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        users.forEach(user => {
            if (user.userId !== this.currentUser.userId) {
                const playerCard = document.createElement('div');
                playerCard.className = `player-card ${user.status}`;
                playerCard.innerHTML = `
                    <div class="player-name">${user.username}</div>
                    <div class="player-stats">Games: N/A | Wins: N/A</div>
                    <div class="player-status ${user.status}">${user.status}</div>
                `;
                
                if (user.status === 'online') {
                    playerCard.addEventListener('click', () => this.sendGameRequest(user));
                }
                
                playersList.appendChild(playerCard);
            }
        });
    }
    
    sendGameRequest(targetUser) {
        if (confirm(`Send game request to ${targetUser.username}?`)) {
            this.socket.emit('send-game-request', {
                targetUserId: targetUser.userId,
                fromUser: this.currentUser
            });
        }
    }
    
    showGameRequest(data) {
        this.pendingRequest = data;
        document.getElementById('request-from').textContent = data.from.username;
        document.getElementById('incoming-request').classList.remove('hidden');
    }
    
    acceptGameRequest() {
        if (this.pendingRequest) {
            this.socket.emit('accept-game-request', {
                fromUserId: this.pendingRequest.from.userId,
                toUser: this.currentUser
            });
            
            document.getElementById('incoming-request').classList.add('hidden');
            this.pendingRequest = null;
        }
    }
    
    rejectGameRequest() {
        if (this.pendingRequest) {
            this.socket.emit('reject-game-request', {
                fromUserId: this.pendingRequest.from.userId
            });
            
            document.getElementById('incoming-request').classList.add('hidden');
            this.pendingRequest = null;
        }
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

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new BrainReactionGame();
});