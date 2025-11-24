import { useState, useEffect } from "react";

export const usePlayerName = () => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem("playerName") || "";
  });

  const savePlayerName = (name) => {
    localStorage.setItem("playerName", name);
    setPlayerName(name);
  };

  const clearPlayerName = () => {
    localStorage.removeItem("playerName");
    setPlayerName("");
  };

  return { playerName, savePlayerName, clearPlayerName };
};
