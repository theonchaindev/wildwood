"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  useGame, AXES, WEAPONS, ARMOR, SHIRTS, HATS, MEDS, SEEDS, FOODS, RECIPES,
  SELL_PRICES, COMBAT, AxeTier, WeaponTier, ArmorTier, ROD_COST, DOG_COST,
  BUILDABLES, PEN_DEFS, PEN_BUILD_COST, MAX_PER_PEN, PenAnimal,
  PICKAXE_COST, HELD_TORCH_COST, HOUSE_LEVELS, RENT_AMOUNT, RENT_INTERVAL_MS,
  SKILLS, SkillKey, MAX_SKILL_RANK, ACHIEVEMENTS, dailyQuestsFor,
  DECOR_ITEMS, MAX_DECOR, CAT_COST,
  COLLECTIBLE_RESPAWN_MS, PACK_CAP, chestCapFor, rankFor, dayOffers,
} from "@/lib/store";
import {
  live, clock, timePhase, zombies, animals, isNight, isBloodMoonNight,
  isBossNight, isRaining, seasonFor, fishing,
  secondsToNight, secondsToDawn,
} from "@/lib/runtime";
import {
  TREES, COLLECTIBLES, RIVER_X, RIVER_WIDTH, CAMPFIRE_POS, BUILDINGS,
  HOME_PORTAL_POS, HOME_TIERS,
} from "@/lib/world";
import {
  fetchOffers, postOffer, acceptPlayerOffer, cancelPlayerOffer, fetchVisit,
  cashOut, fetchLeaderboard, ACORNS_PER_SOL, PlayerOffer,
  fetchGifts, sendGift, claimGift, Gift as CloudGift,
  fetchGuestbook, signGuestbook, GuestbookEntry,
} from "@/lib/cloud";
import { ghosts } from "@/lib/multiplayer";

const ITEM_ICONS: Record<string, string> = {
  Wood: "🪵",
  "Orange Mushroom": "🍄",
  "Purple Mushroom": "🍄‍🟫",
  Sunflower: "🌻",
  Hyacinth: "🪻",
  Daffodil: "🌼",
  Water: "💧",
  Carp: "🐟",
  Trout: "🐠",
  "Golden Fish": "🐡",
  Bandage: "🩹",
  Medkit: "🧰",
  Antidote: "💉",
  "Carrot Seeds": "🌱",
  "Pumpkin Seeds": "🌱",
  Carrot: "🥕",
  Pumpkin: "🎃",
  "Raw Chicken": "🥩",
  "Cooked Chicken": "🍗",
  "Raw Pork": "🥓",
  "Cooked Pork": "🍖",
  "Cooked Fish": "🍤",
  Egg: "🥚",
  "Fried Egg": "🍳",
  Stone: "🪨",
  Wool: "🧶",
  "Raw Steak": "🥩",
  "Cooked Steak": "🍖",
  "Raw Rabbit": "🥩",
  "Cooked Rabbit": "🍖",
  "Raw Venison": "🥩",
  "Cooked Venison": "🍖",
  Apple: "🍎",
  Honey: "🍯",
};

const BUILDING_LABELS = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.label]));

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function Bar({ value, max, color, icon }: { value: number; max: number; color: string; icon: string }) {
  return (
    <div className="stat-row">
      <span className="stat-icon">{icon}</span>
      <div className="stat-track">
        <div
          className="stat-fill"
          style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }}
        />
      </div>
      <span className="stat-num">{Math.round(value)}</span>
    </div>
  );
}

function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext("2d")!;
        const S = cv.width;
        const scale = S / 150;
        const toPx = (x: number, z: number) => [(x + 75) * scale, (z + 75) * scale] as const;

        ctx.clearRect(0, 0, S, S);
        ctx.save();
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = "#48613a";
        ctx.fillRect(0, 0, S, S);

        ctx.fillStyle = "#4d86b3";
        const [rx] = toPx(RIVER_X - RIVER_WIDTH / 2, 0);
        ctx.fillRect(rx, 0, RIVER_WIDTH * scale, S);

        ctx.fillStyle = "#5d7a45";
        const [gx, gz] = toPx(0, 0);
        ctx.beginPath();
        ctx.arc(gx, gz, 15 * scale, 0, Math.PI * 2);
        ctx.fill();

        const state = useGame.getState();

        ctx.fillStyle = "#36502a";
        for (const t of TREES) {
          if (state.choppedAt[t.id]) continue;
          const [x, z] = toPx(t.pos[0], t.pos[2]);
          ctx.fillRect(x - 1, z - 1, 2, 2);
        }

        const now = Date.now();
        ctx.fillStyle = "#ffd968";
        for (const c of COLLECTIBLES) {
          const at = state.collected[c.id];
          if (at && now - at < COLLECTIBLE_RESPAWN_MS) continue;
          const [x, z] = toPx(c.pos[0], c.pos[2]);
          ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
        }

        ctx.fillStyle = "#ff8c1a";
        const [cx, cz] = toPx(CAMPFIRE_POS[0], CAMPFIRE_POS[2]);
        ctx.beginPath();
        ctx.arc(cx, cz, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e2c184";
        for (const b of BUILDINGS) {
          const [tx, tz] = toPx(b.pos[0], b.pos[2]);
          ctx.fillRect(tx - 2, tz - 2, 4, 4);
        }

        // homestead gate
        ctx.fillStyle = "#9bd06a";
        const [hx, hz] = toPx(HOME_PORTAL_POS[0], HOME_PORTAL_POS[2]);
        ctx.fillRect(hx - 2.5, hz - 2.5, 5, 5);

        // animals
        for (const a of animals) {
          if (a.state === "dead") continue;
          ctx.fillStyle = a.kind === "chicken" ? "#f2efe6" : "#8a6a3f";
          const [ax, az] = toPx(a.x, a.z);
          ctx.fillRect(ax - 1.5, az - 1.5, 3, 3);
        }

        ctx.fillStyle = "#ff5040";
        for (const z of zombies) {
          if (z.state === "dying") continue;
          const [zx, zz] = toPx(z.x, z.z);
          ctx.beginPath();
          ctx.arc(zx, zz, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // other live players
        ctx.fillStyle = "#6ec1e8";
        for (const gp of ghosts) {
          const [gx2, gz2] = toPx(gp.cx, gp.cz);
          ctx.beginPath();
          ctx.arc(gx2, gz2, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#ffffff";
        const [px, pz] = toPx(live.x, live.z);
        ctx.beginPath();
        ctx.arc(px, pz, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} width={150} height={150} className="minimap" />;
}

function ClockPill() {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      tick((n) => n + 1);
      useGame.getState().ensureDaily(); // roll the daily tasks at each new game day
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  const phase = timePhase();
  const night = isNight();
  const blood = isBloodMoonNight();
  const boss = isBossNight();
  const bossComing = !night && boss;
  const bloodComing = !night && clock.day % 5 === 0;
  const season = seasonFor(clock.day);
  const icon = blood ? "🔴" : night ? "🌙" : phase === "Dusk" || phase === "Dawn" ? "🌅" : "☀️";
  return (
    <>
      <div className="pill">
        {icon} Day {clock.day} · {phase} · {season.icon} {season.name}{isRaining() ? " · 🌧" : ""}
      </div>
      {boss && night ? (
        <div className="pill danger">👹 THE BUTCHER WALKS! Dawn in {fmtTime(secondsToDawn())}</div>
      ) : blood ? (
        <div className="pill danger">🔴 BLOOD MOON! Dawn in {fmtTime(secondsToDawn())}</div>
      ) : night ? (
        <div className="pill danger">🧟 Out now! Dawn in {fmtTime(secondsToDawn())}</div>
      ) : (
        <div className="pill">
          {bossComing ? "👹 The Butcher" : bloodComing ? "🔴 Blood moon" : "🧟 Rise"} in {fmtTime(secondsToNight())}
        </div>
      )}
    </>
  );
}

function RankBanner() {
  const level = useGame((s) => s.level);
  const xp = useGame((s) => s.xp);
  const cap = level * 100;
  return (
    <div className="rank-banner">
      <span className="rank-medal">🎖️</span>
      <div className="rank-mid">
        <div className="rank-name">{rankFor(level)} · Lv {level}</div>
        <div className="rank-track">
          <div className="rank-fill" style={{ width: `${(xp / cap) * 100}%` }} />
        </div>
      </div>
      <span className="rank-xp">{Math.floor(xp)}/{cap} XP</span>
    </div>
  );
}

function ShopRow({
  icon, name, blurb, right,
}: { icon: string; name: React.ReactNode; blurb: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="shop-row">
      <div className="shop-item">
        <span className="shop-icon">{icon}</span>
        <div>
          <div className="shop-name">{name}</div>
          <div className="shop-blurb">{blurb}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function BuyBtn({ cost, disabled, onClick }: { cost: number; disabled?: boolean; onClick: () => void }) {
  const acorns = useGame((s) => s.acorns);
  return (
    <button className="btn small" disabled={disabled || acorns < cost} onClick={onClick}>
      🌰 {cost}
    </button>
  );
}

function TraderShop() {
  const s = useGame();
  const invEntries = Object.entries(s.inventory).filter(([label]) => SELL_PRICES[label]);
  return (
    <>
      <div className="shop-section">Tools</div>
      {(Object.keys(AXES) as AxeTier[]).map((tier) => {
        const def = AXES[tier];
        const owned = s.axe === tier || (s.axe === "golden" && tier === "rusty");
        return (
          <ShopRow
            key={tier}
            icon={tier === "golden" ? "✨🪓" : "🪓"}
            name={def.label}
            blurb={def.blurb}
            right={owned ? <span className="shop-owned">Owned</span> : <BuyBtn cost={def.cost} onClick={() => s.buyAxe(tier)} />}
          />
        );
      })}
      <ShopRow
        icon="🎣"
        name="Fishing Rod"
        blurb="Stand by the river and press F to fish"
        right={s.rod ? <span className="shop-owned">Owned</span> : <BuyBtn cost={ROD_COST} onClick={s.buyRod} />}
      />
      <ShopRow
        icon="⛏️"
        name="Pickaxe"
        blurb="Mine rocks ~3× faster, +2 stone per rock"
        right={s.pickaxe ? <span className="shop-owned">Owned</span> : <BuyBtn cost={PICKAXE_COST} onClick={s.buyPickaxe} />}
      />
      <ShopRow
        icon="🔥"
        name="Hand Torch"
        blurb="Carried on your hip — lights your way automatically at night"
        right={s.heldTorch ? <span className="shop-owned">Owned</span> : <BuyBtn cost={HELD_TORCH_COST} onClick={s.buyHeldTorch} />}
      />
      <div className="shop-section">Pets</div>
      <ShopRow
        icon="🐕"
        name="Loyal Dog"
        blurb="Follows you everywhere and bites zombies — he levels up with every scrap"
        right={s.dog ? <span className="shop-owned">Adopted</span> : <BuyBtn cost={DOG_COST} onClick={s.buyDog} />}
      />
      <ShopRow
        icon="🐈"
        name="House Cat"
        blurb="Lives on your Haven. Pet her once a day for a little present"
        right={s.cat ? <span className="shop-owned">Adopted</span> : <BuyBtn cost={CAT_COST} onClick={s.buyCat} />}
      />
      <div className="shop-section">Seeds — plant on your own plot</div>
      {Object.entries(SEEDS).map(([label, def]) => (
        <ShopRow
          key={label}
          icon="🌱"
          name={<>{label} {s.inventory[label] ? <span className="shop-count">×{s.inventory[label]}</span> : null}</>}
          blurb={<>Grows {def.yieldLabel} ×{def.yieldN} in {Math.round(def.growMs / 1000)}s</>}
          right={<BuyBtn cost={def.cost} onClick={() => s.buyMed(label)} />}
        />
      ))}
      <div className="shop-section">Sell</div>
      {invEntries.length === 0 && <div className="shop-empty">Nothing to sell — go forage, chop and fish!</div>}
      {invEntries.map(([label, n]) => (
        <ShopRow
          key={label}
          icon={ITEM_ICONS[label] ?? "📦"}
          name={<>{label} <span className="shop-count">×{n}</span></>}
          blurb={<>🌰 {SELL_PRICES[label]} each</>}
          right={
            <div className="shop-actions">
              <button className="btn small ghost" onClick={() => s.sellItem(label, 1)}>Sell 1</button>
              <button className="btn small" onClick={() => s.sellItem(label, n)}>Sell all</button>
            </div>
          }
        />
      ))}
    </>
  );
}

function ArmouryShop() {
  const s = useGame();
  const wOrder: WeaponTier[] = ["club", "spear", "sword"];
  const aOrder: ArmorTier[] = ["leather", "iron"];
  return (
    <>
      <div className="shop-section">Weapons — fight the dead</div>
      {wOrder.map((tier) => {
        const def = WEAPONS[tier];
        const c = COMBAT[tier];
        const owned = s.weapon && wOrder.indexOf(s.weapon) >= wOrder.indexOf(tier);
        return (
          <ShopRow
            key={tier}
            icon={def.icon}
            name={def.label}
            blurb={<>{def.blurb}<br /><b>{c.dmg} dmg</b> · {c.swing}s swing · {c.reach}m reach{c.crit > 0 ? ` · ${Math.round(c.crit * 100)}% crit` : ""}</>}
            right={owned ? <span className="shop-owned">{s.weapon === tier ? "Equipped" : "Owned"}</span> : <BuyBtn cost={def.cost} onClick={() => s.buyWeapon(tier)} />}
          />
        );
      })}
      <div className="shop-section">Armour</div>
      {aOrder.map((tier) => {
        const def = ARMOR[tier];
        const owned = s.armor && aOrder.indexOf(s.armor) >= aOrder.indexOf(tier);
        return (
          <ShopRow
            key={tier}
            icon={def.icon}
            name={def.label}
            blurb={def.blurb}
            right={owned ? <span className="shop-owned">{s.armor === tier ? "Equipped" : "Owned"}</span> : <BuyBtn cost={def.cost} onClick={() => s.buyArmor(tier)} />}
          />
        );
      })}
      <div className="shop-note">
        Fists: 8 dmg, slow · Axe: 14 dmg · The club shoves zombies back, the spear outranges
        their claws, the sword crits for double damage
      </div>
    </>
  );
}

function TailorShop() {
  const s = useGame();
  return (
    <>
      <div className="shop-section">Shirts</div>
      {Object.entries(SHIRTS).map(([key, def]) => {
        const owned = s.ownedShirts.includes(key);
        const wearing = s.shirt === key;
        return (
          <ShopRow
            key={key}
            icon="👕"
            name={<><span className="swatch" style={{ background: def.color }} /> {def.label}</>}
            blurb={owned ? "In your wardrobe" : <>🌰 {def.cost}</>}
            right={
              wearing ? (
                <span className="shop-owned">Wearing</span>
              ) : (
                <button className="btn small" onClick={() => s.buyShirt(key)}>
                  {owned ? "Wear" : `🌰 ${def.cost}`}
                </button>
              )
            }
          />
        );
      })}
      <div className="shop-section">Hats</div>
      <ShopRow
        icon="🚫"
        name="No hat"
        blurb="Just the hood"
        right={
          s.hat === null ? <span className="shop-owned">Wearing</span> : (
            <button className="btn small ghost" onClick={() => s.buyHat("none")}>Remove</button>
          )
        }
      />
      {Object.entries(HATS).map(([key, def]) => {
        const owned = s.ownedHats.includes(key);
        const wearing = s.hat === key;
        return (
          <ShopRow
            key={key}
            icon={def.icon}
            name={def.label}
            blurb={owned ? "In your wardrobe" : <>🌰 {def.cost}</>}
            right={
              wearing ? (
                <span className="shop-owned">Wearing</span>
              ) : (
                <button className="btn small" onClick={() => s.buyHat(key)}>
                  {owned ? "Wear" : `🌰 ${def.cost}`}
                </button>
              )
            }
          />
        );
      })}
    </>
  );
}

function MedbayShop() {
  const s = useGame();
  return (
    <>
      {s.infected && (
        <div className="infect-warning">☣️ You are infected — HP is draining. Use an Antidote!</div>
      )}
      <div className="shop-section">Supplies</div>
      {Object.entries(MEDS).map(([label, def]) => (
        <ShopRow
          key={label}
          icon={def.icon}
          name={<>{label} {s.inventory[label] ? <span className="shop-count">×{s.inventory[label]}</span> : null}</>}
          blurb={def.blurb}
          right={
            <div className="shop-actions">
              {s.inventory[label] ? (
                <button className="btn small ghost" onClick={() => s.useItem(label)}>Use</button>
              ) : null}
              <BuyBtn cost={def.cost} onClick={() => s.buyMed(label)} />
            </div>
          }
        />
      ))}
      <div className="shop-note">Zombie scratches have a chance to infect you. The campfire heals wounds but not infection.</div>
    </>
  );
}

function PlayerOffers() {
  const s = useGame();
  const [offers, setOffers] = useState<PlayerOffer[] | null>(null);
  const [postItem, setPostItem] = useState("");
  const [postQty, setPostQty] = useState(1);
  const [postPrice, setPostPrice] = useState(10);
  const [visitName, setVisitName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    fetchOffers().then(setOffers).catch(() => setOffers([]));
  };
  useEffect(refresh, []);

  if (!s.account) {
    return (
      <div className="shop-note">
        🌐 Log in with an online account to trade with other players and visit
        their Havens.
      </div>
    );
  }

  const sellable = Object.keys(s.inventory).filter((l) => SELL_PRICES[l]);

  const doVisit = async () => {
    setErr(null);
    try {
      const data = await fetchVisit(visitName.trim());
      s.startVisit(data as any);
      s.closeModals();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <>
      <div className="shop-section">Player offers</div>
      {offers === null && <div className="shop-empty">Loading…</div>}
      {offers !== null && offers.length === 0 && (
        <div className="shop-empty">No open offers — post the first one!</div>
      )}
      {offers?.map((o) => (
        <ShopRow
          key={o.id}
          icon={ITEM_ICONS[o.item] ?? "📦"}
          name={<><b>{o.sellerName}</b> sells {o.qty} {o.item}</>}
          blurb={<>for <b>{o.price} 🌰</b></>}
          right={
            o.mine ? (
              <button
                className="btn small ghost"
                onClick={() => cancelPlayerOffer(o).then(refresh).catch((e) => setErr(e.message))}
              >
                Cancel
              </button>
            ) : (
              <button
                className="btn small"
                disabled={s.acorns < o.price}
                onClick={() => acceptPlayerOffer(o).then(refresh).catch((e) => setErr(e.message))}
              >
                Buy
              </button>
            )
          }
        />
      ))}

      <div className="shop-section">Post an offer (escrowed · 5% market fee on sale)</div>
      <div className="offer-form">
        <select className="offer-input" value={postItem} onChange={(e) => setPostItem(e.target.value)}>
          <option value="">item…</option>
          {sellable.map((l) => (
            <option key={l} value={l}>{l} (×{s.inventory[l]})</option>
          ))}
        </select>
        <input
          className="offer-input num" type="number" min={1} max={s.inventory[postItem] ?? 1}
          value={postQty} onChange={(e) => setPostQty(Number(e.target.value))}
        />
        <span className="offer-x">for</span>
        <input
          className="offer-input num" type="number" min={1}
          value={postPrice} onChange={(e) => setPostPrice(Number(e.target.value))}
        />
        <span className="offer-x">🌰</span>
        <button
          className="btn small"
          disabled={!postItem || postQty < 1}
          onClick={() => postOffer(postItem, postQty, postPrice).then(refresh).catch((e) => setErr(e.message))}
        >
          Post
        </button>
      </div>

      <GiftsSection />

      <div className="shop-section">💸 Cash out — play to earn</div>
      {s.account.wallet ? (
        <>
          <div className="shop-note" style={{ marginTop: 0 }}>
            1,000 🌰 = 0.01 SOL, paid from the dev wallet to{" "}
            <b>{s.account.wallet.slice(0, 4)}…{s.account.wallet.slice(-4)}</b>
          </div>
          <div className="offer-form" style={{ marginTop: 8 }}>
            {[1000, 5000, 10000].map((n) => (
              <button
                key={n}
                className="btn small"
                disabled={s.acorns < n}
                onClick={() => cashOut(n).catch((e) => setErr(e.message))}
              >
                {n} 🌰 → {(n / ACORNS_PER_SOL).toFixed(2)} SOL
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="shop-note" style={{ marginTop: 0 }}>
          Sign in with Phantom on the intro screen to cash acorns out as SOL.
        </div>
      )}

      <div className="shop-section">Visit a forager</div>
      <div className="offer-form">
        <input
          className="offer-input grow" placeholder="Their name…"
          value={visitName} onChange={(e) => setVisitName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doVisit()}
        />
        <button className="btn small" disabled={!visitName.trim()} onClick={doVisit}>
          Visit 🏡
        </button>
      </div>
      {err && <div className="offer-error">{err}</div>}
    </>
  );
}

function GiftsSection() {
  const s = useGame();
  const [gifts, setGifts] = useState<CloudGift[] | null>(null);
  const [to, setTo] = useState("");
  const [giftItem, setGiftItem] = useState("");
  const [giftQty, setGiftQty] = useState(1);
  const [tip, setTip] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => {
    fetchGifts().then((d) => setGifts(d.gifts)).catch(() => setGifts([]));
  };
  useEffect(refresh, []);

  const claim = async (g: CloudGift) => {
    try {
      await claimGift(g.id);
      if (g.acorns > 0) useGame.setState({ acorns: useGame.getState().acorns + g.acorns });
      if (g.item && g.qty > 0) s.gainItem(g.item, g.qty);
      s.addToast(
        `🎁 From ${g.fromName}: ${[g.acorns > 0 ? `${g.acorns} 🌰` : "", g.item ? `${g.qty} ${g.item}` : ""].filter(Boolean).join(" + ")}`
      );
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const send = async () => {
    setErr(null);
    const payload: { acorns?: number; item?: string; qty?: number } = {};
    if (tip > 0) {
      if (s.acorns < tip) {
        setErr("Not enough acorns for that tip");
        return;
      }
      payload.acorns = tip;
    }
    if (giftItem && giftQty > 0) {
      if ((s.inventory[giftItem] ?? 0) < giftQty) {
        setErr(`You don't have ${giftQty} ${giftItem}`);
        return;
      }
      payload.item = giftItem;
      payload.qty = giftQty;
    }
    if (!payload.acorns && !payload.item) {
      setErr("Add a tip or an item to the parcel");
      return;
    }
    try {
      await sendGift(to.trim(), payload);
      // hand the goods over locally
      if (payload.acorns) useGame.setState({ acorns: useGame.getState().acorns - payload.acorns });
      if (payload.item && payload.qty) {
        const inv = { ...useGame.getState().inventory };
        if (inv[payload.item] - payload.qty <= 0) delete inv[payload.item];
        else inv[payload.item] -= payload.qty;
        useGame.setState({ inventory: inv });
      }
      s.addToast(`🎁 Gift sent to ${to.trim()}!`);
      setTo("");
      setTip(0);
      setGiftItem("");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <>
      <div className="shop-section">🎁 Gifts</div>
      {gifts === null && <div className="shop-empty">Checking the post…</div>}
      {gifts !== null && gifts.length === 0 && <div className="shop-empty">No parcels waiting.</div>}
      {gifts?.map((g) => (
        <ShopRow
          key={g.id}
          icon="🎁"
          name={<>From <b>{g.fromName}</b></>}
          blurb={[g.acorns > 0 ? `${g.acorns} 🌰` : "", g.item ? `${g.qty} ${g.item}` : ""].filter(Boolean).join(" + ")}
          right={<button className="btn small" onClick={() => claim(g)}>Open</button>}
        />
      ))}
      <div className="offer-form">
        <input
          className="offer-input grow" placeholder="Send to…"
          value={to} onChange={(e) => setTo(e.target.value)}
        />
        <input
          className="offer-input num" type="number" min={0} placeholder="🌰"
          value={tip || ""} onChange={(e) => setTip(Math.max(0, Number(e.target.value)))}
        />
        <select className="offer-input" value={giftItem} onChange={(e) => setGiftItem(e.target.value)}>
          <option value="">+ item…</option>
          {Object.keys(s.inventory).map((l) => (
            <option key={l} value={l}>{l} (×{s.inventory[l]})</option>
          ))}
        </select>
        {giftItem && (
          <input
            className="offer-input num" type="number" min={1} max={s.inventory[giftItem] ?? 1}
            value={giftQty} onChange={(e) => setGiftQty(Number(e.target.value))}
          />
        )}
        <button className="btn small" disabled={!to.trim()} onClick={send}>Send</button>
      </div>
      {err && <div className="offer-error">{err}</div>}
    </>
  );
}

function ExchangeShop() {
  const s = useGame();
  const offers = dayOffers(clock.day);
  return (
    <>
      <PlayerOffers />
      <div className="shop-section">NPC offers — refresh at dawn</div>
      {offers.map((o) => {
        const accepted = s.acceptedOffers.includes(o.id);
        const have = s.inventory[o.item] ?? 0;
        return (
          <ShopRow
            key={o.id}
            icon={ITEM_ICONS[o.item] ?? "📦"}
            name={
              o.type === "buy"
                ? <><b>{o.npc}</b> buys {o.qty} {o.item}</>
                : <><b>{o.npc}</b> sells {o.qty} {o.item}</>
            }
            blurb={
              o.type === "buy"
                ? <>pays <b>{o.price} 🌰</b> {have < o.qty ? `· you have ${have}` : ""}</>
                : <>for <b>{o.price} 🌰</b></>
            }
            right={
              accepted ? (
                <span className="shop-owned">Done</span>
              ) : (
                <button
                  className="btn small"
                  disabled={o.type === "buy" ? have < o.qty : s.acorns < o.price}
                  onClick={() => s.acceptOffer(o)}
                >
                  {o.type === "buy" ? "Sell" : "Buy"}
                </button>
              )
            }
          />
        );
      })}
      <div className="shop-note">Other foragers post offers here daily — usually better than Den prices.</div>
    </>
  );
}

function ShopModal() {
  const s = useGame();
  const shop = s.openShop!;
  return (
    <div className="modal-backdrop" onClick={() => s.setOpenShop(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{BUILDING_LABELS[shop]}</span>
          <span className="modal-acorns">🌰 {s.acorns}</span>
        </div>
        {shop === "trader" && <TraderShop />}
        {shop === "armoury" && <ArmouryShop />}
        {shop === "tailor" && <TailorShop />}
        {shop === "medbay" && <MedbayShop />}
        {shop === "exchange" && <ExchangeShop />}
        <button className="btn block" onClick={() => s.setOpenShop(null)}>Done</button>
      </div>
    </div>
  );
}

function ChestModal() {
  const s = useGame();
  const packEntries = Object.entries(s.inventory);
  const chestEntries = Object.entries(s.chest);
  const chestCount = chestEntries.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="modal-backdrop" onClick={() => s.setOpenPanel(null)}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">📦 Storage Chest</span>
          <span className="modal-acorns">{chestCount}/{chestCapFor(s.homeTier)}</span>
        </div>
        <div className="chest-cols">
          <div className="chest-col">
            <div className="shop-section">🎒 Pack ({s.packCount()}/{PACK_CAP})</div>
            {packEntries.length === 0 && <div className="shop-empty">Empty</div>}
            {packEntries.map(([label, n]) => (
              <div key={label} className="chest-row">
                <span>{ITEM_ICONS[label] ?? "📦"} {label} <b>×{n}</b></span>
                <span className="chest-btns">
                  <button className="btn tiny" onClick={() => s.chestMove(label, 1, true)}>1 →</button>
                  <button className="btn tiny ghost" onClick={() => s.chestMove(label, n, true)}>all →</button>
                </span>
              </div>
            ))}
          </div>
          <div className="chest-col">
            <div className="shop-section">📦 Chest</div>
            {chestEntries.length === 0 && <div className="shop-empty">Empty</div>}
            {chestEntries.map(([label, n]) => (
              <div key={label} className="chest-row">
                <span className="chest-btns">
                  <button className="btn tiny" onClick={() => s.chestMove(label, 1, false)}>← 1</button>
                  <button className="btn tiny ghost" onClick={() => s.chestMove(label, n, false)}>← all</button>
                </span>
                <span>{ITEM_ICONS[label] ?? "📦"} {label} <b>×{n}</b></span>
              </div>
            ))}
          </div>
        </div>
        <button className="btn block" onClick={() => s.setOpenPanel(null)}>Close</button>
      </div>
    </div>
  );
}

function FurnaceModal() {
  const s = useGame();
  const wood = s.inventory.Wood ?? 0;
  const cookable = Object.keys(RECIPES).filter((raw) => (s.inventory[raw] ?? 0) > 0);
  return (
    <div className="modal-backdrop" onClick={() => s.setOpenPanel(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🔥 Furnace</span>
          <span className="modal-acorns">🪵 {wood}</span>
        </div>
        <div className="shop-note" style={{ marginTop: 0 }}>
          Each cook burns 1 Wood. Cooked food heals more — and won&apos;t infect you.
        </div>
        <div className="shop-section">Cook</div>
        {cookable.length === 0 && (
          <div className="shop-empty">Nothing raw to cook — hunt a 🐔 chicken or 🐗 boar, or catch fish.</div>
        )}
        {cookable.map((raw) => {
          const cooked = RECIPES[raw];
          const food = FOODS[cooked];
          return (
            <ShopRow
              key={raw}
              icon={ITEM_ICONS[raw] ?? "📦"}
              name={<>{raw} <span className="shop-count">×{s.inventory[raw]}</span> → {ITEM_ICONS[cooked]} {cooked}</>}
              blurb={<>+{food.hp} HP · +{food.energy} ⚡ when eaten</>}
              right={
                <button className="btn small" disabled={wood < 1} onClick={() => s.cookItem(raw)}>
                  Cook 🪵1
                </button>
              }
            />
          );
        })}
        <button className="btn block" onClick={() => s.setOpenPanel(null)}>Close</button>
      </div>
    </div>
  );
}

function HomeOfferModal() {
  const s = useGame();
  const buying = s.homeOffer === "buy";
  const tier = buying ? HOME_TIERS[0] : HOME_TIERS[s.homeTier];
  if (!tier) return null;
  const current = s.homeTier > 0 ? HOME_TIERS[s.homeTier - 1] : null;

  // everything the next deed adds over the current one
  const gains: [string, string][] = [];
  if (buying) {
    gains.push(
      ["🌱", `${tier.tiles} farm tiles — plant seeds, harvest crops`],
      ["🐔", "1 animal pen — produce while you adventure"],
      ["📦", `Chest holds ${tier.chestCap} items`],
      ["🔥", "Furnace — cook meat & fish (1 Wood per cook)"],
      ["🛖", "A cabin to call home — and no zombies, ever"],
    );
  } else if (current) {
    gains.push(["🌱", `${tier.tiles} farm tiles (up from ${current.tiles})`]);
    if (tier.pens > current.pens) gains.push(["🐔", `${tier.pens} animal pens (+${tier.pens - current.pens})`]);
    if (tier.orchard > current.orchard) gains.push(["🍎", `${tier.orchard} orchard plots (+${tier.orchard - current.orchard})`]);
    if (tier.hives > current.hives) gains.push(["🐝", `Beehive spot ${tier.hives} — slow, valuable honey`]);
    if (tier.well && !current.well) gains.push(["💧", "A well — draw water at home"]);
    if (tier.pond && !current.pond) gains.push(["🎣", "A private fishing pond"]);
    if (tier.windmill && !current.windmill) gains.push(["🌬️", "The Old Windmill & scarecrow — crown of the Domain"]);
    gains.push(["📦", `Chest holds ${tier.chestCap} (up from ${current.chestCap})`]);
    gains.push(["📏", "Bigger fenced grounds"]);
  }

  return (
    <div className="modal-backdrop" onClick={() => s.setHomeOffer(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{buying ? "🪧 Your own Haven" : `📐 ${tier.name}`}</span>
          <span className="modal-acorns">🌰 {s.acorns}</span>
        </div>
        <div className="plot-pitch">
          {buying ? (
            <>Your own private land, away from the forest — the first of {HOME_TIERS.length} deeds, all the way up to the {HOME_TIERS[HOME_TIERS.length - 1].name}:</>
          ) : (
            <>
              Deed {s.homeTier + 1} of {HOME_TIERS.length} · <i>{tier.tagline}</i>
              <span style={{ display: "block", marginTop: 6, letterSpacing: 3 }}>
                {HOME_TIERS.map((t, i) => (
                  <span key={t.name} title={t.name} style={{ opacity: i < s.homeTier ? 1 : i === s.homeTier ? 0.85 : 0.3 }}>
                    {i < s.homeTier ? "●" : i === s.homeTier ? "◉" : "○"}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
        <div className="help-grid" style={{ marginTop: 10 }}>
          {gains.map(([icon, text], i) => (
            <Fragment key={i}>
              <span>{icon}</span>
              <span>{text}</span>
            </Fragment>
          ))}
        </div>
        <button
          className="btn block"
          disabled={s.acorns < tier.price}
          onClick={() => (buying ? s.buyHomestead() : s.extendHomestead())}
        >
          {buying ? `Buy for ${tier.price} 🌰` : `Extend for ${tier.price} 🌰`}
        </button>
        <button className="btn block ghost" onClick={() => s.setHomeOffer(null)}>Not now</button>
      </div>
    </div>
  );
}

function HouseModal() {
  const s = useGame();
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(iv);
  }, []);
  const lv = Math.max(1, Math.min(s.houseLevel, HOUSE_LEVELS.length));
  const cur = HOUSE_LEVELS[lv - 1];
  const next = lv < HOUSE_LEVELS.length ? HOUSE_LEVELS[lv] : null;
  const tier = HOME_TIERS[Math.max(0, s.homeTier - 1)];
  const rentMins = Math.max(0, Math.ceil((RENT_INTERVAL_MS - (Date.now() - s.lastRentAt)) / 60000));
  const close = () => s.setOpenPanel(null);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{cur.icon} {cur.name}</span>
          <span className="modal-acorns">🌰 {s.acorns} · 🪵 {s.inventory.Wood ?? 0} · 🪨 {s.inventory.Stone ?? 0}</span>
        </div>
        <div className="plot-pitch">
          Home on the {tier?.name ?? "Haven"} · house {lv} of {HOUSE_LEVELS.length}
        </div>

        <div className="shop-section">The five houses of the wood</div>
        {HOUSE_LEVELS.map((h, i) => (
          <div key={h.name} className="help-grid" style={{ opacity: i < lv ? 1 : 0.45, marginTop: 2 }}>
            <span>{i < lv ? "✅" : "🔒"}</span>
            <span><b>{h.icon} {h.name}</b> — {h.perk}</span>
          </div>
        ))}

        {next && (
          <>
            <div className="shop-section">Upgrade</div>
            <ShopRow
              icon={next.icon}
              name={`Build the ${next.name}`}
              blurb={next.perk}
              right={
                <button
                  className="btn small"
                  disabled={
                    s.acorns < next.acorns ||
                    (s.inventory.Wood ?? 0) < next.wood ||
                    (s.inventory.Stone ?? 0) < next.stone
                  }
                  onClick={() => s.upgradeHouse()}
                >
                  🌰 {next.acorns}{next.wood ? ` + 🪵 ${next.wood}` : ""}{next.stone ? ` + 🪨 ${next.stone}` : ""}
                </button>
              }
            />
          </>
        )}

        {lv >= 2 && (
          <>
            <div className="shop-section">Comforts</div>
            <ShopRow
              icon="🛏️"
              name="Sleep till dawn"
              blurb={isNight() ? "Skip the night — wake rested (+energy, +30 HP)" : "Only after dusk"}
              right={
                <button className="btn small" disabled={!isNight()} onClick={() => s.sleepTillDawn()}>
                  Sleep
                </button>
              }
            />
            {lv >= HOUSE_LEVELS.length && (
              <ShopRow
                icon="💰"
                name={s.rentReady() ? `${RENT_AMOUNT} 🌰 rent ready` : `Rent due in ~${rentMins} min`}
                blurb="The Manor earns its keep, once every day"
                right={
                  <button className="btn small" disabled={!s.rentReady()} onClick={() => s.collectRent()}>
                    Collect
                  </button>
                }
              />
            )}
          </>
        )}
        <button className="btn block ghost" onClick={close}>Close</button>
      </div>
    </div>
  );
}

function PenModal() {
  const s = useGame();
  const idx = s.openPen!;
  const pen = s.pens[idx];
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(iv);
  }, []);
  const close = () => s.setOpenPen(null);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{pen ? `${PEN_DEFS[pen.animal].icon} ${PEN_DEFS[pen.animal].label}` : "🚧 Empty Pen"}</span>
          <span className="modal-acorns">🌰 {s.acorns} · 🪵 {s.inventory.Wood ?? 0}</span>
        </div>
        {!pen ? (
          <>
            <div className="plot-pitch">
              Choose what lives here — they produce on their own, even while
              you&apos;re off adventuring. Fencing costs {PEN_BUILD_COST.acorns} 🌰 + {PEN_BUILD_COST.wood} 🪵.
            </div>
            <div className="shop-section">Pick your animal</div>
            {(Object.keys(PEN_DEFS) as PenAnimal[]).map((kind) => {
              const def = PEN_DEFS[kind];
              const total = PEN_BUILD_COST.acorns + def.animalCost;
              return (
                <ShopRow
                  key={kind}
                  icon={def.icon}
                  name={def.label}
                  blurb={<>{def.blurb} · {def.productIcon} {def.product} every {Math.round(def.intervalMs / 60000)} min each</>}
                  right={
                    <button
                      className="btn small"
                      disabled={s.acorns < total || (s.inventory.Wood ?? 0) < PEN_BUILD_COST.wood}
                      onClick={() => s.buildPen(idx, kind)}
                    >
                      🌰 {total}
                    </button>
                  }
                />
              );
            })}
          </>
        ) : (
          <>
            {(() => {
              const def = PEN_DEFS[pen.animal];
              const pending = s.penPending(idx);
              return (
                <>
                  <div className="shop-section">Your {def.label.toLowerCase()} — {pen.count}/{MAX_PER_PEN}</div>
                  <ShopRow
                    icon={def.productIcon}
                    name={pending > 0 ? `${pending} ${def.product} ready` : `No ${def.product} yet`}
                    blurb={<>Each {def.icon} produces one every {Math.round(def.intervalMs / 60000)} min</>}
                    right={
                      <button className="btn small" disabled={pending < 1} onClick={() => s.collectPen(idx)}>
                        Collect
                      </button>
                    }
                  />
                  {pen.count < MAX_PER_PEN && (
                    <ShopRow
                      icon={def.icon}
                      name={`Add a ${def.label.toLowerCase().replace(/s$/, "")}`}
                      blurb="More animals, more produce"
                      right={<BuyBtn cost={def.animalCost} onClick={() => s.addPenAnimal(idx)} />}
                    />
                  )}
                  <div className="shop-note">
                    Want a different animal here? Extend your land for more pens — each one is its own choice.
                  </div>
                </>
              );
            })()}
          </>
        )}
        <button className="btn block ghost" onClick={close}>Close</button>
      </div>
    </div>
  );
}

function BuildModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🔨 Build</span>
          <span className="modal-acorns">🪵 {s.inventory.Wood ?? 0} · 🌰 {s.acorns}</span>
        </div>
        <div className="shop-note" style={{ marginTop: 0 }}>
          Pick something, then click the ground on your land to place it. Esc to stop.
        </div>
        {Object.entries(BUILDABLES).map(([key, def]) => {
          const costs = [
            def.wood > 0 ? `${def.wood} 🪵` : "",
            def.stone > 0 ? `${def.stone} 🪨` : "",
            def.acorns > 0 ? `${def.acorns} 🌰` : "",
          ].filter(Boolean).join(" + ");
          return (
            <ShopRow
              key={key}
              icon={def.icon}
              name={def.label}
              blurb={<>{def.blurb} · {costs}</>}
              right={
                <button
                  className="btn small"
                  disabled={
                    (s.inventory.Wood ?? 0) < def.wood ||
                    (s.inventory.Stone ?? 0) < def.stone ||
                    s.acorns < def.acorns
                  }
                  onClick={() => { s.setBuildMode(key); onClose(); }}
                >
                  Place
                </button>
              }
            />
          );
        })}
        <ShopRow
          icon="🗑️"
          name="Remove"
          blurb="Click a structure to take it down (refunds half the wood)"
          right={
            <button className="btn small ghost" onClick={() => { s.setBuildMode("remove"); onClose(); }}>
              Select
            </button>
          }
        />
        <button className="btn block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const myName = useGame((s) => s.name);
  const [data, setData] = useState<{ players: { name: string; level: number; acorns: number }[]; online: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetchLeaderboard().then(setData).catch(() => setErr(true));
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🏆 Top Foragers</span>
          {data && <span className="online-tag">🟢 {data.online} online</span>}
        </div>
        {err && <div className="shop-empty">Leaderboard unavailable — are you online?</div>}
        {!data && !err && <div className="shop-empty">Loading…</div>}
        {data?.players.length === 0 && <div className="shop-empty">No online players yet — be the first!</div>}
        {data?.players.map((p, i) => (
          <div key={p.name} className={`lb-line ${p.name === myName ? "me" : ""}`}>
            <span className="lb-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
            <span className="lb-name">{p.name}</span>
            <span className="lb-stats">Lv {p.level} · {p.acorns} 🌰</span>
          </div>
        ))}
        <button className="btn block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** Jump straight to someone's Haven from any name in the UI. */
async function visitByName(name: string) {
  const s = useGame.getState();
  if (name === s.name) {
    s.addToast("That's you! Walk through your own gate 🏡");
    return;
  }
  try {
    const data = await fetchVisit(name);
    s.startVisit(data as any);
    s.closeModals();
  } catch (e: any) {
    s.addToast(`🏡 ${e.message}`);
  }
}

function LeaderboardDock() {
  const myName = useGame((s) => s.name);
  const [tab, setTab] = useState<"players" | "estates">("players");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchLeaderboard>> | null>(null);
  useEffect(() => {
    const load = () => fetchLeaderboard().then(setData).catch(() => {});
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, []);
  if (!data) return null;
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);
  return (
    <div className="lb-dock">
      <div className="lb-dock-head">
        <span>
          <button
            className={`lb-tab ${tab === "players" ? "on" : ""}`}
            onClick={() => setTab("players")}
          >
            🏆 Foragers
          </button>
          <button
            className={`lb-tab ${tab === "estates" ? "on" : ""}`}
            onClick={() => setTab("estates")}
          >
            🏡 Estates
          </button>
        </span>
        <span className="online-tag">🟢 {data.online}</span>
      </div>
      {tab === "players" ? (
        <>
          {data.players.length === 0 && <div className="lb-dock-empty">No foragers yet — be the first!</div>}
          {data.players.slice(0, 6).map((p, i) => (
            <div
              key={p.name}
              className={`lb-line click ${p.name === myName ? "me" : ""}`}
              title="Visit their Haven"
              onClick={() => visitByName(p.name)}
            >
              <span className="lb-rank">{medal(i)}</span>
              <span className="lb-name">{p.name}</span>
              <span className="lb-stats">Lv {p.level} · {p.acorns} 🌰</span>
            </div>
          ))}
        </>
      ) : (
        <>
          {(data.estates ?? []).length === 0 && <div className="lb-dock-empty">No land owned yet!</div>}
          {(data.estates ?? []).slice(0, 6).map((p, i) => (
            <div
              key={p.name}
              className={`lb-line click ${p.name === myName ? "me" : ""}`}
              title="Visit their Haven"
              onClick={() => visitByName(p.name)}
            >
              <span className="lb-rank">{medal(i)}</span>
              <span className="lb-name">{p.name}</span>
              <span className="lb-stats">
                Deed {p.homeTier}/10 · {HOUSE_LEVELS[Math.max(0, Math.min(p.houseLevel, HOUSE_LEVELS.length) - 1)].icon}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function OnlinePill() {
  const account = useGame((s) => s.account);
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    const load = () => fetchLeaderboard().then((d) => setOnline(d.online)).catch(() => setOnline(null));
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);
  if (online === null) return null;
  return (
    <div className="pill">
      🟢 {online} online{!account ? " · playing as guest" : ""}
    </div>
  );
}

function GuestbookModal({ owner, onClose }: { owner: string; onClose: () => void }) {
  const s = useGame();
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => {
    fetchGuestbook(owner).then((d) => setEntries(d.entries)).catch(() => setEntries([]));
  };
  useEffect(refresh, [owner]);

  const sign = async () => {
    setErr(null);
    try {
      await signGuestbook(owner, text.trim());
      setText("");
      s.addToast("🪶 Signed their guestbook");
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const tipThem = async (n: number) => {
    setErr(null);
    if (s.acorns < n) {
      setErr("Not enough acorns");
      return;
    }
    try {
      await sendGift(owner, { acorns: n });
      useGame.setState({ acorns: useGame.getState().acorns - n });
      s.addToast(`🌰 Tipped ${owner} ${n} acorns!`);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🪶 {owner}&apos;s Guestbook</span>
          <span className="modal-acorns">🌰 {s.acorns}</span>
        </div>
        {entries === null && <div className="shop-empty">Opening the book…</div>}
        {entries !== null && entries.length === 0 && (
          <div className="shop-empty">No entries yet — be their first visitor!</div>
        )}
        {entries?.map((e) => (
          <div key={e.id} className="lb-line">
            <span className="lb-name">
              <b>{e.author}</b> — {e.text}
            </span>
          </div>
        ))}
        {s.account ? (
          <>
            <div className="offer-form" style={{ marginTop: 10 }}>
              <input
                className="offer-input grow"
                placeholder="Leave a kind word… (once a day)"
                maxLength={120}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && text.trim().length >= 2 && sign()}
              />
              <button className="btn small" disabled={text.trim().length < 2} onClick={sign}>
                Sign
              </button>
            </div>
            <div className="offer-form">
              <span className="offer-x">Leave a tip:</span>
              {[25, 100, 500].map((n) => (
                <button key={n} className="btn small ghost" disabled={s.acorns < n} onClick={() => tipThem(n)}>
                  🌰 {n}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="shop-note">Log in with an online account to sign and tip.</div>
        )}
        {err && <div className="offer-error">{err}</div>}
        <button className="btn block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function InventoryModal() {
  const s = useGame();
  const entries = Object.entries(s.inventory);
  const close = () => s.toggleInventory();
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🎒 Your Pack</span>
          <span className="modal-acorns">{s.packCount()}/{PACK_CAP} · 🌰 {s.acorns}</span>
        </div>
        {entries.length === 0 && (
          <div className="shop-empty">Empty! Forage, chop, fish and hunt to fill it.</div>
        )}
        <div className="inv-grid">
          {entries.map(([label, n]) => {
            const food = FOODS[label];
            const med = MEDS[label];
            const usable = !!food || !!med;
            const verb = med ? "use" : label === "Water" ? "drink" : "eat";
            return (
              <div
                key={label}
                className={`inv-slot ${usable ? "usable" : ""}`}
                onClick={usable ? () => s.useItem(label) : undefined}
                title={label}
              >
                <span className="inv-icon">{ITEM_ICONS[label] ?? "📦"}</span>
                <span className="inv-count">{n}</span>
                <span className="inv-label">{label}</span>
                <span className="inv-sub">
                  {med
                    ? "click to use"
                    : food
                    ? `${verb}: +${food.hp}❤ +${food.energy}⚡ +${food.hunger}🍗${food.infect ? " ☣️" : ""}`
                    : SELL_PRICES[label]
                    ? `sells for ${SELL_PRICES[label]} 🌰`
                    : "material"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="shop-note">
          Click food to eat it, water to drink, meds to use. Raw meat is risky — cook it first ☣️
        </div>
        <button className="btn block" onClick={close}>Close (I)</button>
      </div>
    </div>
  );
}

function SkillsModal() {
  const s = useGame();
  return (
    <div className="modal-backdrop" onClick={s.toggleSkills}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🌟 Skills</span>
          <span className="modal-acorns">{s.skillPoints} point{s.skillPoints === 1 ? "" : "s"}</span>
        </div>
        <div className="plot-pitch">Every level-up earns a skill point. Spend them on your craft:</div>
        {(Object.keys(SKILLS) as SkillKey[]).map((key) => {
          const def = SKILLS[key];
          const rank = s.skills[key];
          return (
            <ShopRow
              key={key}
              icon={def.icon}
              name={
                <>
                  {def.label}{" "}
                  <span style={{ letterSpacing: 2 }}>
                    {"●".repeat(rank)}{"○".repeat(MAX_SKILL_RANK - rank)}
                  </span>
                </>
              }
              blurb={def.blurb}
              right={
                rank >= MAX_SKILL_RANK ? (
                  <span className="shop-owned">Maxed</span>
                ) : (
                  <button className="btn small" disabled={s.skillPoints < 1} onClick={() => s.upgradeSkill(key)}>
                    🌟 1
                  </button>
                )
              }
            />
          );
        })}
        <button className="btn block" onClick={s.toggleSkills}>Close</button>
      </div>
    </div>
  );
}

function JournalModal() {
  const s = useGame();
  const done = s.claimedAchievements.length;
  return (
    <div className="modal-backdrop" onClick={s.toggleJournal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">📖 Journal</span>
          <span className="modal-acorns">{done}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="modal-scroll">
          {ACHIEVEMENTS.map((a) => {
            const claimed = s.claimedAchievements.includes(a.id);
            const progress = Math.min(s.stats[a.stat] ?? 0, a.goal);
            return (
              <div key={a.id} className={`quest-line ${claimed ? "done" : ""}`}>
                <span className="quest-check">{claimed ? a.icon : "🔒"}</span>
                <div className="quest-body">
                  <div className="quest-name">{a.title}</div>
                  <div className="quest-desc">
                    {a.desc} — {progress}/{a.goal}
                  </div>
                  <div className="quest-reward">+{a.acorns} 🌰 · +{a.xp} XP</div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn block" onClick={s.toggleJournal}>Close</button>
      </div>
    </div>
  );
}

function DecorShopModal() {
  const s = useGame();
  return (
    <div className="modal-backdrop" onClick={s.toggleDecorShop}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">🛋️ Furnishings</span>
          <span className="modal-acorns">🌰 {s.acorns} · {s.interiorDecor.length}/{MAX_DECOR}</span>
        </div>
        <div className="plot-pitch">
          Pick a piece, then click the floor to place it. Visitors will see your taste — or lack of it.
        </div>
        <div className="modal-scroll">
          {Object.entries(DECOR_ITEMS).map(([key, def]) => (
            <ShopRow
              key={key}
              icon="🪑"
              name={def.label}
              blurb={<>Place anywhere on your floor</>}
              right={
                <button className="btn small" disabled={s.acorns < def.cost} onClick={() => s.setDecorMode(key)}>
                  🌰 {def.cost}
                </button>
              }
            />
          ))}
        </div>
        <button className="btn block ghost" onClick={() => s.setDecorMode("remove")}>
          🗑️ Remove a piece (half refund)
        </button>
        <button className="btn block" onClick={s.toggleDecorShop}>Close</button>
      </div>
    </div>
  );
}

function FishingBar() {
  const angling = useGame((s) => s.skills.angling);
  const markerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const m = Math.sin((Date.now() - fishing.biteAt) / 220); // mirrors the catch check
      if (markerRef.current) markerRef.current.style.left = `${50 + m * 46}%`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  const zoneHalf = 0.22 + 0.05 * angling;
  return (
    <div className="fish-bar-wrap">
      <div className="fish-bar">
        <div className="fish-zone" style={{ left: `${50 - zoneHalf * 46}%`, width: `${zoneHalf * 2 * 46}%` }} />
        <div className="fish-marker" ref={markerRef} />
      </div>
      <div className="fish-hint">🎣 Press <b>F</b> in the green!</div>
    </div>
  );
}

function QuestsModal() {
  const s = useGame();
  return (
    <div className="modal-backdrop" onClick={s.toggleQuests}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">📜 Quests</span>
          <span className="modal-acorns">
            {s.quests.filter((q) => q.done).length}/{s.quests.length}
          </span>
        </div>
        <div className="shop-section">📋 Today&apos;s tasks — day {clock.day}</div>
        {dailyQuestsFor(clock.day).map((q) => {
          const progress = Math.min(q.goal, (s.stats[q.stat] ?? 0) - (s.dailyBase[q.stat] ?? 0));
          const claimed = s.dailyClaimed.includes(q.id);
          return (
            <div key={q.id} className={`quest-line ${claimed ? "done" : ""}`}>
              <span className="quest-check">{q.icon}</span>
              <div className="quest-body">
                <div className="quest-name">{q.label}</div>
                <div className="quest-reward">+{q.acorns} 🌰 · +{q.xp} XP</div>
              </div>
              {claimed ? (
                <span className="quest-prog">✅</span>
              ) : progress >= q.goal ? (
                <button className="btn small" onClick={() => s.claimDaily(q.id)}>Claim</button>
              ) : (
                <span className="quest-prog">{Math.max(0, progress)}/{q.goal}</span>
              )}
            </div>
          );
        })}
        <div className="shop-section">📜 Story</div>
        {s.quests.map((q) => (
          <div key={q.id} className={`quest-line ${q.done ? "done" : ""}`}>
            <span className="quest-check">{q.done ? "✅" : "⬜"}</span>
            <div className="quest-body">
              <div className="quest-name">{q.title}</div>
              <div className="quest-desc">{q.desc}</div>
              <div className="quest-reward">
                Reward: +{q.xp} XP{q.acorns > 0 ? ` · +${q.acorns} 🌰` : ""}
              </div>
            </div>
            <span className="quest-prog">{q.progress}/{q.goal}</span>
          </div>
        ))}
        <button className="btn block" onClick={s.toggleQuests}>Close</button>
      </div>
    </div>
  );
}

function HelpModal() {
  const s = useGame();
  return (
    <div className="modal-backdrop" onClick={s.toggleHelp}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">How to play</span>
        </div>
        <div className="help-grid">
          <span>🚶</span><span><b>WASD / arrows</b> or click the ground to move · <b>Shift</b> sprints</span>
          <span>🪓</span><span><b>Click a tree</b> to chop it — slow by hand, buy an axe at The Den</span>
          <span>🍄</span><span>Walk over mushrooms &amp; flowers to collect them</span>
          <span>🎣</span><span>Buy a rod, stand by the river, press <b>F</b> — and <b>F</b> again on the bite!</span>
          <span>💧</span><span>Click the river up close to collect water</span>
          <span>🧟</span><span>Zombies rise at night (see the timer) — click one to attack. Buy weapons &amp; armour at The Forge</span>
          <span>☣️</span><span>Scratches can infect you — antidotes at The Remedy; click meds in the hotbar to use</span>
          <span>⚖️</span><span>The Exchange posts daily offers from other foragers at premium prices</span>
          <span>🧵</span><span>Threads sells shirts &amp; hats to customise your look</span>
          <span>🪧</span><span><b>Buy your Haven</b> at the gate near camp — your own private land with farm tiles, a chest, a furnace and a cabin. Extend it at the 📐 sign inside</span>
          <span>🥕</span><span>Buy seeds, click a tilled tile to plant, click again to harvest when ready</span>
          <span>🐔</span><span>Hunt chickens &amp; boars for meat — <b>cook it first</b>; raw chicken can infect you!</span>
          <span>🎒</span><span>Your pack holds {PACK_CAP} items — store extras in your chest</span>
          <span>🔥</span><span>Rest at the campfire to restore HP &amp; energy · <b>E</b> opens shops</span>
        </div>
        <button className="btn block" onClick={s.toggleHelp}>Got it</button>
      </div>
    </div>
  );
}

export default function Hud() {
  const s = useGame();
  const [showBuild, setShowBuild] = useState(false);
  const [showLb, setShowLb] = useState(false);
  const [showGuestbook, setShowGuestbook] = useState(false);
  const activeQuest = s.quests.find((q) => !q.done);
  const questIndex = s.quests.findIndex((q) => !q.done);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") s.closeModals();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hud">
      {/* top-left: location + time + night timer */}
      <div className="top-left">
        <div className="pill strong">📍 {s.zone}</div>
        <ClockPill />
        <OnlinePill />
      </div>

      {/* top-center: rank + toasts */}
      <div className="top-center">
        <RankBanner />
        <div className="toasts">
          {s.toasts.map((t) => (
            <div key={t.id} className="toast">{t.text}</div>
          ))}
        </div>
      </div>

      {/* top-right: minimap + quest card */}
      <div className="top-right">
        {s.location === "forest" ? (
          <Minimap />
        ) : (
          <div className="home-badge">
            <div className="home-badge-icon">🏡</div>
            <div className="home-badge-text">
              {s.location === "visit"
                ? `${s.visitData?.name}'s land`
                : HOME_TIERS[Math.max(0, s.homeTier - 1)].name}
              <span>{s.location === "visit" ? "visiting · look, don't touch" : "safe ground · no zombies"}</span>
            </div>
          </div>
        )}
        {activeQuest ? (
          <div className="quest-card" onClick={s.toggleQuests}>
            <div className="quest-card-tag">
              QUEST {questIndex + 1}/{s.quests.length}
            </div>
            <div className="quest-card-title">{activeQuest.title}</div>
            <div className="quest-card-desc">{activeQuest.desc}</div>
            <div className="quest-card-reward">
              🎁 +{activeQuest.xp} XP{activeQuest.acorns > 0 ? ` · +${activeQuest.acorns} 🌰` : ""}
            </div>
            <div className="quest-card-track">
              <div
                className="quest-card-fill"
                style={{ width: `${(activeQuest.progress / activeQuest.goal) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="quest-card" onClick={s.toggleQuests}>
            <div className="quest-card-tag">ALL QUESTS DONE</div>
            <div className="quest-card-desc">The forest is yours. Keep exploring!</div>
          </div>
        )}
        <LeaderboardDock />
      </div>

      {/* bottom-left: avatar + stats */}
      <div className="bottom-left">
        <div className="avatar">
          <span className="avatar-emoji">🧑‍🌾</span>
          <span className="avatar-level">{s.level}</span>
        </div>
        <div className="stats">
          <div className="stats-name">
            {s.name}
            {s.infected && <span className="infect-tag">☣️ infected</span>}
          </div>
          <Bar value={s.hp} max={s.maxHp} color={s.infected ? "#8fbc5a" : "#e8705f"} icon="❤️" />
          <Bar value={s.energy} max={s.maxEnergy} color="#f2c14e" icon="⚡" />
          <Bar value={s.hunger} max={s.maxHunger} color={s.hunger <= 25 ? "#c0392b" : "#d98e4a"} icon="🍗" />
        </div>
        <div className="acorn-pill">🌰 {s.acorns}</div>
        <div
          className="acorn-pill pack click"
          title="Open your pack (I)"
          onClick={s.toggleInventory}
        >
          🎒 {s.packCount()}/{PACK_CAP}
        </div>
      </div>

      {/* bottom-center: prompts + hotbar */}
      <div className="bottom-center">
        {s.nearInteract && !s.openShop && !s.openPanel && !s.homeOffer && (
          <button
            className="trade-prompt"
            onClick={() => {
              const i = s.nearInteract!;
              if (i.kind === "shop") s.setOpenShop(i.id);
              else if (i.kind === "chest") s.setOpenPanel("chest");
              else if (i.kind === "furnace") s.setOpenPanel("furnace");
              else if (i.kind === "portal") {
                if (s.homeTier > 0) s.travel("home");
                else s.setHomeOffer("buy");
              } else if (i.kind === "homegate") s.travel("forest");
              else if (i.kind === "extend") s.setHomeOffer("extend");
              else if (i.kind === "pen") s.setOpenPen(i.idx);
              else if (i.kind === "house") s.enterHouse();
              else if (i.kind === "bed") s.sleepTillDawn();
              else if (i.kind === "desk") s.setOpenPanel("house");
              else if (i.kind === "exitdoor") s.exitHouse();
              else if (i.kind === "well") s.collectWater();
              else if (i.kind === "orchard") {
                if (s.orchard[i.idx]) s.collectOrchard(i.idx);
                else s.plantOrchardTree(i.idx);
              } else if (i.kind === "hive") {
                if (s.hives[i.idx]) s.collectHive(i.idx);
                else s.buildHive(i.idx);
              }
            }}
          >
            Press <b>E</b> —{" "}
            {s.nearInteract.kind === "shop"
              ? BUILDING_LABELS[s.nearInteract.id]
              : s.nearInteract.kind === "chest"
              ? "📦 Storage Chest"
              : s.nearInteract.kind === "furnace"
              ? "🔥 Furnace"
              : s.nearInteract.kind === "portal"
              ? s.homeTier > 0 ? "🏡 Enter your Haven" : "🪧 Land for Sale"
              : s.nearInteract.kind === "homegate"
              ? "🌲 Back to the Forest"
              : s.nearInteract.kind === "pen"
              ? (s.pens[s.nearInteract.idx] ? `${PEN_DEFS[s.pens[s.nearInteract.idx].animal].icon} Animal Pen` : "🚧 Empty Pen")
              : s.nearInteract.kind === "house"
              ? `${HOUSE_LEVELS[Math.min(s.houseLevel, HOUSE_LEVELS.length) - 1].icon} Step inside`
              : s.nearInteract.kind === "bed"
              ? "🛏️ Sleep till dawn"
              : s.nearInteract.kind === "desk"
              ? "📜 Estate Deeds"
              : s.nearInteract.kind === "exitdoor"
              ? "🚪 Step outside"
              : s.nearInteract.kind === "well"
              ? "💧 Draw water"
              : s.nearInteract.kind === "orchard"
              ? (s.orchard[s.nearInteract.idx] ? "🍎 Apple Tree" : "🌳 Plant an apple tree")
              : s.nearInteract.kind === "hive"
              ? (s.hives[s.nearInteract.idx] ? "🍯 Beehive" : "🐝 Build a beehive")
              : "📐 Extend your land"}
          </button>
        )}
        {s.buildMode && (
          <div className="trade-prompt as-pill bite">
            {s.buildMode === "remove"
              ? "🗑️ Click a structure to remove it · Esc to stop"
              : `${BUILDABLES[s.buildMode]?.icon} Placing ${BUILDABLES[s.buildMode]?.label} — click the ground · Esc to stop`}
          </div>
        )}
        {s.decorMode && (
          <div className="trade-prompt as-pill bite">
            {s.decorMode === "remove"
              ? "🗑️ Click a furnishing to remove it · Esc to stop"
              : `🛋️ Placing ${DECOR_ITEMS[s.decorMode]?.label} — click the floor · Esc to stop`}
          </div>
        )}
        {s.fishingState === "bite" && <FishingBar />}
        {s.nearWater && s.fishingState === "idle" && (
          <div className="trade-prompt as-pill">
            {s.rod ? <>Press <b>F</b> to fish 🎣 · click water for 💧</> : <>Click water for 💧 · rod unlocks fishing 🎣</>}
          </div>
        )}
        {s.fishingState === "waiting" && (
          <div className="trade-prompt as-pill">Waiting for a bite… (<b>F</b> to reel in early)</div>
        )}
        {s.fishingState === "bite" && (
          <div className="trade-prompt as-pill bite">‼️ BITE — press <b>F</b>!</div>
        )}
        <div className="hotbar">
          <div className={`slot tool ${s.weapon || s.axe ? "filled" : ""}`} title={s.weapon ? WEAPONS[s.weapon].label : s.axe ? AXES[s.axe].label : "Bare hands"}>
            <span className="slot-icon">
              {s.weapon ? WEAPONS[s.weapon].icon : s.axe === "golden" ? "✨🪓" : s.axe === "rusty" ? "🪓" : "✋"}
            </span>
          </div>
          {s.rod && (
            <div className="slot tool filled" title="Fishing Rod">
              <span className="slot-icon">🎣</span>
            </div>
          )}
          {Object.entries(s.inventory).slice(0, 9).map(([label, n]) => {
            const usable = !!MEDS[label] || !!FOODS[label];
            const verb = MEDS[label] ? "use" : "eat";
            return (
              <div
                key={label}
                className={`slot filled ${usable ? "usable" : ""}`}
                title={usable ? `${label} — click to ${verb}${FOODS[label]?.infect ? " (risky raw!)" : ""}` : label}
                onClick={usable ? () => s.useItem(label) : undefined}
              >
                <span className="slot-icon">{ITEM_ICONS[label] ?? "📦"}</span>
                <span className="slot-count">{n}</span>
              </div>
            );
          })}
          {Object.keys(s.inventory).length === 0 && (
            <div className="slot" title="Forage, chop and fish to fill your pack">
              <span className="slot-icon">🎒</span>
            </div>
          )}
          <div className="slot more" title="Open your full pack (I)" onClick={s.toggleInventory}>
            <span className="slot-icon">🎒</span>
            <span className="slot-count">…</span>
          </div>
        </div>
      </div>

      {/* bottom-right: utility buttons */}
      <div className="bottom-right">
        {s.location === "home" && (
          <button className="round-btn" onClick={() => setShowBuild(true)} title="Build">🔨</button>
        )}
        <button className="round-btn" onClick={() => setShowLb(true)} title="Leaderboard">🏆</button>
        {s.visitData && (
          <button className="round-btn" onClick={() => setShowGuestbook(true)} title="Guestbook">🪶</button>
        )}
        <button className="round-btn" onClick={s.toggleQuests} title="Quests">📜</button>
        <button className="round-btn badge-holder" onClick={s.toggleSkills} title="Skills">
          🌟{s.skillPoints > 0 && <span className="round-badge">{s.skillPoints}</span>}
        </button>
        <button className="round-btn" onClick={s.toggleJournal} title="Journal">📖</button>
        {s.location === "interior" && !s.visitData && (
          <button className="round-btn" onClick={s.toggleDecorShop} title="Furnish">🛋️</button>
        )}
        <button className="round-btn" onClick={s.toggleHelp} title="How to play">❓</button>
        <button className="round-btn" onClick={s.toggleMute} title="Sound">
          {s.muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* banner */}
      {s.banner && <div className="banner">{s.banner}</div>}

      {/* hurt flash */}
      {Date.now() - s.hurtAt < 600 && <div className="hurt-flash" key={s.hurtAt} />}

      {/* modals */}
      {s.openShop && <ShopModal />}
      {s.openPanel === "chest" && <ChestModal />}
      {s.openPanel === "furnace" && <FurnaceModal />}
      {s.openPanel === "house" && <HouseModal />}
      {s.openPen !== null && <PenModal />}
      {showBuild && <BuildModal onClose={() => setShowBuild(false)} />}
      {showLb && <LeaderboardModal onClose={() => setShowLb(false)} />}
      {showGuestbook && s.visitData && (
        <GuestbookModal owner={s.visitData.name} onClose={() => setShowGuestbook(false)} />
      )}
      {s.homeOffer && <HomeOfferModal />}
      {s.showQuests && <QuestsModal />}
      {s.showInventory && <InventoryModal />}
      {s.showSkills && <SkillsModal />}
      {s.showJournal && <JournalModal />}
      {s.showDecorShop && <DecorShopModal />}
      {s.showHelp && <HelpModal />}
    </div>
  );
}
