import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerName } from "../hooks/usePlayerName";

const Home = () => {
  const navigate = useNavigate();
  const { savePlayerName } = usePlayerName();
  const [name, setName] = useState("");

  const handleStartGame = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("Please enter your name!");
      return;
    }
    savePlayerName(trimmedName);
    navigate("/room");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleStartGame();
    }
  };

  return (
    <div className="wig-bg">
      <div
        className="container d-flex flex-column justify-content-center align-items-center"
        style={{ height: "100vh" }}
      >
        <h1 className="wig-title mb-4">WIG</h1>

        <input
          id="playerName"
          className="form-control wig-input text-center mb-4"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        <button className="wig-btn" onClick={handleStartGame}>
          PLAY
        </button>
      </div>
    </div>
  );
};

export default Home;
