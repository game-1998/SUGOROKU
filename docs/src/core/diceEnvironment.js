import { createDice } from './dicePhysics.js';

export function createDiceEnvironment({ canvas, loader, physicsWorld, rigidBodies }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setClearColor(0x000000, 1); // 黒背景、不透明


  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(90, (width / 2) / height, 0.1, 1000);
  camera.position.set(0, 12, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);
  
  const { dice, diceBody } = createDice(scene, physicsWorld, rigidBodies, loader);
  dice.position.set(0, 5, 0);
  scene.add(dice);

  const light = new THREE.PointLight(0xffffff, 2);
  light.position.set(0, 10, 0);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 3));

  const spot = new THREE.SpotLight(0xffffff, 100, 150, Math.PI / 3, 2);
  spot.position.set(7, 10, 7); // 斜め上から照らす
  spot.target.position.set(-5, 0, -5); 
  scene.add(spot);
  scene.add(spot.target);

  const texture = loader.load("images/bowl_texture.png");
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.needsUpdate = true;

  //お椀形状の作成
  const points = [];
  for (let i = 0; i <= 20; i++) {
    const angle = (i / 40) * Math.PI; // 0〜π/2
    const radius = Math.sin(angle) * 5; // 底が狭く、上が広い
    const y = 5 - Math.cos(angle) * 5;      // 深さ方向
    points.push(new THREE.Vector2(radius, y));
  }


  const bowlGeometry = new THREE.LatheGeometry(points, 64);
  const bowlMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.35,
    metalness: 0.7,
    side: THREE.DoubleSide
  });
  const bowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
  scene.add(bowl);

  const triangleMesh = new Ammo.btTriangleMesh();
  const vertices = bowlGeometry.attributes.position.array;

  if (!bowlGeometry.index) {
    console.warn("⚠️ bowlGeometry.index is null — skipping mesh creation");
    return;
  }

  const indices = bowlGeometry.index.array;

  function triangleArea(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]
    ];
    const area = Math.sqrt(cross[0]**2 + cross[1]**2 + cross[2]**2) / 2;

    return area;
  }

  for (let i = 0; i < indices.length; i += 3) {
    const idx0 = indices[i] * 3;
    const idx1 = indices[i + 1] * 3;
    const idx2 = indices[i + 2] * 3;

    const v0arr = [vertices[idx0], vertices[idx0 + 1], vertices[idx0 + 2]];
    const v1arr = [vertices[idx1], vertices[idx1 + 1], vertices[idx1 + 2]];
    const v2arr = [vertices[idx2], vertices[idx2 + 1], vertices[idx2 + 2]];

    if (![...v0arr, ...v1arr, ...v2arr].every(isValid)) {
      console.error(`❌ Invalid triangle at ${i / 3}`, { v0arr, v1arr, v2arr });
      continue;
    }

    if (triangleArea(v0arr, v1arr, v2arr) < 1e-6) {
      console.warn(`⚠️ Skipping zero-area triangle at ${i / 3}`);
      continue;
    }

    const v0 = new Ammo.btVector3(...v0arr);
    const v1 = new Ammo.btVector3(...v1arr);
    const v2 = new Ammo.btVector3(...v2arr);

    triangleMesh.addTriangle(v0, v1, v2, true);
    Ammo.destroy(v0); Ammo.destroy(v1); Ammo.destroy(v2);
  }

  if (indices.length === 0 || vertices.length === 0) {
    console.warn("⚠️ bowlGeometry has no geometry — skipping physics shape");
  } else {
    const shape = new Ammo.btBvhTriangleMeshShape(triangleMesh, true, true);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
    const motionState = new Ammo.btDefaultMotionState(transform);
    const body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0)));
    physicsWorld.addRigidBody(body);
  }

  return { scene, camera, renderer, diceMesh: dice, diceBody };
}

export function loadDiceFace(path, loader) {
  const texture = loader.load(path);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = 0;
  texture.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: texture });
}

function isValid(v) {
  return Number.isFinite(v) && !Number.isNaN(v);
}
