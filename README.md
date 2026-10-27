# Morse Unit Transmitter

A Morse code generator built on the **time unit**, the building block of Morse code. Every character is turned into a stream of units, where `1` is one unit of tone and `0` is one unit of silence:

| Element | Units | Example |
| --- | --- | --- |
| Dot | `1` | **E** = `1` (one unit of tone) |
| Dash | `111` | **T** = `111` (three units of tone) |
| Gap inside a letter | `0` | **A** = `1` `0` `111` → `10111` |
| Gap between letters | `000` | **EE** = `1000` `1` |
| Gap between words | `0000000` | **E E** = `1` `0000000` `1` |

Timing follows the ITU standard (Recommendation ITU-R M.1677-1). Speed uses the PARIS standard word, which is exactly 50 units long, so one unit lasts `1200 ÷ words per minute` milliseconds (60 ms at 20 wpm).

## What's included

```
index.html            Web transmitter: type a message, press Transmit, hear and watch it
src/morse.js          The encoder (no dependencies; browser and Node)
cli/morse.mjs         Command-line transmitter that prints the unit stream and writes WAV audio
test/morse.test.mjs   Tests for the timing rules and round trips
.github/workflows/    Runs the tests and publishes the web page to GitHub Pages
```

## Use the web transmitter

Open `index.html` through any local web server (browsers block ES modules from `file://`):

```bash
npx serve .            # or: python3 -m http.server
```

Then type words, numbers or both and press **Transmit**. The page plays the tone, lights a signal lamp in time with it, and steps a cursor along a paper-tape view of the units. Speed (5–40 wpm) and tone (400–1000 Hz) are adjustable. Type prosigns in angle brackets, such as `<SOS>`, to send them as one unbroken character.

## Use the command line

Requires Node 18 or later.

```bash
node cli/morse.mjs "E T"
# Morse    ·  /  −
# Units    10000000111

node cli/morse.mjs "SOS 123" --wav sos.wav            # write audio
node cli/morse.mjs "PARIS" --wpm 15 --freq 700 --wav paris.wav
node cli/morse.mjs --decode 1010100011101110111000101010   # → SOS
```

## Use the encoder in your own code

```js
import { toUnits, toSymbols, unitMs, renderPcm, toWav, decodeUnits } from "./src/morse.js";

toUnits("E");        // "1"
toUnits("T");        // "111"
toUnits("SOS");      // "101010001110111011100010101"
toUnits("<SOS>");    // "10101011101110111010101" (unbroken)
toSymbols("CALL 911"); // "−·−· ·− ·−·· ·−··  /  −−−−· ·−−−− ·−−−−"
unitMs(20);          // 60
decodeUnits(toUnits("PRICE 458.00")); // "PRICE 458.00"
```

`renderPcm(units, { wpm, freq })` returns 16-bit samples with 5 ms soft edges, and `toWav(pcm)` wraps them as a WAV file.

## Run the tests

```bash
npm test
```

The tests check that E is one unit and T is three, that a dash takes the same time as two dots sent together, the 1-3-7 gap rule, that PARIS plus a word gap is exactly 50 units, and that every character round-trips through encode and decode.

## Publish on GitHub Pages

1. Create a new repository on GitHub and push these files to the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow runs the tests and deploys the page on every push. The site appears at `https://<your-user>.github.io/<repository>/`.

## Supported characters

Letters A–Z, digits 0–9, the punctuation `. , ? ' ! / ( ) & : ; = + - _ " $ @`, and the prosigns `<SOS> <AR> <SK> <BT> <KN> <AS>`. Characters with no Morse code are skipped and listed.
