# Canvas Lecture Downloader

Tools for downloading and processing lecture videos from Canvas/Panopto.

## Prerequisites

- [Bun](https://bun.sh)
- [ffmpeg](https://ffmpeg.org) (for video downloading)
- [parakeet-mlx](https://github.com/senstella/parakeet-mlx) (for transcription)
- Chrome browser (for Panopto authentication)

```bash
bun install
```

## Usage

### 1. Download video from Panopto

```bash
bun scripts/panopto-dl.ts <panopto-url> [output-path]
```

**Important:** Do NOT wrap the URL in quotes.

```bash
# Correct
bun scripts/panopto-dl.ts https://mediaweb.ap.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123 output/lecture.mp4

# Wrong - don't use quotes
bun scripts/panopto-dl.ts "https://mediaweb.ap.panopto.com/..." output/lecture.mp4
```

On first run, a browser window may open for authentication. Login credentials are persisted in `~/.panopto-dl/browser-data`.

### 2. Transcribe video to SRT

Use parakeet-mlx to generate subtitles:

```bash
parakeet output/lecture.mp4 -o output/lecture.srt
```

### 3. Convert SRT to readable markdown

Extract text from SRT (grouped into paragraphs based on speech pauses):

```bash
bun scripts/srt-to-text.ts output/lecture.srt
```

Options:
- `--gap <seconds>` - Pause threshold for paragraph breaks (default: 2.0)

Pipe through Gemini to clean up and format as markdown:

```bash
bun scripts/srt-to-text.ts output/lecture.srt | bun scripts/gemini-cli.ts --prompt-template prompt-markdown.md > output/lecture.md
```

### 4. Using gemini-cli directly

The `gemini-cli` script pipes stdin through Gemini with an optional prompt template:

```bash
echo "Hello world" | bun scripts/gemini-cli.ts
cat input.txt | bun scripts/gemini-cli.ts --prompt-template my-prompt.md > output.txt
```

Requires `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.

## Full workflow example

```bash
# Download
bun scripts/panopto-dl.ts https://mediaweb.ap.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123 output/lecture-01.mp4

# Transcribe
parakeet output/lecture-01.mp4 -o output/lecture-01.srt

# Convert to readable markdown
bun scripts/srt-to-text.ts output/lecture-01.srt | bun scripts/gemini-cli.ts --prompt-template prompt-markdown.md > output/lecture-01.md
```
