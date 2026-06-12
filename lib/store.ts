"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sfx } from "./sound";
import { teleport, live, isBloodMoonNight, isNight, clock, DAY_LENGTH_S } from "./runtime";
import {
  CAMPFIRE_POS, ShopId, HOME_TIERS, HOME_PORTAL_POS, HOME_CABIN_POS,
  homeGateZ, homeTierDef, interiorDims,
} from "./world";

export type Interact =
  | { kind: "shop"; id: ShopId }
  | { kind: "chest" }
  | { kind: "furnace" }
  | { kind: "portal" } // forest gate into the homestead
  | { kind: "homegate" } // homestead gate back to the forest
  | { kind: "extend" } // homestead extension sign
  | { kind: "pen"; idx: number } // farm animal pen (or its empty spot)
  | { kind: "house" } // your front door
  | { kind: "well" }
  | { kind: "orchard"; idx: number }
  | { kind: "hive"; idx: number }
  | { kind: "bed" } // indoors
  | { kind: "desk" }
  | { kind: "exitdoor" };

export type Quest = {
  id: string;
  title: string;
  desc: string;
  goal: number;
  progress: number;
  done: boolean;
  xp: number;
  acorns: number;
};

export type Toast = { id: number; text: string };

export type AxeTier = "rusty" | "golden";
export type WeaponTier = "club" | "spear" | "sword";
export type ArmorTier = "leather" | "iron";

export const AXES: Record<AxeTier, { label: string; cost: number; chopTime: number; yield: number; blurb: string }> = {
  rusty: { label: "Rusty Axe", cost: 60, chopTime: 2.2, yield: 3, blurb: "Chops 2× faster, +1 wood per tree" },
  golden: { label: "Golden Axe", cost: 250, chopTime: 1.0, yield: 5, blurb: "Chops 5× faster, +3 wood per tree" },
};

export const WEAPONS: Record<WeaponTier, { label: string; icon: string; cost: number; dmg: number; blurb: string }> = {
  club: { label: "Wooden Club", icon: "🏏", cost: 40, dmg: 16, blurb: "Heavy knockback — keeps them off you" },
  spear: { label: "Hunting Spear", icon: "🔱", cost: 120, dmg: 26, blurb: "Long reach — strike before they close in" },
  sword: { label: "Iron Sword", icon: "⚔️", cost: 250, dmg: 38, blurb: "Fast swings, 20% critical hits" },
};

export type CombatProfile = {
  label: string;
  dmg: number;
  swing: number; // seconds between swings
  reach: number;
  knockback: number;
  crit: number; // chance of a 2× hit
};

export const COMBAT: Record<"fists" | "axe" | WeaponTier, CombatProfile> = {
  fists: { label: "Fists", dmg: 8, swing: 0.85, reach: 1.6, knockback: 0.3, crit: 0 },
  axe: { label: "Axe", dmg: 14, swing: 0.7, reach: 1.8, knockback: 0.5, crit: 0.05 },
  club: { label: "Wooden Club", dmg: 16, swing: 0.6, reach: 1.9, knockback: 1.5, crit: 0.05 },
  spear: { label: "Hunting Spear", dmg: 26, swing: 0.55, reach: 2.9, knockback: 0.7, crit: 0.1 },
  sword: { label: "Iron Sword", dmg: 38, swing: 0.45, reach: 2.0, knockback: 0.5, crit: 0.2 },
};

export const ARMOR: Record<ArmorTier, { label: string; icon: string; cost: number; reduce: number; blurb: string }> = {
  leather: { label: "Leather Jerkin", icon: "🦺", cost: 100, reduce: 0.25, blurb: "Blocks 25% of zombie damage" },
  iron: { label: "Iron Plate", icon: "🛡️", cost: 280, reduce: 0.5, blurb: "Blocks 50% of zombie damage" },
};

export const SHIRTS: Record<string, { label: string; cost: number; color: string }> = {
  green: { label: "Forest Green", cost: 0, color: "#3f6d35" },
  blue: { label: "River Blue", cost: 30, color: "#2e5d8a" },
  red: { label: "Berry Red", cost: 30, color: "#a8403a" },
  yellow: { label: "Sunflower Yellow", cost: 30, color: "#c99a2e" },
  purple: { label: "Mushroom Purple", cost: 50, color: "#6d4a8a" },
};

export const HATS: Record<string, { label: string; icon: string; cost: number }> = {
  straw: { label: "Straw Hat", icon: "👒", cost: 60 },
  cap: { label: "Forager's Cap", icon: "🧢", cost: 40 },
  crown: { label: "Golden Crown", icon: "👑", cost: 300 },
};

export const MEDS: Record<string, { icon: string; cost: number; blurb: string }> = {
  Bandage: { icon: "🩹", cost: 15, blurb: "Restores 30 HP" },
  Medkit: { icon: "🧰", cost: 50, blurb: "Restores full HP" },
  Antidote: { icon: "💉", cost: 40, blurb: "Cures zombie infection" },
};

export const HAND_CHOP_TIME = 5.5;
export const HAND_YIELD = 2;
export const ROD_COST = 80;

export const SELL_PRICES: Record<string, number> = {
  Wood: 4,
  "Orange Mushroom": 8,
  "Purple Mushroom": 10,
  Sunflower: 6,
  Hyacinth: 6,
  Daffodil: 6,
  Water: 2,
  Carp: 12,
  Trout: 18,
  "Golden Fish": 60,
  Carrot: 7,
  Pumpkin: 18,
  "Raw Chicken": 6,
  "Cooked Chicken": 14,
  "Raw Pork": 8,
  "Cooked Pork": 18,
  "Cooked Fish": 16,
  Egg: 5,
  "Fried Egg": 12,
  Stone: 5,
  Wool: 14,
  "Raw Steak": 15,
  "Cooked Steak": 30,
  "Raw Rabbit": 5,
  "Cooked Rabbit": 12,
  "Raw Venison": 12,
  "Cooked Venison": 24,
  Apple: 9,
  Honey: 25,
};

export const COLLECTIBLE_RESPAWN_MS = 90_000;
export const TREE_RESPAWN_MS = 120_000; // trees regrow after 2 minutes
export const ROCK_RESPAWN_MS = 150_000;

export const PICKAXE_COST = 80;
export const HAND_MINE_TIME = 7;
export const PICK_MINE_TIME = 2.5;
export const HAND_STONE_YIELD = 2;
export const PICK_STONE_YIELD = 4;
export const HELD_TORCH_COST = 60;
export const PACK_CAP = 40;

export function chestCapFor(tier: number) {
  return tier > 0 ? HOME_TIERS[Math.min(tier, HOME_TIERS.length) - 1].chestCap : 0;
}

export const SEEDS: Record<string, { cost: number; growMs: number; yieldLabel: string; yieldN: number }> = {
  "Carrot Seeds": { cost: 8, growMs: 60_000, yieldLabel: "Carrot", yieldN: 2 },
  "Pumpkin Seeds": { cost: 15, growMs: 120_000, yieldLabel: "Pumpkin", yieldN: 1 },
};

// what cooking turns things into (each cook burns 1 Wood)
export const RECIPES: Record<string, string> = {
  "Raw Chicken": "Cooked Chicken",
  "Raw Pork": "Cooked Pork",
  Carp: "Cooked Fish",
  Trout: "Cooked Fish",
  Egg: "Fried Egg",
  "Raw Steak": "Cooked Steak",
  "Raw Rabbit": "Cooked Rabbit",
  "Raw Venison": "Cooked Venison",
};

// eating: hp/energy/hunger restored, and the infection risk of eating it raw
export const FOODS: Record<string, { hp: number; energy: number; hunger: number; infect?: number }> = {
  "Raw Chicken": { hp: 4, energy: 5, hunger: 8, infect: 0.6 },
  "Cooked Chicken": { hp: 25, energy: 15, hunger: 30 },
  "Raw Pork": { hp: 5, energy: 5, hunger: 10, infect: 0.25 },
  "Cooked Pork": { hp: 30, energy: 12, hunger: 35 },
  "Cooked Fish": { hp: 20, energy: 10, hunger: 25 },
  Carrot: { hp: 8, energy: 8, hunger: 12 },
  Pumpkin: { hp: 15, energy: 15, hunger: 20 },
  Egg: { hp: 3, energy: 3, hunger: 5, infect: 0.1 },
  "Fried Egg": { hp: 15, energy: 10, hunger: 20 },
  "Orange Mushroom": { hp: 5, energy: 5, hunger: 8 },
  "Purple Mushroom": { hp: 5, energy: 5, hunger: 8 },
  "Raw Steak": { hp: 6, energy: 5, hunger: 10, infect: 0.2 },
  "Cooked Steak": { hp: 35, energy: 15, hunger: 40 },
  "Raw Rabbit": { hp: 4, energy: 4, hunger: 6, infect: 0.3 },
  "Cooked Rabbit": { hp: 14, energy: 8, hunger: 18 },
  "Raw Venison": { hp: 5, energy: 5, hunger: 8, infect: 0.2 },
  "Cooked Venison": { hp: 28, energy: 12, hunger: 35 },
  Apple: { hp: 10, energy: 8, hunger: 14 },
  Honey: { hp: 18, energy: 20, hunger: 18 },
};

// ---- homestead extras ----

export const DOG_COST = 200;

// ---- the house: five upgrade levels, each with a real perk ----

export const HOUSE_LEVELS = [
  { name: "Log Cabin", icon: "🛖", acorns: 0, wood: 0, stone: 0, perk: "A humble roof over your head" },
  { name: "Timber Cottage", icon: "🏠", acorns: 400, wood: 20, stone: 0, perk: "Sleep through the night — rest at your door after dusk" },
  { name: "Stone Farmhouse", icon: "🏡", acorns: 900, wood: 30, stone: 20, perk: "Crops grow 20% faster" },
  { name: "Hunter's Lodge", icon: "🏕️", acorns: 1600, wood: 50, stone: 35, perk: "Pens, hives & orchard produce 20% faster" },
  { name: "Wildwood Manor", icon: "🏰", acorns: 3000, wood: 80, stone: 60, perk: `Earn 150 🌰 rent — collect at your door every day` },
];

export const RENT_AMOUNT = 150;
export const RENT_INTERVAL_MS = DAY_LENGTH_S * 1000; // once per in-game day

// ---- the orchard: plant apple trees behind the house (land tier 4+) ----

export const ORCHARD_COST = { acorns: 120, wood: 4 };
export const APPLE_GROW_MS = 240_000; // sapling matures in 4 minutes
export const APPLE_INTERVAL_MS = 300_000; // then one apple every 5 minutes
export const ORCHARD_STORE_CAP = 6;

export type OrchardTree = { plantedAt: number; lastCollect: number };

// ---- beehives: slow, valuable honey (land tier 5+) ----

export const HIVE_COST = { acorns: 200, wood: 10 };
export const HONEY_INTERVAL_MS = 420_000; // one honey every 7 minutes
export const HIVE_STORE_CAP = 4;

export type Hive = { builtAt: number; lastCollect: number };

// ---- farm pens: pick an animal per pen, they produce while you play ----

export type PenAnimal = "chicken" | "sheep" | "pig" | "cow";
export type Pen = { animal: PenAnimal; count: number; lastCollect: number };

export const PEN_BUILD_COST = { acorns: 100, wood: 8 };
export const MAX_PER_PEN = 4;
export const PEN_STORE_CAP = 8; // max uncollected produce per animal pen

export const PEN_DEFS: Record<PenAnimal, {
  label: string; icon: string; animalCost: number; product: string;
  productIcon: string; intervalMs: number; blurb: string;
}> = {
  chicken: { label: "Chickens", icon: "🐔", animalCost: 40, product: "Egg", productIcon: "🥚", intervalMs: 240_000, blurb: "Lay eggs — fry them or sell them" },
  sheep: { label: "Sheep", icon: "🐑", animalCost: 80, product: "Wool", productIcon: "🧶", intervalMs: 360_000, blurb: "Grow wool, sheared automatically" },
  pig: { label: "Pigs", icon: "🐖", animalCost: 100, product: "Raw Pork", productIcon: "🥓", intervalMs: 480_000, blurb: "Provide pork for the furnace" },
  cow: { label: "Cows", icon: "🐄", animalCost: 150, product: "Raw Steak", productIcon: "🥩", intervalMs: 600_000, blurb: "The best meat in the forest" },
};

export type Structure = { id: number; type: string; x: number; z: number };

export const BUILDABLES: Record<string, { label: string; icon: string; wood: number; stone: number; acorns: number; blurb: string }> = {
  path: { label: "Stone Path", icon: "🟫", wood: 0, stone: 2, acorns: 0, blurb: "A paved tile for walkways" },
  torch: { label: "Torch", icon: "🕯️", wood: 1, stone: 0, acorns: 5, blurb: "Lights your land at night" },
  flowerbed: { label: "Flower Bed", icon: "🌸", wood: 2, stone: 0, acorns: 10, blurb: "A splash of colour" },
  barn: { label: "Barn", icon: "🛖", wood: 30, stone: 15, acorns: 200, blurb: "A grand red barn" },
};

export const MAX_STRUCTURES = 30;

// ---- character appearance ----

export type Appearance = {
  skin: number; // index into SKIN_TONES
  hair: "none" | "short" | "long";
  hairColor: number; // index into HAIR_COLORS
  beard: boolean;
  accessory: "none" | "glasses" | "scarf";
};

export const SKIN_TONES = ["#d9a87a", "#b5805a", "#8a5a3c"];
export const HAIR_COLORS = ["#4a3520", "#1e1a16", "#c9a84c", "#8a3c28"];

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 0,
  hair: "short",
  hairColor: 0,
  beard: false,
  accessory: "none",
};

export const ANIMAL_DROPS: Record<"chicken" | "boar" | "rabbit" | "deer", { label: string; min: number; max: number; xp: number }> = {
  chicken: { label: "Raw Chicken", min: 1, max: 2, xp: 12 },
  boar: { label: "Raw Pork", min: 2, max: 3, xp: 18 },
  rabbit: { label: "Raw Rabbit", min: 1, max: 1, xp: 10 },
  deer: { label: "Raw Venison", min: 2, max: 3, xp: 20 },
};

const FISH_TABLE: { label: string; weight: number }[] = [
  { label: "Carp", weight: 60 },
  { label: "Trout", weight: 32 },
  { label: "Golden Fish", weight: 8 },
];

function rollFish(): string {
  let r = Math.random() * 100;
  for (const f of FISH_TABLE) {
    if ((r -= f.weight) <= 0) return f.label;
  }
  return "Carp";
}

export function rankFor(level: number): string {
  if (level >= 20) return "Forest Legend";
  if (level >= 16) return "Warden";
  if (level >= 12) return "Ranger";
  if (level >= 8) return "Hunter";
  if (level >= 5) return "Woodsman";
  if (level >= 3) return "Forager";
  return "Drifter";
}

// ---- exchange: daily NPC offers ----

export type Offer = {
  id: string;
  npc: string;
  type: "buy" | "sell"; // buy = NPC buys FROM the player at a premium
  item: string;
  qty: number;
  price: number;
};

const NPCS = ["MossyOak", "FernGully", "BarkBeetle", "OwlEyes", "PineSap"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayOffers(day: number): Offer[] {
  const r = mulberry32(day * 7919 + 11);
  const items = Object.keys(SELL_PRICES);
  const offers: Offer[] = [];
  for (let i = 0; i < 3; i++) {
    const type: "buy" | "sell" = i < 2 ? "buy" : "sell";
    const item = items[Math.floor(r() * items.length)];
    const qty = 2 + Math.floor(r() * 5);
    const base = SELL_PRICES[item] * qty;
    const price = type === "buy" ? Math.ceil(base * (1.4 + r() * 0.4)) : Math.floor(base * 0.7);
    offers.push({ id: `${day}-${i}`, npc: NPCS[Math.floor(r() * NPCS.length)], type, item, qty, price });
  }
  return offers;
}

const QUESTS: Quest[] = [
  { id: "leave-glade", title: "Leave the Glade", desc: "Head out through a gap in the fence into the wild.", goal: 1, progress: 0, done: false, xp: 40, acorns: 10 },
  { id: "forage-mushrooms", title: "Mushroom Forager", desc: "Collect 5 wild mushrooms from the northern grove.", goal: 5, progress: 0, done: false, xp: 80, acorns: 25 },
  { id: "timber", title: "Timber!", desc: "Chop down 2 trees with your bare hands. Click a tree to start chopping.", goal: 2, progress: 0, done: false, xp: 80, acorns: 20 },
  { id: "pick-flowers", title: "Meadow Florist", desc: "Pick 3 flowers from the southern meadow.", goal: 3, progress: 0, done: false, xp: 60, acorns: 20 },
  { id: "buy-axe", title: "Tooled Up", desc: "Sell your goods at the Trading Post and buy an axe.", goal: 1, progress: 0, done: false, xp: 100, acorns: 0 },
  { id: "go-fish", title: "Gone Fishing", desc: "Buy a fishing rod, stand by the river and press F. Catch 2 fish.", goal: 2, progress: 0, done: false, xp: 90, acorns: 25 },
  { id: "cross-bridge", title: "Cross the Old Bridge", desc: "Cross the river east of camp — only the bridge will get you over.", goal: 1, progress: 0, done: false, xp: 50, acorns: 15 },
  { id: "return-camp", title: "Back to Camp", desc: "Return to the campfire and warm up.", goal: 1, progress: 0, done: false, xp: 70, acorns: 30 },
  { id: "night-watch", title: "Night Watch", desc: "Zombies rise after dark. Put 3 of them back in the ground — click one to attack.", goal: 3, progress: 0, done: false, xp: 150, acorns: 50 },
  { id: "buy-plot", title: "Land Owner", desc: "Buy your own homestead at the 🏡 gate near camp — your private land, away from the forest.", goal: 1, progress: 0, done: false, xp: 120, acorns: 0 },
  { id: "harvest", title: "Green Thumb", desc: "Buy seeds at the Trading Post, plant them on your homestead, and harvest 3 crops.", goal: 3, progress: 0, done: false, xp: 100, acorns: 30 },
  { id: "cook", title: "Home Cooking", desc: "Hunt an animal and cook its meat in your homestead furnace (each cook burns 1 Wood).", goal: 1, progress: 0, done: false, xp: 100, acorns: 25 },
];

let toastId = 0;

type GameState = {
  name: string;
  started: boolean;
  muted: boolean;

  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  hunger: number;
  maxHunger: number;
  xp: number;
  level: number;
  acorns: number;
  axe: AxeTier | null;
  rod: boolean;
  weapon: WeaponTier | null;
  armor: ArmorTier | null;
  shirt: string;
  ownedShirts: string[];
  hat: string | null;
  ownedHats: string[];
  appearance: Appearance;
  infected: boolean;
  inventory: Record<string, number>;

  collected: Record<string, number>;
  choppedAt: Record<string, number>;
  minedAt: Record<string, number>; // rock id -> mined at (ms)
  chopTargetId: string | null;
  mineTargetId: string | null;
  pickaxe: boolean;
  heldTorch: boolean;
  spectator: boolean;
  attackTargetId: number | null;
  animalTargetId: string | null;
  fishingState: "idle" | "waiting" | "bite";
  hurtAt: number;
  lastPlayerHit: { amount: number; at: number } | null;
  lastHit: { id: number; key: string; amount: number; crit: boolean; at: number } | null;
  acceptedOffers: string[];
  homeTier: number; // 0 = no land owned
  houseLevel: number; // index+1 into HOUSE_LEVELS
  lastRentAt: number;
  location: "forest" | "home" | "visit" | "interior";
  savedForestPos: { x: number; z: number } | null;
  account: { name: string; wallet?: string } | null;
  visitData: {
    name: string;
    homeTier: number;
    houseLevel?: number;
    structures: Structure[];
    farm: Record<string, { seed: string; at: number }>;
    pens: Record<string, Pen>;
    orchard?: Record<string, OrchardTree>;
    hives?: Record<string, Hive>;
  } | null;
  chest: Record<string, number>;
  farm: Record<string, { seed: string; at: number }>;
  dog: boolean;
  pens: Record<string, Pen>; // key = pen spot index
  orchard: Record<string, OrchardTree>; // key = orchard spot index
  hives: Record<string, Hive>; // key = hive spot index
  structures: Structure[];
  buildMode: string | null; // buildable key, or "remove"

  quests: Quest[];
  zone: string;
  banner: string | null;
  toasts: Toast[];
  nearInteract: Interact | null;
  nearWater: boolean;
  openShop: ShopId | null;
  openPanel: "chest" | "furnace" | "house" | null;
  openPen: number | null;
  homeOffer: "buy" | "extend" | null;
  showQuests: boolean;
  showHelp: boolean;

  xpToLevel: () => number;
  chopTime: () => number;
  packCount: () => number;
  gainItem: (label: string, n: number) => number; // returns how many actually fit
  combatProfile: () => CombatProfile;
  registerHit: (key: string, amount: number, crit: boolean) => void;
  start: (name: string) => void;
  setAppearance: (a: Appearance) => void;
  addToast: (text: string) => void;
  setBanner: (text: string) => void;
  addXp: (amount: number) => void;
  collectItem: (id: string, label: string, kind: string) => void;
  setChopTarget: (id: string | null) => void;
  chopComplete: (treeId: string) => void;
  respawnTree: (treeId: string) => void;
  setMineTarget: (id: string | null) => void;
  mineTime: () => number;
  mineComplete: (rockId: string) => void;
  respawnRock: (rockId: string) => void;
  buyPickaxe: () => void;
  buyHeldTorch: () => void;
  setSpectator: (on: boolean) => void;
  setAttackTarget: (id: number | null) => void;
  setAnimalTarget: (id: string | null) => void;
  zombieKilled: () => void;
  animalKilled: (kind: "chicken" | "boar" | "rabbit" | "deer") => void;
  hurt: (dmg: number, canInfect?: boolean) => void;
  buyHomestead: () => void;
  extendHomestead: () => void;
  travel: (to: "forest" | "home") => void;
  enterHouse: () => void;
  exitHouse: () => void;
  startVisit: (data: GameState["visitData"]) => void;
  buyDog: () => void;
  buildPen: (idx: number, animal: PenAnimal) => void;
  addPenAnimal: (idx: number) => void;
  penPending: (idx: number) => number;
  collectPen: (idx: number) => void;
  growMsFor: (seed: string) => number;
  produceFactor: () => number;
  upgradeHouse: () => void;
  sleepTillDawn: () => void;
  rentReady: () => boolean;
  collectRent: () => void;
  plantOrchardTree: (idx: number) => void;
  orchardPending: (idx: number) => number;
  collectOrchard: (idx: number) => void;
  buildHive: (idx: number) => void;
  hivePending: (idx: number) => number;
  collectHive: (idx: number) => void;
  setBuildMode: (mode: string | null) => void;
  placeStructure: (x: number, z: number) => void;
  removeStructure: (id: number) => void;
  plantSeed: (tileKey: string) => void;
  harvestTile: (tileKey: string) => void;
  chestMove: (label: string, qty: number, toChest: boolean) => void;
  cookItem: (rawLabel: string) => void;
  setFishingState: (s: "idle" | "waiting" | "bite") => void;
  catchFish: () => void;
  collectWater: () => void;
  buyAxe: (tier: AxeTier) => void;
  buyRod: () => void;
  buyWeapon: (tier: WeaponTier) => void;
  buyArmor: (tier: ArmorTier) => void;
  buyShirt: (key: string) => void;
  buyHat: (key: string) => void;
  buyMed: (label: string) => void;
  useItem: (label: string) => void;
  acceptOffer: (offer: Offer) => void;
  sellItem: (label: string, qty: number) => void;
  questEvent: (questId: string) => void;
  setZone: (zone: string) => void;
  setNearInteract: (i: Interact | null) => void;
  setNearWater: (near: boolean) => void;
  tick: (dtSeconds: number, moving: boolean, nearCamp: boolean, sprinting: boolean, working: boolean) => void;
  setOpenShop: (id: ShopId | null) => void;
  setOpenPanel: (p: "chest" | "furnace" | "house" | null) => void;
  setOpenPen: (idx: number | null) => void;
  setHomeOffer: (o: "buy" | "extend" | null) => void;
  toggleQuests: () => void;
  toggleHelp: () => void;
  toggleMute: () => void;
  closeModals: () => void;
};

function spend(s: { acorns: number; addToast: (t: string) => void }, cost: number): boolean {
  if (s.acorns < cost) {
    s.addToast("Not enough acorns!");
    sfx.error();
    return false;
  }
  return true;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      name: "",
      started: false,
      muted: false,

      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      hunger: 100,
      maxHunger: 100,
      xp: 0,
      level: 1,
      acorns: 1000, // generous starting purse for testing the economy
      axe: null,
      rod: false,
      weapon: null,
      armor: null,
      shirt: "green",
      ownedShirts: ["green"],
      hat: null,
      ownedHats: [],
      appearance: DEFAULT_APPEARANCE,
      infected: false,
      inventory: {},

      collected: {},
      choppedAt: {},
      minedAt: {},
      chopTargetId: null,
      mineTargetId: null,
      pickaxe: false,
      heldTorch: false,
      spectator: false,
      attackTargetId: null,
      animalTargetId: null,
      fishingState: "idle",
      hurtAt: 0,
      lastPlayerHit: null,
      lastHit: null,
      acceptedOffers: [],
      homeTier: 0,
      houseLevel: 1,
      lastRentAt: 0,
      location: "forest",
      savedForestPos: null,
      account: null,
      visitData: null,
      chest: {},
      farm: {},
      dog: false,
      pens: {},
      orchard: {},
      hives: {},
      structures: [],
      buildMode: null,

      quests: QUESTS,
      zone: "The Glade",
      banner: null,
      toasts: [],
      nearInteract: null,
      nearWater: false,
      openShop: null,
      openPanel: null,
      openPen: null,
      homeOffer: null,
      showQuests: false,
      showHelp: false,

      xpToLevel: () => get().level * 100,
      chopTime: () => (get().axe ? AXES[get().axe!].chopTime : HAND_CHOP_TIME),
      combatProfile: () => {
        const s = get();
        if (s.weapon) return COMBAT[s.weapon];
        return s.axe ? COMBAT.axe : COMBAT.fists;
      },
      registerHit: (key, amount, crit) => {
        set((s) => ({
          lastHit: { id: (s.lastHit?.id ?? 0) + 1, key, amount, crit, at: Date.now() },
        }));
      },

      packCount: () => Object.values(get().inventory).reduce((a, n) => a + n, 0),

      gainItem: (label, n) => {
        const s = get();
        const space = PACK_CAP - s.packCount();
        const add = Math.max(0, Math.min(n, space));
        if (add > 0) {
          set({ inventory: { ...s.inventory, [label]: (s.inventory[label] ?? 0) + add } });
        }
        if (add < n) {
          s.addToast("🎒 Pack full! Store things in a chest");
          sfx.error();
        }
        return add;
      },

      start: (name) => {
        sfx.unlock();
        set({ name: name.trim() || "Wanderer", started: true });
      },

      setAppearance: (a) => set({ appearance: a }),

      addToast: (text) => {
        const id = ++toastId;
        set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text }] }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3500);
      },

      setBanner: (text) => {
        set({ banner: text });
        setTimeout(() => {
          set((s) => (s.banner === text ? { banner: null } : s));
        }, 4000);
      },

      addXp: (amount) => {
        let { xp, level } = get();
        xp += amount;
        let cap = level * 100;
        let leveled = false;
        while (xp >= cap) {
          xp -= cap;
          level += 1;
          cap = level * 100;
          leveled = true;
        }
        if (leveled) {
          const newMaxHp = 100 + (level - 1) * 10;
          const oldRank = rankFor(get().level);
          const newRank = rankFor(level);
          set({ xp, level, maxHp: newMaxHp, hp: newMaxHp, energy: get().maxEnergy });
          get().setBanner(
            newRank !== oldRank
              ? `Rank up! You are now a ${newRank} (Lv ${level})`
              : `Level up! You are now level ${level}`
          );
          sfx.levelUp();
        } else {
          set({ xp });
        }
      },

      collectItem: (id, label, kind) => {
        const s = get();
        const at = s.collected[id];
        if (at && Date.now() - at < COLLECTIBLE_RESPAWN_MS) return;
        if (s.gainItem(label, 1) < 1) return; // pack full — leave it in the world
        set({ collected: { ...get().collected, [id]: Date.now() } });
        s.addToast(`+1 ${label} · +10 XP`);
        sfx.pickup();
        s.addXp(10);
        const questId = kind === "mushroom" ? "forage-mushrooms" : kind === "flower" ? "pick-flowers" : null;
        if (questId) get().questEvent(questId);
      },

      setChopTarget: (id) => {
        if (get().chopTargetId !== id) set({ chopTargetId: id, mineTargetId: null, attackTargetId: null });
      },

      setMineTarget: (id) => {
        if (get().mineTargetId !== id) set({ mineTargetId: id, chopTargetId: null, attackTargetId: null });
      },

      mineTime: () => (get().pickaxe ? PICK_MINE_TIME : HAND_MINE_TIME),

      mineComplete: (rockId) => {
        const s = get();
        if (s.minedAt[rockId]) return;
        const yieldN = s.pickaxe ? PICK_STONE_YIELD : HAND_STONE_YIELD;
        const got = s.gainItem("Stone", yieldN);
        set({
          minedAt: { ...get().minedAt, [rockId]: Date.now() },
          mineTargetId: null,
        });
        sfx.treeFall();
        if (got > 0) s.addToast(`+${got} Stone · +15 XP`);
        s.addXp(15);
      },

      respawnRock: (rockId) => {
        const next = { ...get().minedAt };
        delete next[rockId];
        set({ minedAt: next });
      },

      buyPickaxe: () => {
        const s = get();
        if (s.pickaxe) return;
        if (!spend(s, PICKAXE_COST)) return;
        set({ acorns: s.acorns - PICKAXE_COST, pickaxe: true });
        sfx.buy();
        s.addToast("⛏️ Pickaxe bought — mining is much faster now");
      },

      buyHeldTorch: () => {
        const s = get();
        if (s.heldTorch) return;
        if (!spend(s, HELD_TORCH_COST)) return;
        set({ acorns: s.acorns - HELD_TORCH_COST, heldTorch: true });
        sfx.buy();
        s.addToast("🔥 Hand torch bought — it lights itself after dark");
      },

      setSpectator: (on) => set({ spectator: on }),

      chopComplete: (treeId) => {
        const s = get();
        if (s.choppedAt[treeId]) return;
        const yieldN = s.axe ? AXES[s.axe].yield : HAND_YIELD;
        const got = s.gainItem("Wood", yieldN);
        set({
          choppedAt: { ...get().choppedAt, [treeId]: Date.now() },
          chopTargetId: null,
        });
        sfx.treeFall();
        if (got > 0) s.addToast(`+${got} Wood · +15 XP`);
        s.addXp(15);
        get().questEvent("timber");
      },

      respawnTree: (treeId) => {
        const next = { ...get().choppedAt };
        delete next[treeId];
        set({ choppedAt: next });
      },

      setAttackTarget: (id) => {
        if (get().attackTargetId !== id) set({ attackTargetId: id, chopTargetId: null });
      },

      zombieKilled: () => {
        const s = get();
        const blood = isBloodMoonNight();
        const loot = (5 + Math.floor(Math.random() * 11)) * (blood ? 2 : 1);
        const extra = Math.random() < 0.25 ? "Purple Mushroom" : null;
        if (extra) s.gainItem(extra, 1);
        set({ acorns: get().acorns + loot, attackTargetId: null });
        s.addToast(`${blood ? "🔴 " : ""}Zombie slain! +25 XP · +${loot} 🌰${extra ? ` · +1 ${extra}` : ""}`);
        sfx.coin();
        s.addXp(25);
        get().questEvent("night-watch");
      },

      setAnimalTarget: (id) => {
        if (get().animalTargetId !== id) {
          set({ animalTargetId: id, attackTargetId: null, chopTargetId: null });
        }
      },

      animalKilled: (kind) => {
        const s = get();
        const drop = ANIMAL_DROPS[kind];
        const n = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        const got = s.gainItem(drop.label, n);
        set({ animalTargetId: null });
        const icon = { chicken: "🐔", boar: "🐗", rabbit: "🐇", deer: "🦌" }[kind];
        s.addToast(`${icon} +${got} ${drop.label} · +${drop.xp} XP`);
        sfx.coin();
        s.addXp(drop.xp);
      },

      buyHomestead: () => {
        const s = get();
        if (s.homeTier > 0) return;
        const tier = HOME_TIERS[0];
        if (!spend(s, tier.price)) return;
        set({ acorns: s.acorns - tier.price, homeTier: 1, homeOffer: null });
        sfx.buy();
        s.setBanner("🏡 The Homestead is yours!");
        s.addToast("Walk through the gate to visit your land");
        get().questEvent("buy-plot");
      },

      extendHomestead: () => {
        const s = get();
        if (s.homeTier < 1 || s.homeTier >= HOME_TIERS.length) return;
        const next = HOME_TIERS[s.homeTier];
        const cur = HOME_TIERS[s.homeTier - 1];
        if (!spend(s, next.price)) return;
        set({ acorns: s.acorns - next.price, homeTier: s.homeTier + 1, homeOffer: null });
        sfx.buy();
        s.setBanner(`🏡 Upgraded to the ${next.name}!`);
        const news: string[] = [`+${next.tiles - cur.tiles} farm tiles`];
        if (next.pens > cur.pens) news.push(`+${next.pens - cur.pens} pen${next.pens - cur.pens > 1 ? "s" : ""}`);
        if (next.orchard > cur.orchard) news.push(`+${next.orchard - cur.orchard} orchard plot${next.orchard - cur.orchard > 1 ? "s" : ""}`);
        if (next.hives > cur.hives) news.push("+1 beehive spot");
        if (next.well && !cur.well) news.push("a well 💧");
        if (next.pond && !cur.pond) news.push("a fishing pond 🎣");
        if (next.windmill && !cur.windmill) news.push("the windmill 🌬️");
        s.addToast(news.join(" · "));
      },

      buyDog: () => {
        const s = get();
        if (s.dog) return;
        if (!spend(s, DOG_COST)) return;
        set({ acorns: s.acorns - DOG_COST, dog: true });
        sfx.buy();
        s.setBanner("🐕 You adopted a dog! He'll fight by your side");
      },

      buildPen: (idx, animal) => {
        const s = get();
        if (s.pens[idx] || s.homeTier < 1) return;
        const def = PEN_DEFS[animal];
        const totalAcorns = PEN_BUILD_COST.acorns + def.animalCost;
        if ((s.inventory.Wood ?? 0) < PEN_BUILD_COST.wood) {
          s.addToast(`You need ${PEN_BUILD_COST.wood} Wood for the fencing 🪵`);
          sfx.error();
          return;
        }
        if (!spend(s, totalAcorns)) return;
        const inv = { ...s.inventory };
        if (inv.Wood - PEN_BUILD_COST.wood <= 0) delete inv.Wood;
        else inv.Wood -= PEN_BUILD_COST.wood;
        set({
          acorns: s.acorns - totalAcorns,
          inventory: inv,
          pens: { ...s.pens, [idx]: { animal, count: 1, lastCollect: Date.now() } },
        });
        sfx.buy();
        s.setBanner(`${def.icon} ${def.label} moved onto your farm!`);
      },

      addPenAnimal: (idx) => {
        const s = get();
        const pen = s.pens[idx];
        if (!pen || pen.count >= MAX_PER_PEN) return;
        const def = PEN_DEFS[pen.animal];
        if (!spend(s, def.animalCost)) return;
        // bank what's been produced so far, then restart the clock
        if (get().penPending(idx) > 0) get().collectPen(idx);
        const cur = get().pens[idx];
        set({
          acorns: get().acorns - def.animalCost,
          pens: { ...get().pens, [idx]: { ...cur, count: cur.count + 1, lastCollect: Date.now() } },
        });
        sfx.buy();
        get().addToast(`${def.icon} +1 (${cur.count + 1}/${MAX_PER_PEN})`);
      },

      penPending: (idx) => {
        const pen = get().pens[idx];
        if (!pen || pen.count < 1) return 0;
        const def = PEN_DEFS[pen.animal];
        const interval = def.intervalMs * get().produceFactor();
        return Math.min(
          PEN_STORE_CAP,
          Math.floor(((Date.now() - pen.lastCollect) / interval) * pen.count)
        );
      },

      collectPen: (idx) => {
        const s = get();
        const pen = s.pens[idx];
        if (!pen) return;
        const def = PEN_DEFS[pen.animal];
        const n = s.penPending(idx);
        if (n < 1) {
          s.addToast(`Nothing ready yet — check back later ${def.productIcon}`);
          return;
        }
        const got = s.gainItem(def.product, n);
        if (got < 1) return;
        set({ pens: { ...get().pens, [idx]: { ...pen, lastCollect: Date.now() } } });
        s.addToast(`${def.productIcon} Collected ${got} ${def.product} · +${4 * got} XP`);
        sfx.pickup();
        s.addXp(4 * got);
      },

      // a Stone Farmhouse tends the fields; a Hunter's Lodge tends the beasts
      growMsFor: (seed) => SEEDS[seed].growMs * (get().houseLevel >= 3 ? 0.8 : 1),
      produceFactor: () => (get().houseLevel >= 4 ? 0.8 : 1),

      upgradeHouse: () => {
        const s = get();
        if (s.homeTier < 1 || s.houseLevel >= HOUSE_LEVELS.length) return;
        const next = HOUSE_LEVELS[s.houseLevel];
        if ((s.inventory.Wood ?? 0) < next.wood) {
          s.addToast(`Needs ${next.wood} Wood 🪵`);
          sfx.error();
          return;
        }
        if ((s.inventory.Stone ?? 0) < next.stone) {
          s.addToast(`Needs ${next.stone} Stone 🪨`);
          sfx.error();
          return;
        }
        if (!spend(s, next.acorns)) return;
        const inv = { ...s.inventory };
        for (const [mat, cost] of [["Wood", next.wood], ["Stone", next.stone]] as const) {
          if (cost > 0) {
            if (inv[mat] - cost <= 0) delete inv[mat];
            else inv[mat] -= cost;
          }
        }
        set({ acorns: s.acorns - next.acorns, inventory: inv, houseLevel: s.houseLevel + 1 });
        sfx.levelUp();
        s.setBanner(`${next.icon} Your house is now a ${next.name}!`);
        s.addToast(next.perk);
      },

      sleepTillDawn: () => {
        const s = get();
        if (s.houseLevel < 2) {
          s.addToast("You need a Timber Cottage to sleep the night away 🛏️");
          return;
        }
        if (!isNight()) {
          s.addToast("You're not tired yet — come back after dusk 🌙");
          return;
        }
        if (clock.timeOfDay > 0.5) clock.day += 1; // sleeping past midnight starts a new day
        clock.timeOfDay = 0.26; // just past dawn
        set({
          energy: s.maxEnergy,
          hp: Math.min(s.maxHp, s.hp + 30),
          openPanel: null,
        });
        sfx.questDone();
        s.setBanner("☀️ You slept soundly till dawn");
      },

      rentReady: () => {
        const s = get();
        return s.houseLevel >= HOUSE_LEVELS.length && Date.now() - s.lastRentAt >= RENT_INTERVAL_MS;
      },

      collectRent: () => {
        const s = get();
        if (!s.rentReady()) {
          const mins = Math.ceil((RENT_INTERVAL_MS - (Date.now() - s.lastRentAt)) / 60000);
          s.addToast(`Rent isn't due yet — about ${mins} min to go 💰`);
          return;
        }
        set({ acorns: s.acorns + RENT_AMOUNT, lastRentAt: Date.now() });
        sfx.coin();
        s.addToast(`💰 Collected ${RENT_AMOUNT} 🌰 rent from your tenants`);
      },

      plantOrchardTree: (idx) => {
        const s = get();
        if (s.orchard[idx] || s.homeTier < 1) return;
        if ((s.inventory.Wood ?? 0) < ORCHARD_COST.wood) {
          s.addToast(`You need ${ORCHARD_COST.wood} Wood for the stakes 🪵`);
          sfx.error();
          return;
        }
        if (!spend(s, ORCHARD_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Wood - ORCHARD_COST.wood <= 0) delete inv.Wood;
        else inv.Wood -= ORCHARD_COST.wood;
        set({
          acorns: s.acorns - ORCHARD_COST.acorns,
          inventory: inv,
          orchard: { ...s.orchard, [idx]: { plantedAt: Date.now(), lastCollect: Date.now() } },
        });
        sfx.buy();
        s.addToast("🌳 Apple sapling planted — it'll bear fruit once it's grown");
      },

      orchardPending: (idx) => {
        const tree = get().orchard[idx];
        if (!tree) return 0;
        const factor = get().produceFactor();
        const grownAt = tree.plantedAt + APPLE_GROW_MS * factor;
        const since = Date.now() - Math.max(tree.lastCollect, grownAt);
        if (since <= 0) return 0;
        return Math.min(ORCHARD_STORE_CAP, Math.floor(since / (APPLE_INTERVAL_MS * factor)));
      },

      collectOrchard: (idx) => {
        const s = get();
        const tree = s.orchard[idx];
        if (!tree) return;
        const n = s.orchardPending(idx);
        if (n < 1) {
          const grown = Date.now() >= tree.plantedAt + APPLE_GROW_MS * s.produceFactor();
          s.addToast(grown ? "No apples ready yet 🍎" : "Still growing — give it time 🌱");
          return;
        }
        const got = s.gainItem("Apple", n);
        if (got < 1) return;
        set({ orchard: { ...get().orchard, [idx]: { ...tree, lastCollect: Date.now() } } });
        s.addToast(`🍎 Picked ${got} Apple${got > 1 ? "s" : ""} · +${4 * got} XP`);
        sfx.pickup();
        s.addXp(4 * got);
      },

      buildHive: (idx) => {
        const s = get();
        if (s.hives[idx] || s.homeTier < 1) return;
        if ((s.inventory.Wood ?? 0) < HIVE_COST.wood) {
          s.addToast(`You need ${HIVE_COST.wood} Wood for the hive box 🪵`);
          sfx.error();
          return;
        }
        if (!spend(s, HIVE_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Wood - HIVE_COST.wood <= 0) delete inv.Wood;
        else inv.Wood -= HIVE_COST.wood;
        set({
          acorns: s.acorns - HIVE_COST.acorns,
          inventory: inv,
          hives: { ...s.hives, [idx]: { builtAt: Date.now(), lastCollect: Date.now() } },
        });
        sfx.buy();
        s.setBanner("🐝 The bees have moved in!");
      },

      hivePending: (idx) => {
        const hive = get().hives[idx];
        if (!hive) return 0;
        const interval = HONEY_INTERVAL_MS * get().produceFactor();
        return Math.min(HIVE_STORE_CAP, Math.floor((Date.now() - hive.lastCollect) / interval));
      },

      collectHive: (idx) => {
        const s = get();
        const hive = s.hives[idx];
        if (!hive) return;
        const n = s.hivePending(idx);
        if (n < 1) {
          s.addToast("The bees are still busy — no honey yet 🐝");
          return;
        }
        const got = s.gainItem("Honey", n);
        if (got < 1) return;
        set({ hives: { ...get().hives, [idx]: { ...hive, lastCollect: Date.now() } } });
        s.addToast(`🍯 Collected ${got} Honey · +${6 * got} XP`);
        sfx.pickup();
        s.addXp(6 * got);
      },

      setBuildMode: (mode) => {
        set({ buildMode: mode, openShop: null, openPanel: null, homeOffer: null, showQuests: false, showHelp: false });
        if (mode) sfx.ui();
      },

      placeStructure: (x, z) => {
        const s = get();
        const def = s.buildMode ? BUILDABLES[s.buildMode] : null;
        if (!def || !s.buildMode) return;
        if (s.structures.length >= MAX_STRUCTURES) {
          s.addToast(`Limit of ${MAX_STRUCTURES} structures reached`);
          sfx.error();
          return;
        }
        const minGap = s.buildMode === "barn" ? 3.5 : 1.4;
        const clash = s.structures.some((st) => Math.hypot(st.x - x, st.z - z) < minGap);
        if (clash) {
          s.addToast("Too close to another structure");
          return;
        }
        if ((s.inventory.Wood ?? 0) < def.wood) {
          s.addToast(`Needs ${def.wood} Wood 🪵`);
          sfx.error();
          return;
        }
        if ((s.inventory.Stone ?? 0) < def.stone) {
          s.addToast(`Needs ${def.stone} Stone 🪨`);
          sfx.error();
          return;
        }
        if (s.acorns < def.acorns) {
          s.addToast(`Needs ${def.acorns} acorns 🌰`);
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const [mat, cost] of [["Wood", def.wood], ["Stone", def.stone]] as const) {
          if (cost > 0) {
            if (inv[mat] - cost <= 0) delete inv[mat];
            else inv[mat] -= cost;
          }
        }
        set({
          inventory: inv,
          acorns: s.acorns - def.acorns,
          structures: [...s.structures, { id: Date.now() + Math.floor(Math.random() * 1000), type: s.buildMode, x, z }],
        });
        sfx.buy();
      },

      removeStructure: (id) => {
        const s = get();
        const st = s.structures.find((x) => x.id === id);
        if (!st) return;
        const def = BUILDABLES[st.type];
        const refundWood = Math.floor(def.wood / 2);
        const refundStone = Math.floor(def.stone / 2);
        if (refundWood > 0) s.gainItem("Wood", refundWood);
        if (refundStone > 0) s.gainItem("Stone", refundStone);
        set({ structures: get().structures.filter((x) => x.id !== id) });
        s.addToast(`Removed ${def.label}`);
        sfx.ui();
      },

      enterHouse: () => {
        const s = get();
        if (s.homeTier < 1 || s.location !== "home") return;
        const { hd } = interiorDims(s.houseLevel);
        const lv = Math.max(1, Math.min(s.houseLevel, HOUSE_LEVELS.length));
        set({
          location: "interior",
          zone: `🏠 ${HOUSE_LEVELS[lv - 1].name}`,
          buildMode: null,
          fishingState: "idle",
          openShop: null,
          openPanel: null,
          openPen: null,
        });
        teleport.x = 0;
        teleport.z = hd - 1.1;
        teleport.pending = true;
        sfx.questDone();
      },

      exitHouse: () => {
        const s = get();
        if (s.location !== "interior") return;
        set({ location: "home", zone: "🏡 Homestead", openPanel: null });
        teleport.x = HOME_CABIN_POS[0];
        teleport.z = HOME_CABIN_POS[2] + 2.2 + s.houseLevel * 0.25 + 0.8;
        teleport.pending = true;
        sfx.ui();
      },

      startVisit: (data) => {
        if (!data) return;
        set({
          visitData: data,
          savedForestPos: { x: live.x, z: live.z },
          location: "visit",
          zone: `🏡 ${data.name}'s land`,
          buildMode: null,
          chopTargetId: null,
          attackTargetId: null,
          animalTargetId: null,
          fishingState: "idle",
          openShop: null,
          openPanel: null,
        });
        teleport.x = 0;
        teleport.z = homeGateZ(data.homeTier) - 2;
        teleport.pending = true;
        sfx.questDone();
      },

      travel: (to) => {
        const s = get();
        set({ buildMode: null, visitData: null });
        if (to === "home") {
          if (s.homeTier < 1) return;
          set({
            savedForestPos: { x: live.x, z: live.z },
            location: "home",
            zone: "🏡 Homestead",
            chopTargetId: null,
            attackTargetId: null,
            animalTargetId: null,
            fishingState: "idle",
          });
          teleport.x = 0;
          teleport.z = homeGateZ(s.homeTier) - 2;
        } else {
          const p = s.savedForestPos ?? { x: HOME_PORTAL_POS[0], z: HOME_PORTAL_POS[2] + 2 };
          set({ location: "forest", zone: "The Glade" });
          teleport.x = p.x;
          teleport.z = p.z;
        }
        teleport.pending = true;
        sfx.questDone();
      },

      plantSeed: (key) => {
        const s = get();
        if (s.farm[key]) return;
        const seedLabel = Object.keys(SEEDS).find((label) => (s.inventory[label] ?? 0) > 0);
        if (!seedLabel) {
          s.addToast("No seeds! Buy some at the Trading Post 🌱");
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        if (inv[seedLabel] <= 1) delete inv[seedLabel];
        else inv[seedLabel] -= 1;
        set({ inventory: inv, farm: { ...s.farm, [key]: { seed: seedLabel, at: Date.now() } } });
        s.addToast(`Planted ${seedLabel.replace(" Seeds", "")} 🌱`);
        sfx.pickup();
      },

      harvestTile: (key) => {
        const s = get();
        const crop = s.farm[key];
        if (!crop) return;
        const def = SEEDS[crop.seed];
        const growMs = s.growMsFor(crop.seed);
        if (Date.now() - crop.at < growMs) {
          const pct = Math.round(((Date.now() - crop.at) / growMs) * 100);
          s.addToast(`Still growing… ${pct}%`);
          return;
        }
        const got = s.gainItem(def.yieldLabel, def.yieldN);
        if (got < 1) return;
        const farm = { ...get().farm };
        delete farm[key];
        set({ farm });
        s.addToast(`+${got} ${def.yieldLabel} · +8 XP`);
        sfx.pickup();
        s.addXp(8);
        get().questEvent("harvest");
      },

      chestMove: (label, qty, toChest) => {
        const s = get();
        if (toChest) {
          const have = s.inventory[label] ?? 0;
          const chestCount = Object.values(s.chest).reduce((a, n) => a + n, 0);
          const n = Math.min(have, qty, chestCapFor(s.homeTier) - chestCount);
          if (n <= 0) return;
          const inv = { ...s.inventory };
          if (inv[label] - n <= 0) delete inv[label];
          else inv[label] -= n;
          set({ inventory: inv, chest: { ...s.chest, [label]: (s.chest[label] ?? 0) + n } });
        } else {
          const have = s.chest[label] ?? 0;
          const n = Math.min(have, qty, PACK_CAP - s.packCount());
          if (n <= 0) {
            s.addToast("🎒 Pack full!");
            return;
          }
          const chest = { ...s.chest };
          if (chest[label] - n <= 0) delete chest[label];
          else chest[label] -= n;
          set({ chest, inventory: { ...s.inventory, [label]: (s.inventory[label] ?? 0) + n } });
        }
        sfx.ui();
      },

      cookItem: (rawLabel) => {
        const s = get();
        const cooked = RECIPES[rawLabel];
        if (!cooked) return;
        if ((s.inventory[rawLabel] ?? 0) < 1) return;
        if ((s.inventory.Wood ?? 0) < 1) {
          s.addToast("You need 1 Wood for fuel 🪵");
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const used of [rawLabel, "Wood"]) {
          if (inv[used] <= 1) delete inv[used];
          else inv[used] -= 1;
        }
        inv[cooked] = (inv[cooked] ?? 0) + 1;
        set({ inventory: inv });
        s.addToast(`🔥 Cooked 1 ${cooked} · +5 XP`);
        sfx.pickup();
        s.addXp(5);
        get().questEvent("cook");
      },

      hurt: (dmg, canInfect = false) => {
        const s = get();
        const reduced = dmg * (1 - (s.armor ? ARMOR[s.armor].reduce : 0));
        const hp = Math.max(0, s.hp - reduced);
        sfx.playerHurt();
        if (dmg > 1) set({ lastPlayerHit: { amount: Math.round(reduced), at: Date.now() } });
        // only zombie scratches can infect — animal attacks never do
        if (canInfect && dmg > 1 && !s.infected && Math.random() < 0.22) {
          set({ infected: true });
          s.addToast("☣️ You've been infected! Get an Antidote at the Med-Bay");
          sfx.error();
        }
        if (hp <= 0) {
          const lost = Math.floor(s.acorns * 0.25);
          teleport.x = CAMPFIRE_POS[0] + 2;
          teleport.z = CAMPFIRE_POS[2] + 2;
          teleport.pending = true;
          set({
            hp: Math.round(s.maxHp * 0.5),
            energy: 40,
            hunger: Math.max(s.hunger, 30),
            acorns: s.acorns - lost,
            hurtAt: Date.now(),
            infected: false,
            location: "forest",
            attackTargetId: null,
            chopTargetId: null,
            animalTargetId: null,
          });
          s.setBanner("You blacked out… you wake by the campfire");
          if (lost > 0) s.addToast(`Lost ${lost} acorns in the dark`);
        } else {
          set({ hp, hurtAt: Date.now() });
        }
      },

      setFishingState: (fs) => {
        if (get().fishingState !== fs) set({ fishingState: fs });
      },

      catchFish: () => {
        const s = get();
        const fish = rollFish();
        set({ fishingState: "idle" });
        if (s.gainItem(fish, 1) < 1) return;
        s.addToast(fish === "Golden Fish" ? `✨ Rare catch! +1 ${fish} · +12 XP` : `+1 ${fish} · +12 XP`);
        sfx.pickup();
        s.addXp(12);
        get().questEvent("go-fish");
      },

      collectWater: () => {
        const s = get();
        if (s.gainItem("Water", 1) < 1) return;
        set({ energy: Math.min(s.maxEnergy, get().energy + 8) });
        s.addToast("+1 Water · +3 XP");
        sfx.pickup();
        s.addXp(3);
      },

      buyAxe: (tier) => {
        const s = get();
        const def = AXES[tier];
        if (s.axe === tier || (s.axe === "golden" && tier === "rusty")) return;
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, axe: tier });
        sfx.buy();
        s.addToast(`Bought the ${def.label}!`);
        get().questEvent("buy-axe");
      },

      buyRod: () => {
        const s = get();
        if (s.rod) return;
        if (!spend(s, ROD_COST)) return;
        set({ acorns: s.acorns - ROD_COST, rod: true });
        sfx.buy();
        s.addToast("Bought the Fishing Rod! Press F by the river.");
      },

      buyWeapon: (tier) => {
        const s = get();
        const order: WeaponTier[] = ["club", "spear", "sword"];
        if (s.weapon && order.indexOf(s.weapon) >= order.indexOf(tier)) return;
        const def = WEAPONS[tier];
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, weapon: tier });
        sfx.buy();
        s.addToast(`Equipped the ${def.label}! (${def.dmg} dmg)`);
      },

      buyArmor: (tier) => {
        const s = get();
        const order: ArmorTier[] = ["leather", "iron"];
        if (s.armor && order.indexOf(s.armor) >= order.indexOf(tier)) return;
        const def = ARMOR[tier];
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, armor: tier });
        sfx.buy();
        s.addToast(`Equipped the ${def.label}!`);
      },

      buyShirt: (key) => {
        const s = get();
        const def = SHIRTS[key];
        if (!def) return;
        if (s.ownedShirts.includes(key)) {
          set({ shirt: key });
          sfx.ui();
          s.addToast(`Wearing ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, ownedShirts: [...s.ownedShirts, key], shirt: key });
        sfx.buy();
        s.addToast(`Bought & wearing ${def.label}!`);
      },

      buyHat: (key) => {
        const s = get();
        if (key === "none") {
          set({ hat: null });
          sfx.ui();
          return;
        }
        const def = HATS[key];
        if (!def) return;
        if (s.ownedHats.includes(key)) {
          set({ hat: key });
          sfx.ui();
          s.addToast(`Wearing the ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, ownedHats: [...s.ownedHats, key], hat: key });
        sfx.buy();
        s.addToast(`Bought & wearing the ${def.label}!`);
      },

      buyMed: (label) => {
        const s = get();
        const def = MEDS[label] ?? (SEEDS[label] ? { cost: SEEDS[label].cost } : null);
        if (!def) return;
        if (!spend(s, def.cost)) return;
        if (s.gainItem(label, 1) < 1) return;
        set({ acorns: get().acorns - def.cost });
        sfx.buy();
        s.addToast(`Bought 1 ${label}`);
      },

      useItem: (label) => {
        const s = get();
        if (!s.inventory[label]) return;
        const consume = () => {
          const inv = { ...get().inventory };
          if (inv[label] <= 1) delete inv[label];
          else inv[label] -= 1;
          set({ inventory: inv });
        };
        if (label === "Bandage") {
          set({ hp: Math.min(s.maxHp, s.hp + 30) });
          consume();
          s.addToast("🩹 +30 HP");
          sfx.pickup();
        } else if (label === "Medkit") {
          set({ hp: s.maxHp });
          consume();
          s.addToast("🧰 Fully healed!");
          sfx.pickup();
        } else if (label === "Antidote") {
          if (!s.infected) {
            s.addToast("You're not infected — save it for later");
            return;
          }
          set({ infected: false });
          consume();
          s.addToast("💉 Infection cured!");
          sfx.questDone();
        } else if (FOODS[label]) {
          const food = FOODS[label];
          consume();
          set({
            hp: Math.min(s.maxHp, get().hp + food.hp),
            energy: Math.min(s.maxEnergy, get().energy + food.energy),
            hunger: Math.min(s.maxHunger, get().hunger + food.hunger),
          });
          sfx.pickup();
          if (food.infect && !get().infected && Math.random() < food.infect) {
            set({ infected: true });
            s.addToast(`🤢 That ${label} was a bad idea… you're infected!`);
            sfx.error();
          } else {
            s.addToast(`Ate 1 ${label} · +${food.hp} HP +${food.energy} ⚡ +${food.hunger} 🍗`);
          }
        }
      },

      acceptOffer: (offer) => {
        const s = get();
        if (s.acceptedOffers.includes(offer.id)) return;
        if (offer.type === "buy") {
          if ((s.inventory[offer.item] ?? 0) < offer.qty) {
            s.addToast(`You need ${offer.qty} ${offer.item}`);
            sfx.error();
            return;
          }
          const inv = { ...s.inventory };
          if (inv[offer.item] - offer.qty <= 0) delete inv[offer.item];
          else inv[offer.item] -= offer.qty;
          set({
            inventory: inv,
            acorns: s.acorns + offer.price,
            acceptedOffers: [...s.acceptedOffers, offer.id],
          });
          s.addToast(`Traded ${offer.qty} ${offer.item} to ${offer.npc} for ${offer.price} 🌰`);
          sfx.coin();
        } else {
          if (!spend(s, offer.price)) return;
          const got = s.gainItem(offer.item, offer.qty);
          if (got < 1) return;
          set({
            acorns: get().acorns - offer.price,
            acceptedOffers: [...get().acceptedOffers, offer.id],
          });
          s.addToast(`Bought ${got} ${offer.item} from ${offer.npc}`);
          sfx.coin();
        }
      },

      sellItem: (label, qty) => {
        const s = get();
        const have = s.inventory[label] ?? 0;
        const n = Math.min(have, qty);
        if (n <= 0) return;
        const price = SELL_PRICES[label] ?? 1;
        const inv = { ...s.inventory };
        if (have - n <= 0) delete inv[label];
        else inv[label] = have - n;
        set({ inventory: inv, acorns: s.acorns + price * n });
        sfx.coin();
        s.addToast(`Sold ${n} ${label} for ${price * n} acorns`);
      },

      questEvent: (questId) => {
        const s = get();
        const idx = s.quests.findIndex((q) => q.id === questId);
        if (idx === -1) return;
        const quest = s.quests[idx];
        if (quest.done) return;
        const activeIdx = s.quests.findIndex((q) => !q.done);
        if (idx !== activeIdx) return;

        const progress = quest.progress + 1;
        const done = progress >= quest.goal;
        const quests = s.quests.map((q, i) => (i === idx ? { ...q, progress, done } : q));
        set({ quests });
        if (done) {
          set({ acorns: get().acorns + quest.acorns });
          s.setBanner(`Quest complete — ${quest.title}`);
          sfx.questDone();
          s.addToast(`Reward: +${quest.xp} XP${quest.acorns > 0 ? ` · +${quest.acorns} 🌰` : ""}`);
          s.addXp(quest.xp);
          const next = quests.find((q) => !q.done);
          if (next) {
            setTimeout(() => get().addToast(`New quest: ${next.title}`), 1200);
          } else {
            setTimeout(() => get().setBanner("All quests complete — the forest is yours"), 4200);
          }
        }
      },

      setZone: (zone) => {
        if (get().zone !== zone) set({ zone });
      },

      setNearInteract: (i) => {
        const cur = get().nearInteract;
        const same =
          (cur === null && i === null) ||
          (cur !== null && i !== null && JSON.stringify(cur) === JSON.stringify(i));
        if (!same) set({ nearInteract: i });
      },

      setNearWater: (near) => {
        if (get().nearWater !== near) set({ nearWater: near });
      },

      tick: (dt, moving, nearCamp, sprinting, working) => {
        const s = get();
        let { energy, hp, hunger } = s;
        const starving = hunger <= 0;
        if (nearCamp) {
          // a fed body rests well — the campfire can't fix an empty stomach
          if (!starving) {
            energy = Math.min(s.maxEnergy, energy + dt * 7);
            hp = Math.min(s.maxHp, hp + dt * 4);
          }
        } else if (working) {
          energy = Math.max(0, energy - dt * 2.5);
        } else if (sprinting) {
          energy = Math.max(0, energy - dt * 5);
        } else if (moving) {
          energy = Math.max(0, energy - dt * 1);
        } else if (hunger > 25) {
          energy = Math.min(s.maxEnergy, energy + dt * 1.2);
        }

        // appetite: faster when working hard
        const burn = working || sprinting ? 0.14 : 0.06;
        const prevHunger = hunger;
        hunger = Math.max(0, hunger - dt * burn);
        if (prevHunger > 25 && hunger <= 25) {
          s.addToast("🍗 You're getting hungry — eat something");
          sfx.error();
        }
        if (prevHunger > 0 && hunger <= 0) {
          s.addToast("💀 You're starving! HP is draining");
          sfx.error();
        }
        if (starving) {
          // starving is an emergency: fast drain + the hurt vignette so it's unmissable
          hp -= dt * 3;
          if (Date.now() - s.hurtAt > 3000) set({ hurtAt: Date.now() });
        }

        // infection slowly eats away at you
        if (s.infected) {
          hp -= dt * 0.8;
        }
        if (hp <= 0) {
          set({ energy, hunger });
          get().hurt(2); // triggers the blackout flow
          return;
        }
        if (
          Math.abs(energy - s.energy) > 0.01 ||
          Math.abs(hp - s.hp) > 0.01 ||
          Math.abs(hunger - s.hunger) > 0.01
        ) {
          set({ energy, hp, hunger });
        }
      },

      setOpenShop: (id) => {
        sfx.ui();
        set({ openShop: id, openPanel: null, homeOffer: null, showQuests: false, showHelp: false });
      },
      setOpenPanel: (p) => {
        sfx.ui();
        set({ openPanel: p, openPen: null, openShop: null, homeOffer: null, showQuests: false, showHelp: false });
      },
      setOpenPen: (idx) => {
        sfx.ui();
        set({ openPen: idx, openPanel: null, openShop: null, homeOffer: null, showQuests: false, showHelp: false });
      },
      setHomeOffer: (o) => {
        sfx.ui();
        set({ homeOffer: o, openShop: null, openPanel: null, showQuests: false, showHelp: false });
      },
      toggleQuests: () => {
        sfx.ui();
        set((s) => ({ showQuests: !s.showQuests, openShop: null, openPanel: null, homeOffer: null, showHelp: false }));
      },
      toggleHelp: () => {
        sfx.ui();
        set((s) => ({ showHelp: !s.showHelp, openShop: null, openPanel: null, homeOffer: null, showQuests: false }));
      },
      toggleMute: () => {
        const muted = !get().muted;
        sfx.muted = muted;
        set({ muted });
      },
      closeModals: () =>
        set({ openShop: null, openPanel: null, openPen: null, homeOffer: null, buildMode: null, showQuests: false, showHelp: false }),
    }),
    {
      name: "wildwood-save-v7",
      partialize: (s) => ({
        name: s.name,
        muted: s.muted,
        hp: s.hp,
        maxHp: s.maxHp,
        energy: s.energy,
        hunger: s.hunger,
        xp: s.xp,
        level: s.level,
        acorns: s.acorns,
        axe: s.axe,
        rod: s.rod,
        pickaxe: s.pickaxe,
        heldTorch: s.heldTorch,
        weapon: s.weapon,
        armor: s.armor,
        shirt: s.shirt,
        ownedShirts: s.ownedShirts,
        hat: s.hat,
        ownedHats: s.ownedHats,
        appearance: s.appearance,
        infected: s.infected,
        inventory: s.inventory,
        quests: s.quests,
        acceptedOffers: s.acceptedOffers,
        homeTier: s.homeTier,
        houseLevel: s.houseLevel,
        lastRentAt: s.lastRentAt,
        chest: s.chest,
        farm: s.farm,
        dog: s.dog,
        pens: s.pens,
        orchard: s.orchard,
        hives: s.hives,
        structures: s.structures,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) sfx.muted = state.muted;
      },
    }
  )
);
