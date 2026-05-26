import { AppScreen, appState, setAppScreen } from "./appState.js";
import { injectScreenStyles } from "../ui/screens/screenStyles.js";
import { renderMainMenuScreen } from "../ui/screens/mainMenuScreen.js";
import { renderCharacterCreationScreen } from "../ui/screens/characterCreationScreen.js";
import { renderPauseMenuScreen } from "../ui/screens/pauseMenuScreen.js";

let screenLayer = null;
let handlers = {};

export function setupScreenManager({ layerElement, rootElement, actions = {} } = {}) {
  injectScreenStyles();
  handlers = actions;
  screenLayer = layerElement ?? document.getElementById("screen-layer") ?? createScreenLayer(rootElement);
  renderCurrentScreen();
  return screenLayer;
}

function createScreenLayer(rootElement) {
  const layer = document.createElement("div");
  layer.id = "screen-layer";
  (rootElement ?? document.body).appendChild(layer);
  return layer;
}

export function showScreen(screen, options = {}) {
  setAppScreen(screen);
  renderCurrentScreen(options);
}

export function hideScreens() {
  if (screenLayer) {
    screenLayer.innerHTML = "";
    screenLayer.classList.remove("is-visible");
  }
}

export function renderCurrentScreen(options = {}) {
  if (!screenLayer) return;

  if (appState.screen === AppScreen.PLAYING) {
    hideScreens();
    return;
  }

  screenLayer.classList.add("is-visible");

  if (appState.screen === AppScreen.MAIN_MENU) {
    renderMainMenuScreen(screenLayer, {
      canContinue: Boolean(appState.hasActiveSession),
      onNewGame: handlers.onNewGame,
      onContinue: handlers.onContinue,
      onOptions: handlers.onOptions,
    });
    return;
  }

  if (appState.screen === AppScreen.CHARACTER_CREATION) {
    renderCharacterCreationScreen(screenLayer, {
      draft: options.draft ?? appState.lastCharacterDraft ?? undefined,
      onBack: handlers.onBackToMainMenu,
      onCreate: handlers.onCreateCharacter,
    });
    return;
  }

  if (appState.screen === AppScreen.PAUSED) {
    renderPauseMenuScreen(screenLayer, {
      onResume: handlers.onResumeGame,
      onExitToMainMenu: handlers.onExitToMainMenu,
    });
    return;
  }

  screenLayer.innerHTML = "";
}
