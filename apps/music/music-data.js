/* ========================================================
 *  柚月小手机 (Yuzuki's Little Phone)
 *  作者 (Author): yuzuki
 *
 * ⚠️ 版权声明 (Copyright Notice):
 * 1. 禁止商业化：本项目仅供交流学习，严禁任何形式的倒卖、盈利等商业行为。
 * 2. 禁止二改发布：严禁未经授权修改代码后作为独立项目二次发布或分发。
 * 3. 禁止抄袭：严禁盗用本项目的核心逻辑、UI设计与相关原代码。
 *
 * Copyright (c) yuzuki. All rights reserved.
 * ======================================================== */
// ========================================
// 🎵 音乐APP - 数据层（播放引擎 + 曲库）
// ----------------------------------------
// global_music_*  跨会话共享（喜欢、歌单、笔记、登录态…）
// music_*         当前聊天专属（TA 推荐的歌、音乐状态卡片、悬浮窗开关）
// ========================================

import { MusicApi } from './music-api.js';

export const PLAY_MODES = [
    { id: 'loop', label: '列表循环' },
    { id: 'order', label: '顺序播放' },
    { id: 'shuffle', label: '随机播放' },
    { id: 'single', label: '单曲循环' }
];

const KEYS = {
    liked: 'global_music_liked',
    legacyFavorites: 'global_music_favorites',
    playlists: 'global_music_playlists',
    collected: 'global_music_collected',
    history: 'global_music_history',
    notes: 'global_music_notes',
    profile: 'global_music_profile',
    ncm: 'global_music_ncm',
    mode: 'global_music_play_mode',
    volume: 'global_music_volume',
    listenSeconds: 'global_music_listen_seconds',
    searchHistory: 'global_music_search_history',
    recentLists: 'global_music_recent_lists',
    queue: 'global_music_queue',
    covers: 'global_music_covers',
    // 当前聊天专属
    recs: 'music_playlist',
    card: 'music_card_data',
    autoPlay: 'music_auto_play'
};

const cleanText = (value = '') => String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/｜/g, '|')
    .replace(/\s+/g, ' ')
    .trim();

const stripWrappers = (value = '') => {
    let text = cleanText(value)
        .replace(/^\s*(?:-|--|—|–)?\s*by\s+/i, '')
        .replace(/\s*(?:-|--|—|–)?\s*by\s*$/i, '')
        .trim();
    const pairs = [['【', '】'], ['《', '》'], ['〈', '〉'], ['「', '」'], ['『', '』'], ['[', ']'], ['(', ')'], ['（', '）'], ['"', '"'], ["'", "'"]];
    let changed = true;
    while (changed && text.length > 1) {
        changed = false;
        for (const [l, r] of pairs) {
            if (text.startsWith(l) && text.endsWith(r)) {
                text = text.slice(l.length, -r.length).trim();
                changed = true;
            }
        }
    }
    return text;
};


// ---------- 播放打断侦测 ----------
// iPhone 上同一页面里别的 <audio> 一开始播放，正在播的就会被系统暂停。
// 这里记录“谁在什么时候播放/暂停了声音”，被打断时能指出是哪个插件。
function stackSource() {
    const lines = String(new Error().stack || '').split('\n').slice(3, 10);
    const hit = lines.find(l => /\.js/.test(l) && !/music-data\.js/.test(l)) || '';
    const m = hit.match(/\/([^/\s()]+\/[^/\s():]+\.js)/);
    return m ? m[1] : hit.trim().slice(0, 80);
}

export function installMediaWatch() {
    if (typeof window === 'undefined' || typeof HTMLMediaElement === 'undefined') return null;
    if (window.__yzMediaWatch) return window.__yzMediaWatch;
    const log = [];
    const push = (item) => { log.push(item); if (log.length > 40) log.shift(); };
    const proto = HTMLMediaElement.prototype;
    const origPlay = proto.play;
    const origPause = proto.pause;
    proto.play = function (...args) {
        try {
            if (!this.__yzOwn) push({ type: 'play', at: Date.now(), from: stackSource(), src: String(this.currentSrc || this.src || '').slice(0, 90), muted: !!this.muted });
        } catch (_e) { /* ignore */ }
        return origPlay.apply(this, args);
    };
    proto.pause = function (...args) {
        try {
            if (this.__yzOwn && !this.__yzSelfPause) push({ type: 'pause-ours', at: Date.now(), from: stackSource() });
        } catch (_e) { /* ignore */ }
        return origPause.apply(this, args);
    };
    window.__yzMediaWatch = {
        log,
        recent(ms = 3000) {
            const now = Date.now();
            return log.filter(item => now - item.at <= ms);
        }
    };
    return window.__yzMediaWatch;
}

const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export class MusicData {
    constructor(storage) {
        this.storage = storage;
        this.api = new MusicApi(() => this.getNcmConfig());

        this._watch = installMediaWatch();
        this.audioPlayer = new Audio();
        this.audioPlayer.__yzOwn = true;
        this.audioPlayer.preload = 'auto';
        this.lastInterruption = null;
        this._interrupts = [];
        this.syncVolume();

        this.queue = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isLoading = false;
        this.lastError = '';
        this.currentLyrics = [];
        this.onStateChange = null;
        this.onPlaybackStopped = null;
        this.onTimeUpdate = null;
        this.onToast = null;

        this._gen = 0;
        this._userPaused = false;
        this._shuffleBag = [];
        this._shuffleHistory = [];
        this._consecutiveFailures = 0;
        this._lastTime = 0;
        this._pendingListen = 0;
        this._cache = {};
        this._cardData = null;

        this._restoreQueue();
        this._bindAudio();
    }

    // ================= 存储工具 =================

    _read(key, fallback) {
        if (Object.prototype.hasOwnProperty.call(this._cache, key)) return this._cache[key];
        let value = this.storage?.get?.(key, null);
        if (typeof value === 'string' && value) {
            try { value = JSON.parse(value); } catch (_e) { /* 保留原字符串 */ }
        }
        if (value === null || value === undefined || value === '') value = fallback;
        this._cache[key] = value;
        return value;
    }

    _write(key, value) {
        this._cache[key] = value;
        this.storage?.set?.(key, JSON.stringify(value));
    }

    _isChatKey(key) {
        return /^music_/.test(key);
    }

    // ================= 歌曲工具 =================

    normalizeSong(raw = {}) {
        const song = {
            id: raw.id ? String(raw.id) : '',
            name: stripWrappers(raw.name || raw.songName || ''),
            artist: stripWrappers(raw.artist || '') || '未知歌手',
            album: cleanText(raw.album || ''),
            pic: String(raw.pic || raw.cover || '').trim(),
            duration: Number(raw.duration || 0) || 0
        };
        if (raw.localUrl) {
            song.localUrl = raw.localUrl;
            song.local = true;
        }
        return song;
    }

    songKey(song) {
        if (!song) return '';
        if (song.id) return `id:${song.id}`;
        const norm = (v) => stripWrappers(v).toLowerCase().replace(/[\s【】《》〈〉「」『』[\]（）()"'“”‘’]/g, '');
        return `n:${norm(song.name)}|${norm(song.artist)}`;
    }

    sameSong(a, b) {
        if (!a || !b) return false;
        if (a.id && b.id) return String(a.id) === String(b.id);
        const ka = this.songKey({ name: a.name, artist: a.artist });
        const kb = this.songKey({ name: b.name, artist: b.artist });
        return ka === kb;
    }

    _storable(song) {
        const { localUrl, ...rest } = this.normalizeSong(song);
        return rest;
    }

    // ================= 网易云配置 =================

    getNcmConfig() {
        const cfg = this._read(KEYS.ncm, {}) || {};
        return typeof cfg === 'object' ? cfg : {};
    }

    setNcmConfig(patch = {}) {
        const next = { ...this.getNcmConfig(), ...patch };
        this._write(KEYS.ncm, next);
        this._notify();
        return next;
    }

    isLoggedIn() {
        return this.api.isLoggedIn() && !!this.getNcmConfig().profile;
    }

    async refreshAccount() {
        if (!this.api.isLoggedIn()) return null;
        const profile = await this.api.loginStatus();
        if (!profile) {
            this.setNcmConfig({ cookie: '', profile: null, stats: null, cloudPlaylists: [] });
            return null;
        }
        let stats = null;
        let cloudPlaylists = [];
        let likeIds = [];
        try { stats = await this.api.userDetail(profile.userId); } catch (_e) { /* 可选 */ }
        try { cloudPlaylists = await this.api.userPlaylists(profile.userId); } catch (_e) { /* 可选 */ }
        try {
            const json = await this.api.ncm('/likelist', { uid: profile.userId });
            likeIds = (json?.ids || []).map(String);
        } catch (_e) { /* 可选 */ }
        this.setNcmConfig({ profile, stats, cloudPlaylists, likeIds, syncedAt: Date.now() });
        return profile;
    }

    async logout() {
        await this.api.logout();
        this.setNcmConfig({ cookie: '', profile: null, stats: null, cloudPlaylists: [], likeIds: [] });
    }

    // ================= 资料 =================

    getProfile() {
        const saved = this._read(KEYS.profile, {}) || {};
        return typeof saved === 'object' ? saved : {};
    }

    setProfile(patch = {}) {
        this._write(KEYS.profile, { ...this.getProfile(), ...patch });
        this._notify();
    }

    getListenHours() {
        const seconds = Number(this._read(KEYS.listenSeconds, 0)) || 0;
        return Math.floor((seconds + this._pendingListen) / 3600);
    }

    // ================= 喜欢 =================

    getLiked() {
        let liked = this._read(KEYS.liked, null);
        if (!Array.isArray(liked)) {
            // 迁移旧版收藏
            const legacy = this._read(KEYS.legacyFavorites, []);
            liked = Array.isArray(legacy) ? legacy.map(s => this._storable(s)).filter(s => s.name).reverse() : [];
            this._write(KEYS.liked, liked);
        }
        return liked;
    }

    isLiked(song) {
        if (!song) return false;
        const ids = this.getNcmConfig().likeIds;
        if (song.id && Array.isArray(ids) && ids.includes(String(song.id))) return true;
        return this.getLiked().some(s => this.sameSong(s, song));
    }

    toggleLike(song) {
        if (!song?.name) return false;
        const liked = this.getLiked().slice();
        const index = liked.findIndex(s => this.sameSong(s, song));
        const nextLiked = index < 0;
        if (index >= 0) liked.splice(index, 1);
        else liked.unshift(this._storable(song));
        this._write(KEYS.liked, liked);

        if (song.id && this.api.isLoggedIn()) {
            const cfg = this.getNcmConfig();
            const ids = new Set((cfg.likeIds || []).map(String));
            if (nextLiked) ids.add(String(song.id)); else ids.delete(String(song.id));
            this.setNcmConfig({ likeIds: [...ids] });
            this.api.likeSong(song.id, nextLiked);
        }
        this._notify();
        return nextLiked;
    }

    // 旧接口兼容（微信一起听会读取）
    getFavorites() {
        return this.getLiked();
    }

    // ================= 自建歌单 =================

    getUserPlaylists() {
        const list = this._read(KEYS.playlists, []);
        return Array.isArray(list) ? list : [];
    }

    getUserPlaylist(id) {
        return this.getUserPlaylists().find(p => p.id === id) || null;
    }

    createPlaylist(name) {
        const title = cleanText(name).slice(0, 40);
        if (!title) return null;
        const list = this.getUserPlaylists().slice();
        const playlist = { id: uid('pl'), name: title, songs: [], createdAt: Date.now() };
        list.unshift(playlist);
        this._write(KEYS.playlists, list);
        this._notify();
        return playlist;
    }

    renamePlaylist(id, name) {
        const title = cleanText(name).slice(0, 40);
        if (!title) return;
        const list = this.getUserPlaylists().map(p => (p.id === id ? { ...p, name: title } : p));
        this._write(KEYS.playlists, list);
        this._notify();
    }

    deletePlaylist(id) {
        this._write(KEYS.playlists, this.getUserPlaylists().filter(p => p.id !== id));
        this._notify();
    }

    addToPlaylist(id, song) {
        let added = false;
        const list = this.getUserPlaylists().map(p => {
            if (p.id !== id) return p;
            if ((p.songs || []).some(s => this.sameSong(s, song))) return p;
            added = true;
            return { ...p, songs: [this._storable(song), ...(p.songs || [])] };
        });
        this._write(KEYS.playlists, list);
        this._notify();
        return added;
    }

    removeFromPlaylist(id, song) {
        const list = this.getUserPlaylists().map(p => (
            p.id === id ? { ...p, songs: (p.songs || []).filter(s => !this.sameSong(s, song)) } : p
        ));
        this._write(KEYS.playlists, list);
        this._notify();
    }

    // ================= 自定义歌单封面 =================

    getCover(key) {
        const map = this._read(KEYS.covers, {}) || {};
        return typeof map === 'object' ? String(map[key] || '') : '';
    }

    setCover(key, url) {
        const map = { ...(this._read(KEYS.covers, {}) || {}) };
        if (url) map[key] = String(url);
        else delete map[key];
        this._write(KEYS.covers, map);
        this._notify();
    }

    // ================= 收藏的网易云歌单 =================

    getCollected() {
        const list = this._read(KEYS.collected, []);
        return Array.isArray(list) ? list : [];
    }

    isCollected(id) {
        return this.getCollected().some(p => String(p.id) === String(id));
    }

    toggleCollect(info) {
        if (!info?.id) return false;
        const list = this.getCollected().slice();
        const index = list.findIndex(p => String(p.id) === String(info.id));
        if (index >= 0) {
            list.splice(index, 1);
            this.api.subscribePlaylist(info.id, false);
        } else {
            list.unshift({
                id: String(info.id), name: info.name || '歌单', cover: info.cover || '',
                count: info.count || 0, creator: info.creator || '', collectedAt: Date.now()
            });
            this.api.subscribePlaylist(info.id, true);
        }
        this._write(KEYS.collected, list);
        this._notify();
        return index < 0;
    }

    touchRecentList(ref) {
        if (!ref?.key) return;
        const list = (this._read(KEYS.recentLists, []) || []).filter(item => item.key !== ref.key);
        list.unshift({ ...ref, at: Date.now() });
        this._write(KEYS.recentLists, list.slice(0, 12));
    }

    getRecentLists() {
        const list = this._read(KEYS.recentLists, []);
        return Array.isArray(list) ? list : [];
    }

    // ================= 历史 / 搜索记录 =================

    getHistory() {
        const list = this._read(KEYS.history, []);
        return Array.isArray(list) ? list : [];
    }

    _addHistory(song) {
        if (!song?.name || song.local) return;
        const list = this.getHistory().filter(s => !this.sameSong(s, song));
        list.unshift({ ...this._storable(song), playedAt: Date.now() });
        this._write(KEYS.history, list.slice(0, 100));
    }

    clearHistory() {
        this._write(KEYS.history, []);
        this._notify();
    }

    getSearchHistory() {
        const list = this._read(KEYS.searchHistory, []);
        return Array.isArray(list) ? list : [];
    }

    addSearchHistory(word) {
        const value = cleanText(word);
        if (!value) return;
        const list = this.getSearchHistory().filter(item => item !== value);
        list.unshift(value);
        this._write(KEYS.searchHistory, list.slice(0, 12));
    }

    clearSearchHistory() {
        this._write(KEYS.searchHistory, []);
    }

    // ================= 笔记（歌词摘录） =================

    getNotes() {
        const list = this._read(KEYS.notes, []);
        return Array.isArray(list) ? list : [];
    }

    addNote({ song, lines = [], note = '', position = 0 }) {
        if (!song?.name) return null;
        const item = {
            id: uid('note'),
            song: this._storable(song),
            lines: lines.map(line => ({ txt: cleanText(line.txt), tr: cleanText(line.tr || ''), t: Number(line.t) || 0 })).filter(l => l.txt).slice(0, 12),
            note: String(note || '').trim().slice(0, 500),
            position: Number(position) || 0,
            createdAt: Date.now()
        };
        const list = this.getNotes().slice();
        list.unshift(item);
        this._write(KEYS.notes, list.slice(0, 300));
        this._notify();
        return item;
    }

    deleteNote(id) {
        this._write(KEYS.notes, this.getNotes().filter(n => n.id !== id));
        this._notify();
    }

    // ================= TA 的推荐（当前聊天专属，兼容旧接口） =================

    getPlaylist() {
        const list = this._read(KEYS.recs, []);
        return Array.isArray(list) ? list : [];
    }

    savePlaylist() {
        this._write(KEYS.recs, this.getPlaylist());
    }

    clearPlaylist() {
        this._write(KEYS.recs, []);
        this._notify();
    }

    /** AI 推荐歌曲入列（index.js 调用）。返回是否为新歌 */
    addSong(name, artist, meta = {}) {
        const song = this.normalizeSong({ ...meta, name, artist });
        if (!song.name) return false;
        const list = this.getPlaylist().slice();
        if (list.some(s => this.sameSong(s, song))) return false;
        list.push(song);
        this._write(KEYS.recs, list.slice(-60));

        const floating = this.storage?.get?.('music_show_floating', false);
        if (!this.isPlaying && !this.isLoading && this.getAutoPlay() && floating && !this._userPaused) {
            this.playSong(song, { auto: true });
        } else {
            this._notify();
        }
        return true;
    }

    getAutoPlay() {
        const val = this.storage?.get?.(KEYS.autoPlay, true);
        return val === true || val === 'true';
    }

    setAutoPlay(enabled) {
        this.storage?.set?.(KEYS.autoPlay, !!enabled);
    }

    // ================= 音乐状态卡片（AI <Music> 标签） =================

    setCardData(parsed) {
        this._cardData = parsed || null;
        this.storage?.set?.(KEYS.card, parsed ? JSON.stringify(parsed) : '');
    }

    getCardData() {
        if (this._cardData) return this._cardData;
        const saved = this.storage?.get?.(KEYS.card, '');
        if (saved) {
            try { this._cardData = typeof saved === 'string' ? JSON.parse(saved) : saved; } catch (_e) { this._cardData = null; }
        }
        return this._cardData;
    }

    // ================= 播放队列 =================

    getCurrentSong() {
        return this.currentIndex >= 0 ? this.queue[this.currentIndex] || null : null;
    }

    getQueue() {
        return this.queue;
    }

    _saveQueue() {
        clearTimeout(this._queueSaveTimer);
        this._queueSaveTimer = setTimeout(() => {
            this._write(KEYS.queue, {
                songs: this.queue.filter(s => !s.local).slice(0, 500).map(s => this._storable(s)),
                index: this.currentIndex
            });
        }, 400);
    }

    _restoreQueue() {
        const saved = this._read(KEYS.queue, null);
        if (saved && Array.isArray(saved.songs)) {
            this.queue = saved.songs.map(s => this.normalizeSong(s)).filter(s => s.name);
            this.currentIndex = Math.min(Number(saved.index ?? -1), this.queue.length - 1);
        }
    }

    /** 用一组歌替换队列并播放 */
    playList(songs = [], startIndex = 0, { shuffle = false } = {}) {
        const list = songs.map(s => this.normalizeSong(s)).filter(s => s.name);
        if (!list.length) return false;
        this.queue = list;
        this._shuffleBag = [];
        this._shuffleHistory = [];
        let index = Math.max(0, Math.min(startIndex, list.length - 1));
        if (shuffle) {
            this.setPlayMode('shuffle');
            index = Math.floor(Math.random() * list.length);
        }
        this._saveQueue();
        this.playAt(index);
        return true;
    }

    /** 播放单曲：已在队列则跳转，否则插到当前歌后面 */
    playSong(raw, { auto = false } = {}) {
        const song = this.normalizeSong(raw);
        if (!song.name) return Promise.resolve(false);
        let index = this.queue.findIndex(s => this.sameSong(s, song));
        if (index < 0) {
            index = this.currentIndex >= 0 ? this.currentIndex + 1 : this.queue.length;
            this.queue.splice(index, 0, song);
            this._saveQueue();
        }
        return this.playAt(index, { auto });
    }

    playNext(raw) {
        const song = this.normalizeSong(raw);
        if (!song.name) return;
        const existing = this.queue.findIndex(s => this.sameSong(s, song));
        if (existing >= 0 && existing !== this.currentIndex) {
            this.queue.splice(existing, 1);
            if (existing < this.currentIndex) this.currentIndex--;
        } else if (existing === this.currentIndex) {
            return;
        }
        this.queue.splice(this.currentIndex + 1, 0, song);
        this._shuffleBag = [];
        this._saveQueue();
        this._notify();
    }

    removeFromQueue(index) {
        if (index < 0 || index >= this.queue.length) return;
        const wasCurrent = index === this.currentIndex;
        this.queue.splice(index, 1);
        this._shuffleBag = [];
        if (index < this.currentIndex) this.currentIndex--;
        if (wasCurrent) {
            if (this.queue.length === 0) {
                this.stop('clear');
                this.currentIndex = -1;
            } else {
                this.playAt(Math.min(index, this.queue.length - 1));
            }
        }
        this._saveQueue();
        this._notify();
    }

    clearQueue() {
        this.stop('clear_playlist');
        this.queue = [];
        this.currentIndex = -1;
        this._shuffleBag = [];
        this._saveQueue();
        this._notify();
    }

    // ================= 播放控制 =================

    async playAt(index, { auto = false } = {}) {
        if (index < 0 || index >= this.queue.length) return false;
        const gen = ++this._gen;
        const song = this.queue[index];
        this.currentIndex = index;
        this._userPaused = false;
        this.isLoading = true;
        this.isPlaying = false;
        this.lastError = '';
        this.currentLyrics = [];
        this._lastTime = 0;
        this._pauseAudio();
        this._saveQueue();
        this._notify();

        let chosen = null;
        let trialFallback = null;
        try {
            for await (const candidate of this.api.urlCandidates(song)) {
                if (gen !== this._gen) return false;
                if (candidate.trial) {
                    trialFallback = trialFallback || candidate;
                    continue;
                }
                const result = await this._probe(candidate.url, song, gen);
                if (gen !== this._gen) return false;
                if (result === 'ok') { chosen = candidate; break; }
                if (result === 'trial' && !trialFallback) trialFallback = candidate;
            }
            if (!chosen && trialFallback && gen === this._gen) {
                const result = await this._probe(trialFallback.url, song, gen, { acceptTrial: true });
                if (result === 'ok') {
                    chosen = trialFallback;
                    this._toast('这首歌只能试听片段');
                }
            }
        } catch (e) {
            console.warn('🎵 [音乐] 取链失败:', e);
        }

        if (gen !== this._gen) return false;

        if (!chosen) {
            this.isLoading = false;
            this.lastError = '暂时无法播放';
            this._consecutiveFailures++;
            this._notify();
            if (this._consecutiveFailures < Math.min(5, this.queue.length)) {
                this._toast(`《${song.name}》暂时无法播放，已跳过`);
                setTimeout(() => { if (gen === this._gen) this.next({ auto: true, skipFailed: true }); }, 600);
            } else {
                this._toast(`《${song.name}》暂时无法播放`);
                this._consecutiveFailures = 0;
            }
            return false;
        }

        try {
            this.audioPlayer.loop = this.getPlayMode() === 'single';
            await this.audioPlayer.play();
            if (gen !== this._gen) return false;
            this.isPlaying = true;
            this._consecutiveFailures = 0;
        } catch (e) {
            this.isPlaying = false;
            if (e?.name === 'NotAllowedError') {
                this.lastError = '点击播放按钮开始';
            }
        }
        this.isLoading = false;
        this._addHistory(song);
        this._saveQueue();
        this._notify();
        this._loadLyrics(song, gen);
        return true;
    }

    /** 加载链接并检查是否为 30 秒试听 */
    _probe(url, song, gen, { acceptTrial = false } = {}) {
        return new Promise(resolve => {
            const audio = this.audioPlayer;
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                audio.removeEventListener('loadedmetadata', onMeta);
                audio.removeEventListener('error', onError);
                resolve(value);
            };
            const onMeta = () => {
                if (gen !== this._gen) return finish('stale');
                const d = Number(audio.duration);
                const expected = Number(song.duration || 0);
                const looksTrial = Number.isFinite(d) && d > 0 && d <= 45 && (expected === 0 || expected > 60);
                if (looksTrial && !acceptTrial && !song.local) return finish('trial');
                if (!song.duration && Number.isFinite(d) && d > 0) song.duration = Math.round(d);
                finish('ok');
            };
            const onError = () => finish('error');
            const timer = setTimeout(() => finish('error'), 10000);
            audio.addEventListener('loadedmetadata', onMeta);
            audio.addEventListener('error', onError);
            audio.src = url;
            audio.load();
        });
    }

    async _loadLyrics(song, gen) {
        try {
            const lyrics = await this.api.getLyrics(song);
            if (gen !== this._gen) return;
            this.currentLyrics = Array.isArray(lyrics) ? lyrics : [];
            song.lrc = this.currentLyrics;
            this._notify();
        } catch (_e) {
            this.currentLyrics = [];
        }
    }

    togglePlay() {
        if (this.isLoading) return;
        if (this.isPlaying) this.pause();
        else this.resume();
    }

    pause() {
        if (typeof window !== 'undefined'
            && window._musicSuppressNavigationPauseUntil
            && Date.now() < window._musicSuppressNavigationPauseUntil) {
            this._notify();
            return;
        }
        const wasPlaying = this.isPlaying || !this.audioPlayer.paused;
        this._pauseAudio();
        this.isPlaying = false;
        this._userPaused = true;
        this._flushListen();
        this._notify();
        if (wasPlaying) this._notifyStopped('pause');
    }

    resume() {
        const song = this.getCurrentSong();
        if (!song) {
            if (this.queue.length) this.playAt(0);
            return;
        }
        if (!this.audioPlayer.src || this.audioPlayer.error || this.lastError) {
            this.playAt(this.currentIndex);
            return;
        }
        this.syncVolume();
        this.audioPlayer.loop = this.getPlayMode() === 'single';
        this.audioPlayer.play().then(() => {
            this.isPlaying = true;
            this._userPaused = false;
            this._notify();
        }).catch(() => this.playAt(this.currentIndex));
    }

    stop(reason = 'stop') {
        const wasPlaying = this.isPlaying || !this.audioPlayer.paused;
        this._gen++;
        this._pauseAudio();
        this.audioPlayer.removeAttribute('src');
        try { this.audioPlayer.load(); } catch (_e) { /* ignore */ }
        this.isPlaying = false;
        this.isLoading = false;
        this._flushListen();
        if (wasPlaying) this._notifyStopped(reason);
    }

    seek(seconds) {
        const d = Number(this.audioPlayer.duration);
        if (!Number.isFinite(d) || d <= 0) return;
        this.audioPlayer.currentTime = Math.max(0, Math.min(d - 0.2, Number(seconds) || 0));
        this._lastTime = this.audioPlayer.currentTime;
    }

    next({ auto = false, skipFailed = false } = {}) {
        const n = this.queue.length;
        if (!n) return;
        if (!skipFailed) this._consecutiveFailures = 0;
        const mode = this.getPlayMode();
        if (mode === 'shuffle' && n > 1) {
            this._shuffleHistory.push(this.currentIndex);
            this.playAt(this._nextShuffleIndex(), { auto });
            return;
        }
        let index = this.currentIndex + 1;
        if (index >= n) {
            if (mode === 'order' && auto) {
                this.isPlaying = false;
                this._notify();
                this._notifyStopped('ended');
                return;
            }
            index = 0;
        }
        this.playAt(index, { auto });
    }

    prev() {
        const n = this.queue.length;
        if (!n) return;
        this._consecutiveFailures = 0;
        if (this.audioPlayer.currentTime > 5 && this.isPlaying) {
            this.seek(0);
            return;
        }
        if (this.getPlayMode() === 'shuffle' && this._shuffleHistory.length) {
            const index = this._shuffleHistory.pop();
            if (index >= 0 && index < n) { this.playAt(index); return; }
        }
        this.playAt((this.currentIndex - 1 + n) % n);
    }

    _nextShuffleIndex() {
        const n = this.queue.length;
        if (!this._shuffleBag.length) {
            const bag = [];
            for (let i = 0; i < n; i++) if (i !== this.currentIndex) bag.push(i);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            this._shuffleBag = bag;
        }
        const index = this._shuffleBag.shift();
        return index === undefined ? 0 : Math.min(index, n - 1);
    }

    getPlayMode() {
        const mode = String(this._read(KEYS.mode, 'loop') || 'loop');
        return PLAY_MODES.some(m => m.id === mode) ? mode : 'loop';
    }

    setPlayMode(mode) {
        const next = PLAY_MODES.some(m => m.id === mode) ? mode : 'loop';
        this._write(KEYS.mode, next);
        this.audioPlayer.loop = next === 'single';
        this._shuffleBag = [];
        this._notify();
        return next;
    }

    cyclePlayMode() {
        const ids = PLAY_MODES.map(m => m.id);
        const next = ids[(ids.indexOf(this.getPlayMode()) + 1) % ids.length];
        return this.setPlayMode(next);
    }

    // 旧接口兼容
    getPlaybackMode() {
        const mode = this.getPlayMode();
        return mode === 'single' ? 'repeat-one' : (mode === 'order' ? 'once' : 'repeat-all');
    }

    getVolume() {
        const v = Number(this.storage?.get?.(KEYS.volume, 0.6));
        return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
    }

    setVolume(value) {
        const v = Math.min(1, Math.max(0, Number(value) || 0));
        this.storage?.set?.(KEYS.volume, v);
        this.audioPlayer.volume = v;
        return v;
    }

    syncVolume() {
        this.audioPlayer.volume = this.getVolume();
    }

    // ================= 微信接口兼容 =================

    /** 微信接受“一起听”邀请时调用 */
    async playSongByName(name, artist, meta = {}) {
        const song = this.normalizeSong({ ...meta, name, artist });
        if (!song.name) return null;
        if (!song.id) {
            const found = await this.api.resolveSongId(song.name, song.artist).catch(() => null);
            if (found) Object.assign(song, { ...found, pic: song.pic || found.pic });
        }
        await this.playSong(song);
        return this.getCurrentSong() || song;
    }

    getListeningSnapshot() {
        const song = this.getCurrentSong();
        if (!song) return null;
        const currentTime = Number.isFinite(this.audioPlayer.currentTime) ? this.audioPlayer.currentTime : 0;
        const duration = Number.isFinite(this.audioPlayer.duration) ? this.audioPlayer.duration : (song.duration || 0);
        const lyrics = this.currentLyrics || [];
        const index = this.getLyricIndex(currentTime);
        const line = index >= 0 ? lyrics[index] : null;
        const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        const lyricWindow = lyrics
            .filter(l => l.t >= currentTime + 40 && l.t <= currentTime + 80)
            .slice(0, 18)
            .map(l => (l.tr ? `${fmt(l.t)} ${l.txt}（${l.tr}）` : `${fmt(l.t)} ${l.txt}`));
        const list = (arr) => arr.map(s => (s.artist ? `${s.name} - ${s.artist}` : s.name)).filter(Boolean).slice(0, 40);

        return {
            songId: song.id || '',
            songName: song.name || '未知歌曲',
            artist: song.artist || '未知歌手',
            cover: song.pic || '',
            currentTime,
            duration,
            isPlaying: !!this.isPlaying,
            lyric: line ? line.txt : '',
            lyricTranslation: line ? (line.tr || '') : '',
            lyricAround: index >= 0 ? lyrics.slice(Math.max(0, index - 1), index + 2).map(l => l.txt) : [],
            lyricWindow,
            playlistSongs: list(this.queue),
            favoriteSongs: list(this.getLiked()),
            activeListType: 'queue'
        };
    }

    getLyricIndex(time = this.audioPlayer.currentTime) {
        const lyrics = this.currentLyrics || [];
        if (!lyrics.length) return -1;
        let lo = 0;
        let hi = lyrics.length - 1;
        let ans = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (lyrics[mid].t <= time + 0.15) { ans = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return ans;
    }

    // ================= 事件 =================

    _bindAudio() {
        const audio = this.audioPlayer;
        audio.addEventListener('ended', () => {
            if (this.getPlayMode() === 'single') {
                audio.currentTime = 0;
                audio.play().catch(() => {});
                return;
            }
            this.isPlaying = false;
            this.next({ auto: true });
        });
        audio.addEventListener('timeupdate', () => {
            const t = audio.currentTime;
            const delta = t - this._lastTime;
            if (this.isPlaying && delta > 0 && delta < 2) {
                this._pendingListen += delta;
                if (this._pendingListen > 20) this._flushListen();
            }
            this._lastTime = t;
            if (typeof this.onTimeUpdate === 'function') this.onTimeUpdate(t, audio.duration);
        });
        audio.addEventListener('pause', () => {
            if (this.isPlaying && !this.isLoading && audio.paused && !audio.ended) {
                this._handleInterruption();
            }
        });
        audio.addEventListener('play', () => {
            if (!this.isPlaying && !this.isLoading) {
                this.isPlaying = true;
                this._notify();
            }
        });
    }


    _pauseAudio() {
        const a = this.audioPlayer;
        a.__yzSelfPause = true;
        try { a.pause(); } finally { a.__yzSelfPause = false; }
    }

    /** 不是我们自己暂停的：先自动续播，连续被打断再停下并说明原因 */
    _handleInterruption() {
        const audio = this.audioPlayer;
        const now = Date.now();
        this._interrupts = this._interrupts.filter(t => now - t < 20000);
        this._interrupts.push(now);
        const recent = this._watch?.recent?.(2500) || [];
        const byPause = [...recent].reverse().find(x => x.type === 'pause-ours');
        const byPlay = [...recent].reverse().find(x => x.type === 'play');
        let who = '';
        if (byPause) who = `「${byPause.from || '未知脚本'}」暂停了音乐`;
        else if (byPlay) who = `「${byPlay.from || byPlay.src || '未知脚本'}」同时播放了声音${byPlay.muted ? '（静音）' : ''}`;
        this.lastInterruption = { at: now, who, recent: recent.map(x => ({ ...x })), song: this.getCurrentSong()?.name || '' };
        console.warn('🎵 [音乐] 播放被意外打断', who || '（未找到来源，可能是系统或其他标签页）', recent);

        if (this._interrupts.length <= 3) {
            setTimeout(() => {
                if (!this.isPlaying || !audio.paused || audio.ended) return;
                audio.play().catch(() => {
                    this.isPlaying = false;
                    this._notify();
                });
            }, 300);
            return;
        }
        this.isPlaying = false;
        this._interrupts = [];
        this._notify();
        this._notifyStopped('interrupted');
        this._toast(who ? `音乐被打断：${who}` : '音乐反复被打断，可能有别的插件在放声音（比如后台保活）');
    }

    getInterruptionReport() {
        return { last: this.lastInterruption, log: (this._watch?.log || []).slice(-15) };
    }

    _flushListen() {
        if (this._pendingListen <= 0) return;
        const total = (Number(this._read(KEYS.listenSeconds, 0)) || 0) + this._pendingListen;
        this._pendingListen = 0;
        this._write(KEYS.listenSeconds, Math.round(total));
    }

    _notify() {
        if (typeof this.onStateChange === 'function') this.onStateChange();
    }

    _notifyStopped(reason = '') {
        if (typeof this.onPlaybackStopped === 'function') this.onPlaybackStopped(reason);
    }

    _toast(message) {
        if (typeof this.onToast === 'function') this.onToast(message);
    }

    /** 切换酒馆聊天：停播 + 丢掉当前聊天专属缓存 */
    clearCache() {
        this.stop('clear');
        this._cardData = null;
        Object.keys(this._cache).forEach(key => {
            if (this._isChatKey(key)) delete this._cache[key];
        });
        this._userPaused = false;
        this._consecutiveFailures = 0;
    }
}
