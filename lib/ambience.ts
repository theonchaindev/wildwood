"use client";

// Real music: a hand-composed folk loop (melody + bass + arpeggio + soft
// percussion) sequenced through WebAudio, plus light wildlife ambience.
// Day: the full tune. Night: a sparser, slower variation with crickets.
// Blood moon: music stops, a low drone takes over.

import { daylight, isBloodMoonNight } from "./runtime";
import { sfx } from "./sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let delaySend: GainNode | null = null;
let droneGain: GainNode | null = null;
let started = false;
const timers: ReturnType<typeof setInterval>[] = [];

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---- the tune: 8 bars of A-minor folk, eighth notes (0 = rest) ----
// chords: Am | F | C | G  ×2
const MELODY = [
  69, 0, 72, 0, 76, 0, 74, 72,
  69, 0, 65, 67, 69, 0, 0, 0,
  72, 0, 74, 76, 79, 0, 76, 74,
  67, 0, 64, 67, 71, 0, 67, 0,
  69, 0, 72, 0, 76, 0, 79, 76,
  77, 76, 74, 72, 69, 0, 0, 0,
  72, 0, 71, 72, 74, 0, 72, 71,
  69, 0, 0, 0, 69, 0, 0, 0,
];
const BASS_ROOTS = [45, 41, 48, 43, 45, 41, 48, 43]; // per bar
const CHORD_TONES: number[][] = [
  [57, 60, 64], [53, 57, 60], [48, 52, 55].map((n) => n + 12), [55, 59, 62],
  [57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62],
];

const STEP_S = 60 / 84 / 2; // 84 bpm, eighth notes

function ac() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new AC();
  }
  return ctx!;
}

function buildBuses() {
  const a = ac();
  master = a.createGain();
  master.gain.value = sfx.muted ? 0 : 0.8;
  master.connect(a.destination);

  musicBus = a.createGain();
  musicBus.gain.value = 0.9;
  musicBus.connect(master);

  // a touch of echo so the melody has space
  const delay = a.createDelay(1);
  delay.delayTime.value = STEP_S * 3;
  const feedback = a.createGain();
  feedback.gain.value = 0.25;
  const delayWet = a.createGain();
  delayWet.gain.value = 0.35;
  delaySend = a.createGain();
  delaySend.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayWet).connect(master);
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

function voice(
  freq: number, t0: number, dur: number, vol: number,
  type: OscillatorType, echo = 0
) {
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(musicBus!);
  if (echo > 0 && delaySend) {
    const send = a.createGain();
    send.gain.value = echo;
    gain.connect(send).connect(delaySend);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function tick(t0: number) {
  const a = ac();
  const len = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 6000;
  const gain = a.createGain();
  gain.gain.value = 0.012;
  src.connect(filter).connect(gain).connect(musicBus!);
  src.start(t0);
}

// ---- sequencer with lookahead scheduling ----
let songPos = 0;
let nextNoteTime = 0;

function scheduleSong() {
  if (!musicBus) return;
  const a = ac();
  if (nextNoteTime === 0) nextNoteTime = a.currentTime + 0.1;

  const d = daylight();
  const blood = isBloodMoonNight();
  const night = d < 0.3;
  const step = night ? STEP_S * 1.25 : STEP_S; // night plays slower

  while (nextNoteTime < a.currentTime + 0.45) {
    const i = songPos % MELODY.length;
    const bar = Math.floor(i / 8);
    const beat = i % 8;
    const t = nextNoteTime;

    if (!blood && !sfx.muted) {
      // melody — full by day, sparse and softer at night
      const note = MELODY[i];
      if (note > 0 && (!night || beat % 4 === 0)) {
        voice(midi(note), t, step * 2.6, night ? 0.028 : 0.045, "triangle", 0.5);
      }
      // bass root on beats 1 and 3
      if (beat === 0 || beat === 4) {
        voice(midi(BASS_ROOTS[bar]), t, step * 3.5, 0.05, "sine");
      }
      // soft arpeggio fills on the off-beats (day only)
      if (!night && (beat === 2 || beat === 6)) {
        const tones = CHORD_TONES[bar];
        voice(midi(tones[(Math.floor(i / 2) % tones.length)]), t, step * 1.8, 0.016, "sine");
      }
      // whispered hat on beats 2 & 4 (day only)
      if (!night && (beat === 2 || beat === 6)) tick(t);
    }

    nextNoteTime += step;
    songPos++;
  }
}

// ---- wildlife ----
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
    note(base + Math.random() * 300, 0.12, 0.01, "sine", i * 0.16);
  }
}

function cricketChirp() {
  for (let i = 0; i < 3; i++) {
    note(4100 + Math.random() * 200, 0.05, 0.005, "sine", i * 0.09);
  }
}

export const ambience = {
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    const a = ac();
    if (a.state === "suspended") a.resume();
    buildBuses();
    buildDrone();

    // music sequencer (lookahead so timing is solid)
    timers.push(setInterval(scheduleSong, 150));

    // wildlife
    timers.push(
      setInterval(() => {
        if (sfx.muted) return;
        const d = daylight();
        if (d > 0.5 && Math.random() < 0.4) birdChirp();
        if (d < 0.25 && Math.random() < 0.6) cricketChirp();
      }, 7_000)
    );

    // mute + blood moon drone fades
    timers.push(
      setInterval(() => {
        if (!master) return;
        const a2 = ac();
        master.gain.linearRampToValueAtTime(sfx.muted ? 0 : 0.8, a2.currentTime + 0.4);
        droneGain?.gain.linearRampToValueAtTime(isBloodMoonNight() ? 0.03 : 0, a2.currentTime + 4);
      }, 1_500)
    );
  },
};
