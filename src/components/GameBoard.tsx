"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Card { id: string; suit: string; rank: string; }
interface Player { id: string; name: string; handCount: number; connected: boolean; chips: number; roundChipsChange?: number; hand?: Card[]; points?: number; }
interface GameState { roomId: string; hostId: string; maxPlayers: number; status: "waiting" | "playing" | "ended"; currentTurnPlayerId: string | null; drawPileCount: number; discardTop: Card | null; winnerId: string | null; instantWinType: string | null; endGameReason: string | null; players: Player[]; endedGameData?: any; }

const SFX_SELECT = "https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3";
const SFX_PLAY = "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3";
const SFX_KANG = "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3";

export default function GameBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [flowData, setFlowData] = useState<{ rank: string; fromPlayerId: string } | null>(null);
  
  const [gotFlowed, setGotFlowed] = useState(false);
  const [recentFlowPlayerId, setRecentFlowPlayerId] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const bgmRef = useRef<HTMLAudioElement>(null);

  const playSound = (url: string) => {
    if (!isMuted) {
      const audio = new Audio(url);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);

    const maxPlayers = parseInt(sessionStorage.getItem("somomkang_maxPlayers") || "4");
    s.emit("join_room", { roomId, username, maxPlayers });

    s.on("game_state", (data) => {
      setGameState(data.public);
      setMyHand(data.yourHand);
      if (data.public.status !== "playing") {
        setSelectedCardIds([]);
        setFlowData(null);
      }
    });

    s.on("flow_available", (data) => setFlowData(data));
    s.on("error_message", (msg) => { alert(msg.message); router.push("/"); });

    s.on("got_flowed_mock", () => {
      setGotFlowed(true);
      setTimeout(() => setGotFlowed(false), 3000);
    });

    s.on("player_flowed", ({ playerId }) => {
      setRecentFlowPlayerId(playerId);
      setTimeout(() => setRecentFlowPlayerId(null), 3000);
    });

    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  useEffect(() => {
    if (bgmRef.current) {
      if (isMuted) bgmRef.current.pause();
      else bgmRef.current.play().catch(() => setIsMuted(true));
    }
  }, [isMuted]);

  if (!gameState || !socket) return null;

  const isHost = socket.id === gameState.hostId;
  const isMyTurn = socket.id === gameState.currentTurnPlayerId;
  const opponents = gameState.players.filter(p => p.id !== socket.id);
  const me = gameState.players.find(p => p.id === socket.id);

  const canFlow = flowData && myHand.some(card => card.rank === flowData.rank);

  const toggleCard = (id: string) => {
    playSound(SFX_SELECT);
    setSelectedCardIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleDrawDiscard = () => {
    if (!isMyTurn || selectedCardIds.length === 0) return;
    playSound(SFX_PLAY);
    socket.emit("draw_and_discard", { roomId, discardCardIds: selectedCardIds });
    setSelectedCardIds([]); setFlowData(null);
  };

  const handleKang = () => { 
    if (isMyTurn) {
      playSound(SFX_KANG);
      socket.emit("kang", { roomId }); 
    }
  };

  const handleFlow = () => {
    if (!flowData || selectedCardIds.length === 0) return;
    playSound(SFX_PLAY);
    socket.emit("flow_discard", { roomId, cardIds: selectedCardIds });
    setSelectedCardIds([]); setFlowData(null);
  };

  // 🃏 ย่อขนาดไพ่ลงให้เล็กลงพอดีโต๊ะ
  const renderCard = (card: Card, isSelected: boolean, onClick?: () => void) => {
    const isRed = card.suit === "hearts" || card.suit === "diamonds";
    const suitSymbol = { hearts: "♥", diamonds: "♦", spades: "♠", clubs: "♣" }[card.suit];
    return (
      <motion.div
        whileHover={onClick ? { y: -10, scale: 1.05 } : {}}
        onClick={onClick}
        className={`relative w-16 h-24 sm:w-20 sm:h-32 rounded-xl bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-white shadow-xl flex flex-col items-center justify-center text-3xl sm:text-4xl transition-all duration-200 ${onClick ? "cursor-pointer" : ""} ${isSelected ? "border-4 border-gold -translate-y-4 shadow-[0_0_20px_gold] z-20" : "border border-gray-300 z-10"} ${isRed ? "text-red-600" : "text-gray-900"}`}
      >
        <div className="absolute top-1 left-2 text-sm sm:text-base font-black">{card.rank}</div>
        <div className="drop-shadow-sm">{suitSymbol}</div>
        <div className="absolute bottom-1 right-2 text-sm sm:text-base font-black rotate-180">{card.rank}</div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-green-950 via-green-900 to-black text-white font-sans overflow-hidden flex flex-col relative">
      
      <AnimatePresence>
        {gotFlowed && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }} 
            animate={{ scale: [0, 1.5, 1], rotate: [-10, 10, -5, 0], opacity: 1 }} 
            exit={{ scale: 0, opacity: 0 }} 
            transition={{ duration: 0.5, type: "spring" }}
            className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_50px_red] uppercase rotate-[-5deg] bg-red-600/90 px-10 py-6 rounded-3xl border-8 border-white shadow-[0_20px_50px_rgba(220,38,38,0.8)]">
              💥 โดนไปดิ! 💥
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={bgmRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" loop />
      
      {/* ✨ คืนชีพพื้นหลังเคลื่อนไหว (สัญลักษณ์ไพ่ลอยได้) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-20 left-10 text-9xl text-gold opacity-10 blur-[2px]">♠</motion.div>
        <motion.div animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute bottom-40 right-10 text-9xl text-red-500 opacity-10 blur-[2px]">♥</motion.div>
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }} className="absolute top-1/3 right-1/4 text-8xl text-red-500 opacity-10 blur-[3px]">♦</motion.div>
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute bottom-1/4 left-1/3 text-8xl text-gold opacity-10 blur-[3px]">♣</motion.div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
      </div>

      <header className="bg-black/60 backdrop-blur-md p-4 flex justify-between items-center z-20 border-b border-gold/30 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-yellow-300 to-amber-500 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            SomomKang VIP
          </h1>
          <p className="text-green-400 font-bold text-sm tracking-widest mt-1">ROOM: {roomId}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMuted(!isMuted)} className={`text-2xl p-2 rounded-full transition-all ${isMuted ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400 drop-shadow-[0_0_10px_#4ade80]"}`}>
            {isMuted ? "🔇" : "🔊"}
          </button>
          <div className="bg-gradient-to-r from-yellow-900/50 to-black px-5 py-2 rounded-xl border border-gold/50 shadow-[0_0_15px_rgba(250,204,21,0.2)] flex items-center gap-2">
            <span className="text-2xl animate-pulse">💰</span>
            <span className="text-xl sm:text-2xl font-black text-gold drop-shadow-md">{me?.chips || 0}</span>
          </div>
        </div>
      </header>

      {gameState.status === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/70 border-2 border-gold/50 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(250,204,21,0.15)] backdrop-blur-xl">
            <div className="text-6xl mb-4 animate-bounce">🎰</div>
            <h2 className="text-3xl font-black text-white mb-6">โต๊ะวีไอพีรอเซียนไพ่</h2>
            
            <div className="bg-black/50 rounded-2xl p-4 mb-6 text-left border border-white/10">
              <h3 className="text-gold font-bold mb-3 flex justify-between">
                <span>ลูกวง</span>
                <span>{gameState.players.length} / {gameState.maxPlayers}</span>
              </h3>
              <ul className="space-y-3">
                {gameState.players.map((p) => (
                  <li key={p.id} className="flex justify-between items-center bg-green-900/30 p-3 rounded-xl border border-green-500/30">
                    <span className="font-bold text-lg text-white flex items-center gap-2">
                      {p.name} {p.id === gameState.hostId && <span className="text-xl" title="เจ้ามือ">👑</span>}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.connected ? "bg-green-500/20 text-green-400 border border-green-400/50" : "bg-red-500/20 text-red-400"}`}>
                      {p.connected ? "นั่งโต๊ะแล้ว" : "เน็ตหลุด"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            {isHost ? (
              <button onClick={() => socket.emit("start_game", { roomId })} disabled={gameState.players.length < 2} className="w-full py-4 bg-gradient-to-r from-gold via-yellow-400 to-amber-500 hover:scale-105 text-black font-black text-2xl rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider">
                เริ่มแจกไพ่!
              </button>
            ) : (
              <div className="text-gold font-bold text-lg animate-pulse bg-gold/10 py-3 rounded-xl border border-gold/20">รอเจ้ามือสับไพ่...</div>
            )}
          </motion.div>
        </div>
      )}

      {gameState.status === "playing" && (
        <div className="flex-1 flex flex-col justify-between p-4 z-10 relative">
          
          <div className="flex justify-center gap-4 sm:gap-8 mt-4 relative">
            {opponents.map((p) => (
              <div key={p.id} className={`flex flex-col items-center transition-all duration-300 ${gameState.currentTurnPlayerId === p.id ? "scale-110 drop-shadow-[0_0_20px_gold]" : "opacity-80"} relative`}>
                
                <AnimatePresence>
                  {recentFlowPlayerId === p.id && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: -20, opacity: 1 }} exit={{ opacity: 0 }} className="absolute -top-10 z-50 bg-purple-600 text-white px-4 py-1 rounded-full font-black text-sm border-2 border-white shadow-[0_0_15px_purple] animate-bounce whitespace-nowrap">
                      🌊 ไหลเว้ย!
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold mb-2 border ${gameState.currentTurnPlayerId === p.id ? "bg-gold text-black border-yellow-300 shadow-[0_0_15px_gold]" : "bg-black/60 text-white border-white/20"} flex items-center gap-2`}>
                  {p.name} <span className={gameState.currentTurnPlayerId === p.id ? "text-black" : "text-gold"}>💰{p.chips}</span>
                </div>
                {/* 🃏 ย่อขนาดหลังไพ่คู่แข่งด้วย */}
                <div className="w-12 h-16 sm:w-16 sm:h-24 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-gradient-to-br from-red-800 to-red-950 rounded-xl border-2 border-gold/50 shadow-xl flex items-center justify-center relative">
                  <div className="w-8 h-12 sm:w-10 sm:h-16 border border-gold/30 rounded-lg"></div>
                  <div className="absolute -bottom-2 -right-2 bg-black text-white w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-gold shadow-lg">
                    {p.handCount}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center items-center gap-6 sm:gap-10 my-4 sm:my-8">
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center cursor-pointer">
              {/* 🃏 ย่อขนาดกองจั่ว */}
              <div className="w-16 h-24 sm:w-20 sm:h-32 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-gradient-to-br from-red-800 to-red-950 rounded-xl border-2 border-gold shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center relative">
                <div className="w-12 h-20 sm:w-14 sm:h-24 border border-gold/30 rounded-lg flex items-center justify-center text-gold opacity-50 text-2xl sm:text-3xl">🂠</div>
                <div className="absolute -top-3 -right-3 bg-gold text-black px-2 py-1 rounded-full text-xs font-black border-2 border-black shadow-lg">
                  {gameState.drawPileCount}
                </div>
              </div>
              <span className="mt-3 px-3 py-1 bg-black/50 rounded-full text-xs font-bold text-gold border border-gold/30">กองจั่ว</span>
            </motion.div>

            <div className="flex flex-col items-center">
              {/* 🃏 ย่อขนาดกองทิ้ง */}
              {gameState.discardTop ? (
                renderCard(gameState.discardTop, false)
              ) : (
                <div className="w-16 h-24 sm:w-20 sm:h-32 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <span className="text-white/30 font-bold text-xs">ว่างเปล่า</span>
                </div>
              )}
              <span className="mt-3 px-3 py-1 bg-black/50 rounded-full text-xs font-bold text-red-400 border border-red-500/30">ไพ่ใบบนสุด</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 sm:gap-6 mb-2 relative z-20">
            
            <AnimatePresence>
              {recentFlowPlayerId === socket.id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }} className="absolute -top-24 sm:-top-32 z-50 bg-purple-600 text-white px-6 py-2 rounded-full font-black text-lg border-2 border-white shadow-[0_0_30px_purple] animate-bounce">
                  🌊 คุณไหลไพ่!
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isMyTurn && !recentFlowPlayerId && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-16 sm:-top-20 text-center z-30">
                  <span className="bg-gradient-to-r from-gold to-yellow-500 text-black px-6 py-2 rounded-full font-black text-sm sm:text-lg shadow-[0_0_20px_gold] animate-pulse border-2 border-white inline-block">
                    🔥 ตาของคุณแล้ว! จัดไป! 🔥
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center gap-[-10px] sm:gap-[-5px] flex-wrap max-w-4xl px-2">
              {myHand.map((card) => (
                <div key={card.id} className="-ml-6 sm:-ml-4 first:ml-0 hover:z-30 transition-all duration-200">
                  {renderCard(card, selectedCardIds.includes(card.id), () => isMyTurn && toggleCard(card.id))}
                </div>
              ))}
            </div>

            <AnimatePresence>
              {isMyTurn && (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-wrap justify-center gap-3 w-full px-2 mt-2">
                  <button onClick={handleDrawDiscard} disabled={selectedCardIds.length === 0} className="min-w-[110px] sm:min-w-[140px] bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-300 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-900 disabled:text-gray-500 text-white font-black py-3 px-4 sm:px-8 rounded-xl sm:rounded-2xl shadow-[0_6px_0_#1e3a8a] disabled:shadow-none hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(59,130,246,0.5)] transition-all text-sm sm:text-lg">
                    จั่ว & ทิ้งไพ่
                  </button>
                  <button onClick={handleKang} className="min-w-[110px] sm:min-w-[140px] bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-black py-3 px-4 sm:px-8 rounded-xl sm:rounded-2xl shadow-[0_6px_0_#7f1d1d] hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(239,68,68,0.5)] transition-all text-sm sm:text-lg border border-red-400">
                    ประกาศ "แคง!"
                  </button>
                  {canFlow && (
                    <button onClick={handleFlow} disabled={selectedCardIds.length === 0} className="min-w-[110px] sm:min-w-[140px] bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 disabled:from-gray-700 disabled:to-gray-900 text-white font-black py-3 px-4 sm:px-8 rounded-xl sm:rounded-2xl shadow-[0_6px_0_#4c1d95] hover:-translate-y-1 transition-all text-sm sm:text-lg animate-pulse border border-purple-300">
                      ไหลไพ่ ({flowData!.rank})
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {gameState.status === "ended" && gameState.endedGameData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 overflow-y-auto">
          <motion.div initial={{ scale: 0.8, opacity: 0, rotateX: 20 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} className="bg-gradient-to-b from-gray-900 to-black border-4 border-gold rounded-3xl p-6 sm:p-10 max-w-3xl w-full shadow-[0_0_80px_rgba(250,204,21,0.4)] my-auto relative overflow-hidden">
            
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/20 blur-[100px] rounded-full"></div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-green-500/20 blur-[100px] rounded-full"></div>

            <div className="text-center mb-8 relative z-10">
              <div className="text-7xl mb-4 drop-shadow-[0_0_20px_gold]">🏆</div>
              <h2 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-yellow-200 to-yellow-500 drop-shadow-lg uppercase tracking-wider">
                {gameState.endedGameData.winnerName} ชนะ!
              </h2>
              <p className="text-lg sm:text-2xl text-white font-black mt-4 bg-red-600/80 inline-block px-4 py-2 rounded-full border-2 border-red-400 shadow-lg">
                {gameState.instantWinType ? `🔥 น็อคมืด: ${gameState.instantWinType} 🔥` : (gameState.endedGameData.endGameReason === "kang" ? "ชนะแคงสวยงาม!" : gameState.endedGameData.endGameReason === "empty_hand" ? "ไพ่หมดมือก่อนชนะ!" : "แคงล่ม! โดนปรับบาน")}
              </p>
            </div>

            <div className="space-y-4 relative z-10">
              {gameState.endedGameData.players.map((p: any) => (
                <div key={p.id} className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border-2 ${p.id === gameState.endedGameData.winnerId ? "bg-gradient-to-r from-gold/30 to-black border-gold shadow-[0_0_20px_rgba(250,204,21,0.2)]" : "bg-black/80 border-white/10"} gap-4`}>
                  <div className="text-center sm:text-left min-w-[120px]">
                    <span className="font-black text-xl text-white block">{p.name}</span>
                    <span className="text-xs sm:text-sm text-gold font-bold bg-black/50 px-3 py-1 rounded-full mt-1 inline-block border border-gold/30">แต้มรวม: {p.points}</span>
                  </div>
                  
                  <div className="flex gap-[-10px] sm:gap-[-5px]">
                    {p.hand.map((c: Card, i: number) => (
                      <div key={i} className="-ml-6 sm:-ml-4 scale-[0.6] transform origin-center hover:z-20 hover:scale-75 transition-all">
                        {renderCard(c, false)}
                      </div>
                    ))}
                  </div>

                  <div className={`font-black text-2xl sm:text-3xl px-4 py-2 rounded-xl bg-black/50 border ${p.roundChipsChange > 0 ? "text-green-400 border-green-500/50" : p.roundChipsChange < 0 ? "text-red-500 border-red-500/50" : "text-gray-400 border-gray-500/50"}`}>
                    {p.roundChipsChange > 0 ? `+${p.roundChipsChange}` : p.roundChipsChange}
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <button onClick={() => socket.emit("play_again", { roomId })} className="w-full mt-10 py-4 sm:py-5 bg-gradient-to-r from-gold via-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-gold text-black font-black text-xl sm:text-2xl rounded-2xl shadow-[0_8px_0_#a16207] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(250,204,21,0.6)] transition-all uppercase tracking-widest border border-yellow-200 z-10 relative">
                เปิดโต๊ะเล่นตาต่อไป!
              </button>
            )}
          </motion.div>
        </div>
      )}

    </div>
  );
}