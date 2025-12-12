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
    diceMeshes,
    diceBodies
  } = createDiceEnvironment({ canvas, loader, physicsWorld, rigidBodies });

  setupDiceController({
    canvas,
    scene,
    camera,
    renderer,
    physicsWorld,
    rigidBodies,
    canRollRef,
    canJudgeDiceRef,
    onDiceStop,
    onPointerRelease,
    isDraggingRef
  });

  return { diceMeshes, diceBodies, scene, renderer, camera, canJudgeDiceRef, onDiceStop };
}
