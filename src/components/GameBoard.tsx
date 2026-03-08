"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card as CardComponent } from "./Card";
import type { CardData, Rank } from "./Card";
import { OpponentAvatar } from "./OpponentAvatar";
import { io, Socket } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";

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

export default function GameBoard({
  roomId = "Demo",
  username = "คุณ",
}: GameBoardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hand, setHand] = useState<CardData[]>([]);
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pendingFlow, setPendingFlow] = useState<FlowAvailablePayload | null>(null);
  
  // State สำหรับเก็บป้ายเยาะเย้ยตอนโดนไหล
  const [mockMessage, setMockMessage] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setMyPlayerId(socket.id || null);
      setStatusMessage("เชื่อมต่อเซิร์ฟเวอร์แล้ว");
      
      const savedMaxPlayers = sessionStorage.getItem("somomkang_maxPlayers");
      const mode = sessionStorage.getItem("somomkang_mode");
      
      socket.emit("join_room", { 
        roomId, 
        username, 
        maxPlayers: mode === "create" && savedMaxPlayers ? parseInt(savedMaxPlayers as string) : undefined 
      });
    });

    socket.on("game_state", (payload: { public: PublicState; yourHand: CardData[]; yourPlayerId: string }) => {
      setPublicState(payload.public);
      setHand(payload.yourHand);
      setMyPlayerId(payload.yourPlayerId);
    });

    socket.on("error_message", (data: { message: string }) => {
      setStatusMessage(data.message);
    });

    socket.on("flow_available", (data: FlowAvailablePayload) => {
      setPendingFlow(data);
    });

    socket.on("flow_win", () => {
      setStatusMessage("ผู้เล่นไหลจนหมดมือ ชนะทันที");
    });

    // รับ event เยาะเย้ยจากเซิร์ฟเวอร์
    socket.on("got_flowed_mock", () => {
      setMockMessage("โดนซะไอเด๋อ!!");
      setTimeout(() => setMockMessage(""), 2500); // หายไปใน 2.5 วิ
    });

    socket.on("kang_result", (data: { kangSuccess: boolean }) => {
      if (data.kangSuccess) {
        setStatusMessage("แคงสำเร็จ! ชนะรอบนี้");
      } else {
        setStatusMessage("แคงล่ม! มีคนแต้มน้อยกว่าหรือเท่ากัน");
      }
    });

    socket.on("disconnect", () => {
      setStatusMessage("ตัดการเชื่อมต่อจากเซิร์ฟเวอร์");
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, username]);

  const toggleCard = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedRanks =
    selectedIds.size > 0 ? hand.filter((c) => selectedIds.has(c.id)).map((c) => c.rank) : [];

  const shouldDim = useCallback(
    (card: CardData): boolean => {
      if (selectedIds.size === 0) return false;
      return !selectedRanks.includes(card.rank);
    },
    [selectedIds, selectedRanks]
  );

  const isMyTurn =
    publicState &&
    myPlayerId &&
    publicState.currentTurnPlayerId === myPlayerId &&
    publicState.status === "playing";

  const opponents =
    publicState && myPlayerId
      ? publicState.players.filter((p) => p.id !== myPlayerId)
      : [];

  const myPlayerData = publicState?.players.find(p => p.id === myPlayerId);
  const myChips = myPlayerData?.chips ?? 0;

  const isHost = publicState?.hostId === myPlayerId;
  const matchingFlowCards = pendingFlow ? hand.filter((c) => c.rank === pendingFlow.rank) : [];
  const canFlow = pendingFlow !== null && matchingFlowCards.length > 0;
  const currentTurnPlayer = publicState?.players.find(p => p.id === publicState.currentTurnPlayerId);

  // เช็คว่าเราชนะหรือแพ้ตอนจบเกม
  const isMeWinner = publicState?.endedGameData?.winnerId === myPlayerId;

  const handleStartGame = () => {
    if (!socketRef.current || !publicState) return;
    if (!isHost) return;
    socketRef.current.emit("start_game", { roomId });
  };

  const handlePlayAgain = () => {
    if (!socketRef.current || !publicState) return;
    if (!isHost) return;
    socketRef.current.emit("play_again", { roomId });
  };

  const handleDrawAndDiscard = () => {
    if (!socketRef.current || !publicState) return;
    if (!isMyTurn) return;

    const selectedCards = hand.filter((c) => selectedIds.has(c.id));
    if (selectedCards.length === 0) return;

    const firstRank = selectedCards[0].rank;
    const allSameRank = selectedCards.every((c) => c.rank === firstRank);
    if (!allSameRank) return;

    socketRef.current.emit("draw_and_discard", {
      roomId,
      discardCardIds: selectedCards.map((c) => c.id),
    });

    setSelectedIds(new Set());
  };

  const handleKang = () => {
    if (!socketRef.current || !publicState) return;
    if (!isMyTurn) return;
    socketRef.current.emit("kang", { roomId });
  };

  const handleFlow = () => {
    if (!socketRef.current || !pendingFlow) return;
    if (matchingFlowCards.length === 0) return;

    socketRef.current.emit("flow_discard", {
      roomId,
      cardIds: matchingFlowCards.map((c) => c.id),
    });
    setPendingFlow(null);
  };

  const discardTop = publicState?.discardTop ?? null;
  const drawPileCount = publicState?.drawPileCount ?? 0;
  const tableCenterX = 50;
  const tableCenterY = 50;
  const arcRadiusPercent = 38;

  const getOpponentPosition = (index: number) => {
    const total = opponents.length;
    const angle = total <= 1 ? Math.PI / 2 : Math.PI - (index * (Math.PI / (total - 1)));
    const leftPercent = tableCenterX + arcRadiusPercent * Math.cos(angle);
    const topPercent = tableCenterY - arcRadiusPercent * Math.sin(angle);
    return { leftPercent, topPercent };
  };

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-felt">
      
      {/* ---------------- ป้ายด่าตอนโดนไหล ---------------- */}
      <AnimatePresence>
        {mockMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.2, rotate: -15 }}
            animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
            exit={{ opacity: 0, scale: 2, filter: "blur(10px)" }}
            transition={{ type: "spring", bounce: 0.6 }}
            className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <h1 className="text-5xl sm:text-7xl font-black text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,1)] text-center transform -skew-y-6 border-4 border-red-500 bg-black/80 px-10 py-6 rounded-[2rem] shadow-2xl">
              {mockMessage}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {opponents.map((opp, i) => {
        const { leftPercent, topPercent } = getOpponentPosition(i);
        return (
          <OpponentAvatar key={opp.id} name={opp.name} cardCount={opp.handCount} chips={opp.chips} leftPercent={leftPercent} topPercent={topPercent} isCurrentTurn={publicState?.currentTurnPlayerId === opp.id} />
        );
      })}

      {publicState?.status === "playing" && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-16 left-0 right-0 flex justify-center z-10 pointer-events-none px-4"
          >
            {isMyTurn ? (
              <div className="text-xl sm:text-2xl font-extrabold text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse bg-black/60 px-6 py-2 rounded-full border border-green-500/30 backdrop-blur-sm">
                ✨ ถึงตาคุณแล้ว! ✨
              </div>
            ) : currentTurnPlayer ? (
              <div className="text-sm sm:text-base font-semibold text-white/90 drop-shadow-md bg-black/60 px-6 py-2 rounded-full inline-block border border-white/10 backdrop-blur-sm">
                กำลังรอ <span className="text-gold">{currentTurnPlayer.name}</span> เล่น...
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-full">
        {publicState?.status === "waiting" ? (
          isHost ? (
            <button type="button" onClick={handleStartGame} disabled={publicState.players.length < 2} className="px-10 py-5 rounded-2xl bg-gold text-felt-dark font-bold text-xl sm:text-2xl shadow-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold transition-colors">
              เริ่มเกม ({publicState.players.length}/{publicState.maxPlayers})
            </button>
          ) : (
            <p className="text-white/90 text-lg bg-black/40 px-6 py-3 rounded-full backdrop-blur-sm">
              รอเจ้าของห้องเริ่มเกม ({publicState.players.length}/{publicState.maxPlayers} ผู้เล่น)
            </p>
          )
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <AnimatePresence mode="popLayout">
                    {drawPileCount > 0 && (
                      <CardComponent key="draw-pile-card" card={{ id: "draw-pile", suit: "spades", rank: "A" }} index={0} totalInHand={1} isSelected={false} isDimmed={false} onClick={() => {}} faceDown />
                    )}
                  </AnimatePresence>
                  {drawPileCount > 0 && <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs whitespace-nowrap bg-black/40 px-2 py-1 rounded-full">เหลือ {drawPileCount} ใบ</span>}
                </div>
                <span className="text-white/90 text-sm mt-7 font-medium">กองจั่ว</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative">
                  <AnimatePresence mode="popLayout">
                    {discardTop ? (
                      <motion.div key={discardTop.id} initial={{ opacity: 0, scale: 0.5, rotate: Math.random() * 20 - 10 }} animate={{ opacity: 1, scale: 1, rotate: Math.random() * 10 - 5 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
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

            <button type="button" onClick={handleDrawAndDiscard} disabled={!isMyTurn || selectedIds.size === 0 || drawPileCount === 0} className={`mt-8 px-8 py-4 rounded-2xl font-bold text-xl transition-all border ${selectedIds.size === 0 || !isMyTurn ? "bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed opacity-70" : "bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:bg-blue-500 hover:scale-105 active:scale-95"}`}>
              {selectedIds.size === 0 ? "⚠️ เลือกไพ่ที่จะทิ้งก่อน" : "🃏 จั่ว 1 ใบ & ทิ้งไพ่"}
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-20 left-0 right-0 flex justify-center px-2 sm:px-4">
        <div className="flex items-end justify-center gap-0 min-h-[100px] pb-2">
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
        <span className="text-white/80 text-sm">ห้อง: {roomId} {publicState?.status === "waiting" && " (รอเริ่มเกม...)"} {publicState?.status === "playing" && " (กำลังเล่น)"} {publicState?.status === "ended" && " (รอบนี้จบแล้ว)"}</span>
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 border border-amber-500/50 px-3 py-1 rounded-full flex items-center gap-2 shadow-inner">
            <span>🪙</span><span className="text-gold font-bold">{myChips.toLocaleString()}</span>
          </div>
          <span className="text-white font-medium bg-black/40 px-3 py-1 rounded-lg border border-white/10">{username}</span>
        </div>
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 px-3 py-3 bg-black/50 backdrop-blur-sm rounded-xl z-20">
        <div className="flex gap-3 flex-shrink-0">
          <button type="button" onClick={handleKang} disabled={!isMyTurn} className={`px-5 py-2 rounded-lg text-base font-bold transition-all ${isMyTurn ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)] hover:scale-105" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}>
            แคง!
          </button>
          {canFlow && pendingFlow && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} type="button" onClick={handleFlow} className="px-5 py-2 rounded-lg text-base font-bold bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-bounce">
              🌊 ไหล {pendingFlow.rank} !
            </motion.button>
          )}
        </div>
        <span className="text-white/90 text-sm sm:text-base font-medium line-clamp-2 text-right min-w-0">{statusMessage}</span>
      </div>

      {/* ----------------- End Game Modal ----------------- */}
      {publicState?.status === "ended" && publicState.endedGameData && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.5 }} className="bg-felt-dark border-2 border-gold/50 rounded-3xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto">
              <div className="p-6 space-y-4">
                
                {/* ------ ข้อความเยาะเย้ยตอนจบเกม ------ */}
                <div className="text-center mt-2 mb-4">
                  <h3 className={`text-2xl sm:text-3xl font-black animate-bounce ${isMeWinner ? "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]" : "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"}`}>
                    {isMeWinner ? "🎉 ยินดีด้วย! คุณคือผู้ชนะ 🎉" : "💀 หลับไปซะไออ่อน 💀"}
                  </h3>
                </div>

                <div className="text-center bg-black/40 py-4 rounded-2xl border border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/10 to-transparent animate-pulse"></div>
                  <p className="text-white/70 text-sm font-bold">ผู้กวาดเงินกองกลาง</p>
                  <p className="text-gold text-4xl font-black mt-1 drop-shadow-md">
                    {publicState.endedGameData.winnerName}
                  </p>
                  <p className="text-amber-300 text-sm mt-3 font-bold bg-amber-500/20 inline-block px-4 py-1.5 rounded-full border border-amber-500/30">
                    {publicState.endedGameData.endGameReason === "instant_win" && "ชนะด้วยไพ่พิเศษ 👑"}
                    {publicState.endedGameData.endGameReason === "kang" && "แคงสำเร็จ 🎯"}
                    {publicState.endedGameData.endGameReason === "kang_shipwreck" && "แคงล่ม (ผู้เรียกแคงจ่ายรอบวง) 💀"}
                    {publicState.endedGameData.endGameReason === "empty_hand" && "ไพ่หมดมือ 🚀"}
                  </p>
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
                            <span className={`font-black text-xl bg-black/60 px-3 py-1 rounded-lg ${changeColor}`}>
                              {changeSign}{p.roundChipsChange}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.hand.map((card) => (
                            <CardComponent key={card.id} card={card} index={0} totalInHand={p.hand.length} isSelected={false} isDimmed={false} onClick={() => {}} compact />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isHost && (
                  <button type="button" onClick={handlePlayAgain} className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-black font-black text-xl hover:from-amber-400 hover:to-yellow-400 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                    ลุยรอบต่อไป!
                  </button>
                )}
                {!isHost && (
                  <p className="text-white/60 text-sm font-bold text-center mt-6 bg-black/30 py-3 rounded-xl border border-white/5">
                    รอเจ้าของห้องเปิดวงรอบใหม่...
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}