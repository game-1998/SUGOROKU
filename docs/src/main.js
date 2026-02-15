import { initPhysics, animate } from './core/physics.js';
import { init3DDice } from './core/diceGraphics.js';
import { setupPlayers, updateTurnDisplay, movePlayer, showBowlArea, hideBowlArea,
  showDiceResult, showNameBubble, handleRemovePlayer, updatePreview, showHankiResultPopup
} from './ui/ui.js';
import { getState, setCanRoll, setCanJudgeDice, setCurrentPlayer, getCurrentPlayer,
  setPlayers, getPlayers, assignEventsToCells, logEventDistribution, addPlayer,
  removePlayer, getTurnOrder, setTurnOrder, getPieces
} from './state/gameState.js';
import { resizeCanvasToFit } from './utils/canvasUtils.js';
import { generateBoard, updateCellPositions } from './board/board.js';
import { updateGrabbedDice } from './core/diceController.js';
import { playBGM } from "./sounds/bgmManager.js";

let usedPieceIds = new Set();
let selectedPieces = [];
const playerPieces = new Map(); // プレイヤー番号 → コマDOM要素
let nextPlayerButton, turnInfo;
let cells, board, svg;
const MAX_CELL_INDEX = 30;

export async function startGameApp() {
  window.Ammo = Ammo;             // グローバルに渡す（他のファイルでも使えるように）
  setCanJudgeDice(false);
  setCanRoll(false);

  // コマ画像の事前読み込み
  preloadPieceImages();

  // ホーム画面の要素を取得
  const startButton = document.getElementById("startGame");
  const homeScreen = document.getElementById("homeScreen");

  // プレイ画面の要素を取得
  const resultElement = document.getElementById("dice-result");
  const loader = new THREE.TextureLoader();
  const canvas = document.getElementById("threeCanvas")
  let dice, diceBody, scene, renderer, camera;
  let rigidBodies = [];
  let diceInit;
  let isDragging = false; // 指が触れている間 true
  let playerNames = [];
  let grabbedDice = [];
  let diceObjects = [];

  document.getElementById("playerCount").addEventListener("change", () => {
    const count = parseInt(document.getElementById("playerCount").value);
    const container = document.getElementById("playerNameInput");
    container.innerHTML = ""; // 既存の入力欄をクリア
    
    selectedPieces = new Array(count).fill(null);
    usedPieceIds.clear();

    // 見出し行を追加
    const headerRow = document.createElement("div");
    headerRow.className = "playerInputRow headerRow";

    const nameHeader = document.createElement("div");
    nameHeader.textContent = "プレイヤー名";
    nameHeader.className = "headerCellPlayername";

    const pieceHeader = document.createElement("div");
    pieceHeader.textContent = "コマ";
    pieceHeader.className = "headerCellPiece";

    headerRow.appendChild(nameHeader);
    headerRow.appendChild(pieceHeader);
    container.appendChild(headerRow);

    for (let i = 0; i < count; i++) {
      const row = document.createElement("div");
      row.className = "playerInputRow";

      const input = document.createElement("input");
      input.type = "text";
      input.id = `player${i}`;
      input.placeholder = `プレイヤー${i + 1}`;

      const pieceSelect = document.createElement("div");
      pieceSelect.className = "pieceSelect";
      pieceSelect.dataset.playerIndex = i;

      const preview = document.createElement("div");
      preview.className = "piecePreview no-select";
      preview.textContent = "？";

      pieceSelect.appendChild(preview);
      row.appendChild(input);
      row.appendChild(pieceSelect);
      container.appendChild(row);
    }

    container.style.display = "block";

    startButton.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    const select = e.target.closest(".pieceSelect");
    if (!select) return;
    const playerIndex = parseInt(select.dataset.playerIndex);
    showPieceSelectionPopup(playerIndex, select);
  });


  document.getElementById("startGame").addEventListener("click", () => {
    const count = parseInt(document.getElementById("playerCount").value);
    if (isNaN(count) || count < 2 || count > 6) {
      alert("プレイヤー人数を選択してください（2〜6人）");
      document.getElementById("playerCount").focus(); // 🎯 選択欄にフォーカス
      return; // ゲーム開始処理を中断
    }

    // ここで駒選択チェックを追加
    for (let i = 0; i < count; i++) {
      if (selectedPieces[i] === null) {
        alert(`プレイヤー${i + 1}の駒が未選択です！`);
        return; // ゲーム開始処理を中断

      }
    }

    // プレイヤー名と駒をペアにする
    const players = [];
    for (let i = 0; i < count; i++) {
      const name = document.getElementById(`player${i}`).value || `プレイヤー${i + 1}`;
      players.push({
        name,
        pieceId: selectedPieces[i],
        position: 0,
        orderIndex: i,
        diceBonus: 0, // 次ターンだけの追加サイコロ数（初期値0）
        effectMultiplier: 1 // 効果倍率（通常1倍、2倍や4倍に拡張可能）
      });
    }

    const shuffledPlayers = shuffle(players);

    // プレイヤーを state に保存（順番はシャッフル済みの配列そのまま）
    setPlayers(shuffledPlayers);

    setTurnOrder(shuffledPlayers.map(p => p.name));

    // 最初のプレイヤーを設定
    setCurrentPlayer(shuffledPlayers[0].name);

    // ホーム画面を非表示
    document.getElementById("homeScreen").style.display = "none";

    // 順番表示  
    const orderDisplay = document.getElementById("playerOrderDisplay");
    const orderText = document.getElementById("playerOrderText");
    orderText.innerHTML = `<div class="orderLabel">プレイヤー順</div>
                          ${getPlayers().map(p => `<div>${p.name}</div>`).join("↓")}`;
    orderDisplay.style.display = "block";
  });

  document.getElementById("confirmOrderButton").addEventListener("click", async () => {
    const curtain = document.getElementById("curtain");
    await playCurtainTransition(curtain);
    playBGM();

    // 設定ボタンのイベントリスナー登録
    const settingsBtn = document.getElementById("settingsBtn");
    settingsBtn.addEventListener("click", () => {
      const panel = document.getElementById("settingsPanel");
      panel.classList.toggle("hidden");
    });

    // バツ印ボタンで閉じる
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    closeSettingsBtn.addEventListener("click", () => {
      const panel = document.getElementById("settingsPanel");
      panel.classList.add("hidden");
    });

    // ゲーム開始後に表示
    settingsBtn.classList.remove("hidden");

    // プレイヤー追加
    // プレイヤー追加ボタン → モーダル表示
    document.getElementById("addPlayerBtn").addEventListener("click", () => {
      const modal = document.getElementById("addPlayerModal");
      const form = document.getElementById("addPlayerForm");

      // 現在の人数をカウント
      const currentCount = getPlayers().length;
      const newIndex = currentCount;

      // 入力行を生成してフォームに追加
      form.innerHTML = ""; // 前回の内容をクリア
      const newRow = createPlayerInputRow(newIndex);
      form.appendChild(newRow);

      modal.classList.remove("hidden"); // 表示

      document.getElementById("closeAddPlayerModal").addEventListener("click", () => {
        document.getElementById("addPlayerModal").classList.add("hidden");
      });
    });

    // 決定ボタン → プレイヤーを追加してモーダルを閉じる
    document.getElementById("confirmAddPlayer").addEventListener("click", () => {
      const modal = document.getElementById("addPlayerModal");
      const newIndex = getPlayers().length;

      if (selectedPieces[newIndex] === undefined) {
        selectedPieces[newIndex] = null;
      }

      const name = document.getElementById(`player${newIndex}`).value || `プレイヤー${newIndex+1}`;
      const pieceId = selectedPieces[newIndex]; // 選択された駒

      if (pieceId === null) {
        alert("駒を選択してください！");
        return;
      }

      // プレイヤーを state に追加
      addPlayer(name, pieceId);

      // UI更新
      updatePreview(document.getElementById("gamePlayerList"), newIndex, pieceId);
      updatePreview(document.getElementById("addPlayerForm"), newIndex, pieceId);

      const gameScreen = document.getElementById("gameScreen");
      setupPlayers(getPlayers().length, gameScreen, getTurnOrder(), getPieces());
      updateTurnDisplay(getState().currentPlayer, turnInfo, nextPlayerButton);

      // モーダルを閉じる
      modal.classList.add("hidden");
    });



    // プレイヤー削除
    document.getElementById("removePlayerBtn").addEventListener("click", () => {
      showRemovePlayerPopup();
    });

    window.addEventListener('resize', () => redraw(cells, board, svg));
    board.addEventListener('scroll', () => redraw(cells, board, svg));

    setTimeout(() => {
      setupPlayers(getPlayers().length, gameScreen, getTurnOrder(), getPieces());
      updateTurnDisplay(getState().currentPlayer, turnInfo, nextPlayerButton);

      // コマにイベントを付与
      document.addEventListener("click", (e) => {
        const piece = e.target.closest(".playerPiece");
        if (!piece) return;

        const pieceId = Number(piece.dataset.pieceId);
        const player = getPlayers().find(p => p.pieceId === pieceId);
        if (player) {
          showNameBubble(piece, player.name);
        }
      });


      // 違う場所をクリックしたら吹き出し削除
      document.addEventListener("click", (e) => {
        // コマをクリックした場合は何もしない
        if (e.target.closest(".playerPiece")) return;

        // 吹き出しを全部削除
        document.querySelectorAll(".nameBubble").forEach(bubble => bubble.remove());
      });

      const { physicsWorld } = initPhysics();

      diceInit = init3DDice({
        canvas,
        physicsWorld,
        rigidBodies,
        diceObjects,
        loader,
        canRollRef: {
          get value() {
            return getState().canRoll;
          },
          set value(v) {
            setCanRoll(v);
          }
        },
        canJudgeDiceRef: {
          get value() {
            return getState().canJudgeDice;
          },
          set value(v) {
            setCanJudgeDice(v);
          }
        },
        onDiceStop: async (diceValue) => {
          showDiceResult(diceValue); // 出目を表示

          // 現在のイベントが「サイコロの出目 × 半揮」系かどうか
          let currentEvent = window.currentEventType; 

          if (currentEvent === "半揮系") {
            // 計算
            const player = getCurrentPlayer()
            const multiplier = player.effectMultiplier;
            const add = diceValue * 0.5 * multiplier;

            await wait(1000);
            
            // ポップアップ表示（OK を押すまで待つ）
            await showHankiResultPopup(
              `✨ 結果 ✨\n出目 ${diceValue} × ${0.5 * multiplier} = ${add}杯！`
            );
            hideBowlArea(rigidBodies);

            // 次のプレイヤーへ
            player.effectMultiplier = 1;
            const turnOrder = getTurnOrder();
            const currentIndex = turnOrder.indexOf(player.name);
            getState().currentTurnIndex = (currentIndex + 1) % turnOrder.length;
            const nextPlayerName = turnOrder[(currentIndex + 1) % turnOrder.length];

            setCurrentPlayer(nextPlayerName);
            updateTurnDisplay(nextPlayerName, turnInfo, nextPlayerButton);
            grabbedDice = updateGrabbedDice(diceObjects, getCurrentPlayer);

            window.currentEventType = null;
            return;
          }
          setTimeout(async() => {
            hideBowlArea(rigidBodies); // お椀を非表示
            const updatedPlayerName = await movePlayer(diceValue, getCurrentPlayer().name);

            await wait(1000);
            currentEvent = window.currentEventType; 
            if (currentEvent !== "半揮系"){
              const turnOrder = getTurnOrder();
              const currentIndex = turnOrder.indexOf(getCurrentPlayer().name);
              getState().currentTurnIndex = (currentIndex + 1) % turnOrder.length;
              setCurrentPlayer(updatedPlayerName);
              updateTurnDisplay(updatedPlayerName, turnInfo, nextPlayerButton);
            }

            // 必要なサイコロの数を出現
            grabbedDice = updateGrabbedDice(diceObjects, getCurrentPlayer);
          }, 3000);
        },
        onPointerRelease: ({ isSwipe, dx, dy, pointer }) => {
          // ここは空でもOK。diceGraphics.js側で使うために渡すだけ
        },
        isDraggingRef: {
          get value() {
            return isDragging;
          },
          set value(v) {
            isDragging = v;
          }
        }
      });

      dice = diceInit.dice;
      diceBody = diceInit.diceBody;
      scene = diceInit.scene;
      renderer = diceInit.renderer;
      camera = diceInit.camera;
      grabbedDice = updateGrabbedDice(diceObjects, getCurrentPlayer);
      
      setTimeout(() => {
        resizeCanvasToFit(canvas, camera, renderer,scene);
      }, 0);

      renderer.setPixelRatio(window.devicePixelRatio);

      animate(renderer, scene, camera, physicsWorld, diceInit.onDiceStop, diceInit.canJudgeDiceRef, rigidBodies); // 毎フレーム更新

      // ボタンを押したらサイコロを振れるようにする
      nextPlayerButton.addEventListener("click", () => {
        nextPlayerButton.classList.remove("show");

        //お椀エリアの表示
        showBowlArea();
        requestAnimationFrame(() => {
          resizeCanvasToFit(canvas, camera, renderer, scene);
        });
        setCanRoll(true);     // ターン全体で投げ許可
        setCanJudgeDice(false);
      });
      
    });
  }, 0);    
  const backToHomeButton = document.getElementById("backToHomeButton");

  backToHomeButton.addEventListener("click", () => {
    gameScreen.style.display = "none";
    homeScreen.style.display = "block";

    // コマを削除
    document.querySelectorAll(".playerPiece").forEach(p => p.remove());

    // 状態をリセット（任意）
    resultElement.textContent = "出目：？";
    backToHomeButton.style.display = "none";
  });

  window.addEventListener("resize", () => {
    if (!camera || !renderer || !scene) return;
    resizeCanvasToFit(canvas, camera, renderer, scene);
  });
}

// プレイヤーの順番をシャッフル
function shuffle(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

// コマの一覧表示
function showPieceSelectionPopup(playerIndex, targetElement) {
  const popup = document.createElement("div");
  popup.className = "piecePopup";

  for (let i = 0; i < 10; i++) {
    const img = document.createElement("img");
    img.src = `images/piece${i + 1}.webp`;
    img.className = "pieceOption";
    img.dataset.pieceId = i;

    if (usedPieceIds.has(i)) {
      img.style.opacity = "0.4";
      img.style.pointerEvents = "none";
    }

    img.addEventListener("click", () => {
      const prev = selectedPieces[playerIndex];

      if (prev !== null) usedPieceIds.delete(prev);

      selectedPieces[playerIndex] = i;
      usedPieceIds.add(i);
      const preview = targetElement.querySelector(`.pieceSelect[data-player-index="${playerIndex}"] .piecePreview`);
      if (preview) {
        preview.innerHTML = `<img src="images/piece${i + 1}.webp" />`;
        preview.classList.remove("no-select");
      } else {
        console.warn("[select] preview not found for index", playerIndex);
      }

      popup.remove();
    });

    popup.appendChild(img);
  }

  document.body.appendChild(popup);

  // --- 位置をプレイヤー行の中央に揃える ---
  const rect = targetElement.getBoundingClientRect();
  popup.style.position = "absolute";
  popup.style.top = `${rect.top + window.scrollY + rect.height / 2 - popup.offsetHeight / 2}px`;

  // ポップアップ内クリックは外側判定に伝播させない
  popup.addEventListener("click", e => e.stopPropagation());

  // --- 外側クリックで閉じる処理 ---
  function handleOutsideClick(event) {
    if (!popup.contains(event.target)) {
      closePopup();
    }
  }

  function closePopup() {
    popup.remove();
    document.removeEventListener("click", handleOutsideClick);
  }

  document.addEventListener("click", handleOutsideClick);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playCurtainTransition(curtain) {
  // 幕を降ろす
  curtain.classList.add("drop");
  await wait(800);

  // 順番表示を非表示
  document.getElementById("playerOrderDisplay").style.display = "none";

  // ゲーム画面を表示
  const gameScreen = document.getElementById("gameScreen");
  gameScreen.classList.remove("hidden");
  gameScreen.classList.add("show");
  
  nextPlayerButton = document.getElementById("nextPlayerButton");
  nextPlayerButton.classList.add("show");
  turnInfo = document.getElementById("turnInfo");
  updateTurnDisplay(getState().currentPlayer, turnInfo, nextPlayerButton);

  // 盤面生成（座標付き）
  ({ cells, board, svg } = generateBoard(MAX_CELL_INDEX));
  assignEventsToCells(cells, MAX_CELL_INDEX);
  logEventDistribution(cells);
  redraw(cells, board, svg);

  // 幕を揺らす
  //curtain.classList.remove("drop");
  //curtain.classList.add("swing");
  await wait(1200); // 揺れ時間

  // 幕を上げる
  curtain.classList.remove("drop");
  //curtain.classList.remove("swing");
  curtain.classList.add("lift");
  await wait(1000); // 上がり時間
}

function redraw(cells, board, svg) {
  requestAnimationFrame(() => updateCellPositions(cells, board, svg));
}

function preloadPieceImages() {
  for (let i = 1; i <= 10; i++) {
    const img = new Image();
    img.src = `images/piece${i}.webp`;
  }
}

function showRemovePlayerPopup() {
  const popup = document.createElement("div");
  popup.className = "removePlayerPopup";

  // --- 上部に指示文を追加 ---
  const header = document.createElement("div");
  header.className = "removePlayerHeader";
  header.textContent = "削除するプレイヤーを\n選択してください";
  popup.appendChild(header);

  // --- 右上に × ボタンを追加 ---
  const closeBtn = document.createElement("button");
  closeBtn.className = "removePlayerClose";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    popup.remove();
  });
  popup.appendChild(closeBtn);

  const players = getPlayers();

  players.forEach(player => {
    const row = document.createElement("div");
    row.className = "removePlayerRow";

    const nameDiv = document.createElement("div");
    nameDiv.textContent = player.name;
    nameDiv.className = "removePlayerName";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.className = "removePlayerBtn";

    deleteBtn.addEventListener("click", () => {
      handleRemovePlayer(player.name, selectedPieces, usedPieceIds);
      popup.remove();
    });

    row.appendChild(nameDiv);
    row.appendChild(deleteBtn);
    popup.appendChild(row);
  });

  document.body.appendChild(popup);

  // 中央に配置
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
}

function createPlayerInputRow(index) {
  const row = document.createElement("div");
  row.className = "playerInputRow";

  const input = document.createElement("input");
  input.type = "text";
  input.id = `player${index}`;
  input.placeholder = `プレイヤー${index + 1}`;

  const pieceSelect = document.createElement("div");
  pieceSelect.className = "pieceSelect";
  pieceSelect.dataset.playerIndex = index;

  const preview = document.createElement("div");
  preview.className = "piecePreview no-select";
  preview.textContent = "？";

  pieceSelect.appendChild(preview);
  row.appendChild(input);
  row.appendChild(pieceSelect);

  return row;
}
