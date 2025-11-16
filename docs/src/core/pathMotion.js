/**
 * コマをSVGパスに沿って滑らかに移動させる
 * @param {HTMLElement} piece - 移動させるコマのDOM要素
 * @param {SVGPathElement} path - SVGのpath要素
 * @param {number} startLength - 移動開始位置（パス上の長さ）
 * @param {number} endLength - 移動終了位置（パス上の長さ）
 * @param {number} duration - アニメーション時間（ミリ秒）
 * @returns {Promise} - 移動完了後にresolveされるPromise
 */
export function movePieceAlongPath(piece, path, board, startLength, endLength, duration) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const svg = path.ownerSVGElement;

    function animate(time) {
      if (!piece || !path || !svg) {
        console.warn("アニメーション対象が見つかりません。中断します。");
        console.log("piece:", piece);
        console.log("path:", path);
        console.log("svg:", svg);
        resolve();
        return;
      }
      const elapsed = time - startTime;
      const ratio = Math.min(elapsed / duration, 1);
      const currentLength = startLength + (endLength - startLength) * ratio;

      // SVGローカル座標を取得
      const point = path.getPointAtLength(currentLength);

      // SVG座標 → DOM座標に変換
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = point.x;
      svgPoint.y = point.y;
      const domPoint = svgPoint.matrixTransform(svg.getScreenCTM());

      const boardRect = board.getBoundingClientRect();
      const scrollY = board.scrollTop;
      const correctedX = domPoint.x - boardRect.left;
      const correctedY = domPoint.y - boardRect.top + scrollY;

      const pieceWidth = piece.offsetWidth;
      const pieceHeight = piece.offsetHeight;

      piece.style.left = `${correctedX - pieceWidth / 2}px`;
      piece.style.top = `${correctedY - pieceHeight / 2}px`;

      if (ratio < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}
