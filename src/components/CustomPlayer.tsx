import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  RotateCcw, RotateCw, Settings, SkipForward, SkipBack,
  Tv, History, AlertTriangle, Loader2, X, Sun, ArrowRight,
  Users, FastForward, Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc } from '../firebase';
import Hls from 'hls.js';

// Utility to normalize Dropbox and Google Drive links to direct stream links
export const normalizeVideoUrl = (url: string): string => {
  if (!url) return '';
  
  // 1. Google Drive Support
  if (url.includes('drive.google.com')) {
    let fileId = '';
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) {
      fileId = fileDMatch[1];
    } else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        fileId = idMatch[1];
      }
    }
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }

  // 2. Dropbox Support
  if (url.includes('dropbox.com')) {
    let cleanUrl = url.replace(/(www\.)?dropbox\.com/, 'dl.dropboxusercontent.com');
    cleanUrl = cleanUrl.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
    if (!cleanUrl.includes('raw=1') && !cleanUrl.includes('dl=1')) {
      cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'raw=1';
    }
    return cleanUrl;
  }

  return url;
};

export const normalizeDropboxUrl = (url: string): string => {
  return normalizeVideoUrl(url);
};

export const isMkvUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.mkv') || cleanUrl.includes('.mkv');
  } catch (e) {
    return false;
  }
};

// Detect if running on a Smart TV / BrowseHere to optimize rendering and buffer configurations
export const isSmartTV = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    ua.includes('smarttv') ||
    ua.includes('smart-tv') ||
    ua.includes('googletv') ||
    ua.includes('androidtv') ||
    ua.includes('appletv') ||
    ua.includes('tizen') ||
    ua.includes('webos') ||
    ua.includes('hbbtv') ||
    ua.includes('netcast') ||
    ua.includes('viera') ||
    ua.includes('opera tv') ||
    ua.includes('philipstv') ||
    ua.includes('sony dtv') ||
    ua.includes('roku') ||
    ua.includes('browsehere') ||
    ua.includes('mi tv') ||
    ua.includes('firetv') ||
    ua.includes('dtv') ||
    ua.includes('stb') ||
    ua.includes('remote') ||
    ua.includes('playstation') ||
    ua.includes('xbox')
  );
};

// Extremely lightweight wrapper to bypass heavy Framer Motion animations on Smart TV hardware
const TVDiv = ({ children, className, initial, animate, exit, transition, style, onClick, onTouchStart, ...props }: any) => {
  const isTV = isSmartTV();
  if (isTV) {
    return (
      <div 
        className={className} 
        style={style} 
        onClick={onClick} 
        onTouchStart={onTouchStart} 
        {...props}
      >
        {children}
      </div>
    );
  }
  return (
    <motion.div 
      className={className} 
      initial={initial} 
      animate={animate} 
      exit={exit} 
      transition={transition} 
      style={style}
      onClick={onClick}
      onTouchStart={onTouchStart}
      {...props}
    >
      {children}
    </motion.div>
  );
};

const TVButton = ({ children, className, initial, animate, exit, transition, style, onClick, onTouchStart, ...props }: any) => {
  const isTV = isSmartTV();
  if (isTV) {
    return (
      <button 
        className={className} 
        style={style} 
        onClick={onClick} 
        onTouchStart={onTouchStart} 
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <motion.button 
      className={className} 
      initial={initial} 
      animate={animate} 
      exit={exit} 
      transition={transition} 
      style={style}
      onClick={onClick}
      onTouchStart={onTouchStart}
      {...props}
    >
      {children}
    </motion.button>
  );
};

interface CustomPlayerProps {
  episode: any;
  animeTitle: string;
  animeType?: string;
  animeThumbnail: string;
  userId: string | undefined;
  onEpisodeCompleted?: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode: boolean;
  nextEpisodePreview?: { title: string, thumbnailUrl: string, number: number };
  onPreviousEpisode?: () => void;
  hasPreviousEpisode: boolean;
  initialProgress?: number;
  seasons?: any[];
  episodes?: any[];
  selectedSeasonId?: string;
  onSelectSeason?: (seasonId: string) => void;
  onSelectEpisode?: (episode: any) => void;
  watchPartyRoom?: any;
  isHost?: boolean;
  onWatchPartyAction?: (actionType: 'play' | 'pause' | 'seek', currentTime: number) => void;
}

export default function CustomPlayer({
  episode,
  animeTitle,
  animeType,
  animeThumbnail,
  userId,
  onEpisodeCompleted,
  onNextEpisode,
  hasNextEpisode,
  nextEpisodePreview,
  onPreviousEpisode,
  hasPreviousEpisode,
  initialProgress = 0,
  seasons,
  episodes,
  selectedSeasonId,
  onSelectSeason,
  onSelectEpisode,
  watchPartyRoom,
  isHost = false,
  onWatchPartyAction
}: CustomPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [brightness, setBrightness] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  
  const [showControls, setShowControls] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now()); // Robust 3s Tracker
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);

  const [showEndScreen, setShowEndScreen] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const [showGestureUI, setShowGestureUI] = useState<'volume' | 'brightness' | null>(null);
  const [skipAnim, setSkipAnim] = useState<'forward' | 'backward' | null>(null);

  // Fallback state variables to avoid any unresolved references
  const [isBlobLoading, setIsBlobLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const lastSavedTimeRef = useRef(0);
  const seekedRef = useRef<string | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 }); 

  const [lastEpisodeId, setLastEpisodeId] = useState(episode?.id || '');
  const [prevEpisodeVideoUrl, setPrevEpisodeVideoUrl] = useState(episode?.videoUrl || '');
  const [currentVideoUrl, setCurrentVideoUrl] = useState(episode?.videoUrl || '');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');
  const [mkvStartOffset, setMkvStartOffset] = useState(0);
  const [nonHostControlWarning, setNonHostControlWarning] = useState(false);

  // MKV and Audio Transcoding Metadata & state
  const [mkvMetadata, setMkvMetadata] = useState<{
    audioTracks: Array<{ index: number; language: string; title: string; codec: string; channels: number; needsTranscode?: boolean }>;
    subtitleTracks: Array<{ index: number; language: string; title: string; codec: string }>;
    duration?: number;
    isContainerNative?: boolean;
  } | null>(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<number | null>(null);
  const [showMkvSettings, setShowMkvSettings] = useState(false);
  const [isAnalyzingCodecs, setIsAnalyzingCodecs] = useState(false);

  // Helper to determine if a video needs remuxing/transcoding
  const needsRemuxOrTranscodeUrl = (url: string, meta: typeof mkvMetadata, selectedAudioIdx: number | null): boolean => {
    if (!url) return false;
    if (url.includes('.m3u8')) return false;

    const cleanUrl = url.toLowerCase().split('?')[0];
    const isMkv = cleanUrl.endsWith('.mkv') || cleanUrl.includes('.mkv');
    const isAvi = cleanUrl.endsWith('.avi') || cleanUrl.includes('.avi');
    const isMov = cleanUrl.endsWith('.mov') || cleanUrl.includes('.mov');

    if (isMkv || isAvi || isMov) {
      return true;
    }

    if (meta) {
      if (meta.isContainerNative === false) {
        return true;
      }
      if (meta.audioTracks && meta.audioTracks.length > 0) {
        const activeTrack = selectedAudioIdx !== null 
          ? meta.audioTracks.find(t => t.index === selectedAudioIdx)
          : meta.audioTracks[0];
        
        if (activeTrack && activeTrack.needsTranscode) {
          return true;
        }
      }
    }

    return false;
  };

  const useRemux = needsRemuxOrTranscodeUrl(resolvedVideoUrl, mkvMetadata, selectedAudioTrack);

  useEffect(() => {
    if (!resolvedVideoUrl) {
      setMkvMetadata(null);
      setSelectedAudioTrack(null);
      setSelectedSubtitleTrack(null);
      return;
    }

    if (resolvedVideoUrl.includes('.m3u8')) {
      setMkvMetadata(null);
      setSelectedAudioTrack(null);
      setSelectedSubtitleTrack(null);
      return;
    }

    // Immediately clear metadata and track selections to prevent stale checks with new URLs
    setMkvMetadata(null);
    setSelectedAudioTrack(null);
    setSelectedSubtitleTrack(null);

    const cacheKey = `animayx_media_info_${encodeURIComponent(resolvedVideoUrl)}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed && parsed.success) {
          setMkvMetadata(parsed);
          if (parsed.duration && parsed.duration > 0) {
            setDuration(parsed.duration);
          }
          if (parsed.audioTracks && parsed.audioTracks.length > 0) {
            setSelectedAudioTrack(parsed.audioTracks[0].index);
          }
          return;
        }
      } catch (err) {}
    }

    setIsAnalyzingCodecs(true);
    fetch(`/api/video/mkv-info?url=${encodeURIComponent(resolvedVideoUrl)}`)
      .then(res => res.json())
      .then(data => {
        setIsAnalyzingCodecs(false);
        if (data && data.success) {
          setMkvMetadata(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {}

          if (data.duration && data.duration > 0) {
            setDuration(data.duration);
          }
          if (data.audioTracks && data.audioTracks.length > 0) {
            setSelectedAudioTrack(data.audioTracks[0].index);
          }
        }
      })
      .catch(err => {
        setIsAnalyzingCodecs(false);
        console.error("[Media Codec Probe Error]", err);
      });
  }, [resolvedVideoUrl]);

  const [autoSkipEnabled, setAutoSkipEnabled] = useState<boolean>(() => {
    return localStorage.getItem('animayx_auto_skip') === 'true';
  });
  const autoSkippedIntroRef = useRef<string | null>(null);
  const autoSkippedOutroRef = useRef<string | null>(null);
  const autoSkippedRecapRef = useRef<string | null>(null);
  const autoSkippedPreviewRef = useRef<string | null>(null);
  const [autoSkipToast, setAutoSkipToast] = useState<string | null>(null);
  const [setupTimestamps, setSetupTimestamps] = useState<any>(null);

  useEffect(() => {
    if (!episode) return;
    setSetupTimestamps(null);
    autoSkippedIntroRef.current = null;
    autoSkippedOutroRef.current = null;

    const fetchSetup = async () => {
      try {
        const animeParam = episode?.animeId || '';
        const seasonParam = String(episode?.seasonNumber || selectedSeasonId || '1');
        const episodeParam = String(episode?.number || '1');
        if (!animeParam) return;
        const url = `/api/player/setup?anime=${encodeURIComponent(animeParam)}&season=${encodeURIComponent(seasonParam)}&episode=${encodeURIComponent(episodeParam)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSetupTimestamps(data);
        }
      } catch (err) {
        console.warn("Failed to fetch player setup:", err);
      }
    };
    fetchSetup();
  }, [episode?.id, episode?.animeId, selectedSeasonId]);

  const toggleAutoSkip = () => {
    setAutoSkipEnabled(prev => {
      const next = !prev;
      localStorage.setItem('animayx_auto_skip', String(next));
      return next;
    });
  };

  // Synchronize with watch party events (For non-hosts)
  useEffect(() => {
    if (!watchPartyRoom || isHost || !videoRef.current) return;

    // 1. Synchronize Play/Pause
    const hostIsPlaying = watchPartyRoom.isPlaying;
    if (hostIsPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else if (!hostIsPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }

    // 2. Synchronize Current Time with high-accuracy check
    const hostTime = watchPartyRoom.currentTime;
    const clientTime = videoRef.current.currentTime;
    const timeDifference = Math.abs(clientTime - hostTime);

    // If drift is larger than 2.5 seconds, force a seek to the host's exact position
    if (timeDifference > 2.5) {
      console.log(`[WatchParty] Force sync position from ${clientTime} to host time ${hostTime}`);
      setIsBuffering(true);
      videoRef.current.currentTime = hostTime;
      setCurrentTime(hostTime);
    }
  }, [watchPartyRoom?.isPlaying, watchPartyRoom?.currentTime, isHost]);

  // Host position syncing heartbeat interval
  useEffect(() => {
    if (!watchPartyRoom || !isHost || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current && onWatchPartyAction) {
        // Emit high-resolution seek sync to server
        onWatchPartyAction('seek', videoRef.current.currentTime);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [watchPartyRoom, isHost, onWatchPartyAction]);

  // Keep a ref for isPlaying state to avoid stale closure issues
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ==========================================
  // SOLID 3-SECOND AUTO-HIDE LOGIC
  // ==========================================
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls && isPlaying && !isDragging && !showEndScreen) {
      timer = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000); // The 3 second hide rule
    }
    return () => clearTimeout(timer);
  }, [showControls, isPlaying, isDragging, showEndScreen, lastActivity]);

  useEffect(() => {
    if (episode?.id !== lastEpisodeId || episode?.videoUrl !== prevEpisodeVideoUrl) {
      setLastEpisodeId(episode?.id);
      setPrevEpisodeVideoUrl(episode?.videoUrl);
      setCurrentVideoUrl(episode?.videoUrl);
      setVideoError(null);
      setIsPlaying(true);
      setCurrentTime(initialProgress || 0);
      setMkvStartOffset(initialProgress || 0);
      setSelectedAudioTrack(null);
      setSelectedSubtitleTrack(null);
      setMkvMetadata(null);
      setShowMkvSettings(false);
      setShowEndScreen(false);
      setCountdown(3);
      setShowControls(true);
      setLastActivity(Date.now()); // Wake up UI on new episode
      if (seekedRef.current) seekedRef.current = null;
    }
  }, [episode?.id, episode?.videoUrl, initialProgress]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showEndScreen && hasNextEpisode && countdown > 0) {
      timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    } else if (showEndScreen && hasNextEpisode && countdown === 0) {
      if (onNextEpisode) {
        setShowEndScreen(false);
        onNextEpisode();
      }
    }
    return () => clearTimeout(timer);
  }, [showEndScreen, countdown, hasNextEpisode, onNextEpisode]);

  useEffect(() => {
    const rawUrl = currentVideoUrl || episode?.videoUrl;
    if (!rawUrl) { setResolvedVideoUrl(''); return; }
    setResolvedVideoUrl(normalizeVideoUrl(rawUrl));
  }, [currentVideoUrl, episode?.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedVideoUrl) return;

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    setIsBuffering(true);
    setVideoError(null);

    if (useRemux) {
      const audioParam = selectedAudioTrack !== null ? `&audioStream=${selectedAudioTrack}` : '';
      video.src = `/api/video/remux?url=${encodeURIComponent(resolvedVideoUrl)}&start=${Math.floor(mkvStartOffset)}${audioParam}`;
      video.load();
      if (isPlaying && !showEndScreen) video.play().catch(() => {});
    } else if (resolvedVideoUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const isTV = isSmartTV();
        const hlsConfig: any = {
          autoStartLoad: true,
          capLevelToPlayerSize: true, // Auto caps level to player size to prevent lag/waste
        };

        if (isTV) {
          // Deeply optimize parameters for low-end Smart TVs (BrowseHere, Tizen, WebOS, Mi TV, etc.)
          hlsConfig.maxBufferLength = 8;         // Only buffer 8 seconds ahead to keep memory footprint very small
          hlsConfig.maxMaxBufferLength = 12;     // Absolute ceiling of forward buffering
          hlsConfig.maxBufferSize = 6 * 1024 * 1024; // Limit buffer to 6MB (standard TVs have very low RAM allotted to tabs)
          hlsConfig.backBufferLength = 3;        // Aggressively discard played frames to free memory
          hlsConfig.enableWorker = false;        // Disabling web worker avoids threading crashes in older JS engines
          hlsConfig.lowLatencyMode = false;      // Disable low-latency to maximize stream stability
          hlsConfig.fragLoadingTimeOut = 20000;  // Long loading timeouts to handle weak TV Wi-Fi receivers
          hlsConfig.manifestLoadingTimeOut = 20000;
          hlsConfig.levelLoadingTimeOut = 20000;
        } else {
          hlsConfig.maxBufferLength = 25;
          hlsConfig.maxMaxBufferLength = 45;
          hlsConfig.backBufferLength = 15;
        }

        const hls = new Hls(hlsConfig);
        hlsInstanceRef.current = hls;
        hls.loadSource(resolvedVideoUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          setVideoLoaded(true);
          if (isPlaying && !showEndScreen) video.play().catch(() => {});
        });

        let mediaErrorAttempts = 0;
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('Network error: attempting to reload stream...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                mediaErrorAttempts++;
                console.warn(`Media recovery attempt #${mediaErrorAttempts}...`);
                if (mediaErrorAttempts <= 3) {
                  hls.recoverMediaError();
                } else {
                  console.warn('Media recovery failed repeatedly. Swapping audio codecs and retrying...');
                  hls.swapAudioCodec();
                  hls.recoverMediaError();
                }
                break;
              default:
                console.error('Fatal HLS.js error. Unrecoverable.', data);
                setVideoError("Streaming network error. Please reload.");
                setIsBuffering(false);
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = resolvedVideoUrl;
        if (isPlaying && !showEndScreen) video.play().catch(() => {});
      } else {
        setVideoError("HLS/m3u8 playback unsupported."); setIsBuffering(false);
      }
    } else {
      video.src = resolvedVideoUrl;
      video.load();
      if (isPlaying && !showEndScreen) video.play().catch(() => {});
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [resolvedVideoUrl, mkvStartOffset, selectedAudioTrack, useRemux]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!resolvedVideoUrl || !useRemux) return;
    
    const fetchDuration = async () => {
      try {
        const res = await fetch(`/api/video/duration?url=${encodeURIComponent(resolvedVideoUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.duration) {
            setDuration(data.duration);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch MKV duration:", err);
      }
    };
    fetchDuration();
  }, [resolvedVideoUrl]);

  const saveProgressToFirestore = async (time: number, totalDur: number) => {
    if (!userId || !episode?.id || totalDur === 0) return;
    try {
      const progressId = `${userId}_${episode?.id}`;
      const completed = time / totalDur >= 0.92; 
      await setDoc(doc(db, 'watchHistory', progressId), {
        id: progressId, userId: userId, animeId: episode?.animeId, episodeId: episode?.id,
        animeTitle: animeTitle, episodeTitle: episode?.title, episodeNumber: episode?.number,
        seasonNumber: episode?.seasonNumber, progress: Math.floor(time), duration: Math.floor(totalDur),
        updatedAt: new Date(), completed, animeThumbnail: animeThumbnail, episodeThumbnail: episode?.thumbnailUrl 
      });
      if (completed && onEpisodeCompleted) onEpisodeCompleted();
    } catch (err) {}
  };

  const seekVideo = (target: number) => {
    if (!videoRef.current) return;
    setIsBuffering(true);
    if (useRemux) {
      setMkvStartOffset(target);
      const audioParam = selectedAudioTrack !== null ? `&audioStream=${selectedAudioTrack}` : '';
      videoRef.current.src = `/api/video/remux?url=${encodeURIComponent(resolvedVideoUrl)}&start=${Math.floor(target)}${audioParam}`;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
      setCurrentTime(target);
    } else {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
    
    if (watchPartyRoom && onWatchPartyAction) {
      onWatchPartyAction('seek', target);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || showEndScreen) return;
    const rawTime = videoRef.current.currentTime;
    const time = useRemux ? (mkvStartOffset + rawTime) : rawTime;
    if (!isDragging) setCurrentTime(time);
    
    if (Math.abs(time - lastSavedTimeRef.current) > 6) {
      lastSavedTimeRef.current = time;
      saveProgressToFirestore(time, duration);
    }

    // Auto Skip logic (when autoSkipEnabled setting is on)
    if (autoSkipEnabled && !isMovie) {
      if (hasIntroData && time >= Math.max(1, introStart) && time < (introEnd - 1) && autoSkippedIntroRef.current !== episode?.id) {
        autoSkippedIntroRef.current = episode?.id || 'active';
        seekVideo(introEnd);
        setAutoSkipToast("Auto-Skipped Intro");
        setTimeout(() => setAutoSkipToast(null), 2500);
      } else if (hasOutroData && time >= outroStart && time < (outroEnd - 1) && autoSkippedOutroRef.current !== episode?.id) {
        autoSkippedOutroRef.current = episode?.id || 'active';
        seekVideo(outroEnd);
        setAutoSkipToast("Auto-Skipped Outro");
        setTimeout(() => setAutoSkipToast(null), 2500);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    if (!useRemux) {
      setDuration(videoRef.current.duration);
    } else if (mkvMetadata && mkvMetadata.duration) {
      setDuration(mkvMetadata.duration);
    }
    setIsBuffering(false);
    setVideoLoaded(true);
    if (seekedRef.current !== episode?.id) {
      seekedRef.current = episode?.id;
      if (useRemux) {
        setCurrentTime(mkvStartOffset);
      } else {
        if (initialProgress && initialProgress > 0 && initialProgress < videoRef.current.duration) {
          try {
            videoRef.current.currentTime = initialProgress;
            setCurrentTime(initialProgress);
          } catch (err) {}
        }
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current || showEndScreen) return;
    if (watchPartyRoom) {
      if (!isHost) {
        setNonHostControlWarning(true);
        setTimeout(() => setNonHostControlWarning(false), 2500);
        return;
      }
    }

    if (isPlaying) {
      videoRef.current.pause();
      if (watchPartyRoom && onWatchPartyAction) {
        onWatchPartyAction('pause', useRemux ? (mkvStartOffset + videoRef.current.currentTime) : videoRef.current.currentTime);
      }
    } else {
      videoRef.current.play().catch(() => {});
      if (watchPartyRoom && onWatchPartyAction) {
        onWatchPartyAction('play', useRemux ? (mkvStartOffset + videoRef.current.currentTime) : videoRef.current.currentTime);
      }
    }
    setShowControls(true);
    setLastActivity(Date.now());
  };

  const skipTime = (amount: number, forceShowControls = true) => {
    if (!videoRef.current) return;
    if (watchPartyRoom) {
      if (!isHost) {
        setNonHostControlWarning(true);
        setTimeout(() => setNonHostControlWarning(false), 2500);
        return;
      }
    }

    let target = (useRemux ? (mkvStartOffset + videoRef.current.currentTime) : videoRef.current.currentTime) + amount;
    if (target < 0) target = 0;
    if (target > duration) target = duration;
    
    seekVideo(target);

    if (forceShowControls) {
      setShowControls(true);
      setLastActivity(Date.now());
    }
  };

  const skipToAbsolute = (timestampInSeconds: number) => {
    if (!videoRef.current || isNaN(timestampInSeconds)) return;
    if (watchPartyRoom) {
      if (!isHost) {
        setNonHostControlWarning(true);
        setTimeout(() => setNonHostControlWarning(false), 2500);
        return;
      }
    }

    seekVideo(timestampInSeconds);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || showEndScreen) return;
      if (e.key === ' ' || e.key === 'Enter') { 
        if (document.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault(); 
        togglePlay(); 
      }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setIsMuted(!isMuted); }
      else if (e.key === 'ArrowRight') { 
        e.preventDefault(); 
        skipTime(10, false); 
        setSkipAnim('forward'); 
        setTimeout(() => setSkipAnim(null), 600); 
      }
      else if (e.key === 'ArrowLeft') { 
        e.preventDefault(); 
        skipTime(-10, false); 
        setSkipAnim('backward'); 
        setTimeout(() => setSkipAnim(null), 600); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, showEndScreen, isMuted, duration, mkvStartOffset, resolvedVideoUrl, useRemux]);

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (watchPartyRoom && !isHost) {
      setNonHostControlWarning(true);
      setTimeout(() => setNonHostControlWarning(false), 2500);
      return; 
    }
    const targetValue = parseFloat(e.target.value);
    setDragTime(targetValue);
    if (videoRef.current && !useRemux) {
      videoRef.current.currentTime = targetValue;
    }
  };

  const handleScrubCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    if (watchPartyRoom) {
      if (!isHost) {
        setNonHostControlWarning(true);
        setTimeout(() => setNonHostControlWarning(false), 2500);
        return;
      }
    }
    const targetValue = parseFloat((e.target as HTMLInputElement).value);
    setIsDragging(false);
    seekVideo(targetValue);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    setHoverPercent(percent);
    setHoverTime(percent * duration);
  };

  // TOUCH & MOUSE LOGIC FOR OVERLAY
  const touchState = useRef({ startX: 0, startY: 0, moved: false, target: '' });
  const lastTapTime = useRef(0);
  const lastTouchTime = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = playerContainerRef.current?.getBoundingClientRect();
    const isLeft = touch.clientX < (rect?.left || 0) + (rect?.width || 0) / 2;
    touchState.current = { startX: touch.clientX, startY: touch.clientY, moved: false, target: isLeft ? 'volume' : 'brightness' };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isFullscreen && !isTheatreMode) {
      touchState.current.moved = true; 
      return; 
    }
    e.preventDefault(); 
    const touch = e.touches[0];
    const deltaY = touchState.current.startY - touch.clientY; 
    
    if (Math.abs(deltaY) > 5) {
      touchState.current.moved = true;
      touchState.current.startY = touch.clientY; 
      const sensitivity = 0.008;

      if (touchState.current.target === 'volume') {
        setVolume(v => {
          const newV = Math.max(0, Math.min(1, v + deltaY * sensitivity));
          if (newV > 0) setIsMuted(false);
          return newV;
        });
        setShowGestureUI('volume');
      } else {
        setBrightness(b => Math.max(0.1, Math.min(1, b + deltaY * sensitivity)));
        setShowGestureUI('brightness');
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTime.current = Date.now();
    if (touchState.current.moved) {
      setTimeout(() => setShowGestureUI(null), 1000);
      return;
    }

    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      const rect = playerContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const isLeft = touchState.current.startX < rect.left + rect.width / 2;
        if (isLeft) { skipTime(-10, false); setSkipAnim('backward'); }
        else { skipTime(10, false); setSkipAnim('forward'); }
        setTimeout(() => setSkipAnim(null), 600);
      }
      lastTapTime.current = 0;
      if (e.cancelable) e.preventDefault(); 
    } else {
      lastTapTime.current = now;
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      
      clickTimeoutRef.current = setTimeout(() => {
        setShowControls(prev => !prev);
        setLastActivity(Date.now()); // Naya timer trigger karega
        clickTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleMouseClick = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTime.current < 500) return;
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    clickTimeoutRef.current = setTimeout(() => {
      setShowControls(prev => !prev);
      setLastActivity(Date.now()); // Naya timer trigger karega
      clickTimeoutRef.current = null;
    }, 250); 
  };

  const handleMouseDoubleClick = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTime.current < 500) return;
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const rect = playerContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const isLeft = e.clientX < rect.left + rect.width / 2;
      if (isLeft) { skipTime(-10, false); setSkipAnim('backward'); }
      else { skipTime(10, false); setSkipAnim('forward'); }
      setTimeout(() => setSkipAnim(null), 600);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(()=>{});
    else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(()=>{});
    setShowControls(true);
    setLastActivity(Date.now());
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return "0:00";
    const hours = Math.floor(timeInSecs / 3600);
    const mins = Math.floor((timeInSecs % 3600) / 60);
    const secs = Math.floor(timeInSecs % 60);
    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    if (hours > 0) return `${hours}:${mute_leading_zero(mins)}:${formattedSecs}`;
    return `${mins}:${formattedSecs}`;
  };

  const mute_leading_zero = (val: number) => {
    return val < 10 ? `0${val}` : val;
  };

  const isMovie = 
    episode?.seasonId === 'movie_season' || 
    episode?.isMovie === true || 
    String(episode?.type || '').toLowerCase() === 'movie' || 
    String(animeType || '').toLowerCase() === 'movie' || 
    (!!animeTitle && animeTitle.toLowerCase().includes('movie')) ||
    (!!episode?.title && episode.title.toLowerCase().includes('movie'));

  const hasSetup = setupTimestamps !== null;

  // Recap
  const hasRecap = !isMovie && (hasSetup ? !!setupTimestamps.recap?.exists : !!episode?.hasSkipRecap);
  const recapStart = hasSetup && setupTimestamps.recap?.start !== undefined ? Number(setupTimestamps.recap.start) : (Number(episode?.recapShowAt) || 0);
  const recapEnd = hasSetup && setupTimestamps.recap?.end !== undefined ? Number(setupTimestamps.recap.end) : (recapStart + (Number(episode?.recapShowDuration) || 50));
  const showSkipRecapBtn = hasRecap && currentTime >= recapStart && currentTime <= recapEnd;

  // Intro
  const introStart = Number(
    hasSetup && setupTimestamps?.introStart !== undefined ? setupTimestamps.introStart :
    hasSetup && setupTimestamps?.intro?.start !== undefined ? setupTimestamps.intro.start :
    (episode?.introStart !== undefined ? episode.introStart :
    episode?.intro_start !== undefined ? episode.intro_start :
    episode?.introShowAt !== undefined ? episode.introShowAt : 0)
  );
  const introEnd = Number(
    hasSetup && setupTimestamps?.introEnd !== undefined ? setupTimestamps.introEnd :
    hasSetup && setupTimestamps?.intro?.end !== undefined ? setupTimestamps.intro.end :
    (episode?.introEnd !== undefined ? episode.introEnd :
    episode?.intro_end !== undefined ? episode.intro_end :
    episode?.introSkipTo !== undefined ? episode.introSkipTo : 0)
  );
  const hasIntroFlag = hasSetup
    ? (setupTimestamps.intro?.exists !== undefined ? setupTimestamps.intro.exists : (setupTimestamps.hasSkipIntro !== undefined ? setupTimestamps.hasSkipIntro : true))
    : (episode?.intro?.exists !== undefined ? episode.intro.exists : (episode?.hasSkipIntro !== undefined ? episode.hasSkipIntro : episode?.skip_intro_enabled !== undefined ? episode.skip_intro_enabled : true));

  const isDummyIntro = (introStart === 0) && (introEnd === 90 || introEnd === 135 || introEnd === 45) && (episode?.skipSource !== 'AniSkip' && setupTimestamps?.skipSource !== 'AniSkip');

  const hasIntroData = !isMovie && hasIntroFlag && introEnd > introStart && !isDummyIntro;
  const showSkipIntroBtn = hasIntroData && currentTime >= introStart && currentTime <= (introEnd + 2);

  // Outro
  const outroStart = Number(
    hasSetup && setupTimestamps?.outroStart !== undefined ? setupTimestamps.outroStart :
    hasSetup && setupTimestamps?.outro?.start !== undefined ? setupTimestamps.outro.start :
    (episode?.outroStart !== undefined ? episode.outroStart :
    episode?.outro_start !== undefined ? episode.outro_start :
    episode?.outroShowAt !== undefined ? episode.outroShowAt : 0)
  );
  const outroEnd = Number(
    hasSetup && setupTimestamps?.outroEnd !== undefined ? setupTimestamps.outroEnd :
    hasSetup && setupTimestamps?.outro?.end !== undefined ? setupTimestamps.outro.end :
    (episode?.outroEnd !== undefined ? episode.outroEnd :
    episode?.outro_end !== undefined ? episode.outro_end :
    episode?.outroSkipTo !== undefined ? episode.outroSkipTo : 0)
  );
  const hasOutroFlag = hasSetup
    ? (setupTimestamps.outro?.exists !== undefined ? setupTimestamps.outro.exists : (setupTimestamps.hasSkipOutro !== undefined ? setupTimestamps.hasSkipOutro : true))
    : (episode?.outro?.exists !== undefined ? episode.outro.exists : (episode?.hasSkipOutro !== undefined ? episode.hasSkipOutro : episode?.skip_outro_enabled !== undefined ? episode.skip_outro_enabled : true));

  const isDummyOutro = (outroStart === 1320) && (outroEnd === 1410) && (episode?.skipSource !== 'AniSkip' && setupTimestamps?.skipSource !== 'AniSkip');

  const hasOutroData = !isMovie && hasOutroFlag && outroEnd > outroStart && !isDummyOutro;
  const showSkipOutroBtn = hasOutroData && currentTime >= outroStart && currentTime <= (outroEnd + 2);

  // Preview
  const hasPreview = !isMovie && (hasSetup ? !!setupTimestamps.preview?.exists : false);
  const previewStart = Number(hasSetup && setupTimestamps.preview?.start !== undefined ? setupTimestamps.preview.start : 0);
  const previewEnd = Number(hasSetup && setupTimestamps.preview?.end !== undefined ? setupTimestamps.preview.end : 0);
  const showSkipPreviewBtn = hasPreview && previewEnd > previewStart && currentTime >= previewStart && currentTime <= (previewEnd + 2);

  const showNextEpPopUp = duration > 0 && currentTime >= (duration - 30) && currentTime < duration - 1;
  const displayTime = isDragging ? dragTime : currentTime;

  return (
    <div 
      id="custom-media-player-container"
      ref={playerContainerRef}
      onMouseMove={(e) => {
        if (Date.now() - lastTouchTime.current < 500) return; 
        if (Math.abs(e.clientX - lastMousePos.current.x) < 5 && Math.abs(e.clientY - lastMousePos.current.y) < 5) return;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setShowControls(true);
        setLastActivity(Date.now()); // Movement par timer refresh
      }}
      onMouseLeave={() => { if (isPlayingRef.current && !isDragging) setShowControls(false); }}
      className={`relative select-none overflow-hidden bg-black transition-all duration-300 rounded-xl border border-zinc-800/80 group flex items-center justify-center ${
        isTheatreMode && !isFullscreen ? 'aspect-[21/9] w-full max-w-7xl mx-auto' : 'aspect-video w-full'
      } ${showControls ? '' : 'cursor-none'}`} 
    >
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-75 z-10"
        style={{ backgroundColor: 'black', opacity: 1 - brightness }}
      />

      {isBuffering && !videoError && !showEndScreen && (
        <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none ${isSmartTV() ? 'bg-black/90' : 'bg-black/60 backdrop-blur-xs'}`}>
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-[10px] uppercase font-bold text-orange-400 mt-2 tracking-widest font-mono">
            {isAnalyzingCodecs ? "Analyzing media codecs..." : (useRemux ? "Preparing audio..." : "Buffering stream...")}
          </p>
        </div>
      )}

      {/* Season End Screen */}
      <AnimatePresence>
        {showEndScreen && (
          <TVDiv 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 ${isSmartTV() ? 'bg-zinc-950' : 'bg-black/85 backdrop-blur-md'}`}
          >
            {hasNextEpisode && nextEpisodePreview ? (
              <div className="text-center flex flex-col items-center w-full max-w-lg">
                <h3 className="text-zinc-400 font-black tracking-widest uppercase text-sm mb-5">
                  Up Next in <span className="text-orange-500 text-lg">{countdown}s</span>
                </h3>
                <div onClick={() => { setShowEndScreen(false); if (onNextEpisode) onNextEpisode(); }} className="relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-zinc-800 hover:border-orange-500 transition-all w-full aspect-video shadow-2xl">
                  <img src={nextEpisodePreview?.thumbnailUrl} alt="Next Episode" className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center shadow-neon-orange group-hover:scale-110 transition-transform">
                       <Play className="w-8 h-8 text-black fill-current ml-1" />
                     </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 text-left">
                     <p className="text-orange-400 font-bold text-xs uppercase tracking-wider mb-1">Episode {nextEpisodePreview?.number}</p>
                     <p className="text-white font-extrabold text-lg truncate">{nextEpisodePreview?.title}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <button onClick={() => setShowEndScreen(false)} className="px-6 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                    <X className="w-4 h-4" /> Cancel Auto-Play
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-lg p-10 bg-zinc-950/60 rounded-3xl border border-zinc-800/80 shadow-2xl">
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 uppercase tracking-widest drop-shadow-lg">Season <span className="text-orange-500">Finale</span></h2>
                <p className="text-zinc-400 font-semibold mb-8 text-sm leading-relaxed">You have reached the end of the currently available episodes for this season.</p>
                <div className="flex justify-center">
                   <button onClick={() => { setShowEndScreen(false); skipToAbsolute(0); togglePlay(); }} className="px-8 py-3.5 rounded-xl bg-zinc-800 hover:text-black text-white font-extrabold text-xs transition-all flex items-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg active:scale-95">
                     <RotateCcw className="w-4 h-4" /> Replay Episode
                   </button>
                </div>
              </div>
            )}
          </TVDiv>
        )}
      </AnimatePresence>

      {/* --- WATCH PARTY OVERLAYS --- */}
      <AnimatePresence>
        {watchPartyRoom && showControls && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-4 z-40 bg-zinc-950/85 backdrop-blur-md border border-orange-500/30 rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider font-mono text-white shadow-xl pointer-events-auto"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <Users className="w-3.5 h-3.5 text-orange-400" />
            <span>Party Active: <span className="text-orange-400">{watchPartyRoom.code}</span></span>
            <span className="px-1.5 py-0.5 bg-zinc-855 text-[8px] rounded text-zinc-400 font-bold ml-1 border border-zinc-700/50">
              {isHost ? 'Host' : 'Viewer'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nonHostControlWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 m-auto w-fit h-fit bg-black/90 backdrop-blur-md text-orange-400 border border-orange-500/30 px-5 py-3 rounded-xl flex items-center space-x-3 shadow-2xl z-50 font-mono text-[11px] font-black uppercase tracking-widest"
          >
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Playback is controlled by the Host</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!episode?.videoUrl && !videoError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
          <div className="max-w-md space-y-3 p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl">
            <History className="w-10 h-10 text-orange-500 mx-auto animate-pulse" />
            <h2 className="text-sm font-black tracking-wider uppercase text-orange-400 font-mono">No Video Stream Loaded</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">This episode does not have a video stream URL configured yet.</p>
          </div>
        </div>
      )}

      {episode?.videoUrl && !videoError && (
        <video
          autoPlay
          key={`${episode?.id || 'video'}`}
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain z-0"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => { setIsPlaying(false); setShowControls(false); setCountdown(3); setShowEndScreen(true); }}
          onError={() => setVideoError("Unable to load this episode. Please try again later.")}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onSeeked={() => setIsBuffering(false)}
          disablePictureInPicture={true}
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
          playsInline 
        >
          {useRemux && selectedSubtitleTrack !== null && (
            <track
              key={`sub_${selectedSubtitleTrack}`}
              src={`/api/video/mkv-subtitle?url=${encodeURIComponent(resolvedVideoUrl)}&track=${selectedSubtitleTrack}`}
              kind="subtitles"
              srcLang="en"
              label="MKV Subtitles"
              default
            />
          )}
        </video>
      )}

      {/* --- INVISIBLE CLICK/TAP LAYER --- */}
      {episode?.videoUrl && !videoError && !showEndScreen && (
        <div 
           className="absolute inset-0 z-20 cursor-pointer"
           onClick={handleMouseClick}
           onDoubleClick={handleMouseDoubleClick}
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd} 
        />
      )}

      {/* --- FLOATING ADVANCED CONTROLS (SKIP RECAP/INTRO/OUTRO) --- */}
      <div className="absolute bottom-24 right-6 md:right-8 z-[60] flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {showSkipRecapBtn && !showEndScreen && (
             <TVButton 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               onClick={(e: any) => { 
                 e.preventDefault(); 
                 e.stopPropagation(); 
                 lastTouchTime.current = Date.now();
                 skipToAbsolute(Number(episode?.recapSkipTo || episode?.introShowAt || 60)); 
               }}
               onTouchStart={(e: any) => { e.stopPropagation(); lastTouchTime.current = Date.now(); }}
               className={`pointer-events-auto border border-zinc-700 hover:border-orange-500 text-white hover:text-orange-400 font-bold text-xs px-4 py-2.5 rounded-lg transition-all uppercase tracking-wider shadow-lg cursor-pointer flex items-center space-x-2 active:scale-95 group ${isSmartTV() ? 'bg-zinc-900' : 'bg-zinc-900/90 backdrop-blur-md'}`}
             >
               <SkipForward className="w-4 h-4 transition-colors text-orange-400" />
               <span>Skip Recap</span>
             </TVButton>
          )}

          {autoSkipToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="pointer-events-auto bg-amber-500/90 text-black font-extrabold text-xs px-4 py-2 rounded-lg shadow-2xl flex items-center space-x-2 backdrop-blur-md"
            >
              <FastForward className="w-4 h-4 fill-current" />
              <span>{autoSkipToast}</span>
            </motion.div>
          )}

          {showSkipIntroBtn && !showEndScreen && !isMovie && (
             <TVButton 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               onClick={(e: any) => { 
                 e.preventDefault(); 
                 e.stopPropagation(); 
                 lastTouchTime.current = Date.now();
                 skipToAbsolute(introEnd); 
               }}
               onTouchStart={(e: any) => { e.stopPropagation(); lastTouchTime.current = Date.now(); }}
               className={`pointer-events-auto border border-zinc-700 hover:border-orange-500 text-white hover:text-orange-400 font-bold text-xs px-4 py-2.5 rounded-lg transition-all uppercase tracking-wider shadow-lg cursor-pointer flex items-center space-x-2 active:scale-95 group ${isSmartTV() ? 'bg-zinc-900' : 'bg-zinc-900/90 backdrop-blur-md'}`}
             >
               <SkipForward className="w-4 h-4 transition-colors text-amber-400" />
               <span>Skip Intro</span>
             </TVButton>
          )}

          {showSkipOutroBtn && !showEndScreen && !isMovie && (
             <TVButton 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               onClick={(e: any) => { 
                 e.preventDefault(); 
                 e.stopPropagation(); 
                 lastTouchTime.current = Date.now();
                 skipToAbsolute(outroEnd); 
               }}
               onTouchStart={(e: any) => { e.stopPropagation(); lastTouchTime.current = Date.now(); }}
               className={`pointer-events-auto border border-zinc-700 hover:border-orange-500 text-white hover:text-orange-400 font-bold text-xs px-4 py-2.5 rounded-lg transition-all uppercase tracking-wider shadow-lg cursor-pointer flex items-center space-x-2 active:scale-95 group ${isSmartTV() ? 'bg-zinc-900' : 'bg-zinc-900/90 backdrop-blur-md'}`}
             >
               <SkipForward className="w-4 h-4 transition-colors text-amber-400" />
               <span>Skip Credits</span>
             </TVButton>
          )}

          {showSkipPreviewBtn && !showEndScreen && (
             <TVButton 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               onClick={(e: any) => { 
                 e.preventDefault(); 
                 e.stopPropagation(); 
                 lastTouchTime.current = Date.now();
                 skipToAbsolute(previewEnd); 
               }}
               onTouchStart={(e: any) => { e.stopPropagation(); lastTouchTime.current = Date.now(); }}
               className={`pointer-events-auto border border-zinc-700 hover:border-orange-500 text-white hover:text-orange-400 font-bold text-xs px-4 py-2.5 rounded-lg transition-all uppercase tracking-wider shadow-lg cursor-pointer flex items-center space-x-2 active:scale-95 group ${isSmartTV() ? 'bg-zinc-900' : 'bg-zinc-900/90 backdrop-blur-md'}`}
             >
               <SkipForward className="w-4 h-4 transition-colors text-amber-400" />
               <span>Skip Preview</span>
             </TVButton>
          )}



          {showNextEpPopUp && !showEndScreen && (
             <TVDiv 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               className="pointer-events-auto"
             >
               {hasNextEpisode ? (
                 <button 
                   onClick={(e) => { 
                     e.preventDefault(); 
                     e.stopPropagation(); 
                     lastTouchTime.current = Date.now();
                     if (onNextEpisode) onNextEpisode(); 
                   }} 
                   onTouchStart={(e) => { e.stopPropagation(); lastTouchTime.current = Date.now(); }}
                   className="bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all uppercase tracking-wider shadow-lg cursor-pointer flex items-center space-x-2 active:scale-95"
                 >
                   <span>Next Episode</span>
                   <ArrowRight className="w-3.5 h-3.5" />
                 </button>
               ) : (
                 <div className={`border border-zinc-700 text-zinc-400 font-bold text-xs px-4 py-2.5 rounded-lg uppercase tracking-wider shadow-lg select-none ${isSmartTV() ? 'bg-zinc-900' : 'bg-zinc-900/90 backdrop-blur-sm'}`}>
                   No More Episodes
                 </div>
               )}
             </TVDiv>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showGestureUI === 'volume' && (
          <TVDiv 
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} 
            className={`absolute left-8 top-1/2 -translate-y-1/2 p-3 rounded-full flex flex-col items-center gap-3 border border-zinc-800 z-40 pointer-events-none ${isSmartTV() ? 'bg-zinc-900' : 'bg-black/60 backdrop-blur-md'}`}
          >
            {volume > 0 ? <Volume2 className="w-5 h-5 text-white"/> : <VolumeX className="w-5 h-5 text-red-500"/>}
            <div className="w-1.5 h-24 bg-zinc-800 rounded-full overflow-hidden flex items-end">
               <div className="w-full bg-orange-500 transition-all duration-75" style={{ height: `${volume * 100}%` }} />
            </div>
          </TVDiv>
        )}
        {showGestureUI === 'brightness' && (
          <TVDiv 
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} 
            className={`absolute right-8 top-1/2 -translate-y-1/2 p-3 rounded-full flex flex-col items-center gap-3 border border-zinc-800 z-40 pointer-events-none ${isSmartTV() ? 'bg-zinc-900' : 'bg-black/60 backdrop-blur-md'}`}
          >
            <Sun className="w-5 h-5 text-white"/>
            <div className="w-1.5 h-24 bg-zinc-800 rounded-full overflow-hidden flex items-end">
               <div className="w-full bg-orange-500 transition-all duration-75" style={{ height: `${brightness * 100}%` }} />
            </div>
          </TVDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {skipAnim === 'backward' && (
          <TVDiv 
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.5 }} exit={{ opacity: 0, scale: 1.8, filter: isSmartTV() ? 'none' : 'blur(4px)' }} 
            className="absolute left-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 pointer-events-none bg-black/40 p-4 rounded-full"
          >
            <RotateCcw className="w-8 h-8 text-white/90" />
            <span className="text-white/90 font-bold mt-1 text-[10px] font-mono">-10s</span>
          </TVDiv>
        )}
        {skipAnim === 'forward' && (
          <TVDiv 
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.5 }} exit={{ opacity: 0, scale: 1.8, filter: isSmartTV() ? 'none' : 'blur(4px)' }} 
            className="absolute right-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 pointer-events-none bg-black/40 p-4 rounded-full"
          >
            <RotateCw className="w-8 h-8 text-white/90" />
            <span className="text-white/90 font-bold mt-1 text-[10px] font-mono">+10s</span>
          </TVDiv>
        )}
      </AnimatePresence>

      {videoError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 p-4 sm:p-6 text-center text-zinc-100">
          <div className="max-w-md w-full space-y-4 p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-850 shadow-2xl shadow-black/80">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto animate-bounce" />
            <p className="text-sm font-semibold text-zinc-200">Unable to load this episode. Please try again later.</p>
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={() => window.location.reload()} className="bg-zinc-800 font-bold text-xs text-zinc-300 px-5 py-2.5 rounded-lg active:scale-95 transition-all cursor-pointer border border-zinc-700 font-mono">Refresh Page</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CENTRAL PLAY/PAUSE & ON-SCREEN SKIP BUTTONS --- */}
      {!videoError && resolvedVideoUrl && !showEndScreen && showControls && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center gap-6 md:gap-14 pointer-events-none transition-all duration-300 z-[60]">
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipTime(-10, true); }}
            className="transform active:scale-95 text-white transition-all pointer-events-auto cursor-pointer p-4 outline-none"
            title="Rewind 10 Seconds"
          >
            <RotateCcw className="w-8 h-8 md:w-12 md:h-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </button>

          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlay(); }}
            className="transform active:scale-95 text-white transition-all pointer-events-auto cursor-pointer p-4 md:p-6 outline-none"
          >
            {isPlaying ? <Pause className="w-12 h-12 md:w-16 md:h-16 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" fill="currentColor" /> : <Play className="w-12 h-12 md:w-16 md:h-16 ml-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" fill="currentColor" /> }
          </button>

          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipTime(10, true); }}
            className="transform active:scale-95 text-white transition-all pointer-events-auto cursor-pointer p-4 outline-none"
            title="Forward 10 Seconds"
          >
            <RotateCw className="w-8 h-8 md:w-12 md:h-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </button>
        </div>
      )}

      <div 
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent pt-20 pb-4 px-5 transition-all duration-300 z-50 flex flex-col justify-end ${
          showControls && !showEndScreen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-3 w-full mb-3.5 relative">
          <span className="text-[10px] font-bold text-zinc-400 font-mono select-none w-10 text-left">{formatTime(displayTime)}</span>
          
          <div 
            className="relative flex-1 group/slider flex items-center h-4 cursor-pointer"
            ref={progressBarRef as any}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={() => setHoverTime(null)}
          >
            {(hoverTime !== null || isDragging) && (
              <div 
                className="absolute bottom-8 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50 transition-all duration-75"
                style={{ left: `${isDragging ? (dragTime / (duration || 1)) * 100 : hoverPercent * 100}%` }}
              >
                <div className="bg-zinc-950/90 border border-zinc-700 w-[120px] aspect-video rounded-md mb-1.5 shadow-2xl overflow-hidden flex flex-col items-center justify-center backdrop-blur-sm">
                   <Tv className="w-6 h-6 text-zinc-600 mb-1" />
                   <span className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest font-bold">Preview Time</span>
                </div>
                <div className="bg-orange-500 text-black font-extrabold text-[11px] py-1 px-2.5 rounded border border-orange-400 font-mono shadow-xl relative">
                  {formatTime(isDragging ? dragTime : (hoverTime || 0))}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rotate-45 border-b border-r border-orange-400"></div>
                </div>
              </div>
            )}

            <input
              type="range"
              min={0}
              max={duration || 100}
              value={displayTime}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              onChange={handleScrubChange}
              onTouchEnd={handleScrubCommit}
              onMouseUp={handleScrubCommit}
              className="w-full h-1 rounded-full appearance-none bg-zinc-700 accent-orange-500 outline-none group-hover/slider:h-1.5 transition-all relative z-10 cursor-pointer"
              style={{ background: `linear-gradient(to right, #f97316 0%, #f97316 ${(displayTime / (duration || 1)) * 100}%, #3f3f46 ${(displayTime / (duration || 1)) * 100}%, #3f3f46 100%)` }}
            />
          </div>

          <span className="text-[10px] font-bold text-zinc-400 font-mono select-none w-10 text-right">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3.5">
            {/* Chota Play Button */}
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlay(); }} 
              className="text-white transition-colors cursor-pointer active:scale-90"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-5.5 h-5.5" /> : <Play className="w-5.5 h-5.5 fill-current" />}
            </button>
            
            {/* REAL 10s Skip Buttons */}
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipTime(-10, true); }} 
              title="Rewind 10s" 
              className="text-white transition-colors cursor-pointer active:scale-90"
            >
              <RotateCcw className="w-4.5 h-4.5" />
            </button>
            
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); skipTime(10, true); }} 
              title="Forward 10s" 
              className="text-white transition-colors cursor-pointer active:scale-90"
            >
              <RotateCw className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center space-x-2 group/volume ml-1.5">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMuted(!isMuted); }} 
                className="text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5 text-orange-500" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if(v>0) setIsMuted(false); }}
                className="w-0 overflow-hidden group-hover/volume:w-16 h-1 rounded bg-zinc-700 accent-orange-500 appearance-none outline-none transition-all duration-300"
              />
            </div>

            <div className="hidden md:block pl-3 border-l border-zinc-800 text-left">
              <p className="text-[10px] font-bold text-zinc-500 truncate max-w-[180px] font-mono uppercase tracking-wider">{animeTitle}</p>
              <h3 className="text-xs font-bold text-white truncate max-w-[220px]">
                {episode?.seasonId === 'movie_season' ? 'Standalone Feature Film' : `S${episode?.seasonNumber} E${episode?.number}: ${episode?.title}`}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-3.5 relative">
            {useRemux && mkvMetadata && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMkvSettings(!showMkvSettings); setShowSpeedMenu(false); }}
                  className="text-zinc-300 text-[10px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md flex items-center space-x-1 cursor-pointer font-mono hover:bg-zinc-800 transition-colors"
                >
                  <Languages className="w-3 h-3 text-zinc-400" />
                  <span>Tracks</span>
                </button>

                <AnimatePresence>
                  {showMkvSettings && (
                    <TVDiv
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-9 right-0 bg-zinc-950/95 border border-zinc-800 p-3 rounded-lg shadow-2xl flex flex-col min-w-[200px] z-50 backdrop-blur-md text-left text-xs text-white max-h-[300px] overflow-y-auto scrollbar-thin"
                    >
                      {/* Audio Tracks Selection */}
                      <div className="mb-3">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-black mb-1.5 font-mono">Audio Dub</p>
                        <div className="space-y-1">
                          {mkvMetadata.audioTracks && mkvMetadata.audioTracks.length > 0 ? (
                            mkvMetadata.audioTracks.map((track) => (
                              <button
                                key={`audio_${track.index}`}
                                onClick={() => {
                                  setSelectedAudioTrack(track.index);
                                  setShowMkvSettings(false);
                                }}
                                className={`w-full text-left text-[10px] font-semibold px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                                  selectedAudioTrack === track.index
                                    ? 'bg-orange-500 text-black font-extrabold'
                                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                }`}
                              >
                                <span className="truncate max-w-[120px]">{track.title}</span>
                                <span className="text-[8px] opacity-70 uppercase font-mono">{track.language}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-[10px] text-zinc-500 italic px-2">Default track</p>
                          )}
                        </div>
                      </div>

                      {/* Subtitles Track Selection */}
                      <div className="border-t border-zinc-800/80 pt-2.5">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-black mb-1.5 font-mono">Subtitles</p>
                        <div className="space-y-1">
                          {/* Option to turn subtitles OFF */}
                          <button
                            onClick={() => {
                              setSelectedSubtitleTrack(null);
                              setShowMkvSettings(false);
                            }}
                            className={`w-full text-left text-[10px] font-semibold px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                              selectedSubtitleTrack === null
                                ? 'bg-orange-500 text-black font-extrabold'
                                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                            }`}
                          >
                            <span>Off</span>
                          </button>

                          {mkvMetadata.subtitleTracks && mkvMetadata.subtitleTracks.length > 0 ? (
                            mkvMetadata.subtitleTracks.map((track) => (
                              <button
                                key={`sub_${track.index}`}
                                onClick={() => {
                                  setSelectedSubtitleTrack(track.index);
                                  setShowMkvSettings(false);
                                }}
                                className={`w-full text-left text-[10px] font-semibold px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                                  selectedSubtitleTrack === track.index
                                    ? 'bg-orange-500 text-black font-extrabold'
                                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                }`}
                              >
                                <span className="truncate max-w-[120px]">{track.title}</span>
                                <span className="text-[8px] opacity-70 uppercase font-mono">{track.language}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-[10px] text-zinc-500 italic px-2">No subtitle tracks</p>
                          )}
                        </div>
                      </div>
                    </TVDiv>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); setShowMkvSettings(false); }}
                className="text-zinc-300 text-[10px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md flex items-center space-x-1 cursor-pointer font-mono hover:bg-zinc-800"
              >
                <Settings className="w-3 h-3 text-zinc-400" />
                <span>{playbackRate}x</span>
              </button>

              <AnimatePresence>
                {showSpeedMenu && (
                  <TVDiv
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-9 right-0 bg-zinc-900/95 border border-zinc-800 p-1 rounded-md shadow-xl flex flex-col min-w-[85px] z-50"
                  >
                    {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`text-left text-[10px] font-semibold px-2 py-1.5 rounded transition-colors font-mono ${
                          playbackRate === rate ? 'bg-orange-500 text-black font-extrabold' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    ))}
                  </TVDiv>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsTheatreMode(!isTheatreMode)} 
              title={isTheatreMode ? "Exit Theatre Mode" : "Theatre Mode"} 
              className={`hidden md:block transition-colors cursor-pointer hover:text-white ${isTheatreMode ? 'text-orange-500' : 'text-zinc-400'}`}
            >
              <Tv className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={toggleFullscreen} 
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} 
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4.5 h-4.5" /> : <Maximize className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
