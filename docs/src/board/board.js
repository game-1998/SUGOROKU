export function generateBoard(maxIndex) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  // SVGレイヤーがなければ追加
  let svg = document.getElementById('pathLayer');
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "pathLayer");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "0";
    board.appendChild(svg);
  }

  const cells = [];

  // まずcellを生成してDOMに追加
  for (let i = 0; i <= maxIndex; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.textContent = i;
    board.appendChild(cell);
    cells.push(cell);
  }
  return { cells, board, svg };
}

// サイズに応じた位置を設定する関数
export function updateCellPositions(cells, board, svg){
  svg.innerHTML = ''; // 前回の線をクリア

  svg.style.top = "0px";

  const positions = [];

  const sampleCell = cells[0];
  const cellWidth = sampleCell.offsetWidth;
  const cellHeight = sampleCell.offsetHeight;
  const boardWidth = board.clientWidth;

  cells.forEach((cell, i) => {
    console.log(`cell ${i}: offsetWidth=${cell.offsetWidth}, offsetHeight=${cell.offsetHeight}`);

    // サイズに応じた座標（例：ジグザグ）
    const x = i % 6 === 0 ? cellWidth * 3 / 2 :
              i % 6 === 1 ? boardWidth / 2 - cellWidth / 2 :
              i % 6 === 2 ? boardWidth - cellWidth * 5 / 2 :
              i % 6 === 3 ? boardWidth - cellWidth * 5 / 2 :
              i % 6 === 4 ? boardWidth / 2 - cellWidth / 2 :
                            cellWidth * 3 / 2;

    const y = i % 6 === 0 ? Math.floor(i / 6) * cellHeight * 5 :
              i % 6 === 1 ? Math.floor(i / 6) * cellHeight * 5 + 0.5 * cellHeight :
              i % 6 === 2 ? Math.floor(i / 6) * cellHeight * 5 + 1 * cellHeight :
              i % 6 === 3 ? Math.floor(i / 6) * cellHeight * 5 + 2.5 * cellHeight :
              i % 6 === 4 ? Math.floor(i / 6) * cellHeight * 5 + 3 * cellHeight :
                            Math.floor(i / 6) * cellHeight * 5 + 3.5 * cellHeight;

    cell.style.left = `${x}px`;
    cell.style.top = `${y}px`;
    console.log(`cell ${i}: style.left=${cell.style.left}, style.top=${cell.style.top}`);

    // 中心座標（board内の相対位置）
    const left = parseFloat(cell.style.left);
    const top = parseFloat(cell.style.top);
    const cx = left + cell.offsetWidth / 2;
    const cy = top + cell.offsetHeight / 2;

    positions.push({ cx, cy });
  });

  // 道を描く（次のcellがあれば）
  for (let i = 1; i < positions.length; i++) {
    const { cx: x1, cy: y1 } = positions[i - 1];
    const { cx: x2, cy: y2 } = positions[i];

    const isEdge = (i - 1) % 6 === 2 || (i - 1) % 6 === 5;

    // --- ① 外側のふち（恋色） ---
    const outline = document.createElementNS("http://www.w3.org/2000/svg", isEdge ? "path" : "line");
    if (isEdge) {
      const radius = Math.abs(x2 - x1) / 2;
      const sweep = y1 < y2 ? 1 : 0;
      outline.setAttribute("d", `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${sweep} ${x2} ${y2}`);
    } else {
      outline.setAttribute("x1", x1);
      outline.setAttribute("y1", y1);
      outline.setAttribute("x2", x2);
      outline.setAttribute("y2", y2);
    }
    outline.setAttribute("stroke", "#000000"); // 色
    outline.setAttribute("stroke-width", cellWidth / 2); // 線幅
    outline.setAttribute("stroke-linecap", "round");
    outline.setAttribute("fill", "none");  svg.appendChild(outline);

    // --- ② 内側の道（灰色） ---
    const path = document.createElementNS("http://www.w3.org/2000/svg", isEdge ? "path" : "line");
    if (isEdge) {
      const radius = Math.abs(x2 - x1) / 2;
      const sweep = y1 < y2 ? 1 : 0;
      path.setAttribute("d", `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${sweep} ${x2} ${y2}`);
    } else {
      path.setAttribute("x1", x1);
      path.setAttribute("y1", y1);
      path.setAttribute("x2", x2);
      path.setAttribute("y2", y2);
    }
    path.setAttribute("stroke", "#f4c542ff"); // 色
    path.setAttribute("stroke-width", cellWidth / 2 * 0.8); // 線幅
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("fill", "none");
    svg.appendChild(path);
  }
  // スクロール限界を最後のセルに合わせて制限
  const lastCell = cells[cells.length - 1];
  const cellBottom = parseFloat(lastCell.style.top) + lastCell.offsetHeight;

  console.log(`lastCell.style.top=${lastCell.style.top}, offsetHeight=${lastCell.offsetHeight}`);
  console.log(`cellBottom=${cellBottom}`);

  let spacer = document.getElementById("boardSpacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.id = "boardSpacer";
    board.appendChild(spacer);
  }
  spacer.style.position = "absolute";
  spacer.style.top = `${cellBottom + 100}px`;
  spacer.style.height = "1px";

  svg.setAttribute("height", cellBottom + 100);
  svg.style.height = `${cellBottom + 100}px`;

  console.log(`board.scrollHeight=${board.scrollHeight}, board.clientHeight=${board.clientHeight}`);
}
