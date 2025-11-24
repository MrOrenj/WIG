# WIG - Who Is the Spy Game (React Version)

A multiplayer game where players try to identify the spy among them based on clues related to a secret word.

## Project Structure

```
WIG/
├── client/               # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/  # React components (Home, Room, Lobby, Game)
│   │   ├── context/     # Socket.IO context provider
│   │   ├── hooks/       # Custom React hooks
│   │   ├── App.js       # Main app component with routing
│   │   ├── App.css      # Styles
│   │   ├── index.js     # React entry point
│   │   └── socket.js    # Socket.IO client configuration
│   └── package.json
├── server.js            # Express + Socket.IO server
├── package.json         # Server dependencies
└── public/              # Old HTML files (can be removed)
```

## Getting Started

### 1. Install Server Dependencies

```bash
npm install
```

### 2. Install Client Dependencies

```bash
cd client
npm install
cd ..
```

Or use the script:

```bash
npm run install-client
```

### 3. Development Mode

Run both the server and Vite dev server:

**Terminal 1 - Start the server:**

```bash
npm run server
```

This starts the Socket.IO server on port 3000.

**Terminal 2 - Start the Vite dev server:**

```bash
npm run client
```

This starts the Vite dev server on port 3001 with instant HMR.

Open [http://localhost:3001](http://localhost:3001) to play the game.

### 4. Production Build

Build the React app:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The server will serve the React build from port 3000.

## Game Flow

1. **Home Page** (`/`) - Enter your name
2. **Room Page** (`/room`) - Create or join a room
3. **Lobby Page** (`/lobby`) - Wait for players, host starts the game
4. **Game Page** (`/game`) - Play the game:
   - Players receive roles (Spy or Normal)
   - Normal players see the secret word
   - Players enter clues
   - Vote for who is the spy
   - Game ends when spy is found

## Technologies

- **Frontend**: React, React Router, Socket.IO Client, Bootstrap, Vite
- **Backend**: Node.js, Express, Socket.IO
- **Real-time Communication**: Socket.IO
- **Build Tool**: Vite (fast, modern bundler)

## Scripts

- `npm run server` - Start backend server with nodemon (development)
- `npm run client` - Start Vite dev server (development)
- `npm run build` - Build React app for production with Vite
- `npm start` - Start production server (serves built React app)
- `npm run install-client` - Install client dependencies

## Development vs Production

**Development:**
- Backend runs on port 3000 (Socket.IO only)
- Vite dev server runs on port 3001 (instant HMR, <1s startup)
- Vite proxies Socket.IO requests to port 3000
- Visit: http://localhost:3001

**Production:**
- Single server on port 3000
- Serves static React build AND handles Socket.IO
- Visit: http://localhost:3000

## Why Vite?

This project uses Vite instead of Create React App for:
- ⚡ Lightning-fast dev server startup (<1 second)
- 🔥 Instant Hot Module Replacement (HMR)
- 📦 Optimized production builds
- 🎯 Modern tooling with ES modules
- 🚀 Better developer experience overall

## Features

- Real-time multiplayer gameplay
- Room-based game sessions
- Role assignment (Spy vs Normal players)
- Clue submission system
- Voting mechanism
- Multiple game rounds
- Responsive UI with Bootstrap

## Network Play

To play on your local network:

1. Find your local IP address (e.g., 192.168.1.100)
2. In development: Other players access `http://YOUR_IP:3001`
3. In production: Other players access `http://YOUR_IP:3000`
4. Make sure your firewall allows connections on these ports

## Notes

- In development, run both `npm run server` and `npm run client`
- React dev server (port 3001) proxies Socket.IO to backend (port 3000)
- Socket.IO handles all real-time game communication
- Player names are stored in localStorage
- The old `public/` folder with HTML files has been removed
