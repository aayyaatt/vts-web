import { useState } from "react";

export default function useCardReader(onCardRead) {
  const [status, setStatus] = useState("idle");
  const [cardData, setCardData] = useState(null);
  const [error, setError] = useState(null);

  const readCard = async () => {
    try {
      setStatus("reading");

      const response = await fetch("/card-api/api/operation/ReadCard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ReadCardInfo: true,
          ReadPersonalInfo: true,
          ReadAddressDetails: true,
          ReadBiometrics: false,
          ReadEmploymentInfo: false,
          ReadImmigrationDetails: false,
          ReadTrafficDetails: false,
          SilentReading: false,
          ReaderIndex: -1,
          ReaderName: "",
          OutputFormat: "JSON",
          ValidateCard: false
        })
      });

      const data = await response.json();

      console.log("🔥 CARD DATA:", data);

      setCardData(data);
      setStatus("done");

      if (onCardRead) {
        onCardRead(data);
      }

    } catch (err) {
      console.error("❌ ERROR:", err);
      setError("Failed to read card");
      setStatus("error");
    }
  };

  const clearCard = () => {
    setCardData(null);
    setStatus("idle");
  };

  return { cardData, status, error, readCard, clearCard };
}