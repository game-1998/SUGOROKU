// サイコロホールドの近接判定
export function pointerIsNearDice(pointer, dice, camera) {
  const dicePosition = dice.position.clone();
  dicePosition.project(camera); // 3D座標 → 2Dスクリーン座標に変換

  const dx = pointer.x - dicePosition.x;
  const dy = pointer.y - dicePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance < 0.2; // ← 判定の甘さ（0.2なら少しズレてもOK）
}