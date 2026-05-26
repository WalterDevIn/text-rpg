import {
  CHARACTER_BACKGROUNDS,
  CHARACTER_CLASSES,
  CHARACTER_RACES,
  DEFAULT_CHARACTER_DRAFT,
  WIZARD_SPELLBOOK_OPTIONS,
  getClassById,
  normalizeCharacterDraft,
} from "../../content/characters/characterOptions.js";

export function renderCharacterCreationScreen(layer, { draft = DEFAULT_CHARACTER_DRAFT, onBack, onCreate } = {}) {
  let safeDraft = normalizeCharacterDraft(draft);
  const classDefinition = getClassById(safeDraft.classId);
  const requiredSpellCount = classDefinition.spellbookPickCount ?? 6;

  layer.innerHTML = `
    <section class="screen-panel character-creation-panel" role="dialog" aria-label="Creación de personaje">
      <h1 class="screen-title">Personaje</h1>
      <p class="screen-subtitle">Humano · Ermitaño · Mago</p>

      <div class="screen-form character-grid">
        <label class="screen-field character-name-field">
          Nombre
          <input class="screen-input" data-field="name" value="${escapeHtml(safeDraft.name)}" maxlength="32" />
        </label>

        <label class="screen-field">
          Raza
          <select class="screen-select" data-field="raceId">
            ${renderOptions(CHARACTER_RACES, safeDraft.raceId)}
          </select>
        </label>

        <label class="screen-field">
          Trasfondo
          <select class="screen-select" data-field="backgroundId">
            ${renderOptions(CHARACTER_BACKGROUNDS, safeDraft.backgroundId)}
          </select>
        </label>

        <label class="screen-field">
          Clase
          <select class="screen-select" data-field="classId">
            ${renderOptions(CHARACTER_CLASSES, safeDraft.classId)}
          </select>
        </label>
      </div>

      <div class="creation-section">
        <h2>Equipo inicial</h2>
        <div class="creation-choice-list">
          ${renderEquipmentChoices(classDefinition, safeDraft)}
        </div>
      </div>

      <div class="creation-section">
        <h2>Libro de conjuros</h2>
        <p class="creation-hint">Saeta de fuego, Luces danzantes y Contacto electrizante quedan fijos como trucos. Elegí ${requiredSpellCount} conjuros para inscribir en el libro.</p>
        <div class="spellbook-grid" data-spellbook-grid>
          ${renderSpellOptions(safeDraft)}
        </div>
        <p class="creation-counter" data-spell-counter></p>
      </div>

      <div class="screen-actions">
        <button class="screen-button" data-action="create">Entrar al juego</button>
        <button class="screen-button" data-action="back">Volver</button>
      </div>
    </section>
  `;

  const updateCounter = () => updateSpellCounter(layer, requiredSpellCount);
  const createButton = layer.querySelector(`[data-action="create"]`);
  const backButton = layer.querySelector(`[data-action="back"]`);

  layer.querySelectorAll(`[data-spell-id]`).forEach((input) => {
    input.addEventListener("change", () => {
      limitSpellSelection(layer, input, requiredSpellCount);
      updateCounter();
    });
  });

  layer.querySelectorAll(`[data-field="raceId"], [data-field="backgroundId"], [data-field="classId"]`).forEach((select) => {
    select.addEventListener("change", () => {
      // Por ahora sólo hay una opción disponible por categoría; se deja la estructura lista para ampliar.
      safeDraft = readDraft(layer);
    });
  });

  createButton?.addEventListener("click", () => {
    const data = readDraft(layer);
    const selectedCount = data.spellbookSpellIds.length;

    if (selectedCount !== requiredSpellCount) {
      updateSpellCounter(layer, requiredSpellCount, true);
      return;
    }

    onCreate?.(data);
  });

  backButton?.addEventListener("click", () => onBack?.());
  updateCounter();
}

function renderOptions(options, selectedId) {
  return options.map((entry) => {
    const selected = entry.id === selectedId ? "selected" : "";
    const disabled = entry.available === false ? "disabled" : "";
    return `<option value="${escapeHtml(entry.id)}" ${selected} ${disabled}>${escapeHtml(entry.name)}</option>`;
  }).join("");
}

function renderEquipmentChoices(classDefinition, draft) {
  return (classDefinition.equipmentChoices ?? []).map((choice) => {
    const selected = draft.equipmentChoices?.[choice.id] ?? choice.options[0]?.id;
    const buttons = choice.options.map((option) => `
      <label class="creation-radio-card">
        <input type="radio" name="equipment-${escapeHtml(choice.id)}" data-equipment-choice="${escapeHtml(choice.id)}" value="${escapeHtml(option.id)}" ${option.id === selected ? "checked" : ""} />
        <span>${escapeHtml(option.label)}</span>
      </label>
    `).join("");

    return `
      <fieldset class="creation-fieldset">
        <legend>${escapeHtml(choice.title)}</legend>
        <div class="creation-radio-grid">${buttons}</div>
      </fieldset>
    `;
  }).join("");
}

function renderSpellOptions(draft) {
  const selected = new Set(draft.spellbookSpellIds ?? []);

  return WIZARD_SPELLBOOK_OPTIONS.map((spell) => `
    <label class="spellbook-card ${selected.has(spell.id) ? "selected" : ""}">
      <input type="checkbox" data-spell-id="${escapeHtml(spell.id)}" ${selected.has(spell.id) ? "checked" : ""} />
      <span class="spellbook-card-name">${escapeHtml(spell.name)}</span>
      <span class="spellbook-card-meta">Nivel ${spell.level}</span>
      ${spell.note ? `<span class="spellbook-card-note">${escapeHtml(spell.note)}</span>` : ""}
    </label>
  `).join("");
}

function readDraft(layer) {
  const classDefinition = getClassById(layer.querySelector(`[data-field="classId"]`)?.value || DEFAULT_CHARACTER_DRAFT.classId);
  const equipmentChoices = {};

  for (const choice of classDefinition.equipmentChoices ?? []) {
    const selected = layer.querySelector(`[data-equipment-choice="${cssEscape(choice.id)}"]:checked`)?.value ?? choice.options[0]?.id;
    equipmentChoices[choice.id] = selected;
  }

  return normalizeCharacterDraft({
    name: layer.querySelector(`[data-field="name"]`)?.value?.trim() || DEFAULT_CHARACTER_DRAFT.name,
    raceId: layer.querySelector(`[data-field="raceId"]`)?.value || DEFAULT_CHARACTER_DRAFT.raceId,
    backgroundId: layer.querySelector(`[data-field="backgroundId"]`)?.value || DEFAULT_CHARACTER_DRAFT.backgroundId,
    classId: classDefinition.id,
    equipmentChoices,
    cantrips: [...(classDefinition.fixedCantrips ?? [])],
    spellbookSpellIds: Array.from(layer.querySelectorAll(`[data-spell-id]:checked`)).map((input) => input.dataset.spellId),
  });
}

function limitSpellSelection(layer, changedInput, requiredSpellCount) {
  const checked = Array.from(layer.querySelectorAll(`[data-spell-id]:checked`));

  if (checked.length <= requiredSpellCount) {
    refreshSpellCardStates(layer);
    return;
  }

  changedInput.checked = false;
  refreshSpellCardStates(layer);
}

function updateSpellCounter(layer, requiredSpellCount, forceError = false) {
  const counter = layer.querySelector(`[data-spell-counter]`);
  const createButton = layer.querySelector(`[data-action="create"]`);
  const count = layer.querySelectorAll(`[data-spell-id]:checked`).length;
  const ok = count === requiredSpellCount;

  if (counter) {
    counter.textContent = `${count}/${requiredSpellCount} conjuros elegidos`;
    counter.classList.toggle("error", forceError || !ok);
  }

  if (createButton) {
    createButton.disabled = !ok;
  }

  refreshSpellCardStates(layer);
}

function refreshSpellCardStates(layer) {
  layer.querySelectorAll(".spellbook-card").forEach((card) => {
    const input = card.querySelector(`[data-spell-id]`);
    card.classList.toggle("selected", Boolean(input?.checked));
  });
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) {
    return CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
