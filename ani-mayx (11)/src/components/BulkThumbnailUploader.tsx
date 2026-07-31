import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Trash2, Copy, Check, Loader2, Search, AlertCircle, 
  CheckCircle2, ArrowRight, FileText, ChevronDown, Sparkles, RefreshCw, X, HelpCircle
} from 'lucide-react';
import { db, collection, getDocs, doc, updateDoc, query, where } from '../firebase';
import { Anime, Season, Episode } from '../types';

interface BulkThumbnailUploaderProps {
  allAnime: Anime[];
  refreshData: () => void;
}

interface ParsedLine {
  lineNumber: number;
  rawLine: string;
  episodeNumber: number | null;
  thumbnailUrl: string;
  isValid: boolean;
  errorReason: string;
  matchedEpisode?: Episode;
}

export default function BulkThumbnailUploader({ allAnime, refreshData }: BulkThumbnailUploaderProps) {
  // Navigation / Selection States
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  
  // Input states
  const [bulkText, setBulkText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Progress & Execution States
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessSummary, setShowSuccessSummary] = useState(false);
  
  // Result Stats
  const [stats, setStats] = useState<{
    totalProcessed: number;
    successfullyUpdated: number;
    failedUpdates: number;
    missingEpisodes: number[];
    invalidUrls: { line: number; text: string }[];
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-select first anime series if available
  useEffect(() => {
    if (allAnime.length > 0 && !selectedAnime) {
      setSelectedAnime(allAnime[0]);
    }
  }, [allAnime, selectedAnime]);

  // Fetch seasons and all episodes when selected anime changes or on local refresh
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

        // Fetch all episodes of this anime to group them in memory
        const epsSnap = await getDocs(
          query(collection(db, 'episodes'), where('animeId', '==', selectedAnime.id))
        );
        const epsList: Episode[] = [];
        epsSnap.forEach((docSnap) => {
          epsList.push({ id: docSnap.id, ...docSnap.data() } as Episode);
        });
        setAllEpisodes(epsList);
        
        // Auto-select first season if available, or preserve selected season if it exists in the new list
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
  }, [selectedSeason, allEpisodes]);

  // Filter anime list
  const filteredAnime = allAnime.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Copy Example Format
  const handleCopyExample = () => {
    const exampleText = `1 | https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80\n2 | https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=600&auto=format&fit=crop&q=80\n3 | https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80`;
    navigator.clipboard.writeText(exampleText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Load Example format to textarea
  const handleLoadExample = () => {
    setBulkText(
      `1 | https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80\n2 | https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=600&auto=format&fit=crop&q=80\n3 | https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80`
    );
  };

  // File drag & drop parsing
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === "text/plain" || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setBulkText(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please drop a plain text (.txt) file or .csv file.");
      }
    }
  };

  // Parse and validate lines in real-time
  const parseLines = (): ParsedLine[] => {
    if (!bulkText.trim()) return [];
    
    const lines = bulkText.split('\n');
    return lines.map((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // If empty line, return invalid but empty so we can choose to skip silently or show nicely
      if (!trimmed) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: null,
          thumbnailUrl: '',
          isValid: false,
          errorReason: 'Empty Line'
        };
      }

      const separatorIdx = trimmed.indexOf('|');
      if (separatorIdx === -1) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: null,
          thumbnailUrl: '',
          isValid: false,
          errorReason: 'Missing separator |'
        };
      }

      const epPart = trimmed.substring(0, separatorIdx).trim();
      const urlPart = trimmed.substring(separatorIdx + 1).trim();

      const epNum = parseInt(epPart, 10);
      if (isNaN(epNum) || epNum <= 0) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: null,
          thumbnailUrl: urlPart,
          isValid: false,
          errorReason: `Invalid episode number: "${epPart}"`
        };
      }

      // Basic URL regex (allow standard web URLs, Base64 data URLs, and local Sandbox indexeddb paths)
      const urlRegex = /^(https?:\/\/|indexeddb:\/\/|data:image\/)/i;
      const isUrlValid = urlRegex.test(urlPart);
      if (!urlPart) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: epNum,
          thumbnailUrl: '',
          isValid: false,
          errorReason: 'Empty Thumbnail URL'
        };
      }
      
      if (!isUrlValid) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: epNum,
          thumbnailUrl: urlPart,
          isValid: false,
          errorReason: 'Invalid URL scheme (Must start with http://, https://, or data:image)'
        };
      }

      // Check if episode exists in loaded list
      const matchedEp = episodes.find(e => e.number === epNum);
      if (!matchedEp) {
        return {
          lineNumber: lineNum,
          rawLine: line,
          episodeNumber: epNum,
          thumbnailUrl: urlPart,
          isValid: false,
          errorReason: `Episode #${epNum} does not exist in this season`,
          matchedEpisode: undefined
        };
      }

      return {
        lineNumber: lineNum,
        rawLine: line,
        episodeNumber: epNum,
        thumbnailUrl: urlPart,
        isValid: true,
        errorReason: '',
        matchedEpisode: matchedEp
      };
    });
  };

  const allParsedLines = parseLines();
  // Filter out truly empty lines when summarizing errors or counting entries
  const nonCommentLines = allParsedLines.filter(l => l.rawLine.trim() !== '');
  const validLines = nonCommentLines.filter(l => l.isValid);
  const invalidLines = nonCommentLines.filter(l => !l.isValid);

  // Apply changes to database
  const handleUpdateThumbnails = async () => {
    if (validLines.length === 0) return;
    setIsUpdating(true);
    setUpdateProgress(0);
    setShowConfirmation(false);

    let successCount = 0;
    let failCount = 0;
    const missingEps: number[] = [];
    const badUrls: { line: number; text: string }[] = [];

    // Detailed categorization of why invalid lines are invalid for the success summary
    invalidLines.forEach(l => {
      if (l.errorReason.includes("does not exist")) {
        if (l.episodeNumber) missingEps.push(l.episodeNumber);
      } else {
        badUrls.push({ line: l.lineNumber, text: l.errorReason });
      }
    });

    const totalToUpdate = validLines.length;

    try {
      for (let i = 0; i < totalToUpdate; i++) {
        const item = validLines[i];
        if (item.matchedEpisode) {
          try {
            const epRef = doc(db, 'episodes', item.matchedEpisode.id);
            await updateDoc(epRef, { thumbnailUrl: item.thumbnailUrl });
            successCount++;
          } catch (err) {
            console.error(`Failed to update episode ID ${item.matchedEpisode.id}:`, err);
            failCount++;
          }
        } else {
          failCount++;
        }
        setUpdateProgress(Math.round(((i + 1) / totalToUpdate) * 100));
      }

      setStats({
        totalProcessed: nonCommentLines.length,
        successfullyUpdated: successCount,
        failedUpdates: failCount,
        missingEpisodes: missingEps,
        invalidUrls: badUrls
      });

      // Refresh data on parent view and locally
      setRefreshCount(prev => prev + 1);
      refreshData();
      setShowSuccessSummary(true);
    } catch (err) {
      console.error("Bulk thumbnail update failed completely:", err);
      alert("An error occurred while bulk updating thumbnails.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 text-left max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-orange-500" />
            Bulk Thumbnail Uploader
          </h2>
          <p className="text-xs text-zinc-400 font-semibold mt-1">
            Seamlessly batch-update episode thumbnails for an entire season in seconds.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoadExample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-800 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            Example Format
          </button>
          <button
            onClick={handleCopyExample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-800 transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            {isCopied ? 'Copied!' : 'Copy Example Format'}
          </button>
        </div>
      </div>

      {/* STEP 1 & STEP 2: Anime and Season Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/40 p-5 rounded-2xl border border-zinc-850">
        
        {/* Step 1: Select Anime with Searchable Dropdown */}
        <div className="space-y-2" ref={dropdownRef}>
          <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Step 1: Select Anime Series
          </label>
          <div className="relative">
            <div 
              onClick={() => setIsDropdownOpen(true)}
              className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between text-zinc-200 text-xs font-semibold cursor-pointer transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className={selectedAnime ? 'text-zinc-100 font-bold' : 'text-zinc-500 font-medium'}>
                  {selectedAnime ? selectedAnime.title : 'Search & select anime...'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 transition" />
            </div>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800"
                >
                  <div className="sticky top-0 p-2 bg-zinc-950 border-b border-zinc-900">
                    <input
                      type="text"
                      placeholder="Type to filter..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 outline-none focus:border-orange-500"
                      autoFocus
                    />
                  </div>
                  <div className="p-1">
                    {filteredAnime.length > 0 ? (
                      filteredAnime.map((anime) => (
                        <button
                          key={anime.id}
                          onClick={() => {
                            setSelectedAnime(anime);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${
                            selectedAnime?.id === anime.id 
                              ? 'bg-orange-500 text-black font-extrabold' 
                              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          {anime.title}
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-4 text-xs text-zinc-500">No matching anime found</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Step 2: Select Season */}
        <div className="space-y-2">
          <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Step 2: Select Season
          </label>
          <div className="relative">
            {isLoadingSeasons ? (
              <div className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-500 font-semibold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                Loading available seasons...
              </div>
            ) : !selectedAnime ? (
              <div className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-500 font-semibold">
                Please select an anime first
              </div>
            ) : seasons.length === 0 ? (
              <div className="w-full bg-red-950/10 border border-red-900/30 text-red-400 rounded-xl p-3 text-xs font-semibold">
                No seasons defined for this anime yet. Define seasons in the Seasons & Episodes tab.
              </div>
            ) : (
              <select
                value={selectedSeason?.id || ''}
                onChange={(e) => {
                  const s = seasons.find(season => season.id === e.target.value);
                  if (s) setSelectedSeason(s);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 text-zinc-100 text-xs font-semibold outline-none transition cursor-pointer appearance-none"
              >
                {seasons.map(s => {
                  const count = allEpisodes.filter(ep => ep.seasonId === s.id).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({count} Episode{count === 1 ? '' : 's'})
                    </option>
                  );
                })}
              </select>
            )}
            {selectedAnime && seasons.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* STEP 3: Bulk Thumbnail Textarea and Drag & Drop Area */}
      <AnimatePresence mode="wait">
        {selectedAnime && selectedSeason && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="space-y-6"
          >
            {/* Episode List Overview Banner */}
            <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850 text-xs text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <span>Selected: <strong className="text-zinc-200">{selectedAnime.title}</strong> — <strong className="text-zinc-200">{selectedSeason.name}</strong></span>
              </div>
              <div className="flex items-center gap-4">
                <span>Total Episodes: <strong className="text-orange-400 font-mono text-sm">{episodes.length}</strong></span>
                {isLoadingEpisodes && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
              </div>
            </div>

            {/* Step 3 Card with Textarea and Drop Event listeners */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Step 3: Paste Episode & Thumbnail URLs
                </label>
                {bulkText && (
                  <button
                    onClick={() => setBulkText('')}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Input
                  </button>
                )}
              </div>

              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl border transition-all ${
                  isDragging 
                    ? 'border-orange-500 bg-orange-500/5 scale-[1.01]' 
                    : 'border-zinc-800 bg-zinc-950'
                }`}
              >
                <textarea
                  ref={textareaRef}
                  rows={8}
                  placeholder={`Example Format:\nEpisode Number | Thumbnail URL\n\n1 | https://example.com/thumb1.jpg\n2 | https://example.com/thumb2.jpg\n3 | https://example.com/thumb3.jpg`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full bg-transparent p-5 text-xs text-zinc-200 font-mono outline-none focus:ring-1 focus:ring-orange-500/20 rounded-2xl leading-relaxed resize-y scrollbar-thin scrollbar-thumb-zinc-800"
                />

                {/* Drag over overlay info */}
                {isDragging && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-zinc-950/90 rounded-2xl space-y-2 border border-orange-500 border-dashed">
                    <FileText className="w-10 h-10 text-orange-500 animate-bounce" />
                    <p className="text-sm font-bold text-zinc-200">Drop Plain Text (.txt) or CSV File Here</p>
                    <p className="text-xs text-zinc-400 font-medium">We'll automatically extract episode & thumbnail lists!</p>
                  </div>
                )}

                {/* Textarea state indicator */}
                {!bulkText && (
                  <div className="absolute right-4 bottom-4 pointer-events-none flex items-center gap-1 text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                    <Upload className="w-3.5 h-3.5" />
                    Or drag and drop a .txt file
                  </div>
                )}
              </div>
            </div>

            {/* LIVE PARSED PREVIEW SECTION */}
            {nonCommentLines.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Live Parsed Preview
                  </h3>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-semibold">
                      {validLines.length} Ready
                    </span>
                    {invalidLines.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
                        {invalidLines.length} Skipper/Error
                      </span>
                    )}
                  </div>
                </div>

                {isLoadingEpisodes ? (
                  <div className="bg-zinc-950/60 border border-zinc-850 rounded-2xl p-8 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    <span className="text-xs text-zinc-400 font-semibold">Verifying episodes against the database...</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-zinc-950/60 border border-zinc-850 rounded-2xl overflow-hidden">
                      <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-950 sticky top-0 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-850">
                            <tr>
                              <th className="p-3 pl-5 w-24">Episode</th>
                              <th className="p-3 w-32">Image Preview</th>
                              <th className="p-3">Thumbnail URL Source</th>
                              <th className="p-3 pr-5 w-48 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900">
                            {nonCommentLines.map((parsed, idx) => (
                              <tr key={idx} className={`hover:bg-zinc-900/30 transition ${!parsed.isValid ? 'bg-red-500/[0.02]' : ''}`}>
                                {/* Episode column */}
                                <td className="p-3 pl-5 font-mono font-bold text-zinc-300">
                                  {parsed.episodeNumber !== null ? (
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-orange-500">#{parsed.episodeNumber}</span>
                                      {parsed.matchedEpisode?.title && (
                                        <span className="text-[10px] text-zinc-500 max-w-[120px] truncate block font-sans" title={parsed.matchedEpisode.title}>
                                          {parsed.matchedEpisode.title}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500">Row {parsed.lineNumber}</span>
                                  )}
                                </td>

                                {/* Thumbnail Image Preview column */}
                                <td className="p-3">
                                  {parsed.isValid ? (
                                    <div className="w-16 h-10 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow">
                                      <img 
                                        src={parsed.thumbnailUrl} 
                                        alt={`Ep #${parsed.episodeNumber} preview`}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100";
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-16 h-10 bg-zinc-950 border border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-600">
                                      No image
                                    </div>
                                  )}
                                </td>

                                {/* URL column */}
                                <td className="p-3 font-mono text-[11px] text-zinc-400 break-all max-w-xs md:max-w-md truncate" title={parsed.thumbnailUrl}>
                                  {parsed.thumbnailUrl || <span className="text-zinc-600 italic">No URL parsed</span>}
                                </td>

                                {/* Status column */}
                                <td className="p-3 pr-5 text-right font-semibold">
                                  {parsed.isValid ? (
                                    <span className="inline-flex items-center gap-1 text-green-400 text-[11px]">
                                      <Check className="w-3.5 h-3.5 shrink-0" />
                                      Ready
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-400 text-[11px]" title={parsed.errorReason}>
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate max-w-[160px] block">{parsed.errorReason}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Primary Update Button triggers confirmation */}
                    {validLines.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowConfirmation(true)}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold px-6 py-3.5 rounded-xl text-xs transition-all shadow-lg hover:shadow-orange-500/10 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        UPDATE EPISODE THUMBNAILS ({validLines.length} ENTR{validLines.length === 1 ? 'Y' : 'IES'})
                      </button>
                    ) : (
                      <div className="bg-amber-950/10 border border-amber-900/30 text-amber-400 p-4 rounded-xl text-xs flex gap-2">
                        <HelpCircle className="w-4 h-4 shrink-0" />
                        <span>Provide at least one row matching a valid episode number and thumbnail URL (starts with http/https) to update.</span>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowConfirmation(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/20 text-orange-500">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-zinc-100">Apply Thumbnail Updates?</h3>
                <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                  You are about to update the episode thumbnails for <strong className="text-zinc-200">{selectedAnime?.title}</strong> - <strong className="text-zinc-200">{selectedSeason?.name}</strong>.
                </p>
              </div>

              {/* Warnings if any rows have errors */}
              {invalidLines.length > 0 && (
                <div className="p-3 rounded-lg bg-red-950/10 border border-red-900/20 text-left text-xs text-red-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    <span>⚠️ {invalidLines.length} rows contain errors</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
                    These invalid lines will be skipped. Only the {validLines.length} valid episode thumbnails will be updated.
                  </p>
                </div>
              )}

              <div className="text-left text-xs bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 space-y-1 font-semibold text-zinc-400">
                <div className="flex justify-between">
                  <span>Total Parsed:</span>
                  <span className="text-zinc-200 font-mono font-bold">{nonCommentLines.length}</span>
                </div>
                <div className="flex justify-between text-green-400 font-bold">
                  <span>Valid Updates to Apply:</span>
                  <span className="font-mono">{validLines.length}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold transition border border-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateThumbnails}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black rounded-lg text-xs font-extrabold shadow-lg shadow-orange-500/10 transition"
                >
                  Apply Batch Write
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROGRESS OVERLAY DURING BATCH SAVE */}
      <AnimatePresence>
        {isUpdating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="max-w-sm w-full space-y-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-base font-bold text-zinc-200">Processing Bulk Thumbnails</h3>
                <p className="text-xs text-zinc-500 font-semibold font-mono">Updating Firestore Records... {updateProgress}%</p>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                <motion.div 
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${updateProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS SUMMARY MODAL */}
      <AnimatePresence>
        {showSuccessSummary && stats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowSuccessSummary(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 text-left"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 text-green-500">
                  <Check className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-extrabold text-zinc-100">Updates Applied Successfully!</h3>
                <p className="text-xs text-zinc-400 font-medium">
                  Episode thumbnails for <strong className="text-zinc-200">{selectedAnime?.title}</strong> - <strong className="text-zinc-200">{selectedSeason?.name}</strong> have been updated.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850 text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Processed</span>
                  <div className="text-xl font-bold font-mono text-zinc-300">{stats.totalProcessed}</div>
                </div>
                <div className="bg-green-950/10 p-3 rounded-xl border border-green-900/20 text-center space-y-1">
                  <span className="text-[10px] text-green-500 uppercase tracking-wider font-bold">Updated</span>
                  <div className="text-xl font-bold font-mono text-green-400">{stats.successfullyUpdated}</div>
                </div>
                <div className="bg-red-950/10 p-3 rounded-xl border border-red-900/20 text-center space-y-1">
                  <span className="text-[10px] text-red-500 uppercase tracking-wider font-bold">Failed</span>
                  <div className="text-xl font-bold font-mono text-red-400">{stats.failedUpdates}</div>
                </div>
              </div>

              {/* Details breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Report Summary</h4>

                {/* Missing Episodes Details */}
                {stats.missingEpisodes.length > 0 && (
                  <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-1.5">
                    <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Missing Episode Numbers ({stats.missingEpisodes.length})
                    </div>
                    <p className="text-[10px] text-zinc-500 font-semibold leading-relaxed">
                      The following episode numbers were parsed but could not be found in this season database:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stats.missingEpisodes.map((num, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-red-400/95 font-bold">
                          #{num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invalid URLs list */}
                {stats.invalidUrls.length > 0 && (
                  <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-2">
                    <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <X className="w-4 h-4 shrink-0" />
                      Failed Formats or Invalid URLs ({stats.invalidUrls.length})
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
                      {stats.invalidUrls.map((err, i) => (
                        <div key={i} className="text-[10px] text-zinc-400 flex justify-between bg-zinc-950 border border-zinc-850 p-2 rounded">
                          <span className="font-mono font-bold text-zinc-500">Line {err.line}:</span>
                          <span className="text-right text-red-400/90 font-medium truncate max-w-[280px]">{err.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clean Status badge if perfect */}
                {stats.failedUpdates === 0 && stats.missingEpisodes.length === 0 && stats.invalidUrls.length === 0 && (
                  <div className="p-4 bg-green-500/[0.02] rounded-xl border border-green-500/20 flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-green-400">100% Import Accuracy!</h5>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-medium leading-relaxed">
                        All pasted lines were verified and updated successfully without any errors or omissions. Excellent!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSuccessSummary(false);
                  setBulkText(''); // Clear input on success
                }}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-extrabold border border-zinc-800 transition"
              >
                Return to Admin Panel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
