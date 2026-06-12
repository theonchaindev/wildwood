"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";

/** Floating damage number that shows for a moment after each hit (re-keyed by `at`). */
export default function HitPop({
  at, text, crit = false, position,
}: { at: number; text: string; crit?: boolean; position: [number, number, number] }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 800);
    return () => clearTimeout(t);
  }, [at]);
  if (!show) return null;
  return (
    <Html position={position} center distanceFactor={24} zIndexRange={[18, 0]}>
      <div className={`dmg-pop ${crit ? "crit" : ""}`} key={at}>{text}</div>
    </Html>
  );
}
