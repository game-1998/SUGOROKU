import { createDiceEnvironment } from './diceEnvironment.js';
import { setupDiceController } from './diceController.js';

export function init3DDice({
  canvas,
  physicsWorld,
  rigidBodies,
  loader,
  canRollRef,
  canJudgeDiceRef,
  onDiceStop,
  onPointerRelease,
  isDraggingRef
}) {
  const {
    scene,
    camera,
    renderer,
    diceMesh,
    diceBody
  } = createDiceEnvironment({ canvas, loader, physicsWorld, rigidBodies });

  setupDiceController({
    canvas,
    scene,
    camera,
    renderer,
    diceMesh,
    diceBody,
    physicsWorld,
    rigidBodies,
    canRollRef,
    canJudgeDiceRef,
    onDiceStop,
    onPointerRelease,
    isDraggingRef
  });

  return { diceMesh, diceBody, scene, renderer, camera };
}

function updatePlayerTurnUI(currentPlayerIndex) {
  const name = playerNames[currentPlayerIndex];
  const ui = document.getElementById("turnDisplay");
  ui.textContent = `次は ${name} の番です`;
}
