import React, { useState, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean; // If true, do not lazy load (above-the-fold)
  wrapperClassName?: string;
  referrerPolicy?: any;
}

export default function LazyImage({
  src,
  alt,
  className = '',
  priority = false,
  wrapperClassName = '',
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');

  useEffect(() => {
    // Reset loaded state when src changes
    setLoaded(false);
    if (src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setLoaded(true);
      };
      img.onerror = () => {
        setCurrentSrc(src);
        setLoaded(true); // stop showing loader on error
      };
    }
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-zinc-950 ${wrapperClassName} ${className}`}>
      {/* Skeleton Shimmer Loader */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}
      
      {src && (
        <img
          src={src}
          alt={alt}
          loading={priority ? undefined : "lazy"}
          className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setLoaded(true)}
          {...props}
        />
      )}
    </div>
  );
}
