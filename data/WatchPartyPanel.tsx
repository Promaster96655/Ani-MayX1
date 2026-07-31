import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, User, LogOut, ShieldAlert, Send, Copy, Check, MessageSquare, Flame, Trophy, Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WatchPartyRoom, WatchPartyMessage, WatchPartyMember } from '../types';

interface WatchPartyPanelProps {
  room: WatchPartyRoom | null;
  error: string;
  status: 'idle' | 'connecting' | 'connected' | 'lobby' | 'error';
  userId: string;
  userDisplayName: string;
  onCreateRoom: (username: string) => void;
  onJoinRoom: (code: string, username: string) => void;
  onLeaveRoom: () => void;
  onSendMessage: (text: string) => void;
}

export default function WatchPartyPanel({
  room,
  error,
  status,
  userId,
  userDisplayName,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSendMessage
}: WatchPartyPanelProps) {
  const [username, setUsername] = useState(userDisplayName || 'Anime Fan');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isHost = room ? room.hostId === userId : false;

  // Sync username input with user displayName when it changes
  useEffect(() => {
    if (userDisplayName) {
      setUsername(userDisplayName);
    }
  }, [userDisplayName]);

  // Scroll to bottom of chat when room messages update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room?.messages]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(username.trim() || 'Anonymous');
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    onJoinRoom(roomCodeInput.trim().toUpperCase(), username.trim() || 'Anonymous');
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleEmojiSelect = (emoji: string) => {
    setChatInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const copyInviteLink = () => {
    if (!room) return;
    const inviteUrl = `${window.location.origin}/?party=${room.code}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const emojis = ['😊', '😂', '😍', '😮', '😡', '🔥', '🎉', '👀', '👍', '❤️', '😱', '🍿'];

  return (
    <div className="flex flex-col h-full bg-[#0a0712] border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl" id="watch-party-panel">
      {/* HEADER SECTION */}
      <div className="bg-[#120d24] border-b border-zinc-850 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-left">
          <div className="relative">
            <Users className="w-5 h-5 text-orange-400" />
            {room && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
            )}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono">Watch Party Lobby</h3>
            <p className="text-[9px] text-zinc-400 font-mono">
              {room ? `ACTIVE ROOM: ${room.code}` : 'SYNCED PLAYBACK WITH FRIENDS'}
            </p>
          </div>
        </div>
        {room && (
          <button
            onClick={onLeaveRoom}
            title="Leave Watch Room"
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-[10px] font-black uppercase font-mono"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        )}
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 p-3 flex items-center space-x-2 text-red-400 text-xs font-semibold text-left">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* LOBBY STATE (NOT IN A ROOM) */}
      {!room && (
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
          {/* Username Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400 font-mono block">
              1. Choose Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter party display name..."
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-orange-500/50 rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold text-white outline-none transition-all"
              />
            </div>
          </div>

          <div className="border-t border-zinc-900/80 my-5"></div>

          {/* Create Room Block */}
          <div className="space-y-3.5">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">Create a New Party</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                Start a private watch room and invite your friends. You will control playback!
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={status === 'connecting'}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black text-xs py-3 rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider cursor-pointer shadow-lg shadow-orange-500/15"
            >
              {status === 'connecting' ? 'Establishing Room...' : 'Create Watch Party Room'}
            </button>
          </div>

          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-x-0 h-px bg-zinc-900"></div>
            <span className="relative bg-[#0a0712] px-3 text-[10px] uppercase font-black text-zinc-500 font-mono">OR JOIN</span>
          </div>

          {/* Join Room Block */}
          <form onSubmit={handleJoin} className="space-y-3.5">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">Join Active Party</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                Enter an invitation code to sync into an active session.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE (E.G. AZ3B9)"
                className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-center text-xs font-black tracking-widest text-white outline-none transition-all uppercase placeholder:tracking-normal placeholder:font-bold"
              />
              <button
                type="submit"
                disabled={!roomCodeInput.trim() || status === 'connecting'}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-white font-extrabold text-xs px-5 rounded-xl transition-colors uppercase cursor-pointer border border-zinc-700/50 select-none"
              >
                Join
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ACTIVE ROOM VIEW (MEMBERS LIST & CHAT ROOM) */}
      {room && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* ROOM DETAILS, CODE COPIER & STATS */}
          <div className="bg-[#100b21]/70 border-b border-zinc-900 p-3.5 flex flex-col gap-3">
            {/* Copy controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyRoomCode}
                className="flex-1 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 rounded-xl p-2 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="min-w-0">
                  <span className="text-[8px] text-zinc-500 block font-mono">ROOM CODE</span>
                  <span className="text-xs font-black tracking-widest text-orange-400 block font-mono uppercase">{room.code}</span>
                </div>
                {copiedCode ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                )}
              </button>

              <button
                onClick={copyInviteLink}
                className="flex-1 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 rounded-xl p-2 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="min-w-0">
                  <span className="text-[8px] text-zinc-500 block font-mono">INVITE LINK</span>
                  <span className="text-[11px] font-bold text-white truncate block font-mono">{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                </div>
                {copiedLink ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                )}
              </button>
            </div>

            {/* Members Section (Mini drawer / list) */}
            <div className="space-y-1.5 text-left">
              <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 font-mono block">
                MEMBERS ({room.members.length})
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto pr-1 no-scrollbar">
                {room.members.map((member: WatchPartyMember) => (
                  <div
                    key={member.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold border ${
                      member.isHost
                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${member.isHost ? 'bg-orange-500' : 'bg-green-500 animate-pulse'}`}></span>
                    <span className="truncate max-w-[80px]">{member.name}</span>
                    {member.id === userId && <span className="text-[7.5px] text-zinc-500 lowercase">(you)</span>}
                    {member.isHost && <span className="text-[8px] text-orange-500 font-bold uppercase tracking-wider font-mono">★ Host</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CHAT MESSAGES LOG */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth no-scrollbar">
            {room.messages.map((msg: WatchPartyMessage) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-1">
                    <span className="bg-zinc-950/80 border border-zinc-900 text-zinc-400 text-[9px] font-bold py-1 px-3 rounded-full text-center tracking-wide max-w-[90%] leading-relaxed">
                      📢 {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.senderId === userId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] text-left ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9.5px] font-black text-zinc-400 font-mono">
                      {isMe ? 'You' : msg.sender}
                    </span>
                    <span className="text-[8.5px] text-zinc-500 font-mono">{msg.timestamp}</span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-2xl text-[11.5px] font-medium leading-relaxed font-sans ${
                      isMe
                        ? 'bg-orange-500 text-black rounded-tr-none font-semibold'
                        : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-850'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* CHAT INPUT AREA */}
          <div className="p-3 bg-[#110d24] border-t border-zinc-900 relative">
            {/* Quick Emoji selection overlay */}
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute bottom-16 inset-x-3 bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl shadow-2xl flex flex-wrap gap-2 z-50 justify-center"
                >
                  {emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-lg hover:scale-125 transition-transform p-1 rounded-lg hover:bg-zinc-900 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSend} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={150}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message..."
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-orange-500/40 rounded-xl pl-3 pr-10 py-2.5 text-xs font-semibold text-white outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-900 disabled:text-zinc-600 text-black font-black p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/10"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
