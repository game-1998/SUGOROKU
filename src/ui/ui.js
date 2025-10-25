import { getPlayers, setPlayers } from '../state/gameState.js';

export function setupPlayers(count, gameScreen, playerNames) {
  const players = [];
  const cells = document.querySelectorAll(".cell");

  // 既存のコマを削除
  document.querySelectorAll(".playerPiece").forEach(p => p.remove());

  for (let i = 0; i < count; i++) {
    // 初期位置は0
    const name = playerNames[i] || `プレイヤー${i + 1}`;
    const piece = document.createElement("div");
    piece.className = "playerPiece";
    piece.id = `piece${i}`;
    piece.textContent = name;
    piece.style.backgroundColor = getColor(i);

    // 初期位置に配置
    const startCell = cells[0];

    // 位置ずらしの計算（3人ずつ段組み）
    const column = i % 3; // 横方向（最大3人）
    const row = Math.floor(i / 3); // 縦方向（段数）
    const offsetX = column * 22; // 横に22pxずつずらす
    const offsetY = row * 22;    // 縦に22pxずつずらす

    piece.style.left = offsetX + "px";
    piece.style.top = offsetY + "px";

    startCell.appendChild(piece);

    players.push({ name, position: 0 });
  }
  setPlayers(players);
}



// 最初のプレイヤー表示
export function updateTurnDisplay(currentPlayer, turnInfo, nextPlayerButton) {
  const players = getPlayers();
  const name = players[currentPlayer].name;
  turnInfo.textContent = `次は ${name} の番です`;
  nextPlayerButton.style.display = "inline-block";
}



// コマを移動する関数
export function movePlayer(diceValue, currentPlayer, updateTurnDisplay) {
  const players = getPlayers();
  const cells = document.querySelectorAll(".cell");
  const MAX_CELL_INDEX = cells.length - 1;
  let gameEnded = false;

  // ゴール判定用に今のプレイヤー番号を保存
  const playerIndex = currentPlayer;
  
  // 現在のプレイヤーの位置を更新
  players[playerIndex].position += diceValue;

  // 範囲チェック
  if (players[playerIndex].position < 0) {
    players[playerIndex].position = 0;
  }
  if (players[playerIndex].position > MAX_CELL_INDEX) {
    players[playerIndex].position = MAX_CELL_INDEX;// 最後のマスで止まる
  }

  // マスの位置を取得してコマを移動
  const targetCell = cells[players[playerIndex].position];
  const piece = document.getElementById(`piece${playerIndex}`);
  console.log("移動先マス:", players[playerIndex].position);
  console.log("targetCell:", targetCell);


  // 位置ずらしの計算（初期位置と同じ段組み）
  const column = playerIndex % 3;
  const row = Math.floor(playerIndex / 3);
  const offsetX = column * 22;
  const offsetY = row * 22;

  targetCell.appendChild(piece);

  piece.style.left = offsetX + "px";
  piece.style.top = offsetY + "px";

  // ゴール判定
  if (players[playerIndex].position === MAX_CELL_INDEX && !gameEnded) {
    gameEnded = true;

    requestAnimationFrame(() => {
      setTimeout(() => {
        alert(`${players[playerIndex].name}がゴール！`);

        // ランキング表示
        showRanking();

        //ホームボタン表示
        document.getElementById("backToHomeButton").style.display = "inline-block";
      }, 500);
    });
  }
  setPlayers(players);

  // 次のプレイヤーに交代
  const nextPlayer = (currentPlayer + 1) % players.length;

  // 次の番を表示
  updateTurnDisplay(nextPlayer, turnInfo, nextPlayerButton);
  
  return nextPlayer;
}

// コマの色分け
export function getColor(index) {
  const colors = ["red", "blue", "green", "orange", "purple", "brown", "pink"];
  return colors[index % colors.length];
}

//ランキング表示
function showRanking() {
  const players = getPlayers();
  const cells = document.querySelectorAll(".cell");
  const MAX_CELL_INDEX = cells.length - 1;

  const ranked = [...players].sort((a, b) => {
    const aGoal = a.position >= MAX_CELL_INDEX ? 1 : 0;
    const bGoal = b.position >= MAX_CELL_INDEX ? 1 : 0;

    if (aGoal !== bGoal) return bGoal - aGoal;
    return b.position - a.position;
  });

  const message = "🏁 ゲーム終了！\n" + ranked.map((p, i) =>
    `${i + 1}位：${p.name}（${p.position >= MAX_CELL_INDEX ? "ゴール" : `マス${p.position}`}）`
  ).join("\n");

  alert(message);
}
