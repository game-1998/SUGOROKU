// 出目の判定
export function getDiceValueFromRotation(quaternion) {
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  const directions = [
    new THREE.Vector3(1, 0, 0),  // +X → 5
    new THREE.Vector3(-1, 0, 0), // -X → 6
    new THREE.Vector3(0, 1, 0),  // +Y → 3
    new THREE.Vector3(0, -1, 0), // -Y → 4
    new THREE.Vector3(0, 0, 1),  // +Z → 1
    new THREE.Vector3(0, 0, -1), // -Z → 2
  ];

  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i].clone().applyMatrix4(matrix);
    const dot = dir.dot(up);
    if (dot > 0.95) return [1, 6, 3, 4, 2, 5][i];
  }
  return null;
}

function nextTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % playerNames.length;
  updatePlayerTurnUI(currentPlayerIndex);
}
