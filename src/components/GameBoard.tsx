"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Card { id: string; suit: string; rank: string; }
interface Player { id: string; name: string; handCount: number; connected: boolean; chips: number; roundChipsChange?: number; hand?: Card[]; points?: number; }
interface GameState { roomId: string; hostId: string; maxPlayers: number; status: "waiting" | "playing" | "ended"; currentTurnPlayerId: string | null; drawPileCount: number; discardTop: Card | null; winnerId: string | null; instantWinType: string | null; endGameReason: string | null; players: Player[]; endedGameData?: any; }

export default function GameBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [flowData, setFlowData] = useState<{ rank: string; fromPlayerId: string } | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);

    const maxPlayers = parseInt(sessionStorage.getItem("somomkang_maxPlayers") || "4");
    s.emit("join_room", { roomId, username, maxPlayers });

    s.on("game_state", (data) => {
      setGameState(data.public);
      setMyHand(data.yourHand);
      // ถ้ารอบเปลี่ยน หรือจบเกม ให้ล้างไพ่ที่เลือกไว้
      if (data.public.status !== "playing") {
        setSelectedCardIds([]);
        setFlowData(null);
      }
    });

    s.on("flow_available", (data) => setFlowData(data));
    s.on("error_message", (msg) => { alert(msg.message); router.push("/"); });

    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  if (!gameState || !socket) return <div className="h-dvh flex items-center justify-center bg-green-950 text-white font-bold text-2xl">กำลังสับไพ่...</div>;

  const isHost = socket.id === gameState.hostId;
  const isMyTurn = socket.id === gameState.currentTurnPlayerId;
  const opponents = gameState.players.filter(p => p.id !== socket.id);
  const me = gameState.players.find(p => p.id === socket.id);

  const toggleCard = (id: string) => {
    setSelectedCardIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleDrawDiscard = () => {
    if (!isMyTurn || selectedCardIds.length === 0) return;
    socket.emit("draw_and_discard", { roomId, discardCardIds: selectedCardIds });
    setSelectedCardIds([]);
    setFlowData(null);
  };

  const handleKang = () => {
    if (!isMyTurn) return;
    socket.emit("kang", { roomId });
  };

  const handleFlow = () => {
    if (!flowData || selectedCardIds.length === 0) return;
    socket.emit("flow_discard", { roomId, cardIds: selectedCardIds });
    setSelectedCardIds([]);
    setFlowData(null);
  };

  // ตัวช่วยวาดไพ่สวยๆ
  const renderCard = (card: Card, isSelected: boolean, onClick?: () => void) => {
    const isRed = card.suit === "hearts" || card.suit === "diamonds";
    const suitSymbol = { hearts: "♥", diamonds: "♦", spades: "♠", clubs: "♣" }[card.suit];
    return (
      <motion.div
        whileHover={onClick ? { y: -10 } : {}}
        onClick={onClick}
        className={`relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl bg-white shadow-xl flex flex-col items-center justify-center text-3xl sm:text-4xl transition-all ${onClick ? "cursor-pointer" : ""} ${isSelected ? "border-4 border-yellow-400 -translate-y-4 shadow-[0_0_20px_gold]" : "border border-gray-300"} ${isRed ? "text-red-500" : "text-black"}`}
      >
        <div className="absolute top-1 left-2 text-sm sm:text-lg font-bold">{card.rank}</div>
        <div>{suitSymbol}</div>
        <div className="absolute bottom-1 right-2 text-sm sm:text-lg font-bold rotate-180">{card.rank}</div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-green-900 to-green-950 text-white font-sans overflow-hidden flex flex-col relative">
      
      {/* Header */}
      <header className="bg-black/40 p-3 sm:p-4 flex justify-between items-center z-10 border-b border-green-500/30">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-500">🃏 SomomKang</h1>
          <p className="text-green-300/70 text-xs sm:text-sm">ห้อง: {roomId}</p>
        </div>
        <div className="bg-green-900/50 px-4 py-2 rounded-xl border border-green-500/50 shadow-inner flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="text-xl font-black text-gold">{me?.chips || 0}</span>
        </div>
      </header>

      {/* หน้าจอรอก่อนเริ่มเกม */}
      {gameState.status === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-4">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-black/50 border-2 border-green-500/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl backdrop-blur-sm">
            <h2 className="text-3xl font-black mb-6">รอลูกวงเข้าโต๊ะ...</h2>
            <div className="bg-black/50 rounded-2xl p-4 mb-6 text-left">
              <h3 className="text-green-400 font-bold mb-3">ผู้เล่น ({gameState.players.length}/{gameState.maxPlayers})</h3>
              <ul className="space-y-2">
                {gameState.players.map((p) => (
                  <li key={p.id} className="flex justify-between bg-green-900/40 p-3 rounded-lg border border-green-500/20">
                    <span className="font-bold">{p.name} {p.id === gameState.hostId && "👑"}</span>
                    <span className={p.connected ? "text-green-400" : "text-red-500"}>{p.connected ? "พร้อม" : "หลุด"}</span>
                  </li>
                ))}
              </ul>
            </div>
            {isHost ? (
              <button onClick={() => socket.emit("start_game", { roomId })} disabled={gameState.players.length < 2} className="w-full py-4 bg-gradient-to-r from-gold to-yellow-500 hover:scale-105 text-black font-black text-xl rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.4)] disabled:opacity-50 transition-all">
                แจกไพ่ลุย!
              </button>
            ) : (
              <p className="text-green-400 font-bold animate-pulse">รอเจ้ามือเปิดโต๊ะ...</p>
            )}
          </motion.div>
        </div>
      )}

      {/* หน้าจอตอนกำลังเล่น */}
      {gameState.status === "playing" && (
        <div className="flex-1 flex flex-col justify-between p-4 z-10 relative">
          
          {/* โซนคู่แข่ง (ด้านบน) */}
          <div className="flex justify-center gap-4 sm:gap-8 mt-4">
            {opponents.map((p) => (
              <div key={p.id} className={`flex flex-col items-center transition-all ${gameState.currentTurnPlayerId === p.id ? "scale-110 drop-shadow-[0_0_15px_gold]" : "opacity-70"}`}>
                <div className="bg-black/60 px-3 py-1 rounded-full text-sm font-bold mb-2 border border-white/10 flex items-center gap-2">
                  {p.name} <span className="text-gold text-xs">💰{p.chips}</span>
                </div>
                <div className="w-16 h-24 bg-gradient-to-br from-blue-700 to-blue-900 rounded-lg border-2 border-white/20 shadow-lg flex items-center justify-center text-white font-black text-2xl relative">
                  🃏
                  <div className="absolute -bottom-3 -right-3 bg-red-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 border-black">
                    {p.handCount}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* โซนกลางโต๊ะ (กองจั่ว & กองทิ้ง) */}
          <div className="flex justify-center items-center gap-8 my-8">
            <div className="flex flex-col items-center">
              <div className="w-20 h-28 sm:w-24 sm:h-36 bg-gradient-to-br from-blue-800 to-indigo-900 rounded-xl border-2 border-white/30 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center text-4xl relative">
                🃏
                <div className="absolute -top-3 -right-3 bg-black/80 px-2 py-1 rounded-full text-xs font-bold border border-white/20">
                  {gameState.drawPileCount} ใบ
                </div>
              </div>
              <span className="mt-2 text-sm font-bold text-green-300">กองจั่ว</span>
            </div>

            <div className="flex flex-col items-center">
              {gameState.discardTop ? (
                renderCard(gameState.discardTop, false)
              ) : (
                <div className="w-20 h-28 sm:w-24 sm:h-36 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center bg-black/20">
                  <span className="text-white/30 text-sm font-bold">ว่างเปล่า</span>
                </div>
              )}
              <span className="mt-2 text-sm font-bold text-red-400">ไพ่ใบบนสุด</span>
            </div>
          </div>

          {/* โซนไพ่ในมือเรา (ด้านล่าง) */}
          <div className="flex flex-col items-center gap-6 mb-4 relative">
            
            {/* สถานะว่าตาใคร */}
            <div className="absolute -top-16 text-center">
              {isMyTurn ? (
                <span className="bg-gold text-black px-6 py-2 rounded-full font-black text-lg shadow-[0_0_20px_gold] animate-bounce inline-block">
                  🔥 ตาของคุณแล้ว! 🔥
                </span>
              ) : (
                <span className="bg-black/60 px-4 py-1 rounded-full text-white/70 font-bold text-sm">
                  รอเพื่อนเล่น...
                </span>
              )}
            </div>

            <div className="flex justify-center gap-[-10px] sm:gap-2 flex-wrap max-w-3xl">
              {myHand.map((card) => (
                <div key={card.id} className="-ml-4 sm:ml-0 first:ml-0">
                  {renderCard(card, selectedCardIds.includes(card.id), () => isMyTurn && toggleCard(card.id))}
                </div>
              ))}
            </div>

            {/* ปุ่ม Action (กดได้เฉพาะตาเรา) */}
            <AnimatePresence>
              {isMyTurn && (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-wrap justify-center gap-3 w-full px-4">
                  <button onClick={handleDrawDiscard} disabled={selectedCardIds.length === 0} className="flex-1 min-w-[120px] bg-blue-500 hover:bg-blue-400 disabled:bg-gray-600 disabled:opacity-50 text-white font-black py-3 px-6 rounded-xl shadow-lg transition-all">
                    จั่ว & ทิ้งไพ่
                  </button>
                  <button onClick={handleKang} className="flex-1 min-w-[120px] bg-red-500 hover:bg-red-400 text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-red-500/50 transition-all">
                    ประกาศ "แคง!"
                  </button>
                  {flowData && (
                    <button onClick={handleFlow} disabled={selectedCardIds.length === 0} className="flex-1 min-w-[120px] bg-purple-500 hover:bg-purple-400 disabled:bg-gray-600 disabled:opacity-50 text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-purple-500/50 transition-all animate-pulse">
                      ไหลไพ่ ({flowData.rank})
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* หน้าจอสรุปผลตอนจบเกม */}
      {gameState.status === "ended" && gameState.endedGameData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-900 border-2 border-gold rounded-3xl p-6 sm:p-10 max-w-2xl w-full shadow-[0_0_50px_rgba(250,204,21,0.3)] my-auto">
            
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-400 drop-shadow-lg">
                ผู้ชนะ: {gameState.endedGameData.winnerName}
              </h2>
              <p className="text-xl text-green-400 font-bold mt-2">
                {gameState.instantWinType ? `🔥 ชนะด้วย: ${gameState.instantWinType} 🔥` : (gameState.endedGameData.endGameReason === "kang" ? "ชนะแคงสวยงาม!" : gameState.endedGameData.endGameReason === "empty_hand" ? "ไพ่หมดมือก่อนชนะ!" : "แคงล่ม! โดนปรับบาน")}
              </p>
            </div>

            <div className="space-y-3">
              {gameState.endedGameData.players.map((p: any) => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${p.id === gameState.endedGameData.winnerId ? "bg-gold/20 border-gold" : "bg-black/50 border-white/10"}`}>
                  <div>
                    <span className="font-bold text-lg block">{p.name}</span>
                    <span className="text-sm text-gray-400">แต้มรวม: {p.points}</span>
                  </div>
                  <div className="flex gap-[-5px]">
                    {p.hand.map((c: Card, i: number) => (
                      <div key={i} className="-ml-3 scale-75 transform origin-right">
                        {renderCard(c, false)}
                      </div>
                    ))}
                  </div>
                  <div className={`font-black text-xl ${p.roundChipsChange > 0 ? "text-green-400" : p.roundChipsChange < 0 ? "text-red-500" : "text-gray-400"}`}>
                    {p.roundChipsChange > 0 ? `+${p.roundChipsChange}` : p.roundChipsChange}
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <button onClick={() => socket.emit("play_again", { roomId })} className="w-full mt-8 py-4 bg-gradient-to-r from-gold to-yellow-500 hover:scale-105 text-black font-black text-xl rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-all">
                ล้างไพ่ เล่นตาต่อไป!
              </button>
            )}
          </motion.div>
        </div>
      )}

    </div>
  );
}