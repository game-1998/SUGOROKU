import { rollDicePhysics, initPhysics, animate } from './core/physics.js';
import { init3DDice } from './core/diceGraphics.js';
import { setupPlayers, updateTurnDisplay, movePlayer, getColor } from './ui/ui.js';
import { getState, setCanRoll, setCanJudgeDice, setCurrentPlayer, getCurrentPlayer, setPlayers, getPlayers } from './state/gameState.js';


export async function startGameApp() {
  window.Ammo = Ammo;             // グローバルに渡す（他のファイルでも使えるように）
  setCanJudgeDice(false);
  setCanRoll(false);
  setCurrentPlayer(0);

  // ホーム画面の要素を取得
  const startButton = document.getElementById("startGame");
  const homeScreen = document.getElementById("homeScreen");
  const gameScreen = document.getElementById("gameScreen");

  // プレイ画面の要素を取得
  const resultElement = document.getElementById("dice-result");
  const loader = new THREE.TextureLoader();
  const canvas = document.getElementById("threeCanvas")
  let nextPlayerButton;
  let turnInfo;
  let dice, diceBody, scene, renderer, camera;
  let rigidBodies = [];
  let diceInit;
  let isDragging = false; // 指が触れている間 true
  let startX = 0;  // スワイプ開始位置（X）
  let startY = 0;  // スワイプ開始位置（Y）

  //マス目を任意の数生成
  const board = document.getElementById("board");
  for (let i = 1; i <= 10; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = i;
    board.appendChild(cell);
  }



  let playerNames = [];

  document.getElementById("playerCount").addEventListener("change", () => {
    const count = parseInt(document.getElementById("playerCount").value);
    const container = document.getElementById("playerNameInput");
    container.innerHTML = ""; // 既存の入力欄をクリア

    for (let i = 0; i < count; i++) {
      const label = document.createElement("label");
      label.textContent = `プレイヤー${i + 1}の名前：`;
      const input = document.createElement("input");
      input.type = "text";
      input.id = `player${i}`;
      input.placeholder = `プレイヤー${i + 1}`;
      container.appendChild(label);
      container.appendChild(input);
      container.appendChild(document.createElement("br"));
    }

    container.style.display = "block";

    const startButton = document.getElementById("startGame");
    startButton.style.display = "block"; // ← 改行して表示
  });


  document.getElementById("startGame").addEventListener("click", () => {
    const count = parseInt(document.getElementById("playerCount").value);
    if (isNaN(count) || count < 2 || count > 7) {
      alert("プレイヤー人数を選択してください（2〜7人）");
      document.getElementById("playerCount").focus(); // 🎯 選択欄にフォーカス
      return; // 🎯 ゲーム開始処理を中断
    }

    playerNames = [];
    for (let i = 0; i < count; i++) {
      const name = document.getElementById(`player${i}`).value || `プレイヤー${i + 1}`;
      playerNames.push(name);
    }

    shuffle(playerNames);

    // ホーム画面を非表示
    document.getElementById("homeScreen").style.display = "none";

    // 順番表示  
    const orderDisplay = document.getElementById("playerOrderDisplay");
    const orderText = document.getElementById("playerOrderText");
    orderText.textContent = "プレイヤー順：\n" + playerNames.join(" → ");
    orderDisplay.style.display = "block";
  });

  document.getElementById("confirmOrderButton").addEventListener("click", () => {
    // 順番表示を非表示
    document.getElementById("playerOrderDisplay").style.display = "none";

    //ゲーム画面を表示
    document.getElementById("gameScreen").style.display = "block";

    nextPlayerButton = document.getElementById("nextPlayerButton");
    turnInfo = document.getElementById("turnInfo");

    const count = playerNames.length;

    setupPlayers(count, gameScreen, playerNames);
    updateTurnDisplay(getState().currentPlayer, turnInfo, nextPlayerButton);

    const { physicsWorld } = initPhysics();

    diceInit = init3DDice({
      canvas,
      physicsWorld,
      rigidBodies,
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
      onDiceStop: (diceValue) => {
        // 出目が確定したらここが呼ばれる！
        const turnInfo = document.getElementById("turnInfo");
        const nextPlayerButton = document.getElementById("nextPlayerButton");

        const updatedPlayer = movePlayer(diceValue, getCurrentPlayer(), (cp) => {
          setCurrentPlayer(cp);
        });

        setCurrentPlayer(updatedPlayer);
        updateTurnDisplay(updatedPlayer, turnInfo, nextPlayerButton);

        nextPlayerButton.style.display = "block"; // 次のターンへ
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

    // カメラとレンダラーのサイズを canvas に合わせて設定
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    animate(renderer, scene, camera, rigidBodies, physicsWorld); // 毎フレーム更新

      // ボタンを押したらサイコロを振れるようにする
      nextPlayerButton.addEventListener("click", () => {
        nextPlayerButton.style.display = "none";
        const players = getPlayers(); 
        const playerIndex = getCurrentPlayer();
        turnInfo.textContent = `${players[playerIndex].name}はサイコロを振ってください`;
        setCanRoll(true);       // ← サイコロに触れていい
        setCanJudgeDice(false); // ← 出目判定はまだダメ！
      });
    });

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
    if (!camera || !renderer) return;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  });
}

//プレイヤーの順番をシャッフル
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
