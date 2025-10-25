const state = {
  currentPlayer: 0,
  players: [],
  canRoll: false,
  canJudgeDice: false
};

export function getState() {
  return state;
}

export function setCurrentPlayer(index) {
  state.currentPlayer = index;
}

export function setCanRoll(value) {
  state.canRoll = value;
}

export function setCanJudgeDice(value) {
  state.canJudgeDice = value;
}

export function getCurrentPlayer() {
  return state.currentPlayer;
}

export function setPlayers(playerList) {
  state.players = playerList;
}

export function getPlayers() {
  return state.players;
}
