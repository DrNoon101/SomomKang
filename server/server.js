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
// 🃏 ระบบเกม 1: SomomKang (สมมแคง)
// ==========================================
const SUITS = ["spades", "hearts", "diamonds", "clubs"]; 
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]; 
const RANK_VALUES = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10 }; 
const SUIT_ORDER = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 }; 
const rooms = new Map();

function createDeck() { 
  const deck = []; let cardId = 0; 
  for (const suit of SUITS) { 
    for (const rank of RANKS) deck.push({ id: `${suit}-${rank}-${cardId++}`, suit, rank }); 
  } 
  return deck; 
}
function shuffle(deck) { 
  for (let i = deck.length - 1; i > 0; i--) { 
    const j = Math.floor(Math.random() * (i + 1)); 
    [deck[i], deck[j]] = [deck[j], deck[i]]; 
  } 
  return deck; 
}
function getCardValue(rank) { return RANK_VALUES[rank] ?? 0; } 
function getHandPoints(hand) { return hand.reduce((sum, card) => sum + getCardValue(card.rank), 0); } 
function getCounts(hand) { 
  const counts = {}; 
  for (const c of hand) counts[c.rank] = (counts[c.rank] || 0) + 1; 
  return Object.values(counts).sort((a, b) => b - a); 
}
function checkStraight(hand) { 
  const nums = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 }; 
  const handNums = hand.map(c => nums[c.rank]).sort((a, b) => a - b); 
  let isStraight = true; 
  for (let i = 1; i < handNums.length; i++) { 
    if (handNums[i] !== handNums[i - 1] + 1) isStraight = false; 
  } 
  if (isStraight) return true; 
  const royal = [1, 10, 11, 12, 13]; 
  if (handNums.every((val, index) => val === royal[index])) return true; 
  return false; 
}
function checkInstantWin(hand) { 
  if (hand.length < 5) return null; 
  const counts = getCounts(hand); 
  const isFlush = hand.every(c => c.suit === hand[0].suit); 
  const isStraight = checkStraight(hand); 
  if (isStraight && isFlush) return "สเตรทฟลัช 👑"; 
  if (counts[0] === 4) return "หอน 🐺"; 
  if (counts[0] === 3 && counts[1] === 2) return "ฟูลเฮาส์ 🏡"; 
  if (isFlush) return "สี 🎨"; 
  if (isStraight) return "เรียง 📶"; 
  if (counts[0] === 3) return "ตอง 💥"; 
  if (getHandPoints(hand) === 50) return "50 แต้ม 💯"; 
  return null; 
}
function getBestCardForTie(hand) { 
  let best = null; 
  for (const card of hand) { 
    const value = getCardValue(card.rank); 
    const suitOrder = SUIT_ORDER[card.suit]; 
    if (!best) best = { card, value, suitOrder }; 
    else if (value > best.value || (value === best.value && suitOrder > best.suitOrder)) best = { card, value, suitOrder }; 
  } 
  return best; 
}
function getOrCreateRoom(roomId) { 
  let room = rooms.get(roomId); 
  if (!room) { 
    room = { id: roomId, hostId: null, maxPlayers: 4, players: [], drawPile: [], discardPile: [], status: "waiting", currentTurnIndex: null, winnerId: null, instantWinType: null, endGameReason: null, pendingFlow: null }; 
    rooms.set(roomId, room); 
  } 
  return room; 
}
function getPlayer(room, socketId) { return room.players.find((p) => p.id === socketId) || null; } 
function getNextPlayerIndex(room, fromIndex) { 
  if (room.players.length === 0) return null; 
  return (fromIndex + 1) % room.players.length; 
} 
function sendError(socket, message) { socket.emit("error_message", { message }); }
function distributeChips(room) { 
  if (!room.winnerId) return; 
  const BET_AMOUNT = 50; 
  const winner = room.players.find((p) => p.id === room.winnerId); 
  const losers = room.players.filter((p) => p.id !== room.winnerId); 
  let totalWon = 0; 
  room.players.forEach(p => p.roundChipsChange = 0); 
  losers.forEach((loser) => { 
    loser.chips -= BET_AMOUNT; loser.roundChipsChange = -BET_AMOUNT; totalWon += BET_AMOUNT; 
  }); 
  if (winner) { winner.chips += totalWon; winner.roundChipsChange = totalWon; } 
}
function buildPublicState(room) { 
  const base = { 
    roomId: room.id, hostId: room.hostId, maxPlayers: room.maxPlayers, status: room.status, 
    currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id ?? null : null, 
    drawPileCount: room.drawPile.length, discardTop: room.discardPile[room.discardPile.length - 1] || null, 
    winnerId: room.winnerId, instantWinType: room.instantWinType, endGameReason: room.endGameReason, 
    players: room.players.map((p) => ({ id: p.id, name: p.name, handCount: p.hand.length, connected: p.connected, chips: p.chips })) 
  }; 
  if (room.status === "ended") { 
    base.endedGameData = { 
      winnerId: room.winnerId, winnerName: room.players.find((p) => p.id === room.winnerId)?.name ?? "—", 
      endGameReason: room.endGameReason, instantWinType: room.instantWinType, 
      players: room.players.map((p) => ({ id: p.id, name: p.name, hand: p.hand, points: getHandPoints(p.hand), chips: p.chips, roundChipsChange: p.roundChipsChange || 0 })) 
    }; 
  } 
  return base; 
}
function broadcastState(roomId) { 
  const room = rooms.get(roomId); if (!room) return; 
  const publicState = buildPublicState(room); 
  for (const player of room.players) { io.to(player.id).emit("game_state", { public: publicState, yourHand: player.hand, yourPlayerId: player.id }); } 
}
function startGame(roomId) { 
  const room = rooms.get(roomId); if (!room || room.players.length < 2) return; 
  let deck = shuffle(createDeck()); room.drawPile = []; room.discardPile = []; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null; 
  for (const player of room.players) { player.hand = deck.splice(0, 5); player.roundChipsChange = 0; } 
  const firstDiscard = deck.shift(); if (firstDiscard) room.discardPile.push(firstDiscard); 
  room.drawPile = deck; room.status = "playing"; room.currentTurnIndex = 0; 
  for (const player of room.players) { 
    const type = checkInstantWin(player.hand); 
    if (type) { room.status = "ended"; room.winnerId = player.id; room.instantWinType = type; room.endGameReason = "instant_win"; distributeChips(room); broadcastState(roomId); return; } 
  } 
  broadcastState(roomId); 
}
function resetRoom(roomId) { 
  const room = rooms.get(roomId); if (!room) return; 
  room.drawPile = []; room.discardPile = []; room.status = "waiting"; room.currentTurnIndex = null; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null; 
  for (const player of room.players) { player.hand = []; player.roundChipsChange = 0; } 
  broadcastState(roomId); 
}
function resolveKang(roomId, callerId) { 
  const room = rooms.get(roomId); if (!room) return; 
  const caller = getPlayer(room, callerId); if (!caller) return; 
  const pointsByPlayer = room.players.map((p) => ({ id: p.id, name: p.name, points: getHandPoints(p.hand) })); 
  const minPoints = Math.min(...pointsByPlayer.map((p) => p.points)); 
  const playersWithMin = room.players.filter((p) => getHandPoints(p.hand) === minPoints); 
  let winnerPlayer = playersWithMin[0]; 
  if (playersWithMin.length > 1) { 
    for (const p of playersWithMin.slice(1)) { 
      const bestP = getBestCardForTie(p.hand); const bestW = getBestCardForTie(winnerPlayer.hand); 
      if (bestP.value > bestW.value || (bestP.value === bestW.value && bestP.suitOrder > bestW.suitOrder)) winnerPlayer = p; 
    } 
  } 
  room.status = "ended"; room.winnerId = winnerPlayer.id; 
  const callerPoints = getHandPoints(caller.hand); 
  const othersHaveLowerOrEqual = pointsByPlayer.some((p) => p.id !== caller.id && p.points <= callerPoints); 
  const kangSuccess = !othersHaveLowerOrEqual; 
  room.endGameReason = kangSuccess ? "kang" : "kang_shipwreck"; distributeChips(room); 
  io.to(room.id).emit("kang_result", { callerId, kangSuccess, winnerId: winnerPlayer.id, pointsByPlayer }); 
  broadcastState(roomId); 
}

// ==========================================
// ✍️ ระบบเกม 2: นิยายยำเละ (Yamstory)
// ==========================================
const yamRooms = new Map(); 

function getOrCreateYamRoom(roomId) { 
  let room = yamRooms.get(roomId); 
  if (!room) { 
    room = { id: roomId, hostId: null, status: "waiting", players: [], currentTurnIndex: null, lastWords: "", turnCount: 0, fullStory: [], maxPlayers: 4, maxRounds: 5, currentRound: 1 }; 
    yamRooms.set(roomId, room); 
  } 
  return room; 
} 
function broadcastYamState(roomId) { 
  const room = yamRooms.get(roomId); if (!room) return; 
  const state = { 
    roomId: room.id, hostId: room.hostId, status: room.status, players: room.players, 
    currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null, 
    lastWords: room.lastWords, turnCount: room.turnCount, maxPlayers: room.maxPlayers, 
    maxRounds: room.maxRounds, currentRound: room.currentRound, fullStory: room.status === "ended" ? room.fullStory : undefined 
  }; 
  io.to(`yam_${roomId}`).emit("yam_state", state); 
}

// ==========================================
// 🏇 ระบบเกม 3: แข่งม้า(กาว)มรณะ (Drunk Racing)
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
    room = { id: roomId, hostId: null, status: "waiting", players: [], maxPlayers: 8, racers: JSON.parse(JSON.stringify(RACER_PROFILES)).map(r => ({ ...r, progress: 0 })), winnerRacerId: null, raceInterval: null, totalPool: 0 }; 
    racingRooms.set(roomId, room); 
  } 
  return room; 
}
function broadcastRacingState(roomId) { 
  const room = racingRooms.get(roomId); if (!room) return; 
  io.to(`racing_${roomId}`).emit("racing_state", { 
    roomId: room.id, hostId: room.hostId, status: room.status, players: room.players, racers: room.racers, 
    winnerRacerId: room.winnerRacerId, totalPool: room.totalPool, maxPlayers: room.maxPlayers 
  }); 
}

// ==========================================
// 🎰 ระบบเกม 4: กาชาปองนรก (Hell Fortune)
// ==========================================
const gachaRooms = new Map();

function createGachaDeck() {
  let deck = [];
  
  // 🟢 1. การ์ดปกติ 25 ใบ (ได้ชิป หรือ เกลือ)
  const normals = [
    { val: 500, count: 2, emoji: '💎' }, { val: 200, count: 4, emoji: '💰' },
    { val: 100, count: 6, emoji: '💵' }, { val: 50, count: 6, emoji: '🪙' },
    { val: 25, count: 5, emoji: '🥉' }, { val: 0, count: 2, emoji: '💨' }
  ];
  normals.forEach(n => {
    for(let i=0; i<n.count; i++) {
      deck.push({ type: 'normal', name: n.val > 0 ? `รับ ${n.val} ชิป` : 'ว่าว!', emoji: n.emoji, desc: n.val > 0 ? `ได้เงินทอน ${n.val} ชิป` : 'เกลือจัด ไม่ได้อะไรเลย', val: n.val, reqTarget: false });
    }
  });

  // 🤩 2. การ์ดโชคดี 5 ใบ
  deck.push({ type: 'jackpot', name: 'แจ็คพอตแตก', emoji: '🎰', desc: 'รับฟรี 1,000 ชิปจากกาสิโน!', reqTarget: false });
  deck.push({ type: 'master_thief', name: 'มหาโจร', emoji: '🥷', desc: 'ขโมย 500 ชิป จากคนรวยที่สุด!', reqTarget: false });
  deck.push({ type: 'leech', name: 'ปลิงดูดเลือด', emoji: '🧛', desc: 'ดูด 300 ชิป จากคนที่คุณเลือก!', reqTarget: true }); 
  deck.push({ type: 'robbery', name: 'ปล้นกลางแดด', emoji: '🗡️', desc: 'ยึดชิปครึ่งนึง จากคนที่คุณเลือก!', reqTarget: true }); 
  deck.push({ type: 'assassin', name: 'สไนเปอร์', emoji: '🔫', desc: 'ยิงทิ้ง! เงินเป้าหมายหายไป 500 ชิป!', reqTarget: true }); 

  // 💀 3. การ์ดซวย 5 ใบ
  deck.push({ type: 'bankruptcy', name: 'ล้มละลาย', emoji: '💥', desc: 'ซวยจัด! ชิปคุณเหลือแค่ 100 ทันที', reqTarget: false });
  deck.push({ type: 'tax', name: 'ภาษีสังคม', emoji: '🏛️', desc: 'ไถตังค์ จ่ายให้ทุกคน คนละ 100 ชิป', reqTarget: false });
  deck.push({ type: 'fallen_angel', name: 'เศรษฐีตกสวรรค์', emoji: '📉', desc: 'ชิปที่มีอยู่ของคุณถูกหาร 2', reqTarget: false });
  deck.push({ type: 'trip_grass', name: 'สะดุดหญ้า', emoji: '💸', desc: 'สะดุดล้ม เงินหล่นหาย 500 ชิป', reqTarget: false });
  deck.push({ type: 'scapegoat', name: 'แพะรับบาป', emoji: '💩', desc: 'บังคับโอนเงิน 500 ชิป ให้คนที่เลือก!', reqTarget: true }); 

  // 🌀 4. การ์ดสุ่มดวง 4 ใบ
  deck.push({ type: 'communist', name: 'คอมมิวนิสต์', emoji: '☭', desc: 'รวมชิปทั้งโต๊ะ แล้วหารแบ่งเท่ากัน!', reqTarget: false });
  deck.push({ type: 'thanos', name: 'ทานอสสแนป', emoji: '🧤', desc: 'ดีดนิ้ว! สลับชิปทุกคนในโต๊ะมั่วไปหมด!', reqTarget: false });
  deck.push({ type: 'robin_hood', name: 'โรบินฮู้ด', emoji: '🏹', desc: 'ดึง 500 ชิปจากคนรวยสุด ให้คนจนสุด!', reqTarget: false });
  deck.push({ type: 'wallet_swap', name: 'สลับกระเป๋า', emoji: '🔄', desc: 'สลับชิปทั้งหมดกับคนที่เลือก!', reqTarget: true }); 

  // สับไพ่
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  deck.forEach((c, idx) => c.id = `gcard_${idx}`);
  return deck;
}

function getOrCreateGachaRoom(roomId) {
  let room = gachaRooms.get(roomId);
  if (!room) {
    room = { id: roomId, hostId: null, status: "waiting", players: [], maxPlayers: 8, deck: [], currentTurnIndex: null, history: [], lastCard: null, pendingCard: null };
    gachaRooms.set(roomId, room);
  }
  return room;
}

function broadcastGachaState(roomId) {
  const room = gachaRooms.get(roomId);
  if (!room) return;
  io.to(`gacha_${roomId}`).emit("gacha_state", {
    roomId: room.id, hostId: room.hostId, status: room.status, maxPlayers: room.maxPlayers,
    players: room.players, currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null,
    deckCount: room.deck.length, lastCard: room.lastCard, history: room.history, pendingCard: room.pendingCard
  });
}

// ==========================================
// 🔌 Socket.io Events
// ==========================================
io.on("connection", (socket) => {
  
  // --- Events: SomomKang ---
  socket.on("join_room", ({ roomId, username, maxPlayers }) => { 
    if (!roomId) return; 
    const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เล่น"; 
    const room = getOrCreateRoom(roomId); 
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; } 
    let existingPlayer = room.players.find(p => p.name === safeName); 
    if (existingPlayer) { 
      if (room.hostId === existingPlayer.id) room.hostId = socket.id; 
      existingPlayer.id = socket.id; existingPlayer.connected = true; 
    } else { 
      if (room.status !== "waiting") return sendError(socket, "เกมเริ่มไปแล้ว"); 
      if (room.players.length >= room.maxPlayers) return sendError(socket, "ห้องเต็มแล้ว"); 
      room.players.push({ id: socket.id, name: safeName, hand: [], connected: true, chips: 2500, roundChipsChange: 0 }); 
    } 
    socket.join(roomId); socket.data.roomId = roomId; broadcastState(roomId); 
  }); 
  socket.on("start_game", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "waiting" && room.hostId === socket.id) startGame(roomId); }); 
  socket.on("play_again", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "ended" && room.hostId === socket.id) resetRoom(roomId); }); 
  socket.on("draw_and_discard", ({ roomId, discardCardIds }) => { 
    const room = rooms.get(roomId); if (!room || room.status !== "playing") return; 
    const playerIndex = room.players.findIndex((p) => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return; 
    const player = room.players[playerIndex]; if (room.pendingFlow && room.pendingFlow.toPlayerId === socket.id) room.pendingFlow = null; 
    if (room.drawPile.length === 0) return; 
    const drawnCard = room.drawPile.shift(); if (drawnCard) player.hand.push(drawnCard); 
    const cardsToDiscard = []; 
    for (const cardId of discardCardIds || []) { const card = player.hand.find((c) => c.id === cardId); if (!card) return; cardsToDiscard.push(card); } 
    if (cardsToDiscard.length === 0) return; 
    const rank = cardsToDiscard[0].rank; if (!cardsToDiscard.every((c) => c.rank === rank)) return; 
    for (const card of cardsToDiscard) { player.hand = player.hand.filter((c) => c.id !== card.id); room.discardPile.push(card); } 
    if (player.hand.length === 0) { room.status = "ended"; room.winnerId = player.id; room.endGameReason = "empty_hand"; distributeChips(room); broadcastState(roomId); return; } 
    const lastDiscard = room.discardPile[room.discardPile.length - 1]; 
    if (lastDiscard) { 
      const nextIndex = getNextPlayerIndex(room, playerIndex); 
      if (nextIndex != null) { 
        const nextPlayer = room.players[nextIndex]; room.pendingFlow = { rank: lastDiscard.rank, fromPlayerId: player.id, toPlayerId: nextPlayer.id }; 
        io.to(nextPlayer.id).emit("flow_available", { roomId, rank: lastDiscard.rank, fromPlayerId: player.id }); 
      } 
    } 
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

  // --- Events: Yamstory ---
  socket.on("join_yam_room", ({ roomId, username, maxPlayers, maxRounds }) => { 
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "นักเขียน"; const room = getOrCreateYamRoom(roomId); 
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; if (maxRounds) room.maxRounds = maxRounds; } 
    let existingPlayer = room.players.find(p => p.name === safeName); 
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { 
      if (room.players.length >= room.maxPlayers) { socket.emit("yam_error", { message: "เต็มแล้ว" }); return; } 
      if (room.status !== "waiting") { socket.emit("yam_error", { message: "เริ่มแล้ว" }); return; } 
      room.players.push({ id: socket.id, name: safeName, connected: true }); 
    } 
    socket.join(`yam_${roomId}`); socket.data.yamRoomId = roomId; broadcastYamState(roomId); 
  }); 
  socket.on("start_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; room.status = "playing"; room.currentTurnIndex = 0; room.turnCount = 0; room.currentRound = 1; room.lastWords = ""; room.fullStory = []; broadcastYamState(roomId); }); 
  socket.on("submit_yam_text", ({ roomId, text }) => { 
    const room = yamRooms.get(roomId); if (!room || room.status !== "playing") return; 
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return; 
    const player = room.players[playerIndex]; const cleanText = text.trim(); room.fullStory.push({ playerId: player.id, playerName: player.name, text: cleanText }); 
    try { 
      const segmenter = new Intl.Segmenter('th-TH', { granularity: 'word' }); 
      const segments = Array.from(segmenter.segment(cleanText)); 
      if (segments.length <= 5) room.lastWords = cleanText; else room.lastWords = "..." + segments.slice(-5).map(s => s.segment).join(""); 
    } catch (e) { room.lastWords = cleanText.length > 30 ? "..." + cleanText.slice(-30) : cleanText; } 
    room.turnCount++; 
    if (room.turnCount % room.players.length === 0) room.currentRound++; 
    if (room.currentRound > room.maxRounds) room.status = "ended"; else room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length; 
    broadcastYamState(roomId); 
  }); 
  socket.on("end_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.hostId !== socket.id) return; room.status = "ended"; broadcastYamState(roomId); }); 
  socket.on("reset_yam_game", ({ roomId }) => { const room = yamRooms.get(roomId); if (!room || room.hostId !== socket.id) return; room.status = "waiting"; room.lastWords = ""; room.turnCount = 0; room.currentRound = 1; room.fullStory = []; broadcastYamState(roomId); });

  // --- Events: Drunk Racing ---
  socket.on("join_racing_room", ({ roomId, username, maxPlayers }) => { 
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "นักลงทุน"; const room = getOrCreateRacingRoom(roomId); 
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; } 
    let existingPlayer = room.players.find(p => p.name === safeName); 
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { 
      if (room.status !== "waiting") return socket.emit("racing_error", { message: "ม้าออกตัวไปแล้ว รอตาหน้านะ!" }); 
      if (room.players.length >= room.maxPlayers) return socket.emit("racing_error", { message: "สนามแข่งเต็มแล้ว!" }); 
      room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500, betAmount: 0, betRacerId: null, wonAmount: 0 }); 
    } 
    socket.join(`racing_${roomId}`); socket.data.racingRoomId = roomId; broadcastRacingState(roomId); 
  }); 
  socket.on("place_bet", ({ roomId, racerId, amount }) => { 
    const room = racingRooms.get(roomId); if (!room || room.status !== "waiting") return; 
    const player = room.players.find(p => p.id === socket.id); if (!player || player.chips < amount) return; 
    if (player.betAmount > 0) { player.chips += player.betAmount; room.totalPool -= player.betAmount; } 
    player.betRacerId = racerId; player.betAmount = amount; player.chips -= amount; room.totalPool += amount; 
    broadcastRacingState(roomId); 
  }); 
  socket.on("start_race", ({ roomId }) => { 
    const room = racingRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; 
    room.status = "playing"; room.winnerRacerId = null; room.players.forEach(p => p.wonAmount = 0); broadcastRacingState(roomId); 
    room.raceInterval = setInterval(() => { 
      let hasWinner = false; 
      room.racers.forEach(r => { 
        const move = Math.floor(Math.random() * 4); // วิ่งช้าลงแบบที่คุยกันไว้
        r.progress += move; 
        if (r.progress >= 100) { r.progress = 100; hasWinner = true; if(!room.winnerRacerId) room.winnerRacerId = r.id; } 
      }); 
      broadcastRacingState(roomId); 
      if (hasWinner) { 
        clearInterval(room.raceInterval); room.status = "ended"; 
        const winners = room.players.filter(p => p.betRacerId === room.winnerRacerId); 
        if (winners.length > 0) { 
          const totalWinningBets = winners.reduce((sum, p) => sum + p.betAmount, 0); 
          winners.forEach(p => { 
            const proportion = p.betAmount / totalWinningBets; 
            p.wonAmount = Math.floor(room.totalPool * proportion); p.chips += p.wonAmount; 
          }); 
        } 
        broadcastRacingState(roomId); 
      } 
    }, 300); // อัปเดตทุก 0.3 วิ
  }); 
  socket.on("reset_race", ({ roomId }) => { 
    const room = racingRooms.get(roomId); if (!room || room.hostId !== socket.id) return; 
    room.status = "waiting"; room.totalPool = 0; room.winnerRacerId = null; 
    room.racers = JSON.parse(JSON.stringify(RACER_PROFILES)).map(r => ({ ...r, progress: 0 })); 
    room.players.forEach(p => { p.betAmount = 0; p.betRacerId = null; p.wonAmount = 0; }); 
    broadcastRacingState(roomId); 
  });

  // --- Events: 🎰 Gacha Hell ---
  socket.on("join_gacha_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เสี่ยงดวง"; const room = getOrCreateGachaRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else {
      if (room.status !== "waiting") return socket.emit("gacha_error", { message: "เกมเริ่มเปิดการ์ดไปแล้ว!" });
      if (room.players.length >= room.maxPlayers) return socket.emit("gacha_error", { message: "ห้องเต็มแล้ว!" });
      room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500 });
    }
    socket.join(`gacha_${roomId}`); socket.data.gachaRoomId = roomId; broadcastGachaState(roomId);
  });

  socket.on("start_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return;
    room.deck = createGachaDeck(); room.status = "playing"; room.currentTurnIndex = 0; room.history = []; room.lastCard = null; room.pendingCard = null;
    broadcastGachaState(roomId);
  });

  socket.on("draw_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;

    if (room.deck.length === 0) return;
    const card = room.deck.pop();
    
    if (card.reqTarget) {
      room.status = "waiting_target";
      room.pendingCard = card;
      broadcastGachaState(roomId);
      return;
    }

    applyGachaEffect(room, socket.id, card, null);
  });

  socket.on("resolve_gacha_target", ({ roomId, targetId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "waiting_target") return;
    if (room.players[room.currentTurnIndex].id !== socket.id) return;

    const card = room.pendingCard;
    room.pendingCard = null;
    room.status = "playing";

    let finalTargetId = targetId;
    if (targetId === "random") {
      const others = room.players.filter(p => p.id !== socket.id);
      if (others.length > 0) finalTargetId = others[Math.floor(Math.random() * others.length)].id;
    }

    applyGachaEffect(room, socket.id, card, finalTargetId);
  });

  function applyGachaEffect(room, playerId, card, targetId) {
    const player = room.players.find(p => p.id === playerId);
    let target = targetId ? room.players.find(p => p.id === targetId) : null;
    let actionLog = `${player.name} สุ่มได้ [${card.name}] `;

    if (card.type === 'normal') {
      player.chips += card.val;
      if (card.val > 0) actionLog += `👉 รับชิป ${card.val} 💰`;
      else actionLog += `👉 เกลือจัดๆ ไม่ได้อะไรเลย!`;
    } 
    else if (card.type === 'jackpot') { player.chips += 1000; actionLog += `👉 รวยเละ รับ 1000 💰!`; } 
    else if (card.type === 'bankruptcy') { player.chips = 100; actionLog += `👉 ล้มละลาย! เงินเหลือ 100 💰`; } 
    else if (card.type === 'fallen_angel') { player.chips = Math.floor(player.chips / 2); actionLog += `👉 โดนยึดทรัพย์ เงินหายครึ่งนึง!`; } 
    else if (card.type === 'trip_grass') { let lose = Math.min(500, player.chips); player.chips -= lose; actionLog += `👉 ซวย! ทำเงินหล่นหาย ${lose} 💰`; } 
    else if (card.type === 'communist') {
      let total = room.players.reduce((sum, p) => sum + p.chips, 0); let each = Math.floor(total / room.players.length);
      room.players.forEach(p => p.chips = each); actionLog += `👉 ริบทรัพย์! ทุกคนโดนหารเงินเท่ากันที่ ${each} 💰`;
    } 
    else if (card.type === 'tax') {
      let others = room.players.filter(p => p.id !== player.id); let totalPaid = 0;
      others.forEach(p => { let pay = Math.min(100, player.chips); if (pay > 0) { player.chips -= pay; p.chips += pay; totalPaid += pay; } });
      actionLog += `👉 จ่ายภาษีให้เพื่อนๆ รวม ${totalPaid} 💰`;
    } 
    else if (card.type === 'master_thief') {
      let others = room.players.filter(p => p.id !== player.id);
      if (others.length > 0) {
        let richest = others.reduce((prev, curr) => (prev.chips > curr.chips) ? prev : curr);
        let steal = Math.min(500, richest.chips);
        richest.chips -= steal; player.chips += steal;
        actionLog += `👉 ปล้นชิป ${steal} 💰 จาก ${richest.name}!`;
      }
    } 
    else if (card.type === 'thanos') {
      let allChips = room.players.map(p => p.chips);
      for (let i = allChips.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [allChips[i], allChips[j]] = [allChips[j], allChips[i]]; }
      room.players.forEach((p, idx) => p.chips = allChips[idx]);
      actionLog += `👉 ดีดนิ้ว! สลับเงินทุกคนมั่วไปหมด!`;
    } 
    else if (card.type === 'robin_hood') {
      let sorted = [...room.players].sort((a,b) => b.chips - a.chips);
      if(sorted.length > 1) {
        let richest = sorted[0]; let poorest = sorted[sorted.length-1];
        let amount = Math.min(500, richest.chips);
        richest.chips -= amount; poorest.chips += amount;
        actionLog += `👉 ดึงชิป ${amount} จาก ${richest.name} โอนให้ ${poorest.name}!`;
      }
    }
    // --- การ์ดล็อกเป้า ---
    else if (card.type === 'leech' && target) {
      let steal = Math.min(300, target.chips);
      target.chips -= steal; player.chips += steal;
      actionLog += `👉 ดูดเลือด ${target.name} มา ${steal} 💰!`;
    } 
    else if (card.type === 'robbery' && target) {
      let steal = Math.floor(target.chips / 2);
      target.chips -= steal; player.chips += steal;
      actionLog += `👉 ปล้น ${target.name} ไปครึ่งตัว (${steal} 💰)!`;
    } 
    else if (card.type === 'assassin' && target) {
      let destroy = Math.min(500, target.chips);
      target.chips -= destroy;
      actionLog += `👉 ยิงสไนเปอร์ใส่ ${target.name} เงินกระจุย ${destroy} 💰!`;
    } 
    else if (card.type === 'scapegoat' && target) {
      let give = Math.min(500, player.chips);
      player.chips -= give; target.chips += give;
      actionLog += `👉 ซวยจัด! บังคับโอนเงิน ${give} ให้ ${target.name}!`;
    } 
    else if (card.type === 'wallet_swap' && target) {
      let temp = player.chips; player.chips = target.chips; target.chips = temp;
      actionLog += `👉 สลับกระเป๋าเงินทั้งหมดกับ ${target.name}!`;
    }

    room.lastCard = { ...card, player: player.name, log: actionLog };
    room.history.unshift(actionLog); if (room.history.length > 15) room.history.pop();

    if (room.deck.length === 0) room.status = "ended";
    else room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    
    broadcastGachaState(room.id);
  }

  socket.on("reset_gacha", ({ roomId }) => { const room = gachaRooms.get(roomId); if (!room || room.hostId !== socket.id) return; room.status = "waiting"; room.deck = []; room.currentTurnIndex = null; room.history = []; room.lastCard = null; room.pendingCard = null; room.players.forEach(p => p.chips = 2500); broadcastGachaState(roomId); });

  // --- Disconnect Handler สำหรับทุกเกม ---
  socket.on("disconnect", () => {
    // 1. จัดการ SomomKang
    const roomId = socket.data.roomId; 
    if (roomId) { 
      const room = rooms.get(roomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { if (room.status === "waiting") room.players.splice(playerIndex, 1); else room.players[playerIndex].connected = false; } 
        if (room.hostId === socket.id) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } 
        if (room.players.length === 0) rooms.delete(roomId); else broadcastState(roomId); 
      } 
    }
    
    // 2. จัดการ Yamstory
    const yamRoomId = socket.data.yamRoomId; 
    if (yamRoomId) { 
      const room = yamRooms.get(yamRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { if (room.status === "waiting") room.players.splice(playerIndex, 1); else room.players[playerIndex].connected = false; } 
        if (room.hostId === socket.id) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } 
        if (room.players.length === 0) yamRooms.delete(yamRoomId); else broadcastYamState(yamRoomId); 
      } 
    }
    
    // 3. จัดการ Drunk Racing
    const racingRoomId = socket.data.racingRoomId; 
    if (racingRoomId) { 
      const room = racingRooms.get(racingRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { if (room.status === "waiting") room.players.splice(playerIndex, 1); else room.players[playerIndex].connected = false; } 
        if (room.hostId === socket.id) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } 
        if (room.players.length === 0) { if(room.raceInterval) clearInterval(room.raceInterval); racingRooms.delete(racingRoomId); } else broadcastRacingState(racingRoomId); 
      } 
    }
    
    // 4. จัดการ Gacha Hell
    const gachaRoomId = socket.data.gachaRoomId; 
    if (gachaRoomId) { 
      const room = gachaRooms.get(gachaRoomId); 
      if (room) { 
        const playerIndex = room.players.findIndex(p => p.id === socket.id); 
        if (playerIndex !== -1) { if (room.status === "waiting") room.players.splice(playerIndex, 1); else room.players[playerIndex].connected = false; } 
        if (room.hostId === socket.id) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } 
        if (room.players.length === 0) gachaRooms.delete(gachaRoomId); else broadcastGachaState(gachaRoomId); 
      } 
    }
  });
});

httpServer.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });