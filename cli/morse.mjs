#!/usr/bin/env node
// Command-line transmitter: prints the Morse symbols and unit stream, and writes a WAV file.
//
//   node cli/morse.mjs "SOS 123"                     # print symbols and units
//   node cli/morse.mjs "CALL 911" --wav call.wav     # also write audio
//   node cli/morse.mjs "PARIS" --wpm 15 --freq 700 --wav paris.wav
//   node cli/morse.mjs --decode 1010100011101110111000101010   # units back to text: SOS

import { writeFileSync } from "node:fs";
import { encode, toUnits, toSymbols, unitMs, renderPcm, toWav, decodeUnits } from "../src/morse.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const decode = opt("decode", null);
if (decode !== null) {
  console.log(decodeUnits(decode));
  process.exit(0);
}

const wpm = Number(opt("wpm", 20));
const freq = Number(opt("freq", 600));
const wav = opt("wav", null);
const text = args.join(" ").trim();

if (!text) {
  console.error('Enter text to send, for example: node cli/morse.mjs "SOS 123"');
  process.exit(1);
}
if (!(wpm > 0 && wpm <= 60)) {
  console.error("Choose a speed from 1 to 60 words per minute with --wpm.");
  process.exit(1);
}

const { unknown } = encode(text);
const units = toUnits(text);
if (!units) {
  console.error("None of these characters exist in Morse code.");
  process.exit(1);
}
const ms = unitMs(wpm);

console.log(`Text     ${text.toUpperCase()}`);
console.log(`Morse    ${toSymbols(text)}`);
console.log(`Units    ${units}`);
console.log(`Length   ${units.length} units = ${((units.length * ms) / 1000).toFixed(2)} s at ${wpm} wpm (1 unit = ${ms.toFixed(0)} ms)`);
if (unknown.length) console.log(`Skipped  ${unknown.join(" ")} (no Morse code)`);

if (wav) {
  writeFileSync(wav, toWav(renderPcm(units, { wpm, freq }), 44100));
  console.log(`Saved    ${wav} (${freq} Hz tone)`);
}
