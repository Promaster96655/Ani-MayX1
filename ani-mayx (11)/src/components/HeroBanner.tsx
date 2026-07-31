import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronLeft, ChevronRight, Info, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from '../types';

interface HeroBannerProps {
  featuredAnime: Anime[];
  onPlayClick: (animeId: string) => void;
  onInfoClick: (animeId: string) => void;
  favorites: string[]; // animeIds
  onToggleFavorite: (animeId: string) => void;
}

export default function HeroBanner({
  featuredAnime,
  onPlayClick,
  onInfoClick,
  favorites,
  onToggleFavorite
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto rotate slider every 8 seconds
  useEffect(() => {
    if (featuredAnime.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredAnime.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [featuredAnime]);

  if (!featuredAnime || featuredAnime.length === 0) return null;

  const currentAnime = featuredAnime[currentIndex];
  const isFavorite = favorites.includes(currentAnime.id);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredAnime.length) % featuredAnime.length);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredAnime.length);
  };

  return (
    <div id="hero-carousel" className="relative w-full h-[72vh] min-h-[480px] md:h-[80vh] overflow-hidden rounded-2xl border border-purple-950/20 shadow-2xl">
      {/* Background slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentAnime.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Cover image object */}
          <img
            src={currentAnime.bannerUrl}
            alt={currentAnime.title}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          {/* Creative visual overlays (Darker vignetting + Purple/Orange soft ambient lighting) */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0813] via-[#0b0813]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0813] via-transparent to-[#0b0813]/40"></div>
          <div className="absolute inset-0 bg-radial-at-bl from-purple-900/20 via-transparent to-transparent"></div>
        </motion.div>
      </AnimatePresence>

      {/* Frontside details container */}
      <div className="absolute bottom-12 left-6 md:left-12 max-w-xl z-20 text-left pr-4">
        <motion.div
          key={`details-${currentAnime.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          {/* Featured badge */}
          <div className="flex items-center space-x-2">
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-black text-xs font-black tracking-widest px-3 py-1 rounded-full uppercase shadow-neon-orange">
              FEATURED HIT
            </span>
            <span className="bg-black/60 backdrop-blur-md text-zinc-300 text-xs font-semibold px-2.5 py-1 rounded border border-purple-500/25">
              🚀 {currentAnime.releaseYear}
            </span>
            <span className="bg-black/60 backdrop-blur-md text-orange-400 text-xs font-bold px-2.5 py-1 rounded border border-orange-500/25 flex items-center space-x-1">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{currentAnime.rating}</span>
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-md">
            {currentAnime.title}
          </h1>

          <p className="text-zinc-300 text-sm md:text-base leading-relaxed line-clamp-3 drop-shadow">
            {currentAnime.description}
          </p>

          {/* Genres row */}
          <div className="flex flex-wrap gap-2 pt-1">
            {currentAnime.genres.map((g) => (
              <span 
                key={g} 
                className="bg-purple-950/40 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full border border-purple-800/30"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Action trigger row */}
          <div className="flex flex-wrap gap-3 pt-3">
            <button
              onClick={() => onPlayClick(currentAnime.id)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold tracking-wide px-7 py-3 rounded-xl flex items-center space-x-2.5 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>WATCH NOW</span>
            </button>

            <button
              onClick={() => onToggleFavorite(currentAnime.id)}
              className={`font-bold text-sm tracking-wide px-5 py-3 rounded-xl border flex items-center space-x-2 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                isFavorite 
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-neon-orange' 
                  : 'border-zinc-700 bg-black/40 hover:bg-black/70 hover:border-purple-500 text-white'
              }`}
            >
              {isFavorite ? (
                <>
                  <Check className="w-4 h-4 text-orange-400" />
                  <span>PLAYLISTED</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-zinc-300" />
                  <span>ADD PLAYLIST</span>
                </>
              )}
            </button>

            <button
              onClick={() => onInfoClick(currentAnime.id)}
              className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white px-5 py-3 rounded-xl border border-zinc-800/80 hover:border-purple-800 flex items-center space-x-2 backdrop-blur-md active:scale-95 transition-all text-sm font-semibold cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>DETAILS</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Manual arrows controller */}
      <div className="absolute bottom-12 right-6 md:right-12 flex space-x-2.5 z-20">
        <button
          onClick={prevSlide}
          className="w-10 h-10 rounded-full bg-black/50 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all backdrop-blur-lg hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextSlide}
          className="w-10 h-10 rounded-full bg-black/50 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all backdrop-blur-lg hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progress slider indicators */}
      <div className="absolute top-6 right-6 hidden md:flex space-x-1.5 z-20">
        {featuredAnime.map((anime, idx) => (
          <button
            key={anime.id}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              currentIndex === idx ? 'w-8 bg-orange-500 shadow-neon-orange' : 'w-2 bg-zinc-600/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
