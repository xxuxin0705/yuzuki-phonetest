// 🎨 聊天界面主题：内置 微信 / QQ / LINE + 导入糯叽机 CSS（自动转换成柚月的聊天界面）
//
// · 内置三套就是原来的“界面风格”（所有聊天共用，可切日间 / 夜间）
// · 导入的主题可以只给某个聊天用，也可以设成所有聊天的默认
// · 导入后：原来的气泡样式、风格配色都不再作用于这个聊天，完全按主题显示；按钮一个都不会被藏起来

import { convertNuojiChatCss, YZT_ROOT } from './chat-theme-convert.js?v=20261022-t1';
import { WECHAT_SKINS, WECHAT_SKIN_PALETTE } from './skins.js?v=20261021-m16';

export const YZT_STORE_KEY = 'wechat_chat_themes_v1';
const R = YZT_ROOT;

// ───────────────────────────── 存储 ─────────────────────────────

export function readThemeStore(storage) {
    let raw = null;
    try { raw = storage?.get?.(YZT_STORE_KEY, false); } catch (e) { raw = null; }
    let obj = {};
    try { obj = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}; } catch (e) { obj = {}; }
    const themes = Array.isArray(obj?.themes) ? obj.themes.filter(t => t && t.id && typeof t.source === 'string') : [];
    const chats = obj?.chats && typeof obj.chats === 'object' ? { ...obj.chats } : {};
    const defaultId = themes.some(t => t.id === obj?.defaultId) ? obj.defaultId : '';
    return { themes, chats, defaultId, scope: obj?.scope === 'all' ? 'all' : 'chat' };
}

export function saveThemeStore(storage, store) {
    try { storage?.set?.(YZT_STORE_KEY, JSON.stringify(store)); } catch (e) { console.warn('⚠️ 聊天主题保存失败:', e); }
}

export function resolveChatTheme(store, chatId) {
    const id = String(chatId || '');
    const pick = id && Object.prototype.hasOwnProperty.call(store.chats, id) ? store.chats[id] : store.defaultId;
    if (!pick || pick === 'none') return null;
    return store.themes.find(t => t.id === pick) || null;
}

const compiledCache = new Map();
export function compileTheme(theme) {
    if (!theme) return null;
    const key = `${theme.id}:${theme.updatedAt || 0}:${theme.source.length}`;
    if (compiledCache.has(key)) return compiledCache.get(key);
    let result;
    try {
        result = convertNuojiChatCss(theme.source);
    } catch (e) {
        console.warn('⚠️ 聊天主题转换失败:', e);
        result = { css: '', report: { rules: 0, kept: 0, dropped: 0, error: String(e?.message || e) }, preview: null };
    }
    const alwaysTrans = /--translation-always-show\s*:\s*1\b/.test(theme.source);
    const out = { ...result, alwaysTrans };
    compiledCache.set(key, out);
    if (compiledCache.size > 12) compiledCache.delete(compiledCache.keys().next().value);
    return out;
}

// ───────────────────────────── 主题底座 ─────────────────────────────
// 导入主题时先把柚月原来的风格清掉，换成糯叽机的默认样子，再叠主题自己的规则

export const YZT_BASE_CSS = `
${R} { --yzt-safe-top: 32px; --nuo-safe-top: 32px; --nuo-safe-bottom: 0px; --yzt-vw: 3.9px; --yzt-vh: 8px; }
/* 顶栏 */
${R} > .wechat-header {
    position: relative !important; display: flex !important; align-items: center !important; justify-content: space-between !important;
    height: calc(56px + var(--yzt-safe-top)) !important; padding-top: var(--yzt-safe-top) !important; padding-left: 10px !important; padding-right: 10px !important;
    background: rgba(255,255,255,.94) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border-bottom: .5px solid #efefef !important; box-shadow: none !important; overflow: visible !important;
}
${R} > .wechat-header .wechat-header-left { width: auto !important; min-width: 34px; display: flex !important; align-items: center; flex: 0 0 auto; }
${R} > .wechat-header .wechat-header-title {
    position: static !important; flex: 1 1 auto !important; min-width: 0 !important; display: grid !important;
    grid-template-columns: auto minmax(0, 1fr); grid-auto-rows: auto; column-gap: 10px; align-items: center; align-content: center;
    text-align: left !important; margin: 0 6px !important; color: #262626 !important;
}
${R} > .wechat-header .wx-head-avatar {
    display: flex !important; grid-row: 1 / span 2; width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; overflow: hidden;
    align-items: center; justify-content: center; background: #fff; box-shadow: none; font-size: 16px;
}
${R} > .wechat-header .wx-head-avatar > *, ${R} > .wechat-header .wx-head-avatar img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: inherit !important; }
${R} > .wechat-header .wechat-header-title-text {
    grid-column: 2; display: block !important; min-width: 0; max-width: 100%; color: #262626 !important; font-size: 16px !important;
    font-weight: 700 !important; line-height: 1.25 !important; text-shadow: none !important; white-space: nowrap; text-overflow: ellipsis;
}
${R} > .wechat-header .wx-head-sub { display: block !important; grid-column: 2; margin: 1px 0 0 !important; color: #8e8e8e !important; font-size: 12px !important; line-height: 1.2 !important; }
${R} > .wechat-header .wx-head-sub::before { content: none !important; }
${R} > .wechat-header .status-dot { display: none !important; }
${R} > .wechat-header :is(.wechat-back-btn, .wechat-header-btn) {
    color: #262626 !important; background: none !important; text-shadow: none !important; border: 0 !important;
    min-width: 32px; min-height: 32px; display: inline-flex !important; align-items: center; justify-content: center;
    visibility: visible !important; opacity: 1 !important; font-size: 18px !important;
}
${R} > .wechat-header .wechat-header-right { display: flex !important; align-items: center; gap: 14px; min-width: 32px !important; flex: 0 0 auto; visibility: visible !important; opacity: 1 !important; }
${R} > .wechat-header #chat-info .fa-ellipsis { display: none !important; }
${R} > .wechat-header #chat-info .wx-bars-icon { display: block !important; }
/* 消息区 */
${R} > .wechat-content { background-color: transparent; }
${R} .chat-messages { padding: 12px 12px 6px !important; }
${R} .chat-message:not(.message-system) { position: relative !important; margin-bottom: 14px !important; }
${R} .chat-message:not(.message-system):is(.yzt-first, .yzt-mid) { margin-bottom: 4px !important; }
${R} .chat-message:not(.message-system) > .message-content { max-width: 72% !important; position: relative !important; }
${R} .chat-message:not(.message-system) > .message-avatar {
    width: 36px !important; height: 36px !important; border-radius: 50% !important; background: #fff !important;
    box-shadow: none !important; border: 0 !important; overflow: hidden !important;
}
${R} .chat-message:not(.message-system) > .message-avatar img { border-radius: inherit !important; }
${R} .chat-message:not(.message-system):is(.yzt-mid, .yzt-last) > .message-avatar { visibility: hidden !important; }
${R} .chat-message:not(.message-system):is(.yzt-mid, .yzt-last) .message-sender { display: none !important; }
${R} .chat-message:not(.message-system) .message-sender { color: #8e8e8e !important; font-size: 12px !important; margin: 0 0 3px !important; text-shadow: none !important; }
${R} .chat-message:not(.message-system) .message-text {
    background: #efefef !important; color: #262626 !important; border: 0 !important; border-radius: 18px !important;
    padding: 9px 13px !important; font-size: 15px !important; line-height: 1.4 !important; box-shadow: none !important;
    text-shadow: none !important; filter: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border-image: none !important; background-image: none !important;
}
${R} .chat-message:not(.message-system).message-right .message-text { background: #0095f6 !important; color: #fff !important; }
${R} .chat-message:not(.message-system) .message-text::before, ${R} .chat-message:not(.message-system) .message-text::after {
    content: none !important; position: absolute; top: auto; right: auto; bottom: auto; left: auto; width: auto; height: auto;
    margin: 0; padding: 0; border: 0 none !important; border-image: none !important; background: none; box-shadow: none !important;
    clip-path: none !important; filter: none !important; transform: none; opacity: 1;
}
${R} .chat-message:not(.message-system) .message-text .wechat-trans-fold { border-top: 1px dashed rgba(128,128,128,.28); }
${R} .chat-message:not(.message-system) .message-text .wechat-trans-fold-btn { color: inherit !important; opacity: .7; }
${R} .chat-message:not(.message-system) .message-text .wechat-trans-fold-body { color: inherit !important; opacity: .85; }
${R} .chat-message:not(.message-system) .wx-line-meta { display: none !important; }
${R} .yzt-trans-detached { display: none !important; box-sizing: border-box; max-width: 100%; margin-top: 4px; font-size: 12px; line-height: 1.5; color: #8e8e8e; word-break: break-word; }
${R} .chat-message:not(.message-system).message-right .yzt-trans-detached { align-self: flex-end; text-align: right; }
html[data-yzt-theme]:not([data-yzt-trans-always]) :is(#phone-panel-content, body) .wechat-app:not(#yzt-none):has(.chat-room) .chat-message:not(.message-system) > .message-content:has(.wechat-trans-fold:not(.expanded)) > .yzt-trans-detached.yzt-trans-detached.yzt-trans-detached { display: none !important; }
${R} .time-divider-text { color: #8e8e8e !important; background: transparent !important; font-size: 11px !important; padding: 2px 8px !important; border-radius: 10px !important; text-shadow: none !important; }
${R} .system-message-bubble { background: transparent !important; color: #8e8e8e !important; }
/* 输入栏 */
${R} .chat-input-area { position: relative !important; overflow: visible !important; contain: none !important; transform: none !important; background: rgba(255,255,255,.94) !important; border-top: .5px solid #efefef !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; box-shadow: none !important; }
${R} .chat-input-area .chat-input-bar { display: flex !important; align-items: center !important; gap: 4px !important; padding: 8px 10px !important; background: transparent !important; border: 0 !important; position: relative; }
${R} .chat-input-area .yzt-btns-left, ${R} .chat-input-area .yzt-btns-right { display: flex !important; align-items: center !important; flex: 0 0 auto; visibility: visible !important; opacity: 1 !important; }
${R} .chat-input-area .yzt-action-bar {
    display: flex !important; align-items: center !important; flex: 1 1 auto !important; min-width: 0 !important; gap: 2px;
    min-height: 40px; padding: 0 4px 0 14px; border-radius: 22px; background: #efefef; box-sizing: border-box;
}
${R} .chat-input-area .chat-input-wrapper { flex: 1 1 auto !important; min-width: 0 !important; display: block !important; }
${R} .chat-input-area #chat-input {
    display: block !important; visibility: visible !important; opacity: 1 !important; width: 100% !important;
    background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    color: #262626 !important; padding: 8px 0 !important; font-size: 15px;
}
${R} .chat-input-area .chat-input-bar .input-btn {
    display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;
    position: relative !important; color: #262626 !important; background-color: transparent; flex-shrink: 0 !important;
    width: 32px; height: 32px; min-width: 28px; transform: none;
}
${R} .chat-input-area .chat-input-bar .input-btn > :is(svg, i) { display: block; }
${R} .chat-input-area .chat-input-bar #send-now-btn[data-mode="stop"] { color: #ff3b30 !important; }
`;

// ───────────────────────────── 应用到页面 ─────────────────────────────

function ensureStyleTag(id) {
    let tag = document.getElementById(id);
    if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
    }
    // 每次都挪到最后，保证排在风格样式、气泡样式后面
    document.head.appendChild(tag);
    return tag;
}

let appliedKey = '';
export function applyChatTheme(theme) {
    const root = document.documentElement;
    if (!root) return;
    if (!theme) {
        if (root.hasAttribute('data-yzt-theme')) root.removeAttribute('data-yzt-theme');
        root.removeAttribute('data-yzt-trans-always');
        const tag = document.getElementById('wechat-yzt-theme');
        if (tag && tag.textContent) tag.textContent = '';
        appliedKey = '';
        return;
    }
    const compiled = compileTheme(theme);
    const base = ensureStyleTag('wechat-yzt-base');
    if (base.textContent !== YZT_BASE_CSS) base.textContent = YZT_BASE_CSS;
    const tag = ensureStyleTag('wechat-yzt-theme');
    const key = `${theme.id}:${theme.updatedAt || 0}`;
    if (appliedKey !== key || !tag.textContent) {
        tag.textContent = compiled?.css || '';
        appliedKey = key;
    }
    root.setAttribute('data-yzt-theme', theme.id);
    if (compiled?.alwaysTrans) root.setAttribute('data-yzt-trans-always', '1'); else root.removeAttribute('data-yzt-trans-always');
}

export function applyChatThemeForChat(app) {
    const chat = app?.currentChat;
    if (!chat) { applyChatTheme(null); return null; }
    const store = readThemeStore(app.storage);
    const theme = resolveChatTheme(store, chat.id);
    applyChatTheme(theme);
    return theme;
}

// ───────────────────────────── 消息行标记 ─────────────────────────────
// 连发位置（第一条 / 中间 / 最后 / 单条）、头像名字变量、气泡外翻译块

const cssString = s => `"${String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
const cssUrl = s => `url("${String(s || '').replace(/"/g, '%22').replace(/[\r\n]/g, '')}")`;
const setVar = (el, name, value) => {
    if (!el) return;
    if (!value) { if (el.style.getPropertyValue(name)) el.style.removeProperty(name); return; }
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
};
const avatarSrc = el => {
    const imgs = el ? el.querySelectorAll('img') : [];
    const img = imgs[imgs.length - 1];
    const src = img?.getAttribute('src') || '';
    return src && !/^data:,?$/.test(src) ? src : '';
};

function chatIdentity(app) {
    const chat = app?.currentChat;
    const data = app?.wechatData;
    if (!chat || !data) return { charName: '', userName: '' };
    const user = data.getUserInfo?.() || {};
    if (chat.type === 'group') return { charName: String(chat.name || ''), userName: String(user.name || ''), group: true };
    let contact = null;
    try { contact = chat.contactId ? data.getContact(chat.contactId) : data.getContactByName(chat.name); } catch (e) { contact = null; }
    const charName = String(contact?.remark || '').trim() || String(contact?.name || chat.name || '').trim();
    return { charName, userName: String(user.name || ''), group: false };
}

function clearMarkers(box) {
    if (!box || box.dataset.yztMarked !== '1') return;
    delete box.dataset.yztMarked;
    box.removeAttribute('data-yzt-kind');
    box.querySelectorAll('.yzt-trans-detached').forEach(n => n.remove());
    box.querySelectorAll('.chat-message').forEach(el => {
        el.classList.remove('yzt-first', 'yzt-mid', 'yzt-last', 'yzt-single');
        ['--char-avatar', '--char-name', '--user-avatar'].forEach(v => el.style.removeProperty(v));
    });
}

export function syncThemeMarkers(box, app) {
    if (!box) return;
    if (!document.documentElement.hasAttribute('data-yzt-theme')) { clearMarkers(box); return; }
    box.dataset.yztMarked = '1';
    const appEl = box.closest('.wechat-app');
    const id = chatIdentity(app);
    const kind = id.group ? 'group' : 'single';
    if (box.getAttribute('data-yzt-kind') !== kind) box.setAttribute('data-yzt-kind', kind);
    if (appEl) {
        setVar(appEl, '--char-name', id.charName ? cssString(id.charName) : '');
        setVar(appEl, '--user-name', id.userName ? cssString(id.userName) : '');
        const headSrc = avatarSrc(appEl.querySelector(':scope > .wechat-header .wx-head-avatar'));
        setVar(appEl, '--char-avatar', headSrc ? cssUrl(headSrc) : '');
        const w = appEl.clientWidth || 0;
        const h = appEl.clientHeight || 0;
        if (w) setVar(appEl, '--yzt-vw', `${(w / 100).toFixed(2)}px`);
        if (h) setVar(appEl, '--yzt-vh', `${(h / 100).toFixed(2)}px`);
    }

    // 连发分组
    const rows = [];
    let run = [];
    const flush = () => { if (run.length) rows.push(run); run = []; };
    Array.from(box.children).forEach(el => {
        const isMsg = el.classList.contains('chat-message') && !el.classList.contains('message-system') && el.dataset.sender !== undefined;
        if (!isMsg) { flush(); return; }
        if (run.length && run[run.length - 1].dataset.sender !== el.dataset.sender) flush();
        run.push(el);
    });
    flush();
    let userAvatar = '';
    rows.forEach(group => {
        group.forEach((el, i) => {
            const pos = group.length === 1 ? 'single' : (i === 0 ? 'first' : (i === group.length - 1 ? 'last' : 'mid'));
            ['first', 'mid', 'last', 'single'].forEach(p => {
                const on = p === pos;
                if (el.classList.contains(`yzt-${p}`) !== on) el.classList.toggle(`yzt-${p}`, on);
            });
            const isMe = el.classList.contains('message-right');
            const src = avatarSrc(el.querySelector(':scope > .message-avatar'));
            if (isMe) {
                if (src) userAvatar = src;
                setVar(el, '--user-avatar', src ? cssUrl(src) : '');
            } else {
                setVar(el, '--char-avatar', src ? cssUrl(src) : '');
                if (id.group) {
                    const name = el.querySelector('.message-sender-name')?.textContent?.trim() || el.dataset.sender || '';
                    setVar(el, '--char-name', name ? cssString(name) : '');
                }
            }
            syncDetachedTranslation(el, isMe);
        });
    });
    if (appEl && userAvatar) setVar(appEl, '--user-avatar', cssUrl(userAvatar));
}

function syncDetachedTranslation(row, isMe) {
    const content = row.querySelector(':scope > .message-content');
    if (!content) return;
    const body = content.querySelector('.wechat-trans-fold-body');
    let block = content.querySelector(':scope > .yzt-trans-detached');
    if (!body) { if (block) block.remove(); return; }
    if (!block) {
        block = document.createElement('div');
        block.className = `yzt-trans-detached ${isMe ? 'yzt-trans-detached-me' : 'yzt-trans-detached-them'}`;
        block.innerHTML = '<div class="yzt-trans-detached-content"></div>';
        const host = Array.from(content.children).find(c => c.contains(body)) || null;
        if (host) host.insertAdjacentElement('afterend', block); else content.appendChild(block);
    }
    const inner = block.firstElementChild;
    if (inner && inner.innerHTML !== body.innerHTML) inner.innerHTML = body.innerHTML;
}

// ───────────────────────────── 设置页卡片 ─────────────────────────────

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const YZT_CARD_CSS = `
.wsk-card [hidden] { display: none !important; }
.yzt-tile-import .wsk-mock { display: flex; align-items: center; justify-content: center; background: transparent !important; box-shadow: inset 0 0 0 1.5px rgba(0,0,0,.14); border-radius: 10px; }
.yzt-tile-import .wsk-mock b { font-size: 22px; font-weight: 300; color: #8a8a8a; }
.yzt-tile .wsk-mock i.yzt-line { left: 7px; right: 7px; top: 22px; height: 0; border-top: 1px dashed rgba(0,0,0,.22); }
.yzt-tile em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
.yzt-tile .yzt-badge { position: absolute; right: 4px; top: 4px; font-size: 9px; font-style: normal; line-height: 1; padding: 2px 4px; border-radius: 6px; background: rgba(0,0,0,.45); color: #fff; }
.yzt-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.yzt-row > span { flex: 0 0 auto; font-size: 12.5px; color: #444; }
.yzt-row .wsk-modes { flex: 1; margin-top: 0; }
.yzt-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.yzt-acts button { flex: 1 1 auto; border: 0; background: #f2f3f5; color: #333; border-radius: 9px; padding: 7px 8px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.yzt-acts button.is-danger { background: #fff1f0; color: #d93025; }
.yzt-modal { position: absolute; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 12px; background: rgba(0,0,0,.35); }
.yzt-panel { width: 100%; max-width: 380px; max-height: 92%; display: flex; flex-direction: column; background: #fff; color: #222; border-radius: 16px; padding: 14px; box-shadow: 0 12px 36px rgba(0,0,0,.2); box-sizing: border-box; }
.yzt-panel header { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 600; margin-bottom: 10px; }
.yzt-panel header button { border: 0; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: #666; }
.yzt-panel input[type=text] { width: 100%; box-sizing: border-box; border: 1px solid #e3e3e3; border-radius: 9px; padding: 8px 10px; font-size: 13px; background: #fafafa; color: #222; }
.yzt-panel textarea { flex: 1; width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #e3e3e3; border-radius: 9px; padding: 8px 10px; font: 11.5px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #fafafa; color: #222; resize: none; white-space: pre; }
.yzt-panel .yzt-tabs { display: flex; gap: 3px; margin: 10px 0 8px; background: #f2f3f5; border-radius: 10px; padding: 2px; }
.yzt-panel .yzt-tabs button { flex: 1; border: 0; background: transparent; padding: 6px 0; border-radius: 8px; font-size: 12px; color: #666; cursor: pointer; }
.yzt-panel .yzt-tabs button.active { background: #fff; color: #111; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.yzt-panel .yzt-report { font-size: 11px; color: #888; line-height: 1.5; margin-top: 8px; }
.yzt-panel .yzt-foot { display: flex; gap: 8px; margin-top: 10px; }
.yzt-panel .yzt-foot button { flex: 1; border: 0; border-radius: 10px; padding: 9px 0; font-size: 13px; cursor: pointer; background: #f2f3f5; color: #333; }
.yzt-panel .yzt-foot button.is-primary { background: #07c160; color: #fff; font-weight: 600; }
`;

function ensureCardCss() {
    let tag = document.getElementById('wechat-yzt-card-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'wechat-yzt-card-style';
        tag.textContent = YZT_CARD_CSS;
        document.head.appendChild(tag);
    }
}

function renderTiles(app, chatId) {
    const state = app.getWechatSkin?.() || { skin: 'wechat', mode: 'day' };
    const store = readThemeStore(app.storage);
    const active = resolveChatTheme(store, chatId);
    const builtin = WECHAT_SKINS.map(sk => {
        const p = WECHAT_SKIN_PALETTE[sk.id]?.[state.mode] || WECHAT_SKIN_PALETTE[sk.id].day;
        return `<button type="button" class="wsk-tile${!active && state.skin === sk.id ? ' active' : ''}" data-wx-skin-pick="${sk.id}">
            <span class="wsk-mock" style="background:${p.page}">
                <i class="wsk-h" style="background:${p.head}"></i>
                ${sk.id === 'line' ? '<i class="wsk-av"></i>' : ''}
                <i class="wsk-in" style="background:${p.inBg};border-radius:${p.radius}"></i>
                <i class="wsk-out" style="background:${p.outBg};border-radius:${p.radius}"></i>
                <i class="wsk-f" style="background:${p.bar}"></i>
            </span>
            <em>${sk.name}</em>
        </button>`;
    }).join('');
    const custom = store.themes.map(t => {
        const p = compileTheme(t)?.preview || {};
        const bd = p.border ? `;box-shadow:inset 0 0 0 1px ${p.border}` : '';
        const isDefault = store.defaultId === t.id;
        return `<button type="button" class="wsk-tile yzt-tile${active?.id === t.id ? ' active' : ''}" data-yzt-pick="${esc(t.id)}" style="position:relative">
            <span class="wsk-mock" style="background:${esc(p.page || '#f2f2f2')}">
                <i class="wsk-h" style="background:${esc(p.head || '#fafafa')}"></i>
                <i class="wsk-in" style="background:${esc(p.inBg || '#efefef')};border-radius:3px${bd}"></i>
                <i class="wsk-out" style="background:${esc(p.outBg || '#0095f6')};border-radius:3px${bd}"></i>
                <i class="wsk-f" style="background:${esc(p.bar || '#fafafa')}"></i>
                ${isDefault ? '<em class="yzt-badge">默认</em>' : ''}
            </span>
            <em>${esc(t.name || '未命名主题')}</em>
        </button>`;
    }).join('');
    const importTile = `<button type="button" class="wsk-tile yzt-tile-import" data-yzt-import="1">
        <span class="wsk-mock"><b>＋</b></span><em>导入 CSS</em>
    </button>`;
    return builtin + custom + importTile;
}

export function renderThemeCardHtml(app, chatId) {
    ensureCardCss();
    const store = readThemeStore(app.storage);
    const active = resolveChatTheme(store, chatId);
    const state = app.getWechatSkin?.() || { skin: 'wechat', mode: 'day' };
    return `
        <section class="wechat-detail-card wsk-card" data-collapse-key="skin" data-yzt-chat="${esc(chatId)}">
            <div class="wechat-detail-heading">界面风格</div>
            <div class="wsk-tiles">${renderTiles(app, chatId)}</div>
            <div class="yzt-row">
                <span>应用到</span>
                <div class="wsk-modes" data-yzt-scope-box>
                    <button type="button" data-yzt-scope="chat" class="${store.scope !== 'all' ? 'active' : ''}">只这个聊天</button>
                    <button type="button" data-yzt-scope="all" class="${store.scope === 'all' ? 'active' : ''}">所有聊天</button>
                </div>
            </div>
            <div class="wsk-modes" data-yzt-mode-box ${active ? 'hidden' : ''}>
                <button type="button" data-wx-mode-pick="day" class="${state.mode !== 'night' ? 'active' : ''}"><i class="fa-solid fa-sun"></i> 日间</button>
                <button type="button" data-wx-mode-pick="night" class="${state.mode === 'night' ? 'active' : ''}"><i class="fa-solid fa-moon"></i> 夜间</button>
            </div>
            <div class="yzt-acts" data-yzt-acts ${active ? '' : 'hidden'}>
                <button type="button" data-yzt-act="edit"><i class="fa-solid fa-pen"></i> 编辑 CSS</button>
                <button type="button" data-yzt-act="rename">重命名</button>
                <button type="button" data-yzt-act="export">导出</button>
                <button type="button" data-yzt-act="delete" class="is-danger">删除</button>
            </div>
            <div class="wsk-note" data-yzt-note>${noteText(store, chatId, active)}</div>
        </section>`;
}

function noteText(store, chatId, active) {
    if (!active) return '微信 / QQ / LINE 所有聊天共用，只改变样子，功能不变；可以导入糯叽机的聊天美化 CSS，会自动转换成柚月的聊天界面';
    const own = Object.prototype.hasOwnProperty.call(store.chats, String(chatId)) && store.chats[String(chatId)] !== 'none';
    return `当前：「${esc(active.name)}」${own ? '（只用于这个聊天）' : '（所有聊天默认）'}。导入主题后原来的气泡样式、风格配色不再生效，按钮全部保留并跟随主题`;
}

export function bindThemeCard(chatView) {
    const app = chatView.app;
    const view = document.querySelector('.phone-view-current') || document;
    const card = view.querySelector('.wsk-card');
    if (!card || card.dataset.bound === '1') return;
    card.dataset.bound = '1';
    const chatId = card.dataset.yztChat || String(app.currentChat?.id || '');
    const notify = (t, m, i) => app.phoneShell?.showNotification?.(t, m, i);

    const refresh = () => {
        const store = readThemeStore(app.storage);
        const active = resolveChatTheme(store, chatId);
        const state = app.getWechatSkin?.() || { skin: 'wechat', mode: 'day' };
        const tiles = card.querySelector('.wsk-tiles');
        if (tiles) tiles.innerHTML = renderTiles(app, chatId);
        card.querySelectorAll('[data-wx-mode-pick]').forEach(b => b.classList.toggle('active', b.dataset.wxModePick === state.mode));
        card.querySelectorAll('[data-yzt-scope]').forEach(b => b.classList.toggle('active', b.dataset.yztScope === (store.scope === 'all' ? 'all' : 'chat')));
        const modeBox = card.querySelector('[data-yzt-mode-box]');
        if (modeBox) modeBox.hidden = !!active;
        const acts = card.querySelector('[data-yzt-acts]');
        if (acts) acts.hidden = !active;
        const note = card.querySelector('[data-yzt-note]');
        if (note) note.innerHTML = noteText(store, chatId, active);
        applyChatThemeForChat(app);
    };

    // 选中某个主题（id 为空 = 内置风格）
    const pick = (themeId) => {
        const store = readThemeStore(app.storage);
        const value = themeId || 'none';
        if (store.scope === 'all') {
            store.defaultId = themeId || '';
            delete store.chats[chatId];
        } else {
            store.chats[chatId] = value;
            if (!themeId && !store.defaultId) delete store.chats[chatId];
        }
        saveThemeStore(app.storage, store);
    };

    card.addEventListener('click', (e) => {
        const skinTile = e.target.closest('[data-wx-skin-pick]');
        if (skinTile) {
            pick('');
            app.setWechatSkin?.({ skin: skinTile.dataset.wxSkinPick });
            refresh();
            return;
        }
        const themeTile = e.target.closest('[data-yzt-pick]');
        if (themeTile) {
            pick(themeTile.dataset.yztPick);
            refresh();
            return;
        }
        if (e.target.closest('[data-yzt-import]')) {
            openThemeEditor(app, null, (saved) => { pick(saved.id); refresh(); });
            return;
        }
        const scope = e.target.closest('[data-yzt-scope]');
        if (scope) {
            const store = readThemeStore(app.storage);
            store.scope = scope.dataset.yztScope === 'all' ? 'all' : 'chat';
            // 切到“所有聊天”时，把当前这个聊天正在用的主题设成默认
            if (store.scope === 'all') {
                const cur = resolveChatTheme(store, chatId);
                store.defaultId = cur ? cur.id : '';
                delete store.chats[chatId];
            }
            saveThemeStore(app.storage, store);
            refresh();
            return;
        }
        const mode = e.target.closest('[data-wx-mode-pick]');
        if (mode) {
            app.setWechatSkin?.({ mode: mode.dataset.wxModePick });
            refresh();
            return;
        }
        const act = e.target.closest('[data-yzt-act]');
        if (act) {
            const store = readThemeStore(app.storage);
            const theme = resolveChatTheme(store, chatId);
            if (!theme) return;
            const kind = act.dataset.yztAct;
            if (kind === 'edit') {
                openThemeEditor(app, theme, () => refresh());
            } else if (kind === 'rename') {
                const name = String(window.prompt('主题名称', theme.name || '') || '').trim();
                if (!name) return;
                theme.name = name.slice(0, 30);
                saveThemeStore(app.storage, store);
                refresh();
            } else if (kind === 'export') {
                try {
                    const blob = new Blob([theme.source], { type: 'text/css;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${(theme.name || 'chat-theme').replace(/[\\/:*?"<>|]+/g, '_')}.css`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
                } catch (err) {
                    notify('导出失败', err?.message || '无法导出', '❌');
                }
            } else if (kind === 'delete') {
                if (!window.confirm(`删除主题「${theme.name}」？用到它的聊天会换回内置风格。`)) return;
                store.themes = store.themes.filter(t => t.id !== theme.id);
                if (store.defaultId === theme.id) store.defaultId = '';
                Object.keys(store.chats).forEach(k => { if (store.chats[k] === theme.id) delete store.chats[k]; });
                saveThemeStore(app.storage, store);
                refresh();
                notify('已删除', `主题「${theme.name}」已删除`, '🗑️');
            }
        }
    });
}

// ───────────────────────────── 导入 / 编辑弹窗 ─────────────────────────────

function newThemeId(store) {
    let id = '';
    do { id = `yzt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; } while (store.themes.some(t => t.id === id));
    return id;
}

// 糯叽机有时导出成 json：把里面的 CSS 字段取出来
function extractCssFromFile(text) {
    const t = String(text || '').trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return t;
    try {
        const obj = JSON.parse(t);
        const seen = [];
        const walk = (o, depth = 0) => {
            if (!o || depth > 4) return;
            if (typeof o === 'string') { if (/[{};]/.test(o) && /\.(bubble|chat|input|msg)-|--bubble-|--chat-/.test(o)) seen.push(o); return; }
            if (typeof o === 'object') Object.values(o).forEach(v => walk(v, depth + 1));
        };
        walk(obj);
        seen.sort((a, b) => b.length - a.length);
        return seen[0] || t;
    } catch (e) {
        return t;
    }
}

function reportText(r) {
    if (!r) return '';
    if (r.error) return `转换出错：${esc(r.error)}`;
    return `已转换：${r.kept} 条规则用上了，${r.dropped} 条在柚月里没有对应的元素（例如糯叽机独有的卡片、通话按钮），已跳过。界面按钮都会保留。`;
}

export function openThemeEditor(app, theme, onSaved) {
    ensureCardCss();
    const host = document.querySelector('.phone-view-current') || document.querySelector('.phone-screen') || document.body;
    host.querySelector('.yzt-modal')?.remove();
    const isNew = !theme;
    const modal = document.createElement('div');
    modal.className = 'yzt-modal';
    modal.innerHTML = `
        <div class="yzt-panel" role="dialog" aria-label="${isNew ? '导入聊天主题' : '编辑聊天主题'}">
            <header><span>${isNew ? '导入聊天主题' : '编辑聊天主题'}</span><button type="button" data-x aria-label="关闭">×</button></header>
            <input type="text" data-name placeholder="主题名称，例如：轻松熊" maxlength="30" value="${esc(theme?.name || '')}">
            <div class="yzt-tabs"><button type="button" data-tab="src" class="active">原 CSS（可编辑）</button><button type="button" data-tab="out">转换结果</button></div>
            <textarea data-src spellcheck="false" placeholder="把糯叽机的聊天美化 CSS 粘贴到这里，或点下面「选择文件」">${esc(theme?.source || '')}</textarea>
            <textarea data-out spellcheck="false" readonly hidden></textarea>
            <div class="yzt-report" data-report></div>
            <div class="yzt-foot">
                <button type="button" data-file>选择文件</button>
                <button type="button" data-save class="is-primary">${isNew ? '导入并使用' : '保存'}</button>
            </div>
            <input type="file" data-file-input accept=".css,.txt,.json,text/css,text/plain,application/json" hidden>
        </div>`;
    host.appendChild(modal);
    const q = s => modal.querySelector(s);
    const src = q('[data-src]');
    const out = q('[data-out]');
    const report = q('[data-report]');
    const nameInput = q('[data-name]');
    let timer = 0;
    const preview = () => {
        const text = src.value;
        if (!text.trim()) { out.value = ''; report.textContent = ''; return; }
        try {
            const r = convertNuojiChatCss(text);
            out.value = r.css;
            report.innerHTML = reportText(r.report);
        } catch (e) {
            report.textContent = `转换出错：${e?.message || e}`;
        }
    };
    preview();
    src.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(preview, 350); });
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-x]')) { modal.remove(); return; }
        const tab = e.target.closest('[data-tab]');
        if (tab) {
            modal.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === tab));
            const showOut = tab.dataset.tab === 'out';
            if (showOut) preview();
            src.hidden = showOut;
            out.hidden = !showOut;
            return;
        }
        if (e.target.closest('[data-file]')) { q('[data-file-input]').click(); return; }
        if (e.target.closest('[data-save]')) {
            const text = src.value.trim();
            if (!text) { app.phoneShell?.showNotification?.('还没有内容', '请先粘贴或选择 CSS 文件', '⚠️'); return; }
            const store = readThemeStore(app.storage);
            const name = String(nameInput.value || '').trim().slice(0, 30) || '导入主题';
            let saved;
            if (isNew) {
                saved = { id: newThemeId(store), name, source: text, createdAt: Date.now(), updatedAt: Date.now() };
                store.themes.push(saved);
            } else {
                saved = store.themes.find(t => t.id === theme.id);
                if (!saved) { saved = { ...theme }; store.themes.push(saved); }
                saved.name = name;
                saved.source = text;
                saved.updatedAt = Date.now();
            }
            saveThemeStore(app.storage, store);
            modal.remove();
            app.phoneShell?.showNotification?.('已保存', `聊天主题「${name}」已转换为柚月样式`, '🎨');
            onSaved?.(saved);
        }
    });
    q('[data-file-input]').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            src.value = extractCssFromFile(text);
            if (!nameInput.value.trim()) {
                nameInput.value = file.name.replace(/\.(css|txt|json)$/i, '').replace(/^[\[【_][^\]】_]*[\]】_]\s*/, '').replace(/\s*by\s*\S*$/i, '').trim().slice(0, 30) || '导入主题';
            }
            preview();
        } catch (err) {
            app.phoneShell?.showNotification?.('读取失败', err?.message || '无法读取文件', '❌');
        }
    });
}
