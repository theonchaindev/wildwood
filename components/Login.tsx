"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useGame, SKIN_TONES, HAIR_COLORS, SHIRTS, Appearance } from "@/lib/store";
import { loginCloud, registerCloud, connectWallet, chooseName, startSaveSync } from "@/lib/cloud";
import CharacterModel, { Motion } from "./CharacterModel";

type Mode = "menu" | "guest" | "online" | "walletname" | "customize";

function Turntable({ children, motion }: { children: React.ReactNode; motion: Motion }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.9;
    motion.phase += dt * 7; // walk in place to show off the animation
  });
  return <group ref={ref}>{children}</group>;
}

function PreviewCanvas() {
  const appearance = useGame((s) => s.appearance);
  const shirt = useGame((s) => s.shirt);
  const motion = useRef<Motion>({ phase: 0, moving: true }).current;
  return (
    <div className="cust-preview">
      <Canvas camera={{ position: [0, 1.1, 2.6], fov: 35 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} color="#fff4e0" />
        <directionalLight position={[2, 4, 3]} intensity={1.6} color="#fff3d6" />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#b8d4e8" />
        <Turntable motion={motion}>
          <group position={[0, -0.82, 0]}>
            <CharacterModel appearance={appearance} shirt={shirt} hat={null} motion={motion} />
          </group>
        </Turntable>
        {/* little grass disc to stand on */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.84, 0]}>
          <circleGeometry args={[0.85, 24]} />
          <meshStandardMaterial color="#6f924a" roughness={1} />
        </mesh>
      </Canvas>
    </div>
  );
}

function Customizer({ onDone }: { onDone: () => void }) {
  const appearance = useGame((s) => s.appearance);
  const setAppearance = useGame((s) => s.setAppearance);
  const shirt = useGame((s) => s.shirt);

  const set = (patch: Partial<Appearance>) => setAppearance({ ...appearance, ...patch });

  return (
    <div className="intro-actions wide">
      <PreviewCanvas />
      <div className="cust-row">
        <span className="cust-label">Skin</span>
        {SKIN_TONES.map((c, i) => (
          <button
            key={c}
            className={`cust-swatch ${appearance.skin === i ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => set({ skin: i })}
          />
        ))}
      </div>
      <div className="cust-row">
        <span className="cust-label">Hair</span>
        {(["none", "short", "long"] as const).map((h) => (
          <button
            key={h}
            className={`cust-chip ${appearance.hair === h ? "active" : ""}`}
            onClick={() => set({ hair: h })}
          >
            {h}
          </button>
        ))}
      </div>
      <div className="cust-row">
        <span className="cust-label">Colour</span>
        {HAIR_COLORS.map((c, i) => (
          <button
            key={c}
            className={`cust-swatch ${appearance.hairColor === i ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => set({ hairColor: i })}
          />
        ))}
      </div>
      <div className="cust-row">
        <span className="cust-label">Beard</span>
        {[false, true].map((b) => (
          <button
            key={String(b)}
            className={`cust-chip ${appearance.beard === b ? "active" : ""}`}
            onClick={() => set({ beard: b })}
          >
            {b ? "beard" : "clean"}
          </button>
        ))}
      </div>
      <div className="cust-row">
        <span className="cust-label">Extra</span>
        {(["none", "glasses", "scarf"] as const).map((a) => (
          <button
            key={a}
            className={`cust-chip ${appearance.accessory === a ? "active" : ""}`}
            onClick={() => set({ accessory: a })}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="cust-row">
        <span className="cust-label">Shirt</span>
        {Object.entries(SHIRTS).slice(0, 5).map(([key, def]) => (
          <button
            key={key}
            className={`cust-swatch ${shirt === key ? "active" : ""}`}
            style={{ background: def.color }}
            onClick={() => useGame.setState({ shirt: key, ownedShirts: Array.from(new Set([...useGame.getState().ownedShirts, key])) })}
          />
        ))}
      </div>
      <button className="intro-btn primary" onClick={onDone}>
        Looks good — into the forest ▶
      </button>
    </div>
  );
}

export default function Login() {
  const savedName = useGame((s) => s.name);
  const level = useGame((s) => s.level);
  const start = useGame((s) => s.start);
  const setSpectator = useGame((s) => s.setSpectator);
  const { progress, active } = useProgress();
  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setName((n) => n || savedName);
  }, [savedName]);

  const ready = !active && progress >= 100;
  const returning = hydrated && !!savedName;

  const finish = () => {
    start(useGame.getState().account?.name ?? name);
  };

  const enterOnline = async (kind: "login" | "register") => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "login") {
        await loginCloud(name.trim(), password);
        startSaveSync();
        finish();
      } else {
        await registerCloud(name.trim(), password);
        startSaveSync();
        setMode("customize"); // new account: pick a look first
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const enterPhantom = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { isNew } = await connectWallet();
      startSaveSync();
      if (isNew) {
        setName("");
        setMode("walletname"); // brand new wallet: pick a username
      } else {
        finish();
      }
    } catch (e: any) {
      setError(e.message ?? "Wallet connection failed");
    } finally {
      setBusy(false);
    }
  };

  const submitWalletName = async () => {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await chooseName(name.trim());
      setMode("customize");
    } catch (e: any) {
      setError(e.message ?? "Couldn't set that name");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="intro-overlay">
      <div className="intro-panel">
        <div className="intro-emblem">🌲🍄🪓</div>
        <h1 className="intro-title">WILDWOOD</h1>
        <p className="intro-tagline">
          a forest that pays you back — forage, farm, fight the dead, cash out
        </p>
        <div className="intro-features">
          <span>🏡 own land</span>
          <span>🧟 blood moons</span>
          <span>🐔 passive eggs</span>
          <span>💸 play to earn</span>
        </div>

        {!ready && (
          <div className="intro-loading">
            <div className="intro-loading-track">
              <div className="intro-loading-fill" style={{ width: `${progress}%` }} />
            </div>
            growing the forest… {Math.round(progress)}%
          </div>
        )}

        {ready && mode === "menu" && (
          <div className="intro-actions">
            <button className="intro-btn primary" onClick={() => setMode("guest")}>
              ▶ Play
            </button>
            <button className="intro-btn" onClick={() => setMode("online")}>
              🌐 Online account
            </button>
            <button className="intro-btn phantom" onClick={enterPhantom} disabled={busy}>
              {busy ? "Connecting…" : "👻 Connect Phantom"}
            </button>
            <button className="intro-btn ghosted" onClick={() => setSpectator(true)}>
              👁 Spectate
            </button>
            {error && <p className="login-error">{error}</p>}
          </div>
        )}

        {ready && mode === "guest" && (
          <div className="intro-actions">
            <input
              className="login-input"
              placeholder="Choose a name"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setMode("customize")}
              autoFocus
            />
            <button className="intro-btn primary" onClick={() => setMode("customize")}>
              {returning && name === savedName ? `Continue as ${savedName} · Lv ${level}` : "Next — customize →"}
            </button>
            <button className="intro-btn ghosted" onClick={() => setMode("menu")}>← Back</button>
            <p className="login-note">guest progress saves in this browser only</p>
          </div>
        )}

        {ready && mode === "online" && (
          <div className="intro-actions">
            <input
              className="login-input"
              placeholder="Name"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enterOnline("login")}
            />
            {error && <p className="login-error">{error}</p>}
            <button
              className="intro-btn primary"
              onClick={() => enterOnline("login")}
              disabled={busy || !name.trim() || !password}
            >
              {busy ? "…" : "Log in"}
            </button>
            <button
              className="intro-btn"
              onClick={() => enterOnline("register")}
              disabled={busy || !name.trim() || !password}
            >
              Create account
            </button>
            <button className="intro-btn ghosted" onClick={() => setMode("menu")}>← Back</button>
            <p className="login-note">cloud saves · player market · visit Havens</p>
          </div>
        )}

        {ready && mode === "walletname" && (
          <div className="intro-actions">
            <p className="intro-step-title">👻 Wallet connected — pick your forager name</p>
            <input
              className="login-input"
              placeholder="Your username"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitWalletName()}
              autoFocus
            />
            {error && <p className="login-error">{error}</p>}
            <button
              className="intro-btn primary"
              onClick={submitWalletName}
              disabled={busy || name.trim().length < 2}
            >
              {busy ? "…" : "That's me →"}
            </button>
          </div>
        )}

        {ready && mode === "customize" && (
          <>
            <p className="intro-step-title">Customize your forager — you&apos;re behind this card 👀</p>
            <Customizer onDone={finish} />
          </>
        )}
      </div>
      <div className="intro-footer">
        the forest behind this card is live — night falls every 20 minutes
      </div>
    </div>
  );
}
