"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Model, useCompositeModel } from "@/lib/assets";
import {
  DECOR, COLLECTIBLES, RIVER_X, RIVER_WIDTH, CAMPFIRE_POS, BUILDINGS,
  HOME_PORTAL_POS, HOME_TIERS,
} from "@/lib/world";
import { useGame, COLLECTIBLE_RESPAWN_MS } from "@/lib/store";
import { moveTarget, daylight, lastWater } from "@/lib/runtime";
import Trees from "./Trees";
import Rocks from "./Rocks";
import Zombies from "./Zombies";
import Animals from "./Animals";
import Dog from "./Dog";
import GhostPlayers from "./GhostPlayers";

function Ground() {
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().setChopTarget(null);
    useGame.getState().setMineTarget(null);
    useGame.getState().setAttackTarget(null);
    moveTarget.x = e.point.x;
    moveTarget.z = e.point.z;
    moveTarget.active = true;
    moveTarget.setAt = performance.now();
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#5d7e3b" roughness={1} />
      </mesh>
      {/* glade clearing — slightly lighter grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[15, 40]} />
        <meshStandardMaterial color="#6f924a" roughness={1} />
      </mesh>
      {/* river — click near the bank to collect water */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[RIVER_X, 0.015, 0]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGame.getState();
          if (!s.nearWater) {
            s.addToast("Get closer to the water 💧");
            return;
          }
          if (Date.now() - lastWater.at < 2000) return;
          lastWater.at = Date.now();
          s.collectWater();
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <planeGeometry args={[RIVER_WIDTH, 150]} />
        <meshStandardMaterial color="#3d7ba6" roughness={0.3} />
      </mesh>
      {/* river banks */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[RIVER_X + side * (RIVER_WIDTH / 2 + 0.5), 0.01, 0]}
        >
          <planeGeometry args={[1.2, 150]} />
          <meshStandardMaterial color="#8a7a55" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Campfire() {
  const flameRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const night = 1 - daylight();
    if (flameRef.current) {
      flameRef.current.scale.setScalar(1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05);
    }
    if (lightRef.current) {
      lightRef.current.intensity =
        (10 + night * 14) + Math.sin(t * 11) * 3 + Math.sin(t * 29) * 2;
    }
  });
  const stones = useMemo(() => {
    const arr: { x: number; z: number; r: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      arr.push({ x: Math.cos(a) * 1.1, z: Math.sin(a) * 1.1, r: a });
    }
    return arr;
  }, []);
  return (
    <group position={CAMPFIRE_POS}>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, 0.18, s.z]} rotation={[0.3, s.r, 0.2]} castShadow>
          <dodecahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial color="#7d7468" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 0.15, 0]} rotation={[0, 0.5, Math.PI / 2.4]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.1, 6]} />
        <meshStandardMaterial color="#5b4226" roughness={1} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[0, 2.4, Math.PI / 2.5]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.1, 6]} />
        <meshStandardMaterial color="#4e3820" roughness={1} />
      </mesh>
      <group ref={flameRef} position={[0, 0.25, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.32, 0.9, 7]} />
          <meshBasicMaterial color="#ff8c1a" />
        </mesh>
        <mesh position={[0.12, 0.22, 0.06]}>
          <coneGeometry args={[0.18, 0.55, 6]} />
          <meshBasicMaterial color="#ffc23d" />
        </mesh>
        <mesh position={[-0.1, 0.2, -0.08]}>
          <coneGeometry args={[0.14, 0.45, 6]} />
          <meshBasicMaterial color="#ffe08a" />
        </mesh>
      </group>
      <pointLight ref={lightRef} position={[0, 1.4, 0]} color="#ff9a3d" distance={18} decay={2} />
      <WorldLabel text="🔥 Campfire" y={2.4} />
    </group>
  );
}

const AWNING_COLORS: Record<string, string> = {
  trader: "#b8543f",
  armoury: "#4a4a52",
  tailor: "#a85a8a",
  medbay: "#d8dde2",
  exchange: "#3a6a5a",
};

function Building({ id, label, pos }: { id: string; label: string; pos: [number, number, number] }) {
  const open = () => {
    const s = useGame.getState();
    if (s.nearInteract?.kind === "shop" && s.nearInteract.id === id) s.setOpenShop(id as any);
    else {
      s.addToast(`Walk closer to the ${label.slice(2).trim()}`);
      moveTarget.x = pos[0] + 2.2;
      moveTarget.z = pos[2] + 1.5;
      moveTarget.active = true;
    }
  };
  const wood = "#7a5a33";
  const woodDark = "#5e4426";
  const awning = AWNING_COLORS[id] ?? "#b8543f";
  return (
    <group
      position={pos}
      onClick={(e) => { e.stopPropagation(); open(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      {/* posts */}
      {[[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.9], [1.4, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 2.2, 6]} />
          <meshStandardMaterial color={woodDark} roughness={1} />
        </mesh>
      ))}
      {/* counter */}
      <mesh position={[0, 0.55, 1]} castShadow>
        <boxGeometry args={[3, 0.5, 0.5]} />
        <meshStandardMaterial color={wood} roughness={1} />
      </mesh>
      {/* awning */}
      <mesh position={[0, 2.25, 0.05]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[3.4, 0.08, 2.4]} />
        <meshStandardMaterial color={awning} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.31, 0.05]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[3.42, 0.02, 1.1]} />
        <meshStandardMaterial color="#e8d9b8" roughness={0.9} />
      </mesh>
      {/* per-shop dressing */}
      {id === "trader" && (
        <>
          <mesh position={[-1, 0.3, 0]} rotation={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#9a7944" roughness={1} />
          </mesh>
          <mesh position={[0.9, 0.25, -0.2]} rotation={[0, -0.3, 0]} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#86683a" roughness={1} />
          </mesh>
        </>
      )}
      {id === "armoury" && (
        <>
          {/* anvil */}
          <mesh position={[-0.8, 0.45, -0.1]} castShadow>
            <boxGeometry args={[0.6, 0.25, 0.3]} />
            <meshStandardMaterial color="#5a5f66" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.8, 0.2, -0.1]} castShadow>
            <boxGeometry args={[0.35, 0.3, 0.35]} />
            <meshStandardMaterial color="#4a3b28" roughness={1} />
          </mesh>
          {/* sword rack */}
          <mesh position={[0.9, 0.6, -0.4]} rotation={[0, 0, 0.4]} castShadow>
            <boxGeometry args={[0.06, 0.9, 0.04]} />
            <meshStandardMaterial color="#c8cdd2" metalness={0.7} roughness={0.25} />
          </mesh>
        </>
      )}
      {id === "tailor" && (
        <>
          {/* mannequin */}
          <mesh position={[-0.8, 0.75, -0.2]} castShadow>
            <boxGeometry args={[0.4, 0.5, 0.25]} />
            <meshStandardMaterial color="#6d4a8a" roughness={1} />
          </mesh>
          <mesh position={[-0.8, 0.3, -0.2]} castShadow>
            <cylinderGeometry args={[0.05, 0.12, 0.5, 6]} />
            <meshStandardMaterial color="#5e4426" roughness={1} />
          </mesh>
          {/* fabric rolls */}
          <mesh position={[0.8, 0.35, -0.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.8, 8]} />
            <meshStandardMaterial color="#a8403a" roughness={1} />
          </mesh>
          <mesh position={[0.8, 0.55, -0.2]} rotation={[0, 0.3, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.8, 8]} />
            <meshStandardMaterial color="#2e5d8a" roughness={1} />
          </mesh>
        </>
      )}
      {id === "medbay" && (
        <>
          {/* red cross sign */}
          <group position={[0, 2.7, 0.1]}>
            <mesh castShadow>
              <boxGeometry args={[0.5, 0.16, 0.1]} />
              <meshStandardMaterial color="#c0392b" emissive="#5a1a12" emissiveIntensity={0.5} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[0.16, 0.5, 0.1]} />
              <meshStandardMaterial color="#c0392b" emissive="#5a1a12" emissiveIntensity={0.5} />
            </mesh>
          </group>
          {/* cot */}
          <mesh position={[-0.8, 0.3, -0.2]} castShadow>
            <boxGeometry args={[0.6, 0.15, 1.1]} />
            <meshStandardMaterial color="#e8e4da" roughness={1} />
          </mesh>
        </>
      )}
      {id === "exchange" && (
        <>
          {/* notice board */}
          <mesh position={[0, 1.4, -0.6]} castShadow>
            <boxGeometry args={[1.6, 1, 0.08]} />
            <meshStandardMaterial color="#8a6a3f" roughness={1} />
          </mesh>
          {[[-0.45, 1.55], [0.1, 1.3], [0.45, 1.5]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, -0.54]}>
              <boxGeometry args={[0.3, 0.24, 0.02]} />
              <meshStandardMaterial color="#f2eddc" roughness={1} />
            </mesh>
          ))}
          {/* scales */}
          <mesh position={[0.9, 0.95, 0.9]} castShadow>
            <cylinderGeometry args={[0.04, 0.12, 0.5, 6]} />
            <meshStandardMaterial color="#8a6a1f" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      )}
      <WorldLabel text={label} y={3.1} />
    </group>
  );
}

function WorldLabel({ text, y = 2 }: { text: string; y?: number }) {
  return (
    <Html position={[0, y, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
      <div className="world-label">{text}</div>
    </Html>
  );
}

function Collectibles() {
  const collected = useGame((s) => s.collected);
  // re-check periodically so collected items respawn
  const [, forceTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
  const now = Date.now();
  return (
    <>
      {COLLECTIBLES.filter((c) => {
        const at = collected[c.id];
        return !at || now - at > COLLECTIBLE_RESPAWN_MS;
      }).map((c) => (
        <group key={c.id} position={c.pos}>
          <Model file={c.file} size={c.size} position={[0, 0, 0]} rotationY={c.rot} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[0.55, 0.7, 24]} />
            <meshBasicMaterial color="#f0c952" transparent opacity={0.65} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Fireflies() {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 48;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 0.6 + Math.random() * 2.2;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);
  useFrame(({ clock }, dt) => {
    const night = 1 - daylight();
    if (matRef.current) {
      matRef.current.opacity = night * (0.55 + Math.sin(clock.elapsedTime * 2.3) * 0.25);
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.012;
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.25;
    }
  });
  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          color="#d8f57e"
          size={0.18}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function World() {
  return (
    <group>
      <Ground />
      {DECOR.map((d, i) => (
        <Model
          key={i}
          file={d.file}
          size={d.size}
          by={d.by}
          align={d.align}
          position={d.pos}
          rotationY={d.rot}
        />
      ))}

      <Trees />
      <Rocks />
      <Bridge />
      <Campfire />
      {BUILDINGS.map((b) => (
        <Building key={b.id} id={b.id} label={b.label} pos={b.pos} />
      ))}
      <Fireflies />
      <Zombies />
      <Animals />
      <Dog />
      <GhostPlayers />
      <HomePortal />

      {/* signposts for the points of interest */}
      <group position={[-6, 0, -26]}>
        <WorldLabel text="🍄 Mushroom Grove" y={1.4} />
      </group>
      <group position={[-2, 0, 28]}>
        <WorldLabel text="🌼 The Meadow" y={1.4} />
      </group>

      <Collectibles />
    </group>
  );
}

function HomePortal() {
  const homeTier = useGame((s) => s.homeTier);
  const click = (e: any) => {
    e.stopPropagation();
    const s = useGame.getState();
    if (s.nearInteract?.kind === "portal") {
      if (s.homeTier > 0) s.travel("home");
      else s.setHomeOffer("buy");
    } else {
      s.addToast("Walk closer to the homestead gate");
      moveTarget.x = HOME_PORTAL_POS[0];
      moveTarget.z = HOME_PORTAL_POS[2] + 2;
      moveTarget.active = true;
    }
  };
  return (
    <group
      position={HOME_PORTAL_POS}
      rotation={[0, Math.PI / 2, 0]}
      onClick={click}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 2.4, 6]} />
          <meshStandardMaterial color="#5e4426" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[3.2, 0.28, 0.28]} />
        <meshStandardMaterial color="#75582f" roughness={1} />
      </mesh>
      {/* shimmering doorway */}
      <mesh position={[0, 1.15, 0]}>
        <planeGeometry args={[2.3, 2.1]} />
        <meshBasicMaterial color="#9bd06a" transparent opacity={0.25} side={2} />
      </mesh>
      <WorldLabel
        text={homeTier > 0 ? "🏡 My Homestead" : `🪧 Land for Sale — ${HOME_TIERS[0].price} 🌰`}
        y={3.3}
      />
    </group>
  );
}

function Bridge() {
  const bridge = useCompositeModel(
    ["PP_Bridge_15_Left", "PP_Bridge_15_Middle", "PP_Bridge_15_Right"],
    11,
    "xz"
  );
  return (
    <group position={[RIVER_X, 0, 0]}>
      <primitive object={bridge} />
      <WorldLabel text="🌉 Old Bridge" y={4} />
    </group>
  );
}
