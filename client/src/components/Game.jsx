import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usePlayerName } from "../hooks/usePlayerName";

const Game = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket } = useSocket();
  const { playerName } = usePlayerName();

  const room = searchParams.get("code");
  const mode = searchParams.get("mode");
  const playerRole = searchParams.get("role");
  const playerWord = searchParams.get("word");

  const [currentRole, setCurrentRole] = useState(playerRole);
  const [word, setWord] = useState(playerWord);
  const [round, setRound] = useState(1);
  const [clueInput, setClueInput] = useState("");
  const [clueInputDisabled, setClueInputDisabled] = useState(false);
  const [clues, setClues] = useState([]);
  const [playerStatus, setPlayerStatus] = useState([]);
  const [cluesGiven, setCluesGiven] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const [showCluePhase, setShowCluePhase] = useState(true);
  const [showVotingPhase, setShowVotingPhase] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  const [votingPlayers, setVotingPlayers] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [votesReceived, setVotesReceived] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);

  const [roundResult, setRoundResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const socketInitialized = useRef(false);

  useEffect(() => {
    if (!playerName || !room) {
      navigate("/");
      return;
    }

    // Prevent duplicate socket listener registration
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    console.log("Game component mounted - Setting up socket listeners");

    // Request game state
    const onConnect = () => {
      console.log("Socket connected, requesting game state for room:", room);
      socket.emit("getGameState", { room });
    };

    if (socket.connected) {
      onConnect();
    }

    const handleYourRole = ({ role, word }) => {
      console.log("Received role:", role, "word:", word);
      setCurrentRole(role);
      setWord(word);
      setClueInputDisabled(false);
    };

    const handleRoundStarted = ({ round, mode, players, totalPlayers }) => {
      console.log("Round started:", round);
      setRound(round);
      setClues([]);
      setClueInput("");
      setClueInputDisabled(false);
      setHasVoted(false);
      setShowCluePhase(true);
      setShowVotingPhase(false);
      setShowRoundResult(false);
      setShowGameOver(false);

      // Initialize player status for ALL players
      const statusList = Object.entries(players).map(([id, player]) => ({
        name: player.name,
        hasClue: false,
      }));
      setPlayerStatus(statusList);
      setTotalPlayers(totalPlayers || Object.keys(players).length);
      setCluesGiven(0);
    };

    const handleClue = ({ name, clue }) => {
      console.log("Received clue:", name, clue);
      setClues((prev) => [...prev, { name, clue }]);
    };

    const handleClueStatus = ({
      cluesGiven,
      totalPlayers,
      players,
      cluesTaken,
    }) => {
      setCluesGiven(cluesGiven);
      setTotalPlayers(totalPlayers);

      // Show status for ALL players including spy
      const statusList = Object.entries(players).map(([id, player]) => ({
        name: player.name,
        hasClue: cluesTaken[id] || false,
      }));
      setPlayerStatus(statusList);
    };

    const handleStartVoting = ({ players, clues, message }) => {
      console.log("Starting voting phase");
      // Keep clues visible during voting
      if (clues && clues.length > 0) {
        setClues(clues);
      }
      setShowCluePhase(false);
      setShowVotingPhase(true);
      setVotingPlayers(Object.values(players));
      setTotalVotes(Object.keys(players).length);
      setVotesReceived(0);
      setHasVoted(false);
    };

    const handleVoteUpdate = ({
      voter,
      target,
      votesReceived,
      totalPlayers,
    }) => {
      setVotesReceived(votesReceived);
      setTotalVotes(totalPlayers);
    };

    const handleRoundResult = (result) => {
      console.log("Round result:", result);
      setRoundResult(result);
      setIsHost(result.hostId === socket.id);
      setShowVotingPhase(false);
      setShowRoundResult(true);

      // If spy was eliminated, it's game over
      if (result.wasSpyEliminated) {
        setShowGameOver(true);
        setShowRoundResult(false);
        setGameResult(result);
      }
    };

    const handleGameOver = (result) => {
      console.log("Game over:", result);
      setGameResult(result);
      setShowCluePhase(false);
      setShowVotingPhase(false);
      setShowRoundResult(false);
      setShowGameOver(true);
    };

    socket.on("connect", onConnect);
    socket.on("yourRole", handleYourRole);
    socket.on("roundStarted", handleRoundStarted);
    socket.on("clue", handleClue);
    socket.on("clueStatus", handleClueStatus);
    socket.on("startVoting", handleStartVoting);
    socket.on("voteUpdate", handleVoteUpdate);
    socket.on("roundResult", handleRoundResult);
    socket.on("gameOver", handleGameOver);

    return () => {
      socket.off("connect", onConnect);
      socket.off("yourRole", handleYourRole);
      socket.off("roundStarted", handleRoundStarted);
      socket.off("clue", handleClue);
      socket.off("clueStatus", handleClueStatus);
      socket.off("startVoting", handleStartVoting);
      socket.off("voteUpdate", handleVoteUpdate);
      socket.off("roundResult", handleRoundResult);
      socket.off("gameOver", handleGameOver);
      socketInitialized.current = false;
    };
  }, [socket, navigate, playerName, room, currentRole]);

  const handleSendClue = () => {
    const clue = clueInput.trim();
    if (!clue) return;

    console.log("Sending clue:", clue);
    socket.emit("clue", { room, name: playerName, clue });
    setClueInput("");
    setClueInputDisabled(true);
  };

  const handleVote = (targetName) => {
    if (hasVoted) return;

    console.log("Voting for:", targetName);
    socket.emit("vote", { room, playerName, targetName });
    setHasVoted(true);
  };

  const handleNextRound = () => {
    console.log("Host starting next round");
    socket.emit("nextRound", { room });
  };

  const handleBackToLobby = () => {
    navigate(`/lobby?code=${room}`);
  };

  return (
    <div className="bg-dark text-white" style={{ minHeight: "100vh" }}>
      <div className="container py-4">
        {/* Role Display */}
        <div className="text-center mb-4">
          <h1>
            {mode === "WIS" && currentRole === "spy" && "🕵️ You are the SPY"}
            {mode === "WIS" &&
              currentRole === "normal" &&
              "👥 You are a NORMAL Player"}
          </h1>
        </div>

        {/* Word Display */}
        {(showCluePhase || showVotingPhase) && (
          <div
            className={`word-display ${currentRole === "spy" ? "spy" : "normal"
              }`}
          >
            {word}
          </div>
        )}

        {/* Clue Phase */}
        {showCluePhase && (
          <div>
            <div className="alert alert-info">
              <strong>
                Round {round} - Clues received: {cluesGiven}/{totalPlayers}
              </strong>
            </div>

            {/* Player Status */}
            <div className="mt-4">
              <h5>Player Status:</h5>
              <ul className="list-group mb-3">
                {playerStatus.map((player, idx) => (
                  <li
                    key={idx}
                    className={`list-group-item ${player.hasClue
                        ? "bg-success text-white"
                        : "bg-warning text-dark"
                      }`}
                  >
                    <b>{player.name}</b> -{" "}
                    {player.hasClue ? "✓ Clue received" : "⏳ Waiting for clue"}
                  </li>
                ))}
              </ul>
            </div>

            {/* Clue Input */}
            <div className="mt-4">
              <input
                className="form-control"
                placeholder="Enter your clue"
                value={clueInput}
                onChange={(e) => setClueInput(e.target.value)}
                disabled={clueInputDisabled}
                onKeyPress={(e) => e.key === "Enter" && handleSendClue()}
              />
              <button
                className="btn btn-success w-100 mt-2"
                onClick={handleSendClue}
                disabled={clueInputDisabled}
              >
                Send Clue
              </button>
            </div>

            {/* Clues List */}
            <h4 className="mt-4">Clues Received:</h4>
            <ul className="list-group">
              {clues.map((clue, idx) => (
                <li
                  key={idx}
                  className="list-group-item bg-dark text-light mb-2"
                >
                  <b>{clue.name}:</b> {clue.clue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Voting Phase */}
        {showVotingPhase && (
          <div>
            <div className="alert alert-warning">
              <h3>All clues given! Now vote for who is the spy.</h3>
            </div>

            {/* Display clues during voting */}
            {clues.length > 0 && (
              <div className="mb-4">
                <h4>Clues from this round:</h4>
                <ul className="list-group">
                  {clues.map((clue, idx) => (
                    <li
                      key={idx}
                      className="list-group-item bg-dark text-light mb-2"
                    >
                      <b>{clue.name}:</b> {clue.clue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h4 className="mt-4">Vote for the SPY:</h4>
            <div className="list-group mt-3">
              {votingPlayers.map((player, idx) => (
                <button
                  key={idx}
                  className={`btn ${hasVoted ? "btn-danger" : "btn-outline-danger"
                    } w-100 mb-2`}
                  onClick={() => handleVote(player.name)}
                  disabled={hasVoted}
                >
                  {player.name}
                </button>
              ))}
            </div>

            <div className="mt-4 text-center">
              <p>
                <strong>
                  {hasVoted ? "✓ Vote submitted!" : "Waiting for all votes..."}{" "}
                  Votes received: {votesReceived}/{totalVotes}
                </strong>
              </p>
            </div>
          </div>
        )}

        {/* Round Result */}
        {showRoundResult && roundResult && !roundResult.wasSpyEliminated && (
          <div>
            <div className="alert alert-info">
              <h3>{roundResult.message}</h3>
              <p>
                <strong>Eliminated:</strong> {roundResult.eliminated}
              </p>
              <p>
                <strong>The Spy was:</strong> {roundResult.spy}
              </p>
            </div>

            {isHost ? (
              <div className="text-center mt-4">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleNextRound}
                >
                  Start Next Round
                </button>
              </div>
            ) : (
              <div className="alert alert-warning mt-4 text-center">
                <p className="mb-0">
                  Waiting for host to start the next round...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Game Over */}
        {showGameOver && gameResult && (
          <div>
            <div
              className={`alert ${gameResult.wasSpyEliminated ? "alert-success" : "alert-danger"
                }`}
            >
              <h2>{gameResult.message}</h2>
            </div>
            <div className="mt-4 alert alert-info">
              <p>
                <strong>Eliminated:</strong> {gameResult.eliminated}
              </p>
              <p>
                <strong>The Spy was:</strong> {gameResult.spy}
              </p>
            </div>

            {isHost ? (
              <div className="d-grid gap-2 mt-4">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleNextRound}
                >
                  Start New Round
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleBackToLobby}
                >
                  Back to Lobby
                </button>
              </div>
            ) : (
              <div>
                <div className="alert alert-warning mt-4 text-center">
                  <p className="mb-0">
                    Waiting for host to start a new round or return to lobby...
                  </p>
                </div>
                <button
                  className="btn btn-secondary w-100 mt-3"
                  onClick={handleBackToLobby}
                >
                  Leave Game
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Game;
