import { isDiceStopped } from './dicePhysics.js';
import { getDiceValueFromRotation } from './diceLogic.js';
import { pointerIsNearDice } from '../input/diceInput.js';
import { setCanJudgeDice } from '../state/gameState.js';

export function setupDiceController({
  canvas, scene, camera, renderer, diceMesh, diceBody,
  physicsWorld, rigidBodies,
  canRollRef, canJudgeDiceRef, onPointerRelease, onDiceStop, isDraggingRef
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let isHolding = false;
  let swipePath = [];
  let diceStopped = false;
  const tmpTrans = new Ammo.btTransform();

  canvas.addEventListener("pointerdown", (event) => {
    if (!canRollRef.value || canJudgeDiceRef.value) return;
    swipePath = [];
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(diceMesh);
    if (intersects.length > 0 || pointerIsNearDice(pointer, diceMesh, camera)) {
      diceBody.setCollisionFlags(diceBody.getCollisionFlags() | 2); // ← ここで初めてON！
      isHolding = true;
      isDraggingRef.value = true;
      diceStopped = false;

      // サイコロの位置を1回だけ更新（タップでも上空に持ち上げる）
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -5);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);

      diceMesh.position.set(intersectPoint.x, 5, intersectPoint.z);
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(intersectPoint.x, 7, intersectPoint.z));
      diceBody.setWorldTransform(transform);
      diceBody.getMotionState().setWorldTransform(transform);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDraggingRef.value || !isHolding) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -5);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    diceMesh.position.set(intersectPoint.x, 5, intersectPoint.z);
    // 物理ボディも追従させる
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(intersectPoint.x, 7, intersectPoint.z));
    diceBody.setWorldTransform(transform);
    diceBody.getMotionState().setWorldTransform(transform);

    if (isHolding){
      swipePath.push({ x: pointer.x, y: pointer.y, t: performance.now() });
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

    diceBody.setCollisionFlags(diceBody.getCollisionFlags() & ~2); // キネマティック解除
    diceBody.setActivationState(Ammo.ACTIVE_TAG); // 物理演算再開

    isHolding = false;
    isDraggingRef.value = false;
    canRollRef.value = false;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(
        diceMesh.position.x,
        diceMesh.position.y,
        diceMesh.position.z
    ));

    diceBody.setWorldTransform(transform);
    diceBody.getMotionState().setWorldTransform(transform);

    diceBody.setActivationState(Ammo.ACTIVE_TAG); // 物理演算再開
    
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

      if (isSwipe){
        setTimeout(() => {
          diceBody.setAngularVelocity(new Ammo.btVector3(-normalizedDy * 100000, 0, -normalizedDx * 100000));
          diceBody.setLinearVelocity(new Ammo.btVector3(normalizedDx * 100000, 0, -normalizedDy * 100000)); 
          diceBody.setActivationState(Ammo.ACTIVE_TAG);
          diceBody.activate();
          setCanJudgeDice(true);
        }, 0);
      }else {
        // 無回転落下（静止判定）
        diceBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
        diceBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        diceBody.setActivationState(Ammo.ACTIVE_TAG);
        diceBody.activate();
        setCanJudgeDice(true);
      }
    }else {
      // タップとみなしてランダム回転＋落下
      const randX = (Math.random() - 0.5) * 10;
      const randZ = (Math.random() - 0.5) * 10;
      diceBody.setAngularVelocity(new Ammo.btVector3(randX, 0, randZ));
      diceBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
      diceBody.setActivationState(Ammo.ACTIVE_TAG);
      diceBody.activate();
      setCanJudgeDice(true);
    }

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
  });

  function animate() {
    requestAnimationFrame(animate);
    physicsWorld.stepSimulation(1 / 60, 10);

    rigidBodies.forEach(obj => {
      if (obj.body === diceBody && isDraggingRef.value) return;
      const ms = obj.body.getMotionState();
      if (ms) {
        ms.getWorldTransform(tmpTrans);
        const origin = tmpTrans.getOrigin();
        const rotation = tmpTrans.getRotation();
        obj.mesh.position.set(origin.x(), origin.y(), origin.z());
        obj.mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
      }
    });

    const dicePos = diceMesh.position;
    const isOutOfBowl = dicePos.y < 0;
    if (canJudgeDiceRef.value && !diceStopped && isDiceStopped(diceBody) || isOutOfBowl) {
      diceStopped = true;
      canJudgeDiceRef.value = false;
      let value = isOutOfBowl ? -1 : getDiceValueFromRotation(diceMesh.quaternion);
      if (isOutOfBowl) {
        diceMesh.position.set(0, 5, 0);
        diceMesh.quaternion.set(0, 0, 0, 1);
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(0, 5, 0));
        transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        diceBody.setWorldTransform(transform);

        setTimeout(() => {
            diceBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
            diceBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));   
        }, 0);

      }

      if (onDiceStop) {
        onDiceStop(value);
      }
    }

    renderer.render(scene, camera);
  }

  animate(); // 毎フレーム更新開始
}


function getHoldDuration(swipePath) {
  if (swipePath.length < 2) return 0;

  const last = swipePath.at(-1);

  return performance.now() - last.t;
}
