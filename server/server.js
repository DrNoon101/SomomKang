const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 4000; 

app.use(cors({ origin: "*" })); 
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.get("/", (req, res) => res.send("Arcade Server is running. (SomomKang + Yamstory)"));

// ==========================================
// 🃏 ระบบเกม: สมมแคง (SomomKang)
// ==========================================
const SUITS = ["spades", "hearts", "diamonds", "clubs"]; 
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10 };
const SUIT_ORDER = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 };
const rooms = new Map();

function createDeck() {
  const deck = [];
  let cardId = 0;
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
  if (isStraight && isFlush) return "สเตรทฟลัช (Straight Flush) 👑";
  if (counts[0] === 4) return "หอน (Four of a Kind) 🐺";
  if (counts[0] === 3 && counts[1] === 2) return "ฟูลเฮาส์ (Full House) 🏡";
  if (isFlush) return "สี (Flush) 🎨";
  if (isStraight) return "เรียง (Straight) 📶";
  if (counts[0] === 3) return "ตอง (Three of a Kind) 💥";
  if (getHandPoints(hand) === 50) return "50 แต้ม (Max Points) 💯";
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
    loser.chips -= BET_AMOUNT;
    loser.roundChipsChange = -BET_AMOUNT;
    totalWon += BET_AMOUNT;
  });
  if (winner) {
    winner.chips += totalWon;
    winner.roundChipsChange = totalWon;
  }
}
function buildPublicState(room) {
  const base = {
    roomId: room.id, hostId: room.hostId, maxPlayers: room.maxPlayers, status: room.status, currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id ?? null : null, drawPileCount: room.drawPile.length, discardTop: room.discardPile[room.discardPile.length - 1] || null, winnerId: room.winnerId, instantWinType: room.instantWinType, endGameReason: room.endGameReason,
    players: room.players.map((p) => ({ id: p.id, name: p.name, handCount: p.hand.length, connected: p.connected, chips: p.chips })),
  };
  if (room.status === "ended") {
    base.endedGameData = {
      winnerId: room.winnerId, winnerName: room.players.find((p) => p.id === room.winnerId)?.name ?? "—", endGameReason: room.endGameReason,
      instantWinType: room.instantWinType,
      players: room.players.map((p) => ({ id: p.id, name: p.name, hand: p.hand, points: getHandPoints(p.hand), chips: p.chips, roundChipsChange: p.roundChipsChange || 0 })),
    };
  }
  return base;
}
function broadcastState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const publicState = buildPublicState(room);
  for (const player of room.players) {
    io.to(player.id).emit("game_state", { public: publicState, yourHand: player.hand, yourPlayerId: player.id });
  }
}
function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return;
  let deck = shuffle(createDeck());
  room.drawPile = []; room.discardPile = []; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null;
  for (const player of room.players) { player.hand = deck.splice(0, 5); player.roundChipsChange = 0; }
  const firstDiscard = deck.shift();
  if (firstDiscard) room.discardPile.push(firstDiscard);
  room.drawPile = deck; room.status = "playing"; room.currentTurnIndex = 0;
  for (const player of room.players) {
    const type = checkInstantWin(player.hand);
    if (type) { 
      room.status = "ended"; room.winnerId = player.id; room.instantWinType = type; room.endGameReason = "instant_win"; 
      distributeChips(room); broadcastState(roomId); return; 
    }
  }
  broadcastState(roomId);
}
function resetRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.drawPile = []; room.discardPile = []; room.status = "waiting"; room.currentTurnIndex = null; room.winnerId = null; room.instantWinType = null; room.endGameReason = null; room.pendingFlow = null;
  for (const player of room.players) { player.hand = []; player.roundChipsChange = 0; }
  broadcastState(roomId);
}
function resolveKang(roomId, callerId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const caller = getPlayer(room, callerId);
  if (!caller) return;
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
  room.endGameReason = kangSuccess ? "kang" : "kang_shipwreck";
  distributeChips(room);
  io.to(room.id).emit("kang_result", { callerId, kangSuccess, winnerId: winnerPlayer.id, pointsByPlayer });
  broadcastState(roomId);
}

// ==========================================
// ✍️ ระบบเกม: นิยายยำเละ (Yamstory)
// ==========================================
const yamRooms = new Map();

function getOrCreateYamRoom(roomId) {
  let room = yamRooms.get(roomId);
  if (!room) {
    room = { id: roomId, hostId: null, status: "waiting", players: [], currentTurnIndex: null, lastWords: "", turnCount: 0, fullStory: [] };
    yamRooms.set(roomId, room);
  }
  return room;
}

function broadcastYamState(roomId) {
  const room = yamRooms.get(roomId);
  if (!room) return;
  const state = {
    roomId: room.id,
    hostId: room.hostId,
    status: room.status,
    players: room.players,
    currentTurnPlayerId: room.currentTurnIndex != null ? room.players[room.currentTurnIndex]?.id : null,
    lastWords: room.lastWords,
    turnCount: room.turnCount,
    fullStory: room.status === "ended" ? room.fullStory : undefined
  };
  io.to(`yam_${roomId}`).emit("yam_state", state);
}


// ==========================================
// 🔌 การจัดการการเชื่อมต่อ Socket.io
// ==========================================
io.on("connection", (socket) => {
  
  // --- ฝั่งสมมแคง (SomomKang) ---
  socket.on("join_room", ({ roomId, username, maxPlayers }) => {
    if (!roomId) return;
    const safeName = username && String(username).trim() ? String(username).trim() : "ผู้เล่น";
    const room = getOrCreateRoom(roomId);
    if (room.players.length === 0) { room.hostId = socket.id; if (maxPlayers) room.maxPlayers = maxPlayers; }
    let existingPlayer = room.players.find(p => p.name === safeName);
    
    if (existingPlayer) {
      if (room.hostId === existingPlayer.id) room.hostId = socket.id;
      if (room.winnerId === existingPlayer.id) room.winnerId = socket.id;
      if (room.pendingFlow?.fromPlayerId === existingPlayer.id) room.pendingFlow.fromPlayerId = socket.id;
      if (room.pendingFlow?.toPlayerId === existingPlayer.id) room.pendingFlow.toPlayerId = socket.id;
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
    } else {
      if (room.status !== "waiting") return sendError(socket, "เกมเริ่มไปแล้ว ไม่สามารถเข้าร่วมได้");
      if (room.players.length >= room.maxPlayers) return sendError(socket, "ห้องเต็มแล้ว"); 
      room.players.push({ id: socket.id, name: safeName, hand: [], connected: true, chips: 1000, roundChipsChange: 0 });
    }
    socket.join(roomId); socket.data.roomId = roomId; broadcastState(roomId);
  });

  socket.on("start_game", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "waiting" && room.hostId === socket.id) startGame(roomId); });
  socket.on("play_again", ({ roomId }) => { const room = rooms.get(roomId); if (room?.status === "ended" && room.hostId === socket.id) resetRoom(roomId); });
  
  socket.on("draw_and_discard", ({ roomId, discardCardIds }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    const player = room.players[playerIndex];
    if (room.pendingFlow && room.pendingFlow.toPlayerId === socket.id) room.pendingFlow = null;
    if (room.drawPile.length === 0) return;

    const drawnCard = room.drawPile.shift();
    if (drawnCard) player.hand.push(drawnCard);

    const cardsToDiscard = [];
    for (const cardId of discardCardIds || []) {
      const card = player.hand.find((c) => c.id === cardId);
      if (!card) return;
      cardsToDiscard.push(card);
    }
    if (cardsToDiscard.length === 0) return;
    const rank = cardsToDiscard[0].rank;
    if (!cardsToDiscard.every((c) => c.rank === rank)) return;

    for (const card of cardsToDiscard) {
      player.hand = player.hand.filter((c) => c.id !== card.id);
      room.discardPile.push(card);
    }

    if (player.hand.length === 0) {
      room.status = "ended"; room.winnerId = player.id; room.endGameReason = "empty_hand";
      distributeChips(room); broadcastState(roomId); return;
    }

    const lastDiscard = room.discardPile[room.discardPile.length - 1];
    if (lastDiscard) {
      const nextIndex = getNextPlayerIndex(room, playerIndex);
      if (nextIndex != null) {
        const nextPlayer = room.players[nextIndex];
        room.pendingFlow = { rank: lastDiscard.rank, fromPlayerId: player.id, toPlayerId: nextPlayer.id };
        io.to(nextPlayer.id).emit("flow_available", { roomId, rank: lastDiscard.rank, fromPlayerId: player.id });
      }
    }
    const nextIndex = getNextPlayerIndex(room, playerIndex);
    if (nextIndex != null) room.currentTurnIndex = nextIndex;
    broadcastState(roomId);
  });

  socket.on("kang", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;
    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;
    resolveKang(roomId, socket.id);
  });

  socket.on("flow_discard", ({ roomId, cardIds }) => {
    const room = rooms.get(roomId);
    if (!room || !room.pendingFlow || room.pendingFlow.toPlayerId !== socket.id) return;
    const player = getPlayer(room, socket.id);
    if (!player) return;

    const cardsToDiscard = [];
    for (const cardId of cardIds) {
      const card = player.hand.find((c) => c.id === cardId);
      if (!card) return;
      cardsToDiscard.push(card);
    }
    if (cardsToDiscard.length === 0 || !cardsToDiscard.every((c) => c.rank === room.pendingFlow.rank)) return;

    const victim = getPlayer(room, room.pendingFlow.fromPlayerId);
    const FLOW_PENALTY = 25 * cardsToDiscard.length;
    if (victim) {
      victim.chips -= FLOW_PENALTY;
      player.chips += FLOW_PENALTY;
      io.to(victim.id).emit("got_flowed_mock");
    }

    for (const card of cardsToDiscard) {
      player.hand = player.hand.filter((c) => c.id !== card.id);
      room.discardPile.push(card);
    }

    if (player.hand.length === 0) {
      room.status = "ended"; room.winnerId = player.id; room.endGameReason = "empty_hand";
      distributeChips(room);
      io.to(room.id).emit("flow_win", { winnerId: player.id, rank: room.pendingFlow.rank });
    } else {
      const playerIndex = room.players.findIndex((p) => p.id === player.id);
      const nextIndex = getNextPlayerIndex(room, playerIndex);
      if (nextIndex != null) room.currentTurnIndex = nextIndex;
    }
    room.pendingFlow = null;
    broadcastState(roomId);
  });

  socket.on("send_emote", ({ roomId, emote }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("receive_emote", { playerId: socket.id, emote });
  });

  // --- ฝั่งนิยายยำเละ (Yamstory) ---
  socket.on("join_yam_room", ({ roomId, username }) => {
    if (!roomId) return;
    const safeName = username && String(username).trim() ? String(username).trim() : "นักเขียนนิรนาม";
    const room = getOrCreateYamRoom(roomId);
    
    if (room.players.length === 0) room.hostId = socket.id;

    let existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) {
      if (room.hostId === existingPlayer.id) room.hostId = socket.id;
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
    } else {
      room.players.push({ id: socket.id, name: safeName, connected: true });
    }

    socket.join(`yam_${roomId}`);
    socket.data.yamRoomId = roomId;
    broadcastYamState(roomId);
  });

  socket.on("start_yam_game", ({ roomId }) => {
    const room = yamRooms.get(roomId);
    if (!room || room.status !== "waiting" || room.hostId !== socket.id) return;
    room.status = "playing";
    room.currentTurnIndex = 0;
    room.turnCount = 1;
    room.lastWords = "";
    room.fullStory = [];
    broadcastYamState(roomId);
  });

  socket.on("submit_yam_text", ({ roomId, text }) => {
    const room = yamRooms.get(roomId);
    if (!room || room.status !== "playing") return;
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || room.currentTurnIndex !== playerIndex) return;

    const player = room.players[playerIndex];
    
    // บันทึกประโยคเต็มๆ ลงสมุดข่อย
    room.fullStory.push({ playerId: player.id, playerName: player.name, text: text.trim() });

    // ✂️ หั่นข้อความ เอาแค่ 5 คำสุดท้าย (เว้นวรรค) ส่งไปปั่นหัวเพื่อน
    const words = text.trim().split(/\s+/);
    room.lastWords = words.slice(-5).join(" ");

    // เลื่อนตาเล่นให้คนถัดไป
    room.turnCount++;
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    broadcastYamState(roomId);
  });

  socket.on("end_yam_game", ({ roomId }) => {
    const room = yamRooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.status = "ended";
    broadcastYamState(roomId);
  });

  socket.on("reset_yam_game", ({ roomId }) => {
    const room = yamRooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.status = "waiting";
    room.lastWords = "";
    room.turnCount = 0;
    room.fullStory = [];
    broadcastYamState(roomId);
  });

  // --- จัดการตอนเน็ตหลุด (Disconnect) ---
  socket.on("disconnect", () => {
    // กรณีหลุดจากห้องสมมแคง
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
        if (room.players.length === 0) rooms.delete(roomId);
        else broadcastState(roomId);
      }
    }

    // กรณีหลุดจากห้องนิยายยำเละ
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
        if (room.players.length === 0) yamRooms.delete(yamRoomId);
        else broadcastYamState(yamRoomId);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Arcade Server is running on port ${PORT}`);
});