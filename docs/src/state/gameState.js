const state = {
  currentPlayer: "",
  players: [], // { name, pieceId, position, orderIndex, diceBonus, effectMultiplier }
  canRoll: false,
  canJudgeDice: false,
  currentTurnIndex: 0,
  turnOrder: []
};

export function getState() {
  return state;
}

export function setCurrentPlayer(name) {
  state.currentPlayer = name;
}

export function setCanRoll(value) {
  state.canRoll = value;
}

export function setCanJudgeDice(value) {
  state.canJudgeDice = value;
}

export function getCurrentPlayer() {
  const order = getTurnOrder();
  if (!order || order.length === 0) return null;

  let attempts = 0;
  while (attempts < order.length) {
    const currentName = order[state.currentTurnIndex % order.length];
    const player = getPlayers().find(p => p.name === currentName);
    if (player) {
      return player;
    }
    state.currentTurnIndex++;
    attempts++;
  }
  console.warn("[getCurrentPlayer] プレイヤーが見つからない");
  return null; // 全員削除されていた場合
}


export function setPlayers(playerList) {
  state.players = playerList;
}

export function getPlayers() {
  return state.players;
}

// 母集団を生成
export function createEventPool(MAX_CELL_INDEX) {
  return [
    ...Array(Math.round(MAX_CELL_INDEX / 2)).fill("半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("満水"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("次の人 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("前の人 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("指名 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("先頭 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("次ターン2倍"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("次ターン\nサイコロ2個"),
    ...Array(Math.round(MAX_CELL_INDEX / 10)).fill("サイコロの出目\n×\n半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("ゲーム"),
  ];
}

// セルにイベントを割り当て
export function assignEventsToCells(cells, MAX_CELL_INDEX) {
  let pool = createEventPool(MAX_CELL_INDEX);

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.classList.contains("start")) {
      cell.event = "半揮";
    } else if (cell.classList.contains("goal")) {

    } else {
      const randomIndex = Math.floor(Math.random() * pool.length);
      cell.event = pool.splice(randomIndex, 1)[0]; // 使用したら取り除く
    }
  }
}

export function logEventDistribution(cells) {
  const counts = {};

  cells.forEach(cell => {
    if (cell.event) {
      counts[cell.event] = (counts[cell.event] || 0) + 1;
    }
  });

  console.log("=== イベント割り当て結果 ===");
  Object.entries(counts).forEach(([event, count]) => {
    console.log(`${event}: ${count}個`);
  });
}

export function addPlayer(name, pieceId) {
  const players = getPlayers();

  // 先頭とビリを判定
  const leader = getLeader(players);
  const tail = getTail(players);

  // ランダムな挿入位置を決定
  const insertPos = getRandomInsertPosition(leader, tail);

  // 新しいプレイヤーオブジェクト
  const newPlayer = { name, pieceId, position: insertPos, orderIndex: players.length };
  setPlayers([...players, newPlayer]);

  // ターン順序に追加
  const order = getTurnOrder();
  order.push(name);
  setTurnOrder(order);

  // 駒リストに追加
  const pieces = getPieces();
  pieces.push(pieceId);

  return newPlayer;
}


export function removePlayer(name) {
  state.players = state.players.filter(p => p.name !== name);
  return state.players;
}

// 順番や駒は都度生成
export function getTurnOrder() {
  return state.turnOrder;
}

export function setTurnOrder(order) {
  state.turnOrder = order;
}

export function getPieces() {
  return state.players.map(p => p.pieceId);
}

// 先頭を探す
export function getLeader(players) {
  // 最も進んだマスを求める
  const maxPos = Math.max(...players.map(p => p.position));

  // そのマスにいるプレイヤーを抽出
  const candidates = players.filter(p => p.position === maxPos);

  // 同着なら orderIndex が小さい人（先にスロットを埋めた人）
  candidates.sort((a, b) => {
    const pieceA = document.querySelector(`.playerPiece[data-piece-id="${a.pieceId}"]`);
    const pieceB = document.querySelector(`.playerPiece[data-piece-id="${b.pieceId}"]`);
    const slotA = pieceA ? parseInt(pieceA.dataset.slot) || 0 : 0;
    const slotB = pieceB ? parseInt(pieceB.dataset.slot) || 0 : 0;
    return slotA - slotB;
  });

  return candidates[0]; // 先頭プレイヤー
}

// ビリを探す
export function getTail(players) {
  const minPos = Math.min(...players.map(p => p.position));
  const candidates = players.filter(p => p.position === minPos);
  candidates.sort((a, b) => a.orderIndex - b.orderIndex);
  return candidates[0]; // ビリのプレイヤー
}

export function getRandomInsertPosition(leader, tail) {
  return Math.floor(Math.random() * (leader.position - tail.position + 1)) + tail.position;
}

export function normalizeTurnIndex() {
  const order = getTurnOrder();
  if (!order || order.length === 0) {
    state.currentTurnIndex = 0;
    return;
  }
  state.currentTurnIndex = state.currentTurnIndex % order.length;
  if (state.currentTurnIndex < 0) {
    state.currentTurnIndex += order.length;
  }
}

// サイコロ数をリセット
function resetDiceBonus(player) {
  player.diceBonus = 0;
}

// イベントカードの処理
export function applyEvent(player, eventType) {

  // --- 効果倍率イベント（強化後も含む） ---
  if (
    eventType === "次ターン2倍" ||
    eventType === "次ターン4倍" ||
    eventType === "次ターン8倍" ||
    eventType === "次ターン16倍"
  ) {
    player.effectMultiplier *= 2;

    console.log(
      "[applyEvent] 効果倍率UP eventType=",
      eventType,
      "→",
      player.effectMultiplier,
      "倍 (player=",
      player.name,
      ")"
    );
    console.log(`[イベント] ${player.name} の効果倍率UP → ${player.effectMultiplier}倍`);
    return;
  }

  // --- サイコロ追加イベント（強化後も含む） ---
  if (
    eventType === "次ターン\nサイコロ2個" ||
    eventType === "次ターン\nサイコロ3個" ||
    eventType === "次ターン\nサイコロ5個" ||
    eventType === "次ターン\nサイコロ9個"
  ) {
    player.diceBonus += 1 * player.effectMultiplier;
    console.log(`[イベント] ${player.name} にサイコロ追加 → diceBonus=${player.diceBonus}`);
    return;
  }

  // --- 半揮 / 満水 系イベント（強化後も含む） ---
  if (
    eventType === "サイコロの出目\n×\n半揮" ||
    eventType === "サイコロの出目\n×\n満水" ||
    eventType === "サイコロの出目\n×\n満水2杯" ||
    eventType === "サイコロの出目\n×\n満水4杯"
  ) {
    const dice = rollDice();
    showDiceResult(dice);

    player.hankiCount = (player.hankiCount ?? 0) + dice * player.effectMultiplier;

    console.log(`[イベント] ${player.name} の半揮系 → +${dice * player.effectMultiplier}`);
    return;
  }

  // --- その他 ---
  console.log(`イベント発生: ${eventType}`);
}


// ターン効果をリセット
export function endTurn() {
  const currentPlayer = getCurrentPlayer();
  if (currentPlayer) {
    resetDiceBonus(currentPlayer);
    //currentPlayer.effectMultiplier = 1; // 2倍効果もリセット
  }
  normalizeTurnIndex();
}

export function getEffectCutinText(multiplier) {
  return `効果${multiplier}倍!!`;
}

export function applyEffectMultiplier(eventText, multiplier) {
  const level = multiplierToLevel(multiplier);

  if (effectMap[eventText]) {
    const list = effectMap[eventText];
    return list[Math.min(level, list.length - 1)];
  }

  return eventText;
}

const effectMap = {
  "半揮": ["半揮", "満水", "満水2杯", "満水4杯"],
  "満水": ["満水", "満水2杯", "満水4杯", "満水8杯"],

  "次の人 半揮": ["次の人 半揮", "次の人 満水", "次の人 満水2杯", "次の人 満水4杯"],
  "前の人 半揮": ["前の人 半揮", "前の人 満水", "前の人 満水2杯", "前の人 満水4杯"],
  "指名 半揮": ["指名 半揮", "指名 満水", "指名 満水2杯", "指名 満水4杯"],
  "先頭 半揮": ["先頭 半揮", "先頭 満水", "先頭 満水2杯", "先頭 満水4杯"],

  "次ターン2倍": ["次ターン2倍", "次ターン4倍", "次ターン8倍", "次ターン16倍"],
  "次ターン\nサイコロ2個": [
    "次ターン\nサイコロ2個",
    "次ターン\nサイコロ3個",
    "次ターン\nサイコロ5個",
    "次ターン\nサイコロ9個"
  ],

  "サイコロの出目\n×\n半揮": [
    "サイコロの出目\n×\n半揮",
    "サイコロの出目\n×\n満水",
    "サイコロの出目\n×\n満水2杯",
    "サイコロの出目\n×\n満水4杯"
  ]
};

export function multiplierToLevel(multiplier) {
  if (multiplier <= 1) return 0;  // 通常
  if (multiplier <= 2) return 1;  // 2倍
  if (multiplier <= 4) return 2;  // 4倍
  if (multiplier <= 8) return 3;  // 8倍
  if (multiplier <= 16) return 4; // 16倍

  // それ以上の倍率が来ても破綻しないように
  return 4;
}
