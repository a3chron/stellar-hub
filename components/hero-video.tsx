"use client";

import { useEffect, useRef, useState } from "react";

export function HeroVideo() {
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check if video is already loaded (e.g., from cache) when component mounts
    // readyState >= 2 means HAVE_CURRENT_DATA - enough data to play current frame
    if (videoRef.current && videoRef.current.readyState >= 2) {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="relative">
      {/* The rounding/border/clip live here, not on the <video> itself: a
          <video> with its own border-radius is composited as an overlay on
          Android Chrome and iOS Safari and doesn't get clipped. `isolate` +
          forcing a compositing layer on this wrapper is the standard fix. */}
      <div className="relative isolate overflow-hidden rounded-3xl border-2 border-ctp-surface2 md:absolute top-0 z-10 w-full aspect-[3/2] md:w-[600px] md:h-[400px] md:aspect-auto [transform:translateZ(0)]">
        {isLoading && (
          <div className="absolute inset-0 bg-ctp-surface0 animate-pulse" />
        )}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          poster="/demo-poster.png"
          onLoadedData={() => setIsLoading(false)}
          className={`block size-full object-cover transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        >
          <source src="/demo.mp4" type="video/mp4" />
          <source src="/demo.webm" type="video/webm" />
          {/* Fallback for browsers that don't support video */}
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="rotate-5 bg-ctp-surface0 rounded-3xl w-[600px] h-[400px] hidden md:block" />
    </div>
  );
}
