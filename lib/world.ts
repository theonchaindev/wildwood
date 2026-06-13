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
  kind: "mushroom" | "flower" | "herb";
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

// the river runs north-south at x ~ 38
export const RIVER_X = 38;
export const RIVER_WIDTH = 8;
export const GLADE_RADIUS = 20;
export const MAP_BOUND = 95; // playable half-extent
export const CAMPFIRE_POS: [number, number, number] = [2, 0, 0];
export const NOTICE_BOARD_POS: [number, number, number] = [-3, 0, -6];

// a calm fishing lake in the north-west
export const LAKE_POS: [number, number, number] = [-46, 0, -34];
export const LAKE_R = 13;

// the welcome tour: the camera glides to each landmark with a caption
export type TourStop = { focus: [number, number]; title: string; text: string };
export const TOUR_STOPS: TourStop[] = [
  { focus: [2, 0], title: "Welcome to Wildwood", text: "A living forest you can farm, fight and earn in. Here's the lay of the land…" },
  { focus: [-9, 8], title: "🛖 The Den", text: "General store — axes, a fishing rod, pickaxe, seeds, even pets. Your first stop." },
  { focus: [-14, -8], title: "⚔️ The Forge", text: "Weapons & armour to fight the dead after dark. Bigger blades, tougher nights." },
  { focus: [6, 15], title: "🧵 Threads", text: "Outfits and hats — make your survivor your own." },
  { focus: [15, 7], title: "🏥 The Remedy", text: "Bandages, medkits and antidotes. Zombie scratches and raw meat can infect you." },
  { focus: [-4, -15], title: "⚖️ The Vault", text: "Trade with other survivors, send gifts, and convert acorns into $ACORN coin." },
  { focus: [-3, -6], title: "📌 Notice Board", text: "The coin contract and a live tally of everything paid out to players." },
  { focus: [-22, 0], title: "🏡 Your Haven", text: "Buy your own private land through the west gate — farm, ranch, build and decorate." },
  { focus: [-38, -38], title: "⛏️ The Old Mine", text: "Northwest through Darkwood: a deep cave of coal, diamonds — and things that bite back." },
  { focus: [-46, -34], title: "🎣 The Lake", text: "A calm lake to fish, and the river to the east — cross it on the Old Bridge." },
  { focus: [2, 0], title: "Off you go!", text: "Night falls every 20 minutes — gather by day, survive by night. Good luck out there." },
];
export const BRIDGE_Z = 0;

export type ShopId = "trader" | "armoury" | "tailor" | "medbay" | "exchange";

export const BUILDINGS: { id: ShopId; label: string; pos: [number, number, number] }[] = [
  { id: "trader", label: "🛖 The Den", pos: [-9, 0, 8] },
  { id: "armoury", label: "⚔️ The Forge", pos: [-14, 0, -8] },
  { id: "tailor", label: "🧵 Threads", pos: [6, 0, 15] },
  { id: "medbay", label: "🏥 The Remedy", pos: [15, 0, 7] },
  { id: "exchange", label: "⚖️ The Vault", pos: [-4, 0, -15] },
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
  // keep clear: glade centre, the east path corridor, the river banks, the lake
  if (Math.hypot(x, z) < GLADE_RADIUS + 2) return true;
  if (Math.abs(z - BRIDGE_Z) < 5 && x > 0 && x < RIVER_X + 16) return true;
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 2) return true;
  if (Math.hypot(x - LAKE_POS[0], z - LAKE_POS[2]) < LAKE_R + 3) return true;
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
for (let i = 0; i < 230; i++) {
  const angle = rand(0, Math.PI * 2);
  const radius = rand(GLADE_RADIUS + 3, 90);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (blocked(x, z)) continue;
  addTree(x, z, rand(4.5, 7.5));
}

// a few trees across the river to make crossing worthwhile
for (let i = 0; i < 26; i++) {
  const x = rand(RIVER_X + 6, 90);
  const z = rand(-50, 50);
  if (Math.abs(z - BRIDGE_Z) < 4) continue;
  addTree(x, z, rand(4.5, 7));
}

// rocks + piles — mineable for stone
let rockId = 0;
for (let i = 0; i < 48; i++) {
  const x = rand(-88, 88);
  const z = rand(-88, 88);
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
for (let i = 0; i < 130; i++) {
  const x = rand(-85, 85);
  const z = rand(-85, 85);
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

// fence ring around the glade, skipping the gaps
for (let a = 0; a < Math.PI * 2; a += Math.PI / 13) {
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

const PATH_TILES = ["PP_Floor_Tile_05", "PP_Floor_Tile_06", "PP_Floor_Tile_15", "PP_Floor_Tile_16"];

// stone path from camp east toward the bridge
for (let x = 8; x <= RIVER_X - 4; x += 2.4) {
  DECOR.push({ file: PATH_TILES[Math.floor(rng() * PATH_TILES.length)], size: 2.4, by: "xz", pos: [x, 0.02, BRIDGE_Z + rand(-0.6, 0.6)], rot: rand(0, Math.PI * 2) });
}

// path west from the glade centre out to the homestead gate
for (let x = -8; x >= -27; x -= 2.4) {
  DECOR.push({ file: PATH_TILES[Math.floor(rng() * PATH_TILES.length)], size: 2.2, by: "xz", pos: [x, 0.02, rand(-0.5, 0.5)], rot: rand(0, Math.PI * 2) });
}

// meadow patches + path in the south — thick ground tiles, embedded flush
DECOR.push({ file: "PP_Meadow_07", size: 18, by: "xz", align: "flush", pos: [-10, 0, 42], rot: 0 });
DECOR.push({ file: "PP_Meadow_08", size: 16, by: "xz", align: "flush", pos: [9, 0, 47], rot: 1.2 });
DECOR.push({ file: "PP_Meadow_Path_05", size: 12, by: "xz", align: "flush", pos: [-1, 0, 30], rot: 0.3 });

// the fishing lake bed in the NW — flush ground under the water plane
DECOR.push({ file: "PP_Lake_Ground_04", size: LAKE_R * 2.4, by: "xz", align: "flush", pos: [LAKE_POS[0], 0, LAKE_POS[2]], rot: 0 });
// reeds + boulders around the lake shore
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const rx = LAKE_POS[0] + Math.cos(a) * (LAKE_R + 1.5);
  const rz = LAKE_POS[2] + Math.sin(a) * (LAKE_R + 1.5);
  DECOR.push({ file: i % 2 ? "PP_Grass_15" : "PP_Rock_Moss_Grown_09", size: i % 2 ? 0.8 : 1.4, pos: [rx, 0, rz], rot: rand(0, 6.28) });
}

// an ancient standing-stone circle landmark in the far south-east
const RUINS: [number, number] = [58, 52];
for (let i = 0; i < 7; i++) {
  const a = (i / 7) * Math.PI * 2;
  const rx = RUINS[0] + Math.cos(a) * 5;
  const rz = RUINS[1] + Math.sin(a) * 5;
  DECOR.push({ file: "PP_Rock_Moss_Grown_11", size: rand(2.6, 3.4), pos: [rx, 0, rz], rot: rand(0, 6.28) });
  COLLIDERS.push({ x: rx, z: rz, r: 1.3 });
}

// mossy mountains ringing the edge of the bigger map
const MOUNTAINS: [number, number][] = [
  [-80, -64], [-30, -88], [44, -84], [86, -46],
  [-88, 24], [-66, 70], [42, 86], [88, 60], [12, -90], [-90, -20],
];
for (const [x, z] of MOUNTAINS) {
  const size = rand(16, 24);
  DECOR.push({
    file: rng() > 0.5 ? "PP_Forest_Mountain_Moss_01" : "PP_Forest_Mountain_Moss_02",
    size,
    pos: [x, 0, z],
    rot: rand(0, Math.PI * 2),
  });
  // these mossy mountains are squat — a wide base, low peak — so the collider
  // is generous to cover the full visible footprint (better to stop early
  // than let players clip into the rock)
  COLLIDERS.push({ x, z, r: size * 0.95 });
}

// the Old Mine's rocky outcrop (the mouth itself stays approachable)
// (literal here — CAVE_ENTRANCE_POS is declared further down)
COLLIDERS.push({ x: -38, z: -39.4, r: 2.6 });

// daffodils sprinkled around the glade as decoration (not collectible)
for (let i = 0; i < 12; i++) {
  const a = rand(0, Math.PI * 2);
  const r = rand(6, 16);
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

// mushrooms in the northern grove (Sporewood)
for (let i = 0; i < 14; i++) {
  const m = MUSHROOM_FILES[i % MUSHROOM_FILES.length];
  const x = rand(-34, 18);
  const z = rand(-58, -30);
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

// the forest's secret stashes — magic shrooms deep in Sporewood, weed on
// the far bank. Rare finds with a long respawn.
COLLECTIBLES.push(
  { id: "shroom-0", file: "PP_Mushroom_Fantasy_Purple_05", size: 1.5, pos: [-24, 0, -56], rot: rand(0, 6.28), kind: "herb", label: "Magic Shroom" },
  { id: "shroom-1", file: "PP_Mushroom_Fantasy_Purple_08", size: 1.4, pos: [12, 0, -58], rot: rand(0, 6.28), kind: "herb", label: "Magic Shroom" },
  { id: "shroom-2", file: "PP_Mushroom_Fantasy_Purple_05", size: 1.6, pos: [-44, 0, -34], rot: rand(0, 6.28), kind: "herb", label: "Magic Shroom" },
  { id: "weed-0", file: "PP_Grass_15", size: 1.3, pos: [62, 0, 30], rot: rand(0, 6.28), kind: "herb", label: "Weed" },
  { id: "weed-1", file: "PP_Grass_15", size: 1.2, pos: [68, 0, -28], rot: rand(0, 6.28), kind: "herb", label: "Weed" },
  { id: "weed-2", file: "PP_Grass_11", size: 1.3, pos: [-58, 0, 52], rot: rand(0, 6.28), kind: "herb", label: "Weed" },
);

// flowers in the southern meadow
for (let i = 0; i < 12; i++) {
  const f = FLOWER_FILES[i % FLOWER_FILES.length];
  const x = rand(-20, 18);
  const z = rand(32, 52);
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
export const HOME_PORTAL_POS: [number, number, number] = [-22, 0, 0];
export const HOME_CHEST_POS: [number, number, number] = [9, 0, -5];
export const HOME_FURNACE_POS: [number, number, number] = [9, 0, -1.5];
export const HOME_EXTEND_POS: [number, number, number] = [9, 0, 5.5]; // extension sign, in the east utility column
export const HOME_CABIN_POS: [number, number, number] = [0, 0, -6.5];
export const HOME_WELL_POS: [number, number, number] = [9, 0, 2]; // continues the utility column
export const HOME_BENCH_POS: [number, number, number] = [6.8, 0, -6.2]; // crafting bench beside the chest
export const HOME_POND_POS: [number, number, number] = [19, 0, 8];
export const POND_R = 3.2;
export const HOME_WINDMILL_POS: [number, number, number] = [-22, 0, -12];
export const HOME_SCARECROW_POS: [number, number, number] = [12, 0, -8];

// The estate masterplan — every zone has a fixed anchor so expansions grow
// outward logically instead of scattering:
//   north (behind the house) = orchard rows · west = ranch pen columns
//   east = utility column (chest/furnace/well/hives) then the pond
//   south = the farm field, filling row by row toward the gate
export type HomeTier = {
  name: string;
  price: number;
  tiles: number;
  halfW: number;
  halfD: number;
  chestCap: number;
  pens: number;
  orchard: number;
  hives: number;
  well: boolean;
  pond: boolean;
  windmill: boolean;
  tagline: string;
};

export const HOME_TIERS: HomeTier[] = [
  { name: "Haven",              price: 250,  tiles: 6,  halfW: 12, halfD: 9,  chestCap: 200,  pens: 1, orchard: 0, hives: 0, well: false, pond: false, windmill: false, tagline: "A patch of land to call your own" },
  { name: "Expanded Haven",     price: 300,  tiles: 12, halfW: 15, halfD: 11, chestCap: 300,  pens: 2, orchard: 0, hives: 0, well: false, pond: false, windmill: false, tagline: "Twice the field, a second pen" },
  { name: "Grand Haven",        price: 600,  tiles: 18, halfW: 18, halfD: 13, chestCap: 400,  pens: 3, orchard: 0, hives: 0, well: true,  pond: false, windmill: false, tagline: "Your own well — water without the trek" },
  { name: "The Acres",          price: 900,  tiles: 24, halfW: 20, halfD: 15, chestCap: 550,  pens: 4, orchard: 2, hives: 0, well: true,  pond: false, windmill: false, tagline: "An orchard takes root behind the house" },
  { name: "The Farmlands",      price: 1300, tiles: 30, halfW: 22, halfD: 17, chestCap: 700,  pens: 4, orchard: 2, hives: 1, well: true,  pond: false, windmill: false, tagline: "The bees move in" },
  { name: "The Grounds",        price: 1800, tiles: 34, halfW: 24, halfD: 18, chestCap: 900,  pens: 5, orchard: 4, hives: 1, well: true,  pond: false, windmill: false, tagline: "Green as far as the fence runs" },
  { name: "Lakeside Grounds",   price: 2400, tiles: 38, halfW: 26, halfD: 20, chestCap: 1100, pens: 5, orchard: 4, hives: 1, well: true,  pond: true,  windmill: false, tagline: "A private pond, stocked with fish" },
  { name: "The Estate",         price: 3200, tiles: 42, halfW: 27, halfD: 21, chestCap: 1400, pens: 6, orchard: 5, hives: 2, well: true,  pond: true,  windmill: false, tagline: "The forest itself works for you" },
  { name: "The Great Estate",   price: 4200, tiles: 45, halfW: 28, halfD: 23, chestCap: 1700, pens: 7, orchard: 6, hives: 2, well: true,  pond: true,  windmill: false, tagline: "An estate worthy of a Warden" },
  { name: "The Domain",         price: 5500, tiles: 48, halfW: 30, halfD: 24, chestCap: 2000, pens: 8, orchard: 6, hives: 2, well: true,  pond: true,  windmill: true,  tagline: "The windmill turns — the whole wood is yours" },
];

export function homeTierDef(tier: number): HomeTier {
  return HOME_TIERS[Math.max(0, Math.min(tier, HOME_TIERS.length) - 1)];
}

/** The exit gate sits in the middle of the southern fence, so it moves out as the land grows. */
export function homeGateZ(tier: number) {
  return homeTierDef(tier).halfD;
}

// orchard rows behind the house: front row first, then the back row
export const ORCHARD_SPOTS: [number, number][] = [
  [-4.5, -11],
  [0, -11],
  [4.5, -11],
  [-4.5, -14.5],
  [0, -14.5],
  [4.5, -14.5],
];

// beehives extend the utility column east of the chest
export const HIVE_SPOTS: [number, number][] = [
  [13, -5],
  [13, -1.5],
];

/** Farm tile position within the homestead (6 per row). The first row sits
 *  south of the house with room for the Manor's porch — the field only ever
 *  grows AWAY from the buildings. */
export function homeTilePos(idx: number): [number, number] {
  const col = idx % 6;
  const row = Math.floor(idx / 6);
  return [-9 + col * 2.7, -1.2 + row * 3.2];
}

export function homeTileKey(idx: number) {
  return `home:${idx}`;
}

function homeColliders(tier: number, houseLevel: number) {
  const t = homeTierDef(tier);
  const c = [
    { x: HOME_CHEST_POS[0], z: HOME_CHEST_POS[2], r: 0.9 },
    { x: HOME_FURNACE_POS[0], z: HOME_FURNACE_POS[2], r: 1.0 },
    { x: HOME_BENCH_POS[0], z: HOME_BENCH_POS[2], r: 0.8 },
    { x: HOME_CABIN_POS[0], z: HOME_CABIN_POS[2], r: 2.2 + houseLevel * 0.25 },
  ];
  if (t.well) c.push({ x: HOME_WELL_POS[0], z: HOME_WELL_POS[2], r: 0.75 });
  if (t.pond) c.push({ x: HOME_POND_POS[0], z: HOME_POND_POS[2], r: POND_R });
  if (t.windmill) c.push({ x: HOME_WINDMILL_POS[0], z: HOME_WINDMILL_POS[2], r: 1.8 });
  return c;
}

/** Movement resolution inside the homestead instance. */
export function resolveHomeMovement(
  px: number, pz: number, nxIn: number, nzIn: number, tier: number, houseLevel = 1
): [number, number] {
  const t = homeTierDef(tier);
  let nx = nxIn;
  let nz = nzIn;
  for (const c of homeColliders(tier, houseLevel)) {
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

// ---- the Old Mine: a dark cave instance, entered in Darkwood ----

export const CAVE_ENTRANCE_POS: [number, number, number] = [-38, 0, -38];
export const CAVE_HW = 36;
export const CAVE_HD = 26;

// the mine has three depths going north (deeper = more danger, better ore):
//   shallow (entrance, z>10) · middle (z -6..10) · deep (z < -6, the diamond seam)
export const CAVE_DEPTHS = [
  { name: "Mine Mouth", zMax: 26, zMin: 12 },
  { name: "The Galleries", zMax: 12, zMin: -8 },
  { name: "The Deep", zMax: -8, zMin: -26 },
];

// spots where mobs lurk (deeper chambers hold more)
export const CAVE_MOB_SPOTS: { x: number; z: number; kind: "zombie" | "skeleton" }[] = [
  { x: -10, z: 6, kind: "zombie" },
  { x: 12, z: 4, kind: "skeleton" },
  { x: 0, z: -2, kind: "zombie" },
  { x: -18, z: -12, kind: "skeleton" },
  { x: 16, z: -14, kind: "skeleton" },
  { x: -4, z: -18, kind: "zombie" },
  { x: 8, z: -20, kind: "skeleton" },
  { x: -24, z: -2, kind: "zombie" },
];

export type CaveOre = {
  id: string;
  kind: "stone" | "coal" | "diamond";
  pos: [number, number, number];
  r: number;
  size: number;
};

export const CAVE_ORES: CaveOre[] = [];
export const STALAGMITES: { x: number; z: number; h: number; r: number }[] = [];

{
  const caveRng = mulberry32(4242);
  const cRand = (min: number, max: number) => min + caveRng() * (max - min);
  const clearOf = (x: number, z: number) =>
    Math.hypot(x - 0, z - (CAVE_HD - 2)) > 3.5 && // entrance area stays open
    CAVE_ORES.every((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) > 2.6) &&
    STALAGMITES.every((s) => Math.hypot(s.x - x, s.z - z) > 2.4);

  // place ore within a z-band (deeper bands hold the richer seams)
  const place = (kind: CaveOre["kind"], n: number, size: [number, number], zMin: number, zMax: number) => {
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < n; tries++) {
      const x = cRand(-CAVE_HW + 2, CAVE_HW - 2);
      const z = cRand(zMin, zMax);
      if (!clearOf(x, z)) continue;
      const s = cRand(size[0], size[1]);
      CAVE_ORES.push({
        id: `ore-${kind}-${placed}`,
        kind,
        pos: [x, 0, z],
        r: s * 0.55 + 0.25,
        size: s,
      });
      placed++;
    }
  };
  // stone everywhere, coal through the galleries, diamonds only in the deep
  place("stone", 16, [0.8, 1.3], -CAVE_HD + 2, CAVE_HD - 2);
  place("coal", 22, [0.9, 1.4], -CAVE_HD + 2, 12);
  place("diamond", 5, [0.7, 0.9], -CAVE_HD + 2, -8);

  for (let i = 0; i < 28; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = cRand(-CAVE_HW + 1.5, CAVE_HW - 1.5);
      const z = cRand(-CAVE_HD + 1.5, CAVE_HD - 1.5);
      if (!clearOf(x, z)) continue;
      STALAGMITES.push({ x, z, h: cRand(1.2, 3.4), r: cRand(0.4, 0.85) });
      break;
    }
  }
}

export const ORE_RESPAWN_MS: Record<CaveOre["kind"], number> = {
  stone: 150_000,
  coal: 180_000,
  diamond: 600_000, // diamonds make you wait
};

export function resolveCaveMovement(
  px: number, pz: number, nxIn: number, nzIn: number,
  mined: Record<string, number> = {}
): [number, number] {
  let nx = nxIn;
  let nz = nzIn;
  for (const s of STALAGMITES) {
    const r = s.r + 0.35;
    const dx = nx - s.x;
    const dz = nz - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = s.x + (dx / d) * r;
      nz = s.z + (dz / d) * r;
    }
  }
  for (const o of CAVE_ORES) {
    if (mined[o.id]) continue;
    const r = o.r + 0.35;
    const dx = nx - o.pos[0];
    const dz = nz - o.pos[2];
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = o.pos[0] + (dx / d) * r;
      nz = o.pos[2] + (dz / d) * r;
    }
  }
  nx = Math.max(-CAVE_HW + 0.5, Math.min(CAVE_HW - 0.5, nx));
  nz = Math.max(-CAVE_HD + 0.5, Math.min(CAVE_HD - 0.5, nz));
  return [nx, nz];
}

// ---- inside the house: a cosy interior instance, sized by house level ----

export function interiorDims(houseLevel: number) {
  const lv = Math.max(1, Math.min(houseLevel, 5));
  return { hw: 3.6 + lv * 0.9, hd: 2.6 + lv * 0.65 };
}

/** Fixed anchors for the furniture, hugging the walls as the room grows. */
export function interiorLayout(houseLevel: number) {
  const lv = Math.max(1, Math.min(houseLevel, 5));
  const { hw, hd } = interiorDims(lv);
  return {
    bed: [-hw + 1.4, -hd + 1.3] as [number, number],
    table: lv >= 2 ? ([0.3, 0.2] as [number, number]) : null,
    fireplace: lv >= 3 ? ([hw * 0.4, -hd + 0.55] as [number, number]) : null,
    lounge: lv >= 3 ? ([-hw + 1.2, hd - 1.7] as [number, number]) : null,
    kitchen: lv >= 4 ? ([-2.1, -hd + 0.75] as [number, number]) : null,
    closet: lv >= 4 ? ([-hw + 0.6, 0.9] as [number, number]) : null,
    dresser: lv >= 4 ? ([-hw + 0.6, -1.3] as [number, number]) : null,
    games: lv >= 5 ? ([3.2, 1.4] as [number, number]) : null,
    music: lv >= 5 ? ([hw - 0.9, 0.2] as [number, number]) : null,
    desk: [hw - 1.1, -hd + 1.1] as [number, number],
    chest: [hw - 0.9, hd - 1.5] as [number, number],
    door: [0, hd] as [number, number],
  };
}

export function resolveInteriorMovement(
  px: number, pz: number, nxIn: number, nzIn: number, houseLevel: number
): [number, number] {
  const { hw, hd } = interiorDims(houseLevel);
  const lay = interiorLayout(houseLevel);
  const colliders: { x: number; z: number; r: number }[] = [
    { x: lay.bed[0], z: lay.bed[1], r: 1.0 },
    { x: lay.desk[0], z: lay.desk[1], r: 0.7 },
    { x: lay.chest[0], z: lay.chest[1], r: 0.55 },
  ];
  if (lay.table) colliders.push({ x: lay.table[0], z: lay.table[1], r: 0.85 });
  if (lay.fireplace) colliders.push({ x: lay.fireplace[0], z: lay.fireplace[1], r: 0.8 });
  if (lay.lounge) colliders.push({ x: lay.lounge[0], z: lay.lounge[1], r: 0.95 });
  if (lay.kitchen) colliders.push({ x: lay.kitchen[0], z: lay.kitchen[1], r: 1.1 });
  if (lay.closet) colliders.push({ x: lay.closet[0], z: lay.closet[1], r: 0.6 });
  if (lay.dresser) colliders.push({ x: lay.dresser[0], z: lay.dresser[1], r: 0.55 });
  if (lay.games) colliders.push({ x: lay.games[0], z: lay.games[1], r: 1.15 });
  if (lay.music) colliders.push({ x: lay.music[0], z: lay.music[1], r: 0.7 });
  let nx = nxIn;
  let nz = nzIn;
  for (const c of colliders) {
    const r = c.r + 0.3;
    const dx = nx - c.x;
    const dz = nz - c.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = c.x + (dx / d) * r;
      nz = c.z + (dz / d) * r;
    }
  }
  nx = Math.max(-hw + 0.45, Math.min(hw - 0.45, nx));
  nz = Math.max(-hd + 0.45, Math.min(hd - 0.45, nz));
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
  { id: "de-4", kind: "deer", pos: [62, -40] },
  { id: "de-5", kind: "deer", pos: [-62, 48] },
  { id: "bo-4", kind: "boar", pos: [70, 30] },
  { id: "bo-5", kind: "boar", pos: [-58, -14] },
  { id: "ra-5", kind: "rabbit", pos: [-50, -28] },
  { id: "ra-6", kind: "rabbit", pos: [40, 44] },
  { id: "ch-8", kind: "chicken", pos: [-40, -44] },
];

// ---- homestead animal pens (unlocked by land tier) ----

// the ranch: pen 0 beside the house, then two tidy columns down the west side,
// kept clear of the farm tile grid (x −10.1…5.6)
export const PEN_SPOTS: [number, number][] = [
  [-9, -6.6],
  [-12.8, -2],
  [-12.8, 2.6],
  [-12.8, 7.2],
  [-17.6, -2],
  [-17.6, 2.6],
  [-17.6, 7.2],
  [-17.6, -6.6],
];

export function pensAllowed(tier: number) {
  return tier > 0 ? homeTierDef(tier).pens : 0;
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
    // (its footprint reaches past the water band onto both banks, and the
    // wing walls flare wider at the ends — cover those too)
    const bdx = Math.abs(nx - RIVER_X);
    const bdz = nz - BRIDGE_Z;
    if (bdx < BRIDGE_HALF_SPAN + 1.2 && Math.abs(bdz) > BRIDGE_HALF_WIDTH && Math.abs(bdz) < 3.6) {
      const wasInside = Math.abs(px - RIVER_X) < BRIDGE_HALF_SPAN + 1.2 && Math.abs(pz - BRIDGE_Z) <= BRIDGE_HALF_WIDTH;
      if (wasInside) {
        // on the deck: the parapet keeps them on it
        nz = BRIDGE_Z + Math.sign(bdz) * BRIDGE_HALF_WIDTH;
      } else {
        // outside: the stone flank pushes them away
        nz = BRIDGE_Z + Math.sign(bdz) * 3.6;
      }
    }
    // the lake — stand on the shore, can't wade in
    const ldx = nx - LAKE_POS[0];
    const ldz = nz - LAKE_POS[2];
    const ld = Math.hypot(ldx, ldz);
    if (ld < LAKE_R && ld > 1e-6) {
      nx = LAKE_POS[0] + (ldx / ld) * LAKE_R;
      nz = LAKE_POS[2] + (ldz / ld) * LAKE_R;
    }
  }

  // map bounds
  nx = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, nx));
  nz = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, nz));
  return [nx, nz];
}

// ---- zones (for the location readout) ----

export function zoneAt(x: number, z: number): string {
  if (Math.abs(x - RIVER_X) < RIVER_WIDTH / 2 + 3) return "The Rush";
  if (x > RIVER_X + RIVER_WIDTH / 2) return "The Outlands";
  if (Math.hypot(x, z) < GLADE_RADIUS + 2) return "The Hollow";
  if (z < -28 && x < 24) return "Sporewood";
  if (z > 28) return "The Bloom";
  return "Darkwood";
}
