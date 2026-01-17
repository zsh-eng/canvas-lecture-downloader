#!/usr/bin/env bun
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { readFileSync } from "fs";

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let promptTemplate = "{{ input }}"; // Default template

  // Parse --prompt-template argument
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt-template" && i + 1 < args.length) {
      const templatePath = args[i + 1];
      try {
        promptTemplate = readFileSync(templatePath, "utf-8");
      } catch (error) {
        console.error(
          `Error: Could not read prompt template file: ${templatePath}`,
          error,
        );
        process.exit(1);
      }
      break;
    }
  }

  // Read from stdin
  const input = await readStdin();

  if (!input.trim()) {
    console.error("Error: No input provided via stdin");
    process.exit(1);
  }

  // Replace {{ input }} in the prompt template
  const prompt = promptTemplate.replace(/\{\{\s*input\s*\}\}/g, input.trim());

  // Check for API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      "Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable not set",
    );
    process.exit(1);
  }

  try {
    // Call Gemini API
    const { text } = await generateText({
      model: google("gemini-3-flash-preview"),
      prompt: prompt,
    });

    // Output to stdout
    process.stdout.write(text);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    process.exit(1);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return buffer.toString("utf-8");
}

main();
