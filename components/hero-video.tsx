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
      {isLoading && (
        <div className="absolute inset-0 bg-ctp-surface0 animate-pulse rounded-3xl" />
      )}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        poster="/demo-poster.png"
        onLoadedData={() => setIsLoading(false)}
        className={`rounded-3xl md:absolute top-0 z-10 border-2 border-ctp-surface2 w-[600px] h-[400px] object-cover transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      >
        <source src="/demo.mp4" type="video/mp4" />
        <source src="/demo.webm" type="video/webm" />
        {/* Fallback for browsers that don't support video */}
        Your browser does not support the video tag.
      </video>
      <div className="rotate-5 bg-ctp-surface0 rounded-3xl w-[600px] h-[400px] hidden md:block" />
    </div>
  );
}
