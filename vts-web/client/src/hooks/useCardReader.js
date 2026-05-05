import { useState } from "react";

export default function useCardReader(onCardRead) {
  const [status, setStatus] = useState("idle");
  const [cardData, setCardData] = useState(null);
  const [error, setError] = useState(null);

  const readCard = async () => {
  try {
    setStatus("reading");
    setError(null);

    const response = await fetch("/api/card/read", {  
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Read failed");
    }

    const data = await response.json();
    setCardData(data);
    setStatus("done");
    if (onCardRead) onCardRead(data);

  } catch (err) {
    console.error("❌ ERROR:", err);
    setError(err.message || "Failed to read card");
    setStatus("error");
  }
};
  const clearCard = () => {
    setCardData(null);
    setStatus("idle");
  };

  return { cardData, status, error, readCard, clearCard };
}