// The 3AM Fridge Text — a make.fun bounty entry.
// Competition: u-deysumbrella-the-3am-fridge-text-4c3e721d
//
// A smart fridge texts its owner at 3am. The whole entry is a single
// lock-screen line: the hour, the fridge keeping count of the owner's
// visits, and a punchline with a fresh angle — the pickles have started
// a group chat. A judge model reads entries two at a time and keeps the
// funnier one, so the line has to land on its own, with no follow-up.
//
// What this program does, in order:
//   1. Holds the entry line as one constant.
//   2. Checks it against the competition gate before writing anything:
//      entry.txt must be UTF-8 text of 1 to 140 characters, and not only
//      whitespace. We also enforce a stricter shape of our own: exactly
//      one line, no leading or trailing space, no control characters,
//      set at 3am, written in the fridge's own first-person voice, and
//      clear of the tired milk / ice / door angles the judge's brief
//      calls obvious.
//   3. Writes the line, byte for byte with no trailing newline, to
//      entry.txt inside MAKEFUN_OUTPUT_DIR (default /output).
//   4. Reads the file back and re-checks the exact bytes the judge
//      will read, so a bad write can never pass silently.
//
// How to run it:
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
//
// The exit code is 0 only when the written file passes every check.
// Any gate failure throws before the file is written. The run is fully
// deterministic: the line is a constant, so there is no clock, no
// randomness, no network, and no input is read.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The entry line
// ---------------------------------------------------------------------------
//
// Three beats in one text message, all in the fridge's own voice:
//
//   "3am." — the hour is the timestamp. The whole premise in four
//     characters: it is the middle of the night and the fridge is awake.
//   "Third visit tonight." — the fridge keeps count. A machine notices
//     patterns, and the owner has already been here twice tonight.
//     That count is the setup the punchline cashes in.
//   "I'm not judging — I'm a fridge — but the pickles have started a
//     group chat about you." — a small appliance with an opinion, and
//     no shame about sharing it at 3am. The joke is specific (pickles,
//     not milk), surprising (a group chat, inside the fridge), and
//     complete in itself — short enough to screenshot, with nothing
//     left unexplained.
//
const LINE =
  "3am. Third visit tonight. I'm not judging — I'm a fridge — but the pickles have started a group chat about you.";

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

// The sealed scorer accepts 1 to 140 characters of UTF-8 text that is
// not only whitespace. Anything outside that is listed as invalid and
// never reaches the judge, so the program refuses to write it at all.
const MIN_CHARS = 1;
const MAX_CHARS = 140;

// The file the judge reads.
const OUTPUT_FILENAME = "entry.txt";

// Angles the judge's brief calls obvious and tired. The line must
// steer clear of all three: milk, ice, and a door left open.
const TIRED_ANGLES = /\bmilk\b|\bice\b|\bdoor\b/i;

// Characters that would break the "one line of text" shape.
const LINE_BREAK = /[\n\r]/;
const CONTROL_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Count characters the way a reader does: one count per Unicode code
// point, so a character outside the basic plane counts once, not twice.
// This line is plain text with two em dashes, so the count agrees with
// .length here — but the check stays honest for any line that is not
// plain ASCII.
function charCount(text: string): number {
  return [...text].length;
}

// Stop the run with a clear reason. Throwing, rather than logging and
// carrying on, guarantees a failed gate never produces an output file.
function fail(reason: string): never {
  throw new Error(`entry rejected: ${reason}`);
}

// Every check returns a short label for what it passed, so the run
// report can list exactly what was verified.
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

// The line has to be a fridge text at 3am, not just a funny sentence:
// it must name the hour, speak as the fridge itself in the first
// person, and avoid the three angles the judge's brief calls obvious.
function checkFridgeText(text: string): string {
  if (!/\b3\s?am\b/i.test(text)) {
    fail('entry must be set at 3am (must say "3am")');
  }
  if (!/\bI'm\b/.test(text) && !/\bI\b/.test(text)) {
    fail("entry must be the fridge's own text (first person)");
  }
  if (TIRED_ANGLES.test(text)) {
    fail("entry uses a tired angle (milk, ice, or a door left open)");
  }
  return "a 3am fridge text, fresh angle";
}

// Run every check in order and return the labels of the checks passed.
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

// Resolve the output directory. The harness sets MAKEFUN_OUTPUT_DIR;
// /output is the documented default for a local run.
function resolveOutputDir(): string {
  const dir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  if (dir.trim().length === 0) {
    fail("MAKEFUN_OUTPUT_DIR is empty");
  }
  return dir;
}

// Write the line exactly as validated: UTF-8, no trailing newline, so
// the file holds the line and nothing else.
function writeEntry(outDir: string, text: string): string {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, OUTPUT_FILENAME);
  writeFileSync(path, text, "utf8");
  return path;
}

// Read the file back, decode it strictly as UTF-8, and confirm it is
// byte for byte the validated line — then validate the decoded text
// once more, so the run proves the exact bytes the judge will read
// are good, not just the string held in memory.
function verifyWrittenFile(path: string, expected: string): void {
  const raw = readFileSync(path);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  if (decoded !== expected) {
    fail(`written file differs from the validated line (${path})`);
  }
  if (raw.length !== Buffer.byteLength(expected, "utf8")) {
    fail(`written file is ${raw.length} bytes, expected ${Buffer.byteLength(expected, "utf8")}`);
  }
  validateEntry(decoded);
}

// Print a short human-readable summary of what was written and
// verified: the line itself, its character and byte counts, every
// gate check that passed, and the output path.
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
