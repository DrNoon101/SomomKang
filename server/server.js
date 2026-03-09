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
// ⚔️ ระบบเกม 5: Deck Builder
// ==========================================
const deckRooms = new Map();

function shuffleDeck(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function createDeckMarket() {
  let deck = []; let id = 0;
  const add = (faction, name, emoji, cost, effect, ally) => { 
    for(let i=0; i<3; i++) deck.push({ id: `db_${id++}`, faction, name, emoji, cost, effect, ally }); 
  };
  add('somom', 'หมัดสมม', '🔥', 2, { combat: 3 }, { combat: 2 });
  add('somom', 'ดาบคลั่ง', '🗡️', 4, { combat: 5 }, { draw: 1 });
  add('somom', 'ระเบิดพลีชีพ', '💣', 3, { combat: 5, hp: -1 }, { combat: 3 });
  add('angles', 'แสงเยียวยา', '👼', 2, { hp: 3 }, { combat: 2 });
  add('angles', 'โล่สวรรค์', '🛡️', 4, { hp: 4, combat: 2 }, { hp: 2 });
  add('angles', 'พรศักดิ์สิทธิ์', '✨', 5, { hp: 5, draw: 1 }, { combat: 2 });
  add('musician', 'จังหวะแจ๊ส', '🎷', 2, { gold: 1, draw: 1 }, { combat: 1 });
  add('musician', 'โซโล่กีตาร์', '🎸', 3, { combat: 2, draw: 1 }, { gold: 1 });
  add('musician', 'วงออร์เคสตรา', '🎺', 5, { draw: 2 }, { combat: 2 });
  add('cassanova', 'โปรยเสน่ห์', '🌹', 2, { gold: 2 }, { hp: 2 });
  add('cassanova', 'เปย์ไม่อั้น', '💸', 4, { gold: 3 }, { combat: 2 });
  add('cassanova', 'หลงใหล', '💋', 3, { gold: 2, combat: 1 }, { draw: 1 });
  return shuffleDeck(deck);
}

function getStartingDeck() {
  const deck = [];
  for(let i=0; i<8; i++) deck.push({ id: `start_g_${Math.random()}`, faction: 'starter', name: 'เหรียญทอง', emoji: '🪙', cost: 0, effect: { gold: 1 }, ally: {} });
  for(let i=0; i<2; i++) deck.push({ id: `start_c_${Math.random()}`, faction: 'starter', name: 'มีดสั้น', emoji: '🔪', cost: 0, effect: { combat: 1 }, ally: {} });
  return deck;
}

function drawDeckCards(player, count) {
  for(let i=0; i<count; i++) {
    if(player.deck.length === 0) {
      if(player.discard.length === 0) break; 
      player.deck = shuffleDeck(player.discard); player.discard = [];
    }
    player.hand.push(player.deck.pop());
  }
}

function getOrCreateDeckRoom(roomId) {
  let room = deckRooms.get(roomId);
  if (!room) { room = { id: roomId, hostId: null, status: "waiting", players: [], maxPlayers: 2, history: [] }; deckRooms.set(roomId, room); }
  return room;
}

function broadcastDeckState(roomId) {
  const room = deckRooms.get(roomId); if (!room) return;
  const publicState = {
    roomId: room.id, hostId: room.hostId, status: room.status, maxPlayers: room.maxPlayers, 
    market: room.market || [], history: room.history || [],
    currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null,
    players: room.players.map(p => ({ 
      id: p.id, name: p.name, connected: p.connected, hp: p.hp || 50, gold: p.gold || 0, combat: p.combat || 0, 
      deckCount: p.deck ? p.deck.length : 0, discardCount: p.discard ? p.discard.length : 0, playArea: p.playArea || [] 
    }))
  };
  room.players.forEach(p => { io.to(p.id).emit("deck_state", { ...publicState, myHand: p.hand || [] }); });
}

// ==========================================
// 🃏 ระบบเกม 1: SomomKang
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

const GACHA_CARD_DEFS = [
  { type: "jackpot", name: "JACKPOT!!", emoji: "💎", group: "lucky", reqTarget: false, count: 3 },
  { type: "master_thief", name: "Master Thief", emoji: "🦹‍♂️", group: "lucky", reqTarget: false, count: 2 },
  { type: "leech", name: "Leech", emoji: "🩸", group: "lucky", reqTarget: true, count: 3 },
  { type: "robbery", name: "Robbery", emoji: "🔫", group: "lucky", reqTarget: true, count: 3 },
  { type: "assassin", name: "Assassin", emoji: "🗡️", group: "lucky", reqTarget: true, count: 2 },
  { type: "bankruptcy", name: "Bankruptcy", emoji: "💣", group: "unlucky", reqTarget: false, count: 2 },
  { type: "tax", name: "Tax Raid", emoji: "🧾", group: "unlucky", reqTarget: false, count: 3 },
  { type: "fallen_angel", name: "Fallen Angel", emoji: "😈", group: "unlucky", reqTarget: false, count: 3 },
  { type: "trip_grass", name: "Trip Grass", emoji: "🌿", group: "unlucky", reqTarget: false, count: 3 },
  { type: "scapegoat", name: "Scapegoat", emoji: "🐐", group: "unlucky", reqTarget: true, count: 2 },
  { type: "communist", name: "Communist Uprising", emoji: "☭", group: "chaos", reqTarget: false, count: 2 },
  { type: "thanos", name: "Thanos Snap", emoji: "🧤", group: "chaos", reqTarget: false, count: 2 },
  { type: "robin_hood", name: "Robin Hood", emoji: "🏹", group: "chaos", reqTarget: false, count: 2 },
  { type: "wallet_swap", name: "Wallet Swap", emoji: "💼", group: "chaos", reqTarget: true, count: 2 },
  { type: "normal_plus", name: "Bonus Chips", emoji: "💰", group: "normal", reqTarget: false, count: 8 },
  { type: "normal_minus", name: "Bad Luck", emoji: "💸", group: "normal", reqTarget: false, count: 8 }
];

function createGachaDeck() {
  const deck = [];
  for (const def of GACHA_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      deck.push({ type: def.type, name: def.name, emoji: def.emoji, group: def.group, reqTarget: def.reqTarget });
    }
  }
  return shuffle(deck);
}

function getOrCreateGachaRoom(roomId) {
  let room = gachaRooms.get(roomId);
  if (!room) { room = { id: roomId, hostId: null, status: "waiting", players: [], maxPlayers: 8, currentTurnIndex: null, deck: [], deckCount: 0, lastCard: null, pendingCard: null, pendingCardType: null, history: [] }; gachaRooms.set(roomId, room); }
  return room;
}

function buildGachaState(room) {
  return {
    roomId: room.id, hostId: room.hostId, status: room.status,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, chips: p.chips })),
    currentTurnPlayerId: room.currentTurnIndex != null && room.players[room.currentTurnIndex] ? room.players[room.currentTurnIndex].id : null,
    deckCount: room.deckCount, lastCard: room.lastCard, history: room.history, maxPlayers: room.maxPlayers, pendingCard: room.pendingCard
  };
}

function broadcastGachaState(roomId) {
  const room = gachaRooms.get(roomId); if (!room) return;
  const state = buildGachaState(room); io.to(`gacha_${roomId}`).emit("gacha_state", state);
}

function getRichestPlayer(room) { if (!room.players.length) return null; return room.players.reduce((best, p) => (p.chips > best.chips ? p : best), room.players[0]); }
function getPoorestPlayer(room) { if (!room.players.length) return null; return room.players.reduce((best, p) => (p.chips < best.chips ? p : best), room.players[0]); }

function applyGachaEffect(room, sourcePlayer, targetPlayer, cardType) {
  const players = room.players; let log = ""; let desc = ""; let val = 0;
  const safeTake = (from, amount) => { const real = Math.max(0, Math.min(from.chips, amount)); from.chips -= real; return real; };

  switch (cardType) {
    case "jackpot": { val = 1000; sourcePlayer.chips += val; desc = `ได้รับชิป ${val} 💰`; log = `${sourcePlayer.name} เปิด JACKPOT! +${val} ชิป`; break; }
    case "master_thief": { const richest = getRichestPlayer(room); if (!richest || richest.id === sourcePlayer.id) { desc = "พยายามจะขโมยแต่ไม่มีใครรวยกว่า..."; log = `${sourcePlayer.name} พยายามเป็น Master Thief แต่ล้มเหลว`; break; } const steal = safeTake(richest, 500); sourcePlayer.chips += steal; val = steal; desc = `ขโมยชิป ${steal} จาก ${richest.name}`; log = `${sourcePlayer.name} เป็น Master Thief! ขโมย ${steal} ชิป จาก ${richest.name}`; break; }
    case "leech": { if (!targetPlayer) break; const steal = safeTake(targetPlayer, 300); sourcePlayer.chips += steal; val = steal; desc = `ดูดชิป ${steal} จาก ${targetPlayer.name}`; log = `${sourcePlayer.name} ดูดชิป ${steal} จาก ${targetPlayer.name}`; break; }
    case "robbery": { if (!targetPlayer) break; const steal = safeTake(targetPlayer, Math.floor(targetPlayer.chips / 2)); sourcePlayer.chips += steal; val = steal; desc = `ปล้น ${targetPlayer.name} ได้ ${steal} ชิป`; log = `${sourcePlayer.name} ปล้น ${targetPlayer.name}! ได้ไป ${steal} ชิป`; break; }
    case "assassin": { if (!targetPlayer) break; const lost = safeTake(targetPlayer, 500); val = -lost; desc = `ลอบสังหารกระเป๋า ${targetPlayer.name} หายไป ${lost} ชิป`; log = `${sourcePlayer.name} ส่งนักฆ่าเก็บ ${targetPlayer.name} (-${lost} ชิป)`; break; }
    case "bankruptcy": { const before = sourcePlayer.chips; sourcePlayer.chips = 100; val = sourcePlayer.chips - before; desc = `ล้มละลาย เหลือชิปแค่ 100 💀`; log = `${sourcePlayer.name} ล้มละลาย! เหลือชิป 100 เดียว`; break; }
    case "tax": { let totalPaid = 0; for (const p of players) { if (p.id === sourcePlayer.id) continue; if (sourcePlayer.chips <= 0) break; const paid = safeTake(sourcePlayer, 100); p.chips += paid; totalPaid += paid; } val = -totalPaid; desc = `จ่ายภาษีรวม ${totalPaid} ชิป ให้คนอื่นทั้งโต๊ะ`; log = `${sourcePlayer.name} ถูกสรรพากรบุก! จ่ายภาษีรวม ${totalPaid} ชิป`; break; }
    case "fallen_angel": { const before = sourcePlayer.chips; sourcePlayer.chips = Math.floor(sourcePlayer.chips / 2); val = sourcePlayer.chips - before; desc = `จากเทพกลายเป็นตกสวรรค์ เหลือครึ่งเดียว`; log = `${sourcePlayer.name} ตกสวรรค์! ชิปหายไปครึ่งหนึ่ง`; break; }
    case "trip_grass": { const lost = safeTake(sourcePlayer, 500); val = -lost; desc = `สะดุดหญ้ากาว ล้มเสียชิป ${lost}`; log = `${sourcePlayer.name} สะดุดหญ้ากาว! เสียไป ${lost} ชิป`; break; }
    case "scapegoat": { if (!targetPlayer) break; const give = safeTake(sourcePlayer, 500); targetPlayer.chips += give; val = -give; desc = `ถูกบังคับให้เป็นแพะ รับกรรมให้ ${targetPlayer.name} จำนวน ${give} ชิป`; log = `${sourcePlayer.name} กลายเป็นแพะ ส่ง ${give} ชิป ให้ ${targetPlayer.name}`; break; }
    case "communist": { const total = players.reduce((sum, p) => sum + p.chips, 0); const avg = Math.floor(total / players.length || 0); players.forEach((p) => { p.chips = avg; }); desc = `แดงทั้งโต๊ะ แบ่งชิปเท่าๆ กันคนละ ${avg}`; log = `พลังคอมมิวนิสต์! ทุกคนมีชิปเท่ากันคนละ ${avg}`; break; }
    case "thanos": { const chipsArr = players.map((p) => p.chips); const shuffled = shuffle(chipsArr.slice()); players.forEach((p, idx) => { p.chips = shuffled[idx]; }); desc = `ดีดนิ้วสลับโชค ชิปทุกคนถูกสลับตำแหน่ง`; log = `Thanos ดีดนิ้ว! ชิปทุกคนถูกสลับกันมั่วไปหมด`; break; }
    case "robin_hood": { const richest = getRichestPlayer(room); const poorest = getPoorestPlayer(room); if (!richest || !poorest || richest.id === poorest.id) { desc = `ไม่มีใครให้ปล้นหรือให้ จึงไม่เกิดอะไรขึ้น`; log = `Robin Hood โผล่มาแต่จับเหยื่อไม่ได้`; break; } const give = safeTake(richest, 500); poorest.chips += give; val = give; desc = `ปล้นคนรวย ${richest.name} ${give} ชิป ไปให้คนจน ${poorest.name}`; log = `Robin Hood ปล้น ${richest.name} ${give} ชิป ไปแจก ${poorest.name}`; break; }
    case "wallet_swap": { if (!targetPlayer) break; const tmp = sourcePlayer.chips; sourcePlayer.chips = targetPlayer.chips; targetPlayer.chips = tmp; desc = `สลับกระเป๋าชิปกับ ${targetPlayer.name} แบบเนียนๆ`; log = `${sourcePlayer.name} สลับกระเป๋ากับ ${targetPlayer.name}!`; break; }
    case "normal_plus": { const gain = 100 + Math.floor(Math.random() * 401); sourcePlayer.chips += gain; val = gain; desc = `ดวงดีเล็กน้อย ได้ชิปเพิ่ม ${gain}`; log = `${sourcePlayer.name} ดวงดี ได้ +${gain} ชิป`; break; }
    case "normal_minus": { const lost = safeTake(sourcePlayer, 100 + Math.floor(Math.random() * 401)); val = -lost; desc = `ซวยเบาๆ เสียชิป ${lost}`; log = `${sourcePlayer.name} ซวย เสียไป ${lost} ชิป`; break; }
    default: { desc = "ไม่มีอะไรเกิดขึ้น... (บั๊กหรือเปล่าเนี่ย)"; log = `${sourcePlayer.name} เปิดการ์ดลึกลับ แต่ดูเหมือนยังไม่ทำอะไร`; }
  }
  return { desc, log, val };
}

// ==========================================
// ✍️ ระบบเกม 2: นิยายยำเละ (Yamstory)
// ==========================================
const yamRooms = new Map();
function getOrCreateYamRoom(roomId) { let room = yamRooms.get(roomId); if (!room) { room = { id: roomId, hostId: null, status: "waiting", players: [], currentTurnIndex: null, lastWords: "", turnCount: 0, fullStory: [], maxPlayers: 4, maxRounds: 5, currentRound: 1 }; yamRooms.set(roomId, room); } return room; }
function broadcastYamState(roomId) { const room = yamRooms.get(roomId); if (!room) return; const state = { roomId: room.id, hostId: room.hostId, status: room.status, players: room.players, currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null, lastWords: room.lastWords, turnCount: room.turnCount, maxPlayers: room.maxPlayers, maxRounds: room.maxRounds, currentRound: room.currentRound, fullStory: room.status === "ended" ? room.fullStory : undefined }; io.to(`yam_${roomId}`).emit("yam_state", state); }

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
// 🔌 Socket.io Events (การรับส่งคำสั่งทั้งหมด)
// ==========================================
io.on("connection", (socket) => {
  // --- SomomKang ---
  socket.on("join_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เล่น"; const room = getOrCreateRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { if (room.status !== "waiting") return sendError(socket, "เกมเริ่มไปแล้ว"); if (room.players.length >= room.maxPlayers) return sendError(socket, "ห้องเต็มแล้ว"); room.players.push({ id: socket.id, name: safeName, hand: [], connected: true, chips: 2500, roundChipsChange: 0 }); }
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
      room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500, betAmount: 0, betRacerId: null, wonAmount: 0 });
    }
    socket.join(`racing_${roomId}`); socket.data.racingRoomId = roomId; broadcastRacingState(roomId);
  });
  socket.on("place_bet", ({ roomId, racerId, amount }) => {
    const room = racingRooms.get(roomId); if (!room || room.status !== "waiting") return;
    const player = room.players.find(p => p.id === socket.id); if (!player || player.chips < amount) return;
    if (player.betAmount > 0) { player.chips += player.betAmount; room.totalPool -= player.betAmount; }
    player.betRacerId = racerId; player.betAmount = amount; player.chips -= amount; room.totalPool += amount; broadcastRacingState(roomId);
  });
  socket.on("start_race", ({ roomId }) => { 
    const room = racingRooms.get(roomId); 
    if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; 
    room.status = "playing"; room.winnerRacerId = null; room.players.forEach(p => p.wonAmount = 0); 
    broadcastRacingState(roomId); 
    room.raceInterval = setInterval(() => { 
      let hasWinner = false; 
      room.racers.forEach(r => { 
        const move = Math.floor(Math.random() * 4); 
        r.progress += move; 
        if (r.progress >= 100) { r.progress = 100; hasWinner = true; if(!room.winnerRacerId) room.winnerRacerId = r.id; } 
      }); 
      broadcastRacingState(roomId); 
      if (hasWinner) { 
        clearInterval(room.raceInterval); room.status = "ended"; 
        const winners = room.players.filter(p => p.betRacerId === room.winnerRacerId); 
        if (winners.length > 0) { 
          const totalWinningBets = winners.reduce((sum, p) => sum + p.betAmount, 0); 
          winners.forEach(p => { const proportion = p.betAmount / totalWinningBets; p.wonAmount = Math.floor(room.totalPool * proportion); p.chips += p.wonAmount; }); 
        } 
        broadcastRacingState(roomId); 
      } 
    }, 300); 
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
    if (!roomId) return; const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เสี่ยงดวง"; const room = getOrCreateGachaRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find((p) => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else { if (room.status !== "waiting") return socket.emit("gacha_error", { message: "เกมเริ่มไปแล้ว" }); if (room.players.length >= room.maxPlayers) return socket.emit("gacha_error", { message: "ห้องเต็มแล้ว" }); room.players.push({ id: socket.id, name: safeName, connected: true, chips: 2500 }); }
    socket.join(`gacha_${roomId}`); socket.data.gachaRoomId = roomId; broadcastGachaState(roomId);
  });
  socket.on("start_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return; if (room.players.length < 2) return;
    room.deck = createGachaDeck(); room.deckCount = room.deck.length; room.status = "playing"; room.currentTurnIndex = 0; room.lastCard = null; room.pendingCard = null; room.pendingCardType = null; room.history = [];
    broadcastGachaState(roomId);
  });
  socket.on("draw_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "playing" || room.deckCount <= 0 || !room.deck || !room.deck.length) return;
    const playerIndex = room.players.findIndex((p) => p.id === socket.id); if (playerIndex === -1 || playerIndex !== room.currentTurnIndex) return;
    const player = room.players[playerIndex]; const drawn = room.deck.shift(); room.deckCount = room.deck.length;
    if (!drawn) { room.status = "ended"; broadcastGachaState(roomId); return; }
    const cardId = `gacha-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (drawn.reqTarget) {
      room.status = "waiting_target"; room.pendingCardType = drawn.type;
      room.pendingCard = { id: cardId, name: drawn.name, emoji: drawn.emoji, desc: "การ์ดใบนี้ต้องเลือกเหยื่อ 1 คนให้รับกรรม...", player: player.name, log: "", type: drawn.type, val: 0 };
      room.lastCard = room.pendingCard; broadcastGachaState(roomId); return;
    }
    const effect = applyGachaEffect(room, player, null, drawn.type);
    const card = { id: cardId, name: drawn.name, emoji: drawn.emoji, desc: effect.desc, player: player.name, log: effect.log, type: drawn.type === "normal_plus" || drawn.type === "normal_minus" ? "normal" : drawn.type, val: effect.val };
    room.lastCard = card; room.history = [card.log, ...room.history].slice(0, 100);
    if (room.deckCount === 0) room.status = "ended"; else room.currentTurnIndex = room.players.length > 0 ? (playerIndex + 1) % room.players.length : null;
    broadcastGachaState(roomId);
  });
  socket.on("reset_gacha", ({ roomId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.hostId !== socket.id) return;
    room.status = "waiting"; room.currentTurnIndex = null; room.deck = []; room.deckCount = 0; room.lastCard = null; room.pendingCard = null; room.pendingCardType = null; room.history = [];
    broadcastGachaState(roomId);
  });
  socket.on("resolve_gacha_target", ({ roomId, targetId }) => {
    const room = gachaRooms.get(roomId); if (!room || room.status !== "waiting_target" || room.pendingCardType == null || !room.pendingCard) return;
    const currentIndex = room.currentTurnIndex != null ? room.currentTurnIndex : -1; if (currentIndex === -1) return;
    const sourcePlayer = room.players[currentIndex]; if (!sourcePlayer || sourcePlayer.id !== socket.id) return;
    let targetPlayer = null;
    if (targetId === "random") { const candidates = room.players.filter((p) => p.id !== sourcePlayer.id); if (candidates.length > 0) { const idx = Math.floor(Math.random() * candidates.length); targetPlayer = candidates[idx]; } } 
    else { targetPlayer = room.players.find((p) => p.id === targetId) || null; }
    if (!targetPlayer) return;
    const effect = applyGachaEffect(room, sourcePlayer, targetPlayer, room.pendingCardType);
    const resolvedCard = { ...room.pendingCard, desc: effect.desc, log: effect.log, type: room.pendingCardType === "normal_plus" || room.pendingCardType === "normal_minus" ? "normal" : room.pendingCardType, val: effect.val };
    room.lastCard = resolvedCard; room.history = [resolvedCard.log, ...room.history].slice(0, 100); room.pendingCard = null; room.pendingCardType = null; room.status = room.deckCount === 0 ? "ended" : "playing";
    if (room.status === "playing") room.currentTurnIndex = room.players.length > 0 ? (currentIndex + 1) % room.players.length : null;
    broadcastGachaState(roomId);
  });

  // ==========================================
  // ⚔️ Deck Builder Events
  // ==========================================
  socket.on("join_deck_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return; const safeName = username ? String(username).trim() : "นักรบไร้นาม"; const room = getOrCreateDeckRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) { if (room.hostId === existingPlayer.id) room.hostId = socket.id; existingPlayer.id = socket.id; existingPlayer.connected = true; } 
    else {
      if (room.status !== "waiting") return socket.emit("deck_error", { message: "ศึกเริ่มไปแล้ว!" });
      if (room.players.length >= room.maxPlayers) return socket.emit("deck_error", { message: "ปาร์ตี้เต็มแล้ว!" });
      room.players.push({ id: socket.id, name: safeName, connected: true, hp: 50, gold: 0, combat: 0, deck: [], hand: [], discard: [], playArea: [] });
    }
    socket.join(`deck_${roomId}`); socket.data.deckRoomId = roomId; broadcastDeckState(roomId);
  });

  socket.on("start_deck_game", ({ roomId }) => {
    const room = deckRooms.get(roomId); if (!room || room.status !== "waiting" || room.hostId !== socket.id) return;
    room.marketDeck = createDeckMarket(); room.market = room.marketDeck.splice(0, 5); room.status = "playing"; room.currentTurnIndex = 0; room.history = ["⚔️ เริ่มศึกตะลุมบอน!"];
    room.players.forEach(p => { p.hp = 50; p.gold = 0; p.combat = 0; p.deck = shuffleDeck(getStartingDeck()); p.hand = []; p.discard = []; p.playArea = []; drawDeckCards(p, 5); });
    broadcastDeckState(roomId);
  });

  // --- ลอจิก: ระบบเผาไพ่ทิ้งถาวร (Scrap) ---
  socket.on("scrap_deck_card", ({ roomId, cardId }) => {
    const room = deckRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex]; 
    
    // ต้องมีเงินอย่างน้อย 3 Gold ในเทิร์นนี้ถึงจะเผาไพ่ได้
    if (player.gold < 3) return; 
    
    const cardIndex = player.hand.findIndex(c => c.id === cardId); if (cardIndex === -1) return;
    
    // หักเงิน 3G แล้วลบไพ่ออกจากมือทิ้งหายไปจากเด็คเลย (ไม่ลงกองทิ้ง)
    player.gold -= 3;
    const card = player.hand.splice(cardIndex, 1)[0];
    
    if(!room.history) room.history = []; 
    room.history.unshift(`🔥 ${player.name} จ่าย 3G เผาไพ่ [${card.name}] ทิ้งถาวร! (รีดเด็ค)`); 
    broadcastDeckState(roomId);
  });

  socket.on("play_deck_card", ({ roomId, cardId }) => {
    const room = deckRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex]; const cardIndex = player.hand.findIndex(c => c.id === cardId); if (cardIndex === -1) return;
    const card = player.hand.splice(cardIndex, 1)[0];
    const hasAlly = player.playArea.some(c => c.faction === card.faction && card.faction !== 'starter');
    
    if(card.effect.gold) player.gold += card.effect.gold; if(card.effect.combat) player.combat += card.effect.combat;
    if(card.effect.hp) player.hp += card.effect.hp; if(card.effect.draw) drawDeckCards(player, card.effect.draw);
    
    let log = `${player.name} ลงไพ่ [${card.name}]`;
    if(hasAlly && card.ally) {
      if(card.ally.gold) player.gold += card.ally.gold; if(card.ally.combat) player.combat += card.ally.combat;
      if(card.ally.hp) player.hp += card.ally.hp; if(card.ally.draw) drawDeckCards(player, card.ally.draw);
      log += ` 🔥 (คอมโบ ${card.faction.toUpperCase()} ทำงาน!)`;
    }
    
    player.playArea.push(card);
    if(!room.history) room.history = []; room.history.unshift(log); if(room.history.length > 15) room.history.pop();
    broadcastDeckState(roomId);
  });

  socket.on("buy_deck_card", ({ roomId, cardId }) => {
    const room = deckRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex]; const marketIndex = room.market.findIndex(c => c.id === cardId); if (marketIndex === -1) return;
    const card = room.market[marketIndex];
    if (player.gold < card.cost) return; 
    
    player.gold -= card.cost; room.market.splice(marketIndex, 1); player.discard.push(card);
    if(room.marketDeck.length > 0) room.market.push(room.marketDeck.pop()); 
    if(!room.history) room.history = []; room.history.unshift(`🛒 ${player.name} ซื้อ [${card.name}]`); 
    broadcastDeckState(roomId);
  });

  socket.on("end_deck_turn", ({ roomId }) => {
    const room = deckRooms.get(roomId); if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id); if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex];
    
    if (player.combat > 0 && room.players.length > 1) {
      const targetIndex = (playerIndex + 1) % room.players.length; const target = room.players[targetIndex]; target.hp -= player.combat;
      if(!room.history) room.history = []; room.history.unshift(`⚔️ ${player.name} สาด ${player.combat} ดาเมจใส่ ${target.name}!`);
      if (target.hp <= 0) { target.hp = 0; room.status = "ended"; room.history.unshift(`🏆 ${player.name} เป็นผู้ชนะ!`); broadcastDeckState(roomId); return; }
    }
    
    player.gold = 0; player.combat = 0; player.discard.push(...player.hand, ...(player.playArea || [])); player.hand = []; player.playArea = [];
    drawDeckCards(player, 5); room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length; 
    if(!room.history) room.history = []; room.history.unshift(`⏳ จบเทิร์นของ ${player.name}`);
    broadcastDeckState(roomId);
  });

  socket.on("reset_deck_game", ({ roomId }) => {
    const room = deckRooms.get(roomId); if (!room || room.hostId !== socket.id) return;
    room.status = "waiting"; room.market = []; room.marketDeck = []; room.history = [];
    room.players.forEach(p => { p.hp = 50; p.gold = 0; p.combat = 0; p.deck = []; p.hand = []; p.discard = []; p.playArea = []; });
    broadcastDeckState(roomId);
  });

  // --- Disconnect Handler (ป้องกันห้องผีสิงครบทุกเกม) ---
  socket.on("disconnect", () => {
    const sId = socket.id;
    // 1. SomomKang
    if (socket.data.roomId) { const room = rooms.get(socket.data.roomId); if (room) { const pIdx = room.players.findIndex(p => p.id === sId); if (pIdx !== -1) { if (room.status === "waiting") room.players.splice(pIdx, 1); else room.players[pIdx].connected = false; } if (room.hostId === sId) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } if (!room.players.some(p => p.connected)) rooms.delete(socket.data.roomId); else broadcastState(socket.data.roomId); } }
    // 2. Yamstory
    if (socket.data.yamRoomId) { const room = yamRooms.get(socket.data.yamRoomId); if (room) { const pIdx = room.players.findIndex(p => p.id === sId); if (pIdx !== -1) { if (room.status === "waiting") room.players.splice(pIdx, 1); else room.players[pIdx].connected = false; } if (room.hostId === sId) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } if (!room.players.some(p => p.connected)) yamRooms.delete(socket.data.yamRoomId); else broadcastYamState(socket.data.yamRoomId); } }
    // 3. Drunk Racing
    if (socket.data.racingRoomId) { const room = racingRooms.get(socket.data.racingRoomId); if (room) { const pIdx = room.players.findIndex(p => p.id === sId); if (pIdx !== -1) { if (room.status === "waiting") room.players.splice(pIdx, 1); else room.players[pIdx].connected = false; } if (room.hostId === sId) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } if (!room.players.some(p => p.connected)) { if(room.raceInterval) clearInterval(room.raceInterval); racingRooms.delete(socket.data.racingRoomId); } else broadcastRacingState(socket.data.racingRoomId); } }
    // 4. Gacha Hell
    if (socket.data.gachaRoomId) { const room = gachaRooms.get(socket.data.gachaRoomId); if (room) { const pIdx = room.players.findIndex(p => p.id === sId); if (pIdx !== -1) { if (room.status === "waiting") room.players.splice(pIdx, 1); else room.players[pIdx].connected = false; } if (room.hostId === sId) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } if (!room.players.some(p => p.connected)) gachaRooms.delete(socket.data.gachaRoomId); else broadcastGachaState(socket.data.gachaRoomId); } }
    // 5. Deck Builder
    if (socket.data.deckRoomId) { const room = deckRooms.get(socket.data.deckRoomId); if (room) { const pIdx = room.players.findIndex(p => p.id === sId); if (pIdx !== -1) { if (room.status === "waiting") room.players.splice(pIdx, 1); else room.players[pIdx].connected = false; } if (room.hostId === sId) { const nextHost = room.players.find(p => p.connected); room.hostId = nextHost ? nextHost.id : null; } if (!room.players.some(p => p.connected)) deckRooms.delete(socket.data.deckRoomId); else broadcastDeckState(socket.data.deckRoomId); } }
  });
});

httpServer.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });