"use client";

import Image from "next/image";
import { useState } from "react";

interface ThemeScreenshotProps {
  src: string;
  alt: string;
}

export function ThemeScreenshot({ src, alt }: ThemeScreenshotProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-ctp-surface0 animate-pulse rounded-lg" />
      )}
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={240}
        className={`rounded-lg shadow-lg border-2 border-ctp-crust mb-8 transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        priority
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
