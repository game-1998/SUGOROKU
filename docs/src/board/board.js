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
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "0";
    board.appendChild(svg);
  }

  const cells = [];  

  // スタートセルを追加（index = "start"）
  const startCell = document.createElement('div');
  startCell.className = 'cell start';
  startCell.dataset.index = "start";

  // 専用のテキスト要素を追加
  const startLabel = document.createElement('span');
  startLabel.className = 'cellText';
  startLabel.textContent = "スタート";
  startCell.appendChild(startLabel);

  board.appendChild(startCell);
  cells.push(startCell);

  // 通常のマスを追加
  for (let i = 0; i <= maxIndex; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    board.appendChild(cell);
    cells.push(cell);
  }

  const goalCell = cells[cells.length - 1];
  goalCell.classList.add("goal");

  // 専用のテキスト要素を追加
  const goalLabel = document.createElement('span');
  goalLabel.className = 'cellText';
  goalLabel.textContent = "ゴール!";
  goalCell.appendChild(goalLabel);

  return { cells, board, svg };
}

// サイズに応じた位置を設定する関数
export function updateCellPositions(cells, board, svg){
  svg.innerHTML = ''; // 前回の線をクリア

  const positions = [];

  const sampleCell = Array.from(cells).find(c => !c.classList.contains("start"));
  const cellWidth = sampleCell.offsetWidth;
  const cellHeight = sampleCell.offsetHeight;
  const boardWidth = board.clientWidth;

  cells.forEach((cell, i) => {
    const isStart = cell.classList.contains("start");
    const isGoal = cell.classList.contains("goal");

    if (isStart) {
      // スタートセルのサイズと位置
      cell.style.width = `${cellWidth * 5}px`;
      cell.style.height = `${cellWidth}px`;
      cell.style.left = `${(boardWidth - cellWidth * 5) / 2}px`;
      cell.style.top = `22px`; // 道の上に浮かせる（調整可）
    } else if (isGoal){
      // ゴールセルのサイズと位置
      cell.style.width = `${cellWidth * 3}px`;
      cell.style.height = `${cellWidth * 2}px`;

      const x = i % 6 === 0 ? cellWidth * 1 / 2 :
                i % 6 === 1 ? boardWidth / 2 - cellWidth * 3 / 2 :
                i % 6 === 2 ? boardWidth - cellWidth * 7 / 2 :
                i % 6 === 3 ? boardWidth - cellWidth * 7 / 2 :
                i % 6 === 4 ? boardWidth / 2 - cellWidth * 3 / 2 :
                              cellWidth * 1 / 2;

      const y = i % 6 === 0 ? Math.floor(i / 6) * cellHeight * 5 + cellHeight:
                i % 6 === 1 ? Math.floor(i / 6) * cellHeight * 5 + 1.5 * cellHeight :
                i % 6 === 2 ? Math.floor(i / 6) * cellHeight * 5 + 2 * cellHeight :
                i % 6 === 3 ? Math.floor(i / 6) * cellHeight * 5 + 3.5 * cellHeight :
                i % 6 === 4 ? Math.floor(i / 6) * cellHeight * 5 + 4 * cellHeight :
                              Math.floor(i / 6) * cellHeight * 5 + 4.5 * cellHeight;

      cell.style.left = `${x}px`;
      cell.style.top = `${y}px`;
    } else {
      // サイズに応じた座標（例：ジグザグ）
      const x = i % 6 === 0 ? cellWidth * 3 / 2 :
                i % 6 === 1 ? boardWidth / 2 - cellWidth / 2 :
                i % 6 === 2 ? boardWidth - cellWidth * 5 / 2 :
                i % 6 === 3 ? boardWidth - cellWidth * 5 / 2 :
                i % 6 === 4 ? boardWidth / 2 - cellWidth / 2 :
                              cellWidth * 3 / 2;

      const y = i % 6 === 0 ? Math.floor(i / 6) * cellHeight * 5 + cellHeight:
                i % 6 === 1 ? Math.floor(i / 6) * cellHeight * 5 + 1.5 * cellHeight :
                i % 6 === 2 ? Math.floor(i / 6) * cellHeight * 5 + 2 * cellHeight :
                i % 6 === 3 ? Math.floor(i / 6) * cellHeight * 5 + 3.5 * cellHeight :
                i % 6 === 4 ? Math.floor(i / 6) * cellHeight * 5 + 4 * cellHeight :
                              Math.floor(i / 6) * cellHeight * 5 + 4.5 * cellHeight;

      cell.style.left = `${x}px`;
      cell.style.top = `${y}px`;
    }

    // 中心座標（board内の相対位置）
    const left = parseFloat(cell.style.left);
    const top = parseFloat(cell.style.top);
    const cx = left + cell.offsetWidth / 2;
    const cy = top + cell.offsetHeight / 2;

    positions.push({ cx, cy });
  });

  const paths = [];

  // 道を描く（次のcellがあれば）
  for (let i = 1; i < positions.length; i++) {

    const { cx: x1, cy: y1 } = positions[i - 1];
    const { cx: x2, cy: y2 } = positions[i];

    const isEdge = (i - 1) % 6 === 2 || (i - 1) % 6 === 5;

    // --- ① 外側のふち（恋色） ---
    const outline = document.createElementNS("http://www.w3.org/2000/svg", isEdge ? "path" : "line");
    if (isEdge) {
      const radius = Math.abs(y2 - y1) / 2;
      const sweep = (i - 1) % 6 === 2 ? 1 : 0;
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
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path" );
    if (isEdge) {
      const radius = Math.abs(y2 - y1) / 2;
      const sweep = (i - 1) % 6 === 2 ? 1 : 0;
      path.setAttribute("d", `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${sweep} ${x2} ${y2}`);
    } else {
      path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
    }
    path.setAttribute("stroke", "#f4c542ff"); // 色
    path.setAttribute("stroke-width", cellWidth / 2 * 0.8); // 線幅
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("fill", "none");
    svg.appendChild(path);
    paths.push(path);
  }
  // スクロール限界を最後のセルに合わせて制限
  const lastCell = cells[cells.length - 1];
  const cellBottom = parseFloat(lastCell.style.top) + lastCell.offsetHeight;

  let spacer = document.getElementById("boardSpacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.id = "boardSpacer";
    board.appendChild(spacer);
  }
  spacer.style.position = "absolute";
  spacer.style.top = `${cellBottom + 100}px`;
  spacer.style.height = "1px";

  const totalHeight = cellBottom + 100;
  svg.setAttribute("viewBox", `0 0 ${boardWidth} ${totalHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");

  return { positions, paths}
}
