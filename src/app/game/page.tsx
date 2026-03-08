"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameBoard from "../../components/GameBoard";

function SomomkangContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "Lobby";
  const [username, setUsername] = useState("เซียนไพ่");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(sessionStorage.getItem("somomkang_username") || "เซียนไพ่");
    }
  }, []);

  return <GameBoard roomId={roomId} username={username} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="h-dvh flex items-center justify-center bg-green-900 text-white font-bold text-xl animate-pulse">กำลังปูเสื่อตั้งวงไพ่...</div>}>
      <SomomkangContent />
    </Suspense>
  );
}