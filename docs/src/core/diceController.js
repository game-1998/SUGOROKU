import { isDiceStopped } from './dicePhysics.js';
import { getDiceValueFromRotation } from './diceLogic.js';
import { setCanJudgeDice, getCurrentPlayer, getState } from '../state/gameState.js';

let hasEmittedTotal = false;
let grabCenter = null; // 円の中心（THREE.Vector3）
let grabbedDice = []; // 操作対象サイコロ
let isHolding = false;
const tmpTrans = new Ammo.btTransform();

export function setupDiceController({
  canvas, scene, camera, renderer,
  physicsWorld, rigidBodies,
  canRollRef, canJudgeDiceRef, onPointerRelease, isDraggingRef
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let swipePath = [];
  let diceStopped = false;

  canvas.addEventListener("pointerdown", (event) => {
    if (!canRollRef.value || canJudgeDiceRef.value) return;
    swipePath = [];
    hasEmittedTotal = false; // 合計発火ガードのリセット
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 全部キネマティック化
    grabbedDice.forEach(obj => {
      obj._stopped = false;
      obj._value = 0;
      const flags = obj.body.getCollisionFlags();
      obj.body.setCollisionFlags(flags | 2); // CF_KINEMATIC_OBJECT
    });
    isHolding = true;
    isDraggingRef.value = true;

    // 指の位置を取得（既存の intersectPlane ロジックを流用）
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -5);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    grabCenter = intersectPoint.clone();

    // 掴んだ瞬間に指の周囲に寄せる（円形に並べる）
    const radius = 1.2;
    grabbedDice.forEach((obj, i) => {
      const angle = (i / grabbedDice.length) * Math.PI * 2;
      const x = intersectPoint.x + Math.cos(angle) * radius;
      const z = intersectPoint.z + Math.sin(angle) * radius;
      const y = 7;

      obj.mesh.position.set(x, y, z);

      const t = new Ammo.btTransform();
      t.setIdentity();
      t.setOrigin(new Ammo.btVector3(x, y, z));
      obj.body.setWorldTransform(t);
      obj.body.getMotionState().setWorldTransform(t);
    });
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDraggingRef.value || !isHolding) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -5);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    if (grabCenter) {
      grabCenter.copy(intersectPoint);
    }

    const radius = 1.2;
    grabbedDice.forEach((obj, i) => {
      const angle = (i / grabbedDice.length) * Math.PI * 2;
      const x = grabCenter.x + Math.cos(angle) * radius;
      const z = grabCenter.z + Math.sin(angle) * radius;
      const y = 7;

      obj.mesh.position.set(x, y, z);

      const t = new Ammo.btTransform();
      t.setIdentity();
      t.setOrigin(new Ammo.btVector3(x, y, z));

      // ドラッグ中は物理速度を完全に殺す
      obj.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
      obj.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

      // transform だけ更新して位置を同期
      obj.body.setWorldTransform(t);
      obj.body.getMotionState().setWorldTransform(t);
    });

    if (isHolding) {
      swipePath.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      if (swipePath.length > 50) swipePath.shift();
    }
  });


  canvas.addEventListener("pointerup", (e) => {
    if (!isDraggingRef.value || !isHolding) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    grabbedDice.forEach(obj => {
      const body = obj.body;

      // キネマティック解除
      const flags = body.getCollisionFlags();
      body.setCollisionFlags(flags & ~2);
      body.setActivationState(Ammo.ACTIVE_TAG); // 物理演算再開

      const t = new Ammo.btTransform();
      t.setIdentity();
      t.setOrigin(new Ammo.btVector3(
        obj.mesh.position.x,
        obj.mesh.position.y - 1,
        obj.mesh.position.z
      ));
      obj.body.setWorldTransform(t);
      obj.body.getMotionState().setWorldTransform(t);

      // Ammo の transform を取得
      const ammoTransform = new Ammo.btTransform();
      body.getMotionState().getWorldTransform(ammoTransform);

      grabbedDice.forEach(other => {
        if (other === obj) return;
        const dx = other.mesh.position.x - obj.mesh.position.x;
        const dz = other.mesh.position.z - obj.mesh.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
      });

      obj._rolled = true;

      let totalVx = 0, totalVy = 0;
      if (swipePath.length >= 6) {
        for (let i = swipePath.length - 6; i < swipePath.length - 1; i++) {
          const a = swipePath[i];
          const b = swipePath[i + 1];
          totalVx += (b.x - a.x) / (b.t - a.t);
          totalVy += (b.y - a.y) / (b.t - a.t);
        }

        const holdDuration = getHoldDuration(swipePath);
        const isSwipe = holdDuration < 200;
        const normalizedDx = totalVx / canvasWidth;
        const normalizedDy = totalVy / canvasHeight;

        if (isSwipe) {
          setTimeout(() => {
            body.setAngularVelocity(new Ammo.btVector3(normalizedDy * 600, 0, -normalizedDx * 600));
            body.setLinearVelocity(new Ammo.btVector3(normalizedDx * 600, 0, normalizedDy * 600));
            body.setActivationState(Ammo.ACTIVE_TAG);
            body.activate();     
          }, 0);       
        } else {
          setTimeout(() => {
            body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
            body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
            body.setActivationState(Ammo.ACTIVE_TAG);
            body.activate();  
          }, 0);   
        }
      } else {
        const randX = (Math.random() - 0.5) * 10;
        const randZ = (Math.random() - 0.5) * 10;
        setTimeout(() => {
          body.setAngularVelocity(new Ammo.btVector3(randX, 0, randZ));
          body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
          body.setActivationState(Ammo.ACTIVE_TAG);
          body.activate();
        }, 0);   
      }
    });

    setCanJudgeDice(true);
    isHolding = false;
    isDraggingRef.value = false;
    canRollRef.value = false;

    const pointer = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    if (onPointerRelease) {
      const dx = swipePath.length >= 6 ? swipePath.at(-1).x - swipePath.at(-6).x : 0;
      const dy = swipePath.length >= 6 ? swipePath.at(-1).y - swipePath.at(-6).y : 0;

      const holdDuration = getHoldDuration(swipePath);
      const isSwipe = swipePath.length >= 6 && holdDuration < 200;
      onPointerRelease({ isSwipe, dx, dy, pointer });
    }

    swipePath = [];
    //grabbedDice = [];
  });


}

function getHoldDuration(swipePath) {
  if (swipePath.length < 2) return 0;

  const last = swipePath.at(-1);

  return performance.now() - last.t;
}

// grabbedDice を更新して表示・非表示を切り替える関数
export function updateGrabbedDice(rigidBodies, getCurrentPlayer, physicsWorld) {
  const currentPlayer = getCurrentPlayer();
  const diceCount = 1 + (currentPlayer?.diceBonus ?? 0);

  grabbedDice = rigidBodies.slice(0, diceCount);

  rigidBodies.forEach((obj, i) => {
    
    if (i < diceCount) {
      obj.mesh.visible = true;
      obj._rolled = false;

      // ターン開始時に描画位置へ移動させる
      const t = new Ammo.btTransform();
      t.setIdentity();
    } else {
      obj.mesh.visible = false;
      obj._rolled = true;
      obj._stopped = true;
      // エリア外に退避
      const t = new Ammo.btTransform();
      t.setIdentity();
      t.setOrigin(new Ammo.btVector3(0, -100, 0)); // 床の下に移動
      obj.body.setWorldTransform(t);
      obj.body.getMotionState().setWorldTransform(t);
    }
  });

  return grabbedDice;
}

export function updateDiceFrame({
  physicsWorld, scene, camera, renderer,
  canJudgeDiceRef, onDiceStop
}) {
  physicsWorld.stepSimulation(1 / 60, 10);

  // サイコロの位置・回転を mesh に反映
  grabbedDice.forEach(obj => {
    // nullや不正要素をスキップ
    if (!obj || !obj.body || !obj.mesh) return;

    // ドラッグ中のサイコロは物理更新をスキップ
    if (isHolding && grabbedDice.includes(obj)) return;

    const ms = obj.body.getMotionState();
    if (ms) {
      ms.getWorldTransform(tmpTrans);
      const origin = tmpTrans.getOrigin();
      
      const rotation = tmpTrans.getRotation();
      obj.mesh.position.set(origin.x(), origin.y(), origin.z());
      obj.mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
    }
  });

  // 停止判定は操作対象のサイコロごとに行う
  grabbedDice.forEach(obj => {
    if (!obj || !obj.body || !obj.mesh) return;
    if (!obj._rolled || obj._stopped) return;

    const dicePos = obj.mesh.position;
    const isOutOfBowl = dicePos.y < 0;

    // サイコロごとに停止判定フラグを持たせる
    if ((getState().canJudgeDice && !obj._stopped && isDiceStopped(obj.body)) && obj.mesh.position.y < 1.0 || isOutOfBowl) {
      obj._stopped = true; // このサイコロは判定済み

      let value = isOutOfBowl ? -1 : getDiceValueFromRotation(obj.mesh.quaternion);

      obj._value = value; // 出目を保存
    }
  });

  // 全サイコロが停止済みなら合計値を渡す
  const rolledDice = grabbedDice.filter(o => o._rolled);
  const allStopped = rolledDice.length > 0 && rolledDice.every(o => o._stopped);

  if (allStopped && !hasEmittedTotal) {
    const total = rolledDice.reduce((sum, o) => sum + (o._value ?? 0), 0);
    onDiceStop?.(total);
    canJudgeDiceRef.value = false;
    hasEmittedTotal = true;
  }

  renderer.render(scene, camera);
}

