"use client";

// Gentle generative ambience — no audio files, and nothing loud.
// Day: soft warm pad, occasional birdsong and plucked notes.
// Night: sparse cricket chirps, slightly darker pad.
// Blood moon: a quiet low drone underneath.

import { daylight, isBloodMoonNight } from "./runtime";
import { sfx } from "./sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padGains: GainNode[] = [];
let padOscs: OscillatorNode[] = [];
let droneGain: GainNode | null = null;
let started = false;
const timers: ReturnType<typeof setInterval>[] = [];

// soft folk chords, voiced low
const CHORDS = [
  [220, 261.6, 329.6],
  [174.6, 220, 261.6],
  [196, 261.6, 329.6],
  [196, 246.9, 293.7],
];
const PENTATONIC = [392, 440, 523.3, 587.3, 659.3];

function ac() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new AC();
  }
  return ctx!;
}

function buildPad() {
  const a = ac();
  // gentle lowpass so the pad sits in the background
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.connect(master!);
  for (let i = 0; i < 3; i++) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "sine";
    gain.gain.value = 0;
    osc.connect(gain).connect(filter);
    osc.start();
    padOscs.push(osc);
    padGains.push(gain);
  }
}

function setChord(freqs: number[], level: number) {
  const a = ac();
  freqs.forEach((f, i) => {
    if (!padOscs[i]) return;
    padOscs[i].frequency.linearRampToValueAtTime(f, a.currentTime + 6);
    padGains[i].gain.linearRampToValueAtTime(level / (i + 1.6), a.currentTime + 6);
  });
}

function buildDrone() {
  const a = ac();
  droneGain = a.createGain();
  droneGain.gain.value = 0;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 160;
  for (const f of [55, 55.6]) {
    const osc = a.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(droneGain);
    osc.start();
  }
  droneGain.connect(filter).connect(master!);
}

/** One short, soft envelope-shaped tone. */
function note(freq: number, dur: number, vol: number, type: OscillatorType = "sine", delay = 0) {
  if (sfx.muted || !master) return;
  const a = ac();
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function birdChirp() {
  const base = 2300 + Math.random() * 800;
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    note(base + Math.random() * 300, 0.12, 0.012, "sine", i * 0.16);
  }
}

function cricketChirp() {
  for (let i = 0; i < 3; i++) {
    note(4100 + Math.random() * 200, 0.05, 0.006, "sine", i * 0.09);
  }
}

function pluck() {
  note(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], 1.4, 0.02, "triangle");
}

export const ambience = {
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    const a = ac();
    if (a.state === "suspended") a.resume();
    master = a.createGain();
    master.gain.value = sfx.muted ? 0 : 0.7;
    master.connect(a.destination);

    buildPad();
    buildDrone();

    let chordIdx = 0;
    setChord(CHORDS[0], 0.018);

    // slow chord changes
    timers.push(
      setInterval(() => {
        chordIdx = (chordIdx + 1) % CHORDS.length;
        setChord(CHORDS[chordIdx], 0.014 + daylight() * 0.008);
      }, 26_000)
    );

    // sparse wildlife + melody
    timers.push(
      setInterval(() => {
        if (sfx.muted) return;
        const d = daylight();
        if (d > 0.5) {
          if (Math.random() < 0.5) birdChirp();
          if (Math.random() < 0.3) pluck();
        } else if (d < 0.25) {
          if (Math.random() < 0.65) cricketChirp();
        }
      }, 6_000)
    );

    // mute + blood moon drone
    timers.push(
      setInterval(() => {
        if (!master) return;
        const a2 = ac();
        master.gain.linearRampToValueAtTime(sfx.muted ? 0 : 0.7, a2.currentTime + 0.4);
        droneGain?.gain.linearRampToValueAtTime(isBloodMoonNight() ? 0.025 : 0, a2.currentTime + 4);
      }, 1_500)
    );
  },
};
