const state = {
  currentPlayer: "",
  players: [],
  turnOrder: [],
  canRoll: false,
  canJudgeDice: false
};

export function getState() {
  return state;
}

export function setCurrentPlayer(name) {
  state.currentPlayer = name;
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


export function setTurnOrder(order) {
  state.turnOrder = order;
}

export function getTurnOrder() {
  return state.turnOrder;
}
