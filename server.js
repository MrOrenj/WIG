const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001", // Allow React dev server
    methods: ["GET", "POST"],
  },
});

let rooms = {};
let playerRoles = {}; // Map: playerId -> { role, word, room }
let roomClues = {}; // Map: roomId -> [{ name, clue }, ...]
let roomVotes = {}; // Map: roomId -> { playerName -> targetName }

// List of random words for the game
const WORD_LIST = [
  "APPLE",
  "BANANA",
  "ORANGE",
  "COMPUTER",
  "PHONE",
  "ELEPHANT",
  "MOUNTAIN",
  "OCEAN",
  "FLOWER",
  "GUITAR",
  "PIZZA",
  "ROCKET",
  "DINOSAUR",
  "TREASURE",
  "CAMERA",
  "BICYCLE",
  "BUTTERFLY",
  "VOLCANO",
  "PENGUIN",
  "RAINBOW",
  "CASTLE",
  "DIAMOND",
  "TORNADO",
  "ISLAND",
];

function getRandomWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ============================
  // CREATE ROOM
  // ============================
  socket.on("createRoom", ({ name }) => {
    let code = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[code] = {
      host: socket.id,
      players: {},
      started: false,
      mode: "",
      word: "",
      spy: "",
    };

    socket.join(code);

    rooms[code].players[socket.id] = {
      name: name,
      role: "",
    };

    console.log(
      `[ROOM CREATED] Code: ${code}, Creator: ${name}, SocketID: ${socket.id}`
    );

    socket.emit("roomCreated", code);
    io.to(code).emit("roomUpdate", rooms[code]);
  });

  // ============================
  // JOIN ROOM
  // ============================
  socket.on("joinRoom", ({ room, name }) => {
    if (!rooms[room]) {
      console.log(`[JOIN ERROR] Room ${room} does not exist!`);
      socket.emit("errorRoom", "Room does not exist!");
      return;
    }

    socket.join(room);

    rooms[room].players[socket.id] = {
      name: name,
      role: "",
    };

    console.log(
      `[ROOM JOINED] Room: ${room}, Player: ${name}, SocketID: ${socket.id}`
    );
    console.log(
      `[ROOM STATE] Total players in room ${room}:`,
      Object.values(rooms[room].players).map((p) => p.name)
    );

    // If no host is set, make this the first joiner the host
    if (!rooms[room].host) {
      rooms[room].host = socket.id;
    }

    io.to(room).emit("roomUpdate", rooms[room]);
  });

  // ============================
  // START GAME (Host Only)
  // ============================
  socket.on("startGame", ({ room, mode }) => {
    if (!rooms[room]) return;

    // Check if at least 3 players are present
    let playerCount = Object.keys(rooms[room].players).length;
    if (playerCount < 3) {
      socket.emit(
        "gameError",
        "At least 3 players are required to start the game!"
      );
      return;
    }

    rooms[room].started = true;
    rooms[room].mode = mode;
    rooms[room].round = 1;

    startNewRound(room, io);
  });

  // ============================
  // START NEW ROUND
  // ============================
  function startNewRound(room, io) {
    rooms[room].cluesTaken = {}; // Track who has given clues
    roomVotes[room] = {}; // Reset votes for this round
    roomClues[room] = []; // Reset clues for this round

    let players = Object.keys(rooms[room].players);

    // ===============================
    // GAME MODE 1 — WIS (Who Is Spy)
    // ===============================
    if (rooms[room].mode === "WIS") {
      // Pick random secret word
      let secretWord = getRandomWord();

      // pick a random spy
      let spy = players[Math.floor(Math.random() * players.length)];

      rooms[room].word = secretWord;
      rooms[room].spy = spy;

      // Initialize cluesTaken object
      players.forEach((id) => {
        rooms[room].cluesTaken[id] = false;
      });

      // assign roles to each player and STORE them
      players.forEach((id) => {
        let role = id === spy ? "spy" : "normal";
        rooms[room].players[id].role = role;

        // Store player role globally for quick lookup
        playerRoles[id] = {
          role: role,
          word: role === "normal" ? secretWord : "?",
          room: room,
        };

        console.log(
          `[ROLE ASSIGNED] Player (${id}): ${role}, Word: ${playerRoles[id].word}`
        );

        io.to(id).emit("yourRole", {
          role,
          word: role === "normal" ? secretWord : "?",
        });
      });
    }

    io.to(room).emit("roundStarted", {
      round: rooms[room].round,
      mode: rooms[room].mode,
      players: rooms[room].players,
      totalPlayers: players.length,
    });

    // Emit gameStarted event for lobby to redirect to game page
    // Include role and word in the payload for URL params
    players.forEach((id) => {
      const role = rooms[room].players[id].role;
      const word = role === "normal" ? rooms[room].word : "?";
      io.to(id).emit("gameStarted", {
        mode: rooms[room].mode,
        role: role,
        word: word,
      });
    });
  }

  // ============================
  // GET GAME STATE (for page reload or game page load)
  // ============================
  socket.on("getGameState", ({ room }) => {
    console.log("\n[GET GAME STATE]");
    console.log("Socket ID:", socket.id);
    console.log("Room:", room);

    if (!rooms[room]) {
      console.log("ERROR: Room not found");
      return;
    }

    socket.join(room);

    // Check if this socket has a stored role
    if (socket.id in playerRoles && playerRoles[socket.id].room === room) {
      console.log("✓ Found stored role for socket");
      const { role, word } = playerRoles[socket.id];
      console.log(`  Sending role: ${role}, word: ${word}`);

      socket.emit("yourRole", {
        role,
        word,
      });

      socket.emit("roundStarted", {
        round: rooms[room].round,
        mode: rooms[room].mode,
        players: rooms[room].players,
        totalPlayers: Object.keys(rooms[room].players).length,
      });

      // Send any clues that have already been submitted
      if (roomClues[room] && roomClues[room].length > 0) {
        console.log(
          `[SENDING STORED CLUES] Sending ${roomClues[room].length} clues to late joiner`
        );
        roomClues[room].forEach(({ name, clue }) => {
          socket.emit("clue", { name, clue });
        });
      }

      // Send current clue status
      let cluesGiven = 0;
      let expectedClues = Object.keys(rooms[room].players).length;
      for (let socketId in rooms[room].players) {
        if (rooms[room].cluesTaken[socketId]) {
          cluesGiven++;
        }
      }

      socket.emit("clueStatus", {
        cluesGiven,
        totalPlayers: expectedClues,
        players: rooms[room].players,
        cluesTaken: rooms[room].cluesTaken,
      });
    } else {
      console.log("✗ No stored role found for this socket");
      console.log(`  Available sockets with roles:`, Object.keys(playerRoles));
    }
  });

  // ============================
  // RECEIVE CLUE
  // ============================
  socket.on("clue", ({ room, name, clue }) => {
    if (!rooms[room]) {
      console.log(`[CLUE ERROR] Room ${room} not found`);
      return;
    }

    console.log(
      `[CLUE RECEIVED] Room: ${room}, Player: ${name}, Clue: ${clue}`
    );

    // Find the player by name and mark them as having given a clue
    let playerSocketId = null;
    for (let socketId in rooms[room].players) {
      if (rooms[room].players[socketId].name === name) {
        playerSocketId = socketId;
        break;
      }
    }

    if (!playerSocketId) {
      console.log(`[CLUE ERROR] Player ${name} not found in room ${room}`);
      return;
    }

    // Mark this player as having given their clue
    rooms[room].cluesTaken[playerSocketId] = true;
    console.log(
      `[CLUE MARKED] Player ${name} (${playerSocketId}) marked as given clue`
    );

    // Store the clue for late joiners
    if (!roomClues[room]) {
      roomClues[room] = [];
    }
    roomClues[room].push({ name, clue });
    console.log(
      `[CLUE STORED] Clues stored for room ${room}:`,
      roomClues[room]
    );

    let playerCount = Object.keys(rooms[room].players).length;

    // Count clues from ALL players (including spy)
    let cluesGiven = 0;
    let expectedClues = playerCount;
    for (let socketId in rooms[room].players) {
      if (rooms[room].cluesTaken[socketId]) {
        cluesGiven++;
      }
    }

    // Broadcast clue to all players in the room
    io.to(room).emit("clue", { name, clue });

    // Send player status update
    io.to(room).emit("clueStatus", {
      cluesGiven,
      totalPlayers: expectedClues,
      players: rooms[room].players,
      cluesTaken: rooms[room].cluesTaken,
    });

    console.log(
      `[CLUE STATUS] Clues given: ${cluesGiven}/${expectedClues} in room ${room}`
    );

    // When ALL players have given clues, start voting phase
    if (cluesGiven >= expectedClues && expectedClues > 0) {
      console.log(
        `[VOTING PHASE] All clues received in room ${room}, starting voting`
      );
      io.to(room).emit("startVoting", {
        players: rooms[room].players,
        clues: roomClues[room] || [],
        message: "All clues given! Now vote for who is the spy.",
      });
    }
  });

  // ============================
  // VOTING SYSTEM
  // ============================
  socket.on("vote", ({ room, playerName, targetName }) => {
    if (!rooms[room]) {
      console.log(`[VOTE ERROR] Room ${room} not found`);
      return;
    }

    console.log(
      `[VOTE RECEIVED] ${playerName} voted for ${targetName} in room ${room}`
    );

    // Initialize votes for this room if not already
    if (!roomVotes[room]) {
      roomVotes[room] = {};
    }

    // Record the vote by player name
    roomVotes[room][playerName] = targetName;
    console.log(`[VOTE RECORDED] Votes in room ${room}:`, roomVotes[room]);

    let playerCount = Object.keys(rooms[room].players).length;
    let voteCount = Object.keys(roomVotes[room]).length;

    io.to(room).emit("voteUpdate", {
      voter: playerName,
      target: targetName,
      votesReceived: voteCount,
      totalPlayers: playerCount,
    });

    console.log(`[VOTE STATUS] Votes: ${voteCount}/${playerCount}`);

    // When all players have voted, determine winner
    if (voteCount >= playerCount) {
      console.log(`[ALL VOTES RECEIVED] Determining winner for room ${room}`);
      determineWinner(room, io);
    }
  });

  // ============================
  // DETERMINE WINNER
  // ============================
  function determineWinner(room, io) {
    let votes = roomVotes[room] || {};
    let voteCount = {};

    // Count votes for each player by name
    for (let voterName in votes) {
      let targetName = votes[voterName];
      voteCount[targetName] = (voteCount[targetName] || 0) + 1;
    }

    // Find player with most votes by name
    let eliminatedName = Object.keys(voteCount).reduce((a, b) =>
      voteCount[a] > voteCount[b] ? a : b
    );

    console.log(
      `[ELIMINATION] Player ${eliminatedName} received ${voteCount[eliminatedName]} votes`
    );

    // Find the actual spy name
    let spyName = rooms[room].players[rooms[room].spy].name;
    let wasSpyEliminated = eliminatedName === spyName;

    let result = {
      eliminated: eliminatedName,
      wasSpyEliminated: wasSpyEliminated,
      spy: spyName,
      message: wasSpyEliminated
        ? `${eliminatedName} was the SPY! Counter Terrorist win! 👅`
        : `${eliminatedName} was not the spy. SPY WINS! 🕵️`,
      roundEnded: wasSpyEliminated,
    };

    console.log(`[ROUND RESULT] ${result.message}`);

    // Send result with host information
    const resultWithHost = {
      ...result,
      hostId: rooms[room].host,
    };

    io.to(room).emit("roundResult", resultWithHost);
  }

  // ============================
  // NEXT ROUND (Host Only)
  // ============================
  socket.on("nextRound", ({ room }) => {
    if (!rooms[room]) {
      console.log(`[NEXT ROUND ERROR] Room ${room} not found`);
      return;
    }

    // Check if requester is the host
    if (rooms[room].host !== socket.id) {
      console.log(`[NEXT ROUND ERROR] Only host can start next round`);
      return;
    }

    console.log(`[NEXT ROUND] Host starting next round in room ${room}`);
    rooms[room].round++;
    roomVotes[room] = {}; // Reset votes for next round
    startNewRound(room, io);
  });

  // ============================
  // PLAYER DISCONNECT
  // ============================
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] Socket: ${socket.id}`);

    // Clean up stored role
    if (socket.id in playerRoles) {
      delete playerRoles[socket.id];
    }

    for (let room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];

        // If host leaves → assign new host
        if (rooms[room].host === socket.id) {
          let remaining = Object.keys(rooms[room].players);
          rooms[room].host = remaining[0] || null;
        }

        io.to(room).emit("roomUpdate", rooms[room]);
      }
    }
  });
});

// ============================
// Serve React build in production
// ============================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));

  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
  });
}

// ============================
// SERVER START
// ============================
server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on:");
  console.log("Local:  http://localhost:3000");
  console.log("LAN:    http://YOUR_LAN_IP:3000");
});
