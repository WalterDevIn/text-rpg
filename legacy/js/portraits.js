const PORTRAIT_MAX_INDEX = 8;
const PORTRAIT_EXTENSIONS = ["jpg", "png", "jpeg", "webp"];

const portraitAssignments = new Map();

export function getCreaturePortraitKey(creature) {
  if (!creature) return null;

  if (creature.portraitKey) {
    return creature.portraitKey;
  }

  if (creature.isPlayer) {
    return "jugador";
  }

  const baseName = String(creature.name ?? "criatura")
    .replace(/\s+hostil$/i, "")
    .replace(/\s+\d+$/i, "")
    .trim();

  return slugify(baseName || "criatura");
}

export function requestCreaturePortrait(creature) {
  const key = getCreaturePortraitKey(creature);

  if (!key) {
    return null;
  }

  const displayName = getCreatureDisplayNameForPortrait(creature);
  const assignment = getOrCreateAssignment(key, displayName);
  loadCurrentCandidate(assignment);

  return key;
}

export function getPortraitImage(key) {
  if (!key) {
    return null;
  }

  const assignment = portraitAssignments.get(key);

  if (!assignment) {
    return null;
  }

  loadCurrentCandidate(assignment);

  if (assignment.status === "loaded") {
    return assignment.image;
  }

  return null;
}

export function hasPortraitAttempt(key) {
  return Boolean(key && portraitAssignments.has(key));
}

function getOrCreateAssignment(key, displayName) {
  if (portraitAssignments.has(key)) {
    return portraitAssignments.get(key);
  }

  const candidates = shuffleCandidates(buildPortraitCandidates(key, displayName));
  const assignment = {
    key,
    candidates,
    index: 0,
    image: null,
    status: "idle",
  };

  portraitAssignments.set(key, assignment);
  return assignment;
}

function loadCurrentCandidate(assignment) {
  if (!assignment || assignment.status === "loading" || assignment.status === "loaded" || assignment.status === "missing") {
    return;
  }

  const url = assignment.candidates[assignment.index];

  if (!url) {
    assignment.status = "missing";
    assignment.image = null;
    return;
  }

  assignment.status = "loading";

  const image = new Image();
  image.onload = () => {
    assignment.image = image;
    assignment.status = "loaded";
  };
  image.onerror = () => {
    assignment.index += 1;
    assignment.image = null;
    assignment.status = "idle";
    loadCurrentCandidate(assignment);
  };
  image.src = url;
}

function buildPortraitCandidates(key, displayName) {
  const variants = getUniqueNameVariants(key, displayName);
  const candidates = [];

  for (const variant of variants) {
    for (let i = 1; i <= PORTRAIT_MAX_INDEX; i++) {
      for (const extension of PORTRAIT_EXTENSIONS) {
        candidates.push(`imagenes/${variant}/${variant}${i}.${extension}`);
        candidates.push(`imagenes/${variant}${i}.${extension}`);
      }
    }
  }

  return [...new Set(candidates)];
}

function getUniqueNameVariants(key, displayName) {
  const slug = slugify(displayName ?? key);
  const compact = slug.replace(/_/g, "");
  const rawKey = slugify(key);
  const rawCompact = rawKey.replace(/_/g, "");

  return [...new Set([rawKey, rawCompact, slug, compact].filter(Boolean))];
}

function getCreatureDisplayNameForPortrait(creature) {
  if (!creature) return "criatura";

  if (creature.portraitName) {
    return creature.portraitName;
  }

  if (creature.isPlayer) {
    return "jugador";
  }

  return String(creature.name ?? "criatura")
    .replace(/\s+hostil$/i, "")
    .replace(/\s+\d+$/i, "")
    .trim();
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function shuffleCandidates(candidates) {
  const copy = [...candidates];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
