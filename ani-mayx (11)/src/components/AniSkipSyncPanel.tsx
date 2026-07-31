import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, RefreshCw, Loader2, Play, CheckCircle2, AlertCircle, ChevronDown, 
  Search, ShieldAlert, FastForward, CheckCircle, XCircle, AlertTriangle, Pause, 
  Square, Terminal, Eye, Edit3, ExternalLink, Filter, Layers, Database, Cpu, HardDrive,
  FlaskConical, Wrench
} from 'lucide-react';
import { Anime, Season, Episode, AniSkipJobProgress, AniSkipLog } from '../types';
import { fetchAniSkipWithRetry } from '../services/aniskipService';

interface AniSkipSyncPanelProps {
  allAnime: Anime[];
  refreshData: () => void;
}

export default function AniSkipSyncPanel({ allAnime, refreshData }: AniSkipSyncPanelProps) {
  // Filters & Selections
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  // Toggles
  const [missingOnly, setMissingOnly] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // MAL ID Quick Fix Modal
  const [malFixAnime, setMalFixAnime] = useState<Anime | null>(null);
  const [malFixSeason, setMalFixSeason] = useState<Season | null>(null);
  const [customMalId, setCustomMalId] = useState<string>('');
  const [isSearchingMal, setIsSearchingMal] = useState(false);
  const [isAutoDetectingAll, setIsAutoDetectingAll] = useState(false);
  const [malSearchResult, setMalSearchResult] = useState<any>(null);

  // Single Test Request State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testMalId, setTestMalId] = useState<string>('40748'); // Default: Jujutsu Kaisen
  const [testEpisodeNumber, setTestEpisodeNumber] = useState<string>('1');
  const [testEpisodeLength, setTestEpisodeLength] = useState<string>('0');
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleExecuteTestRequest = async () => {
    setIsExecutingTest(true);
    setTestResult(null);
    try {
      const data = await fetchAniSkipWithRetry(
        testMalId, 
        testEpisodeNumber, 
        Number(testEpisodeLength) || 0,
        1
      );
      setTestResult({
        success: data.found,
        results: data.results,
        statusCode: data.httpStatus,
        response: {
          json: {
            found: data.found,
            results: data.results
          }
        },
        error: data.errorMessage
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: `Failed to connect to backend: ${err.message}`
      });
    } finally {
      setIsExecutingTest(false);
    }
  };

  // Queue Status State
  const [jobStatus, setJobStatus] = useState<AniSkipJobProgress>({
    status: 'idle',
    totalEpisodes: 0,
    completed: 0,
    failed: 0,
    remaining: 0,
    queuedAnime: 0,
    currentAnime: '',
    currentEpisode: 0,
    currentEpisodeTitle: '',
    retryCount: 0,
    estimatedTimeRemainingSec: 0,
    logs: []
  });

  const [isLogAutoScroll, setIsLogAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Filtered Anime List
  const filteredAnime = allAnime.filter(a => 
    a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.malId && String(a.malId).includes(searchQuery))
  );

  const selectedAnime = allAnime.find(a => a.id === selectedAnimeId);

  const fetchJsonSafe = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (res.ok) {
        return { success: true };
      }
      throw new Error(`Server temporarily unavailable (${res.status}). Please try again in a few seconds.`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Server error (${res.status})`);
    }
    return data;
  };

  const [isRepairing, setIsRepairing] = useState(false);

  const handleAutoRepairCatalog = async () => {
    setIsRepairing(true);
    try {
      const data = await fetchJsonSafe('/api/aniskip/auto-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (data.success) {
        refreshData();
        if (selectedAnimeId) {
          const seasonsRes = await fetch(`/api/seasons?animeId=${selectedAnimeId}`);
          if (seasonsRes.ok && (seasonsRes.headers.get('content-type') || '').includes('json')) {
            setSeasons(await seasonsRes.json());
          }
          const epsRes = await fetch(`/api/episodes?animeId=${selectedAnimeId}`);
          if (epsRes.ok && (epsRes.headers.get('content-type') || '').includes('json')) {
            setEpisodes(await epsRes.json());
          }
        }
        alert(`Auto-repair complete! All anime episodes & seasons verified.\n\nSeasons added: ${data.summary?.seasonsAdded || 0}\nEpisodes generated/repaired: ${data.summary?.episodesAdded || 0}`);
      } else {
        alert(`Auto repair notice: ${data.error || 'Check logs'}`);
      }
    } catch (err: any) {
      alert(`Auto repair error: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  // Fetch seasons & episodes for selected anime
  useEffect(() => {
    if (!selectedAnimeId) {
      setSeasons([]);
      setEpisodes([]);
      return;
    }

    const fetchSeasonsAndEpisodes = async () => {
      try {
        let seasonsRes = await fetch(`/api/seasons?animeId=${selectedAnimeId}`);
        let seasonsData = seasonsRes.ok ? await seasonsRes.json() : [];

        let epsRes = await fetch(`/api/episodes?animeId=${selectedAnimeId}`);
        let epsData = epsRes.ok ? await epsRes.json() : [];

        if (!seasonsData || seasonsData.length === 0 || !epsData || epsData.length <= 2) {
          await fetch('/api/aniskip/auto-repair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ animeId: selectedAnimeId })
          });
          
          seasonsRes = await fetch(`/api/seasons?animeId=${selectedAnimeId}`);
          if (seasonsRes.ok) seasonsData = await seasonsRes.json();

          epsRes = await fetch(`/api/episodes?animeId=${selectedAnimeId}`);
          if (epsRes.ok) epsData = await epsRes.json();

          refreshData();
        }

        setSeasons(seasonsData || []);
        setEpisodes(epsData || []);
      } catch (err) {
        console.warn("Error loading anime details for AniSkip panel:", err);
      }
    };

    fetchSeasonsAndEpisodes();
  }, [selectedAnimeId]);

  // Polling backend for AniSkip queue status
  useEffect(() => {
    let interval: any = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/aniskip/status');
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
        }
      } catch (err) {
        console.warn("Error fetching AniSkip queue status:", err);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, jobStatus.status === 'running' ? 1000 : 3000);

    return () => clearInterval(interval);
  }, [jobStatus.status]);

  // Scroll terminal logs to bottom when updated
  useEffect(() => {
    if (isLogAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus.logs, isLogAutoScroll]);

  // Trigger Sync Selected Anime
  const handleSyncSelectedAnime = async () => {
    if (!selectedAnimeId) {
      alert("Please select an anime title from the list first.");
      return;
    }

    try {
      const data = await fetchJsonSafe('/api/aniskip/sync-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: selectedAnimeId,
          seasonId: selectedSeasonId !== 'all' ? selectedSeasonId : undefined,
          missingOnly,
          forceRefresh
        })
      });
      if (data.success) {
        setJobStatus(prev => ({ ...prev, status: 'running' }));
      }
    } catch (err: any) {
      alert(`Failed to launch sync: ${err.message}`);
    }
  };

  // Trigger Sync All Anime
  const handleSyncAllAnime = async () => {
    if (!confirm("Are you sure you want to run AniSkip synchronization across ALL anime in your catalog? This will set or refresh Intro/Outro timings for all seasons and episodes.")) {
      return;
    }

    try {
      const data = await fetchJsonSafe('/api/aniskip/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingOnly: false,
          forceRefresh: true
        })
      });
      if (data.success) {
        setJobStatus(prev => ({ ...prev, status: 'running' }));
      }
    } catch (err: any) {
      alert(`Failed to launch full catalog sync: ${err.message}`);
    }
  };

  // Pause / Resume / Stop Controls
  const handlePauseSync = async () => {
    await fetch('/api/aniskip/pause', { method: 'POST' });
  };

  const handleResumeSync = async () => {
    await fetch('/api/aniskip/resume', { method: 'POST' });
  };

  const handleStopSync = async () => {
    if (confirm("Are you sure you want to stop the background sync process?")) {
      await fetch('/api/aniskip/stop', { method: 'POST' });
    }
  };

  // Search MAL ID via Jikan API helper
  const handleSearchMalId = async () => {
    if (!malFixAnime) return;
    setIsSearchingMal(true);
    setMalSearchResult(null);
    try {
      const res = await fetch(`/api/mal-search?title=${encodeURIComponent(malFixAnime.title)}`);
      if (res.ok) {
        const data = await res.json();
        setMalSearchResult(data);
        if (data.malId) {
          setCustomMalId(String(data.malId));
        }
      }
    } catch (err) {
      console.warn("MAL Search error:", err);
    } finally {
      setIsSearchingMal(false);
    }
  };

  // Save Anime MAL ID
  const handleSaveMalId = async () => {
    if (!malFixAnime || !customMalId.trim()) return;
    const malNum = parseInt(customMalId.trim(), 10);
    if (isNaN(malNum) || malNum <= 0) {
      alert("Please enter a valid numeric MAL ID.");
      return;
    }

    try {
      const res = await fetch('/api/aniskip/update-mal-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: malFixAnime.id,
          malId: malNum
        })
      });

      if (res.ok) {
        setMalFixAnime(null);
        setCustomMalId('');
        setMalSearchResult(null);
        await refreshData();
      }
    } catch (err: any) {
      alert(`Failed to save Anime MAL ID: ${err.message}`);
    }
  };

  // Save Season MAL ID
  const handleSaveSeasonMalId = async () => {
    if (!malFixSeason || !customMalId.trim()) return;
    const malNum = parseInt(customMalId.trim(), 10);
    if (isNaN(malNum) || malNum <= 0) {
      alert("Please enter a valid numeric MAL ID.");
      return;
    }

    try {
      const res = await fetch('/api/aniskip/update-season-mal-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: malFixSeason.id,
          malId: malNum
        })
      });

      if (res.ok) {
        setMalFixSeason(null);
        setCustomMalId('');
        setMalSearchResult(null);
        await refreshData();
      }
    } catch (err: any) {
      alert(`Failed to save Season MAL ID: ${err.message}`);
    }
  };

  // Auto-Detect MAL ID for a single season
  const handleAutoDetectSeasonMalId = async (season: Season) => {
    try {
      const data = await fetchJsonSafe('/api/aniskip/auto-detect-season-mal-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: season.id })
      });
      if (data.success && data.detected) {
        alert(`Success! Auto-detected Season MAL ID ${data.detected.malId} ("${data.detected.title}") via ${data.detected.source}`);
        await refreshData();
      } else {
        alert(`Auto-detection failed: ${data.error || 'No matching MAL entry found'}`);
      }
    } catch (err: any) {
      alert(`Auto-detect error: ${err.message}`);
    }
  };

  // Auto-Detect All Missing MAL IDs
  const handleAutoDetectAllMalIds = async () => {
    setIsAutoDetectingAll(true);
    try {
      const data = await fetchJsonSafe('/api/aniskip/auto-detect-mal-ids', { method: 'POST' });
      if (data.success) {
        alert(`Auto-detection scan complete! Detected / updated ${data.updatedCount} MAL ID(s) across your catalog seasons.`);
        await refreshData();
      } else {
        alert(`Auto-detect failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Auto-detect error: ${err.message}`);
    } finally {
      setIsAutoDetectingAll(false);
    }
  };

  // Calculate overall sync stats across catalog
  const syncedCount = allAnime.filter(a => a.aniSkipStatus === 'synced').length;
  const missingMalCount = allAnime.filter(a => !a.malId).length;
  const progressPercent = jobStatus.totalEpisodes > 0 
    ? Math.min(100, Math.round((jobStatus.completed / jobStatus.totalEpisodes) * 100))
    : 0;

  function formatTimeRemaining(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-950/60 via-purple-950/40 to-zinc-950 border border-orange-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-black font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-neon-orange flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                OFFICIAL ANISKIP INTEGRATION
              </span>
              <span className="bg-purple-900/60 text-purple-300 border border-purple-700/50 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                api.aniskip.com v2
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              AniSkip Auto Integration & Sync Engine
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Automatically fetch, store, and cache official MyAnimeList Intro (Opening) and Outro (Ending) timings directly in your AniMayX database for seamless instant skipping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-end">
            <button
              onClick={handleAutoDetectAllMalIds}
              disabled={isAutoDetectingAll}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-black font-extrabold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-neon-orange"
            >
              {isAutoDetectingAll ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Sparkles className="w-4 h-4 fill-black text-black" />
              )}
              <span>{isAutoDetectingAll ? 'Scanning Season MAL IDs...' : 'Auto Detect ALL MAL IDs'}</span>
            </button>

            <button
              onClick={handleAutoRepairCatalog}
              disabled={isRepairing}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-md border border-emerald-500/40"
            >
              {isRepairing ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Wrench className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isRepairing ? 'Repairing Episodes...' : 'Fix All Anime Episodes 🛠️'}</span>
            </button>

            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-md border border-purple-500/40"
            >
              <FlaskConical className="w-4 h-4 text-purple-200" />
              <span>Test API Request 🧪</span>
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="flex items-center space-x-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs"
            >
              <Terminal className="w-4 h-4 text-orange-400" />
              <span>Live Logs Terminal</span>
              {jobStatus.logs.length > 0 && (
                <span className="bg-orange-500 text-black font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {jobStatus.logs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Controls & Catalog Selector */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Search & Target Selector Card */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-5 bg-zinc-950/70">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="flex items-center space-x-2.5">
                <Filter className="w-5 h-5 text-orange-400" />
                <h3 className="font-extrabold text-white text-base">Select Target Anime & Season</h3>
              </div>
              <span className="text-xs font-semibold text-zinc-500">
                {filteredAnime.length} of {allAnime.length} catalog items
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search anime title or MAL ID..."
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Anime Grid Selection List */}
            <div className="max-h-64 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              {filteredAnime.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  No anime match your search.
                </div>
              ) : (
                filteredAnime.map(anime => {
                  const isSelected = selectedAnimeId === anime.id;
                  const hasMal = !!anime.malId;
                  
                  return (
                    <div
                      key={anime.id}
                      onClick={() => setSelectedAnimeId(anime.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected 
                          ? 'bg-orange-500/10 border-orange-500/60 text-white shadow-neon-orange-sm' 
                          : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img 
                          src={anime.thumbnailUrl || anime.bannerUrl || 'https://via.placeholder.com/100'} 
                          alt={anime.title} 
                          className="w-10 h-12 object-cover rounded-lg border border-zinc-800 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate text-white">{anime.title}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            {hasMal ? (
                              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                MAL ID: {anime.malId}
                              </span>
                            ) : (
                              <span className="bg-amber-950/80 text-amber-400 border border-amber-800/50 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                Missing MAL ID
                              </span>
                            )}
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {anime.totalSeasons || 1} Season(s) • {anime.episodeCount || 0} Ep(s)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {!hasMal && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMalFixAnime(anime);
                              setCustomMalId('');
                            }}
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Set MAL
                          </button>
                        )}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-orange-500 bg-orange-500' : 'border-zinc-700 bg-transparent'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Target Details & Per-Season MAL Breakdown */}
            {selectedAnime && (
              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">Selected Anime Target</span>
                    <h4 className="text-base font-extrabold text-white">{selectedAnime.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAnime.malId ? (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-lg">
                        Main MAL ID: {selectedAnime.malId}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setMalFixAnime(selectedAnime);
                          setCustomMalId('');
                        }}
                        className="bg-amber-500 text-black font-bold px-3 py-1 rounded-lg text-xs cursor-pointer shadow-neon-amber"
                      >
                        Assign Anime MAL ID
                      </button>
                    )}
                  </div>
                </div>

                {/* Per-Season Breakdown Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Anime Seasons Breakdown ({seasons.length})</span>
                    <button
                      onClick={() => setSelectedSeasonId('all')}
                      className={`text-[11px] px-2 py-0.5 rounded cursor-pointer ${selectedSeasonId === 'all' ? 'bg-orange-500/20 text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Target All Seasons
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {seasons.map(season => {
                      const seasonEps = episodes.filter(e => e.seasonId === season.id);
                      const isSelectedSeason = selectedSeasonId === season.id;
                      const activeMal = season.malId || selectedAnime.malId;

                      return (
                        <div
                          key={season.id}
                          onClick={() => setSelectedSeasonId(season.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelectedSeason
                              ? 'bg-orange-500/15 border-orange-500/60 text-white'
                              : 'bg-zinc-950/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="bg-zinc-800 text-orange-400 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                                S{season.number}
                              </span>
                              <h5 className="font-bold text-xs truncate text-white">
                                {season.name || `Season ${season.number}`}
                              </h5>
                            </div>
                            <span className="text-[11px] text-zinc-500 mt-0.5 block">
                              {seasonEps.length} Episode(s)
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {season.malId ? (
                              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                                Season MAL: {season.malId}
                              </span>
                            ) : (
                              <span className="bg-amber-950/80 text-amber-400 border border-amber-800/50 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                                Missing MAL
                              </span>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoDetectSeasonMalId(season);
                              }}
                              className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3 text-orange-400" />
                              Auto Detect
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMalFixSeason(season);
                                setCustomMalId(season.malId ? String(season.malId) : '');
                              }}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Edit MAL
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Execution Options & Sync Action Buttons */}
            <div className="space-y-4 pt-2 border-t border-zinc-900">
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center space-x-2 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={missingOnly}
                    onChange={e => setMissingOnly(e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                  />
                  <span>Sync Missing Only (Skip cached episodes)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forceRefresh}
                    onChange={e => setForceRefresh(e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                  />
                  <span>Refresh Existing Data (Force overwrite)</span>
                </label>
              </div>

              {/* Top Quick Actions Bar: ALL & Auto-Detect */}
              <div className="p-3 bg-gradient-to-r from-orange-950/40 via-purple-950/30 to-zinc-900 rounded-xl border border-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">Global Catalog Engine</span>
                  <p className="text-xs text-zinc-300 font-bold">Sync or Auto-Detect MAL IDs for ALL Anime & Seasons</p>
                </div>
                
                <button
                  onClick={handleAutoDetectAllMalIds}
                  disabled={isAutoDetectingAll || jobStatus.status === 'running'}
                  className="w-full sm:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                >
                  {isAutoDetectingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Auto-Detect MAL IDs</span>
                </button>
              </div>

              {/* Sync Action Buttons including ALL button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleSyncSelectedAnime}
                  disabled={!selectedAnimeId || jobStatus.status === 'running'}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-black font-extrabold py-3 px-4 rounded-xl shadow-neon-orange transition-all cursor-pointer flex items-center justify-center space-x-2 text-sm"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Sync Selected Target</span>
                </button>

                <button
                  onClick={handleSyncAllAnime}
                  disabled={jobStatus.status === 'running'}
                  className="w-full bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 hover:from-purple-500 hover:to-indigo-700 disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-purple-900/40 transition-all cursor-pointer flex items-center justify-center space-x-2 text-sm uppercase tracking-wider"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>ALL - SYNC ALL ANIME</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Right 1 Column: Real-Time Sync Status & Dashboard Metrics */}
        <div className="space-y-6">
          
          {/* Progress Card */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  jobStatus.status === 'running' ? 'bg-orange-500 animate-ping' :
                  jobStatus.status === 'completed' ? 'bg-emerald-500' :
                  jobStatus.status === 'paused' ? 'bg-amber-500' : 'bg-zinc-600'
                }`} />
                <h3 className="font-extrabold text-white text-base uppercase tracking-wide">
                  Sync Engine Status
                </h3>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                jobStatus.status === 'running' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                jobStatus.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                jobStatus.status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {jobStatus.status}
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-zinc-400">Total Progress:</span>
                <span className="text-orange-400 font-mono">
                  {jobStatus.completed} / {jobStatus.totalEpisodes} Episodes ({progressPercent}%)
                </span>
              </div>
              <div className="w-full bg-zinc-900 h-3.5 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                <motion.div 
                  className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 h-full rounded-full shadow-neon-orange"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Current Target Indicator */}
            {jobStatus.status === 'running' && (
              <div className="p-3.5 bg-orange-950/30 rounded-xl border border-orange-500/30 space-y-1.5 animate-pulse">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">Currently Processing</span>
                <p className="text-sm font-extrabold text-white truncate">
                  {jobStatus.currentAnime || 'Initializing...'}
                </p>
                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                  <span>{jobStatus.currentEpisodeTitle || `Episode ${jobStatus.currentEpisode}`}</span>
                  <span>MAL ID: {jobStatus.currentAnimeMalId || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Controls (Pause/Resume/Stop) */}
            {jobStatus.status === 'running' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handlePauseSync}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleStopSync}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            {jobStatus.status === 'paused' && (
              <button
                onClick={handleResumeSync}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold py-2.5 px-3 rounded-xl text-xs cursor-pointer flex items-center justify-center space-x-2 shadow-neon-emerald"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Resume Process</span>
              </button>
            )}

            {/* Metric Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Completed</span>
                <span className="text-lg font-black text-emerald-400 font-mono">{jobStatus.completed}</span>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Remaining</span>
                <span className="text-lg font-black text-orange-400 font-mono">{jobStatus.remaining}</span>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Failed / Retry</span>
                <span className="text-lg font-black text-red-400 font-mono">{jobStatus.failed} ({jobStatus.retryCount})</span>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Est. Time Left</span>
                <span className="text-sm font-black text-purple-300 font-mono mt-1 block">
                  {formatTimeRemaining(jobStatus.estimatedTimeRemainingSec)}
                </span>
              </div>
            </div>

            {/* Sync Summary Metrics */}
            <div className="p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-850 space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Synced Catalog Titles:</span>
                <span className="font-bold text-emerald-400 font-mono">{syncedCount} / {allAnime.length}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Missing MAL IDs:</span>
                <span className={`font-bold font-mono ${missingMalCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {missingMalCount} Titles
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Live Log Terminal Modal / Drawer */}
      <AnimatePresence>
        {showLogsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Terminal Header */}
              <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-orange-400" />
                  <h3 className="font-extrabold text-white text-base font-mono">
                    AniSkip Synchronization Console Logs
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isLogAutoScroll}
                      onChange={e => setIsLogAutoScroll(e.target.checked)}
                      className="accent-orange-500 rounded cursor-pointer"
                    />
                    <span>Auto Scroll</span>
                  </label>

                  <button
                    onClick={() => setShowLogsModal(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1.5 rounded-lg cursor-pointer text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Terminal Log Output */}
              <div className="flex-1 bg-black p-4 font-mono text-xs overflow-y-auto space-y-2.5 custom-scrollbar">
                {jobStatus.logs.length === 0 ? (
                  <div className="text-zinc-600 italic">No logs recorded yet.</div>
                ) : (
                  jobStatus.logs.slice().reverse().map(log => (
                    <div key={log.id} className="p-2 bg-zinc-950/70 border border-zinc-900 rounded-lg space-y-1">
                      <div className="flex items-start space-x-2 leading-relaxed">
                        <span className="text-zinc-600 flex-shrink-0">[{log.timestamp}]</span>
                        
                        {log.type === 'success' && <span className="text-emerald-400 font-bold flex-shrink-0">[SUCCESS]</span>}
                        {log.type === 'info' && <span className="text-indigo-400 font-bold flex-shrink-0">[INFO]</span>}
                        {log.type === 'warning' && <span className="text-amber-400 font-bold flex-shrink-0">[WARN]</span>}
                        {log.type === 'error' && <span className="text-red-400 font-bold flex-shrink-0">[ERROR]</span>}
                        {log.type === 'retry' && <span className="text-purple-400 font-bold flex-shrink-0">[RETRY]</span>}

                        <span className={`${
                          log.type === 'error' ? 'text-red-300 font-semibold' :
                          log.type === 'warning' ? 'text-amber-300 font-semibold' :
                          log.type === 'success' ? 'text-emerald-200 font-semibold' : 'text-zinc-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>

                      {/* Diagnostic Metadata Badge Row */}
                      {(log.seasonMalId || log.httpStatus || log.aniskipUrl || log.reason) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 pl-4 text-[11px] text-zinc-400 border-t border-zinc-900/60 mt-1">
                          {log.seasonMalId && (
                            <span className="bg-zinc-900 text-orange-400 px-2 py-0.5 rounded border border-zinc-800 font-bold">
                              Season MAL: {log.seasonMalId}
                            </span>
                          )}
                          {log.httpStatus !== undefined && (
                            <span className={`px-2 py-0.5 rounded font-bold ${log.httpStatus === 200 ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                              HTTP {log.httpStatus}
                            </span>
                          )}
                          {log.aniskipUrl && (
                            <a href={log.aniskipUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-xs flex items-center gap-1">
                              <span>Endpoint</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {log.reason && (
                            <span className="text-zinc-500 italic">
                              Reason: {log.reason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAL ID Fix Modal */}
      <AnimatePresence>
        {malFixAnime && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-orange-400" />
                  Assign MyAnimeList (MAL) ID
                </h3>
                <button
                  onClick={() => setMalFixAnime(null)}
                  className="text-zinc-500 hover:text-white cursor-pointer font-bold text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Target Anime</span>
                <p className="text-sm font-bold text-white">{malFixAnime.title}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300">MAL ID Number:</label>
                  <button
                    onClick={handleSearchMalId}
                    disabled={isSearchingMal}
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold cursor-pointer flex items-center gap-1"
                  >
                    {isSearchingMal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    <span>Auto-Detect via Jikan Search</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={customMalId}
                  onChange={e => setCustomMalId(e.target.value)}
                  placeholder="e.g. 49596"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
                />

                {malSearchResult && (
                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs space-y-1">
                    <span className="text-emerald-400 font-bold block">Top Match Found:</span>
                    <p className="text-white font-semibold">{malSearchResult.title}</p>
                    <p className="text-zinc-400 font-mono">MAL ID: {malSearchResult.malId} (Score: {malSearchResult.score})</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setMalFixAnime(null)}
                  className="w-1/2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMalId}
                  disabled={!customMalId.trim()}
                  className="w-1/2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-neon-orange"
                >
                  Save MAL ID
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Season MAL ID Fix Modal */}
      <AnimatePresence>
        {malFixSeason && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-orange-400" />
                  Assign Season MyAnimeList (MAL) ID
                </h3>
                <button
                  onClick={() => setMalFixSeason(null)}
                  className="text-zinc-500 hover:text-white cursor-pointer font-bold text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Target Season</span>
                <p className="text-sm font-bold text-white">{malFixSeason.name || `Season ${malFixSeason.number}`}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300">Season MAL ID Number:</label>
                  <button
                    onClick={async () => {
                      setIsSearchingMal(true);
                      setMalSearchResult(null);
                      try {
                        const searchQuery = `${selectedAnime?.title || ''} Season ${malFixSeason.number}`;
                        const res = await fetch(`/api/mal-search?title=${encodeURIComponent(searchQuery)}`);
                        if (res.ok) {
                          const data = await res.json();
                          setMalSearchResult(data);
                          if (data.malId) setCustomMalId(String(data.malId));
                        }
                      } catch (err) {
                        console.warn("Season MAL search error:", err);
                      } finally {
                        setIsSearchingMal(false);
                      }
                    }}
                    disabled={isSearchingMal}
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold cursor-pointer flex items-center gap-1"
                  >
                    {isSearchingMal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    <span>Auto-Search Season MAL</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={customMalId}
                  onChange={e => setCustomMalId(e.target.value)}
                  placeholder="e.g. 51009 for Jujutsu Kaisen Season 2"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
                />

                {malSearchResult && (
                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs space-y-1">
                    <span className="text-emerald-400 font-bold block">Top Match Found:</span>
                    <p className="text-white font-semibold">{malSearchResult.title}</p>
                    <p className="text-zinc-400 font-mono">MAL ID: {malSearchResult.malId}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setMalFixSeason(null)}
                  className="w-1/2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSeasonMalId}
                  disabled={!customMalId.trim()}
                  className="w-1/2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-neon-orange"
                >
                  Save Season MAL ID
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Single Test Request Modal */}
        {showTestModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-purple-900/60 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl text-left my-8 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-950/80 border border-purple-700/50 rounded-xl text-purple-400">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">
                      AniSkip API Test Inspector
                    </h3>
                    <p className="text-xs text-zinc-400">Validate request parameters, raw JSON responses, and HTTP status codes</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer font-bold text-xs"
                >
                  Close
                </button>
              </div>

              {/* Form & Presets */}
              <div className="space-y-4 flex-shrink-0">
                <div>
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1.5">Quick Anime Presets:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setTestMalId('40748'); setTestEpisodeNumber('1'); }}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
                    >
                      Jujutsu Kaisen (MAL: 40748) Ep 1
                    </button>
                    <button
                      onClick={() => { setTestMalId('38000'); setTestEpisodeNumber('1'); }}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
                    >
                      Demon Slayer (MAL: 38000) Ep 1
                    </button>
                    <button
                      onClick={() => { setTestMalId('16498'); setTestEpisodeNumber('1'); }}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
                    >
                      Attack on Titan (MAL: 16498) Ep 1
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">MAL ID <span className="text-red-400">*</span></label>
                    <input
                      type="number"
                      value={testMalId}
                      onChange={e => setTestMalId(e.target.value)}
                      placeholder="e.g. 40748"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">Episode Number <span className="text-red-400">*</span></label>
                    <input
                      type="number"
                      value={testEpisodeNumber}
                      onChange={e => setTestEpisodeNumber(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">Episode Length (Sec)</label>
                    <input
                      type="number"
                      value={testEpisodeLength}
                      onChange={e => setTestEpisodeLength(e.target.value)}
                      placeholder="0 (optional)"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleExecuteTestRequest}
                  disabled={isExecutingTest || !testMalId || !testEpisodeNumber}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  {isExecutingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Sending AniSkip v2 Request...</span>
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4" />
                      <span>Execute Single Test Request</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Output & Diagnostics */}
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                {testResult ? (
                  <div className="space-y-4">
                    {/* Status & Timing Banner */}
                    <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                      testResult.response?.status === 200 
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' 
                        : 'bg-red-950/40 border-red-800/80 text-red-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {testResult.response?.status === 200 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-extrabold text-sm">
                            HTTP Status: {testResult.response?.status || 'Error'} {testResult.response?.status === 200 ? 'OK' : 'Bad Request / Failed'}
                          </p>
                          <p className="text-xs opacity-80">
                            {testResult.parsed?.found ? 'AniSkip returned valid skip timestamps!' : (testResult.parsed?.reason || testResult.error || 'No skip times available')}
                          </p>
                        </div>
                      </div>
                      {testResult.response?.durationMs !== undefined && (
                        <span className="text-xs font-mono bg-black/40 px-2.5 py-1 rounded border border-white/10">
                          {testResult.response.durationMs}ms
                        </span>
                      )}
                    </div>

                    {/* Request Inspector Card */}
                    {testResult.request && (
                      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">1. Outgoing Request Configuration</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-zinc-500 block">HTTP Method:</span>
                            <span className="text-indigo-400 font-bold">{testResult.request.method}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Headers:</span>
                            <span className="text-zinc-300">Accept: application/json</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs font-mono block">Constructed URL:</span>
                          <a 
                            href={testResult.request.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:underline text-xs font-mono break-all flex items-center gap-1 mt-0.5"
                          >
                            <span>{testResult.request.url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs font-mono block">Query Parameters:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {testResult.request.queryParams?.types?.map((t: string) => (
                              <span key={t} className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded text-[11px] font-mono">
                                types: {t}
                              </span>
                            ))}
                            <span className="bg-zinc-800 text-amber-300 border border-zinc-700 px-2 py-0.5 rounded text-[11px] font-mono">
                              episodeLength: {testResult.request.queryParams?.episodeLength}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Parsed Timings Card */}
                    {testResult.parsed && (
                      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">2. Parsed Skip Timings</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-black/60 rounded-lg border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-orange-400">Intro (Opening)</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${testResult.parsed.intro?.exists ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {testResult.parsed.intro?.exists ? 'EXISTS' : 'NONE'}
                              </span>
                            </div>
                            {testResult.parsed.intro?.exists ? (
                              <p className="font-mono text-zinc-200 text-sm font-bold pt-1">
                                {testResult.parsed.intro.start}s → {testResult.parsed.intro.end}s
                              </p>
                            ) : (
                              <p className="text-zinc-500 italic text-[11px]">No intro timing returned</p>
                            )}
                          </div>

                          <div className="p-3 bg-black/60 rounded-lg border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-400">Outro (Ending)</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${testResult.parsed.outro?.exists ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {testResult.parsed.outro?.exists ? 'EXISTS' : 'NONE'}
                              </span>
                            </div>
                            {testResult.parsed.outro?.exists ? (
                              <p className="font-mono text-zinc-200 text-sm font-bold pt-1">
                                {testResult.parsed.outro.start}s → {testResult.parsed.outro.end}s
                              </p>
                            ) : (
                              <p className="text-zinc-500 italic text-[11px]">No outro timing returned</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw JSON Response Card */}
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">3. Raw Response Body</span>
                        <span className="text-[10px] font-mono text-zinc-500">JSON Format</span>
                      </div>
                      <pre className="p-3 bg-black border border-zinc-900 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-48 custom-scrollbar">
                        {testResult.response?.json 
                          ? JSON.stringify(testResult.response.json, null, 2)
                          : (testResult.response?.rawBody || testResult.error || 'No body')}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center space-y-2 text-zinc-500">
                    <FlaskConical className="w-8 h-8 mx-auto text-zinc-600" />
                    <p className="text-xs font-semibold">Click "Execute Single Test Request" above to test an live endpoint call.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
