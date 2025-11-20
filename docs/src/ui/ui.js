import { getPlayers, setPlayers, getTurnOrder, setCurrentPlayer } from '../state/gameState.js';
import { setPiece, getPiece, clearPieces } from '../utils/pieceRegistry.js';
import { movePieceAlongPath } from "../core/pathMotion.js";
import { updateCellPositions } from '../board/board.js';

export function setupPlayers(count, gameScreen, playerNames, selectedPieces) {
  const players = [];
  const cells = document.querySelectorAll(".cell");
  const startCell = document.querySelector(".cell.start");
  startCell.dataset.slotCount = count; // プレイヤー数を記録


  // 既存のコマを削除
  document.querySelectorAll(".playerPiece").forEach(p => p.remove());

  for (let i = 0; i < count; i++) {
    // 初期位置は0
    const name = playerNames[i] || `プレイヤー${i + 1}`;
    const piece = document.createElement("div");
    piece.className = "playerPiece";
    piece.id = `piece${i}`;
    piece.dataset.playerName = name;

    // コマ画像を表示
    const img = document.createElement("img");
    img.src = `images/piece${selectedPieces[i] + 1}.webp`;
    img.className = "pieceImage";
    piece.appendChild(img);

    // 初期位置に配置
    const startCell = cells[0];
    positionPiece(piece, startCell);

    // コマをマップに登録
    setPiece(name, piece);

    players.push({ name, position: 0 });
  }
  setPlayers(players.map(({ name, position }) => ({ name, position })));
}

// 最初のプレイヤー表示
export function updateTurnDisplay(playerName, turnInfo, nextPlayerButton) {
  turnInfo.textContent = `次は ${playerName} の番です`;
  nextPlayerButton.classList.add("show");
}

// コマを移動する関数
export async function movePlayer(diceValue, currentPlayerName, updateTurnDisplay) {
  const players = getPlayers();
  const cells = document.querySelectorAll(".cell");
  const board = document.getElementById("board");
  const MAX_CELL_INDEX = cells.length - 1;
  const svg = document.querySelector("svg");
  let gameEnded = false;

  // 名前からインデックス取得
  const playerIndex = players.findIndex(p => p.name === currentPlayerName);
  const piece = getPiece(currentPlayerName);
  
  // 現在のプレイヤーの位置を更新
  let currentPos = players[playerIndex].position;
  let targetPos = currentPos + diceValue;

  // 範囲チェック
  if (targetPos > MAX_CELL_INDEX) targetPos = MAX_CELL_INDEX;
  if (targetPos < 0) targetPos = 0;
  const finalCell = cells[targetPos];

  // --- ここで特殊処理を分岐 ---
  if (diceValue === -1) {
    await animateMinusOne(piece, targetPos, finalCell);
  }
  else {
    // 出目の数だけ一歩ずつ滑らかに移動
    for (let i = currentPos; i < targetPos; i++) {
      const { positions, paths } = updateCellPositions(Array.from(cells), board, svg);
      const path = paths[i]; // i番目のpathを取得
      const endLength = path.getTotalLength();
      const speed = 0.2; // pixel per ms
      const duration = endLength / speed;

      if (!path || !path.ownerSVGElement) {
        console.warn(`path[${i}] が無効です。ownerSVGElement:`, path?.ownerSVGElement);
        continue; // または break、resolve、return など状況に応じて
      }

      // アニメ開始前に駒を board 直下へ移動
      if (piece.parentElement !== board) {
        // パスの始点座標を取得
        const startPoint = path.getPointAtLength(0);
        const svg = path.ownerSVGElement;
        const pt = svg.createSVGPoint();
        pt.x = startPoint.x;
        pt.y = startPoint.y;

        // SVG座標をスクリーン座標に変換
        const screenPt = pt.matrixTransform(svg.getScreenCTM());
        const boardRect = board.getBoundingClientRect();

        const boardX = screenPt.x - boardRect.left - piece.offsetWidth/2 + board.scrollLeft;
        const boardY = screenPt.y - boardRect.top - piece.offsetHeight/2 + board.scrollTop;

        // 駒をパス始点に配置（中心補正なし）
        piece.style.left = boardX + "px";
        piece.style.top  = boardY + "px";
        board.appendChild(piece);
      }

      await new Promise(r => requestAnimationFrame(r)); // レイアウト確定を待つ

      await movePieceAlongPath(piece, path, board, 0, endLength, duration);

      // 移動完了後にセル内のslotへ再配置
      if (i === targetPos - 1){
        positionPiece(piece, finalCell);
      }
      else{
        await delay(100);
      }
      players[playerIndex].position = i + 1;
    }
  }
    
  players[playerIndex].position = targetPos;
  setPlayers(players);
      
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
  //setPlayers(players);

  // 次のプレイヤー名を取得
  const turnOrder = getTurnOrder();
  const currentIndex = turnOrder.indexOf(currentPlayerName);
  const nextPlayerName = turnOrder[(currentIndex + 1) % turnOrder.length];

  setCurrentPlayer(nextPlayerName);

  // 表示更新
  updateTurnDisplay(nextPlayerName, turnInfo, nextPlayerButton);
  
  return nextPlayerName;
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

//お椀エリアの出現
export function showBowlArea() {
  const bowl = document.getElementById('bowlArea');
  bowl.classList.remove('hidden');
  bowl.classList.add('show');
}

//お椀エリアの非表示
export function hideBowlArea() {
  const bowl = document.getElementById('bowlArea');
  bowl.classList.remove('show');
  bowl.classList.add('hidden');
}

//出目表示
export function showDiceResult(value) {
  const resultDisplay = document.getElementById('dice-result');
  resultDisplay.textContent = `出目：${value}`;
}

// コマの位置調整・配置
function positionPiece(piece, cell) {
  const isStart = cell.classList.contains("start");

  // スロット構成を切り替える
  const groupSize = isStart ? 6 : 2; // 横方向の数
  const maxSlots = isStart ? parseInt(cell.dataset.slotCount) || 1 : groupSize * 3;

  const sampleCell = document.querySelector(".cell:not(.start)");
  const cellSize = sampleCell.offsetWidth;

  // 既存のスロットを取得
  const usedSlots = Array.from(cell.querySelectorAll(".playerPiece"))
    .filter(p => p !== piece) // ← 自分自身を除外
    .map(p => parseInt(p.dataset.slot))
    .filter(n => !isNaN(n));

  // 空いているスロットを探す
  let slot = 0;
  while (usedSlots.includes(slot) && slot < maxSlots) {
    slot++;
  }

  // 左上から詰めるための行列計算
  const column = slot % groupSize;
  const row = Math.floor(slot / groupSize);

  // サイズ調整（コマをセルにフィットさせる）
  piece.style.width = `${cellSize * 0.7}px`;  // 70%サイズなど調整可能
  piece.style.height = `${cellSize * 0.7}px`;
  let offsetX, offsetY;
  
  // 配置位置（オフセット）
  if(isStart){
    const totalWidth = cell.offsetWidth;
    const pieceWidth = cellSize * 0.7;
    const spacing = (totalWidth - pieceWidth * maxSlots) / (maxSlots + 1); // 両端に余白

    offsetX = spacing * (slot + 1) + pieceWidth * slot;
    offsetY = (cell.offsetHeight - cellSize * 0.7) / 2;
  }else{
    if (column === 0){
      offsetX = -cellSize * 0.1;
    }else{
      offsetX = cellSize * 0.4;
    }
    offsetY = row * (cellSize * 0.75);
  }

  piece.style.left = `${offsetX}px`;
  piece.style.top = `${offsetY}px`;
  piece.dataset.slot = slot; // スロット記録

  const isGoal = cell.classList.contains("goal");
  if (isGoal) {
    // 例：中央に重ねて配置
    piece.style.left = `${(cell.offsetWidth - piece.offsetWidth) / 2}px`;
    piece.style.top = `${(cell.offsetHeight - piece.offsetHeight) / 2}px`;
  }

  // 中の画像にもサイズを反映
  const img = piece.querySelector("img");
  if (img) {
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain"; // はみ出し防止
  }

  cell.appendChild(piece);
}

// コマにプレイヤー名を表示
export function showNameBubble(pieceElement, playerName) {
  // 既存の吹き出しを削除
  const oldBubble = pieceElement.querySelector(".nameBubble");
  if (oldBubble) oldBubble.remove();

  // 新しい吹き出しを作成
  const bubble = document.createElement("div");
  bubble.className = "nameBubble";
  bubble.textContent = playerName;

  console.log(`playerName:${playerName}`);
  pieceElement.appendChild(bubble);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateMinusOne(piece, targetPos, finalCell) {
  return new Promise(resolve => {
    setTimeout(() => {
      // 一度上に消す
      piece.classList.add("disappear");    
    
      setTimeout(() => {
        // 新しいマスに配置
        positionPiece(piece, finalCell);

        setTimeout(() => {
          // 2回 requestAnimationFrame で確実に反映
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              piece.classList.remove("disappear");
              piece.classList.add("drop");
            });
          });

          setTimeout(() => {
            piece.classList.remove("drop");
            resolve();
          },700);
        }, 700);
      }, 650);
    }, 400);
  });
}