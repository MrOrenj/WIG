const socket = io();
let page = window.location.pathname;

// ==================================
// INDEX PAGE (Enter Name + Play)
// ==================================
if (page.endsWith("index.html") || page === "/") {

    window.startGame = function () {
        let name = document.getElementById("playerName").value.trim();

        if (!name) {
            alert("Please enter your name!");
            return;
        }

        localStorage.setItem("playerName", name);
        window.location.href = "room.html";
    };
}

// ==================================
// ROOM PAGE (Create Room / Join Room)
// ==================================
if (page.endsWith("room.html")) {

    const playerName = localStorage.getItem("playerName");
    if (!playerName) window.location.href = "index.html";

    // Create Room (send real name)
    window.createRoom = function () {
        let name = localStorage.getItem("playerName");
        socket.emit("createRoom", { name });
    };

    // Wait for room to be created, THEN navigate
    socket.once("roomCreated", (code) => {
        // Give server time to emit roomUpdate before page redirects
        setTimeout(() => {
            window.location.href = "lobby.html?code=" + code;
        }, 100);
    });

    // Join Room
    window.joinRoom = function () {
        let room = document.getElementById("joinCode").value.trim();
        let name = localStorage.getItem("playerName");

        if (!room) {
            alert("Enter a room code!");
            return;
        }

        socket.emit("joinRoom", { room, name });
        window.location.href = "lobby.html?code=" + room;
    };
}

// ==================================
// LOBBY PAGE (Host Mode Selector + Start Button)
// ==================================
if (page.endsWith("lobby.html")) {

    const playerName = localStorage.getItem("playerName");
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get("code");

    document.getElementById("roomCodeDisplay").innerText = room;

    // Immediately request room update when page loads
    socket.emit("joinRoom", { room, name: playerName });

    socket.on("roomUpdate", (data) => {

        // Update Players List
        let list = document.getElementById("playerList");
        list.innerHTML = "";

        let playerCount = 0;
        for (let id in data.players) {
            playerCount++;
            let li = document.createElement("li");
            li.className = "list-group-item bg-dark text-light mb-2";
            li.innerText = data.players[id].name + (id === data.host ? " (Host)" : "");
            list.appendChild(li);
        }

        // Check if host and update start button status
        if (data.host === socket.id) {
            document.getElementById("hostOptions").style.display = "block";
            document.getElementById("waitingMsg").style.display = "none";
            
            // Enable start button only if at least 3 players
            if (playerCount >= 3) {
                document.getElementById("startGameBtn").disabled = false;
                document.getElementById("playerWarning").style.display = "none";
            } else {
                document.getElementById("startGameBtn").disabled = true;
                document.getElementById("playerWarning").style.display = "block";
            }
        }
        // Player UI
        else {
            document.getElementById("hostOptions").style.display = "none";
            document.getElementById("waitingMsg").style.display = "block";
        }
    });

    // Host starts game
    window.startGame = function () {
        const mode = document.getElementById("gameMode").value;
        socket.emit("startGame", { room, mode });
    };

    socket.on("gameError", (message) => {
        alert(message);
    });

    socket.on("gameStarted", ({ mode, role, word }) => {
        // URL encode the word in case it has special characters
        const encodedWord = encodeURIComponent(word);
        window.location.href = `game.html?code=${room}&mode=${mode}&role=${role}&word=${encodedWord}`;
    });
}

// ==================================
// GAME PAGE (WIS or other modes)
// ==================================
if (page.endsWith("game.html")) {

    const playerName = localStorage.getItem("playerName");
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get("code");
    const mode = urlParams.get("mode");
    const playerRole = urlParams.get("role");  // Get role from URL
    const playerWord = urlParams.get("word");  // Get word from URL

    console.log("=== GAME PAGE LOADED ===");
    console.log("Player:", playerName, "Room:", room, "Mode:", mode);
    console.log("Role:", playerRole, "Word:", playerWord);

    let hasVoted = false;
    let allPlayers = {};
    let playerIds = [];
    let currentRole = playerRole;  // Use role from URL

    // Setup all event listeners BEFORE making any requests
    // Receive role from server
    socket.on("yourRole", ({ role, word }) => {
        console.log("=== YOUR ROLE EVENT RECEIVED ===");
        console.log("Role received:", role, "Word:", word);
        currentRole = role;
        
        // Display role immediately
        console.log("Setting role text...");
        if (mode === "WIS") {
            document.getElementById("roleText").innerText =
                role === "spy" ? "🕵️ You are the SPY" : "👥 You are a NORMAL Player";
        }

        // Display word based on role
        console.log("Setting word display...");
        if (role !== "spy") {
            document.getElementById("wordText").innerText = word;
            document.getElementById("wordText").className = "word-display normal";
        } else {
            document.getElementById("wordText").innerText = "?";
            document.getElementById("wordText").className = "word-display spy";
        }
        
        // Make sure word container shows
        console.log("Showing word container...");
        document.getElementById("wordContainer").style.display = "block";
    });

    // If we have role data from URL, display it immediately (no waiting for server)
    if (playerRole && playerWord) {
        console.log("=== DISPLAYING ROLE FROM URL ===");
        console.log("Role:", playerRole, "Word:", playerWord);
        
        if (mode === "WIS") {
            document.getElementById("roleText").innerText =
                playerRole === "spy" ? "🕵️ You are the SPY" : "👥 You are a NORMAL Player";
        }

        if (playerRole !== "spy") {
            document.getElementById("wordText").innerText = playerWord;
            document.getElementById("wordText").className = "word-display normal";
        } else {
            document.getElementById("wordText").innerText = "?";
            document.getElementById("wordText").className = "word-display spy";
        }
        
        document.getElementById("wordContainer").style.display = "block";
    }

    // Request the game state when socket is ready
    socket.on("connect", () => {
        console.log("Socket connected! Socket ID:", socket.id);
        console.log("Requesting game state for room:", room);
        socket.emit("getGameState", { room });
    });

    // If socket is already connected, request state immediately
    if (socket.connected) {
        console.log("Socket already connected. Requesting game state...");
        socket.emit("getGameState", { room });
    }

    // Receive round started
    socket.on("roundStarted", ({ round, mode, players }) => {
        console.log("=== ROUND STARTED EVENT RECEIVED ===");
        console.log("Round:", round, "Mode:", mode, "Players:", players);
        playerIds = Object.keys(players);
        hasVoted = false;
        
        // Make sure to show clue input for non-spies
        if (currentRole !== "spy") {
            document.getElementById("clueInput").disabled = false;
            document.querySelector("button[onclick='sendClue()']").disabled = false;
        } else {
            // Disable clue input for spies
            document.getElementById("clueInput").disabled = true;
            document.querySelector("button[onclick='sendClue()']").disabled = true;
        }
        document.getElementById("clueInput").value = "";
        
        // Show word container and clue phase
        console.log("Showing clue phase...");
        document.getElementById("wordContainer").style.display = "block";
        document.getElementById("cluePhase").style.display = "block";
        document.getElementById("clueStatusContainer").style.display = "block";
        
        // Hide voting and game over phases
        document.getElementById("votingPhase").style.display = "none";
        document.getElementById("gameOverPhase").style.display = "none";
        document.getElementById("roundResultPhase").style.display = "none";
        
        // Update status
        document.getElementById("clueStatusText").innerText = 
            `Round ${round} - Waiting for players to enter clues... (0/${playerIds.length})`;
        
        // Populate player status list initially (all waiting for clues)
        let statusList = document.getElementById("playerStatus");
        statusList.innerHTML = "";
        
        for (let id in players) {
            // Skip spy players from the clue list display
            if (players[id].role === "spy") {
                continue;
            }
            
            let li = document.createElement("li");
            li.className = "list-group-item bg-warning text-dark";
            li.innerHTML = `<b>${players[id].name}</b> - ⏳ Waiting for clue`;
            statusList.appendChild(li);
        }
    });

    // Send clue
    window.sendClue = function () {
        console.log("=== SEND CLUE CALLED ===");
        let clue = document.getElementById("clueInput").value.trim();
        console.log("Clue input:", clue);
        if (!clue) {
            console.log("Clue is empty, returning");
            return;
        }

        console.log("Emitting clue:", { room, name: playerName, clue });
        socket.emit("clue", { room, name: playerName, clue });
        document.getElementById("clueInput").value = "";
        document.getElementById("clueInput").disabled = true;
        document.querySelector("button[onclick='sendClue()']").disabled = true;
    };

    // Receive clue
    socket.on("clue", ({ name, clue }) => {
        console.log("[CLUE EVENT RECEIVED]", { name, clue });
        let list = document.getElementById("clueList");
        if (!list) {
            console.error("ERROR: clueList element not found!");
            return;
        }
        let li = document.createElement("li");
        li.className = "list-group-item bg-dark text-light mb-2";
        li.innerHTML = `<b>${name}:</b> ${clue}`;
        list.appendChild(li);
        console.log(`[CLUE DISPLAYED] ${name}: ${clue}`);
    });

    // Update clue status
    socket.on("clueStatus", ({ cluesGiven, totalPlayers, players, cluesTaken }) => {
        // Update status text
        document.getElementById("clueStatusText").innerText = 
            `Clues received: ${cluesGiven}/${totalPlayers}`;

        // Update player status list
        let statusList = document.getElementById("playerStatus");
        statusList.innerHTML = "";

        for (let id in players) {
            // Skip spy players from the clue list display
            if (players[id].role === "spy") {
                continue;
            }
            
            let li = document.createElement("li");
            li.className = cluesTaken[id] ? 
                "list-group-item bg-success text-white" : 
                "list-group-item bg-warning text-dark";
            
            let status = cluesTaken[id] ? "✓ Clue received" : "⏳ Waiting for clue";
            li.innerHTML = `<b>${players[id].name}</b> - ${status}`;
            statusList.appendChild(li);
        }
    });

    // Start voting phase
    socket.on("startVoting", ({ players, message }) => {
        allPlayers = players;
        hasVoted = false;

        // Hide clue phase and word, show voting phase
        document.getElementById("cluePhase").style.display = "none";
        document.getElementById("wordContainer").style.display = "none";
        document.getElementById("votingPhase").style.display = "block";
        document.getElementById("votingMessage").innerText = message;

        // Create voting buttons for each player
        let voteContainer = document.getElementById("playerVotes");
        voteContainer.innerHTML = "";

        for (let id in players) {
            let btn = document.createElement("button");
            btn.className = "btn btn-outline-danger w-100 mb-2";
            btn.innerText = players[id].name;
            btn.onclick = function() {
                if (!hasVoted) {
                    socket.emit("vote", { room, playerName, targetName: players[id].name });
                    hasVoted = true;
                    btn.classList.remove("btn-outline-danger");
                    btn.classList.add("btn-danger");
                    btn.disabled = true;
                    document.getElementById("voteStatus").innerText = "✓ Vote submitted!";
                }
            };
            voteContainer.appendChild(btn);
        }

        document.getElementById("voteStatus").innerText = "Waiting for all votes...";
    });

    // Update vote count
    socket.on("voteUpdate", ({ voter, target, votesReceived, totalPlayers }) => {
        document.getElementById("voteStatus").innerText = 
            `Votes received: ${votesReceived}/${totalPlayers}`;
    });

    // Round result
    socket.on("roundResult", ({ eliminated, wasSpyEliminated, spy, message }) => {
        document.getElementById("votingPhase").style.display = "none";
        document.getElementById("roundResultPhase").style.display = "block";
        
        // Show result message
        let resultDiv = document.createElement("div");
        resultDiv.className = wasSpyEliminated ? "alert alert-success" : "alert alert-info";
        resultDiv.innerHTML = `
            <h3>${message}</h3>
            <p><strong>Eliminated:</strong> ${eliminated}</p>
            <p><strong>The Spy was:</strong> ${spy}</p>
        `;
        
        if (!wasSpyEliminated) {
            resultDiv.innerHTML += "<p class='mt-3 text-center'><em>Next round starting in 3 seconds...</em></p>";
        }
        
        document.getElementById("roundResultContent").innerHTML = "";
        document.getElementById("roundResultContent").appendChild(resultDiv);
    });

    // Game over
    socket.on("gameOver", ({ eliminated, wasSpyEliminated, spy, message }) => {
        document.getElementById("cluePhase").style.display = "none";
        document.getElementById("votingPhase").style.display = "none";
        document.getElementById("roundResultPhase").style.display = "none";
        document.getElementById("wordContainer").style.display = "none";
        document.getElementById("gameOverPhase").style.display = "block";

        let resultClass = wasSpyEliminated ? "alert-success" : "alert-danger";
        document.getElementById("gameResult").innerHTML = `<div class="alert ${resultClass}"><h2>${message}</h2></div>`;
        document.getElementById("eliminatedName").innerText = eliminated;
        document.getElementById("spyName").innerText = spy;
    });
}
