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

// 毎フレーム物理演算を更新
export function animate(renderer, scene, camera, rigidBodies, physicsWorld) {
  function loop() {
    requestAnimationFrame(loop);

    physicsWorld.stepSimulation(1 / 60, 10);

    rigidBodies.forEach(obj => {
      const ms = obj.body.getMotionState();
      if (ms) {
        const transform = new Ammo.btTransform();
        ms.getWorldTransform(transform);
        const origin = transform.getOrigin();
        const rotation = transform.getRotation();
        obj.mesh.position.set(origin.x(), origin.y(), origin.z());
        obj.mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
      }
    });

  renderer.render(scene, camera);
  }

  loop(); // ← 毎フレーム更新開始
}