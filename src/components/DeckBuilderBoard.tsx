"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface Card { id: string; faction: string; name: string; emoji: string; cost: number; effect: any; ally: any; }
interface Player { id: string; name: string; connected: boolean; hp: number; gold: number; combat: number; deckCount: number; discardCount: number; playArea: Card[]; }
interface DeckState { roomId: string; hostId: string; status: "waiting" | "playing" | "ended"; maxPlayers: number; market: Card[]; currentTurnPlayerId: string | null; players: Player[]; myHand?: Card[]; }

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

  if (!gameState || !socket) return <div className="min-h-dvh flex items-center justify-center bg-slate-950 text-white"><div className="text-6xl animate-spin">⚔️</div></div>;

  const isHost = socket.id === gameState.hostId;
  const me = gameState.players.find(p => p.id === socket.id);
  const opponents = gameState.players.filter(p => p.id !== socket.id);

  // ตัวช่วยแสดงสีแฟกชัน
  const getFactionColors = (faction: string) => {
    switch(faction) {
      case 'somom': return "from-red-900 to-red-950 border-red-500 text-red-400";
      case 'angles': return "from-yellow-700 to-yellow-900 border-yellow-400 text-yellow-400";
      case 'musician': return "from-blue-800 to-blue-950 border-blue-400 text-blue-400";
      case 'cassanova': return "from-pink-800 to-pink-950 border-pink-400 text-pink-400";
      default: return "from-gray-700 to-gray-900 border-gray-500 text-gray-300"; 
    }
  };

  const getEffectText = (effect: any) => {
    if (!effect) return ""; let text = [];
    if(effect.gold) text.push(`+${effect.gold} 💰`);
    if(effect.combat) text.push(`+${effect.combat} ⚔️`);
    if(effect.hp) text.push(`${effect.hp > 0 ? '+' : ''}${effect.hp} 💖`);
    if(effect.draw) text.push(`จั่ว ${effect.draw} 🃏`);
    return text.join(" | ");
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-white font-sans flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <header className="bg-black/80 p-4 flex justify-between items-center z-20 border-b border-cyan-500/30">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">⚔️ Deck Builder</h1>
          <p className="text-cyan-300 text-sm">ROOM: {roomId} | ผู้เล่น: {username}</p>
        </div>
      </header>

      {/* --- โหมดรอคน --- */}
      {gameState.status === "waiting" && (
        <main className="flex-1 flex flex-col items-center justify-center p-4 z-10">
          <div className="text-center bg-black/60 p-10 rounded-3xl border border-cyan-900/50 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
            <h2 className="text-3xl font-black mb-4 text-cyan-300">รอปาร์ตี้ ({gameState.players.length}/{gameState.maxPlayers})</h2>
            <div className="flex flex-col gap-3 mt-6">
              {gameState.players.map((p) => (
                <div key={p.id} className="bg-slate-800/80 px-6 py-4 rounded-xl border border-slate-600 flex justify-between items-center min-w-[300px]">
                  <span className="font-bold text-xl">{p.name} {p.id === gameState.hostId && "👑"}</span>
                  <span className={`text-sm font-bold ${p.connected ? 'text-green-400' : 'text-red-400'}`}>{p.connected ? "🟢 พร้อมลุย" : "🔴 เน็ตหลุด"}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button onClick={() => socket.emit("start_deck_game", { roomId })} disabled={gameState.players.length < 2} className="mt-8 px-8 py-4 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 disabled:opacity-50 text-white font-black text-xl rounded-2xl transition-all shadow-lg">
                เริ่มสับไพ่!
              </button>
            ) : (<div className="mt-8 text-cyan-500/70 font-bold text-lg animate-pulse">รอหัวหน้าห้องเริ่มเกม...</div>)}
          </div>
        </main>
      )}

      {/* --- โหมดเล่นเกม (สนามรบ) --- */}
      {gameState.status === "playing" && (
        <div className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto p-2 z-10 overflow-hidden mt-4">
          
          {/* ศัตรู */}
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {opponents.map(op => (
              <div key={op.id} className="flex-1 min-w-[200px] bg-red-950/30 border-2 border-red-900/50 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-red-400 font-bold text-xl">{op.name}</p>
                  <p className="text-xs text-gray-400">ไพ่ในกอง: {op.deckCount} | กองทิ้ง: {op.discardCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-green-400">{op.hp} 💖</p>
                </div>
              </div>
            ))}
          </div>

          {/* ตลาดกลาง */}
          <div className="my-2 p-4 bg-black/60 border border-cyan-900/50 rounded-2xl">
            <h3 className="text-center text-cyan-400 font-black mb-2 tracking-widest">--- ตลาดไพ่ ---</h3>
            <div className="flex justify-center gap-3 overflow-x-auto pb-2">
              {gameState.market.map((card, idx) => (
                <div key={idx} className={`w-32 h-48 flex-shrink-0 bg-gradient-to-b ${getFactionColors(card.faction)} border-2 rounded-xl flex flex-col items-center justify-between p-2 relative shadow-lg`}>
                  <span className="bg-black/70 text-yellow-300 text-xs font-bold px-2 py-1 rounded-full absolute top-1 right-1">💰 {card.cost}</span>
                  <div className="text-4xl mt-4">{card.emoji}</div>
                  <div className="text-center w-full">
                    <p className="text-[11px] font-black uppercase truncate">{card.name}</p>
                    <div className="bg-black/60 mt-1 py-1 rounded text-[10px] text-white font-bold">{getEffectText(card.effect)}</div>
                    {card.ally && Object.keys(card.ally).length > 0 && <div className="text-[9px] text-gray-300 mt-1">🤝 {getEffectText(card.ally)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* สเตตัสของเรา และไพ่บนมือ */}
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex gap-4 mb-2">
              <div className="bg-green-900/80 border-2 border-green-500 p-3 rounded-2xl text-center min-w-[90px]"><p className="text-green-300 text-xs font-bold">HP</p><p className="text-3xl font-black text-white">{me?.hp}</p></div>
              <div className="bg-yellow-900/80 border-2 border-yellow-500 p-3 rounded-2xl text-center min-w-[90px]"><p className="text-yellow-300 text-xs font-bold">Gold</p><p className="text-3xl font-black text-white">{me?.gold}</p></div>
              <div className="bg-red-900/80 border-2 border-red-500 p-3 rounded-2xl text-center min-w-[90px]"><p className="text-red-300 text-xs font-bold">Combat</p><p className="text-3xl font-black text-white">{me?.combat}</p></div>
              <div className="bg-slate-800/80 border-2 border-slate-500 p-3 rounded-2xl flex-1 flex items-center justify-center"><p className="text-slate-400 font-bold">รอระบบเล่นไพ่ในสเต็ปถัดไป...</p></div>
            </div>
            
            <div className="bg-slate-900/70 border-t-2 border-slate-600 rounded-t-2xl p-4 flex justify-center gap-3 overflow-x-auto min-h-[200px]">
              {gameState.myHand?.map((card, idx) => (
                <div key={card.id} className={`w-32 h-48 flex-shrink-0 bg-gradient-to-b ${getFactionColors(card.faction)} border-2 rounded-xl flex flex-col items-center justify-between p-2 hover:-translate-y-4 transition-transform cursor-pointer shadow-lg`}>
                  <div className="text-4xl mt-4">{card.emoji}</div>
                  <div className="text-center w-full">
                    <p className="text-[11px] font-black uppercase truncate">{card.name}</p>
                    <div className="bg-black/60 mt-1 py-1 rounded text-[10px] text-white font-bold">{getEffectText(card.effect)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}