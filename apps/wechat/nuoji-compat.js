// 🍡 糯叽机美化兼容层（柚月小手机 · 微信）
//
// 作用：把糯叽机的「聊天界面美化 CSS」和「消息 App（聊天列表）美化 CSS」导入到柚月微信里用。
// 做法：美化开启时，给柚月现有的元素额外挂上糯叽机同名的 class（不改柚月原有 class / 功能），
//       再补一层底座 CSS，让糯叽机的变量在柚月元素上生效。关掉美化后重绘一次，就完全回到柚月原样。
// 额外补上的功能：头像框（不开美化也能用）、顶栏电话/视频按钮、返回键旁未读红点、顶栏装饰贴图层、
//                聊天项 / 朋友圈装饰层、装饰槽、日夜时段属性。

import { scopeNuojiCss } from './nuoji-css-scope.js?v=20261018-nj1';
import { buildChatBaseCss, buildListBaseCss, NJ_KEYFRAMES, NJ_FRAME_CSS, NJ_ICON_KEYS } from './nuoji-base-css.js?v=20261018-nj1';

const KEYS = {
    chatProfiles: 'nj_chat_css_profiles_v1',
    chatActive: 'nj_chat_css_active_v1',
    listProfiles: 'nj_list_css_profiles_v1',
    listActive: 'nj_list_css_active_v1',
    frames: 'nj_avatar_frames_v1',
    options: 'nj_options_v1'
};

const CHAT_ROOT = '.wechat-app.nj-chat-on:not(#nj-a):not(#nj-b)';
const LIST_ROOT = '.wechat-app.nj-list-on:not(#nj-a):not(#nj-b)';
const LIST_TAB_CLASSES = ['nj-messaging-chat-tab', 'nj-messaging-moments-tab', 'nj-messaging-profile-tab', 'nj-messaging-favorites-tab', 'nj-messaging-contacts-tab'];

// 美化里写了这些变量才启用对应的「糯叽机外观」（没写就保留柚月原样）
const VAR_FLAGS = {
    chat: { 'nj-tf-on': ['--transfer-card-bg', '--transfer-me-card-bg', '--transfer-them-card-bg', '--transfer-card-radius', '--transfer-amount-color', '--transfer-success-card-bg', '--transfer-card-border'] },
    list: {
        'nj-v-note': ['--nj-msg-chat-note-bubble-bg', '--nj-msg-chat-note-bubble-color'],
        'nj-v-mpost': ['--nj-msg-moments-post-card-bg', '--nj-msg-moments-post-card-radius'],
        'nj-v-mcomment': ['--nj-msg-moments-comment-bg'],
        'nj-v-pavatar': ['--nj-msg-profile-avatar-size', '--nj-msg-profile-avatar-radius']
    }
};

const PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const BACK_SVG = '<svg class="nj-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const MORE_SVG = '<svg class="nj-svg-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
const VIDEO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const addCls = (el, ...cls) => { if (el) cls.forEach(c => c && !el.classList.contains(c) && el.classList.add(c)); };
const togCls = (el, cls, on) => { if (el && el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); };
const setAttr = (el, k, v) => { if (!el) return; const s = String(v); if (el.getAttribute(k) !== s) el.setAttribute(k, s); };
const setVar = (el, k, v) => { if (!el) return; const s = String(v); if (el.style.getPropertyValue(k) !== s) el.style.setProperty(k, s); };

function timeSlots(d = new Date()) {
    const h = d.getHours();
    const ofDay = h >= 5 && h <= 10 ? 'morning' : (h >= 11 && h <= 16 ? 'day' : (h >= 17 && h <= 20 ? 'evening' : 'night'));
    const slot = h < 5 ? 'lateNight' : (h < 7 ? 'dawn' : (h < 11 ? 'morning' : (h < 14 ? 'noon' : (h < 17 ? 'afternoon' : (h < 20 ? 'evening' : 'night')))));
    return { hour: h, ofDay, slot };
}

function lastTypeOf(text) {
    const t = String(text || '').trim();
    if (!t || t === '暂无消息') return 'none';
    if (/^\[(图片|照片)/.test(t)) return 'image';
    if (/^\[(表情|动画表情)/.test(t)) return 'sticker';
    if (/^\[语音/.test(t)) return 'voice';
    if (/红包/.test(t) && /^\[/.test(t)) return 'redpacket';
    if (/转账/.test(t) && /^\[/.test(t)) return 'transfer';
    if (/礼物/.test(t) && /^\[/.test(t)) return 'gift';
    if (/^\[(位置|定位)/.test(t)) return 'location';
    if (/通话/.test(t) && /^\[/.test(t)) return 'call';
    return 'text';
}

export class NuojiCompat {
    constructor(app) {
        this.app = app;
        this.storage = app?.storage;
        this._pending = false;
        this._observer = null;
        this._observeRoot = null;
        this._unreadSnapshot = new Map();
        this._flashUntil = new Map();
        this._lastTab = '';
        this._tabAnimTimer = null;
        try {
            this._injectStatic();
            this.applyStyles();
            this._wrapShell();
            setInterval(() => this.schedule(), 60 * 1000);
            try { window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => this.schedule()); } catch (e) { /* 忽略 */ }
        } catch (e) {
            console.warn('⚠️ [糯叽机美化] 初始化失败:', e);
        }
    }

    // ---------------- 存储 ----------------
    _get(key, fallback) {
        // 读一次就缓存（美化 CSS 可能有几百 KB，每次刷新都 JSON.parse 太慢）
        if (!this._cache) this._cache = new Map();
        if (this._cache.has(key)) {
            const v = this._cache.get(key);
            return v === undefined ? fallback : JSON.parse(JSON.stringify(v));
        }
        const v = this._read(key);
        this._cache.set(key, v);
        return v === undefined ? fallback : JSON.parse(JSON.stringify(v));
    }
    _read(key) {
        try {
            const raw = this.storage?.get?.(key, false);
            if (raw === undefined || raw === null || raw === '') return undefined;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) { return undefined; }
    }
    _set(key, value) {
        if (!this._cache) this._cache = new Map();
        this._cache.set(key, value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
        try { this.storage?.set?.(key, JSON.stringify(value), false); } catch (e) { console.warn('[糯叽机美化] 保存失败', e); }
    }
    getProfiles(kind) { const v = this._get(kind === 'list' ? KEYS.listProfiles : KEYS.chatProfiles, []); return Array.isArray(v) ? v : []; }
    saveProfiles(kind, list) { this._set(kind === 'list' ? KEYS.listProfiles : KEYS.chatProfiles, list); }
    getActiveId(kind) { return String(this._get(kind === 'list' ? KEYS.listActive : KEYS.chatActive, '') || ''); }
    setActiveId(kind, id) { this._set(kind === 'list' ? KEYS.listActive : KEYS.chatActive, String(id || '')); }
    getActiveProfile(kind) { const id = this.getActiveId(kind); return id ? (this.getProfiles(kind).find(p => p.id === id) || null) : null; }
    isActive(kind) {
        if (!this._cache) this._cache = new Map();
        const pk = kind === 'list' ? KEYS.listProfiles : KEYS.chatProfiles;
        const ak = kind === 'list' ? KEYS.listActive : KEYS.chatActive;
        if (!this._cache.has(pk)) this._cache.set(pk, this._read(pk));
        if (!this._cache.has(ak)) this._cache.set(ak, this._read(ak));
        const id = String(this._cache.get(ak) || '');
        const list = this._cache.get(pk);
        return !!(id && Array.isArray(list) && list.some(p => p.id === id && String(p.css || '').trim()));
    }
    getFrames() {
        const v = this._get(KEYS.frames, {});
        return { them: '', me: '', scale: 1.45, offsetY: 0, chats: {}, ...(v && typeof v === 'object' ? v : {}) };
    }
    saveFrames(f) { this._set(KEYS.frames, f); }
    getOptions() { return { headerCalls: true, ...(this._get(KEYS.options, {}) || {}) }; }
    saveOptions(o) { this._set(KEYS.options, o); }
    _hasAnyFrame() {
        const f = this.getFrames();
        if (f.them || f.me) return true;
        return Object.values(f.chats || {}).some(c => c && (c.them || c.me));
    }
    _frameFor(chatId, side) {
        const f = this.getFrames();
        const own = f.chats?.[chatId]?.[side];
        return String(own || f[side] || '').trim();
    }

    // ---------------- 样式注入 ----------------
    _styleTag(id) {
        let tag = document.getElementById(id);
        if (!tag) {
            tag = document.createElement('style');
            tag.id = id;
            document.head.appendChild(tag);
        }
        return tag;
    }
    _injectStatic() {
        this._styleTag('nj-compat-ui').textContent = NJ_UI_CSS;
        this._styleTag('nj-compat-frame').textContent = NJ_FRAME_CSS;
    }
    applyStyles() {
        const chat = this.getActiveProfile('chat');
        const list = this.getActiveProfile('list');
        const anyOn = !!(chat?.css?.trim() || list?.css?.trim());
        this._styleTag('nj-compat-keyframes').textContent = anyOn ? NJ_KEYFRAMES : '';
        this._styleTag('nj-compat-chat-base').textContent = chat?.css?.trim() ? buildChatBaseCss(CHAT_ROOT) : '';
        this._styleTag('nj-compat-list-base').textContent = list?.css?.trim() ? buildListBaseCss(LIST_ROOT) : '';
        let chatCss = '';
        let listCss = '';
        try { chatCss = chat?.css?.trim() ? scopeNuojiCss(chat.css, { root: CHAT_ROOT, rootClasses: ['chat-detail-screen'] }) : ''; } catch (e) { console.warn('[糯叽机美化] 聊天界面 CSS 解析失败', e); }
        try { listCss = list?.css?.trim() ? scopeNuojiCss(list.css, { root: LIST_ROOT, rootClasses: LIST_TAB_CLASSES }) : ''; } catch (e) { console.warn('[糯叽机美化] 聊天列表 CSS 解析失败', e); }
        // 用户美化放在最后，同优先级时盖过底座
        const userChat = this._styleTag('nj-compat-chat-user');
        const userList = this._styleTag('nj-compat-list-user');
        userChat.textContent = chatCss;
        userList.textContent = listCss;
        document.head.appendChild(userChat);
        document.head.appendChild(userList);
        this._syncReferrer(anyOn);
        this.schedule();
    }

    // 图床防盗链：美化开着时让页面上的图片请求不带来源（酒馆本身不依赖来源）
    _syncReferrer(anyOn) {
        try {
            const want = anyOn && this.getOptions().noReferrer !== false;
            let meta = document.getElementById('nj-compat-referrer');
            if (want && !meta) {
                meta = document.createElement('meta');
                meta.id = 'nj-compat-referrer';
                meta.name = 'referrer';
                meta.content = 'no-referrer';
                document.head.prepend(meta);
            } else if (!want && meta) {
                meta.remove();
            }
        } catch (e) { /* 忽略 */ }
    }

    // 切换美化后整页重绘，让关掉的部分回到柚月原样
    refreshApp() {
        this.applyStyles();
        // 正在聊天窗口里时重绘一次（输入栏按钮会被挪回柚月原位）；设置页不动，返回时自然重绘
        try {
            const cur = document.querySelector('.phone-view-current') || document;
            if (this.app?.currentChat && cur.querySelector('.wechat-app .chat-room')) this.app?.render?.();
        } catch (e) { /* 忽略 */ }
        this.schedule();
    }

    // ---------------- 观察 DOM ----------------
    _wrapShell() {
        const shell = this.app?.phoneShell;
        if (!shell || shell.__njWrapped || typeof shell.setContent !== 'function') return;
        const orig = shell.setContent.bind(shell);
        shell.setContent = (...args) => {
            const r = orig(...args);
            this._ensureObserver();
            this.schedule();
            return r;
        };
        shell.__njWrapped = true;
    }

    _ensureObserver() {
        const anyApp = document.querySelector('.wechat-app');
        const root = anyApp?.closest?.('#phone-panel-content') || anyApp?.closest?.('.phone-screen') || anyApp?.parentElement?.parentElement || null;
        if (!root || this._observeRoot === root) return;
        this._observer?.disconnect();
        this._observeRoot = root;
        this._observer = new MutationObserver(() => this.schedule());
        this._observer.observe(root, { childList: true, subtree: true });
        root.addEventListener('scroll', (e) => {
            const t = e.target;
            if (!t?.classList?.contains?.('wechat-content')) return;
            const appEl = t.closest('.wechat-app');
            if (appEl?.classList.contains('nj-list-on')) setAttr(appEl, 'data-scrolled', t.scrollTop > 8 ? 'true' : 'false');
        }, true);
    }

    schedule() {
        if (this._pending) return;
        this._pending = true;
        const run = () => {
            this._pending = false;
            try { this.pass(); } catch (e) { console.warn('[糯叽机美化] 刷新失败', e); }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 16);
    }

    pass() {
        this._ensureObserver();
        const apps = Array.from(document.querySelectorAll('.wechat-app'));
        if (!apps.length) return;
        const chatOn = this.isActive('chat');
        const listOn = this.isActive('list');
        const frames = this._hasAnyFrame();
        this._observer?.disconnect();
        try {
            apps.forEach(appEl => {
                const room = appEl.querySelector('.chat-room');
                const isMain = appEl.classList.contains('wechat-main-shell') && !room;
                togCls(appEl, 'nj-chat-on', chatOn && !!room);
                togCls(appEl, 'nj-list-on', listOn && isMain);
                if (!(chatOn && room)) togCls(appEl, 'chat-detail-screen', false);
                if (!(listOn && isMain)) LIST_TAB_CLASSES.forEach(c => togCls(appEl, c, false));
                if ((chatOn && room) || (listOn && isMain)) this._tagGlobalAttrs(appEl);
                if (chatOn && room) this._tagChat(appEl, room);
                if (listOn && isMain) this._tagList(appEl);
                if (room) this._tagFrames(appEl, room, frames);
                if (isMain) this._bindTabLongPress(appEl);
            });
        } finally {
            if (this._observeRoot) {
                this._observer?.takeRecords?.();
                this._observer?.observe(this._observeRoot, { childList: true, subtree: true });
            }
        }
    }

    _tagGlobalAttrs(appEl) {
        const t = timeSlots();
        setAttr(appEl, 'data-time-of-day', t.ofDay);
        setAttr(appEl, 'data-time-slot', t.slot);
        setAttr(appEl, 'data-hour', t.hour);
        let dark = false;
        try { dark = document.documentElement.getAttribute('data-wx-mode') === 'night' || !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches; } catch (e) { dark = false; }
        setAttr(appEl, 'data-color-scheme', dark ? 'dark' : 'light');
    }

    _flagVars(appEl, group) {
        let cs = null;
        try { cs = getComputedStyle(appEl); } catch (e) { return; }
        Object.entries(VAR_FLAGS[group] || {}).forEach(([flag, vars]) => {
            togCls(appEl, flag, vars.some(v => String(cs.getPropertyValue(v) || '').trim() && String(cs.getPropertyValue(v)).trim() !== 'initial'));
        });
        return cs;
    }

    // ================= 聊天界面 =================
    _tagChat(appEl, room) {
        addCls(appEl, 'chat-detail-screen');
        const cs = this._flagVars(appEl, 'chat');
        const chatId = String(room.dataset.chatId || this.app?.currentChat?.id || '');
        const chat = this.app?.wechatData?.getChat?.(chatId) || this.app?.currentChat || null;
        setAttr(appEl, 'data-chat-kind', chat?.type === 'group' ? 'group' : 'single');
        const alwaysShow = String(cs?.getPropertyValue('--translation-always-show') || '').trim() === '1';
        togCls(appEl, 'msg-translation-always-show', alwaysShow);

        // ---- 顶栏 ----
        const header = appEl.querySelector(':scope > .wechat-header');
        if (header) {
            addCls(header, 'chat-header-custom', 'glass-header');
            const left = header.querySelector(':scope > .wechat-header-left');
            addCls(left, 'nj-header-left');
            const back = header.querySelector('.wechat-back-btn');
            addCls(back, 'header-btn-back', 'header-action-btn');
            this._svgIcon(back, BACK_SVG);
            const title = header.querySelector(':scope > .wechat-header-title');
            addCls(title, 'header-profile-section');
            const av = title?.querySelector(':scope > .wx-head-avatar');
            addCls(av, 'header-avatar-container');
            addCls(av?.firstElementChild, 'chat-header-avatar');
            addCls(title?.querySelector(':scope > .wechat-header-title-text'), 'chat-header-title');
            addCls(title?.querySelector(':scope > .wx-head-sub'), 'chat-header-subtitle');
            const right = header.querySelector(':scope > .wechat-header-right');
            addCls(right, 'nj-header-right');
            const info = right?.querySelector('#chat-info');
            addCls(info, 'header-btn-info', 'header-action-btn');
            this._svgIcon(info, MORE_SVG);
            this._ensureHeaderCallButtons(right, info);
            this._ensureHeaderUnread(back, chatId);
            this._ensureHeaderDeco(header);
            // 美化自己在顶栏画了状态文字（例如仿QQ的「在线＞幸福來臨中」）时，柚月自带的「在线」就不再叠着显示
            let drawn = '';
            try { drawn = String(getComputedStyle(header, '::after').content || ''); } catch (e) { drawn = ''; }
            togCls(appEl, 'nj-theme-subtitle', !!drawn && !['none', 'normal', '""', "''"].includes(drawn));
        }

        // ---- 消息 ----
        const box = room.querySelector('.chat-messages');
        addCls(box, 'chat-messages-area');
        setAttr(box, 'data-theme-style', 'qq');
        const messages = this.app?.wechatData?.getMessages?.(chatId) || [];
        let prevRow = null;
        const rows = [];
        Array.from(box?.children || []).forEach(el => {
            if (el.classList.contains('message-time-divider')) {
                this._tagTimeDivider(el);
                prevRow = null;
                return;
            }
            if (!el.classList.contains('chat-message')) { prevRow = null; return; }
            if (el.classList.contains('message-system')) {
                addCls(el, 'msg-system-row');
                const b = el.querySelector('.system-message-bubble');
                if (b) { addCls(b, 'msg-system'); if (b.getAttribute('style')) b.removeAttribute('style'); }
                if (el.getAttribute('style')) el.removeAttribute('style');
                prevRow = null;
                return;
            }
            const sender = el.dataset.sender ?? '';
            const cont = prevRow && prevRow.dataset.sender === sender;
            rows.push({ el, cont });
            prevRow = el;
        });
        rows.forEach((r, i) => {
            const next = rows[i + 1];
            const hasNext = next && next.cont;
            r.pos = r.cont ? (hasNext ? 'mid' : 'last') : (hasNext ? 'first' : 'single');
            const idx = Number(r.el.dataset.messageIndex);
            this._tagMessageRow(r.el, r.pos, Number.isFinite(idx) ? messages[idx] : null, cs);
        });

        // ---- 输入区 ----
        this._tagInput(room, cs);
        this._tagIcons(appEl, cs);
    }

    _tagTimeDivider(el) {
        const manual = el.classList.contains('wechat-manual-time-marker');
        addCls(el, 'msg-time-row');
        if (manual) addCls(el, 'msg-time-marker');
        if (el.getAttribute('style')) el.removeAttribute('style');
        const text = el.querySelector('.time-divider-text');
        if (text) {
            addCls(text, 'timestamp-custom');
            if (manual) addCls(text, 'msg-time-marker-pill');
            togCls(text, 'date-divider-custom', /星期|周[一二三四五六日天]|\d+月|\d{4}[-/.年]|昨天|前天/.test(text.textContent || ''));
            const st = text.getAttribute('style') || '';
            if (st && !/user-select/.test(st)) text.removeAttribute('style');
            else if (st) text.setAttribute('style', '-webkit-user-select:none;user-select:none;');
        }
    }

    _tagMessageRow(row, pos, msg, cs) {
        const isMe = row.classList.contains('message-right');
        const side = isMe ? 'me' : 'them';
        addCls(row, 'msg-bubble-wrapper');
        togCls(row, 'msg-me', isMe);
        togCls(row, 'msg-them', !isMe);
        ['is-first', 'is-mid', 'is-last', 'is-single'].forEach(c => togCls(row, c, c === `is-${pos}`));
        setAttr(row, 'data-msg-type', msg?.type || 'text');
        const reactions = row.querySelector('.wechat-reaction-row');
        togCls(row, 'has-reactions', !!reactions);

        const avatar = row.querySelector(':scope > .message-avatar');
        if (avatar) {
            addCls(avatar, `msg-avatar-${side}-container`);
            if (!isMe) addCls(avatar, 'msg-avatar-container');
            ['is-first', 'is-mid', 'is-last', 'is-single'].forEach(c => togCls(avatar, c, c === `is-${pos}`));
            const inner = Array.from(avatar.children).find(c => !c.classList.contains('nuo-avatar-frame'));
            addCls(inner, `msg-avatar-${side}-inner`);
            addCls(avatar.querySelector('img'), 'msg-avatar-custom');
        }

        const content = row.querySelector(':scope > .message-content');
        if (!content) return;
        addCls(content, 'msg-content-stack');
        let body = content.querySelector(':scope > .nj-body');
        if (!body) {
            body = Array.from(content.children).find(c => c.tagName === 'DIV' && !c.className);
            addCls(body, 'nj-body');
        }
        const sender = content.querySelector(':scope > .message-sender');
        if (sender) {
            addCls(sender, 'grp-sender-row', `grp-sender-row-${side}`);
            addCls(sender.querySelector('.message-sender-name'), 'grp-sender-name');
            addCls(sender.querySelector('.wechat-sender-chip'), 'grp-title-badge');
        }
        const quote = content.querySelector(':scope > .wechat-quote-block');
        if (quote) {
            addCls(quote, 'msg-reply-block-detached', `msg-reply-detached-${side}`);
            addCls(quote.querySelector('.wechat-quote-sender'), 'msg-reply-detached-name');
            addCls(quote.querySelector('.wechat-quote-text'), 'msg-reply-detached-text');
        }
        if (reactions) {
            addCls(reactions, 'msg-reaction-row');
            reactions.querySelectorAll('.wechat-reaction-pill').forEach(p => addCls(p, 'msg-reaction-badge', `msg-reaction-badge-${side}`));
            reactions.querySelectorAll('.wechat-reaction-emoji').forEach(p => addCls(p, 'msg-reaction-emoji'));
        }
        if (!body) return;

        // 导入的美化优先：单个聊天里自选的「气泡样式」先让位（关掉美化后重绘就回来）
        Array.from(row.classList).forEach(c => { if (c.startsWith('wbx-c-')) row.classList.remove(c); });
        const textEl = body.querySelector(':scope > .message-text, :scope > .wechat-inner-os-wrapper > .message-text');
        const isText = !!textEl;
        const bubbleCls = isMe ? 'bubble-me-custom' : 'bubble-them-custom';
        addCls(body, bubbleCls, 'msg-bubble-container');
        togCls(body, isMe ? 'bubble-them-custom' : 'bubble-me-custom', false);
        togCls(body, 'nj-bubble-text', isText);
        togCls(body, 'nj-bubble-card', !isText);
        ['first', 'mid', 'last', 'single'].forEach(c => togCls(body, c, c === pos));

        // ---- 各种消息内容 ----
        const type = msg?.type || '';
        if (textEl) {
            addCls(textEl, 'msg-text-custom');
            if (textEl.classList.contains('wechat-voice-message')) {
                addCls(textEl, 'voice-msg', `voice-msg-${side}`);
                addCls(textEl.querySelector('.wechat-voice-transcript-inner'), 'voice-transcription');
                addCls(textEl.querySelector('.voice-bubble-playable'), 'voice-play-row');
            }
            if (type === 'call_record') addCls(textEl, 'msg-call-card', 'msg-videocall-card', msg?.status === 'answered' ? 'connected' : 'missed');
            textEl.querySelectorAll('.wechat-trans-fold').forEach(f => {
                addCls(f, 'msg-translation-wrapper');
                addCls(f.querySelector('.wechat-trans-fold-btn'), 'msg-translation-btn');
                addCls(f.querySelector('.wechat-trans-fold-body'), 'msg-translation-content');
            });
            addCls(textEl.querySelector('.wechat-translation-target'), 'msg-translation-detached-content');
            return;
        }
        const tf = body.querySelector('.message-transfer');
        if (tf) {
            addCls(tf, 'msg-transfer-card', 'msg-transfer-container');
            const st = String(msg?.status || '');
            togCls(tf, 'msg-transfer-success', st === 'received');
            togCls(tf, 'msg-transfer-rejected', st === 'refunded');
            togCls(tf, 'msg-transfer-expired-card', st === 'expired');
            togCls(tf, 'nj-tf-themed', row.closest('.wechat-app')?.classList.contains('nj-tf-on'));
            addCls(tf.querySelector('.rp-icon'), 'msg-transfer-icon');
            addCls(tf.querySelector('.rp-title'), 'msg-transfer-amount');
            addCls(tf.querySelector('.rp-subtitle'), 'msg-transfer-subtitle', 'msg-transfer-status');
            addCls(tf.querySelector('.rp-footer'), 'msg-transfer-footer', 'msg-transfer-label');
            addCls(body, 'msg-transfer-wrapper');
            return;
        }
        const rp = body.querySelector('.message-redpacket');
        if (rp) {
            const opened = rp.classList.contains('opened');
            addCls(rp, 'msg-redpacket-card');
            togCls(rp, 'is-opened', opened);
            togCls(rp, 'is-unopened', !opened);
            addCls(rp.querySelector('.rp-icon'), 'msg-redpacket-emoji');
            return;
        }
        const img = body.querySelector('.message-image-box');
        if (img) {
            if (img.classList.contains('message-image-prompt-box')) addCls(img, 'msg-sim-card');
            else if (img.classList.contains('message-image-box-custom-emoji')) addCls(img, 'msg-sticker-wrapper');
            else addCls(img, 'msg-image-wrapper', 'msg-image-card');
            return;
        }
        const map = [
            ['.message-sticker-box', 'msg-sticker-wrapper'],
            ['.message-location', 'msg-loc-card'],
            ['.message-music-card', 'msg-music-card'],
            ['.message-moment-card', 'msg-forum-share-card'],
            ['.message-weibo-card', 'ext-share-card'],
            ['.message-x-card', 'ext-share-card'],
            ['.message-werewolf-card', 'msg-werewolf-card'],
            ['.message-poker-card', 'msg-game-card'],
            ['.message-undercover-card', 'msg-game-card'],
            ['.message-wangxiang-task-card', 'msg-game-card'],
            ['.message-mind-share', 'msg-qa-share-card'],
            ['.message-mind-reply', 'msg-qa-share-card'],
            ['.message-honey-invite', 'msg-special-card'],
            ['.message-catbox-care-card', 'msg-special-card'],
            ['.message-catbox-invite-card', 'msg-special-card']
        ];
        for (const [sel, cls] of map) {
            const el = body.querySelector(sel);
            if (el) { addCls(el, cls); break; }
        }
    }

    _tagInput(room, cs) {
        const area = room.querySelector('.chat-input-area');
        if (!area) return;
        addCls(area, 'input-area-custom');
        addCls(area.querySelector('.emoji-panel'), 'emoji-panel-custom');
        addCls(area.querySelector('.more-panel'), 'more-panel-custom');
        addCls(area.querySelector('.wechat-active-quote-bar'), 'input-reply-preview-bar');
        const bar = area.querySelector('.chat-input-bar');
        if (!bar) return;
        addCls(bar, 'input-row-wrapper');
        const cap = bar.querySelector('.chat-input-wrapper');
        addCls(cap, 'input-action-bar-custom');
        const input = bar.querySelector('#chat-input');
        addCls(input, 'input-box-custom');
        const q = id => bar.querySelector(`#${id}`);
        const plus = q('send-btn');
        const mic = q('quick-reply-btn');
        const sticker = q('emoji-btn');
        const ai = q('regenerate-btn');
        const send = q('send-now-btn');
        addCls(plus, 'input-btn-plus');
        addCls(mic, 'input-btn-mic', 'nj-btn-quick-reply');
        addCls(sticker, 'input-btn-sticker');
        addCls(ai, 'input-btn-ai', 'nj-btn-regenerate');
        if (send) {
            const stop = send.dataset.mode === 'stop';
            togCls(send, 'send-btn-custom', !stop);
            togCls(send, 'stop-btn-custom', stop);
        }
        // 糯叽机布局：[+] [输入框 · 快捷回复 · 表情 · 重新生成 · 发送]
        if (cap) {
            if (plus && bar.firstElementChild !== plus) bar.insertBefore(plus, bar.firstElementChild);
            [mic, sticker, ai, send].forEach(btn => { if (btn && btn.parentElement !== cap) cap.appendChild(btn); });
            Array.from(bar.children).forEach(ch => {
                if (ch === plus || ch === cap || ch.tagName !== 'DIV') return;
                togCls(ch, 'nj-empty-group', !ch.querySelector('button'));
            });
        }
    }

    _tagIcons(appEl, cs) {
        if (!cs) return;
        NJ_ICON_KEYS.forEach(([sel, v]) => {
            const val = String(cs.getPropertyValue(v) || '').trim();
            const on = !!val && val !== 'none' && val !== 'initial';
            appEl.querySelectorAll(sel).forEach(el => togCls(el, 'nj-has-icon', on));
        });
    }

    // 柚月顶栏用的是字体图标 <i>，糯叽机美化都按 <svg> 写（例如 .header-btn-back svg { display:none }），这里换成 svg
    _svgIcon(btn, svg) {
        if (!btn || btn.querySelector(':scope > svg.nj-svg-icon')) return;
        btn.querySelectorAll(':scope > i, :scope > svg:not(.nj-svg-icon)').forEach(el => el.classList.add('nj-hidden-icon'));
        btn.insertAdjacentHTML('afterbegin', svg);
    }

    _ensureHeaderCallButtons(right, info) {
        if (!right) return;
        const want = this.getOptions().headerCalls !== false;
        let phone = right.querySelector(':scope > .header-btn-phone');
        let video = right.querySelector(':scope > .header-btn-video');
        if (!want) { phone?.remove(); video?.remove(); return; }
        const mk = (cls, svg, label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `wechat-header-btn header-action-btn ${cls}`;
            b.setAttribute('aria-label', label);
            b.title = label;
            b.innerHTML = svg;
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try { this.app?.chatView?.[fn]?.(); } catch (err) { console.warn('[糯叽机美化] 发起通话失败', err); }
            });
            return b;
        };
        if (!phone) { phone = mk('header-btn-phone', PHONE_SVG, '语音通话', 'startVoiceCall'); right.insertBefore(phone, info || null); }
        if (!video) { video = mk('header-btn-video', VIDEO_SVG, '视频通话', 'startVideoCall'); right.insertBefore(video, info || null); }
    }

    _ensureHeaderUnread(back, chatId) {
        if (!back) return;
        let total = 0;
        try {
            (this.app?.wechatData?.getChatList?.() || []).forEach(c => { if (String(c.id) !== String(chatId)) total += Number(c.unread) || 0; });
        } catch (e) { total = 0; }
        let dot = back.querySelector(':scope > .nuo-chat-header-unread-dot');
        let num = back.querySelector(':scope > .nuo-chat-header-unread-num');
        if (total <= 0) { dot?.remove(); num?.remove(); return; }
        if (!dot) { dot = document.createElement('span'); dot.className = 'nuo-chat-header-unread-dot'; back.appendChild(dot); }
        if (!num) { num = document.createElement('span'); num.className = 'nuo-chat-header-unread-num'; back.appendChild(num); }
        const txt = total > 99 ? '99+' : String(total);
        if (num.textContent !== txt) num.textContent = txt;
    }

    _ensureHeaderDeco(header) {
        if (header.querySelector(':scope > .nuo-chat-header-deco')) return;
        for (let n = 1; n <= 6; n++) {
            const d = document.createElement('div');
            d.className = `nuo-chat-header-deco nuo-chat-header-deco-${n}`;
            d.setAttribute('aria-hidden', 'true');
            header.appendChild(d);
        }
    }

    // ================= 头像框 =================
    _tagFrames(appEl, room, any) {
        const chatId = String(room.dataset.chatId || this.app?.currentChat?.id || '');
        const f = this.getFrames();
        if (any) {
            setVar(appEl, '--nuo-avatar-frame-scale', Number(f.scale) || 1.45);
            setVar(appEl, '--nuo-avatar-frame-offset-y', `${Number(f.offsetY) || 0}px`);
        }
        const urls = { them: any ? this._frameFor(chatId, 'them') : '', me: any ? this._frameFor(chatId, 'me') : '' };
        room.querySelectorAll('.chat-messages > .chat-message > .message-avatar').forEach(av => {
            const side = av.parentElement.classList.contains('message-right') ? 'me' : 'them';
            const url = urls[side];
            let fr = av.querySelector(':scope > .nuo-avatar-frame');
            if (!url) {
                if (fr) fr.remove();
                togCls(av, 'nj-has-frame', false);
                return;
            }
            if (!fr) {
                fr = document.createElement('i');
                fr.className = 'nuo-avatar-frame';
                fr.setAttribute('aria-hidden', 'true');
                av.appendChild(fr);
            }
            if (fr.dataset.src !== url) {
                fr.dataset.src = url;
                fr.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
            }
            addCls(av, 'nj-has-frame');
        });
    }

    // ================= 聊天列表（消息 App） =================
    _viewOf(appEl) {
        if (appEl.querySelector('.wcl-v2')) return 'chat';
        if (appEl.querySelector('.moments-page')) return 'moments';
        if (appEl.querySelector('.wechat-profile')) return 'profile';
        return 'contacts';
    }

    _tagList(appEl) {
        const view = this._viewOf(appEl);
        const tabCls = view === 'contacts' ? ['nj-messaging-contacts-tab', 'nj-messaging-chat-tab'] : [`nj-messaging-${view}-tab`];
        LIST_TAB_CLASSES.forEach(c => togCls(appEl, c, tabCls.includes(c)));
        setAttr(appEl, 'data-active-tab', view);
        setAttr(appEl, 'data-view-mode', 'list');
        if (this._lastTab !== view) {
            if (this._lastTab) setAttr(appEl, 'data-prev-tab', this._lastTab);
            this._lastTab = view;
            setAttr(appEl, 'data-tab-anim', 'enter');
            clearTimeout(this._tabAnimTimer);
            this._tabAnimTimer = setTimeout(() => { document.querySelectorAll('.wechat-app[data-tab-anim]').forEach(el => el.removeAttribute('data-tab-anim')); }, 500);
        }
        this._flagVars(appEl, 'list');

        const header = appEl.querySelector(':scope > .wechat-header');
        if (header) {
            const hdr = view === 'chat' ? 'nj-chat-tab-header' : (view === 'moments' ? 'nj-moments-header' : (view === 'profile' ? 'nj-profile-tab-header' : 'nj-contacts-tab-header'));
            ['nj-chat-tab-header', 'nj-moments-header', 'nj-profile-tab-header', 'nj-contacts-tab-header'].forEach(c => togCls(header, c, c === hdr));
            addCls(header.querySelector('.wechat-back-btn'), 'nj-chat-tab-header-back');
            const tt = header.querySelector('.wechat-header-title-text');
            addCls(tt, 'nj-chat-tab-header-title', 'nj-chat-tab-header-title-btn');
            addCls(header.querySelector('#wechat-add'), 'nj-chat-tab-header-edit');
            addCls(header.querySelector('#moments-generate-btn'), 'nj-moments-header-btn-gen');
            addCls(header.querySelector('#moments-post-btn'), 'nj-moments-header-btn-post');
        }

        if (view === 'chat') this._tagChatList(appEl);
        if (view === 'moments') this._tagMoments(appEl);
        if (view === 'profile') this._tagProfile(appEl);
        this._tagTabbar(appEl);
    }

    _decor(parent, cls, before = null) {
        if (!parent) return;
        let d = parent.querySelector(`:scope > .${cls}`);
        if (!d) {
            d = document.createElement('div');
            d.className = `nj-decor ${cls}`;
            d.setAttribute('aria-hidden', 'true');
            parent.insertBefore(d, before);
        } else if (before && d.nextSibling !== before) {
            parent.insertBefore(d, before);
        }
    }

    _itemDeco(item) {
        if (item.querySelector(':scope > .nj-item-deco-1')) {
            // 装饰层永远排在最后，不打乱 :nth-child
            const d1 = item.querySelector(':scope > .nj-item-deco-1');
            const d2 = item.querySelector(':scope > .nj-item-deco-2');
            if (d2 && item.lastElementChild !== d2) { item.appendChild(d1); item.appendChild(d2); }
            return;
        }
        ['nj-item-deco-1', 'nj-item-deco-2'].forEach(c => {
            const d = document.createElement('div');
            d.className = `${c} heavy-anim`;
            d.setAttribute('aria-hidden', 'true');
            item.appendChild(d);
        });
    }

    _tagChatList(appEl) {
        const list = appEl.querySelector('.wcl-v2');
        if (!list) return;
        addCls(list, 'nj-chat-tab-root');
        const search = list.querySelector(':scope > .wcl-search');
        addCls(search, 'nj-chat-tab-search', 'nj-chat-tab-search-wrap');
        const notes = list.querySelector(':scope > .mind-row');
        if (notes) {
            addCls(notes, 'nj-chat-tab-notes');
            notes.querySelectorAll('.mind-cell').forEach(c => addCls(c, 'nj-chat-tab-note-item'));
            notes.querySelectorAll('.mind-bubble').forEach(c => addCls(c, 'nj-chat-tab-note-bubble'));
            notes.querySelectorAll('.mind-av').forEach(c => addCls(c, 'nj-chat-tab-note-avatar'));
        }
        const section = list.querySelector(':scope > .wcl-section');
        addCls(section, 'nj-chat-tab-section-title');
        setAttr(section, 'data-grouping', 'hidden');
        const items = list.querySelector(':scope > .wcl-items');
        addCls(items, 'nj-chat-tab-list');
        this._decor(list, 'nj-chat-tab-decor-top', list.firstElementChild);
        this._decor(list, 'nj-chat-tab-decor-mid', section || items);
        this._decor(list, 'nj-chat-tab-decor-bottom', null);
        if (list.lastElementChild && !list.lastElementChild.classList.contains('nj-chat-tab-decor-bottom')) {
            list.appendChild(list.querySelector(':scope > .nj-chat-tab-decor-bottom'));
        }

        const wd = this.app?.wechatData;
        const sendingId = this.app?.chatView?.isSending ? String(this.app.chatView._activeSendingChatId || '') : '';
        let totalUnread = 0;
        const now = Date.now();
        Array.from(items?.querySelectorAll(':scope > .chat-item') || []).forEach((item, index) => {
            const id = String(item.dataset.chatId || '');
            const chat = wd?.getChat?.(id) || null;
            const unread = Number(chat?.unread) || 0;
            totalUnread += unread;
            const kind = chat?.type === 'group' ? 'group' : 'char';
            addCls(item, 'nj-chat-item', `nj-chat-item-${kind}`);
            togCls(item, 'nj-chat-item-pinned', item.classList.contains('is-pinned'));
            togCls(item, 'nj-chat-item-unread', unread > 0);
            setAttr(item, 'data-kind', kind);
            setAttr(item, 'data-unread', unread <= 0 ? '0' : (unread === 1 ? '1' : (unread < 10 ? 'few' : 'many')));
            setAttr(item, 'data-pinned', item.classList.contains('is-pinned') ? 'true' : 'false');
            setAttr(item, 'data-muted', chat?.muted ? 'true' : 'false');
            setAttr(item, 'data-generating', sendingId && sendingId === id ? 'true' : 'false');
            const preview = item.querySelector('.chat-last-msg');
            const last = preview?.dataset?.orig ?? preview?.textContent ?? '';
            setAttr(item, 'data-last-type', lastTypeOf(last));
            const len = String(last).length;
            setAttr(item, 'data-length', len < 10 ? 'short' : (len < 30 ? 'medium' : 'long'));
            // 刚来新消息：闪 3 秒
            const prev = this._unreadSnapshot.get(id);
            if (prev !== undefined && unread > prev) this._flashUntil.set(id, now + 3000);
            this._unreadSnapshot.set(id, unread);
            const flashing = (this._flashUntil.get(id) || 0) > now;
            setAttr(item, 'data-flash', flashing ? 'true' : 'false');
            if (flashing) setTimeout(() => this.schedule(), 3100);
            const t = timeSlots(new Date(Number(chat?.lastMessageTime || chat?.timestamp || now) || now));
            setAttr(item, 'data-time-slot', t.slot);
            setAttr(item, 'data-hour', t.hour);
            setVar(item, '--nj-item-index', index);
            setVar(item, '--nj-item-unread', unread);
            const avatar = item.querySelector(':scope > .chat-avatar');
            addCls(avatar, 'nj-chat-item-avatar');
            const src = avatar?.querySelector('img')?.getAttribute('src') || '';
            setVar(item, '--nj-item-avatar-url', src ? `url("${src.replace(/"/g, '%22')}")` : 'none');
            addCls(avatar?.querySelector('.chat-badge'), 'nj-chat-item-unread-badge');
            addCls(item.querySelector('.chat-name'), 'nj-chat-item-name');
            addCls(item.querySelector('.chat-time'), 'nj-chat-item-time');
            addCls(preview, 'nj-chat-item-preview');
            addCls(item.querySelector('.group-count'), 'nj-chat-item-badge');
            this._itemDeco(item);
        });
        setAttr(appEl, 'data-unread-total', totalUnread);
        setAttr(appEl, 'data-searching', String(this.app?._chatListQuery || '').trim() ? 'true' : 'false');
    }

    _tagMoments(appEl) {
        const page = appEl.querySelector('.moments-page');
        if (!page) return;
        // 柚月没设朋友圈背景时会写死白底，美化开着时让主题背景透出来
        const st = page.getAttribute('style') || '';
        if (/background:\s*#fff/.test(st)) page.setAttribute('style', st.replace(/background:\s*#fff;?/, ''));
        const cover = page.querySelector('.moments-cover, .mz-head, .ins-top');
        addCls(cover, 'nj-moments-cover');
        addCls(page.querySelector('.moments-cover-name, .mz-name'), 'nj-moments-cover-username');
        addCls(page.querySelector('.moments-cover-avatar, .mz-avatar, .ins-me'), 'nj-moments-cover-avatar');
        const feed = page.querySelector('.moments-feed');
        addCls(feed, 'nj-moments-feed');
        this._decor(page, 'nj-moments-decor-top', page.firstElementChild);
        if (cover?.parentElement) this._decor(cover.parentElement, 'nj-moments-decor-mid', cover.nextSibling);
        this._decor(page, 'nj-moments-decor-bottom', null);

        let byId = new Map();
        try { byId = new Map((this.app?.wechatData?.getMoments?.() || []).map(m => [String(m.id), m])); } catch (e) { byId = new Map(); }
        const myName = this.app?.wechatData?.getUserInfo?.()?.name;
        const posts = Array.from(page.querySelectorAll('.moment-item'));
        setAttr(appEl, 'data-post-count', posts.length);
        setAttr(appEl, 'data-empty', posts.length ? 'false' : 'true');
        posts.forEach((post, index) => {
            const m = byId.get(String(post.dataset.momentId || '')) || {};
            const self = this.app?.momentsView?._isSelfMoment ? !!this.app.momentsView._isSelfMoment(m) : m.name === myName;
            addCls(post, 'nj-moments-post', self ? 'nj-moments-post-user' : 'nj-moments-post-char');
            const imgs = Array.isArray(m.images) ? m.images.length : 0;
            const likes = Array.isArray(m.likeList) ? m.likeList.length : 0;
            const comments = Array.isArray(m.commentList) ? m.commentList.length : 0;
            setAttr(post, 'data-post-kind', self ? 'user' : 'char');
            setAttr(post, 'data-img-count', imgs);
            setAttr(post, 'data-has-img', imgs ? 'true' : 'false');
            setAttr(post, 'data-liked', myName && m.likeList?.includes?.(myName) ? 'true' : 'false');
            setAttr(post, 'data-like-count', likes);
            setAttr(post, 'data-comment-count', comments);
            setAttr(post, 'data-has-comment', comments ? 'true' : 'false');
            setAttr(post, 'data-has-location', String(m.location || '').trim() ? 'true' : 'false');
            const tl = String(m.text || '').length;
            setAttr(post, 'data-length', tl < 20 ? 'short' : (tl < 80 ? 'medium' : 'long'));
            setVar(post, '--nj-item-index', index);
            setVar(post, '--nj-post-img-count', imgs);
            setVar(post, '--nj-post-like-count', likes);
            setVar(post, '--nj-post-comment-count', comments);
            addCls(post.querySelector('.moment-avatar-col, .ins-avatar'), 'nj-moments-post-avatar');
            addCls(post.querySelector('.moment-author, .ins-name'), 'nj-moments-post-name');
            post.querySelectorAll('.moment-text, .ins-caption, .ins-textcard').forEach(e => addCls(e, 'nj-moments-post-text'));
            const grid = post.querySelector('.moment-images');
            if (grid) {
                addCls(grid, 'nj-moments-post-imgs', `nj-moments-post-imgs-${imgs <= 1 ? 1 : (imgs <= 4 ? 4 : 9)}`);
                grid.querySelectorAll('.moment-img-wrapper').forEach(c => addCls(c, 'nj-moments-post-img-cell'));
            }
            addCls(post.querySelector('.moment-time, .ins-time'), 'nj-moments-post-time');
            addCls(post.querySelector('.moment-location, .ins-loc'), 'nj-moments-post-location');
            addCls(post.querySelector('.moment-action-btn'), 'nj-moments-post-actions-trigger');
            const inter = post.querySelector('.moment-interactions');
            addCls(inter, 'nj-moments-engagement');
            addCls(post.querySelector('.interaction-likes, .ins-likes'), 'nj-moments-likes');
            post.querySelectorAll('.comment-row').forEach(r => {
                addCls(r, 'nj-moments-comment');
                r.querySelectorAll('.comment-author').forEach(a => addCls(a, 'nj-moments-comment-author'));
                addCls(r.querySelector('.comment-content'), 'nj-moments-comment-content');
            });
            this._itemDeco(post);
        });
    }

    _tagProfile(appEl) {
        const p = appEl.querySelector('.wechat-profile');
        if (!p) return;
        const card = p.querySelector('.profile-card');
        addCls(card, 'nj-profile-top');
        addCls(p.querySelector('.profile-avatar-large'), 'nj-profile-avatar');
        addCls(p.querySelector('.profile-username'), 'nj-profile-name');
        addCls(p.querySelector('.profile-signature'), 'nj-profile-signature');
        addCls(p.querySelector('.profile-functions'), 'nj-profile-menu');
        p.querySelectorAll('.profile-function-item').forEach(i => addCls(i, 'nj-profile-menu-item'));
        this._decor(p, 'nj-profile-decor-top', p.firstElementChild);
        if (card) this._decor(p, 'nj-profile-decor-mid', card.nextSibling);
        this._decor(p, 'nj-profile-decor-bottom', null);
    }

    _tagTabbar(appEl) {
        const bar = appEl.querySelector(':scope > .wechat-tabbar');
        if (!bar) return;
        addCls(bar, 'nj-tab-bottom-bar');
        const map = { chats: 'chat', contacts: 'contacts', discover: 'moments', me: 'profile' };
        bar.querySelectorAll(':scope > .wechat-tab').forEach(tab => {
            addCls(tab, 'nj-tab-bottom-item', `nj-tab-bottom-item-${map[tab.dataset.view] || tab.dataset.view}`);
            togCls(tab, 'nj-tab-bottom-item-active', tab.classList.contains('active'));
            addCls(tab.querySelector(':scope > i, :scope > svg'), 'nj-tab-bottom-icon');
            addCls(tab.querySelector('.tab-badge'), 'nj-tab-bottom-total-unread');
            addCls(tab.querySelector('.wechat-moments-unread-dot'), 'nj-tab-bottom-moments-dot');
        });
    }

    // 长按（或右键）底栏「微信」：打开美化面板，和糯叽机一样
    _bindTabLongPress(appEl) {
        const tab = appEl.querySelector(':scope > .wechat-tabbar > .wechat-tab[data-view="chats"]');
        if (!tab || tab.dataset.njLp === '1') return;
        tab.dataset.njLp = '1';
        let timer = null;
        let fired = false;
        let sx = 0;
        let sy = 0;
        const start = (x, y) => { fired = false; sx = x; sy = y; clearTimeout(timer); timer = setTimeout(() => { fired = true; try { navigator.vibrate?.(15); } catch (e) { /* 忽略 */ } this.openPanel(appEl); }, 520); };
        const cancel = () => { clearTimeout(timer); timer = null; };
        tab.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) start(t.clientX, t.clientY); }, { passive: true });
        tab.addEventListener('touchmove', e => { const t = e.touches[0]; if (t && (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8)) cancel(); }, { passive: true });
        tab.addEventListener('touchend', cancel);
        tab.addEventListener('touchcancel', cancel);
        tab.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientX, e.clientY); });
        tab.addEventListener('mouseup', cancel);
        tab.addEventListener('mouseleave', cancel);
        tab.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); fired = true; this.openPanel(appEl); });
        tab.addEventListener('click', e => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
    }

    openPanel(appEl = null) {
        const host = appEl || document.querySelector('.phone-view-current .wechat-app') || document.querySelector('.wechat-app');
        if (!host) return;
        host.querySelector(':scope > .njc-modal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'njc-modal';
        modal.innerHTML = `<div class="njc-modal-sheet"><div class="njc-modal-head"><span>糯叽机美化</span><button type="button" class="njc-modal-close" aria-label="关闭">✕</button></div><div class="njc-modal-body">${this.renderCardHtml({ inModal: true })}</div></div>`;
        ['click', 'mousedown', 'touchstart', 'touchend', 'pointerdown'].forEach(ev => modal.addEventListener(ev, e => e.stopPropagation()));
        modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.njc-modal-close')) modal.remove(); });
        host.appendChild(modal);
        this.bindCard(modal);
    }

    // ================= 设置卡片 =================
    // 聊天界面：导入的糯叽机主题做成和「微信 / QQ / LINE」一样的风格方块
    _chatThemesHtml() {
        const profiles = this.getProfiles('chat');
        const activeId = this.isActive('chat') ? this.getActiveId('chat') : '';
        const tile = p => `
            <button type="button" class="njc-tile${p.id === activeId ? ' active' : ''}" data-njc-pick="${esc(p.id)}" title="${esc(p.name)}">
                <span class="njc-tile-mock"><i class="njc-tm-h"></i><i class="njc-tm-in"></i><i class="njc-tm-out"></i><i class="njc-tm-f"></i><b>🍡</b></span>
                <em>${esc(p.name)}</em>
            </button>`;
        return `
            <div class="njc-sec" data-njc-kind="chat">
                <div class="njc-sec-title">导入的聊天美化<small>糯叽机「聊天界面美化」CSS，例如仿QQ、轻松一点熊；选中后会盖过下面的柚月内置风格</small></div>
                <div class="njc-tiles">
                    ${profiles.map(tile).join('')}
                    <button type="button" class="njc-tile is-add" data-njc="import"><span class="njc-tile-mock"><b>＋</b></span><em>导入文件</em></button>
                    <button type="button" class="njc-tile is-add" data-njc="paste"><span class="njc-tile-mock"><b>✎</b></span><em>粘贴 CSS</em></button>
                </div>
                ${activeId ? `
                <div class="njc-btns">
                    <button type="button" data-njc="edit">编辑</button>
                    <button type="button" data-njc="rename">改名</button>
                    <button type="button" data-njc="export">导出</button>
                    <button type="button" class="is-danger" data-njc="delete">删除</button>
                    <button type="button" data-njc="off">不用了，换回内置风格</button>
                </div>` : ''}
                <input type="file" accept=".css,.txt,text/css,text/plain" data-njc="file" hidden>
                <div class="njc-editor" data-njc="editor" hidden>
                    <textarea data-njc="text" spellcheck="false" placeholder="把糯叽机的聊天美化 CSS 粘贴到这里"></textarea>
                    <div class="njc-btns">
                        <button type="button" class="is-primary" data-njc="save">保存并应用</button>
                        <button type="button" data-njc="cancel">取消</button>
                    </div>
                </div>
            </div>`;
    }

    _listThemesHtml() {
        const profiles = this.getProfiles('list');
        const activeId = this.isActive('list') ? this.getActiveId('list') : '';
        return `
            <div class="njc-sec" data-njc-kind="list">
                <div class="njc-sec-title">聊天列表美化<small>糯叽机「消息 App 美化」CSS，例如 NACRE；作用于聊天列表、朋友圈、我、底栏</small></div>
                <select class="njc-select" data-njc="select">
                    <option value="" ${activeId ? '' : 'selected'}>不使用（柚月原样）</option>
                    ${profiles.map(p => `<option value="${esc(p.id)}" ${p.id === activeId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                </select>
                <div class="njc-btns">
                    <button type="button" data-njc="import">导入文件</button>
                    <button type="button" data-njc="paste">粘贴新建</button>
                    <button type="button" data-njc="edit" ${activeId ? '' : 'disabled'}>编辑</button>
                    <button type="button" data-njc="rename" ${activeId ? '' : 'disabled'}>改名</button>
                    <button type="button" data-njc="export" ${activeId ? '' : 'disabled'}>导出</button>
                    <button type="button" class="is-danger" data-njc="delete" ${activeId ? '' : 'disabled'}>删除</button>
                </div>
                <input type="file" accept=".css,.txt,text/css,text/plain" data-njc="file" hidden>
                <div class="njc-editor" data-njc="editor" hidden>
                    <textarea data-njc="text" spellcheck="false" placeholder="把糯叽机的消息 App 美化 CSS 粘贴到这里"></textarea>
                    <div class="njc-btns">
                        <button type="button" class="is-primary" data-njc="save">保存并应用</button>
                        <button type="button" data-njc="cancel">取消</button>
                    </div>
                </div>
            </div>`;
    }

    _frameRow(scope, side, url) {
        const label = side === 'them' ? '对方头像框' : '我的头像框';
        return `
            <div class="njc-frame-row" data-njc-frame-scope="${scope}" data-njc-frame-side="${side}">
                <span class="njc-frame-prev" style="${url ? `background-image:url('${esc(url)}')` : ''}">${url ? '' : '无'}</span>
                <span class="njc-frame-label">${label}</span>
                <button type="button" data-njc-frame="upload">上传</button>
                <button type="button" data-njc-frame="link">链接</button>
                <button type="button" data-njc-frame="clear" ${url ? '' : 'disabled'}>清除</button>
            </div>`;
    }

    // 合进「界面风格」卡片的两块：上面的导入主题、下面的列表美化/头像框/选项
    renderChatPartHtml({ chatId = '' } = {}) {
        return `<div class="njc-part" data-njc-part="chat" data-njc-chat="${esc(chatId)}">${this._chatThemesHtml()}</div>`;
    }

    renderExtrasPartHtml({ chatId = '' } = {}) {
        const f = this.getFrames();
        const own = chatId ? (f.chats?.[chatId] || {}) : {};
        const opt = this.getOptions();
        return `
            <div class="njc-part" data-njc-part="extras" data-njc-chat="${esc(chatId)}">
                ${this._listThemesHtml()}
                <div class="njc-sec">
                    <div class="njc-sec-title">头像框<small>聊天里气泡旁的头像加装饰框（透明 PNG / GIF），不开美化也能用；美化自带头像框时以美化为准</small></div>
                    ${this._frameRow('global', 'them', f.them)}
                    ${this._frameRow('global', 'me', f.me)}
                    <label class="njc-range"><span>大小</span><input type="range" min="1" max="2.2" step="0.05" value="${Number(f.scale) || 1.45}" data-njc-frame-num="scale"><b>${(Number(f.scale) || 1.45).toFixed(2)}×</b></label>
                    <label class="njc-range"><span>上下</span><input type="range" min="-12" max="12" step="1" value="${Number(f.offsetY) || 0}" data-njc-frame-num="offsetY"><b>${Number(f.offsetY) || 0}px</b></label>
                    ${chatId ? `
                        <div class="njc-sub">本聊天单独设置（不设就跟随上面的通用框）</div>
                        ${this._frameRow('chat', 'them', own.them || '')}
                        ${this._frameRow('chat', 'me', own.me || '')}` : ''}
                    <input type="file" accept="image/*" data-njc-frame="file" hidden>
                </div>
                <div class="njc-sec">
                    <label class="njc-switch"><span>顶栏显示电话 / 视频按钮<small>导入的聊天美化开启时，顶栏右上角多出这两个按钮（糯叽机同款），点了直接发起通话</small></span><input type="checkbox" data-njc-opt="headerCalls" ${opt.headerCalls !== false ? 'checked' : ''}></label>
                    <label class="njc-switch"><span>美化图片不带来源<small>很多图床会拦掉从酒馆页面来的图片请求（防盗链），导致美化里的气泡底图、头像框、图标显示不出来。开着就能正常加载</small></span><input type="checkbox" data-njc-opt="noReferrer" ${opt.noReferrer !== false ? 'checked' : ''}></label>
                </div>
            </div>`;
    }

    // 长按底栏打开的面板用：完整一份
    renderCardHtml({ chatId = '', inModal = false } = {}) {
        return `
            <section class="wechat-detail-card njc-card${inModal ? ' is-modal' : ''}">
                <div class="njc-note">关掉美化即回到柚月原样，功能不受影响。聊天设置的「界面风格」里也有同样的选项。</div>
                ${this.renderChatPartHtml({ chatId })}
                ${this.renderExtrasPartHtml({ chatId })}
            </section>`;
    }

    _notify(title, msg, icon = '✅') {
        try { this.app?.phoneShell?.showNotification?.(title, msg, icon); } catch (e) { /* 忽略 */ }
    }

    _newId() { return `nj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

    _rerenderPart(part) {
        const chatId = part.dataset.njcChat || '';
        const holder = document.createElement('div');
        holder.innerHTML = (part.dataset.njcPart === 'chat' ? this.renderChatPartHtml({ chatId }) : this.renderExtrasPartHtml({ chatId })).trim();
        const fresh = holder.firstElementChild;
        part.replaceWith(fresh);
        this.bindCard(fresh.parentElement || document);
        // 通知「界面风格」卡片刷新内置风格方块的选中状态
        fresh.dispatchEvent(new CustomEvent('njc:changed', { bubbles: true }));
    }

    _rerenderAllParts(from) {
        const host = from?.closest?.('.wechat-detail-card') || from?.parentElement || document;
        host.querySelectorAll('.njc-part').forEach(p => this._rerenderPart(p));
    }

    bindCard(root = document) {
        const parts = root.matches?.('.njc-part') ? [root] : Array.from(root.querySelectorAll('.njc-part'));
        parts.forEach(part => {
            if (part.dataset.njcBound === '1') return;
            part.dataset.njcBound = '1';
            part.querySelectorAll('.njc-sec[data-njc-kind]').forEach(sec => this._bindSection(part, sec));
            this._bindFrames(part);
            part.querySelectorAll('[data-njc-opt]').forEach(inp => inp.addEventListener('change', () => {
                const o = this.getOptions();
                o[inp.dataset.njcOpt] = !!inp.checked;
                this.saveOptions(o);
                this.applyStyles();
            }));
        });
    }

    _bindSection(card, sec) {
        // card 这里是 .njc-part
        const kind = sec.dataset.njcKind;
        const q = k => sec.querySelector(`[data-njc="${k}"]`);
        const editor = q('editor');
        const text = q('text');
        let editingId = null;
        const label = kind === 'chat' ? '聊天美化' : '聊天列表美化';

        const pick = (id) => {
            this.setActiveId(kind, id);
            this.refreshApp();
            const p = this.getActiveProfile(kind);
            this._notify(label, p ? `已应用「${p.name}」` : '已关闭，恢复柚月原样');
            this._rerenderAllParts(card);
        };
        q('select')?.addEventListener('change', (e) => pick(e.target.value));
        sec.querySelectorAll('[data-njc-pick]').forEach(t => t.addEventListener('click', () => pick(t.classList.contains('active') ? '' : t.dataset.njcPick)));
        q('off')?.addEventListener('click', () => pick(''));

        const upsert = (name, css, id = null) => {
            const list = this.getProfiles(kind);
            const now = Date.now();
            let p = id ? list.find(x => x.id === id) : list.find(x => x.name === name);
            if (p && !id && !window.confirm(`已经有一个叫「${name}」的美化，要覆盖吗？`)) return null;
            if (p) { p.css = css; p.updatedAt = now; if (name) p.name = name; } else { p = { id: this._newId(), name, css, createdAt: now, updatedAt: now }; list.push(p); }
            this.saveProfiles(kind, list);
            this.setActiveId(kind, p.id);
            this.refreshApp();
            return p;
        };

        q('import')?.addEventListener('click', () => { const f = q('file'); if (f) { f.value = ''; f.click(); } });
        q('file')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > 3 * 1024 * 1024) { this._notify('导入失败', '文件不能超过 3MB', '⚠️'); return; }
            try {
                const css = String(await file.text()).replace(/^\uFEFF/, '');
                if (!css.trim()) { this._notify('导入失败', '文件是空的', '⚠️'); return; }
                const name = String(file.name || '').replace(/\.(css|txt)$/i, '').trim() || '导入的美化';
                const p = upsert(name, css);
                if (!p) return;
                this._notify('导入成功', `${label}「${p.name}」已应用`);
                this._rerenderAllParts(card);
            } catch (err) {
                this._notify('导入失败', err?.message || '读不了这个文件', '❌');
            }
        });

        const openEditor = (id, css) => {
            editingId = id;
            if (text) text.value = css || '';
            if (editor) editor.hidden = false;
            text?.focus();
        };
        q('paste')?.addEventListener('click', () => openEditor(null, ''));
        q('edit')?.addEventListener('click', () => { const p = this.getActiveProfile(kind); if (p) openEditor(p.id, p.css); });
        q('cancel')?.addEventListener('click', () => { if (editor) editor.hidden = true; editingId = null; });
        q('save')?.addEventListener('click', () => {
            const css = String(text?.value || '');
            if (!css.trim()) { this._notify('保存失败', '还没有填 CSS', '⚠️'); return; }
            let p = null;
            if (editingId) {
                p = upsert('', css, editingId);
            } else {
                const name = String(window.prompt('给这套美化起个名字', '') || '').trim();
                if (!name) return;
                p = upsert(name, css);
            }
            if (!p) return;
            this._notify('已保存', `${label}「${p.name}」已应用`);
            this._rerenderAllParts(card);
        });
        q('rename')?.addEventListener('click', () => {
            const list = this.getProfiles(kind);
            const p = list.find(x => x.id === this.getActiveId(kind));
            if (!p) return;
            const name = String(window.prompt('新名字', p.name) || '').trim();
            if (!name || name === p.name) return;
            p.name = name;
            this.saveProfiles(kind, list);
            this._rerenderAllParts(card);
        });
        q('export')?.addEventListener('click', () => {
            const p = this.getActiveProfile(kind);
            if (!p) return;
            try {
                const blob = new Blob([p.css], { type: 'text/css' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${p.name}.css`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            } catch (e) { this._notify('导出失败', e?.message || '', '❌'); }
        });
        q('delete')?.addEventListener('click', () => {
            const list = this.getProfiles(kind);
            const id = this.getActiveId(kind);
            const idx = list.findIndex(x => x.id === id);
            if (idx < 0) return;
            if (!window.confirm(`删除${label}「${list[idx].name}」？`)) return;
            list.splice(idx, 1);
            this.saveProfiles(kind, list);
            this.setActiveId(kind, '');
            this.refreshApp();
            this._rerenderAllParts(card);
        });
    }

    _bindFrames(card) {
        if (!card.querySelector('.njc-frame-row')) return;
        const chatId = card.dataset.njcChat || '';
        const fileInput = card.querySelector('[data-njc-frame="file"]');
        let target = null;
        const setUrl = (scope, side, url) => {
            const f = this.getFrames();
            if (scope === 'chat' && chatId) {
                f.chats = f.chats || {};
                f.chats[chatId] = { ...(f.chats[chatId] || {}), [side]: url };
                if (!f.chats[chatId].them && !f.chats[chatId].me) delete f.chats[chatId];
            } else {
                f[side] = url;
            }
            this.saveFrames(f);
            this.schedule();
            this._rerenderAllParts(card);
        };
        card.querySelectorAll('.njc-frame-row').forEach(row => {
            const scope = row.dataset.njcFrameScope;
            const side = row.dataset.njcFrameSide;
            row.querySelector('[data-njc-frame="upload"]')?.addEventListener('click', () => { target = { scope, side }; if (fileInput) { fileInput.value = ''; fileInput.click(); } });
            row.querySelector('[data-njc-frame="link"]')?.addEventListener('click', () => {
                const url = String(window.prompt('头像框图片链接（透明 PNG / GIF）', '') || '').trim();
                if (!url) return;
                if (!/^(https?:|data:image\/|\/)/i.test(url)) { this._notify('链接不对', '请填 http(s) 开头的图片链接', '⚠️'); return; }
                setUrl(scope, side, url);
            });
            row.querySelector('[data-njc-frame="clear"]')?.addEventListener('click', () => setUrl(scope, side, ''));
        });
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !target) return;
            if (file.size > 4 * 1024 * 1024) { this._notify('上传失败', '图片不能超过 4MB', '⚠️'); return; }
            try {
                const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = rej; r.readAsDataURL(file); });
                let url = '';
                try { url = await window.VirtualPhone?.imageManager?.uploadDataUrl?.(dataUrl, 'avatar_frame'); } catch (err) { url = ''; }
                setUrl(target.scope, target.side, url || dataUrl);
                this._notify('头像框', '已更新');
            } catch (err) {
                this._notify('上传失败', err?.message || '', '❌');
            }
        });
        card.querySelectorAll('[data-njc-frame-num]').forEach(inp => {
            const key = inp.dataset.njcFrameNum;
            const out = inp.parentElement?.querySelector('b');
            inp.addEventListener('input', () => {
                const v = Number(inp.value);
                if (out) out.textContent = key === 'scale' ? `${v.toFixed(2)}×` : `${v}px`;
                document.querySelectorAll('.wechat-app').forEach(a => a.style.setProperty(key === 'scale' ? '--nuo-avatar-frame-scale' : '--nuo-avatar-frame-offset-y', key === 'scale' ? String(v) : `${v}px`));
            });
            inp.addEventListener('change', () => {
                const f = this.getFrames();
                f[key] = Number(inp.value);
                this.saveFrames(f);
                this.schedule();
            });
        });
    }
}

const NJ_UI_CSS = `
.njc-sec-title small { display: block; font-size: 11px; font-weight: 400; color: #9a9ea6; line-height: 1.45; margin-top: 2px; }
.njc-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 6px; }
.njc-tile { border: 1.5px solid transparent; background: transparent; border-radius: 12px; padding: 0 0 6px; cursor: pointer; -webkit-tap-highlight-color: transparent; min-width: 0; }
.njc-tile.active { border-color: #07c160; }
.njc-tile-mock { display: block; position: relative; height: 74px; border-radius: 10px; overflow: hidden; background: linear-gradient(160deg, #fdf3f7, #eef3ff); box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.njc-tile-mock i { position: absolute; display: block; }
.njc-tm-h { left: 0; right: 0; top: 0; height: 15px; background: rgba(255,255,255,.85); }
.njc-tm-in { left: 7px; top: 24px; width: 46%; height: 13px; border-radius: 7px; background: #fff; }
.njc-tm-out { right: 7px; top: 42px; width: 40%; height: 13px; border-radius: 7px; background: #f7c6d9; }
.njc-tm-f { left: 0; right: 0; bottom: 0; height: 12px; background: rgba(255,255,255,.85); }
.njc-tile-mock b { position: absolute; right: 6px; bottom: 14px; font-size: 14px; font-weight: 400; }
.njc-tile.is-add .njc-tile-mock { background: #f5f6f8; border: 1.5px dashed #d5d8de; box-shadow: none; box-sizing: border-box; }
.njc-tile.is-add .njc-tile-mock b { left: 0; right: 0; top: 50%; bottom: auto; transform: translateY(-50%); text-align: center; font-size: 22px; color: #9aa0a8; }
.njc-tile em { display: block; font-style: normal; font-size: 12px; margin-top: 5px; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
.wsk-card .wsk-builtin { padding: 10px 0; border-top: 1px solid rgba(0,0,0,.06); }
.wsk-card .njc-part[data-njc-part="chat"] .njc-sec { border-top: 0; padding-top: 2px; }
.njc-card .njc-note { font-size: 11px; color: #8a8f98; line-height: 1.5; margin: -4px 0 10px; }
.njc-sec { padding: 10px 0; border-top: 1px solid rgba(0,0,0,.06); }
.njc-sec:first-of-type { border-top: 0; }
.njc-sec-title { font-size: 13.5px; font-weight: 650; color: #30343b; margin-bottom: 3px; }
.njc-desc { font-size: 11px; color: #9a9ea6; line-height: 1.45; margin-bottom: 8px; }
.njc-sub { font-size: 11.5px; color: #6b7280; margin: 10px 0 6px; }
.njc-select { width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; border: 1px solid #e6e6e9; border-radius: 9px; background: #fafafa; color: #222; font-size: 13px; }
.njc-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.njc-btns button, .njc-frame-row button { border: 1px solid #e3e5e8; background: #f7f8fa; color: #333; border-radius: 8px; padding: 5px 10px; font-size: 12px; cursor: pointer; line-height: 1.3; }
.njc-btns button:disabled, .njc-frame-row button:disabled { opacity: .45; cursor: default; }
.njc-btns button.is-primary { background: #07c160; border-color: #07c160; color: #fff; }
.njc-btns button.is-danger { color: #d93025; border-color: #f3d0cd; background: #fff7f6; }
.njc-editor textarea { width: 100%; box-sizing: border-box; min-height: 180px; margin-top: 8px; padding: 8px; border: 1px solid #e3e5e8; border-radius: 9px; background: #fbfbfb; color: #222;
  font: 11.5px/1.45 ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
.njc-frame-row { display: flex; align-items: center; gap: 6px; margin: 6px 0; }
.njc-frame-prev { flex: 0 0 34px; width: 34px; height: 34px; border-radius: 8px; background: #f2f3f5 center / contain no-repeat; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #aaa; }
.njc-frame-label { flex: 1; min-width: 0; font-size: 12.5px; color: #333; }
.njc-range { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: #555; }
.njc-range input { flex: 1; }
.njc-range b { font-weight: 500; color: #888; min-width: 44px; text-align: right; }
.njc-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: #222; }
.njc-switch small { display: block; font-size: 11px; color: #999; margin-top: 3px; line-height: 1.4; }
.njc-modal { position: absolute; inset: 0; z-index: 99990; background: rgba(0,0,0,.35); display: flex; align-items: flex-end; justify-content: center; }
.njc-modal-sheet { width: 100%; max-height: 86%; display: flex; flex-direction: column; background: #f4f5f7; border-radius: 18px 18px 0 0; overflow: hidden; box-shadow: 0 -8px 30px rgba(0,0,0,.18); }
.njc-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: 15px; font-weight: 650; color: #222; background: #fff; }
.njc-modal-close { border: 0; background: #f0f1f3; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; color: #555; }
.njc-modal-body { overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: 16px; }
.njc-modal-body .njc-card { margin: 12px; }
html[data-wx-mode="night"] .njc-card .njc-sec-title, html[data-wx-mode="night"] .njc-frame-label, html[data-wx-mode="night"] .njc-switch { color: inherit; }
`;
