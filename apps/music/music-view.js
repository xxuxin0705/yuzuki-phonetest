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
// 🎵 音乐APP - 视图层（网易云风格）
// ----------------------------------------
// 页面图层：music(根：首页/搜索/笔记/我的) → music-list → music-player
//          music-listen（一起听）/ music-settings / music-login
// 弹层：底部动作面板、分享、一起听、摘录、播放列表
// ========================================

import { PLAY_MODES } from './music-data.js';
import { MUSIC_TOPLISTS, MUSIC_HOT_KEYWORDS, MusicApi } from './music-api.js';
import { listShareTargets, shareSongToWechat, inviteListenInWechat, normalizeAvatarPath } from './music-share.js';

const CSS_VERSION = '2.0.0';
const FLOAT_POS_KEY = 'global_music_floating_position';

const P = {
    menu: '<path d="M4 7h16M4 12h10M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    more: '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    prev: '<path d="M6 5v14" /><path d="M19 5.5v13L9 12z" fill="currentColor" stroke="none"/>',
    next: '<path d="M18 5v14" /><path d="M5 5.5v13L15 12z" fill="currentColor" stroke="none"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    heartFill: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
    pulse: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M7.5 12.5h2.2l1.2-2.2 2 4 1.2-1.8h2.4"/>',
    quote: '<path d="M5 19h4l10-10-4-4L5 15z"/><path d="m13 7 4 4"/>',
    share: '<path d="M12 4v11"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
    listen: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
    list: '<path d="M4 6h11M4 11h11M4 16h7"/><path d="M17 13v7"/><circle cx="15" cy="19.5" r="2"/><path d="M17 13l3-1"/>',
    loop: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/>',
    order: '<path d="M4 7h12M4 12h12M4 17h7"/><path d="m16 15 3 3-3 3"/><path d="M13 18h6"/>',
    shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 3.6c1.1 1.7 2.3 2.7 4.3 2.7H21"/><path d="m18 13 3 3-3 3"/><path d="M3 17h3.5c1.4 0 2.4-.5 3.3-1.4"/><path d="M14.2 8.4c.9-.9 1.9-1.4 3.3-1.4H21"/><path d="m18 4 3 3-3 3"/>',
    single: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/><path d="M11.5 10.5 13 9.5v5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    folder: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M12 11v5"/><path d="m9.5 13.5 2.5 2.5 2.5-2.5"/>',
    lyric: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><path d="M16.75 13.5v6.5M13.5 16.75H20"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    import: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M15 14h-6"/><path d="m11 11.5-2.5 2.5 2.5 2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M5 7h14"/><path d="M9.5 7V5h5v2"/><path d="M7 7l1 12.5h8L17 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
    collect: '<path d="M6 4.5h12v15.5l-6-4-6 4z"/>',
    collectFill: '<path d="M6 4.5h12v15.5l-6-4-6 4z" fill="currentColor"/>',
    note: '<path d="M9 18V6.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    home: '<path d="M4 11 12 4.5 20 11"/><path d="M6.5 9.5V19h11V9.5"/>',
    edit: '<path d="M5 19h4l10-10-4-4L5 15z"/>'
};
const ic = (name, size = 22, extra = '') => `<svg class="mz-ic ${extra}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

const MODE_ICON = { loop: 'loop', order: 'order', shuffle: 'shuffle', single: 'single' };

const DEFAULT_COVER = (() => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd3d6"/><stop offset="1" stop-color="#f05a64"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><path d="M74 34v38a10 10 0 1 1-5-8.7V44l-22 5v28a10 10 0 1 1-5-8.7V40z" fill="#fff" fill-opacity=".92"/></svg>';
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
})();

const esc = (str = '') => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtTime = (s) => {
    const v = Math.max(0, Number(s) || 0);
    return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
};

const fmtCount = (n) => {
    const v = Number(n) || 0;
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    return String(v);
};

const coverOf = (url, size = 200) => {
    const raw = String(url || '').trim();
    if (!raw) return DEFAULT_COVER;
    if (/music\.126\.net/.test(raw) && !/[?&]param=/.test(raw)) return `${raw}${raw.includes('?') ? '&' : '?'}param=${size}y${size}`;
    return raw;
};

const img = (url, size = 200, cls = '') => `<img class="${cls}" src="${esc(coverOf(url, size))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${DEFAULT_COVER}'">`;

const levelFromHours = (h) => {
    const steps = [0, 5, 20, 60, 150, 350, 700, 1500, 3000, 6000];
    let lv = 1;
    steps.forEach((need, i) => { if (h >= need) lv = i + 1; });
    return Math.min(10, lv);
};

export class MusicView {
    constructor(musicApp) {
        this.app = musicApp;
        this.tab = 'mine';
        this.mainTab = 'music';
        this.mineSub = 'recent';
        this.stack = ['music'];
        this.listCtx = null;
        this.playerFace = 'disc';
        this.search = { keyword: '', page: 1, songs: [], playlists: [], mode: 'songs', loading: false, hasMore: false, expansion: null, error: '', token: 0 };
        this.homeDaily = null;
        this.listenFace = 'disc';
        this._listen = null;
        this._listenJoinAt = 0;
        this._thoughtIdx = 0;
        this._thoughtTimer = null;
        this.localFiles = [];
        this._lyricsIndex = -1;
        this._lyricsTouchedAt = 0;
        this._libSig = '';
        this._float = null;
        this._toastTimer = null;
        this._overlay = null;
        this._qrTimer = null;
        this._seeking = false;
        this._injectCSS();
    }

    get data() {
        return this.app.musicData;
    }

    get shell() {
        return this.app.phoneShell;
    }

    // ================= 基础设施 =================

    _injectCSS() {
        if (typeof document === 'undefined') return;
        const href = new URL(`./music.css?v=${CSS_VERSION}`, import.meta.url).href;
        let link = document.getElementById('music-app-style');
        if (link) {
            if (link.href !== href) link.href = href;
            return;
        }
        link = document.createElement('link');
        link.id = 'music-app-style';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    _screen() {
        return this.shell?.screen || null;
    }

    _layer(id) {
        return this._screen()?.querySelector(`[data-view-id="${id}"]`) || null;
    }

    _show(id, html, bind) {
        if (!this.shell) return null;
        this.shell.setContent(html, id);
        const layer = this._layer(id);
        if (layer && typeof bind === 'function') bind(layer);
        if (this.stack[this.stack.length - 1] !== id) {
            const existing = this.stack.indexOf(id);
            if (existing >= 0) this.stack.splice(existing + 1);
            else this.stack.push(id);
        }
        this.updateDisplay();
        return layer;
    }

    _restore(id) {
        const layer = this._layer(id);
        if (!layer || !this.shell) return false;
        this.shell.setContent(layer.getAttribute('data-raw-html') || '', id);
        return true;
    }

    /** 返回：先关弹层，再退页面，最后回桌面 */
    back() {
        if (this._overlay) {
            this._closeOverlay();
            return true;
        }
        const leaving = this.stack[this.stack.length - 1];
        if (leaving === 'music-login') this._stopQr();
        if (leaving === 'music-listen') this._hideThought();
        if (this.stack.length > 1) {
            this.stack.pop();
            const target = this.stack[this.stack.length - 1];
            if (!this._restore(target)) {
                this.stack = ['music'];
                this.renderRoot();
            }
            this.updateDisplay();
            return true;
        }
        window.dispatchEvent(new CustomEvent('phone:goHome'));
        return true;
    }

    toast(message) {
        const text = String(message || '').trim();
        if (!text) return;
        const screen = this._screen();
        const inApp = !!screen?.querySelector('.phone-view-current .mz-app');
        if (!inApp) {
            if (this.shell?.showNotification) this.shell.showNotification('音乐', text, '🎵');
            else window.VirtualPhone?.notify?.('音乐', text, '🎵');
            return;
        }
        let el = screen.querySelector('.mz-toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'mz-toast';
            screen.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    // ================= 入口 =================

    renderSettings() {
        this.render();
    }

    render() {
        this._injectCSS();
        this.stack = ['music'];
        this.renderRoot();
        if (this.data.api.isLoggedIn() && !this._accountRefreshedAt) {
            this._accountRefreshedAt = Date.now();
            this.data.refreshAccount().then(() => this._refreshTab()).catch(() => {});
        }
    }

    renderRoot() {
        const html = `
            <div class="music-app mz-app mz-root" data-r="${Date.now()}">
                <div class="mz-tab-body"></div>
                <div class="mz-dock">
                    ${this._miniHtml()}
                    <nav class="mz-tabbar">
                        ${[['home', '首页'], ['search', '搜索'], ['notes', '笔记'], ['mine', '我的']].map(([id, label]) => `
                            <button type="button" class="mz-tabbar-btn ${this.tab === id ? 'on' : ''}" data-tab="${id}">${label}${id === 'notes' && this.data.getNotes().length ? '' : ''}</button>
                        `).join('')}
                    </nav>
                </div>
            </div>`;
        this._show('music', html, (layer) => {
            this._bindLayer(layer);
            this._renderTab(layer);
        });
    }

    _switchTab(tab) {
        if (this.tab === tab) {
            if (tab === 'search') this._layer('music')?.querySelector('.mz-search-input')?.focus();
            return;
        }
        this.tab = tab;
        const layer = this._layer('music');
        if (!layer) return;
        layer.querySelectorAll('.mz-tabbar-btn').forEach(btn => btn.classList.toggle('on', btn.dataset.tab === tab));
        this._renderTab(layer);
    }

    _refreshTab() {
        const layer = this._layer('music');
        if (layer && (this.tab === 'mine' || this.tab === 'notes' || this.tab === 'home')) this._renderTab(layer, { keepScroll: true });
    }

    _renderTab(layer = this._layer('music'), { keepScroll = false } = {}) {
        const body = layer?.querySelector('.mz-tab-body');
        if (!body) return;
        const prevScroll = keepScroll ? body.querySelector('.mz-scroll')?.scrollTop || 0 : 0;
        if (this.tab === 'home') body.innerHTML = this._homeHtml();
        else if (this.tab === 'search') body.innerHTML = this._searchHtml();
        else if (this.tab === 'notes') body.innerHTML = this._notesPageHtml();
        else body.innerHTML = this._mineHtml();
        body.dataset.current = this.tab;
        if (keepScroll) {
            const scroller = body.querySelector('.mz-scroll');
            if (scroller) scroller.scrollTop = prevScroll;
        }
        if (this.tab === 'search') this._bindSearchInput(body);
        this._libSig = this._librarySignature();
        this.updateDisplay();
    }

    // ================= 迷你播放条 =================

    _miniHtml() {
        return `
            <div class="mz-mini" data-act="open-player">
                <div class="mz-mini-disc"><img alt="" src="${DEFAULT_COVER}"></div>
                <div class="mz-mini-text"><b class="mz-mini-title">还没有在听的歌</b><span class="mz-mini-artist"></span></div>
                <button type="button" class="mz-mini-play" data-act="mini-play" aria-label="播放">
                    <svg class="mz-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="mz-ring-bg"/><circle cx="18" cy="18" r="16" class="mz-ring-fg"/></svg>
                    <span class="mz-mini-play-ic">${ic('play', 16)}</span>
                </button>
                <button type="button" class="mz-mini-queue" data-act="queue" aria-label="播放列表">${ic('list', 24)}</button>
            </div>`;
    }

    // ================= 我的 =================

    _accountView() {
        const cfg = this.data.getNcmConfig();
        const local = this.data.getProfile();
        const wechatUser = (window.VirtualPhone?.wechatApp?.wechatData || window.VirtualPhone?.cachedWechatData)?.getUserInfo?.() || {};
        const hours = this.data.getListenHours();
        if (cfg.profile && cfg.cookie) {
            const p = cfg.profile;
            const s = cfg.stats || {};
            return {
                logged: true,
                name: p.nickname || '网易云用户',
                avatar: p.avatarUrl,
                vip: p.vipType > 0,
                status: local.status || '',
                tag: local.tag || '',
                stats: [[s.follows ?? 0, '关注'], [s.followeds ?? 0, '粉丝'], [`Lv.${s.level || levelFromHours(hours)}`, ''], [hours, '小时']]
            };
        }
        return {
            logged: false,
            name: local.name || wechatUser.name || '音乐用户',
            avatar: local.avatar || normalizeAvatarPath(wechatUser.avatar) || '',
            vip: false,
            status: local.status || '',
            tag: local.tag || '',
            stats: [[this.data.getUserPlaylists().length, '歌单'], [this.data.getLiked().length, '喜欢'], [`Lv.${levelFromHours(hours)}`, ''], [hours, '小时']]
        };
    }

    _mineHtml() {
        const acc = this._accountView();
        const avatar = acc.avatar ? esc(coverOf(acc.avatar, 300)) : '';
        return `
            <div class="mz-scroll mz-mine">
                <header class="mz-hero">
                    <div class="mz-hero-bg" ${avatar ? `style="background-image:url('${avatar}')"` : ''}></div>
                    <div class="mz-hero-top">
                        <button type="button" class="mz-icon-btn" data-act="settings" aria-label="设置">${ic('menu', 24)}</button>
                        <button type="button" class="mz-status-pill" data-act="edit-status">${acc.status ? esc(acc.status) : '+ 添加状态'}</button>
                        <button type="button" class="mz-icon-btn" data-tab="search" aria-label="搜索">${ic('search', 24)}</button>
                        <button type="button" class="mz-icon-btn" data-act="account" aria-label="账号">${ic('more', 24)}</button>
                    </div>
                    <button type="button" class="mz-hero-avatar" data-act="edit-profile">
                        ${avatar ? `<img src="${avatar}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(Array.from(acc.name)[0] || '音')}</span>`}
                    </button>
                    <div class="mz-hero-name">
                        <span>${esc(acc.name)}</span>
                        ${acc.vip ? '<em class="mz-vip-chip">VIP</em>' : ''}
                    </div>
                    <div class="mz-hero-tags">
                        ${acc.logged
                            ? '<span class="mz-tag-chip ok">网易云已连接</span>'
                            : '<button type="button" class="mz-tag-chip" data-act="login">登录网易云</button>'}
                        ${acc.tag ? `<span class="mz-tag-text">${ic('note', 13)} ${esc(acc.tag)}</span>` : ''}
                    </div>
                    <div class="mz-hero-stats">
                        ${acc.stats.map(([v, label]) => `<span><b>${esc(fmtCount(v) === 'NaN' ? v : (typeof v === 'number' ? fmtCount(v) : v))}</b>${label ? ` ${label}` : ''}</span>`).join('')}
                    </div>
                    <div class="mz-hero-quick">
                        <button type="button" data-act="quick-recent">${ic('clock', 20)}<span>最近</span></button>
                        <button type="button" data-act="quick-local">${ic('folder', 20)}<span>本地</span></button>
                        <button type="button" data-act="quick-lyrics">${ic('lyric', 20)}<span>歌词</span></button>
                        <button type="button" class="mz-quick-sq" data-act="settings" aria-label="更多">${ic('grid', 20)}</button>
                    </div>
                </header>
                <section class="mz-panel">
                    <div class="mz-main-tabs">
                        <button type="button" class="${this.mainTab === 'music' ? 'on' : ''}" data-act="main-tab" data-v="music">音乐</button>
                        <button type="button" class="${this.mainTab === 'notes' ? 'on' : ''}" data-act="main-tab" data-v="notes">笔记</button>
                    </div>
                    ${this.mainTab === 'notes' ? `<div class="mz-panel-notes">${this._notesListHtml()}</div>` : this._mineMusicHtml()}
                </section>
            </div>`;
    }

    _mineMusicHtml() {
        const created = this._createdLists();
        const collected = this._collectedLists();
        const sub = this.mineSub;
        let rows = '';
        if (sub === 'recent') {
            rows = this._likedRowHtml() + this._recentListRows();
        } else if (sub === 'created') {
            rows = this._likedRowHtml() + (created.length ? created.map(p => this._plRowHtml(p)).join('') : '')
                + `<button type="button" class="mz-pl-row mz-pl-add" data-act="create-pl"><span class="mz-pl-cover mz-pl-cover-add">${ic('plus', 26)}</span><span class="mz-pl-meta"><b>新建歌单</b></span></button>`;
        } else {
            rows = collected.length
                ? collected.map(p => this._plRowHtml(p)).join('')
                : `<div class="mz-empty">还没有收藏歌单。<br>点右上角 ${ic('import', 14)} 粘贴网易云歌单链接，不登录也能导入。</div>`;
        }
        return `
            <div class="mz-sub-tabs">
                <button type="button" class="${sub === 'recent' ? 'on' : ''}" data-act="mine-sub" data-v="recent">${ic('lock', 15)} 近期</button>
                <button type="button" class="${sub === 'created' ? 'on' : ''}" data-act="mine-sub" data-v="created">创建<sup>${created.length}</sup></button>
                <button type="button" class="${sub === 'collected' ? 'on' : ''}" data-act="mine-sub" data-v="collected">收藏<sup>${collected.length}</sup></button>
                <span class="mz-sub-spacer"></span>
                <button type="button" class="mz-icon-btn sm" data-act="import-pl" aria-label="导入歌单">${ic('import', 22)}</button>
                <button type="button" class="mz-icon-btn sm" data-act="create-pl" aria-label="新建歌单">${ic('plus', 22)}</button>
            </div>
            <div class="mz-pl-list">${rows}</div>
            ${this._recsTeaserHtml()}`;
    }

    _likedRowHtml() {
        const liked = this.data.getLiked();
        const cloud = this._cloudLikedList();
        const count = cloud ? Math.max(cloud.count, liked.length) : liked.length;
        const custom = this.data.getCover('liked');
        const cover = custom || liked[0]?.pic || cloud?.cover || '';
        return `
            <div class="mz-pl-row" data-act="open-list" data-kind="liked">
                <span class="mz-pl-cover ${custom ? '' : 'mz-pl-cover-liked'}">${cover ? img(cover, 160) : ''}${custom ? '' : `<i>${ic('heartFill', 22)}</i>`}</span>
                <span class="mz-pl-meta"><b>我喜欢的音乐</b><small>${count} 首${this.data.getListenHours() ? ` · 已听 ${this.data.getListenHours()} 小时` : ''}</small></span>
                <button type="button" class="mz-heart-mode" data-act="heart-mode">${ic('pulse', 17)} 心动模式</button>
            </div>`;
    }

    _plRowHtml(p) {
        const isLocal = p.kind === 'local';
        const sub = isLocal ? `歌单 · ${p.count} 首` : `歌单 · ${p.count || '?'} 首${p.creator ? ` · ${esc(p.creator)}` : ''}`;
        return `
            <div class="mz-pl-row" data-act="open-list" data-kind="${p.kind}" data-id="${esc(p.id)}">
                <span class="mz-pl-cover">${img(this.data.getCover(`${p.kind}:${p.id}`) || p.cover, 160)}</span>
                <span class="mz-pl-meta"><b>${esc(p.name)}</b><small>${sub}</small></span>
                <button type="button" class="mz-icon-btn sm mz-row-more" data-act="pl-more" data-kind="${p.kind}" data-id="${esc(p.id)}" aria-label="更多">${ic('more', 20)}</button>
            </div>`;
    }

    _recentListRows() {
        const created = this._createdLists();
        const collected = this._collectedLists();
        const all = [...created, ...collected];
        const recent = this.data.getRecentLists()
            .map(ref => all.find(p => `${p.kind}:${p.id}` === ref.key))
            .filter(Boolean);
        const fill = all.filter(p => !recent.includes(p));
        const rows = [...recent, ...fill].slice(0, 8);
        return rows.map(p => this._plRowHtml(p)).join('');
    }

    _cloudLikedList() {
        const cloud = this.data.getNcmConfig().cloudPlaylists || [];
        return this.data.getNcmConfig().cookie ? (cloud.find(p => p.specialType === 5) || null) : null;
    }

    _createdLists() {
        const local = this.data.getUserPlaylists().map(p => ({
            kind: 'local', id: p.id, name: p.name, count: (p.songs || []).length, cover: p.songs?.[0]?.pic || ''
        }));
        const cfg = this.data.getNcmConfig();
        const uidStr = cfg.profile?.userId;
        const cloud = cfg.cookie ? (cfg.cloudPlaylists || [])
            .filter(p => p.specialType !== 5 && (!p.subscribed && (!uidStr || p.creatorId === uidStr)))
            .map(p => ({ kind: 'netease', id: p.id, name: p.name, count: p.count, cover: p.cover, creator: p.creator })) : [];
        return [...local, ...cloud];
    }

    _collectedLists() {
        const cfg = this.data.getNcmConfig();
        const uidStr = cfg.profile?.userId;
        const cloud = cfg.cookie ? (cfg.cloudPlaylists || [])
            .filter(p => p.subscribed || (uidStr && p.creatorId && p.creatorId !== uidStr))
            .map(p => ({ kind: 'netease', id: p.id, name: p.name, count: p.count, cover: p.cover, creator: p.creator })) : [];
        const local = this.data.getCollected()
            .filter(p => !cloud.some(c => String(c.id) === String(p.id)))
            .map(p => ({ kind: 'netease', id: p.id, name: p.name, count: p.count, cover: p.cover, creator: p.creator }));
        return [...local, ...cloud];
    }

    _recsTeaserHtml() {
        const recs = this.data.getPlaylist();
        if (!recs.length) return '';
        const card = this.data.getCardData();
        const who = card?.char?.[0] || 'TA';
        return `
            <div class="mz-pl-list mz-pl-list-tail">
                <div class="mz-pl-row" data-act="open-list" data-kind="recs">
                    <span class="mz-pl-cover">${img(recs[recs.length - 1]?.pic, 160)}</span>
                    <span class="mz-pl-meta"><b>${esc(who)} 推荐给你的歌</b><small>当前剧情 · ${recs.length} 首</small></span>
                </div>
            </div>`;
    }

    // ================= 首页 =================

    _homeHtml() {
        const card = this.data.getCardData();
        const recs = this.data.getPlaylist();
        const history = this.data.getHistory().slice(0, 12);
        const logged = this.data.api.isLoggedIn();
        const replies = this._normalizeReplies(card?.replies);
        const charName = card?.char?.[0] || '';
        return `
            <div class="mz-scroll mz-home">
                <div class="mz-home-head">
                    <button type="button" class="mz-icon-btn" data-act="settings" aria-label="设置">${ic('menu', 24)}</button>
                    <button type="button" class="mz-fake-search" data-tab="search">${ic('search', 17)}<span>搜索歌曲、歌手，试试“日语”</span></button>
                </div>

                ${card && (charName || card.thought?.length) ? `
                <section class="mz-char-card">
                    <div class="mz-char-head">
                        <b>${esc(charName || 'TA')}</b>
                        ${card.char?.[1] ? `<small>${esc(card.char[1])}</small>` : ''}
                        ${card.meta?.length ? `<small class="mz-char-time">${esc(card.meta.join(' '))}</small>` : ''}
                    </div>
                    ${card.stats?.length ? `<p class="mz-char-stats">“${esc(card.stats.join(' '))}”</p>` : ''}
                    ${card.thought?.length ? `<p class="mz-char-thought">${esc(card.thought.join(' '))}</p>` : ''}
                    ${card.likes?.length ? `<div class="mz-char-likes">${card.likes.filter(Boolean).map(l => `<span>${ic('heart', 12)} ${esc(l)}</span>`).join('')}</div>` : ''}
                    ${replies.length ? `<div class="mz-char-replies">${replies.map(r => `<div><b>${esc(r.name)}</b><span>${esc(r.text)}</span></div>`).join('')}</div>` : ''}
                </section>` : ''}

                ${recs.length ? `
                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>${esc(charName || 'TA')} 推荐的歌</h3><button type="button" data-act="open-list" data-kind="recs">全部 ${recs.length}</button></div>
                    <div class="mz-song-list compact">
                        ${recs.slice(-4).reverse().map((s, i) => this._songRowHtml(s, recs.length - 1 - i, 'recs', { cover: true })).join('')}
                    </div>
                </section>` : ''}

                ${logged ? `
                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>每日推荐</h3><button type="button" data-act="daily">播放</button></div>
                    <button type="button" class="mz-daily" data-act="daily-open">
                        <b>${new Date().getDate()}</b><span>根据你的口味，每天 6:00 更新</span>
                    </button>
                </section>` : ''}

                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>排行榜</h3></div>
                    <div class="mz-toplists">
                        ${MUSIC_TOPLISTS.map(t => `
                            <button type="button" class="mz-toplist" style="--tint:${t.tint}" data-act="open-list" data-kind="netease" data-id="${t.id}" data-name="${esc(t.name)}">
                                <b>${esc(t.name)}</b><span>网易云音乐</span>
                            </button>`).join('')}
                    </div>
                </section>

                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>按语种和风格</h3></div>
                    <div class="mz-chips">${MUSIC_HOT_KEYWORDS.slice(0, 8).map(k => `<button type="button" data-act="kw" data-kw="${esc(k)}">${esc(k)}</button>`).join('')}</div>
                </section>

                ${history.length ? `
                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>最近播放</h3><button type="button" data-act="quick-recent">全部</button></div>
                    <div class="mz-hscroll phone-gesture-control">
                        ${history.map((s, i) => `
                            <button type="button" class="mz-hcard" data-act="song" data-list="hist" data-idx="${i}">
                                ${img(s.pic, 200)}<b>${esc(s.name)}</b><small>${esc(s.artist)}</small>
                            </button>`).join('')}
                    </div>
                </section>` : ''}

                ${!this.data.api.hasNcm() ? `
                <button type="button" class="mz-connect-tip" data-act="login">
                    <b>连接网易云账号</b>
                    <span>登录后可同步你的歌单、喜欢和每日推荐；不登录也能搜歌、听歌、导入歌单。</span>
                </button>` : ''}
            </div>`;
    }

    _normalizeReplies(raw) {
        if (!Array.isArray(raw) || !raw.length) return [];
        const cleaned = raw.map(v => String(v || '').trim()).filter(Boolean);
        const out = [];
        for (let i = 0; i + 2 < cleaned.length; i += 3) {
            out.push({ name: cleaned[i], handle: cleaned[i + 1], text: cleaned[i + 2] });
        }
        return out.filter(r => r.text).slice(0, 3);
    }

    // ================= 搜索 =================

    _searchHtml() {
        const s = this.search;
        return `
            <div class="mz-search">
                <div class="mz-search-bar">
                    <label class="mz-search-field">${ic('search', 17)}
                        <input class="mz-search-input" type="search" enterkeyhint="search" placeholder="搜索歌曲、歌手、语种" value="${esc(s.keyword)}" autocomplete="off">
                    </label>
                    ${s.keyword ? '<button type="button" class="mz-search-clear" data-act="search-clear">取消</button>' : ''}
                </div>
                <div class="mz-scroll mz-search-body">${this._searchBodyHtml()}</div>
            </div>`;
    }

    _searchBodyHtml() {
        const s = this.search;
        if (!s.keyword) {
            const history = this.data.getSearchHistory();
            return `
                ${history.length ? `
                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>搜索历史</h3><button type="button" data-act="clear-search-history" aria-label="清空">${ic('trash', 17)}</button></div>
                    <div class="mz-chips light">${history.map(k => `<button type="button" data-act="kw" data-kw="${esc(k)}">${esc(k)}</button>`).join('')}</div>
                </section>` : ''}
                <section class="mz-sec">
                    <div class="mz-sec-head"><h3>试试这些</h3></div>
                    <div class="mz-hot-list">
                        ${MUSIC_HOT_KEYWORDS.map((k, i) => `<button type="button" data-act="kw" data-kw="${esc(k)}"><i class="${i < 3 ? 'hot' : ''}">${i + 1}</i>${esc(k)}</button>`).join('')}
                    </div>
                </section>`;
        }

        const tabs = this.data.api.hasNcm() ? `
            <div class="mz-seg">
                <button type="button" class="${s.mode === 'songs' ? 'on' : ''}" data-act="search-mode" data-v="songs">单曲</button>
                <button type="button" class="${s.mode === 'playlists' ? 'on' : ''}" data-act="search-mode" data-v="playlists">歌单</button>
            </div>` : '';

        if (s.mode === 'playlists') {
            return `${tabs}
                <div class="mz-pl-list">
                    ${s.playlists.map((p, i) => `
                        <div class="mz-pl-row" data-act="search-pl" data-idx="${i}">
                            <span class="mz-pl-cover">${img(p.cover, 160)}</span>
                            <span class="mz-pl-meta"><b>${esc(p.name)}</b><small>${p.count} 首 · ${esc(p.creator)} · 播放 ${fmtCount(p.playCount)}</small></span>
                        </div>`).join('')}
                </div>
                ${this._searchFooterHtml(s.playlists.length)}`;
        }

        return `${tabs}
            ${s.expansion ? `<div class="mz-search-hint">已为你挑选「${esc(s.expansion.label)}」歌曲，来自多位代表歌手</div>` : ''}
            ${s.songs.length ? `
            <div class="mz-play-all">
                <button type="button" class="mz-play-all-btn" data-act="play-all" data-list="search">${ic('play', 16)}<b>播放全部</b><small>${s.songs.length}</small></button>
                <button type="button" class="mz-chip-btn" data-act="shuffle-all" data-list="search">${ic('shuffle', 16)} 随机播放</button>
            </div>` : ''}
            <div class="mz-song-list">${s.songs.map((song, i) => this._songRowHtml(song, i, 'search', { cover: true })).join('')}</div>
            ${this._searchFooterHtml(s.songs.length)}`;
    }

    _searchFooterHtml(count) {
        const s = this.search;
        if (s.loading) return '<div class="mz-loading"><i></i><i></i><i></i></div>';
        if (s.error) return `<div class="mz-empty">${esc(s.error)}<br><button type="button" class="mz-link" data-act="search-retry">重试</button></div>`;
        if (!count) return '<div class="mz-empty">没有找到相关结果，换个关键词试试</div>';
        if (s.hasMore) return '<button type="button" class="mz-load-more" data-act="load-more">加载更多</button>';
        return '<div class="mz-end">没有更多了</div>';
    }

    _bindSearchInput(body) {
        const input = body.querySelector('.mz-search-input');
        if (!input) return;
        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            const value = input.value.trim();
            timer = setTimeout(() => {
                if (value === this.search.keyword) return;
                this._runSearch(value);
            }, 380);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(timer);
                const value = input.value.trim();
                this.data.addSearchHistory(value);
                if (value !== this.search.keyword) this._runSearch(value);
                input.blur();
            }
        });
    }

    async _runSearch(keyword, { page = 1 } = {}) {
        const s = this.search;
        const token = ++s.token;
        if (page === 1) {
            s.keyword = keyword;
            s.songs = [];
            s.playlists = [];
            s.page = 1;
            s.expansion = null;
        }
        s.error = '';
        s.loading = !!keyword;
        this._paintSearchBody();
        if (!keyword) return;

        try {
            if (s.mode === 'playlists' && this.data.api.hasNcm()) {
                const res = await this.data.api.searchPlaylists(keyword, page);
                if (token !== s.token) return;
                s.playlists = page === 1 ? res.playlists : [...s.playlists, ...res.playlists];
                s.hasMore = res.hasMore;
            } else {
                const res = await this.data.api.searchSongs(keyword, page);
                if (token !== s.token) return;
                const seen = new Set(s.songs.map(x => this.data.songKey(x)));
                const fresh = res.songs.filter(x => {
                    const k = this.data.songKey(x);
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                });
                s.songs = page === 1 ? fresh : [...s.songs, ...fresh];
                s.hasMore = res.hasMore;
                s.expansion = res.expansion;
            }
            s.page = page;
        } catch (e) {
            if (token !== s.token) return;
            s.error = '搜索失败，请检查网络后重试';
            console.warn('🎵 [音乐] 搜索失败:', e);
        }
        s.loading = false;
        this._paintSearchBody();
    }

    _paintSearchBody() {
        const layer = this._layer('music');
        if (!layer || this.tab !== 'search') return;
        const bar = layer.querySelector('.mz-search-bar');
        if (bar) {
            let clear = bar.querySelector('.mz-search-clear');
            if (this.search.keyword && !clear) bar.insertAdjacentHTML('beforeend', '<button type="button" class="mz-search-clear" data-act="search-clear">取消</button>');
            if (!this.search.keyword && clear) clear.remove();
        }
        const body = layer.querySelector('.mz-search-body');
        if (!body) return;
        const scroll = body.scrollTop;
        body.innerHTML = this._searchBodyHtml();
        if (this.search.page > 1 || this.search.loading) body.scrollTop = scroll;
        else body.scrollTop = 0;
        this.updateDisplay();
    }

    // ================= 笔记 =================

    _notesPageHtml() {
        return `
            <div class="mz-scroll mz-notes">
                <div class="mz-page-title">
                    <h2>笔记</h2>
                    <button type="button" class="mz-chip-btn" data-act="note-new">${ic('quote', 15)} 摘录正在播放</button>
                </div>
                ${this._notesListHtml()}
            </div>`;
    }

    _notesListHtml() {
        const notes = this.data.getNotes();
        if (!notes.length) {
            return '<div class="mz-empty">听到喜欢的句子时，在播放页点「摘录」，<br>歌词和你的想法会收在这里。</div>';
        }
        return `<div class="mz-note-list">${notes.map(n => `
            <article class="mz-note">
                <div class="mz-note-song" data-act="note-play" data-id="${esc(n.id)}">
                    ${img(n.song.pic, 120)}
                    <span><b>${esc(n.song.name)}</b><small>${esc(n.song.artist)}</small></span>
                    <i>${ic('play', 14)}</i>
                </div>
                ${n.lines?.length ? `<blockquote>${n.lines.map(l => `<p>${esc(l.txt)}${l.tr ? `<small>${esc(l.tr)}</small>` : ''}</p>`).join('')}</blockquote>` : ''}
                ${n.note ? `<p class="mz-note-text">${esc(n.note)}</p>` : ''}
                <footer>
                    <time>${this._fmtDate(n.createdAt)}</time>
                    <button type="button" data-act="note-share" data-id="${esc(n.id)}">${ic('share', 16)} 分享</button>
                    <button type="button" data-act="note-del" data-id="${esc(n.id)}">${ic('trash', 16)}</button>
                </footer>
            </article>`).join('')}</div>`;
    }

    _fmtDate(ts) {
        const d = new Date(Number(ts) || Date.now());
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ================= 歌曲行 =================

    _songRowHtml(song, index, listName, { cover = false } = {}) {
        const sub = [song.artist, song.album].filter(Boolean).join(' · ');
        return `
            <div class="mz-song-row" data-act="song" data-list="${listName}" data-idx="${index}" data-key="${esc(this.data.songKey(song))}">
                ${cover ? `<span class="mz-song-cover">${img(song.pic, 120)}</span>` : `<span class="mz-song-index">${index + 1}</span>`}
                <span class="mz-song-meta">
                    <b>${esc(song.name)}</b>
                    <small>${esc(sub)}</small>
                </span>
                <span class="mz-playing-bars"><i></i><i></i><i></i></span>
                <button type="button" class="mz-icon-btn sm mz-row-more" data-act="song-more" data-list="${listName}" data-idx="${index}" aria-label="更多">${ic('more', 20)}</button>
            </div>`;
    }

    _songsFor(listName) {
        if (listName === 'search') return this.search.songs;
        if (listName === 'list') return this.listCtx?.songs || [];
        if (listName === 'recs') return this.data.getPlaylist();
        if (listName === 'hist') return this.data.getHistory();
        if (listName === 'queue') return this.data.getQueue();
        return [];
    }

    // ================= 歌单详情页 =================

    async openList({ kind, id = '', name = '' }) {
        const ctx = { kind, id, name, songs: [], loading: true, error: '', info: null };
        this.listCtx = ctx;

        if (kind === 'liked') {
            ctx.name = '我喜欢的音乐';
            ctx.songs = this.data.getLiked();
            const cloud = this._cloudLikedList();
            ctx.loading = !!cloud;
            ctx.cloudId = cloud?.id || '';
        } else if (kind === 'local') {
            const p = this.data.getUserPlaylist(id);
            ctx.name = p?.name || '歌单';
            ctx.songs = p?.songs || [];
            ctx.loading = false;
            this.data.touchRecentList({ key: `local:${id}` });
        } else if (kind === 'recent') {
            ctx.name = '最近播放';
            ctx.songs = this.data.getHistory();
            ctx.loading = false;
        } else if (kind === 'recs') {
            const card = this.data.getCardData();
            ctx.name = `${card?.char?.[0] || 'TA'} 推荐的歌`;
            ctx.songs = this.data.getPlaylist().slice().reverse();
            ctx.loading = false;
        } else if (kind === 'localfiles') {
            ctx.name = '本地音乐';
            ctx.songs = this.localFiles;
            ctx.loading = false;
        } else if (kind === 'daily') {
            ctx.name = '每日推荐';
        } else if (kind === 'netease') {
            const known = [...this._collectedLists(), ...this._createdLists()].find(p => String(p.id) === String(id))
                || MUSIC_TOPLISTS.find(t => t.id === String(id));
            ctx.name = name || known?.name || '歌单';
            ctx.cover = known?.cover || '';
            ctx.creator = known?.creator || '';
            this.data.touchRecentList({ key: `netease:${id}` });
        }

        this._show('music-list', this._listPageHtml(), (layer) => this._bindLayer(layer));

        if (!ctx.loading) return;
        try {
            if (kind === 'liked' && ctx.cloudId) {
                const res = await this.data.api.getPlaylistTracks(ctx.cloudId);
                const local = this.data.getLiked();
                const merged = [...local];
                res.songs.forEach(s => { if (!merged.some(x => this.data.sameSong(x, s))) merged.push(s); });
                ctx.songs = merged;
            } else if (kind === 'daily') {
                ctx.songs = await this.data.api.dailySongs();
            } else if (kind === 'netease') {
                const res = await this.data.api.getPlaylistTracks(id);
                ctx.songs = res.songs;
                if (res.info) {
                    ctx.name = res.info.name || ctx.name;
                    ctx.cover = res.info.cover || ctx.cover;
                    ctx.creator = res.info.creator || ctx.creator;
                    ctx.description = res.info.description || '';
                    ctx.count = res.info.count;
                }
                if (!ctx.songs.length) ctx.error = '这个歌单是空的，或者暂时加载不出来';
            }
        } catch (e) {
            console.warn('🎵 [音乐] 歌单加载失败:', e);
            ctx.error = '歌单加载失败。游客音源偶尔不稳定，可以稍后重试，或在设置里连接网易云 API。';
        }
        ctx.loading = false;
        if (this.listCtx !== ctx) return;
        const layer = this._layer('music-list');
        if (layer) {
            const root = layer.querySelector('.mz-list-page');
            if (root) root.outerHTML = this._listPageHtml();
            this.updateDisplay();
        }
    }

    _listPageHtml() {
        const ctx = this.listCtx || {};
        const coverKey = this._listCoverKey(ctx);
        const customCover = coverKey ? this.data.getCover(coverKey) : '';
        const cover = customCover || ctx.cover || ctx.songs?.[0]?.pic || '';
        const isNetease = ctx.kind === 'netease';
        const collected = isNetease && this.data.isCollected(ctx.id);
        const canEdit = ctx.kind === 'local';
        let body;
        if (ctx.loading && !ctx.songs?.length) body = '<div class="mz-loading"><i></i><i></i><i></i></div>';
        else if (ctx.error && !ctx.songs?.length) body = `<div class="mz-empty">${esc(ctx.error)}<br><button type="button" class="mz-link" data-act="list-retry">重试</button></div>`;
        else if (!ctx.songs?.length) {
            body = ctx.kind === 'localfiles'
                ? `<div class="mz-empty">选择手机里的音频文件来播放<br><small>仅在本次打开期间可用</small><br><button type="button" class="mz-link" data-act="pick-local">选择文件</button></div>`
                : '<div class="mz-empty">这里还没有歌。去搜索页找找喜欢的吧</div>';
        } else {
            body = ctx.songs.map((s, i) => this._songRowHtml(s, i, 'list')).join('')
                + (ctx.loading ? '<div class="mz-loading"><i></i><i></i><i></i></div>' : '');
        }
        return `
            <div class="music-app mz-app mz-list-page" data-r="${Date.now()}">
                <div class="mz-scroll">
                    <header class="mz-list-hero">
                        <div class="mz-list-hero-bg" style="background-image:url('${esc(coverOf(cover, 300))}')"></div>
                        <div class="mz-list-top">
                            <button type="button" class="mz-icon-btn music-back-btn" data-act="back" aria-label="返回">${ic('back', 24)}</button>
                            <span>歌单</span>
                            ${ctx.kind === 'localfiles' ? `<button type="button" class="mz-icon-btn" data-act="pick-local" aria-label="添加">${ic('plus', 24)}</button>` : '<span class="mz-icon-btn"></span>'}
                        </div>
                        <div class="mz-list-info">
                            <button type="button" class="mz-list-cover ${coverKey ? 'editable' : ''}" ${coverKey ? 'data-act="edit-cover"' : ''} aria-label="更换封面">
                                ${ctx.kind === 'liked' && !customCover ? `<i class="mz-liked-mark">${ic('heartFill', 40)}</i>` : img(cover, 300)}
                                ${coverKey ? `<em>${ic('edit', 13)} 换封面</em>` : ''}
                            </button>
                            <div>
                                <h2>${esc(ctx.name || '歌单')}</h2>
                                ${ctx.creator ? `<small>${esc(ctx.creator)}</small>` : ''}
                                ${ctx.description ? `<p>${esc(ctx.description)}</p>` : ''}
                            </div>
                        </div>
                        <div class="mz-list-btns">
                            ${isNetease ? `<button type="button" data-act="list-collect">${ic(collected ? 'collectFill' : 'collect', 18)} ${collected ? '已收藏' : '收藏'}</button>` : ''}
                            ${canEdit ? `<button type="button" data-act="pl-more" data-kind="local" data-id="${esc(ctx.id)}">${ic('edit', 18)} 编辑</button>` : ''}
                            ${ctx.kind === 'recent' && ctx.songs?.length ? `<button type="button" data-act="clear-history">${ic('trash', 18)} 清空</button>` : ''}
                            ${ctx.kind === 'liked' ? `<button type="button" data-act="heart-mode">${ic('pulse', 18)} 心动模式</button>` : ''}
                        </div>
                    </header>
                    <div class="mz-list-body">
                        ${ctx.songs?.length ? `
                        <div class="mz-play-all">
                            <button type="button" class="mz-play-all-btn" data-act="play-all" data-list="list">${ic('play', 16)}<b>播放全部</b><small>${ctx.songs.length}</small></button>
                            <button type="button" class="mz-chip-btn" data-act="shuffle-all" data-list="list">${ic('shuffle', 16)} 随机播放</button>
                        </div>` : ''}
                        <div class="mz-song-list">${body}</div>
                    </div>
                </div>
                <div class="mz-dock">${this._miniHtml()}</div>
            </div>`;
    }

    // ================= 播放页 =================

    openPlayer({ face } = {}) {
        if (face) this.playerFace = face;
        const html = `
            <div class="music-app mz-app mz-player" data-face="${this.playerFace}">
                <div class="mz-player-bg"></div>
                <header class="mz-player-top">
                    <button type="button" class="mz-icon-btn music-back-btn" data-act="back" aria-label="收起">${ic('down', 26)}</button>
                    <div class="mz-player-title"><b></b><small></small></div>
                    <button type="button" class="mz-icon-btn" data-act="p-more" aria-label="更多">${ic('more', 22)}</button>
                </header>
                <div class="mz-stage" data-act="toggle-face">
                    <div class="mz-disc-face">
                        <div class="mz-needle"></div>
                        <div class="mz-disc"><div class="mz-disc-cover">${img('', 400)}</div></div>
                        <p class="mz-disc-line"></p>
                    </div>
                    <div class="mz-lyrics phone-gesture-control"><div class="mz-lyrics-inner"></div></div>
                </div>
                <div class="mz-player-actions">
                    <button type="button" data-act="p-like" aria-label="喜欢">${ic('heart', 24)}</button>
                    <button type="button" data-act="p-excerpt" aria-label="摘录歌词">${ic('quote', 24)}<span>摘录</span></button>
                    <button type="button" data-act="p-listen" aria-label="一起听">${ic('listen', 24)}<span>一起听</span></button>
                    <button type="button" data-act="p-share" aria-label="分享">${ic('share', 24)}<span>分享</span></button>
                </div>
                <div class="mz-progress">
                    <span class="mz-time-cur">0:00</span>
                    <div class="mz-bar phone-gesture-control" role="slider" aria-label="播放进度" tabindex="0"><div class="mz-bar-fill"><i></i></div></div>
                    <span class="mz-time-dur">0:00</span>
                </div>
                <div class="mz-controls">
                    <button type="button" class="mz-ctl-mode" data-act="p-mode" aria-label="播放模式"></button>
                    <button type="button" data-act="p-prev" aria-label="上一首">${ic('prev', 30)}</button>
                    <button type="button" class="mz-ctl-play" data-act="p-play" aria-label="播放"></button>
                    <button type="button" data-act="p-next" aria-label="下一首">${ic('next', 30)}</button>
                    <button type="button" data-act="queue" aria-label="播放列表">${ic('list', 26)}</button>
                </div>
            </div>`;
        this._show('music-player', html, (layer) => {
            this._bindLayer(layer);
            this._bindSeekBar(layer.querySelector('.mz-bar'));
            const lyr = layer.querySelector('.mz-lyrics');
            ['touchstart', 'wheel', 'pointerdown'].forEach(evt => lyr?.addEventListener(evt, () => { this._lyricsTouchedAt = Date.now(); }, { passive: true }));
        });
    }

    _bindSeekBar(bar) {
        if (!bar) return;
        let dragging = false;
        const ratioAt = (e) => {
            const rect = bar.getBoundingClientRect();
            return Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
        };
        const preview = (r) => {
            const fill = bar.querySelector('.mz-bar-fill');
            if (fill) fill.style.width = `${r * 100}%`;
            const d = Number(this.data.audioPlayer.duration) || 0;
            const cur = bar.parentElement?.querySelector('.mz-time-cur');
            if (cur && d) cur.textContent = fmtTime(r * d);
        };
        bar.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            dragging = true;
            this._seeking = true;
            try { bar.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
            preview(ratioAt(e));
        });
        bar.addEventListener('pointermove', (e) => { if (dragging) preview(ratioAt(e)); });
        const end = (e) => {
            if (!dragging) return;
            dragging = false;
            this._seeking = false;
            const d = Number(this.data.audioPlayer.duration) || 0;
            if (d) this.data.seek(ratioAt(e) * d);
        };
        bar.addEventListener('pointerup', end);
        bar.addEventListener('pointercancel', () => { dragging = false; this._seeking = false; });
        bar.addEventListener('click', (e) => e.stopPropagation());
    }

    // ================= 设置页 =================

    openSettings() {
        const cfg = this.data.getNcmConfig();
        const showFloating = this.app.storage.get('music_show_floating', false);
        const autoPlay = this.data.getAutoPlay();
        let promptContent = '';
        const pm = window.VirtualPhone?.promptManager;
        if (pm) {
            pm.ensureLoaded?.();
            promptContent = pm.getPromptForFeature?.('music', 'recommend') || '';
        }
        const html = `
            <div class="music-app mz-app mz-settings" data-r="${Date.now()}">
                <header class="mz-page-head">
                    <button type="button" class="mz-icon-btn music-back-btn" data-act="back" aria-label="返回">${ic('back', 24)}</button>
                    <h2>设置</h2><span class="mz-icon-btn"></span>
                </header>
                <div class="mz-scroll mz-settings-body music-settings-body">
                    <section class="mz-group">
                        <h4>网易云账号</h4>
                        <button type="button" class="mz-cell" data-act="login">
                            <span>${cfg.profile && cfg.cookie ? `已登录：${esc(cfg.profile.nickname)}` : (cfg.apiBase ? '已连接接口，未登录' : '游客模式')}</span>
                            <small>${cfg.profile && cfg.cookie ? '管理' : '登录 / 连接'}</small>
                        </button>
                    </section>
                    <section class="mz-group">
                        <h4>播放</h4>
                        <div class="mz-cell">
                            <span>音量</span>
                            <input class="mz-range" type="range" min="0" max="100" step="1" value="${Math.round(this.data.getVolume() * 100)}" data-input="volume">
                        </div>
                        <button type="button" class="mz-cell" data-act="cycle-mode"><span>播放模式</span><small class="mz-mode-label">${esc(PLAY_MODES.find(m => m.id === this.data.getPlayMode())?.label || '')}</small></button>
                    </section>
                    <section class="mz-group">
                        <h4>酒馆联动</h4>
                        <div class="mz-cell">
                            <span>全局悬浮播放器<small>关掉手机也能切歌</small></span>
                            <button type="button" class="mz-switch ${showFloating ? 'on' : ''}" data-act="toggle-floating" aria-label="全局悬浮播放器"></button>
                        </div>
                        <div class="mz-cell">
                            <span>角色推荐歌曲自动播放<small>剧情里推荐新歌且当前没在播时</small></span>
                            <button type="button" class="mz-switch ${autoPlay ? 'on' : ''}" data-act="toggle-autoplay" aria-label="自动播放"></button>
                        </div>
                        <details class="mz-fold">
                            <summary>音乐推荐提示词</summary>
                            <div class="mz-fold-body">
                                ${pm?.renderPromptPresetControls?.('music', 'recommend') || ''}
                                <textarea id="music-prompt-textarea" class="mz-textarea">${esc(promptContent)}</textarea>
                                <div class="mz-row-btns">
                                    <button type="button" class="mz-btn primary" data-act="prompt-save">保存</button>
                                    <button type="button" class="mz-btn" data-act="prompt-reset">恢复默认</button>
                                </div>
                            </div>
                        </details>
                    </section>
                    <section class="mz-group">
                        <h4>数据</h4>
                        <button type="button" class="mz-cell" data-act="clear-recs"><span>清空当前剧情的推荐歌曲</span><small>${this.data.getPlaylist().length} 首</small></button>
                        <button type="button" class="mz-cell" data-act="clear-history"><span>清空播放历史</span><small>${this.data.getHistory().length} 首</small></button>
                        <button type="button" class="mz-cell" data-act="clear-search-history"><span>清空搜索历史</span></button>
                    </section>
                </div>
            </div>`;
        this._show('music-settings', html, (layer) => {
            this._bindLayer(layer);
            layer.querySelector('[data-input="volume"]')?.addEventListener('input', (e) => {
                this.data.setVolume(Number(e.target.value) / 100);
            });
            window.VirtualPhone?.promptManager?.bindPromptPresetControls?.(layer, 'music', 'recommend', '#music-prompt-textarea', {
                notify: (title, message, icon) => this.shell?.showNotification?.(title, message, icon)
            });
        });
    }

    // ================= 登录页 =================

    openLogin() {
        const cfg = this.data.getNcmConfig();
        const logged = !!(cfg.profile && cfg.cookie);
        const html = `
            <div class="music-app mz-app mz-login" data-r="${Date.now()}">
                <header class="mz-page-head">
                    <button type="button" class="mz-icon-btn music-back-btn" data-act="back" aria-label="返回">${ic('back', 24)}</button>
                    <h2>网易云账号</h2><span class="mz-icon-btn"></span>
                </header>
                <div class="mz-scroll mz-settings-body">
                    ${logged ? `
                    <section class="mz-login-card">
                        ${img(cfg.profile.avatarUrl, 200, 'mz-login-avatar')}
                        <b>${esc(cfg.profile.nickname)}</b>
                        <small>${cfg.profile.vipType > 0 ? '黑胶 VIP · ' : ''}已同步 ${(cfg.cloudPlaylists || []).length} 个歌单</small>
                        <div class="mz-row-btns">
                            <button type="button" class="mz-btn" data-act="sync-account">重新同步</button>
                            <button type="button" class="mz-btn danger" data-act="logout">退出登录</button>
                        </div>
                    </section>` : ''}

                    <section class="mz-group">
                        <h4>网易云 API 地址</h4>
                        <div class="mz-cell column">
                            <input class="mz-input" data-input="api-base" placeholder="例如 http://127.0.0.1:3000" value="${esc(cfg.apiBase || '')}" autocomplete="off">
                            <label class="mz-check"><input type="checkbox" data-input="real-ip" ${cfg.realIP ? 'checked' : ''}> 接口部署在海外（附加国内 IP 参数）</label>
                            <div class="mz-row-btns">
                                <button type="button" class="mz-btn primary" data-act="api-save">保存并测试</button>
                                ${cfg.apiBase ? '<button type="button" class="mz-btn" data-act="api-clear">改回游客模式</button>' : ''}
                            </div>
                            <p class="mz-help">需要一个 NeteaseCloudMusicApi 兼容服务（自己部署在电脑、NAS 或云函数上）。不填也能用：游客模式可以搜歌、听歌、看歌词、导入歌单链接。</p>
                        </div>
                    </section>

                    ${cfg.apiBase && !logged ? `
                    <section class="mz-group">
                        <h4>扫码登录</h4>
                        <div class="mz-qr">
                            <div class="mz-qr-box"><span>正在生成二维码…</span></div>
                            <p class="mz-qr-status">用网易云音乐 App 扫一扫</p>
                            <button type="button" class="mz-link" data-act="qr-refresh">刷新二维码</button>
                        </div>
                    </section>
                    <section class="mz-group">
                        <h4>或粘贴 Cookie</h4>
                        <div class="mz-cell column">
                            <textarea class="mz-textarea sm" data-input="cookie" placeholder="MUSIC_U=..."></textarea>
                            <div class="mz-row-btns"><button type="button" class="mz-btn" data-act="cookie-login">用 Cookie 登录</button></div>
                            <p class="mz-help">Cookie 只保存在你的酒馆扩展设置里，请勿分享给他人。</p>
                        </div>
                    </section>` : ''}
                </div>
            </div>`;
        this._show('music-login', html, (layer) => {
            this._bindLayer(layer);
            if (cfg.apiBase && !logged) this._startQr();
        });
    }

    async _startQr() {
        this._stopQr();
        const layer = this._layer('music-login');
        const box = layer?.querySelector('.mz-qr-box');
        const status = layer?.querySelector('.mz-qr-status');
        if (!box) return;
        box.innerHTML = '<span>正在生成二维码…</span>';
        try {
            const key = await this.data.api.qrKey();
            if (!key) throw new Error('no key');
            const qr = await this.data.api.qrCreate(key);
            if (!qr.img) throw new Error('no img');
            box.innerHTML = `<img src="${esc(qr.img)}" alt="登录二维码">`;
            if (status) status.textContent = '用网易云音乐 App 扫一扫';
            const token = Symbol('qr');
            this._qrToken = token;
            const poll = async () => {
                if (this._qrToken !== token) return;
                let res;
                try { res = await this.data.api.qrCheck(key); } catch (_e) { res = { code: 0 }; }
                if (this._qrToken !== token) return;
                if (res.code === 803) {
                    this._stopQr();
                    if (status) status.textContent = '登录成功，正在同步…';
                    this.data.setNcmConfig({ cookie: res.cookie });
                    await this._afterLogin();
                    return;
                }
                if (res.code === 800) {
                    if (status) status.textContent = '二维码已过期';
                    box.innerHTML = '<button type="button" class="mz-link" data-act="qr-refresh">点击刷新</button>';
                    return;
                }
                if (status) status.textContent = res.code === 802 ? '已扫码，请在手机上确认' : '用网易云音乐 App 扫一扫';
                this._qrTimer = setTimeout(poll, 2200);
            };
            this._qrTimer = setTimeout(poll, 2200);
        } catch (e) {
            box.innerHTML = '<span>二维码生成失败</span>';
            if (status) status.textContent = '请检查 API 地址是否可访问';
        }
    }

    _stopQr() {
        this._qrToken = null;
        clearTimeout(this._qrTimer);
        this._qrTimer = null;
    }

    async _afterLogin() {
        try {
            const profile = await this.data.refreshAccount();
            if (!profile) {
                this.toast('登录失败，Cookie 无效或已过期');
                return;
            }
            this.toast(`欢迎回来，${profile.nickname}`);
            this.back();
            this.openLogin();
            this._refreshTab();
        } catch (e) {
            this.toast('同步账号失败，请稍后再试');
        }
    }


    // ================= 歌单封面 =================

    _listCoverKey(ctx) {
        if (!ctx) return '';
        if (ctx.kind === 'liked') return 'liked';
        if (ctx.kind === 'local' || ctx.kind === 'netease') return `${ctx.kind}:${ctx.id}`;
        return '';
    }

    _themeImages() {
        const urls = [];
        for (let i = 1; i <= 7; i++) {
            urls.push(new URL(`../wechat/backgrounds/bg${i}.${i === 7 ? 'jpg' : 'png'}`, import.meta.url).href);
        }
        const songs = (this.listCtx?.songs || []).map(s => s.pic).filter(Boolean);
        const liked = this.data.getLiked().map(s => s.pic).filter(Boolean);
        const seen = new Set();
        return [...urls, ...songs, ...liked].filter(u => {
            if (seen.has(u)) return false;
            seen.add(u);
            return true;
        }).slice(0, 36);
    }

    _coverSheet() {
        const key = this._listCoverKey(this.listCtx);
        if (!key) return;
        const current = this.data.getCover(key);
        const images = this._themeImages();
        this._openOverlay(`
            <div class="mz-sheet-title">更换歌单封面</div>
            <div class="mz-cover-src">
                <button type="button" data-cv="upload">${ic('import', 20)}<span>上传新图片</span></button>
                <button type="button" data-cv="album">${ic('grid', 20)}<span>从相册 App 选</span></button>
                ${current ? `<button type="button" data-cv="reset">${ic('close', 20)}<span>恢复默认</span></button>` : ''}
            </div>
            <div class="mz-sub-label">主题图片和歌曲封面</div>
            <div class="mz-cover-grid mz-scroll">
                ${images.map(u => `<button type="button" class="${u === current ? 'on' : ''}" data-cv-pick="${esc(u)}">${img(u, 200)}</button>`).join('')}
            </div>`, {
            cls: 'tall',
            onMount: (overlay) => {
                overlay.addEventListener('click', async (e) => {
                    const pick = e.target.closest('[data-cv-pick]');
                    if (pick) {
                        this._applyCover(key, pick.dataset.cvPick);
                        return;
                    }
                    const btn = e.target.closest('[data-cv]');
                    if (!btn) return;
                    const action = btn.dataset.cv;
                    if (action === 'reset') this._applyCover(key, '');
                    if (action === 'upload') { this._closeOverlay(); this._uploadCover(key); }
                    if (action === 'album') { this._closeOverlay(); this._albumCover(key); }
                });
            }
        });
    }

    _applyCover(key, url) {
        this.data.setCover(key, url);
        this._closeOverlay();
        this.toast(url ? '封面已更换' : '已恢复默认封面');
        this._repaintList();
        this._refreshTab();
    }

    async _getImageManager() {
        if (window.VirtualPhone?.imageManager) return window.VirtualPhone.imageManager;
        const mod = await import('../settings/image-upload.js');
        const manager = new mod.ImageUploadManager(window.VirtualPhone?.storage || this.app.storage);
        if (window.VirtualPhone) window.VirtualPhone.imageManager = manager;
        return manager;
    }

    _uploadCover(key) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const { ImageCropper } = await import('../settings/image-cropper.js');
                const cropper = new ImageCropper({ title: '裁剪封面', outputWidth: 600, outputHeight: 600, quality: 0.86 });
                const base64 = await cropper.open(file);
                this.toast('正在上传…');
                const manager = await this._getImageManager();
                const url = await manager._uploadToServer(base64, 'music-cover', { allowBase64Fallback: false });
                this.data.setCover(key, url);
                this.toast('封面已更换');
                this._repaintList();
                this._refreshTab();
            } catch (err) {
                if (err?.message !== '用户取消') this.toast(err?.message || '上传失败');
            }
        };
        input.click();
    }

    async _albumCover(key) {
        try {
            const [{ AlbumData }, { AlbumImagePicker }] = await Promise.all([
                import('../album/album-data.js'),
                import('../album/album-image-picker.js')
            ]);
            const albumData = window.VirtualPhone?.albumApp?.albumData || new AlbumData(window.VirtualPhone?.storage || this.app.storage);
            const picker = new AlbumImagePicker(albumData);
            if (!(albumData.getImages?.() || []).length) {
                this.toast('相册 App 里还没有图片');
                return;
            }
            const image = await picker.chooseImage({ title: '选择歌单封面' });
            if (image?.path) {
                this.data.setCover(key, image.path);
                this.toast('封面已更换');
                this._repaintList();
                this._refreshTab();
            }
        } catch (err) {
            this.toast('打开相册失败');
        }
    }

    // ================= 一起听 =================

    _wechatDataSync() {
        return window.VirtualPhone?.wechatApp?.wechatData || window.VirtualPhone?.cachedWechatData || null;
    }

    async _loadListenSession() {
        let wd = this._wechatDataSync();
        if (!wd) {
            try {
                const { getWechatData } = await import('./music-share.js');
                wd = await getWechatData(this.app.storage);
            } catch (_e) { wd = null; }
        }
        this._listen = null;
        const sessions = wd?.data?.musicListening || {};
        Object.values(sessions).forEach(s => {
            if (!s || s.active === false) return;
            if (!this._listen || Number(s.startedAt) > Number(this._listen.startedAt)) this._listen = s;
        });
        return this._listen;
    }

    _listenSession() {
        const wd = this._wechatDataSync();
        if (!wd || !this._listen) return this._listen;
        const live = wd.getMusicListening?.(this._listen.chatId);
        if (!live) this._listen = null;
        return this._listen;
    }

    async openListen() {
        if (!this.data.getCurrentSong()) {
            this.toast('先播放一首歌，再邀请一起听');
            return;
        }
        await this._loadListenSession();
        const html = `
            <div class="music-app mz-app mz-listen" data-face="${this.listenFace}" data-r="${Date.now()}">
                <header class="mz-listen-top">
                    <button type="button" class="mz-icon-btn music-back-btn" data-act="back" aria-label="收起">${ic('down', 26)}</button>
                    <span></span>
                    <button type="button" class="mz-icon-btn mz-round-btn" data-act="l-more" aria-label="更多">${ic('more', 20)}</button>
                </header>
                <div class="mz-listen-people"></div>
                <div class="mz-stage mz-listen-stage" data-act="toggle-face">
                    <div class="mz-disc-face">
                        <div class="mz-vinyl"><div class="mz-vinyl-label">${img('', 300)}</div><i class="mz-vinyl-dot"></i></div>
                        <div class="mz-arm"><i></i></div>
                    </div>
                    <div class="mz-lyrics phone-gesture-control"><div class="mz-lyrics-inner"></div></div>
                </div>
                <div class="mz-listen-meta">
                    <div class="mz-player-title left"><b></b><small></small></div>
                    <button type="button" data-act="p-excerpt" class="mz-listen-act" aria-label="摘录歌词">${ic('quote', 24)}</button>
                    <button type="button" data-act="p-like" class="mz-listen-act" aria-label="喜欢">${ic('heart', 26)}</button>
                </div>
                <div class="mz-progress">
                    <div class="mz-bar phone-gesture-control" role="slider" aria-label="播放进度" tabindex="0"><div class="mz-bar-fill"><i></i></div></div>
                </div>
                <div class="mz-progress-times"><span class="mz-time-cur">0:00</span><span class="mz-time-dur">0:00</span></div>
                <div class="mz-controls">
                    <button type="button" class="mz-ctl-mode" data-act="p-mode" aria-label="播放模式"></button>
                    <button type="button" data-act="p-prev" aria-label="上一首">${ic('prev', 30)}</button>
                    <button type="button" class="mz-ctl-play" data-act="p-play" aria-label="播放"></button>
                    <button type="button" data-act="p-next" aria-label="下一首">${ic('next', 30)}</button>
                    <button type="button" data-act="queue" aria-label="播放列表">${ic('list', 26)}</button>
                </div>
                <div class="mz-listen-switch">
                    <button type="button" class="${this.listenFace === 'disc' ? 'on' : ''}" data-act="l-face" data-v="disc" aria-label="唱片">${ic('note', 18)}</button>
                    <button type="button" class="${this.listenFace === 'lyrics' ? 'on' : ''}" data-act="l-face" data-v="lyrics" aria-label="歌词">${ic('lyric', 18)}</button>
                </div>
            </div>`;
        this._show('music-listen', html, (layer) => {
            this._bindLayer(layer);
            this._bindSeekBar(layer.querySelector('.mz-bar'));
            const lyr = layer.querySelector('.mz-lyrics');
            ['touchstart', 'wheel', 'pointerdown'].forEach(evt => lyr?.addEventListener(evt, () => { this._lyricsTouchedAt = Date.now(); }, { passive: true }));
        });
        this._paintListen();
    }

    _paintListen() {
        const room = this._layer('music-listen')?.querySelector('.mz-listen');
        if (!room) return;
        const box = room.querySelector('.mz-listen-people');
        if (!box) return;
        const session = this._listenSession();
        const wd = this._wechatDataSync();
        const user = wd?.getUserInfo?.() || {};
        const myAvatar = normalizeAvatarPath(session?.userAvatar || user.avatar) || normalizeAvatarPath(this.data.getProfile().avatar) || '';
        const myName = user.name || this.data.getProfile().name || '我';
        const avatar = (url, name) => url
            ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">`
            : `<span>${esc(Array.from(name || '?')[0])}</span>`;

        let partnerHtml;
        let status;
        if (!session) {
            partnerHtml = `<button type="button" class="mz-listen-avatar empty" data-act="l-invite" aria-label="邀请好友">${ic('plus', 30)}</button>`;
            status = '<button type="button" class="mz-listen-status link" data-act="l-invite">邀请好友一起听</button>';
        } else {
            const waiting = Date.now() < this._listenJoinAt;
            const pAvatar = normalizeAvatarPath(session.contactAvatar)
                || normalizeAvatarPath(wd?.getContactAutoAvatar?.(session.contactId || session.contactName)) || '';
            partnerHtml = `
                <button type="button" class="mz-listen-avatar partner ${waiting ? 'waiting' : 'joined'}" data-act="l-poke" aria-label="戳一戳 ${esc(session.contactName)}">
                    ${avatar(pAvatar, session.contactName)}
                    ${waiting ? '<i class="mz-wait-dots"><b></b><b></b><b></b></i>' : ''}
                    <span class="mz-thought" hidden></span>
                </button>`;
            const minutes = Math.max(1, Math.round((Date.now() - Number(session.startedAt || Date.now())) / 60000));
            status = waiting
                ? `<span class="mz-listen-status">等待 ${esc(session.contactName)} 加入中…</span>`
                : `<span class="mz-listen-status">和 ${esc(session.contactName)} 一起听了 ${minutes} 分钟 · 点头像戳一下</span>`;
            if (waiting) {
                clearTimeout(this._joinTimer);
                this._joinTimer = setTimeout(() => this._paintListen(), Math.max(200, this._listenJoinAt - Date.now() + 50));
            }
        }
        box.innerHTML = `
            <div class="mz-listen-pair">
                <span class="mz-listen-avatar me">${avatar(myAvatar, myName)}</span>
                ${partnerHtml}
            </div>
            ${status}`;
        this.updateDisplay();
    }

    async _endListen() {
        const session = this._listenSession();
        if (!session) return;
        const ended = window.VirtualPhone?.wechatApp?.endMusicListening?.(session.chatId, { reason: 'manual' })
            || this._wechatDataSync()?.endMusicListening?.(session.chatId, { reason: 'manual' });
        this._listen = null;
        if (ended !== false) this.toast('已结束一起听');
        this._paintListen();
    }

    // 戳一戳：只用本地已有信息拼出“心声”，不额外调用 API
    _thoughtPool(session) {
        const d = this.data;
        const song = d.getCurrentSong();
        const name = session?.contactName || 'TA';
        const pool = [];
        const card = d.getCardData();
        const cardName = String(card?.char?.[0] || '').trim();
        const sameChar = !cardName || !name || cardName.includes(name) || name.includes(cardName);
        if (card && sameChar) {
            (card.thought || []).filter(Boolean).forEach(t => pool.push(t));
            (card.stats || []).filter(Boolean).forEach(t => pool.push(t));
            const likes = (card.likes || []).filter(Boolean);
            if (likes.length) pool.push(`最近喜欢的东西……${likes.slice(0, 3).join('、')}。嗯，还有现在这首歌。`);
        }
        const mind = this._wechatDataSync()?.getUserInfo?.()?.mindNotes?.others?.[name];
        if (mind?.text) pool.push(`${mind.status?.emoji || ''}${mind.text}`.trim());

        const idx = d.getLyricIndex();
        const line = idx >= 0 ? d.currentLyrics[idx]?.txt : '';
        if (line) {
            pool.push(`「${line}」……这句是不是在说我们`);
            pool.push(`刚刚那句「${line}」，偷偷记下来了`);
        }
        if (song) {
            pool.push(`《${song.name}》……你是故意挑这首给我听的吧`);
            pool.push(`${song.artist}的歌，下次换我来放`);
            if (d.isLiked(song)) pool.push('这首在你的红心歌单里？那我也要点一下');
        }
        const h = new Date().getHours();
        if (h >= 23 || h < 5) pool.push('这么晚还在听歌……是睡不着，还是想我了');
        else if (h < 11) pool.push('一大早就一起听歌，今天应该会是好日子');
        pool.push('别戳了……我在认真听呢', '耳机里是同一首歌，感觉离你近了一点', '想知道你现在在想什么');
        return [...new Set(pool.map(t => String(t).trim()).filter(Boolean))];
    }

    _poke() {
        const session = this._listenSession();
        const room = this._layer('music-listen')?.querySelector('.mz-listen');
        const btn = room?.querySelector('.mz-listen-avatar.partner');
        if (!session || !btn) return;
        if (btn.classList.contains('waiting')) {
            this.toast(`${session.contactName} 还在加入中…`);
            return;
        }
        const pool = this._thoughtPool(session);
        const text = pool[this._thoughtIdx % pool.length];
        this._thoughtIdx++;
        btn.classList.remove('poked');
        void btn.offsetWidth;
        btn.classList.add('poked');
        const bubble = btn.querySelector('.mz-thought');
        if (!bubble) return;
        bubble.textContent = text;
        bubble.hidden = false;
        bubble.classList.remove('show');
        void bubble.offsetWidth;
        bubble.classList.add('show');
        clearTimeout(this._thoughtTimer);
        this._thoughtTimer = setTimeout(() => this._hideThought(), 4200);
    }

    _hideThought() {
        clearTimeout(this._thoughtTimer);
        const bubble = this._layer('music-listen')?.querySelector('.mz-thought');
        if (bubble) {
            bubble.classList.remove('show');
            setTimeout(() => { bubble.hidden = true; }, 250);
        }
    }

    // ===== MV / 视频已按需求移除 =====

    // ================= 弹层 =================

    _openOverlay(innerHtml, { cls = '', onMount } = {}) {
        this._closeOverlay();
        const screen = this._screen();
        if (!screen) return null;
        const overlay = document.createElement('div');
        overlay.className = `mz-overlay ${cls}`;
        overlay.setAttribute('data-no-swipe-back', '');
        overlay.innerHTML = `<div class="mz-sheet" role="dialog">${innerHtml}</div>`;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeOverlay();
        });
        this._bindLayer(overlay);
        screen.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        this._overlay = overlay;
        if (typeof onMount === 'function') onMount(overlay);
        return overlay;
    }

    _closeOverlay() {
        const overlay = this._overlay;
        if (!overlay) return;
        this._overlay = null;
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 220);
    }

    _ask({ title, placeholder = '', value = '', confirmText = '确定', multiline = false }) {
        return new Promise(resolve => {
            let settled = false;
            const done = (v) => {
                if (settled) return;
                settled = true;
                this._closeOverlay();
                resolve(v);
            };
            const overlay = this._openOverlay(`
                <div class="mz-dialog">
                    <h3>${esc(title)}</h3>
                    ${multiline
                        ? `<textarea class="mz-textarea sm" data-ask placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
                        : `<input class="mz-input" data-ask placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off">`}
                    <div class="mz-row-btns">
                        <button type="button" class="mz-btn" data-ask-cancel>取消</button>
                        <button type="button" class="mz-btn primary" data-ask-ok>${esc(confirmText)}</button>
                    </div>
                </div>`, { cls: 'center' });
            if (!overlay) { resolve(null); return; }
            const input = overlay.querySelector('[data-ask]');
            overlay.querySelector('[data-ask-ok]').onclick = () => done(input.value.trim());
            overlay.querySelector('[data-ask-cancel]').onclick = () => done(null);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) done(input.value.trim()); });
            const observer = new MutationObserver(() => { if (!overlay.isConnected) { observer.disconnect(); done(null); } });
            observer.observe(this._screen(), { childList: true });
            setTimeout(() => input.focus(), 80);
        });
    }

    _confirm(title, okText = '确定') {
        return new Promise(resolve => {
            let settled = false;
            const done = (v) => { if (settled) return; settled = true; this._closeOverlay(); resolve(v); };
            const overlay = this._openOverlay(`
                <div class="mz-dialog">
                    <h3>${esc(title)}</h3>
                    <div class="mz-row-btns">
                        <button type="button" class="mz-btn" data-c-no>取消</button>
                        <button type="button" class="mz-btn primary" data-c-yes>${esc(okText)}</button>
                    </div>
                </div>`, { cls: 'center' });
            if (!overlay) { resolve(false); return; }
            overlay.querySelector('[data-c-yes]').onclick = () => done(true);
            overlay.querySelector('[data-c-no]').onclick = () => done(false);
        });
    }

    _sheetHeadHtml(song, sub = '') {
        return `
            <div class="mz-sheet-song">
                ${img(song?.pic, 120)}
                <span><b>${esc(song?.name || '')}</b><small>${esc(sub || song?.artist || '')}</small></span>
            </div>`;
    }

    _songMenu(song, { listName, index } = {}) {
        if (!song) return;
        const liked = this.data.isLiked(song);
        const inLocalList = listName === 'list' && this.listCtx?.kind === 'local';
        const items = [
            ['next', 'plus', '下一首播放'],
            ['add-to-pl', 'collect', '收藏到歌单'],
            ['like', liked ? 'heartFill' : 'heart', liked ? '取消喜欢' : '喜欢'],
            ['share', 'share', '分享给微信好友 / 群聊'],
            ['listen', 'listen', '一起听'],
            ['excerpt', 'quote', '摘录歌词'],
            ...(this._listenSession() ? [['end-listen', 'close', '结束一起听']] : []),
            ...(inLocalList ? [['remove-pl', 'trash', '从歌单中删除']] : []),
        ];
        this._openOverlay(`
            ${this._sheetHeadHtml(song, [song.artist, song.album].filter(Boolean).join(' · '))}
            <div class="mz-menu">
                ${items.map(([act, icon, label]) => `<button type="button" data-menu="${act}">${ic(icon, 21)}<span>${label}</span></button>`).join('')}
            </div>`, {
            onMount: (overlay) => {
                overlay.querySelectorAll('[data-menu]').forEach(btn => {
                    btn.onclick = async () => {
                        const act = btn.dataset.menu;
                        this._closeOverlay();
                        await new Promise(r => setTimeout(r, 120));
                        if (act === 'next') { this.data.playNext(song); this.toast('已添加到下一首播放'); }
                        if (act === 'add-to-pl') this._addToPlaylistSheet(song);
                        if (act === 'like') this._toggleLike(song);
                        if (act === 'share') this._shareSheet({ song, mode: 'share' });
                        if (act === 'listen') {
                            if (!this.data.sameSong(this.data.getCurrentSong(), song)) await this.data.playSong(song);
                            this.openListen();
                        }
                        if (act === 'excerpt') this._excerptSheet(song);
                        if (act === 'end-listen') this._endListen();
                        if (act === 'remove-pl') {
                            this.data.removeFromPlaylist(this.listCtx.id, song);
                            this.listCtx.songs = this.data.getUserPlaylist(this.listCtx.id)?.songs || [];
                            this._repaintList();
                        }
                    };
                });
            }
        });
    }

    _toggleLike(song) {
        const nowLiked = this.data.toggleLike(song);
        this.toast(nowLiked ? '已添加到我喜欢的音乐' : '已取消喜欢');
        if (this.listCtx?.kind === 'liked') {
            this.listCtx.songs = this.data.getLiked();
            this._repaintList();
        }
    }

    _repaintList() {
        const layer = this._layer('music-list');
        const root = layer?.querySelector('.mz-list-page');
        if (!root) return;
        const scroll = root.querySelector('.mz-scroll')?.scrollTop || 0;
        root.outerHTML = this._listPageHtml();
        const next = layer.querySelector('.mz-list-page .mz-scroll');
        if (next) next.scrollTop = scroll;
        this.updateDisplay();
    }

    _addToPlaylistSheet(song) {
        const lists = this.data.getUserPlaylists();
        this._openOverlay(`
            <div class="mz-sheet-title">收藏到歌单</div>
            <div class="mz-pl-list sheet">
                <button type="button" class="mz-pl-row" data-pick="__new"><span class="mz-pl-cover mz-pl-cover-add">${ic('plus', 24)}</span><span class="mz-pl-meta"><b>新建歌单</b></span></button>
                ${lists.map(p => `
                    <button type="button" class="mz-pl-row" data-pick="${esc(p.id)}">
                        <span class="mz-pl-cover">${img(p.songs?.[0]?.pic, 120)}</span>
                        <span class="mz-pl-meta"><b>${esc(p.name)}</b><small>${(p.songs || []).length} 首</small></span>
                    </button>`).join('')}
            </div>`, {
            onMount: (overlay) => {
                overlay.querySelectorAll('[data-pick]').forEach(btn => {
                    btn.onclick = async () => {
                        let id = btn.dataset.pick;
                        if (id === '__new') {
                            this._closeOverlay();
                            const name = await this._ask({ title: '新建歌单', placeholder: '歌单名称' });
                            if (!name) return;
                            id = this.data.createPlaylist(name)?.id;
                            if (!id) return;
                        } else {
                            this._closeOverlay();
                        }
                        const added = this.data.addToPlaylist(id, song);
                        this.toast(added ? '已收藏到歌单' : '歌单里已经有这首歌了');
                        this._refreshTab();
                    };
                });
            }
        });
    }

    _queueSheet() {
        const queue = this.data.getQueue();
        const mode = this.data.getPlayMode();
        const label = PLAY_MODES.find(m => m.id === mode)?.label || '';
        this._openOverlay(`
            <div class="mz-queue-head">
                <b>当前播放 <small>(${queue.length})</small></b>
                <button type="button" class="mz-chip-btn" data-q="mode">${ic(MODE_ICON[mode], 16)} ${label}</button>
                <button type="button" class="mz-icon-btn sm" data-q="clear" aria-label="清空">${ic('trash', 19)}</button>
            </div>
            <div class="mz-queue-list mz-scroll">
                ${queue.length ? queue.map((s, i) => `
                    <div class="mz-queue-row ${i === this.data.currentIndex ? 'on' : ''}" data-q="play" data-idx="${i}">
                        <span class="mz-queue-name"><b>${esc(s.name)}</b><small> - ${esc(s.artist)}</small></span>
                        <button type="button" class="mz-icon-btn sm" data-q="remove" data-idx="${i}" aria-label="移除">${ic('close', 16)}</button>
                    </div>`).join('') : '<div class="mz-empty">播放列表是空的</div>'}
            </div>`, {
            cls: 'tall',
            onMount: (overlay) => {
                const cur = overlay.querySelector('.mz-queue-row.on');
                if (cur) cur.scrollIntoView({ block: 'center' });
                overlay.addEventListener('click', (e) => {
                    const el = e.target.closest('[data-q]');
                    if (!el) return;
                    e.stopPropagation();
                    const q = el.dataset.q;
                    const idx = Number(el.dataset.idx);
                    if (q === 'play') { this.data.playAt(idx); this._closeOverlay(); }
                    if (q === 'remove') { this.data.removeFromQueue(idx); this._queueSheet(); }
                    if (q === 'mode') { this.data.cyclePlayMode(); this._queueSheet(); }
                    if (q === 'clear') { this.data.clearQueue(); this._closeOverlay(); }
                });
            }
        });
    }

    async _shareSheet({ song, mode = 'share', excerpt = null, note = '' }) {
        if (!song) return;
        if (mode === 'listen' && !this.data.getListeningSnapshot()) {
            this.toast('先播放一首歌，再邀请一起听');
            return;
        }
        const overlay = this._openOverlay(`
            <div class="mz-sheet-title">${mode === 'listen' ? '邀请一起听' : '分享到微信'}</div>
            ${this._sheetHeadHtml(song)}
            ${excerpt?.length ? `<blockquote class="mz-share-quote">${excerpt.map(l => `<p>${esc(l.txt)}</p>`).join('')}</blockquote>` : ''}
            <div class="mz-seg in-sheet">
                <button type="button" class="on" data-share-tab="singles">私聊</button>
                <button type="button" data-share-tab="groups">群聊</button>
            </div>
            <div class="mz-share-list mz-scroll"><div class="mz-loading"><i></i><i></i><i></i></div></div>
            <div class="mz-share-send" hidden>
                <input class="mz-input" data-share-text placeholder="${mode === 'listen' ? '说点什么（可选）' : '给对方留言（可选）'}" autocomplete="off">
                <button type="button" class="mz-btn primary" data-share-go>发送</button>
            </div>`, { cls: 'tall' });
        if (!overlay) return;

        let targets;
        try {
            targets = await listShareTargets(this.app.storage);
        } catch (_e) {
            targets = { singles: [], groups: [] };
        }
        if (!overlay.isConnected) return;
        let tab = 'singles';
        let picked = null;
        const listEl = overlay.querySelector('.mz-share-list');
        const sendBar = overlay.querySelector('.mz-share-send');
        const paint = () => {
            const items = targets[tab] || [];
            listEl.innerHTML = items.length
                ? items.map((t, i) => `
                    <button type="button" class="mz-share-row ${picked === t ? 'on' : ''}" data-share-idx="${i}">
                        <span class="mz-share-avatar">${t.avatar ? `<img src="${esc(t.avatar)}" alt="">` : esc(Array.from(t.name || '?')[0])}</span>
                        <span class="mz-share-name">${esc(t.name)}${t.kind === 'group' && t.memberCount ? `<small>${t.memberCount} 人</small>` : ''}</span>
                        <i>${ic('check', 18)}</i>
                    </button>`).join('')
                : `<div class="mz-empty">${tab === 'groups' ? '微信里还没有群聊' : '微信里还没有好友'}</div>`;
        };
        paint();
        overlay.addEventListener('click', async (e) => {
            const tabBtn = e.target.closest('[data-share-tab]');
            if (tabBtn) {
                tab = tabBtn.dataset.shareTab;
                overlay.querySelectorAll('[data-share-tab]').forEach(b => b.classList.toggle('on', b === tabBtn));
                picked = null;
                sendBar.hidden = true;
                paint();
                return;
            }
            const row = e.target.closest('[data-share-idx]');
            if (row) {
                picked = (targets[tab] || [])[Number(row.dataset.shareIdx)] || null;
                sendBar.hidden = !picked;
                paint();
                return;
            }
            if (e.target.closest('[data-share-go]') && picked) {
                const text = overlay.querySelector('[data-share-text]')?.value.trim() || '';
                try {
                    if (mode === 'listen') {
                        await inviteListenInWechat(this.app.storage, picked, this.data.getListeningSnapshot());
                        if (text) await shareSongToWechatTextOnly(this.app.storage, picked, text);
                        this._listenJoinAt = Date.now() + 2600;
                        this.toast(`已邀请 ${picked.name} 一起听`);
                        await this._loadListenSession();
                        this._paintListen();
                    } else {
                        await shareSongToWechat(this.app.storage, picked, song, { excerpt: excerpt || [], note, text });
                        this.toast(`已分享给 ${picked.name}`);
                    }
                    this._closeOverlay();
                } catch (err) {
                    this.toast(err?.message || '发送失败');
                }
            }
        });
    }

    async _excerptSheet(song) {
        if (!song) return;
        const isCurrent = this.data.sameSong(song, this.data.getCurrentSong());
        let lyrics = isCurrent ? this.data.currentLyrics : [];
        const overlay = this._openOverlay(`
            <div class="mz-sheet-title">摘录</div>
            ${this._sheetHeadHtml(song)}
            <div class="mz-excerpt-lines mz-scroll"><div class="mz-loading"><i></i><i></i><i></i></div></div>
            <textarea class="mz-textarea sm" data-ex-note placeholder="写下此刻的想法（可选）"></textarea>
            <div class="mz-row-btns">
                <button type="button" class="mz-btn" data-ex="save">保存到笔记</button>
                <button type="button" class="mz-btn primary" data-ex="share">保存并分享</button>
            </div>`, { cls: 'tall' });
        if (!overlay) return;
        if (!lyrics?.length) {
            try { lyrics = await this.data.api.getLyrics(song); } catch (_e) { lyrics = []; }
        }
        if (!overlay.isConnected) return;
        const box = overlay.querySelector('.mz-excerpt-lines');
        const currentIdx = isCurrent ? this.data.getLyricIndex() : -1;
        const selected = new Set(currentIdx >= 0 ? [currentIdx] : []);
        if (!lyrics.length) {
            box.innerHTML = '<div class="mz-empty">这首歌暂时没有歌词，可以只写笔记</div>';
        } else {
            box.innerHTML = lyrics.map((l, i) => `
                <button type="button" class="mz-ex-line ${selected.has(i) ? 'on' : ''}" data-ex-line="${i}">
                    <span>${esc(l.txt)}${l.tr ? `<small>${esc(l.tr)}</small>` : ''}</span><i>${ic('check', 16)}</i>
                </button>`).join('');
            const cur = box.querySelector('.mz-ex-line.on');
            if (cur) cur.scrollIntoView({ block: 'center' });
        }
        overlay.addEventListener('click', (e) => {
            const line = e.target.closest('[data-ex-line]');
            if (line) {
                const i = Number(line.dataset.exLine);
                if (selected.has(i)) selected.delete(i);
                else if (selected.size < 8) selected.add(i);
                else this.toast('最多摘录 8 句');
                line.classList.toggle('on', selected.has(i));
                return;
            }
            const btn = e.target.closest('[data-ex]');
            if (!btn) return;
            const lines = [...selected].sort((a, b) => a - b).map(i => lyrics[i]).filter(Boolean);
            const note = overlay.querySelector('[data-ex-note]')?.value.trim() || '';
            if (!lines.length && !note) {
                this.toast('选几句歌词，或者写点什么');
                return;
            }
            this.data.addNote({ song, lines, note, position: isCurrent ? this.data.audioPlayer.currentTime : 0 });
            this._refreshTab();
            if (btn.dataset.ex === 'share') {
                this._closeOverlay();
                setTimeout(() => this._shareSheet({ song, mode: 'share', excerpt: lines, note }), 230);
            } else {
                this._closeOverlay();
                this.toast('已保存到笔记');
            }
        });
    }

    async _plMoreSheet(kind, id) {
        if (kind === 'local') {
            const p = this.data.getUserPlaylist(id);
            if (!p) return;
            this._openOverlay(`
                <div class="mz-sheet-title">${esc(p.name)}</div>
                <div class="mz-menu">
                    <button type="button" data-pm="rename">${ic('edit', 21)}<span>重命名</span></button>
                    <button type="button" data-pm="delete">${ic('trash', 21)}<span>删除歌单</span></button>
                </div>`, {
                onMount: (overlay) => {
                    overlay.querySelector('[data-pm="rename"]').onclick = async () => {
                        this._closeOverlay();
                        const name = await this._ask({ title: '重命名歌单', value: p.name });
                        if (name) { this.data.renamePlaylist(id, name); this._afterPlaylistEdit(id); }
                    };
                    overlay.querySelector('[data-pm="delete"]').onclick = async () => {
                        this._closeOverlay();
                        if (await this._confirm(`删除歌单「${p.name}」？`, '删除')) {
                            this.data.deletePlaylist(id);
                            if (this.listCtx?.id === id && this.stack.includes('music-list')) this.back();
                            this._refreshTab();
                        }
                    };
                }
            });
            return;
        }
        const info = this._collectedLists().find(p => String(p.id) === String(id));
        if (!info) return;
        const isLocalCollect = this.data.isCollected(id);
        this._openOverlay(`
            <div class="mz-sheet-title">${esc(info.name)}</div>
            <div class="mz-menu">
                <button type="button" data-pm="open">${ic('play', 21)}<span>打开歌单</span></button>
                ${isLocalCollect ? `<button type="button" data-pm="uncollect">${ic('trash', 21)}<span>取消收藏</span></button>` : ''}
            </div>`, {
            onMount: (overlay) => {
                overlay.querySelector('[data-pm="open"]').onclick = () => { this._closeOverlay(); this.openList({ kind: 'netease', id, name: info.name }); };
                const un = overlay.querySelector('[data-pm="uncollect"]');
                if (un) un.onclick = () => { this._closeOverlay(); this.data.toggleCollect(info); this._refreshTab(); };
            }
        });
    }

    _afterPlaylistEdit(id) {
        this._refreshTab();
        if (this.listCtx?.kind === 'local' && this.listCtx.id === id) {
            const p = this.data.getUserPlaylist(id);
            this.listCtx.name = p?.name || this.listCtx.name;
            this._repaintList();
        }
    }

    _pickLocalFiles() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.multiple = true;
        input.onchange = () => {
            const files = [...(input.files || [])];
            files.forEach(file => {
                const base = file.name.replace(/\.[^.]+$/, '');
                const [a, b] = base.split(/\s+-\s+/);
                this.localFiles.push(this.data.normalizeSong({
                    id: '',
                    name: b ? b : a,
                    artist: b ? a : '本地音乐',
                    localUrl: URL.createObjectURL(file)
                }));
            });
            if (files.length) {
                this.toast(`已添加 ${files.length} 首本地歌曲`);
                if (this.listCtx?.kind === 'localfiles') {
                    this.listCtx.songs = this.localFiles;
                    this._repaintList();
                }
            }
        };
        input.click();
    }

    // ================= 事件分发 =================

    _bindLayer(root) {
        if (!root || root._mzBound) return;
        root._mzBound = true;
        root.addEventListener('click', (e) => this._onClick(e, root));
    }

    async _onClick(e, root) {
        const tabEl = e.target.closest('[data-tab]');
        if (tabEl && root.contains(tabEl)) {
            this._switchTab(tabEl.dataset.tab);
            return;
        }
        const el = e.target.closest('[data-act]');
        if (!el || !root.contains(el)) return;
        const act = el.dataset.act;
        if (el.closest('.mz-sheet') && !root.classList.contains('mz-overlay')) return;
        e.stopPropagation();

        const d = this.data;
        const list = el.dataset.list;
        const idx = Number(el.dataset.idx);

        switch (act) {
            case 'back': this.back(); break;
            case 'settings': this.openSettings(); break;
            case 'login':
            case 'account': this.openLogin(); break;
            case 'open-player': this.openPlayer(); break;
            case 'mini-play': this._miniPlay(); break;
            case 'queue': this._queueSheet(); break;

            case 'edit-status': {
                const v = await this._ask({ title: '添加状态', placeholder: '正在听什么、此刻心情…', value: d.getProfile().status || '' });
                if (v !== null) { d.setProfile({ status: v.slice(0, 20) }); this._refreshTab(); }
                break;
            }
            case 'edit-profile': {
                if (d.isLoggedIn()) { this.openLogin(); break; }
                const name = await this._ask({ title: '昵称', value: this._accountView().name });
                if (name === null) break;
                const tag = await this._ask({ title: '个性标签', placeholder: '比如：NCT 乐迷', value: d.getProfile().tag || '' });
                d.setProfile({ name: name || '', tag: (tag || '').slice(0, 16) });
                this._refreshTab();
                break;
            }
            case 'main-tab': this.mainTab = el.dataset.v; this._refreshTab(); break;
            case 'mine-sub': this.mineSub = el.dataset.v; this._refreshTab(); break;
            case 'quick-recent': this.openList({ kind: 'recent' }); break;
            case 'quick-local': this.openList({ kind: 'localfiles' }); break;
            case 'pick-local': this._pickLocalFiles(); break;
            case 'quick-lyrics':
                if (!d.getCurrentSong()) { this.toast('先播放一首歌'); break; }
                this.openPlayer({ face: 'lyrics' });
                break;
            case 'open-list':
                this.openList({ kind: el.dataset.kind, id: el.dataset.id || '', name: el.dataset.name || '' });
                break;
            case 'pl-more': this._plMoreSheet(el.dataset.kind, el.dataset.id); break;
            case 'heart-mode': {
                const liked = this.listCtx?.kind === 'liked' && this.listCtx.songs?.length ? this.listCtx.songs : d.getLiked();
                if (!liked.length) { this.toast('先给几首歌点上红心吧'); break; }
                d.playList(liked, 0, { shuffle: true });
                this.toast('心动模式：随机播放你喜欢的歌');
                break;
            }
            case 'create-pl': {
                const name = await this._ask({ title: '新建歌单', placeholder: '歌单名称' });
                if (name) { d.createPlaylist(name); this.mineSub = 'created'; this._refreshTab(); this.toast('歌单已创建'); }
                break;
            }
            case 'import-pl': {
                const text = await this._ask({ title: '导入网易云歌单', placeholder: '粘贴歌单分享链接或歌单 ID', confirmText: '导入' });
                if (!text) break;
                const id = MusicApi.parsePlaylistId(text);
                if (!id) { this.toast('没有识别到歌单 ID'); break; }
                this.toast('正在读取歌单…');
                try {
                    const res = await d.api.getPlaylistTracks(id);
                    if (!res.songs.length) { this.toast('歌单是空的，或暂时读取不到'); break; }
                    const name = res.info?.name || await this._ask({ title: '给歌单起个名字', value: `导入的歌单` }) || '导入的歌单';
                    if (!d.isCollected(id)) {
                        d.toggleCollect({ id, name, cover: res.info?.cover || res.songs[0]?.pic || '', count: res.songs.length, creator: res.info?.creator || '' });
                    }
                    this.mineSub = 'collected';
                    this._refreshTab();
                    this.toast(`已导入「${name}」${res.songs.length} 首`);
                } catch (_err) {
                    this.toast('导入失败，请稍后重试');
                }
                break;
            }

            // 首页
            case 'kw':
                this.search.mode = 'songs';
                this.data.addSearchHistory(el.dataset.kw);
                this._switchTab('search');
                this._runSearch(el.dataset.kw);
                break;
            case 'daily': {
                try {
                    const songs = await d.api.dailySongs();
                    if (songs.length) d.playList(songs, 0); else this.toast('每日推荐暂时为空');
                } catch (_e2) { this.toast('获取每日推荐失败'); }
                break;
            }
            case 'daily-open': this.openList({ kind: 'daily' }); break;

            // 搜索
            case 'search-clear':
                this.search.keyword = '';
                this.search.songs = [];
                this.search.playlists = [];
                { const input = this._layer('music')?.querySelector('.mz-search-input'); if (input) input.value = ''; }
                this._paintSearchBody();
                break;
            case 'clear-search-history': d.clearSearchHistory(); this._paintSearchBody(); this.toast('搜索历史已清空'); break;
            case 'search-mode':
                if (this.search.mode === el.dataset.v) break;
                this.search.mode = el.dataset.v;
                this._runSearch(this.search.keyword);
                break;
            case 'search-retry': this._runSearch(this.search.keyword); break;
            case 'load-more': this._runSearch(this.search.keyword, { page: this.search.page + 1 }); break;
            case 'search-pl': {
                const p = this.search.playlists[idx];
                if (p) { d.addSearchHistory(this.search.keyword); this.openList({ kind: 'netease', id: p.id, name: p.name }); }
                break;
            }

            // 歌曲
            case 'play-all':
            case 'shuffle-all': {
                const songs = this._songsFor(list);
                if (!songs.length) break;
                if (list === 'search') d.addSearchHistory(this.search.keyword);
                if (act === 'play-all' && d.getPlayMode() === 'shuffle') d.setPlayMode('loop');
                d.playList(songs, 0, { shuffle: act === 'shuffle-all' });
                break;
            }
            case 'song': {
                const songs = this._songsFor(list);
                const song = songs[idx];
                if (!song) break;
                if (list === 'search') d.addSearchHistory(this.search.keyword);
                if (this.data.sameSong(song, d.getCurrentSong())) { this.openPlayer(); break; }
                if (list === 'hist') d.playSong(song);
                else d.playList(songs, idx);
                break;
            }
            case 'song-more': this._songMenu(this._songsFor(list)[idx], { listName: list, index: idx }); break;
            case 'list-retry': if (this.listCtx) this.openList({ kind: this.listCtx.kind, id: this.listCtx.id, name: this.listCtx.name }); break;
            case 'list-collect': {
                const ctx = this.listCtx;
                if (!ctx) break;
                const on = d.toggleCollect({ id: ctx.id, name: ctx.name, cover: ctx.cover || ctx.songs?.[0]?.pic || '', count: ctx.count || ctx.songs?.length || 0, creator: ctx.creator || '' });
                this.toast(on ? '已收藏歌单' : '已取消收藏');
                this._repaintList();
                this._refreshTab();
                break;
            }
            case 'clear-history':
                if (await this._confirm('清空播放历史？', '清空')) {
                    d.clearHistory();
                    if (this.listCtx?.kind === 'recent') { this.listCtx.songs = []; this._repaintList(); }
                    this.toast('播放历史已清空');
                }
                break;

            // 笔记
            case 'note-new': {
                const song = d.getCurrentSong();
                if (!song) { this.toast('先播放一首歌'); break; }
                this._excerptSheet(song);
                break;
            }
            case 'note-play': {
                const n = d.getNotes().find(x => x.id === el.dataset.id);
                if (!n) break;
                await d.playSong(n.song);
                if (n.position > 3 && d.sameSong(d.getCurrentSong(), n.song)) d.seek(Math.max(0, n.position - 2));
                break;
            }
            case 'note-share': {
                const n = d.getNotes().find(x => x.id === el.dataset.id);
                if (n) this._shareSheet({ song: n.song, mode: 'share', excerpt: n.lines, note: n.note });
                break;
            }
            case 'note-del':
                if (await this._confirm('删除这条笔记？', '删除')) { d.deleteNote(el.dataset.id); this._refreshTab(); }
                break;

            // 播放页
            case 'toggle-face': {
                if (e.target.closest('.mz-lyric-line') && el.closest('[data-face]')?.dataset.face === 'lyrics') {
                    const line = e.target.closest('.mz-lyric-line');
                    const t = Number(line.dataset.t);
                    if (Number.isFinite(t)) { d.seek(t); this._lyricsTouchedAt = 0; break; }
                }
                const room = el.closest('.mz-listen');
                if (room) {
                    this.listenFace = this.listenFace === 'disc' ? 'lyrics' : 'disc';
                    room.dataset.face = this.listenFace;
                    room.querySelectorAll('[data-act="l-face"]').forEach(b => b.classList.toggle('on', b.dataset.v === this.listenFace));
                } else {
                    this.playerFace = this.playerFace === 'disc' ? 'lyrics' : 'disc';
                    const player = this._layer('music-player')?.querySelector('.mz-player');
                    if (player) player.dataset.face = this.playerFace;
                }
                this._lyricsTouchedAt = 0;
                this._syncLyrics(true);
                break;
            }
            case 'p-play': d.togglePlay(); break;
            case 'p-prev': d.prev(); break;
            case 'p-next': d.next(); break;
            case 'p-mode': {
                const mode = d.cyclePlayMode();
                this.toast(PLAY_MODES.find(m => m.id === mode)?.label || '');
                break;
            }
            case 'p-like': { const s = d.getCurrentSong(); if (s) this._toggleLike(s); break; }
            case 'p-excerpt': this._excerptSheet(d.getCurrentSong()); break;
            case 'p-share': this._shareSheet({ song: d.getCurrentSong(), mode: 'share' }); break;
            case 'p-listen': this.openListen(); break;
            case 'edit-cover': this._coverSheet(); break;
            case 'l-invite': this._shareSheet({ song: d.getCurrentSong(), mode: 'listen' }); break;
            case 'l-poke': this._poke(); break;
            case 'l-face': {
                this.listenFace = el.dataset.v;
                const room = this._layer('music-listen')?.querySelector('.mz-listen');
                if (room) room.dataset.face = this.listenFace;
                room?.querySelectorAll('[data-act="l-face"]').forEach(b => b.classList.toggle('on', b.dataset.v === this.listenFace));
                this._syncLyrics(true);
                break;
            }
            case 'l-more': {
                const song = d.getCurrentSong();
                if (song) this._songMenu(song, { listName: 'queue', index: d.currentIndex });
                break;
            }
            case 'p-more': this._songMenu(d.getCurrentSong(), { listName: 'queue', index: d.currentIndex }); break;

            // 设置
            case 'cycle-mode': {
                const mode = d.cyclePlayMode();
                const lab = this._layer('music-settings')?.querySelector('.mz-mode-label');
                if (lab) lab.textContent = PLAY_MODES.find(m => m.id === mode)?.label || '';
                break;
            }
            case 'toggle-floating': {
                const next = !this.app.storage.get('music_show_floating', false);
                this.app.storage.set('music_show_floating', next);
                el.classList.toggle('on', next);
                if (next) this.renderFloatingWidget(); else this.destroyFloatingWidget();
                break;
            }
            case 'toggle-autoplay': {
                const next = !d.getAutoPlay();
                d.setAutoPlay(next);
                el.classList.toggle('on', next);
                break;
            }
            case 'clear-recs':
                if (await this._confirm('清空当前剧情里角色推荐的歌？', '清空')) { d.clearPlaylist(); this.toast('已清空'); this._refreshTab(); }
                break;
            case 'prompt-save': {
                const pm = window.VirtualPhone?.promptManager;
                const ta = this._layer('music-settings')?.querySelector('#music-prompt-textarea');
                if (!pm || !ta) break;
                try {
                    (pm.updateActivePromptUserPreset?.('music', 'recommend', ta.value)) ?? pm.updatePrompt?.('music', 'recommend', ta.value);
                    this.toast('提示词已保存');
                } catch (err) {
                    this.toast(err?.message || '请先新增预设再保存');
                }
                break;
            }
            case 'prompt-reset': {
                const pm = window.VirtualPhone?.promptManager;
                const ta = this._layer('music-settings')?.querySelector('#music-prompt-textarea');
                if (!pm || !ta) break;
                pm.ensureLoaded?.();
                ta.value = pm.resetPromptToDefault?.('music', 'recommend') ?? pm.getDefaultPrompts?.().music?.recommend?.content ?? '';
                this.toast('已恢复默认提示词');
                break;
            }

            // 登录
            case 'api-save': {
                const layer = this._layer('music-login');
                const base = (layer?.querySelector('[data-input="api-base"]')?.value || '').trim().replace(/\/+$/, '');
                const realIP = !!layer?.querySelector('[data-input="real-ip"]')?.checked;
                if (!/^https?:\/\//i.test(base)) { this.toast('请填写以 http:// 或 https:// 开头的地址'); break; }
                d.setNcmConfig({ apiBase: base, realIP });
                this.toast('正在测试连接…');
                try {
                    await d.api.ncm('/search/hot', {}, { withCookie: false, timeout: 8000 });
                    this.toast('连接成功');
                } catch (_e3) {
                    this.toast('连接失败：请确认地址可以在浏览器里打开，且允许跨域');
                }
                this.back();
                this.openLogin();
                break;
            }
            case 'api-clear':
                d.setNcmConfig({ apiBase: '', cookie: '', profile: null, stats: null, cloudPlaylists: [], likeIds: [] });
                this.toast('已切换为游客模式');
                this.back();
                this.openLogin();
                this._refreshTab();
                break;
            case 'qr-refresh': this._startQr(); break;
            case 'cookie-login': {
                const raw = (this._layer('music-login')?.querySelector('[data-input="cookie"]')?.value || '').trim();
                if (!raw) { this.toast('请先粘贴 Cookie'); break; }
                const cookie = /MUSIC_U=/.test(raw) ? raw : `MUSIC_U=${raw}`;
                d.setNcmConfig({ cookie });
                this.toast('正在验证…');
                await this._afterLogin();
                break;
            }
            case 'sync-account':
                this.toast('正在同步…');
                await d.refreshAccount().catch(() => null);
                this.toast('同步完成');
                this.back();
                this.openLogin();
                this._refreshTab();
                break;
            case 'logout':
                if (await this._confirm('退出网易云账号？本地喜欢和歌单会保留。', '退出')) {
                    await d.logout();
                    this.toast('已退出登录');
                    this.back();
                    this.openLogin();
                    this._refreshTab();
                }
                break;
            default:
                break;
        }
    }

    _miniPlay() {
        const d = this.data;
        if (!d.getCurrentSong()) {
            const fallback = d.getLiked().length ? d.getLiked() : d.getHistory();
            if (fallback.length) d.playList(fallback, 0);
            else this.toast('去搜索页找首歌吧');
            return;
        }
        d.togglePlay();
    }

    // ================= 刷新 =================

    _librarySignature() {
        const d = this.data;
        const cfg = d.getNcmConfig();
        return [
            d.getLiked().length, d.getUserPlaylists().map(p => `${p.id}:${p.name}:${(p.songs || []).length}`).join(','),
            d.getCollected().length, d.getNotes().length, d.getPlaylist().length,
            JSON.stringify(d.getProfile()), cfg.profile?.userId || '', (cfg.cloudPlaylists || []).length,
            d.getListenHours(), cfg.apiBase ? 1 : 0, d.getHistory()[0]?.name || '',
            JSON.stringify(d.getCardData() || {}).length
        ].join('|');
    }

    updateDisplay() {
        this._updateFloating();
        const screen = this._screen();
        if (!screen) return;
        const d = this.data;
        const song = d.getCurrentSong();
        const playing = d.isPlaying;
        const loading = d.isLoading;

        screen.querySelectorAll('.mz-mini').forEach(mini => {
            const imgEl = mini.querySelector('.mz-mini-disc img');
            const want = song ? coverOf(song.pic, 120) : DEFAULT_COVER;
            if (imgEl && imgEl.getAttribute('src') !== want) imgEl.setAttribute('src', want);
            mini.querySelector('.mz-mini-disc')?.classList.toggle('spin', playing);
            const title = mini.querySelector('.mz-mini-title');
            const artist = mini.querySelector('.mz-mini-artist');
            if (title) title.textContent = song ? song.name : '还没有在听的歌';
            if (artist) artist.textContent = song ? ` - ${loading ? '加载中…' : song.artist}` : '';
            const playIc = mini.querySelector('.mz-mini-play-ic');
            if (playIc) playIc.innerHTML = ic(playing ? 'pause' : 'play', 16);
            mini.classList.toggle('loading', loading);
        });

        const key = song ? d.songKey(song) : '';
        screen.querySelectorAll('.mz-song-row').forEach(row => {
            const on = !!key && row.dataset.key === key;
            row.classList.toggle('is-current', on);
            row.classList.toggle('is-playing', on && playing);
        });

        this._updatePlayer(screen, song, 'music-player');
        this._updatePlayer(screen, song, 'music-listen');

        // 我的 / 笔记 / 首页：曲库变化时重绘
        const sig = this._librarySignature();
        if (sig !== this._libSig) {
            this._libSig = sig;
            const layer = this._layer('music');
            if (layer && ['mine', 'notes', 'home'].includes(this.tab)) this._renderTab(layer, { keepScroll: true });
        }
        this.onTime(d.audioPlayer.currentTime, d.audioPlayer.duration);
    }

    _updatePlayer(screen, song, viewId = 'music-player') {
        const player = screen.querySelector(`[data-view-id="${viewId}"] .mz-app`);
        if (!player) return;
        const d = this.data;
        const cover = coverOf(song?.pic, 600);
        const bg = player.querySelector('.mz-player-bg');
        if (bg && bg.dataset.src !== cover) {
            bg.dataset.src = cover;
            bg.style.backgroundImage = `url('${cover.replace(/'/g, '%27')}')`;
        }
        const discImg = player.querySelector('.mz-disc-cover img, .mz-vinyl-label img');
        if (discImg && discImg.getAttribute('src') !== cover) discImg.setAttribute('src', cover);
        player.querySelector('.mz-disc, .mz-vinyl')?.classList.toggle('spin', d.isPlaying);
        player.classList.toggle('is-playing', d.isPlaying);
        const t = player.querySelector('.mz-player-title b');
        const a = player.querySelector('.mz-player-title small');
        if (t) t.textContent = song?.name || '还没有在听的歌';
        if (a) a.textContent = song ? (d.isLoading ? '正在加载…' : (d.lastError || song.artist)) : '';
        const like = player.querySelector('[data-act="p-like"]');
        if (like) {
            const liked = !!song && d.isLiked(song);
            like.classList.toggle('on', liked);
            like.innerHTML = ic(liked ? 'heartFill' : 'heart', 24);
        }
        const mode = d.getPlayMode();
        const modeBtn = player.querySelector('.mz-ctl-mode');
        if (modeBtn && modeBtn.dataset.mode !== mode) {
            modeBtn.dataset.mode = mode;
            modeBtn.innerHTML = ic(MODE_ICON[mode], 24);
            modeBtn.setAttribute('aria-label', PLAY_MODES.find(m => m.id === mode)?.label || '');
        }
        const play = player.querySelector('.mz-ctl-play');
        if (play) {
            const state = d.isLoading ? 'loading' : (d.isPlaying ? 'pause' : 'play');
            if (play.dataset.state !== state) {
                play.dataset.state = state;
                play.innerHTML = state === 'loading' ? '<span class="mz-spinner"></span>' : ic(state, 30);
            }
        }
        this._renderLyrics(player, song);
    }

    _activePlayer() {
        const screen = this._screen();
        if (!screen) return null;
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const id = this.stack[i];
            if (id === 'music-player' || id === 'music-listen') {
                return screen.querySelector(`[data-view-id="${id}"] .mz-app`);
            }
        }
        return null;
    }

    _renderLyrics(player, song) {
        const inner = player.querySelector('.mz-lyrics-inner');
        if (!inner) return;
        const lyrics = this.data.currentLyrics || [];
        const key = `${song ? this.data.songKey(song) : ''}#${lyrics.length}#${this.data.isLoading ? 1 : 0}`;
        if (inner.dataset.key === key) return;
        inner.dataset.key = key;
        player.dataset.lyricIdx = '-1';
        if (!song) inner.innerHTML = '<p class="mz-lyric-empty">还没有在听的歌</p>';
        else if (!lyrics.length) inner.innerHTML = `<p class="mz-lyric-empty">${this.data.isLoading ? '歌词加载中…' : '纯音乐，或暂时没有歌词'}</p>`;
        else inner.innerHTML = lyrics.map((l, i) => `<p class="mz-lyric-line" data-i="${i}" data-t="${l.t}">${esc(l.txt)}${l.tr ? `<small>${esc(l.tr)}</small>` : ''}</p>`).join('');
        this._syncLyrics(true, player);
    }

    _syncLyrics(force = false, player = this._activePlayer()) {
        if (!player) return;
        const idx = this.data.getLyricIndex();
        const lyrics = this.data.currentLyrics || [];
        const discLine = player.querySelector('.mz-disc-line');
        if (discLine) discLine.textContent = idx >= 0 ? (lyrics[idx]?.txt || '') : '';
        if (String(idx) === player.dataset.lyricIdx && !force) return;
        player.dataset.lyricIdx = String(idx);
        const box = player.querySelector('.mz-lyrics');
        if (!box) return;
        box.querySelectorAll('.mz-lyric-line.on').forEach(el => el.classList.remove('on'));
        const line = idx >= 0 ? box.querySelector(`.mz-lyric-line[data-i="${idx}"]`) : null;
        if (line) line.classList.add('on');
        if (!line || player.dataset.face !== 'lyrics') return;
        if (!force && Date.now() - this._lyricsTouchedAt < 3000) return;
        const top = line.offsetTop - box.clientHeight / 2 + line.offsetHeight / 2;
        box.scrollTo({ top: Math.max(0, top), behavior: force ? 'auto' : 'smooth' });
    }

    onTime(t, dur) {
        const screen = this._screen();
        const d = Number(dur);
        const ratio = Number.isFinite(d) && d > 0 ? Math.min(1, (Number(t) || 0) / d) : 0;
        if (screen && screen.isConnected) {
            screen.querySelectorAll('.mz-mini .mz-ring-fg').forEach(c => {
                c.style.strokeDashoffset = String(100.53 * (1 - ratio));
            });
            const player = this._activePlayer();
            if (player && !this._seeking) {
                const fill = player.querySelector('.mz-bar-fill');
                if (fill) fill.style.width = `${ratio * 100}%`;
                const cur = player.querySelector('.mz-time-cur');
                const total = player.querySelector('.mz-time-dur');
                if (cur) cur.textContent = fmtTime(t);
                if (total) total.textContent = fmtTime(Number.isFinite(d) ? d : (this.data.getCurrentSong()?.duration || 0));
                this._syncLyrics(false, player);
            }
        }
        if (this._float) {
            const bar = this._float.querySelector('.mz-float-progress i');
            if (bar) bar.style.width = `${ratio * 100}%`;
        }
    }

    _stopProgressTimer() {
        // 进度由 audio timeupdate 驱动，不需要定时器；保留旧接口供 index.js 调用
    }

    // ================= 全局悬浮播放器 =================

    _floatingRoot() {
        let root = document.getElementById('music-floating-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'music-floating-root';
            Object.assign(root.style, {
                position: 'fixed', top: '0', left: '0', width: '0', height: '0',
                zIndex: '2147483640', pointerEvents: 'none', transform: 'none', contain: 'none'
            });
            document.documentElement.appendChild(root);
        }
        return root;
    }

    renderFloatingWidget() {
        this._injectCSS();
        if (this._float) return;
        const el = document.createElement('div');
        el.className = 'mz-float';
        el.innerHTML = `
            <div class="mz-float-disc" data-f="toggle"><img alt="" src="${DEFAULT_COVER}"></div>
            <div class="mz-float-body">
                <div class="mz-float-text"><b></b><small></small></div>
                <div class="mz-float-ctrls">
                    <button type="button" data-f="prev" aria-label="上一首">${ic('prev', 18)}</button>
                    <button type="button" data-f="play" aria-label="播放"></button>
                    <button type="button" data-f="next" aria-label="下一首">${ic('next', 18)}</button>
                    <button type="button" data-f="like" aria-label="喜欢"></button>
                    <button type="button" data-f="mode" aria-label="播放模式"></button>
                </div>
                <div class="mz-float-progress"><i></i></div>
            </div>`;
        this._floatingRoot().appendChild(el);
        this._float = el;
        this._floatExpanded = false;
        this._placeFloat();
        this._bindFloatDrag(el);
        this._resizeHandler = () => this._placeFloat();
        window.addEventListener('resize', this._resizeHandler);
        this._updateFloating();
    }

    destroyFloatingWidget() {
        if (this._float) {
            this._float.remove();
            this._float = null;
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
    }

    _placeFloat(pos) {
        const el = this._float;
        if (!el) return;
        let saved = pos;
        if (!saved) {
            try {
                const raw = this.app.storage?.get?.(FLOAT_POS_KEY, '');
                saved = typeof raw === 'string' && raw ? JSON.parse(raw) : raw;
            } catch (_e) { saved = null; }
        }
        const w = el.offsetWidth || 52;
        const h = el.offsetHeight || 52;
        const left = Number.isFinite(Number(saved?.left)) ? Number(saved.left) : window.innerWidth - w - 14;
        const top = Number.isFinite(Number(saved?.top)) ? Number(saved.top) : window.innerHeight * 0.72;
        el.style.left = `${Math.max(4, Math.min(window.innerWidth - Math.min(w, 60) - 4, left))}px`;
        el.style.top = `${Math.max(4, Math.min(window.innerHeight - h - 4, top))}px`;
    }

    _bindFloatDrag(el) {
        let sx = 0; let sy = 0; let ox = 0; let oy = 0; let moved = false; let down = false;
        el.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            down = true; moved = false;
            sx = e.clientX; sy = e.clientY;
            ox = parseFloat(el.style.left) || 0; oy = parseFloat(el.style.top) || 0;
            try { el.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
        });
        el.addEventListener('pointermove', (e) => {
            if (!down) return;
            const dx = e.clientX - sx; const dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 6) return;
            moved = true;
            el.style.left = `${ox + dx}px`;
            el.style.top = `${oy + dy}px`;
        });
        el.addEventListener('pointerup', (e) => {
            if (!down) return;
            down = false;
            if (moved) {
                const pos = { left: Math.round(parseFloat(el.style.left)), top: Math.round(parseFloat(el.style.top)) };
                this._placeFloat(pos);
                this.app.storage?.set?.(FLOAT_POS_KEY, JSON.stringify(pos));
            } else if (e.target.closest('[data-f="toggle"]') || !e.target.closest('button')) {
                this._floatExpanded = !this._floatExpanded;
                el.classList.toggle('open', this._floatExpanded);
                this._placeFloat();
            }
        });
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-f]');
            if (!btn) return;
            e.stopPropagation();
            const d = this.data;
            const f = btn.dataset.f;
            if (f === 'play') this._miniPlay();
            if (f === 'prev') d.prev();
            if (f === 'next') d.next();
            if (f === 'like') { const s = d.getCurrentSong(); if (s) d.toggleLike(s); }
            if (f === 'mode') d.cyclePlayMode();
        });
    }

    _updateFloating() {
        const el = this._float;
        if (!el) return;
        const d = this.data;
        const song = d.getCurrentSong();
        const imgEl = el.querySelector('.mz-float-disc img');
        const want = song ? coverOf(song.pic, 120) : DEFAULT_COVER;
        if (imgEl && imgEl.getAttribute('src') !== want) imgEl.setAttribute('src', want);
        el.querySelector('.mz-float-disc')?.classList.toggle('spin', d.isPlaying);
        const b = el.querySelector('.mz-float-text b');
        const s = el.querySelector('.mz-float-text small');
        if (b) b.textContent = song?.name || '没有在播放';
        if (s) s.textContent = song ? (d.isLoading ? '加载中…' : song.artist) : '打开手机里的音乐找首歌';
        const play = el.querySelector('[data-f="play"]');
        if (play) play.innerHTML = ic(d.isPlaying ? 'pause' : 'play', 20);
        const like = el.querySelector('[data-f="like"]');
        if (like) {
            const liked = !!song && d.isLiked(song);
            like.innerHTML = ic(liked ? 'heartFill' : 'heart', 18);
            like.classList.toggle('on', liked);
        }
        const mode = el.querySelector('[data-f="mode"]');
        if (mode) mode.innerHTML = ic(MODE_ICON[d.getPlayMode()], 18);
    }
}

async function shareSongToWechatTextOnly(storage, target, text) {
    const { getWechatData } = await import('./music-share.js');
    const wechatData = await getWechatData(storage);
    const chatId = target.chatId || (target.contact?.id ? `chat_${target.contact.id}` : '');
    const chat = chatId ? wechatData?.getChat?.(chatId) : null;
    if (!chat) return;
    wechatData.addMessage(chat.id, { from: 'me', type: 'text', content: text, avatar: wechatData.getUserInfo?.()?.avatar || '' });
    await Promise.resolve(wechatData.saveData?.());
}
