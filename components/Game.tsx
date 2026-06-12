"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import World from "./World";
import Homestead from "./Homestead";
import Interior from "./Interior";
import Player from "./Player";
import Hud from "./Hud";
import Login from "./Login";
import { useGame } from "@/lib/store";
import { clock, daylight, live, moveTarget, zombies, teleport, isBloodMoonNight, DAY_LENGTH_S } from "@/lib/runtime";
import { TREES, ROCKS } from "@/lib/world";
import { ambience } from "@/lib/ambience";
import { startMultiplayer, ghosts } from "@/lib/multiplayer";

const SKY_DAY = new THREE.Color("#7fae5e");
const SKY_NIGHT = new THREE.Color("#0d1422");
const SKY_BLOOD = new THREE.Color("#2a0d10");
const SKY_INTERIOR = new THREE.Color("#221a10");
const SUN_DAY = new THREE.Color("#fff3d6");
const SUN_NIGHT = new THREE.Color("#7a8fc9");
const SUN_BLOOD = new THREE.Color("#d96a5a");

function DayNight() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const sky = useRef(new THREE.Color());
  const sun = useRef(new THREE.Color());

  useFrame((_, dt) => {
    const prev = clock.timeOfDay;
    clock.timeOfDay = (clock.timeOfDay + dt / DAY_LENGTH_S) % 1;
    if (clock.timeOfDay < prev) clock.day += 1;

    const d = daylight();
    if (isBloodMoonNight()) {
      sky.current.copy(SKY_BLOOD).lerp(SKY_DAY, d);
      sun.current.copy(SUN_BLOOD).lerp(SUN_DAY, d);
    } else {
      sky.current.copy(SKY_NIGHT).lerp(SKY_DAY, d);
      sun.current.copy(SUN_NIGHT).lerp(SUN_DAY, d);
    }
    // indoors the world falls away into warm darkness
    if (useGame.getState().location === "interior") sky.current.copy(SKY_INTERIOR);

    if (scene.background instanceof THREE.Color) scene.background.copy(sky.current);
    else scene.background = sky.current.clone();
    if (scene.fog) scene.fog.color.copy(sky.current);

    if (dirRef.current) {
      dirRef.current.intensity = 0.12 + 1.4 * d;
      dirRef.current.color.copy(sun.current);
    }
    if (ambRef.current) ambRef.current.intensity = 0.22 + 0.42 * d;
    if (hemiRef.current) hemiRef.current.intensity = 0.08 + 0.34 * d;
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.6} color="#cfe0b8" />
      <directionalLight
        ref={dirRef}
        position={[35, 50, 15]}
        intensity={1.5}
        color="#fff3d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />
      <hemisphereLight ref={hemiRef} args={["#b8d4e8", "#3d4a28", 0.4]} />
    </>
  );
}

function SpectatorOverlay() {
  const setSpectator = useGame((s) => s.setSpectator);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSpectator(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSpectator]);
  return (
    <div className="spectator-bar">
      <span>👁 Spectator mode — the forest lives on its own</span>
      <button className="btn small" onClick={() => setSpectator(false)}>Exit (Esc)</button>
    </div>
  );
}

export default function Game() {
  const started = useGame((s) => s.started);
  const spectator = useGame((s) => s.spectator);
  const location = useGame((s) => s.location);

  useEffect(() => {
    if (started || spectator) ambience.start();
    if (started) startMultiplayer();
  }, [started, spectator]);
  useEffect(() => {
    // dev/test hooks for scripted playtesting
    (window as any).__game = useGame;
    (window as any).__live = live;
    (window as any).__trees = TREES;
    (window as any).__clock = clock;
    (window as any).__mt = moveTarget;
    (window as any).__zombies = zombies;
    (window as any).__teleport = teleport;
    (window as any).__rocks = ROCKS;
    (window as any).__ghosts = ghosts;
  }, []);
  return (
    <div className="game-root">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [16, 22, 16], fov: 38 }}
      >
        <color attach="background" args={["#7fae5e"]} />
        <fog attach="fog" args={["#7fae5e", 60, 130]} />
        <DayNight />
        <Suspense fallback={null}>
          {location === "forest" ? <World /> : location === "interior" ? <Interior /> : <Homestead />}
          <Player />
        </Suspense>
      </Canvas>
      {started ? <Hud /> : spectator ? <SpectatorOverlay /> : <Login />}
    </div>
  );
}
