import { test } from "node:test";
import assert from "node:assert/strict";
import { toUnits, toSymbols, encode, unitMs, decodeUnits, runs, renderPcm, toWav, CODE } from "../src/morse.js";

test("E is one unit of tone, T is three", () => {
  assert.equal(toUnits("E"), "1");
  assert.equal(toUnits("T"), "111");
});

test("a dash takes the same time as two dots sent together", () => {
  assert.equal(toUnits("I").length, toUnits("T").length); // 101 vs 111
});

test("letters, words and gaps follow the 1-3-7 rule", () => {
  assert.equal(toUnits("A"), "10111");
  assert.equal(toUnits("EE"), "1" + "000" + "1");
  assert.equal(toUnits("E E"), "1" + "0000000" + "1");
});

test("PARIS plus one word gap is exactly 50 units", () => {
  assert.equal(toUnits("PARIS").length + 7, 50);
});

test("20 words per minute gives a 60 ms unit", () => {
  assert.equal(unitMs(20), 60);
  assert.throws(() => unitMs(0));
});

test("prosign <SOS> is sent unbroken; SOS as letters has gaps", () => {
  assert.equal(toUnits("<SOS>"), "10101011101110111010101");
  assert.equal(toUnits("SOS"), "10101" + "000" + "11101110111" + "000" + "10101");
});

test("numbers and mixed text encode and decode round trip", () => {
  for (const t of ["SOS", "CALL 911", "PRICE 458.00", "WHAT HATH GOD WROUGHT?", "<SOS>"]) {
    assert.equal(decodeUnits(toUnits(t)), t);
  }
});

test("every character in the table round trips", () => {
  for (const ch of Object.keys(CODE)) assert.equal(decodeUnits(toUnits(ch)), ch);
});

test("unknown characters are reported, not sent", () => {
  const r = encode("café #1");
  assert.deepEqual(r.unknown.sort(), ["#", "É"].sort());
  assert.equal(toUnits("#"), "");
});

test("symbols view separates words with a slash", () => {
  assert.equal(toSymbols("ET TE"), "· −  /  − ·");
});

test("runs and audio rendering line up with the unit stream", () => {
  assert.deepEqual(runs("10111").map((r) => [r.on, r.units]), [[true, 1], [false, 1], [true, 3]]);
  const pcm = renderPcm("111", { wpm: 20, sampleRate: 8000 });
  assert.equal(pcm.length, 4 * 480); // 3 units of tone + 1 unit tail, 480 samples per 60 ms unit
  const wav = toWav(pcm, 8000);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
});
