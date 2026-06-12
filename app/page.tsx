"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wildwood-logo.png" alt="WILDWOOD" className="loading-logo" />
      <div className="loading-sub">waking the forest…</div>
    </div>
  ),
});

export default function Page() {
  return <Game />;
}
