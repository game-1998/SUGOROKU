import { createDiceEnvironment } from './diceEnvironment.js';
import { setupDiceController } from './diceController.js';

export function init3DDice({
  canvas,
  physicsWorld,
  rigidBodies,
  diceObjects,
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
    rigidBodies: updatedRigidBodies
  } = createDiceEnvironment({ canvas, loader, physicsWorld, rigidBodies, diceObjects });

  setupDiceController({
    canvas,
    scene,
    camera,
    renderer,
    physicsWorld,
    rigidBodies: updatedRigidBodies,
    diceObjects,
    canRollRef,
    canJudgeDiceRef,
    onDiceStop,
    onPointerRelease,
    isDraggingRef
  });

  return { scene, renderer, camera, canJudgeDiceRef, onDiceStop };
}
