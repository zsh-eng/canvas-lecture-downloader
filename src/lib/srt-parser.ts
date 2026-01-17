export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface Paragraph {
  id: number;
  startTime: number;
  endTime: number;
  subtitles: Subtitle[];
  text: string;
}

function timeToSeconds(time: string): number {
  const [hours, minutes, secondsMs] = time.split(":");
  const [seconds, ms] = secondsMs.split(",");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(ms) / 1000
  );
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseSRT(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const id = parseInt(lines[0]);
    if (isNaN(id)) continue;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = timeToSeconds(timeMatch[1]);
    const endTime = timeToSeconds(timeMatch[2]);
    const text = lines.slice(2).join(" ").trim();

    if (text && text !== ".") {
      subtitles.push({ id, startTime, endTime, text });
    }
  }

  return subtitles;
}

export function mergeToParagraphs(
  subtitles: Subtitle[],
  gapThreshold: number = 2.0
): Paragraph[] {
  if (subtitles.length === 0) return [];

  const paragraphs: Paragraph[] = [];
  let currentParagraph: Subtitle[] = [subtitles[0]];

  for (let i = 1; i < subtitles.length; i++) {
    const prev = subtitles[i - 1];
    const curr = subtitles[i];
    const gap = curr.startTime - prev.endTime;

    if (gap > gapThreshold) {
      paragraphs.push({
        id: paragraphs.length + 1,
        startTime: currentParagraph[0].startTime,
        endTime: currentParagraph[currentParagraph.length - 1].endTime,
        subtitles: currentParagraph,
        text: currentParagraph.map((s) => s.text).join(" "),
      });
      currentParagraph = [curr];
    } else {
      currentParagraph.push(curr);
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push({
      id: paragraphs.length + 1,
      startTime: currentParagraph[0].startTime,
      endTime: currentParagraph[currentParagraph.length - 1].endTime,
      subtitles: currentParagraph,
      text: currentParagraph.map((s) => s.text).join(" "),
    });
  }

  return paragraphs;
}
