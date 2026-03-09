"use client";

import { useEffect, useState } from "react";
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
  const [betAmountInput, setBetAmountInput] = useState(500); // ✨ ค่าเริ่มต้นให้แทงตาละ 500

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
        <div className="bg-black/50 px-5 py-2 rounded-xl border border-gold/50 flex items-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <span className="text-xl">💰</span>
          <span className="text-xl font-black text-gold">{me?.chips || 0}</span>
        </div>
      </header>

      {/* กองกลาง */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 text-center w-full max-w-xs px-4">
        <div className="bg-red-900/90 backdrop-blur-sm px-6 sm:px-8 py-3 sm:py-4 rounded-full border-4 border-gold shadow-[0_0_30px_rgba(250,204,21,0.5)]">
          <span className="text-white font-bold text-xs sm:text-sm block uppercase tracking-wider">เงินรางวัลรวม (กองกลาง)</span>
          <span className="text-3xl sm:text-5xl font-black text-gold drop-shadow-lg">{gameState.totalPool} 💰</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto p-4 z-10 mt-24 sm:mt-28">
        
        {/* สนามแข่ง */}
        <div className="bg-green-900/40 backdrop-blur-sm rounded-3xl border-4 border-orange-800 p-4 sm:p-8 flex flex-col gap-4 sm:gap-5 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* เส้นชัย */}
          <div className="absolute top-0 bottom-0 right-10 sm:right-20 w-6 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] border-l-4 border-r-4 border-white/80 z-0 opacity-90 shadow-[0_0_20px_white]"></div>

          {gameState.racers.map((racer) => (
            <div key={racer.id} className="relative w-full h-16 sm:h-24 bg-stone-800/80 rounded-full border-2 border-stone-600 flex items-center px-4 overflow-hidden group shadow-inner">
              
              {/* ชื่อนักแข่ง */}
              <div className="absolute left-4 sm:left-6 z-10 font-black text-white/60 group-hover:text-white transition-all text-sm sm:text-xl drop-shadow-md">
                #{racer.id} {racer.name}
              </div>

              {/* แท่งวิ่ง (Progress) */}
              <motion.div 
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-600 to-yellow-500 opacity-30"
                animate={{ width: `${racer.progress}%` }} transition={{ ease: "linear", duration: 0.5 }}
              />

              {/* ตัวละคร */}
              <motion.div 
                className="absolute z-20 text-4xl sm:text-6xl drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]"
                animate={{ left: `calc(${racer.progress}% - 30px)`, y: gameState.status === "playing" ? [-5, 5, -5] : 0 }} 
                transition={{ left: { ease: "linear", duration: 0.5 }, y: { repeat: Infinity, duration: 0.2 } }}
              >
                {racer.emoji}
              </motion.div>

              {/* ปุ่มแทง (โชว์เฉพาะตอนรอเล่น) */}
              {gameState.status === "waiting" && (
                <button 
                  onClick={() => handleBet(racer.id)} 
                  disabled={(me?.chips || 0) < betAmountInput && me?.betRacerId !== racer.id}
                  className={`absolute right-4 z-30 px-4 sm:px-8 py-2 sm:py-3 rounded-full font-black text-xs sm:text-base transition-all ${me?.betRacerId === racer.id ? "bg-gold text-black shadow-[0_0_20px_gold] scale-105" : "bg-black/60 text-white hover:bg-orange-500 border border-white/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-black/60"}`}
                >
                  {me?.betRacerId === racer.id ? `แทงแล้ว (${me.betAmount})` : "เดิมพัน!"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* แผงควบคุมด้านล่าง (อัปเกรดใหม่!) */}
        <div className="mt-6 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-black/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border-2 border-orange-500/30 gap-8 shadow-2xl">
          
          {/* ✨ บอร์ดประจานการลงทุน */}
          <div className="flex-1 w-full">
            <h3 className="text-orange-400 font-black text-lg mb-4 flex items-center gap-2">
              📊 บอร์ดนักลงทุน ({gameState.players.length}/{gameState.maxPlayers})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
              {gameState.players.map(p => {
                const betRacer = gameState.racers.find(r => r.id === p.betRacerId);
                return (
                  <div key={p.id} className={`px-4 py-3 rounded-2xl text-sm font-bold border-2 flex items-center justify-between transition-all ${p.betRacerId ? "bg-gradient-to-r from-orange-900/50 to-orange-800/30 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]" : "bg-gray-800/50 text-gray-400 border-gray-600"}`}>
                    <span className="truncate pr-2 text-base">{p.name}</span>
                    {p.betRacerId ? (
                      <span className="bg-black/80 px-3 py-1.5 rounded-xl text-gold font-black whitespace-nowrap border border-gold/30 shadow-inner">
                        {betRacer?.emoji} แทง {p.betAmount}
                      </span>
                    ) : (
                      <span className="text-xs animate-pulse whitespace-nowrap bg-black/40 px-3 py-1.5 rounded-xl">กำลังดูเชิง...</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ปุ่มเริ่มเกมและตัวเลือกชิป */}
          {gameState.status === "waiting" && (
            <div className="flex flex-col items-center gap-4 w-full lg:w-auto shrink-0">
              <div className="flex items-center justify-between w-full bg-black/80 px-6 py-4 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-gray-400 font-bold mr-4">ลงเดิมพันตาละ:</span>
                <select value={betAmountInput} onChange={(e) => setBetAmountInput(Number(e.target.value))} className="bg-transparent text-gold font-black text-2xl outline-none cursor-pointer text-right">
                  <option value={100}>100 💰</option>
                  <option value={500}>500 💰</option>
                  <option value={1000}>1,000 💰</option>
                  <option value={2500}>2,500 💰 (All in!)</option>
                </select>
              </div>

              {isHost ? (
                <button onClick={() => socket.emit("start_race", { roomId })} disabled={gameState.players.length < 1} className="w-full px-10 py-5 bg-gradient-to-r from-red-600 via-orange-500 to-red-500 hover:scale-105 disabled:opacity-50 text-white font-black text-2xl rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.5)] transition-all uppercase tracking-widest border-2 border-red-400">
                  ปล่อยม้า!
                </button>
              ) : (
                <div className="w-full px-10 py-5 bg-gray-800 text-gray-400 font-black text-xl rounded-2xl text-center border-2 border-gray-600 animate-pulse">
                  รอเจ้ามือปล่อยม้า...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* หน้าจอสรุปผล */}
      {gameState.status === "ended" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0, rotateX: 20 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} className="bg-gradient-to-b from-stone-900 to-black border-4 border-gold rounded-3xl p-8 sm:p-10 max-w-xl w-full text-center shadow-[0_0_80px_rgba(250,204,21,0.5)] relative overflow-hidden">
            
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/20 blur-[100px] rounded-full"></div>
            
            <div className="text-7xl sm:text-8xl mb-4 drop-shadow-[0_0_20px_gold]">🏆</div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">ผู้ชนะเข้าเส้นชัยคือ...</h2>
            <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-400 mb-8 animate-bounce drop-shadow-lg">
              {gameState.racers.find(r => r.id === gameState.winnerRacerId)?.emoji} {gameState.racers.find(r => r.id === gameState.winnerRacerId)?.name}
            </div>

            <div className="bg-black/60 rounded-2xl p-6 mb-8 border border-white/10 shadow-inner">
              <h3 className="text-gray-400 font-bold mb-4 text-lg">💰 สรุปผลประกอบการ</h3>
              <ul className="space-y-3 text-left max-h-48 overflow-y-auto pr-2">
                {gameState.players.map(p => (
                  <li key={p.id} className={`flex justify-between items-center p-4 rounded-xl border-2 ${p.wonAmount > 0 ? "bg-green-900/40 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "bg-red-900/20 border-red-900/50 text-gray-500"}`}>
                    <span className="font-bold text-lg">{p.name}</span>
                    <span className="font-black text-xl sm:text-2xl">{p.wonAmount > 0 ? `+${p.wonAmount} 💰` : `-${p.betAmount} 💰`}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost && (
              <button onClick={() => socket.emit("reset_race", { roomId })} className="w-full py-5 bg-gradient-to-r from-gold via-yellow-400 to-amber-500 text-black font-black text-2xl rounded-2xl hover:scale-105 transition-all shadow-[0_10px_0_#a16207] hover:shadow-[0_10px_30px_rgba(250,204,21,0.6)] uppercase tracking-widest border border-yellow-200">
                เปิดสนามตาต่อไป!
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}