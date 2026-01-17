#!/usr/bin/env bun
import { readFileSync } from "fs";
import { parseSRT, mergeToParagraphs } from "../src/lib/srt-parser";

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: srt-to-text.ts <srt-file> [--gap <seconds>]");
    console.error("  --gap <seconds>  Pause threshold for paragraph breaks (default: 2.0)");
    process.exit(1);
  }

  const srtPath = args[0];
  let gapThreshold = 2.0;

  // Parse --gap argument
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--gap" && i + 1 < args.length) {
      gapThreshold = parseFloat(args[i + 1]);
      break;
    }
  }

  let content: string;
  try {
    content = readFileSync(srtPath, "utf-8");
  } catch (error) {
    console.error(`Error: Could not read file: ${srtPath}`);
    process.exit(1);
  }

  const subtitles = parseSRT(content);
  const paragraphs = mergeToParagraphs(subtitles, gapThreshold);

  // Output paragraphs separated by blank lines
  const output = paragraphs.map((p) => p.text).join("\n\n");
  console.log(output);
}

main();
