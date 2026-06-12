# WILDWOOD

An isometric 3D forest survival/quest game in the browser, built with Next.js +
react-three-fiber using the Polyperfect free low-poly nature pack (the `pp_*`
FBX assets + palette texture in `public/models/`).

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Controls

- **WASD / arrow keys** or **click the ground** — move
- **Shift** — sprint (drains energy)
- **Click a tree** — walk over and chop it (slow by hand; buy an axe!)
- **E** — trade when near the Trading Post
- Stand near the **campfire** to restore HP and energy

## Features

- **Login screen** with name entry; progress auto-saves to localStorage
- **Solid collision** — trees, rocks, fences, mountains; the river is only
  crossable via the Old Bridge (you walk up over its deck)
- **Tree chopping** — click a tree, chop bar fills, tree topples and yields
  wood; stumps regrow after ~75s
- **Economy** — sell wood/mushrooms/flowers at the Trading Post for acorns;
  buy the Rusty Axe (faster, +1 wood) or Golden Axe (fastest, +3 wood)
- **Fishing** — buy the Fishing Rod (80 acorns), stand by the river, press
  **F** to cast, press **F** again on the bite. Carp / Trout / rare Golden Fish
- **Water collecting** — click the river up close for water (sellable, restores
  a little energy)
- **Night zombies** — they rise after dark (a HUD timer counts down to
  nightfall), roam and chase; click one to attack. Kills grant XP + acorn
  loot. Scratches can **infect** you (HP drain until cured). If they down
  you, you wake at the campfire minus some acorns
- **Five camp buildings**:
  - 🛖 Trading Post — sell goods, buy axes + fishing rod
  - ⚔️ Armoury — weapons (club/spear/sword) and armour (leather/iron)
  - 🧵 Tailor — shirt colours and hats to customise your character
  - 🏥 Med-Bay — bandages, medkits, antidotes (click meds in hotbar to use)
  - ⚖️ Exchange — daily NPC offers at premium prices, refresh each dawn
- **Visible equipment** — shirt colour, hat, armour, weapon, axe, and the rod
  (on your back, in hand while fishing) all render on the player
- **Rank banner** — top of screen shows your rank (Drifter → Forest Legend)
  with live XP progress; quests and pickups display their XP/acorn rewards
- **Land ownership** — buy your homestead at the 🏡 gate near camp (250🌰).
  It's a **separate instance off the main map** (so the forest never gets
  crowded), with farm tiles, a chest, a furnace, a cabin — and no zombies.
  Pay to extend it twice (300🌰 → 600🌰) for more tiles, bigger grounds and a
  bigger chest (6/12/18 tiles, 200/300/400 storage)
- **Farming** — buy Carrot/Pumpkin seeds at the Trading Post, click a tile to
  plant, click again to harvest when ready
- **Animals** — chickens (briefly stunned when hit, so hunts actually end)
  and boars (fight back!) roam the map and drop raw meat; they respawn.
  Animal attacks never infect — only zombie scratches and eating raw meat do
- **Cooking** — the furnace turns raw meat/fish into meals (1 Wood per cook).
  Eating raw chicken has a 60% infection chance; cooked food heals properly
- **Pack limit** — 40 items on you; store the rest in your plot's chest
- **12 sequential quests** — through foraging, chopping, fishing, the bridge,
  night watch, land ownership, farming and cooking
- **Day/night cycle** (~4 min) with firefly swarms and a glowing campfire
- **Collectible respawns**, XP/levels, sprint, circular minimap, dynamic
  hotbar, WebAudio sound effects (mutable)

## v7 additions

- **20-minute day/night cycle** (Minecraft pacing) with countdown pills
- **Blood moon** every 5th night: red sky, double zombies, faster spawns, 2× loot
- **Zombie variety**: walkers, fast runners, hulking brutes
- **Hunger meter** — eat to stay fed; starving drains HP, hunger blocks regen
- **Pet dog** (Trading Post, 200🌰) — follows you and bites zombies
- **Chicken coop** on your homestead — hens lay eggs while you're away;
  collect, fry in the furnace, eat or sell
- **Build mode** (🔨 at home) — place stone paths, torches (lit at night),
  flower beds and a barn using wood + acorns; remove refunds half
- **Homestead gate** now stands in the west fence gap with its own path
- **Accounts + cloud saves** — Prisma/SQLite + jose JWT. Online tab on the
  login screen; saves sync every 20s. The Exchange gains **real player
  offers** (escrowed; proceeds delivered next login) and **visit any
  player's homestead** read-only by name.

API: `app/api/{auth,save,offers,visit}` · DB: `prisma/dev.db` (set
`DATABASE_URL` to Postgres for production)

## Structure

- `lib/world.ts` — seeded world layout, colliders, `resolveMovement`, `bridgeY`
- `lib/assets.tsx` — FBX loading, palette material, size normalization
- `lib/store.ts` — zustand game state (persisted), quests, economy, chopping
- `lib/runtime.ts` — per-frame mutable state (position, chop progress, clock)
- `lib/sound.ts` — WebAudio synth SFX
- `components/Trees.tsx` — choppable trees, fall/regrow animation
- `components/World.tsx` — ground, river, bridge, campfire, trading post, fireflies
- `components/Player.tsx` — movement + collision, chopping, camera, triggers
- `components/Hud.tsx` — pills, minimap, quest card, hotbar, shop/quest/help modals
- `components/Login.tsx` — preloader/login screen
- `scripts/shot.mjs` — Playwright playtest helper
  (`START=1 KEYS="w:2000" EVAL='...' REPORT=1 node scripts/shot.mjs`)
