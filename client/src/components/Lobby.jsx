import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usePlayerName } from "../hooks/usePlayerName";

const Lobby = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket } = useSocket();
  const { playerName } = usePlayerName();

  const room = searchParams.get("code");
  const [players, setPlayers] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [gameMode, setGameMode] = useState("WIS");
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    if (!playerName || !room) {
      navigate("/");
      return;
    }

    // Join room when component mounts
    socket.emit("joinRoom", { room, name: playerName });

    const handleRoomUpdate = (data) => {
      setPlayers(data.players);
      setHostId(data.host);
      setIsHost(data.host === socket.id);
      setPlayerCount(Object.keys(data.players).length);
    };

    const handleGameError = (message) => {
      alert(message);
    };

    const handleGameStarted = ({ mode, role, word }) => {
      const encodedWord = encodeURIComponent(word);
      navigate(
        `/game?code=${room}&mode=${mode}&role=${role}&word=${encodedWord}`
      );
    };

    socket.on("roomUpdate", handleRoomUpdate);
    socket.on("gameError", handleGameError);
    socket.on("gameStarted", handleGameStarted);

    return () => {
      socket.off("roomUpdate", handleRoomUpdate);
      socket.off("gameError", handleGameError);
      socket.off("gameStarted", handleGameStarted);
    };
  }, [socket, navigate, playerName, room]);

  const handleStartGame = () => {
    socket.emit("startGame", { room, mode: gameMode });
  };

  return (
    <div className="wig-bg">
      <div className="container py-5 text-center">
        <h2 className="page-title mb-3">
          Room Code: <span>{room}</span>
        </h2>

        <h4 className="mb-2 text-light">Players</h4>
        <ul className="list-group mb-4">
          {Object.entries(players).map(([id, player]) => (
            <li key={id} className="list-group-item bg-dark text-light mb-2">
              {player.name} {id === hostId ? "(Host)" : ""}
            </li>
          ))}
        </ul>

        {isHost ? (
          <div>
            <h4 className="text-light mb-2">Select Game Mode</h4>
            <select
              className="form-select wig-input text-center mb-4"
              value={gameMode}
              onChange={(e) => setGameMode(e.target.value)}
              style={{ maxWidth: "300px", margin: "0 auto" }}
            >
              <option value="WIS">WIS – Who Is Spy</option>
            </select>

            <button
              className="wig-btn"
              onClick={handleStartGame}
              disabled={playerCount < 3}
            >
              Start Game
            </button>

            {playerCount < 3 && (
              <p className="text-warning mt-2">
                <small>At least 3 players required to start</small>
              </p>
            )}
          </div>
        ) : (
          <p className="text-light">Waiting for the host to start...</p>
        )}
      </div>
    </div>
  );
};

export default Lobby;
