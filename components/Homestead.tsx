"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame, SEEDS, BUILDABLES, PEN_DEFS, Structure } from "@/lib/store";
import { live, daylight, moveTarget } from "@/lib/runtime";
import { Model } from "@/lib/assets";
import {
  HOME_TIERS, HOME_GATE_POS, HOME_CHEST_POS, HOME_FURNACE_POS,
  HOME_EXTEND_POS, HOME_CABIN_POS, PEN_SPOTS, pensAllowed, homeTilePos, homeTileKey,
} from "@/lib/world";

function near(px: number, pz: number, r = 4) {
  return Math.hypot(live.x - px, live.z - pz) < r;
}

function stopAnd(fn: () => void) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    fn();
  };
}

function hoverCursor() {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

const STAGE_COLORS: Record<string, string> = {
  "Carrot Seeds": "#e8923a",
  "Pumpkin Seeds": "#d8742e",
};

function FarmTile({ idx, readOnly }: { idx: number; readOnly?: boolean }) {
  const key = homeTileKey(idx);
  const ownCrop = useGame((s) => s.farm[key]);
  const visitCrop = useGame((s) => s.visitData?.farm?.[key]);
  const crop = readOnly ? visitCrop : ownCrop;
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 4000);
    return () => clearInterval(iv);
  }, []);

  const [x, z] = homeTilePos(idx);

  const click = stopAnd(() => {
    const s = useGame.getState();
    if (readOnly) {
      s.addToast("This isn't your field! 🌱");
      return;
    }
    if (!near(x, z, 3.5)) {
      s.addToast("Walk closer to your field");
      return;
    }
    if (crop) s.harvestTile(key);
    else s.plantSeed(key);
  });

  let stage = 0;
  let ready = false;
  if (crop) {
    const def = SEEDS[crop.seed];
    const k = Math.min(1, (Date.now() - crop.at) / def.growMs);
    stage = k;
    ready = k >= 1;
  }

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} onClick={click} {...hoverCursor()} receiveShadow>
        <boxGeometry args={[2.2, 0.12, 2.4]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      {crop && !ready && (
        <mesh position={[0, 0.2 + stage * 0.25, 0]} castShadow>
          <coneGeometry args={[0.12 + stage * 0.1, 0.25 + stage * 0.45, 6]} />
          <meshStandardMaterial color="#5fa052" roughness={1} />
        </mesh>
      )}
      {crop && ready && (
        <group>
          {crop.seed === "Pumpkin Seeds" ? (
            <mesh position={[0, 0.32, 0]} castShadow onClick={click} {...hoverCursor()}>
              <sphereGeometry args={[0.34, 8, 6]} />
              <meshStandardMaterial color={STAGE_COLORS[crop.seed]} roughness={1} />
            </mesh>
          ) : (
            <>
              {[-0.55, 0, 0.55].map((ox) => (
                <group key={ox} position={[ox, 0, 0]}>
                  <mesh position={[0, 0.28, 0]} castShadow>
                    <coneGeometry args={[0.09, 0.3, 6]} />
                    <meshStandardMaterial color="#6fae4f" roughness={1} />
                  </mesh>
                  <mesh position={[0, 0.14, 0]}>
                    <coneGeometry args={[0.06, 0.16, 6]} />
                    <meshStandardMaterial color={STAGE_COLORS[crop.seed]} roughness={1} />
                  </mesh>
                </group>
              ))}
            </>
          )}
          <Html position={[0, 1.1, 0]} center distanceFactor={28} zIndexRange={[12, 0]}>
            <div className="world-label small">✨ Ready!</div>
          </Html>
        </group>
      )}
    </group>
  );
}

function Furnace() {
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const night = 1 - daylight();
      glowRef.current.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 7) * 0.3 + night * 0.5;
    }
  });
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(HOME_FURNACE_POS[0], HOME_FURNACE_POS[2])) s.setOpenPanel("furnace");
    else s.addToast("Walk closer to the furnace");
  });
  return (
    <group position={HOME_FURNACE_POS} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial color="#7d7468" roughness={1} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.35, 0.4, 0.35]} />
        <meshStandardMaterial color="#6a6258" roughness={1} />
      </mesh>
      <mesh position={[-0.56, 0.38, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[0.5, 0.4, 0.02]} />
        <meshStandardMaterial ref={glowRef} color="#2a1a10" emissive="#ff7a1a" emissiveIntensity={1} />
      </mesh>
      <Html position={[0, 2, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
        <div className="world-label small">🔥 Furnace</div>
      </Html>
    </group>
  );
}

function Chest() {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(HOME_CHEST_POS[0], HOME_CHEST_POS[2])) s.setOpenPanel("chest");
    else s.addToast("Walk closer to the chest");
  });
  return (
    <group position={HOME_CHEST_POS} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1, 0.6, 0.7]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.62, -0.05]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[1.02, 0.18, 0.72]} />
        <meshStandardMaterial color="#75582f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.45, 0.36]}>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color="#d9a93f" metalness={0.5} roughness={0.4} />
      </mesh>
      <Html position={[0, 1.6, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
        <div className="world-label small">📦 Chest</div>
      </Html>
    </group>
  );
}

function Cabin() {
  return (
    <group position={HOME_CABIN_POS}>
      {/* walls */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[3.6, 2, 2.8]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 2.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.9, 1.3, 4]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      {/* door */}
      <mesh position={[0, 0.75, 1.42]}>
        <boxGeometry args={[0.8, 1.5, 0.06]} />
        <meshStandardMaterial color="#4a3520" roughness={1} />
      </mesh>
      {/* window */}
      <mesh position={[1.2, 1.2, 1.42]}>
        <boxGeometry args={[0.6, 0.6, 0.04]} />
        <meshStandardMaterial color="#cfe6f0" emissive="#7a96a8" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

const PEN_ANIMAL_MESH: Record<string, JSX.Element> = {
  chicken: (
    <>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.28]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
      <mesh position={[0, 0.34, 0.12]}>
        <boxGeometry args={[0.1, 0.12, 0.1]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
      <mesh position={[0, 0.42, 0.12]}>
        <boxGeometry args={[0.03, 0.05, 0.06]} />
        <meshStandardMaterial color="#d8453a" roughness={1} />
      </mesh>
    </>
  ),
  sheep: (
    <>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.45, 0.38, 0.6]} />
        <meshStandardMaterial color="#ece8dd" roughness={1} />
      </mesh>
      <mesh position={[0, 0.42, 0.38]} castShadow>
        <boxGeometry args={[0.22, 0.22, 0.2]} />
        <meshStandardMaterial color="#3a342c" roughness={1} />
      </mesh>
      {[[-0.14, 0.22], [0.14, 0.22], [-0.14, -0.22], [0.14, -0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]}>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#3a342c" roughness={1} />
        </mesh>
      ))}
    </>
  ),
  pig: (
    <>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.4, 0.32, 0.6]} />
        <meshStandardMaterial color="#e8a8a0" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0.36]} castShadow>
        <boxGeometry args={[0.24, 0.22, 0.16]} />
        <meshStandardMaterial color="#e8a8a0" roughness={1} />
      </mesh>
      <mesh position={[0, 0.28, 0.46]}>
        <boxGeometry args={[0.12, 0.1, 0.05]} />
        <meshStandardMaterial color="#d68d84" roughness={1} />
      </mesh>
      {[[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]}>
          <boxGeometry args={[0.08, 0.14, 0.08]} />
          <meshStandardMaterial color="#d68d84" roughness={1} />
        </mesh>
      ))}
    </>
  ),
  cow: (
    <>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.5, 0.42, 0.8]} />
        <meshStandardMaterial color="#e8e0d2" roughness={1} />
      </mesh>
      <mesh position={[0.1, 0.5, 0.15]} castShadow>
        <boxGeometry args={[0.22, 0.2, 0.3]} />
        <meshStandardMaterial color="#5a4434" roughness={1} />
      </mesh>
      <mesh position={[0, 0.5, 0.5]} castShadow>
        <boxGeometry args={[0.26, 0.26, 0.24]} />
        <meshStandardMaterial color="#e8e0d2" roughness={1} />
      </mesh>
      <mesh position={[-0.1, 0.66, 0.5]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.12, 0.04, 0.04]} />
        <meshStandardMaterial color="#d9c8a8" roughness={1} />
      </mesh>
      <mesh position={[0.1, 0.66, 0.5]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.12, 0.04, 0.04]} />
        <meshStandardMaterial color="#d9c8a8" roughness={1} />
      </mesh>
      {[[-0.16, 0.28], [0.16, 0.28], [-0.16, -0.28], [0.16, -0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]}>
          <boxGeometry args={[0.1, 0.2, 0.1]} />
          <meshStandardMaterial color="#e8e0d2" roughness={1} />
        </mesh>
      ))}
    </>
  ),
};

function PenAnimalIdle({ kind, seed }: { kind: string; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime + seed * 2.3;
      ref.current.position.y = Math.abs(Math.sin(t * (kind === "chicken" ? 6 : 3))) * 0.03;
      ref.current.rotation.y = seed * 1.8 + Math.sin(t * 0.4) * 0.5;
    }
  });
  return <group ref={ref}>{PEN_ANIMAL_MESH[kind]}</group>;
}

function PenSpot({ idx }: { idx: number }) {
  const pen = useGame((s) => s.pens[idx]);
  const [x, z] = PEN_SPOTS[idx];
  const def = pen ? PEN_DEFS[pen.animal] : null;
  // periodic re-render so the "ready" badge appears
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
  const pending = useGame.getState().penPending(idx);

  const click = stopAnd(() => {
    const s = useGame.getState();
    if (!near(x, z, 4.5)) {
      s.addToast("Walk closer to the pen");
      return;
    }
    s.setOpenPen(idx);
  });

  // fence square 4.2 × 3.6
  const posts: [number, number][] = [];
  for (let px = -2.1; px <= 2.1; px += 1.05) {
    posts.push([px, -1.8], [px, 1.8]);
  }
  for (let pz = -0.9; pz <= 0.9; pz += 0.9) {
    posts.push([-2.1, pz], [2.1, pz]);
  }

  return (
    <group position={[x, 0, z]} onClick={click} {...hoverCursor()}>
      {/* dirt pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4.2, 3.6]} />
        <meshStandardMaterial color={pen ? "#9b8456" : "#85975c"} roughness={1} />
      </mesh>
      {posts.map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.3, pz]} castShadow>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshStandardMaterial color="#75582f" roughness={1} />
        </mesh>
      ))}
      {/* rails */}
      {[-1.8, 1.8].map((rz, i) => (
        <mesh key={"r" + i} position={[0, 0.45, rz]} castShadow>
          <boxGeometry args={[4.2, 0.07, 0.07]} />
          <meshStandardMaterial color="#8a6a3f" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-2.1, 0.45, 0]} castShadow>
        <boxGeometry args={[0.07, 0.07, 3.6]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      <mesh position={[2.1, 0.45, 0]} castShadow>
        <boxGeometry args={[0.07, 0.07, 3.6]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>

      {pen ? (
        <>
          {Array.from({ length: pen.count }).map((_, i) => (
            <group key={i} position={[-1.2 + (i % 2) * 1.5, 0, -0.8 + Math.floor(i / 2) * 1.5]}>
              <PenAnimalIdle kind={pen.animal} seed={idx * 4 + i} />
            </group>
          ))}
          <Html position={[0, 2, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
            <div className="world-label small">
              {def!.icon} ×{pen.count}{pending > 0 ? ` · ${def!.productIcon} ${pending} ready!` : ""}
            </div>
          </Html>
        </>
      ) : (
        <Html position={[0, 1.6, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
          <div className="world-label">🚧 Empty pen — pick an animal</div>
        </Html>
      )}
    </group>
  );
}

function StructureMesh({ st, readOnly }: { st: Structure; readOnly?: boolean }) {
  const buildModeRaw = useGame((s) => s.buildMode);
  const buildMode = readOnly ? null : buildModeRaw;
  const torchLight = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (st.type === "torch" && torchLight.current) {
      const night = 1 - daylight();
      torchLight.current.intensity = (0.6 + night * 3.2) + Math.sin(clock.elapsedTime * 9 + st.id) * 0.4;
    }
  });
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (s.buildMode === "remove") s.removeStructure(st.id);
  });
  const interactive = buildMode === "remove";
  return (
    <group
      position={[st.x, 0, st.z]}
      onClick={interactive ? click : undefined}
      {...(interactive ? hoverCursor() : {})}
    >
      {st.type === "path" && (
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[1.6, 0.07, 1.6]} />
          <meshStandardMaterial color="#9a958a" roughness={1} />
        </mesh>
      )}
      {st.type === "torch" && (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.1, 6]} />
            <meshStandardMaterial color="#5e4426" roughness={1} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <coneGeometry args={[0.1, 0.25, 6]} />
            <meshBasicMaterial color="#ffc23d" />
          </mesh>
          <pointLight ref={torchLight} position={[0, 1.4, 0]} color="#ffb04a" distance={7} decay={2} />
        </group>
      )}
      {st.type === "flowerbed" && (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[1.4, 0.16, 1.4]} />
            <meshStandardMaterial color="#5e4426" roughness={1} />
          </mesh>
          {[[-0.35, -0.3, "#e8705f"], [0.3, -0.25, "#f2c14e"], [-0.2, 0.3, "#b76ec9"], [0.35, 0.32, "#6ec1e8"]].map(([x, z, c], i) => (
            <group key={i} position={[x as number, 0.16, z as number]}>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.24, 4]} />
                <meshStandardMaterial color="#5fa052" roughness={1} />
              </mesh>
              <mesh position={[0, 0.27, 0]}>
                <sphereGeometry args={[0.07, 6, 5]} />
                <meshStandardMaterial color={c as string} roughness={1} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {st.type === "barn" && (
        <group>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[3.4, 2.2, 2.6]} />
            <meshStandardMaterial color="#a8453a" roughness={1} />
          </mesh>
          <mesh position={[0, 2.6, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[2.6, 2.6, 2.8]} />
            <meshStandardMaterial color="#7a3028" roughness={1} />
          </mesh>
          <mesh position={[0, 0.8, 1.32]}>
            <boxGeometry args={[1.2, 1.6, 0.05]} />
            <meshStandardMaterial color="#e8e0cc" roughness={1} />
          </mesh>
          <mesh position={[0, 2, 1.32]}>
            <boxGeometry args={[0.6, 0.6, 0.05]} />
            <meshStandardMaterial color="#e8e0cc" roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function SleepingDog() {
  const owned = useGame((s) => s.dog);
  if (!owned) return null;
  return (
    <group position={[HOME_CABIN_POS[0] + 2.6, 0, HOME_CABIN_POS[2] + 1.4]} rotation={[0, -0.7, 0]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.6]} />
        <meshStandardMaterial color="#9a7448" roughness={1} />
      </mesh>
      <mesh position={[0, 0.22, 0.32]} castShadow>
        <boxGeometry args={[0.24, 0.2, 0.22]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      <Html position={[0, 0.9, 0]} center distanceFactor={28} zIndexRange={[9, 0]}>
        <div className="world-label small">🐕 zzz…</div>
      </Html>
    </group>
  );
}

function ExitGate() {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(HOME_GATE_POS[0], HOME_GATE_POS[2], 4.5)) s.travel("forest");
    else s.addToast("Walk to the gate to leave");
  });
  return (
    <group position={HOME_GATE_POS} onClick={click} {...hoverCursor()}>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 2.2, 6]} />
          <meshStandardMaterial color="#5e4426" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, 0]} castShadow>
        <boxGeometry args={[3, 0.25, 0.25]} />
        <meshStandardMaterial color="#75582f" roughness={1} />
      </mesh>
      <Html position={[0, 3, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
        <div className="world-label">🌲 Back to the Forest</div>
      </Html>
    </group>
  );
}

function ExtendSign() {
  const homeTier = useGame((s) => s.homeTier);
  if (homeTier >= HOME_TIERS.length) return null;
  const next = HOME_TIERS[homeTier];
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(HOME_EXTEND_POS[0], HOME_EXTEND_POS[2], 4.5)) s.setHomeOffer("extend");
    else s.addToast("Walk to the sign to extend your land");
  });
  return (
    <group position={HOME_EXTEND_POS} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1, 6]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[1.1, 0.6, 0.08]} />
        <meshStandardMaterial color="#a8854a" roughness={1} />
      </mesh>
      <Html position={[0, 1.9, 0]} center distanceFactor={30} zIndexRange={[10, 0]}>
        <div className="world-label">📐 Extend land — {next.price} 🌰</div>
      </Html>
    </group>
  );
}

export default function Homestead() {
  const ownName = useGame((s) => s.name);
  const ownTier = useGame((s) => s.homeTier);
  const ownStructures = useGame((s) => s.structures);
  const visitData = useGame((s) => s.visitData);
  const visiting = useGame((s) => s.location === "visit") && !!visitData;

  const name = visiting ? visitData!.name : ownName;
  const homeTier = visiting ? visitData!.homeTier : ownTier;
  const structures = visiting ? visitData!.structures : ownStructures;
  const tier = HOME_TIERS[Math.max(0, Math.min(homeTier, HOME_TIERS.length) - 1)];

  // fence posts around the current bounds, gap at the gate (south middle)
  const posts: [number, number][] = [];
  for (let x = -tier.halfW; x <= tier.halfW; x += 3) {
    posts.push([x, -tier.halfD]);
    if (Math.abs(x) > 2.4) posts.push([x, tier.halfD]);
  }
  for (let z = -tier.halfD + 3; z <= tier.halfD - 1; z += 3) {
    posts.push([-tier.halfW, z]);
    posts.push([tier.halfW, z]);
  }

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = useGame.getState();
    if (!visiting && s.buildMode && s.buildMode !== "remove") {
      // keep placements inside the fence and off the farm rows
      const x = e.point.x;
      const z = e.point.z;
      if (Math.abs(x) > tier.halfW - 1 || Math.abs(z) > tier.halfD - 1) {
        s.addToast("Build inside your fence");
        return;
      }
      s.placeStructure(x, z);
      return;
    }
    moveTarget.x = e.point.x;
    moveTarget.z = e.point.z;
    moveTarget.active = true;
  };

  return (
    <group>
      {/* surrounding forest floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#4c6a33" roughness={1} />
      </mesh>
      {/* your land */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={groundClick}>
        <planeGeometry args={[tier.halfW * 2, tier.halfD * 2]} />
        <meshStandardMaterial color="#7a9b54" roughness={1} />
      </mesh>

      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]} castShadow>
          <boxGeometry args={[0.14, 0.9, 0.14]} />
          <meshStandardMaterial color="#75582f" roughness={1} />
        </mesh>
      ))}

      {/* decorative treeline beyond the fence */}
      {[[-24, -18], [-15, -24], [0, -26], [14, -24], [24, -16], [-26, 4], [26, 2], [-22, 18], [20, 20], [8, 26], [-8, 26]].map(([x, z], i) => (
        <Model
          key={i}
          file={i % 2 ? "PP_Tree_02" : "PP_Birch_Tree_05"}
          size={5.5 + (i % 3)}
          position={[x, 0, z]}
          rotationY={i * 1.3}
        />
      ))}

      <Cabin />
      {!visiting && <Chest />}
      {!visiting && <Furnace />}
      <ExitGate />
      {!visiting && <ExtendSign />}
      {visiting
        ? Object.entries(visitData!.pens ?? {}).map(([i, p]: [string, any]) =>
            Number(i) < PEN_SPOTS.length ? <VisitPen key={i} idx={Number(i)} animal={p.animal} count={p.count} /> : null
          )
        : PEN_SPOTS.slice(0, pensAllowed(homeTier)).map((_, i) => <PenSpot key={i} idx={i} />)}
      {!visiting && <SleepingDog />}

      {structures.map((st) => (
        <StructureMesh key={st.id} st={st} readOnly={visiting} />
      ))}

      {Array.from({ length: tier.tiles }).map((_, i) => (
        <FarmTile key={i} idx={i} readOnly={visiting} />
      ))}

      <Html position={[0, 5.4, -6]} center distanceFactor={36} zIndexRange={[8, 0]}>
        <div className="world-label">🏡 {name}&apos;s {tier.name}{visiting ? " (visiting)" : ""}</div>
      </Html>
    </group>
  );
}

function VisitPen({ idx, animal, count }: { idx: number; animal: string; count: number }) {
  const [x, z] = PEN_SPOTS[idx];
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4.2, 3.6]} />
        <meshStandardMaterial color="#9b8456" roughness={1} />
      </mesh>
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <group key={i} position={[-1.2 + (i % 2) * 1.5, 0, -0.8 + Math.floor(i / 2) * 1.5]}>
          <PenAnimalIdle kind={animal} seed={idx * 4 + i} />
        </group>
      ))}
    </group>
  );
}
