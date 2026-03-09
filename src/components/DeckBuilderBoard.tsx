"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface Card { id: string; faction: string; name: string; emoji: string; cost: number; effect: any; ally: any; }
interface Player { id: string; name: string; connected: boolean; hp: number; gold: number; combat: number; deckCount: number; discardCount: number; playArea: Card[]; }
interface DeckState { roomId: string; hostId: string; status: "waiting" | "playing" | "ended"; maxPlayers: number; market: Card[]; currentTurnPlayerId: string | null; history?: string[]; players: Player[]; myHand?: Card[]; }

export default function DeckBuilderBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<DeckState | null>(null);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const soundsRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      soundsRef.current = {
        play: new Audio("https://www.soundjay.com/buttons/sounds/button-09.mp3"),
        buy: new Audio("https://www.soundjay.com/misc/sounds/coins-in-hand-2.mp3"),
        attack: new Audio("https://www.soundjay.com/mechanical/sounds/explosion-01.mp3"),
        win: new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3"),
        scrap: new Audio("https://www.soundjay.com/nature/sounds/fire-1.mp3") // 🔥 เสียงเผาไพ่
      };
      Object.values(soundsRef.current).forEach(audio => { audio.volume = 0.5; });
    }
  }, []);

  const playSound = (type: string) => {
    if (!soundUnlocked) return;
    const audio = soundsRef.current[type];
    if (audio) { audio.currentTime = 0; audio.play().catch(e => console.log(e)); }
  };

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);
    const attemptJoin = () => {
      const maxPlayers = parseInt(sessionStorage.getItem("deckbuilder_maxPlayers") || "2");
      s.emit("join_deck_room", { roomId, username, maxPlayers });
    };
    s.on("connect", attemptJoin);
    if (s.connected) attemptJoin();
    s.on("deck_state", (state: DeckState) => {
      setGameState(state);
      if (state.status === "ended") playSound("win");
    });
    s.on("deck_error", (msg) => { alert(msg.message); router.push("/"); });
    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  if (!gameState || !socket) return <div className="min-h-dvh flex items-center justify-center bg-slate-950 text-white"><div className="text-6xl animate-spin">⚔️</div></div>;

  const isHost = socket.id === gameState.hostId;
  const isMyTurn = socket.id === gameState.currentTurnPlayerId;
  const me = gameState.players.find(p => p.id === socket.id);
  const opponents = gameState.players.filter(p => p.id !== socket.id);

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
    // 🔥 2 บรรทัดที่เพิ่มเข้ามาใหม่
    if(effect.steal) text.push(`ขโมยศัตรู ${effect.steal} 💰`);
    if(effect.discardEnemy) text.push(`ศัตรูทิ้งไพ่ ${effect.discardEnemy} 🗑️`);
    return text.join(" | ");
  };

  const handlePlayCard = (cardId: string) => { playSound("play"); socket.emit("play_deck_card", { roomId, cardId }); };
  const handleBuyCard = (cardId: string) => { playSound("buy"); socket.emit("buy_deck_card", { roomId, cardId }); };
  const handleEndTurn = () => { playSound("attack"); socket.emit("end_deck_turn", { roomId }); };
  // 🔥 ฟังก์ชันยิงคำสั่งเผาไพ่
  const handleScrapCard = (cardId: string) => { playSound("scrap"); socket.emit("scrap_deck_card", { roomId, cardId }); };

  return (
    <div className="min-h-dvh bg-slate-950 text-white font-sans flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] h-dvh overflow-hidden">
      
      {!soundUnlocked && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] bg-cyan-600 text-white px-6 py-2 rounded-full font-bold shadow-xl animate-bounce cursor-pointer border-2 border-white" onClick={() => { setSoundUnlocked(true); playSound("play"); }}>
          🔊 คลิกลงกระดาน 1 ที เพื่อปลดล็อกระบบเสียง!
        </div>
      )}

      <header className="bg-black/80 p-3 flex justify-between items-center z-20 border-b border-cyan-500/30 shrink-0">
        <div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">⚔️ Deck Builder</h1>
          <p className="text-cyan-300 text-xs">ROOM: {roomId} | ผู้เล่น: {username}</p>
        </div>
        <button onClick={() => router.push("/")} className="bg-red-900/50 text-red-400 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition">ออกเกม</button>
      </header>

      {gameState.status === "ended" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-cyan-500 p-8 rounded-3xl text-center shadow-[0_0_50px_cyan]">
            <h2 className="text-5xl font-black text-cyan-400 mb-4">🏆 จบเกม!</h2>
            <p className="text-2xl text-white mb-8">{gameState.history?.[0]}</p>
            {isHost && <button onClick={() => socket.emit("reset_deck_game", { roomId })} className="px-6 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500">สับไพ่เล่นใหม่</button>}
          </div>
        </div>
      )}

      {gameState.status === "waiting" && (
        <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 overflow-y-auto">
          <div className="text-center bg-black/60 p-10 rounded-3xl border border-cyan-900/50 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
            <h2 className="text-3xl font-black mb-4 text-cyan-300">รอปาร์ตี้ ({gameState.players.length}/{gameState.maxPlayers})</h2>
            <div className="flex flex-col gap-3 mt-6">
              {gameState.players.map((p) => (
                <div key={p.id} className="bg-slate-800/80 px-6 py-4 rounded-xl border border-slate-600 flex justify-between items-center min-w-[300px]">
                  <span className="font-bold text-xl">{p.name} {p.id === gameState.hostId && "👑"}</span>
                  <span className={`text-sm font-bold ${p.connected ? 'text-green-400' : 'text-red-400'}`}>{p.connected ? "🟢" : "🔴"}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button onClick={() => socket.emit("start_deck_game", { roomId })} disabled={gameState.players.length < 2} className="mt-8 px-8 py-4 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 disabled:opacity-50 text-white font-black text-xl rounded-2xl transition-all shadow-lg">เริ่มสับไพ่!</button>
            ) : (<div className="mt-8 text-cyan-500/70 font-bold animate-pulse">รอหัวหน้าห้องเริ่มเกม...</div>)}
          </div>
        </main>
      )}

      {gameState.status === "playing" && (
        <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 z-10 overflow-hidden h-full">
          <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
            
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              
              <div className="flex gap-2 overflow-x-auto shrink-0 mb-2">
                {opponents.map(op => (
                  <div key={op.id} className={`flex-1 min-w-[200px] bg-red-950/30 border-2 ${gameState.currentTurnPlayerId === op.id ? 'border-red-400 shadow-[0_0_15px_red]' : 'border-red-900/50'} rounded-2xl p-3 flex justify-between items-center`}>
                    <div>
                      <p className="text-red-400 font-bold">{op.name}</p>
                      <p className="text-[10px] text-gray-400">เด็ค: {op.deckCount} | ทิ้ง: {op.discardCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-green-400">{op.hp}💖</p>
                      <div className="flex gap-2 text-[10px] font-bold mt-1 justify-end"><span className="text-red-400">{op.combat}⚔️</span><span className="text-yellow-400">{op.gold}💰</span></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-1 p-3 bg-black/60 border border-cyan-900/50 rounded-2xl shrink-0">
                <div className="flex justify-center gap-2 overflow-x-auto pb-1">
                  {gameState.market.map((card, idx) => {
                    const canAfford = isMyTurn && (me?.gold || 0) >= card.cost;
                    return (
                      <div key={idx} onClick={() => canAfford && handleBuyCard(card.id)} className={`w-24 h-36 flex-shrink-0 bg-gradient-to-b ${getFactionColors(card.faction)} border-2 rounded-xl flex flex-col items-center justify-between p-1.5 relative ${canAfford ? "hover:-translate-y-2 cursor-pointer shadow-[0_0_15px_rgba(250,204,21,0.5)]" : "opacity-60 grayscale-[40%]"}`}>
                        <span className="bg-black/70 text-yellow-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full absolute top-1 right-1">💰{card.cost}</span>
                        <div className="text-3xl mt-3">{card.emoji}</div>
                        <div className="text-center w-full leading-tight">
                          <p className="text-[9px] font-black uppercase truncate">{card.name}</p>
                          <div className="bg-black/60 mt-0.5 py-0.5 rounded text-[8px] text-white font-bold">{getEffectText(card.effect)}</div>
                          {card.ally && Object.keys(card.ally).length > 0 && <div className="text-[7px] text-gray-300 mt-0.5">🤝{getEffectText(card.ally)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-auto shrink-0">
                
                <div className="h-16 sm:h-20 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center gap-2 p-2 overflow-x-auto">
                  {me?.playArea && me.playArea.length === 0 && <p className="text-slate-500 text-xs font-bold w-full text-center">ยังไม่ได้เล่นไพ่ในเทิร์นนี้...</p>}
                  {me?.playArea?.map((card, idx) => (
                    <div key={idx} title={card.name} className={`w-12 h-16 flex-shrink-0 bg-gradient-to-b ${getFactionColors(card.faction)} border rounded-md flex items-center justify-center text-xl`}>{card.emoji}</div>
                  ))}
                </div>

                <div className="flex justify-between items-end gap-2">
                  <div className="flex gap-2">
                    <div className="bg-green-900/80 border-2 border-green-500 p-2 rounded-xl text-center min-w-[60px]"><p className="text-green-300 text-[9px] font-bold">HP</p><p className="text-xl font-black text-white">{me?.hp}</p></div>
                    <div className="bg-yellow-900/80 border-2 border-yellow-500 p-2 rounded-xl text-center min-w-[60px]"><p className="text-yellow-300 text-[9px] font-bold">Gold</p><p className="text-xl font-black text-white">{me?.gold}</p></div>
                    <div className="bg-red-900/80 border-2 border-red-500 p-2 rounded-xl text-center min-w-[60px]"><p className="text-red-300 text-[9px] font-bold">Combat</p><p className="text-xl font-black text-white">{me?.combat}</p></div>
                  </div>
                  {isMyTurn ? (
                    <button onClick={handleEndTurn} className="bg-gradient-to-r from-red-600 to-red-800 border-2 border-red-400 px-4 py-2 rounded-xl font-black text-white hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse text-sm">⚔️ โจมตี & จบเทิร์น</button>
                  ) : (
                    <div className="bg-slate-800 text-slate-500 border-2 border-slate-600 px-4 py-2 rounded-xl font-bold text-sm">รอเทิร์นเพื่อน...</div>
                  )}
                </div>
                
                <div className="bg-slate-900/70 border-t-2 border-slate-600 rounded-t-2xl p-3 flex justify-center gap-2 overflow-x-auto min-h-[140px] sm:min-h-[160px]">
                  {gameState.myHand?.map((card) => {
                    const canScrap = isMyTurn && (me?.gold || 0) >= 3;
                    return (
                      <div key={card.id} className={`w-24 h-36 flex-shrink-0 bg-gradient-to-b ${getFactionColors(card.faction)} border-2 rounded-xl flex flex-col items-center justify-between p-1.5 relative group ${isMyTurn ? "hover:-translate-y-4 cursor-pointer hover:shadow-[0_0_20px_white] transition-transform z-10" : "opacity-80"}`}>
                        
                        {/* 🔥 ปุ่มเผาไพ่ (โผล่มาเฉพาะตอนมีเงิน 3G+) */}
                        {canScrap && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleScrapCard(card.id); }}
                            className="absolute -top-3 -left-3 bg-red-600 hover:bg-red-500 text-white rounded-full px-2 py-1 text-[9px] font-black border border-white opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
                            title="จ่าย 3 Gold เผาไพ่ทิ้งถาวร"
                          >
                            🔥เผา(3G)
                          </button>
                        )}

                        <div onClick={() => isMyTurn && handlePlayCard(card.id)} className="w-full h-full flex flex-col items-center justify-between">
                          <div className="text-3xl mt-2">{card.emoji}</div>
                          <div className="text-center w-full leading-tight">
                            <p className="text-[9px] font-black uppercase truncate">{card.name}</p>
                            <div className="bg-black/60 mt-0.5 py-0.5 rounded text-[8px] text-white font-bold">{getEffectText(card.effect)}</div>
                            {card.ally && Object.keys(card.ally).length > 0 && <div className="text-[7px] text-yellow-300 mt-0.5 font-bold">🤝{getEffectText(card.ally)}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="hidden md:flex w-64 flex-col bg-black/60 border border-slate-700 rounded-2xl p-3 max-h-[85vh] overflow-hidden">
              <h3 className="text-cyan-400 font-bold text-sm border-b border-slate-700 pb-2 mb-2 shrink-0">📜 บันทึกสงคราม</h3>
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 min-h-0">
                {gameState.history?.map((log, idx) => (
                  <div key={idx} className={`text-[10px] p-1.5 rounded bg-slate-800/50 border-l-2 ${idx===0 ? 'border-cyan-400 text-white' : 'border-slate-500 text-slate-400'}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}