import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usePlayerName } from "../hooks/usePlayerName";

const Room = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { playerName } = usePlayerName();
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!playerName) {
      navigate("/");
      return;
    }

    const handleRoomCreated = (code) => {
      setTimeout(() => {
        navigate(`/lobby?code=${code}`);
      }, 100);
    };

    socket.on("roomCreated", handleRoomCreated);

    return () => {
      socket.off("roomCreated", handleRoomCreated);
    };
  }, [socket, navigate, playerName]);

  const handleCreateRoom = () => {
    socket.emit("createRoom", { name: playerName });
  };

  const handleJoinRoom = () => {
    const room = joinCode.trim();
    if (!room) {
      alert("Enter a room code!");
      return;
    }
    socket.emit("joinRoom", { room, name: playerName });
    navigate(`/lobby?code=${room}`);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  };

  return (
    <div className="wig-bg">
      <div
        className="container d-flex flex-column justify-content-center align-items-center"
        style={{ height: "100vh" }}
      >
        <h1 className="page-title mb-4">Room Setup</h1>

        <h4 className="text-light mb-4">Player: {playerName}</h4>

        <button className="wig-btn mb-4" onClick={handleCreateRoom}>
          Create Room
        </button>

        <input
          id="joinCode"
          className="form-control wig-input text-center mb-3"
          placeholder="Enter room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        <button className="wig-btn" onClick={handleJoinRoom}>
          Join Room
        </button>
      </div>
    </div>
  );
};

export default Room;
