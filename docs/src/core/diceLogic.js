// 出目の判定
export function getDiceValueFromRotation(quaternion) {
  const up = new THREE.Vector3(0, 1, 0);

  // サイコロの各面の法線（ローカル座標）
  const faces = [
    { value: 1, normal: new THREE.Vector3(1, 0, 0) },   // +X
    { value: 6, normal: new THREE.Vector3(-1, 0, 0) },  // -X
    { value: 3, normal: new THREE.Vector3(0, 1, 0) },   // +Y
    { value: 4, normal: new THREE.Vector3(0, -1, 0) },  // -Y
    { value: 2, normal: new THREE.Vector3(0, 0, 1) },   // +Z
    { value: 5, normal: new THREE.Vector3(0, 0, -1) },  // -Z
  ];

  let bestValue = null;
  let bestDot = -Infinity;

  faces.forEach(face => {
    const worldNormal = face.normal.clone().applyQuaternion(quaternion);
    const dot = worldNormal.dot(up); // 上向き度合い

    if (dot > bestDot) {
      bestDot = dot;
      bestValue = face.value;
    }
  });

  return bestValue;
}
