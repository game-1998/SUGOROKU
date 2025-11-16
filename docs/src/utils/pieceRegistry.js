const playerPieces = new Map();

export function setPiece(playerName, piece) {
  playerPieces.set(playerName, piece);
}

export function getPiece(playerName) {
  return playerPieces.get(playerName);
}

export function clearPieces() {
  playerPieces.clear();
}

export function getAllPieces() {
  return playerPieces;
}
