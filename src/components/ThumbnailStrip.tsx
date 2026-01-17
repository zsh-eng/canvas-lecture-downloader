import { useState, useEffect, useRef, useCallback } from "react";

interface Thumbnail {
  time: number;
  url: string;
}

async function* generateThumbnails(
  videoSrc: string,
  count: number,
  signal?: AbortSignal,
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
  isPlaying: boolean;
  playbackRate: number;
  onSeek: (time: number) => void;
}

// Scroll sensitivity: seconds per pixel of horizontal scroll
const SECONDS_PER_PIXEL = 0.05;
// Throttle interval for video seeks (ms)
const SEEK_THROTTLE_MS = 60;
// Time before exiting scrub mode after last scroll (ms)
const SCRUB_EXIT_DELAY_MS = 150;

export function ThumbnailStrip({
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  playbackRate,
  onSeek,
}: ThumbnailStripProps) {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(currentTime);

  // Refs for throttling and timing
  const lastSeekTimeRef = useRef<number>(0);
  const scrubExitTimerRef = useRef<number | undefined>(undefined);
  const scrubTimeRef = useRef<number>(currentTime); // Keep ref in sync for wheel handler

  // Refs for DOM manipulation (bypassing React re-renders during playback)
  const playheadRef = useRef<HTMLDivElement>(null);
  const progressOverlayRef = useRef<HTMLDivElement>(null);

  // Counter to trigger animation restart on seek
  const [seekVersion, setSeekVersion] = useState(0);

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
          controller.signal,
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

  // Sync scrubTime with currentTime when not scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubTime(currentTime);
      scrubTimeRef.current = currentTime;
    }
  }, [currentTime, isScrubbing]);

  // Animation setup effect - controls playhead and progress overlay via refs
  // This effect deliberately does NOT depend on currentTime to avoid restarting animation
  useEffect(() => {
    const playhead = playheadRef.current;
    const progressOverlay = progressOverlayRef.current;
    if (!playhead || !progressOverlay || !duration) return;

    if (isPlaying && !isScrubbing) {
      // Use scrubTimeRef for accurate position (handles post-scrub handoff)
      const startTime = scrubTimeRef.current;
      const remainingTime = (duration - startTime) / playbackRate;

      // Animate to 100% over remaining duration
      playhead.style.transition = `left ${remainingTime}s linear`;
      playhead.style.left = "100%";

      progressOverlay.style.transition = `width ${remainingTime}s linear`;
      progressOverlay.style.width = "100%";
    } else {
      // Static positioning - no transition
      const percent = `${(scrubTimeRef.current / duration) * 100}%`;

      playhead.style.transition = "none";
      playhead.style.left = percent;

      progressOverlay.style.transition = "none";
      progressOverlay.style.width = percent;
    }
  }, [isPlaying, isScrubbing, playbackRate, duration, seekVersion]);

  // Update static position when not playing (for timeupdate during pause, etc.)
  useEffect(() => {
    if (isPlaying && !isScrubbing) return; // Animation handles this

    const playhead = playheadRef.current;
    const progressOverlay = progressOverlayRef.current;
    if (!playhead || !progressOverlay || !duration) return;

    const percent = `${(currentTime / duration) * 100}%`;
    playhead.style.left = percent;
    progressOverlay.style.width = percent;
  }, [currentTime, duration, isPlaying, isScrubbing]);

  // Update position during scrubbing (from scrubTime state)
  useEffect(() => {
    if (!isScrubbing) return;

    const playhead = playheadRef.current;
    const progressOverlay = progressOverlayRef.current;
    if (!playhead || !progressOverlay || !duration) return;

    const percent = `${(scrubTime / duration) * 100}%`;
    playhead.style.left = percent;
    progressOverlay.style.width = percent;
  }, [scrubTime, duration, isScrubbing]);

  // Wheel event handler for horizontal scroll scrubbing
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Only handle horizontal scroll (ignore vertical)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.5) return;
      if (!duration) return;

      e.preventDefault();

      // Calculate new time based on scroll delta
      const delta = e.deltaX * SECONDS_PER_PIXEL;
      const newTime = Math.max(
        0,
        Math.min(duration, scrubTimeRef.current + delta),
      );

      // Update scrub state immediately for visual feedback
      scrubTimeRef.current = newTime;
      setScrubTime(newTime);
      setIsScrubbing(true);

      // Throttled video seek
      const now = performance.now();
      if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
        lastSeekTimeRef.current = now;
        onSeek(newTime);
      }

      // Reset scrub exit timer
      if (scrubExitTimerRef.current) {
        clearTimeout(scrubExitTimerRef.current);
      }
      scrubExitTimerRef.current = window.setTimeout(() => {
        // Final seek to ensure we land on the exact scrubbed position
        onSeek(scrubTimeRef.current);
        setIsScrubbing(false);
        // Trigger animation restart from scrubbed position
        setSeekVersion((v) => v + 1);
      }, SCRUB_EXIT_DELAY_MS);
    },
    [duration, onSeek],
  );

  // Attach wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (scrubExitTimerRef.current) {
        clearTimeout(scrubExitTimerRef.current);
      }
    };
  }, [handleWheel]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !duration) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;

    // Update scrubTimeRef so animation starts from correct position
    scrubTimeRef.current = newTime;
    onSeek(newTime);

    // Trigger animation restart
    setSeekVersion((v) => v + 1);
  };

  // Initial position for SSR/first render
  const initialPercent = duration ? (currentTime / duration) * 100 : 0;

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

      {/* Progress overlay - position controlled via ref */}
      <div
        ref={progressOverlayRef}
        className="absolute inset-y-0 left-0 bg-black/40 pointer-events-none"
        style={{ width: `${initialPercent}%` }}
      />

      {/* Playhead - position controlled via ref */}
      <div
        ref={playheadRef}
        className="absolute inset-y-0 w-1 bg-primary rounded-full shadow-lg pointer-events-none"
        style={{ left: `${initialPercent}%` }}
      />
    </div>
  );
}
