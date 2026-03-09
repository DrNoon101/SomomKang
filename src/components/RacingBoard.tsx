"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Racer { id: number; name: string; emoji: string; progress: number; }
interface Player { id: string; name: string; connected: boolean; chips: number; betAmount: number; betRacerId: number | null; wonAmount: number; }
interface RacingState { roomId: string; hostId: string; status: "waiting" | "playing" | "ended"; players: Player[]; racers: Racer[]; winnerRacerId: number | null; totalPool: number; maxPlayers: number; }

export default function RacingBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<RacingState | null>(null);
  const [betAmountInput, setBetAmountInput] = useState(100);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);
    const maxPlayers = parseInt(sessionStorage.getItem("racing_maxPlayers") || "8");
    s.emit("join_racing_room", { roomId, username, maxPlayers });

    s.on("racing_state", (state) => setGameState(state));
    s.on("racing_error", (msg) => { alert(msg.message); router.push("/"); });

    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  if (!gameState || !socket) return null;

  const isHost = socket.id === gameState.hostId;
  const me = gameState.players.find(p => p.id === socket.id);

  const handleBet = (racerId: number) => {
    if (gameState.status !== "waiting" || !me || me.chips < betAmountInput) return;
    socket.emit("place_bet", { roomId, racerId, amount: betAmountInput });
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-orange-950 to-stone-900 text-white font-sans overflow-hidden flex flex-col relative">
      
      {/* Header */}
      <header className="bg-black/60 p-4 flex justify-between items-center z-20 border-b border-orange-500/30">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">🐎 แข่งม้ามรณะ</h1>
          <p className="text-orange-300 text-sm">ROOM: {roomId}</p>
        </div>
        <div className="bg-black/50 px-5 py-2 rounded-xl border border-gold/50 flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="text-xl font-black text-gold">{me?.chips || 0}</span>
        </div>
      </header>

      {/* กองกลาง */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 text-center">
        <div className="bg-red-900/80 px-8 py-3 rounded-full border-4 border-gold shadow-[0_0_30px_rgba(250,204,21,0.5)]">
          <span className="text-white font-bold text-sm block">เงินรางวัลรวม (กองกลาง)</span>
          <span className="text-4xl font-black text-gold drop-shadow-md">{gameState.totalPool} 💰</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto p-4 z-10 mt-16">
        
        {/* สนามแข่ง */}
        <div className="bg-green-900/40 rounded-3xl border-4 border-orange-800 p-4 sm:p-8 flex flex-col gap-4 relative overflow-hidden shadow-2xl">
          {/* เส้นชัย */}
          <div className="absolute top-0 bottom-0 right-10 sm:right-20 w-4 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] border-l-4 border-white/50 z-0 opacity-80"></div>

          {gameState.racers.map((racer) => (
            <div key={racer.id} className="relative w-full h-16 sm:h-20 bg-stone-800/80 rounded-full border-2 border-stone-600 flex items-center px-4 overflow-hidden group">
              
              {/* ชื่อนักแข่ง */}
              <div className="absolute left-4 z-10 font-black text-white/50 group-hover:text-white/80 transition-all text-sm sm:text-lg">
                #{racer.id} {racer.name}
              </div>

              {/* แท่งวิ่ง (Progress) */}
              <motion.div 
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-600 to-yellow-500 opacity-20"
                animate={{ width: `${racer.progress}%` }} transition={{ ease: "linear", duration: 0.5 }}
              />

              {/* ตัวละคร */}
              <motion.div 
                className="absolute z-20 text-4xl sm:text-5xl drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                animate={{ left: `calc(${racer.progress}% - 30px)`, y: gameState.status === "playing" ? [-5, 5, -5] : 0 }} 
                transition={{ left: { ease: "linear", duration: 0.5 }, y: { repeat: Infinity, duration: 0.2 } }}
              >
                {racer.emoji}
              </motion.div>

              {/* ปุ่มแทง (โชว์เฉพาะตอนรอเล่น) */}
              {gameState.status === "waiting" && (
                <button onClick={() => handleBet(racer.id)} className={`absolute right-4 z-30 px-6 py-2 rounded-full font-black text-sm transition-all ${me?.betRacerId === racer.id ? "bg-gold text-black shadow-[0_0_15px_gold]" : "bg-black/50 text-white hover:bg-orange-500 hover:text-white border border-white/20"}`}>
                  {me?.betRacerId === racer.id ? `แทงแล้ว (${me.betAmount})` : "เดิมพัน!"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* แผงควบคุมด้านล่าง */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-black/50 p-6 rounded-3xl border border-white/10 gap-6">
          
          <div className="flex-1">
            <h3 className="text-orange-400 font-bold mb-2">รายชื่อนักลงทุน ({gameState.players.length}/{gameState.maxPlayers})</h3>
            <div className="flex flex-wrap gap-2">
              {gameState.players.map(p => (
                <div key={p.id} className={`px-3 py-1 rounded-full text-xs font-bold border ${p.betRacerId ? "bg-orange-500/20 text-orange-300 border-orange-500" : "bg-gray-800 text-gray-400 border-gray-600"}`}>
                  {p.name} {p.betRacerId && `(แทง #${p.betRacerId})`}
                </div>
              ))}
            </div>
          </div>

          {gameState.status === "waiting" && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-xl">
                <span className="text-gray-400 text-sm">ลงเดิมพันตาละ:</span>
                <select value={betAmountInput} onChange={(e) => setBetAmountInput(Number(e.target.value))} className="bg-transparent text-gold font-black text-xl outline-none cursor-pointer">
                  <option value={50}>50 💰</option>
                  <option value={100}>100 💰</option>
                  <option value={500}>500 💰</option>
                  <option value={1000}>1,000 💰</option>
                </select>
              </div>

              {isHost && (
                <button onClick={() => socket.emit("start_race", { roomId })} disabled={gameState.players.length < 1} className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-red-600 to-orange-500 hover:scale-105 disabled:opacity-50 text-white font-black text-xl rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all uppercase">
                  ปล่อยม้า!
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* หน้าจอสรุปผล */}
      {gameState.status === "ended" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-stone-900 border-4 border-gold rounded-3xl p-8 max-w-lg w-full text-center shadow-[0_0_50px_rgba(250,204,21,0.5)]">
            <div className="text-7xl mb-4">🏆</div>
            <h2 className="text-4xl font-black text-white mb-2">ผู้ชนะคือ...</h2>
            <div className="text-5xl font-black text-gold mb-6 animate-pulse">
              {gameState.racers.find(r => r.id === gameState.winnerRacerId)?.emoji} {gameState.racers.find(r => r.id === gameState.winnerRacerId)?.name}
            </div>

            <div className="bg-black/50 rounded-2xl p-4 mb-6">
              <h3 className="text-gray-400 font-bold mb-3">ผลประกอบการ</h3>
              <ul className="space-y-2 text-left">
                {gameState.players.map(p => (
                  <li key={p.id} className={`flex justify-between p-3 rounded-lg border ${p.wonAmount > 0 ? "bg-green-900/40 border-green-500 text-green-400" : "bg-red-900/20 border-red-900 text-gray-500"}`}>
                    <span className="font-bold">{p.name}</span>
                    <span className="font-black text-lg">{p.wonAmount > 0 ? `ได้ +${p.wonAmount} 💰` : `เสีย -${p.betAmount} 💰`}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost && (
              <button onClick={() => socket.emit("reset_race", { roomId })} className="w-full py-4 bg-gradient-to-r from-gold to-yellow-500 text-black font-black text-xl rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(250,204,21,0.5)]">
                เล่นตาต่อไป!
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}