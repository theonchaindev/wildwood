// Tiny WebAudio synth for UI/game feedback — no audio assets needed.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {}
) {
  if (sfx.muted) return;
  const a = ac();
  if (!a) return;
  const { type = "sine", vol = 0.12, slide, delay = 0 } = opts;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function thud(freq: number, dur: number, vol = 0.25, delay = 0) {
  if (sfx.muted) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  // filtered noise burst
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  muted: false,

  unlock() {
    const a = ac();
    if (a?.state === "suspended") a.resume();
  },

  chop() {
    thud(900, 0.09, 0.3);
    tone(180, 0.07, { type: "square", vol: 0.05, slide: 120 });
  },
  treeFall() {
    thud(300, 0.5, 0.35);
    tone(140, 0.5, { type: "sawtooth", vol: 0.05, slide: 60 });
  },
  pickup() {
    tone(660, 0.1, { type: "sine", vol: 0.1 });
    tone(990, 0.14, { type: "sine", vol: 0.1, delay: 0.07 });
  },
  coin() {
    tone(880, 0.08, { type: "triangle", vol: 0.12 });
    tone(1320, 0.18, { type: "triangle", vol: 0.12, delay: 0.06 });
  },
  buy() {
    tone(520, 0.1, { type: "triangle", vol: 0.12 });
    tone(660, 0.1, { type: "triangle", vol: 0.12, delay: 0.08 });
    tone(880, 0.2, { type: "triangle", vol: 0.12, delay: 0.16 });
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.22, { type: "triangle", vol: 0.12, delay: i * 0.1 })
    );
  },
  questDone() {
    [659, 880].forEach((f, i) =>
      tone(f, 0.25, { type: "sine", vol: 0.12, delay: i * 0.12 })
    );
  },
  ui() {
    tone(440, 0.06, { type: "sine", vol: 0.06 });
  },
  hit() {
    thud(600, 0.08, 0.3);
    tone(220, 0.08, { type: "square", vol: 0.06, slide: 150 });
  },
  crit() {
    thud(900, 0.1, 0.35);
    tone(660, 0.12, { type: "square", vol: 0.08, slide: 330 });
    tone(990, 0.16, { type: "triangle", vol: 0.1, delay: 0.05 });
  },
  groan() {
    tone(110, 0.7, { type: "sawtooth", vol: 0.05, slide: 70 });
    tone(165, 0.6, { type: "sine", vol: 0.04, slide: 95 });
  },
  playerHurt() {
    tone(300, 0.15, { type: "square", vol: 0.09, slide: 160 });
  },
  bark() {
    tone(420, 0.07, { type: "square", vol: 0.08, slide: 240 });
    tone(380, 0.09, { type: "square", vol: 0.07, slide: 200, delay: 0.09 });
  },
  splash() {
    thud(1800, 0.25, 0.2);
    tone(500, 0.18, { type: "sine", vol: 0.06, slide: 900 });
  },
  error() {
    tone(180, 0.18, { type: "square", vol: 0.06 });
  },
};
