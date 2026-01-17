import { useRef, useEffect, useState, useCallback } from "react";

interface VideoSliderProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  onSeek: (time: number) => void;
}

export function VideoSlider({
  duration,
  currentTime,
  isPlaying,
  playbackRate,
  onSeek,
}: VideoSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragTimeRef = useRef<number>(currentTime);

  // Counter to trigger animation restart on seek
  const [seekVersion, setSeekVersion] = useState(0);

  // Sync dragTimeRef with currentTime when not dragging
  useEffect(() => {
    if (!isDragging) {
      dragTimeRef.current = currentTime;
    }
  }, [currentTime, isDragging]);

  // Animation setup effect - controls thumb and fill via refs
  useEffect(() => {
    const thumb = thumbRef.current;
    const fill = fillRef.current;
    if (!thumb || !fill || !duration) return;

    if (isPlaying && !isDragging) {
      const startTime = dragTimeRef.current;
      const remainingTime = (duration - startTime) / playbackRate;

      // Animate to 100% over remaining duration
      thumb.style.transition = `left ${remainingTime}s linear`;
      thumb.style.left = "100%";

      fill.style.transition = `width ${remainingTime}s linear`;
      fill.style.width = "100%";
    } else {
      // Static positioning
      const percent = `${(dragTimeRef.current / duration) * 100}%`;

      thumb.style.transition = "none";
      thumb.style.left = percent;

      fill.style.transition = "none";
      fill.style.width = percent;
    }
  }, [isPlaying, isDragging, playbackRate, duration, seekVersion]);

  // Update static position when not playing
  useEffect(() => {
    if (isPlaying && !isDragging) return;

    const thumb = thumbRef.current;
    const fill = fillRef.current;
    if (!thumb || !fill || !duration) return;

    const percent = `${(currentTime / duration) * 100}%`;
    thumb.style.left = percent;
    fill.style.width = percent;
  }, [currentTime, duration, isPlaying, isDragging]);

  // Calculate time from mouse position
  const getTimeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const track = trackRef.current;
      if (!track || !duration) return 0;

      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      return percent * duration;
    },
    [duration],
  );

  // Handle click on track
  const handleTrackClick = (e: React.MouseEvent) => {
    if (isDragging) return; // Ignore clicks during drag

    const newTime = getTimeFromEvent(e);
    dragTimeRef.current = newTime;
    onSeek(newTime);
    setSeekVersion((v) => v + 1);
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const newTime = getTimeFromEvent(e);
    dragTimeRef.current = newTime;

    // Update thumb position immediately
    const thumb = thumbRef.current;
    const fill = fillRef.current;
    if (thumb && fill && duration) {
      const percent = `${(newTime / duration) * 100}%`;
      thumb.style.transition = "none";
      thumb.style.left = percent;
      fill.style.transition = "none";
      fill.style.width = percent;
    }
  };

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = getTimeFromEvent(e);
      dragTimeRef.current = newTime;

      // Update thumb position
      const thumb = thumbRef.current;
      const fill = fillRef.current;
      if (thumb && fill && duration) {
        const percent = `${(newTime / duration) * 100}%`;
        thumb.style.left = percent;
        fill.style.width = percent;
      }

      // Throttled seek for live feedback
      onSeek(newTime);
    };

    const handleMouseUp = () => {
      // Final seek to exact position
      onSeek(dragTimeRef.current);
      setIsDragging(false);
      setSeekVersion((v) => v + 1);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, duration, getTimeFromEvent, onSeek]);

  const initialPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      onMouseDown={handleMouseDown}
      className="relative h-2 bg-secondary rounded-lg cursor-pointer group"
    >
      {/* Fill (progress) */}
      <div
        ref={fillRef}
        className="absolute inset-y-0 left-0 bg-primary rounded-lg pointer-events-none"
        style={{ width: `${initialPercent}%` }}
      />

      {/* Thumb */}
      <div
        ref={thumbRef}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${initialPercent}%` }}
      />
    </div>
  );
}
