# Brain Reaction Speed Game

A multiplayer web-based brain reaction speed game where two players compete to test their reaction times.

## Features

### Game Flow
1. **Connect to private network** - Players connect via web browser
2. **Account system** - Create account or login with existing credentials
3. **Player selection** - Browse online players and send game requests
4. **Game requests** - Send/receive invitations to play
5. **Game lobby** - Both players must click "Ready" to start
6. **Reaction game** - Wait for background color change, then click as fast as possible
7. **Win conditions** - First to click after color change wins; clicking early loses
8. **Scoring system** - 1 point per win
9. **Statistics** - Track games played, wins, losses, and game history

### Technical Features
- Real-time multiplayer using Socket.io
- User authentication with bcrypt password hashing
- Game statistics and history tracking
- Responsive web design
- Random timing (1-5 seconds) for color changes
- Anti-cheat protection (early clicks result in loss)

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation
1. **Install Node.js** from https://nodejs.org/
2. **Open terminal/command prompt** in the game directory
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the server**:
   ```bash
   npm start
   ```
   Or on Windows, double-click `start.bat`

### Access the Game
1. Open your web browser
2. Go to: `http://localhost:3000`
3. Create an account or login
4. Start playing!

## Game Rules

### How to Play
1. **Register/Login** - Create an account or login with existing credentials
2. **Find Players** - See list of online players
3. **Send Request** - Click on a player to send a game request
4. **Accept/Reject** - Respond to incoming game requests
5. **Get Ready** - Both players must click "Ready" in the lobby
6. **Wait for Change** - Watch for the background color to change
7. **React Fast** - Click the button as soon as the color changes
8. **Win/Lose** - First to click after color change wins!

### Winning Conditions
- ✅ **Win**: Click the button first AFTER the color changes
- ❌ **Lose**: Click the button BEFORE the color changes
- ❌ **Lose**: Click slower than your opponent after color changes

### Scoring
- Each win gives you 1 point
- Statistics track:
  - Total games played
  - Games won
  - Games lost
  - Win rate percentage
  - Game history

## Game Architecture

### Backend (Node.js + Express + Socket.io)
- **Authentication API**: `/api/register`, `/api/login`
- **User API**: `/api/users`, `/api/user/:userId/stats`
- **Real-time events**: Game requests, lobby management, game logic
- **Data storage**: In-memory (users, games, statistics)

### Frontend (HTML + CSS + JavaScript)
- **Responsive design**: Works on desktop and mobile
- **Real-time UI**: Instant updates via WebSocket
- **Game screens**: Auth, player selection, lobby, game, results
- **Visual feedback**: Color changes, status updates, animations

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Input validation
- Anti-cheat protection

## Customization

### Timing Configuration
In `server.js`, modify the color change delay:
```javascript
// Current: 1-5 seconds random
const delay = Math.random() * 4000 + 1000;

// Custom: 2-8 seconds random
const delay = Math.random() * 6000 + 2000;
```

### Styling
Modify `public/style.css` to change:
- Colors and themes
- Layout and responsive design
- Animations and effects

### Game Logic
Extend `server.js` to add:
- Multiple rounds per game
- Different game modes
- Tournament brackets
- Leaderboards

## Network Setup

### Local Network
- Server runs on `http://localhost:3000`
- Other devices can connect using your computer's IP: `http://YOUR_IP:3000`

### Public Access
To make the game accessible from outside your network:
1. Configure router port forwarding (port 3000)
2. Use your public IP address
3. Consider using services like ngrok for testing

## Troubleshooting

### Common Issues
1. **npm command not found**
   - Install Node.js from https://nodejs.org/
   - Restart terminal/command prompt

2. **Port already in use**
   - Change port in server.js: `const PORT = 3001;`
   - Or kill process using port 3000

3. **Cannot connect to server**
   - Check if server is running
   - Verify firewall settings
   - Ensure correct IP/port

### Development Mode
For development with auto-restart:
```bash
npm install -g nodemon
npm run dev
```

## Future Enhancements

- [ ] Persistent database (MongoDB/PostgreSQL)
- [ ] User profiles and avatars
- [ ] Tournament mode
- [ ] Global leaderboards
- [ ] Mobile app version
- [ ] Sound effects and music
- [ ] Multiple game modes
- [ ] Chat system
- [ ] Spectator mode
- [ ] Game replays

## License
MIT License - Feel free to modify and distribute!