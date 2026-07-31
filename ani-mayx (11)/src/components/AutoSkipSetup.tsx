import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, RefreshCw, Loader2, Play, CheckCircle2, AlertCircle, ChevronDown, 
  Settings, Layers, Tv, Video, HelpCircle, Save, Sliders, ListFilter, PlayCircle, 
  PauseCircle, ArrowRight, RotateCcw, Check, Info, Terminal, Download, Trash2, 
  Search, ShieldAlert, FastForward, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { db, collection, getDocs, doc, setDoc, updateDoc, query, where } from '../firebase';
import { Anime, Season, Episode } from '../types';
import { fetchAniSkipWithRetry } from '../services/aniskipService';

interface AutoSkipSetupProps {
  allAnime: Anime[];
  refreshData: () => void;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  animeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

// Known MAL ID Fallbacks mapping for instant resolution
const KNOWN_MAL_IDS: Record<string, number> = {
  'demon-slayer': 38000,
  'frieren': 52991,
  'jujutsu-kaisen': 40748,
  'chainsaw-man': 44511,
  'solo-leveling': 52299,
  'one-piece': 21,
  'naruto': 20,
  'attack-on-titan': 16498,
  'bleach': 269,
  'my-hero-academia': 31964
};

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function AutoSkipSetup({ allAnime, refreshData }: AutoSkipSetupProps) {
  // Selections
  const [targetMode, setTargetMode] = useState<'all' | 'selected'>('all');
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>('');
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<string[]>([]);
  const [animeSearchQuery, setAnimeSearchQuery] = useState<string>('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  // Scan & Progress State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  
  const [progress, setProgress] = useState({
    currentAnime: '',
    currentSeason: 0,
    currentEpisode: 0,
    currentTask: 'Idle',
    status: 'Ready' as 'Ready' | 'Scanning' | 'Fetching' | 'Saving' | 'Completed' | 'Paused' | 'Error',
    totalEpisodes: 0,
    completed: 0,
    failed: 0,
    remaining: 0,
    percent: 0
  });

  // Background Async Workers state
  const [activeSubTab, setActiveSubTab] = useState<'backend' | 'client'>('backend');
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Terminal Logs State
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-log',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'AniSkip AI Logs Console initialized. Ready for Auto Setup scan.'
    }
  ]);
  const [isLogsPaused, setIsLogsPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scanCancelRef = useRef(false);
  const scanPauseRef = useRef(false);
  const syncedEpisodesRef = useRef<Set<string>>(new Set());

  // Function to sync completed background job results directly from the browser to Firestore
  const syncJobResultsToFirestore = async (jobs: any[]) => {
    if (!jobs || jobs.length === 0) return;

    for (const job of jobs) {
      if (!job.results || !Array.isArray(job.results) || job.results.length === 0) {
        continue;
      }

      for (const result of job.results) {
        const episodeId = result.episodeId;
        if (!episodeId || syncedEpisodesRef.current.has(episodeId)) {
          continue;
        }

        // Mark as synced locally to avoid repeated writes
        syncedEpisodesRef.current.add(episodeId);

        try {
          console.log(`[AutoSync] Syncing backend computed skip timestamps for episode ${episodeId} to Firestore...`);
          const epRef = doc(db, 'episodes', episodeId);
          
          const introStart = Number(result.intro_start);
          const introEnd = Number(result.intro_end);
          const outroStart = Number(result.outro_start);
          const outroEnd = Number(result.outro_end);
          const duration = Number(result.duration || 1420);

          await updateDoc(epRef, {
            duration,
            introStart: introStart,
            introEnd: introEnd,
            outroStart: outroStart,
            outroEnd: outroEnd,
            skipSource: 'AniSkip',
            lastUpdated: new Date().toISOString(),
            status: 'success',

            // Compatibility fields
            intro_start: introStart,
            intro_end: introEnd,
            outro_start: outroStart,
            outro_end: outroEnd,
            skip_intro_enabled: true,
            skip_outro_enabled: true,
            hasSkipIntro: true,
            introShowAt: introStart,
            introShowDuration: introEnd - introStart,
            introSkipTo: introEnd,
            hasSkipOutro: true,
            outroShowAt: outroStart,
            outroShowDuration: outroEnd - outroStart,
            outroSkipTo: outroEnd,
            aiProcessed: true,
            aiNotes: result.detection_method ? `Skips auto-configured via ${result.detection_method}. Confidence: ${Math.round((result.confidence_score || 0.95) * 100)}%` : `Auto-configured via background job.`
          });
          console.log(`[AutoSync] Successfully saved skip timestamps for episode ${episodeId} to Firestore.`);
        } catch (err: any) {
          console.error(`[AutoSync] Failed to sync result for episode ${episodeId} to Firestore:`, err);
          // Retry on subsequent fetch cycles if it failed
          syncedEpisodesRef.current.delete(episodeId);
        }
      }
    }
  };

  // Manual Setup State
  const [manualAnimeId, setManualAnimeId] = useState<string>('');
  const [manualSeasons, setManualSeasons] = useState<Season[]>([]);
  const [manualSeasonId, setManualSeasonId] = useState<string>('');
  const [manualEpisodes, setManualEpisodes] = useState<Episode[]>([]);
  const [manualEpisodeId, setManualEpisodeId] = useState<string>('');
  const [manualMalId, setManualMalId] = useState<string>('');
  
  const [manualForm, setManualForm] = useState({
    introStart: 0,
    introEnd: 90,
    outroStart: 1350,
    outroEnd: 1420,
    skipSource: 'AniSkip'
  });
  const [isFetchingManual, setIsFetchingManual] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [manualErrorMsg, setManualErrorMsg] = useState<string | null>(null);
  const [isDetectingMalIds, setIsDetectingMalIds] = useState(false);

  // Background Jobs Fetch & Polling
  const fetchBackgroundJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const res = await fetch('/api/ai/auto-skip/jobs');
      if (res.ok) {
        const data = await res.json();
        setBackgroundJobs(data || []);
        // Trigger auto-sync to Firestore for all completed/in-progress episode results
        syncJobResultsToFirestore(data || []);
      }
    } catch (err) {
      console.warn("Failed to fetch skip setup jobs:", err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Fetch AniSkip Server Queue Status and Logs
  const fetchAniSkipQueueStatus = async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/aniskip/status'),
        fetch('/api/aniskip/logs')
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        if (s) {
          const isBusy = s.status === 'running' || s.status === 'paused';
          if (isBusy) {
            setIsRunning(true);
            setIsPaused(s.status === 'paused');
          }

          const percent = s.totalEpisodes > 0 
            ? Math.round((s.completed / s.totalEpisodes) * 100)
            : s.status === 'completed' ? 100 : 0;

          setProgress({
            currentAnime: s.currentAnime || '',
            currentSeason: 0,
            currentEpisode: s.currentEpisode || 0,
            currentTask: isBusy 
              ? `Syncing S1E${s.currentEpisode || 1}: ${s.currentAnime || 'Anime'}...`
              : s.status === 'completed' ? 'All AniSkip Timestamps Synced!' : 'Idle',
            status: s.status === 'running' ? 'Fetching' : s.status === 'paused' ? 'Paused' : s.status === 'completed' ? 'Completed' : 'Ready',
            totalEpisodes: s.totalEpisodes || 0,
            completed: s.completed || 0,
            failed: s.failed || 0,
            remaining: s.remaining || 0,
            percent
          });

          if (s.status === 'completed' || s.status === 'stopped') {
            refreshData();
          }
        }
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (Array.isArray(logsData) && logsData.length > 0) {
          const formattedLogs: LogEntry[] = logsData.map((l: any) => ({
            id: l.id || `slog_${Math.random()}`,
            timestamp: l.timestamp || new Date().toLocaleTimeString(),
            type: l.type === 'error' ? 'error' : l.type === 'warning' ? 'warning' : l.type === 'success' ? 'success' : 'info',
            message: l.message,
            animeTitle: l.animeTitle,
            seasonNumber: l.seasonNumber,
            episodeNumber: l.episodeNumber
          }));
          setLogs(formattedLogs);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch AniSkip server queue status:", err);
    }
  };

  useEffect(() => {
    fetchBackgroundJobs();
    fetchAniSkipQueueStatus();
    const interval = setInterval(() => {
      fetchBackgroundJobs();
      fetchAniSkipQueueStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncAllAnime = async () => {
    try {
      addLog('info', '🚀 Launching Full AniSkip Auto Setup for ALL Catalog Anime...');
      const res = await fetch('/api/aniskip/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingOnly: !forceRefresh,
          forceRefresh
        })
      });
      if (res.ok) {
        const data = await res.json();
        addLog('success', `✓ AniSkip Queue launched: ${data.message || 'Processing catalog...'}`);
        setIsRunning(true);
        fetchAniSkipQueueStatus();
      } else {
        const errData = await res.json();
        addLog('error', `Failed to start sync: ${errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      addLog('error', `Network error launching sync: ${err.message || err}`);
    }
  };

  const handleAutoDetectAllMalIds = async (autoChainSync = true) => {
    try {
      setIsDetectingMalIds(true);
      addLog('info', '🔍 Launching AI Google Search & MAL Auto-Detector across ALL anime & seasons...');
      const res = await fetch('/api/aniskip/auto-detect-mal-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh })
      });
      if (res.ok) {
        const data = await res.json();
        addLog('success', `✓ MAL Auto-Detector finished: ${data.message || `Updated ${data.updatedCount || 0} MAL IDs`}`);
        refreshData();
        if (autoChainSync) {
          addLog('info', '⚡ Automatically starting full AniSkip timestamp sync now...');
          await handleSyncAllAnime();
        }
      } else {
        const errData = await res.json();
        addLog('error', `MAL auto-detect failed: ${errData.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      addLog('error', `Failed auto-detecting MAL IDs: ${err.message || err}`);
    } finally {
      setIsDetectingMalIds(false);
    }
  };

  const handleInterruptJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/ai/auto-skip/jobs/${jobId}/interrupt`, { method: 'POST' });
      if (res.ok) {
        fetchBackgroundJobs();
      }
    } catch (err) {
      console.error("Failed to interrupt job:", err);
    }
  };

  const handleEnqueueBackgroundJob = async () => {
    if (!selectedAnimeId || !selectedSeasonId) {
      alert("Please select Anime and Season first.");
      return;
    }

    try {
      const res = await fetch('/api/ai/auto-skip/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: selectedAnimeId,
          seasonId: selectedSeasonId,
          resume: !forceRefresh
        })
      });
      if (res.ok) {
        const result = await res.json();
        fetchBackgroundJobs();
        if (result.job) {
          setSelectedJobId(result.job.id);
        }
      } else {
        const errData = await res.json();
        alert(`Failed to enqueue job: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Failed to enqueue job:", err);
    }
  };

  // Select anime default
  useEffect(() => {
    if (allAnime.length > 0) {
      if (!selectedAnimeId) {
        setSelectedAnimeId(allAnime[0].id);
        setManualAnimeId(allAnime[0].id);
      }
      if (selectedAnimeIds.length === 0) {
        setSelectedAnimeIds([allAnime[0].id]);
      }
    }
  }, [allAnime]);

  // Load Seasons for Selected Anime in Auto Setup
  useEffect(() => {
    if (!selectedAnimeId) {
      setSeasons([]);
      setSelectedSeasonId('');
      return;
    }
    const loadSeasons = async () => {
      try {
        const q = query(collection(db, 'seasons'), where('animeId', '==', selectedAnimeId));
        const snap = await getDocs(q);
        const list: Season[] = [];
        snap.forEach(d => list.push(d.data() as Season));
        list.sort((a, b) => Number(a.number) - Number(b.number));
        setSeasons(list);
        if (list.length > 0) setSelectedSeasonId(list[0].id);
      } catch (e) {
        console.error("Failed loading seasons:", e);
      }
    };
    loadSeasons();
  }, [selectedAnimeId]);

  // Load Seasons for Manual Setup
  useEffect(() => {
    if (!manualAnimeId) {
      setManualSeasons([]);
      setManualSeasonId('');
      return;
    }
    const targetAnime = allAnime.find(a => a.id === manualAnimeId);
    if (targetAnime && targetAnime.malId) {
      setManualMalId(String(targetAnime.malId));
    } else if (KNOWN_MAL_IDS[manualAnimeId]) {
      setManualMalId(String(KNOWN_MAL_IDS[manualAnimeId]));
    } else {
      setManualMalId('');
    }

    const loadManualSeasons = async () => {
      try {
        const q = query(collection(db, 'seasons'), where('animeId', '==', manualAnimeId));
        const snap = await getDocs(q);
        const list: Season[] = [];
        snap.forEach(d => list.push(d.data() as Season));
        list.sort((a, b) => Number(a.number) - Number(b.number));
        setManualSeasons(list);
        if (list.length > 0) setManualSeasonId(list[0].id);
      } catch (e) {
        console.error("Failed loading manual seasons:", e);
      }
    };
    loadManualSeasons();
  }, [manualAnimeId, allAnime]);

  // Load Episodes for Manual Setup
  useEffect(() => {
    if (!manualSeasonId) {
      setManualEpisodes([]);
      setManualEpisodeId('');
      return;
    }
    const loadManualEpisodes = async () => {
      try {
        const q = query(collection(db, 'episodes'), where('seasonId', '==', manualSeasonId));
        const snap = await getDocs(q);
        const list: Episode[] = [];
        snap.forEach(d => list.push(d.data() as Episode));
        list.sort((a, b) => Number(a.number) - Number(b.number));
        setManualEpisodes(list);
        if (list.length > 0) {
          const firstEp = list[0];
          setManualEpisodeId(firstEp.id);
          setManualForm({
            introStart: firstEp.introStart ?? firstEp.intro_start ?? firstEp.introShowAt ?? 0,
            introEnd: firstEp.introEnd ?? firstEp.intro_end ?? firstEp.introSkipTo ?? 90,
            outroStart: firstEp.outroStart ?? firstEp.outro_start ?? firstEp.outroShowAt ?? 1350,
            outroEnd: firstEp.outroEnd ?? firstEp.outro_end ?? firstEp.outroSkipTo ?? 1420,
            skipSource: firstEp.skipSource || 'AniSkip'
          });
        }
      } catch (e) {
        console.error("Failed loading manual episodes:", e);
      }
    };
    loadManualEpisodes();
  }, [manualSeasonId]);

  // Handle Manual Episode Selection change
  useEffect(() => {
    if (!manualEpisodeId) return;
    const activeEp = manualEpisodes.find(e => e.id === manualEpisodeId);
    if (activeEp) {
      setManualForm({
        introStart: activeEp.introStart ?? activeEp.intro_start ?? activeEp.introShowAt ?? 0,
        introEnd: activeEp.introEnd ?? activeEp.intro_end ?? activeEp.introSkipTo ?? 90,
        outroStart: activeEp.outroStart ?? activeEp.outro_start ?? activeEp.outroShowAt ?? 1350,
        outroEnd: activeEp.outroEnd ?? activeEp.outro_end ?? activeEp.outroSkipTo ?? 1420,
        skipSource: activeEp.skipSource || 'AniSkip'
      });
    }
  }, [manualEpisodeId, manualEpisodes]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (!isLogsPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLogsPaused]);

  // Helper to add log
  const addLog = (type: 'success' | 'warning' | 'info' | 'error', message: string, animeTitle?: string, seasonNumber?: number, episodeNumber?: number) => {
    if (isLogsPaused) return;
    const entry: LogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      animeTitle,
      seasonNumber,
      episodeNumber
    };
    setLogs(prev => [...prev, entry]);
  };

  // Helper to resolve MAL ID for an Anime
  const resolveMalId = async (anime: Anime): Promise<number | null> => {
    if (anime.malId && Number(anime.malId) > 0) {
      return Number(anime.malId);
    }
    if (KNOWN_MAL_IDS[anime.id]) {
      const knownId = KNOWN_MAL_IDS[anime.id];
      // Save back to Firestore
      try {
        await updateDoc(doc(db, 'anime', anime.id), { malId: knownId });
      } catch (e) {}
      return knownId;
    }

    // Attempt online lookup via /api/mal-search
    try {
      addLog('info', `Searching MyAnimeList ID for "${anime.title}"...`, anime.title);
      const res = await fetch(`/api/mal-search?title=${encodeURIComponent(anime.title)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.malId) {
          const malId = Number(data.malId);
          await updateDoc(doc(db, 'anime', anime.id), { malId });
          addLog('success', `Detected MAL ID: ${malId} for "${anime.title}"`, anime.title);
          return malId;
        }
      }
    } catch (err) {
      console.warn("MAL lookup failed:", err);
    }

    addLog('warning', `Could not automatically resolve MAL ID for "${anime.title}".`, anime.title);
    return null;
  };

  // Helper to fetch AniSkip timestamps for malId and episodeNumber
  const fetchAniSkipTimestamps = async (malId: number, epNum: number): Promise<{
    introStart: number;
    introEnd: number;
    outroStart: number;
    outroEnd: number;
    found: boolean;
  } | null> => {
    try {
      const data = await fetchAniSkipWithRetry(malId, epNum, 0, 2);
      if (!data.found || !Array.isArray(data.results) || data.results.length === 0) {
        return { introStart: 0, introEnd: 0, outroStart: 0, outroEnd: 0, found: false };
      }

      let introStart = 0;
      let introEnd = 0;
      let outroStart = 0;
      let outroEnd = 0;
      let foundAny = false;

      for (const item of data.results) {
        const skipType = String(item.skipType || '').toLowerCase().trim();
        const interval = item.interval || (item as any).timing || {};
        const start = Number(interval.startTime ?? interval.start_time ?? interval.start ?? 0);
        const end = Number(interval.endTime ?? interval.end_time ?? interval.end ?? 0);

        if ((skipType === 'op' || skipType === 'mixed_op' || skipType === 'mixed-op') && end > start) {
          introStart = Math.round(start * 10) / 10;
          introEnd = Math.round(end * 10) / 10;
          foundAny = true;
        } else if ((skipType === 'ed' || skipType === 'mixed_ed' || skipType === 'mixed-ed') && end > start) {
          outroStart = Math.round(start * 10) / 10;
          outroEnd = Math.round(end * 10) / 10;
          foundAny = true;
        }
      }

      return { introStart, introEnd, outroStart, outroEnd, found: foundAny };
    } catch (err: any) {
      return null;
    }
  };

  // MAIN AUTO SETUP SCANNER
  const handleStartAutoSetup = async () => {
    if (isRunning) return;

    scanCancelRef.current = false;
    scanPauseRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    addLog('info', 'Starting Scan...');

    // Determine scope
    let targetAnimeList: Anime[] = [];
    if (targetMode === 'selected') {
      if (selectedAnimeIds.length > 0) {
        targetAnimeList = allAnime.filter(a => selectedAnimeIds.includes(a.id));
      } else if (selectedAnimeId) {
        const match = allAnime.find(a => a.id === selectedAnimeId);
        if (match) targetAnimeList = [match];
      }
    } else {
      targetAnimeList = [...allAnime];
    }

    if (targetAnimeList.length === 0) {
      addLog('error', 'No anime selected or available for setup scan.');
      setIsRunning(false);
      return;
    }

    // Fetch all seasons and episodes for scope
    let allTargetEpisodes: { anime: Anime; season: Season; episode: Episode }[] = [];

    try {
      setProgress(prev => ({
        ...prev,
        status: 'Scanning',
        currentTask: 'Gathering catalog records from database...'
      }));

      for (const anime of targetAnimeList) {
        let seasonsSnap = await getDocs(query(collection(db, 'seasons'), where('animeId', '==', anime.id)));
        let seasonList: Season[] = [];
        seasonsSnap.forEach(d => seasonList.push(d.data() as Season));
        seasonList.sort((a, b) => Number(a.number) - Number(b.number));

        for (const season of seasonList) {
          let epSnap = await getDocs(query(collection(db, 'episodes'), where('seasonId', '==', season.id)));
          let epList: Episode[] = [];
          epSnap.forEach(d => epList.push(d.data() as Episode));
          epList.sort((a, b) => Number(a.number) - Number(b.number));

          for (const ep of epList) {
            allTargetEpisodes.push({ anime, season, episode: ep });
          }
        }
      }
    } catch (err: any) {
      addLog('error', `Failed to load catalog episodes: ${err.message || err}`);
      setIsRunning(false);
      return;
    }

    const totalCount = allTargetEpisodes.length;
    let completedCount = 0;
    let failedCount = 0;

    setProgress({
      currentAnime: '',
      currentSeason: 0,
      currentEpisode: 0,
      currentTask: 'Starting episode scans...',
      status: 'Scanning',
      totalEpisodes: totalCount,
      completed: 0,
      failed: 0,
      remaining: totalCount,
      percent: 0
    });

    for (let i = 0; i < allTargetEpisodes.length; i++) {
      if (scanCancelRef.current) {
        addLog('warning', 'Scan cancelled by administrator.');
        break;
      }

      while (scanPauseRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (scanCancelRef.current) break;
      }

      const { anime, season, episode } = allTargetEpisodes[i];

      // Update progress UI
      const currentRemaining = totalCount - (completedCount + failedCount);
      const currentPercent = Math.round(((completedCount + failedCount) / totalCount) * 100);

      setProgress({
        currentAnime: anime.title,
        currentSeason: season.number,
        currentEpisode: episode.number,
        currentTask: `Processing ${anime.title} S${season.number} E${episode.number}...`,
        status: 'Scanning',
        totalEpisodes: totalCount,
        completed: completedCount,
        failed: failedCount,
        remaining: currentRemaining,
        percent: currentPercent
      });

      addLog('info', `Anime: ${anime.title}`, anime.title);
      addLog('info', `Season ${season.number}`, anime.title, season.number);
      addLog('info', `Episode ${episode.number}`, anime.title, season.number, episode.number);

      // Check if already processed
      if (!forceRefresh && episode.status === 'success' && (episode.introStart !== undefined || episode.intro_start !== undefined)) {
        addLog('warning', `Episode ${episode.number} already has skip data saved. Skipping...`, anime.title, season.number, episode.number);
        completedCount++;
        continue;
      }

      // Resolve MAL ID
      const malId = await resolveMalId(anime);
      if (!malId) {
        addLog('error', `No MAL ID available for "${anime.title}". Cannot fetch AniSkip.`, anime.title, season.number, episode.number);
        failedCount++;
        addLog('info', '------------------------------------------------');
        continue;
      }

      addLog('info', `MAL ID: ${malId}`, anime.title, season.number, episode.number);
      addLog('info', `Requesting AniSkip API...`, anime.title, season.number, episode.number);

      setProgress(p => ({ ...p, status: 'Fetching', currentTask: `Requesting AniSkip API for MAL ID ${malId}, Ep ${episode.number}...` }));

      const skipData = await fetchAniSkipTimestamps(malId, episode.number);

      if (!skipData) {
        addLog('error', `Failed to fetch AniSkip data for Episode ${episode.number}.`, anime.title, season.number, episode.number);
        failedCount++;
        // Update episode error status
        try {
          await updateDoc(doc(db, 'episodes', episode.id), {
            status: 'error',
            lastUpdated: new Date().toISOString()
          });
        } catch (e) {}
        addLog('info', '------------------------------------------------');
        continue;
      }

      if (!skipData.found) {
        addLog('warning', `No Skip Data Found for Episode ${episode.number}`, anime.title, season.number, episode.number);
        completedCount++;
        try {
          await updateDoc(doc(db, 'episodes', episode.id), {
            status: 'no_data',
            skipSource: 'AniSkip',
            lastUpdated: new Date().toISOString()
          });
        } catch (e) {}
        addLog('info', '------------------------------------------------');
        continue;
      }

      // Skip times found!
      setProgress(p => ({ ...p, status: 'Saving', currentTask: `Saving skip timestamps to Firestore...` }));

      if (skipData.introEnd > skipData.introStart) {
        addLog('success', `Intro Found`, anime.title, season.number, episode.number);
        addLog('success', `Intro: ${formatTime(skipData.introStart)} → ${formatTime(skipData.introEnd)}`, anime.title, season.number, episode.number);
      }
      if (skipData.outroEnd > skipData.outroStart) {
        addLog('success', `Outro Found`, anime.title, season.number, episode.number);
        addLog('success', `Outro: ${formatTime(skipData.outroStart)} → ${formatTime(skipData.outroEnd)}`, anime.title, season.number, episode.number);
      }

      try {
        const epRef = doc(db, 'episodes', episode.id);
        const updatePayload = {
          introStart: skipData.introStart,
          introEnd: skipData.introEnd,
          outroStart: skipData.outroStart,
          outroEnd: skipData.outroEnd,
          skipSource: 'AniSkip',
          lastUpdated: new Date().toISOString(),
          status: 'success',

          // Compatibility fields
          intro_start: skipData.introStart,
          intro_end: skipData.introEnd,
          outro_start: skipData.outroStart,
          outro_end: skipData.outroEnd,
          skip_intro_enabled: skipData.introEnd > skipData.introStart,
          skip_outro_enabled: skipData.outroEnd > skipData.outroStart,
          hasSkipIntro: skipData.introEnd > skipData.introStart,
          introShowAt: skipData.introStart,
          introShowDuration: skipData.introEnd - skipData.introStart,
          introSkipTo: skipData.introEnd,
          hasSkipOutro: skipData.outroEnd > skipData.outroStart,
          outroShowAt: skipData.outroStart,
          outroShowDuration: skipData.outroEnd - skipData.outroStart,
          outroSkipTo: skipData.outroEnd,
          detection_method: 'AniSkip',
          processed_at: new Date().toISOString()
        };

        await updateDoc(epRef, updatePayload);
        addLog('success', `Saved Successfully`, anime.title, season.number, episode.number);
        completedCount++;
      } catch (saveErr: any) {
        addLog('error', `Failed to write episode skip records to database: ${saveErr.message || saveErr}`, anime.title, season.number, episode.number);
        failedCount++;
      }

      addLog('info', '------------------------------------------------');

      // Small throttle pause between requests to prevent API rate limiting
      await new Promise(r => setTimeout(r, 400));
    }

    setProgress(prev => ({
      ...prev,
      status: 'Completed',
      currentTask: 'Auto Setup scan completed successfully!',
      remaining: 0,
      percent: 100,
      completed: completedCount,
      failed: failedCount
    }));

    addLog('success', `Auto Setup Scan Complete. ${completedCount} processed, ${failedCount} failed.`);
    setIsRunning(false);
    refreshData();
  };

  const handleStopScan = () => {
    scanCancelRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    addLog('warning', 'Stopped scan process.');
  };

  const handleTogglePause = () => {
    if (!isRunning) return;
    scanPauseRef.current = !scanPauseRef.current;
    setIsPaused(scanPauseRef.current);
    if (scanPauseRef.current) {
      addLog('warning', 'Scan paused by administrator.');
      setProgress(p => ({ ...p, status: 'Paused', currentTask: 'Scan process paused.' }));
    } else {
      addLog('info', 'Resuming scan...');
      setProgress(p => ({ ...p, status: 'Scanning', currentTask: 'Resuming scan...' }));
    }
  };

  // Log Console Operations
  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleDownloadLogs = () => {
    const textContent = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `animayx-skip-ai-logs-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Manual Fetch Skip Data from AniSkip
  const handleFetchManualSkipData = async () => {
    if (!manualMalId || isNaN(Number(manualMalId))) {
      setManualErrorMsg("Please enter a valid numeric MyAnimeList (MAL) ID.");
      return;
    }
    const activeEp = manualEpisodes.find(e => e.id === manualEpisodeId);
    if (!activeEp) {
      setManualErrorMsg("Please select an episode first.");
      return;
    }

    setIsFetchingManual(true);
    setManualErrorMsg(null);
    setManualSuccessMsg(null);

    try {
      const skipData = await fetchAniSkipTimestamps(Number(manualMalId), activeEp.number);
      if (!skipData || !skipData.found) {
        setManualErrorMsg(`No AniSkip timestamps found for MAL ID ${manualMalId}, Ep ${activeEp.number}.`);
      } else {
        setManualForm({
          introStart: skipData.introStart,
          introEnd: skipData.introEnd,
          outroStart: skipData.outroStart,
          outroEnd: skipData.outroEnd,
          skipSource: 'AniSkip'
        });
        setManualSuccessMsg(`✨ Retrieved timestamps! Intro: ${formatTime(skipData.introStart)} → ${formatTime(skipData.introEnd)} | Outro: ${formatTime(skipData.outroStart)} → ${formatTime(skipData.outroEnd)}`);
      }
    } catch (err: any) {
      setManualErrorMsg(`Fetch error: ${err.message || err}`);
    } finally {
      setIsFetchingManual(false);
    }
  };

  // Manual Save Timestamps
  const handleSaveManualSkipData = async () => {
    if (!manualEpisodeId) {
      setManualErrorMsg("Select a valid episode to save.");
      return;
    }

    setIsSavingManual(true);
    setManualErrorMsg(null);
    setManualSuccessMsg(null);

    try {
      const epRef = doc(db, 'episodes', manualEpisodeId);
      const updatePayload = {
        introStart: Number(manualForm.introStart),
        introEnd: Number(manualForm.introEnd),
        outroStart: Number(manualForm.outroStart),
        outroEnd: Number(manualForm.outroEnd),
        skipSource: manualForm.skipSource || 'AniSkip',
        lastUpdated: new Date().toISOString(),
        status: 'success',

        intro_start: Number(manualForm.introStart),
        intro_end: Number(manualForm.introEnd),
        outro_start: Number(manualForm.outroStart),
        outro_end: Number(manualForm.outroEnd),
        skip_intro_enabled: Number(manualForm.introEnd) > Number(manualForm.introStart),
        skip_outro_enabled: Number(manualForm.outroEnd) > Number(manualForm.outroStart),
        hasSkipIntro: Number(manualForm.introEnd) > Number(manualForm.introStart),
        introShowAt: Number(manualForm.introStart),
        introShowDuration: Number(manualForm.introEnd) - Number(manualForm.introStart),
        introSkipTo: Number(manualForm.introEnd),
        hasSkipOutro: Number(manualForm.outroEnd) > Number(manualForm.outroStart),
        outroShowAt: Number(manualForm.outroStart),
        outroShowDuration: Number(manualForm.outroEnd) - Number(manualForm.outroStart),
        outroSkipTo: Number(manualForm.outroEnd),
        detection_method: 'AniSkip',
        processed_at: new Date().toISOString()
      };

      await updateDoc(epRef, updatePayload);

      if (manualAnimeId && manualMalId) {
        await updateDoc(doc(db, 'anime', manualAnimeId), { malId: Number(manualMalId) });
      }

      setManualSuccessMsg("✨ Timestamps saved successfully to database!");
      refreshData();

      // Refresh manual list locally
      const q = query(collection(db, 'episodes'), where('seasonId', '==', manualSeasonId));
      const snap = await getDocs(q);
      const list: Episode[] = [];
      snap.forEach(d => list.push(d.data() as Episode));
      list.sort((a, b) => Number(a.number) - Number(b.number));
      setManualEpisodes(list);
    } catch (err: any) {
      setManualErrorMsg(`Save failed: ${err.message || err}`);
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* 1-CLICK ALL ANIME ACTION BANNER */}
      <div className="glass-panel p-6 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-950/60 via-zinc-950 to-amber-950/60 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-orange-500/40 rounded-xl text-orange-400">
                <FastForward className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  <span>AniSkip 1-Click Automation Engine</span>
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">ALL ANIME AT ONCE</span>
                </h2>
                <p className="text-xs text-zinc-300 font-medium">
                  Synchronize intro/outro skip times for <strong className="text-white">ALL catalog anime at once</strong>. Missing MAL IDs are automatically discovered using <strong className="text-amber-400">Gemini AI + Google Search</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={isDetectingMalIds || isRunning}
              onClick={() => handleAutoDetectAllMalIds(true)}
              className="px-5 py-3 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 hover:from-sky-400 hover:to-purple-400 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isDetectingMalIds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{isDetectingMalIds ? 'AI Searching Google...' : '1-Click AI Search MAL IDs & Sync ALL'}</span>
            </button>

            {isRunning ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePause}
                  className="px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <PauseCircle className="w-4 h-4" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  onClick={handleStopScan}
                  className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleSyncAllAnime}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold rounded-xl text-xs transition-all shadow-neon-orange flex items-center space-x-2 cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Sync ALL Catalog Anime (1-Button)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUB TAB SELECTOR */}
      <div className="flex border-b border-zinc-850 gap-4 mb-2">
        <button
          onClick={() => setActiveSubTab('backend')}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative cursor-pointer ${
            activeSubTab === 'backend' ? 'text-orange-400 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Backend Async Workers (RQ/Celery)
          {activeSubTab === 'backend' && (
            <motion.div layoutId="subtab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('client')}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative cursor-pointer ${
            activeSubTab === 'client' ? 'text-orange-400 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Client-Side Immediate Scan
          {activeSubTab === 'client' && (
            <motion.div layoutId="subtab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
      </div>

      {activeSubTab === 'backend' && (
        <div className="space-y-8">
          {/* CONFIG & INITIATE PANEL */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 bg-zinc-950/40">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
              <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
                <Settings className="w-4 h-4" />
                <span>Asynchronous Scan Initiation</span>
              </div>
              <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg hover:border-orange-500/40 transition-colors">
                <input 
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={e => setForceRefresh(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-700 text-orange-500 focus:ring-orange-500 h-4 w-4"
                />
                <span>Force Scan (Reanalyze already processed episodes)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Target Anime Series</label>
                <select
                  value={selectedAnimeId}
                  onChange={e => setSelectedAnimeId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 font-medium"
                >
                  <option value="">-- Choose Anime --</option>
                  {allAnime.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Target Season</label>
                <select
                  value={selectedSeasonId}
                  onChange={e => setSelectedSeasonId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 font-medium"
                >
                  <option value="">-- Choose Season --</option>
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name || `Season ${s.number}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleEnqueueBackgroundJob}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Enqueue Season in Background Worker</span>
              </button>
            </div>
          </div>

          {/* QUEUE & JOBS PROGRESS LIST */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-white">Scan Queue & Jobs List</span>
                  <button
                    onClick={fetchBackgroundJobs}
                    disabled={isLoadingJobs}
                    className="p-1.5 hover:bg-zinc-900 rounded-lg transition-colors text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {backgroundJobs.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-xs italic">
                      No active or past background jobs in queue. Select a season above to enqueue a scan!
                    </div>
                  ) : (
                    backgroundJobs.map((job) => {
                      const animeObj = allAnime.find(a => a.id === job.animeId);
                      const isSelected = selectedJobId === job.id;
                      const progressPct = job.totalEpisodes > 0 
                        ? Math.round((job.processedEpisodes / job.totalEpisodes) * 100) 
                        : 0;

                      return (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-3 ${
                            isSelected 
                              ? 'bg-zinc-900/60 border-orange-500/50 shadow-md' 
                              : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-black text-white uppercase tracking-tight">
                                {animeObj?.title || job.animeId}
                              </h4>
                              <p className="text-[10px] text-zinc-400 font-mono">
                                Job ID: {job.id} | Season ID: {job.seasonId}
                              </p>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              job.status === 'processing'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                : job.status === 'pending'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : job.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {job.status}
                            </span>
                          </div>

                          {/* Progress bar inside job row */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold font-mono text-zinc-500">
                              <span>Progress ({job.processedEpisodes}/{job.totalEpisodes} eps)</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Queued: {new Date(job.createdAt).toLocaleTimeString()}
                            </span>

                            {(job.status === 'processing' || job.status === 'pending') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInterruptJob(job.id);
                                }}
                                className="px-2.5 py-1 bg-red-950/40 hover:bg-red-950/80 border border-red-900/60 text-red-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              >
                                Interrupt
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* DETAILS & SPECIFIC JOB CONSOLE */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 h-full flex flex-col justify-between space-y-4">
                <div className="border-b border-zinc-900 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-white">Job Log Inspector</span>
                </div>

                {(() => {
                  const selectedJob = backgroundJobs.find(j => j.id === selectedJobId);
                  if (!selectedJob) {
                    return (
                      <div className="text-center py-24 text-zinc-650 text-xs italic">
                        Select a job from the queue list to inspect its logs & metadata.
                      </div>
                    );
                  }

                  const handleDownloadJobReport = () => {
                    const textContent = (selectedJob.logs || []).join('\n');
                    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `animayx-job-report-${selectedJob.id}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  };

                  return (
                    <div className="space-y-4 flex-grow flex flex-col justify-between">
                      <div className="space-y-2 text-left">
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                          <span>Status: <span className="text-white uppercase">{selectedJob.status}</span></span>
                          <span>{selectedJob.processedEpisodes} / {selectedJob.totalEpisodes} episodes</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          Started: {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleTimeString() : 'N/A'}<br/>
                          Completed: {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>

                      {/* Log Screen */}
                      <div className="flex-grow bg-zinc-950 border border-zinc-900 rounded-xl p-3 font-mono text-[10px] text-sky-400 h-64 overflow-y-auto space-y-1 text-left scrollbar-thin">
                        {(selectedJob.logs || []).length === 0 ? (
                          <div className="text-zinc-650 italic">No logs captured yet.</div>
                        ) : (
                          (selectedJob.logs || []).map((line: string, idx: number) => (
                            <div key={idx} className="leading-relaxed border-b border-zinc-900/40 pb-0.5">{line}</div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={handleDownloadJobReport}
                        className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Job Report</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'client' && (
        <>
          {/* AUTO SETUP SCANNER CONTROLS */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
          <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Auto Setup Configuration</span>
          </div>

          <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg hover:border-orange-500/40 transition-colors">
            <input 
              type="checkbox"
              checked={forceRefresh}
              onChange={e => setForceRefresh(e.target.checked)}
              className="rounded bg-zinc-950 border-zinc-700 text-orange-500 focus:ring-orange-500 h-4 w-4"
            />
            <span>Force Refresh (Re-scan already processed episodes)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={targetMode === 'selected' ? 'md:col-span-3' : ''}>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Scan Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('all')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  targetMode === 'all'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                All Catalog Anime
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('selected')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  targetMode === 'selected'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Selected Anime Only
              </button>
            </div>
          </div>

          {targetMode === 'selected' && (
            <div className="col-span-1 md:col-span-3 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900/40 pb-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Select Anime Series ({selectedAnimeIds.length} Selected)
                  </label>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                    The scanner will auto-configure skip times for ALL seasons and ALL episodes of each checked anime.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAnimeIds(allAnime.map(a => a.id))}
                    className="text-[10px] text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider cursor-pointer transition-colors bg-orange-500/5 px-2.5 py-1 rounded border border-orange-500/10"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAnimeIds([])}
                    className="text-[10px] text-zinc-400 hover:text-zinc-300 font-bold uppercase tracking-wider cursor-pointer transition-colors bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search box inside target selection */}
              <div className="relative max-w-md">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search anime to select..."
                  value={animeSearchQuery}
                  onChange={e => setAnimeSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 placeholder-zinc-600 font-medium font-sans"
                />
              </div>

              {/* Grid list of checkboxes */}
              <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 scrollbar-thin">
                {(() => {
                  const filtered = allAnime.filter(a => 
                    a.title.toLowerCase().includes(animeSearchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full text-center py-16 text-zinc-600 text-xs italic">
                        No matching anime found in database.
                      </div>
                    );
                  }
                  return filtered.map((anime) => {
                    const isChecked = selectedAnimeIds.includes(anime.id);
                    return (
                      <div
                        key={anime.id}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedAnimeIds(prev => prev.filter(id => id !== anime.id));
                          } else {
                            setSelectedAnimeIds(prev => [...prev, anime.id]);
                          }
                        }}
                        className={`flex items-center space-x-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                            : 'bg-zinc-900/30 border-zinc-900 text-zinc-400 hover:bg-zinc-900/50 hover:border-zinc-800'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                          isChecked
                            ? 'bg-orange-500 border-orange-500 text-black'
                            : 'border-zinc-700 bg-zinc-950'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        
                        {anime.thumbnailUrl && (
                          <img
                            src={anime.thumbnailUrl}
                            alt=""
                            className="w-6 h-8 object-cover rounded bg-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        <div className="text-left min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-zinc-100">
                            {anime.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-semibold font-mono">
                            {anime.malId ? `MAL: ${anime.malId}` : 'No MAL ID'}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* LIVE SCAN PROGRESS DISPLAY */}
        <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Scan Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  progress.status === 'Scanning' || progress.status === 'Fetching' || progress.status === 'Saving'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : progress.status === 'Completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : progress.status === 'Paused'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {progress.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-300 font-mono">
                {progress.currentTask}
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Anime: </span>
                <span className="font-bold text-orange-400">{progress.currentAnime || 'N/A'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Season: </span>
                <span className="font-bold text-amber-400">{progress.currentSeason || 0}</span>
              </div>
              <div>
                <span className="text-zinc-500">Episode: </span>
                <span className="font-bold text-yellow-400">{progress.currentEpisode || 0}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span>Overall Scan Progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-900">
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Total Episodes</span>
              <span className="text-lg font-black text-zinc-200 font-mono">{progress.totalEpisodes}</span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Completed</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{progress.completed}</span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block">Failed</span>
              <span className="text-lg font-black text-red-400 font-mono">{progress.failed}</span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Remaining</span>
              <span className="text-lg font-black text-amber-400 font-mono">{progress.remaining}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SKIP AI LOGS CONSOLE */}
      <div className="glass-panel rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden shadow-2xl">
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center space-x-2 border-l border-zinc-800 pl-3">
              <Terminal className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">Skip AI Logs</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsLogsPaused(!isLogsPaused)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 cursor-pointer ${
                isLogsPaused 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              {isLogsPaused ? <Play className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span>{isLogsPaused ? 'Resume Logs' : 'Pause Logs'}</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Logs</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 text-red-300 hover:text-red-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* TERMINAL CONTENT LOG DISPLAY */}
        <div className="p-4 h-80 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950/95 scrollbar-thin scrollbar-thumb-zinc-800">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic py-10 text-center">No log entries available. Start an Auto Setup scan to see live output.</div>
          ) : (
            logs.map(log => {
              let colorClass = 'text-zinc-400';
              if (log.type === 'success') colorClass = 'text-emerald-400 font-semibold';
              if (log.type === 'warning') colorClass = 'text-yellow-400 font-medium';
              if (log.type === 'info') colorClass = 'text-sky-400';
              if (log.type === 'error') colorClass = 'text-red-400 font-bold';

              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed hover:bg-zinc-900/40 px-1 py-0.5 rounded transition-colors">
                  <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                  <span className={colorClass}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
      </>)}

      {/* MANUAL SETUP SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6">
        <div className="flex items-center space-x-2 text-amber-400 font-extrabold uppercase text-xs tracking-wider border-b border-zinc-900 pb-4">
          <Settings className="w-4 h-4" />
          <span>Manual Setup & AniSkip Query Override</span>
        </div>

        {manualErrorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-900 text-red-300 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{manualErrorMsg}</span>
          </div>
        )}

        {manualSuccessMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{manualSuccessMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">1. Select Anime</label>
            <select
              value={manualAnimeId}
              onChange={e => setManualAnimeId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-medium"
            >
              {allAnime.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">2. Select Season</label>
            <select
              value={manualSeasonId}
              onChange={e => setManualSeasonId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-medium"
            >
              {manualSeasons.map(s => (
                <option key={s.id} value={s.id}>{s.name || `Season ${s.number}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">3. Select Episode</label>
            <select
              value={manualEpisodeId}
              onChange={e => setManualEpisodeId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-medium"
            >
              {manualEpisodes.map(ep => (
                <option key={ep.id} value={ep.id}>Ep {ep.number}: {ep.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">4. MyAnimeList (MAL) ID</label>
            <input
              type="text"
              value={manualMalId}
              onChange={e => setManualMalId(e.target.value)}
              placeholder="e.g. 52299"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        {/* Timestamps Entry Controls */}
        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-850 pb-3">
            <span className="text-xs font-bold text-zinc-300">Timestamps Controls (Seconds)</span>
            
            <button
              type="button"
              onClick={handleFetchManualSkipData}
              disabled={isFetchingManual}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isFetchingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Fetch Skip Data from AniSkip</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Intro Start (s)</label>
              <input
                type="number"
                value={manualForm.introStart}
                onChange={e => setManualForm({ ...manualForm, introStart: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">{formatTime(manualForm.introStart)}</span>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Intro End (s)</label>
              <input
                type="number"
                value={manualForm.introEnd}
                onChange={e => setManualForm({ ...manualForm, introEnd: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">{formatTime(manualForm.introEnd)}</span>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Outro Start (s)</label>
              <input
                type="number"
                value={manualForm.outroStart}
                onChange={e => setManualForm({ ...manualForm, outroStart: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">{formatTime(manualForm.outroStart)}</span>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Outro End (s)</label>
              <input
                type="number"
                value={manualForm.outroEnd}
                onChange={e => setManualForm({ ...manualForm, outroEnd: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">{formatTime(manualForm.outroEnd)}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveManualSkipData}
              disabled={isSavingManual}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSavingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Episode Skip Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
