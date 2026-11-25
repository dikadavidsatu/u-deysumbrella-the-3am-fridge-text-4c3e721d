// The 3AM Fridge Text — make.fun bounty
// u-deysumbrella-the-3am-fridge-text-4c3e721d
//
// A smart fridge texts its owner at 3am. The judge reads entries two at a
// time and keeps the funnier one, so the whole entry is one lock-screen line:
// the hour, the fridge keeping count, and a punchline with a fresh angle.
//
// This program:
//   1. Holds the entry line as a constant.
//   2. Validates it against the competition gate before writing anything:
//      /output/entry.txt must be UTF-8 text of 1..140 characters, not only
//      whitespace. On top of that we enforce a stricter shape so the line
//      always reaches the judge clean: exactly one line, no leading or
//      trailing whitespace, no control characters, set at 3am, in the
//      fridge's own first-person voice, and clear of the tired milk / ice /
//      door-left-open angles the judge's brief counts against.
//   3. Writes the line, byte for byte with no trailing newline, to
//      `entry.txt` inside MAKEFUN_OUTPUT_DIR (default `/output`).
//
// Run it:
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
//
// Exit code 0 only when the written file passes every check. Any gate
// failure throws before the file is written, so a bad line can never ship.
// Fully deterministic: the line is a constant — no clock, no randomness,
// no network, no input read.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The entry line
// ---------------------------------------------------------------------------
//
// Three beats in one lock-screen line, in the fridge's own voice:
//
//   "3am." — the hour is the timestamp; the whole premise in four characters.
//   "Third visit tonight." — the fridge keeps count. A machine notices
//     patterns: the owner came back twice already, which is the setup the
//     punchline cashes in.
//   "I'm not judging — I'm a fridge — but the pickles have started a group
//     chat about you." — a small appliance with an opinion and no shame
//     about sharing it at 3am. The punchline is specific (pickles, not
//     milk), surprising (a group chat, inside the fridge), and complete in
//     itself — no follow-up needed, and short enough to screenshot.
//
const LINE =
  "3am. Third visit tonight. I'm not judging — I'm a fridge — but the pickles have started a group chat about you.";

// ---------------------------------------------------------------------------
// The gate (from the competition rules)
// ---------------------------------------------------------------------------

// The sealed scorer accepts 1..140 characters of UTF-8 text that is not only
// whitespace. Anything outside that is listed with Valid 0 and never reaches
// the judge, so the program refuses to write it at all.
const MIN_CHARS = 1;
const MAX_CHARS = 140;

// The file the judge reads.
const OUTPUT_FILENAME = "entry.txt";

// Angles the judge's brief explicitly calls obvious and tired. The line
// must steer clear of all of them.
const TIRED_ANGLES = /\bmilk\b|\bice\b|\bdoor\b/i;

// Characters that would break the "one line of text" shape.
const LINE_BREAK = /[\n\r]/;
const CONTROL_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Count characters the way a reader does: one count per Unicode code point,
// so an astral character counts once, not twice. Our line is plain text
// with two em dashes, so this agrees with .length here — but the check stays
// honest for any future line that is not plain ASCII.
function charCount(text: string): number {
  return [...text].length;
}

// Abort the run with a clear reason. Throwing (rather than logging and
// continuing) guarantees a failed gate never produces an output file.
function fail(reason: string): never {
  throw new Error(`entry rejected: ${reason}`);
}

// Each check returns the name of the check it passed, so the run report can
// list exactly what was verified.
function checkLength(text: string): string {
  const n = charCount(text);
  if (n < MIN_CHARS || n > MAX_CHARS) {
    fail(`length ${n} characters is outside ${MIN_CHARS}..${MAX_CHARS}`);
  }
  return `length ${n}/${MAX_CHARS}`;
}

function checkNotBlank(text: string): string {
  if (text.trim().length === 0) {
    fail("entry is only whitespace");
  }
  return "not blank";
}

function checkSingleLine(text: string): string {
  if (LINE_BREAK.test(text)) {
    fail("entry must be a single line (no line breaks)");
  }
  return "single line";
}

function checkNoEdgeWhitespace(text: string): string {
  if (text !== text.trim()) {
    fail("entry must not start or end with whitespace");
  }
  return "no edge whitespace";
}

function checkNoControlChars(text: string): string {
  if (CONTROL_CHAR.test(text)) {
    fail("entry contains a control character");
  }
  return "no control characters";
}

// The line has to be a fridge text at 3am, not just a funny sentence: it
// must name the hour, speak as the fridge itself (first person), and avoid
// the three angles the judge's brief calls obvious — milk, ice, a door left
// open.
function checkFridgeText(text: string): string {
  if (!/\b3\s?am\b/i.test(text)) {
    fail('entry must be set at 3am (must say "3am")');
  }
  if (!/\bI\b/.test(text) && !/\bI'm\b/.test(text)) {
    fail("entry must be the fridge's own text (first person)");
  }
  if (TIRED_ANGLES.test(text)) {
    fail("entry uses a tired angle (milk, ice, or a door left open)");
  }
  return "a 3am fridge text, fresh angle";
}

// Run every check in order and return the list of checks that passed.
function validateEntry(text: string): string[] {
  if (typeof text !== "string") {
    fail("entry must be a string");
  }
  return [
    checkLength(text),
    checkNotBlank(text),
    checkSingleLine(text),
    checkNoEdgeWhitespace(text),
    checkNoControlChars(text),
    checkFridgeText(text),
  ];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

// Resolve the output directory: the harness sets MAKEFUN_OUTPUT_DIR, and
// /output is the documented default for a local run.
function resolveOutputDir(): string {
  const dir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  if (dir.trim().length === 0) {
    fail("MAKEFUN_OUTPUT_DIR is empty");
  }
  return dir;
}

// Write the line exactly as validated: UTF-8, no trailing newline, so the
// file's contents are the line and nothing else.
function writeEntry(outDir: string, text: string): string {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, OUTPUT_FILENAME);
  writeFileSync(path, text, "utf8");
  return path;
}

// Read the file back, decode it strictly as UTF-8, and confirm it is byte
// for byte the validated line — then validate the decoded text once more,
// so the run proves the exact bytes the judge will read.
function verifyWrittenFile(path: string, expected: string): void {
  const raw = readFileSync(path);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  if (decoded !== expected) {
    fail(`written file differs from the validated line (${path})`);
  }
  validateEntry(decoded);
}

// Print a short human-readable summary of what was written and verified.
function report(text: string, checks: string[], outPath: string): void {
  const bytes = Buffer.byteLength(text, "utf8");
  console.log(`entry (${charCount(text)} chars, ${bytes} bytes): ${text}`);
  console.log(`gate checks passed: ${checks.join("; ")}`);
  console.log(`wrote ${outPath} (verified byte-for-byte on read-back)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const checks = validateEntry(LINE);
  const outDir = resolveOutputDir();
  const outPath = writeEntry(outDir, LINE);
  verifyWrittenFile(outPath, LINE);
  report(LINE, checks, outPath);
}

main();
