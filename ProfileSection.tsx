import React, { useState, useEffect } from 'react';
import { 
  User, 
  Clock, 
  Heart, 
  Settings, 
  Trash2, 
  Tv, 
  UserCheck, 
  Check, 
  LogOut, 
  Play,
  Grid
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth, collection, query, where, getDocs, doc, deleteDoc, updateDoc, syncUserBackup } from '../firebase';
import { UserProfile, WatchHistory, Anime, Favorite } from '../types';
import LazyImage from './LazyImage';

interface ProfileSectionProps {
  userProfile: UserProfile;
  allAnime: Anime[];
  favorites: string[]; // animeIds
  onAnimeClick: (animeId: string) => void;
  onPlayEpisode: (animeId: string, episodeId: string) => void;
  onToggleFavorite: (animeId: string) => void;
  onLogout: () => void;
  refreshUserProfile: () => Promise<void>;
}

export default function ProfileSection({
  userProfile,
  allAnime,
  favorites,
  onAnimeClick,
  onPlayEpisode,
  onToggleFavorite,
  onLogout,
  refreshUserProfile
}: ProfileSectionProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'favorites' | 'watchlist' | 'notifications' | 'settings'>('history');
  
  // Watch history list state
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Watchlist & notifications states
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Profile management edit states
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Push notifications preferences state
  const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (isNotificationSupported) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported) {
      alert("System Notifications are not supported in your browser or device container.");
      return;
    }

    if (Notification.permission === 'denied') {
      alert("Notification permission has been denied in your browser settings. Please reset the permission in your browser address bar to enable notifications.");
      return;
    }

    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          alert("Notifications successfully enabled! You will now receive system updates.");
        } else {
          setNotificationsEnabled(false);
          alert("Notification permission was denied. The website will continue loading normally.");
        }
      } else if (Notification.permission === 'granted') {
        // Toggle visual setting preference
        setNotificationsEnabled(prev => !prev);
        alert(!notificationsEnabled ? "Notifications successfully enabled!" : "Notifications successfully muted.");
      }
    } catch (err) {
      console.error("Error toggling notifications:", err);
      alert("Notification error handled. Loaded website normally.");
    }
  };

  // Built-in cool avatars seed list
  const sampleAvatars = [
    'Sasuke', 'Naruto', 'Goku', 'Mikasa', 'Zoro', 'Luffy', 'Tanjiro', 'Frieren'
  ].map(seed => `https://api.dicebear.com/7.x/pixel-art/svg?seed=${seed}`);

  // Load watchlist items
  const loadWatchlistItems = async () => {
    try {
      const q = query(collection(db, 'watchlist'), where('userId', '==', userProfile.uid));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setWatchlist(list);
    } catch (e) {
      console.error("Error loading watchlist:", e);
    }
  };

  const loadNotifications = async () => {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userProfile.uid));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setNotifications(list);
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  };

  const handleRemoveFromWatchlist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'watchlist', id));
      loadWatchlistItems();
    } catch (err) {
      console.error("Error deleting from watchlist:", err);
    }
  };

  // Fetch watch history sequence
  const loadWatchHistory = async () => {
    try {
      setHistoryLoading(true);
      const historyQuery = query(
        collection(db, 'watchHistory'),
        where('userId', '==', userProfile.uid)
      );
      const historySnap = await getDocs(historyQuery);
      const historyList: WatchHistory[] = [];
      historySnap.forEach(d => {
        historyList.push({ id: d.id, ...d.data() } as WatchHistory);
      });

      // Sort history by date updated descending
      historyList.sort((a, b) => {
        const dateA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime();
        const dateB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });

      setWatchHistory(historyList);
    } catch (err) {
      console.error("Failed loading user watch history progress details:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadWatchHistory();
    loadWatchlistItems();
    loadNotifications();
  }, [userProfile.uid, activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;

    try {
      setIsSavingProfile(true);
      setProfileMessage('');
      
      // Update Firestore user document
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName,
        photoURL
      });

      await refreshUserProfile();
      try {
        await syncUserBackup(userProfile.uid);
      } catch (backupErr) {
        console.warn("Non-blocking backup sync issue:", backupErr);
      }
      setProfileMessage('Account updated successfully!');
      setTimeout(() => setProfileMessage(''), 4000);
    } catch (err) {
      console.error("Failed updating user account details:", err);
      setProfileMessage('Error updating profile metadata.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Clear single watch history item
  const handleClearHistoryItem = async (e: React.MouseEvent, historyId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'watchHistory', historyId));
      setWatchHistory(prev => prev.filter(x => x.id !== historyId));
    } catch (err) {
      console.error("Purging single history record failed:", err);
    }
  };

  // Clear entire watch history
  const handleClearAllHistory = async () => {
    if (!confirm("Are you sure you want to clear your entire watch history progress? This cannot be undone.")) return;
    try {
      for (const item of watchHistory) {
        await deleteDoc(doc(db, 'watchHistory', item.id));
      }
      setWatchHistory([]);
    } catch (err) {
      console.error("Failed purging complete history:", err);
    }
  };

  // Map favorite series objects
  const favoriteSeries = allAnime.filter(a => favorites.includes(a.id));

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 text-zinc-100 text-left">
      
      {/* Top Banner Profile overview header */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-purple-950/30 flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left relative overflow-hidden">
        
        {/* Soft background glow circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none" />

        <img
          src={userProfile.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userProfile.email}`}
          alt={userProfile.displayName}
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-orange-500/80 shadow-neon-orange object-cover bg-black"
        />

        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-4xl font-black text-white">{userProfile.displayName || 'Unverified User'}</h1>
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full self-center sm:self-start ${
              userProfile.role === 'admin' 
                ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-neon-orange' 
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              {userProfile.role === 'admin' ? '🛡️ SYSTEM ADMIN' : '⭐ OTALIST MEMBER'}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-400">{userProfile.email}</p>
          <p className="text-xs font-semibold text-zinc-500 font-mono">ACCOUNT CLOUD ID: {userProfile.uid}</p>
        </div>

        {/* Exit Logout */}
        <button
          onClick={onLogout}
          className="bg-red-950/60 hover:bg-red-900/80 text-red-400 font-bold px-5 py-3 rounded-xl border border-red-900/30 hover:border-red-600 flex items-center space-x-2 transition-all active:scale-95 text-sm cursor-pointer self-stretch sm:self-center"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>SIGN OUT</span>
        </button>
      </div>

      {/* Tabs navigation row */}
      <div className="flex border-b border-zinc-900 mb-8 overflow-x-auto select-none font-sans">
        {[
          { tab: 'history', label: 'CONTINUE WATCHER', Icon: Clock },
          { tab: 'favorites', label: 'MY ANIME COLLECTION', Icon: Heart },
          { tab: 'watchlist', label: 'BOOKMARKS WATCHLIST', Icon: Grid },
          { tab: 'notifications', label: 'EPISODE ALERTS', Icon: Tv },
          { tab: 'settings', label: 'PROFILE PREFERENCES', Icon: Settings },
        ].map(({ tab, label, Icon }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center space-x-2.5 py-4 px-6 border-b-2 text-sm font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab 
                ? 'border-orange-500 text-orange-400 font-black bg-gradient-to-t from-orange-500/5 to-transparent' 
                : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Primary Panels screens */}
      <div>
        
        {/* PANEL: HISTORY TRACK */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span>CONTINUE WATCHING ({watchHistory.length})</span>
              </h2>
              {watchHistory.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/60 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  CLEAR ALL HISTORY
                </button>
              )}
            </div>

            {historyLoading ? (
              <div className="text-center py-12 text-zinc-500 font-bold">Querying watch progress catalog...</div>
            ) : watchHistory.length === 0 ? (
              <div className="glass-panel p-12 text-center text-zinc-500 rounded-xl">
                <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
                <p className="font-semibold text-sm">Your watch history is empty.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Pick an anime from the home list to launch playback!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchHistory.map((history) => {
                  const percent = Math.floor((history.progress / (history.duration || 1)) * 100);

                  return (
                    <div
                      key={history.id}
                      onClick={() => onPlayEpisode(history.animeId, history.episodeId)}
                      className="glass-panel rounded-xl overflow-hidden hover:border-purple-600 transition-all cursor-pointer flex flex-col group border border-purple-950/20 hover:scale-[1.01]"
                    >
                      {/* Thumbnail wrapper */}
                      <div className="relative aspect-video w-full background-zinc-900">
                        <LazyImage
                          src={history.animeThumbnail}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        {/* Hover Play Button banner overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-orange-500 text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Progress slider absolute bar */}
                        <div className="absolute bottom-0 inset-x-0 bg-zinc-800 h-1.5 overflow-hidden">
                          <div 
                            className="bg-orange-500 h-full shadow-neon-orange" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between text-left">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">
                            S{history.seasonNumber} • EPISODE {history.episodeNumber}
                          </p>
                          <h3 className="font-extrabold text-white text-base truncate mt-1 group-hover:text-orange-400 transition-colors">
                            {history.animeTitle}
                          </h3>
                          <p className="text-zinc-400 text-xs truncate mt-0.5 font-semibold">
                            {history.episodeTitle}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-900 mt-3 pt-3">
                          <span className="text-[10px] font-bold text-zinc-500 font-mono">
                            {percent}% COMPLETED
                          </span>
                          <button
                            onClick={(e) => handleClearHistoryItem(e, history.id)}
                            className="p-1 hover:bg-zinc-800 text-zinc-600 hover:text-red-400 rounded transition-colors cursor-pointer"
                            title="Clear progress node"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PANEL: FAVORITE COLLECTION */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
              <Heart className="w-5 h-5 text-orange-500" />
              <span>MY BOOKMARKED ANIME COLLECTION ({favoriteSeries.length})</span>
            </h2>

            {favoriteSeries.length === 0 ? (
              <div className="glass-panel p-12 text-center text-zinc-500 rounded-xl border border-purple-950/20">
                <Heart className="w-10 h-10 text-zinc-650 mx-auto mb-2.5" />
                <p className="font-semibold text-sm">Your collections list is currently clean.</p>
                <p className="text-[11px] text-zinc-650 mt-1">Bookmark high quality shows and trailers on their details pages to save them here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {favoriteSeries.map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => onAnimeClick(anime.id)}
                    className="glass-panel rounded-xl overflow-hidden hover:border-purple-600 transition-all cursor-pointer flex flex-col group relative"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                      <LazyImage
                        src={anime.thumbnailUrl}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      {/* Delete Quick Star link */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(anime.id); }}
                        className="absolute top-2.5 right-2.5 p-2 bg-black/75 backdrop-blur-md rounded-full text-orange-400 hover:text-zinc-300 border border-orange-500/20 transition-all cursor-pointer z-10"
                        title="Remove Favorite"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 text-left">
                      <p className="text-[9px] uppercase font-bold text-zinc-500">{anime.releaseYear} • {anime.status}</p>
                      <h4 className="font-extrabold text-sm text-zinc-100 truncate mt-0.5 group-hover:text-orange-400 transition-colors">
                        {anime.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL: PREFERENCES EDIT */}
        {activeTab === 'settings' && (
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-purple-950/30 max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-white border-b border-zinc-900 pb-3 mb-6 flex items-center space-x-2">
              <Settings className="w-5 h-5 text-orange-500" />
              <span>EDIT PROFILE INFOS</span>
            </h2>

            <form onSubmit={handleUpdateProfile} className="space-y-5 text-sm font-semibold">
              
              {/* Display name field */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">DISPLAY CHAT NAME</label>
                <input
                  type="text"
                  required
                  placeholder="Insert username..."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-zinc-100 font-semibold outline-none transition-colors"
                />
              </div>

              {/* Display logo picture field */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">CUSTOM PROFILE AVATAR</label>
                
                {/* Visual fast selection choices */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900">
                  {sampleAvatars.map((url, idx) => {
                    const isSelected = photoURL === url;
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setPhotoURL(url)}
                        className={`aspect-square rounded-full overflow-hidden border-2 transition-all cursor-pointer relative hover:scale-105 active:scale-95 bg-black ${
                          isSelected ? 'border-orange-500 shadow-neon-orange scale-105' : 'border-zinc-800 hover:border-purple-600'
                        }`}
                      >
                        <LazyImage src={url} alt="" className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                            <Check className="w-4 h-4 text-orange-500" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">...OR DIRECT WEB IMAGE URL</p>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... custom JPG/PNG url link"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-purple-800 focus:border-orange-500 rounded-lg p-2.5 text-xs text-zinc-350 font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Push Notifications Configuration */}
              <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Push Notifications</h4>
                    <p className="text-[10px] text-zinc-500 mt-1">Receive system broadcast updates and episode release alerts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleNotifications}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notificationsEnabled ? 'bg-orange-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {profileMessage && (
                <div className={`p-3 rounded-lg text-xs font-bold ${
                  profileMessage.includes('successfully') ? 'bg-green-950/40 border border-green-500/30 text-green-400' : 'bg-red-950/35 text-red-400'
                }`}>
                  {profileMessage}
                </div>
              )}

              {/* Form submit */}
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold tracking-wider py-3 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
              >
                {isSavingProfile ? (
                  <span>COMMITTING EDITS...</span>
                ) : (
                  <>
                    <UserCheck className="w-4.5 h-4.5" />
                    <span>SAVE PROFILE SETTINGS</span>
                  </>
                )}
              </button>
            </form>


          </div>
        )}

        {/* PANEL: WATCHLIST */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
              <Grid className="w-5 h-5 text-orange-500" />
              <span>MY BOOKMARKS WATCHLIST ({watchlist.length})</span>
            </h2>
            
            {watchlist.length === 0 ? (
              <div className="glass-panel p-16 text-center text-zinc-500 rounded-2xl border border-zinc-900">
                You have not bookmarked any anime series. Select 'Add to Watchlist' on any anime details page to bookmark it!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {watchlist.map((item) => {
                  const anime = allAnime.find(a => a.id === item.animeId);
                  if (!anime) return null;
                  return (
                    <div 
                      key={item.id} 
                      className="group bg-zinc-950/80 border border-zinc-900 rounded-xl overflow-hidden cursor-pointer hover:border-orange-500/70 transition-all duration-300 relative"
                      onClick={() => onAnimeClick(anime.id)}
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img src={anime.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                        <button
                          onClick={(e) => handleRemoveFromWatchlist(item.id, e)}
                          className="absolute top-2 right-2 p-2 bg-black/80 hover:bg-red-600 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-white font-black truncate">{anime.title}</p>
                        <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase flex items-center justify-between">
                          <span>{anime.type}</span>
                          <span className="text-orange-400">★ {anime.rating || 'N/A'}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PANEL: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
              <Tv className="w-5 h-5 text-orange-500" />
              <span>EPISODE ANNOUNCEMENTS ALERTS ({notifications.length})</span>
            </h2>
            
            {notifications.length === 0 ? (
              <div className="glass-panel p-16 text-center text-zinc-500 rounded-2xl border border-zinc-900">
                You do not have any new broadcast notifications. Keep an eye out for newly added episodes!
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    className="p-4 bg-zinc-950/65 border border-zinc-900/80 rounded-xl flex items-start gap-4 hover:border-orange-500/30 transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                    <div className="space-y-1 flex-grow">
                      <p className="text-white text-sm font-extrabold">{notif.title}</p>
                      <p className="text-zinc-450 text-xs font-semibold leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
