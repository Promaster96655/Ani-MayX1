import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Film, 
  Tv, 
  Folder, 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  PlusCircle, 
  ShieldAlert, 
  TrendingUp, 
  Video, 
  Settings,
  Upload,
  Link,
  Hash,
  Key,
  Copy,
  FileText,
  RefreshCw,
  Database,
  Download,
  ShieldCheck,
  Search,
  UserPlus,
  Shield,
  Lock,
  Clock,
  Calendar,
  BarChart3,
  Radio,
  FileSpreadsheet,
  Sparkles,
  FastForward,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  Code,
  AlertTriangle,
  Megaphone
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, ref, uploadBytesResumable, getDownloadURL, getLocalSandboxMode, setLocalSandboxMode, seedAnimeDatabase, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, checkIsDefaultAdmin, getActiveFirebaseConfig, getDoc } from '../firebase';
import { Anime, Season, Episode, UserProfile, GenreType } from '../types';
import { storeVideoInIndexedDB } from '../lib/indexedDb';
import BulkThumbnailUploader from './BulkThumbnailUploader';
import AutoThumbnailGenerator from './AutoThumbnailGenerator';
import AutoSkipSetup from './AutoSkipSetup';
import AniSkipSyncPanel from './AniSkipSyncPanel';
import SystemDiagnosticsPanel from './SystemDiagnosticsPanel';

const ALL_AVAILABLE_PERMISSIONS = [
  { key: 'upload_videos', label: 'Upload Videos' },
  { key: 'add_anime', label: 'Add New Anime' },
  { key: 'edit_anime', label: 'Edit Anime' },
  { key: 'delete_anime', label: 'Delete Anime' },
  { key: 'add_season', label: 'Add Season' },
  { key: 'delete_season', label: 'Delete Season' },
  { key: 'add_episode', label: 'Add Episode' },
  { key: 'delete_episode', label: 'Delete Episode' },
  { key: 'upload_thumbnail', label: 'Upload Episode Thumbnail' },
  { key: 'bulk_episode', label: 'Bulk Episode Upload' },
  { key: 'bulk_thumbnail', label: 'Bulk Thumbnail Upload' },
  { key: 'edit_banner', label: 'Edit Banner' },
  { key: 'manage_announcements', label: 'Manage Announcements' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'ban_users', label: 'Ban Users' },
  { key: 'unban_users', label: 'Unban Users' },
  { key: 'delete_comments', label: 'Delete Comments' },
  { key: 'delete_reviews', label: 'Delete Reviews' },
  { key: 'view_analytics', label: 'Access Analytics' },
  { key: 'create_admins', label: 'Create Other Admins' },
  { key: 'edit_permissions', label: 'Edit Admin Permissions' },
  { key: 'remove_admin', label: 'Remove Admin' },
  { key: 'backup_restore', label: 'Backup & Restore Database' },
  { key: 'all', label: 'Full Admin Access' }
];

interface AdminSectionProps {
  currentUserId: string;
  currentUser?: UserProfile | null;
  onExit: () => void;
  allAnime: Anime[];
  refreshData: () => Promise<void>;
}

export default function AdminSection({ 
  currentUserId, 
  currentUser,
  onExit, 
  allAnime,
  refreshData 
}: AdminSectionProps) {
  // Tabs: 'stats', 'anime', 'seasons_episodes', 'users', 'hash_generator', 'backup_restore', 'bulk_thumbnails', 'auto_thumbnail', 'firebase_config'
  const [activeTab, setActiveTab] = useState<'stats' | 'anime' | 'seasons_episodes' | 'users' | 'hash_generator' | 'backup_restore' | 'bulk_operations' | 'banner_manager' | 'bulk_thumbnails' | 'auto_thumbnail' | 'auto_skip_setup' | 'auto_setup_new' | 'aniskip_sync' | 'diagnostics' | 'firebase_config' | 'api_generator' | 'announcements'>('stats');

  // Stats Counters
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAnime: 0,
    totalSeasons: 0,
    totalEpisodes: 0,
    totalViews: 0
  });

  const [storageStats, setStorageStats] = useState<{
    databaseSizeKB: number;
    databaseSizeMB: number;
    totalCollections: number;
    totalItemsCount: number;
    counts: Record<string, number>;
    vpsStorageLocation: string;
    nodeVersion: string;
    platform: string;
  } | null>(null);

  // Collections States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [adminInvites, setAdminInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<string[]>([
    'view_analytics', 'manage_anime', 'manage_seasons_episodes'
  ]);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [editingAdminUser, setEditingAdminUser] = useState<UserProfile | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);

  // Bulk operations, Schedule and NewsStates
  const [bulkSeasonsText, setBulkSeasonsText] = useState('');
  const [bulkEpisodesText, setBulkEpisodesText] = useState('');
  const [newsList, setNewsList] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [newSchedule, setNewSchedule] = useState({
    animeId: '',
    episodeNumber: 1,
    releaseDay: 'Monday' as 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
    time: '18:00'
  });
  const [newsForm, setNewsForm] = useState({
    title: '',
    content: '',
    imageUrl: '',
    source: ''
  });

  // External Upload API State
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [lastApiRequest, setLastApiRequest] = useState<string | null>(null);
  const [apiHistoryLogs, setApiHistoryLogs] = useState<any[]>([]);
  const [isLoadingApiSettings, setIsLoadingApiSettings] = useState(false);
  const [isLoadingApiHistory, setIsLoadingApiHistory] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isTogglingAPI, setIsTogglingAPI] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Fetch API Upload Settings & History
  const fetchApiSettings = async () => {
    setIsLoadingApiSettings(true);
    try {
      const res = await fetch('/api/admin/upload-api/settings');
      const data = await res.json();
      if (data.success) {
        setApiEnabled(data.enabled);
        setApiKey(data.apiKey || '');
        setLastApiRequest(data.lastApiRequest);
      }
    } catch (err) {
      console.error('Failed to fetch API settings:', err);
    } finally {
      setIsLoadingApiSettings(false);
    }
  };

  const fetchApiHistory = async () => {
    setIsLoadingApiHistory(true);
    try {
      const res = await fetch('/api/admin/upload-api/history');
      const data = await res.json();
      if (data.success) {
        setApiHistoryLogs(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch API upload history:', err);
    } finally {
      setIsLoadingApiHistory(false);
    }
  };

  const handleToggleApi = async () => {
    setIsTogglingAPI(true);
    try {
      const nextState = !apiEnabled;
      const res = await fetch('/api/admin/upload-api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setApiEnabled(data.enabled);
        fetchApiSettings();
      }
    } catch (err) {
      console.error('Failed to toggle API status:', err);
    } finally {
      setIsTogglingAPI(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (apiKey && !window.confirm("Are you sure you want to regenerate the API key? The existing key will be invalidated instantly.")) {
      return;
    }
    setIsGeneratingKey(true);
    try {
      const res = await fetch('/api/admin/upload-api/generate', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setApiKey(data.apiKey);
        setIsKeyVisible(true);
        fetchApiSettings();
      }
    } catch (err) {
      console.error('Failed to generate API Key:', err);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bulk_operations' || activeTab === 'api_generator') {
      fetchApiSettings();
      fetchApiHistory();
    }
  }, [activeTab]);

  // Anime Creation Form State
  const [isAnimeModalOpen, setIsAnimeModalOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState<Anime | null>(null);
  const [animeForm, setAnimeForm] = useState({
    title: '',
    description: '',
    bannerUrl: '',
    thumbnailUrl: '',
    genres: [] as GenreType[],
    rating: '8.5',
    status: 'Ongoing' as 'Ongoing' | 'Completed',
    category: 'Regular' as 'Popular' | 'Trending' | 'Featured' | 'Regular',
    releaseYear: 2026,
    type: 'Series' as 'Series' | 'Movie',
    videoUrl: '',
    duration: 5400,
  });

  // Base64 helper files upload strings or URL toggle
  const [bannerInputType, setBannerInputType] = useState<'url' | 'file'>('url');
  const [thumbnailInputType, setThumbnailInputType] = useState<'url' | 'file'>('url');
  const [movieVideoInputType, setMovieVideoInputType] = useState<'url' | 'file'>('url');

  // Genres selection checklist constant
  const availableGenres: GenreType[] = [
    'Action', 'Adventure', 'Fantasy', 'Sci-Fi', 'Drama', 'Comedy', 
    'Slice of Life', 'Mystery', 'Romance', 'Thriller', 'Demons', 'Mecha', 'Sports'
  ];

  // Season management states
  const [selectedSeasonAnimeId, setSelectedSeasonAnimeId] = useState<string>('');
  const [newSeasonForm, setNewSeasonForm] = useState({
    number: 1,
    name: ''
  });

  // Episode management states
  const [selectedEpisodeSeasonId, setSelectedEpisodeSeasonId] = useState<string>('');
  const [videoInputType, setVideoInputType] = useState<'url' | 'file'>('url');
  const [epForm, setEpForm] = useState({
    number: 1,
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    duration: 300
  });
  const [isEditingEp, setIsEditingEp] = useState<Episode | null>(null);

  // Load backend stats, seasons, episodes, users
  const loadAdminData = async () => {
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers: UserProfile[] = [];
      usersSnap.forEach(d => {
        fetchedUsers.push({ uid: d.id, ...d.data() } as UserProfile);
      });
      setUsers(fetchedUsers);

      // 2. Fetch Seasons
      const seasonsSnap = await getDocs(collection(db, 'seasons'));
      const fetchedSeasons: Season[] = [];
      seasonsSnap.forEach(d => {
        fetchedSeasons.push({ id: d.id, ...d.data() } as Season);
      });
      setSeasons(fetchedSeasons);

      // 3. Fetch Episodes
      const epsSnap = await getDocs(collection(db, 'episodes'));
      const fetchedEpisodes: Episode[] = [];
      epsSnap.forEach(d => {
        fetchedEpisodes.push({ id: d.id, ...d.data() } as Episode);
      });
      setEpisodes(fetchedEpisodes);

      // 4. Fetch Watch views tally
      const historySnap = await getDocs(collection(db, 'watchHistory'));
      const fetchedHistory: any[] = [];
      historySnap.forEach(d => {
        fetchedHistory.push({ id: d.id, ...d.data() });
      });
      setWatchHistory(fetchedHistory);

      // 5. Fetch News
      const newsSnap = await getDocs(collection(db, 'news'));
      const fetchedNews: any[] = [];
      newsSnap.forEach(d => {
        fetchedNews.push({ id: d.id, ...d.data() });
      });
      setNewsList(fetchedNews);

      // 6. Fetch Schedules
      const schedulesSnap = await getDocs(collection(db, 'schedule'));
      const fetchedSchedules: any[] = [];
      schedulesSnap.forEach(d => {
        fetchedSchedules.push({ id: d.id, ...d.data() });
      });
      setSchedules(fetchedSchedules);

      // 7. Fetch Admin Invites
      const invitesSnap = await getDocs(collection(db, 'adminInvites'));
      const fetchedInvites: any[] = [];
      invitesSnap.forEach(d => {
        fetchedInvites.push({ id: d.id, ...d.data() });
      });
      setAdminInvites(fetchedInvites);

      // 8. Fetch Admin Logs
      const logsSnap = await getDocs(collection(db, 'adminLogs'));
      const fetchedLogs: any[] = [];
      logsSnap.forEach(d => {
        fetchedLogs.push({ id: d.id, ...d.data() });
      });
      fetchedLogs.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setAdminLogs(fetchedLogs);
      
      setStats({
        totalUsers: fetchedUsers.length,
        totalAnime: allAnime.length,
        totalSeasons: fetchedSeasons.length,
        totalEpisodes: fetchedEpisodes.length,
        totalViews: historySnap.size
      });

      // 9. Fetch VPS Storage Stats
      try {
        const statsRes = await fetch('/api/storage-stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStorageStats(statsData);
        } else {
          throw new Error("API storage-stats status non-ok");
        }
      } catch (err) {
        console.warn("Could not load VPS storage stats, falling back to LocalStorage Sandbox computation:", err);
        const counts: Record<string, number> = {};
        let totalItems = 0;
        const collections = [
          'anime', 'seasons', 'episodes', 'users', 'watchHistory', 
          'watchlist', 'reviews', 'comments', 'news', 'schedule', 
          'adminInvites', 'favorites', 'favoriteEpisodes', 'users_backup', 'adminLogs'
        ];
        
        let totalLength = 0;
        collections.forEach(col => {
          const cached = localStorage.getItem(`animayx_db_col_${col}`) || '[]';
          totalLength += cached.length;
          try {
            const arr = JSON.parse(cached);
            counts[col] = arr.length;
            totalItems += arr.length;
          } catch (e) {
            counts[col] = 0;
          }
        });
        
        setStorageStats({
          databaseSizeKB: parseFloat((totalLength / 1024).toFixed(2)),
          databaseSizeMB: parseFloat((totalLength / (1024 * 1024)).toFixed(3)),
          totalCollections: collections.length,
          totalItemsCount: totalItems,
          counts,
          vpsStorageLocation: "Browser LocalStorage (Web Sandbox)",
          nodeVersion: "Browser Engine (Client-Side)",
          platform: "Netlify (Web Sandbox Mode)",
        });
      }

    } catch (e) {
      console.error("Error reading initial admin states:", e);
    }
  };

  const logAdminAction = async (actionType: string, details: string) => {
    try {
      const activeUser = users.find(u => u.uid === currentUserId) || currentUser;
      await addDoc(collection(db, 'adminLogs'), {
        userId: currentUserId,
        email: activeUser?.email || 'admin@ani-mayx.net',
        displayName: activeUser?.displayName || 'Administrator',
        actionType,
        details,
        timestamp: new Date()
      });
      
      // Reload logs locally
      const logsSnap = await getDocs(collection(db, 'adminLogs'));
      const fetchedLogs: any[] = [];
      logsSnap.forEach(d => {
        fetchedLogs.push({ id: d.id, ...d.data() });
      });
      fetchedLogs.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setAdminLogs(fetchedLogs);
    } catch (e) {
      console.warn("Could not log action to Firestore:", e);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [allAnime]);

  // 1. Bulk Season Import Action
  const handleBulkImportSeasons = async () => {
    if (!hasPermission('add_season')) {
      alert("Permission Denied: You do not have permission to add seasons.");
      return;
    }
    if (!selectedSeasonAnimeId) {
      alert("Please select a target anime show first.");
      return;
    }
    const lines = bulkSeasonsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert("Please enter season titles (one per line) or comma-separated numbers.");
      return;
    }

    try {
      let countAdded = 0;
      for (const line of lines) {
        let numVal = 1;
        let nameVal = line;
        
        const matchNum = line.match(/\d+/);
        if (matchNum) {
          numVal = parseInt(matchNum[0], 10);
        }

        const seasonId = `${selectedSeasonAnimeId}_season${numVal}`;
        const seasonData = {
          id: seasonId,
          animeId: selectedSeasonAnimeId,
          number: numVal,
          name: nameVal,
          episodeCount: 0,
          createdAt: new Date()
        };

        await setDoc(doc(db, 'seasons', seasonId), seasonData);
        countAdded++;
      }

      const animeRef = doc(db, 'anime', selectedSeasonAnimeId);
      const updatedCount = activeAnimeSeasons.length + countAdded;
      await updateDoc(animeRef, { totalSeasons: updatedCount });

      alert(`Successfully imported ${countAdded} seasons!`);
      setBulkSeasonsText('');
      await loadAdminData();
    } catch (err) {
      console.error("Bulk seasons import failure:", err);
      alert("Failed to batch import seasons.");
    }
  };

  // 2. Bulk Episode Upload Handler
  const handleBulkUploadEpisodes = async () => {
    if (!selectedSeasonAnimeId || !selectedEpisodeSeasonId) {
      alert("Please select both a target anime and an active season first.");
      return;
    }
    const lines = bulkEpisodesText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert("Please enter episode items (one per line). Format:\nNumber | Title | Video URL | Thumbnail URL | Duration (seconds) | Description");
      return;
    }

    try {
      let countAdded = 0;
      const parsedSeasonNumber = seasons.find(s => s.id === selectedEpisodeSeasonId)?.number || 1;

      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 3) continue;

        const epNum = parseInt(parts[0], 10) || 1;
        const epTitle = parts[1] || `Episode ${epNum}`;
        const epVideoUrl = parts[2];
        const epThumb = parts[3] || '';
        const epDur = parseInt(parts[4], 10) || 1440;
        const epDesc = parts[5] || `Bulk imported episode ${epNum} from video library.`;

        const episodeId = `${selectedSeasonAnimeId}_s${parsedSeasonNumber}_e${epNum}`;
        const epData = {
          id: episodeId,
          animeId: selectedSeasonAnimeId,
          seasonId: selectedEpisodeSeasonId,
          seasonNumber: parsedSeasonNumber,
          number: epNum,
          title: epTitle,
          description: epDesc,
          videoUrl: epVideoUrl,
          thumbnailUrl: epThumb || allAnime.find(a => a.id === selectedSeasonAnimeId)?.thumbnailUrl || '',
          duration: epDur,
          createdAt: new Date()
        };

        await setDoc(doc(db, 'episodes', episodeId), epData);
        countAdded++;
      }

      const animeRef = doc(db, 'anime', selectedSeasonAnimeId);
      const updatedCount = episodes.filter(e => e.animeId === selectedSeasonAnimeId).length + countAdded;
      await updateDoc(animeRef, { episodeCount: updatedCount });

      alert(`Successfully bulk-imported ${countAdded} episodes!`);
      setBulkEpisodesText('');
      await loadAdminData();
    } catch (err) {
      console.error("Bulk episodes import failure:", err);
      alert("Failed to bulk upload episodes. Check entry format correctness.");
    }
  };

  // 3. Save Schedule Release Event
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.animeId) {
      alert("Please select an anime for the schedule!");
      return;
    }
    try {
      const parentAnime = allAnime.find(a => a.id === newSchedule.animeId);
      const scheduleId = `${newSchedule.animeId}_ep${newSchedule.episodeNumber}_${newSchedule.releaseDay.toLowerCase()}`;
      
      const schedData = {
        id: scheduleId,
        animeId: newSchedule.animeId,
        animeTitle: parentAnime?.title || 'Unknown Anime',
        episodeNumber: Number(newSchedule.episodeNumber),
        releaseDay: newSchedule.releaseDay,
        time: newSchedule.time,
        createdAt: new Date()
      };

      await setDoc(doc(db, 'schedule', scheduleId), schedData);
      alert("Episode release schedule added successfully!");
      setNewSchedule({ ...newSchedule, episodeNumber: newSchedule.episodeNumber + 1 });
      await loadAdminData();
    } catch (err) {
      console.error("Failed adding episode schedule:", err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await deleteDoc(doc(db, 'schedule', id));
      await loadAdminData();
    } catch (err) {
      console.error("Failed to delete schedule item:", err);
    }
  };

  // 4. News Creation
  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsForm.title || !newsForm.content) {
      alert("Please fill in news title and content.");
      return;
    }
    try {
      const newsId = 'news_' + Date.now();
      const newsItem = {
        id: newsId,
        title: newsForm.title,
        content: newsForm.content,
        imageUrl: newsForm.imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80',
        source: newsForm.source || 'Ani-MayX Editorial',
        createdAt: new Date()
      };

      await setDoc(doc(db, 'news', newsId), newsItem);
      alert("News article published successfully!");
      setNewsForm({ title: '', content: '', imageUrl: '', source: '' });
      await loadAdminData();
    } catch (err) {
      console.error("Failed publishing news item:", err);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm("Are you sure you want to delete this news article?")) return;
    try {
      await deleteDoc(doc(db, 'news', id));
      await loadAdminData();
    } catch (err) {
      console.error("Failed news article deletion:", err);
    }
  };

  // 5. Banner/Featured Highlights Category updater
  const handleUpdateCategory = async (animeId: string, category: 'Popular' | 'Trending' | 'Featured' | 'Regular') => {
    try {
      await updateDoc(doc(db, 'anime', animeId), { category });
      await loadAdminData();
      await refreshData();
      alert(`Updated show category to ${category}!`);
    } catch (err) {
      console.error("Failed setting category:", err);
    }
  };

  // Handle Anime selection for Seasons list
  useEffect(() => {
    if (allAnime.length > 0 && !selectedSeasonAnimeId) {
      setSelectedSeasonAnimeId(allAnime[0].id);
    }
  }, [allAnime]);

  // Handle Season selection for Episodes list
  const activeAnimeSeasons = seasons
    .filter(s => s.animeId === selectedSeasonAnimeId)
    .sort((a, b) => a.number - b.number);

  useEffect(() => {
    if (activeAnimeSeasons.length > 0) {
      setSelectedEpisodeSeasonId(activeAnimeSeasons[0].id);
    } else {
      setSelectedEpisodeSeasonId('');
    }
  }, [selectedSeasonAnimeId, seasons]);

  const activeSeasonEpisodes = episodes
    .filter(ep => ep.seasonId === selectedEpisodeSeasonId)
    .sort((a, b) => a.number - b.number);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // File Upload utility to support images and MP4 videos correctly
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetField: 'bannerUrl' | 'thumbnailUrl' | 'videoUrl' | 'epThumbnailUrl' | 'animeMovieVideoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (targetField === 'videoUrl' || targetField === 'animeMovieVideoUrl') {
      if (!file.type.startsWith('video/') && !file.name.endsWith('.mp4') && !file.name.endsWith('.m3u8')) {
        const errStr = "Please upload a valid MP4 or compatible video file.";
        setUploadError(errStr);
        alert(errStr);
        return;
      }

      console.log("Saving video file to high-speed local browser cache (IndexedDB)...");
      setUploadingField(targetField);
      setUploadProgress(10);

      const localKey = `localvideo_${Date.now()}`;
      
      // 1. First write immediately to high-speed local IndexedDB cache (instantaneous)
      storeVideoInIndexedDB(localKey, file).then(() => {
        console.log(`Dynamic local IndexedDB cache secured: indexeddb://${localKey}`);
        const localSchemeUrl = `indexeddb://${localKey}`;
        
        // Immediately assign the local scheme so they can save the form instantly!
        if (targetField === 'animeMovieVideoUrl') {
          setAnimeForm(prev => ({ ...prev, videoUrl: localSchemeUrl }));
        } else {
          setEpForm(prev => ({ ...prev, videoUrl: localSchemeUrl }));
        }
        
        // Mark upload as instantly completed in UI and unlock form!
        setUploadProgress(100);
        setTimeout(() => {
          setUploadingField(null);
        }, 500);

        console.log("Local video caching successful. Form is unlocked and ready to submit!");

        // 2. Simultaneously, fire-and-forget Firebase Cloud Storage upload as a silent non-blocking background task
        try {
          const fileExtension = file.name.split('.').pop() || 'mp4';
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const storagePath = `anime_videos/${Date.now()}_${cleanFileName}`;
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, file);

          uploadTask.on('state_changed', 
            null, 
            (error) => {
              console.warn("Silent background cloud backup upload warning (non-blocking):", error);
            }, 
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("Background cloud backup completed silently. Permanent URL is:", downloadUrl);

                // Write/secure mapping in Firestore videoUrlMap so any player fallback can find it instantly!
                await setDoc(doc(db, 'videoUrlMap', localKey), { 
                  cloudUrl: downloadUrl, 
                  createdAt: new Date() 
                });

                // Update any Firestore anime documents matching this local video URL
                const qAnime = query(collection(db, 'anime'), where('videoUrl', '==', localSchemeUrl));
                const animeSnap = await getDocs(qAnime);
                animeSnap.forEach(async (d) => {
                  await updateDoc(doc(db, 'anime', d.id), { videoUrl: downloadUrl });
                  console.log(`Updated animeMovieDoc ${d.id} videoUrl directly to remote cloud URL.`);
                });

                // Update any Firestore episode documents matching this local video URL
                const qEp = query(collection(db, 'episodes'), where('videoUrl', '==', localSchemeUrl));
                const epSnap = await getDocs(qEp);
                epSnap.forEach(async (d) => {
                  await updateDoc(doc(db, 'episodes', d.id), { videoUrl: downloadUrl });
                  console.log(`Updated episodeDoc ${d.id} videoUrl directly to remote cloud URL.`);
                });

                // Also update form states if still on screen
                setAnimeForm(prev => prev.videoUrl === localSchemeUrl ? { ...prev, videoUrl: downloadUrl } : prev);
                setEpForm(prev => prev.videoUrl === localSchemeUrl ? { ...prev, videoUrl: downloadUrl } : prev);

                // Re-trigger static dataset parent sync
                if (refreshData) {
                  refreshData();
                }

              } catch (urlErr: any) {
                console.warn("Could not retrieve remote download URL silently:", urlErr);
              }
            }
          );
        } catch (initErr: any) {
          console.warn("Firebase Storage background transfer initiation skipped:", initErr);
        }

      }).catch(err => {
        console.error("Failed to write video to IndexedDB cache:", err);
        setUploadError(`Failed to save video locally: ${err.message || err}`);
        setUploadingField(null);
        setUploadProgress(0);
      });
    } else {
      setUploadingField(targetField);
      setUploadProgress(0);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (targetField === 'bannerUrl') {
          setAnimeForm(prev => ({ ...prev, bannerUrl: base64String }));
        } else if (targetField === 'thumbnailUrl') {
          setAnimeForm(prev => ({ ...prev, thumbnailUrl: base64String }));
        } else if (targetField === 'epThumbnailUrl') {
          setEpForm(prev => ({ ...prev, thumbnailUrl: base64String }));
        }
        setUploadingField(null);
        setUploadProgress(100);
      };
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  // Anime Add or Edit Action
  const handleSaveAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAnime) {
      if (!hasPermission('edit_anime')) {
        alert("Permission Denied: You do not have permission to edit anime.");
        return;
      }
    } else {
      if (!hasPermission('add_anime')) {
        alert("Permission Denied: You do not have permission to add new anime.");
        return;
      }
    }
    if (!animeForm.title || !animeForm.bannerUrl || !animeForm.thumbnailUrl) {
      alert("Please fill all the fields (Title, Banner image, Card card).");
      return;
    }

    if (animeForm.type === 'Movie' && !animeForm.videoUrl) {
      alert("Please provide a video URL or upload a file for the anime movie.");
      return;
    }

    try {
      const documentId = editingAnime ? editingAnime.id : animeForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const animeData: Anime = {
        id: documentId,
        title: animeForm.title || '',
        description: animeForm.description || '',
        bannerUrl: animeForm.bannerUrl || '',
        thumbnailUrl: animeForm.thumbnailUrl || '',
        genres: animeForm.genres || [],
        rating: animeForm.rating || '8.5',
        status: animeForm.status || 'Ongoing',
        category: animeForm.category || 'Regular',
        releaseYear: Number(animeForm.releaseYear) || 2026,
        createdAt: (editingAnime && editingAnime.createdAt) ? editingAnime.createdAt : new Date(),
        episodeCount: (editingAnime && editingAnime.episodeCount) ? editingAnime.episodeCount : 0,
        totalSeasons: (editingAnime && editingAnime.totalSeasons) ? editingAnime.totalSeasons : 0,
        type: animeForm.type || 'Series',
        videoUrl: animeForm.type === 'Movie' ? (animeForm.videoUrl || '') : '',
        duration: animeForm.type === 'Movie' ? (Number(animeForm.duration) || 5400) : 0,
      };

      await setDoc(doc(db, 'anime', documentId), animeData);
      await logAdminAction(editingAnime ? 'EDIT_ANIME' : 'CREATE_ANIME', `Anime Title: ${animeForm.title}, ID: ${documentId}`);
      
      setIsAnimeModalOpen(false);
      setEditingAnime(null);
      // Reset
      setAnimeForm({
        title: '',
        description: '',
        bannerUrl: '',
        thumbnailUrl: '',
        genres: [],
        rating: '8.5',
        status: 'Ongoing',
        category: 'Regular',
        releaseYear: 2026,
        type: 'Series',
        videoUrl: '',
        duration: 5400,
      });

      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Save anime database details failure:", err);
    }
  };

  const handleEditAnimeClick = (anime: Anime) => {
    setEditingAnime(anime);
    setAnimeForm({
      title: anime.title || '',
      description: anime.description || '',
      bannerUrl: anime.bannerUrl || '',
      thumbnailUrl: anime.thumbnailUrl || '',
      genres: anime.genres || [],
      rating: anime.rating || '8.5',
      status: anime.status || 'Ongoing',
      category: anime.category || 'Regular',
      releaseYear: anime.releaseYear || 2026,
      type: anime.type || 'Series',
      videoUrl: anime.videoUrl || '',
      duration: anime.duration || 5400,
    });
    setBannerInputType('url');
    setThumbnailInputType('url');
    setMovieVideoInputType('url');
    setIsAnimeModalOpen(true);
  };

  const handleDeleteAnimeClick = async (animeId: string) => {
    if (!hasPermission('delete_anime')) {
      alert("Permission Denied: You do not have permission to delete anime.");
      return;
    }
    if (!confirm("Are you sure you want to delete this anime? This removes its catalog details representation from the application list.")) return;
    try {
      await deleteDoc(doc(db, 'anime', animeId));
      await logAdminAction('DELETE_ANIME', `Deleted anime ID: ${animeId}`);
      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Error deleting anime document:", err);
    }
  };

  // Toggle category helper
  const handleToggleGenre = (g: GenreType) => {
    if (animeForm.genres.includes(g)) {
      setAnimeForm(prev => ({ ...prev, genres: prev.genres.filter(x => x !== g) }));
    } else {
      setAnimeForm(prev => ({ ...prev, genres: [...prev.genres, g] }));
    }
  };

  // Create Season
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('add_season')) {
      alert("Permission Denied: You do not have permission to add a season.");
      return;
    }
    if (!selectedSeasonAnimeId) return;

    try {
      const seasonId = `${selectedSeasonAnimeId}_${newSeasonForm.number}`;
      const seasonData: Season = {
        id: seasonId,
        animeId: selectedSeasonAnimeId,
        number: Number(newSeasonForm.number),
        name: newSeasonForm.name || `Season ${newSeasonForm.number}`,
        episodeCount: 0,
        createdAt: new Date()
      };

      await setDoc(doc(db, 'seasons', seasonId), seasonData);
      await logAdminAction('CREATE_SEASON', `Anime ID: ${selectedSeasonAnimeId}, Season Name: ${seasonData.name}, ID: ${seasonId}`);

      // increment simple season counts in Anime profile
      const targetAnime = allAnime.find(a => a.id === selectedSeasonAnimeId);
      if (targetAnime) {
        const oldSeasonCount = targetAnime.totalSeasons || 0;
        await updateDoc(doc(db, 'anime', selectedSeasonAnimeId), {
          totalSeasons: oldSeasonCount + 1
        });
      }

      setNewSeasonForm({ number: (activeAnimeSeasons.length + 2), name: '' });
      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Create season data failure:", err);
    }
  };

  const handleDeleteSeasonClick = async (seasonId: string) => {
    if (!hasPermission('delete_season')) {
      alert("Permission Denied: You do not have permission to delete a season.");
      return;
    }
    if (!confirm("Are you sure you want to delete this season and all its associated episodes?")) return;
    try {
      await deleteDoc(doc(db, 'seasons', seasonId));
      await logAdminAction('DELETE_SEASON', `Deleted season ID: ${seasonId}`);
      
      // Delete associated episodes
      const filteredEps = episodes.filter(ep => ep.seasonId === seasonId);
      for (const ep of filteredEps) {
        await deleteDoc(doc(db, 'episodes', ep.id));
      }

      const targetAnime = allAnime.find(a => a.id === selectedSeasonAnimeId);
      if (targetAnime) {
        const oldSeasonCount = targetAnime.totalSeasons || 1;
        await updateDoc(doc(db, 'anime', selectedSeasonAnimeId), {
          totalSeasons: Math.max(0, oldSeasonCount - 1)
        });
      }

      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Delete season data failure:", err);
    }
  };

  // Create / Update Episodes
  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEpisodeSeasonId || !selectedSeasonAnimeId) return;
    if (!epForm.title || !epForm.videoUrl) {
      alert("Please provide at least a title and video URL / file stream.");
      return;
    }

    try {
      const findSeason = seasons.find(s => s.id === selectedEpisodeSeasonId);
      const sNum = findSeason ? findSeason.number : 1;
      const episodeId = isEditingEp ? isEditingEp.id : `${selectedSeasonAnimeId}_${sNum}_${epForm.number}`;

      // If thumbnail is empty, use anime's thumbnail as fallback
      const finalThumb = epForm.thumbnailUrl || (allAnime.find(a => a.id === selectedSeasonAnimeId)?.thumbnailUrl || '');

      const epData: Episode = {
        id: episodeId,
        animeId: selectedSeasonAnimeId,
        seasonId: selectedEpisodeSeasonId,
        seasonNumber: sNum,
        number: Number(epForm.number) || 1,
        title: epForm.title || '',
        description: epForm.description || '',
        videoUrl: epForm.videoUrl || '',
        thumbnailUrl: finalThumb || '',
        duration: Number(epForm.duration) || 0,
        createdAt: (isEditingEp && isEditingEp.createdAt) ? isEditingEp.createdAt : new Date()
      };

      await setDoc(doc(db, 'episodes', episodeId), epData);
      await logAdminAction(isEditingEp ? 'EDIT_EPISODE' : 'CREATE_EPISODE', `Episode Title: ${epForm.title}, Num: ${epForm.number}, ID: ${episodeId}`);

      // If new, increment counts
      if (!isEditingEp) {
        const targetAnime = allAnime.find(a => a.id === selectedSeasonAnimeId);
        if (targetAnime) {
          const oldEpCount = targetAnime.episodeCount || 0;
          await updateDoc(doc(db, 'anime', selectedSeasonAnimeId), {
            episodeCount: oldEpCount + 1
          });
        }
      }

      // Reset episode form
      setEpForm({
        number: activeSeasonEpisodes.length + 2,
        title: '',
        description: '',
        videoUrl: '',
        thumbnailUrl: '',
        duration: 300
      });
      setIsEditingEp(null);

      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Save episode failure:", err);
    }
  };

  const handleEditEpClick = (ep: Episode) => {
    setIsEditingEp(ep);
    setEpForm({
      number: ep.number || 1,
      title: ep.title || '',
      description: ep.description || '',
      videoUrl: ep.videoUrl || '',
      thumbnailUrl: ep.thumbnailUrl || '',
      duration: ep.duration || 300
    });
  };

  const handleDeleteEpClick = async (epId: string) => {
    if (!confirm("Are you sure you want to delete this episode?")) return;
    try {
      await deleteDoc(doc(db, 'episodes', epId));
      await logAdminAction('DELETE_EPISODE', `Deleted episode ID: ${epId}`);
      
      const targetAnime = allAnime.find(a => a.id === selectedSeasonAnimeId);
      if (targetAnime) {
        const oldEpCount = targetAnime.episodeCount || 1;
        await updateDoc(doc(db, 'anime', selectedSeasonAnimeId), {
          episodeCount: Math.max(0, oldEpCount - 1)
        });
      }

      await refreshData();
      await loadAdminData();
    } catch (err) {
      console.error("Delete ep failure:", err);
    }
  };

  // Toggle user permissions/roles
  const handleToggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    if (userId === currentUserId) {
      alert("You cannot strip yourself of developer administrative privileges.");
      return;
    }
    const activeUser = users.find(u => u.uid === currentUserId) || currentUser;
    const isCurrentUserMainAdmin = activeUser ? (activeUser.email === 'afajs1629@gmail.com' || activeUser.email === 'ani-mayx@gmail.com' || checkIsDefaultAdmin(activeUser.email)) : false;
    if (!isCurrentUserMainAdmin) {
      alert("Only a Main Admin (ani-mayx@gmail.com, afajs1629@gmail.com, or mrzorvixofficial@gmail.com) can grant, revoke, or modify administrator accounts.");
      return;
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const targetUser = users.find(u => u.uid === userId);
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        // Reset permissions when demoting to user, set defaults when promoting
        permissions: newRole === 'admin' ? ['view_analytics', 'manage_anime', 'manage_seasons_episodes'] : []
      });
      await logAdminAction('TOGGLE_ROLE', `Swapped ${targetUser?.email || userId} role to ${newRole}`);
      await loadAdminData();
    } catch (e) {
      console.error("Change role error:", e);
    }
  };

  // Ban or Unban user
  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    if (userId === currentUserId) {
      alert("You cannot ban yourself from the application server.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: !isBanned
      });
      await loadAdminData();
    } catch (e) {
      console.error("Ban/unban operation has failed:", e);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      alert("Please provide a valid Gmail account to invite.");
      return;
    }
    const emailLower = inviteEmail.trim().toLowerCase();
    
    // Check if user is already an admin
    const existingUser = users.find(u => u.email?.toLowerCase() === emailLower);
    if (existingUser && existingUser.role === 'admin') {
      alert("This account is already registered as an administrator.");
      return;
    }

    // Check if invitation is already pending
    const existingInvite = adminInvites.find(i => i.email === emailLower && i.status === 'pending');
    if (existingInvite) {
      alert("An invitation is already pending for this email address.");
      return;
    }

    setIsSendingInvite(true);
    try {
      const activeUser = users.find(u => u.uid === currentUserId) || currentUser;
      await addDoc(collection(db, 'adminInvites'), {
        email: emailLower,
        permissions: invitePermissions,
        status: 'pending',
        createdAt: new Date(),
        invitedBy: activeUser?.email || 'System Admin'
      });

      await logAdminAction('INVITE_ADMIN', `Invited ${emailLower} with permissions: ${invitePermissions.join(', ')}`);
      
      // Reload invitations list
      const invitesSnap = await getDocs(collection(db, 'adminInvites'));
      const fetchedInvites: any[] = [];
      invitesSnap.forEach(d => {
        fetchedInvites.push({ id: d.id, ...d.data() });
      });
      setAdminInvites(fetchedInvites);

      setInviteEmail('');
      setInvitePermissions(['view_analytics', 'manage_anime', 'manage_seasons_episodes']);
      alert(`Invitation sent successfully to ${emailLower}!`);
    } catch (err: any) {
      console.error("Error sending admin invite:", err);
      alert(`Invitation transmission failed: ${err.message || err}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Are you sure you want to cancel and delete the pending invitation for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'adminInvites', inviteId));
      await logAdminAction('CANCEL_INVITE', `Cancelled pending invitation for ${email}`);
      
      // Reload invitations list
      const invitesSnap = await getDocs(collection(db, 'adminInvites'));
      const fetchedInvites: any[] = [];
      invitesSnap.forEach(d => {
        fetchedInvites.push({ id: d.id, ...d.data() });
      });
      setAdminInvites(fetchedInvites);
    } catch (err: any) {
      console.error("Error cancelling invitation:", err);
      alert(`Cancellation failed: ${err.message || err}`);
    }
  };

  const handleOpenEditPermissions = (adminUser: UserProfile) => {
    setEditingAdminUser(adminUser);
    setEditingPermissions(adminUser.permissions || []);
  };

  const handleSavePermissions = async () => {
    if (!editingAdminUser) return;
    setIsUpdatingPermissions(true);
    try {
      await updateDoc(doc(db, 'users', editingAdminUser.uid), {
        permissions: editingPermissions
      });

      await logAdminAction('UPDATE_ADMIN_PERMISSIONS', `Updated ${editingAdminUser.email} permissions to: ${editingPermissions.join(', ')}`);
      
      setEditingAdminUser(null);
      await loadAdminData();
      alert("Administrative permissions updated successfully!");
    } catch (err: any) {
      console.error("Error saving admin permissions:", err);
      alert(`Permissions update failed: ${err.message || err}`);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  // Delete user profile
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      alert("You cannot delete your own administrative workspace entry.");
      return;
    }
    if (!confirm("Are you sure you want to purge this user? This does not delete their Firebase Auth credential, but will delete their profile details.")) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      await loadAdminData();
    } catch (e) {
      console.error(" purge operation has failed:", e);
    }
  };

  const currentUserProfile = users.find(u => u.uid === currentUserId) || currentUser;
  const isMainAdmin = currentUserProfile?.email === 'afajs1629@gmail.com' || currentUserProfile?.email === 'ani-mayx@gmail.com' || (currentUserProfile?.email && checkIsDefaultAdmin(currentUserProfile.email));

  // Check if current user has a specific permission
  const hasPermission = (permission: string): boolean => {
    const profile = users.find(u => u.uid === currentUserId) || currentUser;
    if (!profile) return false;

    // Main administrators have total bypass to avoid lockouts
    const isThisMainAdmin = profile.email === 'afajs1629@gmail.com' || profile.email === 'ani-mayx@gmail.com' || (profile.email && checkIsDefaultAdmin(profile.email));
    if (isThisMainAdmin) return true;

    if (profile.role !== 'admin') return false;

    // Default admin role gets access to all features if permissions list is missing, empty, or has 'all' bypass
    if (!profile.permissions || profile.permissions.length === 0 || profile.permissions.includes('all')) return true;

    // Direct match
    if (profile.permissions.includes(permission)) return true;

    // Legacy and composite key routing
    if (permission === 'manage_anime') {
      const animeKeys = ['add_anime', 'edit_anime', 'delete_anime', 'manage_anime'];
      return animeKeys.some(k => profile.permissions?.includes(k));
    }
    if (permission === 'manage_seasons_episodes') {
      const epKeys = ['add_season', 'delete_season', 'add_episode', 'delete_episode', 'bulk_episode', 'bulk_thumbnail', 'upload_thumbnail', 'upload_videos', 'manage_seasons_episodes'];
      return epKeys.some(k => profile.permissions?.includes(k));
    }
    if (permission === 'manage_banners') {
      const bannerKeys = ['edit_banner', 'manage_banners'];
      return bannerKeys.some(k => profile.permissions?.includes(k));
    }
    if (permission === 'manage_users') {
      const userKeys = ['manage_users', 'ban_users', 'unban_users', 'create_admins', 'edit_permissions', 'remove_admin'];
      return userKeys.some(k => profile.permissions?.includes(k));
    }

    return false;
  };

  // Automatically adjust activeTab if the user is restricted
  useEffect(() => {
    if (users.length === 0) return;
    const permittedTabs: any[] = [];
    if (hasPermission('view_analytics')) permittedTabs.push('stats');
    if (hasPermission('manage_anime')) permittedTabs.push('anime');
    if (hasPermission('manage_seasons_episodes')) {
      permittedTabs.push('seasons_episodes');
      permittedTabs.push('bulk_operations');
      permittedTabs.push('bulk_thumbnails');
      permittedTabs.push('auto_thumbnail');
      permittedTabs.push('auto_skip_setup');
      permittedTabs.push('api_generator');
    }
    if (hasPermission('manage_banners')) {
      permittedTabs.push('banner_manager');
      permittedTabs.push('announcements');
    }
    if (hasPermission('manage_users')) permittedTabs.push('users');
    if (hasPermission('view_analytics')) permittedTabs.push('hash_generator');
    if (hasPermission('backup_restore')) permittedTabs.push('backup_restore');

    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      setActiveTab(permittedTabs[0]);
    }
  }, [users, currentUserId]);

  // Compute analytics from watch progress history logs
  const analytics = React.useMemo(() => {
    if (watchHistory.length === 0) {
      return {
        totalHours: 0,
        todayHours: 0,
        weekHours: 0,
        monthHours: 0,
        mostWatchedAnime: 'N/A',
        mostWatchedEpisode: 'N/A',
        activeUsers: 0,
        peakTime: 'N/A',
        avgDurationPerUser: 0,
        hourlyData: [] as { hour: string; count: number }[],
        animeShareData: [] as { name: string; hours: number }[],
        weeklyData: [] as { name: string; hours: number }[]
      };
    }

    let totalSeconds = 0;
    let todaySeconds = 0;
    let weekSeconds = 0;
    let monthSeconds = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeThreshold = new Date(now.getTime() - 15 * 60 * 1000); // 15 mins active threshold

    const animeStats: Record<string, { seconds: number; views: number }> = {};
    const episodeStats: Record<string, { seconds: number; views: number }> = {};
    const uniqueUsers = new Set<string>();
    const activeUsersSet = new Set<string>();
    const hourCounts = new Array(24).fill(0);

    // Day of week stats (Mon-Sun)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekDaySeconds = new Array(7).fill(0);

    watchHistory.forEach(entry => {
      const progress = entry.progress || 0;
      totalSeconds += progress;
      uniqueUsers.add(entry.userId);

      // Resolve Date
      let entryDate = new Date();
      if (entry.updatedAt) {
        if (typeof entry.updatedAt.toDate === 'function') {
          entryDate = entry.updatedAt.toDate();
        } else if (entry.updatedAt.seconds) {
          entryDate = new Date(entry.updatedAt.seconds * 1000);
        } else {
          entryDate = new Date(entry.updatedAt);
        }
      }

      // Range validation checks
      if (entryDate >= startOfToday) {
        todaySeconds += progress;
      }
      if (entryDate >= startOfWeek) {
        weekSeconds += progress;
      }
      if (entryDate >= startOfMonth) {
        monthSeconds += progress;
      }
      if (entryDate >= activeThreshold) {
        activeUsersSet.add(entry.userId);
      }

      // Hour counts for peak time
      const hour = entryDate.getHours();
      hourCounts[hour] += 1;

      // Day of week counts
      const dayIndex = entryDate.getDay();
      weekDaySeconds[dayIndex] += progress;

      // Anime stats
      const aTitle = entry.animeTitle || 'Unknown Anime';
      if (!animeStats[aTitle]) {
        animeStats[aTitle] = { seconds: 0, views: 0 };
      }
      animeStats[aTitle].seconds += progress;
      animeStats[aTitle].views += 1;

      // Episode stats
      const epTitle = entry.episodeTitle ? `Ep ${entry.episodeNumber}: ${entry.episodeTitle}` : `Ep ${entry.episodeNumber}`;
      const epFull = `${aTitle} - ${epTitle}`;
      if (!episodeStats[epFull]) {
        episodeStats[epFull] = { seconds: 0, views: 0 };
      }
      episodeStats[epFull].seconds += progress;
      episodeStats[epFull].views += 1;
    });

    // Find most watched anime
    let mostWatchedAnime = 'None';
    let maxAnimeSeconds = -1;
    Object.entries(animeStats).forEach(([title, stat]) => {
      if (stat.seconds > maxAnimeSeconds) {
        maxAnimeSeconds = stat.seconds;
        mostWatchedAnime = title;
      }
    });

    // Find most watched episode
    let mostWatchedEpisode = 'None';
    let maxEpisodeSeconds = -1;
    Object.entries(episodeStats).forEach(([title, stat]) => {
      if (stat.seconds > maxEpisodeSeconds) {
        maxEpisodeSeconds = stat.seconds;
        mostWatchedEpisode = title;
      }
    });

    // Find peak hour
    let peakHourIndex = 0;
    let maxHourCount = -1;
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > maxHourCount) {
        maxHourCount = hourCounts[h];
        peakHourIndex = h;
      }
    }
    const ampm = peakHourIndex >= 12 ? 'PM' : 'AM';
    const displayHour = peakHourIndex % 12 === 0 ? 12 : peakHourIndex % 12;
    const peakTime = `${displayHour}:00 ${ampm} (${maxHourCount} views recorded)`;

    // Calculations
    const totalHours = Number((totalSeconds / 3600).toFixed(1));
    const todayHours = Number((todaySeconds / 3600).toFixed(1));
    const weekHours = Number((weekSeconds / 3600).toFixed(1));
    const monthHours = Number((monthSeconds / 3600).toFixed(1));
    const avgDurationPerUser = uniqueUsers.size > 0 ? Number((totalHours / uniqueUsers.size).toFixed(1)) : 0;

    // Charts preparation
    const hourlyData = hourCounts.map((count, hr) => {
      const hLabel = hr % 12 === 0 ? `12${hr >= 12 ? 'pm' : 'am'}` : `${hr % 12}${hr >= 12 ? 'pm' : 'am'}`;
      return { hour: hLabel, count };
    });

    const animeShareData = Object.entries(animeStats)
      .map(([name, stat]) => ({
        name,
        hours: Number((stat.seconds / 3600).toFixed(1))
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    const weeklyData = dayNames.map((name, idx) => ({
      name: name.substring(0, 3),
      hours: Number((weekDaySeconds[idx] / 3600).toFixed(1))
    }));

    return {
      totalHours,
      todayHours,
      weekHours,
      monthHours,
      mostWatchedAnime,
      mostWatchedEpisode,
      activeUsers: activeUsersSet.size,
      peakTime,
      avgDurationPerUser,
      hourlyData,
      animeShareData,
      weeklyData
    };
  }, [watchHistory]);

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 md:px-8 bg-[#0b0813] min-h-screen text-zinc-100 text-left">
      {/* Title Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-950/40 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2.5">
            <Settings className="w-8 h-8 text-orange-500 shadow-neon-orange rounded-lg" />
            <span>ADMINISTRATIVE TERMINAL</span>
          </h1>
          <p className="text-sm font-semibold text-zinc-400 mt-1.5">
            Maintain anime collections, manage watch seasons/episodes, modify roles, and consult system statistics.
          </p>
        </div>
        <button
          onClick={onExit}
          className="bg-purple-950/60 hover:bg-purple-900 text-purple-300 font-bold border border-purple-800/40 px-5	py-3 rounded-xl transition-all active:scale-95 text-sm cursor-pointer self-start"
        >
          RETURN TO HOME
        </button>
      </div>

      {/* Selector tab lists */}
      <div className="flex flex-wrap gap-2.5 mb-8 border-b border-zinc-900 pb-3">
        {[
          { tab: 'stats', label: 'Dashboard Statistics', Icon: BarChart2, perm: 'view_analytics' },
          { tab: 'anime', label: 'Anime Collections Manager', Icon: Film, perm: 'manage_anime' },
          { tab: 'seasons_episodes', label: 'Seasons & Episodes', Icon: Video, perm: 'manage_seasons_episodes' },
          { tab: 'bulk_operations', label: 'Bulk Imports & Scheduler', Icon: PlusCircle, perm: 'manage_seasons_episodes' },
          { tab: 'api_generator', label: 'API Generator 🔑', Icon: Cpu, perm: 'manage_seasons_episodes' },
          { tab: 'bulk_thumbnails', label: 'Bulk Thumbnail Uploader', Icon: Upload, perm: 'manage_seasons_episodes' },
          { tab: 'auto_thumbnail', label: 'Auto Thumbnail', Icon: RefreshCw, perm: 'manage_seasons_episodes' },
          { tab: 'auto_setup_new', label: 'Auto Setup New', Icon: Sparkles, perm: 'manage_seasons_episodes' },
          { tab: 'aniskip_sync', label: 'AniSkip Sync ⭐', Icon: FastForward, perm: 'manage_seasons_episodes' },
          { tab: 'banner_manager', label: 'Banners & News', Icon: Tv, perm: 'manage_banners' },
          { tab: 'announcements', label: 'App Announcement 📢', Icon: Megaphone, perm: 'manage_banners' },
          { tab: 'users', label: 'User Roll Call', Icon: Users, perm: 'manage_users' },
          { tab: 'hash_generator', label: 'Advanced Hash & Slug Tool', Icon: Hash, perm: 'view_analytics' },
          { tab: 'backup_restore', label: 'Backup & Restore', Icon: Database, perm: 'backup_restore' },
          { tab: 'diagnostics', label: 'System Diagnostics ⚙️', Icon: Cpu, perm: 'manage_seasons_episodes' },
          { tab: 'firebase_config', label: 'Firebase Connection 🔌', Icon: Database, perm: 'backup_restore' },
        ].filter(t => hasPermission(t.perm)).map(({ tab, label, Icon }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center space-x-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === tab 
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-neon-orange font-bold' 
                : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-900 hover:border-purple-800/30'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tabs panels routing */}
      <div>
        
        {/* STATS PANEL */}
        {activeTab === 'stats' && (
          <div className="space-y-8">
            {/* Primary Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: 'Total Watch Hours', value: `${analytics.totalHours} hrs`, trend: 'Lifetime duration', color: 'border-l-orange-500' },
                { label: 'Active Users Watching', value: `${analytics.activeUsers}`, trend: 'In the last 15 mins', color: 'border-l-emerald-500' },
                { label: 'Watch Time Today', value: `${analytics.todayHours} hrs`, trend: 'Since midnight UTC', color: 'border-l-indigo-500' },
                { label: 'Watch Time This Week', value: `${analytics.weekHours} hrs`, trend: 'Past 7 days rolling', color: 'border-l-pink-500' },
                { label: 'Watch Time This Month', value: `${analytics.monthHours} hrs`, trend: 'Past 30 days rolling', color: 'border-l-purple-500' },
              ].map((stat, idx) => (
                <div key={idx} className={`glass-panel p-5 rounded-xl border-l-4 ${stat.color} flex flex-col justify-between h-32 hover:border-l-orange-500 transition-all`}>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{stat.label}</span>
                  <p className="text-3xl font-black text-white my-1">{stat.value}</p>
                  <span className="text-[10px] font-semibold text-zinc-500">{stat.trend}</span>
                </div>
              ))}
            </div>

            {/* Catalog & Additional User-Focused Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass-panel p-5 rounded-xl flex flex-col justify-between border border-zinc-850/60">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Most Watched Anime</span>
                <p className="text-lg font-extrabold text-orange-400 mt-2 truncate" title={analytics.mostWatchedAnime}>
                  {analytics.mostWatchedAnime}
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold mt-1">Series generating highest watch times</span>
              </div>
              <div className="glass-panel p-5 rounded-xl flex flex-col justify-between border border-zinc-850/60">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Most Watched Episode</span>
                <p className="text-sm font-extrabold text-amber-400 mt-2 line-clamp-2" title={analytics.mostWatchedEpisode}>
                  {analytics.mostWatchedEpisode}
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold mt-1">Single most replayed episode</span>
              </div>
              <div className="glass-panel p-5 rounded-xl flex flex-col justify-between border border-zinc-850/60">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Peak Watching Hour</span>
                <p className="text-base font-extrabold text-purple-400 mt-2 truncate" title={analytics.peakTime}>
                  {analytics.peakTime}
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold mt-1">Most popular viewing window</span>
              </div>
              <div className="glass-panel p-5 rounded-xl flex flex-col justify-between border border-zinc-850/60">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg Duration / User</span>
                <p className="text-2xl font-extrabold text-emerald-400 mt-2">
                  {analytics.avgDurationPerUser} hrs
                </p>
                <span className="text-[10px] text-zinc-500 font-semibold mt-1">Total hours divided by unique users</span>
              </div>
            </div>

            {/* Static Catalog Counters for Database Size */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
              <div className="text-center">
                <span className="block text-[10px] uppercase font-black tracking-widest text-zinc-500">Catalog Titles</span>
                <span className="text-xl font-bold text-zinc-200">{stats.totalAnime}</span>
              </div>
              <div className="text-center border-l border-zinc-900">
                <span className="block text-[10px] uppercase font-black tracking-widest text-zinc-500">Total Seasons</span>
                <span className="text-xl font-bold text-zinc-200">{stats.totalSeasons}</span>
              </div>
              <div className="text-center border-l border-zinc-900">
                <span className="block text-[10px] uppercase font-black tracking-widest text-zinc-500">Episode Count</span>
                <span className="text-xl font-bold text-zinc-200">{stats.totalEpisodes}</span>
              </div>
              <div className="text-center border-l border-zinc-900">
                <span className="block text-[10px] uppercase font-black tracking-widest text-zinc-500">Total Accounts</span>
                <span className="text-xl font-bold text-zinc-200">{stats.totalUsers}</span>
              </div>
            </div>

            {/* VPS Self-Hosted / Netlify Sandbox Storage Engine Stats */}
            {(() => {
              const isNetlify = storageStats?.platform === "Netlify (Web Sandbox Mode)";
              return (
                <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-xl space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-900 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-lg border ${isNetlify ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse" : "bg-orange-500/10 border-orange-500/20 text-orange-400"}`}>
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                          {isNetlify ? "Netlify Sandbox Storage Engine" : "VPS Local File-Based Storage Engine"}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          {isNetlify 
                            ? "Real-time status of the durable local storage database persisting directly within your web browser"
                            : "Real-time status of the offline filesystem database residing directly on the VPS"
                          }
                        </p>
                      </div>
                    </div>
                    <div className={`mt-3 sm:mt-0 flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                      isNetlify 
                        ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isNetlify ? "bg-indigo-400" : "bg-emerald-400"} animate-ping`} />
                      <span>{isNetlify ? "NETLIFY SANDBOX ACTIVE" : "VPS STORAGE LIVE"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    {/* File size & Location Card */}
                    <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                          {isNetlify ? "Durable Sandbox Storage Store" : "Database Storage File"}
                        </span>
                        <p className="text-sm font-semibold text-zinc-300 mt-1 font-mono break-all bg-zinc-950/80 p-2 rounded border border-zinc-900">
                          {storageStats?.vpsStorageLocation || './data/db.json'}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-900">
                        <span>{isNetlify ? "Sandbox Active Size:" : "Database File Size:"}</span>
                        <span className={`font-bold font-mono ${isNetlify ? "text-indigo-400" : "text-orange-400"}`}>
                          {storageStats ? `${storageStats.databaseSizeKB} KB (${storageStats.databaseSizeMB} MB)` : 'Calculating...'}
                        </span>
                      </div>
                    </div>

                    {/* Storage Allocation Stats Card */}
                    <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 space-y-3">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        {isNetlify ? "Sandbox Storage Allocation" : "Local Storage Allocation"}
                      </span>
                      <div className="space-y-1.5 text-xs text-zinc-300">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Anime Catalogue:</span>
                          <span className="font-bold font-mono">{storageStats?.counts?.anime ?? 0} titles</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Episodes & Seasons:</span>
                          <span className="font-bold font-mono">{(storageStats?.counts?.episodes ?? 0) + (storageStats?.counts?.seasons ?? 0)} items</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">User Registered Accounts:</span>
                          <span className="font-bold font-mono text-indigo-400">{storageStats?.counts?.users ?? 0} users</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Total Rows Persisted:</span>
                          <span className="font-bold font-mono text-orange-400">{storageStats?.totalItemsCount ?? 0} rows</span>
                        </div>
                      </div>
                    </div>

                    {/* Security Compliance Card */}
                    <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Privacy & Security Compliance</span>
                        <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                          {isNetlify 
                            ? "All registered account data (such as login emails, secure passwords, Google-linked profiles, watch history backups, comments, and reviews) are persisted directly and safely within your browser's durable LocalStorage Sandbox (Netlify client-side mode)."
                            : "All registered account data (such as login emails, secure passwords, Google-linked profiles, watch history backups, comments, and reviews) are persisted directly and exclusively within the local filesystem of your Virtual Private Server (VPS)."
                          }
                        </p>
                      </div>
                      <div className="pt-2 border-t border-zinc-900 mt-2 flex items-center space-x-2 text-[10px] text-emerald-400 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {isNetlify 
                            ? "Client-only sandbox: zero external cloud data leaks" 
                            : "No external cloud servers used for database storage"
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extra VPS Environment Details Footer */}
                  {storageStats && (
                    <div className="pt-2 border-t border-zinc-900/80 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-zinc-500 font-medium">
                      <div>
                        {isNetlify ? "Database System: " : "Host OS Platform: "}<span className="text-zinc-400 font-mono">{storageStats.platform}</span>
                      </div>
                      <div>
                        {isNetlify ? "Execution Environment: " : "Node.js Runtime: "}<span className="text-zinc-400 font-mono">{storageStats.nodeVersion}</span>
                      </div>
                      {!isNetlify && (
                        <div>
                          VPS Port: <span className="text-zinc-400 font-mono">3000</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Interactive Visualizations Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Area Chart of Day totals */}
              <div className="glass-panel p-6 rounded-2xl border border-zinc-850/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Watch Time Distribution</h3>
                    <p className="text-xs text-zinc-500 font-medium">Watch hours grouped by day of the week</p>
                  </div>
                  <Calendar className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWeekly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                      <XAxis dataKey="name" stroke="#52525b" fontSize={11} fontWeight="bold" />
                      <YAxis stroke="#52525b" fontSize={11} fontWeight="bold" unit="h" />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }} labelClassName="text-white font-bold" />
                      <Area type="monotone" dataKey="hours" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorWeekly)" name="Watch Hours" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Bar Chart representing share */}
              <div className="glass-panel p-6 rounded-2xl border border-zinc-850/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 5 Most Popular Anime Series</h3>
                    <p className="text-xs text-zinc-500 font-medium">Accumulated watch hours ranking</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.animeShareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                      <XAxis dataKey="name" stroke="#52525b" fontSize={10} fontWeight="bold" tickFormatter={(tick) => tick.length > 12 ? `${tick.slice(0,10)}...` : tick} />
                      <YAxis stroke="#52525b" fontSize={11} fontWeight="bold" unit="h" />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }} labelClassName="text-white font-bold" />
                      <Bar dataKey="hours" fill="#f97316" radius={[4, 4, 0, 0]} name="Watch Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Chart 3: Hourly Activity Peak Line Chart */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-850/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hourly Stream Volume Peak Activity</h3>
                  <p className="text-xs text-zinc-500 font-medium">Viewer action tracking spikes over the 24-hour cycle (UTC)</p>
                </div>
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                    <XAxis dataKey="hour" stroke="#52525b" fontSize={9} fontWeight="bold" />
                    <YAxis stroke="#52525b" fontSize={11} fontWeight="bold" />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }} labelClassName="text-white font-bold" />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} name="Interaction Count" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ANIME MANAGER PANEL */}
        {activeTab === 'anime' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Film className="w-5 h-5 text-orange-500" />
                <span>ANIME TITLES ({allAnime.length})</span>
              </h2>
              <button
                onClick={() => {
                  setEditingAnime(null);
                  setAnimeForm({
                    title: '',
                    description: '',
                    bannerUrl: '',
                    thumbnailUrl: '',
                    genres: [],
                    rating: '8.5',
                    status: 'Ongoing',
                    category: 'Regular',
                    releaseYear: 2026,
                  });
                  setIsAnimeModalOpen(true);
                }}
                className="bg-orange-500 hover:bg-orange-600 font-bold text-black px-4 py-2.5 rounded-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-neon-orange active:scale-95 transition-all text-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>ADD ANIME SERIES</span>
              </button>
            </div>

            {/* Desktop List Table (Hidden on small mobile viewports) */}
            <div className="hidden md:block glass-panel rounded-xl overflow-hidden overflow-x-auto border border-zinc-800/80">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-4 px-6">Poster</th>
                    <th className="py-4 px-6">Anime Details</th>
                    <th className="py-4 px-6">Genres</th>
                    <th className="py-4 px-6">Rating</th>
                    <th className="py-4 px-6">Status / Category</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-sm">
                  {allAnime.map((anime) => (
                    <tr key={anime.id} className="hover:bg-purple-950/10 transition-colors">
                      <td className="py-4 px-6">
                        <img 
                          src={anime.thumbnailUrl} 
                          alt="" 
                          className="w-12 h-16 rounded object-cover border border-purple-900/30"
                          referrerPolicy="no-referrer"
                        />
                      </td>
                      <td className="py-4 px-6 max-w-xs">
                        <h4 className="font-bold text-white text-base truncate">{anime.title}</h4>
                        <p className="text-zinc-400 text-xs mt-1 leading-relaxed line-clamp-1">{anime.description}</p>
                        <p className="text-zinc-500 text-[10px] mt-1">ID: <code className="text-orange-400">{anime.id}</code> ({anime.releaseYear}) • <span className="text-orange-450 font-extrabold uppercase font-mono tracking-wider">{anime.type || 'Series'}</span></p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {anime.genres?.map(g => (
                            <span key={g} className="bg-purple-950/60 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-zinc-100">
                        ⭐ {anime.rating}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                          anime.status === 'Ongoing' ? 'bg-purple-900 text-purple-200' : 'bg-emerald-900 text-emerald-300'
                        }`}>
                          {anime.status}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 ml-2">
                          {anime.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5">
                        <button
                          onClick={() => handleEditAnimeClick(anime)}
                          className="p-2 bg-zinc-900 hover:bg-orange-500 text-zinc-400 hover:text-black rounded transition-colors cursor-pointer inline-flex"
                          title="Edit Info"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnimeClick(anime.id)}
                          className="p-2 bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer inline-flex"
                          title="Delete Series"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allAnime.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-zinc-500 font-semibold">
                        No anime configured in your catalog database. Create some!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Responsive View (Visible on mobile/tablet viewports) */}
            <div className="block md:hidden space-y-4">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 flex items-center">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
                Admin Catalog ({allAnime.length} entries detected)
              </p>
              {allAnime.map((anime) => (
                <div key={anime.id} className="glass-panel p-4 rounded-xl border border-zinc-800/80 flex flex-col space-y-4">
                  <div className="flex items-start space-x-4">
                    <img 
                      src={anime.thumbnailUrl} 
                      alt="" 
                      className="w-16 h-22 rounded object-cover border border-purple-900/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded ${
                          anime.status === 'Ongoing' ? 'bg-purple-900 text-purple-200' : 'bg-emerald-900 text-emerald-300'
                        }`}>
                          {anime.status}
                        </span>
                        <span className="text-[10px] uppercase font-black text-amber-450">
                          ⭐ {anime.rating}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-base mt-1 truncate">{anime.title}</h4>
                      <p className="text-zinc-400 text-xs mt-1 leading-relaxed line-clamp-2">{anime.description}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {anime.genres?.map(g => (
                          <span key={g} className="bg-purple-950/60 text-purple-300 text-[8px] font-black px-1.5 py-0.5 rounded">
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="text-zinc-500 text-[9px] mt-2 font-semibold">
                        ID: <code className="text-orange-400">{anime.id}</code> ({anime.releaseYear}) • <span className="text-orange-450 uppercase">{anime.type || 'Series'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-zinc-900">
                    <button
                      onClick={() => handleEditAnimeClick(anime)}
                      className="py-2.5 bg-zinc-900 hover:bg-orange-500 text-zinc-300 hover:text-black text-xs font-black rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>EDIT CATALOG</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAnimeClick(anime.id)}
                      className="py-2.5 bg-zinc-900/50 hover:bg-red-950 text-red-400 hover:text-red-200 text-xs font-black rounded-lg border border-red-900/40 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>DELETE SERIES</span>
                    </button>
                  </div>
                </div>
              ))}
              {allAnime.length === 0 && (
                <div className="text-center py-8 text-zinc-500 font-semibold glass-panel rounded-xl">
                  No anime configured in your catalog database. Create some!
                </div>
              )}
            </div>

            {/* Anime Creation Modal Overlay */}
            <AnimatePresence>
              {isAnimeModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel-heavy p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                      <h3 className="text-xl font-bold text-white">
                        {editingAnime ? `EDIT ANIME: ${editingAnime.title}` : 'ADD NEW ANIME SERIES'}
                      </h3>
                      <button onClick={() => { setIsAnimeModalOpen(false); setEditingAnime(null); }} className="text-zinc-400 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveAnime} className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Anime Name Title *</label>
                        <input
                          type="text"
                          required
                          value={animeForm.title}
                          onChange={(e) => setAnimeForm({ ...animeForm, title: e.target.value })}
                          placeholder="e.g. Demon Slayer, Cyberpunk Edgerunners"
                          className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-600 text-sm font-semibold outline-none transition-colors"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Synopsis Description</label>
                        <textarea
                          rows={3}
                          value={animeForm.description}
                          onChange={(e) => setAnimeForm({ ...animeForm, description: e.target.value })}
                          placeholder="Provide a comprehensive back-cover plot overview..."
                          className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-600 text-sm font-semibold outline-none transition-colors resize-none"
                        />
                      </div>

                      {/* Format Classification & Movie Uploads */}
                      <div className="bg-purple-950/20 border border-purple-900/35 p-4 rounded-xl space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <label className="block text-xs font-bold text-zinc-350 uppercase tracking-wider">Anime Format Type</label>
                            <p className="text-[10px] text-zinc-550 font-semibold mt-0.5">Series has multiple episodes; Movies are standalone media downloads and streams.</p>
                          </div>
                          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 text-xs font-extrabold select-none shrink-0 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => setAnimeForm({ ...animeForm, type: 'Series' })}
                              className={`px-3 py-1.5 rounded-lg cursor-pointer ${animeForm.type === 'Series' ? 'bg-orange-500 text-black font-black' : 'text-zinc-400 hover:text-white'}`}
                            >
                              TV Series
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnimeForm({ ...animeForm, type: 'Movie' })}
                              className={`px-3 py-1.5 rounded-lg cursor-pointer ${animeForm.type === 'Movie' ? 'bg-orange-500 text-black font-black' : 'text-zinc-400 hover:text-white'}`}
                            >
                              Anime Movie
                            </button>
                          </div>
                        </div>

                        {animeForm.type === 'Movie' && (
                          <div className="space-y-4 pt-3 border-t border-purple-950/60 transition-all">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Movie Video File or Stream URL *</label>
                                <div className="flex space-x-1 select-none">
                                  <button
                                    type="button"
                                    onClick={() => setMovieVideoInputType('url')}
                                    className={`text-[9px] px-2 py-0.5 rounded ${movieVideoInputType === 'url' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                                  >
                                    URL Link
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMovieVideoInputType('file')}
                                    className={`text-[9px] px-2 py-0.5 rounded ${movieVideoInputType === 'file' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                                  >
                                    Upload File
                                  </button>
                                </div>
                              </div>

                              {movieVideoInputType === 'url' ? (
                                <input
                                  type="text"
                                  required={animeForm.type === 'Movie'}
                                  value={animeForm.videoUrl}
                                  onChange={(e) => setAnimeForm({ ...animeForm, videoUrl: e.target.value })}
                                  placeholder="e.g. https://commondatastorage.googleapis.com/...mp4"
                                  className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-650 text-xs font-mono outline-none"
                                />
                              ) : (
                                <div className="border border-dashed border-zinc-850 bg-zinc-950/80 rounded-lg p-4 flex flex-col items-center justify-center relative hover:border-purple-500 transition-colors">
                                  {uploadingField === 'animeMovieVideoUrl' ? (
                                    <div className="flex flex-col items-center justify-center py-2 w-full text-center">
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-orange-500 border-zinc-700 mb-1.5"></div>
                                      <p className="text-[10px] font-bold text-orange-400">⚡ Instantly cached local copy: 100% playable</p>
                                      <p className="text-[9px] text-zinc-500 font-medium mt-1">☁️ Background Cloud Upload: {uploadProgress}%</p>
                                      <div className="w-2/3 bg-zinc-800 h-1 rounded mt-1.5 overflow-hidden">
                                        <div className="bg-orange-500 h-1 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                      </div>
                                      <p className="text-[8px] text-green-400 mt-2 font-bold animate-pulse">✓ Ready to Save Movie Form Immediately!</p>
                                    </div>
                                  ) : (
                                    <>
                                      <input
                                        type="file"
                                        accept="video/*"
                                        onChange={(e) => handleFileUpload(e, 'animeMovieVideoUrl')}
                                        className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                                      />
                                      <Upload className="w-5 h-5 text-orange-500 mb-1" />
                                      <p className="text-[11px] text-zinc-400">Click to upload raw mp4 anime movie video</p>
                                      {animeForm.videoUrl && <p className="text-[10px] text-green-400 mt-2 truncate max-w-xs font-bold">Movie file loaded successfully ✔</p>}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Movie Duration (in seconds) *</label>
                              <input
                                type="number"
                                required={animeForm.type === 'Movie'}
                                value={animeForm.duration}
                                onChange={(e) => setAnimeForm({ ...animeForm, duration: Number(e.target.value) })}
                                className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs outline-none font-semibold"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Banner Image selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Top Banner Landscape Image *</label>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => setBannerInputType('url')}
                              className={`text-[10px] px-2 py-0.5 rounded ${bannerInputType === 'url' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                            >
                              URL Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setBannerInputType('file')}
                              className={`text-[10px] px-2 py-0.5 rounded ${bannerInputType === 'file' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                            >
                              Upload File
                            </button>
                          </div>
                        </div>
                        {bannerInputType === 'url' ? (
                          <input
                            type="text"
                            required
                            value={animeForm.bannerUrl}
                            onChange={(e) => setAnimeForm({ ...animeForm, bannerUrl: e.target.value })}
                            placeholder="https://images.unsplash.com/... or any other web link"
                            className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-600 text-xs font-mono outline-none transition-colors"
                          />
                        ) : (
                          <div className="border border-dashed border-zinc-800 bg-zinc-950/80 rounded-lg p-4 flex flex-col items-center justify-center relative cursor-pointer hover:border-purple-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'bannerUrl')}
                              className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                            />
                            <Upload className="w-6 h-6 text-orange-500 mb-1" />
                            <p className="text-xs text-zinc-400">Click to select horizontal showcase image file</p>
                            {animeForm.bannerUrl && <p className="text-[10px] text-green-400 mt-2 truncate max-w-xs">File loaded successfully ✔</p>}
                          </div>
                        )}
                      </div>

                      {/* Card Thumbnail selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Vertical Card Poster Image *</label>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => setThumbnailInputType('url')}
                              className={`text-[10px] px-2 py-0.5 rounded ${thumbnailInputType === 'url' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                            >
                              URL Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setThumbnailInputType('file')}
                              className={`text-[10px] px-2 py-0.5 rounded ${thumbnailInputType === 'file' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                            >
                              Upload File
                            </button>
                          </div>
                        </div>
                        {thumbnailInputType === 'url' ? (
                          <input
                            type="text"
                            required
                            value={animeForm.thumbnailUrl}
                            onChange={(e) => setAnimeForm({ ...animeForm, thumbnailUrl: e.target.value })}
                            placeholder="https://images.unsplash.com/... (vertical aspect orientation)"
                            className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-600 text-xs font-mono outline-none transition-colors"
                          />
                        ) : (
                          <div className="border border-dashed border-zinc-800 bg-zinc-950/80 rounded-lg p-4 flex flex-col items-center justify-center relative cursor-pointer hover:border-purple-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'thumbnailUrl')}
                              className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                            />
                            <Upload className="w-6 h-6 text-orange-500 mb-1" />
                            <p className="text-xs text-zinc-400">Click to select vertical poster image file</p>
                            {animeForm.thumbnailUrl && <p className="text-[10px] text-green-400 mt-2 truncate max-w-xs">File loaded successfully ✔</p>}
                          </div>
                        )}
                      </div>

                      {/* Genre selector checklists */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Anime Genres Selector</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-zinc-800 bg-zinc-950/80 p-3 rounded-lg max-h-[140px] overflow-y-auto">
                          {availableGenres.map((g) => {
                            const isChecked = animeForm.genres.includes(g);
                            return (
                              <button
                                type="button"
                                key={g}
                                onClick={() => handleToggleGenre(g)}
                                className={`text-left text-xs p-1.5 rounded flex items-center justify-between border cursor-pointer ${
                                  isChecked 
                                    ? 'bg-purple-950/70 border-orange-500 text-orange-400 font-bold' 
                                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-300'
                                }`}
                              >
                                <span>{g}</span>
                                {isChecked && <Check className="w-3.5 h-3.5 text-orange-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Metadata Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Rating Score</label>
                          <input
                            type="text"
                            required
                            value={animeForm.rating}
                            onChange={(e) => setAnimeForm({ ...animeForm, rating: e.target.value })}
                            placeholder="e.g. 9.1"
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Release Year</label>
                          <input
                            type="number"
                            required
                            value={animeForm.releaseYear}
                            onChange={(e) => setAnimeForm({ ...animeForm, releaseYear: Number(e.target.value) })}
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</label>
                          <select
                            value={animeForm.status}
                            onChange={(e) => setAnimeForm({ ...animeForm, status: e.target.value as any })}
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="Ongoing">Ongoing</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Row Category</label>
                          <select
                            value={animeForm.category}
                            onChange={(e) => setAnimeForm({ ...animeForm, category: e.target.value as any })}
                            className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="Regular">Regular List</option>
                            <option value="Featured">Hero Featured Banner</option>
                            <option value="Trending">Trending Carousel</option>
                            <option value="Popular">Popular Sections</option>
                          </select>
                        </div>
                      </div>

                      {/* Modal Form controls */}
                      <div className="flex space-x-3 pt-3 border-t border-zinc-800 mt-6">
                        <button
                          type="submit"
                          className="flex-1 bg-orange-500 hover:bg-orange-600 font-extrabold text-black px-5 py-3 rounded-xl shadow-lg transition-transform active:scale-95 text-sm cursor-pointer"
                        >
                          {editingAnime ? 'SAVE CHANGES' : 'CREATE SERIES'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAnimeModalOpen(false); setEditingAnime(null); }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer"
                        >
                          CANCEL
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* SEASONS & EPISODES MANAGER */}
        {activeTab === 'seasons_episodes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            
            {/* LEFT BAR: Anime Selector and Season Add */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Select Anime target */}
              <div className="glass-panel p-5 rounded-2xl border border-zinc-800">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">1. SELECT TARGET SERIES</label>
                <select
                  value={selectedSeasonAnimeId}
                  onChange={(e) => setSelectedSeasonAnimeId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-600 rounded-lg p-3 text-zinc-100 text-sm font-semibold outline-none cursor-pointer"
                >
                  {allAnime.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>

              {/* Seasons in Selected Anime Grid */}
              <div className="glass-panel p-5 rounded-2xl border border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-900 pb-2 flex items-center justify-between">
                  <span>SEASONS CREATED</span>
                  <span className="bg-purple-950 text-purple-300 font-black text-xs px-2 py-0.5 rounded-full">{activeAnimeSeasons.length}</span>
                </h3>

                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {activeAnimeSeasons.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedEpisodeSeasonId(s.id)}
                      className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        selectedEpisodeSeasonId === s.id 
                          ? 'bg-purple-950/60 border-orange-500 text-orange-400' 
                          : 'bg-zinc-900/30 border-zinc-800 text-zinc-300 hover:border-purple-900/60'
                      }`}
                    >
                      <div>
                        <p className="font-extrabold text-[13px]">{s.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Season No. {s.number} • ID: <code className="text-zinc-400">{s.id}</code></p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSeasonClick(s.id); }}
                        className="p-1 hover:bg-red-950 hover:text-red-400 rounded text-zinc-500 transition-colors cursor-pointer"
                        title="Delete Season"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                  {activeAnimeSeasons.length === 0 && (
                    <p className="text-center text-xs text-zinc-600 py-4 font-semibold">No seasons defined. Add Season 1 below!</p>
                  )}
                </div>

                {/* Season Addition box */}
                <form onSubmit={handleCreateSeason} className="pt-4 border-t border-zinc-900 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Season</span>
                  </h4>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">NUMBER</label>
                      <input
                        type="number"
                        required
                        value={newSeasonForm.number}
                        onChange={(e) => setNewSeasonForm({ ...newSeasonForm, number: Math.max(1, Number(e.target.value)) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-center font-bold"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">SEASON SUBTITLE LABEL</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Shibuya Arc, Season 1"
                        value={newSeasonForm.name}
                        onChange={(e) => setNewSeasonForm({ ...newSeasonForm, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-900 hover:bg-purple-800 font-bold text-white py-2 rounded text-xs tracking-wider transition-colors cursor-pointer"
                  >
                    ADD SEASON ENTRY
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT BAR: Episodes manager list and add form */}
            <div className="lg:col-span-8 space-y-6">
              
              {selectedEpisodeSeasonId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  
                  {/* Episodes List */}
                  <div className="glass-panel p-5 rounded-2xl border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-900 pb-2">
                      EPISODES DETECTED ({activeSeasonEpisodes.length})
                    </h3>

                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {activeSeasonEpisodes.map((ep) => (
                        <div 
                          key={ep.id}
                          className="flex items-center space-x-3 bg-zinc-950/40 p-2 rounded-lg border border-zinc-900 hover:border-purple-900/40"
                        >
                          <img 
                            src={ep.thumbnailUrl} 
                            alt="" 
                            className="w-16 h-10 object-cover rounded" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-white truncate">Ep {ep.number}: {ep.title}</h4>
                            <p className="text-[10px] text-zinc-500 truncate">{ep.description || 'No description plot overview'}</p>
                            <span className="text-[9px] font-semibold text-orange-400 bg-orange-500/10 px-1.5 py-0.2 rounded font-mono">
                              {ep.duration ? `${Math.floor(ep.duration / 60)}m` : '0m'}
                            </span>
                          </div>
                          
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditEpClick(ep)}
                              className="p-1.5 bg-zinc-900 text-zinc-400 hover:text-orange-500 rounded transition-colors cursor-pointer"
                              title="Edit Episode"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEpClick(ep.id)}
                              className="p-1.5 bg-zinc-900 text-zinc-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                              title="Delete Episode"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {activeSeasonEpisodes.length === 0 && (
                        <p className="text-center text-xs text-zinc-500 py-8 font-semibold">No episodes populated for this season. Build one on the right!</p>
                      )}
                    </div>
                  </div>

                  {/* Add / Edit Episode form */}
                  <div className="glass-panel p-5 rounded-2xl border border-zinc-800">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-900 pb-2 mb-4">
                      {isEditingEp ? `EDIT EPISODE ${isEditingEp.number}` : 'ADD NEW EPISODE'}
                    </h3>

                    <form onSubmit={handleSaveEpisode} className="space-y-3 pb-2 text-xs font-semibold">
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] text-zinc-400 mb-0.5">EP NUMBER</label>
                          <input
                            type="number"
                            required
                            value={epForm.number}
                            onChange={(e) => setEpForm({ ...epForm, number: Math.max(1, Number(e.target.value)) })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] text-zinc-400 mb-0.5">TITLE</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Inner City Blues"
                            value={epForm.title}
                            onChange={(e) => setEpForm({ ...epForm, title: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] text-zinc-400 mb-0.5">SYNOPSIS DESCRIPTION</label>
                        <textarea
                          placeholder="A quick summary of what happens in this episode..."
                          rows={2}
                          value={epForm.description}
                          onChange={(e) => setEpForm({ ...epForm, description: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white resize-none"
                        />
                      </div>

                      {/* Video URL selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[9px] text-zinc-400">VIDEO SOURCE STREAM *</label>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => setVideoInputType('url')}
                              className={`text-[8px] px-1.5 py-0.2 rounded transition-all cursor-pointer ${videoInputType === 'url' ? 'bg-orange-500 text-black font-extrabold shadow-sm' : 'bg-zinc-850 text-zinc-400 hover:text-white'}`}
                            >
                              URL Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setVideoInputType('file')}
                              className={`text-[8px] px-1.5 py-0.2 rounded transition-all cursor-pointer ${videoInputType === 'file' ? 'bg-orange-500 text-black font-extrabold shadow-sm' : 'bg-zinc-850 text-zinc-400 hover:text-white'}`}
                            >
                              Upload MP4 / File
                            </button>
                          </div>
                        </div>

                        {videoInputType === 'url' ? (
                          <input
                            type="text"
                            required
                            placeholder="Provide a valid direct web link (e.g. mp4 stream URL)"
                            value={epForm.videoUrl}
                            onChange={(e) => setEpForm({ ...epForm, videoUrl: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white text-[10px] font-mono outline-none focus:border-orange-500"
                          />
                        ) : (
                          <div className="border border-dashed border-zinc-800 bg-zinc-950 pl-2 pr-2 pt-3 pb-3 rounded flex flex-col items-center justify-center relative hover:border-purple-500 transition-colors">
                            {uploadingField === 'videoUrl' ? (
                              <div className="flex flex-col items-center justify-center py-1 w-full text-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-orange-500 border-zinc-700 mb-1.5"></div>
                                <p className="text-[10px] font-bold text-orange-400">⚡ Instantly cached local copy: 100% playable</p>
                                <p className="text-[9px] text-zinc-500 font-medium mt-1">☁️ Background Cloud Upload: {uploadProgress}%</p>
                                <div className="w-2/3 bg-zinc-800 h-1 rounded mt-1.5 overflow-hidden">
                                  <div className="bg-orange-500 h-1 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                                <p className="text-[8px] text-green-400 mt-2 font-bold animate-pulse">✓ Ready to Save Episode Immediately!</p>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="video/*"
                                  disabled={uploadingField !== null}
                                  onChange={(e) => handleFileUpload(e, 'videoUrl')}
                                  className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                                />
                                <Video className="w-5 h-5 text-orange-500 mb-1" />
                                <p className="text-[10px] text-zinc-400">Click to upload video file (.mp4)</p>
                                {epForm.videoUrl && (
                                  <div className="mt-1 flex flex-col items-center">
                                    <p className="text-[9px] text-green-400 font-bold truncate max-w-[200px]">✓ Video Loaded Successfully</p>
                                    <p className="text-[8px] text-zinc-500 font-mono mt-0.5 truncate max-w-[200px]" title={epForm.videoUrl}>
                                      {epForm.videoUrl}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {uploadError && (
                          <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {uploadError}</p>
                        )}
                      </div>

                      {/* Thumbnail screenshot */}
                      <div>
                        <label className="block text-[9px] text-zinc-400 mb-0.5">STILL SCREENSHOT THUMB (OPTIONAL)</label>
                        <input
                          type="text"
                          placeholder="https://... URL, or leave blank to fallback to posters"
                          value={epForm.thumbnailUrl}
                          onChange={(e) => setEpForm({ ...epForm, thumbnailUrl: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white"
                        />
                      </div>

                      {/* Duration */}
                      <div>
                        <label className="block text-[9px] text-zinc-400 mb-0.5">DURATION (SECONDS)</label>
                        <input
                          type="number"
                          value={epForm.duration}
                          onChange={(e) => setEpForm({ ...epForm, duration: Number(e.target.value) })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white font-bold"
                        />
                      </div>

                      <div className="flex space-x-2 pt-3 border-t border-zinc-900 mt-2">
                        <button
                          type="submit"
                          className="flex-1 bg-orange-500 hover:bg-orange-600 font-bold text-black py-2.5 rounded-lg text-xs"
                        >
                          {isEditingEp ? 'SAVE EPISODE' : 'CREATE EPISODE'}
                        </button>
                        {isEditingEp && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingEp(null);
                              setEpForm({
                                number: activeSeasonEpisodes.length + 1,
                                title: '',
                                description: '',
                                videoUrl: '',
                                thumbnailUrl: '',
                                duration: 300
                              });
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 px-3 rounded-lg text-xs"
                          >
                            CANCEL
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 text-center text-zinc-500 font-semibold rounded-2xl">
                  Please select or construct an anime season in the left panel before populating media episodes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACCOUNT ROLL CALL PANEL */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span>REGISTERED USER PROFILES ({users.length})</span>
            </h2>

            {/* Main Admin Only Invitation Card */}
            {isMainAdmin && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 text-left">
                {/* Invite form */}
                <div className="glass-panel p-6 rounded-2xl border border-zinc-800/80 space-y-4">
                  <div className="flex items-center space-x-2 text-purple-400 font-extrabold uppercase text-xs tracking-wider">
                    <UserPlus className="w-4 h-4" />
                    <span>Invite New Admin (Main Admin Only)</span>
                  </div>
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Gmail Address</label>
                      <input
                        type="email"
                        placeholder="e.g. name@gmail.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Select Permissions</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-900 max-h-48 overflow-y-auto">
                        {ALL_AVAILABLE_PERMISSIONS.map(p => {
                          const isChecked = invitePermissions.includes(p.key);
                          return (
                            <label key={p.key} className="flex items-center space-x-2 text-xs text-zinc-400 font-semibold cursor-pointer hover:text-zinc-200 py-0.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setInvitePermissions(prev => prev.filter(x => x !== p.key));
                                  } else {
                                    setInvitePermissions(prev => [...prev, p.key]);
                                  }
                                }}
                                className="accent-purple-500 rounded cursor-pointer w-3.5 h-3.5"
                              />
                              <span>{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isSendingInvite}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <span>{isSendingInvite ? 'SENDING INVITATION...' : 'SEND INVITATION'}</span>
                    </button>
                  </form>
                </div>

                {/* Sent Invites registry */}
                <div className="glass-panel p-6 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-purple-400 font-extrabold uppercase text-xs tracking-wider mb-4">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sent Administrative Invitations</span>
                    </div>
                    {adminInvites.length === 0 ? (
                      <p className="text-xs text-zinc-500 font-semibold italic text-center py-8">No sent invitations found.</p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-2.5 pr-2">
                        {adminInvites.map((invite) => (
                          <div key={invite.id || invite.email} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-200 truncate">{invite.email}</p>
                              <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                                Sent by: {invite.invitedBy} • Status: <span className={invite.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}>{invite.status.toUpperCase()}</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(invite.permissions || []).map((perm: string) => (
                                  <span key={perm} className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                                    {perm.replace('manage_', '').replace('view_', '')}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {invite.status === 'pending' && (
                              <button
                                onClick={() => handleCancelInvite(invite.id, invite.email)}
                                className="ml-3 p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-900 hover:bg-zinc-850 rounded border border-zinc-850 transition-all cursor-pointer"
                                title="Cancel Invitation"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="glass-panel rounded-xl overflow-hidden overflow-x-auto border border-zinc-800/80">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-4 px-6">Avatar</th>
                    <th className="py-4 px-6">Username / Email</th>
                    <th className="py-4 px-6">User ID Reference</th>
                    <th className="py-4 px-6">Current Role</th>
                    <th className="py-4 px-6">Status Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-sm">
                  {users.map((profile) => (
                    <tr key={profile.uid} className={`hover:bg-purple-950/10 transition-colors ${profile.isBanned ? 'bg-red-950/10' : ''}`}>
                      <td className="py-4 px-6">
                        <img 
                          src={profile.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile.email}`} 
                          alt="" 
                          className="w-10 h-10 rounded-full border border-purple-500/25"
                        />
                      </td>
                      <td className="py-4 px-6 font-bold text-zinc-100">
                        <p>{profile.displayName || 'Unverified User'}</p>
                        <p className="text-xs font-normal text-zinc-500 mt-0.5">{profile.email}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-zinc-500">
                        {profile.uid}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          profile.role === 'admin' 
                            ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-neon-orange' 
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {profile.role || 'user'}
                        </span>
                        {profile.role === 'admin' && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Active Permissions:</p>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(profile.permissions?.includes('all') ? ['view_analytics', 'manage_anime', 'manage_seasons_episodes', 'manage_banners', 'manage_users', 'backup_restore'] : (profile.permissions || [])).map((perm: string) => (
                                <span key={perm} className="text-[8px] bg-purple-950/40 border border-purple-800/60 text-purple-300 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                                  {perm.replace('manage_', '').replace('view_', '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {profile.isBanned ? (
                          <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-900 px-2 py-0.5 rounded">
                            BANNED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-400 bg-green-950/30 border border-green-900 px-2 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        {profile.role === 'admin' && (
                          <button
                            onClick={() => handleOpenEditPermissions(profile)}
                            className="text-xs px-2.5 py-1.5 rounded font-bold transition-all cursor-pointer bg-zinc-900 text-purple-400 hover:bg-purple-950/40 border border-zinc-800 hover:border-purple-900"
                            title="Edit Permissions"
                          >
                            PERMISSIONS
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleRole(profile.uid, profile.role || 'user')}
                          className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all cursor-pointer ${
                            profile.uid === currentUserId 
                              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' 
                              : 'bg-zinc-900 text-zinc-350 hover:bg-orange-500 hover:text-black border border-zinc-800'
                          }`}
                          disabled={profile.uid === currentUserId}
                        >
                          TOGGLE ROLE
                        </button>

                        <button
                          onClick={() => handleToggleBan(profile.uid, !!profile.isBanned)}
                          className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all cursor-pointer ${
                            profile.uid === currentUserId 
                              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' 
                              : profile.isBanned 
                                ? 'bg-green-950 hover:bg-green-900 text-green-400' 
                                : 'bg-red-950 hover:bg-red-900 text-red-400'
                          }`}
                          disabled={profile.uid === currentUserId}
                        >
                          {profile.isBanned ? 'UNBAN' : 'BAN'}
                        </button>

                        <button
                          onClick={() => handleDeleteUser(profile.uid)}
                          className="p-1.5 bg-zinc-900 text-zinc-500 hover:text-red-500 rounded border border-zinc-850 hover:border-red-900 cursor-pointer inline-flex align-middle"
                          disabled={profile.uid === currentUserId}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Permissions Editor Modal */}
            {editingAdminUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-zinc-800 space-y-6 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-purple-400">
                      <Shield className="w-5 h-5" />
                      <h3 className="text-lg font-bold text-white">Edit Admin Permissions</h3>
                    </div>
                    <button 
                      onClick={() => setEditingAdminUser(null)}
                      className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 mb-1">Target Account:</p>
                    <p className="text-sm font-semibold text-zinc-200">{editingAdminUser.displayName || 'Unverified User'}</p>
                    <p className="text-xs text-zinc-500 font-mono">{editingAdminUser.email}</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Authorized Permissions</label>
                    <div className="grid grid-cols-1 gap-2 bg-zinc-950 p-4 rounded-xl border border-zinc-900 max-h-60 overflow-y-auto">
                      {ALL_AVAILABLE_PERMISSIONS.map(p => {
                        const isChecked = editingPermissions.includes(p.key);
                        return (
                          <label key={p.key} className="flex items-center space-x-3 text-xs text-zinc-300 font-semibold cursor-pointer hover:text-white py-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setEditingPermissions(prev => prev.filter(x => x !== p.key));
                                } else {
                                  setEditingPermissions(prev => [...prev, p.key]);
                                }
                              }}
                              className="accent-purple-500 rounded cursor-pointer w-4 h-4"
                            />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setEditingAdminUser(null)}
                      className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePermissions}
                      disabled={isUpdatingPermissions}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-black px-5 py-2.5 rounded-lg transition-all"
                    >
                      {isUpdatingPermissions ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADVANCED HASH & ROUTING TOOLS TAB PANEL */}
        {activeTab === 'hash_generator' && (
          <HashGeneratorPanel allAnime={allAnime} />
        )}

        {/* BACKUP & RESTORE TAB PANEL */}
        {activeTab === 'backup_restore' && (
          <BackupRestorePanel refreshData={refreshData} />
        )}

        {/* APP ANNOUNCEMENT TAB PANEL */}
        {activeTab === 'announcements' && (
          <AnnouncementsPanel />
        )}

        {/* BULK THUMBNAIL UPLOADER TAB PANEL */}
        {activeTab === 'bulk_thumbnails' && (
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 animate-fade-in text-left">
            <BulkThumbnailUploader allAnime={allAnime} refreshData={refreshData} />
          </div>
        )}

        {/* AUTO THUMBNAIL GENERATOR TAB PANEL */}
        {activeTab === 'auto_thumbnail' && (
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 animate-fade-in text-left">
            <AutoThumbnailGenerator allAnime={allAnime} refreshData={refreshData} />
          </div>
        )}

        {/* AUTO SETUP NEW TAB PANEL */}
        {(activeTab === 'auto_setup_new' || activeTab === 'auto_skip_setup') && (
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 animate-fade-in text-left">
            <AutoSkipSetup allAnime={allAnime} refreshData={refreshData} />
          </div>
        )}

        {/* ANISKIP SYNC ⭐ TAB PANEL */}
        {activeTab === 'aniskip_sync' && (
          <AniSkipSyncPanel allAnime={allAnime} refreshData={refreshData} />
        )}

        {/* SYSTEM DIAGNOSTICS TAB PANEL */}
        {activeTab === 'diagnostics' && (
          <SystemDiagnosticsPanel />
        )}

        {/* FIREBASE CONNECTION PANEL */}
        {activeTab === 'firebase_config' && (
          <FirebaseConfigPanel />
        )}

        {/* BULK OPERATIONS & SCHEDULER TAB PANEL */}
        {activeTab === 'bulk_operations' && (
          <div className="space-y-8 animate-fade-in text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Season Importer card */}
              <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
                  <PlusCircle className="w-4 h-4" />
                  <span>Bulk Seasons Importer</span>
                </div>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  Quickly add seasons to an anime in bulk. Select the target anime, then paste or enter season subtitles (one per line). e.g., <code>Season 1: Origin Point</code> or <code>Season 2</code>.
                </p>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Target Anime Series</label>
                  <select
                    value={selectedSeasonAnimeId}
                    onChange={(e) => setSelectedSeasonAnimeId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
                  >
                    {allAnime.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Seasons List (One per line)</label>
                  <textarea
                    rows={5}
                    placeholder="Season 1: Original Course&#10;Season 2: Shibuya Showdown&#10;Season 3: Final Season"
                    value={bulkSeasonsText}
                    onChange={(e) => setBulkSeasonsText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-3 text-xs text-zinc-200 outline-none focus:border-orange-500 font-sans"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBulkImportSeasons}
                  className="bg-orange-500 hover:bg-orange-600 text-black font-extrabold px-6 py-2.5 rounded-lg text-xs"
                >
                  Import Seasons Batch
                </button>
              </div>

              {/* Bulk Episode Upload system */}
              <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-purple-400 font-extrabold uppercase text-xs tracking-wider">
                  <Video className="w-4 h-4" />
                  <span>Bulk Episodes Importer</span>
                </div>
                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                  Import multiple episodes simultaneously. Select anime and season, then feed raw details in this format: <code className="text-zinc-200 font-mono">EpisodeNumber | EpisodeTitle | VideoURL | ThumbnailURL | DurationInSeconds | Description</code>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Target Anime</label>
                    <select
                      value={selectedSeasonAnimeId}
                      onChange={(e) => setSelectedSeasonAnimeId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-2 text-zinc-100 text-xs font-semibold outline-none"
                    >
                      {allAnime.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Target Season</label>
                    <select
                      value={selectedEpisodeSeasonId}
                      onChange={(e) => setSelectedEpisodeSeasonId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-2 text-zinc-100 text-xs font-semibold outline-none"
                    >
                      {activeAnimeSeasons.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Episodes CSV Grid (One per line)</label>
                  <textarea
                    rows={5}
                    placeholder="1 | Prologue Journey | https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 | https://images.unsplash.com/photo-1578632767115-351597cf2477 | 300 | This is the official introduction explaining the origin story of the characters.&#10;2 | Awakening Power | https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4 |  | 360 | A mysterious source of energy causes mutations in the nearby village during a thunderstorm."
                    value={bulkEpisodesText}
                    onChange={(e) => setBulkEpisodesText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-3 text-xs text-zinc-200 outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                {/* Real-time Parsed Preview with Description */}
                {(() => {
                  const lines = bulkEpisodesText.split('\n').map(l => l.trim()).filter(Boolean);
                  if (lines.length === 0) return null;
                  return (
                    <div className="mt-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Live Parsed Episodes Preview</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-400 font-mono">{lines.length} Line(s)</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        {lines.map((line, idx) => {
                          const parts = line.split('|').map(p => p.trim());
                          const isValid = parts.length >= 3;
                          const epNum = parseInt(parts[0], 10) || (idx + 1);
                          const epTitle = parts[1] || `Episode ${epNum}`;
                          const epVideoUrl = parts[2] || 'Missing URL';
                          const epThumb = parts[3] || 'Default Cover';
                          const epDur = parseInt(parts[4], 10) || 1440;
                          const epDesc = parts[5] || `Bulk imported episode ${epNum} from video library.`;
                          
                          return (
                            <div key={idx} className={`p-3 rounded-lg border text-xs space-y-1 ${isValid ? 'bg-zinc-900/40 border-zinc-800' : 'bg-red-950/10 border-red-900/30'}`}>
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-zinc-200">
                                  <span className="text-purple-400 mr-1.5">#{epNum}</span> {epTitle}
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono font-medium">{Math.floor(epDur / 60)}m {epDur % 60}s</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono truncate">Video: {epVideoUrl}</div>
                              {epThumb && epThumb !== 'Default Cover' && (
                                <div className="text-[10px] text-zinc-400/80 font-mono truncate">Thumb: {epThumb}</div>
                              )}
                              <div className="mt-1.5 p-2 rounded bg-zinc-950/60 border border-zinc-800/40 text-[11px] text-zinc-300 leading-relaxed break-words">
                                <span className="text-purple-400/80 font-semibold text-[9px] uppercase tracking-wider block mb-0.5">Parsed Description:</span>
                                {epDesc}
                              </div>
                              {!isValid && (
                                <div className="text-[10px] text-red-400 font-bold mt-1">⚠️ Need at least 3 values (Number | Title | Video URL)</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={handleBulkUploadEpisodes}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-6 py-2.5 rounded-lg text-xs animate-pulse"
                >
                  Bulk Import Episodes
                </button>
              </div>

            </div>

            {/* Episode Scheduler Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6">
              <div className="flex items-center space-x-2 text-amber-500 font-extrabold uppercase text-xs tracking-wider">
                <Settings className="w-4 h-4" />
                <span>Episode Release Schedule Planner</span>
              </div>
              <p className="text-xs text-zinc-400 font-semibold max-w-3xl leading-relaxed">
                Schedule anime episode releases in advance to notify fans when episodes are ready. Fans can see when a new episode will launch during the week on the Home Release Calendar.
              </p>
              
              <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-zinc-950/60 rounded-xl border border-zinc-900 items-end">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Target Anime</label>
                  <select
                    value={newSchedule.animeId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, animeId: e.target.value })}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-150 text-xs font-semibold outline-none"
                  >
                    <option value="">-- Choose Anime --</option>
                    {allAnime.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Episode Number</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newSchedule.episodeNumber}
                    onChange={(e) => setNewSchedule({ ...newSchedule, episodeNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Weekly Release Day</label>
                  <select
                    value={newSchedule.releaseDay}
                    onChange={(e) => setNewSchedule({ ...newSchedule, releaseDay: e.target.value as any })}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs font-semibold select-none"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Time (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="18:30"
                      required
                      value={newSchedule.time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-805 rounded-lg p-2 text-zinc-100 text-xs font-semibold text-center"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-2 px-1 rounded-lg text-xs tracking-wider cursor-pointer"
                  >
                    Add Schedule
                  </button>
                </div>
              </form>

              {/* Schedules list */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Active Release Calendar Lists</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schedules.map(sch => (
                    <div key={sch.id} className="p-4 bg-zinc-900 border border-zinc-850 rounded-lg flex items-center justify-between text-xs font-semibold">
                      <div>
                        <p className="font-extrabold text-white text-sm">{sch.animeTitle}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Episode {sch.episodeNumber} • <span className="text-orange-400 font-bold">{sch.releaseDay}s at {sch.time}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(sch.id)}
                        className="p-1 px-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/30 rounded cursor-pointer transition-all"
                        title="Delete schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <p className="col-span-full py-6 text-center text-zinc-650 text-xs font-semibold">No release schedules registered currently.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* API GENERATOR TAB PANEL */}
        {activeTab === 'api_generator' && (
          <div className="space-y-8 animate-fade-in text-left">
            {/* Header section */}
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Secure Admin API Generator</h3>
                <p className="text-xs text-zinc-400 font-semibold">Generate authorization credentials and integrate bots or scripts to automate catalog updates.</p>
              </div>
            </div>

            {/* External Upload API Section */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-2 text-cyan-400 font-extrabold uppercase text-xs tracking-wider">
                  <Cpu className="w-4 h-4" />
                  <span>External Upload API Manager</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDocModal(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-800 hover:border-cyan-500/30 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-all"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>View API Documentation</span>
                </button>
              </div>

              <p className="text-xs text-zinc-400 font-semibold max-w-3xl leading-relaxed">
                Connect your external applications (such as a Python Dropbox script, transcoding pipeline, or content ingest tools) to upload or update episode packages directly inside your AniMayX database.
              </p>

              {/* Alert Warning Box */}
              <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl flex items-start space-x-3 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider">Keep this key extremely confidential</p>
                  <p className="text-[10px] text-amber-500/90 leading-relaxed font-semibold">
                    This API key has absolute write access to your AniMayX database. Never commit this token to client-side code, public repositories, or share it in unsecured environments.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Column 1: API Configuration settings */}
                <div className="lg:col-span-5 space-y-6 bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 text-left">
                  <h4 className="text-xs font-bold text-zinc-350 uppercase tracking-wider">API Configuration & Keys</h4>

                  {/* Toggle and Status indicator (Always On) */}
                  <div className="flex items-center justify-between p-3.5 bg-zinc-950 rounded-lg border border-zinc-900">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">API Endpoint Status</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Online (Always Active & Protected)
                      </p>
                    </div>

                    <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                      Always Active
                    </div>
                  </div>

                  {/* API Key management */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Secret Admin API Key</label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type={isKeyVisible ? 'text' : 'password'}
                          readOnly
                          value={apiKey || '••••••••••••••••••••••••••••••••••••••••••••••••'}
                          className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2.5 pr-10 text-xs font-mono text-zinc-300 outline-none"
                        />
                        {apiKey && (
                          <button
                            type="button"
                            onClick={() => setIsKeyVisible(!isKeyVisible)}
                            className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                          >
                            {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!apiKey}
                        onClick={() => {
                          if (!apiKey) return;
                          const fallback = (text: string) => {
                            try {
                              const textArea = document.createElement("textarea");
                              textArea.value = text;
                              textArea.style.position = "fixed";
                              textArea.style.top = "0";
                              textArea.style.left = "0";
                              textArea.style.opacity = "0";
                              document.body.appendChild(textArea);
                              textArea.focus();
                              textArea.select();
                              const successful = document.execCommand('copy');
                              document.body.removeChild(textArea);
                              if (successful) {
                                alert('API Key copied to clipboard!');
                              } else {
                                alert('Failed to auto-copy. Please select the key text and copy manually.');
                              }
                            } catch (err) {
                              alert('Failed to auto-copy. Please select the key text and copy manually.');
                            }
                          };

                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(apiKey)
                              .then(() => alert('API Key copied to clipboard!'))
                              .catch(() => fallback(apiKey));
                          } else {
                            fallback(apiKey);
                          }
                        }}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 p-2.5 rounded-lg text-xs"
                        title="Copy API Key"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isGeneratingKey}
                        onClick={handleGenerateApiKey}
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 p-2.5 rounded-lg text-xs flex items-center space-x-1"
                        title="Regenerate API Key"
                      >
                        <RefreshCw className={`w-4 h-4 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Treat this key like a password. Anyone with access can update and create metadata items inside your anime database.
                    </p>
                  </div>

                  {/* Metadata Stats */}
                  <div className="pt-4 border-t border-zinc-900 grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Last API Request</p>
                      <p className="text-zinc-300 mt-1">
                        {lastApiRequest ? new Date(lastApiRequest).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Upload Transactions</p>
                      <p className="text-zinc-300 mt-1">{apiHistoryLogs.length} logged</p>
                    </div>
                  </div>
                </div>

                {/* Column 2: API History Logs */}
                <div className="lg:col-span-7 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-350 uppercase tracking-wider">External API Ingest Logs</h4>
                    <button
                      type="button"
                      onClick={fetchApiHistory}
                      disabled={isLoadingApiHistory}
                      className="text-[10px] text-zinc-500 hover:text-cyan-400 font-bold flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingApiHistory ? 'animate-spin' : ''}`} />
                      <span>Refresh Logs</span>
                    </button>
                  </div>

                  <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-zinc-900 scrollbar-thin scrollbar-thumb-zinc-800">
                    {apiHistoryLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-zinc-950/40 transition-colors space-y-2">
                        <div className="flex items-start justify-between text-xs">
                          <div>
                            <p className="font-bold text-zinc-200">{log.animeTitle}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              Season {log.seasonNumber} • {new Date(log.uploadDate).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase ${
                            log.status === 'Success' ? 'bg-emerald-950/55 text-emerald-400 border border-emerald-900/40' :
                            log.status === 'Partial Success' ? 'bg-amber-950/55 text-amber-400 border border-amber-900/40' :
                            'bg-red-950/55 text-red-400 border border-red-900/40'
                          }`}>
                            {log.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900/60 font-mono">
                          <div>Added: <span className="text-emerald-400 font-bold">{log.episodesAdded}</span></div>
                          <div>Updated: <span className="text-cyan-400 font-bold">{log.episodesUpdated}</span></div>
                          <div>Failed: <span className="text-red-400 font-bold">{log.failedCount}</span></div>
                        </div>

                        {log.errorLogs && log.errorLogs.length > 0 && (
                          <div className="p-2.5 bg-red-950/10 border border-red-900/20 rounded text-[10px] text-red-400 leading-relaxed font-mono">
                            <p className="font-bold mb-1 uppercase tracking-wider text-[9px]">Errors / Skip Details:</p>
                            {log.errorLogs.map((err: string, i: number) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {apiHistoryLogs.length === 0 && (
                      <div className="py-12 text-center space-y-2">
                        <Cpu className="w-8 h-8 text-zinc-700 mx-auto opacity-40" />
                        <p className="text-zinc-500 text-xs font-semibold">No automated API uploads logged yet.</p>
                        <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">
                          Generate an API key and query the bulk upload endpoint to populate logs.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* API Documentation Modal overlay */}
            <AnimatePresence>
              {showDocModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl text-left"
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-5 border-b border-zinc-900">
                      <div className="flex items-center space-x-2 text-cyan-400 font-extrabold uppercase text-xs tracking-wider">
                        <Code className="w-4 h-4" />
                        <span>External Upload API Specifications</span>
                      </div>
                      <button
                        onClick={() => setShowDocModal(false)}
                        className="text-zinc-400 hover:text-white bg-zinc-900 p-1.5 rounded-lg border border-zinc-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-350 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800">
                      <div className="space-y-1.5">
                        <h5 className="font-extrabold text-white text-sm">Endpoint Specification</h5>
                        <div className="flex items-center space-x-2 bg-zinc-900 p-2.5 rounded border border-zinc-800 font-mono">
                          <span className="bg-cyan-500/20 text-cyan-400 font-black px-1.5 py-0.5 rounded text-[10px]">POST</span>
                          <span className="text-zinc-200">/api/admin/bulk-upload</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-extrabold text-white text-sm">Request Payload Definition (JSON)</h5>
                        <p className="text-[11px] text-zinc-500">
                          Submit a raw JSON POST payload with your authorized API Key and an array of metadata objects.
                        </p>
                        <pre className="bg-zinc-900 p-4 rounded border border-zinc-800 text-zinc-200 overflow-x-auto font-mono text-[11px] leading-relaxed">
{`{
  "apiKey": "${apiKey || 'YOUR_GENERATED_API_KEY'}",
  "animeId": "demon-slayer",     // Matches the Anime Catalog ID exactly
  "seasonNumber": 2,            // Auto-creates season if missing
  "episodes": [
    {
      "episodeNumber": 1,
      "episodeTitle": "Sound Hashira Uzui Tengen",
      "videoURL": "https://example.com/videos/ds_s2_e1.mp4",
      "thumbnailURL": "https://example.com/covers/ds_s2_e1.jpg", // Optional
      "durationInSeconds": 1440,                                 // Optional (Defaults to 24m)
      "description": "Tanjiro accompanies Uzui Tengen on a mission..." // Optional
    }
  ]
}`}
                        </pre>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-extrabold text-white text-sm">Python Integration Code (Dropbox Tool Automation)</h5>
                        <p className="text-[11px] text-zinc-500">
                          Integrate your local file sync automations cleanly. Copy this Python snippet into your Dropbox script:
                        </p>
                        <pre className="bg-zinc-900 p-4 rounded border border-zinc-800 text-zinc-200 overflow-x-auto font-mono text-[11px] leading-relaxed">
{`import requests

API_URL = "http://localhost:3000/api/admin/bulk-upload"
API_KEY = "${apiKey || 'YOUR_API_KEY'}"

payload = {
    "apiKey": API_KEY,
    "animeId": "demon-slayer",
    "seasonNumber": 2,
    "episodes": [
        {
            "episodeNumber": 1,
            "episodeTitle": "Infiltrating the District",
            "videoURL": "https://dropbox.com/s/raw/episode1.mp4",
            "thumbnailURL": "https://unsplash.com/photos/demo.jpg",
            "durationInSeconds": 1440,
            "description": "Auto-ingested via Dropbox Automation Pipeline."
        }
    ]
}

response = requests.post(API_URL, json=payload)
print(response.status_code)
print(response.json())`}
                        </pre>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-zinc-900">
                        <h5 className="font-extrabold text-white text-sm">Response Payload Structure</h5>
                        <pre className="bg-zinc-900 p-4 rounded border border-zinc-800 text-zinc-200 overflow-x-auto font-mono text-[11px] leading-relaxed">
{`{
  "success": true,
  "animeName": "Demon Slayer: Kimetsu no Yaiba",
  "seasonNumber": 2,
  "episodesAdded": 1,
  "episodesUpdated": 0,
  "failedUploads": [],
  "processingTime": "45ms"
}`}
                        </pre>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex justify-end">
                      <button
                        onClick={() => setShowDocModal(false)}
                        className="bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold px-5 py-2 rounded-lg text-xs"
                      >
                        Got it, close
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* HOMEPAGE BANNER MANAGER & NEWS TAB PANEL */}
        {activeTab === 'banner_manager' && (
          <div className="space-y-8 animate-fade-in text-left">
            
            {/* Banner Category Selector list */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-4">
              <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
                <Tv className="w-4 h-4" />
                <span>Homepage Banners & Reels Highlight manager</span>
              </div>
              <p className="text-xs text-zinc-450 font-semibold leading-relaxed">
                Update categories of anime shows. Featured category shows are displayed as high-definition banners on the top slider on the browse page. Trending and Popular categories populate their respective horizontal blocks.
              </p>
              
              <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/80">
                <table className="w-full border-collapse text-left text-xs font-bold">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-450 uppercase tracking-widest text-[10px] border-b border-zinc-800">
                      <th className="p-4">Anime Series Title</th>
                      <th className="p-4">Current Category</th>
                      <th className="p-4">Status & release</th>
                      <th className="p-4 text-center">Change Category Highlight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-100">
                    {allAnime.map(ani => (
                      <tr key={ani.id} className="hover:bg-zinc-905/60 transition-colors">
                        <td className="p-4 flex items-center space-x-3.5">
                          <img src={ani.thumbnailUrl} alt="" className="w-10 h-14 object-cover rounded border border-zinc-850" />
                          <div>
                            <p className="font-extrabold text-[13px]">{ani.title}</p>
                            <p className="text-[10px] text-zinc-500 font-normal mt-0.5 font-mono">{ani.id}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                            ani.category === 'Featured' ? 'bg-orange-500 text-black shadow-neon-orange' :
                            ani.category === 'Trending' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900' :
                            ani.category === 'Popular' ? 'bg-purple-950 text-purple-400 border border-purple-900' :
                            'bg-zinc-900 text-zinc-400'
                          }`}>
                            {ani.category}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400 font-semibold">
                          <p>{ani.type || 'Series'}</p>
                          <p className="text-[10px] text-zinc-650 font-semibold font-mono mt-0.5">{ani.genres.join(', ')}</p>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {(['Featured', 'Trending', 'Popular', 'Regular'] as any[]).map(cat => (
                              <button
                                key={cat}
                                onClick={() => handleUpdateCategory(ani.id, cat)}
                                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer text-[10px] uppercase font-bold ${
                                  ani.category === cat 
                                    ? 'bg-zinc-800 text-orange-400 border border-orange-500/50' 
                                    : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-900'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anime News section database manager form */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Form card */}
              <div className="md:col-span-5 glass-panel p-6 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-indigo-400 font-extrabold uppercase text-xs tracking-wider">
                  <PlusCircle className="w-4 h-4" />
                  <span>Publish Anime News article</span>
                </div>
                
                <form onSubmit={handleCreateNews} className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Article Headline Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Demon Slayer Season 4 official Release date revealed!"
                      value={newsForm.title}
                      onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Content Body text</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Write announcement description..."
                      value={newsForm.content}
                      onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 rounded-lg p-3 text-zinc-200 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Cover Image URL</label>
                    <input
                      type="text"
                      placeholder="https://... URL address cover"
                      value={newsForm.imageUrl}
                      onChange={(e) => setNewsForm({ ...newsForm, imageUrl: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">News Source / Author</label>
                    <input
                      type="text"
                      placeholder="e.g. Crunchyroll News, Ani-MayX"
                      value={newsForm.source}
                      onChange={(e) => setNewsForm({ ...newsForm, source: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-lg text-xs uppercase cursor-pointer transition-all active:scale-95"
                  >
                    Publish Article Release
                  </button>
                </form>
              </div>

              {/* News Articles feed lists manager */}
              <div className="md:col-span-7 glass-panel p-6 rounded-2xl border border-zinc-800 space-y-4">
                <div className="text-zinc-300 font-extrabold uppercase text-xs tracking-wider">
                  <span>Current Published News Pieces ({newsList.length})</span>
                </div>
                
                <div className="space-y-3 overflow-y-auto max-h-[460px] pr-2">
                  {newsList.map(news => (
                    <div key={news.id} className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-xl flex gap-4 items-start text-xs font-semibold">
                      <img src={news.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
                      <div className="flex-grow">
                        <p className="font-extrabold text-white text-sm line-clamp-1">{news.title}</p>
                        <p className="text-zinc-500 text-[11px] leading-relaxed line-clamp-2 mt-1">{news.content}</p>
                        <p className="text-[10px] text-zinc-400 mt-2 font-medium">Source: <span className="text-indigo-400 font-bold">{news.source}</span></p>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(news.id)}
                        className="p-1.5 text-zinc-650 hover:text-red-400 hover:bg-red-950/30 rounded self-center cursor-pointer transition-colors"
                        title="Delete article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newsList.length === 0 && (
                    <p className="text-center text-zinc-600 text-xs font-semibold py-12">No news items published yet on this platform.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ==========================================
// PURE-JS ALGORITHM PROVIDERS FOR PERFORMANCE
// ==========================================

function computeMD5(str: string): string {
  let k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];
  let r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  
  let utf8 = unescape(encodeURIComponent(str));
  let bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
  
  let words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  let byteLen = bytes.length;
  words[byteLen >> 2] |= 0x80 << ((byteLen % 4) * 8);
  let wordLen = ((byteLen + 8) >> 6) * 16 + 14;
  words[wordLen] = byteLen * 8;
  
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  
  for (let i = 0; i < words.length; i += 16) {
    let a = h0, b = h1, c = h2, d = h3;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }
      let temp = d;
      d = c;
      c = b;
      let val = a + f + k[j] + (words[i + g] || 0);
      let rot = r[j];
      b = b + ((val << rot) | (val >>> (32 - rot)));
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
  }
  
  const toHex = (n: number) => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      let b = (n >>> (i * 8)) & 0xff;
      s += (b < 16 ? "0" : "") + b.toString(16);
    }
    return s;
  };
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3);
}

function computeCRC32(str: string): string {
  let table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ -1;
  const utf8 = unescape(encodeURIComponent(str));
  for (let i = 0; i < utf8.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ utf8.charCodeAt(i)) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// Helper to convert array buffer to hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


// ==========================================
// APP ANNOUNCEMENT & BROADCAST PANEL
// ==========================================

function AnnouncementsPanel() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [active, setActive] = useState(false);
  const [type, setType] = useState<'info' | 'warning' | 'alert' | 'success'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const docRef = doc(db, 'settings', 'announcement');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setMessage(data.message || '');
          setLinkText(data.linkText || '');
          setLinkUrl(data.linkUrl || '');
          setActive(!!data.active);
          setType(data.type || 'info');
        }
      } catch (err) {
        console.error("Error loading announcement:", err);
      }
    };
    fetchAnnouncement();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setIsSaved(false);
    try {
      const docRef = doc(db, 'settings', 'announcement');
      await setDoc(docRef, {
        title,
        message,
        linkText,
        linkUrl,
        active,
        type,
        updatedAt: new Date().toISOString()
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(`Failed to save announcement: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 animate-fade-in text-left">
      <div className="flex items-center space-x-2.5 text-orange-400 font-extrabold uppercase text-sm tracking-wider pb-2 border-b border-zinc-900">
        <Megaphone className="w-5 h-5 animate-bounce" />
        <span>Manage Global App Announcement Banner</span>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
        Publish an app-wide alert banner at the very top of the homepage. You can use this to broadcast server maintenance, upcoming stream additions, community events, or any important notice to all active users.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Announcement Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Server Maintenance, Important Notice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Banner Type Theme</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
            >
              <option value="info">Info (Blue/Zinc Accent)</option>
              <option value="warning">Warning (Amber Alert Accent)</option>
              <option value="alert">Alert (Red Critical Accent)</option>
              <option value="success">Success (Emerald Green Accent)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Announcement Message Details</label>
          <textarea
            rows={4}
            required
            placeholder="Write details or message contents for users..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500 rounded-lg p-3 text-zinc-200 text-xs outline-none leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Call-to-Action Link Text (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Join Discord, Read More"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Call-to-Action Link URL (Optional)</label>
            <input
              type="text"
              placeholder="e.g. https://discord.gg/QNTADzYNB"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 text-xs font-semibold outline-none"
            />
          </div>
        </div>

        <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-zinc-200">Enable Announcement Banner</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Toggle whether the announcement displays instantly to all users.</span>
          </div>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-orange-500 rounded cursor-pointer w-5 h-5"
          />
        </div>

        {/* Live Preview Card */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Live Banner Preview:</p>
          {active ? (
            <div className={`p-3 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs leading-relaxed transition-colors ${
              type === 'info' ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200' :
              type === 'warning' ? 'bg-amber-950/20 border-amber-900/50 text-amber-300' :
              type === 'alert' ? 'bg-red-950/20 border-red-900/50 text-red-300' :
              'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold uppercase tracking-wide">{title}:</span>
                <span className="font-medium text-zinc-350">{message}</span>
              </div>
              {linkText && linkUrl && (
                <div 
                  className={`font-black uppercase tracking-wider text-[10px] px-2.5 py-1 rounded border hover:scale-105 transition-all flex items-center gap-1 shrink-0 ${
                    type === 'info' ? 'bg-zinc-800 border-zinc-700 text-white' :
                    type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' :
                    type === 'alert' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
                    'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  <span>{linkText}</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 italic">Banner is currently disabled.</p>
          )}
        </div>

        <div className="flex items-center space-x-3 justify-end pt-2">
          {isSaved && (
            <span className="text-xs text-emerald-500 font-extrabold uppercase animate-pulse">Announcement Updated Successfully!</span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-black font-black text-xs uppercase px-6 py-3 rounded-xl transition-all shadow-neon-orange select-none disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'PUBLISHING...' : 'PUBLISH ANNOUNCEMENT'}
          </button>
        </div>
      </form>
    </div>
  );
}


// ==========================================
// ADVANCED HASH & ROUTING GENERATOR PANEL
// ==========================================

interface HashGeneratorPanelProps {
  allAnime: Anime[];
}

function HashGeneratorPanel({ allAnime }: HashGeneratorPanelProps) {
  // Inputs for Text Hasher
  const [textInput, setTextInput] = useState('Ani-MayX_Secret_Stream_Source_Value');
  const [liveMD5, setLiveMD5] = useState('');
  const [liveCRC32, setLiveCRC32] = useState('');
  const [liveSHA1, setLiveSHA1] = useState('');
  const [liveSHA256, setLiveSHA256] = useState('');
  const [liveSHA512, setLiveSHA512] = useState('');

  // File Hashing
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHashResult, setFileHashResult] = useState('');
  const [fileHashAlgo, setFileHashAlgo] = useState<'SHA-256' | 'SHA-1' | 'MD5'>('SHA-256');
  const [fileHashProgress, setFileHashProgress] = useState(0);
  const [isFileHashing, setIsFileHashing] = useState(false);

  // Router slug pre-calculated helper
  const [slugInput, setSlugInput] = useState('Demon Slayer: Kimetsu no Yaiba');
  const [liveSlugOutput, setLiveSlugOutput] = useState('');

  // Routing previewer
  const [selectedAnimeId, setSelectedAnimeId] = useState(allAnime[0]?.id || '');
  const [seasonNumberInput, setSeasonNumberInput] = useState(1);
  const [episodeNumberInput, setEpisodeNumberInput] = useState(1);
  const [watchUrlOutput, setWatchUrlOutput] = useState('');

  // HMAC Link Tokenizer Signer
  const [hmacPayload, setHmacPayload] = useState('/anime/demon-slayer/demon-slayer_1_1');
  const [hmacKey, setHmacKey] = useState('Ani-MayXDefaultSigningSalt2026');
  const [hmacSignature, setHmacSignature] = useState('');
  const [tokenExpHrs, setTokenExpHrs] = useState(6);

  // Notification Copy Alert States
  const [copiedState, setCopiedState] = useState<string | null>(null);

  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(label);
    setTimeout(() => setCopiedState(null), 2000);
  };

  // 1. Text Real-Time Hashing
  useEffect(() => {
    if (!textInput) {
      setLiveMD5('');
      setLiveCRC32('');
      setLiveSHA1('');
      setLiveSHA256('');
      setLiveSHA512('');
      return;
    }

    setLiveMD5(computeMD5(textInput));
    setLiveCRC32(computeCRC32(textInput));

    // Native SubtleCrypto async hashing
    const textEncoder = new TextEncoder();
    const dataBytes = textEncoder.encode(textInput);

    window.crypto.subtle.digest('SHA-1', dataBytes)
      .then(buf => setLiveSHA1(bufToHex(buf)))
      .catch(() => setLiveSHA1('Error'));

    window.crypto.subtle.digest('SHA-256', dataBytes)
      .then(buf => setLiveSHA255(bufToHex(buf)))
      .catch(() => setLiveSHA256('Error'));

    window.crypto.subtle.digest('SHA-512', dataBytes)
      .then(buf => setLiveSHA512(bufToHex(buf)))
      .catch(() => setLiveSHA512('Error'));

    // Workaround compiler checks for variable scoping
    function setLiveSHA255(val: string) {
      setLiveSHA256(val);
    }
  }, [textInput]);

  // 2. SEO Slugs live updates helper
  useEffect(() => {
    const slug = slugInput
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[-\s]+/g, '-');
    setLiveSlugOutput(slug);
  }, [slugInput]);

  // 3. Routing parameters updates helper
  useEffect(() => {
    const anime = allAnime.find(a => a.id === selectedAnimeId);
    const slugTitle = anime 
      ? anime.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[-\s]+/g, '-')
      : 'unspecified-anime';
    const epId = `${slugTitle}_${seasonNumberInput}_${episodeNumberInput}`;
    const targetUrl = `https://watch-ani-mayx.netlify.app/anime/${slugTitle}/${epId}`;
    setWatchUrlOutput(targetUrl);
    // Auto-update hmacPayload to mimic realistic secure signature generator
    setHmacPayload(`/anime/${slugTitle}/${epId}`);
  }, [selectedAnimeId, seasonNumberInput, episodeNumberInput, allAnime]);

  // 4. HMAC Live update calculation helper
  useEffect(() => {
    const payloadWithExp = `${hmacPayload}?expires=${Date.now() + tokenExpHrs * 3600000}`;
    
    // Web Crypto HMAC-SHA256 generator
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(hmacKey);
    const dataBytes = encoder.encode(payloadWithExp);

    window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ).then(cryptoKey => {
      window.crypto.subtle.sign("HMAC", cryptoKey, dataBytes).then(signature => {
        setHmacSignature(bufToHex(signature));
      });
    }).catch(() => {
      setHmacSignature('HMAC-Error');
    });
  }, [hmacPayload, hmacKey, tokenExpHrs]);

  // 5. Async File stream hasher action
  const handleFileHashing = async () => {
    if (!selectedFile) return;
    setIsFileHashing(true);
    setFileHashProgress(0);
    setFileHashResult('');

    try {
      if (fileHashAlgo === 'MD5') {
        const reader = new FileReader();
        reader.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setFileHashProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };
        reader.onload = (e) => {
          const text = e.target?.result as string || '';
          setFileHashResult(computeMD5(text));
          setIsFileHashing(false);
          setFileHashProgress(100);
        };
        reader.readAsBinaryString(selectedFile);
      } else {
        const algoName = fileHashAlgo === 'SHA-1' ? 'SHA-1' : 'SHA-256';
        const reader = new FileReader();
        reader.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setFileHashProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };
        reader.onload = async (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const hashBuffer = await window.crypto.subtle.digest(algoName, buffer);
            setFileHashResult(bufToHex(hashBuffer));
            setIsFileHashing(false);
            setFileHashProgress(100);
          } catch (err) {
            console.error(err);
            setFileHashResult('SubtleCrypto error digesting stream');
            setIsFileHashing(false);
          }
        };
        reader.readAsArrayBuffer(selectedFile);
      }
    } catch (e: any) {
      setFileHashResult(`Error computing checksum: ${e.message || e}`);
      setIsFileHashing(false);
    }
  };

  return (
    <div className="space-y-8 text-left animate-fade-in pb-16">
      
      {/* Header telemetry info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center mb-1">
            <Hash className="w-6 h-6 text-orange-500 mr-2.5 stroke-[2.5]" />
            <span>ADVANCED CRYPTOGRAPHIC HASH & SLUG ENGINE</span>
          </h2>
          <p className="text-xs text-zinc-400 font-medium">
            Generate and verify slugs, route integrity checks, direct Netflix-style slug paths, file checksum hashes, and secure HMAC signing parameters.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-zinc-950/80 px-3.5 py-1.5 rounded-lg border border-zinc-900">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-zinc-400 font-mono">Crypto.Subtle NATIVE ACCELERATION ACTIVATED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: real-time hash inputs and outputs */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Interactive Real-Time Text hashing */}
          <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <h3 className="text-sm font-black tracking-wider text-orange-400 font-mono uppercase mb-4 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              <span>1. Text & Stream String Hasher</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-zinc-500 font-mono block mb-1.5">Input Text String / Stream URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter string values to compute instant live hashes..."
                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/20 outline-none pr-12 transition-all"
                  />
                  {textInput && (
                    <button 
                      onClick={() => setTextInput('')}
                      className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-white text-xs font-bold font-mono cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 font-mono px-1">
                  <span>Characters: {textInput.length}</span>
                  <span>Bytes: {new Blob([textInput]).size} B</span>
                </div>
              </div>

              {/* Outputs grid */}
              <div className="space-y-3 pt-2">
                {[
                  { name: 'MD5', hash: liveMD5, color: 'text-orange-400' },
                  { name: 'CRC-32', hash: liveCRC32, color: 'text-amber-400' },
                  { name: 'SHA-1', hash: liveSHA1, color: 'text-purple-400' },
                  { name: 'SHA-256', hash: liveSHA256, color: 'text-rose-400' },
                  { name: 'SHA-512', hash: liveSHA512, color: 'text-blue-400' },
                ].map((item) => (
                  <div key={item.name} className="bg-zinc-900/65 border border-zinc-850/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <span className={`font-mono font-black ${item.color} uppercase tracking-wider w-20 shrink-0`}>
                      {item.name}
                    </span>
                    <div className="font-mono text-zinc-300 break-all select-all flex-1 bg-black/35 py-1.5 px-3 rounded-lg border border-zinc-950 text-left truncate">
                      {item.hash || 'Computing...'}
                    </div>
                    <button
                      onClick={() => triggerCopy(item.hash, item.name)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-orange-500 hover:text-black rounded-lg text-[10px] text-zinc-300 transition-all font-bold cursor-pointer shrink-0 uppercase tracking-wider min-w-[70px] text-center flex items-center justify-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedState === item.name ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Core file checksummer */}
          <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative">
            <h3 className="text-sm font-black tracking-wider text-orange-400 font-mono uppercase mb-4 flex items-center">
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>2. File Checksum Verifier</span>
            </h3>

            <div className="space-y-4">
              <div className="border border-dashed border-zinc-800 hover:border-orange-500/40 bg-zinc-900/10 rounded-xl p-5 text-center transition-colors relative cursor-pointer">
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setFileHashResult('');
                      setFileHashProgress(0);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-orange-500 mx-auto mb-2 animate-pulse" />
                <p className="text-xs font-bold text-zinc-200">
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'Drag and drop or Click to choose video/file'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                  {selectedFile ? `Size: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Format: ${selectedFile.name.split('.').pop()?.toUpperCase()}` : 'Supports MP4, M3U8, JPG, PNG or Web assets'}
                </p>
              </div>

              {selectedFile && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center space-x-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                    {['SHA-256', 'SHA-1', 'MD5'].map((algo) => (
                      <button
                        key={algo}
                        onClick={() => {
                          setFileHashAlgo(algo as any);
                          setFileHashResult('');
                          setFileHashProgress(0);
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                          fileHashAlgo === algo 
                            ? 'bg-orange-500 text-black font-extrabold' 
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {algo}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleFileHashing}
                    disabled={isFileHashing}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 font-black text-black px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer shadow-md shadow-orange-500/10 uppercase tracking-widest font-mono"
                  >
                    {isFileHashing ? `Hashing... ${fileHashProgress}%` : 'Compute File Checksum'}
                  </button>
                </div>
              )}

              {/* Progress bar container */}
              {isFileHashing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-orange-400 font-bold font-mono">
                    <span>ASYNC ENCODER READ SEGMENT</span>
                    <span>{fileHashProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 transition-all duration-200"
                      style={{ width: `${fileHashProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* File Hash Result wrapper */}
              {fileHashResult && (
                <div className="bg-zinc-900/80 border border-zinc-850 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono text-zinc-500">Computed File Integrity Checksum ({fileHashAlgo})</span>
                    <button
                      onClick={() => triggerCopy(fileHashResult, 'FILE_HASH')}
                      className="text-[10px] font-bold text-orange-400 hover:text-orange-300 font-mono uppercase cursor-pointer"
                    >
                      {copiedState === 'FILE_HASH' ? '✔ COPIED CHECKSUM' : 'COPY OUTPUT'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-white break-all bg-black/45 p-2.5 rounded-lg border border-zinc-950 select-all leading-relaxed">
                    {fileHashResult}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: SEO system slugs & HMAC session link protection router tools */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 3: Ani-MayX Direct Slug & Routing Link generator tool */}
          <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative overflow-hidden">
            <h3 className="text-sm font-black tracking-wider text-orange-400 font-mono uppercase mb-4 flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              <span>3. Ani-MayX routing slug assistant</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-zinc-500 font-mono block mb-1.5">Anime Name / Base Text</label>
                <input
                  type="text"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  placeholder="e.g. Demon Slayer Season 4"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-zinc-500 font-mono block mb-1.5">Deterministic URL slug output</label>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-green-400 font-black">
                    {liveSlugOutput || '(Empty Slug)'}
                  </span>
                  <button
                    onClick={() => triggerCopy(liveSlugOutput, 'SLUG')}
                    className="text-[10px] text-zinc-400 hover:text-white font-black uppercase font-mono cursor-pointer"
                  >
                    {copiedState === 'SLUG' ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              </div>

              {/* Dynamic routing playground links selector */}
              <div className="pt-3 border-t border-zinc-900 space-y-3">
                <p className="text-[10px] font-black uppercase text-zinc-500 font-mono">
                  🎮 SIMULATE ACTIVE PLAYER ROUTING LINK
                </p>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono block mb-1">Target Anime Selector</label>
                  <select
                    value={selectedAnimeId}
                    onChange={(e) => setSelectedAnimeId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono outline-none focus:border-orange-500 transition-all cursor-pointer"
                  >
                    {allAnime.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                    {allAnime.length === 0 && (
                      <option value="">No Anime collections loaded</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono block mb-1">Season Num</label>
                    <input
                      type="number"
                      min={1}
                      value={seasonNumberInput}
                      onChange={(e) => setSeasonNumberInput(parseInt(e.target.value) || 1)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono block mb-1">Episode Num</label>
                    <input
                      type="number"
                      min={1}
                      value={episodeNumberInput}
                      onChange={(e) => setEpisodeNumberInput(parseInt(e.target.value) || 1)}
                      className="w-full bg-zinc-905 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-3 space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-orange-400 font-mono block select-none">Preview Player Link (Netlify structure friendly!)</span>
                  <p className="font-mono text-[11px] text-zinc-300 break-all select-all hover:text-white transition-colors">
                    {watchUrlOutput}
                  </p>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => triggerCopy(watchUrlOutput, 'WATCH_URL')}
                      className="bg-orange-500 hover:bg-orange-600 text-black font-black text-[10px] px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center space-x-1 uppercase font-mono"
                    >
                      <Copy className="w-3.5 h-3.5 mr-0.5" />
                      <span>{copiedState === 'WATCH_URL' ? 'EPISODE LINK COPIED ✓' : 'COPY PLAYABLE ROUTING LINK'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Secure Stream token HMAC protecter signer */}
          <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative">
            <h3 className="text-sm font-black tracking-wider text-orange-400 font-mono uppercase mb-4 flex items-center">
              <Key className="w-4 h-4 mr-2" />
              <span>4. CDN Signature Link protector (HMAC-SHA256)</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-zinc-500 font-mono block mb-1.5">Sign Secret Key / Token Salt</label>
                <input
                  type="text"
                  value={hmacKey}
                  onChange={(e) => setHmacKey(e.target.value)}
                  placeholder="Secret key salt, e.g. AniMayXSecKey"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-black uppercase text-zinc-500 font-mono">Token Expiration Limit</label>
                  <span className="text-xs font-bold text-orange-400 font-mono">{tokenExpHrs} Hours</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={72}
                  value={tokenExpHrs}
                  onChange={(e) => setTokenExpHrs(parseInt(e.target.value) || 1)}
                  className="w-full accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800 appearance-none outline-none"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-zinc-500 font-mono block">Signed Signature token</span>
                <p className="font-mono text-[10px] text-zinc-400 break-all bg-black/45 p-3 rounded-lg border border-zinc-950 select-all leading-normal">
                  {hmacSignature || 'Generating...'}
                </p>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                  <span>Sign algorithm: HMAC-256</span>
                  <button
                    onClick={() => triggerCopy(hmacSignature, 'HMAC')}
                    className="text-[10px] font-bold text-orange-400 hover:text-orange-300 hover:underline cursor-pointer uppercase flex items-center space-x-1"
                  >
                    <span>{copiedState === 'HMAC' ? 'Token Copied!' : 'Copy Secure Token'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

// ==========================================
// FIREBASE CONNECTION SETTINGS PANEL
// ==========================================

function FirebaseConfigPanel() {
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [firestoreDatabaseId, setFirestoreDatabaseId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);

  useEffect(() => {
    const current = getActiveFirebaseConfig();
    setProjectId(current.projectId || '');
    setAppId(current.appId || '');
    setApiKey(current.apiKey || '');
    setAuthDomain(current.authDomain || '');
    setFirestoreDatabaseId(current.firestoreDatabaseId || '(default)');
    setStorageBucket(current.storageBucket || '');
    setMessagingSenderId(current.messagingSenderId || '');
    setMeasurementId(current.measurementId || '');

    try {
      const custom = localStorage.getItem('animayx_custom_firebase_config');
      setHasCustomConfig(!!custom);
    } catch (e) {}
  }, []);

  const handleApplyPresetAnimayx = () => {
    setProjectId('animayx-fc202');
    setAuthDomain('animayx-fc202.firebaseapp.com');
    setStorageBucket('animayx-fc202.firebasestorage.app');
    setFirestoreDatabaseId('(default)');
  };

  const handleResetToSandbox = () => {
    setProjectId('animayx-115f6');
    setAuthDomain('animayx-115f6.firebaseapp.com');
    setStorageBucket('animayx-115f6.firebasestorage.app');
    setFirestoreDatabaseId('ai-studio-animayx-c4bb8bf3-74b9-4879-9932-fe52b31ca7a1');
    setApiKey('AIzaSyDF77lX0vCADWWMkdRt7cokYhR8Kw3WM3w');
    setAppId('1:982921263273:web:00b9f0ae2b0f6498ff91b8');
    setMessagingSenderId('982921263273');
    setMeasurementId('');
  };

  const handleSave = () => {
    if (!projectId || !apiKey || !appId) {
      alert('Project ID, API Key, and App ID are required to establish a valid Firebase web connection.');
      return;
    }

    const customConfig = {
      projectId,
      appId,
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      firestoreDatabaseId: firestoreDatabaseId || '(default)',
      storageBucket: storageBucket || `${projectId}.firebasestorage.app`,
      messagingSenderId,
      measurementId
    };

    try {
      localStorage.setItem('animayx_custom_firebase_config', JSON.stringify(customConfig));
      setIsSaved(true);
      setHasCustomConfig(true);
    } catch (e) {
      alert('Failed to save settings to localStorage. Make sure storage is enabled in your browser settings.');
    }
  };

  const handleClearCustom = () => {
    try {
      localStorage.removeItem('animayx_custom_firebase_config');
      setIsSaved(false);
      setHasCustomConfig(false);
      window.location.reload();
    } catch (e) {}
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-zinc-800 space-y-6 animate-fade-in text-left">
      <div className="flex justify-between items-start border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-400" />
            <span>FIREBASE CONNECTION SETTINGS</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Connect AniMayX to your custom Firebase project to store and persist collections, authentication users, and comments.
          </p>
        </div>
        {hasCustomConfig && (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold font-mono rounded-lg text-[10px] uppercase">
            Active: Custom Project
          </span>
        )}
      </div>

      {isSaved && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-emerald-400 font-extrabold text-xs">CONNECTION CONFIGURATION SAVED SUCCESSFULLY!</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Please reload the web application to establish connection with the new database.</p>
          </div>
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase rounded-lg active:scale-95 transition-all cursor-pointer font-mono"
          >
            Reload Application
          </button>
        </div>
      )}

      {/* Preset Buttons helper */}
      <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 space-y-2.5">
        <span className="text-[10px] font-black uppercase text-zinc-500 font-mono block">Connection Presets</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApplyPresetAnimayx}
            className="px-3.5 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-500/60 text-orange-400 text-xs font-bold rounded-lg transition-all active:scale-95"
          >
            🔌 Connect to Animayx Custom Project (animayx-fc202)
          </button>
          <button
            onClick={handleResetToSandbox}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs font-bold rounded-lg transition-all active:scale-95"
          >
            🔄 Reset to AI Studio Sandbox Default
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 italic mt-1 leading-normal">
          Clicking the preset button fills in the Project ID and corresponding endpoints. Make sure to paste your actual Web SDK <b>API Key</b> and <b>App ID</b> from the Firebase console.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Firebase Project ID *</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="e.g. animayx-fc202"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Web App API Key *</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* App ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Firebase App ID *</label>
          <input
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="1:982921263273:web:..."
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* Auth Domain */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Auth Domain</label>
          <input
            type="text"
            value={authDomain}
            onChange={(e) => setAuthDomain(e.target.value)}
            placeholder="animayx-fc202.firebaseapp.com"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* Firestore Database ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Firestore Database ID</label>
          <input
            type="text"
            value={firestoreDatabaseId}
            onChange={(e) => setFirestoreDatabaseId(e.target.value)}
            placeholder="(default)"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
          <span className="text-[9px] text-zinc-500 block leading-tight">Use "(default)" for standard projects. Override only if using multiple databases.</span>
        </div>

        {/* Storage Bucket */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Storage Bucket</label>
          <input
            type="text"
            value={storageBucket}
            onChange={(e) => setStorageBucket(e.target.value)}
            placeholder="animayx-fc202.firebasestorage.app"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* Messaging Sender ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Messaging Sender ID</label>
          <input
            type="text"
            value={messagingSenderId}
            onChange={(e) => setMessagingSenderId(e.target.value)}
            placeholder="982921263273"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>

        {/* Measurement ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-black uppercase text-zinc-400">Measurement ID (Optional)</label>
          <input
            type="text"
            value={measurementId}
            onChange={(e) => setMeasurementId(e.target.value)}
            placeholder="G-XXXXXX"
            className="w-full bg-black/45 border border-zinc-800 focus:border-orange-500/50 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
        {hasCustomConfig ? (
          <button
            onClick={handleClearCustom}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold text-xs uppercase rounded-lg active:scale-95 transition-all cursor-pointer font-mono"
          >
            Disconnect Custom Config
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black text-xs uppercase rounded-lg active:scale-95 transition-all cursor-pointer font-mono shadow-neon-orange"
        >
          Save and Connect Project
        </button>
      </div>
    </div>
  );
}

// ==========================================
// BACKUP & RESTORE DATABASE PANEL
// ==========================================

interface BackupRestorePanelProps {
  refreshData: () => Promise<void>;
}

function BackupRestorePanel({ refreshData }: BackupRestorePanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  const [sandboxActive, setSandboxActive] = useState(getLocalSandboxMode());

  // User backup states
  const [userBackups, setUserBackups] = useState<any[]>([]);
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  const fetchUserBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const q = collection(db, 'users_backup');
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setUserBackups(list);
    } catch (err) {
      console.error("Error loading user backups:", err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleToggleSandbox = (val: boolean) => {
    setLocalSandboxMode(val);
    setSandboxActive(val);
    try {
      localStorage.setItem('animayx_show_sandbox_toast', val ? 'true' : 'false');
    } catch (e) {}
    window.location.reload();
  };

  const handleRestoreUser = async (backup: any) => {
    try {
      const confirmRestore = window.confirm(`Are you sure you want to restore the user account with email "${backup.email}"?`);
      if (!confirmRestore) return;

      const userDocRef = doc(db, 'users', backup.uid);
      await setDoc(userDocRef, {
        uid: backup.uid,
        email: backup.email,
        displayName: backup.displayName || 'Restored Member',
        photoURL: backup.photoURL || '',
        role: backup.role || 'user',
        createdAt: backup.createdAt || new Date(),
        isBanned: false
      });

      // Restore watch history records
      if (backup.watchHistory && Array.isArray(backup.watchHistory)) {
        for (const entry of backup.watchHistory) {
          const entryId = entry.id || `${backup.uid}_${entry.episodeId}`;
          await setDoc(doc(db, 'watchHistory', entryId), {
            ...entry,
            id: entryId,
            userId: backup.uid
          });
        }
      }

      // Restore watchlist records
      if (backup.watchlist && Array.isArray(backup.watchlist)) {
        for (const entry of backup.watchlist) {
          const entryId = entry.id || `${backup.uid}_${entry.animeId}`;
          await setDoc(doc(db, 'watchlist', entryId), {
            ...entry,
            id: entryId,
            userId: backup.uid
          });
        }
      }

      // Restore reviews
      if (backup.reviews && Array.isArray(backup.reviews)) {
        for (const entry of backup.reviews) {
          const entryId = entry.id || `review_${Math.random().toString(36).substring(2, 11)}`;
          await setDoc(doc(db, 'reviews', entryId), {
            ...entry,
            id: entryId,
            userId: backup.uid
          });
        }
      }

      // Restore comments
      if (backup.comments && Array.isArray(backup.comments)) {
        for (const entry of backup.comments) {
          const entryId = entry.id || `comment_${Math.random().toString(36).substring(2, 11)}`;
          await setDoc(doc(db, 'comments', entryId), {
            ...entry,
            id: entryId,
            userId: backup.uid
          });
        }
      }

      alert(`User ${backup.email} has been successfully restored with all watch history, watchlist, comments, and reviews!`);
      refreshData();
    } catch (err: any) {
      console.error("Error restoring user account:", err);
      alert(`User restoration failure: ${err.message || err}`);
    }
  };

  const [backupLogs, setBackupLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchUserBackups();
  }, []);

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setBackupLogs(["Backup Started", "Exporting Data"]);
    try {
      console.log("Acquiring snaps of all system collections for database backup...");
      const collectionsToExport = [
        { key: 'anime', label: 'Anime Catalog' },
        { key: 'seasons', label: 'Seasons Links' },
        { key: 'episodes', label: 'Episodes metadata' },
        { key: 'videoUrlMap', label: 'Video Stream Mapping' },
        { key: 'news', label: 'News Releases' },
        { key: 'schedule', label: 'Weekly Release Calendar' },
        { key: 'users', label: 'User Profiles' },
        { key: 'users_backup', label: 'User Backups' },
        { key: 'watchHistory', label: 'Watch History' },
        { key: 'watchlist', label: 'Watchlist' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'comments', label: 'Comments' },
        { key: 'adminInvites', label: 'Admin Invites' },
        { key: 'adminLogs', label: 'Admin Logs' },
        { key: 'favorites', label: 'Favorites' },
        { key: 'favoriteEpisodes', label: 'Favorite Episodes' },
        { key: 'notifications', label: 'Notifications' },
        { key: 'banners', label: 'Banners' },
        { key: 'settings', label: 'Settings' },
        { key: 'aniskipCache', label: 'AniSkip Cache' },
        { key: 'aniskip', label: 'AniSkip data' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'thumbnails', label: 'Thumbnails metadata' }
      ];

      const backupBundle: any = {
        appName: "Ani-MayX Streaming Studio",
        exportedAt: new Date().toISOString(),
        schemaVersion: "2.0.0",
        databaseId: "ai-studio-animayx-c4bb8bf3-74b9-4879-9932-fe52b31ca7a1",
        isSandboxSource: getLocalSandboxMode()
      };

      const snapPromises = collectionsToExport.map(col => 
        getDocs(collection(db, col.key)).catch(err => {
          console.warn(`Skipping optional/uncreated collection ${col.key}:`, err);
          return null;
        })
      );
      const snapshots = await Promise.all(snapPromises);

      collectionsToExport.forEach((col, idx) => {
        const snap = snapshots[idx];
        if (snap) {
          backupBundle[col.key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setBackupLogs(prev => [...prev, ` - Exported ${col.label}: ${snap.docs.length} records`]);
        } else {
          backupBundle[col.key] = [];
          setBackupLogs(prev => [...prev, ` - Exported ${col.label}: 0 records`]);
        }
      });

      setBackupLogs(prev => [...prev, "Validating"]);

      // Verify backup integrity
      const serialized = JSON.stringify(backupBundle, null, 2);
      const parsed = JSON.parse(serialized);

      // Verify that required collections exist
      const requiredKeys = ['anime', 'seasons', 'episodes'];
      for (const reqKey of requiredKeys) {
        if (!parsed[reqKey] || !Array.isArray(parsed[reqKey])) {
          throw new Error(`Integrity error: Required collection "${reqKey}" is missing in export payload.`);
        }
      }

      // Record count validation
      let totalExpected = 0;
      let totalActual = 0;
      collectionsToExport.forEach((col, idx) => {
        const snap = snapshots[idx];
        const count = snap ? snap.docs.length : 0;
        totalExpected += count;
        totalActual += parsed[col.key]?.length || 0;
      });

      if (totalExpected !== totalActual) {
        throw new Error(`Integrity error: Record count mismatch (expected ${totalExpected} records, but payload contained ${totalActual}).`);
      }

      setBackupLogs(prev => [...prev, "Backup Completed Successfully"]);

      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      const filePrefix = getLocalSandboxMode() ? "animayx_sandbox" : "animayx_cloud";
      link.download = `${filePrefix}_full_database_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("Full database backup exported & downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      setBackupLogs(prev => [...prev, `❌ Integrity Validation Error: ${err.message || err}`]);
      alert(`Download Backup failure: ${err.message || err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.json')) {
        alert("Please pick a valid '.json' database backup file.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setRestoreLogs([]);
    }
  };

  const normalizeCollection = (val: any): any[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val;
    }
    if (typeof val === 'object') {
      return Object.entries(val).map(([key, item]: [string, any]) => {
        if (item && typeof item === 'object') {
          return { id: item.id || key, ...item };
        }
        return null;
      }).filter(Boolean) as any[];
    }
    return [];
  };

  const extractCollection = (json: any, possibleKeys: string[]): any[] => {
    if (!json || typeof json !== 'object') return [];
    for (const k of Object.keys(json)) {
      if (possibleKeys.includes(k.toLowerCase())) {
        return normalizeCollection(json[k]);
      }
    }
    const namespaces = ["entities", "collections", "data", "db", "records"];
    for (const ns of namespaces) {
      if (json[ns] && typeof json[ns] === 'object') {
        for (const k of Object.keys(json[ns])) {
          if (possibleKeys.includes(k.toLowerCase())) {
            return normalizeCollection(json[ns][k]);
          }
        }
      }
    }
    return [];
  };

  const handleRestoreBackup = async () => {
    if (!selectedFile) return;
    
    const isSandbox = getLocalSandboxMode();
    const dbLabel = isSandbox ? "LOCAL OFFLINE SANDBOX CACHE" : "LIVE CLOUD FIREBASE DATABASE";

    const confirmMsg = restoreMode === 'replace' 
      ? `⚠️ WARNING: You have selected SCRUB AND REPLACE mode targeting the ${dbLabel}.\n\nThis will COMPLETELY ERASE all existing records (Anime, Seasons, Episodes, Watchlist, watch History, comments, etc.) in the active database before importing.\n\nAre you absolutely sure you want to proceed?`
      : `Are you sure you want to restore and merge the backup file into the active ${dbLabel}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreLogs(["Reading local database backup file...", "Parsing JSON structures..."]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        let json: any;
        try {
          json = JSON.parse(fileContent);
        } catch (err: any) {
          throw new Error(`Failed to parse JSON file: ${err.message}`);
        }

        const schemaVer = json.schemaVersion || "1.0.0";
        setRestoreLogs(prev => [...prev, `Verified backup schema version: ${schemaVer}`]);

        const collectionsToRestore = [
          { key: 'anime', label: 'Anime Catalog', possibleKeys: ['anime', 'animes', 'animelist', 'anime_list'] },
          { key: 'seasons', label: 'Seasons', possibleKeys: ['seasons', 'season', 'seasonslist', 'season_list'] },
          { key: 'episodes', label: 'Episodes', possibleKeys: ['episodes', 'episode', 'episodeslist', 'episode_list'] },
          { key: 'videoUrlMap', label: 'Video Stream Mapping', possibleKeys: ['videourlmap', 'videourlmaps', 'video_url_map', 'video_url_maps', 'videomap', 'videomaps', 'video_map', 'video_maps'] },
          { key: 'news', label: 'News Releases', possibleKeys: ['news', 'newslist', 'news_articles', 'newsarticles'] },
          { key: 'schedule', label: 'Weekly Release Calendar', possibleKeys: ['schedule', 'schedules', 'schedulelist', 'releaseschedule'] },
          { key: 'users', label: 'User Profiles', possibleKeys: ['users', 'userlist', 'user_profiles', 'profiles'] },
          { key: 'users_backup', label: 'User Backups', possibleKeys: ['users_backup', 'userbackups', 'users_backups', 'usersbackup'] },
          { key: 'watchHistory', label: 'Watch History', possibleKeys: ['watchhistory', 'watch_history', 'history'] },
          { key: 'watchlist', label: 'Watchlist / Bookmarks', possibleKeys: ['watchlist', 'watchlists', 'bookmarks'] },
          { key: 'reviews', label: 'Reviews', possibleKeys: ['reviews', 'reviewlist'] },
          { key: 'comments', label: 'Comments', possibleKeys: ['comments', 'commentlist'] },
          { key: 'adminInvites', label: 'Admin Invites', possibleKeys: ['admininvites', 'admin_invites'] },
          { key: 'adminLogs', label: 'Admin Logs', possibleKeys: ['adminlogs', 'admin_logs'] },
          { key: 'favorites', label: 'Favorites', possibleKeys: ['favorites'] },
          { key: 'favoriteEpisodes', label: 'Favorite Episodes', possibleKeys: ['favoriteepisodes', 'favorite_episodes'] },
          { key: 'notifications', label: 'Notifications', possibleKeys: ['notifications'] },
          { key: 'banners', label: 'Banners', possibleKeys: ['banners'] },
          { key: 'settings', label: 'Settings', possibleKeys: ['settings', 'setting'] },
          { key: 'aniskipCache', label: 'AniSkip Cache', possibleKeys: ['aniskipcache', 'aniskip_cache'] },
          { key: 'aniskip', label: 'AniSkip data', possibleKeys: ['aniskip', 'aniskipdata', 'aniskip_data'] },
          { key: 'analytics', label: 'Analytics', possibleKeys: ['analytics'] },
          { key: 'thumbnails', label: 'Thumbnails metadata', possibleKeys: ['thumbnails', 'thumbnail_metadata', 'thumbnails_metadata'] }
        ];

        const parsedCollections: { [col: string]: any[] } = {};
        let totalItemsFound = 0;

        if (Array.isArray(json)) {
          if (json.length > 0) {
            const first = json[0];
            if (first && typeof first === 'object') {
              let targetCol = 'anime';
              if ('seasonId' in first || 'number' in first) {
                targetCol = 'episodes';
              } else if ('animeId' in first || 'order' in first) {
                targetCol = 'seasons';
              } else if ('title' in first || 'rating' in first || 'genres' in first) {
                targetCol = 'anime';
              } else if ('key' in first && 'url' in first) {
                targetCol = 'videoUrlMap';
              } else if ('uid' in first && 'email' in first) {
                targetCol = 'users';
              }
              parsedCollections[targetCol] = json;
              totalItemsFound = json.length;
            }
          }
        } else if (json && typeof json === 'object') {
          collectionsToRestore.forEach(col => {
            const list = extractCollection(json, col.possibleKeys);
            if (list && list.length > 0) {
              parsedCollections[col.key] = list;
              totalItemsFound += list.length;
            }
          });
        }

        if (totalItemsFound === 0) {
          throw new Error("No recognizeable collections found in this backup file. Ensure it contains anime, seasons, episodes, watchlist, comments, etc.");
        }

        setRestoreLogs(prev => [
          ...prev, 
          `Backup file successfully parsed. Detected ${totalItemsFound} total records:`, 
          ...collectionsToRestore
            .filter(col => parsedCollections[col.key]?.length > 0)
            .map(col => ` - ${parsedCollections[col.key].length} ${col.label} records`)
        ]);

        if (restoreMode === 'replace') {
          setRestoreLogs(prev => [...prev, `[Scrub Mode] Purging active collections: ${Object.keys(parsedCollections).join(', ')}...`]);
          
          const purgePromises = Object.keys(parsedCollections).map(async (colName) => {
            const snap = await getDocs(collection(db, colName));
            if (snap.size > 0) {
              setRestoreLogs(prev => [...prev, ` -> Deleting ${snap.size} entries from ${colName}...`]);
              const CHUNK_SIZE = 400;
              const allRefs = snap.docs.map(d => d.ref);
              const colPurgePromises = [];
              for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
                const chunk = allRefs.slice(i, i + CHUNK_SIZE);
                const clearBatch = writeBatch(db);
                chunk.forEach(ref => clearBatch.delete(ref));
                colPurgePromises.push(clearBatch.commit());
              }
              await Promise.all(colPurgePromises);
            }
          });
          await Promise.all(purgePromises);
          setRestoreLogs(prev => [...prev, "Purge of existing target collections completed."]);
        }

        const restoreCollectionChunked = async (colName: string, items: any[]) => {
          if (!items || items.length === 0) return { restoredCount: 0, skippedCount: 0 };
          
          let existingIds = new Set<string>();
          if (restoreMode === 'merge') {
            try {
              const snap = await getDocs(collection(db, colName));
              snap.forEach(d => existingIds.add(d.id));
            } catch (err) {
              console.warn(`Could not fetch existing IDs for ${colName} to deduplicate:`, err);
            }
          }

          const CHUNK_SIZE = 400;
          let skippedCount = 0;
          let restoredCount = 0;
          const batchPromises = [];

          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            let chunkHasWrite = false;

            chunk.forEach(item => {
              const data = { ...item };
              const itemId = item.id || item.key || item.uid || `item_${Math.random().toString(36).substring(2, 11)}`;
              data.id = itemId;

              if (restoreMode === 'merge' && existingIds.has(itemId)) {
                skippedCount++;
                return;
              }

              // Normalize timestamp or date fields
              const dateFields = ['createdAt', 'updatedAt', 'timestamp', 'watchedAt', 'expiresAt', 'date'];
              dateFields.forEach(field => {
                if (data[field] !== undefined && data[field] !== null) {
                  if (typeof data[field] === 'string') {
                    const parsedDate = new Date(data[field]);
                    if (!isNaN(parsedDate.getTime())) {
                      data[field] = parsedDate;
                    }
                  } else if (typeof data[field] === 'object') {
                    if (data[field].seconds !== undefined) {
                      data[field] = new Date(data[field].seconds * 1000);
                    } else if (data[field]._seconds !== undefined) {
                      data[field] = new Date(data[field]._seconds * 1000);
                    }
                  }
                }
              });
              
              if (!data.createdAt) {
                data.createdAt = new Date();
              }
              
              const itemRef = doc(db, colName, itemId);
              batch.set(itemRef, data);
              chunkHasWrite = true;
              restoredCount++;
            });

            if (chunkHasWrite) {
              batchPromises.push(batch.commit());
            }
          }

          if (batchPromises.length > 0) {
            await Promise.all(batchPromises);
          }

          return { restoredCount, skippedCount };
        };

        const activeLogs: string[] = [];

        // Restore all collections in parallel for maximum speed
        const activeCollectionsToRestore = collectionsToRestore.filter(col => {
          const items = parsedCollections[col.key];
          return items && items.length > 0;
        });

        await Promise.all(activeCollectionsToRestore.map(async (col) => {
          const items = parsedCollections[col.key];
          setRestoreLogs(prev => [...prev, `Importing ${items.length} records into ${col.label}...`]);
          const resStats = await restoreCollectionChunked(col.key, items);
          
          if (col.key === 'anime') {
            activeLogs.push(`Anime Restored (${resStats.restoredCount} written, ${resStats.skippedCount} skipped duplicates)`);
          } else if (col.key === 'episodes') {
            activeLogs.push(`Episodes Restored (${resStats.restoredCount} written, ${resStats.skippedCount} skipped duplicates)`);
          } else if (col.key === 'users') {
            activeLogs.push(`Users Restored (${resStats.restoredCount} written, ${resStats.skippedCount} skipped duplicates)`);
          } else if (col.key === 'aniskipCache' || col.key === 'aniskip') {
            activeLogs.push(`AniSkip Cache Restored (${resStats.restoredCount} written, ${resStats.skippedCount} skipped duplicates)`);
          } else if (col.key === 'settings') {
            activeLogs.push(`Settings Restored (${resStats.restoredCount} written, ${resStats.skippedCount} skipped duplicates)`);
          }
        }));

        setRestoreLogs(prev => [...prev, "Syncing system states with UI views..."]);
        await refreshData();
        
        // Output specific expected logs
        setRestoreLogs(prev => [
          ...prev, 
          ...activeLogs,
          "Completed Successfully"
        ]);
        setSelectedFile(null);
        alert(`Full Backup Restored successfully to ${dbLabel}! Catalog data, user accounts, lists, watch histories, comments, and configurations are active.`);
      } catch (err: any) {
        console.error(err);
        setRestoreLogs(prev => [...prev, `❌ ERROR: ${err.message || err}`]);
        alert(`Restore processing failed: ${err.message || err}`);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(selectedFile);
  };

  return (
    <div className="space-y-8 text-left animate-fade-in pb-16">
      {/* Header Panel info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center mb-1">
            <Database className="w-6 h-6 text-orange-500 mr-2.5 stroke-[2.5]" />
            <span>STUDIO BACKUP & CATALOG RESTORE</span>
          </h2>
          <p className="text-xs text-zinc-400 font-medium">
            Acquire full snapshots of your curated anime, seasons, episodes, and fallback streams, and reinstate backups locally.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Download backup */}
        <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="bg-orange-500/5 px-3 py-2 rounded-lg border border-orange-500/10 inline-flex items-center space-x-2 text-xs font-mono font-bold text-orange-400">
              <Download className="w-3.5 h-3.5" />
              <span>Full System Database Exporter</span>
            </div>
            
            <h3 className="text-lg font-black text-white">Download Full Backup</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Export all system collections—anime catalog metadata, customized season groups, episode streaming sources, news alerts, scheduler lists, user profiles, watchlists, watch history, reviews, and comments—into a single offline-safe database snapshot (`.json`).
            </p>

            <ul className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 font-medium font-mono pt-2">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> Curated Catalog Metadata</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> Seasons link hierarchy</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> Episode streaming URLs</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> Registered User Profiles</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> User Watch History</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> User Lists & Bookmarks</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> User Reviews & Comments</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span> System Logs & Invites</span>
              </li>
            </ul>
          </div>

          <div className="pt-8">
            <button
              onClick={handleDownloadBackup}
              disabled={isDownloading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 font-black text-black px-6 py-3.5 rounded-xl text-xs active:scale-95 transition-all text-center uppercase tracking-widest font-mono flex items-center justify-center space-x-2.5 cursor-pointer shadow-lg shadow-orange-500/5"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-black border-zinc-700"></div>
                  <span>COMPILING BACKUP SNAPSHOT...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>DOWNLOAD FULL BACKUP (.JSON)</span>
                </>
              )}
            </button>
          </div>

          {/* Realtime progress log trail for backup */}
          {backupLogs.length > 0 && (
            <div className="mt-5 bg-black/60 border border-zinc-900 rounded-xl p-4 space-y-1.5 text-[10px] font-mono leading-relaxed h-32 overflow-y-auto custom-scrollbar text-zinc-400 text-left">
              {backupLogs.map((log, index) => {
                let colorClass = 'text-zinc-300';
                if (log.startsWith('❌')) {
                  colorClass = 'text-red-400 font-bold';
                } else if (log === 'Backup Completed Successfully' || log === 'Validating' || log === 'Backup Started' || log === 'Exporting Data') {
                  colorClass = 'text-green-400 font-bold';
                } else if (log.startsWith(' -')) {
                  colorClass = 'text-teal-400';
                }
                return (
                  <div key={index} className={colorClass}>
                    {log}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 2: Upload backup */}
        <div className="glass-panel p-6 rounded-2xl border border-purple-950/15 bg-zinc-950/40 relative">
          <div className="space-y-4">
            <div className="bg-purple-950/40 px-3 py-2 rounded-lg border border-purple-900/30 inline-flex items-center space-x-2 text-xs font-mono font-bold text-purple-300">
              <Upload className="w-3.5 h-3.5" />
              <span>Full Catalog Restoration</span>
            </div>

            <h3 className="text-lg font-black text-white">Restore Database Backup</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload an existing `.json` backup file collected previously. This will load all relationships and metadata back into Firestore instantly.
            </p>

            <div className="grid grid-cols-2 gap-4 pb-1">
              <label 
                className={`border rounded-xl p-3 flex items-start space-x-2.5 cursor-pointer transition-all ${
                  restoreMode === 'merge' 
                    ? 'border-orange-500/50 bg-orange-500/5 text-white' 
                    : 'border-zinc-850 hover:border-zinc-805 text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-0.5 accent-orange-500 cursor-pointer"
                />
                <div className="text-left">
                  <span className="text-xs font-bold block mb-0.5">Append & Merge</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">Merge items with the current list, safely skipping matches.</p>
                </div>
              </label>

              <label 
                className={`border rounded-xl p-3 flex items-start space-x-2.5 cursor-pointer transition-all ${
                  restoreMode === 'replace' 
                    ? 'border-red-500/40 bg-red-500/5 text-white' 
                    : 'border-zinc-850 hover:border-zinc-850 text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-0.5 accent-red-500 cursor-pointer"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-red-400 block mb-0.5">Scrub & Replace</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">Purge/zero all collections first, producing a clean blueprint match.</p>
                </div>
              </label>
            </div>

            {/* Custom file pick field */}
            <div className="border border-dashed border-zinc-800 hover:border-orange-500/40 bg-zinc-900/10 h-32 rounded-xl flex flex-col items-center justify-center relative cursor-pointer text-center p-4 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={isRestoring}
              />
              <Upload className="w-7 h-7 text-orange-500 mb-1.5 animate-pulse" />
              <p className="text-xs font-bold text-zinc-200">
                {selectedFile ? `Active Backup: ${selectedFile.name}` : 'Click or Drag folder backup `.json` file here'}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                {selectedFile ? `Size: ${(selectedFile.size / 1024).toFixed(1)} KB` : 'Only supports valid JSON structure outputs'}
              </p>
            </div>
          </div>

          {selectedFile && (
            <div className="mt-4 pt-2">
              <button
                onClick={handleRestoreBackup}
                disabled={isRestoring}
                className="w-full bg-zinc-100 hover:bg-white disabled:bg-zinc-850 disabled:text-zinc-500 font-extrabold text-black px-5 py-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-mono flex items-center justify-center space-x-2"
              >
                {isRestoring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-black border-zinc-500"></div>
                    <span>REINSTATING DATA BLUEPRINTS...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>RESTORE BACKUP FILE NOW</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Realtime progress log trail */}
          {restoreLogs.length > 0 && (
            <div className="mt-5 bg-black/60 border border-zinc-900 rounded-xl p-4 space-y-1.5 text-[10px] font-mono leading-relaxed h-32 overflow-y-auto custom-scrollbar text-zinc-400">
              {restoreLogs.map((log, index) => (
                <div key={index} className={log.startsWith('❌') ? 'text-red-400 font-bold' : log.startsWith('✔') ? 'text-green-400 font-bold' : log.startsWith(' -') ? 'text-teal-400' : ''}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION: USER BACKUP REGISTRY */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-805 bg-zinc-950/20 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
          <div>
            <div className="bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/10 inline-flex items-center space-x-2 text-xs font-mono font-bold text-red-400">
              <Users className="w-3.5 h-3.5" />
              <span>User Backups & Security Registry</span>
            </div>
            <h3 className="text-lg font-black text-white mt-1">Automatic Registration Backups</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
              Registered users or login profiles are mirrored in structural offline-safe duplicates. Search catalog index by e-mail or restore accidentally deleted accounts back instantly.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchUserBackups}
            disabled={isLoadingBackups}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-black text-zinc-355 flex items-center space-x-2 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
            <span>Refresh Backups</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center bg-zinc-950/80 border border-zinc-855 px-4 py-2.5 rounded-xl max-w-md">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5" />
          <input
            type="text"
            placeholder="Search backed up users by email..."
            value={userSearchEmail}
            onChange={(e) => setUserSearchEmail(e.target.value)}
            className="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none w-full placeholder-zinc-650"
          />
          {userSearchEmail && (
            <button type="button" onClick={() => setUserSearchEmail('')} className="p-0.5 text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Users backup list Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-450 border-b border-zinc-900 font-mono font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-12">Profile</th>
                <th className="p-4">Display Name</th>
                <th className="p-4">E-mail Address</th>
                <th className="p-4">Backup Created At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60 bg-zinc-950/10 font-semibold">
              {userBackups
                .filter(backup => 
                  (backup.email || '').toLowerCase().includes(userSearchEmail.toLowerCase()) ||
                  (backup.displayName || '').toLowerCase().includes(userSearchEmail.toLowerCase())
                )
                .map((backup) => {
                  const bDate = backup.createdAt?.toDate ? backup.createdAt.toDate() : (backup.createdAt ? new Date(backup.createdAt) : null);
                  
                  return (
                    <tr key={backup.id} className="hover:bg-zinc-900/10 transition-colors">
                      <td className="p-4">
                        {backup.photoURL ? (
                          <img src={backup.photoURL} alt="" className="w-7 h-7 rounded-full border border-zinc-800 bg-black" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black flex items-center justify-center uppercase text-[10px]">
                            {backup.displayName?.[0] || backup.email?.[0]}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-extrabold text-zinc-100">{backup.displayName || 'Unverified User'}</td>
                      <td className="p-4 font-mono text-zinc-450">{backup.email || 'no-email@ani-mayx.net'}</td>
                      <td className="p-4 text-zinc-500 font-mono">
                        {bDate ? bDate.toLocaleDateString() + ' ' + bDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRestoreUser(backup)}
                          className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-black font-black rounded-lg text-[11px] active:scale-95 transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5 ml-auto font-mono"
                        >
                          <RefreshCw className="w-3 h-3 text-black stroke-[3]" />
                          <span>Restore Account</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {userBackups.filter(backup => 
                (backup.email || '').toLowerCase().includes(userSearchEmail.toLowerCase()) ||
                (backup.displayName || '').toLowerCase().includes(userSearchEmail.toLowerCase())
              ).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-500 font-bold">
                    {userSearchEmail ? 'No matching backups found under this email search prefix.' : 'No user backups synced under the security module yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
