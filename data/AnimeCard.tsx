import React from 'react';
import { Star, Play, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Anime } from '../types';
import LazyImage from './LazyImage';

interface AnimeCardProps {
  key?: any;
  anime: Anime;
  onClick: (animeId: string) => void;
  onPlayClick?: (animeId: string) => void;
  isFavorite: boolean;
  onToggleFavorite?: (animeId: string) => void;
}

export default function AnimeCard({
  anime,
  onClick,
  onPlayClick,
  isFavorite,
  onToggleFavorite
}: AnimeCardProps) {
  const handlePlayAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlayClick) {
      onPlayClick(anime.id);
    }
  };

  const handleFavoriteAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(anime.id);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={() => onClick(anime.id)}
      className="glass-panel relative rounded-xl overflow-hidden cursor-pointer group flex flex-col h-full border border-purple-950/25 shadow-lg shadow-black/40 hover:shadow-neon-purple hover:border-purple-800/60"
    >
      {/* BoxArt container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
        <LazyImage
          src={anime.thumbnailUrl}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />

        {/* Top badges bar */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
          <span className="bg-black/85 backdrop-blur-md text-xs font-bold px-2 py-0.5 rounded border border-orange-500/25 text-orange-400 flex items-center space-x-1">
            <Star className="w-3 h-3 fill-current" />
            <span>{anime.rating}</span>
          </span>

          <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
            anime.status === 'Ongoing' 
              ? 'bg-purple-900 border border-purple-500 text-purple-200' 
              : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
          }`}>
            {anime.status}
          </span>
        </div>

        {/* Hover quick overlays action triggers */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
          <div className="flex space-x-2.5">
            <button
              onClick={handlePlayAction}
              className="w-11 h-11 rounded-full bg-orange-500 text-black flex items-center justify-center hover:bg-orange-400 transition-all shadow-lg active:scale-95 cursor-pointer"
              title="Watch Anime"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
            
            {onToggleFavorite && (
              <button
                onClick={handleFavoriteAction}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${
                  isFavorite 
                    ? 'bg-purple-900/80 border-orange-500 text-orange-400' 
                    : 'bg-black/80 border-zinc-700 text-white hover:border-purple-500'
                }`}
                title={isFavorite ? "Remove Playlist" : "Add Playlist"}
              >
                {isFavorite ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Meta section */}
      <div className="p-4 flex flex-col flex-grow text-left">
        {/* Category tag */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
            {anime.releaseYear} • {anime.category}
          </span>
        </div>

        <h3 className="font-extrabold text-base text-zinc-100 group-hover:text-orange-400 transition-colors line-clamp-1 pb-1.5 leading-relaxed">
          {anime.title}
        </h3>

        {/* First 2 genres tags */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {anime.genres.slice(0, 2).map((g) => (
            <span 
              key={g} 
              className="bg-purple-950/35 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-900/30"
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
