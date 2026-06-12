"use client";

// Inside the player's house — its own instance, like the homestead.
// Placeholder furniture built from primitives; each piece is a component so
// it can be swapped for models when the interior asset pack lands.

import { useRef } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame, HOUSE_LEVELS } from "@/lib/store";
import { live, moveTarget, isNight } from "@/lib/runtime";
import { interiorDims, interiorLayout } from "@/lib/world";

function near(px: number, pz: number, r = 3) {
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

function Bed({ pos, lv }: { pos: [number, number]; lv: number }) {
  const blanket = lv >= 5 ? "#8a3c5a" : lv >= 3 ? "#4a6d8a" : "#6d8a4a";
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (!near(pos[0], pos[1])) {
      s.addToast("Walk over to the bed");
      return;
    }
    s.sleepTillDawn();
  });
  return (
    <group position={[pos[0], 0, pos[1]]} onClick={click} {...hoverCursor()}>
      {/* frame */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.3, 0.3, 2]} />
        <meshStandardMaterial color="#6a4a2c" roughness={1} />
      </mesh>
      {/* mattress + blanket */}
      <mesh position={[0, 0.42, 0.12]} castShadow>
        <boxGeometry args={[1.18, 0.16, 1.7]} />
        <meshStandardMaterial color="#e8e0cc" roughness={1} />
      </mesh>
      <mesh position={[0, 0.46, 0.35]} castShadow>
        <boxGeometry args={[1.2, 0.12, 1.15]} />
        <meshStandardMaterial color={blanket} roughness={1} />
      </mesh>
      {/* pillow */}
      <mesh position={[0, 0.52, -0.7]} castShadow>
        <boxGeometry args={[0.8, 0.14, 0.45]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
      {/* headboard */}
      <mesh position={[0, 0.65, -0.98]} castShadow>
        <boxGeometry args={[1.3, 0.85, 0.08]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      <Html position={[0, 1.5, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label small">🛏️ Bed{isNight() ? " — sleep till dawn" : ""}</div>
      </Html>
    </group>
  );
}

function Table({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 0.08, 10]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.6, 6]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      {/* candle */}
      <mesh position={[0.2, 0.74, 0.1]}>
        <cylinderGeometry args={[0.04, 0.04, 0.16, 6]} />
        <meshStandardMaterial color="#e8e0cc" roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.86, 0.1]}>
        <coneGeometry args={[0.035, 0.09, 6]} />
        <meshBasicMaterial color="#ffc23d" />
      </mesh>
      <pointLight position={[0.2, 1, 0.1]} color="#ffb04a" intensity={0.5} distance={4} decay={2} />
      {/* stools */}
      {[[-1.05, 0.25], [0.95, -0.45]].map(([sx, sz], i) => (
        <group key={i} position={[sx, 0, sz]}>
          <mesh position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.07, 8]} />
            <meshStandardMaterial color="#75582f" roughness={1} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.32, 5]} />
            <meshStandardMaterial color="#5e4426" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Fireplace({ pos }: { pos: [number, number] }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) {
      light.current.intensity = 1.6 + Math.sin(clock.elapsedTime * 8) * 0.35 + Math.sin(clock.elapsedTime * 13) * 0.2;
    }
  });
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.7, 1.4, 0.7]} />
        <meshStandardMaterial color="#7d7468" roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[1.9, 0.2, 0.85]} />
        <meshStandardMaterial color="#6a6258" roughness={1} />
      </mesh>
      {/* firebox */}
      <mesh position={[0, 0.45, 0.36]}>
        <boxGeometry args={[0.9, 0.7, 0.04]} />
        <meshStandardMaterial color="#1c1410" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0.42]}>
        <coneGeometry args={[0.22, 0.45, 6]} />
        <meshBasicMaterial color="#ff9a2e" />
      </mesh>
      <mesh position={[0.14, 0.26, 0.44]}>
        <coneGeometry args={[0.13, 0.3, 6]} />
        <meshBasicMaterial color="#ffc23d" />
      </mesh>
      <pointLight ref={light} position={[0, 0.7, 1]} color="#ff8c2e" distance={9} decay={2} />
    </group>
  );
}

function Bookshelf({ pos }: { pos: [number, number] }) {
  const books = ["#a8453a", "#3f6d35", "#2e5d8a", "#c99a2e", "#6d4a8a", "#8a3c28"];
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[1.6, 1.9, 0.45]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      {[0.5, 1.05, 1.6].map((y, row) => (
        <group key={y}>
          {books.slice(0, 5).map((c, i) => (
            <mesh key={i} position={[-0.55 + i * 0.27, y, 0.18]}>
              <boxGeometry args={[0.16, 0.34, 0.12]} />
              <meshStandardMaterial color={books[(i + row * 2) % books.length]} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Desk({ pos }: { pos: [number, number] }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (!near(pos[0], pos[1])) {
      s.addToast("Walk over to the desk");
      return;
    }
    s.setOpenPanel("house");
  });
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, -Math.PI / 7, 0]} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.2, 0.08, 0.7]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      {[[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.3, lz]}>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <meshStandardMaterial color="#5e4426" roughness={1} />
        </mesh>
      ))}
      {/* the deed papers + quill */}
      <mesh position={[-0.15, 0.675, 0]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.55]} />
        <meshStandardMaterial color="#f2ecda" roughness={1} />
      </mesh>
      <mesh position={[0.35, 0.72, 0.1]} rotation={[0, 0, 0.7]}>
        <coneGeometry args={[0.03, 0.3, 5]} />
        <meshStandardMaterial color="#e8e0cc" roughness={1} />
      </mesh>
      <Html position={[0, 1.4, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label small">📜 Estate Deeds</div>
      </Html>
    </group>
  );
}

function InteriorChest({ pos }: { pos: [number, number] }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (!near(pos[0], pos[1])) {
      s.addToast("Walk over to the chest");
      return;
    }
    s.setOpenPanel("chest");
  });
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, Math.PI / 5, 0]} onClick={click} {...hoverCursor()}>
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
      <Html position={[0, 1.3, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label small">📦 Chest</div>
      </Html>
    </group>
  );
}

function Chandelier() {
  return (
    <group position={[0, 2.7, 0]}>
      <mesh>
        <torusGeometry args={[0.55, 0.05, 6, 16]} />
        <meshStandardMaterial color="#9c8454" metalness={0.4} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.14, 5]} />
              <meshStandardMaterial color="#e8e0cc" roughness={1} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <coneGeometry args={[0.03, 0.08, 5]} />
              <meshBasicMaterial color="#ffc23d" />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.1, 4]} />
        <meshStandardMaterial color="#4a3520" roughness={1} />
      </mesh>
      <pointLight position={[0, -0.2, 0]} color="#ffd98a" intensity={1.1} distance={11} decay={2} />
    </group>
  );
}

function ExitDoor({ hd, lv }: { hd: number; lv: number }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(0, hd, 3.2)) s.exitHouse();
    else s.addToast("Walk to the door to leave");
  });
  return (
    <group position={[0, 0, hd]} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 1, -0.04]}>
        <boxGeometry args={[1, 2, 0.1]} />
        <meshStandardMaterial color="#4a3520" roughness={1} />
      </mesh>
      <mesh position={[0.32, 1, -0.12]}>
        <sphereGeometry args={[0.06, 6, 5]} />
        <meshStandardMaterial color="#d9a93f" metalness={0.5} roughness={0.4} />
      </mesh>
      <Html position={[0, 2.5, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label">🚪 Step outside</div>
      </Html>
    </group>
  );
}

export default function Interior() {
  const houseLevel = useGame((s) => s.houseLevel);
  const lv = Math.max(1, Math.min(houseLevel, HOUSE_LEVELS.length));
  const def = HOUSE_LEVELS[lv - 1];
  const { hw, hd } = interiorDims(lv);
  const lay = interiorLayout(lv);
  const wallH = 2.8;
  const stone = lv >= 3;
  const wallColor = lv >= 5 ? "#d8c9a8" : stone ? "#9c9183" : "#8a6a3f";
  const floorColor = lv >= 5 ? "#9c7a4a" : "#8a6a45";

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    moveTarget.x = e.point.x;
    moveTarget.z = e.point.z;
    moveTarget.active = true;
  };

  // wooden plank seams
  const planks: number[] = [];
  for (let x = -hw + 0.8; x < hw - 0.2; x += 0.8) planks.push(x);

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={groundClick}>
        <planeGeometry args={[hw * 2, hd * 2]} />
        <meshStandardMaterial color={floorColor} roughness={1} />
      </mesh>
      {planks.map((x) => (
        <mesh key={x} position={[x, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.03, hd * 2]} />
          <meshStandardMaterial color="#6a4f30" roughness={1} />
        </mesh>
      ))}
      {/* rug */}
      <mesh position={[0.3, 0.01, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2 + lv * 0.12, 18]} />
        <meshStandardMaterial color={lv >= 5 ? "#8a3c5a" : "#a8703a"} roughness={1} />
      </mesh>

      {/* back walls (north + west) — the near sides stay open for the camera */}
      <mesh position={[0, wallH / 2, -hd - 0.1]} receiveShadow>
        <boxGeometry args={[hw * 2 + 0.4, wallH, 0.2]} />
        <meshStandardMaterial color={wallColor} roughness={1} />
      </mesh>
      <mesh position={[-hw - 0.1, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, wallH, hd * 2 + 0.4]} />
        <meshStandardMaterial color={wallColor} roughness={1} />
      </mesh>
      {/* low stub walls on the open sides */}
      <mesh position={[hw + 0.1, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, hd * 2 + 0.4]} />
        <meshStandardMaterial color={wallColor} roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (hw / 2 + 0.55), 0.3, hd + 0.1]}>
          <boxGeometry args={[hw - 1.1, 0.6, 0.2]} />
          <meshStandardMaterial color={wallColor} roughness={1} />
        </mesh>
      ))}

      {/* windows on the north wall, glowing with the day outside */}
      {[-hw * 0.5, hw * 0.5].map((x) => (
        <mesh key={x} position={[x, 1.6, -hd + 0.01]}>
          <boxGeometry args={[0.9, 0.8, 0.06]} />
          <meshStandardMaterial
            color="#cfe6f0"
            emissive={isNight() ? "#1c2c3a" : "#b8d8e8"}
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}

      {/* furniture */}
      <Bed pos={lay.bed} lv={lv} />
      {lay.table && <Table pos={lay.table} />}
      {lay.fireplace && <Fireplace pos={lay.fireplace} />}
      {lay.shelf && <Bookshelf pos={lay.shelf} />}
      <Desk pos={lay.desk} />
      <InteriorChest pos={lay.chest} />
      {lv >= 5 && <Chandelier />}
      <ExitDoor hd={hd} lv={lv} />

      {/* a warm hearth-glow so the room reads cosy even at night */}
      <ambientLight intensity={0.45} color="#ffe2b8" />
      <pointLight position={[0, 2.4, 0]} color="#ffd9a8" intensity={lv >= 5 ? 0.4 : 0.8} distance={14} decay={2} />

      <Html position={[0, wallH + 1, -hd]} center distanceFactor={22} zIndexRange={[8, 0]}>
        <div className="world-label">{def.icon} Inside the {def.name}</div>
      </Html>
    </group>
  );
}
