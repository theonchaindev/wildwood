"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sfx } from "./sound";
import { teleport, live, isBloodMoonNight, isNight, isRaining, clock, DAY_LENGTH_S, tour } from "./runtime";
import {
  CAMPFIRE_POS, ShopId, HOME_TIERS, HOME_PORTAL_POS, HOME_CABIN_POS,
  CAVE_ENTRANCE_POS, CAVE_HD,
  homeGateZ, homeTierDef, interiorDims, TOUR_STOPS,
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
  | { kind: "exitdoor" }
  | { kind: "cave" } // the mine entrance in Darkwood
  | { kind: "caveexit" }
  | { kind: "bench" } // crafting bench at the Base
  | { kind: "notice" }; // the camp notice board

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
export type WeaponTier = "club" | "spear" | "sword" | "waraxe" | "warhammer" | "diamond";
export type ArmorTier = "leather" | "iron";

export const AXES: Record<AxeTier, { label: string; cost: number; chopTime: number; yield: number; blurb: string }> = {
  rusty: { label: "Rusty Axe", cost: 60, chopTime: 2.2, yield: 3, blurb: "Chops 2× faster, +1 wood per tree" },
  golden: { label: "Golden Axe", cost: 250, chopTime: 1.0, yield: 5, blurb: "Chops 5× faster, +3 wood per tree" },
};

export const WEAPONS: Record<WeaponTier, { label: string; icon: string; cost: number; dmg: number; blurb: string }> = {
  club: { label: "Wooden Club", icon: "🏏", cost: 40, dmg: 16, blurb: "Heavy knockback — keeps them off you" },
  spear: { label: "Hunting Spear", icon: "🔱", cost: 120, dmg: 26, blurb: "Long reach — strike before they close in" },
  sword: { label: "Iron Sword", icon: "⚔️", cost: 250, dmg: 38, blurb: "Fast swings, 20% critical hits" },
  waraxe: { label: "War Axe", icon: "🪓", cost: 450, dmg: 46, blurb: "Brutal cleaves with savage knockback" },
  warhammer: { label: "War Hammer", icon: "🔨", cost: 700, dmg: 52, blurb: "Slow but devastating — flattens the dead" },
  // not for sale — crafted at the Base bench from mine diamonds
  diamond: { label: "Diamond Sword", icon: "💠", cost: 0, dmg: 55, blurb: "Forged from the deep — craft it at your bench" },
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
  waraxe: { label: "War Axe", dmg: 46, swing: 0.6, reach: 2.1, knockback: 1.6, crit: 0.18 },
  warhammer: { label: "War Hammer", dmg: 52, swing: 0.75, reach: 2.0, knockback: 2.2, crit: 0.15 },
  diamond: { label: "Diamond Sword", dmg: 55, swing: 0.4, reach: 2.1, knockback: 0.6, crit: 0.25 },
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
  cap: { label: "Scout's Cap", icon: "🧢", cost: 40 },
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
  Timber: 4,
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
  Coal: 8,
  Diamond: 400,
  Bones: 6,
  "Magic Shroom": 45,
  Weed: 35,
  "Honey Apple": 40,
  "Forest Stew": 55,
};

export const COLLECTIBLE_RESPAWN_MS = 90_000;
export const HERB_RESPAWN_MS = 300_000; // the rare stuff takes its time

export function collectibleRespawnMs(kind: string) {
  return kind === "herb" ? HERB_RESPAWN_MS : COLLECTIBLE_RESPAWN_MS;
}
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

// what cooking turns things into (each cook burns 1 Coal, or 1 Timber)
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
  Water: { hp: 2, energy: 12, hunger: 3 },
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
  "Honey Apple": { hp: 30, energy: 25, hunger: 30 },
  "Forest Stew": { hp: 40, energy: 20, hunger: 50 },
};

// ---- the crafting bench at the Base ----

export type CraftRecipe = {
  id: string;
  icon: string;
  label: string;
  blurb: string;
  inputs: Record<string, number>;
  output?: { label: string; n: number };
  weapon?: WeaponTier; // recipes that forge equipment instead of items
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "bandage", icon: "🩹", label: "Bandages ×2", blurb: "Field dressing from wool and clean water",
    inputs: { Wool: 1, Water: 1 }, output: { label: "Bandage", n: 2 },
  },
  {
    id: "honeyapple", icon: "🍎", label: "Honey Apple", blurb: "A sticky-sweet energy boost",
    inputs: { Apple: 1, Honey: 1 }, output: { label: "Honey Apple", n: 1 },
  },
  {
    id: "stew", icon: "🍲", label: "Forest Stew", blurb: "The most filling meal in the wood",
    inputs: { Carrot: 2, Pumpkin: 1, Water: 1 }, output: { label: "Forest Stew", n: 1 },
  },
  {
    id: "torchpack", icon: "🕯️", label: "Timber bundle ×6", blurb: "Split coal heat into burnable timber",
    inputs: { Coal: 2, Stone: 1 }, output: { label: "Timber", n: 6 },
  },
  {
    id: "dsword", icon: "💠", label: "Diamond Sword", blurb: "55 dmg · 25% crits — the deep pays off",
    inputs: { Diamond: 2, Timber: 5, Coal: 5 }, weapon: "diamond",
  },
];

// ---- skills: spend points earned at each level-up ----

export const SKILLS = {
  forestry: { label: "Forestry", icon: "🪓", blurb: "Chop & mine 8% faster per rank" },
  angling: { label: "Angling", icon: "🎣", blurb: "Bites 10% sooner, bigger catch window, +2% golden fish per rank" },
  warfare: { label: "Warfare", icon: "⚔️", blurb: "+6% damage per rank" },
  harvest: { label: "Harvest", icon: "🌾", blurb: "Crops 5% faster, +8% bonus-crop chance per rank" },
} as const;

export type SkillKey = keyof typeof SKILLS;
export const MAX_SKILL_RANK = 5;

// ---- achievements: auto-granted as the matching stat ticks up ----

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  stat: string;
  goal: number;
  acorns: number;
  xp: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "chop-1", icon: "🪓", title: "Lumberjack", desc: "Chop 10 trees", stat: "treesChopped", goal: 10, acorns: 30, xp: 50 },
  { id: "chop-2", icon: "🪓", title: "Deforester", desc: "Chop 100 trees", stat: "treesChopped", goal: 100, acorns: 150, xp: 150 },
  { id: "chop-3", icon: "🪓", title: "Timber Tycoon", desc: "Chop 500 trees", stat: "treesChopped", goal: 500, acorns: 600, xp: 400 },
  { id: "mine-1", icon: "⛏️", title: "Rock Bottom", desc: "Mine 10 rocks", stat: "rocksMined", goal: 10, acorns: 30, xp: 50 },
  { id: "mine-2", icon: "⛏️", title: "Quarry Master", desc: "Mine 100 rocks", stat: "rocksMined", goal: 100, acorns: 200, xp: 200 },
  { id: "fish-1", icon: "🎣", title: "First Catch", desc: "Catch 10 fish", stat: "fishCaught", goal: 10, acorns: 30, xp: 50 },
  { id: "fish-2", icon: "🎣", title: "River Regular", desc: "Catch 50 fish", stat: "fishCaught", goal: 50, acorns: 120, xp: 150 },
  { id: "fish-3", icon: "🎣", title: "Master Angler", desc: "Catch 200 fish", stat: "fishCaught", goal: 200, acorns: 500, xp: 350 },
  { id: "golden-1", icon: "🐡", title: "One in a Million", desc: "Catch a Golden Fish", stat: "goldenFish", goal: 1, acorns: 100, xp: 100 },
  { id: "zombie-1", icon: "🧟", title: "Night Watchman", desc: "Slay 10 zombies", stat: "zombiesKilled", goal: 10, acorns: 50, xp: 80 },
  { id: "zombie-2", icon: "🧟", title: "Gravekeeper", desc: "Slay 50 zombies", stat: "zombiesKilled", goal: 50, acorns: 200, xp: 200 },
  { id: "zombie-3", icon: "🧟", title: "Scourge of the Dead", desc: "Slay 250 zombies", stat: "zombiesKilled", goal: 250, acorns: 800, xp: 500 },
  { id: "boss-1", icon: "👹", title: "Butcher's Bane", desc: "Fell the Butcher on a boss night", stat: "bossKills", goal: 1, acorns: 400, xp: 300 },
  { id: "hunt-1", icon: "🏹", title: "Hunter-Gatherer", desc: "Hunt 10 animals", stat: "animalsHunted", goal: 10, acorns: 40, xp: 60 },
  { id: "hunt-2", icon: "🏹", title: "Apex Predator", desc: "Hunt 50 animals", stat: "animalsHunted", goal: 50, acorns: 180, xp: 180 },
  { id: "harvest-1", icon: "🌾", title: "Green Thumb", desc: "Harvest 10 crops", stat: "cropsHarvested", goal: 10, acorns: 30, xp: 50 },
  { id: "harvest-2", icon: "🌾", title: "Breadbasket", desc: "Harvest 100 crops", stat: "cropsHarvested", goal: 100, acorns: 250, xp: 220 },
  { id: "cook-1", icon: "🍳", title: "Camp Cook", desc: "Cook 10 meals", stat: "mealsCooked", goal: 10, acorns: 30, xp: 50 },
  { id: "cook-2", icon: "🍳", title: "Forest Chef", desc: "Cook 50 meals", stat: "mealsCooked", goal: 50, acorns: 150, xp: 150 },
  { id: "sell-1", icon: "💰", title: "Trader", desc: "Earn 1,000 acorns from sales", stat: "acornsEarned", goal: 1000, acorns: 100, xp: 100 },
  { id: "sell-2", icon: "💰", title: "Merchant Prince", desc: "Earn 10,000 acorns from sales", stat: "acornsEarned", goal: 10000, acorns: 500, xp: 300 },
  { id: "produce-1", icon: "🥚", title: "Farmhand", desc: "Collect 50 farm produce", stat: "produceCollected", goal: 50, acorns: 100, xp: 100 },
  { id: "produce-2", icon: "🥚", title: "Land Baron", desc: "Collect 250 farm produce", stat: "produceCollected", goal: 250, acorns: 400, xp: 250 },
  { id: "coal-1", icon: "⚫", title: "Coal Face", desc: "Mine 25 coal in the Old Mine", stat: "coalMined", goal: 25, acorns: 120, xp: 120 },
  { id: "diamond-1", icon: "💎", title: "Diamond in the Rough", desc: "Unearth a diamond", stat: "diamondsFound", goal: 1, acorns: 200, xp: 200 },
  { id: "craft-1", icon: "🛠️", title: "Tinkerer", desc: "Craft 10 things at your bench", stat: "itemsCrafted", goal: 10, acorns: 100, xp: 100 },
  { id: "deeds-10", icon: "🏡", title: "Lord of the Wildwood", desc: "Hold all 10 land deeds", stat: "deeds", goal: 10, acorns: 1000, xp: 500 },
  { id: "house-5", icon: "🏰", title: "Manor Born", desc: "Build the Wildwood Manor", stat: "housePeak", goal: 5, acorns: 500, xp: 300 },
];

// ---- daily quests: three fresh tasks every game day ----

export type DailyQuest = {
  id: string;
  stat: string;
  goal: number;
  label: string;
  icon: string;
  acorns: number;
  xp: number;
};

const DAILY_TEMPLATES = [
  { stat: "treesChopped", icon: "🪓", word: "Chop", thing: "trees", min: 5, max: 12, per: 6 },
  { stat: "fishCaught", icon: "🎣", word: "Catch", thing: "fish", min: 3, max: 7, per: 10 },
  { stat: "zombiesKilled", icon: "🧟", word: "Slay", thing: "zombies", min: 3, max: 8, per: 12 },
  { stat: "cropsHarvested", icon: "🌾", word: "Harvest", thing: "crops", min: 4, max: 10, per: 8 },
  { stat: "rocksMined", icon: "⛏️", word: "Mine", thing: "rocks", min: 3, max: 8, per: 8 },
  { stat: "produceCollected", icon: "🥚", word: "Collect", thing: "farm produce", min: 4, max: 10, per: 7 },
  { stat: "animalsHunted", icon: "🏹", word: "Hunt", thing: "animals", min: 2, max: 6, per: 12 },
];

export function dailyQuestsFor(day: number): DailyQuest[] {
  const r = mulberry32(day * 31 + 7);
  const picks: number[] = [];
  while (picks.length < 3) {
    const i = Math.floor(r() * DAILY_TEMPLATES.length);
    if (!picks.includes(i)) picks.push(i);
  }
  return picks.map((i) => {
    const t = DAILY_TEMPLATES[i];
    const goal = t.min + Math.floor(r() * (t.max - t.min + 1));
    return {
      id: `d${day}-${t.stat}`,
      stat: t.stat,
      goal,
      label: `${t.word} ${goal} ${t.thing}`,
      icon: t.icon,
      acorns: goal * t.per,
      xp: goal * 5,
    };
  });
}

// ---- interior decoration: furniture-pack pieces you can buy & place ----

export const DECOR_ITEMS: Record<string, { label: string; file: string; cost: number; size: number; by?: "y" | "xz" }> = {
  sofa: { label: "Sofa", file: "sofa_001", cost: 350, size: 2, by: "xz" },
  armchair: { label: "Lounge Chair", file: "lounge_chair_001", cost: 220, size: 1 },
  coffeetable: { label: "Coffee Table", file: "coffee_table_001", cost: 140, size: 0.5 },
  chair: { label: "Kitchen Chair", file: "kitchen_chair_001", cost: 60, size: 0.95 },
  dresser: { label: "Dresser", file: "dresser_001", cost: 180, size: 1.1 },
  wardrobe: { label: "Wardrobe", file: "closet_002", cost: 260, size: 2 },
  floorlamp: { label: "Floor Lamp", file: "lamp_001", cost: 100, size: 1.5 },
  tablelamp: { label: "Table Lamp", file: "lamp_002", cost: 60, size: 0.5 },
  plant: { label: "House Plant", file: "flower_001", cost: 80, size: 0.9 },
  tv: { label: "TV Wall", file: "tv_wall_001", cost: 400, size: 1.6 },
  washer: { label: "Washing Machine", file: "washing_machine_001", cost: 250, size: 1 },
  microwave: { label: "Microwave", file: "microwave_oven_001", cost: 120, size: 0.45 },
  dumbbells: { label: "Dumbbell Rack", file: "dumbbell_001", cost: 200, size: 0.9 },
  bench: { label: "Workout Bench", file: "training_item_001", cost: 260, size: 1 },
  treadmill: { label: "Exercise Rig", file: "training_item_002", cost: 320, size: 1.3 },
  scratch: { label: "Scratching Post", file: "scratching_post_001", cost: 150, size: 1.1 },
  bear: { label: "Teddy Bear", file: "toy_001", cost: 90, size: 0.5 },
  blocks: { label: "Toy Blocks", file: "toy_002", cost: 70, size: 0.35 },
  guitar: { label: "Instrument", file: "musical_instrument_001", cost: 320, size: 1.4 },
  airhockey: { label: "Air Hockey", file: "air_hockey_001", cost: 500, size: 2.2, by: "xz" },
  crate: { label: "Old Crate", file: "box_001", cost: 40, size: 0.6 },
};

export type DecorPiece = { id: number; key: string; x: number; z: number; rot: number };
export const MAX_DECOR = 25;

// ---- homestead extras ----

export const DOG_COST = 200;
export const CAT_COST = 250;
export const HORSE_COST = 600;
export const BOAT_COST = { acorns: 180, wood: 35 };

// the cat brings a present once per game day if you remember to pet her
const CAT_GIFTS = ["Egg", "Apple", "Carrot", "Stone", "Timber", "Carp", "Orange Mushroom"];

// ---- the house: five upgrade levels, each with a real perk ----

// a fresh Base is bare ground — every station is built by hand
export const BASE_BUILD = {
  chest: { wood: 20, stone: 0, acorns: 0, label: "Storage Chest", icon: "📦" },
  furnace: { wood: 0, stone: 25, acorns: 0, label: "Furnace", icon: "🔥" },
  bench: { wood: 15, stone: 10, acorns: 0, label: "Crafting Bench", icon: "🛠️" },
};
export const TILL_COST = { acorns: 8, wood: 1 }; // per plot of soil
export const BASE_LAND_WOOD = 30; // clearing the raw plot costs timber too

// bump this to wipe every player's base once (they keep acorns/level/etc.).
// Each client applies it a single time on load — survives cloud re-syncs.
export const BASE_RESET_EPOCH = 1;
export const BASE_RESET_REFUND = 1000;

/** Rename the old "Wood" item to "Timber" in a save's stacks (the $WOOD coin
 *  took the "Wood" name). Idempotent. */
export function migrateWoodToTimber(save: any) {
  for (const bag of [save?.inventory, save?.chest]) {
    if (bag && bag.Wood != null) {
      bag.Timber = (bag.Timber ?? 0) + bag.Wood;
      delete bag.Wood;
    }
  }
}

/** One-time base wipe migration, applied to a save object on load. Mutates
 *  the object and returns true if it changed anything. */
export function applyBaseReset(save: any): boolean {
  if (!save || save.baseResetAck === BASE_RESET_EPOCH) return false;
  const hadBase = (save.homeTier ?? 0) >= 1;
  save.homeTier = 0;
  save.houseLevel = 0;
  save.baseChest = false;
  save.baseFurnace = false;
  save.baseBench = false;
  save.tilled = {};
  save.pens = {};
  save.orchard = {};
  save.hives = {};
  save.structures = [];
  save.farm = {};
  save.chest = {};
  if (hadBase) save.acorns = (save.acorns ?? 0) + BASE_RESET_REFUND;
  save.baseResetAck = BASE_RESET_EPOCH;
  return true;
}

export const HOUSE_LEVELS = [
  // the Log Cabin must be built first — expensive, and a lot of timber
  { name: "Log Cabin", icon: "🛖", acorns: 300, wood: 60, stone: 0, perk: "A roof of your own — unlocks sleeping & upgrades" },
  { name: "Timber Cottage", icon: "🏠", acorns: 400, wood: 20, stone: 0, perk: "Sleep through the night — rest at your door after dusk" },
  { name: "Stone Farmhouse", icon: "🏡", acorns: 900, wood: 30, stone: 20, perk: "Crops grow 20% faster" },
  { name: "Hunter's Lodge", icon: "🏕️", acorns: 1600, wood: 50, stone: 35, perk: "Pens, hives & orchard produce 20% faster" },
  { name: "Wildwood Manor", icon: "🏰", acorns: 3000, wood: 80, stone: 60, perk: `Earn 150 🪵 rent — collect at your door every day` },
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

function rollFish(goldenBonus = 0): string {
  const table: { label: string; weight: number }[] = [
    { label: "Carp", weight: 60 },
    { label: "Trout", weight: 32 },
    { label: "Golden Fish", weight: 8 + goldenBonus },
  ];
  const total = table.reduce((a, f) => a + f.weight, 0);
  let r = Math.random() * total;
  for (const f of table) {
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
  if (level >= 3) return "Scavenger";
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
  { id: "leave-glade", title: "Leave the Hollow", desc: "Head out through a gap in the fence into the wild.", goal: 1, progress: 0, done: false, xp: 40, acorns: 10 },
  { id: "forage-mushrooms", title: "Mushroom Hunter", desc: "Collect 5 wild mushrooms from Sporewood, north of the Hollow.", goal: 5, progress: 0, done: false, xp: 80, acorns: 25 },
  { id: "timber", title: "Timber!", desc: "Chop down 2 trees with your bare hands. Click a tree to start chopping.", goal: 2, progress: 0, done: false, xp: 80, acorns: 20 },
  { id: "pick-flowers", title: "Bloom Florist", desc: "Pick 3 flowers from the Bloom in the south.", goal: 3, progress: 0, done: false, xp: 60, acorns: 20 },
  { id: "buy-axe", title: "Tooled Up", desc: "Sell your goods at The Den and buy an axe.", goal: 1, progress: 0, done: false, xp: 100, acorns: 0 },
  { id: "go-fish", title: "Gone Fishing", desc: "Buy a fishing rod, stand by the river and press F. Catch 2 fish.", goal: 2, progress: 0, done: false, xp: 90, acorns: 25 },
  { id: "cross-bridge", title: "Cross the Old Bridge", desc: "Cross the river east of camp — only the bridge will get you over.", goal: 1, progress: 0, done: false, xp: 50, acorns: 15 },
  { id: "return-camp", title: "Back to Camp", desc: "Return to the campfire and warm up.", goal: 1, progress: 0, done: false, xp: 70, acorns: 30 },
  { id: "night-watch", title: "Night Watch", desc: "Zombies rise after dark. Put 3 of them back in the ground — click one to attack.", goal: 3, progress: 0, done: false, xp: 150, acorns: 50 },
  { id: "buy-plot", title: "Land Owner", desc: "Buy your own Base at the 🏡 gate near camp — your private land, away from the forest.", goal: 1, progress: 0, done: false, xp: 120, acorns: 0 },
  { id: "harvest", title: "Green Thumb", desc: "Buy seeds at The Den, plant them on your Base, and harvest 3 crops.", goal: 3, progress: 0, done: false, xp: 100, acorns: 30 },
  { id: "cook", title: "Home Cooking", desc: "Hunt an animal and cook its meat in your Base furnace (fuelled by coal or wood).", goal: 1, progress: 0, done: false, xp: 100, acorns: 25 },
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
  ownedAxes: AxeTier[];
  rod: boolean;
  weapon: WeaponTier | null;
  ownedWeapons: WeaponTier[];
  armor: ArmorTier | null;
  ownedArmor: ArmorTier[];
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
  houseLevel: number; // 0 = no house yet, else index+1 into HOUSE_LEVELS
  baseChest: boolean;
  baseFurnace: boolean;
  baseBench: boolean;
  tilled: Record<string, boolean>; // farm tile key -> soil purchased
  baseResetAck: number;
  lastRentAt: number;
  location: "forest" | "home" | "visit" | "interior" | "cave";
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
    interiorDecor?: DecorPiece[];
  } | null;
  chest: Record<string, number>;
  farm: Record<string, { seed: string; at: number }>;
  dog: boolean;
  dogXp: number;
  cat: boolean;
  catLastPet: number;
  horse: boolean;
  boat: boolean;
  mounted: boolean;
  tripUntil: number;
  tripKind: "shroom" | "weed" | null;
  pens: Record<string, Pen>; // key = pen spot index
  orchard: Record<string, OrchardTree>; // key = orchard spot index
  hives: Record<string, Hive>; // key = hive spot index
  structures: Structure[];
  buildMode: string | null; // buildable key, or "remove"
  interiorDecor: DecorPiece[];
  decorMode: string | null; // DECOR_ITEMS key, or "remove"

  stats: Record<string, number>;
  skills: Record<SkillKey, number>;
  skillPoints: number;
  claimedAchievements: string[];
  dailyDay: number;
  dailyBase: Record<string, number>;
  dailyClaimed: string[];

  quests: Quest[];
  zone: string;
  banner: string | null;
  toasts: Toast[];
  nearInteract: Interact | null;
  nearWater: boolean;
  openShop: ShopId | null;
  openPanel: "chest" | "furnace" | "house" | "bench" | null;
  openPen: number | null;
  homeOffer: "buy" | "extend" | null;
  showQuests: boolean;
  showHelp: boolean;
  showSkills: boolean;
  showJournal: boolean;
  showDecorShop: boolean;
  showInventory: boolean;
  tourStep: number;
  showNotice: boolean;

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
  zombieKilled: (boss?: boolean) => void;
  bumpStat: (key: string, n?: number) => void;
  upgradeSkill: (key: SkillKey) => void;
  ensureDaily: () => void;
  claimDaily: (id: string) => void;
  buyCat: () => void;
  petCat: () => void;
  dogBit: () => void;
  dogLevel: () => number;
  placeDecor: (x: number, z: number) => void;
  removeDecor: (id: number) => void;
  setDecorMode: (mode: string | null) => void;
  toggleSkills: () => void;
  toggleJournal: () => void;
  toggleDecorShop: () => void;
  toggleInventory: () => void;
  toggleNotice: () => void;
  startTour: () => void;
  setTourStep: (n: number) => void;
  endTour: () => void;
  animalKilled: (kind: "chicken" | "boar" | "rabbit" | "deer") => void;
  hurt: (dmg: number, canInfect?: boolean) => void;
  buyHomestead: () => void;
  extendHomestead: () => void;
  travel: (to: "forest" | "home") => void;
  enterHouse: () => void;
  station: (kind: "chest" | "furnace" | "bench") => void;
  houseStation: () => void;
  tillSoil: (key: string) => void;
  exitHouse: () => void;
  enterCave: () => void;
  exitCave: () => void;
  craftItem: (id: string) => void;
  buyHorse: () => void;
  buyBoat: () => void;
  toggleMount: () => void;
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
  equipWeapon: (tier: WeaponTier | null) => void;
  equipAxe: (tier: AxeTier | null) => void;
  equipArmor: (tier: ArmorTier | null) => void;
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
  catchUpQuests: () => void;
  setZone: (zone: string) => void;
  setNearInteract: (i: Interact | null) => void;
  setNearWater: (near: boolean) => void;
  tick: (dtSeconds: number, moving: boolean, nearCamp: boolean, sprinting: boolean, working: boolean) => void;
  setOpenShop: (id: ShopId | null) => void;
  setOpenPanel: (p: "chest" | "furnace" | "house" | "bench" | null) => void;
  setOpenPen: (idx: number | null) => void;
  setHomeOffer: (o: "buy" | "extend" | null) => void;
  toggleQuests: () => void;
  toggleHelp: () => void;
  toggleMute: () => void;
  closeModals: () => void;
};

function spend(s: { acorns: number; addToast: (t: string) => void }, cost: number): boolean {
  if (s.acorns < cost) {
    s.addToast("Not enough Wood!");
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
      ownedAxes: [],
      rod: false,
      weapon: null,
      ownedWeapons: [],
      armor: null,
      ownedArmor: [],
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
      houseLevel: 0,
      baseChest: false,
      baseFurnace: false,
      baseBench: false,
      tilled: {},
      baseResetAck: BASE_RESET_EPOCH,
      lastRentAt: 0,
      location: "forest",
      savedForestPos: null,
      account: null,
      visitData: null,
      chest: {},
      farm: {},
      dog: false,
      dogXp: 0,
      cat: false,
      catLastPet: 0,
      horse: false,
      boat: false,
      mounted: false,
      tripUntil: 0,
      tripKind: null,
      pens: {},
      orchard: {},
      hives: {},
      structures: [],
      buildMode: null,
      interiorDecor: [],
      decorMode: null,

      stats: {},
      skills: { forestry: 0, angling: 0, warfare: 0, harvest: 0 },
      skillPoints: 0,
      claimedAchievements: [],
      dailyDay: 0,
      dailyBase: {},
      dailyClaimed: [],

      quests: QUESTS,
      zone: "The Hollow",
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
      showSkills: false,
      showJournal: false,
      showDecorShop: false,
      showInventory: false,
      tourStep: -1,
      showNotice: false,

      xpToLevel: () => get().level * 100,
      chopTime: () =>
        (get().axe ? AXES[get().axe!].chopTime : HAND_CHOP_TIME) *
        (1 - 0.08 * get().skills.forestry),
      combatProfile: () => {
        const s = get();
        const base = s.weapon ? COMBAT[s.weapon] : s.axe ? COMBAT.axe : COMBAT.fists;
        const rank = s.skills.warfare;
        return rank > 0 ? { ...base, dmg: Math.round(base.dmg * (1 + 0.06 * rank)) } : base;
      },

      bumpStat: (key, n = 1) => {
        if (n === 0) return;
        const stats = { ...get().stats, [key]: (get().stats[key] ?? 0) + n };
        set({ stats });
        for (const a of ACHIEVEMENTS) {
          if (a.stat !== key) continue;
          if (stats[key] >= a.goal && !get().claimedAchievements.includes(a.id)) {
            set({
              claimedAchievements: [...get().claimedAchievements, a.id],
              acorns: get().acorns + a.acorns,
            });
            get().setBanner(`${a.icon} Achievement — ${a.title}!`);
            get().addToast(`📖 ${a.desc} · +${a.acorns} 🪵 · +${a.xp} XP`);
            sfx.questDone();
            get().addXp(a.xp);
          }
        }
        get().ensureDaily();
      },

      ensureDaily: () => {
        const s = get();
        if (s.dailyDay === clock.day) return;
        const base: Record<string, number> = {};
        for (const q of dailyQuestsFor(clock.day)) base[q.stat] = s.stats[q.stat] ?? 0;
        set({ dailyDay: clock.day, dailyBase: base, dailyClaimed: [] });
        if (s.dailyDay > 0) s.addToast("📋 New daily tasks have arrived!");
      },

      claimDaily: (id) => {
        const s = get();
        if (s.dailyClaimed.includes(id)) return;
        const q = dailyQuestsFor(clock.day).find((d) => d.id === id);
        if (!q) return;
        if ((s.stats[q.stat] ?? 0) - (s.dailyBase[q.stat] ?? 0) < q.goal) return;
        set({ dailyClaimed: [...s.dailyClaimed, id], acorns: s.acorns + q.acorns });
        sfx.coin();
        s.addToast(`📋 ${q.label} — +${q.acorns} 🪵 · +${q.xp} XP`);
        s.addXp(q.xp);
      },

      upgradeSkill: (key) => {
        const s = get();
        if (s.skillPoints < 1 || s.skills[key] >= MAX_SKILL_RANK) return;
        set({ skillPoints: s.skillPoints - 1, skills: { ...s.skills, [key]: s.skills[key] + 1 } });
        sfx.levelUp();
        s.addToast(`${SKILLS[key].icon} ${SKILLS[key].label} is now rank ${s.skills[key] + 1}`);
      },

      buyCat: () => {
        const s = get();
        if (s.cat) return;
        if (!spend(s, CAT_COST)) return;
        set({ acorns: s.acorns - CAT_COST, cat: true });
        sfx.buy();
        s.setBanner("🐈 A cat has adopted you (it works that way round)");
      },

      petCat: () => {
        const s = get();
        if (!s.cat) return;
        if (Date.now() - s.catLastPet < DAY_LENGTH_S * 1000) {
          s.addToast("😺 She purrs contentedly");
          return;
        }
        const gift = CAT_GIFTS[Math.floor(Math.random() * CAT_GIFTS.length)];
        if (s.gainItem(gift, 1) < 1) return;
        set({ catLastPet: Date.now() });
        sfx.pickup();
        s.addToast(`😺 She's brought you 1 ${gift}!`);
      },

      dogBit: () => set({ dogXp: get().dogXp + 5 }),
      dogLevel: () => Math.min(5, 1 + Math.floor(get().dogXp / 100)),

      placeDecor: (x, z) => {
        const s = get();
        const key = s.decorMode;
        if (!key || key === "remove") return;
        const def = DECOR_ITEMS[key];
        if (!def) return;
        if (s.interiorDecor.length >= MAX_DECOR) {
          s.addToast(`Limit of ${MAX_DECOR} furnishings reached`);
          sfx.error();
          return;
        }
        const { hw, hd } = interiorDims(s.houseLevel);
        if (Math.abs(x) > hw - 0.5 || Math.abs(z) > hd - 0.5) {
          s.addToast("Keep it inside the walls!");
          return;
        }
        if (s.interiorDecor.some((d) => Math.hypot(d.x - x, d.z - z) < 0.7)) {
          s.addToast("Too close to another piece");
          return;
        }
        if (!spend(s, def.cost)) return;
        set({
          acorns: get().acorns - def.cost,
          interiorDecor: [
            ...s.interiorDecor,
            { id: Date.now() + Math.floor(Math.random() * 1000), key, x, z, rot: Math.random() * Math.PI * 2 },
          ],
        });
        sfx.buy();
      },

      removeDecor: (id) => {
        const s = get();
        const piece = s.interiorDecor.find((d) => d.id === id);
        if (!piece) return;
        const refund = Math.floor((DECOR_ITEMS[piece.key]?.cost ?? 0) / 2);
        set({
          interiorDecor: s.interiorDecor.filter((d) => d.id !== id),
          acorns: s.acorns + refund,
        });
        s.addToast(`Removed ${DECOR_ITEMS[piece.key]?.label ?? "furnishing"} · +${refund} 🪵 back`);
        sfx.ui();
      },

      setDecorMode: (mode) => {
        set({ decorMode: mode, showDecorShop: false });
        if (mode) sfx.ui();
      },

      toggleSkills: () => {
        sfx.ui();
        set((s) => ({ showSkills: !s.showSkills, showJournal: false, showQuests: false, showHelp: false, openShop: null, openPanel: null, homeOffer: null }));
      },
      toggleJournal: () => {
        sfx.ui();
        set((s) => ({ showJournal: !s.showJournal, showSkills: false, showQuests: false, showHelp: false, openShop: null, openPanel: null, homeOffer: null }));
      },
      toggleDecorShop: () => {
        sfx.ui();
        set((s) => ({ showDecorShop: !s.showDecorShop, decorMode: null, showSkills: false, showJournal: false, showQuests: false, showHelp: false, openShop: null, openPanel: null }));
      },
      toggleInventory: () => {
        sfx.ui();
        set((s) => ({ showInventory: !s.showInventory, showSkills: false, showJournal: false, showQuests: false, showHelp: false, openShop: null, openPanel: null, homeOffer: null }));
      },
      toggleNotice: () => {
        sfx.ui();
        set((s) => ({ showNotice: !s.showNotice, showInventory: false, showSkills: false, showJournal: false, showQuests: false, showHelp: false, openShop: null, openPanel: null, homeOffer: null }));
      },

      startTour: () => {
        tour.active = true;
        set({ tourStep: 0, openShop: null, openPanel: null, showInventory: false, showNotice: false });
      },
      setTourStep: (n) => {
        if (n >= TOUR_STOPS.length) { get().endTour(); return; }
        set({ tourStep: n });
      },
      endTour: () => {
        tour.active = false;
        set({ tourStep: -1 });
        try { localStorage.setItem("ww-tour-done", "1"); } catch {}
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
        setTimeout(() => get().catchUpQuests(), 100);
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
          const oldRank = rankFor(get().level);
          const newRank = rankFor(level);
          // levelling no longer raises max HP — just heal up and grant a skill point
          set({
            xp, level, hp: get().maxHp, energy: get().maxEnergy,
            skillPoints: get().skillPoints + 1,
          });
          get().setBanner(
            newRank !== oldRank
              ? `Rank up! You are now a ${newRank} (Lv ${level})`
              : `Level up! You are now level ${level}`
          );
          get().addToast("🌟 +1 skill point — spend it in Skills");
          sfx.levelUp();
          // a level-up is worth saving immediately
          if (typeof window !== "undefined") window.dispatchEvent(new Event("ww-push-save"));
        } else {
          set({ xp });
        }
      },

      collectItem: (id, label, kind) => {
        const s = get();
        const at = s.collected[id];
        if (at && Date.now() - at < collectibleRespawnMs(kind)) return;
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

      mineTime: () =>
        (get().pickaxe ? PICK_MINE_TIME : HAND_MINE_TIME) *
        (1 - 0.08 * get().skills.forestry),

      mineComplete: (rockId) => {
        const s = get();
        if (s.minedAt[rockId]) return;
        set({
          minedAt: { ...s.minedAt, [rockId]: Date.now() },
          mineTargetId: null,
        });
        sfx.treeFall();
        if (rockId.startsWith("ore-diamond")) {
          const got = s.gainItem("Diamond", 1);
          if (got > 0) {
            get().setBanner("💎 A DIAMOND! Straight from the deep");
            s.addToast("+1 Diamond · +100 XP");
            sfx.levelUp();
          }
          s.addXp(100);
          get().bumpStat("diamondsFound");
        } else if (rockId.startsWith("ore-coal")) {
          const n = (s.pickaxe ? 3 : 2) + (Math.random() < 0.5 ? 1 : 0);
          const got = s.gainItem("Coal", n);
          if (got > 0) s.addToast(`+${got} Coal · +20 XP`);
          s.addXp(20);
          get().bumpStat("coalMined", n);
        } else {
          const yieldN = s.pickaxe ? PICK_STONE_YIELD : HAND_STONE_YIELD;
          const got = s.gainItem("Stone", yieldN);
          if (got > 0) s.addToast(`+${got} Stone · +15 XP`);
          s.addXp(15);
        }
        get().bumpStat("rocksMined");
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
        const got = s.gainItem("Timber", yieldN);
        set({
          choppedAt: { ...get().choppedAt, [treeId]: Date.now() },
          chopTargetId: null,
        });
        sfx.treeFall();
        if (got > 0) s.addToast(`+${got} Timber · +15 XP`);
        s.addXp(15);
        get().bumpStat("treesChopped");
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

      zombieKilled: (boss = false) => {
        const s = get();
        if (boss) {
          const loot = 300 + Math.floor(Math.random() * 201);
          s.gainItem("Medkit", 1);
          s.gainItem("Purple Mushroom", 2);
          set({ acorns: get().acorns + loot, attackTargetId: null });
          s.setBanner("👹 THE BUTCHER HAS FALLEN!");
          s.addToast(`+${loot} 🪵 · +150 XP · 🧰 Medkit · 🍄 ×2`);
          sfx.questDone();
          s.addXp(150);
          get().bumpStat("bossKills");
          get().bumpStat("zombiesKilled");
          get().questEvent("night-watch");
          return;
        }
        // down in the mine the dead drop bones and the odd lump of ore
        if (s.location === "cave") {
          const loot = 4 + Math.floor(Math.random() * 9);
          s.gainItem("Bones", 1 + (Math.random() < 0.4 ? 1 : 0));
          if (Math.random() < 0.35) s.gainItem("Coal", 1);
          if (Math.random() < 0.04) s.gainItem("Diamond", 1);
          set({ acorns: get().acorns + loot, attackTargetId: null });
          s.addToast(`💀 Slain! +20 XP · +${loot} 🪵 · 🦴 Bones`);
          sfx.coin();
          s.addXp(20);
          get().bumpStat("zombiesKilled");
          return;
        }
        const blood = isBloodMoonNight();
        const loot = (5 + Math.floor(Math.random() * 11)) * (blood ? 2 : 1);
        const extra = Math.random() < 0.06 ? "Magic Shroom" : Math.random() < 0.25 ? "Purple Mushroom" : null;
        if (extra) s.gainItem(extra, 1);
        set({ acorns: get().acorns + loot, attackTargetId: null });
        s.addToast(`${blood ? "🔴 " : ""}Zombie slain! +25 XP · +${loot} 🪵${extra ? ` · +1 ${extra}` : ""}`);
        sfx.coin();
        s.addXp(25);
        get().bumpStat("zombiesKilled");
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
        get().bumpStat("animalsHunted");
      },

      buyHomestead: () => {
        const s = get();
        if (s.homeTier > 0) return;
        const tier = HOME_TIERS[0];
        if ((s.inventory.Timber ?? 0) < BASE_LAND_WOOD) {
          s.addToast(`Clearing the land needs ${BASE_LAND_WOOD} Timber 🌲`);
          sfx.error();
          return;
        }
        if (!spend(s, tier.price)) return;
        const inv = { ...s.inventory };
        if (inv.Timber - BASE_LAND_WOOD <= 0) delete inv.Timber;
        else inv.Timber -= BASE_LAND_WOOD;
        set({ acorns: s.acorns - tier.price, inventory: inv, homeTier: 1, homeOffer: null });
        sfx.buy();
        s.setBanner("🏡 The land is yours — now build it up!");
        s.addToast("Through the gate: build a chest, furnace, cabin and till your soil");
        get().bumpStat("deeds");
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
        get().bumpStat("deeds");
        if (typeof window !== "undefined") window.dispatchEvent(new Event("ww-push-save"));
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
        if ((s.inventory.Timber ?? 0) < PEN_BUILD_COST.wood) {
          s.addToast(`You need ${PEN_BUILD_COST.wood} Timber for the fencing 🌲`);
          sfx.error();
          return;
        }
        if (!spend(s, totalAcorns)) return;
        const inv = { ...s.inventory };
        if (inv.Timber - PEN_BUILD_COST.wood <= 0) delete inv.Timber;
        else inv.Timber -= PEN_BUILD_COST.wood;
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
        get().bumpStat("produceCollected", got);
      },

      // a Stone Farmhouse tends the fields, the Harvest skill sharpens them,
      // and rain waters everything for free
      growMsFor: (seed) => {
        const s = get();
        let f = s.houseLevel >= 3 ? 0.8 : 1;
        f *= 1 - 0.05 * s.skills.harvest;
        if (isRaining()) f *= 0.75;
        return SEEDS[seed].growMs * f;
      },
      produceFactor: () => (get().houseLevel >= 4 ? 0.8 : 1),

      upgradeHouse: () => {
        const s = get();
        if (s.homeTier < 1 || s.houseLevel >= HOUSE_LEVELS.length) return;
        const next = HOUSE_LEVELS[s.houseLevel];
        if ((s.inventory.Timber ?? 0) < next.wood) {
          s.addToast(`Needs ${next.wood} Timber 🌲`);
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
        for (const [mat, cost] of [["Timber", next.wood], ["Stone", next.stone]] as const) {
          if (cost > 0) {
            if (inv[mat] - cost <= 0) delete inv[mat];
            else inv[mat] -= cost;
          }
        }
        set({ acorns: s.acorns - next.acorns, inventory: inv, houseLevel: s.houseLevel + 1 });
        sfx.levelUp();
        s.setBanner(`${next.icon} Your house is now a ${next.name}!`);
        s.addToast(next.perk);
        get().bumpStat("housePeak", get().houseLevel - (get().stats.housePeak ?? 0));
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
        s.addToast(`💰 Collected ${RENT_AMOUNT} 🪵 rent from your tenants`);
      },

      plantOrchardTree: (idx) => {
        const s = get();
        if (s.orchard[idx] || s.homeTier < 1) return;
        if ((s.inventory.Timber ?? 0) < ORCHARD_COST.wood) {
          s.addToast(`You need ${ORCHARD_COST.wood} Timber for the stakes 🌲`);
          sfx.error();
          return;
        }
        if (!spend(s, ORCHARD_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Timber - ORCHARD_COST.wood <= 0) delete inv.Timber;
        else inv.Timber -= ORCHARD_COST.wood;
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
        get().bumpStat("produceCollected", got);
      },

      buildHive: (idx) => {
        const s = get();
        if (s.hives[idx] || s.homeTier < 1) return;
        if ((s.inventory.Timber ?? 0) < HIVE_COST.wood) {
          s.addToast(`You need ${HIVE_COST.wood} Timber for the hive box 🌲`);
          sfx.error();
          return;
        }
        if (!spend(s, HIVE_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Timber - HIVE_COST.wood <= 0) delete inv.Timber;
        else inv.Timber -= HIVE_COST.wood;
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
        get().bumpStat("produceCollected", got);
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
        if ((s.inventory.Timber ?? 0) < def.wood) {
          s.addToast(`Needs ${def.wood} Timber 🌲`);
          sfx.error();
          return;
        }
        if ((s.inventory.Stone ?? 0) < def.stone) {
          s.addToast(`Needs ${def.stone} Stone 🪨`);
          sfx.error();
          return;
        }
        if (s.acorns < def.acorns) {
          s.addToast(`Needs ${def.acorns} Wood 🪵`);
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const [mat, cost] of [["Timber", def.wood], ["Stone", def.stone]] as const) {
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
        if (refundWood > 0) s.gainItem("Timber", refundWood);
        if (refundStone > 0) s.gainItem("Stone", refundStone);
        set({ structures: get().structures.filter((x) => x.id !== id) });
        s.addToast(`Removed ${def.label}`);
        sfx.ui();
      },

      enterCave: () => {
        const s = get();
        if (s.location !== "forest") return;
        set({
          location: "cave",
          zone: "⛏️ The Old Mine",
          savedForestPos: { x: live.x, z: live.z },
          mounted: false, // no horses underground
          chopTargetId: null,
          mineTargetId: null,
          attackTargetId: null,
          animalTargetId: null,
          fishingState: "idle",
        });
        teleport.x = 0;
        teleport.z = CAVE_HD - 2;
        teleport.pending = true;
        sfx.questDone();
      },

      exitCave: () => {
        const s = get();
        if (s.location !== "cave") return;
        set({ location: "forest", zone: "Darkwood", mineTargetId: null });
        teleport.x = CAVE_ENTRANCE_POS[0];
        teleport.z = CAVE_ENTRANCE_POS[2] + 2.2;
        teleport.pending = true;
        sfx.ui();
      },

      craftItem: (id) => {
        const s = get();
        const recipe = CRAFT_RECIPES.find((r) => r.id === id);
        if (!recipe) return;
        for (const [item, n] of Object.entries(recipe.inputs)) {
          if ((s.inventory[item] ?? 0) < n) {
            s.addToast(`Needs ${n} ${item}`);
            sfx.error();
            return;
          }
        }
        if (recipe.weapon && s.weapon === recipe.weapon) {
          s.addToast("You already wield it!");
          return;
        }
        const inv = { ...s.inventory };
        for (const [item, n] of Object.entries(recipe.inputs)) {
          if (inv[item] - n <= 0) delete inv[item];
          else inv[item] -= n;
        }
        set({ inventory: inv });
        if (recipe.weapon) {
          set({
            weapon: recipe.weapon,
            ownedWeapons: Array.from(new Set([...get().ownedWeapons, recipe.weapon])),
          });
          get().setBanner(`💠 You forged the ${WEAPONS[recipe.weapon].label}!`);
          sfx.levelUp();
        } else if (recipe.output) {
          get().gainItem(recipe.output.label, recipe.output.n);
          get().addToast(`🛠️ Crafted ${recipe.output.n} ${recipe.output.label} · +10 XP`);
          sfx.pickup();
        }
        get().addXp(10);
        get().bumpStat("itemsCrafted");
      },

      buyHorse: () => {
        const s = get();
        if (s.horse) return;
        if (!spend(s, HORSE_COST)) return;
        set({ acorns: s.acorns - HORSE_COST, horse: true });
        sfx.buy();
        s.setBanner("🐴 A horse of your own! Press H to ride");
      },

      buyBoat: () => {
        const s = get();
        if (s.boat) return;
        if ((s.inventory.Timber ?? 0) < BOAT_COST.wood) {
          s.addToast(`You need ${BOAT_COST.wood} Timber to build a boat 🌲`);
          sfx.error();
          return;
        }
        if (!spend(s, BOAT_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Timber - BOAT_COST.wood <= 0) delete inv.Timber;
        else inv.Timber -= BOAT_COST.wood;
        set({ acorns: s.acorns - BOAT_COST.acorns, inventory: inv, boat: true });
        sfx.buy();
        s.setBanner("⛵ A boat! Now you can cross the river and lake anywhere");
      },

      toggleMount: () => {
        const s = get();
        if (!s.horse) return;
        if (s.location === "interior" || s.location === "cave") {
          s.addToast("No room to ride in here!");
          return;
        }
        set({ mounted: !s.mounted });
        sfx.ui();
        if (!s.mounted) s.addToast("🐴 Mounted up — H to dismount");
      },

      // build-or-use a base station (chest / furnace / bench)
      station: (kind) => {
        const s = get();
        const builtKey = kind === "chest" ? "baseChest" : kind === "furnace" ? "baseFurnace" : "baseBench";
        if ((s as any)[builtKey]) {
          s.setOpenPanel(kind);
          return;
        }
        const def = BASE_BUILD[kind];
        if ((s.inventory.Timber ?? 0) < def.wood) { s.addToast(`Build the ${def.label}: needs ${def.wood} Timber 🌲`); sfx.error(); return; }
        if ((s.inventory.Stone ?? 0) < def.stone) { s.addToast(`Build the ${def.label}: needs ${def.stone} Stone 🪨`); sfx.error(); return; }
        const inv = { ...s.inventory };
        for (const [mat, n] of [["Timber", def.wood], ["Stone", def.stone]] as const) {
          if (n > 0) { if (inv[mat] - n <= 0) delete inv[mat]; else inv[mat] -= n; }
        }
        set({ inventory: inv, [builtKey]: true } as any);
        sfx.buy();
        s.setBanner(`${def.icon} ${def.label} built!`);
        s.setOpenPanel(kind);
      },

      // build-or-enter the house (Log Cabin first, then upgrades via the desk)
      houseStation: () => {
        const s = get();
        if (s.location === "visit") { s.enterHouse(); return; }
        if (s.houseLevel >= 1) { s.enterHouse(); return; }
        const def = HOUSE_LEVELS[0];
        if (!spend(s, def.acorns)) return;
        if ((s.inventory.Timber ?? 0) < def.wood) { s.addToast(`The ${def.name} needs ${def.wood} Timber 🌲`); sfx.error(); return; }
        const inv = { ...s.inventory };
        if (inv.Timber - def.wood <= 0) delete inv.Timber; else inv.Timber -= def.wood;
        set({ acorns: s.acorns - def.acorns, inventory: inv, houseLevel: 1 });
        sfx.levelUp();
        s.setBanner(`${def.icon} You built a ${def.name}!`);
        s.addToast("Step inside — sleep, store deeds, and upgrade from the desk");
      },

      tillSoil: (key) => {
        const s = get();
        if (s.tilled[key]) return;
        if ((s.inventory.Timber ?? 0) < TILL_COST.wood) { s.addToast(`Tilling soil needs ${TILL_COST.wood} Timber 🌲`); sfx.error(); return; }
        if (!spend(s, TILL_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (TILL_COST.wood > 0) { if (inv.Timber - TILL_COST.wood <= 0) delete inv.Timber; else inv.Timber -= TILL_COST.wood; }
        set({ acorns: s.acorns - TILL_COST.acorns, inventory: inv, tilled: { ...s.tilled, [key]: true } });
        sfx.pickup();
        s.addToast("🟫 Soil tilled — plant a seed here");
      },

      enterHouse: () => {
        const s = get();
        const visiting = s.location === "visit" && !!s.visitData;
        if (!visiting && (s.homeTier < 1 || s.location !== "home")) return;
        const lvRaw = visiting ? s.visitData!.houseLevel ?? 1 : s.houseLevel;
        const lv = Math.max(1, Math.min(lvRaw, HOUSE_LEVELS.length));
        const { hd } = interiorDims(lv);
        set({
          location: "interior",
          zone: visiting
            ? `🏠 ${s.visitData!.name}'s ${HOUSE_LEVELS[lv - 1].name}`
            : `🏠 ${HOUSE_LEVELS[lv - 1].name}`,
          buildMode: null,
          decorMode: null,
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
        const visiting = !!s.visitData;
        const lv = visiting ? s.visitData!.houseLevel ?? 1 : s.houseLevel;
        set({
          location: visiting ? "visit" : "home",
          zone: visiting ? `🏡 ${s.visitData!.name}'s land` : "🏡 Your Base",
          openPanel: null,
          decorMode: null,
        });
        teleport.x = HOME_CABIN_POS[0];
        teleport.z = HOME_CABIN_POS[2] + 2.2 + lv * 0.25 + 0.8;
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
            zone: "🏡 Your Base",
            chopTargetId: null,
            attackTargetId: null,
            animalTargetId: null,
            fishingState: "idle",
          });
          teleport.x = 0;
          teleport.z = homeGateZ(s.homeTier) - 2;
        } else {
          const p = s.savedForestPos ?? { x: HOME_PORTAL_POS[0], z: HOME_PORTAL_POS[2] + 2 };
          set({ location: "forest", zone: "The Hollow" });
          teleport.x = p.x;
          teleport.z = p.z;
        }
        teleport.pending = true;
        sfx.questDone();
      },

      plantSeed: (key) => {
        const s = get();
        if (s.farm[key]) return;
        if (!s.tilled[key]) {
          // not bought yet — buy the soil first
          s.tillSoil(key);
          return;
        }
        const seedLabel = Object.keys(SEEDS).find((label) => (s.inventory[label] ?? 0) > 0);
        if (!seedLabel) {
          s.addToast("No seeds! Buy some at The Den 🌱");
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
        const bonus = Math.random() < 0.08 * s.skills.harvest ? 1 : 0;
        const got = s.gainItem(def.yieldLabel, def.yieldN + bonus);
        if (got < 1) return;
        const farm = { ...get().farm };
        delete farm[key];
        set({ farm });
        s.addToast(`+${got} ${def.yieldLabel}${bonus ? " (bonus!)" : ""} · +8 XP`);
        sfx.pickup();
        s.addXp(8);
        get().bumpStat("cropsHarvested");
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
        // coal from the mine burns first; wood as a fallback
        const fuel = (s.inventory.Coal ?? 0) >= 1 ? "Coal" : "Timber";
        if ((s.inventory[fuel] ?? 0) < 1) {
          s.addToast("You need 1 Coal or 1 Timber for fuel ⚫🌲");
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const used of [rawLabel, fuel]) {
          if (inv[used] <= 1) delete inv[used];
          else inv[used] -= 1;
        }
        inv[cooked] = (inv[cooked] ?? 0) + 1;
        set({ inventory: inv });
        s.addToast(`🔥 Cooked 1 ${cooked} · +5 XP`);
        sfx.pickup();
        s.addXp(5);
        get().bumpStat("mealsCooked");
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
          s.addToast("☣️ You've been infected! Get an Antidote at The Remedy");
          sfx.error();
        }
        if (hp <= 0) {
          const lost = Math.floor(s.acorns * 0.25);
          const lootCount = Object.values(s.inventory).reduce((a, n) => a + n, 0);
          teleport.x = CAMPFIRE_POS[0] + 2;
          teleport.z = CAMPFIRE_POS[2] + 2;
          teleport.pending = true;
          // death is expensive: the whole pack is gone. Tools and gear stay
          // yours, and anything in your chest is safe — that's what it's for.
          set({
            hp: Math.round(s.maxHp * 0.5),
            energy: 40,
            hunger: Math.max(s.hunger, 30),
            acorns: s.acorns - lost,
            inventory: {},
            hurtAt: Date.now(),
            infected: false,
            location: "forest",
            attackTargetId: null,
            chopTargetId: null,
            animalTargetId: null,
          });
          s.setBanner("You blacked out… you wake by the campfire, pack empty");
          s.addToast(
            lootCount > 0
              ? `💀 Lost all your loot (${lootCount} items)${lost > 0 ? ` · ${lost} 🪵` : ""} — chest items are safe`
              : `💀 ${lost > 0 ? `Lost ${lost} 🪵 in the dark` : "At least your pack was already empty"}`
          );
        } else {
          set({ hp, hurtAt: Date.now() });
        }
      },

      setFishingState: (fs) => {
        if (get().fishingState !== fs) set({ fishingState: fs });
      },

      catchFish: () => {
        const s = get();
        const fish = rollFish(s.skills.angling * 2);
        set({ fishingState: "idle" });
        if (s.gainItem(fish, 1) < 1) return;
        s.addToast(fish === "Golden Fish" ? `✨ Rare catch! +1 ${fish} · +12 XP` : `+1 ${fish} · +12 XP`);
        sfx.pickup();
        s.addXp(12);
        get().bumpStat("fishCaught");
        if (fish === "Golden Fish") get().bumpStat("goldenFish");
        get().questEvent("go-fish");
      },

      collectWater: () => {
        const s = get();
        if (s.gainItem("Water", 1) < 1) return;
        set({ energy: Math.min(s.maxEnergy, get().energy + 8) });
        s.addToast("+1 Water · +3 XP");
        sfx.pickup();
        s.addXp(3);
        get().bumpStat("watersCollected");
      },

      buyAxe: (tier) => {
        const s = get();
        const def = AXES[tier];
        if (s.ownedAxes.includes(tier)) {
          set({ axe: tier });
          sfx.ui();
          s.addToast(`Equipped the ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, axe: tier, ownedAxes: [...s.ownedAxes, tier] });
        sfx.buy();
        s.addToast(`Bought the ${def.label}!`);
        get().questEvent("buy-axe");
      },

      equipWeapon: (tier) => {
        const s = get();
        if (tier && !s.ownedWeapons.includes(tier)) return;
        set({ weapon: tier });
        sfx.ui();
        s.addToast(tier ? `Equipped ${WEAPONS[tier].label}` : "Weapon stowed — bare fists");
      },
      equipAxe: (tier) => {
        const s = get();
        if (tier && !s.ownedAxes.includes(tier)) return;
        set({ axe: tier });
        sfx.ui();
        s.addToast(tier ? `Equipped ${AXES[tier].label}` : "Axe stowed");
      },
      equipArmor: (tier) => {
        const s = get();
        if (tier && !s.ownedArmor.includes(tier)) return;
        set({ armor: tier });
        sfx.ui();
        s.addToast(tier ? `Equipped ${ARMOR[tier].label}` : "Armour removed");
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
        const def = WEAPONS[tier];
        // already own it? just equip
        if (s.ownedWeapons.includes(tier)) {
          set({ weapon: tier });
          sfx.ui();
          s.addToast(`Equipped the ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, weapon: tier, ownedWeapons: [...s.ownedWeapons, tier] });
        sfx.buy();
        s.addToast(`Bought & equipped the ${def.label}! (${def.dmg} dmg)`);
      },

      buyArmor: (tier) => {
        const s = get();
        const def = ARMOR[tier];
        if (s.ownedArmor.includes(tier)) {
          set({ armor: tier });
          sfx.ui();
          s.addToast(`Equipped the ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, armor: tier, ownedArmor: [...s.ownedArmor, tier] });
        sfx.buy();
        s.addToast(`Bought & equipped the ${def.label}!`);
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
        } else if (label === "Magic Shroom") {
          consume();
          set({
            tripUntil: Date.now() + 30_000,
            tripKind: "shroom",
            energy: Math.min(s.maxEnergy, s.energy + 20),
          });
          s.setBanner("🌈 The forest begins to breathe…");
          s.addToast("🍄 +20 ⚡ · the colours… the COLOURS");
          sfx.levelUp();
        } else if (label === "Weed") {
          consume();
          set({
            tripUntil: Date.now() + 25_000,
            tripKind: "weed",
            hp: Math.min(s.maxHp, s.hp + 8),
            hunger: Math.max(0, s.hunger - 12), // munchies
          });
          s.setBanner("🌿 Everything is… fine, actually");
          s.addToast("🌿 +8 ❤ · suddenly very hungry");
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
          s.addToast(`Traded ${offer.qty} ${offer.item} to ${offer.npc} for ${offer.price} 🪵`);
          sfx.coin();
          get().bumpStat("acornsEarned", offer.price);
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
        s.addToast(`Sold ${n} ${label} for ${price * n} Wood`);
        get().bumpStat("acornsEarned", price * n);
      },

      // auto-complete the active quest (and any after it) if the player has
      // already met its condition — fixes e.g. buying land before the quest
      catchUpQuests: () => {
        const satisfied = (q: Quest): boolean => {
          const st = get();
          const stat = (k: string) => st.stats[k] ?? 0;
          switch (q.id) {
            case "timber": return stat("treesChopped") >= q.goal;
            case "buy-axe": return !!st.axe;
            case "go-fish": return stat("fishCaught") >= q.goal;
            case "night-watch": return stat("zombiesKilled") >= q.goal;
            case "buy-plot": return st.homeTier >= 1;
            case "harvest": return stat("cropsHarvested") >= q.goal;
            case "cook": return stat("mealsCooked") >= q.goal;
            default: return false;
          }
        };
        let changed = false;
        for (let guard = 0; guard < 20; guard++) {
          const quests = get().quests;
          const ai = quests.findIndex((q) => !q.done);
          if (ai === -1) break;
          const q = quests[ai];
          if (!satisfied(q)) break;
          set({
            quests: quests.map((x, i) => (i === ai ? { ...x, progress: x.goal, done: true } : x)),
            acorns: get().acorns + q.acorns,
          });
          get().setBanner(`Quest complete — ${q.title}`);
          get().addToast(`Reward: +${q.xp} XP${q.acorns > 0 ? ` · +${q.acorns} 🪵` : ""}`);
          get().addXp(q.xp);
          changed = true;
        }
        if (changed) {
          const next = get().quests.find((q) => !q.done);
          if (next) setTimeout(() => get().addToast(`New quest: ${next.title}`), 1200);
        }
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
          s.addToast(`Reward: +${quest.xp} XP${quest.acorns > 0 ? ` · +${quest.acorns} 🪵` : ""}`);
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

        // appetite: faster when working hard (slowed right down — a full bar
        // now lasts well over an hour of light play)
        const burn = working || sprinting ? 0.05 : 0.022;
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
        set({
          openShop: null, openPanel: null, openPen: null, homeOffer: null, buildMode: null,
          decorMode: null, showQuests: false, showHelp: false, showSkills: false,
          showJournal: false, showDecorShop: false, showInventory: false, showNotice: false,
        }),
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
        ownedAxes: s.ownedAxes,
        ownedWeapons: s.ownedWeapons,
        ownedArmor: s.ownedArmor,
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
        baseChest: s.baseChest,
        baseFurnace: s.baseFurnace,
        baseBench: s.baseBench,
        tilled: s.tilled,
        baseResetAck: s.baseResetAck,
        lastRentAt: s.lastRentAt,
        chest: s.chest,
        farm: s.farm,
        dog: s.dog,
        dogXp: s.dogXp,
        cat: s.cat,
        catLastPet: s.catLastPet,
        horse: s.horse,
        boat: s.boat,
        pens: s.pens,
        orchard: s.orchard,
        hives: s.hives,
        structures: s.structures,
        interiorDecor: s.interiorDecor,
        stats: s.stats,
        skills: s.skills,
        skillPoints: s.skillPoints,
        claimedAchievements: s.claimedAchievements,
        dailyDay: s.dailyDay,
        dailyBase: s.dailyBase,
        dailyClaimed: s.dailyClaimed,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        sfx.muted = state.muted;
        // back-fill owned-gear lists for saves from before they existed
        if (!state.ownedWeapons) state.ownedWeapons = state.weapon ? [state.weapon] : [];
        if (!state.ownedAxes) state.ownedAxes = state.axe ? [state.axe] : [];
        if (!state.ownedArmor) state.ownedArmor = state.armor ? [state.armor] : [];
        // one-time base wipe for this epoch (keeps acorns/level/etc.)
        migrateWoodToTimber(state);
        const wiped = applyBaseReset(state);
        if (wiped && state.homeTier === 0) state.location = "forest";
        // existing base owners already had everything built — keep it that way
        if (state.homeTier >= 1 && state.baseChest === undefined) {
          state.baseChest = true;
          state.baseFurnace = true;
          state.baseBench = true;
          if (!state.houseLevel || state.houseLevel < 1) state.houseLevel = 1;
          const tiles = HOME_TIERS[Math.min(state.homeTier, HOME_TIERS.length) - 1].tiles;
          state.tilled = state.tilled ?? {};
          for (let i = 0; i < tiles; i++) state.tilled[`home:${i}`] = true;
        } else if (state.homeTier < 1 || state.homeTier === undefined) {
          // never owned land — make sure they start house-less on a fresh base
          if (state.baseChest === undefined) state.houseLevel = 0;
        }
      },
    }
  )
);
