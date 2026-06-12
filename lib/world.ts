// Deterministic world layout generated from a seeded RNG so the forest is the
// same on every visit.

export type Placement = {
  file: string;
  size: number;
  by?: "y" | "xz";
  align?: "bottom" | "flush";
  pos: [number, number, number];
  rot: number;
};

export type TreeDef = {
  id: string;
  file: string;
  size: number;
  pos: [number, number, number];
  rot: number;
  r: number; // collider radius
};

export type Collectible = {
  id: string;
  file: string;
  size: number;
  pos: [number, number, number];
  rot: number;
  kind: "mushroom" | "flower";
  label: string;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(1337);
const rand = (min: number, max: number) => min + rng() * (max - min);

// the river runs north-south at x ~ 30
export const RIVER_X = 30;
export const RIVER_WIDTH = 7;
export const GLADE_RADIUS = 14;
export const CAMPFIRE_POS: [number, number, number] = [3, 0, -2];
export const BRIDGE_Z = 0;

export type ShopId = "trader" | "armoury" | "tailor" | "medbay" | "exchange";

export const BUILDINGS: { id: ShopId; label: string; pos: [number, number, number] }[] = [
  { id: "trader", label: "🛖 Trading Post", pos: [-5, 0, 4] },
  { id: "armoury", label: "⚔️ Armoury", pos: [-9, 0, -5] },
  { id: "tailor", label: "🧵 Tailor", pos: [3, 0, 9] },
  { id: "medbay", label: "🏥 Med-Bay", pos: [9, 0, 3] },
  { id: "exchange", label: "⚖️ Exchange", pos: [-2, 0, -9] },
];

// gaps in the glade fence: east (path), south (meadow), north (grove),
// west (the homestead gate sits in this one)
const FENCE_GAPS = [
  { a: 0, half: 0.6 },
  { a: Math.PI / 2, half: 0.5 },
  { a: (3 * Math.PI) / 2, half: 0.5 },
  { a: Math.PI, half: 0.45 },
];

function inFenceGap(angle: number) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return FENCE_GAPS.some((g) => {
    let d = Math.abs(a - g.a);
    d = Math.min(d, Math.PI * 2 - d);
    return d < g.half;
  });
}

function blocked(x: number, z: number) {
  // keep clear: glade centre, the east path corridor, and the river banks
  if (Math.hypot(x, z) < GLADE_RADIUS + 2) return true;
  if (Math.abs(z - BRIDGE_Z) < 5 && x > 0 && x < 45) return true;
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 2) return true;
  return false;
}

const TREE_FILES = ["PP_Tree_02", "PP_Tree_10", "PP_Birch_Tree_05", "PP_Birch_Tree_06"];
const ROCK_FILES = ["PP_Rock_Moss_Grown_09", "PP_Rock_Moss_Grown_11"];
const ROCK_PILES = ["PP_Rock_Pile_Forest_Moss_05", "PP_Rock_Pile_Forest_Moss_10"];
const GRASS = ["PP_Grass_11", "PP_Grass_15"];
const PEBBLES = ["PP_Cemetery_Pebbles_03", "PP_Cemetery_Pebbles_09"];

export const TREES: TreeDef[] = [];
export const ROCKS: TreeDef[] = []; // mineable — same shape as trees
export const DECOR: Placement[] = [];

// static circle colliders (rocks, mountains, camp objects, fences)
export const COLLIDERS: { x: number; z: number; r: number }[] = [];

let treeId = 0;
function addTree(x: number, z: number, size: number) {
  TREES.push({
    id: `tree-${treeId++}`,
    file: TREE_FILES[Math.floor(rng() * TREE_FILES.length)],
    size,
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
    r: Math.max(0.7, size * 0.13),
  });
}

// forest trees — denser ring around the glade, scattered out to the edge
for (let i = 0; i < 110; i++) {
  const angle = rand(0, Math.PI * 2);
  const radius = rand(GLADE_RADIUS + 3, 62);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (blocked(x, z)) continue;
  addTree(x, z, rand(4.5, 7.5));
}

// a few trees across the river to make crossing worthwhile
for (let i = 0; i < 14; i++) {
  const x = rand(RIVER_X + 6, 60);
  const z = rand(-30, 30);
  if (Math.abs(z - BRIDGE_Z) < 4) continue;
  addTree(x, z, rand(4.5, 7));
}

// rocks + piles — mineable for stone
let rockId = 0;
for (let i = 0; i < 26; i++) {
  const x = rand(-55, 55);
  const z = rand(-55, 55);
  if (blocked(x, z)) continue;
  const pile = rng() > 0.7;
  const size = pile ? rand(1.2, 2) : rand(0.7, 1.4);
  ROCKS.push({
    id: `rock-${rockId++}`,
    file: pile
      ? ROCK_PILES[Math.floor(rng() * ROCK_PILES.length)]
      : ROCK_FILES[Math.floor(rng() * ROCK_FILES.length)],
    size,
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
    r: size * 0.55 + 0.3,
  });
}

// grass tufts everywhere, including inside the glade
for (let i = 0; i < 70; i++) {
  const x = rand(-50, 50);
  const z = rand(-50, 50);
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 1) continue;
  DECOR.push({
    file: GRASS[Math.floor(rng() * GRASS.length)],
    size: rand(0.35, 0.7),
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
  });
}

// pebbles
for (let i = 0; i < 14; i++) {
  const x = rand(-40, 40);
  const z = rand(-40, 40);
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 1) continue;
  DECOR.push({
    file: PEBBLES[Math.floor(rng() * PEBBLES.length)],
    size: rand(0.3, 0.6),
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
  });
}

// fence ring around the glade, skipping the three gaps
for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
  if (inFenceGap(a)) continue;
  const x = Math.cos(a) * GLADE_RADIUS;
  const z = Math.sin(a) * GLADE_RADIUS;
  DECOR.push({
    file: rng() > 0.5 ? "PP_Small_Fence_01" : "PP_Small_Fence_04",
    size: 3.4,
    by: "xz",
    pos: [x, 0, z],
    rot: -a + Math.PI / 2,
  });
}

// stone path from camp east toward the bridge
for (let x = 5; x <= 24; x += 2.4) {
  const tiles = ["PP_Floor_Tile_05", "PP_Floor_Tile_06", "PP_Floor_Tile_15", "PP_Floor_Tile_16"];
  DECOR.push({
    file: tiles[Math.floor(rng() * tiles.length)],
    size: 2.4,
    by: "xz",
    pos: [x, 0.02, BRIDGE_Z + rand(-0.6, 0.6)],
    rot: rand(0, Math.PI * 2),
  });
}

// short path west from the glade centre to the homestead gate
for (let x = -6; x >= -13.5; x -= 2.4) {
  const tiles = ["PP_Floor_Tile_05", "PP_Floor_Tile_06", "PP_Floor_Tile_15", "PP_Floor_Tile_16"];
  DECOR.push({
    file: tiles[Math.floor(rng() * tiles.length)],
    size: 2.2,
    by: "xz",
    pos: [x, 0.02, rand(-0.5, 0.5)],
    rot: rand(0, Math.PI * 2),
  });
}

// meadow patches + path in the south — thick ground tiles, embedded flush
DECOR.push({ file: "PP_Meadow_07", size: 14, by: "xz", align: "flush", pos: [-8, 0, 30], rot: 0 });
DECOR.push({ file: "PP_Meadow_08", size: 12, by: "xz", align: "flush", pos: [6, 0, 34], rot: 1.2 });
DECOR.push({ file: "PP_Meadow_Path_05", size: 10, by: "xz", align: "flush", pos: [-1, 0, 22], rot: 0.3 });

// lake bed decor to the west — also flush
DECOR.push({ file: "PP_Lake_Ground_04", size: 16, by: "xz", align: "flush", pos: [-34, 0, 14], rot: 0 });

// mossy mountains as a backdrop on the map edges
const MOUNTAINS: [number, number][] = [
  [-58, -50], [-20, -64], [34, -60], [62, -34],
  [-64, 16], [-50, 48], [30, 62], [64, 44],
];
for (const [x, z] of MOUNTAINS) {
  const size = rand(14, 22);
  DECOR.push({
    file: rng() > 0.5 ? "PP_Forest_Mountain_Moss_01" : "PP_Forest_Mountain_Moss_02",
    size,
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
  });
  COLLIDERS.push({ x, z, r: size * 0.34 });
}

// daffodils sprinkled around the glade as decoration (not collectible)
for (let i = 0; i < 8; i++) {
  const a = rand(0, Math.PI * 2);
  const r = rand(5, 11);
  DECOR.push({
    file: "PP_Daffodil_03",
    size: 0.55,
    pos: [Math.cos(a) * r, 0, Math.sin(a) * r],
    rot: rand(0, Math.PI * 2),
  });
}

// camp objects
COLLIDERS.push({ x: CAMPFIRE_POS[0], z: CAMPFIRE_POS[2], r: 1.6 });
for (const b of BUILDINGS) {
  COLLIDERS.push({ x: b.pos[0], z: b.pos[2], r: 2.1 });
}

// ---- collectibles ----

const MUSHROOM_FILES: { file: string; label: string }[] = [
  { file: "PP_Mushroom_Fantasy_Orange_09", label: "Orange Mushroom" },
  { file: "PP_Mushroom_Fantasy_Orange_10", label: "Orange Mushroom" },
  { file: "PP_Mushroom_Fantasy_Purple_05", label: "Purple Mushroom" },
  { file: "PP_Mushroom_Fantasy_Purple_08", label: "Purple Mushroom" },
];

const FLOWER_FILES: { file: string; label: string }[] = [
  { file: "PP_Sunflower_04", label: "Sunflower" },
  { file: "PP_Hyacinth_04", label: "Hyacinth" },
  { file: "PP_Daffodil_03", label: "Daffodil" },
];

export const COLLECTIBLES: Collectible[] = [];

// mushrooms in the northern grove
for (let i = 0; i < 8; i++) {
  const m = MUSHROOM_FILES[i % MUSHROOM_FILES.length];
  const x = rand(-24, 14);
  const z = rand(-44, -22);
  COLLECTIBLES.push({
    id: `mushroom-${i}`,
    file: m.file,
    size: rand(0.7, 1.1),
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
    kind: "mushroom",
    label: m.label,
  });
}

// flowers in the southern meadow
for (let i = 0; i < 6; i++) {
  const f = FLOWER_FILES[i % FLOWER_FILES.length];
  const x = rand(-14, 12);
  const z = rand(24, 40);
  COLLECTIBLES.push({
    id: `flower-${i}`,
    file: f.file,
    size: rand(0.7, 1),
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
    kind: "flower",
    label: f.label,
  });
}

// ---- the homestead: a separate instance entered through the forest gate ----
// Each player gets their own homestead "off-map", so the forest never gets
// crowded with private land.

// the gate stands in the west gap of the glade fence, at the end of its own path
export const HOME_PORTAL_POS: [number, number, number] = [-14.5, 0, 0];
export const HOME_GATE_POS: [number, number, number] = [0, 0, 8]; // exit gate at the homestead
export const HOME_CHEST_POS: [number, number, number] = [9, 0, -5];
export const HOME_FURNACE_POS: [number, number, number] = [9, 0, -1.5];
export const HOME_EXTEND_POS: [number, number, number] = [-9, 0, 6.5]; // extension sign
export const HOME_COOP_POS: [number, number, number] = [-9, 0, -5];
export const HOME_CABIN_POS: [number, number, number] = [0, 0, -6.5];

export const HOME_TIERS = [
  { name: "Homestead", price: 250, tiles: 6, halfW: 12, halfD: 9, chestCap: 200 },
  { name: "Extended Homestead", price: 300, tiles: 12, halfW: 15, halfD: 11, chestCap: 300 },
  { name: "Grand Homestead", price: 600, tiles: 18, halfW: 18, halfD: 13, chestCap: 400 },
];

/** Farm tile position within the homestead (6 per row). */
export function homeTilePos(idx: number): [number, number] {
  const col = idx % 6;
  const row = Math.floor(idx / 6);
  return [-9 + col * 2.7, -3 + row * 3.2];
}

export function homeTileKey(idx: number) {
  return `home:${idx}`;
}

const HOME_COLLIDERS = [
  { x: HOME_CHEST_POS[0], z: HOME_CHEST_POS[2], r: 0.9 },
  { x: HOME_FURNACE_POS[0], z: HOME_FURNACE_POS[2], r: 1.0 },
  { x: HOME_CABIN_POS[0], z: HOME_CABIN_POS[2], r: 2.4 },
];

/** Movement resolution inside the homestead instance. */
export function resolveHomeMovement(
  px: number, pz: number, nxIn: number, nzIn: number, tier: number
): [number, number] {
  const t = HOME_TIERS[Math.max(0, Math.min(tier, HOME_TIERS.length) - 1)];
  let nx = nxIn;
  let nz = nzIn;
  for (const c of HOME_COLLIDERS) {
    const r = c.r + 0.35;
    const dx = nx - c.x;
    const dz = nz - c.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = c.x + (dx / d) * r;
      nz = c.z + (dz / d) * r;
    }
  }
  nx = Math.max(-t.halfW + 0.5, Math.min(t.halfW - 0.5, nx));
  nz = Math.max(-t.halfD + 0.5, Math.min(t.halfD - 0.5, nz));
  return [nx, nz];
}

// ---- animals ----

export type WildKind = "chicken" | "boar" | "rabbit" | "deer";

export type AnimalSpawn = {
  id: string;
  kind: WildKind;
  pos: [number, number];
};

export const ANIMAL_SPAWNS: AnimalSpawn[] = [
  // chickens around the glade + meadow
  { id: "ch-0", kind: "chicken", pos: [7, 7] },
  { id: "ch-1", kind: "chicken", pos: [-3, 10] },
  { id: "ch-2", kind: "chicken", pos: [-9, 22] },
  { id: "ch-3", kind: "chicken", pos: [4, 26] },
  { id: "ch-4", kind: "chicken", pos: [12, 20] },
  { id: "ch-5", kind: "chicken", pos: [-12, 8] },
  { id: "ch-6", kind: "chicken", pos: [8, -9] },
  { id: "ch-7", kind: "chicken", pos: [-7, -10] },
  // boars deeper in the forest
  { id: "bo-0", kind: "boar", pos: [-28, -8] },
  { id: "bo-1", kind: "boar", pos: [16, -28] },
  { id: "bo-2", kind: "boar", pos: [-30, 34] },
  { id: "bo-3", kind: "boar", pos: [44, -16] },
  // rabbits around the meadow + glade fringes
  { id: "ra-0", kind: "rabbit", pos: [-6, 18] },
  { id: "ra-1", kind: "rabbit", pos: [10, 24] },
  { id: "ra-2", kind: "rabbit", pos: [-16, 6] },
  { id: "ra-3", kind: "rabbit", pos: [18, -12] },
  { id: "ra-4", kind: "rabbit", pos: [-12, 30] },
  // deer in the deep forest + far bank
  { id: "de-0", kind: "deer", pos: [-34, -20] },
  { id: "de-1", kind: "deer", pos: [24, -34] },
  { id: "de-2", kind: "deer", pos: [-38, 26] },
  { id: "de-3", kind: "deer", pos: [48, 12] },
];

// ---- homestead animal pens (unlocked by land tier) ----

export const PEN_SPOTS: [number, number][] = [
  [-9, -5],
  [-13, 1],
  [12, 4],
  [-13, -8],
];

export function pensAllowed(tier: number) {
  return tier >= 3 ? 4 : tier === 2 ? 2 : tier === 1 ? 1 : 0;
}

// ---- movement / collision ----

const RIVER_BAND = RIVER_WIDTH / 2 + 0.7; // water + muddy bank
const BRIDGE_HALF_SPAN = 5.5;
const BRIDGE_HALF_WIDTH = 1.7;
const PLAYER_R = 0.35;

/** Height of the bridge deck at a given world position (0 when off the bridge). */
export function bridgeY(x: number, z: number) {
  const dx = x - RIVER_X;
  if (Math.abs(dx) > BRIDGE_HALF_SPAN || Math.abs(z - BRIDGE_Z) > BRIDGE_HALF_WIDTH + 0.3) return 0;
  return 2.05 * Math.cos((Math.PI / 2) * (dx / BRIDGE_HALF_SPAN));
}

/**
 * Resolves a desired move against the static world: circle colliders, living
 * trees, the glade fence ring, and the river (crossable only via the bridge).
 */
export function resolveMovement(
  px: number, pz: number,
  nxIn: number, nzIn: number,
  chopped: Record<string, number>,
  mined: Record<string, number> = {}
): [number, number] {
  let nx = nxIn;
  let nz = nzIn;

  for (let pass = 0; pass < 2; pass++) {
    // circle colliders
    for (const c of COLLIDERS) {
      const r = c.r + PLAYER_R;
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-9) {
        const d = Math.sqrt(d2);
        nx = c.x + (dx / d) * r;
        nz = c.z + (dz / d) * r;
      }
    }
    // living trees + unmined rocks
    for (const list of [TREES, ROCKS]) {
      for (const t of list) {
        if (chopped[t.id] || mined[t.id]) continue;
        const r = t.r + PLAYER_R;
        const dx = nx - t.pos[0];
        const dz = nz - t.pos[2];
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          nx = t.pos[0] + (dx / d) * r;
          nz = t.pos[2] + (dz / d) * r;
        }
      }
    }
    // glade fence ring (solid band except at the gaps)
    const rr = Math.hypot(nx, nz);
    if (rr > GLADE_RADIUS - 1 && rr < GLADE_RADIUS + 1 && !inFenceGap(Math.atan2(nz, nx))) {
      const target = Math.hypot(px, pz) < GLADE_RADIUS ? GLADE_RADIUS - 1 : GLADE_RADIUS + 1;
      const s = target / (rr || 1);
      nx *= s;
      nz *= s;
    }
    // river — only crossable on the bridge deck
    const inBand = Math.abs(nx - RIVER_X) < RIVER_BAND;
    if (inBand) {
      const onBridgeZ = Math.abs(nz - BRIDGE_Z) <= BRIDGE_HALF_WIDTH;
      if (!onBridgeZ) {
        const wasOnBridge =
          Math.abs(px - RIVER_X) < RIVER_BAND && Math.abs(pz - BRIDGE_Z) <= BRIDGE_HALF_WIDTH;
        if (wasOnBridge) {
          // walking on the deck: keep them on it
          nz = BRIDGE_Z + Math.sign(nz - BRIDGE_Z) * BRIDGE_HALF_WIDTH;
        } else {
          // wading in from the bank: push back out
          nx = RIVER_X + Math.sign(nx - RIVER_X || 1) * RIVER_BAND;
        }
      }
    }

    // the bridge itself is solid stone: block its side walls and arch
    // (its footprint reaches past the water band onto both banks)
    const bdx = Math.abs(nx - RIVER_X);
    const bdz = nz - BRIDGE_Z;
    if (bdx < BRIDGE_HALF_SPAN && Math.abs(bdz) > BRIDGE_HALF_WIDTH && Math.abs(bdz) < 3.4) {
      const wasInside = Math.abs(px - RIVER_X) < BRIDGE_HALF_SPAN && Math.abs(pz - BRIDGE_Z) <= BRIDGE_HALF_WIDTH;
      if (wasInside) {
        // on the deck: the parapet keeps them on it
        nz = BRIDGE_Z + Math.sign(bdz) * BRIDGE_HALF_WIDTH;
      } else {
        // outside: the stone flank pushes them away
        nz = BRIDGE_Z + Math.sign(bdz) * 3.4;
      }
    }
  }

  // map bounds
  nx = Math.max(-68, Math.min(68, nx));
  nz = Math.max(-68, Math.min(68, nz));
  return [nx, nz];
}

// ---- zones (for the location readout) ----

export function zoneAt(x: number, z: number): string {
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 3) return "The River";
  if (x > RIVER_X + RIVER_WIDTH / 2) return "Far Bank";
  if (Math.hypot(x, z) < GLADE_RADIUS + 2) return "The Glade";
  if (z < -20 && x < 18) return "Mushroom Grove";
  if (z > 20) return "The Meadow";
  return "Deep Forest";
}
