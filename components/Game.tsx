"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import World from "./World";
import Homestead from "./Homestead";
import Interior from "./Interior";
import Cave from "./Cave";
import Player from "./Player";
import Hud from "./Hud";
import Login from "./Login";
import { useGame } from "@/lib/store";
import { clock, daylight, live, moveTarget, zombies, teleport, isBloodMoonNight, DAY_LENGTH_S, weather, isRaining, seasonFor, tour } from "@/lib/runtime";
import { TREES, ROCKS, TOUR_STOPS } from "@/lib/world";
import { ambience } from "@/lib/ambience";
import { startMultiplayer, ghosts } from "@/lib/multiplayer";
import * as cloud from "@/lib/cloud";

const SKY_DAY = new THREE.Color("#7fae5e");
const SKY_NIGHT = new THREE.Color("#0d1422");
const SKY_BLOOD = new THREE.Color("#2a0d10");
const SKY_INTERIOR = new THREE.Color("#221a10");
const SKY_CAVE = new THREE.Color("#0b0a0c");
const SKY_RAIN = new THREE.Color("#5e7261");

// each season nudges the sunlight: warm gold autumns, pale blue winters
const SEASON_TINT: Record<string, THREE.Color> = {
  Spring: new THREE.Color("#ffffff"),
  Summer: new THREE.Color("#fff8e8"),
  Autumn: new THREE.Color("#ffd9a8"),
  Winter: new THREE.Color("#cfdce8"),
};
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

    // weather state machine: stretches of clear sky broken by rain showers
    if (Date.now() > weather.until) {
      if (weather.kind === "rain" || Math.random() < 0.65) {
        weather.kind = "clear";
        weather.until = Date.now() + (200 + Math.random() * 200) * 1000;
      } else {
        weather.kind = "rain";
        weather.until = Date.now() + (90 + Math.random() * 110) * 1000;
        useGame.getState().addToast("🌧 Rain! Crops drink it up, fish are biting");
      }
    }
    const raining = isRaining();

    const d = daylight();
    if (isBloodMoonNight()) {
      sky.current.copy(SKY_BLOOD).lerp(SKY_DAY, d);
      sun.current.copy(SUN_BLOOD).lerp(SUN_DAY, d);
    } else {
      sky.current.copy(SKY_NIGHT).lerp(SKY_DAY, d);
      sun.current.copy(SUN_NIGHT).lerp(SUN_DAY, d);
    }
    if (raining) sky.current.lerp(SKY_RAIN, 0.55 * d);
    sun.current.multiply(SEASON_TINT[seasonFor(clock.day).name]);
    // indoors (and underground) the world falls away into darkness
    const loc = useGame.getState().location;
    if (loc === "interior") sky.current.copy(SKY_INTERIOR);
    if (loc === "cave") sky.current.copy(SKY_CAVE);

    if (scene.background instanceof THREE.Color) scene.background.copy(sky.current);
    else scene.background = sky.current.clone();
    if (scene.fog) scene.fog.color.copy(sky.current);

    if (dirRef.current) {
      dirRef.current.intensity = (0.12 + 1.4 * d) * (raining ? 0.55 : 1);
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

const RAIN_COUNT = 900;
const RAIN_BOX = 36;
const RAIN_H = 18;

function Rain() {
  const ref = useRef<THREE.Points>(null);
  const positions = useRef<Float32Array>();
  if (!positions.current) {
    const p = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      p[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
      p[i * 3 + 1] = Math.random() * RAIN_H;
      p[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
    }
    positions.current = p;
  }

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const raining = isRaining() && useGame.getState().location !== "interior";
    pts.visible = raining;
    if (!raining) return;
    const p = positions.current!;
    for (let i = 0; i < RAIN_COUNT; i++) {
      p[i * 3 + 1] -= dt * 26;
      p[i * 3] -= dt * 3; // a touch of wind
      if (p[i * 3 + 1] < 0) {
        p[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
        p[i * 3 + 1] = RAIN_H;
        p[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
      }
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    pts.position.set(live.x, 0, live.z); // the shower follows the player
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={RAIN_COUNT}
          array={positions.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#c8e2ee" size={0.18} transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

const TOUR_OFFSET = new THREE.Vector3(13, 15, 13);
const TOUR_SECS = 3.6;

function TourCamera() {
  const { camera } = useThree();
  const step = useGame((s) => s.tourStep);
  const elapsed = useRef(0);
  const lastStep = useRef(-1);

  useFrame((_, dt) => {
    if (step < 0 || step >= TOUR_STOPS.length) return;
    if (step !== lastStep.current) {
      lastStep.current = step;
      elapsed.current = 0;
    }
    const stop = TOUR_STOPS[step];
    const focus = new THREE.Vector3(stop.focus[0], 0.8, stop.focus[1]);
    const want = focus.clone().add(TOUR_OFFSET);
    // first stop snaps near, the rest glide
    camera.position.lerp(want, Math.min(1, dt * (step === 0 ? 6 : 2.2)));
    camera.up.set(0, 1, 0);
    camera.lookAt(focus);
    elapsed.current += dt;
    if (elapsed.current >= TOUR_SECS) {
      useGame.getState().setTourStep(step + 1);
    }
  });
  return null;
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
    // first time in: roll the welcome camera tour
    if (started) {
      let done = false;
      try { done = localStorage.getItem("ww-tour-done") === "1"; } catch {}
      if (!done && useGame.getState().location === "forest") {
        setTimeout(() => useGame.getState().startTour(), 600);
      }
    }
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
    (window as any).__weather = weather;
    (window as any).__cloud = cloud;
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
          {location === "forest" ? <World /> : location === "interior" ? <Interior /> : location === "cave" ? <Cave /> : <Homestead />}
          <Player />
          <Rain />
          <TourCamera />
        </Suspense>
      </Canvas>
      {started ? <Hud /> : spectator ? <SpectatorOverlay /> : <Login />}
    </div>
  );
}
