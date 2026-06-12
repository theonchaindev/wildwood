"use client";

// Inside the player's house — its own instance, like the homestead.
// Furniture comes from the interior asset pack (public/models/furniture),
// textured by its own atlas; the room grows and fills up with house level.

import { useRef } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame, HOUSE_LEVELS, DECOR_ITEMS, DecorPiece } from "@/lib/store";
import { live, moveTarget, isNight } from "@/lib/runtime";
import { interiorDims, interiorLayout } from "@/lib/world";
import { Model } from "@/lib/assets";

const FTEX = "/models/furniture/Textures.png";

type FurnProps = {
  file: string;
  size: number;
  by?: "y" | "xz";
  position: [number, number, number];
  rotationY?: number;
};

/** One piece from the furniture pack. */
function Furn({ file, size, by = "y", position, rotationY = 0 }: FurnProps) {
  return (
    <Model
      file={`furniture/${file}`}
      tex={FTEX}
      size={size}
      by={by}
      position={position}
      rotationY={rotationY}
    />
  );
}

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

function Bed({ pos }: { pos: [number, number] }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (s.visitData) {
      s.addToast("Not your bed! 🛏️");
      return;
    }
    if (!near(pos[0], pos[1])) {
      s.addToast("Walk over to the bed");
      return;
    }
    s.sleepTillDawn();
  });
  return (
    <group position={[pos[0], 0, pos[1]]} onClick={click} {...hoverCursor()}>
      <Furn file="bed_001" size={2.2} by="xz" position={[0, 0, 0]} rotationY={Math.PI} />
      <Html position={[0, 1.5, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label small">🛏️ Bed{isNight() ? " — sleep till dawn" : ""}</div>
      </Html>
    </group>
  );
}

function DiningSet({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <Furn file="kitchen_table_001" size={0.85} position={[0, 0, 0]} />
      <Furn file="kitchen_chair_001" size={0.95} position={[-0.95, 0, 0.25]} rotationY={Math.PI / 2} />
      <Furn file="kitchen_chair_001" size={0.95} position={[0.9, 0, -0.35]} rotationY={-Math.PI / 2 + 0.4} />
      <Furn file="dish_001" size={0.3} by="xz" position={[-0.12, 0.85, 0.1]} />
      <Furn file="drink_001" size={0.22} position={[0.25, 0.85, -0.15]} />
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

function Lounge({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <Furn file="sofa_001" size={2} by="xz" position={[0, 0, 0]} rotationY={Math.PI / 2} />
      <Furn file="coffee_table_001" size={0.5} position={[1.35, 0, 0]} />
      <Furn file="toy_001" size={0.3} position={[1.3, 0, 0.9]} rotationY={0.8} />
    </group>
  );
}

function Kitchen({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <Furn file="fridge_001" size={1.9} position={[-0.75, 0, 0]} />
      <Furn file="kitchen_sink_001" size={0.95} position={[0.55, 0, 0]} />
      <Furn file="coffee_machine_001" size={0.35} position={[1.35, 0.95, 0]} rotationY={-0.4} />
    </group>
  );
}

function Desk({ pos }: { pos: [number, number] }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (s.visitData) {
      s.addToast("Their deeds are private 📜");
      return;
    }
    if (!near(pos[0], pos[1])) {
      s.addToast("Walk over to the desk");
      return;
    }
    s.setOpenPanel("house");
  });
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, -Math.PI / 7, 0]} onClick={click} {...hoverCursor()}>
      <Furn file="office_table_001" size={0.85} position={[0, 0, 0]} />
      {/* the deed papers */}
      <mesh position={[-0.15, 0.88, 0]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.55]} />
        <meshStandardMaterial color="#f2ecda" roughness={1} />
      </mesh>
      <mesh position={[0.3, 0.95, 0.1]} rotation={[0, 0, 0.7]}>
        <coneGeometry args={[0.03, 0.3, 5]} />
        <meshStandardMaterial color="#e8e0cc" roughness={1} />
      </mesh>
      <Html position={[0, 1.5, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label small">📜 Estate Deeds</div>
      </Html>
    </group>
  );
}

function InteriorChest({ pos }: { pos: [number, number] }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (s.visitData) {
      s.addToast("Hands off their valuables! 📦");
      return;
    }
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

function ExitDoor({ hd }: { hd: number }) {
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (near(0, hd, 3.2)) s.exitHouse();
    else s.addToast("Walk to the door to leave");
  });
  return (
    <group position={[0, 0, hd]} onClick={click} {...hoverCursor()}>
      <Furn file="door_001" size={2.1} position={[0, 0, -0.05]} />
      <Html position={[0, 2.5, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div className="world-label">🚪 Step outside</div>
      </Html>
    </group>
  );
}

function DecorMesh({ piece, readOnly }: { piece: DecorPiece; readOnly: boolean }) {
  const def = DECOR_ITEMS[piece.key];
  const removeMode = useGame((s) => s.decorMode === "remove") && !readOnly;
  if (!def) return null;
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (readOnly) return;
    if (s.decorMode === "remove") s.removeDecor(piece.id);
  });
  return (
    <group onClick={removeMode ? click : undefined} {...(removeMode ? hoverCursor() : {})}>
      <Furn
        file={def.file}
        size={def.size}
        by={def.by ?? "y"}
        position={[piece.x, 0, piece.z]}
        rotationY={piece.rot}
      />
    </group>
  );
}

function HouseCat({ lv }: { lv: number }) {
  const owned = useGame((s) => s.cat);
  if (!owned) return null;
  // she claims the warmest spot: by the fire if there is one, else the rug
  const spot: [number, number] = lv >= 3 ? [interiorLayout(lv).fireplace![0] - 1.6, interiorLayout(lv).fireplace![1] + 1] : [1.2, 1.4];
  const click = stopAnd(() => {
    const s = useGame.getState();
    if (s.visitData) return;
    if (near(spot[0], spot[1])) s.petCat();
    else s.addToast("She won't come to you. Cats.");
  });
  return (
    <group position={[spot[0], 0, spot[1]]} rotation={[0, -0.8, 0]} onClick={click} {...hoverCursor()}>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.34]} />
        <meshStandardMaterial color="#5a5048" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0.14]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.16]} />
        <meshStandardMaterial color="#665a50" roughness={1} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.41, 0.14]}>
          <coneGeometry args={[0.035, 0.08, 4]} />
          <meshStandardMaterial color="#5a5048" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.08, -0.2]} rotation={[0, 0.8, 1.2]}>
        <boxGeometry args={[0.04, 0.04, 0.26]} />
        <meshStandardMaterial color="#665a50" roughness={1} />
      </mesh>
      <Html position={[0, 0.8, 0]} center distanceFactor={16} zIndexRange={[9, 0]}>
        <div className="world-label small">🐈 zzz…</div>
      </Html>
    </group>
  );
}

export default function Interior() {
  const ownLevel = useGame((s) => s.houseLevel);
  const visitData = useGame((s) => s.visitData);
  const visiting = !!visitData;
  const ownDecor = useGame((s) => s.interiorDecor);
  const decorMode = useGame((s) => s.decorMode);
  const lv = Math.max(1, Math.min(visiting ? visitData!.houseLevel ?? 1 : ownLevel, HOUSE_LEVELS.length));
  const decor = visiting ? visitData!.interiorDecor ?? [] : ownDecor;
  const def = HOUSE_LEVELS[lv - 1];
  const { hw, hd } = interiorDims(lv);
  const lay = interiorLayout(lv);
  const wallH = 2.8;
  const stone = lv >= 3;
  const wallColor = lv >= 5 ? "#d8c9a8" : stone ? "#9c9183" : "#8a6a3f";
  const floorColor = lv >= 5 ? "#9c7a4a" : "#8a6a45";

  const groundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = useGame.getState();
    if (!visiting && s.decorMode && s.decorMode !== "remove") {
      s.placeDecor(e.point.x, e.point.z);
      return;
    }
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

      {/* furniture from the pack */}
      <Bed pos={lay.bed} />
      {lay.table && <DiningSet pos={lay.table} />}
      {lay.fireplace && <Fireplace pos={lay.fireplace} />}
      {lay.lounge && <Lounge pos={lay.lounge} />}
      {lay.kitchen && <Kitchen pos={lay.kitchen} />}
      {lay.closet && <Furn file="closet_001" size={2} position={[lay.closet[0], 0, lay.closet[1]]} rotationY={Math.PI / 2} />}
      {lay.dresser && <Furn file="dresser_001" size={1.1} position={[lay.dresser[0], 0, lay.dresser[1]]} rotationY={Math.PI / 2} />}
      {lay.games && <Furn file="air_hockey_001" size={2.2} by="xz" position={[lay.games[0], 0, lay.games[1]]} rotationY={0.5} />}
      {lay.music && <Furn file="musical_instrument_001" size={1.4} position={[lay.music[0], 0, lay.music[1]]} rotationY={-Math.PI / 2} />}
      <Desk pos={lay.desk} />
      <InteriorChest pos={lay.chest} />
      {lv >= 5 && <Chandelier />}
      <ExitDoor hd={hd} />
      {!visiting && <HouseCat lv={lv} />}

      {/* player-placed furnishings */}
      {decor.map((piece) => (
        <DecorMesh key={piece.id} piece={piece} readOnly={visiting} />
      ))}

      {/* decor that arrives as the house grows */}
      <group position={[-hw + 0.5, 0, -hd + 0.5]}>
        <Furn file="lamp_001" size={1.5} position={[0, 0, 0]} />
        <pointLight position={[0, 1.5, 0.2]} color="#ffd9a8" intensity={0.7} distance={6} decay={2} />
      </group>
      {lv >= 2 && <Furn file="flower_001" size={0.9} position={[hw - 0.6, 0, hd - 0.55]} />}
      {lv >= 3 && <Furn file="lamp_002" size={0.45} position={[lay.desk[0] + 0.35, 0.88, lay.desk[1] + 0.25]} rotationY={2.4} />}
      {lv >= 4 && <Furn file="box_001" size={0.6} position={[hw - 0.5, 0, hd - 2.6]} rotationY={0.4} />}

      {/* a warm hearth-glow so the room reads cosy even at night */}
      <ambientLight intensity={0.45} color="#ffe2b8" />
      <pointLight position={[0, 2.4, 0]} color="#ffd9a8" intensity={lv >= 5 ? 0.4 : 0.8} distance={14} decay={2} />

      <Html position={[0, wallH + 1, -hd]} center distanceFactor={22} zIndexRange={[8, 0]}>
        <div className="world-label">{def.icon} Inside the {def.name}</div>
      </Html>
    </group>
  );
}
