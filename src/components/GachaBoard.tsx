"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Player { id: string; name: string; connected: boolean; chips: number; }
interface CardData { id: string; name: string; emoji: string; desc: string; player: string; log: string; type?: string; val?: number; }
interface GachaState { roomId: string; hostId: string; status: "waiting" | "playing" | "ended" | "waiting_target"; players: Player[]; currentTurnPlayerId: string | null; deckCount: number; lastCard: CardData | null; history: string[]; maxPlayers: number; pendingCard: CardData | null; }

export default function GachaBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GachaState | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  
  const lastCardIdRef = useRef<string | null>(null);
  const gotInitialStateRef = useRef(false);
  
  // 🔥 ใช้ Ref เก็บสถานะการคลิก เพื่อไม่ให้รบกวนการรีเฟรชหน้าเว็บ
  const hasInteractedRef = useRef(false);
  const [showSoundHint, setShowSoundHint] = useState(true);

  // 🔊 ระบบเสียงฝั่ง client เท่านั้น
  const soundsRef = useRef<Record<string, HTMLAudioElement>>({});
  const soundsInitializedRef = useRef(false);

  const initSoundsIfNeeded = () => {
    if (soundsInitializedRef.current) return;
    if (typeof window === "undefined") return;

    soundsRef.current = {
      draw: new Audio("https://www.soundjay.com/buttons/sounds/button-20.mp3"),
      jackpot: new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3"),
      explode: new Audio("https://www.soundjay.com/mechanical/sounds/explosion-01.mp3"),
      fail: new Audio("https://www.soundjay.com/misc/sounds/fail-trombone-01.mp3"),
      evil: new Audio("https://www.soundjay.com/human/sounds/laughter-01.mp3"),
      cash: new Audio("https://www.soundjay.com/misc/sounds/coins-in-hand-2.mp3"),
      alert: new Audio("https://www.soundjay.com/buttons/sounds/button-10.mp3")
    };

    Object.values(soundsRef.current).forEach((audio) => {
      audio.volume = 0.5;
    });

    soundsInitializedRef.current = true;
  };

  const playSound = (type: keyof typeof soundsRef.current) => {
    if (!hasInteractedRef.current) return;
    if (!soundsInitializedRef.current) initSoundsIfNeeded();
    const audio = soundsRef.current[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((e) => console.log("เสียงถูกบล็อกโดย Browser:", e));
    }
  };

  // ⚡ ระบบเชื่อมต่อเวอร์ชันที่เสถียรที่สุด (แบบเดียวกับตอนที่พี่บอมเข้าได้ปกติ)
  useEffect(() => {
    if (typeof window === "undefined") return;

    console.log("[Gacha][Client] useEffect init", { roomId, username });

    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);

    const handleConnect = () => {
      console.log("[Gacha][Client] socket connected", { socketId: s.id, roomId });
      const maxPlayers = parseInt(window.sessionStorage.getItem("gacha_maxPlayers") || "8");
      console.log("[Gacha][Client] emitting join_gacha_room", { roomId, username, maxPlayers });
      s.emit("join_gacha_room", { roomId, username, maxPlayers });
    };

    if (s.connected) handleConnect();
    s.on("connect", handleConnect);

    s.on("connect_error", (err) => {
      console.error("[Gacha][Client] socket connect_error", err);
    });

    const retryJoinTimeout = window.setTimeout(() => {
      if (!gotInitialStateRef.current) {
        console.warn("[Gacha][Client] no gacha_state yet, re-emitting join_gacha_room", { roomId, username });
        handleConnect();
      }
    }, 4000);

    s.on("gacha_state", (state: GachaState) => {
      if (!gotInitialStateRef.current) {
        console.log("[Gacha][Client] received first gacha_state", {
          roomId: state.roomId,
          status: state.status,
          players: state.players.length
        });
        gotInitialStateRef.current = true;
      } else {
        console.log("[Gacha][Client] received gacha_state update", {
          status: state.status,
          deckCount: state.deckCount
        });
      }

      setGameState(state);
      
      if (state.status === "waiting_target" && state.currentTurnPlayerId === s.id) {
        setShowTargetModal(true);
        playSound("alert");
      } else {
        setShowTargetModal(false);
      }

      if (state.lastCard && state.lastCard.id !== lastCardIdRef.current) {
        lastCardIdRef.current = state.lastCard.id;
        const type = state.lastCard.type;
        
        if (type === "jackpot" || type === "lucky_draw") playSound("jackpot");
        else if (type === "bankruptcy" || type === "assassin") playSound("explode");
        else if (type === "trip_grass" || type === "fallen_angel" || type === "tax") playSound("fail");
        else if (["communist", "thanos", "master_thief", "leech", "robbery", "scapegoat", "wallet_swap", "robin_hood"].includes(type || "")) playSound("evil");
        else if (type === "normal") {
          if (state.lastCard.val && state.lastCard.val > 0) playSound("cash");
          else playSound("fail");
        }
      }
    });

    s.on("gacha_error", (msg) => {
      console.error("[Gacha][Client] gacha_error", msg);
      alert(msg.message);
      router.push("/");
    });

    return () => { 
      console.log("[Gacha][Client] cleanup useEffect, disconnecting socket", { socketId: s.id });
      s.off("connect", handleConnect);
      s.off("gacha_state");
      s.off("gacha_error");
      s.off("connect_error");
      window.clearTimeout(retryJoinTimeout);
      s.disconnect(); 
    };
  }, [roomId, username, router]); 

  // โหลดดิ้งระหว่างรอข้อมูล
  if (!gameState || !socket) return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-purple-950 text-white font-sans text-center">
      <div className="text-8xl mb-6 animate-spin">🔮</div>
      <h2 className="text-3xl font-bold animate-pulse text-purple-300">กำลังเปิดประตูนรก...</h2>
    </div>
  );

  const isHost = socket.id === gameState.hostId;
  const isMyTurn = socket.id === gameState.currentTurnPlayerId;
  const me = gameState.players.find(p => p.id === socket.id);
  const sortedPlayers = [...gameState.players].sort((a, b) => b.chips - a.chips);

  const handleDraw = () => { 
    hasInteractedRef.current = true;
    setShowSoundHint(false);
    initSoundsIfNeeded();
    playSound("draw"); 
    socket.emit("draw_gacha", { roomId }); 
  };
  
  const selectTarget = (targetId: string) => { 
    if (targetId === "random") playSound("evil"); 
    socket.emit("resolve_gacha_target", { roomId, targetId }); 
    setShowTargetModal(false); 
  };

  return (
    <div
      onClick={() => { 
        hasInteractedRef.current = true; 
        setShowSoundHint(false); 
        initSoundsIfNeeded();
      }}
      className="min-h-dvh bg-gradient-to-b from-purple-950 to-black text-white font-sans overflow-hidden flex flex-col relative"
    >
      
      <header className="bg-black/60 p-4 flex justify-between items-center z-20 border-b border-purple-500/30">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500">🎰 กาชาปองนรก</h1>
          <p className="text-purple-300 text-sm">ROOM: {roomId} {showSoundHint && <span className="text-yellow-500 ml-2 animate-pulse">(คลิกจอ 1 ทีเพื่อเปิดเสียง)</span>}</p>
        </div>
        <div className="bg-black/50 px-5 py-2 rounded-xl border border-gold/50 flex items-center gap-2">
          <span className="text-xl">💰</span><span className="text-xl font-black text-gold">{me?.chips || 0}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto p-4 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          
          <div className="bg-black/40 rounded-3xl border border-purple-500/30 p-6 flex flex-col gap-4 shadow-xl lg:order-1 order-2">
            <h3 className="text-purple-400 font-black text-xl text-center border-b border-purple-500/20 pb-3">📊 อันดับความรวย</h3>
            <ul className="space-y-3 overflow-y-auto max-h-[40vh] pr-2">
              {sortedPlayers.map((p, index) => (
                <li key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${gameState.currentTurnPlayerId === p.id ? "bg-purple-900/50 border-purple-400 shadow-[0_0_15px_purple]" : "bg-black/50 border-white/10"} ${index === 0 && gameState.status === "playing" ? "border-gold shadow-[0_0_10px_gold]" : ""}`}>
                  <span className="font-bold text-lg flex items-center gap-2">{index === 0 && "👑"} {p.name} {p.id === gameState.hostId && "⭐"}</span>
                  <span className="font-black text-gold text-xl">{p.chips} 💰</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-900/40 to-fuchsia-900/20 rounded-3xl border-4 border-purple-700 p-6 flex flex-col items-center justify-center gap-6 relative shadow-[0_20px_50px_rgba(168,85,247,0.2)] lg:col-span-1 lg:order-2 order-1 min-h-[50vh]">
            {gameState.status === "waiting" && (
              <div className="text-center">
                <div className="text-8xl mb-6 animate-bounce">🔮</div>
                <h2 className="text-2xl font-black mb-6 text-purple-300">รอคนใจกล้า ({gameState.players.length}/{gameState.maxPlayers})</h2>
                {isHost ? (
                  <button onClick={() => { hasInteractedRef.current = true; setShowSoundHint(false); socket.emit("start_gacha", { roomId }); }} disabled={gameState.players.length < 2} className="w-full px-8 py-4 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:scale-105 disabled:opacity-50 text-white font-black text-2xl rounded-2xl shadow-[0_10px_30px_rgba(192,38,211,0.5)] transition-all">เริ่มสับไพ่!</button>
                ) : (<div className="text-gray-400 animate-pulse font-bold text-xl">รอเจ้ามือเปิดโต๊ะ...</div>)}
              </div>
            )}

            {gameState.status === "playing" && (
              <>
                <AnimatePresence mode="wait">
                  {gameState.lastCard && (
                    <motion.div key={gameState.lastCard.id + gameState.deckCount} initial={{ scale: 0, rotateY: 180 }} animate={{ scale: 1, rotateY: 0 }} className="z-30 bg-gradient-to-br from-gray-100 to-white text-black p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-4 border-gold text-center w-64 h-80 flex flex-col items-center justify-center gap-4 shrink-0">
                      <div className="text-7xl">{gameState.lastCard.emoji}</div>
                      <h3 className="text-2xl font-black text-red-600">{gameState.lastCard.name}</h3>
                      <p className="text-gray-700 font-bold text-sm">{gameState.lastCard.desc}</p>
                      <div className="mt-2 bg-black text-gold px-4 py-1 rounded-full text-xs font-black w-full truncate">เปิดโดย: {gameState.lastCard.player}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="text-center z-10 flex flex-col items-center mt-4">
                  <div className="text-purple-300 font-bold mb-4">ไพ่เหลือ: <span className="text-3xl text-white">{gameState.deckCount}</span> ใบ</div>
                  {isMyTurn ? (
                    <button onClick={handleDraw} className="px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-500 hover:scale-110 text-white font-black text-2xl rounded-full shadow-[0_0_40px_purple] transition-all border-4 border-white animate-pulse">🔥 จั่วไพ่!</button>
                  ) : (
                    <div className="px-8 py-4 bg-gray-800 text-gray-400 rounded-full font-bold text-lg border-2 border-gray-600">รอ {gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name} จั่ว...</div>
                  )}
                </div>
              </>
            )}

            {gameState.status === "ended" && (
              <div className="text-center z-40 bg-black/80 p-8 rounded-3xl border-2 border-gold backdrop-blur-sm">
                <div className="text-7xl mb-4">🏆</div>
                <h2 className="text-3xl font-black text-white mb-2">ผู้ชนะคือ...</h2>
                <div className="text-5xl font-black text-gold mb-6">{sortedPlayers[0]?.name}</div>
                <p className="text-xl text-green-400 font-bold mb-8">รวยเละเทะ {sortedPlayers[0]?.chips} 💰</p>
                {isHost && <button onClick={() => { playSound("draw"); socket.emit("reset_gacha", { roomId }); }} className="w-full px-8 py-4 bg-gradient-to-r from-gold to-yellow-500 hover:scale-105 text-black font-black text-xl rounded-xl transition-all shadow-[0_0_20px_rgba(250,204,21,0.5)]">สับไพ่เล่นตาต่อไป!</button>}
              </div>
            )}
          </div>

          <div className="bg-black/40 rounded-3xl border border-purple-500/30 p-6 flex flex-col gap-4 shadow-xl lg:order-3 order-3">
            <h3 className="text-purple-400 font-black text-xl text-center border-b border-purple-500/20 pb-3">📜 ข่าวแจ่วนรก</h3>
            <ul className="space-y-3 overflow-y-auto max-h-[40vh] text-sm text-gray-300 font-medium">
              {gameState.history.length === 0 && <li className="text-center text-gray-500 italic">ยังไม่มีใครกล้าเปิดไพ่...</li>}
              {gameState.history.map((log, index) => (<li key={index} className="bg-black/60 p-3 rounded-lg border-l-4 border-purple-500">{log}</li>))}
            </ul>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showTargetModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 border-4 border-red-500 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_red]">
              <h2 className="text-3xl font-black text-red-500 mb-2">🎯 ล็อกเป้าหมาย!</h2>
              <p className="text-gray-300 mb-6 text-sm">การ์ดใบนี้ต้องมีคนรับกรรม เลือกมา 1 คน!</p>
              <div className="grid grid-cols-2 gap-4">
                {gameState.players.filter(p => p.id !== socket.id).map(p => (
                  <button key={p.id} onClick={() => selectTarget(p.id)} className="bg-red-900/50 hover:bg-red-600 border border-red-500 text-white font-bold py-3 rounded-xl transition-all">{p.name}</button>
                ))}
                <button onClick={() => selectTarget("random")} className="col-span-2 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white font-black py-4 rounded-xl border-2 border-white shadow-[0_0_20px_purple] mt-2">🎲 หลับตาสุ่มชี้เลย!</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}