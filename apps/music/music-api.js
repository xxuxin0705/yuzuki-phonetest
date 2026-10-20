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
// 🎵 音乐APP - 音源 / 网易云接口层
// ----------------------------------------
// 两种模式：
//  1) 游客模式：vkeys 搜索 + Meting 取链/歌词/歌单，无需任何配置
//  2) 网易云模式：用户自行部署的 NeteaseCloudMusicApi（兼容服务）
//     支持扫码登录、我的歌单、喜欢、每日推荐、歌单搜索
// ========================================

const VKEYS = 'https://api.vkeys.cn/v2/music/netease';
const METING = 'https://api.qijieya.cn/meting/';
const EXTERNAL_SOURCE_URL = 'https://drive.baibai.cv/f/ZKEBuW/Music.js';
const EXTERNAL_SOURCE_ID = 'st-phone-baibai-music-source';

// 网易云官方榜单（ID 长期稳定）
export const MUSIC_TOPLISTS = [
    { id: '19723756', name: '飙升榜', tint: '#4fb3a9' },
    { id: '3779629', name: '新歌榜', tint: '#6c8fd8' },
    { id: '3778678', name: '热歌榜', tint: '#e0605e' },
    { id: '2884035', name: '原创榜', tint: '#c07ad6' }
];

// 语种 / 风格关键词扩展：直接搜“日语”只会搜到歌名带“日语”的歌，
// 这里把它展开成一批代表歌手，保证搜出来的确实是日语歌。
const KEYWORD_EXPANSIONS = [
    {
        match: /^(日语|日文|日系|日本|j-?pop|日语歌|日文歌)$/i,
        label: '日语', cat: '日语',
        seeds: ['米津玄師', 'YOASOBI', 'ヨルシカ', 'Aimer', 'RADWIMPS', 'Official髭男dism', 'King Gnu', 'あいみょん', '藤井風', '宇多田ヒカル', 'Mrs. GREEN APPLE', 'back number', 'LiSA', 'Ado', '優里', '中島美嘉']
    },
    {
        match: /^(韩语|韩文|韩国|k-?pop|韩语歌)$/i,
        label: '韩语', cat: '韩语',
        seeds: ['IU', 'BTS', 'BLACKPINK', 'NewJeans', 'NCT 127', 'TWICE', 'BIGBANG', 'aespa', 'IVE', 'SEVENTEEN', 'EXO', 'Red Velvet', '太妍', 'LE SSERAFIM']
    },
    {
        match: /^(英语|英文|欧美|英文歌|英语歌)$/i,
        label: '英语', cat: '欧美',
        seeds: ['Taylor Swift', 'Ed Sheeran', 'Billie Eilish', 'Bruno Mars', 'Adele', 'The Weeknd', 'Ariana Grande', 'Lana Del Rey', 'Justin Bieber', 'Coldplay', 'Rihanna', 'Keri Hilson', 'Dua Lipa', 'Maroon 5']
    },
    {
        match: /^(粤语|广东话|粤语歌)$/i,
        label: '粤语', cat: '粤语',
        seeds: ['陈奕迅 粤语', '张学友', 'Beyond', '王菲 粤语', '张国荣', '梅艳芳', '容祖儿', '杨千嬅', '谢安琪', '古巨基', '林子祥', '邓紫棋 粤语']
    },
    {
        match: /^(二次元|动漫|acg|动画|番剧)$/i,
        label: '二次元', cat: 'ACG',
        seeds: ['LiSA', 'Aimer', 'ClariS', 'supercell', 'EGOIST', 'ReoNa', '澤野弘之', 'fripSide', 'YOASOBI', 'Eve']
    },
    {
        match: /^(古风|国风)$/i,
        label: '古风', cat: '古风',
        seeds: ['银临', '河图', '双笙', '音频怪物', '等什么君', '司夏', '小魂', '古风']
    },
    {
        match: /^(说唱|rap|嘻哈|hiphop|hip-hop)$/i,
        label: '说唱', cat: '说唱',
        seeds: ['GAI', '法老', '马思唯', '艾热', 'Higher Brothers', 'Kendrick Lamar', 'Drake', 'Eminem', '说唱']
    }
];

export const MUSIC_HOT_KEYWORDS = ['日语', '韩语', '英语', '粤语', '二次元', '古风', '说唱', '小甜歌', '治愈', '伤感', 'NCT', '周杰伦'];

const cleanText = (value = '') => String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDurationText = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value > 10000 ? Math.round(value / 1000) : Math.round(value);
    const text = String(value);
    const mmss = text.match(/(\d+):(\d{1,2})/);
    if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
    const zh = text.match(/(?:(\d+)\s*分)?\s*(?:(\d+)\s*秒)?/);
    if (zh && (zh[1] || zh[2])) return Number(zh[1] || 0) * 60 + Number(zh[2] || 0);
    const num = Number(text);
    return Number.isFinite(num) ? (num > 10000 ? Math.round(num / 1000) : Math.round(num)) : 0;
};

const toHttps = (url = '') => String(url || '').replace(/^http:\/\//i, 'https://');

export function parseLrc(text = '') {
    const lines = [];
    const timeRegex = /\[(\d+):(\d+)(\.\d+)?\]/g;
    String(text || '').split(/\r?\n/).forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;
        const matches = [...line.matchAll(timeRegex)];
        if (matches.length === 0) return;
        const lyricText = line.replace(timeRegex, '').trim();
        if (!lyricText) return;
        matches.forEach(match => {
            const fraction = match[3] ? parseFloat(`0${match[3]}`) : 0;
            lines.push({ t: Number(match[1]) * 60 + Number(match[2]) + fraction, txt: lyricText });
        });
    });
    return lines.sort((a, b) => a.t - b.t);
}

function mergeLyrics(mainText, transText) {
    const main = parseLrc(mainText);
    if (main.length === 0) return [];
    const trans = transText ? parseLrc(transText) : [];
    return main.map(line => {
        const hit = trans.find(item => Math.abs(item.t - line.t) < 0.6);
        return { t: line.t, txt: line.txt, tr: hit && hit.txt !== line.txt ? hit.txt : '' };
    });
}

export class MusicApi {
    /**
     * @param {() => {apiBase?: string, cookie?: string, realIP?: boolean}} getConfig
     */
    constructor(getConfig) {
        this.getConfig = typeof getConfig === 'function' ? getConfig : () => ({});
        this._lyricCache = new Map();
        this._externalPromise = null;
    }

    // ================= 基础 =================

    get apiBase() {
        return String(this.getConfig()?.apiBase || '').trim().replace(/\/+$/, '');
    }

    hasNcm() {
        return !!this.apiBase;
    }

    isLoggedIn() {
        return this.hasNcm() && !!String(this.getConfig()?.cookie || '').trim();
    }

    async _fetch(url, { timeout = 9000, as = 'json' } = {}) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
        try {
            const res = await fetch(url, { signal: controller?.signal, credentials: 'omit' });
            if (as === 'text') return await res.text();
            return await res.json();
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /** 调用用户部署的 NeteaseCloudMusicApi */
    async ncm(path, params = {}, options = {}) {
        const base = this.apiBase;
        if (!base) throw new Error('未配置网易云 API 地址');
        const config = this.getConfig() || {};
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            query.set(key, String(value));
        });
        query.set('timestamp', String(Date.now()));
        const cookie = String(config.cookie || '').trim();
        if (cookie && options.withCookie !== false) query.set('cookie', cookie);
        if (config.realIP) query.set('realIP', '116.25.146.177');
        const url = `${base}${path.startsWith('/') ? path : `/${path}`}?${query.toString()}`;
        return this._fetch(url, { timeout: options.timeout || 12000 });
    }

    // ================= 归一化 =================

    normalizeNcmSong(raw = {}) {
        const artists = Array.isArray(raw.ar) ? raw.ar : (Array.isArray(raw.artists) ? raw.artists : []);
        const album = raw.al || raw.album || {};
        return {
            id: raw.id ? String(raw.id) : '',
            name: cleanText(raw.name),
            artist: cleanText(artists.map(a => a?.name).filter(Boolean).join(' / ')) || '未知歌手',
            album: cleanText(album.name || ''),
            pic: toHttps(album.picUrl || raw.picUrl || ''),
            duration: parseDurationText(raw.dt ?? raw.duration ?? 0),
            fee: Number(raw.fee || 0) || 0
        };
    }

    normalizeVkeysSong(raw = {}) {
        return {
            id: raw.id ? String(raw.id) : '',
            name: cleanText(raw.song || raw.name || raw.title || ''),
            artist: cleanText(raw.singer || raw.artist || raw.author || '') || '未知歌手',
            album: cleanText(raw.album || ''),
            pic: toHttps(raw.cover || raw.pic || raw.picUrl || ''),
            duration: parseDurationText(raw.interval || raw.duration || raw.time || 0),
            fee: 0
        };
    }

    normalizeMetingSong(raw = {}) {
        const idMatch = String(raw.url || raw.lrc || raw.pic || '').match(/[?&]id=(\d+)/);
        return {
            id: raw.id ? String(raw.id) : (idMatch ? idMatch[1] : ''),
            name: cleanText(raw.name || raw.title || ''),
            artist: cleanText(raw.artist || raw.author || '') || '未知歌手',
            album: '',
            pic: toHttps(raw.pic || raw.cover || ''),
            duration: 0,
            fee: 0
        };
    }

    normalizeNcmPlaylist(raw = {}) {
        return {
            id: raw.id ? String(raw.id) : '',
            name: cleanText(raw.name || '歌单'),
            cover: toHttps(raw.coverImgUrl || raw.picUrl || ''),
            count: Number(raw.trackCount || 0) || 0,
            playCount: Number(raw.playCount || 0) || 0,
            creator: cleanText(raw.creator?.nickname || ''),
            creatorId: raw.creator?.userId ? String(raw.creator.userId) : '',
            specialType: Number(raw.specialType || 0) || 0,
            subscribed: !!raw.subscribed,
            source: 'netease'
        };
    }

    // ================= 搜索 =================

    getExpansion(keyword = '') {
        const key = cleanText(keyword);
        return KEYWORD_EXPANSIONS.find(item => item.match.test(key)) || null;
    }

    async _vkeysSearch(word, page = 1, num = 20) {
        const json = await this._fetch(`${VKEYS}?word=${encodeURIComponent(word)}&page=${page}&num=${num}`);
        const items = Array.isArray(json?.data) ? json.data : [];
        return items.map(item => this.normalizeVkeysSong(item)).filter(song => song.name);
    }

    async _ncmSearchSongs(word, page = 1, limit = 30) {
        const json = await this.ncm('/cloudsearch', { keywords: word, type: 1, limit, offset: (page - 1) * limit });
        const songs = Array.isArray(json?.result?.songs) ? json.result.songs : [];
        return {
            songs: songs.map(song => this.normalizeNcmSong(song)).filter(song => song.name),
            total: Number(json?.result?.songCount || 0)
        };
    }

    async _searchOne(word, page, limit) {
        if (this.hasNcm()) {
            try {
                const { songs, total } = await this._ncmSearchSongs(word, page, limit);
                return { songs, hasMore: songs.length >= limit && page * limit < (total || Infinity) };
            } catch (e) {
                console.warn('🎵 [音乐] 网易云 API 搜索失败，改用游客音源:', e?.message || e);
            }
        }
        const songs = await this._vkeysSearch(word, page, Math.min(20, limit));
        return { songs, hasMore: songs.length >= Math.min(20, limit) };
    }

    /**
     * 搜索歌曲
     * 语种/风格词会展开成多位代表歌手并交错合并结果
     */
    async searchSongs(keyword, page = 1) {
        const word = cleanText(keyword);
        if (!word) return { songs: [], hasMore: false, expansion: null };
        const expansion = this.getExpansion(word);

        if (!expansion) {
            const result = await this._searchOne(word, page, 30);
            return { ...result, expansion: null };
        }

        // 展开搜索：每页取 4 位歌手，每人 8 首
        const perPage = 4;
        const seeds = expansion.seeds.slice((page - 1) * perPage, page * perPage);
        if (seeds.length === 0) return { songs: [], hasMore: false, expansion };
        const groups = await Promise.all(seeds.map(seed =>
            this._searchOne(seed, 1, 8).then(r => r.songs.slice(0, 8)).catch(() => [])
        ));
        const merged = [];
        const maxLen = Math.max(0, ...groups.map(g => g.length));
        for (let i = 0; i < maxLen; i++) {
            groups.forEach(group => { if (group[i]) merged.push(group[i]); });
        }
        return {
            songs: merged,
            hasMore: page * perPage < expansion.seeds.length,
            expansion
        };
    }

    /** 歌单搜索（仅网易云模式） */
    async searchPlaylists(keyword, page = 1) {
        if (!this.hasNcm()) return { playlists: [], hasMore: false };
        const word = cleanText(keyword);
        const expansion = this.getExpansion(word);
        const limit = 20;
        if (expansion && page === 1) {
            try {
                const json = await this.ncm('/top/playlist', { cat: expansion.cat, limit: 30, order: 'hot' });
                const list = (json?.playlists || []).map(p => this.normalizeNcmPlaylist(p));
                if (list.length) return { playlists: list, hasMore: false };
            } catch (_e) { /* 回落到关键词搜索 */ }
        }
        const json = await this.ncm('/cloudsearch', { keywords: word, type: 1000, limit, offset: (page - 1) * limit });
        const list = (json?.result?.playlists || []).map(p => this.normalizeNcmPlaylist(p));
        return { playlists: list, hasMore: list.length >= limit };
    }

    async searchSuggest(keyword) {
        const word = cleanText(keyword);
        if (!word || !this.hasNcm()) return [];
        try {
            const json = await this.ncm('/search/suggest', { keywords: word, type: 'mobile' }, { timeout: 5000 });
            return (json?.result?.allMatch || []).map(item => cleanText(item?.keyword)).filter(Boolean).slice(0, 8);
        } catch (_e) {
            return [];
        }
    }

    // ================= 歌单 =================

    async getPlaylistTracks(playlistId) {
        const id = String(playlistId || '').trim();
        if (!id) return { info: null, songs: [] };

        if (this.hasNcm()) {
            try {
                const [detail, tracks] = await Promise.all([
                    this.ncm('/playlist/detail', { id }).catch(() => null),
                    this.ncm('/playlist/track/all', { id, limit: 500, offset: 0 })
                ]);
                const songs = (tracks?.songs || []).map(s => this.normalizeNcmSong(s)).filter(s => s.name);
                if (songs.length) {
                    const info = detail?.playlist ? this.normalizeNcmPlaylist(detail.playlist) : null;
                    if (info) info.description = cleanText(detail.playlist.description || '');
                    return { info, songs };
                }
            } catch (e) {
                console.warn('🎵 [音乐] 网易云歌单加载失败，改用游客音源:', e?.message || e);
            }
        }

        const json = await this._fetch(`${METING}?server=netease&type=playlist&id=${encodeURIComponent(id)}`, { timeout: 15000 });
        const list = Array.isArray(json) ? json : [];
        const songs = list.map(item => this.normalizeMetingSong(item)).filter(s => s.name);
        return { info: null, songs };
    }

    /** 从分享链接 / 文本里提取歌单 ID */
    static parsePlaylistId(text = '') {
        const value = String(text || '').trim();
        const match = value.match(/playlist[^0-9]*?(?:id=)?(\d{5,})/i) || value.match(/[?&]id=(\d{5,})/) || value.match(/^(\d{5,})$/);
        return match ? match[1] : '';
    }

    // ================= 播放链接 =================

    /**
     * 依次产出可尝试的播放链接
     * @returns {AsyncGenerator<{url: string, source: string, trial?: boolean}>}
     */
    async *urlCandidates(song) {
        if (!song) return;
        if (song.localUrl) {
            yield { url: song.localUrl, source: 'local' };
            return;
        }

        let id = String(song.id || '').trim();
        if (!id) {
            const found = await this.resolveSongId(song.name, song.artist).catch(() => null);
            if (found?.id) {
                id = found.id;
                song.id = found.id;
                if (!song.pic && found.pic) song.pic = found.pic;
                if (!song.duration && found.duration) song.duration = found.duration;
            }
        }

        if (id && this.hasNcm()) {
            try {
                const json = await this.ncm('/song/url/v1', { id, level: 'exhigh' });
                const item = Array.isArray(json?.data) ? json.data[0] : null;
                if (item?.url) yield { url: toHttps(item.url), source: 'ncm', trial: !!item.freeTrialInfo };
            } catch (_e) { /* 下一个 */ }
        }

        if (id) {
            try {
                const json = await this._fetch(`${METING}?server=netease&type=song&id=${encodeURIComponent(id)}`);
                const url = Array.isArray(json) ? json[0]?.url : '';
                if (url && !String(url).includes('music.163.com/404')) {
                    if (!song.pic && json[0]?.pic) song.pic = toHttps(json[0].pic);
                    yield { url: toHttps(url), source: 'meting' };
                }
            } catch (_e) { /* 下一个 */ }

            try {
                const json = await this._fetch(`${VKEYS}?id=${encodeURIComponent(id)}`);
                if (json?.data?.url) yield { url: toHttps(json.data.url), source: 'vkeys' };
            } catch (_e) { /* 下一个 */ }

            yield { url: `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`, source: 'outer' };
        }

        const external = await this._fetchExternalSong(song.name, song.artist).catch(() => null);
        if (external?.url) {
            if (!song.pic && external.pic) song.pic = external.pic;
            if (external.lrc?.length && !this._lyricCache.has(this._lyricKey(song))) {
                this._lyricCache.set(this._lyricKey(song), external.lrc);
            }
            yield { url: external.url, source: 'external' };
        }
    }

    async resolveSongId(name, artist) {
        const word = cleanText(`${name || ''} ${artist || ''}`);
        if (!word) return null;
        const { songs } = await this._searchOne(word, 1, 10);
        if (!songs.length) return null;
        const targetName = cleanText(name).toLowerCase();
        return songs.find(s => s.name.toLowerCase() === targetName) || songs[0];
    }

    // ================= 歌词 =================

    _lyricKey(song) {
        return song?.id ? `id:${song.id}` : `n:${cleanText(song?.name)}|${cleanText(song?.artist)}`;
    }

    async getLyrics(song) {
        if (!song) return [];
        const key = this._lyricKey(song);
        if (this._lyricCache.has(key)) return this._lyricCache.get(key);

        let lyrics = [];
        const id = String(song.id || '').trim();
        if (id && this.hasNcm()) {
            try {
                const json = await this.ncm('/lyric', { id }, { withCookie: false });
                lyrics = mergeLyrics(json?.lrc?.lyric || '', json?.tlyric?.lyric || '');
            } catch (_e) { /* 回落 */ }
        }
        if (!lyrics.length && id) {
            try {
                const main = await this._fetch(`${METING}?server=netease&type=lrc&id=${encodeURIComponent(id)}`, { as: 'text' });
                if (main && !main.includes('暂无歌词')) {
                    const trans = await this._fetch(`${METING}?server=netease&type=lrc&id=${encodeURIComponent(id)}&type=tlrc`, { as: 'text' }).catch(() => '');
                    lyrics = mergeLyrics(main, trans);
                }
            } catch (_e) { /* 无歌词 */ }
        }
        this._lyricCache.set(key, lyrics);
        return lyrics;
    }

    // ================= 登录 & 账号 =================

    async qrKey() {
        const json = await this.ncm('/login/qr/key', {}, { withCookie: false });
        return json?.data?.unikey || '';
    }

    async qrCreate(key) {
        const json = await this.ncm('/login/qr/create', { key, qrimg: true }, { withCookie: false });
        return { img: json?.data?.qrimg || '', url: json?.data?.qrurl || '' };
    }

    /** 800 过期 / 801 等待扫码 / 802 待确认 / 803 成功 */
    async qrCheck(key) {
        const json = await this.ncm('/login/qr/check', { key, noCookie: true }, { withCookie: false });
        return { code: Number(json?.code || 0), cookie: json?.cookie || '', message: json?.message || '' };
    }

    async loginStatus(cookieOverride) {
        const params = cookieOverride ? { cookie: cookieOverride } : {};
        const json = await this.ncm('/login/status', params, { withCookie: !cookieOverride });
        const data = json?.data || json || {};
        const profile = data.profile || null;
        if (!profile?.userId) return null;
        return {
            userId: String(profile.userId),
            nickname: profile.nickname || '',
            avatarUrl: toHttps(profile.avatarUrl || ''),
            backgroundUrl: toHttps(profile.backgroundUrl || ''),
            signature: profile.signature || '',
            vipType: Number(profile.vipType || 0) || 0
        };
    }

    async userDetail(uid) {
        const json = await this.ncm('/user/detail', { uid });
        return {
            level: Number(json?.level || 0) || 0,
            listenSongs: Number(json?.listenSongs || 0) || 0,
            follows: Number(json?.profile?.follows || 0) || 0,
            followeds: Number(json?.profile?.followeds || 0) || 0
        };
    }

    async userPlaylists(uid) {
        const json = await this.ncm('/user/playlist', { uid, limit: 200 });
        return (json?.playlist || []).map(p => this.normalizeNcmPlaylist(p));
    }

    async likeSong(id, like = true) {
        if (!this.isLoggedIn() || !id) return false;
        try {
            const json = await this.ncm('/like', { id, like: like ? 'true' : 'false' });
            return Number(json?.code) === 200;
        } catch (_e) {
            return false;
        }
    }

    async subscribePlaylist(id, subscribe = true) {
        if (!this.isLoggedIn() || !id) return false;
        try {
            const json = await this.ncm('/playlist/subscribe', { id, t: subscribe ? 1 : 2 });
            return Number(json?.code) === 200;
        } catch (_e) {
            return false;
        }
    }

    async dailySongs() {
        if (!this.isLoggedIn()) return [];
        const json = await this.ncm('/recommend/songs');
        return (json?.data?.dailySongs || []).map(s => this.normalizeNcmSong(s));
    }

    async logout() {
        try { await this.ncm('/logout'); } catch (_e) { /* ignore */ }
    }

    // ================= 备用音源（百百音源脚本） =================

    async _ensureExternalSource() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return null;
        const existing = window.Music || globalThis.Music;
        if (typeof existing?.SearchMusic === 'function') return existing;
        if (this._externalPromise) return this._externalPromise;

        this._externalPromise = new Promise(resolve => {
            let settled = false;
            const finish = (api = null) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(api);
            };
            const timer = setTimeout(() => finish(null), 10000);
            const onReady = () => {
                const api = window.Music || globalThis.Music;
                finish(typeof api?.SearchMusic === 'function' ? api : null);
            };
            const existingNode = document.getElementById(EXTERNAL_SOURCE_ID);
            if (existingNode) {
                existingNode.addEventListener('load', onReady, { once: true });
                existingNode.addEventListener('error', () => finish(null), { once: true });
                setTimeout(onReady, 50);
                return;
            }
            const node = document.createElement('script');
            node.id = EXTERNAL_SOURCE_ID;
            node.src = EXTERNAL_SOURCE_URL;
            node.async = true;
            node.onload = onReady;
            node.onerror = () => finish(null);
            document.head.appendChild(node);
        }).finally(() => {
            this._externalPromise = null;
        });
        return this._externalPromise;
    }

    async _fetchExternalSong(name, artist) {
        const safeName = cleanText(name);
        if (!safeName) return null;
        const api = await this._ensureExternalSource();
        if (typeof api?.SearchMusic !== 'function') return null;

        const queries = [cleanText(`${safeName} ${artist || ''}`), safeName]
            .filter((value, index, arr) => value && arr.indexOf(value) === index);
        for (const query of queries) {
            let raw = null;
            try {
                raw = await Promise.resolve(api.SearchMusic(query));
            } catch (_e) {
                continue;
            }
            const source = Array.isArray(raw) ? raw[0] : raw;
            if (!source || typeof source !== 'object') continue;
            const url = toHttps(source.Url || source.url || source.URL || source.data?.Url || source.data?.url || '');
            if (!url) continue;
            const lyricText = String(source.Lyric || source.lyric || source.Lrc || source.lrc || '').trim();
            return {
                url,
                pic: toHttps(source.Pic || source.pic || source.Cover || source.cover || ''),
                lrc: lyricText ? parseLrc(lyricText).map(line => ({ ...line, tr: '' })) : []
            };
        }
        return null;
    }
}
