import { updateDiceFrame } from "./diceController.js";
export let activeThrownDice = null;

let lastHitTime = 0; // ★ 連続再生防止のクールダウン
let isFirstHit = true;
const activeCollisions = new Set();

function playDiceHit(relativeSpeed) {
  const now = performance.now();
  if (now - lastHitTime < 80) return; // 50ms以内は無視
  lastHitTime = now;

  const sound = new Audio("src/sounds/dice_hit.mp3");
  // ★ 相対速度を音量に変換
  const maxSpeed = 5; // 調整可能
  let volume = relativeSpeed / maxSpeed;
  // 最初の衝突だけ補正
  if (isFirstHit) {
    volume *= 3;
    isFirstHit = false;
  }
  if (volume > 1) volume = 1;
  sound.volume = volume;
  sound.play();
}

export function rollDicePhysics(diceBody, power = 10) {
  diceBody.activate();
  const force = new Ammo.btVector3(
    (Math.random() - 0.5) * power,
    power,
    (Math.random() - 0.5) * power
  );
  diceBody.setLinearVelocity(force);

  const torque = new Ammo.btVector3(
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10
  );
  diceBody.setAngularVelocity(torque);
}

export function disableDicePhysics(obj, physicsWorld) {
  try {
    physicsWorld.removeRigidBody(obj.body);
  } catch (e) {
    console.warn("disableDicePhysics error:", e);
  }
}
export function enableDicePhysics(obj, physicsWorld) {
  try {
    physicsWorld.addRigidBody(obj.body);
  } catch (e) {
    console.warn("enableDicePhysics error:", e);
  }
}

// 物理世界を作る
export function initPhysics() {
  const collisionConfig = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfig);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfig);
  physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));

  // お椀の底面（物理的な地面）を追加
  const groundShape = new Ammo.btCylinderShape(new Ammo.btVector3(1.5, 0.05, 1.5));
  const groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  groundTransform.setOrigin(new Ammo.btVector3(0, -0.05, 0)); // お椀の底に合わせる

  const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
  const groundMass = 0; // 静的オブジェクト
  const groundLocalInertia = new Ammo.btVector3(0, 0, 0);
  const groundRbInfo = new Ammo.btRigidBodyConstructionInfo(groundMass, groundMotionState, groundShape, groundLocalInertia);
  const groundBody = new Ammo.btRigidBody(groundRbInfo);

  physicsWorld.addRigidBody(groundBody);

  return {physicsWorld, groundBody};
}

let firstFrame = true;

// 毎フレーム物理演算を更新
export function animate(renderer, scene, camera, physicsWorld, onDiceStop, canJudgeDiceRef, rigidBodies) {
  function loop() {
    requestAnimationFrame(loop);

    if (firstFrame) {
      firstFrame = false;
    }

    // 毎フレームの更新処理を呼ぶ
    updateDiceFrame({
      physicsWorld,
      scene,
      camera,
      renderer,
      onDiceStop,
      canJudgeDiceRef
    });

    // ★ activeThrownDice が null の間は衝突チェックしない
    if (activeThrownDice == null) {
      renderer.render(scene, camera);
      return;
    }

    // ★ 衝突チェック
    const dispatcher = physicsWorld.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();
    const currentFrameHits = new Set();

    for (let i = 0; i < numManifolds; i++) {
      const contactManifold = dispatcher.getManifoldByIndexInternal(i);
      const numContacts = contactManifold.getNumContacts();
      if (numContacts === 0) {
        continue;
      }

      const body0 = Ammo.castObject(contactManifold.getBody0(), Ammo.btRigidBody);
      const body1 = Ammo.castObject(contactManifold.getBody1(), Ammo.btRigidBody);

      const id0 = Ammo.getPointer(body0);
      const id1 = Ammo.getPointer(body1);

      const isDiceCollision = id0 === activeThrownDice || id1 === activeThrownDice;

      if (isDiceCollision) {
        let relativeSpeed = 0;

        try {
          const vel0 = body0.getLinearVelocity();
          const vel1 = body1.getLinearVelocity();

          const rvx = vel0.x() - vel1.x();
          const rvy = vel0.y() - vel1.y();
          const rvz = vel0.z() - vel1.z();

          relativeSpeed = Math.sqrt(rvx*rvx + rvy*rvy + rvz*rvz);
          

        } catch (e) {
          console.warn("速度取得エラー:", e);
          // 速度が取れないときは音を鳴らさずスキップ
          continue;
        }

        currentFrameHits.add(activeThrownDice);
        if (!activeCollisions.has(activeThrownDice)) {
          playDiceHit(relativeSpeed);
          activeCollisions.add(activeThrownDice);
        }
      }
    }

    // ★ 今フレームで衝突していないなら解除
    if (!currentFrameHits.has(activeThrownDice)) {
      activeCollisions.delete(activeThrownDice);
    }
    renderer.render(scene, camera);
  }
  
  loop(); // ← 毎フレーム更新開始
}

export function setActiveThrownDice(id) {
  activeThrownDice = id;
  isFirstHit = true;
}