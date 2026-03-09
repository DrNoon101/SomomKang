const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 4000; 

app.use(cors({ origin: "*" })); 
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.get("/", (req, res) => res.send("Arcade Server is running."));

// ==========================================
// 🃏 ระบบเกม 1: SomomKang (อยู่ครบ 100%)
// ==========================================
const SUITS = ["spades", "hearts", "diamonds", "clubs"]; 
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10 };
const SUIT_ORDER = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 };
const rooms = new Map();

function createDeck() { const deck = []; let cardId = 0; for (const suit of SUITS) { for (const rank of RANKS) deck.push({ id: `${suit}-${rank}-${cardId++}`, suit, rank }); } return deck; }
function shuffle(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function getCardValue(rank) { return RANK_VALUES[rank] ?? 0; }
function getHandPoints(hand) { return hand.reduce((sum, card) => sum + getCardValue(card.rank), 0); }
function getCounts(hand) { const counts = {}; for (const c of hand) counts[c.rank] = (counts[c.rank] || 0) + 1; return Object.values(counts).sort((a, b) => b - a); }
function checkStraight(hand) {
  const nums = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 };
  const handNums = hand.map(c => nums[c.rank]).sort((a, b) => a - b);
  let isStraight = true; for (let i = 1; i < handNums.length; i++) { if (handNums[i] !== handNums[i - 1] + 1) isStraight = false; }
  if (isStraight) return true;
  const royal = [1, 10, 11, 12, 13]; if (handNums.every((val, index) => val === royal[index])) return true;
  return false;
}
function checkInstantWin(hand) {
  if (hand.length < 5) return null; const counts = getCounts(hand); const isFlush = hand.every(c => c.suit === hand[0].suit); const isStraight = checkStraight(hand);
  if (isStraight && isFlush) return "สเตรทฟลัช 👑"; if (counts[0] === 4) return "หอน 🐺"; if (counts[0] === 3 && counts[1] === 2) return "ฟูลเฮาส์ 🏡";
  if (isFlush) return "สี 🎨"; if (isStraight) return "เรียง 📶"; if (counts[0] === 3) return "ตอง 💥"; if (getHandPoints(hand) === 50) return "50 แต้ม 💯"; return null;
}
function getBestCardForTie(hand) {
  let best = null;
  for (const card of hand) { const value = getCardValue(card.rank); const suitOrder = SUIT_ORDER[card.suit]; if (!best) best = { card, value, suitOrder }; else if (value > best.value || (value === best.value && suitOrder > best.suitOrder)) best = { card, value, suitOrder }; }
  return best;
}
function getOrCreateRoom(roomId) { let room = rooms.get(roomId); if (!room) { room = { id: roomId, hostId: null, maxPlayers: 4, players: [], drawPile: [], discardPile: [], status: "waiting", currentTurnIndex: null, winnerId: null, instantWinType: null, endGameReason: null, pendingFlow: null }; rooms.set(roomId, room); } return room; }
function getPlayer(room, socketId) { return room.players.find((p) => p.id === socketId) || null; }
function getNextPlayerIndex(room, fromIndex) { if (room.players.length === 0) return null; return (fromIndex + 1) % room.players.length; }
function sendError(socket, message) { socket.emit("error_message", { message }); }
function distributeChips(room) {
  if (!room.winnerId) return; const BET_AMOUNT = 50; const winner = room.players.find((p) => p.id === room.winnerId); const losers = room.players.filter((p) => p.id !== room.winnerId);
  let totalWon = 0; room.players.forEach(p => p.roundChipsChange = 0);
  losers.forEach((loser) => { loser.chips -= BET_AMOUNT; loser.roundChipsChange = -BET_AMOUNT; totalWon += BET_AMOUNT; });
  if (winner) { winner.chips += totalWon; winner.roundChipsChange = totalWon; }
}
function buildPublicState(room) {
  const base = { roomId: room.id, hostId: room.hostId, maxPlayers: room.maxPlayers, status: room.status, currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id ?? null : null, drawPileCount: room.drawPile.length, discardTop: room.discardPile[room.discardPile.length - 1] || null, winnerId: room.winnerId, instantWinType: room.instantWinType, endGameReason: room.endGameReason, players: room.players.map((p) => ({ id: p.id, name: p.name, handCount: p.hand.length, connected: p.connected, chips: p.chips })) };
  if (room.status === "ended") { base.endedGameData = { winnerId: room.winnerId, winnerName: room.players.find((p) => p.id === room.winnerId)?.name ?? "—", endGameReason: room.endGameReason, instantWinType: room.instantWinType, players: room.players.map((p) => ({ id: p.id, name: p.name, hand: p.hand, points: getHandPoints(p.hand), chips: p.chips, roundChipsChange: p.roundChipsChange || 0 })) }; } return base;
}
function broadcastState(roomId) { const room = rooms.get(roomId); if (!room) return; const publicState = buildPublicState(room); for (const player of room.players) { io.to(player.id).emit("game_state", { public: publicState, yourHand: player.hand, yourPlayerId: player.id }); } }
function startGame(roomId) {
  const room = rooms.get(roomId); if (!room || room.players.length < 2) return;
  let deck = shuffle(createDeck()); room.drawPile = []; room.discardPile = []; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null;
  for (const player of room.players) { player.hand = deck.splice(0, 5); player.roundChipsChange = 0; }
  const firstDiscard = deck.shift(); if (firstDiscard) room.discardPile.push(firstDiscard);
  room.drawPile = deck; room.status = "playing"; room.currentTurnIndex = 0;
  for (const player of room.players) { const type = checkInstantWin(player.hand); if (type) { room.status = "ended"; room.winnerId = player.id; room.instantWinType = type; room.endGameReason = "instant_win"; distributeChips(room); broadcastState(roomId); return; } } broadcastState(roomId);
}
function resetRoom(roomId) { const room = rooms.get(roomId); if (!room) return; room.drawPile = []; room.discardPile = []; room.status = "waiting"; room.currentTurnIndex = null; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null; for (const player of room.players) { player.hand = []; player.roundChipsChange = 0; } broadcastState(roomId); }
function resolveKang(roomId, callerId) {
  const room = rooms.get(roomId); if (!room) return; const caller = getPlayer(room, callerId); if (!caller) return;
  const pointsByPlayer = room.players.map((p) => ({ id: p.id, name: p.name, points: getHandPoints(p.hand) })); const minPoints = Math.min(...pointsByPlayer.map((p) => p.points)); const playersWithMin = room.players.filter((p) => getHandPoints(p.hand) === minPoints);
  let winnerPlayer = playersWithMin[0];
  if (playersWithMin.length > 1) { for (const p of playersWithMin.slice(1)) { const bestP = getBestCardForTie(p.hand); const bestW = getBestCardForTie(winnerPlayer.hand); if (bestP.value > bestW.value || (bestP.value === bestW.value && bestP.suitOrder > bestW.suitOrder)) winnerPlayer = p; } }
  room.status = "ended"; room.winnerId = winnerPlayer.id; const callerPoints = getHandPoints(caller.hand); const othersHaveLowerOrEqual = pointsByPlayer.some((p) => p.id !== caller.id && p.points <= callerPoints);
  const kangSuccess = !othersHaveLowerOrEqual; room.endGameReason = kangSuccess ? "kang" : "kang_shipwreck"; distributeChips(room); io.to(room.id).emit("kang_result", { callerId, kangSuccess, winnerId: winnerPlayer.id, pointsByPlayer }); broadcastState(roomId);
}

// ==========================================
// 🎰 ระบบเกม 4: Gacha Hell
// ==========================================
const gachaRooms = new Map();

function getOrCreateGachaRoom(roomId) {
  let room = gachaRooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      hostId: null,
      status: "waiting",
      players: [],
      maxPlayers: 8,
      currentTurnIndex: null,
      deckCount: 0,
      lastCard: null,
      pendingCard: null,
      history: []
    };
    gachaRooms.set(roomId, room);
  }
  return room;
}

function buildGachaState(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      chips: p.chips
    })),
    currentTurnPlayerId:
      room.currentTurnIndex != null && room.players[room.currentTurnIndex]
        ? room.players[room.currentTurnIndex].id
        : null,
    deckCount: room.deckCount,
    lastCard: room.lastCard,
    history: room.history,
    maxPlayers: room.maxPlayers,
    pendingCard: room.pendingCard
  };
}

function broadcastGachaState(roomId) {
  const room = gachaRooms.get(roomId);
  if (!room) return;
  const state = buildGachaState(room);
  io.to(`gacha_${roomId}`).emit("gacha_state", state);
}

// ==========================================
// ✍️ ระบบเกม 2: นิยายยำเละ (Yamstory) (อยู่ครบ 100%)
// ==========================================
const yamRooms = new Map();
function getOrCreateYamRoom(roomId) { let room = yamRooms.get(roomId); if (!room) { room = { id: roomId, hostId: null, status: "waiting", players: [], currentTurnIndex: null, lastWords: "", turnCount: 0, fullStory: [], maxPlayers: 4, maxRounds: 5, currentRound: 1 }; yamRooms.set(roomId, room); } return room; }
function broadcastYamState(roomId) { const room = yamRooms.get(roomId); if (!room) return; const state = { roomId: room.id, hostId: room.hostId, status: room.status, players: room.players, currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null, lastWords: room.lastWords, turnCount: room.turnCount, maxPlayers: room.maxPlayers, maxRounds: room.maxRounds, currentRound: room.currentRound, fullStory: room.status === "ended" ? room.fullStory : undefined }; io.to(`yam_${roomId}`).emit("yam_state", state); }

// ==========================================
// 🏇 ระบบเกม 3: แข่งม้า(กาว)มรณะ (Drunk Racing) ✨ (ใหม่ล่าสุด!)
// ==========================================
const racingRooms = new Map();
const RACER_PROFILES = [
  { id: 1, name: "ม้าศึกพเนจร", emoji: "🐎" },
  { id: 2, name: "เต่าเทอร์โบ", emoji: "🐢" },
  { id: 3, name: "หอยทากดริฟท์", emoji: "🐌" },
  { id: 4, name: "หมูป่าคลั่ง", emoji: "🐗" }
];

function getOrCreateRacingRoom(roomId) {
  let room = racingRooms.get(roomId);
  if (!room) {
    room = {
      id: roomId, hostId: null, status: "waiting", players: [], maxPlayers: 8,
      racers: JSON.parse(JSON.stringify(RACER_PROFILES)).map(r => ({ ...r, progress: 0 })),
      winnerRacerId: null, raceInterval: null, totalPool: 0
    };
    racingRooms.set(roomId, room);
  }
  return room;
}

function broadcastRacingState(roomId) {
  const room = racingRooms.get(roomId);
  if (!room) return;
  io.to(`racing_${roomId}`).emit("racing_state", {
    roomId: room.id, hostId: room.hostId, status: room.status,
    players: room.players, racers: room.racers, winnerRacerId: room.winnerRacerId, totalPool: room.totalPool, maxPlayers: room.maxPlayers
  });
}

// ==========================================
// 🔌 Socket.io Events
// ==========================================
io.on("connection", (socket) => {
  console.log("[Gacha][Server] New connection", { socketId: socket.id });
  // --- SomomKang ---
  socket.on("join_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เล่น"; const room = getOrCreateRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { if (room.status !== "waiting") return sendError(socket, "เกมเริ่มไปแล้ว"); if (room.players.length >= room.maxPlayers) return sendError(socket, "ห้องเต็มแล้ว"); room.players.push({ id: socket.id, name: safeName, hand: [], connected: true, chips: 2500,hipsChange: 0 }); }
    socket.join(roomId); socket.data.roomId = roomId; broadcastState(roomId);
  });
  socket.on("start_game", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "waiting" && room.hostId === socket.id) startGame(roomId); });
  socket.on("play_again", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "ended" && room.hostId === socket.id) resetRoom(roomId); });
  socket.on("draw_and_discard", ({ roomId, discardCardIds }) => {
    const room = rooms.get(roomId); if (!room || room.status !== "playing") return; const playerIndex = room.players.findIndex((p) => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex]; if (room.pendingFlow && room.pendingFlow.toPlayerId === socket.id) room.pendingFlow = null; if (room.drawPile.length === 0) return;
    const drawnCard = room.drawPile.shift(); if (drawnCard) player.hand.push(drawnCard);
    const cardsToDiscard = []; for (const cardId of discardCardIds || []) { const card = player.hand.find((c) => c.id === cardId); if (!card) return; cardsToDiscard.push(card); }
    if (cardsToDiscard.length === 0) return; const rank = cardsToDiscard[0].rank; if (!cardsToDiscard.every((c) => c.rank === rank)) return;
    for (const card of cardsToDiscard) { player.hand = player.hand.filter((c) => c.id !== card.id); room.discardPile.push(card); }
    if (player.hand.length === 0) { room.status = "ended"; room.winnerId = player.id; room.endGameReason = "empty_hand"; distributeChips(room); broadcastState(roomId); return; }
    const lastDiscard = room.discardPile[room.discardPile.length - 1];
    if (lastDiscard) { const nextIndex = getNextPlayerIndex(room, playerIndex); if (nextIndex != null) { const nextPlayer = room.players[nextIndex]; room.pendingFlow = { rank: lastDiscard.rank, fromPlayerId: player.id, toPlayerId: nextPlayer.id }; io.to(nextPlayer.id).emit("flow_available", { roomId, rank: lastDiscard.rank, fromPlayerId: player.id }); } }
    const nextIndex = getNextPlayerIndex(room, playerIndex); if (nextIndex != null) room.currentTurnIndex = nextIndex; broadcastState(roomId);
  });
  socket.on("kang", ({ roomId }) => { const room = rooms.get(roomId); if (!room || room.status !== "playing") return; const playerIndex = room.players.findIndex((p) => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return; resolveKang(roomId, socket.id); });
  socket.on("flow_discard", ({ roomId, cardIds }) => {
    const room = rooms.get(roomId); if (!room || !room.pendingFlow || room.pendingFlow.toPlayerId !== socket.id) return;
    const player = getPlayer(room, socket.id); if (!player) return;
    const cardsToDiscard = []; for (const cardId of cardIds) { const card = player.hand.find((c) => c.id === cardId); if (!card) return; cardsToDiscard.push(card); }
    if (cardsToDiscard.length === 0 || !cardsToDiscard.every((c) => c.rank === room.pendingFlow.rank)) return;
    const victim = getPlayer(room, room.pendingFlow.fromPlayerId); const FLOW_PENALTY = 25 * cardsToDiscard.length;
    if (victim) { victim.chips -= FLOW_PENALTY; player.chips += FLOW_PENALTY; io.to(victim.id).emit("got_flowed_mock"); }
    io.to(roomId).emit("player_flowed", { playerId: player.id, victimId: victim ? victim.id : null });
    for (const card of cardsToDiscard) { player.hand = player.hand.filter((c) => c.id !== card.id); room.discardPile.push(card); }
    if (player.hand.length === 0) { room.status = "ended"; room.winnerId = player.id; room.endGameReason = "empty_hand"; distributeChips(room); io.to(room.id).emit("flow_win", { winnerId: player.id, rank: room.pendingFlow.rank }); } 
    else { const playerIndex = room.players.findIndex((p) => p.id === player.id); const nextIndex = getNextPlayerIndex(room, playerIndex); if (nextIndex != null) room.currentTurnIndex = nextIndex; }
    room.pendingFlow = null; broadcastState(roomId);
  });

  // --- Yamstory ---
  socket.on("join_yam_room", ({ roomId, username, maxPlayers, maxRounds }) => {
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "นักเขียน"; const room = getOrCreateYamRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; if (maxRounds) room.maxRounds = maxRounds; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { if (room.players.length >= room.maxPlayers) { socket.emit("yam_error", { message: "เต็มแล้ว" }); return; } if (room.status !== "waiting") { socket.emit("yam_error", { message: "เริ่มแล้ว" }); return; } room.players.push({ id: socket.id, name: safeName, connected: true }); }
    socket.join(`yam_${roomId}`); socket.data.yamRoomId = roomId; broadcastYamState(roomId);
  });
  socket.on("start_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; room.status = "playing"; room.currentTurnIndex = 0; room.turnCount = 0; room.currentRound = 1; room.lastWords = ""; room.fullStory = []; broadcastYamState(roomId); });
  socket.on("submit_yam_text", ({ roomId, text }) => {
    const room = yamRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex]; const cleanText = text.trim(); room.fullStory.push({ playerId: player.id, playerName: player.name, text: cleanText });
    try { const segmenter = new Intl.Segmenter('th-TH', { granularity: 'word' }); const segments = Array.from(segmenter.segment(cleanText)); if (segments.length <= 5) room.lastWords = cleanText; else room.lastWords = "..." + segments.slice(-5).map(s => s.segment).join(""); } catch (e) { room.lastWords = cleanText.length > 30 ? "..." + cleanText.slice(-30) : cleanText; }
    room.turnCount++; if (room.turnCount % room.players.length === 0) room.currentRound++;
    if (room.currentRound > room.maxRounds) room.status = "ended"; else room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    broadcastYamState(roomId);
  });
  socket.on("end_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.hostId !== socket.id) return; room.status = "ended"; broadcastYamState(roomId); });
  socket.on("reset_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.hostId !== socket.id) return; room.status = "waiting"; room.lastWords = ""; room.turnCount = 0; room.currentRound = 1; room.fullStory = []; broadcastYamState(roomId); });

  // --- 🏇 Drunk Racing ---
  socket.on("join_racing_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "นักลงทุน"; const room = getOrCreateRacingRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else {
      if (room.status !== "waiting") return socket.emit("racing_error", { message: "ม้าออกตัวไปแล้ว รอตาหน้านะ!" });
      if (room.players.length >= room.maxPlayers) return socket.emit("racing_error", { message: "สนามแข่งเต็มแล้ว!" });
      room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500,Amount: 0, betRacerId: null, wonAmount: 0 });
    }
    socket.join(`racing_${roomId}`); socket.data.racingRoomId = roomId; broadcastRacingState(roomId);
  });

  socket.on("place_bet", ({ roomId, racerId, amount }) => {
    const room = racingRooms.get(roomId); if (!room || room.status !== "waiting") return;
    const player = room.players.find(p => p.id === socket.id); if (!player || player.chips < amount) return;
    
    // คืนเงินเดิมพันเก่าก่อน (ถ้าเคยแทงไปแล้ว)
    if (player.betAmount > 0) { player.chips += player.betAmount; room.totalPool -= player.betAmount; }
    
    player.betRacerId = racerId; player.betAmount = amount;
    player.chips -= amount; room.totalPool += amount;
    broadcastRacingState(roomId);
  });

  socket.on("start_race", ({ roomId }) => { 
    const room = racingRooms.get(roomId); 
    if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; 
    room.status = "playing"; room.winnerRacerId = null; room.players.forEach(p => p.wonAmount = 0); 
    broadcastRacingState(roomId); 
    
    // 🔥 ปรับความกาวให้ลุ้นนานขึ้น!
    room.raceInterval = setInterval(() => { 
      let hasWinner = false; 
      room.racers.forEach(r => { 
        // 🐢 สุ่มเดินหน้า 0-3 เปอร์เซ็นต์ (ลดจากเดิม 0-8 เพื่อให้วิ่งช้าลงแบบอืดๆ)
        const move = Math.floor(Math.random() * 4); 
        r.progress += move; 
        if (r.progress >= 100) { 
          r.progress = 100; hasWinner = true; 
          if(!room.winnerRacerId) room.winnerRacerId = r.id; 
        } 
      }); 
      broadcastRacingState(roomId); 
      
      if (hasWinner) { 
        clearInterval(room.raceInterval); room.status = "ended"; 
        const winners = room.players.filter(p => p.betRacerId === room.winnerRacerId); 
        if (winners.length > 0) { 
          const totalWinningBets = winners.reduce((sum, p) => sum + p.betAmount, 0); 
          winners.forEach(p => { 
            const proportion = p.betAmount / totalWinningBets; 
            p.wonAmount = Math.floor(room.totalPool * proportion); 
            p.chips += p.wonAmount; 
          }); 
        } 
        broadcastRacingState(roomId); 
      } 
    }, 300); // ⏱️ ปรับให้หน้าจอขยับสมูทขึ้น (ทุกๆ 0.3 วินาที) แต่อัตราก้าวเดินสั้นลง
  });

  socket.on("reset_race", ({ roomId }) => {
    const room = racingRooms.get(roomId); if (!room || room.hostId !== socket.id) return;
    room.status = "waiting"; room.totalPool = 0; room.winnerRacerId = null;
    room.racers = JSON.parse(JSON.stringify(RACER_PROFILES)).map(r => ({ ...r, progress: 0 }));
    room.players.forEach(p => { p.betAmount = 0; p.betRacerId = null; p.wonAmount = 0; });
    broadcastRacingState(roomId);
  });

  // --- Gacha Hell ---
  socket.on("join_gacha_room", ({ roomId, username, maxPlayers }) => {
    console.log("[Gacha][Server] join_gacha_room received", { socketId: socket.id, roomId, username, maxPlayers });
    if (!roomId) return;
    const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เสี่ยงดวง";
    const room = getOrCreateGachaRoom(roomId);
    console.log("[Gacha][Server] current gacha room before join", {
      roomId,
      status: room.status,
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected }))
    });

    if (room.players.length === 0) {
      room.hostId = socket.id;
      if (maxPlayers) room.maxPlayers = maxPlayers;
    }

    let existingPlayer = room.players.find((p) => p.name === safeName);
    if (existingPlayer) {
      if (room.hostId === existingPlayer.id) room.hostId = socket.id;
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
    } else {
      if (room.status !== "waiting") {
        socket.emit("gacha_error", { message: "เกมเริ่มไปแล้ว" });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        socket.emit("gacha_error", { message: "ห้องเต็มแล้ว" });
        return;
      }
      room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500 });
      console.log("[Gacha][Server] new player joined room", {
        roomId,
        playerId: socket.id,
        name: safeName,
        playersCount: room.players.length
      });
    }

    const roomName = `gacha_${roomId}`;
    console.log("[Gacha][Server] joining socket to room", { socketId: socket.id, roomName });
    socket.join(roomName);
    socket.data.gachaRoomId = roomId;
    console.log("[Gacha][Server] broadcasting initial gacha_state after join", { roomId });
    broadcastGachaState(roomId);
  });

  socket.on("start_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId);
    if (!room || room.status !== "waiting" || room.hostId !== socket.id) {
      console.warn("[Gacha][Server] start_gacha rejected", {
        socketId: socket.id,
        roomExists: !!room,
        status: room && room.status,
        hostId: room && room.hostId
      });
      return;
    }
    if (room.players.length < 2) {
      console.warn("[Gacha][Server] start_gacha rejected because not enough players", {
        roomId,
        players: room.players.length
      });
      return;
    }

    room.status = "playing";
    room.currentTurnIndex = 0;
    room.deckCount = 30;
    room.lastCard = null;
    room.pendingCard = null;
    room.history = [];
    console.log("[Gacha][Server] start_gacha -> broadcasting state", {
      roomId,
      players: room.players.length,
      deckCount: room.deckCount
    });
    broadcastGachaState(roomId);
  });

  socket.on("draw_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId);
    if (!room || room.status !== "playing" || room.deckCount <= 0) {
      console.warn("[Gacha][Server] draw_gacha rejected", {
        socketId: socket.id,
        roomExists: !!room,
        status: room && room.status,
        deckCount: room && room.deckCount
      });
      return;
    }

    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (playerIndex === -1 || playerIndex !== room.currentTurnIndex) {
      console.warn("[Gacha][Server] draw_gacha rejected because not player's turn", {
        socketId: socket.id,
        roomId,
        playerIndex,
        currentTurnIndex: room.currentTurnIndex
      });
      return;
    }
    const player = room.players[playerIndex];

    const delta = Math.floor(Math.random() * 801) - 400; // -400 .. 400
    const gained = delta >= 0;

    if (delta !== 0) {
      player.chips += delta;
    }

    const card = {
      id: `gacha-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: gained ? "โชคดี!" : "ซวยจัด!",
      emoji: gained ? "🎁" : "💀",
      desc: gained ? `ได้รับชิป ${delta} 💰` : `เสียชิป ${-delta} 💰`,
      player: player.name,
      log: gained
        ? `${player.name} เปิดได้ +${delta} ชิป` 
        : `${player.name} เปิดได้ -${-delta} ชิป`,
      type: "normal",
      val: delta
    };

    room.lastCard = card;
    room.history = [card.log, ...room.history].slice(0, 100);
    room.deckCount = Math.max(0, room.deckCount - 1);

    if (room.deckCount === 0) {
      room.status = "ended";
    } else {
      const nextIndex =
        room.players.length > 0 ? (playerIndex + 1) % room.players.length : null;
      room.currentTurnIndex = nextIndex;
    }

    console.log("[Gacha][Server] draw_gacha -> broadcasting state", {
      roomId,
      playerId: player.id,
      delta,
      deckCount: room.deckCount,
      nextTurnIndex: room.currentTurnIndex
    });
    broadcastGachaState(roomId);
  });

  socket.on("reset_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    room.status = "waiting";
    room.currentTurnIndex = null;
    room.deckCount = 0;
    room.lastCard = null;
    room.pendingCard = null;
    room.history = [];

    console.log("[Gacha][Server] reset_gacha -> broadcasting state", {
      roomId,
      players: room.players.length
    });
    broadcastGachaState(roomId);
  });

  // --- Disconnect Handler สำหรับทุกเกม (แก้บั๊กห้องผีสิง) ---
  socket.on("disconnect", () => {
    // 1. จัดการ SomomKang
    const roomId = socket.data.roomId; 
    if (roomId) { 
      const room = rooms.get(roomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { 
          if (room.status === "waiting") room.players.splice(playerIndex, 1); 
          else room.players[playerIndex].connected = false; 
        } 
        if (room.hostId === socket.id) { 
          const nextHost = room.players.find(p => p.connected); 
          room.hostId = nextHost ? nextHost.id : null; 
        } 
        // 🔥 เช็คตรงนี้: ถ้าไม่มีใครออนไลน์เลย = ลบห้องทิ้ง!
        if (!room.players.some(p => p.connected)) {
          rooms.delete(roomId); 
        } else {
          broadcastState(roomId); 
        }
      } 
    }
    
    // 2. จัดการ Yamstory
    const yamRoomId = socket.data.yamRoomId; 
    if (yamRoomId) { 
      const room = yamRooms.get(yamRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { 
          if (room.status === "waiting") room.players.splice(playerIndex, 1); 
          else room.players[playerIndex].connected = false; 
        } 
        if (room.hostId === socket.id) { 
          const nextHost = room.players.find(p => p.connected); 
          room.hostId = nextHost ? nextHost.id : null; 
        } 
        if (!room.players.some(p => p.connected)) yamRooms.delete(yamRoomId); 
        else broadcastYamState(yamRoomId); 
      } 
    }
    
    // 3. จัดการ Drunk Racing
    const racingRoomId = socket.data.racingRoomId; 
    if (racingRoomId) { 
      const room = racingRooms.get(racingRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { 
          if (room.status === "waiting") room.players.splice(playerIndex, 1); 
          else room.players[playerIndex].connected = false; 
        } 
        if (room.hostId === socket.id) { 
          const nextHost = room.players.find(p => p.connected); 
          room.hostId = nextHost ? nextHost.id : null; 
        } 
        if (!room.players.some(p => p.connected)) { 
          if(room.raceInterval) clearInterval(room.raceInterval); 
          racingRooms.delete(racingRoomId); 
        } 
        else broadcastRacingState(racingRoomId); 
      } 
    }
    
    // 4. จัดการ Gacha Hell
    const gachaRoomId = socket.data.gachaRoomId; 
    if (gachaRoomId) { 
      const room = gachaRooms.get(gachaRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { 
          if (room.status === "waiting") room.players.splice(playerIndex, 1); 
          else room.players[playerIndex].connected = false; 
        } 
        if (room.hostId === socket.id) { 
          const nextHost = room.players.find(p => p.connected); 
          room.hostId = nextHost ? nextHost.id : null; 
        } 
        if (!room.players.some(p => p.connected)) gachaRooms.delete(gachaRoomId); 
        else broadcastGachaState(gachaRoomId); 
      } 
    }
  }); // อันนี้คือปิดของ socket.on("disconnect")

}); // 🔥 พี่บอมต้องมีบรรทัดนี้ครับ (เติมเข้าไปเลย) เพื่อปิด io.on("connection")

httpServer.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });