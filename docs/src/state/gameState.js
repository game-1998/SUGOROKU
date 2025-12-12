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
    ...Array(MAX_CELL_INDEX).fill("半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("満水"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("次の人 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("前の人 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("指名 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 3)).fill("先頭 半揮"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("次ターン2倍"),
    ...Array(Math.round(MAX_CELL_INDEX / 5)).fill("次ターン\nサイコロ2個"),
    ...Array(Math.round(MAX_CELL_INDEX / 10)).fill("サイコロの出目\n×\n半揮"),
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
  switch (eventType) {
    case "次ターン2倍":
      player.effectMultiplier *= 2;
      console.log(`[イベント] ${player.name} に効果2倍を付与 → effectMultiplier=${player.effectMultiplier}`);
      break;

    case "次ターン\nサイコロ2個":
      player.diceBonus += 1 * player.effectMultiplier;
      console.log(`[イベント] ${player.name} にサイコロ追加 → diceBonus=${player.diceBonus}`);
      break;

    case "サイコロの出目\n×\n半揮":
      const dice = rollDice(); // 出目を取得
      showDiceResult(dice);    // 出目をUIに表示
      player.hankiCount = (player.hankiCount ?? 0) + dice;
      break;

    default:
      // 他のイベントはテキスト表示のみ
      console.log(`イベント発生: ${eventType}`);
  }
}

// ターン効果をリセット
export function endTurn() {
  const currentPlayer = getCurrentPlayer();
  if (currentPlayer) {
    resetDiceBonus(currentPlayer);
    currentPlayer.effectMultiplier = 1; // 2倍効果もリセット
  }
  normalizeTurnIndex();
}
