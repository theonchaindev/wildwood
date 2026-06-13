"use client";

// The Old Mine — a dark cave instance below Darkwood. Coal is common,
// diamonds glitter rarely, and the only light is yours.

import { useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { live, moveTarget, mine } from "@/lib/runtime";
import { CAVE_ORES, CAVE_HW, CAVE_HD, STALAGMITES, ORE_RESPAWN_MS, CaveOre } from "@/lib/world";
import { HoverRing } from "./Trees";
import CaveMobs from "./CaveMobs";

const ORE_COLORS: Record<CaveOre["kind"], { rock: string; fleck: string; emissive: string }> = {
  stone: { rock: "#6e675e", fleck: "#8d857a", emissive: "#000000" },
  coal: { rock: "#544e46", fleck: "#1c1a17", emissive: "#000000" },
  diamond: { rock: "#5a5e66", fleck: "#9fe8f0", emissive: "#5fd8e8" },
};

function OreNode({ ore }: { ore: CaveOre }) {
  const minedAtTs = useGame((s) => s.minedAt[ore.id]);
  const isTarget = useGame((s) => s.mineTargetId === ore.id);
  const [hovered, setHovered] = useState(false);
  const pivot = useRef<THREE.Group>(null);
  const c = ORE_COLORS[ore.kind];

  useFrame(({ clock }) => {
    const g = pivot.current;
    if (!g) return;
    if (minedAtTs) {
      const k = Math.min(1, (Date.now() - minedAtTs) / 600);
      g.scale.setScalar(Math.max(0.001, 1 - k));
      g.visible = k < 1;
      return;
    }
    g.visible = true;
    g.scale.setScalar(1);
    if (isTarget && mine.mining) {
      const s = Math.sin(clock.elapsedTime * 45) * 0.012;
      g.position.x = s;
      g.position.z = s * 0.7;
    } else {
      g.position.x = 0;
      g.position.z = 0;
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (minedAtTs) return;
    e.stopPropagation();
    useGame.getState().setMineTarget(ore.id);
    moveTarget.x = ore.pos[0];
    moveTarget.z = ore.pos[2];
    moveTarget.active = true;
  };

  // a few mineral flecks dotted on the rock
  const flecks: [number, number, number][] = [
    [ore.size * 0.3, ore.size * 0.45, ore.size * 0.32],
    [-ore.size * 0.32, ore.size * 0.3, ore.size * 0.28],
    [ore.size * 0.05, ore.size * 0.62, -ore.size * 0.25],
    [-ore.size * 0.15, ore.size * 0.25, -ore.size * 0.35],
  ];

  return (
    <group position={ore.pos}>
      <group ref={pivot}>
        <group
          onClick={click}
          onPointerOver={(e) => {
            if (minedAtTs) return;
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            setHovered(true);
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
            setHovered(false);
          }}
        >
          <mesh position={[0, ore.size * 0.4, 0]} castShadow>
            <dodecahedronGeometry args={[ore.size * 0.55, 0]} />
            <meshStandardMaterial color={c.rock} roughness={1} />
          </mesh>
          {flecks.map((p, i) => (
            <mesh key={i} position={p}>
              <octahedronGeometry args={[ore.size * (ore.kind === "diamond" ? 0.13 : 0.11), 0]} />
              <meshStandardMaterial
                color={c.fleck}
                roughness={ore.kind === "diamond" ? 0.15 : 0.8}
                emissive={c.emissive}
                emissiveIntensity={ore.kind === "diamond" ? 0.8 : 0}
              />
            </mesh>
          ))}
          {ore.kind === "diamond" && (
            <pointLight position={[0, ore.size * 0.7, 0]} color="#7fe8f5" intensity={0.7} distance={4.5} decay={2} />
          )}
        </group>
      </group>
      {hovered && !minedAtTs && <HoverRing r={ore.r + 0.5} />}
      {isTarget && !minedAtTs && <MineBar height={ore.size + 0.8} />}
      {ore.kind !== "stone" && !minedAtTs && (
        <Html position={[0, ore.size + 0.55, 0]} center distanceFactor={26} zIndexRange={[9, 0]}>
          <div className="world-label small">{ore.kind === "diamond" ? "💎 Diamond" : "⚫ Coal vein"}</div>
        </Html>
      )}
    </group>
  );
}

function MineBar({ height }: { height: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${Math.round(mine.progress * 100)}%`;
    }
  });
  return (
    <Html position={[0, height, 0]} center distanceFactor={26} zIndexRange={[20, 0]}>
      <div className="chop-bar">
        <div className="chop-bar-icon">⛏️</div>
        <div className="chop-bar-track">
          <div className="chop-bar-fill stone" ref={fillRef} />
        </div>
      </div>
    </Html>
  );
}

function CaveExit() {
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = useGame.getState();
    if (Math.hypot(live.x - 0, live.z - CAVE_HD) < 4) s.exitCave();
    else s.addToast("Walk to the mouth of the mine to leave");
  };
  return (
    <group position={[0, 0, CAVE_HD]} onClick={click}>
      {/* daylight spilling in */}
      <mesh position={[0, 1.6, -0.1]}>
        <planeGeometry args={[3.4, 3.2]} />
        <meshBasicMaterial color="#cfe8b8" transparent opacity={0.9} />
      </mesh>
      <pointLight position={[0, 2, -1.5]} color="#e8f5cf" intensity={1.6} distance={12} decay={2} />
      <Html position={[0, 3.4, 0]} center distanceFactor={26} zIndexRange={[10, 0]}>
        <div className="world-label">🌲 Back to Darkwood</div>
      </Html>
    </group>
  );
}

export default function Cave() {
  const respawnCheck = useRef(0);
  const flicker = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, dt) => {
    // respawn mined ores on their own clocks (diamonds take their time)
    respawnCheck.current += dt;
    if (respawnCheck.current > 2) {
      respawnCheck.current = 0;
      const s = useGame.getState();
      for (const ore of CAVE_ORES) {
        const at = s.minedAt[ore.id];
        if (at && Date.now() - at > ORE_RESPAWN_MS[ore.kind]) {
          s.respawnRock(ore.id);
        }
      }
    }
    if (flicker.current) {
      flicker.current.intensity = 1.1 + Math.sin(clock.elapsedTime * 7) * 0.25;
      flicker.current.position.set(live.x, 2.2, live.z);
    }
  });

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    moveTarget.x = e.point.x;
    moveTarget.z = e.point.z;
    moveTarget.active = true;
  };

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={groundClick}>
        <planeGeometry args={[CAVE_HW * 2, CAVE_HD * 2]} />
        <meshStandardMaterial color="#3d3833" roughness={1} />
      </mesh>
      {/* rough rock walls */}
      <mesh position={[0, 2.6, -CAVE_HD - 0.4]}>
        <boxGeometry args={[CAVE_HW * 2 + 2, 5.2, 0.8]} />
        <meshStandardMaterial color="#322d28" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (CAVE_HW + 0.4), 2.6, 0]}>
          <boxGeometry args={[0.8, 5.2, CAVE_HD * 2 + 2]} />
          <meshStandardMaterial color="#322d28" roughness={1} />
        </mesh>
      ))}
      {/* south wall with the exit gap */}
      {[-1, 1].map((side) => (
        <mesh key={"s" + side} position={[side * (CAVE_HW / 2 + 1.6), 2.6, CAVE_HD + 0.4]}>
          <boxGeometry args={[CAVE_HW - 3.2, 5.2, 0.8]} />
          <meshStandardMaterial color="#322d28" roughness={1} />
        </mesh>
      ))}

      {STALAGMITES.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2, s.z]} castShadow>
          <coneGeometry args={[s.r, s.h, 6]} />
          <meshStandardMaterial color="#46413a" roughness={1} />
        </mesh>
      ))}

      {CAVE_ORES.map((ore) => (
        <OreNode key={ore.id} ore={ore} />
      ))}

      <CaveMobs />
      <CaveExit />

      {/* your lantern glow follows you; the rest is darkness */}
      <ambientLight intensity={0.16} color="#8a93b8" />
      <pointLight ref={flicker} color="#ffb868" intensity={1.1} distance={11} decay={2} />

      <Html position={[0, 5.6, -CAVE_HD]} center distanceFactor={30} zIndexRange={[8, 0]}>
        <div className="world-label">⛏️ The Old Mine</div>
      </Html>
    </group>
  );
}
