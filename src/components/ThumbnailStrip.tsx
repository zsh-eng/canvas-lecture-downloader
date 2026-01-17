import { useState, useEffect, useRef } from "react";

interface Thumbnail {
  time: number;
  url: string;
}

async function* generateThumbnails(
  videoSrc: string,
  count: number,
  signal?: AbortSignal
): AsyncGenerator<Thumbnail> {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.muted = true;
  video.preload = "metadata";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  const canvas = document.createElement("canvas");
  const aspectRatio = video.videoWidth / video.videoHeight;
  canvas.height = 64;
  canvas.width = Math.round(64 * aspectRatio);
  const ctx = canvas.getContext("2d")!;

  const interval = video.duration / count;

  for (let i = 0; i < count; i++) {
    if (signal?.aborted) return;

    // Yield to main thread
    await new Promise((r) => setTimeout(r, 0));

    const time = i * interval;
    video.currentTime = time;
    await new Promise<void>((r) => {
      video.onseeked = () => r();
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    yield { time, url: canvas.toDataURL("image/jpeg", 0.6) };
  }
}

interface ThumbnailStripProps {
  videoUrl: string;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function ThumbnailStrip({
  videoUrl,
  duration,
  currentTime,
  onSeek,
}: ThumbnailStripProps) {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoUrl || !duration) return;

    const controller = new AbortController();
    setThumbnails([]);
    setIsGenerating(true);

    // Calculate thumbnail count based on container width
    const thumbnailWidth = 80;
    const containerWidth = containerRef.current?.offsetWidth ?? 600;
    const count = Math.max(8, Math.floor(containerWidth / thumbnailWidth));

    (async () => {
      try {
        for await (const thumb of generateThumbnails(
          videoUrl,
          count,
          controller.signal
        )) {
          setThumbnails((prev) => [...prev, thumb]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Thumbnail generation failed:", err);
        }
      } finally {
        setIsGenerating(false);
      }
    })();

    return () => controller.abort();
  }, [videoUrl, duration]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !duration) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(percent * duration);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="relative h-16 bg-black/20 rounded-lg squircle overflow-hidden cursor-pointer"
    >
      {/* Thumbnails */}
      <div className="absolute inset-0 flex">
        {thumbnails.map((thumb, i) => (
          <div
            key={i}
            className="h-full flex-1 min-w-0"
            style={{
              backgroundImage: `url(${thumb.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ))}

        {/* Placeholder slots while generating */}
        {isGenerating &&
          thumbnails.length < 8 &&
          Array.from({ length: 8 - thumbnails.length }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="h-full flex-1 min-w-0 bg-white/5 animate-pulse"
            />
          ))}
      </div>

      {/* Progress overlay */}
      <div
        className="absolute inset-y-0 left-0 bg-black/40 pointer-events-none"
        style={{ width: `${progressPercent}%` }}
      />

      {/* Playhead */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-sm pointer-events-none"
        style={{ left: `${progressPercent}%` }}
      />
    </div>
  );
}
