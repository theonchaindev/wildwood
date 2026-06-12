"use client";

// Generative ambience + music, all synthesised — no audio files.
// Day: warm pad, birdsong, occasional plucked melody.
// Night: crickets, darker pad. Blood moon: a low menacing drone.

import { daylight, isBloodMoonNight } from "./runtime";
import { sfx } from "./sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padGains: GainNode[] = [];
let padOscs: OscillatorNode[] = [];
let windGain: GainNode | null = null;
let cricketGain: GainNode | null = null;
let droneGain: GainNode | null = null;
let started = false;
let timers: ReturnType<typeof setInterval>[] = [];

// gentle folk chords (Am, F, C, G voiced low)
const CHORDS = [
  [220, 261.6, 329.6],
  [174.6, 220, 261.6],
  [196, 261.6, 329.6],
  [196, 246.9, 293.7],
];
const PENTATONIC = [392, 440, 523.3, 587.3, 659.3, 784];

function ac() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new AC();
  }
  return ctx!;
}

function buildPad() {
  const a = ac();
  padOscs = [];
  padGains = [];
  for (let i = 0; i < 3; i++) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "sine";
    gain.gain.value = 0;
    osc.connect(gain).connect(master!);
    osc.start();
    padOscs.push(osc);
    padGains.push(gain);
  }
}

function setChord(freqs: number[], level: number) {
  const a = ac();
  freqs.forEach((f, i) => {
    if (!padOscs[i]) return;
    padOscs[i].frequency.linearRampToValueAtTime(f, a.currentTime + 4);
    padGains[i].gain.linearRampToValueAtTime(level / (i + 1.4), a.currentTime + 4);
  });
}

function buildWind() {
  const a = ac();
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  windGain = a.createGain();
  windGain.gain.value = 0.018;
  src.connect(filter).connect(windGain).connect(master!);
  src.start();
}

function buildCrickets() {
  const a = ac();
  const osc = a.createOscillator();
  osc.type = "square";
  osc.frequency.value = 4200;
  const chirpLfo = a.createOscillator();
  chirpLfo.type = "square";
  chirpLfo.frequency.value = 13;
  const lfoGain = a.createGain();
  lfoGain.gain.value = 0.006;
  cricketGain = a.createGain();
  cricketGain.gain.value = 0;
  chirpLfo.connect(lfoGain).connect(cricketGain.gain);
  osc.connect(cricketGain).connect(master!);
  osc.start();
  chirpLfo.start();
}

function buildDrone() {
  const a = ac();
  droneGain = a.createGain();
  droneGain.gain.value = 0;
  for (const f of [55, 58.3]) {
    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    const g = a.createGain();
    g.gain.value = 0.5;
    osc.connect(g).connect(droneGain);
    osc.start();
  }
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220;
  droneGain.connect(filter).connect(master!);
}

function birdChirp() {
  const a = ac();
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  const base = 2400 + Math.random() * 900;
  osc.frequency.setValueAtTime(base, t0);
  for (let i = 0; i < 3; i++) {
    osc.frequency.linearRampToValueAtTime(base + 500 + Math.random() * 300, t0 + i * 0.12 + 0.06);
    osc.frequency.linearRampToValueAtTime(base, t0 + i * 0.12 + 0.12);
  }
  gain.gain.setValueAtTime(0.025, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  osc.connect(gain).connect(master!);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

function pluck() {
  const a = ac();
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "triangle";
  osc.frequency.value = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
  gain.gain.setValueAtTime(0.045, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  osc.connect(gain).connect(master!);
  osc.start(t0);
  osc.stop(t0 + 1.5);
}

export const ambience = {
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    const a = ac();
    if (a.state === "suspended") a.resume();
    master = a.createGain();
    master.gain.value = sfx.muted ? 0 : 1;
    master.connect(a.destination);

    buildPad();
    buildWind();
    buildCrickets();
    buildDrone();

    let chordIdx = 0;
    setChord(CHORDS[0], 0.05);

    timers.push(
      setInterval(() => {
        chordIdx = (chordIdx + 1) % CHORDS.length;
        const night = 1 - daylight();
        setChord(CHORDS[chordIdx], 0.035 + (1 - night) * 0.02);
      }, 22_000)
    );

    timers.push(
      setInterval(() => {
        if (sfx.muted) return;
        const d = daylight();
        if (d > 0.5 && Math.random() < 0.7) birdChirp();
        if (d > 0.4 && Math.random() < 0.45) pluck();
      }, 7_000)
    );

    // crossfade day/night/blood-moon layers
    timers.push(
      setInterval(() => {
        if (!master) return;
        const a2 = ac();
        master.gain.linearRampToValueAtTime(sfx.muted ? 0 : 1, a2.currentTime + 0.5);
        const night = 1 - daylight();
        cricketGain?.gain.linearRampToValueAtTime(night > 0.7 ? 0.5 : 0, a2.currentTime + 2);
        droneGain?.gain.linearRampToValueAtTime(isBloodMoonNight() ? 0.06 : 0, a2.currentTime + 3);
        windGain?.gain.linearRampToValueAtTime(0.012 + night * 0.012, a2.currentTime + 2);
      }, 2_000)
    );
  },
};
