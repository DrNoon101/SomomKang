"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface Player { id: string; name: string; connected: boolean; }
interface DeckState { id: string; hostId: string; status: "waiting" | "playing" | "ended"; maxPlayers: number; players: Player[]; }

export default function DeckBuilderBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<DeckState | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);

    const attemptJoin = () => {
      const maxPlayers = parseInt(sessionStorage.getItem("deckbuilder_maxPlayers") || "2");
      s.emit("join_deck_room", { roomId, username, maxPlayers });
    };

    s.on("connect", attemptJoin);
    if (s.connected) attemptJoin();

    s.on("deck_state", (state: DeckState) => setGameState(state));
    s.on("deck_error", (msg) => { alert(msg.message); router.push("/"); });

    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  if (!gameState || !socket) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <div className="text-6xl animate-spin mb-4">⚔️</div>
        <h2 className="text-2xl font-bold text-cyan-400 animate-pulse">กำลังเชื่อมต่อค่ายกล...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white font-sans flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <header className="bg-black/80 p-4 flex justify-between items-center z-20 border-b border-cyan-500/30">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">⚔️ Deck Builder</h1>
          <p className="text-cyan-300 text-sm">ROOM: {roomId} | ผู้เล่น: {username}</p>
        </div>
        <button onClick={() => router.push("/")} className="bg-red-900/50 text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white transition">หนีออกจากห้อง</button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10">
        {gameState.status === "waiting" && (
          <div className="text-center bg-black/60 p-10 rounded-3xl border border-cyan-900/50 shadow-[0_0_40px_rgba(6,182,212,0.15)] backdrop-blur-sm">
            <div className="text-8xl mb-6 animate-pulse">🏰</div>
            <h2 className="text-3xl font-black mb-4 text-cyan-300">ลานประลอง ({gameState.players.length}/{gameState.maxPlayers})</h2>
            
            <div className="flex flex-col gap-3 mt-6">
              {gameState.players.map((p) => (
                <div key={p.id} className="bg-slate-800/80 px-6 py-4 rounded-xl border border-slate-600 flex justify-between items-center min-w-[300px]">
                  <span className="font-bold text-xl">{p.name} {p.id === gameState.hostId && "👑"}</span>
                  <span className={`text-sm font-bold ${p.connected ? 'text-green-400' : 'text-red-400'}`}>
                    {p.connected ? "🟢 พร้อมลุย" : "🔴 เน็ตหลุด"}
                  </span>
                </div>
              ))}
            </div>

            {socket.id === gameState.hostId ? (
              <button disabled className="mt-8 px-8 py-4 w-full bg-slate-800 text-slate-500 border-2 border-slate-600 font-black text-xl rounded-2xl cursor-not-allowed">
                รอโค้ชสร้างไพ่ก่อน... (ยังกดไม่ได้)
              </button>
            ) : (
              <div className="mt-8 text-cyan-500/70 font-bold text-lg animate-pulse">รอหัวหน้าห้องเริ่มเกม...</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}