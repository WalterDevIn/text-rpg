export function renderPauseMenuScreen(layer, { onResume, onExitToMainMenu } = {}) {
  layer.innerHTML = `
    <section class="screen-panel" role="dialog" aria-label="Menú de pausa">
      <h1 class="screen-title">Pausa</h1>
      <p class="screen-subtitle">Sesión suspendida</p>
      <div class="screen-actions">
        <button class="screen-button" data-action="resume">Continuar</button>
        <button class="screen-button danger" data-action="exit">Salir al menú principal</button>
      </div>
    </section>
  `;

  layer.querySelector(`[data-action="resume"]`)?.addEventListener("click", () => onResume?.());
  layer.querySelector(`[data-action="exit"]`)?.addEventListener("click", () => onExitToMainMenu?.());
}
