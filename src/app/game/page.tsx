"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import GameBoard from "@/components/GameBoard";
import Link from "next/link";

function GameContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "Demo";
  const [username, setUsername] = useState("คุณ");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(sessionStorage.getItem("somomkang_username") || "คุณ");
    }
  }, []);

  return (
    <div className="relative h-dvh">
      <GameBoard roomId={roomId} username={username} />
      {/* Back to Lobby - for Step 1 testing */}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh flex items-center justify-center bg-felt">
          <span className="text-gold animate-pulse">กำลังโหลด...</span>
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
