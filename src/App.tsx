import { useState, useRef, useEffect, useCallback } from "react";
import {
  parseSRT,
  formatTime,
  type Subtitle,
} from "./lib/srt-parser";
import { ThumbnailStrip } from "./components/ThumbnailStrip";

function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSubtitleRef = useRef<HTMLDivElement>(null);

  const currentSubtitleIndex = subtitles.findIndex(
    (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  // Auto-scroll to current subtitle
  useEffect(() => {
    if (activeSubtitleRef.current && transcriptRef.current) {
      const container = transcriptRef.current;
      const element = activeSubtitleRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentSubtitleIndex]);

  const handleVideoFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
  }, []);

  const handleSrtFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseSRT(content);
      setSubtitles(parsed);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);

      for (const file of files) {
        if (file.type.startsWith("video/") || file.name.endsWith(".mp4")) {
          handleVideoFile(file);
        } else if (file.name.endsWith(".srt")) {
          handleSrtFile(file);
        }
      }
    },
    [handleVideoFile, handleSrtFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // No video loaded - show drop zone
  if (!videoUrl) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center bg-background"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="glass squircle rounded-3xl p-16 text-center max-w-lg shadow-lg">
          <div className="text-4xl mb-4">🎬</div>
          <h1 className="text-xl font-semibold mb-2">Lecture Viewer</h1>
          <p className="text-muted-foreground mb-4">
            Drop an MP4 video and SRT subtitle file here
          </p>
          <p className="text-sm text-muted-foreground">
            or drop just a video to start
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex bg-background"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Left: Video Player */}
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <div className="mb-2">
          <h1 className="text-lg font-semibold truncate">{videoName}</h1>
        </div>

        {/* Video */}
        <div className="flex-1 bg-black rounded-lg squircle overflow-hidden flex items-center justify-center min-h-0">
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-h-full max-w-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlayPause}
          />
        </div>

        {/* Thumbnail Strip */}
        <div className="mt-4">
          <ThumbnailStrip
            videoUrl={videoUrl}
            duration={duration}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>

        {/* Controls */}
        <div className="mt-4 space-y-2">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-sm text-muted-foreground w-16 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md squircle hover:opacity-90"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Speed:</span>
              {[0.5, 1, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRateChange(rate)}
                  className={`px-2 py-1 text-sm rounded squircle ${
                    playbackRate === rate
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drop hint */}
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Drop additional files anytime (MP4 or SRT)
        </p>
      </div>

      {/* Right: Transcript */}
      <div className="w-96 glass flex flex-col">
        <div className="p-4">
          <h2 className="font-semibold">Transcript</h2>
          {subtitles.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {subtitles.length} subtitles
            </p>
          )}
        </div>

        {subtitles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div className="text-muted-foreground">
              <p>No transcript loaded</p>
              <p className="text-sm mt-1">Drop an SRT file to add subtitles</p>
            </div>
          </div>
        ) : (
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-4 space-y-1"
          >
            {subtitles.map((subtitle, index) => {
              const isActive = index === currentSubtitleIndex;
              return (
                <div
                  key={subtitle.id}
                  ref={isActive ? activeSubtitleRef : null}
                  onClick={() => seekTo(subtitle.startTime)}
                  className={`p-2 rounded squircle cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/15"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="text-xs text-muted-foreground mr-2">
                    {formatTime(subtitle.startTime)}
                  </span>
                  <span className={isActive ? "text-foreground" : ""}>
                    {subtitle.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
