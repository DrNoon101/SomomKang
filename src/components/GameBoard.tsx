"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card as CardComponent } from "./Card";
import type { CardData, Rank } from "./Card";
import { OpponentAvatar } from "./OpponentAvatar";
import { io, Socket } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";
import { RulesModal } from "./RulesModal";

interface GameBoardProps {
  roomId?: string;
  username?: string;
}

interface PublicPlayer {
  id: string;
  name: string;
  handCount: number;
  connected: boolean;
  chips: number;
}

type GameStatus = "waiting" | "playing" | "ended";

interface EndedPlayerData {
  id: string;
  name: string;
  hand: CardData[];
  points: number;
  chips: number;
  roundChipsChange: number;
}

interface EndedGameData {
  winnerId: string;
  winnerName: string;
  endGameReason: string;
  instantWinType?: string;
  players: EndedPlayerData[];
}

interface PublicState {
  roomId: string;
  hostId: string | null;
  maxPlayers: number;
  status: GameStatus;
  players: PublicPlayer[];
  currentTurnPlayerId: string | null;
  drawPileCount: number;
  discardTop: CardData | null;
  winnerId: string | null;
  instantWinType: string | null;
  endGameReason: string | null;
  endedGameData?: EndedGameData;
}

interface FlowAvailablePayload {
  roomId: string;
  rank: Rank;
  fromPlayerId: string;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

const playRetroSound = (type: "card" | "action" | "win" | "lose") => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (type === "card") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === "action") {
      osc.type = "square";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      osc.frequency.setValueAtTime(800, now + 0.2);
      osc.frequency.setValueAtTime(1200, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
    } else if (type === "lose") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.6);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
    }
  } catch (err) {
    console.error("Audio block", err);
  }
};

export default function GameBoard({ roomId = "Demo", username = "คุณ" }: GameBoardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hand, setHand] = useState<CardData[]>([]);
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pendingFlow, setPendingFlow] = useState<FlowAvailablePayload | null>(null);
  const [mockMessage, setMockMessage] = useState<string>("");
  const [showRules, setShowRules] = useState(false);
  
  const [floatingSuits, setFloatingSuits] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🔥 State สำหรับระบบอีโมจิ
  const EMOTES_LIST = ["🤡", "🤬", "💸", "😭", "💀", "🤣"];
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<{id: number, playerId: string, emote: string}[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const suits = ["♠", "♥", "♣", "♦"];
    const items = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      suit: suits[i % 4],
      left: `${Math.random() * 100}%`,
      xOffset: Math.random() * 150 - 75,
      duration: 15 + Math.random() * 20,
      delay: -(Math.random() * 40),
      size: Math.random() * 3 + 2,
      isRed: i % 4 === 1 || i % 4 === 3
    }));
    setFloatingSuits(items);
  }, []);

  useEffect(() => {
    if (audioRef.current && isMounted) {
      audioRef.current.volume = 0.3;
      if (!isMuted) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [isMuted, isMounted]);

  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current && !isMuted && isMounted) audioRef.current.play().catch(() => {});
      document.removeEventListener("click", unlockAudio);
    };
    if (isMounted) document.addEventListener("click", unlockAudio);
    return () => document.removeEventListener("click", unlockAudio);
  }, [isMuted, isMounted]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setMyPlayerId(socket.id || null);
      setStatusMessage("เชื่อมต่อเซิร์ฟเวอร์แล้ว");
      const savedMaxPlayers = sessionStorage.getItem("somomkang_maxPlayers");
      const mode = sessionStorage.getItem("somomkang_mode");
      socket.emit("join_room", { roomId, username, maxPlayers: mode === "create" && savedMaxPlayers ? parseInt(savedMaxPlayers as string) : undefined });
    });

    socket.on("game_state", (payload: { public: PublicState; yourHand: CardData[]; yourPlayerId: string }) => {
      setPublicState(payload.public);
      setHand(payload.yourHand);
      setMyPlayerId(payload.yourPlayerId);
    });

    socket.on("error_message", (data: { message: string }) => setStatusMessage(data.message));
    socket.on("flow_available", (data: FlowAvailablePayload) => {
      setPendingFlow(data);
      if (!isMuted) playRetroSound("action");
    });
    
    socket.on("flow_win", () => setStatusMessage("ผู้เล่นไหลจนหมดมือ ชนะทันที"));

    socket.on("got_flowed_mock", () => {
      setMockMessage("โดนซะไอเด๋อ!!");
      if (!isMuted) playRetroSound("lose");
      setTimeout(() => setMockMessage(""), 2500);
    });

    socket.on("kang_result", (data: { kangSuccess: boolean }) => {
      setStatusMessage(data.kangSuccess ? "แคงสำเร็จ! ชนะรอบนี้" : "แคงล่ม! มีคนแต้มน้อยกว่าหรือเท่ากัน");
    });

    // 🔥 ดักจับสัญญาณเวลามีคนกดส่งอีโมจิ
    socket.on("receive_emote", (data: { playerId: string, emote: string }) => {
      const newEmote = { id: Date.now() + Math.random(), ...data };
      setActiveEmotes((prev) => [...prev, newEmote]);
      // ให้อีโมจิลอยอยู่ 2 วินาทีแล้วหายไป
      setTimeout(() => {
        setActiveEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
      }, 2000);
    });

    socket.on("disconnect", () => setStatusMessage("ตัดการเชื่อมต่อจากเซิร์ฟเวอร์"));
    return () => { socket.disconnect(); };
  }, [roomId, username, isMuted]);

  useEffect(() => {
    if (publicState?.status === "ended" && publicState.endedGameData && myPlayerId) {
      if (!isMuted) {
        if (publicState.endedGameData.winnerId === myPlayerId) playRetroSound("win");
        else playRetroSound("lose");
      }
    }
  }, [publicState?.status, publicState?.endedGameData, myPlayerId, isMuted]);

  const isMyTurn = publicState && myPlayerId && publicState.currentTurnPlayerId === myPlayerId && publicState.status === "playing";

  useEffect(() => {
    if (!isMyTurn || publicState?.status !== "playing") setPendingFlow(null);
  }, [isMyTurn, publicState?.status]);

  const toggleCard = useCallback((id: string) => {
    if (!isMuted) playRetroSound("card");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isMuted]);

  const shouldDim = useCallback((card: CardData): boolean => {
    if (selectedIds.size === 0) return false;
    const currentSelectedRanks = hand.filter((c) => selectedIds.has(c.id)).map((c) => c.rank);
    return !currentSelectedRanks.includes(card.rank);
  }, [selectedIds, hand]);

  const opponents = publicState && myPlayerId ? publicState.players.filter((p) => p.id !== myPlayerId) : [];
  const myPlayerData = publicState?.players.find(p => p.id === myPlayerId);
  const myChips = myPlayerData?.chips ?? 0;
  const isHost = publicState?.hostId === myPlayerId;
  const matchingFlowCards = pendingFlow ? hand.filter((c) => c.rank === pendingFlow.rank) : [];
  const canFlow = pendingFlow !== null && matchingFlowCards.length > 0;
  const currentTurnPlayer = publicState?.players.find(p => p.id === publicState.currentTurnPlayerId);
  const isMeWinner = publicState?.endedGameData?.winnerId === myPlayerId;

  const handleStartGame = () => { 
    if (!isMuted) playRetroSound("action");
    if (socketRef.current && isHost) socketRef.current.emit("start_game", { roomId }); 
  };
  const handlePlayAgain = () => { 
    if (!isMuted) playRetroSound("action");
    if (socketRef.current && isHost) socketRef.current.emit("play_again", { roomId }); 
  };

  const handleDrawAndDiscard = () => {
    if (!socketRef.current || !publicState || !isMyTurn) return;
    const selectedCards = hand.filter((c) => selectedIds.has(c.id));
    if (selectedCards.length === 0) return setStatusMessage("เลือกไพ่ที่จะทิ้งก่อน");
    if (!selectedCards.every((c) => c.rank === selectedCards[0].rank)) return setStatusMessage("ต้องทิ้งไพ่ที่แต้มเหมือนกัน");
    
    if (!isMuted) playRetroSound("action");
    socketRef.current.emit("draw_and_discard", { roomId, discardCardIds: selectedCards.map((c) => c.id) });
    setSelectedIds(new Set());
    setPendingFlow(null);
  };

  const handleKang = () => {
    if (!socketRef.current || !publicState || !isMyTurn) return;
    if (!isMuted) playRetroSound("action");
    socketRef.current.emit("kang", { roomId });
    setPendingFlow(null);
  };

  const handleFlow = () => {
    if (!socketRef.current || !pendingFlow || matchingFlowCards.length === 0) return;
    if (!isMuted) playRetroSound("action");
    socketRef.current.emit("flow_discard", { roomId, cardIds: matchingFlowCards.map((c) => c.id) });
    setPendingFlow(null);
  };

  // 🔥 ฟังก์ชันยิงอีโมจิ
  const handleSendEmote = (emote: string) => {
    if (socketRef.current) {
      socketRef.current.emit("send_emote", { roomId, emote });
      setShowEmotePicker(false);
    }
  };

  const discardTop = publicState?.discardTop ?? null;
  const drawPileCount = publicState?.drawPileCount ?? 0;
  const tableCenterX = 50; const tableCenterY = 50; const arcRadiusPercent = 38;

  const getOpponentPosition = (index: number) => {
    const total = opponents.length;
    const angle = total <= 1 ? Math.PI / 2 : Math.PI - (index * (Math.PI / (total - 1)));
    const leftPercent = tableCenterX + arcRadiusPercent * Math.cos(angle);
    const topPercent = tableCenterY - arcRadiusPercent * Math.sin(angle);
    return { leftPercent, topPercent };
  };

  if (!isMounted) return null;

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-felt">
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
        <div className="flex gap-4 sm:gap-12 text-[15vw] sm:text-[10vw] font-black text-black">
          <span>♠</span><span className="text-red-900">♥</span><span>♣</span><span className="text-red-900">♦</span>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {floatingSuits.map(item => (
          <motion.div
            key={item.id}
            className="absolute font-black drop-shadow-sm"
            style={{ 
              left: item.left, 
              top: "110%",
              fontSize: `${item.size}rem`,
              color: item.isRed ? "rgba(248, 113, 113, 0.15)" : "rgba(255, 255, 255, 0.1)", 
            }}
            animate={{ y: ["0vh", "-130vh"], rotate: [0, 360], x: [0, item.xOffset, 0] }}
            transition={{ duration: item.duration, repeat: Infinity, delay: item.delay, ease: "linear" }}
          >
            {item.suit}
          </motion.div>
        ))}
      </div>

      {/* 🔥 เรนเดอร์อีโมจิที่ลอยขึ้นมา */}
      {activeEmotes.map((e) => {
        if (e.playerId === myPlayerId) {
          // อีโมจิของเราจะลอยขึ้นจากตรงกลางด้านล่าง (จุดที่เราถือไพ่)
          return (
            <motion.div key={e.id} initial={{ opacity: 0, scale: 0.5, y: 0 }} animate={{ opacity: 1, scale: 1.5, y: -100 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }} className="absolute bottom-32 left-1/2 -translate-x-1/2 text-6xl z-50 pointer-events-none drop-shadow-2xl">
              {e.emote}
            </motion.div>
          );
        } else {
          // อีโมจิของเพื่อนจะลอยขึ้นจากรูปโปรไฟล์ของคนนั้นๆ
          const oppIndex = opponents.findIndex((o) => o.id === e.playerId);
          if (oppIndex !== -1) {
            const { leftPercent, topPercent } = getOpponentPosition(oppIndex);
            return (
              <motion.div key={e.id} initial={{ opacity: 0, scale: 0.5, y: 0 }} animate={{ opacity: 1, scale: 1.5, y: -80 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }} className="absolute text-6xl z-50 pointer-events-none drop-shadow-2xl" style={{ left: `${leftPercent}%`, top: `${topPercent}%`, transform: 'translate(-50%, -50%)' }}>
                {e.emote}
              </motion.div>
            );
          }
        }
        return null;
      })}

      <AnimatePresence>
        {mockMessage && (
          <motion.div initial={{ opacity: 0, scale: 0.2, rotate: -15 }} animate={{ opacity: 1, scale: 1.2, rotate: 0 }} exit={{ opacity: 0, scale: 2, filter: "blur(10px)" }} transition={{ type: "spring", bounce: 0.6 }} className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <h1 className="text-5xl sm:text-7xl font-black text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,1)] text-center transform -skew-y-6 border-4 border-red-500 bg-black/80 px-10 py-6 rounded-[2rem] shadow-2xl">{mockMessage}</h1>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => { window.location.href = "/"; }} 
        className="absolute bottom-4 left-4 px-4 py-2 bg-black/40 text-white rounded-lg hover:bg-black/60 z-50 text-sm font-bold border border-white/20"
      >
        ← กลับไปล็อบบี้
      </button>

      {opponents.map((opp, i) => {
        const { leftPercent, topPercent } = getOpponentPosition(i);
        return <OpponentAvatar key={opp.id} name={opp.name} cardCount={opp.handCount} chips={opp.chips} leftPercent={leftPercent} topPercent={topPercent} isCurrentTurn={publicState?.currentTurnPlayerId === opp.id} />;
      })}

      {publicState?.status === "playing" && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute top-16 left-0 right-0 flex justify-center z-10 pointer-events-none px-4">
            {isMyTurn ? (
              <div className="text-xl sm:text-2xl font-extrabold text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse bg-black/60 px-6 py-2 rounded-full border border-green-500/30 backdrop-blur-sm">✨ ถึงตาคุณแล้ว! ✨</div>
            ) : currentTurnPlayer ? (
              <div className="text-sm sm:text-base font-semibold text-white/90 drop-shadow-md bg-black/60 px-6 py-2 rounded-full inline-block border border-white/10 backdrop-blur-sm">กำลังรอ <span className="text-gold">{currentTurnPlayer.name}</span> เล่น...</div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-full z-10">
        {publicState?.status === "waiting" ? (
          isHost ? (
            <button type="button" onClick={handleStartGame} disabled={publicState.players.length < 2} className="px-10 py-5 rounded-2xl bg-gold text-felt-dark font-bold text-xl sm:text-2xl shadow-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold transition-colors z-20">เริ่มเกม ({publicState.players.length}/{publicState.maxPlayers})</button>
          ) : (
            <p className="text-white/90 text-lg bg-black/40 px-6 py-3 rounded-full backdrop-blur-sm z-20">รอเจ้าของห้องเริ่มเกม ({publicState.players.length}/{publicState.maxPlayers} ผู้เล่น)</p>
          )
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <AnimatePresence mode="popLayout">
                    {drawPileCount > 0 && <CardComponent key="draw-pile-card" card={{ id: "draw-pile", suit: "spades", rank: "A" }} index={0} totalInHand={1} isSelected={false} isDimmed={false} onClick={() => {}} faceDown />}
                  </AnimatePresence>
                  {drawPileCount > 0 && <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs whitespace-nowrap bg-black/40 px-2 py-1 rounded-full">เหลือ {drawPileCount} ใบ</span>}
                </div>
                <span className="text-white/90 text-sm mt-7 font-medium">กองจั่ว</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <AnimatePresence mode="popLayout">
                    {discardTop ? (
                      <motion.div key={discardTop.id} initial={{ opacity: 0, scale: 0.5, rotate: -15 }} animate={{ opacity: 1, scale: 1, rotate: -5 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                        <CardComponent card={discardTop} index={0} totalInHand={1} isSelected={false} isDimmed={false} onClick={() => {}} compact />
                      </motion.div>
                    ) : (
                      <CardComponent card={{ id: "discard-empty", suit: "hearts", rank: "A" }} index={0} totalInHand={1} isSelected={false} isDimmed={false} onClick={() => {}} compact />
                    )}
                  </AnimatePresence>
                </div>
                <span className="text-white/90 text-sm mt-3 font-medium">กองทิ้ง</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center px-2 sm:px-4 pointer-events-none z-10">
        {publicState?.status === "playing" && (
          <div className="flex gap-2 sm:gap-4 mb-4 bg-black/50 p-2 sm:p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl pointer-events-auto transition-all">
            <button type="button" onClick={handleKang} disabled={!isMyTurn} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${isMyTurn ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:-translate-y-1" : "bg-gray-700/50 text-gray-500 cursor-not-allowed"}`}>แคง!</button>
            <button type="button" onClick={handleDrawAndDiscard} disabled={!isMyTurn || selectedIds.size === 0 || drawPileCount === 0} className={`px-6 sm:px-8 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${isMyTurn && selectedIds.size > 0 ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:-translate-y-1" : "bg-gray-700/50 text-gray-500 cursor-not-allowed"}`}>จั่ว 1 & ทิ้งไพ่</button>
            <button type="button" onClick={handleFlow} disabled={!canFlow} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center gap-1 ${canFlow ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse hover:-translate-y-1" : "bg-gray-700/50 text-gray-500 cursor-not-allowed"}`}>🌊 ไหล {canFlow && pendingFlow ? `(${pendingFlow.rank})` : ""}</button>
          </div>
        )}
        <div className="flex items-end justify-center gap-0 min-h-[100px] pointer-events-auto">
          <AnimatePresence mode="popLayout">
            {hand.map((card, index) => (
              <motion.div key={card.id} layout initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -50, scale: 0.5 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="flex items-end" style={{ marginLeft: index === 0 ? 0 : -20 }}>
                <CardComponent card={card} index={index} totalInHand={hand.length} isSelected={selectedIds.has(card.id)} isDimmed={shouldDim(card)} onClick={() => toggleCard(card.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute top-2 left-2 right-2 flex justify-between items-center px-3 py-2 bg-black/30 backdrop-blur-sm rounded-lg z-20">
        <span className="text-white/80 text-sm">
          ห้อง: {roomId} <span className="text-white/50 ml-2 hidden sm:inline">{statusMessage}</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          
          <audio ref={audioRef} src="/bgm.mp3" loop />
          
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`px-3 py-1 border rounded-full text-sm font-bold transition-all ${
              isMuted ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-green-500/20 text-green-400 border-green-500/50"
            }`}
          >
            {isMuted ? "🔇 ปิดเสียง" : "🔊 เปิดเสียง"}
          </button>

          {/* 🔥 ปุ่มกล่องข้อความอีโมจิ */}
          <div className="relative">
            <button 
              onClick={() => setShowEmotePicker(!showEmotePicker)} 
              className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white/90 text-sm font-bold transition-colors"
            >
              💬 อีโมจิ
            </button>
            <AnimatePresence>
              {showEmotePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 10, scale: 0.8 }} 
                  className="absolute top-10 right-0 bg-black/80 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex gap-3 z-50 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
                >
                  {EMOTES_LIST.map(e => (
                    <button 
                      key={e} 
                      onClick={() => handleSendEmote(e)} 
                      className="text-2xl hover:scale-125 hover:-translate-y-2 transition-all"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setShowRules(true)} className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white/90 text-sm font-bold transition-colors">
            📖 กติกา
          </button>
          <div className="bg-amber-500/20 border border-amber-500/50 px-3 py-1 rounded-full flex items-center gap-2 shadow-inner">
            <span>🪙</span><span className="text-gold font-bold">{myChips.toLocaleString()}</span>
          </div>
          <span title={username} className="text-white font-medium bg-black/40 px-3 py-1 rounded-lg border border-white/10 max-w-[100px] truncate cursor-help">
            {username}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </AnimatePresence>

      {publicState?.status === "ended" && publicState.endedGameData && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.5 }} className="bg-felt-dark border-2 border-gold/50 rounded-3xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="text-center mt-2 mb-4">
                  <h3 className={`text-2xl sm:text-3xl font-black animate-bounce ${isMeWinner ? "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]" : "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"}`}>
                    {isMeWinner ? "🎉 ยินดีด้วย! คุณคือผู้ชนะ 🎉" : "💀 หลับไปซะไออ่อน 💀"}
                  </h3>
                </div>
                
                <div className="text-center bg-black/40 py-4 rounded-2xl border border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/10 to-transparent animate-pulse"></div>
                  <p className="text-white/70 text-sm font-bold">ผู้กวาดเงินกองกลาง</p>
                  <p className="text-gold text-4xl font-black mt-1 drop-shadow-md">{publicState.endedGameData.winnerName}</p>
                  
                  {publicState.endedGameData.endGameReason === "instant_win" && (
                    <div className="mt-4 mb-2 animate-pulse">
                      <p className="text-white/80 text-sm mb-1">ชนะน็อคมืดด้วย</p>
                      <p className="text-amber-300 text-lg sm:text-xl font-black bg-amber-500/20 inline-block px-5 py-2 rounded-full border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                        {publicState.endedGameData.instantWinType}
                      </p>
                    </div>
                  )}

                  {publicState.endedGameData.endGameReason === "kang" && <p className="text-amber-300 text-sm mt-3 font-bold bg-amber-500/20 inline-block px-4 py-1.5 rounded-full border border-amber-500/30">แคงสำเร็จ 🎯</p>}
                  {publicState.endedGameData.endGameReason === "kang_shipwreck" && <p className="text-red-400 text-sm mt-3 font-bold bg-red-500/20 inline-block px-4 py-1.5 rounded-full border border-red-500/30">แคงล่ม (ผู้เรียกแคงจ่ายรอบวง) 💀</p>}
                  {publicState.endedGameData.endGameReason === "empty_hand" && <p className="text-blue-300 text-sm mt-3 font-bold bg-blue-500/20 inline-block px-4 py-1.5 rounded-full border border-blue-500/30">ไพ่หมดมือ 🚀</p>}
                </div>
                
                <div className="border-t border-white/10 pt-4 space-y-3">
                  {publicState.endedGameData.players.map((p) => {
                    const isWinner = p.id === publicState.endedGameData!.winnerId;
                    const changeColor = p.roundChipsChange > 0 ? "text-green-400" : p.roundChipsChange < 0 ? "text-red-400" : "text-gray-400";
                    const changeSign = p.roundChipsChange > 0 ? "+" : "";
                    return (
                      <div key={p.id} className={`rounded-2xl p-4 transition-colors flex flex-col gap-3 ${isWinner ? "bg-gold/20 border border-gold/50 shadow-inner" : "bg-black/40 border border-white/5"}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-white font-bold text-lg">{p.name} {p.id === myPlayerId && "(คุณ)"}</span>
                          <div className="flex gap-2 items-center">
                            <span className="text-gold font-bold bg-black/60 px-3 py-1 rounded-lg text-sm">{p.points} แต้ม</span>
                            <span className={`font-black text-xl bg-black/60 px-3 py-1 rounded-lg ${changeColor}`}>{changeSign}{p.roundChipsChange}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.hand.map((card) => <CardComponent key={card.id} card={card} index={0} totalInHand={p.hand.length} isSelected={false} isDimmed={false} onClick={() => {}} compact />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isHost ? (
                  <button type="button" onClick={handlePlayAgain} className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-black font-black text-xl hover:from-amber-400 hover:to-yellow-400 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(250,204,21,0.4)]">ลุยรอบต่อไป!</button>
                ) : (
                  <p className="text-white/60 text-sm font-bold text-center mt-6 bg-black/30 py-3 rounded-xl border border-white/5">รอเจ้าของห้องเปิดวงรอบใหม่...</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}