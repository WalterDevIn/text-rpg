export const AppScreen = {
  MAIN_MENU: "main_menu",
  CHARACTER_CREATION: "character_creation",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
};

export const appState = {
  screen: AppScreen.MAIN_MENU,
  hasActiveSession: false,
  lastCharacterDraft: null,
};

export function setAppScreen(screen) {
  appState.screen = screen;
  return appState.screen;
}

export function isGameRunningScreen() {
  return appState.screen === AppScreen.PLAYING;
}

export function isGameSuspendedScreen() {
  return appState.screen === AppScreen.PAUSED || appState.screen === AppScreen.MAIN_MENU || appState.screen === AppScreen.CHARACTER_CREATION;
}
