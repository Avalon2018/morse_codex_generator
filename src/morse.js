// morse.js — International Morse code (ITU-R M.1677-1) built on the time unit.
//
// The building block is the unit: one dot-length slot that is either
// tone (1) or silence (0). Everything else is a whole number of units:
//
//   dot                 1        (E = "1")
//   dash                111      (T = "111", three units of tone)
//   gap inside a letter 0
//   gap between letters 000
//   gap between words   0000000
//
// Works in browsers and in Node (ES module, no dependencies).

export const CODE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....",
  "6": "-....", "7": "--...", "8": "---..", "9": "----.", "0": "-----",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
});

// Procedural signals, typed as <SOS>, <AR>, <SK>, <BT>: sent as one unbroken
// character with no letter gaps inside.
export const PROSIGNS = Object.freeze({
  SOS: "...---...", AR: ".-.-.", SK: "...-.-", BT: "-...-", KN: "-.--.", AS: ".-...",
});

export const UNIT = Object.freeze({ DOT: "1", DASH: "111", SYMBOL_GAP: "0", LETTER_GAP: "000", WORD_GAP: "0000000" });

const REVERSE = Object.freeze({
  ...Object.fromEntries(Object.entries(PROSIGNS).map(([k, v]) => [v, `<${k}>`])),
  ...Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])),
});

/** Split text into words of characters. Prosigns like <SOS> become one character. */
export function encode(text) {
  const words = [];
  const unknown = [];
  for (const raw of String(text).toUpperCase().trim().split(/\s+/)) {
    if (!raw) continue;
    const chars = [];
    const re = /<([A-Z]+)>|./g;
    let m;
    while ((m = re.exec(raw))) {
      if (m[1] !== undefined) {
        if (PROSIGNS[m[1]]) chars.push({ char: `<${m[1]}>`, code: PROSIGNS[m[1]] });
        else unknown.push(m[0]);
      } else if (CODE[m[0]]) chars.push({ char: m[0], code: CODE[m[0]] });
      else unknown.push(m[0]);
    }
    if (chars.length) words.push(chars);
  }
  return { words, unknown: [...new Set(unknown)] };
}

/** One character's code (".-") as units ("10111"). */
export function codeToUnits(code) {
  return [...code].map((s) => (s === "." ? UNIT.DOT : UNIT.DASH)).join(UNIT.SYMBOL_GAP);
}

/** Text as a stream of units: "1" = tone, "0" = silence. No trailing gap. */
export function toUnits(text) {
  return encode(text).words
    .map((w) => w.map((c) => codeToUnits(c.code)).join(UNIT.LETTER_GAP))
    .join(UNIT.WORD_GAP);
}

/** Text as readable symbols: "··· −−− ···  /  ..." */
export function toSymbols(text, { dot = "·", dash = "−" } = {}) {
  return encode(text).words
    .map((w) => w.map((c) => c.code.replace(/\./g, dot).replace(/-/g, dash)).join(" "))
    .join("  /  ");
}

/** Length of one unit in milliseconds at a given speed (PARIS standard: 50 units per word). */
export function unitMs(wpm) {
  if (!(wpm > 0)) throw new RangeError("Speed must be greater than 0 words per minute.");
  return 1200 / wpm;
}

/** Group a unit stream into runs: [{ on: true, units: 3, start: 0 }, ...]. */
export function runs(units) {
  const out = [];
  let i = 0;
  while (i < units.length) {
    let j = i;
    while (j < units.length && units[j] === units[i]) j++;
    out.push({ on: units[i] === "1", units: j - i, start: i });
    i = j;
  }
  return out;
}

/** Decode a unit stream back to text (tolerates any run of 0s ≥ 7 as a word gap). */
export function decodeUnits(units) {
  return String(units).replace(/^0+|0+$/g, "").split(/0{7,}/).map((word) =>
    word.split(/0{3,6}/).map((letter) => {
      const code = letter.split("0").filter(Boolean).map((r) => (r.length >= 3 ? "-" : ".")).join("");
      return REVERSE[code] ?? "?";
    }).join("")
  ).join(" ");
}

/** Render a unit stream as 16-bit mono PCM samples (Int16Array) with soft edges to avoid clicks. */
export function renderPcm(units, { wpm = 20, freq = 600, sampleRate = 44100, volume = 0.6, rampMs = 5 } = {}) {
  const perUnit = Math.round((unitMs(wpm) / 1000) * sampleRate);
  const ramp = Math.max(1, Math.round((rampMs / 1000) * sampleRate));
  const pcm = new Int16Array(units.length * perUnit + perUnit); // one unit of trailing silence
  for (const run of runs(units)) {
    if (!run.on) continue;
    const start = run.start * perUnit, len = run.units * perUnit;
    for (let n = 0; n < len; n++) {
      const env = Math.min(1, n / ramp, (len - n) / ramp);
      pcm[start + n] = Math.round(Math.sin((2 * Math.PI * freq * (start + n)) / sampleRate) * env * volume * 32767);
    }
  }
  return pcm;
}

/** Wrap PCM samples in a WAV file (Uint8Array). */
export function toWav(pcm, sampleRate = 44100) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return new Uint8Array(buf);
}
