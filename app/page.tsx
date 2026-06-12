"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <div className="loading-title">WILDWOOD</div>
      <div className="loading-sub">waking the forest…</div>
    </div>
  ),
});

export default function Page() {
  return <Game />;
}
