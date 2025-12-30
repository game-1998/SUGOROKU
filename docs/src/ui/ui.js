import {
  getPlayers, setPlayers, getCurrentPlayer, getTurnOrder, setCurrentPlayer,
  removePlayer, getLeader, setTurnOrder, getPieces, normalizeTurnIndex,
  getState, applyEvent, endTurn, applyEffectMultiplier, getEffectCutinText,
  setCanRoll, setCanJudgeDice
} from '../state/gameState.js';
import { setPiece, getPiece, clearPieces } from '../utils/pieceRegistry.js';
import { movePieceAlongPath } from "../core/pathMotion.js";
import { updateCellPositions } from '../board/board.js';

export function setupPlayers(count, gameScreen, playerNames, pieceIds) {
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

    // 既存プレイヤー情報を取得
    const existingPlayer = getPlayers().find(p => p.name === name);

    // 駒IDは既存があれば引き継ぐ、なければ新規
    const pieceId = existingPlayer ? existingPlayer.pieceId : pieceIds[i];
    piece.dataset.pieceId = pieceId;

    // 位置も既存があれば引き継ぐ
    const position = existingPlayer ? existingPlayer.position : 0;

    // サイコロ効果も引き継ぐ（なければ初期値）
    const diceBonus = existingPlayer ? existingPlayer.diceBonus : 0;
    const effectMultiplier = existingPlayer ? existingPlayer.effectMultiplier : 1;

    // コマ画像を表示
    const img = document.createElement("img");
    img.src = `images/piece${pieceId + 1}.webp`;
    img.className = "pieceImage";
    piece.appendChild(img);

    piece.dataset.pieceId = pieceId;

    positionPiece(piece, cells[position]);

    // コマをマップに登録
    setPiece(name, piece);

    // コマにイベントを付与
    document.querySelectorAll(".playerPiece").forEach(piece => {
      const playerName = piece.dataset.playerName; // 事前にdata属性で名前を持たせておく
      piece.addEventListener("click", () => {
        showNameBubble(piece, playerName);
      });
    });

    // プレイヤー情報を保存
    players.push({ name, position, pieceId, diceBonus, effectMultiplier });
  }

  setPlayers(players);
}

// 最初のプレイヤー表示
export function updateTurnDisplay(playerName, turnInfo, nextPlayerButton) {
  turnInfo.textContent = `次は ${playerName} の番です`;
  //nextPlayerButton.classList.add("show");
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
  if (diceValue <= -1) {
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
    
  endTurn();
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

  // 次のプレイヤー名を取得
  const turnOrder = getTurnOrder();
  const currentIndex = turnOrder.indexOf(currentPlayerName);

  const nextPlayerName = turnOrder[(currentIndex + 1) % turnOrder.length];

  // イベントカードの表示
  const stoppedCell = cells[targetPos];
  if (stoppedCell.event) {
    showEventCard(stoppedCell.event);
  }

  //setCurrentPlayer(nextPlayerName);
  

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
export function hideBowlArea(rigidBodies) {
  const bowl = document.getElementById('bowlArea');
  bowl.classList.remove('show');
  bowl.classList.add('hidden');
  
  rigidBodies.forEach(obj => {
    if (obj._value === -1) {
      // 落ちたサイコロだけリセット位置に戻す
      obj.mesh.position.set(0, 5, 0);
      obj.mesh.quaternion.set(0, 0, 0, 1);

      const t = new Ammo.btTransform();
      t.setIdentity();
      t.setOrigin(new Ammo.btVector3(0, 5, 0));
      t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
      obj.body.setWorldTransform(t);

      setTimeout(() => {
        obj.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        obj.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
      }, 0);
    }
  });
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
  piece.style.width = `${cellSize * 0.76}px`;  // 70%サイズなど調整可能
  piece.style.height = `${cellSize * 0.76}px`;
  let offsetX, offsetY;
  
  // 配置位置（オフセット）
  if(isStart){
    const totalWidth = cell.offsetWidth;
    const pieceWidth = cellSize * 0.76;
    const spacing = (totalWidth - pieceWidth * maxSlots) / (maxSlots + 1); // 両端に余白

    offsetX = spacing * (slot + 1) + pieceWidth * slot;
    offsetY = (cell.offsetHeight - cellSize * 0.76) / 2;
  }else{
    if (column === 0){
      offsetX = -cellSize * 0.13;
    }else{
      offsetX = cellSize * 0.37;
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

async function showEventCard(eventText) {
  const card = document.getElementById("eventCard");
  const back = card.querySelector(".card-back");
  const inner = card.querySelector(".card-inner");

  const currentPlayer = getCurrentPlayer();       // 今のプレイヤー名
  const turnOrder = getTurnOrder();               // 順番配列
  const targetPlayer = resolveTargetPlayer(eventText, currentPlayer.name, turnOrder);

  // --- 効果倍率の適用 ---
  const multiplier = currentPlayer.effectMultiplier;
  const beforeText = eventText;
  const afterText = applyEffectMultiplier(eventText, multiplier);
  
  card.classList.remove("hidden");
  back.textContent = beforeText;

  // カットインが必要かどうか（multiplier が 1 以外なら強化あり）
  const needsCutin = multiplier !== 1;

  // 効果適用
  const result = applyEvent(currentPlayer, afterText);

  // 半揮イベントならフラグを立てる
  if (result?.needsReroll) {
    window.currentEventType = "半揮系";
    setCanRoll(true);        // サイコロをつかめるようにする
    setCanJudgeDice(false);  // 判定はまだ開始しない
  } else {
    window.currentEventType = null;
  }

  // カットイン（必要なときだけ）
  if (needsCutin) {
    await playEffectCutin(multiplier);
  }

  // カットイン後にテキスト切り替え
  back.textContent = targetPlayer
    ? `${afterText}\n対象: ${targetPlayer}`
    : afterText;

  // 倍率カードかどうか判定
  const isMultiplierCard =
    afterText.startsWith("次ターン2倍") ||
    afterText.startsWith("次ターン4倍") ||
    afterText.startsWith("次ターン8倍") ||
    afterText.startsWith("次ターン16倍") ||
    afterText.startsWith("サイコロの出目");

  // 倍率カードじゃなければ multiplier をリセット
  if (!isMultiplierCard) {
    currentPlayer.effectMultiplier = 1;
  }

  // 少し遅れてめくる
  setTimeout(() => {
    inner.classList.add("flipped");
  
    // めくりアニメーションが終わった後にクリックイベントを登録
    setTimeout(() => {
      card.addEventListener("click", () => {
        card.classList.add("hidden");
        inner.classList.remove("flipped");
        nextPlayerButton.classList.add("show");
      }, { once: true });
    }, 1000); // アニメーション時間に合わせて調整
  }, 500);

  if (result?.needsReroll) {
    await wait(2500);
    showBowlArea();
  }
}

function resolveTargetPlayer(eventText, currentPlayerName, turnOrder) {
  const currentIndex = turnOrder.indexOf(currentPlayerName);

  if (eventText.startsWith("次の人")) {
    return turnOrder[(currentIndex + 1) % turnOrder.length];
  }
  if (eventText.startsWith("前の人")) {
    return turnOrder[(currentIndex - 1 + turnOrder.length) % turnOrder.length];
  }
  if (eventText.startsWith("先頭")) {
    return getLeader(getPlayers()).name;
  }
  return null; // 対象なし
}

export function handleRemovePlayer(name, selectedPieces, usedPieceIds) {
  // 削除対象プレイヤーを取得
  const players = getPlayers();
  const removedPlayer = players.find(p => p.name === name);
  // 実データ削除
  removePlayer(name);

  // --- 駒の使用状態を解放 ---
  if (removedPlayer) {
    // usedPieceIds から削除
    usedPieceIds.delete(removedPlayer.pieceId);
    // selectedPieces の該当インデックスを null に
    const playerIndex = players.findIndex(p => p.name === name);
    if (playerIndex !== -1) {
      selectedPieces[playerIndex] = null;
      updatePreview(document.getElementById("gamePlayerList"), playerIndex, null);
      updatePreview(document.getElementById("addPlayerForm"), playerIndex, null);
    }
  }

  // 順番を最新化
  const order = getPlayers().map(p => p.name);
  setTurnOrder(order);

  // 現在のインデックスを正規化
  normalizeTurnIndex();

  // 現在プレイヤーが削除されていた場合、正規化後のインデックスのプレイヤーに差し替え
  const current = getCurrentPlayer();
  if (current) setCurrentPlayer(current.name);

  // UI再構築（pieceId と名前のペアで）
  setupPlayers(getPlayers().length, gameScreen, getTurnOrder(), getPieces());
  const cur = getCurrentPlayer();
  updateTurnDisplay(cur ? cur.name : "（プレイヤーなし）", turnInfo, nextPlayerButton);

  // 吹き出し等の残骸はクリア（必要なら）
  document.querySelectorAll(".nameBubble").forEach(b => b.remove());
}

// コマ選択のプレビュー更新
export function updatePreview(container, playerIndex, pieceId) {
  const preview = container.querySelector(
    `.piecePreview[data-player-index="${playerIndex}"]`
  );
  if (!preview) return;

  if (pieceId != null) {
    preview.innerHTML = `<img src="images/piece${pieceId + 1}.webp" />`;
    preview.classList.remove("no-select");
  } else {
    preview.textContent = "？";
    preview.classList.add("no-select");
  }
}

// 効果倍率のカットイン
async function playEffectCutin(multiplier, beforeText, afterText) {
  const cutin = document.getElementById("effectCutin");
  const cutinText = document.getElementById("effectCutinText");
  const overlay = document.getElementById("cutinOverlay");

  // カットインに表示するテキスト
  cutinText.textContent = getEffectCutinText(multiplier);

    // 背景暗転
  overlay.classList.remove("hidden");
  overlay.classList.add("show");

  // カットイン表示
  cutin.classList.remove("hidden");
  cutin.classList.add("show");

  await wait(200);

  // 稲妻走らせる
  cutin.classList.add("run");

  // 稲妻が終わるまで待つ（150ms）
  await wait(1000);

  // 稲妻クラスを外す
  cutin.classList.remove("run");

  await wait(800);

  // カットイン消す
  cutin.classList.remove("show");
  cutin.classList.add("hide");

  await wait(500);

  cutin.classList.add("hidden");
  cutin.classList.remove("hide");

  // 背景暗転解除
  overlay.classList.remove("show");
  await wait(300);
  overlay.classList.add("hidden");
}

export function showHankiResultPopup(text) {
  const popup = document.getElementById("hankiResultPopup");
  const textBox = document.getElementById("hankiResultText");
  const okButton = document.getElementById("hankiResultOk");

  textBox.textContent = text;
  popup.classList.remove("hidden");

  return new Promise(resolve => {
    okButton.onclick = () => {
      popup.classList.add("hidden");
      resolve();
    };
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
