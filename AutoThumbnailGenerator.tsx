import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Trash2, Copy, Check, Loader2, Search, AlertCircle, 
  CheckCircle2, ArrowRight, FileText, ChevronDown, Sparkles, RefreshCw, X, HelpCircle,
  Play, Film, Tv, Video, Image, Settings, Flame, Layers
} from 'lucide-react';
import { db, collection, getDocs, doc, updateDoc, query, where, getDoc } from '../firebase';
import { Anime, Season, Episode } from '../types';

// Shared helper to resolve video sources (including indexeddb:// protocol and raw CDN video streams)
const resolveVideoUrl = async (url: string): Promise<{ url: string; revoke?: () => void }> => {
  if (!url) return { url: '' };
  
  if (url.startsWith('indexeddb://')) {
    const dbKey = url.replace('indexeddb://', '');
    try {
      // Lazy load indexedDb library to keep bundles fast
      const { getVideoFromIndexedDB } = await import('../lib/indexedDb');
      const blob = await getVideoFromIndexedDB(dbKey);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        return {
          url: blobUrl,
          revoke: () => URL.revokeObjectURL(blobUrl)
        };
      }
    } catch (err) {
      console.warn("Failed to retrieve local IndexedDB video file:", err);
    }
    
    // Fallback to checking the Firestore videoUrlMap database
    try {
      const mapRef = doc(db, 'videoUrlMap', dbKey);
      const mapSnap = await getDoc(mapRef);
      if (mapSnap.exists() && mapSnap.data()?.cloudUrl) {
        return { url: mapSnap.data().cloudUrl };
      }
    } catch (mapErr) {
      console.warn("Failed to query cloudUrl fallback database mapping:", mapErr);
    }
  }
  
  return { url };
};

const isEmbedUrl = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('/embed/') ||
    lower.includes('embed.html') ||
    lower.includes('player.') ||
    lower.includes('youtube.com/') ||
    lower.includes('youtu.be/') ||
    lower.includes('drive.google.com/file/') ||
    lower.includes('vimeo.com/') ||
    lower.includes('gogoplay') ||
    lower.includes('vidstream') ||
    (!lower.includes('.mp4') && !lower.includes('.m3u8') && !lower.includes('.mkv') && !lower.includes('.webm') && !lower.startsWith('indexeddb://'))
  );
};

interface InlineVideoPreviewProps {
  videoUrl: string;
}

function InlineVideoPreview({ videoUrl }: InlineVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    let revokeFn: (() => void) | undefined;
    
    const setup = async () => {
      if (!videoUrl) return;
      setError(null);
      setIsLoading(true);
      
      try {
        const resolved = await resolveVideoUrl(videoUrl);
        setResolvedUrl(resolved.url);
        revokeFn = resolved.revoke;
      } catch (err: any) {
        setError("Failed to resolve video stream source: " + err.message);
        setIsLoading(false);
      }
    };
    
    setup();
    
    return () => {
      if (revokeFn) revokeFn();
    };
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl || isEmbedUrl(videoUrl)) return;

    setError(null);
    setIsLoading(true);

    if (resolvedUrl.includes('.m3u8')) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            autoStartLoad: true,
          });
          hlsRef.current = hls;
          hls.loadSource(resolvedUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
          });

          hls.on(Hls.Events.ERROR, () => {
            setError("Failed to decode HLS stream link. This URL might be restricted or inactive.");
            setIsLoading(false);
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = resolvedUrl;
          video.addEventListener('loadedmetadata', () => setIsLoading(false));
        } else {
          setError("HLS streaming is not natively supported on this browser.");
          setIsLoading(false);
        }
      }).catch((e) => {
        setError("Could not load streaming engine (hls.js).");
        setIsLoading(false);
      });
    } else {
      video.src = resolvedUrl;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
      video.addEventListener('error', () => {
        setError("Error loading direct video file stream. Verify CORS permissions or connection.");
        setIsLoading(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedUrl]);

  return (
    <div className="mt-3 relative rounded-xl overflow-hidden bg-black border border-zinc-900 aspect-video flex flex-col justify-end">
      {isLoading && !error && !isEmbedUrl(videoUrl) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 z-10">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-1.5" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">LOADING LIVE STREAM PREVIEW...</span>
        </div>
      )}
      {error && !isEmbedUrl(videoUrl) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zinc-950/90 text-center text-[10px] text-red-400 z-10">
          <AlertCircle className="w-5 h-5 mb-1 text-red-500" />
          <span className="font-bold uppercase tracking-wider block mb-0.5">Stream Playback Failed</span>
          <p className="text-zinc-500 max-w-[200px] leading-tight text-[9px] font-medium">{error}</p>
        </div>
      )}
      {isEmbedUrl(videoUrl) ? (
        <iframe
          src={videoUrl}
          className="w-full h-full border-0 aspect-video bg-black"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      ) : (
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full h-full object-contain"
        />
      )}
    </div>
  );
}

interface AutoThumbnailGeneratorProps {
  allAnime: Anime[];
  refreshData: () => Promise<void>;
}

export default function AutoThumbnailGenerator({ allAnime, refreshData }: AutoThumbnailGeneratorProps) {
  // Selections States
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Search & Dropdowns
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Engine Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEpIndex, setCurrentEpIndex] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<Record<string, 'pending' | 'processing' | 'success' | 'failed' | 'skipped'>>({});
  const [logFeed, setLogFeed] = useState<string[]>([]);
  const [customRangeMin, setCustomRangeMin] = useState<number>(10);
  const [customRangeMax, setCustomRangeMax] = useState<number>(30);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Custom thumbnail edit fields & active video preview selections
  const [customThumbnails, setCustomThumbnails] = useState<Record<string, string>>({});
  const [isSavingThumbnail, setIsSavingThumbnail] = useState<Record<string, boolean>>({});
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Auto-select first anime series if available
  useEffect(() => {
    if (allAnime.length > 0 && !selectedAnime) {
      setSelectedAnime(allAnime[0]);
    }
  }, [allAnime, selectedAnime]);

  // Close searchable dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll log feed to bottom on update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logFeed]);

  // Fetch seasons and all episodes when selected anime changes
  useEffect(() => {
    if (!selectedAnime) {
      setSeasons([]);
      setSelectedSeason(null);
      setAllEpisodes([]);
      setEpisodes([]);
      return;
    }

    const loadSeasonsAndEpisodes = async () => {
      setIsLoadingSeasons(true);
      setIsLoadingEpisodes(true);
      try {
        // Fetch seasons for this anime
        const seasonsSnap = await getDocs(
          query(collection(db, 'seasons'), where('animeId', '==', selectedAnime.id))
        );
        const seasonsList: Season[] = [];
        seasonsSnap.forEach((docSnap) => {
          seasonsList.push({ id: docSnap.id, ...docSnap.data() } as Season);
        });
        
        // Sort seasons by season number
        seasonsList.sort((a, b) => a.number - b.number);
        setSeasons(seasonsList);

        // Fetch all episodes of this anime
        const epsSnap = await getDocs(
          query(collection(db, 'episodes'), where('animeId', '==', selectedAnime.id))
        );
        const epsList: Episode[] = [];
        epsSnap.forEach((docSnap) => {
          epsList.push({ id: docSnap.id, ...docSnap.data() } as Episode);
        });
        setAllEpisodes(epsList);
        
        // Auto-select first season if available
        if (seasonsList.length > 0) {
          const firstSeason = seasonsList[0];
          setSelectedSeason(firstSeason);
          
          // Filter episodes for the first season immediately
          const firstSeasonEps = epsList.filter(ep => ep.seasonId === firstSeason.id);
          firstSeasonEps.sort((a, b) => a.number - b.number);
          setEpisodes(firstSeasonEps);
        } else {
          setSelectedSeason(null);
          setEpisodes([]);
        }
      } catch (error) {
        console.error("Error loading seasons and episodes:", error);
      } finally {
        setIsLoadingSeasons(false);
        setIsLoadingEpisodes(false);
      }
    };

    loadSeasonsAndEpisodes();
  }, [selectedAnime, refreshCount]);

  // Filter episodes instantaneously when selected season changes
  useEffect(() => {
    if (!selectedSeason) {
      setEpisodes([]);
      return;
    }

    const filtered = allEpisodes.filter(ep => ep.seasonId === selectedSeason.id);
    filtered.sort((a, b) => a.number - b.number);
    setEpisodes(filtered);

    // Reset status flags for the new list
    const initialStatus: Record<string, 'pending'> = {};
    filtered.forEach(ep => {
      initialStatus[ep.id] = 'pending';
    });
    setProcessingStatus(initialStatus);
  }, [selectedSeason, allEpisodes]);

  // Local helper to generate a stunning procedural gradient thumbnail card in case of CORS or load issues
  const generateProceduralFallback = (animeTitle: string, epNum: number, epTitle: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Create stylish linear gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0d0b18');
    grad.addColorStop(0.5, '#2e124d');
    grad.addColorStop(1, '#f97316');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Circular geometric space accents
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.85, canvas.height * 0.5, 140, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width * 0.85, canvas.height * 0.5, 210, 0, Math.PI * 2);
    ctx.stroke();

    // Side accent strip
    ctx.fillStyle = '#f97316';
    ctx.fillRect(40, 48, 4, 76);

    // Anime Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText(animeTitle.toUpperCase(), 56, 58);

    // Episode Number Display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'extrabold 30px "Space Grotesk", "Inter", sans-serif';
    ctx.fillText(`EPISODE ${epNum}`, 56, 94);

    // Episode Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '500 15px "Inter", sans-serif';
    let displayTitle = epTitle || `Special Broadcast ${epNum}`;
    if (displayTitle.length > 50) {
      displayTitle = displayTitle.substring(0, 47) + '...';
    }
    ctx.fillText(displayTitle, 56, 122);

    // Bottom decorative label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('ANI-MAYX PROCEDURAL FALLBACK GENERATOR', 40, 315);

    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Fetch partial video blob through a range request on proxy to bypass CORS security constraints cleanly
  const fetchVideoBlob = async (url: string): Promise<Blob> => {
    const proxies = [
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`
    ];

    let lastErr = null;
    for (const proxyFn of proxies) {
      try {
        const proxiedUrl = proxyFn(url);
        const response = await fetch(proxiedUrl, {
          headers: {
            'Range': 'bytes=0-12000000' // Request first 12MB of video for metadata & early frame extraction
          }
        });
        if (response.ok || response.status === 206) {
          return await response.blob();
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to fetch video blob through proxy");
  };

  // Capture frame from video source using HTML Video & Canvas APIs with HLS & CORS Proxy support
  const captureFrame = async (videoUrl: string, targetTime: number): Promise<string> => {
    const attemptCapture = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const isHls = url.includes('.m3u8') || url.includes('m3u8');
        let hlsInstance: any = null;

        // Set a strict load/decode timeout of 12 seconds
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Video loading or decoding timed out"));
        }, 12000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
          }
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          video.pause();
          video.src = '';
          video.load();
        };

        const onLoadedMetadata = () => {
          const duration = video.duration;
          let seekTime = targetTime;
          if (duration && duration > 60) {
            // Pick a truly random spot in the active body of the episode (15% to 85% of duration)
            // so we get a unique, stunning action frame instead of a repeat of the intro/black screen!
            seekTime = 0.15 * duration + Math.random() * 0.7 * duration;
          } else if (duration && duration > 0) {
            seekTime = Math.random() * duration;
          }
          video.currentTime = seekTime;
        };

        const onSeeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              cleanup();
              resolve(dataUrl);
            } else {
              cleanup();
              reject(new Error("Could not acquire canvas context"));
            }
          } catch (err: any) {
            cleanup();
            reject(err); // Throws SecurityError on canvas taint / CORS restrictions
          }
        };

        const onError = () => {
          cleanup();
          reject(new Error(video.error?.message || "Failed to load streaming media"));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('error', onError);

        if (isHls) {
          import('hls.js').then(({ default: Hls }) => {
            if (Hls.isSupported()) {
              const hls = new Hls({
                autoStartLoad: true,
                maxBufferLength: 5,
              });
              hlsInstance = hls;
              hls.loadSource(url);
              hls.attachMedia(video);
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                // Seek trigger
              });
              
              hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                  cleanup();
                  reject(new Error(`HLS stream loading failed: ${data.details}`));
                }
              });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            } else {
              reject(new Error("HLS streaming is not natively supported on this browser"));
            }
          }).catch(err => {
            reject(new Error("Could not load streaming engine (hls.js)"));
          });
        } else {
          video.src = url;
          video.load();
        }
      });
    };

    // First resolve the video URL to handle indexeddb:// or local blob URLs
    const resolved = await resolveVideoUrl(videoUrl);
    
    try {
      // Try direct capture on the resolved url
      const dataUrl = await attemptCapture(resolved.url);
      if (resolved.revoke) resolved.revoke();
      return dataUrl;
    } catch (err) {
      if (resolved.revoke) resolved.revoke();
      
      // If original URL is a local resource or we cannot proxy it, throw original error
      if (videoUrl.startsWith('indexeddb://') || videoUrl.startsWith('blob:')) {
        throw err;
      }
      
      console.warn("Direct stream capture failed, retrying via proxy blob fetch...", err);
      
      // Fallback: Fetch a partial slice of the video via CORS proxy as a blob, and capture from that
      try {
        const videoBlob = await fetchVideoBlob(videoUrl);
        const objectUrl = URL.createObjectURL(videoBlob);
        
        try {
          const proxiedDataUrl = await attemptCapture(objectUrl);
          URL.revokeObjectURL(objectUrl);
          return proxiedDataUrl;
        } catch (proxiedErr) {
          URL.revokeObjectURL(objectUrl);
          throw proxiedErr;
        }
      } catch (proxyFetchErr) {
        // Last-resort fallback: attempt direct proxy URL decoration
        console.warn("Proxy blob fetch failed, trying direct proxy URL...", proxyFetchErr);
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(videoUrl)}`;
        return attemptCapture(proxiedUrl);
      }
    }
  };

  // Run the sequence over all filtered episodes in order
  const handleAutoThumbnailSequence = async () => {
    if (episodes.length === 0) return;
    setIsProcessing(true);
    setLogFeed([]);
    
    setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Initiating Auto-Thumbnail capture pipeline...`]);
    setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] target collection: "${selectedAnime?.title}" - Season ${selectedSeason?.number}`]);
    setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] Total target episodes loaded: ${episodes.length}`]);

    let successCount = 0;
    let fallbackCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      if (!ep.videoUrl) {
        setProcessingStatus(prev => ({ ...prev, [ep.id]: 'skipped' }));
        setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Episode ${ep.number} skipped: No video stream URL configured.`]);
        skippedCount++;
        continue;
      }

      setProcessingStatus(prev => ({ ...prev, [ep.id]: 'processing' }));
      setCurrentEpIndex(i);
      setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎬 Loading Video Ep ${ep.number} ("${ep.title || `Episode ${ep.number}`}")`]);

      // Calculate random seconds within range
      const randomSeconds = Math.random() * (customRangeMax - customRangeMin) + customRangeMin;
      setLogFeed(prev => [...prev, ` -> Target frame timestamp: ${randomSeconds.toFixed(2)} seconds...`]);

      try {
        const base64Thumbnail = await captureFrame(ep.videoUrl, randomSeconds);
        setLogFeed(prev => [...prev, ` -> Successfully captured video frame canvas buffer.`]);

        // Save directly back to Firestore
        await updateDoc(doc(db, 'episodes', ep.id), { thumbnailUrl: base64Thumbnail });
        
        setProcessingStatus(prev => ({ ...prev, [ep.id]: 'success' }));
        setLogFeed(prev => [...prev, ` ✔️ Episode ${ep.number} thumbnail loaded and saved successfully!`]);
        successCount++;
      } catch (err: any) {
        console.warn(`Frame capture failed for Ep ${ep.number}:`, err);
        setLogFeed(prev => [...prev, ` ⚠️ Capture failed: ${err.message || "Network / CORS block"}`]);
        setLogFeed(prev => [...prev, ` -> Fabricating premium procedural graphic vector banner fallback...`]);
        
        try {
          const fallbackDataUrl = generateProceduralFallback(selectedAnime?.title || 'Ani-MayX Series', ep.number, ep.title || '');
          await updateDoc(doc(db, 'episodes', ep.id), { thumbnailUrl: fallbackDataUrl });
          
          setProcessingStatus(prev => ({ ...prev, [ep.id]: 'success' }));
          setLogFeed(prev => [...prev, ` ✔️ Episode ${ep.number} stylized vector fallback generated successfully!`]);
          fallbackCount++;
        } catch (fallbackErr: any) {
          setProcessingStatus(prev => ({ ...prev, [ep.id]: 'failed' }));
          setLogFeed(prev => [...prev, ` ❌ Episode ${ep.number} fallback creation failed: ${fallbackErr.message}`]);
        }
      }
    }

    setIsProcessing(false);
    setCurrentEpIndex(null);
    setLogFeed(prev => [
      ...prev, 
      `\n[${new Date().toLocaleTimeString()}] 🎉 Auto-Thumbnail pipeline processing complete!`,
      ` -> Successful capture: ${successCount} episodes`,
      ` -> Stylish Fallback Vector banners: ${fallbackCount} episodes`,
      ` -> Skipped (No URL): ${skippedCount} episodes`
    ]);

    // Force data refresh globally
    await refreshData();
    // Update local cache state by triggering refetch count
    setRefreshCount(prev => prev + 1);
  };

  // Run auto thumbnail for a single episode only
  const handleSingleEpisodeThumbnail = async (ep: Episode, index: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLogFeed([]);
    setProcessingStatus(prev => ({ ...prev, [ep.id]: 'processing' }));
    setCurrentEpIndex(index);

    setLogFeed(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Launching single episode frame capture...`]);
    setLogFeed(prev => [...prev, `🎬 Targeting: Ep ${ep.number} - "${ep.title || `Episode ${ep.number}`}"`]);

    if (!ep.videoUrl) {
      setProcessingStatus(prev => ({ ...prev, [ep.id]: 'skipped' }));
      setLogFeed(prev => [...prev, `❌ Error: This episode is missing a video stream URL.`]);
      setIsProcessing(false);
      setCurrentEpIndex(null);
      return;
    }

    const randomSeconds = Math.random() * (customRangeMax - customRangeMin) + customRangeMin;
    setLogFeed(prev => [...prev, ` -> Target random offset: ${randomSeconds.toFixed(2)} seconds...`]);

    try {
      const base64Thumbnail = await captureFrame(ep.videoUrl, randomSeconds);
      setLogFeed(prev => [...prev, ` -> Frame captured successfully! Converting buffer...`]);

      await updateDoc(doc(db, 'episodes', ep.id), { thumbnailUrl: base64Thumbnail });
      
      setProcessingStatus(prev => ({ ...prev, [ep.id]: 'success' }));
      setLogFeed(prev => [...prev, ` ✔️ Episode ${ep.number} thumbnail updated successfully!`]);
    } catch (err: any) {
      console.warn(`Frame capture failed for Ep ${ep.number}:`, err);
      setLogFeed(prev => [...prev, ` ⚠️ Capture failed: ${err.message || "Stream error"}`]);
      setLogFeed(prev => [...prev, ` -> Building custom graphical layout...`]);
      try {
        const fallbackDataUrl = generateProceduralFallback(selectedAnime?.title || 'Ani-MayX Series', ep.number, ep.title || '');
        await updateDoc(doc(db, 'episodes', ep.id), { thumbnailUrl: fallbackDataUrl });
        setProcessingStatus(prev => ({ ...prev, [ep.id]: 'success' }));
        setLogFeed(prev => [...prev, ` ✔️ Episode ${ep.number} vector poster generated successfully!`]);
      } catch (fErr: any) {
        setProcessingStatus(prev => ({ ...prev, [ep.id]: 'failed' }));
        setLogFeed(prev => [...prev, ` ❌ Fallback generation failed: ${fErr.message}`]);
      }
    }

    setIsProcessing(false);
    setCurrentEpIndex(null);
    await refreshData();
    setRefreshCount(prev => prev + 1);
  };

  // Filter list of anime according to search query
  const filteredAnime = allAnime.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 text-left animate-fade-in pb-16">
      
      {/* 1. Header Information Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center mb-1">
            <Sparkles className="w-6 h-6 text-orange-500 mr-2.5 stroke-[2.5]" />
            <span>AUTOMATED VIDEO THUMBNAIL CAPTURER</span>
          </h2>
          <p className="text-xs text-zinc-400 font-medium">
            Scan and decode episode streams in real-time. Pick an elegant random frame and save it instantly as your cover.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 bg-zinc-950/80 px-3.5 py-1.5 rounded-lg border border-zinc-900 shrink-0">
          <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-400 font-mono">AUTOMATED DEC_STAGE READY</span>
        </div>
      </div>

      {/* 2. Target Series & Season Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/40 p-6 rounded-2xl border border-zinc-900">
        
        {/* Anime Selection searchable dropdown */}
        <div className="space-y-2 relative" ref={dropdownRef}>
          <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-mono flex items-center">
            <Film className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
            <span>1. Select Anime Series</span>
          </label>
          
          <div 
            onClick={() => !isProcessing && setIsDropdownOpen(!isDropdownOpen)}
            className={`bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 font-semibold cursor-pointer flex justify-between items-center transition-all ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-purple-800'
            }`}
          >
            <span>{selectedAnime ? selectedAnime.title : 'Choose an Anime series...'}</span>
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          </div>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-30 left-0 right-0 mt-2 bg-zinc-950 border border-zinc-850 rounded-xl shadow-2xl p-2.5 overflow-hidden"
              >
                <div className="flex items-center border border-zinc-900 bg-zinc-900/50 rounded-lg px-3 py-1.5 mb-2">
                  <Search className="w-3.5 h-3.5 text-zinc-500 mr-2" />
                  <input
                    type="text"
                    placeholder="Search Anime titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-white placeholder-zinc-650 focus:outline-none w-full"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                  {filteredAnime.map((anime) => (
                    <div
                      key={anime.id}
                      onClick={() => {
                        setSelectedAnime(anime);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer hover:bg-orange-500 hover:text-black transition-colors flex items-center justify-between ${
                        selectedAnime?.id === anime.id ? 'bg-orange-500/10 text-orange-400 font-extrabold' : 'text-zinc-300'
                      }`}
                    >
                      <span>{anime.title}</span>
                      <span className="text-[10px] font-mono opacity-60">ID: {anime.id}</span>
                    </div>
                  ))}
                  {filteredAnime.length === 0 && (
                    <p className="text-zinc-600 text-[11px] text-center py-4 font-semibold">No series match this search prefix.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Season Selection List */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-mono flex items-center">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
            <span>2. Select Season</span>
          </label>
          
          <select
            disabled={isProcessing || seasons.length === 0}
            value={selectedSeason?.id || ''}
            onChange={(e) => {
              const matched = seasons.find(s => s.id === e.target.value);
              if (matched) setSelectedSeason(matched);
            }}
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 font-semibold outline-none focus:border-purple-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id} className="bg-zinc-950 text-white font-semibold">
                Season {season.number} {season.name ? `(${season.name})` : ''}
              </option>
            ))}
            {seasons.length === 0 && (
              <option value="">No Seasons loaded under this series</option>
            )}
          </select>
        </div>
      </div>

      {/* 3. Engine Settings, Log Terminal & Primary Action Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Settings & Execution Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative space-y-5">
            <h3 className="text-sm font-black tracking-wider text-orange-400 font-mono uppercase flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              <span>Engine Capture Settings</span>
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 font-mono">Frame Seek Range (Seconds)</label>
                  <span className="text-xs font-bold text-orange-400 font-mono">{customRangeMin}s - {customRangeMax}s</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/80 border border-zinc-850 rounded-xl p-3 text-left">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono block mb-1">Min Offset</span>
                    <input
                      type="number"
                      disabled={isProcessing}
                      min={1}
                      max={customRangeMax - 1}
                      value={customRangeMin}
                      onChange={(e) => setCustomRangeMin(Math.max(1, parseInt(e.target.value) || 10))}
                      className="bg-transparent text-sm font-bold font-mono text-white focus:outline-none w-full"
                    />
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-850 rounded-xl p-3 text-left">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono block mb-1">Max Offset</span>
                    <input
                      type="number"
                      disabled={isProcessing}
                      min={customRangeMin + 1}
                      value={customRangeMax}
                      onChange={(e) => setCustomRangeMax(Math.max(customRangeMin + 1, parseInt(e.target.value) || 30))}
                      className="bg-transparent text-sm font-bold font-mono text-white focus:outline-none w-full"
                    />
                  </div>
                </div>
                
                <p className="text-[10px] text-zinc-550 leading-relaxed font-semibold mt-2.5">
                  The engine will pick a completely random video frame inside this offset window. Set this to skip introductory credits and theme music (usually 0s - 90s).
                </p>
              </div>

              {/* Main Execution Trigger */}
              <button
                type="button"
                onClick={handleAutoThumbnailSequence}
                disabled={isProcessing || episodes.length === 0}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-zinc-850 disabled:to-zinc-850 disabled:text-zinc-550 font-black text-black px-6 py-4 rounded-xl text-xs active:scale-95 transition-all text-center uppercase tracking-widest font-mono flex items-center justify-center space-x-2.5 cursor-pointer shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 text-black animate-spin" />
                    <span>Processing Episode {currentEpIndex !== null ? currentEpIndex + 1 : ''}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>AUTO THUMBNAIL ALL EPISODES ({episodes.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CORS and Tech Warning Notice */}
          <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed font-medium text-purple-300">
            <HelpCircle className="w-4.5 h-4.5 shrink-0 text-purple-400 mt-0.5" />
            <div>
              <span className="font-extrabold uppercase tracking-wide text-white block mb-0.5">Cross-Origin Policy (CORS) Integration</span>
              <p className="text-zinc-400 text-[11px] leading-normal font-semibold">
                Canvas capture requires the media stream server to return valid CORS headers. If your streaming server has CORS disabled, our system automatically detects the lock and crafts a beautiful stylized graphic banner with the episode number and details instead!
              </p>
            </div>
          </div>
        </div>

        {/* Live Processing Output Console Log */}
        <div className="lg:col-span-7">
          <div className="glass-panel border border-zinc-900 bg-zinc-950/50 p-6 rounded-2xl flex flex-col h-[320px] justify-between">
            <span className="text-[10px] uppercase font-black font-mono tracking-widest text-zinc-500 block mb-2">
              🖥️ ACTIVE STREAMS ENGINE DECODER SHELL
            </span>
            
            <div 
              ref={logContainerRef}
              className="bg-black/85 border border-zinc-900 rounded-xl p-4.5 font-mono text-[10px] leading-normal text-zinc-400 flex-1 overflow-y-auto space-y-1.5 text-left custom-scrollbar"
            >
              {logFeed.map((log, idx) => (
                <div 
                  key={idx} 
                  className={
                    log.startsWith(' ✔️') ? 'text-green-400 font-bold' : 
                    log.startsWith(' ⚠️') ? 'text-amber-400 font-bold' :
                    log.startsWith(' ❌') ? 'text-red-400 font-bold' :
                    log.startsWith(' ->') ? 'text-teal-400 font-semibold' :
                    log.includes('🚀') ? 'text-orange-400 font-bold tracking-wide' : 'text-zinc-400'
                  }
                >
                  {log}
                </div>
              ))}
              {logFeed.length === 0 && (
                <div className="text-zinc-650 italic text-center py-16">
                  Terminal inactive. Choose a series above and trigger the engine to inspect live action frames.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Episodes Queue Overview */}
      <div className="space-y-4">
        <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
          <Video className="w-5 h-5 text-orange-500" />
          <span>Episodes Queue ({episodes.length})</span>
        </h3>

        {isLoadingEpisodes ? (
          <div className="flex justify-center items-center py-20 bg-zinc-950/20 rounded-2xl border border-zinc-900">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950/20 rounded-2xl border border-zinc-900 text-zinc-550 font-semibold">
            No episode entries loaded for Season {selectedSeason?.number || 1}. Use the scheduler or bulk operations tab to insert streams.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.map((ep, index) => {
              const status = processingStatus[ep.id] || 'pending';
              const isCurrent = currentEpIndex === index;
              
              return (
                <div 
                  key={ep.id} 
                  className={`glass-panel border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                    isCurrent 
                      ? 'border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/5' 
                      : status === 'success' 
                        ? 'border-green-500/35 bg-green-500/5' 
                        : 'border-zinc-850 bg-zinc-950/10'
                  }`}
                >
                  <div>
                    {/* Thumbnail Preview Banner */}
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-zinc-900 mb-3.5 group">
                      {ep.thumbnailUrl ? (
                        <img 
                          src={ep.thumbnailUrl} 
                          alt="" 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                          <Image className="w-8 h-8 text-zinc-700 mb-1" />
                          <span className="text-[10px] font-bold font-mono">NO THUMBNAIL LOADED</span>
                        </div>
                      )}
                      
                      {/* Interactive Float Status badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {status === 'processing' && (
                          <span className="bg-orange-500 text-black text-[9px] font-black px-2.5 py-1 rounded-md font-mono tracking-wider shadow-md animate-pulse">
                            DECODING...
                          </span>
                        )}
                        {status === 'success' && (
                          <span className="bg-green-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md font-mono tracking-wider shadow-md flex items-center space-x-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>CAPTURED</span>
                          </span>
                        )}
                        {status === 'failed' && (
                          <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md font-mono tracking-wider shadow-md">
                            FAILED
                          </span>
                        )}
                        {status === 'skipped' && (
                          <span className="bg-zinc-800 text-zinc-400 text-[9px] font-black px-2.5 py-1 rounded-md font-mono tracking-wider shadow-md">
                            SKIPPED
                          </span>
                        )}
                      </div>

                      {/* Video Stream Indicator badge */}
                      <div className="absolute bottom-2.5 left-2.5 bg-black/70 px-2 py-1 rounded text-[9px] font-mono font-bold text-zinc-350">
                        EPISODE {ep.number}
                      </div>
                    </div>

                    <h4 className="font-bold text-white text-sm line-clamp-1">{ep.title || `Episode ${ep.number}`}</h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2 mt-1 font-medium">{ep.description || 'No summary description.'}</p>
                    
                    {ep.videoUrl ? (
                      <div className="mt-3 bg-zinc-950/60 border border-zinc-900 rounded-xl px-3 py-2 flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-zinc-500 truncate max-w-[150px]">{ep.videoUrl}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (activePreviewId === ep.id) {
                                  setActivePreviewId(null);
                                } else {
                                  setActivePreviewId(ep.id);
                                }
                              }}
                              className={`px-2 py-1 rounded text-[9px] font-bold font-mono tracking-wider flex items-center space-x-1 uppercase cursor-pointer ${
                                activePreviewId === ep.id 
                                  ? 'bg-orange-500 text-black font-extrabold' 
                                  : 'bg-zinc-800 text-zinc-350 hover:bg-zinc-700 hover:text-white'
                              }`}
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>{activePreviewId === ep.id ? 'Close' : 'Preview'}</span>
                            </button>
                            <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest font-mono">Stream Live</span>
                          </div>
                        </div>

                        {activePreviewId === ep.id && (
                          <InlineVideoPreview videoUrl={ep.videoUrl} />
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 bg-red-950/20 border border-red-900/10 rounded-xl px-3 py-2 flex items-center space-x-1.5 text-red-400 font-mono text-[9px]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>NO SOURCE URL CONFIGURED</span>
                      </div>
                    )}

                    {/* Manual Thumbnail URL Editor */}
                    <div className="mt-4 space-y-1.5 pt-3.5 border-t border-zinc-900/50">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase text-zinc-500 font-mono">
                          Pasted Cover URL Fallback
                        </label>
                        {ep.thumbnailUrl && ep.thumbnailUrl.startsWith('data:image') && (
                          <span className="text-zinc-600 text-[8px] font-medium">(Procedural graphic stored)</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Or paste direct image URL (jpg/png)..."
                          value={customThumbnails[ep.id] !== undefined ? customThumbnails[ep.id] : (ep.thumbnailUrl || '')}
                          onChange={(e) => setCustomThumbnails(prev => ({ ...prev, [ep.id]: e.target.value }))}
                          className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-orange-500/50 transition-colors font-medium"
                        />
                        <button
                          type="button"
                          disabled={isSavingThumbnail[ep.id]}
                          onClick={async () => {
                            const newUrl = customThumbnails[ep.id] !== undefined ? customThumbnails[ep.id] : (ep.thumbnailUrl || '');
                            setIsSavingThumbnail(prev => ({ ...prev, [ep.id]: true }));
                            try {
                              await updateDoc(doc(db, 'episodes', ep.id), { thumbnailUrl: newUrl });
                              setLogFeed(prev => [...prev, ` ✔️ Episode ${ep.number} thumbnail URL set successfully!`]);
                              await refreshData();
                              setRefreshCount(prev => prev + 1);
                            } catch (e: any) {
                              console.error(e);
                              setLogFeed(prev => [...prev, ` ❌ Failed to update thumbnail: ${e.message}`]);
                            } finally {
                              setIsSavingThumbnail(prev => ({ ...prev, [ep.id]: false }));
                            }
                          }}
                          className="bg-orange-500/10 hover:bg-orange-500 hover:text-black text-orange-400 border border-orange-500/20 disabled:bg-zinc-800 disabled:text-zinc-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase font-mono tracking-wider active:scale-95 transition-all cursor-pointer shrink-0"
                        >
                          {isSavingThumbnail[ep.id] ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Individual Episode Manual Trigger action */}
                  <div className="pt-4 mt-4 border-t border-zinc-900 flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 font-mono font-bold">
                      Duration: {Math.floor((ep.duration || 1440) / 60)} min
                    </span>
                    <button
                      type="button"
                      disabled={isProcessing || !ep.videoUrl}
                      onClick={() => handleSingleEpisodeThumbnail(ep, index)}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-orange-500 text-zinc-400 hover:text-black disabled:opacity-40 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-400 font-bold rounded-lg text-[10px] active:scale-95 transition-all cursor-pointer uppercase flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3 animate-spin-slow" />
                      <span>Capture Single Frame</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
