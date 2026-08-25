const POKE_API = "https://pokeapi.co/api/v2";
const NATIONAL_DEX_MAX = 386;
const CONCURRENCY = 12;
const MAX_ATTEMPTS = 3;
const WILD_METHODS = new Set(["walk", "surf", "old-rod", "good-rod", "super-rod", "rock-smash"]);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchJsonWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await delay(250 * attempt);
    }
  }
  throw lastError;
}

function fireRedWeight(encounters) {
  return encounters.reduce((total, location) => total + location.version_details
    .filter((detail) => detail.version.name === "firered")
    .reduce((locationTotal, detail) => detail.encounter_details
      .some((encounter) => WILD_METHODS.has(encounter.method.name))
      ? locationTotal + detail.max_chance
      : locationTotal, 0), 0);
}

const results = new Array(NATIONAL_DEX_MAX);
let nextId = 1;

async function worker() {
  while (nextId <= NATIONAL_DEX_MAX) {
    const id = nextId;
    nextId += 1;
    const encounters = await fetchJsonWithRetry(`${POKE_API}/pokemon/${id}/encounters`);
    const weight = fireRedWeight(encounters);
    if (weight > 0) results[id - 1] = { id, weight };
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
process.stdout.write(JSON.stringify(results.filter(Boolean)));
