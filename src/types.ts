export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  createdAt: any;
  isBanned?: boolean;
  permissions?: string[];
}

export type GenreType = 'Action' | 'Adventure' | 'Fantasy' | 'Sci-Fi' | 'Drama' | 'Comedy' | 'Slice of Life' | 'Mystery' | 'Romance' | 'Thriller' | 'Demons' | 'Mecha' | 'Sports';

export interface Anime {
  id: string;
  title: string;
  description: string;
  bannerUrl: string; // large top banner
  thumbnailUrl: string; // vertical card thumbnail
  genres: GenreType[];
  rating: string; // e.g. "9.2", "8.5"
  status: 'Ongoing' | 'Completed';
  category: 'Popular' | 'Trending' | 'Featured' | 'Regular';
  releaseYear: number;
  totalSeasons?: number;
  episodeCount?: number;
  createdAt: any;
  type?: 'Series' | 'Movie';
  videoUrl?: string; // used for Movie
  duration?: number; // used for Movie (in seconds)
  studio?: string;
  language?: 'Sub' | 'Dub' | 'Both';
  malId?: number | string; // MyAnimeList ID for AniSkip lookup
  aniListId?: number | string; // AniList ID (optional)
  lastAniSkipSync?: string;
  aniSkipStatus?: 'synced' | 'missing_mal_id' | 'partial' | 'not_synced' | 'error';
  characters?: { name: string; role: 'Main' | 'Supporting'; avatarUrl?: string }[];
  voiceActors?: { character: string; actor: string; avatarUrl?: string }[];
}

export interface Comment {
  id: string;
  episodeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
}

export interface Review {
  id: string;
  animeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number; // 1 to 5 star rating
  reviewText: string;
  createdAt: any;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  animeId: string;
  createdAt: any;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: any;
}

export interface ScheduleItem {
  id: string;
  animeId: string;
  animeTitle: string;
  episodeNumber: number;
  releaseDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  time: string; // e.g. "18:30"
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  source?: string;
  createdAt: any;
}

export interface Season {
  id: string; // animeId_seasonNum
  animeId: string;
  number: number;
  name: string; // e.g., "Season 1", "Season 2: Shibuya Incident"
  episodeCount: number;
  malId?: number | string; // Per-season MyAnimeList ID for AniSkip lookup
  aniSkipStatus?: 'synced' | 'missing_mal_id' | 'partial' | 'not_synced' | 'error';
  createdAt: any;
}

export interface Episode {
  id: string; // animeId_seasonNum_episodeNum
  animeId: string;
  seasonId: string; // refers to Season.id
  seasonNumber: number;
  number: number;
  title: string;
  description?: string;
  videoUrl: string; // streaming mp4 url
  thumbnailUrl: string; // episode screenshot
  duration?: number; // duration in seconds
  introStart?: number;
  introEnd?: number;
  outroStart?: number;
  outroEnd?: number;
  skipSource?: string; // 'AniSkip' | 'AI' | 'Manual'
  lastUpdated?: string;
  status?: string; // 'success' | 'no_data' | 'error'
  hasSkipIntro?: boolean;
  introShowAt?: number;
  introShowDuration?: number;
  introSkipTo?: number;
  hasSkipRecap?: boolean;
  recapShowAt?: number;
  recapShowDuration?: number;
  recapSkipTo?: number;
  hasSkipOutro?: boolean;
  outroShowAt?: number;
  outroShowDuration?: number;
  outroSkipTo?: number;
  intro_start?: number;
  intro_end?: number;
  outro_start?: number;
  outro_end?: number;
  skip_intro_enabled?: boolean;
  skip_outro_enabled?: boolean;
  detection_method?: 'Online' | 'AI' | 'AniSkip';
  confidence_score?: number;
  processed_at?: string;
  aiNotes?: string;
  aiProcessed?: boolean;
  createdAt: any;
}

export interface WatchHistory {
  id: string; // userId_episodeId
  userId: string;
  animeId: string;
  episodeId: string;
  animeTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  progress: number; // in seconds
  duration: number; // in seconds
  updatedAt: any;
  completed: boolean;
  animeThumbnail: string;
}

export interface Favorite {
  id: string; // userId_animeId
  userId: string;
  animeId: string;
  createdAt: any;
}

export interface WatchPartyMember {
  id: string;
  name: string;
  isHost: boolean;
  avatarUrl?: string;
  joinedAt: string;
}

export interface WatchPartyMessage {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface WatchPartyRoom {
  code: string;
  hostId: string;
  hostName: string;
  animeId: string;
  seasonId: string;
  episodeId: string;
  isPlaying: boolean;
  currentTime: number;
  members: WatchPartyMember[];
  messages: WatchPartyMessage[];
  createdAt: string;
  lastUpdated: string;
}

export interface AniSkipTimingInterval {
  exists: boolean;
  start: number;
  end: number;
}

export interface AniSkipRecord {
  anime: string;
  season: number;
  episode: number;
  malId: number | string;
  intro: AniSkipTimingInterval;
  outro: AniSkipTimingInterval;
  episodeLength?: number;
  skipId?: string;
  lastUpdated?: string;
  status?: 'synced' | 'no_data' | 'missing_mal_id' | 'error';
}

export interface AniSkipJobProgress {
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  totalEpisodes: number;
  completed: number;
  failed: number;
  remaining: number;
  queuedAnime: number;
  currentAnime: string;
  currentEpisode: number;
  currentEpisodeTitle?: string;
  currentAnimeMalId?: number | string;
  retryCount: number;
  estimatedTimeRemainingSec: number;
  logs: AniSkipLog[];
  lastSyncTime?: string;
  missingOnly?: boolean;
}

export interface AniSkipLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'retry';
  message: string;
  animeTitle?: string;
  seasonNumber?: number;
  seasonName?: string;
  episodeNumber?: number;
  seasonMalId?: number | string;
  aniskipUrl?: string;
  httpStatus?: number;
  found?: boolean;
  skipTypes?: string[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  reason?: string;
  responseTimeMs?: number;
}


