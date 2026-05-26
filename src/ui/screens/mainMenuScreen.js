export function renderMainMenuScreen(layer, { canContinue = false, onNewGame, onContinue, onOptions } = {}) {
  layer.innerHTML = `
    <section class="screen-panel" role="dialog" aria-label="Menú principal">
      <h1 class="screen-title">Rogue Canvas</h1>
      <p class="screen-subtitle">Mazmorras · bosque · D&D</p>
      <div class="screen-actions">
        <button class="screen-button" data-action="new-game">Nueva partida</button>
        <button class="screen-button" data-action="continue" ${canContinue ? "" : "disabled"}>Continuar</button>
        <button class="screen-button" data-action="options">Opciones</button>
      </div>
    </section>
  `;

  bind(layer, "new-game", onNewGame);
  bind(layer, "continue", onContinue);
  bind(layer, "options", onOptions);
}

function bind(layer, action, handler) {
  const button = layer.querySelector(`[data-action="${action}"]`);
  if (!button || typeof handler !== "function") return;
  button.addEventListener("click", handler);
}
