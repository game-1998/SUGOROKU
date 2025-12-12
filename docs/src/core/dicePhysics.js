import { loadDiceFace } from './diceEnvironment.js';
import { RoundedBoxGeometry } from '../libs/three/geometries/RoundedBoxGeometry.js';

// サイコロを物理オブジェクトとして登録
export function createDice(scene, physicsWorld, loader) {
  const size = 1;
  const diceGeometry = new RoundedBoxGeometry(size, size, size, 4, 0.2);
  const diceMaterials = [
    loadDiceFace("images/dice1.png", loader),
    loadDiceFace("images/dice6.png", loader),
    loadDiceFace("images/dice3.png", loader),
    loadDiceFace("images/dice4.png", loader),
    loadDiceFace("images/dice2.png", loader),
    loadDiceFace("images/dice5.png", loader)
  ]; // 画像付き材質
  const dice = new THREE.Mesh(diceGeometry, diceMaterials);
  scene.add(dice);

  const shape = new Ammo.btBoxShape(new Ammo.btVector3(size / 2, size / 2, size / 2));
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(0, 7, 0)); // 高い位置から落とす

  const mass = 10;
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);

  const motionState = new Ammo.btDefaultMotionState(transform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const diceBody = new Ammo.btRigidBody(rbInfo);
  diceBody.setRestitution(0.9); // 反発係数
  physicsWorld.addRigidBody(diceBody);

  diceBody.setActivationState(Ammo.DISABLE_DEACTIVATION);

  return { mesh: dice, body: diceBody };
}

// サイコロの静止判定
export function isDiceStopped(diceBody) {
  const linear = diceBody.getLinearVelocity();
  const angular = diceBody.getAngularVelocity();

  const linearSpeed = Math.sqrt(linear.x() ** 2 + linear.y() ** 2 + linear.z() ** 2);
  const angularSpeed = Math.sqrt(angular.x() ** 2 + angular.y() ** 2 + angular.z() ** 2);

  return linearSpeed < 0.05 && angularSpeed < 0.05;
}