let injected = false;

export function injectScreenStyles() {
  if (injected || document.getElementById("screen-layer-styles")) {
    injected = true;
    return;
  }

  const style = document.createElement("style");
  style.id = "screen-layer-styles";
  style.textContent = `
    #screen-layer {
      position: absolute;
      inset: 0;
      z-index: 100;
      display: none;
      pointer-events: none;
      font-family: Georgia, "Times New Roman", serif;
      color: #f5f5f5;
    }

    #screen-layer.is-visible {
      display: grid;
      place-items: center;
      pointer-events: auto;
      background:
        radial-gradient(circle at 50% 35%, rgba(54, 28, 18, 0.34), rgba(0, 0, 0, 0.94) 68%),
        rgba(0, 0, 0, 0.88);
    }

    .screen-panel {
      width: min(560px, calc(100vw - 48px));
      border: 3px solid rgba(255, 255, 255, 0.88);
      border-radius: 18px;
      padding: 28px;
      background:
        linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(4, 4, 4, 0.98));
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.12) inset,
        0 18px 60px rgba(0, 0, 0, 0.8),
        0 0 36px rgba(255, 255, 255, 0.08);
    }

    .screen-title {
      margin: 0 0 6px;
      font-size: clamp(2rem, 6vw, 4rem);
      line-height: 0.95;
      letter-spacing: 0.06em;
      text-align: center;
      text-transform: uppercase;
    }

    .screen-subtitle {
      margin: 0 0 24px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.95rem;
      text-align: center;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .screen-actions {
      display: grid;
      gap: 12px;
    }

    .screen-button {
      width: 100%;
      border: 2px solid rgba(255, 255, 255, 0.86);
      border-radius: 14px;
      padding: 14px 18px;
      background: rgba(0, 0, 0, 0.68);
      color: white;
      font: inherit;
      font-size: 1.05rem;
      cursor: pointer;
      letter-spacing: 0.04em;
      text-align: center;
      transition: transform 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }

    .screen-button:hover:not(:disabled) {
      transform: translateY(-1px);
      background: white;
      color: black;
      box-shadow: 0 0 18px rgba(255, 255, 255, 0.22);
    }

    .screen-button:disabled {
      cursor: not-allowed;
      opacity: 0.38;
    }

    .screen-button.danger:hover:not(:disabled) {
      background: #a31222;
      color: white;
      border-color: #ffb3be;
    }

    .screen-form {
      display: grid;
      gap: 14px;
      margin-bottom: 22px;
    }

    .screen-field {
      display: grid;
      gap: 6px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.85rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .screen-input,
    .screen-select {
      border: 2px solid rgba(255, 255, 255, 0.82);
      border-radius: 12px;
      padding: 11px 12px;
      background: black;
      color: white;
      font: inherit;
      font-size: 1rem;
      outline: none;
    }

    .screen-input:focus,
    .screen-select:focus {
      border-color: #00ff66;
      box-shadow: 0 0 0 3px rgba(0, 255, 102, 0.16);
    }

    .character-creation-panel {
      width: min(900px, calc(100vw - 48px));
      max-height: calc(100vh - 48px);
      overflow: auto;
    }

    .character-grid {
      grid-template-columns: 1.2fr 1fr 1fr 1fr;
      align-items: end;
    }

    .character-name-field {
      min-width: 0;
    }

    .creation-section {
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 16px;
      background: rgba(255, 255, 255, 0.035);
    }

    .creation-section h2 {
      margin: 0 0 10px;
      font-size: 1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .creation-hint {
      margin: -4px 0 12px;
      color: rgba(255, 255, 255, 0.68);
      font-size: 0.85rem;
      line-height: 1.35;
    }

    .creation-choice-list {
      display: grid;
      gap: 12px;
    }

    .creation-fieldset {
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 10px;
      margin: 0;
    }

    .creation-fieldset legend {
      padding: 0 8px;
      color: rgba(255, 255, 255, 0.76);
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .creation-radio-grid,
    .spellbook-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 8px;
    }

    .creation-radio-card,
    .spellbook-card {
      display: grid;
      gap: 4px;
      min-height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 11px;
      padding: 10px 11px;
      background: rgba(0, 0, 0, 0.42);
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
    }

    .creation-radio-card:hover,
    .spellbook-card:hover {
      border-color: rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-1px);
    }

    .creation-radio-card input,
    .spellbook-card input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .creation-radio-card:has(input:checked),
    .spellbook-card.selected {
      border-color: #00ff66;
      background: rgba(0, 255, 102, 0.12);
      box-shadow: 0 0 0 1px rgba(0, 255, 102, 0.16) inset;
    }

    .spellbook-card-name {
      font-size: 0.95rem;
      color: white;
    }

    .spellbook-card-meta,
    .spellbook-card-note {
      color: rgba(255, 255, 255, 0.62);
      font-size: 0.76rem;
      line-height: 1.25;
    }

    .creation-counter {
      margin: 10px 0 0;
      color: #00ff66;
      font-size: 0.86rem;
      text-align: right;
    }

    .creation-counter.error {
      color: #ff7777;
    }

    @media (max-width: 760px) {
      .character-grid {
        grid-template-columns: 1fr;
      }
    }

  `;

  document.head.appendChild(style);
  injected = true;
}
