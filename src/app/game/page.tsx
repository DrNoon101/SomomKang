"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameBoard from "../../components/GameBoard";

function SomomkangContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "VIP-Room";
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
    <Suspense fallback={
      <div className="h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-green-900 to-black text-white font-bold text-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse"></div>
        <div className="text-6xl mb-4 animate-bounce drop-shadow-[0_0_20px_gold]">🃏</div>
        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-400">กำลังปูพรมแดงเข้าโต๊ะไพ่...</div>
      </div>
    }>
      <SomomkangContent />
    </Suspense>
  );
}