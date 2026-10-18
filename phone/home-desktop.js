/* ========================================================
 *  柚月小手机 - 自由桌面（可长按编辑 / 拖动 / 组件 / 主题）
 *  phone/home-desktop.js
 *  - 4×6 网格多页桌面 + Dock
 *  - 长按菜单：编辑内容 / 更换样式 / 编辑主画面 / 换图标 / 移除
 *  - 编辑模式：抖动、拖动换位、拖进/拖出 Dock、拖到屏幕边缘翻页
 *  - 内置组件 + 自定义 HTML/CSS/JS 组件（兼容 .widget.json）
 *  - 导入美化（兼容 糯叽机 主页面 json）、保存/切换/导出主题、图标导入
 *  数据存 IndexedDB（图片多、体积大，不塞进酒馆 settings.json）
 * ======================================================== */

import { BUILTINS as WIDGET_DEFS, WIDGETS_CSS, LEGACY_WIDGET_MAP } from './home-widgets.js?v=20261018-w3';

const STYLE_ID = 'yzd-desktop-style-v2';
const DB_NAME = 'yuzuki-phone-desktop';
const DB_STORE = 'kv';
export const FREE_DESKTOP_FLAG_KEY = 'phone-home-free-desktop';

const COLS = 4;
const ROWS = 6;
const DOCK_MAX = 5;

export const SIZE_DEFS = {
    small:    { w: 2, h: 2, label: '小 2×2' },
    medium:   { w: 4, h: 2, label: '中 4×2' },
    large:    { w: 4, h: 4, label: '大 4×4' },
    size_2x1: { w: 2, h: 1, label: '扁 2×1' },
    size_4x1: { w: 4, h: 1, label: '长条 4×1' },
    size_1x2: { w: 1, h: 2, label: '瘦高 1×2' },
    size_1x1: { w: 1, h: 1, label: '迷你 1×1' }
};

const GAL_CATS = [['all', '全部'], ['small', '小组件'], ['medium', '中组件'], ['large', '大组件']];
/** 尺寸 → 分类：小 = 2×2 及更小（1×1 / 2×1 / 1×2），中 = 4×2 / 4×1，大 = 4×4 */
function sizeCat(size) {
    if (size === 'large') return 'large';
    if (size === 'medium' || size === 'size_4x1') return 'medium';
    return 'small';
}

const BG_OPTIONS = [['glass', '毛玻璃'], ['clear', '透明'], ['solid', '纯色'], ['image', '图片']];
const COMMON_FIELDS = [
    { key: 'bg', label: '背景样式', type: 'select', options: BG_OPTIONS },
    { key: 'bgColor', label: '背景颜色', type: 'color' },
    { key: 'bgAlpha', label: '背景不透明度', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'bgImage', label: '背景图片（背景样式选「图片」时生效）', type: 'image' },
    { key: 'textColor', label: '文字颜色', type: 'color' },
    { key: 'radius', label: '圆角', type: 'range', min: 0, max: 44, step: 1 }
];
const COMMON_DEFAULTS = { bg: 'clear', bgColor: '#ffffff', bgAlpha: 0.38, bgImage: '', textColor: '#2b2b33', radius: 24 };

// 内置组件定义在 home-widgets.js（按糯叽机的小/中/大内置组件重做）
const BUILTINS = WIDGET_DEFS;
const NUO_BUILTIN_TYPE_MAP = { clock: 'clock', calendar: 'month_cal', photo: 'photo', image: 'photo', note: 'text', text: 'text', countdown: 'countdown', music: 'player', vinyl: 'vinyl', badge: 'badge', analog: 'analog', water: 'water', moon: 'moon', zodiac: 'zodiac' };
const defName = (def, size) => def?.names?.[size] || def?.name || '组件';

/* ------------------------------ 工具 ------------------------------ */
const uid = (p = 'w') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function cssUrl(u) {
    const s = String(u || '').trim();
    if (!s) return 'none';
    return `url("${s.replace(/\\/g, '/').replace(/"/g, '%22')}")`;
}
function hexToRgba(hex, a = 1) {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return `rgba(255,255,255,${a})`;
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function normHex(v, fb = '#ffffff') {
    const s = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('');
    return fb;
}
function sizeOf(item) {
    if (item.kind === 'app') return { w: 1, h: 1 };
    return SIZE_DEFS[item.size] || SIZE_DEFS.small;
}
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function stName(which) {
    try {
        const ctx = window.SillyTavern?.getContext?.() || {};
        return String(which === 'user' ? (ctx.name1 || '') : (ctx.name2 || ''));
    } catch (e) { return ''; }
}
function downloadText(filename, text) {
    try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
        return true;
    } catch (e) {
        console.warn('[自由桌面] 导出失败', e);
        return false;
    }
}
function pickFiles({ accept = '*/*', multiple = false } = {}) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(input);
        let done = false;
        const finish = (files) => { if (done) return; done = true; input.remove(); resolve(files); };
        input.addEventListener('change', () => finish(Array.from(input.files || [])));
        input.addEventListener('cancel', () => finish([]));
        input.click();
    });
}
function readFileText(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error);
        r.readAsText(file);
    });
}
function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}
/** 读图并压缩；png/webp 保留透明，gif 原样保留（动图） */
async function readImageFile(file, maxDim = 1200, quality = 0.88) {
    const raw = await readFileDataUrl(file);
    if (/gif|svg/i.test(file.type)) return raw;
    try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale >= 1 && raw.length < 900000) return raw;
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const keepAlpha = /png|webp/i.test(file.type);
        return c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', quality);
    } catch (e) {
        return raw;
    }
}

/* ------------------------------ IndexedDB ------------------------------ */
let _dbPromise = null;
function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE); };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
    });
    return _dbPromise;
}
async function idbGet(key) {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const rq = tx.objectStore(DB_STORE).get(key);
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error);
        });
    } catch (e) {
        console.warn('[自由桌面] 读取失败', key, e);
        return undefined;
    }
}
async function idbSet(key, value) {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch (e) {
        console.warn('[自由桌面] 保存失败', key, e);
        return false;
    }
}

/* 图片组件独立素材库：不借用酒馆背景图存储；state 仅保留素材引用。 */
const WIDGET_MEDIA_DB = 'yuzuki-phone-widget-media';
const WIDGET_MEDIA_STORE = 'images';
const WIDGET_MEDIA_PREFIX = 'yzd-media:';
const widgetMediaCache = new Map();
let widgetMediaDbPromise = null;
function openWidgetMediaDb() {
    if (!widgetMediaDbPromise) {
        widgetMediaDbPromise = new Promise((resolve, reject) => {
            try {
                const req = indexedDB.open(WIDGET_MEDIA_DB, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(WIDGET_MEDIA_STORE);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        }).catch(e => { widgetMediaDbPromise = null; throw e; });
    }
    return widgetMediaDbPromise;
}
async function hydrateWidgetMedia() {
    try {
        const db = await openWidgetMediaDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(WIDGET_MEDIA_STORE, 'readonly');
            const store = tx.objectStore(WIDGET_MEDIA_STORE);
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return resolve();
                widgetMediaCache.set(String(cursor.key), cursor.value);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) { console.warn('[组件素材库] 无法读取独立素材库', e); }
}
async function saveWidgetMedia(dataUrl) {
    if (!dataUrl) return '';
    const id = uid('img');
    try {
        const db = await openWidgetMediaDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(WIDGET_MEDIA_STORE, 'readwrite');
            tx.objectStore(WIDGET_MEDIA_STORE).put(dataUrl, id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        widgetMediaCache.set(id, dataUrl);
        return WIDGET_MEDIA_PREFIX + id;
    } catch (e) {
        console.warn('[组件素材库] 独立存储不可用，改用桌面本地数据', e);
        return dataUrl; // 无 IndexedDB 时仍能使用上传内容，不丢图
    }
}
function resolveWidgetMedia(url) {
    const s = String(url || '');
    return s.startsWith(WIDGET_MEDIA_PREFIX) ? (widgetMediaCache.get(s.slice(WIDGET_MEDIA_PREFIX.length)) || '') : s;
}
// Export JSON is self-contained: the separate local DB must not result in
// broken images after importing a theme on another device/browser.
function embedWidgetMediaForExport(state) {
    const result = clone(state);
    for (const item of result.items || []) {
        if (item.kind !== 'widget' || !item.data) continue;
        const d = item.data;
        if (item.wtype === 'custom') {
            for (const k of Object.keys(d.images || {})) d.images[k] = resolveWidgetMedia(d.images[k]);
            for (const field of d.userFields || []) {
                if (field.type === 'image' && result.widgetState?.[item.id]) {
                    result.widgetState[item.id][field.key] = resolveWidgetMedia(result.widgetState[item.id][field.key]);
                }
            }
        } else {
            for (const field of BUILTINS[item.wtype]?.fields || []) {
                if (field.type === 'image') d[field.key] = resolveWidgetMedia(d[field.key]);
            }
            d.bgImage = resolveWidgetMedia(d.bgImage);
        }
    }
    return result;
}
async function isolateWidgetMediaInState(state) {
    for (const item of state.items || []) {
        if (item.kind !== 'widget' || !item.data) continue;
        const d = item.data;
        if (item.wtype === 'custom') {
            for (const k of Object.keys(d.images || {})) {
                const v = String(d.images[k] || '');
                if (/^data:image\//i.test(v)) d.images[k] = await saveWidgetMedia(v);
            }
            for (const field of d.userFields || []) {
                const values = state.widgetState?.[item.id];
                if (field.type === 'image' && values && /^data:image\//i.test(String(values[field.key] || ''))) {
                    values[field.key] = await saveWidgetMedia(values[field.key]);
                }
            }
        } else {
            for (const field of [...(BUILTINS[item.wtype]?.fields || []), { key: 'bgImage', type: 'image' }]) {
                if (field.type !== 'image') continue;
                const v = String(d[field.key] || '');
                if (/^data:image\//i.test(v)) d[field.key] = await saveWidgetMedia(v);
            }
        }
    }
    return state;
}

function resolveWidgetFields(data, fields) {
    const resolved = { ...data };
    for (const f of fields || []) if (f.type === 'image') resolved[f.key] = resolveWidgetMedia(resolved[f.key]);
    resolved.bgImage = resolveWidgetMedia(resolved.bgImage);
    return resolved;
}
function applyWidgetImagePositions(box, resolved, original, fields) {
    for (const field of fields || []) {
        if (field.type !== 'image') continue;
        const url = resolved[field.key];
        if (!url) continue;
        const zoom = clamp(Number(original[field.key + 'Zoom'] ?? 100) || 100, 100, 300);
        const x = clamp(Number(original[field.key + 'PosX'] ?? 50), 0, 100);
        const y = clamp(Number(original[field.key + 'PosY'] ?? 50), 0, 100);
        // 以对应素材的 URL 精确定位背景元素，不会误改其他图的布局。
        for (const el of box.querySelectorAll('[style]')) {
            if (!el.style.backgroundImage || !el.style.backgroundImage.includes(url)) continue;
            el.style.backgroundPosition = `${x}% ${y}%`;
            if (zoom !== 100) el.style.backgroundSize = `${zoom}% auto`;
        }
    }
}

/* ------------------------------ 主题风格图标（线条图标，按主题颜色上色） ------------------------------ */
// 自绘 24×24 线条图标，风格对齐糯叽机的 component:IconXxx（它的图标本身也是矢量线条 + 主题色）
const GLYPHS = {
    wechat: '<path d="M4 11.5c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7c-1 0-2-.15-2.9-.45L5 19.5l1-3.4C4.75 14.9 4 13.3 4 11.5z"/><circle cx="9" cy="11.5" r=".9" class="f"/><circle cx="12" cy="11.5" r=".9" class="f"/><circle cx="15" cy="11.5" r=".9" class="f"/>',
    weibo: '<circle cx="12" cy="12" r="8"/><path d="M8 12.5c1.2 1.8 2.5 2.5 4 2.5s2.8-.7 4-2.5"/><circle cx="9.3" cy="9.8" r=".9" class="f"/><circle cx="14.7" cy="9.8" r=".9" class="f"/><path d="M17.5 3.8c1.6.4 2.6 1.4 3 3"/>',
    x: '<path d="M5 4.5l14 15M19 4.5l-14 15"/>',
    honey: '<path d="M12 19.5s-7-4.3-7-9.4C5 7.3 7 5.5 9.2 5.5c1.3 0 2.2.6 2.8 1.6.6-1 1.5-1.6 2.8-1.6 2.2 0 4.2 1.8 4.2 4.6 0 5.1-7 9.4-7 9.4z"/>',
    mofo: '<path d="M5 19L15 9"/><path d="M13.5 7.5l3 3"/><path d="M17 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" class="f"/><path d="M8 4l.4 1 1 .4-1 .4L8 6.8l-.4-1-1-.4 1-.4z" class="f"/>',
    wangxiang: '<circle cx="12" cy="12" r="7.5"/><ellipse cx="12" cy="12" rx="3.2" ry="7.5"/><path d="M4.5 12h15"/>',
    phone: '<path d="M7.2 4.5l2.3 2.6c.4.5.4 1.2-.1 1.7l-1.2 1.2c.9 2 2.4 3.6 4.4 4.6l1.3-1.2c.5-.4 1.2-.5 1.7-.1l2.6 2.2c.6.5.6 1.3.1 1.9l-1.3 1.4c-.7.7-1.8 1-2.8.6C9 17.7 6.3 15 4.6 10.2c-.4-1 0-2.1.7-2.8l1.3-1.1c.2-.2.4-.2.6.2z"/>',
    diary: '<path d="M6 4.5h10.5a1.5 1.5 0 011.5 1.5v13.5H7.5A1.5 1.5 0 016 18V4.5z"/><path d="M6 18a1.5 1.5 0 011.5-1.5H18"/><path d="M9.5 8.5h5M9.5 11.5h3.5"/>',
    music: '<path d="M9.5 17V6.5l9-2V15"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="15" r="2"/>',
    album: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.5-4 3.5 3 3-2.5 4 3.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="14.5" r="1" class="f"/>',
    games: '<path d="M7.5 8h9a4 4 0 013.9 4.9l-.8 3.4a2 2 0 01-3.5.8L14.5 15h-5l-1.6 2.1a2 2 0 01-3.5-.8l-.8-3.4A4 4 0 017.5 8z"/><path d="M8.5 10.5v3M7 12h3"/><circle cx="15.5" cy="11" r=".9" class="f"/><circle cx="17" cy="13" r=".9" class="f"/>',
    storyvoice: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M15 9.5c1 1.4 1 3.6 0 5M17.5 7.5c2 2.6 2 6.4 0 9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/><circle cx="12" cy="12" r="6.2"/>'
};
const _glyphCache = new Map();
function mixHex(hex, factor) {
    const h = normHex(hex, '#8fb8c8').slice(1);
    const n = parseInt(h, 16);
    const f = (c) => Math.round(clamp(c * factor, 0, 255)).toString(16).padStart(2, '0');
    return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
/** 主题色 → 图标线条色：主题的 iconColor 往往很浅，按「强度」压暗一点保证看得清 */
function themeGlyphColor(iconColor, intensity = 60) {
    return mixHex(iconColor, 1 - 0.45 * clamp(Number(intensity) || 60, 0, 100) / 100);
}
function glyphDataUrl(appId, color, fallbackText = '') {
    const key = `${appId}|${color}|${fallbackText}`;
    if (_glyphCache.has(key)) return _glyphCache.get(key);
    const c = normHex(color, '#7fa6b6');
    const body = GLYPHS[appId]
        || `<text x="12" y="16.2" text-anchor="middle" font-size="11" font-family="-apple-system,sans-serif" font-weight="600" fill="${c}" stroke="none">${esc(String(fallbackText || appId || '?').slice(0, 1))}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><style>.f{fill:${c};stroke:none}</style><g transform="translate(9 9) scale(1.25)" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
    const url = 'data:image/svg+xml,' + encodeURIComponent(svg);
    _glyphCache.set(key, url);
    return url;
}

/* ------------------------------ 应用名匹配（主题里的应用 ↔ 柚月小手机的应用） ------------------------------ */
const APP_SYNONYMS = {
    wechat: ['wechat', '微信', '微訊', '消息', '訊息', '信息', '聊天', 'chat', 'chatlist', 'msg', 'msgs', 'message', 'messages', 'ig', 'instagram', 'line', 'qq', 'im', 'imessage', 'iconmsgs'],
    weibo: ['weibo', '微博', 'community', '社区', '社區', 'forum', '论坛', '論壇', '广场', '廣場', 'sns', 'moments', '朋友圈', '动态', '動態', 'thismoment', '此时此刻', '此時此刻'],
    x: ['x', 'twitter', '推特', 'tweet', 'threads'],
    honey: ['honey', '蜜语', '蜜語', 'couples', 'couple', '情侣', '情侶', '情侣空间', '恋爱', '戀愛', 'love', 'heart', 'dating', '约会', '約會'],
    mofo: ['mofo', '魔坊', 'plugins', 'plugin', '插件', 'magic', '魔法', 'magicwand', 'iconmagicwandsparkle', '工坊', 'studio', 'promptpreset', '预设', '預設', 'textalchemist', '文字炼金'],
    wangxiang: ['wangxiang', '万象', '萬象', 'shop', '商店', '购物', '購物', 'delivery', '外卖', '外賣', 'goingout', '出门', '出門', 'wallet', '钱包', '錢包', 'task', '任务', '任務', 'liferpg'],
    phone: ['phone', '通话', '通話', '电话', '電話', 'call', 'calls', 'contacts', '联系人', '聯絡人', 'characterroster', '通讯录', '通訊錄', '角色'],
    diary: ['diary', '日记', '日記', 'memorypalace', '记忆', '記憶', '记忆宫殿', 'journal', 'note', 'notes', '笔记', '筆記', '备忘录', '備忘錄', 'booknook', 'book', '书', '書', 'worldbook', '世界书', '世界書'],
    music: ['music', '音乐', '音樂', 'radio', '电台', '電台', 'player', '播放器', 'song', '歌', 'spotify'],
    album: ['album', '相册', '相簿', '相冊', 'photo', 'photos', 'gallery', '图片', '圖片', 'assetlibrary', '素材', '素材库', '照片', 'camera', '相机', '相機'],
    calendar: ['calendar', '日历', '日曆', 'schedule', '日程', 'pomodoro', '番茄钟', '番茄鐘', 'clock', '时钟', '時鐘'],
    games: ['games', 'game', '游戏', '遊戲', 'gamelobby', '游戏大厅', '遊戲大廳', 'play', 'isekai', '异世界', '異世界', 'desktoppet', '桌宠', '桌寵'],
    storyvoice: ['storyvoice', '朗读', '朗讀', 'tts', 'voice', '语音', '語音', 'read', 'reader', 'speaker'],
    settings: ['settings', 'setting', '设置', '設置', '设定', '設定', 'apisettings', 'api', 'wallpaper', '外观', '外觀', 'appearance', 'config', '偏好', 'icongearkeyhole', 'gear']
};
function normName(x) {
    return String(x || '').toLowerCase().replace(/^component:/, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[\s_\-()（）.·・]/g, '');
}
/** 给一个名字（文件名/主题应用 id/名称），返回最像的柚月应用 id */
function matchAppId(names, apps, displayName) {
    const cands = (Array.isArray(names) ? names : [names]).map(normName).filter(Boolean);
    if (!cands.length) return '';
    // 1. 完全等于 id / 名称 / 自定义名称
    for (const a of apps) {
        const own = [a.id, a.name, displayName?.(a)].map(normName).filter(Boolean);
        if (cands.some(c => own.includes(c))) return a.id;
    }
    // 2. 近义词完全匹配
    for (const a of apps) {
        const syn = (APP_SYNONYMS[a.id] || []).map(normName);
        if (cands.some(c => syn.includes(c))) return a.id;
    }
    // 3. 包含关系（长度≥2，避免 x/ig 误伤）
    for (const a of apps) {
        const words = [a.id, a.name, displayName?.(a), ...(APP_SYNONYMS[a.id] || [])].map(normName).filter(w => w.length >= 2);
        if (cands.some(c => words.some(w => c.includes(w) || (c.length >= 2 && w.includes(c))))) return a.id;
    }
    return '';
}
const isImageUrl = (u) => typeof u === 'string' && /^(data:image\/|https?:\/\/|blob:)/i.test(u.trim());

/* ------------------------------ 全局数据仓库（所有实例共享） ------------------------------ */
const Store = {
    loaded: false,
    loading: null,
    state: null,
    themes: [],
    library: [],
    _timers: {},
    load() {
        if (this.loaded) return Promise.resolve();
        if (this.loading) return this.loading;
        this.loading = (async () => {
            const [state, themes, library] = await Promise.all([idbGet('state'), idbGet('themes'), idbGet('library'), hydrateWidgetMedia()]);
            this.state = state && typeof state === 'object' ? state : null;
            this.themes = Array.isArray(themes) ? themes : [];
            this.library = Array.isArray(library) ? library : [];
            this.loaded = true;
        })();
        return this.loading;
    },
    save(key = 'state', delay = 350) {
        clearTimeout(this._timers[key]);
        this._timers[key] = setTimeout(() => {
            const val = key === 'state' ? this.state : key === 'themes' ? this.themes : this.library;
            idbSet(key, val);
        }, delay);
    }
};

/* ------------------------------ iframe 消息路由 ------------------------------ */
const FRAME_MAP = new Map();
let _msgBound = false;
function bindFrameMessages() {
    if (_msgBound) return;
    _msgBound = true;
    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.__yzw !== 1) return;
        const rec = FRAME_MAP.get(e.source);
        if (!rec) return;
        if (!rec.iframe.isConnected) { FRAME_MAP.delete(e.source); return; }
        rec.desk.onFrameMessage(rec, d);
    });
}

const BRIDGE_JS = `(function(){
var S=__STATE__,P=window.parent,T={};
function post(m){m.__yzw=1;try{P.postMessage(m,'*')}catch(e){}}
function cp(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v))}
window.widget={
 onReady:function(cb){Promise.resolve().then(function(){try{cb()}catch(e){console.error(e)}})},
 getState:function(k){return Promise.resolve(cp(S[k]))},
 getAllState:function(){return Promise.resolve(cp(S))},
 setState:function(k,v){S[k]=v;clearTimeout(T[k]);T[k]=setTimeout(function(){post({t:'set',k:k,v:cp(v)})},500);return Promise.resolve()},
 clearState:function(k){if(k===undefined||k===null){S={}}else{delete S[k]}post({t:'clear',k:(k===undefined?null:k)});return Promise.resolve()},
 align:function(){}
};
var down=false;
addEventListener('pointerdown',function(e){down=true;post({t:'pd',x:e.clientX,y:e.clientY})},true);
addEventListener('pointermove',function(e){if(down)post({t:'pm',x:e.clientX,y:e.clientY})},true);
addEventListener('pointerup',function(e){if(!down)return;down=false;post({t:'pu',x:e.clientX,y:e.clientY})},true);
addEventListener('pointercancel',function(e){if(!down)return;down=false;post({t:'pu',x:e.clientX,y:e.clientY,c:1})},true);
addEventListener('contextmenu',function(e){e.preventDefault()},true);
})();`;

function fillPlaceholders(text, images, state, { html = false } = {}) {
    return String(text || '').replace(/\{\{\s*([\w$\-]+)\s*\}\}/g, (m, key) => {
        if (images && Object.prototype.hasOwnProperty.call(images, key)) {
            const url = String(images[key] || '');
            return html ? url.replace(/"/g, '&quot;') : url;
        }
        let v = state ? state[key] : undefined;
        if ((v === undefined || v === null || v === '') && (key === 'user' || key === 'char')) v = stName(key);
        if (v === undefined || v === null) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return html ? esc(s) : s;
    });
}

function buildSrcdoc(data, state) {
    const images = data.images || {};
    const html = fillPlaceholders(data.html, images, state, { html: true });
    const css = fillPlaceholders(data.css, images, state, { html: false }).replace(/<\/style/gi, '<\\/style');
    const transforms = Object.keys(images).filter(k => !/(Zoom|PosX|PosY)$/.test(k) && images[k]).map(k => ({
        url: String(images[k]), zoom: clamp(Number(images[k + 'Zoom'] ?? 100) || 100, 100, 300),
        x: clamp(Number(images[k + 'PosX'] ?? 50), 0, 100), y: clamp(Number(images[k + 'PosY'] ?? 50), 0, 100)
    }));
    const adjustJs = `addEventListener('DOMContentLoaded',()=>{for(const p of ${JSON.stringify(transforms).replace(/</g, '\\u003c')}){for(const el of document.querySelectorAll('*')){if(el.tagName==='IMG'&&el.getAttribute('src')===p.url){el.style.objectPosition=p.x+'% '+p.y+'%';if(p.zoom!==100){el.style.width=p.zoom+'%';el.style.height=p.zoom+'%';el.style.maxWidth='none';el.style.maxHeight='none'}}else if(el.style?.backgroundImage?.includes(p.url)){el.style.backgroundPosition=p.x+'% '+p.y+'%';if(p.zoom!==100)el.style.backgroundSize=p.zoom+'% auto'}}}});`;
    const stateJson = JSON.stringify(state || {}).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}</style>
<script>${BRIDGE_JS.replace('__STATE__', stateJson)}<\/script>
<style>${css}</style><script>${adjustJs.replace(/<\/script/gi, '<\\/script')}<\/script></head><body>${html}</body></html>`;
}

/* ------------------------------ 默认数据 ------------------------------ */
function defaultStyle() {
    return {
        iconShape: 'rounded', // 默认圆角方形；也可选圆形、原图或直角方形
        iconRadius: 24,      // 圆角方形的半径，0-50（百分比）
        iconFit: 'cover',    // cover 铺满裁切 / contain 完整显示
        iconScale: 100,      // 70-120
        labelColor: '#2b2b33',
        showLabels: true,
        plateColor: '#ffffff',
        plateAlpha: 0,       // 图标底板（透明 PNG 图标用）
        dockColor: '#ffffff',
        dockAlpha: 0.32,
        dockBlur: 18
    };
}
function makeWidget(wtype, size, data = {}) {
    const def = BUILTINS[wtype];
    return {
        id: uid('w'), kind: 'widget', wtype,
        size: (def?.sizes || []).includes(size) ? size : (def?.sizes?.[0] || 'small'),
        page: 0, x: 0, y: 0,
        data: { ...COMMON_DEFAULTS, ...(def?.defaults || {}), _created: Date.now(), ...data }
    };
}
function makeCustomWidget(tpl, size) {
    return {
        id: uid('w'), kind: 'widget', wtype: 'custom',
        size: SIZE_DEFS[size || tpl.size] ? (size || tpl.size) : 'small',
        page: 0, x: 0, y: 0,
        data: {
            name: String(tpl.name || '自定义组件'),
            html: String(tpl.html || ''),
            css: String(tpl.css || ''),
            userFields: Array.isArray(tpl.userFields) ? clone(tpl.userFields) : [],
            images: Object.fromEntries((tpl.imageKeys || Object.keys(tpl.images || {})).map(k => [k, String(tpl.images?.[k] || '')])),
            templateId: tpl.templateId || tpl.tid || ''
        }
    };
}
function emptyState() {
    return { v: 1, pages: 1, items: [], dock: null, hidden: [], widgetState: {}, icons: {}, wallpaper: '', style: defaultStyle(), themeName: '' };
}

/* ======================================================================
 *  FreeDesktop
 * ==================================================================== */
export class FreeDesktop {
    constructor(home) {
        this.home = home;
        this.page = 0;
        this.editing = false;
        this.root = null;
        this.g = null;
        this._tick = null;
        bindFrameMessages();
    }

    static isEnabled() {
        const v = window.VirtualPhone?.storage?.get?.(FREE_DESKTOP_FLAG_KEY);
        return !(v === false || v === 'false' || v === 0 || v === '0');
    }
    static setEnabled(on) {
        window.VirtualPhone?.storage?.set?.(FREE_DESKTOP_FLAG_KEY, !!on);
    }

    get S() { return Store.state; }
    get apps() { return Array.isArray(this.home?.apps) ? this.home.apps : []; }
    getApp(id) { return this.apps.find(a => a.id === id) || null; }

    /* ---------------- 数据初始化 ---------------- */
    _ensureState() {
        if (!Store.state) {
            Store.state = this._buildDefaultState();
            Store.save();
        }
        const s = Store.state;
        s.items = Array.isArray(s.items) ? s.items : [];
        s.hidden = Array.isArray(s.hidden) ? s.hidden : [];
        s.widgetState = s.widgetState && typeof s.widgetState === 'object' ? s.widgetState : {};
        s.icons = s.icons && typeof s.icons === 'object' ? s.icons : {};
        // 老版本从美化 JSON 导入的主题可能把 0 圆角直接应用到全部图标。
        // 只对没有新外形设置的旧主题做一次兼容处理，保留后来手动选的直角模式。
        const previousStyle = s.style || {};
        const migratedSquareTheme = s.themeIcons?.enabled && Number(previousStyle.iconRadius) === 0
            && previousStyle.iconShape === undefined;
        s.style = { ...defaultStyle(), ...previousStyle };
        if (migratedSquareTheme) {
            s.style.iconRadius = 24;
            Store.save('state');
        }
        s.pages = Math.max(1, Number(s.pages) || 1);
        if (!Array.isArray(s.dock)) s.dock = this._legacyDock();
        // 旧版内置组件 → 新内置组件
        s.items.forEach(it => {
            if (it.kind !== 'widget' || it.wtype === 'custom' || BUILTINS[it.wtype]) return;
            const to = LEGACY_WIDGET_MAP[it.wtype]?.(it.size) || 'text';
            const fresh = makeWidget(to, it.size);
            it.wtype = to;
            it.data = { ...fresh.data, ...(it.data || {}), ...(to === 'text' && it.data?.text === undefined ? {} : {}) };
        });
        // 首次升级：仅转换沿用原始预设纯色的组件，不覆盖用户自定的颜色/样式。
        if (!s.transparentDefaultsV1) {
            s.items.forEach(it => {
                const def = BUILTINS[it.wtype];
                if (it.kind === 'widget' && def && it.data?.bg === 'solid'
                    && it.data.bgColor === def.defaults?.bgColor) it.data.bg = 'clear';
            });
            s.transparentDefaultsV1 = true;
            Store.save();
        }
        // 修正越界
        s.items.forEach(it => {
            const { w, h } = sizeOf(it);
            it.page = Math.max(0, Number(it.page) || 0);
            it.x = clamp(Number(it.x) || 0, 0, COLS - w);
            it.y = clamp(Number(it.y) || 0, 0, ROWS - h);
            if (it.page >= s.pages) s.pages = it.page + 1;
        });
        this._placeMissingApps();
        this.page = clamp(this.page, 0, s.pages - 1);
    }

    _legacyDock() {
        let ids = ['wechat', 'weibo', 'phone', 'settings'];
        try {
            const saved = window.VirtualPhone?.storage?.get?.('dock-apps');
            if (saved) {
                const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                if (Array.isArray(parsed) && parsed.length) ids = parsed;
            }
        } catch (e) { /* ignore */ }
        return ids.slice(0, DOCK_MAX);
    }

    _buildDefaultState() {
        const s = emptyState();
        s.dock = this._legacyDock();
        const clock = makeWidget('clock', 'medium');
        Object.assign(clock, { page: 0, x: 0, y: 0 });
        s.items.push(clock);
        const vinyl = makeWidget('vinyl', 'small');
        Object.assign(vinyl, { page: 1, x: 0, y: 0 });
        const cal = makeWidget('simple_cal', 'small');
        Object.assign(cal, { page: 1, x: 2, y: 0 });
        const memo = makeWidget('memo', 'medium', { items: '长按空白处进入编辑模式\n拖动图标和组件\n＋ 组件 / 🎨 导入美化' });
        Object.assign(memo, { page: 1, x: 0, y: 2 });
        s.items.push(vinyl, cal, memo);
        s.pages = 2;
        return s;
    }

    _placeMissingApps() {
        const s = this.S;
        const known = new Set(this.apps.map(a => a.id));
        const onGrid = new Set(s.items.filter(i => i.kind === 'app').map(i => i.appId));
        s.dock = s.dock.filter((id, idx, arr) => arr.indexOf(id) === idx);
        this.apps.forEach(app => {
            if (onGrid.has(app.id) || s.dock.includes(app.id) || s.hidden.includes(app.id)) return;
            const item = { id: uid('a'), kind: 'app', appId: app.id, page: 0, x: 0, y: 0 };
            this._autoPlace(item, 0);
            s.items.push(item);
        });
        // 隐藏列表里不存在的应用不处理；dock 中不存在的应用只是不显示
        void known;
    }

    _occupied(page, exceptIds = []) {
        const ex = new Set(exceptIds);
        return this.S.items.filter(i => i.page === page && !ex.has(i.id)).map(i => ({ id: i.id, item: i, x: i.x, y: i.y, ...sizeOf(i) }));
    }

    _isFree(page, x, y, w, h, exceptIds = []) {
        if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
        const r = { x, y, w, h };
        return !this._occupied(page, exceptIds).some(o => rectsOverlap(r, o));
    }

    _findFree(page, w, h, exceptIds = []) {
        for (let y = 0; y <= ROWS - h; y++) {
            for (let x = 0; x <= COLS - w; x++) {
                if (this._isFree(page, x, y, w, h, exceptIds)) return { x, y };
            }
        }
        return null;
    }

    /** 把 item 放进 startPage 起第一个空位（必要时新建页面） */
    _autoPlace(item, startPage = 0, exceptIds = []) {
        const s = this.S;
        const { w, h } = sizeOf(item);
        const ex = [item.id, ...exceptIds];
        for (let p = startPage; p < s.pages; p++) {
            const pos = this._findFree(p, w, h, ex);
            if (pos) { item.page = p; item.x = pos.x; item.y = pos.y; return; }
        }
        for (let p = 0; p < startPage; p++) {
            const pos = this._findFree(p, w, h, ex);
            if (pos) { item.page = p; item.x = pos.x; item.y = pos.y; return; }
        }
        s.pages += 1;
        item.page = s.pages - 1; item.x = 0; item.y = 0;
    }

    _cleanupPages() {
        const s = this.S;
        if (s.pages <= 1) return;
        const used = new Set(s.items.map(i => i.page));
        const map = [];
        let n = 0;
        for (let p = 0; p < s.pages; p++) {
            if (used.has(p)) map[p] = n++;
        }
        if (n === 0) n = 1;
        s.items.forEach(i => { i.page = map[i.page] ?? 0; });
        const curMapped = map[this.page];
        s.pages = n;
        this.page = clamp(curMapped ?? Math.min(this.page, n - 1), 0, n - 1);
    }

    save() { Store.save('state'); }

    /* ---------------- 挂载 ---------------- */
    mount(homeEl) {
        if (!homeEl) return;
        injectStyle();
        this.homeEl = homeEl;
        let root = homeEl.querySelector(':scope > .yzd-root');
        if (!root) {
            root = document.createElement('div');
            root.className = 'yzd-root phone-gesture-control';
            root.setAttribute('data-no-swipe-back', '');
            homeEl.appendChild(root);
        }
        const fresh = root !== this.root || !root.querySelector('.yzd-viewport');
        this.root = root;
        if (!Store.loaded) {
            root.innerHTML = '<div class="yzd-loading">桌面加载中…</div>';
            Store.load().then(() => {
                if (this.root === root && root.isConnected) this.build();
            });
            return;
        }
        if (fresh) this.build();
        else this.refreshLight();
        this._startTick();
    }

    build() {
        this._ensureState();
        const root = this.root;
        if (!root) return;
        root.innerHTML = `
            <div class="yzd-wall"></div>
            <div class="yzd-viewport"><div class="yzd-track"></div></div>
            <div class="yzd-bar">
                <div class="yzd-dots"></div>
                <div class="yzd-edit-tools">
                    <span class="yzd-tool" data-act="add">＋ 组件</span>
                    <span class="yzd-tool" data-act="theme">🎨 美化/主题</span>
                    <span class="yzd-tool yzd-tool-done" data-act="done">完成</span>
                </div>
            </div>
            <div class="yzd-dock"></div>
            <div class="yzd-layer"></div>
        `;
        this.track = root.querySelector('.yzd-track');
        this.viewport = root.querySelector('.yzd-viewport');
        this.dockEl = root.querySelector('.yzd-dock');
        this.dotsEl = root.querySelector('.yzd-dots');
        this.layer = root.querySelector('.yzd-layer');
        root.classList.toggle('yzd-editing', this.editing);
        this.applyStyleVars();
        this.updateWallpaper();
        this.syncLayout();
        this.renderDock();
        this._bindRoot();
        this._observeSize();
        this._startTick();
    }

    refreshLight() {
        this.updateWallpaper();
        this.updateTime();
        this.updateBadges();
    }

    _startTick() {
        clearInterval(this._tick);
        // 剧情时间在正文/聊天更新时，立刻同步；现实时间仍定期刷新。
        if (!this._storyTimeListener) {
            this._storyTimeListener = () => { if (this.root?.isConnected) this.updateTime(); };
            window.addEventListener('phone:timeUpdated', this._storyTimeListener);
        }
        this._tick = setInterval(() => {
            if (!this.root?.isConnected) {
                clearInterval(this._tick); this._tick = null;
                window.removeEventListener('phone:timeUpdated', this._storyTimeListener);
                this._storyTimeListener = null;
                return;
            }
            this.updateTime();
        }, 20000);
    }

    _observeSize() {
        if (this._ro) this._ro.disconnect();
        if (typeof ResizeObserver === 'undefined') { this._measure(); return; }
        this._ro = new ResizeObserver(() => this._measure());
        this._ro.observe(this.viewport);
        this._measure();
    }

    _measure() {
        if (!this.viewport || !this.root) return;
        const vw = this.viewport.clientWidth;
        const vh = this.viewport.clientHeight;
        if (!vw || !vh) return;
        const padX = Math.round(vw * 0.035);
        const cellW = (vw - padX * 2) / COLS;
        const cellH = (vh - 8) / ROWS;
        const st = this.S.style;
        const icon = Math.round(Math.min(cellW * 0.64, cellH * 0.58, 72) * (clamp(Number(st.iconScale) || 100, 60, 130) / 100));
        this.root.style.setProperty('--yzd-padx', `${padX}px`);
        this.root.style.setProperty('--yzd-icon', `${icon}px`);
        this.track.style.transition = 'none';
        this._setTrack(0, false);
    }

    applyStyleVars() {
        const st = this.S.style;
        const r = this.root;
        const shape = ['rounded', 'circle', 'square', 'original'].includes(st.iconShape) ? st.iconShape : 'rounded';
        const radius = shape === 'circle' ? 50 : (shape === 'square' || shape === 'original' ? 0
            : clamp(Number(st.iconRadius ?? 24) || 0, 0, 50));
        r.style.setProperty('--yzd-radius', `${radius}%`);
        r.style.setProperty('--yzd-icon-fit', shape === 'original' ? 'contain' : (st.iconFit === 'contain' ? 'contain' : 'cover'));
        r.classList.toggle('yzd-icon-original', shape === 'original');
        r.style.setProperty('--yzd-label', st.labelColor || '#2b2b33');
        r.style.setProperty('--yzd-plate', hexToRgba(normHex(st.plateColor), clamp(Number(st.plateAlpha) || 0, 0, 1)));
        r.style.setProperty('--yzd-plate-blur', Number(st.plateAlpha) > 0 ? '10px' : '0px');
        r.style.setProperty('--yzd-dock-bg', hexToRgba(normHex(st.dockColor), clamp(Number(st.dockAlpha ?? 0.32), 0, 1)));
        r.style.setProperty('--yzd-dock-blur', `${clamp(Number(st.dockBlur ?? 18), 0, 40)}px`);
        r.classList.toggle('yzd-no-labels', st.showLabels === false);
        this._measure();
    }

    updateWallpaper() {
        const wall = this.root?.querySelector('.yzd-wall');
        if (!wall) return;
        const url = String(this.S?.wallpaper || '').trim() || String(this.home?._getWallpaperImage?.() || '').trim();
        wall.style.backgroundImage = url ? cssUrl(url) : '';
    }

    /* ---------------- 渲染：页面/图标/组件 ---------------- */
    _pageEl(p) {
        let el = this.track.querySelector(`:scope > .yzd-page[data-page="${p}"]`);
        if (!el) {
            el = document.createElement('div');
            el.className = 'yzd-page';
            el.dataset.page = String(p);
            const pages = Array.from(this.track.children);
            const after = pages.find(x => Number(x.dataset.page) > p);
            this.track.insertBefore(el, after || null);
        }
        return el;
    }

    /** 增量同步：已存在的元素只改位置（同页内拖动不会重载 iframe） */
    syncLayout() {
        const s = this.S;
        if (!this.track) return;
        Array.from(this.track.children).forEach(pg => {
            if (Number(pg.dataset.page) >= s.pages) pg.remove();
        });
        for (let p = 0; p < s.pages; p++) this._pageEl(p);
        const alive = new Set();
        s.items.forEach(item => {
            if (item.kind === 'app' && !this.getApp(item.appId)) return;
            alive.add(item.id);
            let el = this.track.querySelector(`.yzd-item[data-id="${item.id}"]`);
            if (!el) el = this._createItemEl(item);
            const pg = this._pageEl(item.page);
            if (el.parentElement !== pg) pg.appendChild(el);
            const { w, h } = sizeOf(item);
            el.style.gridColumn = `${item.x + 1} / span ${w}`;
            el.style.gridRow = `${item.y + 1} / span ${h}`;
        });
        this.track.querySelectorAll('.yzd-item').forEach(el => {
            if (!alive.has(el.dataset.id)) el.remove();
        });
        this.renderDots();
        this._setTrack(0, false);
    }

    _rebuildItem(item) {
        const el = this.track?.querySelector(`.yzd-item[data-id="${item.id}"]`);
        if (el) el.remove();
        this.syncLayout();
    }

    /**
     * 图标优先级：
     *  1. 本主题里给这个应用单独指定的图标（上传 / 主题图片 / 图标池）
     *  2. 主题风格图标（导入了美化的主题：按主题颜色画的线条图标，不再用 phone 文件夹里的原版图标）
     *  3. 原版图标（没导入美化的桌面）
     *  特殊值：'@original' 强制原版，'@glyph' 强制主题线条图标，'@wallpaper' 用当前壁纸
     */
    _iconUrl(app) {
        const own = String(this.S.icons?.[app.id] || '').trim();
        const original = () => this.home?._getAppIconImage?.(app) || '';
        const ti = this.S.themeIcons;
        if (own === '@original') return original();
        if (own === '@glyph') return glyphDataUrl(app.id, ti?.color || '#7fa6b6', app.name);
        if (own === '@wallpaper') return String(this.S.wallpaper || '') || original();
        if (own) return own;
        if (ti?.enabled) return glyphDataUrl(app.id, ti.color, app.name);
        return original();
    }
    _appName(app) {
        return this.home?._getAppDisplayName?.(app) || app.name || app.id;
    }
    _appIconHtml(app) {
        const url = this._iconUrl(app);
        if (url) return `<div class="yzd-icon" style="background-image:${esc(cssUrl(url))}"></div>`;
        return `<div class="yzd-icon yzd-icon-emoji" style="background:${esc(app.color || '#999')}">${esc(app.icon || '•')}</div>`;
    }
    _badgeHtml(app) {
        const n = Math.max(0, parseInt(app?.badge, 10) || 0);
        return n > 0 ? `<span class="yzd-badge">${n > 99 ? '99+' : n}</span>` : '';
    }

    _createItemEl(item) {
        const el = document.createElement('div');
        el.className = `yzd-item yzd-${item.kind}`;
        el.dataset.id = item.id;
        if (item.kind === 'app') {
            const app = this.getApp(item.appId);
            el.dataset.app = item.appId;
            el.innerHTML = `<div class="yzd-app-body">${this._appIconHtml(app)}<div class="yzd-label">${esc(this._appName(app))}</div></div>${this._badgeHtml(app)}<span class="yzd-del" data-del>−</span>`;
        } else {
            el.classList.add(`yzd-w-${item.wtype}`, `yzd-size-${item.size}`);
            el.innerHTML = `<div class="yzd-wbox"></div><div class="yzd-shield"></div><span class="yzd-del" data-del>−</span>`;
            this._fillWidget(item, el.querySelector('.yzd-wbox'));
        }
        return el;
    }

    _fillWidget(item, box) {
        if (item.wtype === 'custom') {
            box.className = 'yzd-wbox yzd-wbox-custom';
            box.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.className = 'yzd-frame';
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('allowtransparency', 'true');
            iframe.setAttribute('title', item.data?.name || 'widget');
            const customData = item.data || {};
            const customState = { ...(this.S.widgetState[item.id] || {}) };
            for (const field of customData.userFields || []) {
                if (field.type === 'image') customState[field.key] = resolveWidgetMedia(customState[field.key]);
            }
            iframe.srcdoc = buildSrcdoc({ ...customData, images: Object.fromEntries(Object.entries(customData.images || {}).map(([key, value]) => [key, resolveWidgetMedia(value)])) }, customState);
            box.appendChild(iframe);
            FRAME_MAP.set(iframe.contentWindow, { desk: this, id: item.id, iframe });
            iframe.addEventListener('load', () => {
                if (iframe.contentWindow) FRAME_MAP.set(iframe.contentWindow, { desk: this, id: item.id, iframe });
            });
            return;
        }
        const d = { ...COMMON_DEFAULTS, ...(BUILTINS[item.wtype]?.defaults || {}), ...(item.data || {}) };
        box.className = 'yzd-wbox yzd-wbox-builtin';
        const def = BUILTINS[item.wtype];
        const resolved = resolveWidgetFields(d, [...(def?.fields || []), { key: 'bgImage', type: 'image' }]);
        box.setAttribute('style', this._surfaceStyle(resolved));
        try {
            box.innerHTML = def?.render ? def.render(item, resolved, this._widgetCtx(item)) : '<div class="yzw yzw-text"><div>未知组件</div></div>';
            applyWidgetImagePositions(box, resolved, d, [...(def?.fields || []), { key: 'bgImage', type: 'image' }]);
        } catch (e) {
            console.warn('[自由桌面] 组件渲染失败', item.wtype, e);
            box.innerHTML = '<div class="yzw yzw-text"><div>组件出错了</div></div>';
        }
    }

    _surfaceStyle(d) {
        const parts = [`--yzd-wtext:${normHex(d.textColor, '#2b2b33')}`, `border-radius:${clamp(Number(d.radius ?? 24), 0, 60)}px`];
        const a = clamp(Number(d.bgAlpha ?? 0.38), 0, 1);
        if (d.bg === 'clear') parts.push('background:transparent', 'box-shadow:none');
        else if (d.bg === 'solid') parts.push(`background:${normHex(d.bgColor)}`);
        else if (d.bg === 'image' && d.bgImage) parts.push(`background:${cssUrl(d.bgImage)} center/cover no-repeat`);
        else parts.push(`background:${hexToRgba(normHex(d.bgColor), a)}`, `backdrop-filter:blur(18px) saturate(140%)`, `-webkit-backdrop-filter:blur(18px) saturate(140%)`);
        return parts.join(';');
    }

    _timeParts(source = 'phone') {
        let info = null;
        try {
            const manager = window.VirtualPhone?.timeManager;
            if (source === 'real') info = manager?.getRealTime?.() || null;
            else if (source === 'story') info = manager?.getCurrentStoryTime?.() || null;
            else info = this.home?._getCurrentPhoneTimeInfo?.() || null;
        } catch (e) { info = null; }
        const now = new Date();
        let y = now.getFullYear(), m = now.getMonth() + 1, day = now.getDate();
        const mt = String(info?.date || '').match(/(\d+)年(\d+)月(\d+)日/) || String(info?.date || '').match(/(\d{4,6})[-/](\d{1,2})[-/](\d{1,2})/);
        if (mt) { y = +mt[1]; m = +mt[2]; day = +mt[3]; }
        let hh = now.getHours(), mm = now.getMinutes();
        const tm = String(info?.time || '').match(/(\d{1,2}):(\d{2})/);
        if (tm) { hh = +tm[1]; mm = +tm[2]; }
        const dt = new Date(y, m - 1, day);
        return { y, m, d: day, hh, mm, ss: now.getSeconds(), wd: dt.getDay(), ancient: !!info?.isAncient, rawDate: String(info?.date || ''), weekdayText: String(info?.weekday || '') };
    }

    _widgetCtx(item) {
        return {
            t: this._timeParts(item?.data?.timeSource || (item?.wtype === 'clock' ? 'story' : 'phone')),
            choose: (title, options) => this._dialog(`<div class="yzd-dlg-title">${esc(title)}</div>
                <div class="yzd-chips">${options.map(([v, l]) => `<span class="yzd-chip" data-v="${esc(v)}">${esc(l)}</span>`).join('')}</div>
                <div class="yzd-dlg-btns"><span class="yzd-btn" data-x="1">取消</span></div>`, (dlg, close) => {
                dlg.addEventListener('click', (e) => {
                    const c = e.target.closest('[data-v]');
                    if (c) close(c.dataset.v); else if (e.target.closest('[data-x]')) close(null);
                });
            }),
            float: (txt) => {
                const el = this.track?.querySelector(`.yzd-item[data-id="${item.id}"]`);
                if (!el) return;
                const f = document.createElement('span');
                f.className = 'yzw-float';
                f.textContent = txt;
                el.appendChild(f);
                setTimeout(() => f.remove(), 900);
            }
        };
    }

    _renderBuiltinLegacy(item, d) {
        const t = this._timeParts();
        const WD_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const pad = n => String(n).padStart(2, '0');
        switch (item.wtype) {
            case 'clock': {
                const is12 = String(d.h24) === '12';
                const h = is12 ? ((t.hh % 12) || 12) : t.hh;
                const ap = is12 ? `<span class="yzd-ck-ap">${t.hh < 12 ? 'AM' : 'PM'}</span>` : '';
                const date = t.ancient ? esc(t.rawDate) : (d.lang === 'en'
                    ? `${WD_EN[t.wd]}, ${MON_EN[t.m - 1]} ${t.d}`
                    : `${t.m}月${t.d}日 ${t.weekdayText || WD_ZH[t.wd]}`);
                return `<div class="yzd-ck yzd-ck-${item.size}"><div class="yzd-ck-time">${pad(h)}:${pad(t.mm)}${ap}</div><div class="yzd-ck-date">${date}</div></div>`;
            }
            case 'analog': {
                const now = new Date();
                const hDeg = (t.hh % 12) * 30 + t.mm * 0.5;
                const mDeg = t.mm * 6;
                const sDeg = now.getSeconds() * 6;
                const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="8" x2="50" y2="${i % 3 === 0 ? 15 : 12}" transform="rotate(${i * 30} 50 50)" />`).join('');
                return `<svg class="yzd-analog" viewBox="0 0 100 100"><g class="yzd-an-ticks">${ticks}</g>
                    <line class="yzd-an-h" x1="50" y1="50" x2="50" y2="28" transform="rotate(${hDeg} 50 50)"/>
                    <line class="yzd-an-m" x1="50" y1="50" x2="50" y2="17" transform="rotate(${mDeg} 50 50)"/>
                    <line class="yzd-an-s" style="stroke:${esc(normHex(d.accent, '#ff6b81'))}" x1="50" y1="56" x2="50" y2="14" transform="rotate(${sDeg} 50 50)"/>
                    <circle cx="50" cy="50" r="2.6" style="fill:${esc(normHex(d.accent, '#ff6b81'))}"/></svg>`;
            }
            case 'calendar': {
                const accent = esc(normHex(d.accent, '#ff5a5f'));
                if (t.ancient) return `<div class="yzd-cal"><div class="yzd-cal-wd" style="color:${accent}">今日</div><div class="yzd-cal-anc">${esc(t.rawDate)}</div></div>`;
                const head = `<div class="yzd-cal-wd" style="color:${accent}">${WD_ZH[t.wd]}</div><div class="yzd-cal-day">${t.d}</div><div class="yzd-cal-mon">${t.y}年${t.m}月</div>`;
                if (item.size !== 'medium') return `<div class="yzd-cal">${head}</div>`;
                const first = new Date(t.y, t.m - 1, 1).getDay();
                const days = new Date(t.y, t.m, 0).getDate();
                let cells = ['日', '一', '二', '三', '四', '五', '六'].map(x => `<b>${x}</b>`).join('');
                for (let i = 0; i < first; i++) cells += '<i></i>';
                for (let i = 1; i <= days; i++) cells += i === t.d ? `<i class="on" style="background:${accent}">${i}</i>` : `<i>${i}</i>`;
                return `<div class="yzd-cal yzd-cal-m"><div class="yzd-cal-left">${head}</div><div class="yzd-cal-grid">${cells}</div></div>`;
            }
            case 'photo': {
                if (!d.image) return `<div class="yzd-ph-empty"><span>🖼️</span><small>长按 → 编辑内容<br>上传图片</small></div>`;
                return `<div class="yzd-photo" style="background-image:${esc(cssUrl(d.image))};background-size:${d.fit === 'contain' ? 'contain' : 'cover'}"></div>${d.caption ? `<div class="yzd-ph-cap">${esc(d.caption)}</div>` : ''}`;
            }
            case 'music': {
                const app = this.getApp('music');
                const cover = d.cover || (app ? this._iconUrl(app) : '');
                const title = d.title || (app ? this._appName(app) : '音乐');
                return `<div class="yzd-mu yzd-mu-${item.size}">
                    <div class="yzd-mu-disc${d.spin === 'off' ? '' : ' spin'}"><div class="yzd-mu-cover" style="background-image:${esc(cssUrl(cover))}"></div></div>
                    <div class="yzd-mu-side"><div class="yzd-mu-title">${esc(title)}</div>
                    <div class="yzd-mu-ctrl"><span>⏮</span><span class="yzd-mu-play">⏯</span><span>⏭</span></div></div></div>`;
            }
            case 'countdown': {
                let txt = '设置日期', num = '--';
                const md = String(d.date || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (md) {
                    const target = new Date(+md[1], +md[2] - 1, +md[3]).getTime();
                    const today = new Date(t.y, t.m - 1, t.d).getTime();
                    const diff = Math.round((target - today) / 86400000);
                    if (diff > 0) { txt = '还有'; num = diff; } else if (diff < 0) { txt = '已经'; num = -diff; } else { txt = '就是'; num = '今天'; }
                }
                return `<div class="yzd-cd yzd-cd-${item.size}"><div class="yzd-cd-title">${esc(d.title || '')}</div>
                    <div class="yzd-cd-row"><small>${txt}</small><span class="yzd-cd-num" style="color:${esc(normHex(d.accent, '#ff7aa2'))}">${num}</span>${typeof num === 'number' ? '<small>天</small>' : ''}</div>
                    <div class="yzd-cd-date">${esc(d.date || '长按编辑内容设置')}</div></div>`;
            }
            case 'note':
                return `<div class="yzd-note" style="font-size:${clamp(Number(d.fontSize) || 15, 8, 60)}px;text-align:${esc(d.align || 'left')}">${esc(d.text || '')}</div>`;
            default:
                return `<div class="yzd-ph-empty"><small>未知组件</small></div>`;
        }
    }

    updateTime() {
        if (!this.track) return;
        this.S?.items?.forEach(item => {
            if (item.kind !== 'widget' || !BUILTINS[item.wtype]?.timeBased) return;
            const box = this.track.querySelector(`.yzd-item[data-id="${item.id}"] .yzd-wbox`);
            if (box) this._fillWidget(item, box);
        });
    }

    updateBadges() {
        if (!this.root) return;
        this.root.querySelectorAll('[data-app]').forEach(el => {
            const app = this.getApp(el.dataset.app);
            el.querySelector(':scope > .yzd-badge')?.remove();
            const html = this._badgeHtml(app);
            if (html) el.insertAdjacentHTML('beforeend', html);
        });
    }

    renderDock() {
        if (!this.dockEl) return;
        const ids = (this.S.dock || []).filter(id => this.getApp(id));
        this.dockEl.innerHTML = ids.map((id, i) => {
            const app = this.getApp(id);
            return `<div class="yzd-dock-app" data-app="${esc(id)}" data-index="${i}"><div class="yzd-app-body">${this._appIconHtml(app)}</div>${this._badgeHtml(app)}<span class="yzd-del" data-del>−</span></div>`;
        }).join('');
        this.dockEl.classList.toggle('is-empty', ids.length === 0);
    }

    renderDots() {
        if (!this.dotsEl) return;
        const n = this.S.pages;
        this.dotsEl.innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<i data-dot="${i}" class="${i === this.page ? 'on' : ''}"></i>`).join('') : '';
    }

    _setTrack(dx = 0, animate = true) {
        if (!this.track || !this.viewport) return;
        const W = this.viewport.clientWidth || 1;
        this.track.style.transition = animate ? 'transform .34s cubic-bezier(.2,.85,.25,1)' : 'none';
        this.track.style.transform = `translate3d(${-this.page * W + dx}px,0,0)`;
    }

    goPage(p, animate = true) {
        this.page = clamp(p, 0, this.S.pages - 1);
        this._setTrack(0, animate);
        this.dotsEl?.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === this.page));
    }
}

/* ======================================================================
 *  手势：点击 / 长按 / 翻页 / 拖动
 * ==================================================================== */
const LONG_PRESS_MS = 460;

Object.assign(FreeDesktop.prototype, {
    _bindRoot() {
        const root = this.root;
        if (root._yzdBound) return;
        root._yzdBound = true;

        root.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            if (e.target.closest('.yzd-layer > *')) return;
            if (this._menuEl) { this.closeMenu(); this._swallowUntil = Date.now() + 350; return; }
            const tool = e.target.closest('[data-act]');
            if (tool) return;
            const dot = e.target.closest('[data-dot]');
            if (dot) { this.goPage(Number(dot.dataset.dot)); return; }
            const itemEl = e.target.closest('.yzd-item, .yzd-dock-app');
            this._gStart(e.clientX, e.clientY, itemEl, { delHit: !!e.target.closest('[data-del]'), act: e.target.closest('[data-wact]')?.dataset.wact || '' });
            const move = (ev) => this._gMove(ev.clientX, ev.clientY);
            const up = (ev) => {
                window.removeEventListener('pointermove', move, true);
                window.removeEventListener('pointerup', up, true);
                window.removeEventListener('pointercancel', up, true);
                this._gEnd(ev.clientX, ev.clientY, ev.type === 'pointercancel');
            };
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', up, true);
            window.addEventListener('pointercancel', up, true);
        });

        root.addEventListener('click', (e) => {
            const tool = e.target.closest('[data-act]');
            if (!tool || e.target.closest('.yzd-layer')) return;
            e.stopPropagation();
            const act = tool.dataset.act;
            if (act === 'done') this.exitEdit();
            else if (act === 'add') this.openGallery({ mode: 'add' });
            else if (act === 'theme') this.openThemeSheet();
        });
        root.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    },

    _itemFromEl(el) {
        if (!el) return null;
        if (el.classList.contains('yzd-dock-app')) {
            return { kind: 'app', appId: el.dataset.app, fromDock: true, dockIndex: Number(el.dataset.index), id: `dock:${el.dataset.app}` };
        }
        return this.S.items.find(i => i.id === el.dataset.id) || null;
    },

    _gStart(x, y, itemEl, extra = {}) {
        if (Date.now() < (this._swallowUntil || 0)) return;
        clearTimeout(this._lpTimer);
        const item = this._itemFromEl(itemEl);
        this.g = { x0: x, y0: y, x, y, t0: Date.now(), itemEl, item, mode: null, lp: false, menuShown: false, ...extra };
        this._lpTimer = setTimeout(() => this._onLongPress(), LONG_PRESS_MS);
    },

    _gMove(x, y) {
        const g = this.g;
        if (!g) return;
        g.x = x; g.y = y;
        const dx = x - g.x0, dy = y - g.y0;
        const dist = Math.hypot(dx, dy);
        if (!g.mode) {
            if (dist > 9) clearTimeout(this._lpTimer);
            if (this.editing && g.item && !g.fromFrame && dist > 7) {
                this._startDrag();
            } else if (g.menuShown && g.item && dist > 12) {
                this.closeMenu();
                this.enterEdit();
                this._startDrag();
            } else if (!g.menuShown && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                g.mode = 'page';
            }
        }
        if (g.mode === 'page') this._setTrack(this.page === 0 && dx > 0 ? dx * 0.45 : (this.page === this.S.pages - 1 && dx < 0 ? dx * 0.35 : dx), false);
        else if (g.mode === 'drag') this._dragMove(x, y);
    },

    _gEnd(x, y, cancelled = false) {
        const g = this.g;
        clearTimeout(this._lpTimer);
        if (!g) return;
        this.g = null;
        if (g.mode === 'page') {
            const W = this.viewport.clientWidth || 1;
            const dx = x - g.x0;
            const fast = Math.abs(dx) / Math.max(1, Date.now() - g.t0) > 0.5;
            if ((dx < -W * 0.18 || (fast && dx < -30)) && this.page < this.S.pages - 1) this.goPage(this.page + 1);
            else if ((dx > W * 0.18 || (fast && dx > 30)) && this.page > 0) this.goPage(this.page - 1);
            else if (!this.editing && this.page === 0 && dx > W * 0.38) { this._setTrack(0, true); this.closePhone(); }
            else this._setTrack(0, true);
            return;
        }
        if (g.mode === 'drag') { this._finishDrop(g, cancelled); return; }
        if (cancelled || g.lp || g.menuShown) return;
        if (Math.hypot(x - g.x0, y - g.y0) > 10) return;
        this._tap(g);
    },

    _onLongPress() {
        const g = this.g;
        if (!g || g.mode) return;
        g.lp = true;
        try { navigator.vibrate?.(12); } catch (e) { /* ignore */ }
        if (this.editing) {
            if (g.item) this._startDrag();
            return;
        }
        if (g.item) {
            g.menuShown = true;
            this.showMenu(g.item, g.itemEl);
        } else {
            this.enterEdit();
        }
    },

    _tap(g) {
        const item = g.item;
        if (this.editing) {
            if (g.delHit && item) { this.removeItem(item); return; }
            if (item?.kind === 'widget') { this.editContent(item); return; }
            if (!item) this.exitEdit();
            return;
        }
        if (!item) return;
        if (item.kind === 'app') { this.home?.openApp?.(item.appId); return; }
        if (g.fromFrame) return;
        const tdef = BUILTINS[item.wtype];
        if (tdef?.onTap) {
            item.data = item.data || {};
            Promise.resolve(tdef.onTap(item, g.act || '', this._widgetCtx(item))).then((changed) => {
                if (!changed) return;
                const box = this.track?.querySelector(`.yzd-item[data-id="${item.id}"] .yzd-wbox`);
                if (box) this._fillWidget(item, box);
                this.save();
            });
            return;
        }
        const linked = tdef?.app;
        if (linked && this.getApp(linked)) this.home?.openApp?.(linked);
        else if (item.wtype === 'photo' && !item.data?.image) this.editContent(item);
    },

    /* iframe 里的触摸转发过来 */
    onFrameMessage(rec, d) {
        if (d.t === 'set') {
            const st = (this.S.widgetState[rec.id] = this.S.widgetState[rec.id] || {});
            st[d.k] = d.v;
            this.save();
            return;
        }
        if (d.t === 'clear') {
            if (d.k === null || d.k === undefined) this.S.widgetState[rec.id] = {};
            else if (this.S.widgetState[rec.id]) delete this.S.widgetState[rec.id][d.k];
            this.save();
            if (d.k === null || d.k === undefined) {
                setTimeout(() => {
                    const item = this.S.items.find(i => i.id === rec.id);
                    if (item) this._rebuildItem(item);
                }, 80);
            }
            return;
        }
        const r = rec.iframe.getBoundingClientRect();
        const sx = r.width / (rec.iframe.clientWidth || r.width || 1);
        const sy = r.height / (rec.iframe.clientHeight || r.height || 1);
        const x = r.left + (Number(d.x) || 0) * sx;
        const y = r.top + (Number(d.y) || 0) * sy;
        if (d.t === 'pd') {
            if (this._menuEl) { this.closeMenu(); return; }
            this._gStart(x, y, rec.iframe.closest('.yzd-item'), { fromFrame: true });
        } else if (d.t === 'pm') this._gMove(x, y);
        else if (d.t === 'pu') this._gEnd(x, y, !!d.c);
    },

    closePhone() {
        this.exitEdit();
        window.dispatchEvent(new CustomEvent('phone:requestClose'));
    },

    enterEdit() {
        if (this.editing) return;
        this.editing = true;
        this.root?.classList.add('yzd-editing');
    },
    exitEdit() {
        if (!this.editing) return;
        this.editing = false;
        this.root?.classList.remove('yzd-editing');
        this._cleanupPages();
        this.syncLayout();
        this.goPage(this.page, false);
        this.save();
    },

    removeItem(item) {
        const s = this.S;
        if (item.fromDock) {
            s.dock = s.dock.filter(id => id !== item.appId);
            if (!s.hidden.includes(item.appId)) s.hidden.push(item.appId);
            this.renderDock();
            this.save();
            this.toast('已从 Dock 移除（可在「＋ 组件」里加回）');
            return;
        }
        s.items = s.items.filter(i => i.id !== item.id);
        if (item.kind === 'app') {
            if (!s.hidden.includes(item.appId)) s.hidden.push(item.appId);
            this.toast('已从主屏幕移除（可在「＋ 组件」里加回）');
        } else {
            delete s.widgetState[item.id];
        }
        this.syncLayout();
        this.save();
    },

    /* ---------------- 拖动 ---------------- */
    _startDrag() {
        const g = this.g;
        if (!g || !g.item || g.mode === 'drag') return;
        clearTimeout(this._lpTimer);
        this.closeMenu();
        g.mode = 'drag';
        const el = g.itemEl;
        const rect = el.getBoundingClientRect();
        g.grabDX = g.x0 - rect.left;
        g.grabDY = g.y0 - rect.top;
        g.originPage = this.page;
        g.rootRect = this.root.getBoundingClientRect();
        if (g.item.kind === 'app') {
            const fl = el.cloneNode(true);
            fl.classList.add('yzd-floating');
            fl.style.width = `${rect.width}px`;
            fl.style.height = `${rect.height}px`;
            fl.style.left = `${rect.left - g.rootRect.left}px`;
            fl.style.top = `${rect.top - g.rootRect.top}px`;
            fl.style.gridColumn = fl.style.gridRow = '';
            this.root.appendChild(fl);
            g.float = fl;
            g.floatBase = { left: rect.left, top: rect.top };
            el.classList.add('yzd-origin-hidden');
        } else {
            el.classList.add('yzd-lifted');
        }
        this.root.classList.add('yzd-dragging');
        g.ph = document.createElement('div');
        g.ph.className = 'yzd-placeholder';
        g.target = null;
        this._dragMove(g.x, g.y);
    },

    _dragMove(x, y) {
        const g = this.g;
        if (!g) return;
        const W = this.viewport.clientWidth || 1;
        if (g.float) {
            g.float.style.transform = `translate3d(${x - g.x0}px,${y - g.y0}px,0) scale(1.08)`;
        } else {
            g.itemEl.style.transform = `translate3d(${x - g.x0 + (this.page - g.originPage) * W}px,${y - g.y0}px,0) scale(1.03)`;
        }
        const item = g.item;
        const dockRect = this.dockEl.getBoundingClientRect();
        const vpRect = this.viewport.getBoundingClientRect();

        // Dock 目标
        if (item.kind === 'app' && y > dockRect.top - 6) {
            g.ph.remove();
            const apps = Array.from(this.dockEl.querySelectorAll('.yzd-dock-app')).filter(a => !(item.fromDock && a.dataset.app === item.appId));
            let idx = apps.length;
            for (let i = 0; i < apps.length; i++) {
                const r = apps[i].getBoundingClientRect();
                if (x < r.left + r.width / 2) { idx = i; break; }
            }
            g.target = { kind: 'dock', index: idx };
            this.dockEl.classList.add('yzd-dock-hot');
            this._clearEdgeTimer();
            return;
        }
        this.dockEl.classList.remove('yzd-dock-hot');

        // 边缘翻页
        if (x < vpRect.left + 22 || x > vpRect.right - 22) {
            const dir = x < vpRect.left + 22 ? -1 : 1;
            if (!this._edgeTimer || this._edgeDir !== dir) {
                this._clearEdgeTimer();
                this._edgeDir = dir;
                this._edgeTimer = setTimeout(() => {
                    this._edgeTimer = null;
                    const next = this.page + dir;
                    if (next < 0) return;
                    if (next >= this.S.pages) {
                        const hasOthers = this.S.items.some(i => i.page === this.page && i.id !== item.id);
                        if (!hasOthers) return;
                        this.S.pages += 1;
                        this._pageEl(this.S.pages - 1);
                        this.renderDots();
                    }
                    this.goPage(next);
                    this._edgeDir = 0;
                    setTimeout(() => this.g && this.g.mode === 'drag' && this._dragMove(this.g.x, this.g.y), 360);
                }, 620);
            }
        } else {
            this._clearEdgeTimer();
        }

        // 网格目标
        const pg = this._pageEl(this.page);
        const pr = pg.getBoundingClientRect();
        const cs = getComputedStyle(pg);
        const gx = pr.left + parseFloat(cs.paddingLeft || 0);
        const gy = pr.top + parseFloat(cs.paddingTop || 0);
        const gw = pr.width - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        const gh = pr.height - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
        const cw = gw / COLS, ch = gh / ROWS;
        const { w, h } = sizeOf(item);
        let col, row;
        if (item.kind === 'app') {
            col = Math.floor((x - gx) / cw);
            row = Math.floor((y - gy) / ch);
        } else {
            col = Math.round((x - g.grabDX - gx) / cw);
            row = Math.round((y - g.grabDY - gy) / ch);
        }
        col = clamp(col, 0, COLS - w);
        row = clamp(row, 0, ROWS - h);
        const ev = this._evaluate(item, this.page, col, row);
        g.target = { kind: 'grid', page: this.page, x: col, y: row, ...ev };
        g.ph.style.gridColumn = `${col + 1} / span ${w}`;
        g.ph.style.gridRow = `${row + 1} / span ${h}`;
        g.ph.classList.toggle('bad', !ev.ok);
        g.ph.classList.toggle('swap', !!ev.swap);
        if (g.ph.parentElement !== pg) pg.appendChild(g.ph);
    },

    _clearEdgeTimer() {
        clearTimeout(this._edgeTimer);
        this._edgeTimer = null;
        this._edgeDir = 0;
    },

    _evaluate(item, page, x, y) {
        const { w, h } = sizeOf(item);
        const r = { x, y, w, h };
        const others = this._occupied(page, item.fromDock ? [] : [item.id]).filter(o => rectsOverlap(r, o));
        if (!others.length) return { ok: true };
        if (item.kind === 'app' && others.length === 1 && others[0].item.kind === 'app') return { ok: true, swap: others[0].item };
        if (item.kind === 'widget' && others.every(o => o.item.kind === 'app')) return { ok: true, displace: others.map(o => o.item) };
        return { ok: false };
    },

});

/* ======================================================================
 *  落点 / 菜单 / 弹层基础
 * ==================================================================== */
Object.assign(FreeDesktop.prototype, {
    _finishDrop(g, cancelled) {
        this._clearEdgeTimer();
        this.dockEl?.classList.remove('yzd-dock-hot');
        g.ph?.remove();
        g.float?.remove();
        g.itemEl?.classList.remove('yzd-origin-hidden', 'yzd-lifted');
        if (g.itemEl) g.itemEl.style.transform = '';
        this.root?.classList.remove('yzd-dragging');
        const t = g.target;
        const item = g.item;
        if (!cancelled && t && item) {
            if (t.kind === 'dock') this._dropToDock(item, t.index);
            else if (t.ok) this._dropToGrid(item, t);
        }
        this.syncLayout();
        this.renderDock();
        this.goPage(this.page, false);
        this.save();
    },

    _removeItemEl(item) {
        this.track?.querySelector(`.yzd-item[data-id="${item.id}"]`)?.remove();
    },

    _dropToDock(item, index) {
        const s = this.S;
        if (item.fromDock) {
            const arr = s.dock.filter(id => id !== item.appId);
            arr.splice(clamp(index, 0, arr.length), 0, item.appId);
            s.dock = arr;
            return;
        }
        const arr = s.dock.filter(id => this.getApp(id));
        if (arr.length < DOCK_MAX) {
            arr.splice(clamp(index, 0, arr.length), 0, item.appId);
            s.items = s.items.filter(i => i.id !== item.id);
        } else {
            const idx = clamp(index, 0, arr.length - 1);
            const out = arr[idx];
            arr[idx] = item.appId;
            item.appId = out;
            this._removeItemEl(item);
        }
        s.dock = arr;
    },

    _dropToGrid(item, t) {
        const s = this.S;
        if (item.fromDock) {
            const idx = s.dock.indexOf(item.appId);
            if (t.swap) {
                s.dock[idx] = t.swap.appId;
                t.swap.appId = item.appId;
                this._removeItemEl(t.swap);
            } else {
                s.dock = s.dock.filter(id => id !== item.appId);
                s.items.push({ id: uid('a'), kind: 'app', appId: item.appId, page: t.page, x: t.x, y: t.y });
            }
            return;
        }
        if (t.swap) { t.swap.page = item.page; t.swap.x = item.x; t.swap.y = item.y; }
        item.page = t.page; item.x = t.x; item.y = t.y;
        if (t.displace) t.displace.forEach(a => this._autoPlace(a, t.page));
    },

    /* ---------------- 长按菜单 ---------------- */
    showMenu(item, el) {
        this.closeMenu();
        const entries = [];
        if (item.kind === 'widget') {
            const canResize = item.wtype === 'custom' || (BUILTINS[item.wtype]?.sizes || []).length > 1;
            entries.push(['edit', '编辑内容', '✎'], ['style', '更换样式', '▦']);
            if (canResize) entries.push(['resize', '调整大小', '⤢']);
            entries.push(['home', '编辑主画面', '⚙'], ['remove', '移除组件', '⊖', 'danger']);
        } else {
            entries.push(['icon', '更换图标', '🖼']);
            if (this.S.icons?.[item.appId]) entries.push(['reseticon', '恢复默认图标', '↺']);
            entries.push(['rename', '重命名', '✎'], ['home', '编辑主画面', '⚙'], ['remove', item.fromDock ? '从 Dock 移除' : '从主屏幕移除', '⊖', 'danger']);
        }
        const dim = document.createElement('div');
        dim.className = 'yzd-dim';
        const menu = document.createElement('div');
        menu.className = 'yzd-menu';
        menu.innerHTML = entries.map(([k, label, ic, cls]) => `<div class="yzd-menu-item ${cls || ''}" data-k="${k}"><span>${label}</span><i>${ic}</i></div>`).join('');
        this.layer.append(dim, menu);
        el?.classList.add('yzd-focus');
        this._menuEl = menu;
        this._menuDim = dim;
        this._menuTargetEl = el;

        const rr = this.root.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const mw = 200;
        const mh = menu.offsetHeight || entries.length * 44;
        let left = er.left - rr.left;
        left = clamp(left, 10, rr.width - mw - 10);
        let top = er.bottom - rr.top + 8;
        if (top + mh > rr.height - 20) top = er.top - rr.top - mh - 8;
        top = clamp(top, 40, rr.height - mh - 10);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        const onPick = (ev) => {
            const it = ev.target.closest('.yzd-menu-item');
            if (!it) return;
            ev.stopPropagation();
            const k = it.dataset.k;
            this.closeMenu();
            this._menuAction(k, item);
        };
        menu.addEventListener('click', onPick);
        dim.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); this.closeMenu(); });
    },

    closeMenu() {
        this._menuEl?.remove();
        this._menuDim?.remove();
        this._menuTargetEl?.classList.remove('yzd-focus');
        this._menuEl = this._menuDim = this._menuTargetEl = null;
    },

    async _menuAction(k, item) {
        if (k === 'home') { this.enterEdit(); return; }
        if (k === 'remove') { this.removeItem(item); return; }
        if (k === 'edit') { this.editContent(item); return; }
        if (k === 'style') { this.openGallery({ mode: 'replace', target: item }); return; }
        if (k === 'resize') { this.openResize(item); return; }
        if (k === 'icon') { this.openIconChooser(item.appId); return; }
        if (k === 'reseticon') { delete this.S.icons[item.appId]; this.save(); this.refreshAppVisuals(); return; }
        if (k === 'rename') {
            const app = this.getApp(item.appId);
            const name = await this.prompt('重命名应用', this._appName(app), { hint: '留空恢复原名' });
            if (name === null) return;
            this.setAppName(item.appId, name.trim());
        }
    },

    setAppName(appId, name) {
        const storage = window.VirtualPhone?.storage;
        if (!storage) return;
        const raw = storage.get('phone-app-custom-names');
        let map = {};
        try { map = (typeof raw === 'string' ? JSON.parse(raw) : raw) || {}; } catch (e) { map = {}; }
        if (name) map[appId] = name; else delete map[appId];
        storage.set('phone-app-custom-names', typeof raw === 'string' ? JSON.stringify(map) : map);
        this.refreshAppVisuals();
    },

    refreshAppVisuals() {
        this.track?.querySelectorAll('.yzd-item.yzd-app').forEach(el => el.remove());
        this.track?.querySelectorAll('.yzd-item.yzd-w-music').forEach(el => el.remove());
        this.syncLayout();
        this.renderDock();
    },

    async pickIconFor(appId) {
        const [file] = await pickFiles({ accept: 'image/*' });
        if (!file) return;
        this.S.icons[appId] = await readImageFile(file, 256);
        this.save();
        this.refreshAppVisuals();
    },

    openResize(item) {
        const sizes = item.wtype === 'custom' ? Object.keys(SIZE_DEFS) : (BUILTINS[item.wtype]?.sizes || [item.size]);
        const sheet = this.openSheet('调整大小', (body) => {
            body.innerHTML = `<div class="yzd-chips">${sizes.map(sz => `<span class="yzd-chip ${sz === item.size ? 'on' : ''}" data-sz="${sz}">${SIZE_DEFS[sz].label}</span>`).join('')}</div>
                <p class="yzd-tip">放不下时会自动挪到本页其他空位或下一页。</p>`;
            body.addEventListener('click', (e) => {
                const c = e.target.closest('[data-sz]');
                if (!c) return;
                this.resizeItem(item, c.dataset.sz);
                sheet.close();
            });
        });
    },

    resizeItem(item, size) {
        if (!SIZE_DEFS[size] || item.size === size) return;
        const old = item.size;
        item.size = size;
        const { w, h } = sizeOf(item);
        const nx = clamp(item.x, 0, COLS - w), ny = clamp(item.y, 0, ROWS - h);
        if (this._isFree(item.page, nx, ny, w, h, [item.id])) { item.x = nx; item.y = ny; }
        else {
            const ev = this._evaluate(item, item.page, nx, ny);
            if (ev.ok && ev.displace) {
                item.x = nx; item.y = ny;
                ev.displace.forEach(a => this._autoPlace(a, item.page));
            } else this._autoPlace(item, item.page);
        }
        void old;
        this._rebuildItem(item);
        this.save();
    },

    /* ---------------- 提示 / 对话框 / 面板 ---------------- */
    toast(msg, ms = 2200) {
        if (!this.layer) return;
        const t = document.createElement('div');
        t.className = 'yzd-toast';
        t.textContent = msg;
        this.layer.appendChild(t);
        setTimeout(() => t.classList.add('out'), ms);
        setTimeout(() => t.remove(), ms + 400);
    },

    _dialog(html, onReady) {
        return new Promise((resolve) => {
            const mask = document.createElement('div');
            mask.className = 'yzd-mask yzd-mask-center';
            mask.innerHTML = `<div class="yzd-dialog">${html}</div>`;
            this.layer.appendChild(mask);
            const close = (v) => { mask.remove(); resolve(v); };
            onReady(mask.querySelector('.yzd-dialog'), close);
        });
    },

    prompt(title, value = '', { hint = '', multiline = false } = {}) {
        return this._dialog(`<div class="yzd-dlg-title">${esc(title)}</div>
            ${hint ? `<div class="yzd-tip">${esc(hint)}</div>` : ''}
            ${multiline ? `<textarea class="yzd-input" rows="5">${esc(value)}</textarea>` : `<input class="yzd-input" type="text" value="${esc(value)}">`}
            <div class="yzd-dlg-btns"><span class="yzd-btn" data-v="0">取消</span><span class="yzd-btn primary" data-v="1">确定</span></div>`, (dlg, close) => {
            const input = dlg.querySelector('.yzd-input');
            setTimeout(() => input.focus(), 50);
            dlg.addEventListener('click', (e) => {
                const b = e.target.closest('[data-v]');
                if (!b) return;
                close(b.dataset.v === '1' ? input.value : null);
            });
        });
    },

    confirm(text, okText = '确定') {
        return this._dialog(`<div class="yzd-dlg-title" style="white-space:pre-line">${esc(text)}</div>
            <div class="yzd-dlg-btns"><span class="yzd-btn" data-v="0">取消</span><span class="yzd-btn primary" data-v="1">${esc(okText)}</span></div>`, (dlg, close) => {
            dlg.addEventListener('click', (e) => {
                const b = e.target.closest('[data-v]');
                if (b) close(b.dataset.v === '1');
            });
        });
    },

    openSheet(title, build, { tall = false, headExtra = '' } = {}) {
        const mask = document.createElement('div');
        mask.className = 'yzd-mask';
        mask.innerHTML = `<div class="yzd-sheet${tall ? ' tall' : ''}"><div class="yzd-sheet-grab"></div>
            <div class="yzd-sheet-head"><b>${esc(title)}</b><span class="yzd-sheet-extra">${headExtra}</span><span class="yzd-x" data-close>✕</span></div>
            <div class="yzd-sheet-body"></div></div>`;
        this.layer.appendChild(mask);
        const sheet = {
            el: mask,
            body: mask.querySelector('.yzd-sheet-body'),
            head: mask.querySelector('.yzd-sheet-head'),
            close: () => { mask.classList.add('out'); setTimeout(() => mask.remove(), 220); sheet.onClose?.(); }
        };
        mask.addEventListener('pointerdown', (e) => { if (e.target === mask) sheet.close(); });
        mask.querySelector('[data-close]').addEventListener('click', () => sheet.close());
        build(sheet.body, sheet);
        return sheet;
    },
});

/* ======================================================================
 *  表单 / 组件库 / 组件编辑
 * ==================================================================== */
function optPairs(options) {
    return (options || []).map(o => Array.isArray(o) ? [String(o[0]), String(o[1] ?? o[0])] : [String(o), String(o).replace(/[\u200b-\u200d\u2060-\u2064\ufeff]/g, '')]);
}

Object.assign(FreeDesktop.prototype, {
    _buildFields(container, fields, values, onChange) {
        const getters = [];
        fields.forEach(f => {
            const row = document.createElement('div');
            row.className = 'yzd-field';
            const v = values?.[f.key];
            const label = `<label class="yzd-flabel">${esc(f.label || f.key)}</label>`;
            let get;
            switch (f.type) {
                case 'textarea':
                    row.innerHTML = `${label}<textarea class="yzd-input" rows="4">${esc(v ?? '')}</textarea>`;
                    get = () => row.querySelector('textarea').value;
                    break;
                case 'color': {
                    const hex = normHex(v, '#ffffff');
                    row.innerHTML = `${label}<div class="yzd-color"><input type="color" value="${hex}"><input class="yzd-input" type="text" value="${esc(v ?? '')}" placeholder="#rrggbb / rgba(...)"></div>`;
                    const [pick, txt] = row.querySelectorAll('input');
                    pick.addEventListener('input', () => { txt.value = pick.value; onChange?.(); });
                    txt.addEventListener('change', () => { if (/^#[0-9a-f]{3,6}$/i.test(txt.value.trim())) pick.value = normHex(txt.value); onChange?.(); });
                    get = () => txt.value.trim();
                    break;
                }
                case 'range': {
                    const val = v ?? f.min ?? 0;
                    row.innerHTML = `${label}<div class="yzd-range"><input type="range" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${esc(val)}"><span>${esc(val)}</span></div>`;
                    const r = row.querySelector('input');
                    r.addEventListener('input', () => { row.querySelector('span').textContent = r.value; onChange?.(); });
                    get = () => Number(r.value);
                    break;
                }
                case 'select': {
                    const pairs = optPairs(f.options);
                    row.innerHTML = `${label}<select class="yzd-input">${pairs.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v ?? '') === ov ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
                    const sel = row.querySelector('select');
                    if (v === undefined || v === null || v === '') sel.selectedIndex = pairs.findIndex(p => p[0] === String(v ?? '')) >= 0 ? sel.selectedIndex : 0;
                    sel.addEventListener('change', () => onChange?.());
                    get = () => sel.value;
                    break;
                }
                case 'image': {
                    row._val = String(v || '');
                    const getNum = (suffix, fallback) => Number(values?.[f.key + suffix] ?? fallback);
                    row.innerHTML = `${label}<div class="yzd-imgrow"><div class="yzd-thumb"></div>
                        <span class="yzd-btn sm" data-i="up">上传</span><span class="yzd-btn sm" data-i="url">链接</span><span class="yzd-btn sm" data-i="clr">清除</span></div>
                        <div class="yzd-image-adjust">
                            <label>图片缩放 <input data-adjust="Zoom" type="range" min="100" max="300" step="5" value="${clamp(getNum('Zoom', 100), 100, 300)}"><output></output></label>
                            <label>左右位置 <input data-adjust="PosX" type="range" min="0" max="100" step="1" value="${clamp(getNum('PosX', 50), 0, 100)}"><output></output></label>
                            <label>上下位置 <input data-adjust="PosY" type="range" min="0" max="100" step="1" value="${clamp(getNum('PosY', 50), 0, 100)}"><output></output></label>
                        </div>`;
                    const paint = () => {
                        const resolved = resolveWidgetMedia(row._val);
                        row.querySelector('.yzd-thumb').style.backgroundImage = resolved ? cssUrl(resolved) : 'none';
                        const thumb = row.querySelector('.yzd-thumb');
                        thumb.classList.toggle('empty', !resolved);
                        thumb.style.backgroundSize = `${row.querySelector('[data-adjust="Zoom"]').value}% auto`;
                        thumb.style.backgroundPosition = `${row.querySelector('[data-adjust="PosX"]').value}% ${row.querySelector('[data-adjust="PosY"]').value}%`;
                        for (const i of row.querySelectorAll('[data-adjust]')) {
                            i.nextElementSibling.textContent = i.dataset.adjust === 'Zoom' ? `${i.value}%` : `${i.value}%`;
                        }
                    };
                    paint();
                    row.addEventListener('input', e => { if (e.target.matches('[data-adjust]')) { paint(); onChange?.(); } });
                    row.addEventListener('click', async (e) => {
                        const b = e.target.closest('[data-i]');
                        if (!b) return;
                        if (b.dataset.i === 'up') {
                            const [file] = await pickFiles({ accept: 'image/*' });
                            if (!file) return;
                            try {
                                const dataUrl = await readImageFile(file, f.maxDim || 1400);
                                row._val = await saveWidgetMedia(dataUrl);
                            } catch (err) { console.error('[组件图片] 上传失败', err); this.toast('图片上传失败，请重试'); return; }
                        } else if (b.dataset.i === 'url') {
                            const u = await this.prompt('图片链接', row._val.startsWith(WIDGET_MEDIA_PREFIX) || /^data:/.test(row._val) ? '' : row._val);
                            if (u === null) return;
                            row._val = u.trim();
                        } else row._val = '';
                        paint();
                        onChange?.();
                    });
                    get = () => row._val;
                    for (const suffix of ['Zoom', 'PosX', 'PosY']) {
                        getters.push([f.key + suffix, () => Number(row.querySelector(`[data-adjust="${suffix}"]`).value)]);
                    }
                    break;
                }
                case 'number':
                    row.innerHTML = `${label}<input class="yzd-input" type="number" value="${esc(v ?? '')}">`;
                    get = () => { const s = row.querySelector('input').value; return s === '' ? undefined : Number(s); };
                    break;
                case 'date':
                case 'time':
                    row.innerHTML = `${label}<input class="yzd-input" type="${f.type}" value="${esc(v ?? '')}">`;
                    get = () => row.querySelector('input').value;
                    break;
                default:
                    row.innerHTML = `${label}<input class="yzd-input" type="text" value="${esc(v ?? '')}">`;
                    get = () => row.querySelector('input').value;
            }
            row.querySelectorAll('input:not([type=range]):not([type=color]),textarea').forEach(i => { i.addEventListener('change', () => onChange?.()); i.addEventListener('input', () => onChange?.()); });
            container.appendChild(row);
            getters.push([f.key, get]);
        });
        return () => Object.fromEntries(getters.map(([k, g]) => [k, g()]));
    },

    /* ---------------- 编辑内容 ---------------- */
    editContent(item) {
        if (item.wtype === 'custom') { this.openCustomEditor(item); return; }
        const def = BUILTINS[item.wtype];
        if (!def) return;
        const d = { ...COMMON_DEFAULTS, ...(def.defaults || {}), ...(item.data || {}) };
        this.openSheet(`编辑 ${defName(def, item.size)}`, (body, sheet) => {
            const prev = document.createElement('div');
            prev.className = 'yzd-edit-prev';
            body.appendChild(prev);
            const form = document.createElement('div');
            body.appendChild(form);
            let pending = 0;
            const get = this._buildFields(form, [...def.fields, ...COMMON_FIELDS], d, () => {
                clearTimeout(pending);
                // 上传图片和拖动位置后，直接将设置写回桌面；无需点保存。
                commit();
            });
            const commit = () => {
                item.data = { ...d, ...get() };
                this._rebuildItem(item);
                this.save();
                prev.innerHTML = '';
                prev.appendChild(this._previewBuiltin(item.wtype, item.size, item.data));
                this._scalePreviews(prev);
            };
            prev.appendChild(this._previewBuiltin(item.wtype, item.size, d));
            this._scalePreviews(prev);
            sheet.onClose = () => { clearTimeout(pending); commit(); Store.save('state', 0); };
            body.insertAdjacentHTML('beforeend', '<div class="yzd-tip">修改会实时保存，完成后直接点右上角 ✕ 关闭即可。</div>');
        }, { tall: true });
    },

    openCustomEditor(item, { isNew = false } = {}) {
        const data = clone(item.data || {});
        data.images = data.images || {};
        data.userFields = Array.isArray(data.userFields) ? data.userFields : [];
        const stateVals = clone(this.S.widgetState[item.id] || {});
        let size = item.size;
        this.openSheet(isNew ? '新建自定义组件' : '高级自定义组件', (body, sheet) => {
            const render = () => {
                body.innerHTML = `
                    <div class="yzd-field"><label class="yzd-flabel">组件名称</label><input class="yzd-input" data-f="name" value="${esc(data.name || '')}"></div>
                    <div class="yzd-field"><label class="yzd-flabel">尺寸</label><select class="yzd-input" data-f="size">${Object.entries(SIZE_DEFS).map(([k, v]) => `<option value="${k}" ${k === size ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
                    <div class="yzd-sec">用户可填写字段</div>
                    <div class="yzd-uf"></div>
                    <div class="yzd-sec">图片素材 <small>HTML/CSS 里用 {{名称}} 引用</small></div>
                    <div class="yzd-imgs"></div>
                    <div class="yzd-addrow"><input class="yzd-input" data-f="newimg" placeholder="新图片占位符名称，如 img1"><span class="yzd-btn sm" data-b="addimg">添加</span></div>
                    <details class="yzd-code"><summary>HTML（可写 &lt;script&gt;，用 widget.getState 读字段）</summary><textarea class="yzd-input mono" data-f="html" rows="12" spellcheck="false">${esc(data.html || '')}</textarea></details>
                    <details class="yzd-code"><summary>CSS</summary><textarea class="yzd-input mono" data-f="css" rows="12" spellcheck="false">${esc(data.css || '')}</textarea></details>
                    <details class="yzd-code"><summary>字段定义（作者用）</summary>
                        <div class="yzd-fdefs">${data.userFields.map((f, i) => `<div class="yzd-fdef"><code>${esc(f.key)}</code> ${esc(f.label || '')} <small>${esc(f.type)}</small><span class="yzd-x sm" data-delf="${i}">✕</span></div>`).join('') || '<div class="yzd-tip">暂无字段</div>'}</div>
                        <div class="yzd-addrow wrap"><input class="yzd-input" data-f="fkey" placeholder="标识 key"><input class="yzd-input" data-f="flabel" placeholder="显示名">
                        <select class="yzd-input" data-f="ftype">${['text', 'number', 'date', 'time', 'color', 'select', 'textarea'].map(t => `<option>${t}</option>`).join('')}</select>
                        <input class="yzd-input" data-f="fopts" placeholder="下拉选项，逗号分隔"><span class="yzd-btn sm" data-b="addf">新增字段</span></div>
                    </details>
                    <div class="yzd-dlg-btns wrap">
                        <span class="yzd-btn" data-b="export">导出组件</span><span class="yzd-btn" data-b="lib">存入组件库</span>
                        <span class="yzd-tip">修改自动保存，点右上角 ✕ 关闭</span></div>`;
                const imgs = body.querySelector('.yzd-imgs');
                const keys = Object.keys(data.images).filter(k => !/(Zoom|PosX|PosY)$/.test(k));
                if (!keys.length) imgs.innerHTML = '<div class="yzd-tip">没有图片占位符</div>';
                this._imgGetters = {};
                keys.forEach(k => {
                    const wrap = document.createElement('div');
                    wrap.className = 'yzd-imgkey';
                    imgs.appendChild(wrap);
                    const get = this._buildFields(wrap, [{ key: k, label: `{{${k}}}`, type: 'image', maxDim: 1200 }], data.images, () => { pull(); commit(); });
                    wrap.insertAdjacentHTML('beforeend', `<span class="yzd-x sm" data-delimg="${esc(k)}">✕</span>`);
                    this._imgGetters[k] = get;
                });
                const uf = body.querySelector('.yzd-uf');
                if (!data.userFields.length) uf.innerHTML = '<div class="yzd-tip">这个组件没有可填写字段</div>';
                this._ufGet = this._buildFields(uf, data.userFields.map(f => ({ ...f, type: f.type === 'string' ? 'text' : f.type })), stateVals, () => { pull(); commit(); });
            };
            const pull = () => {
                data.name = body.querySelector('[data-f=name]').value;
                size = body.querySelector('[data-f=size]').value;
                data.html = body.querySelector('[data-f=html]').value;
                data.css = body.querySelector('[data-f=css]').value;
                Object.entries(this._imgGetters || {}).forEach(([k, g]) => {
                    const vals = g();
                    data.images[k] = vals[k];
                    for (const suffix of ['Zoom', 'PosX', 'PosY']) data.images[k + suffix] = vals[k + suffix];
                });
                Object.assign(stateVals, this._ufGet ? this._ufGet() : {});
            };
            const commit = () => {
                item.data = clone(data);
                const declared = new Set(data.userFields.map(f => f.key));
                const st = (this.S.widgetState[item.id] = this.S.widgetState[item.id] || {});
                Object.entries(stateVals).forEach(([k, v]) => {
                    if (declared.has(k)) { if (v === '' || v === undefined) delete st[k]; else st[k] = v; }
                });
                if (size !== item.size) this.resizeItem(item, size);
                else this._rebuildItem(item);
                this.save();
            };
            render();
            let customCommitTimer;
            body.addEventListener('input', () => {
                clearTimeout(customCommitTimer);
                customCommitTimer = setTimeout(() => { pull(); commit(); }, 160);
            });
            body.addEventListener('change', () => { clearTimeout(customCommitTimer); pull(); commit(); });
            sheet.onClose = () => { clearTimeout(customCommitTimer); pull(); commit(); Store.save('state', 0); };
            body.addEventListener('click', (e) => {
                const b = e.target.closest('[data-b],[data-delimg],[data-delf]');
                if (!b) return;
                pull();
                if (b.dataset.delimg) { const k = b.dataset.delimg; for (const suffix of ['', 'Zoom', 'PosX', 'PosY']) delete data.images[k + suffix]; commit(); render(); return; }
                if (b.dataset.delf !== undefined) { data.userFields.splice(Number(b.dataset.delf), 1); commit(); render(); return; }
                const act = b.dataset.b;
                if (act === 'addimg') {
                    const k = body.querySelector('[data-f=newimg]').value.trim().replace(/[^\w$-]/g, '');
                    if (k && !(k in data.images)) data.images[k] = '';
                    commit(); render();
                } else if (act === 'addf') {
                    const key = body.querySelector('[data-f=fkey]').value.trim().replace(/[^\w$]/g, '');
                    if (!key) { this.toast('请填写字段标识'); return; }
                    const f = { key, label: body.querySelector('[data-f=flabel]').value.trim() || key, type: body.querySelector('[data-f=ftype]').value };
                    if (f.type === 'select') f.options = body.querySelector('[data-f=fopts]').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                    data.userFields = data.userFields.filter(x => x.key !== key).concat(f);
                    commit(); render();
                } else if (act === 'export') {
                    const exported = this._toTemplateJson(data, size);
                    exported.images = Object.fromEntries(Object.entries(data.images || {}).map(([k, v]) => [k, resolveWidgetMedia(v)]));
                    downloadText(`${(data.name || 'widget').replace(/[\\/:*?"<>|]/g, '_')}.widget.json`, JSON.stringify(exported, null, 2));
                } else if (act === 'lib') {
                    this.addToLibrary({ ...this._toTemplateJson(data, size), images: clone(data.images), templateId: data.templateId || uid('t') }, { src: '自建' });
                    this.toast('已存入组件库');
                }
            });
        }, { tall: true });
    },

    _toTemplateJson(data, size) {
        return {
            type: 'custom_widget_template', version: 2,
            name: data.name || '自定义组件', size: SIZE_DEFS[size] ? size : 'small',
            html: data.html || '', css: data.css || '',
            imageKeys: Object.keys(data.images || {}).filter(k => !/(Zoom|PosX|PosY)$/.test(k)),
            userFields: clone(data.userFields || [])
        };
    },

    addToLibrary(tpl, { cat, src } = {}) {
        const t = {
            tid: tpl.templateId || tpl.tid || uid('t'),
            name: String(tpl.name || '自定义组件'),
            size: SIZE_DEFS[tpl.size] ? tpl.size : 'small',
            html: String(tpl.html || ''), css: String(tpl.css || ''),
            imageKeys: Array.isArray(tpl.imageKeys) ? tpl.imageKeys : Object.keys(tpl.images || {}),
            userFields: clone(tpl.userFields || []),
            images: Object.fromEntries(Object.entries(tpl.images || {}).filter(([, v]) => /^(https?:|yzd-media:)/i.test(String(v || ''))))
        };
        const idx = Store.library.findIndex(x => x.tid === t.tid || (x.name === t.name && x.html.length === t.html.length && x.css.length === t.css.length));
        const old = idx >= 0 ? Store.library[idx] : null;
        t.cat = cat || old?.cat || tpl.cat || '';
        t.src = src || old?.src || tpl.src || '导入';
        if (idx >= 0) Store.library[idx] = t; else Store.library.unshift(t);
        Store.save('library');
        return t;
    },

    /* ---------------- 预览 ---------------- */
    _cellPx() {
        const vw = this.viewport?.clientWidth || 360;
        const vh = this.viewport?.clientHeight || 640;
        const padX = Math.round(vw * 0.035);
        return { cw: (vw - padX * 2) / COLS, ch: (vh - 8) / ROWS };
    },
    _previewShell(size) {
        const { cw, ch } = this._cellPx();
        const sd = SIZE_DEFS[size] || SIZE_DEFS.small;
        const wrap = document.createElement('div');
        wrap.className = 'yzd-prev';
        wrap.dataset.w = String(sd.w * cw);
        wrap.dataset.h = String(sd.h * ch);
        const inner = document.createElement('div');
        inner.className = `yzd-prev-inner yzd-item yzd-widget yzd-size-${size}`;
        inner.style.width = `${sd.w * cw}px`;
        inner.style.height = `${sd.h * ch}px`;
        wrap.appendChild(inner);
        return { wrap, inner };
    },
    _previewBuiltin(wtype, size, data) {
        const { wrap, inner } = this._previewShell(size);
        inner.classList.add(`yzd-w-${wtype}`);
        const box = document.createElement('div');
        inner.appendChild(box);
        const d = { ...COMMON_DEFAULTS, ...(BUILTINS[wtype]?.defaults || {}), ...(data || {}) };
        this._fillWidget({ id: 'preview', kind: 'widget', wtype, size, data: d }, box);
        return wrap;
    },
    _previewCustom(tpl, size) {
        const { wrap, inner } = this._previewShell(size);
        const box = document.createElement('div');
        box.className = 'yzd-wbox yzd-wbox-custom';
        const iframe = document.createElement('iframe');
        iframe.className = 'yzd-frame';
        iframe.setAttribute('sandbox', 'allow-scripts');
        iframe.setAttribute('loading', 'lazy');
        iframe.srcdoc = buildSrcdoc({ html: tpl.html, css: tpl.css, images: Object.fromEntries(Object.entries(tpl.images || {}).map(([key, value]) => [key, resolveWidgetMedia(value)])) }, {});
        box.appendChild(iframe);
        inner.appendChild(box);
        return wrap;
    },
    _scalePreviews(container) {
        requestAnimationFrame(() => {
            container.querySelectorAll('.yzd-prev').forEach(wrap => {
                const w = Number(wrap.dataset.w) || 1;
                const h = Number(wrap.dataset.h) || 1;
                const avail = wrap.clientWidth || w;
                const sc = Math.min(1, avail / w);
                const inner = wrap.firstElementChild;
                inner.style.transform = `scale(${sc})`;
                wrap.style.height = `${h * sc}px`;
            });
        });
    },
});

/* ======================================================================
 *  组件画廊（添加 / 更换样式）
 * ==================================================================== */
Object.assign(FreeDesktop.prototype, {
    /* 组件按「小 / 中 / 大 / 未分类」分组，再按来源（内置 / 自建 / 导入 / 某个主题）筛选 */
    openGallery({ mode = 'add', target = null } = {}) {
        const replacing = mode === 'replace' && target;
        const s = this.S;
        if (replacing) this._galCat = sizeCat(target.size);
        if (!GAL_CATS.some(([k]) => k === this._galCat)) this._galCat = 'all';
        if (!this._galSrc) this._galSrc = 'all';

        const sheet = this.openSheet(replacing ? '更换样式' : '添加组件', (body) => {
            body.innerHTML = `
                <div class="yzd-gal-filters">
                    <div class="yzd-tabs">${GAL_CATS.map(([k, l]) => `<span class="yzd-tab" data-cat="${k}">${l}</span>`).join('')}</div>
                    <div class="yzd-srcs-row"><span class="yzd-srcs-label">按主题</span><div class="yzd-srcs"></div></div>
                </div>
                <div class="yzd-gal-content"></div>`;
        }, {
            tall: true,
            headExtra: `<span class="yzd-hbtn" data-g="new" title="新建自定义组件">⊕</span><span class="yzd-hbtn" data-g="import" title="导入组件">↑</span>`
        });
        const body = sheet.body;
        const content = body.querySelector('.yzd-gal-content');
        let observer = null;
        let queue = [];
        let pumping = false;
        const pump = () => {
            if (pumping) return;
            pumping = true;
            const step = () => {
                const job = queue.shift();
                if (!job || !body.isConnected) { pumping = false; return; }
                job();
                setTimeout(step, 40);
            };
            step();
        };
        sheet.onClose = () => { observer?.disconnect(); queue = []; };

        // 来源：内置 → 每个已保存的主题（直接取主题里的组件）→ 单独导入的组件
        const entries = () => {
            const list = [];
            Object.entries(BUILTINS).forEach(([type, def]) => {
                def.sizes.forEach(size => list.push({ kind: 'builtin', type, size, name: defName(def, size), cat: sizeCat(size), src: '内置' }));
            });
            const seenTheme = new Set();
            this._themeSources().forEach(th => {
                const seen = new Set();
                (th.state?.items || []).forEach(it => {
                    if (it.kind !== 'widget' || it.wtype !== 'custom') return;
                    const key = `${it.data?.name}|${String(it.data?.html || '').length}|${String(it.data?.css || '').length}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    seenTheme.add(`${it.data?.name}`);
                    list.push({ kind: 'theme', item: it, wstate: th.state?.widgetState?.[it.id] || {}, size: it.size, name: it.data?.name || '组件', cat: sizeCat(it.size), src: th.name, tpl: it.data });
                });
            });
            Store.library.forEach((tpl, i) => {
                // 旧版自动塞进库里的主题组件（和已保存主题里的重复）不再单独显示
                if ((tpl.src === '导入' || this._themeSources().some(t => t.name === tpl.src)) && seenTheme.has(tpl.name)) return;
                list.push({ kind: 'lib', idx: i, tpl, size: tpl.size, name: tpl.name, cat: sizeCat(tpl.size), src: tpl.src && tpl.src !== '导入' && !this._themeSources().some(t => t.name === tpl.src) ? tpl.src : '单独导入' });
            });
            return list;
        };

        const renderSrcs = () => {
            const srcs = ['all', ...new Set(entries().map(e => e.src))];
            if (!srcs.includes(this._galSrc)) this._galSrc = 'all';
            body.querySelector('.yzd-srcs').innerHTML = srcs.map(x => `<span class="yzd-chip sm ${x === this._galSrc ? 'on' : ''}" data-src="${esc(x)}">${x === 'all' ? '全部主题' : esc(x)}</span>`).join('')
                + (this._galSrc === '单独导入' || this._galSrc === '自建' ? `<span class="yzd-chip sm danger" data-srcdel="1">全部删除</span>` : '');
            body.querySelectorAll('.yzd-tab').forEach(t => t.classList.toggle('on', t.dataset.cat === this._galCat));
        };

        const render = () => {
            observer?.disconnect();
            queue = [];
            renderSrcs();
            const list = entries().filter(e => (this._galCat === 'all' || e.cat === this._galCat) && (this._galSrc === 'all' || e.src === this._galSrc));
            const hiddenApps = s.hidden.map(id => this.getApp(id)).filter(Boolean);
            content.innerHTML = `
                ${!replacing && hiddenApps.length && this._galCat === 'all' ? `<div class="yzd-sec">已移除的应用（点一下放回桌面）</div>
                    <div class="yzd-hidden-apps">${hiddenApps.map(a => `<div class="yzd-happ" data-happ="${esc(a.id)}">${this._appIconHtml(a)}<small>${esc(this._appName(a))}</small></div>`).join('')}</div>` : ''}
                ${list.length ? '' : '<div class="yzd-tip yzd-empty-tip">这个尺寸下还没有组件</div>'}
                <div class="yzd-gal"></div>`;
            const grid = content.querySelector('.yzd-gal');
            const frag = document.createDocumentFragment();
            list.forEach(e => {
                const sd = SIZE_DEFS[e.size] || SIZE_DEFS.small;
                const card = document.createElement('div');
                card.className = `yzd-gcard span-${sd.w >= 4 ? 2 : 1}`;
                if (e.kind === 'builtin') { card.dataset.type = e.type; card.dataset.size = e.size; }
                else if (e.kind === 'theme') card.dataset.theme = '1';
                else card.dataset.lib = String(e.idx);
                const { wrap } = this._previewShell(e.size);
                wrap.classList.add('lazy');
                card.appendChild(wrap);
                card.insertAdjacentHTML('beforeend', `<div class="yzd-gname">${esc(e.name)} <small>${sd.label}</small></div>
                    <div class="yzd-gsrc">${esc(e.src)}</div>
                    ${e.kind === 'lib' ? `<span class="yzd-x sm yzd-gdel" data-libmore="${e.idx}">✕</span>` : ''}`);
                card._entry = e;
                frag.appendChild(card);
            });
            grid.appendChild(frag);
            this._scalePreviews(grid);
            // 只有滚动到可见区域才真正生成预览，iframe 一个一个排队加载
            const fill = (card) => {
                const e = card._entry;
                const wrap = card.querySelector('.yzd-prev');
                if (!wrap || !wrap.classList.contains('lazy')) return;
                wrap.classList.remove('lazy');
                const inner = wrap.firstElementChild;
                if (e.kind === 'builtin') {
                    inner.classList.add(`yzd-w-${e.type}`);
                    const box = document.createElement('div');
                    inner.appendChild(box);
                    const d = { ...COMMON_DEFAULTS, ...(BUILTINS[e.type]?.defaults || {}) };
                    this._fillWidget({ id: 'preview', kind: 'widget', wtype: e.type, size: e.size, data: d }, box);
                } else {
                    const box = document.createElement('div');
                    box.className = 'yzd-wbox yzd-wbox-custom';
                    const iframe = document.createElement('iframe');
                    iframe.className = 'yzd-frame';
                    iframe.setAttribute('sandbox', 'allow-scripts');
                    iframe.srcdoc = buildSrcdoc({ html: e.tpl.html, css: e.tpl.css, images: Object.fromEntries(Object.entries(e.tpl.images || {}).map(([key, value]) => [key, resolveWidgetMedia(value)])) }, e.wstate || {});
                    box.appendChild(iframe);
                    inner.appendChild(box);
                }
            };
            if (typeof IntersectionObserver !== 'undefined') {
                observer = new IntersectionObserver((ents) => {
                    ents.forEach(en => {
                        if (!en.isIntersecting) return;
                        observer.unobserve(en.target);
                        const card = en.target;
                        if (card._entry.kind === 'builtin') fill(card);
                        else { queue.push(() => fill(card)); pump(); }
                    });
                }, { root: body, rootMargin: '150px 0px' });
                grid.querySelectorAll('.yzd-gcard').forEach(c => observer.observe(c));
            } else {
                grid.querySelectorAll('.yzd-gcard').forEach(c => queue.push(() => fill(c)));
                pump();
            }
            body.scrollTop = 0;
        };
        requestAnimationFrame(render);

        body.addEventListener('click', async (e) => {
            const tab = e.target.closest('[data-cat]');
            if (tab) { this._galCat = tab.dataset.cat; render(); return; }
            if (e.target.closest('[data-srcdel]')) {
                const src = this._galSrc;
                const ids = new Set(entries().filter(x => x.kind === 'lib' && x.src === src).map(x => x.idx));
                if (await this.confirm(`删除「${src}」里的 ${ids.size} 个组件？（桌面上已放的不受影响）`, '删除')) {
                    Store.library = Store.library.filter((t, i) => !ids.has(i));
                    Store.save('library');
                    this._galSrc = 'all';
                    render();
                }
                return;
            }
            const src = e.target.closest('[data-src]');
            if (src) { this._galSrc = src.dataset.src; render(); return; }
            const more = e.target.closest('[data-libmore]');
            if (more) {
                e.stopPropagation();
                const idx = Number(more.dataset.libmore);
                const tpl = Store.library[idx];
                if (tpl && await this.confirm(`从组件库删除「${tpl.name}」？（桌面上已放的不受影响）`, '删除')) {
                    Store.library.splice(idx, 1);
                    Store.save('library');
                    render();
                }
                return;
            }
            const happ = e.target.closest('[data-happ]');
            if (happ) {
                const id = happ.dataset.happ;
                s.hidden = s.hidden.filter(x => x !== id);
                const it = { id: uid('a'), kind: 'app', appId: id, page: this.page, x: 0, y: 0 };
                this._autoPlace(it, this.page);
                s.items.push(it);
                this.syncLayout();
                this.goPage(it.page);
                this.save();
                happ.remove();
                return;
            }
            const card = e.target.closest('.yzd-gcard');
            if (!card) return;
            let newItem;
            if (card.dataset.type) {
                newItem = makeWidget(card.dataset.type, card.dataset.size);
                if (replacing && target.wtype !== 'custom') {
                    const keep = {};
                    ['bg', 'bgColor', 'bgAlpha', 'bgImage', 'textColor', 'radius'].forEach(k => { if (target.data?.[k] !== undefined) keep[k] = target.data[k]; });
                    Object.assign(newItem.data, keep);
                }
            } else if (card.dataset.theme) {
                const e2 = card._entry;
                newItem = makeCustomWidget({ ...e2.item.data, images: { ...(e2.item.data?.images || {}) } }, e2.size);
                newItem.data.images = { ...(e2.item.data?.images || {}) };
                s.widgetState[newItem.id] = clone(e2.wstate || {});
            } else if (card.dataset.lib !== undefined) {
                const tpl = Store.library[Number(card.dataset.lib)];
                if (!tpl) return;
                newItem = makeCustomWidget(tpl, tpl.size);
            }
            if (!newItem) return;
            sheet.close();
            if (replacing) this.replaceWidget(target, newItem);
            else this.placeNewWidget(newItem);
            if (!card.dataset.theme && newItem.wtype === 'custom' && ((newItem.data.userFields || []).length || Object.keys(newItem.data.images || {}).some(k => !newItem.data.images[k]))) {
                setTimeout(() => this.openCustomEditor(newItem), 260);
            }
        });

        sheet.head.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-g]');
            if (!b) return;
            if (b.dataset.g === 'import') {
                sheet.close();
                await this.importJsonFlow('widget');
            } else {
                const sz = await this._chooseSize();
                if (!sz) return;
                sheet.close();
                const it = makeCustomWidget({ name: '我的组件', html: '<div class="card">Hello ✦</div>', css: '.card{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:22px;background:rgba(255,255,255,.55);font:600 16px -apple-system,sans-serif;color:#333}', userFields: [], imageKeys: [] }, sz);
                this.placeNewWidget(it);
                this.openCustomEditor(it, { isNew: true });
            }
        });
    },

    /** 用来筛选组件的已保存主题（不含自动备份） */
    _themeSources() {
        return Store.themes.filter(t => t && t.name && t.name !== AUTO_BACKUP_NAME && Array.isArray(t.state?.items));
    },

    _chooseSize() {
        return this._dialog(`<div class="yzd-dlg-title">选择尺寸</div><div class="yzd-chips">${Object.entries(SIZE_DEFS).map(([k, v]) => `<span class="yzd-chip" data-sz="${k}">${v.label}</span>`).join('')}</div>
            <div class="yzd-dlg-btns"><span class="yzd-btn" data-v="0">取消</span></div>`, (dlg, close) => {
            dlg.addEventListener('click', (e) => {
                const c = e.target.closest('[data-sz]');
                if (c) close(c.dataset.sz);
                else if (e.target.closest('[data-v]')) close(null);
            });
        });
    },

    placeNewWidget(item) {
        const s = this.S;
        const { w, h } = sizeOf(item);
        const pos = this._findFree(this.page, w, h, [item.id]);
        if (pos) { item.page = this.page; item.x = pos.x; item.y = pos.y; }
        else this._autoPlace(item, this.page);
        s.items.push(item);
        this.syncLayout();
        this.goPage(item.page);
        this.save();
    },

    replaceWidget(target, newItem) {
        const s = this.S;
        s.items = s.items.filter(i => i.id !== target.id);
        delete s.widgetState[target.id];
        this._removeItemEl(target);
        newItem.page = target.page;
        newItem.x = target.x;
        newItem.y = target.y;
        const { w, h } = sizeOf(newItem);
        newItem.x = clamp(newItem.x, 0, COLS - w);
        newItem.y = clamp(newItem.y, 0, ROWS - h);
        const ev = this._evaluate(newItem, newItem.page, newItem.x, newItem.y);
        if (!ev.ok) this._autoPlace(newItem, newItem.page);
        s.items.push(newItem);
        if (ev.ok && ev.displace) ev.displace.forEach(a => this._autoPlace(a, newItem.page));
        this.syncLayout();
        this.save();
    },
});

/* ======================================================================
 *  主题 / 美化 / 图标 / 导入导出
 * ==================================================================== */
const AUTO_BACKUP_NAME = '⟲ 自动备份（应用主题前）';

Object.assign(FreeDesktop.prototype, {
    openThemeSheet() {
        const sheet = this.openSheet('美化与主题', (body, sh) => this._renderThemeBody(body, sh), { tall: true });
        return sheet;
    },

    _renderThemeBody(body, sheet) {
        const s = this.S;
        const st = s.style;
        const curName = s.themeName || '';
        const wall = String(s.wallpaper || '').trim() || String(this.home?._getWallpaperImage?.() || '');
        body.innerHTML = `
            <div class="yzd-sec">主题 ${curName ? `<small>当前：${esc(curName)}</small>` : ''}</div>
            <div class="yzd-btnrow">
                <span class="yzd-btn" data-t="savenew">保存为新主题</span>
                ${curName && Store.themes.some(t => t.name === curName) ? `<span class="yzd-btn" data-t="overwrite">覆盖「${esc(curName)}」</span>` : ''}
                <span class="yzd-btn primary" data-t="import">导入美化 JSON</span>
                <span class="yzd-btn" data-t="importw">导入组件 JSON</span>
            </div>
            <div class="yzd-themes">${Store.themes.length ? Store.themes.map((t, i) => `
                <div class="yzd-theme ${t.name === curName ? 'on' : ''}">
                    <div class="yzd-theme-thumb" style="background-image:${esc(cssUrl(t.state?.wallpaper || ''))}"></div>
                    <div class="yzd-theme-info"><b>${esc(t.name)}</b><small>${esc(new Date(t.savedAt || Date.now()).toLocaleString())} · ${(t.state?.items || []).filter(x => x.kind === 'widget').length} 个组件</small></div>
                    <span class="yzd-btn sm primary" data-apply="${i}">应用</span><span class="yzd-btn sm" data-exp="${i}">导出</span><span class="yzd-x sm" data-del="${i}">✕</span>
                </div>`).join('') : '<div class="yzd-tip">还没有保存的主题。导入的美化会自动存成主题，可随时切换。</div>'}</div>

            <div class="yzd-sec">壁纸</div>
            <div class="yzd-imgrow"><div class="yzd-thumb tall" style="background-image:${esc(cssUrl(wall))}"></div>
                <span class="yzd-btn sm" data-t="wallup">上传</span><span class="yzd-btn sm" data-t="wallurl">链接</span><span class="yzd-btn sm" data-t="wallreset">用手机设置的壁纸</span></div>

            <div class="yzd-sec">应用图标 <small>${s.themeIcons?.enabled ? '跟随主题' : '原版图标'} · 点图标单独换</small></div>
            <div class="yzd-iconlist">${this.apps.map(a => `<div class="yzd-happ" data-icon="${esc(a.id)}">${this._appIconHtml(a)}<small>${esc(this._appName(a))}</small>${s.icons[a.id] && s.icons[a.id] !== '@glyph' ? '<i class="yzd-dot-mark"></i>' : ''}</div>`).join('')}</div>
            <div class="yzd-btnrow">
                <span class="yzd-btn primary" data-t="iconextract">从美化 JSON 提取图标</span>
                <span class="yzd-btn" data-t="iconglyph">全部用主题线条图标</span>
                ${(s.iconPool || []).length ? '<span class="yzd-btn" data-t="iconrandom">随机用主题图片</span>' : ''}
                <span class="yzd-btn" data-t="iconbulk">批量导入图标</span>
                <span class="yzd-btn" data-t="iconreset">全部用原版图标</span>
            </div>
            <div class="yzd-field yzd-glyph-color"><label class="yzd-flabel">主题线条图标颜色</label>
                <div class="yzd-color"><input type="color" value="${normHex(s.themeIcons?.color, '#7fa6b6')}"><input class="yzd-input" type="text" value="${esc(s.themeIcons?.color || '#7fa6b6')}"></div></div>

            <div class="yzd-sec">主题图片池 <small>${(s.iconPool || []).length ? '点图片：分配给应用 · ⤓ 下载 · ✕ 删掉不喜欢的（随机就不会抽到）' : '导入美化或「提取图标」后这里会列出主题里的所有图片'}</small></div>
            <div class="yzd-pool">${(s.iconPool || []).map((p, i) => `<div class="yzd-pool-item" data-pool="${i}"><i class="yzd-pool-ic" style="background-image:${esc(cssUrl(this._resolvePoolUrl(p.url)))}"></i><small>${esc(p.label)}</small><span class="yzd-pool-dl" data-pooldl="${i}">⤓</span><span class="yzd-pool-del" data-pooldel="${i}">✕</span></div>`).join('')}</div>

            <div class="yzd-sec">外观</div>
            <div class="yzd-look"></div>

            <div class="yzd-sec">其他</div>
            <div class="yzd-btnrow">
                <span class="yzd-btn" data-t="resetlayout">恢复默认布局</span>
                <span class="yzd-btn" data-t="legacy">切换回原版桌面</span>
            </div>
            <p class="yzd-tip">数据保存在本浏览器（IndexedDB）。换设备/清缓存前请先「导出」主题。<br>原版桌面长按空白处可再切回自由桌面。</p>`;

        const look = body.querySelector('.yzd-look');
        const getLook = this._buildFields(look, [
            { key: 'iconShape', label: '图标外形', type: 'select', options: [
                ['rounded', '圆角方形（推荐，适配美化）'],
                ['circle', '圆形'],
                ['original', '原图形状（适合透明 PNG）'],
                ['square', '直角方形']
            ] },
            { key: 'iconRadius', label: '圆角大小（圆角方形模式）', type: 'range', min: 0, max: 50, step: 1 },
            { key: 'iconFit', label: '图标图片适配方式', type: 'select', options: [
                ['cover', '铺满图标（可能裁剪边缘）'],
                ['contain', '完整显示图片（不裁剪）']
            ] },
            { key: 'iconScale', label: '图标大小 %', type: 'range', min: 60, max: 130, step: 1 },
            { key: 'labelColor', label: '图标文字颜色', type: 'color' },
            { key: 'showLabels', label: '显示图标名字', type: 'select', options: [['1', '显示'], ['0', '隐藏']] },
            { key: 'plateColor', label: '图标底板颜色', type: 'color' },
            { key: 'plateAlpha', label: '图标底板不透明度（0=无底板）', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'dockColor', label: 'Dock 颜色', type: 'color' },
            { key: 'dockAlpha', label: 'Dock 不透明度', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'dockBlur', label: 'Dock 模糊', type: 'range', min: 0, max: 40, step: 1 }
        ], { ...st, showLabels: st.showLabels === false ? '0' : '1' }, () => {
            const v = getLook();
            Object.assign(st, v, { showLabels: v.showLabels !== '0' });
            this.applyStyleVars();
            this.save();
        });

        const gc = body.querySelector('.yzd-glyph-color');
        if (gc) {
            const [pick, txt] = gc.querySelectorAll('input');
            const applyGlyph = (v) => {
                if (!/^#[0-9a-f]{3,6}$/i.test(v)) return;
                s.themeIcons = { ...(s.themeIcons || { enabled: false }), color: normHex(v) };
                this.save();
                this.refreshAppVisuals();
                body.querySelectorAll('.yzd-iconlist .yzd-happ').forEach(h => {
                    const a = this.getApp(h.dataset.icon);
                    const ic = h.querySelector('.yzd-icon');
                    if (a && ic) ic.outerHTML = this._appIconHtml(a);
                });
            };
            pick.addEventListener('change', () => { txt.value = pick.value; applyGlyph(pick.value); });
            txt.addEventListener('change', () => { pick.value = normHex(txt.value); applyGlyph(txt.value.trim()); });
        }

        body.onclick = async (e) => {
            const el = e.target.closest('[data-t],[data-apply],[data-exp],[data-del],[data-icon],[data-pooldl],[data-pooldel],[data-pool]');
            if (!el) return;
            if (el.dataset.apply !== undefined) { sheet.close(); await this.applyTheme(Store.themes[Number(el.dataset.apply)]); return; }
            if (el.dataset.exp !== undefined) { this.exportTheme(Store.themes[Number(el.dataset.exp)]); return; }
            if (el.dataset.del !== undefined) {
                const t = Store.themes[Number(el.dataset.del)];
                if (t && await this.confirm(`删除主题「${t.name}」？`, '删除')) {
                    Store.themes.splice(Number(el.dataset.del), 1);
                    Store.save('themes');
                    this._renderThemeBody(body, sheet);
                }
                return;
            }
            if (el.dataset.icon) { this.openIconChooser(el.dataset.icon, () => this._renderThemeBody(body, sheet)); return; }
            if (el.dataset.pooldl !== undefined) {
                e.stopPropagation();
                const p = (s.iconPool || [])[Number(el.dataset.pooldl)];
                if (p) this.downloadImage(this._resolvePoolUrl(p.url), p.label);
                return;
            }
            if (el.dataset.pooldel !== undefined) {
                e.stopPropagation();
                this.removePoolImage(Number(el.dataset.pooldel));
                const item = el.closest('.yzd-pool-item');
                item?.remove();
                // 重新编号，避免后面的按钮指错图
                body.querySelectorAll('.yzd-pool .yzd-pool-item').forEach((it, i) => {
                    it.dataset.pool = String(i);
                    it.querySelector('[data-pooldl]')?.setAttribute('data-pooldl', String(i));
                    it.querySelector('[data-pooldel]')?.setAttribute('data-pooldel', String(i));
                });
                return;
            }
            if (el.dataset.pool !== undefined) { await this.assignPoolImage(Number(el.dataset.pool), () => this._renderThemeBody(body, sheet)); return; }
            const t = el.dataset.t;
            if (t === 'savenew') {
                const name = await this.prompt('主题名称', curName && !Store.themes.some(x => x.name === curName) ? curName : `我的主题 ${Store.themes.length + 1}`);
                if (!name) return;
                this.saveTheme(name.trim());
                this._renderThemeBody(body, sheet);
            } else if (t === 'overwrite') {
                this.saveTheme(curName);
                this.toast('已覆盖保存');
                this._renderThemeBody(body, sheet);
            } else if (t === 'import') { sheet.close(); await this.importJsonFlow('theme'); }
            else if (t === 'importw') { sheet.close(); await this.importJsonFlow('widget'); }
            else if (t === 'savewidgets') {
                const tpls = s.items.filter(i => i.kind === 'widget' && i.wtype === 'custom').map(i => ({ ...i.data, size: i.size }));
                if (!tpls.length) { this.toast('当前桌面没有自定义组件'); return; }
                await this._askSaveThemeWidgets(tpls, s.themeName || '当前桌面');
            }
            else if (t === 'wallup') {
                const [file] = await pickFiles({ accept: 'image/*' });
                if (!file) return;
                s.wallpaper = await readImageFile(file, 1800, 0.86);
                this.updateWallpaper(); this.save(); this._renderThemeBody(body, sheet);
            } else if (t === 'wallurl') {
                const u = await this.prompt('壁纸图片链接', /^data:/.test(s.wallpaper || '') ? '' : (s.wallpaper || ''));
                if (u === null) return;
                s.wallpaper = u.trim(); this.updateWallpaper(); this.save(); this._renderThemeBody(body, sheet);
            } else if (t === 'wallreset') {
                s.wallpaper = ''; this.updateWallpaper(); this.save(); this._renderThemeBody(body, sheet);
            } else if (t === 'iconbulk') { await this.bulkImportIcons(); this._renderThemeBody(body, sheet); }
            else if (t === 'iconextract') { await this.extractIconsFromFile(); this._renderThemeBody(body, sheet); }
            else if (t === 'iconglyph') {
                s.themeIcons = { ...(s.themeIcons || { color: '#7fa6b6' }), enabled: true };
                s.icons = {};
                if (!(Number(s.style.plateAlpha) > 0)) { s.style.plateAlpha = 0.45; this.applyStyleVars(); }
                this.save(); this.refreshAppVisuals(); this._renderThemeBody(body, sheet);
            } else if (t === 'iconrandom') {
                s.icons = {};
                this._randomAssign(s, this.apps.map(a => a.id));
                this.save(); this.refreshAppVisuals(); this._renderThemeBody(body, sheet);
            } else if (t === 'iconreset') {
                if (await this.confirm('当前主题的应用图标全部换回 phone 文件夹里的原版图标？')) {
                    s.icons = {};
                    if (s.themeIcons) s.themeIcons.enabled = false;
                    this.save(); this.refreshAppVisuals(); this._renderThemeBody(body, sheet);
                }
            } else if (t === 'resetlayout') {
                if (await this.confirm('恢复默认布局？当前桌面的组件和摆放会被清空（已保存的主题不受影响）。', '恢复')) {
                    const keep = { icons: s.icons, wallpaper: s.wallpaper, style: s.style };
                    Store.state = Object.assign(this._buildDefaultState(), keep);
                    this.page = 0; sheet.close(); this.build(); this.save();
                }
            } else if (t === 'legacy') {
                if (await this.confirm('切换回原版桌面（图标/卡片布局）？自由桌面的数据会保留。', '切换')) {
                    sheet.close();
                    FreeDesktop.setEnabled(false);
                    this.editing = false;
                    this.home?.render?.({ forceDomRefresh: true });
                }
            }
        };
    },

    saveTheme(name) {
        const snap = clone(this.S);
        snap.themeName = name;
        this.S.themeName = name;
        const t = { id: uid('th'), name, savedAt: Date.now(), state: snap };
        const idx = Store.themes.findIndex(x => x.name === name);
        if (idx >= 0) Store.themes[idx] = { ...Store.themes[idx], savedAt: t.savedAt, state: snap };
        else Store.themes.unshift(t);
        Store.save('themes', 50);
        this.save();
    },

    _autoBackup() {
        const cur = this.S;
        if (!cur || !cur.items?.length) return;
        const already = Store.themes.find(t => t.name === cur.themeName);
        if (already && JSON.stringify(already.state.items) === JSON.stringify(cur.items)) return;
        const snap = clone(cur);
        const idx = Store.themes.findIndex(t => t.name === AUTO_BACKUP_NAME);
        const t = { id: uid('th'), name: AUTO_BACKUP_NAME, savedAt: Date.now(), state: { ...snap, themeName: AUTO_BACKUP_NAME } };
        if (idx >= 0) Store.themes[idx] = t; else Store.themes.push(t);
    },

    async applyTheme(theme) {
        if (!theme?.state) return;
        this._autoBackup();
        Store.state = clone(theme.state);
        Store.state.themeName = theme.name;
        this.page = 0;
        this.editing = false;
        this.root?.classList.remove('yzd-editing');
        this.build();
        this.save();
        Store.save('themes', 50);
        this.toast(`已应用主题「${theme.name}」`);
    },

    exportTheme(theme) {
        if (!theme) return;
        const state = embedWidgetMediaForExport(theme.state);
        const ok = downloadText(`${theme.name.replace(/[\\/:*?"<>|]/g, '_')}.yuzuki-theme.json`, JSON.stringify({ type: 'yuzuki_phone_desktop_theme', version: 2, name: theme.name, exportDate: new Date().toISOString(), state }));
        this.toast(ok ? '已导出（已包含组件图片）' : '导出失败');
    },

    async bulkImportIcons() {
        const files = await pickFiles({ accept: 'image/*', multiple: true });
        if (!files.length) return;
        const guess = (file) => matchAppId([file.name], this.apps, a => this._appName(a));
        const list = await Promise.all(files.map(async f => ({ url: await readImageFile(f, 256), app: guess(f), name: f.name })));
        await new Promise((resolve) => {
            const sheet = this.openSheet('分配图标', (body) => {
                body.innerHTML = `<p class="yzd-tip">给每张图选一个应用（按文件名已自动匹配）</p>
                    ${list.map((it, i) => `<div class="yzd-assign"><div class="yzd-thumb" style="background-image:${esc(cssUrl(it.url))}"></div>
                    <small>${esc(it.name)}</small><select class="yzd-input" data-ai="${i}"><option value="">— 不使用 —</option>
                    ${this.apps.map(a => `<option value="${esc(a.id)}" ${a.id === it.app ? 'selected' : ''}>${esc(this._appName(a))}</option>`).join('')}</select></div>`).join('')}
                    <div class="yzd-dlg-btns"><span class="yzd-btn" data-b="0">取消</span><span class="yzd-btn primary" data-b="1">应用</span></div>`;
                body.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-b]');
                    if (!b) return;
                    if (b.dataset.b === '1') {
                        body.querySelectorAll('[data-ai]').forEach(sel => {
                            if (sel.value) this.S.icons[sel.value] = list[Number(sel.dataset.ai)].url;
                        });
                        this.save();
                        this.refreshAppVisuals();
                    }
                    sheet.close();
                });
            });
            sheet.onClose = resolve;
        });
    },

    /* ---------- JSON 导入总入口（自动识别 美化 / 组件） ---------- */
    async importJsonFlow(prefer = 'theme') {
        const files = await pickFiles({ accept: '.json,application/json,text/plain', multiple: true });
        if (!files.length) return;
        for (const file of files) {
            let json;
            try { json = JSON.parse(await readFileText(file)); }
            catch (e) { this.toast(`「${file.name}」不是有效的 JSON`); continue; }
            const baseName = file.name.replace(/\.(widget\.|yuzuki-theme\.)?json$/i, '').replace(/\.json$/i, '');
            if (json?.type === 'yuzuki_phone_desktop_theme' && json.state) {
                await this._importThemeState(json.state, json.name || baseName);
            } else if (json?.homeScreenLayout) {
                const state = this.convertNuoTheme(json, baseName);
                const tpls = state._widgetTpls || [];
                delete state._widgetTpls;
                await this._askUnmatchedIcons(state);
                void tpls;
                await this._importThemeState(state, baseName);
            } else {
                const tpls = this.parseWidgetTemplates(json);
                if (!tpls.length) { this.toast(`「${file.name}」识别不出是美化还是组件`); continue; }
                for (const tpl of tpls) {
                    for (const k of Object.keys(tpl.images || {})) {
                        const value = String(tpl.images[k] || '');
                        if (/^data:image\//i.test(value)) tpl.images[k] = await saveWidgetMedia(value);
                    }
                }
                const added = tpls.map(t => this.addToLibrary(t));
                if (added.length === 1 || prefer === 'widget') {
                    const it = makeCustomWidget(added[0], added[0].size);
                    this.placeNewWidget(it);
                    this.toast(added.length > 1 ? `已导入 ${added.length} 个组件到组件库` : `已导入组件「${added[0].name}」`);
                    setTimeout(() => this.openCustomEditor(it), 250);
                } else {
                    this.toast(`已导入 ${added.length} 个组件到组件库`);
                }
            }
        }
    },

    async _importThemeState(state, name) {
        const imported = await isolateWidgetMediaInState(clone(state));
        const finalName = (await this.prompt('导入成功，给这个主题起个名字', name)) || name;
        const theme = { id: uid('th'), name: finalName, savedAt: Date.now(), state: { ...imported, themeName: finalName } };
        const idx = Store.themes.findIndex(t => t.name === finalName);
        if (idx >= 0) Store.themes[idx] = theme; else Store.themes.unshift(theme);
        Store.save('themes', 50);
        await this.applyTheme(theme);
        return finalName;
    },

    /** 主题里的组件要不要存进组件库？存到「按大小分到小/中/大」还是「未分类」；来源记为主题名 */
    async _askSaveThemeWidgets(tpls, themeName) {
        if (!tpls?.length) return;
        const cnt = { small: 0, medium: 0, large: 0 };
        tpls.forEach(t => { cnt[sizeCat(t.size)]++; });
        const ok = await this.confirm(`把这个主题的 ${tpls.length} 个组件存进组件库？\n（小组件 ${cnt.small} 个 · 中组件 ${cnt.medium} 个 · 大组件 ${cnt.large} 个，会按它们本身的尺寸出现在「＋ 组件」的小/中/大里，来源标为「${themeName}」）`, '保存');
        if (!ok) return;
        tpls.forEach(t => this.addToLibrary(t, { src: themeName }));
        this.toast(`已存入组件库（来源：${themeName}）`);
    },

    parseWidgetTemplates(json) {
        const arr = Array.isArray(json) ? json : (Array.isArray(json?.widgets) ? json.widgets : [json]);
        const out = [];
        arr.forEach(o => {
            if (!o || typeof o !== 'object') return;
            const d = (o.data && (o.data.html !== undefined || o.data.css !== undefined)) ? { ...o.data, size: o.size || o.data.size } : o;
            if (d.html === undefined && d.css === undefined) return;
            out.push({
                templateId: d.templateId || d.tid || '',
                name: d.name || '自定义组件',
                size: SIZE_DEFS[d.size] ? d.size : 'small',
                html: d.html || '', css: d.css || '',
                imageKeys: Array.isArray(d.imageKeys) ? d.imageKeys : Object.keys(d.images || {}),
                userFields: Array.isArray(d.userFields) ? d.userFields : [],
                images: d.images || {}
            });
        });
        return out;
    },

    /** 糯叽机 主页面 json → 本桌面状态（应用不同：按主题里图标的位置依次摆放我们的应用） */
    convertNuoTheme(json, name) {
        const L = json.homeScreenLayout || {};
        const s = emptyState();
        s.themeName = name;
        s.dock = clone(this.S?.dock || this._legacyDock());
        s.wallpaper = String(json.homeWallpaper || '');
        const hs = json.homeIconStyle || {};
        s.style = {
            ...defaultStyle(),
            // 某些美化文件把圆角记为 0（或未提供），不能强制桌面所有图标变成直角。
            iconShape: 'rounded',
            iconRadius: Number(hs.radius) > 0
                ? clamp(Math.round(Number(hs.radius) / 60 * 100), 1, 50) : 24,
            iconFit: 'cover',
            iconScale: clamp(Number(hs.size) || 100, 60, 130),
            labelColor: json.textColor || '#ffffff',
            showLabels: json.showAppLabels !== false,
            plateColor: hs.surfaceColor || '#ffffff',
            plateAlpha: hs.surfaceAlpha !== undefined ? clamp(Number(hs.surfaceAlpha), 0, 1) : 0
        };
        const pageIdx = [...(L.desktopWidgets || []), ...(L.desktopApps || [])].map(x => Number(x.pageIndex) || 0);
        s.pages = Math.max(1, (L.pages || []).length, ...pageIdx.map(p => p + 1));

        const prev = Store.state;
        Store.state = s;
        try {
            (L.desktopWidgets || []).forEach(w => {
                let item = null;
                const size = SIZE_DEFS[w.size] ? w.size : 'small';
                if (w.data && (w.data.html !== undefined || w.data.css !== undefined)) {
                    item = makeCustomWidget({ ...w.data, images: w.data.images || {} }, size);
                    item.data.images = { ...(w.data.images || {}) };
                    (s._widgetTpls = s._widgetTpls || []).push({ ...w.data, size });
                    s.widgetState[item.id] = clone(json.customWidgetState?.[w.id] || {});
                } else if (NUO_BUILTIN_TYPE_MAP[w.type]) {
                    const t = NUO_BUILTIN_TYPE_MAP[w.type];
                    item = makeWidget(t, size);
                }
                if (!item) return;
                item.page = Math.max(0, Number(w.pageIndex) || 0);
                const { w: iw, h: ih } = sizeOf(item);
                item.x = clamp(Number(w.gridX) || 0, 0, COLS - iw);
                item.y = clamp(Number(w.gridY) || 0, 0, ROWS - ih);
                if (!this._isFree(item.page, item.x, item.y, iw, ih, [item.id])) this._autoPlace(item, item.page);
                s.items.push(item);
            });
            const slots = (L.desktopApps || [])
                .filter(a => Number(a.pageIndex) >= 0 && Number(a.gridX) >= 0 && Number(a.gridY) >= 0)
                .sort((a, b) => (a.pageIndex - b.pageIndex) || (a.gridY - b.gridY) || (a.gridX - b.gridX));
            let si = 0;
            this.apps.filter(a => !s.dock.includes(a.id)).forEach(app => {
                const it = { id: uid('a'), kind: 'app', appId: app.id, page: 0, x: 0, y: 0 };
                let placed = false;
                while (si < slots.length && !placed) {
                    const sl = slots[si++];
                    const p = Number(sl.pageIndex), x = Number(sl.gridX), y = Number(sl.gridY);
                    if (this._isFree(p, x, y, 1, 1)) { Object.assign(it, { page: p, x, y }); placed = true; }
                }
                if (!placed) this._autoPlace(it, 0);
                s.items.push(it);
            });
            this._collectThemeIcons(json, s);
        } finally {
            Store.state = prev;
        }
        return s;
    },
});

/* ======================================================================
 *  主题图标：提取 / 匹配 / 随机 / 图片池 / 逐个分配
 * ==================================================================== */
Object.assign(FreeDesktop.prototype, {
    /** 从美化 json 里收集：图标颜色、带名字的图标图片（按名字/近义词匹配）、所有图片做成「主题图片池」 */
    _collectThemeIcons(json, s, { inlineWallpaper = false } = {}) {
        const L = json.homeScreenLayout || {};
        s.icons = s.icons || {};
        s.themeIcons = {
            enabled: true,
            color: themeGlyphColor(json.iconColor || '#9cc9d9', json.iconColorIntensity ?? 60),
            base: json.iconColor || '',
            intensity: json.iconColorIntensity ?? 60
        };
        const pool = [];
        const seen = new Set();
        const add = (url, label, kind) => {
            if (!isImageUrl(url)) return;
            const u = url.trim();
            if (seen.has(u)) return;
            seen.add(u);
            pool.push({ url: u, label: String(label || '图片'), kind });
        };
        const named = [];
        const pushNamed = (names, url) => {
            if (!isImageUrl(url)) return;
            named.push({ names: names.filter(Boolean), url: url.trim() });
            add(url, names.find(Boolean) || '图标', 'icon');
        };
        Object.entries(json.appCustomizations || {}).forEach(([k, v]) => {
            const url = typeof v === 'string' ? v : (v?.icon || v?.customIcon || v?.iconUrl || v?.iconImage || v?.image || '');
            pushNamed([k, v?.name, v?.label, v?.langKey], url);
        });
        ['appIcons', 'icons', 'customIcons', 'iconPack'].forEach(key => {
            const obj = json[key];
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                Object.entries(obj).forEach(([k, v]) => pushNamed([k, v?.name], typeof v === 'string' ? v : (v?.icon || v?.url || '')));
            }
        });
        const walkApps = (list) => (list || []).forEach(a => {
            if (!a || typeof a !== 'object') return;
            pushNamed([a.id, a.name, a.langKey, a.screenId], a.iconImage || a.iconUrl || a.customIcon || a.icon);
            if (Array.isArray(a.apps)) walkApps(a.apps);
        });
        walkApps(L.desktopApps);
        walkApps(L.dockApps);
        (L.desktopWidgets || []).forEach(w => {
            Object.entries(w.data?.images || {}).forEach(([k, v]) => add(v, `${w.data?.name || '组件'} · ${k}`, 'widget'));
        });
        if (isImageUrl(json.homeWallpaper)) {
            if (inlineWallpaper) add(json.homeWallpaper, '主屏壁纸', 'wallpaper');
            else { pool.push({ url: '@wallpaper', label: '主屏壁纸', kind: 'wallpaper' }); }
        }
        if (isImageUrl(json.lockScreenWallpaper) && String(json.lockScreenWallpaper).length < 600000) add(json.lockScreenWallpaper, '锁屏壁纸', 'wallpaper');
        s.iconPool = pool;

        named.forEach(n => {
            const id = matchAppId(n.names, this.apps, a => this._appName(a));
            if (id && !s.icons[id]) s.icons[id] = n.url;
        });
        s._namedCount = named.length;
        s._unmatched = this.apps.map(a => a.id).filter(id => !s.icons[id]);
        return s;
    },

    /** 从主题图片池删除一张（随机分配时就不会再抽到它）；正在用它当图标的应用换回主题线条图标 */
    removePoolImage(idx) {
        const s = this.S;
        const p = (s.iconPool || [])[idx];
        if (!p) return;
        s.iconPool.splice(idx, 1);
        let changed = 0;
        Object.keys(s.icons || {}).forEach(k => { if (s.icons[k] === p.url) { delete s.icons[k]; changed++; } });
        this.save();
        if (changed) this.refreshAppVisuals();
        this.toast(changed ? `已删除，${changed} 个用它的图标换回了主题图标` : '已从图片池删除');
    },

    _resolvePoolUrl(u, state = this.S) {
        return u === '@wallpaper' ? String(state?.wallpaper || '') : String(u || '');
    },

    async _askUnmatchedIcons(s) {
        const unmatched = s._unmatched || [];
        const namedCount = s._namedCount || 0;
        delete s._unmatched;
        delete s._namedCount;
        if (!unmatched.length) return;
        const photos = (s.iconPool || []).filter(p => p.kind !== 'icon');
        const color = s.themeIcons?.color || '#7fa6b6';
        const glyphRow = unmatched.slice(0, 5).map(id => `<i style="background-image:${esc(cssUrl(glyphDataUrl(id, color, this.getApp(id)?.name)))}"></i>`).join('');
        const matched = this.apps.length - unmatched.length;
        const why = namedCount === 0
            ? '这个美化文件本身<b>不带应用图标图片</b>（糯叽机的图标是内置矢量图形 + 主题色）。'
            : `主题里的 ${namedCount} 个图标已按名字/近义词匹配上 ${matched} 个应用。`;
        const choice = await this._dialog(`<div class="yzd-dlg-title">应用图标跟随主题</div>
            <div class="yzd-tip">${why}还有 ${unmatched.length} 个应用没有对应图标，它们用：</div>
            <div class="yzd-choice" data-v="glyph" style="--yzd-plate:${esc(hexToRgba(normHex(s.style?.plateColor), Math.max(0.35, Number(s.style?.plateAlpha) || 0)))}">
                <div class="yzd-choice-prev">${glyphRow}</div><b>主题风格线条图标（推荐）</b><small>按主题颜色绘制，和原主题同一个风格</small></div>
            <div class="yzd-choice ${photos.length ? '' : 'disabled'}" data-v="random">
                <div class="yzd-choice-prev">${photos.slice(0, 5).map(p => `<i style="background-image:${esc(cssUrl(this._resolvePoolUrl(p.url, s)))}"></i>`).join('')}</div>
                <b>随机用主题里的图片</b><small>${photos.length ? `从组件图片/壁纸里随机挑（共 ${photos.length} 张）` : '这个主题里没有可用的图片'}</small></div>
            <div class="yzd-choice" data-v="original"><b>保留原版图标</b><small>phone 文件夹里的图标</small></div>
            <div class="yzd-tip">之后随时可以在「美化/主题 → 应用图标」里逐个换，主题图片也能在「主题图片池」里下载。</div>`, (dlg, close) => {
            dlg.addEventListener('click', (e) => {
                const c = e.target.closest('.yzd-choice');
                if (c && !c.classList.contains('disabled')) close(c.dataset.v);
            });
        });
        if (choice === 'random') this._randomAssign(s, unmatched);
        else if (choice === 'original') unmatched.forEach(id => { s.icons[id] = '@original'; });
    },

    _randomAssign(s, appIds) {
        const used = new Set(Object.values(s.icons || {}));
        let photos = (s.iconPool || []).map(p => p.url).filter(u => !used.has(u));
        if (!photos.length) photos = (s.iconPool || []).map(p => p.url);
        if (!photos.length) return 0;
        const bag = [];
        appIds.forEach(id => {
            if (!bag.length) bag.push(...photos.slice().sort(() => Math.random() - 0.5));
            s.icons[id] = bag.pop();
        });
        return appIds.length;
    },

    /** 单独给某个应用选图标：上传 / 链接 / 主题线条图标 / 原版 / 主题图片池 */
    openIconChooser(appId, after) {
        const app = this.getApp(appId);
        if (!app) return;
        const s = this.S;
        const color = s.themeIcons?.color || '#7fa6b6';
        const pool = s.iconPool || [];
        const sheet = this.openSheet(`「${this._appName(app)}」的图标`, (body) => {
            body.innerHTML = `
                <div class="yzd-icon-cur">${this._appIconHtml(app)}<small>当前</small></div>
                <div class="yzd-sec">选一个</div>
                <div class="yzd-pool">
                    <div class="yzd-pool-item" data-pick="@upload"><i class="yzd-pool-ic up">＋</i><small>上传图片</small></div>
                    <div class="yzd-pool-item" data-pick="@url"><i class="yzd-pool-ic up">🔗</i><small>图片链接</small></div>
                    <div class="yzd-pool-item" data-pick="@glyph"><i class="yzd-pool-ic plate" style="background-image:${esc(cssUrl(glyphDataUrl(appId, color, app.name)))}"></i><small>主题线条图标</small></div>
                    <div class="yzd-pool-item" data-pick="@original"><i class="yzd-pool-ic" style="background-image:${esc(cssUrl(this.home?._getAppIconImage?.(app) || ''))}"></i><small>原版图标</small></div>
                </div>
                <div class="yzd-sec">主题图片池 <small>${pool.length ? '点图片直接用作图标' : '这个主题没有图片'}</small></div>
                <div class="yzd-pool">${pool.map((p, i) => `<div class="yzd-pool-item" data-pick-pool="${i}"><i class="yzd-pool-ic" style="background-image:${esc(cssUrl(this._resolvePoolUrl(p.url)))}"></i><small>${esc(p.label)}</small></div>`).join('')}</div>`;
            body.addEventListener('click', async (e) => {
                const t = e.target.closest('[data-pick],[data-pick-pool]');
                if (!t) return;
                let val = null;
                if (t.dataset.pickPool !== undefined) val = pool[Number(t.dataset.pickPool)]?.url || null;
                else if (t.dataset.pick === '@upload') {
                    const [file] = await pickFiles({ accept: 'image/*' });
                    if (file) val = await readImageFile(file, 256);
                } else if (t.dataset.pick === '@url') {
                    const u = await this.prompt('图标图片链接', '');
                    if (u && u.trim()) val = u.trim();
                } else val = t.dataset.pick;
                if (!val) return;
                s.icons[appId] = val;
                this.save();
                this.refreshAppVisuals();
                sheet.close();
                after?.();
            });
        }, { tall: true });
    },

    /** 主题图片池里的某张图 → 分配给哪个应用 */
    async assignPoolImage(idx, after) {
        const p = (this.S.iconPool || [])[idx];
        if (!p) return;
        const url = this._resolvePoolUrl(p.url);
        const appId = await this._dialog(`<div class="yzd-dlg-title">这张图要做哪个应用的图标？</div>
            <div class="yzd-pool-big" style="background-image:${esc(cssUrl(url))}"></div>
            <div class="yzd-pool">${this.apps.map(a => `<div class="yzd-pool-item" data-app-pick="${esc(a.id)}">${this._appIconHtml(a)}<small>${esc(this._appName(a))}</small></div>`).join('')}</div>
            <div class="yzd-dlg-btns"><span class="yzd-btn" data-dl="1">⤓ 下载这张图</span><span class="yzd-btn" data-v="0">取消</span></div>`, (dlg, close) => {
            dlg.addEventListener('click', (e) => {
                if (e.target.closest('[data-dl]')) { this.downloadImage(url, p.label); return; }
                const a = e.target.closest('[data-app-pick]');
                if (a) close(a.dataset.appPick);
                else if (e.target.closest('[data-v]')) close(null);
            });
        });
        if (!appId) return;
        this.S.icons[appId] = p.url;
        this.save();
        this.refreshAppVisuals();
        after?.();
    },

    async downloadImage(url, label = 'image') {
        const name = String(label || 'image').replace(/[\\/:*?"<>|·\s]+/g, '_').slice(0, 40) || 'image';
        try {
            let href = url;
            let revoke = false;
            let ext = 'png';
            const m = String(url).match(/^data:image\/([a-z0-9.+-]+)/i);
            if (m) ext = m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
            else {
                const res = await fetch(url, { mode: 'cors' });
                if (!res.ok) throw new Error(String(res.status));
                const blob = await res.blob();
                ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
                href = URL.createObjectURL(blob);
                revoke = true;
            }
            const a = document.createElement('a');
            a.href = href;
            a.download = `${name}.${ext}`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { a.remove(); if (revoke) URL.revokeObjectURL(href); }, 1500);
            this.toast('已下载（看浏览器下载）');
        } catch (e) {
            // 图床不允许跨域下载时，新窗口打开让用户长按保存
            window.open(url, '_blank');
            this.toast('已在新窗口打开图片，长按/右键保存');
        }
    },

    /** 不改布局，只从美化文件里拿图标（给之前已经导入过、图标没跟上的主题用） */
    async extractIconsFromFile() {
        const [file] = await pickFiles({ accept: '.json,application/json,text/plain' });
        if (!file) return;
        let json;
        try { json = JSON.parse(await readFileText(file)); } catch (e) { this.toast('不是有效的 JSON'); return; }
        const s = this.S;
        if (json?.type === 'yuzuki_phone_desktop_theme' && json.state) {
            const st = json.state;
            s.themeIcons = st.themeIcons || s.themeIcons;
            s.iconPool = (st.iconPool || []).map(p => p.url === '@wallpaper' ? { ...p, url: st.wallpaper } : p).filter(p => isImageUrl(p.url));
            s.icons = { ...(st.icons || {}) };
        } else if (json?.homeScreenLayout) {
            const tmp = { icons: {}, style: s.style, wallpaper: s.wallpaper };
            this._collectThemeIcons(json, tmp, { inlineWallpaper: true });
            await this._askUnmatchedIcons(tmp);
            s.themeIcons = tmp.themeIcons;
            s.iconPool = tmp.iconPool;
            s.icons = tmp.icons;
            if (!(Number(s.style.plateAlpha) > 0)) {
                const hs = json.homeIconStyle || {};
                s.style.plateAlpha = hs.surfaceAlpha !== undefined ? clamp(Number(hs.surfaceAlpha), 0, 1) : 0.45;
                s.style.plateColor = hs.surfaceColor || s.style.plateColor;
                this.applyStyleVars();
            }
        } else { this.toast('这个文件里没有主题信息'); return; }
        this.save();
        this.refreshAppVisuals();
        this.toast('图标已更新');
    },
});

/* ======================================================================
 *  样式
 * ==================================================================== */
const DESKTOP_CSS = `
.yzd-root{position:absolute;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
 font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;z-index:1;
 --yzd-top:calc(env(safe-area-inset-top,0px) + 42px);--yzd-dock-h:88px;--yzd-bottom-gap:max(12px,env(safe-area-inset-bottom,0px));--yzd-bar-h:32px;--yzd-icon:58px;--yzd-ioff:calc((var(--yzd-icon) + 19px)/2)}
.yzd-root *{box-sizing:border-box}
.yzd-root .yzd-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;text-shadow:0 1px 4px #0008;background:#999}
.yzd-root .yzd-wall{position:absolute;inset:0;background:#d9d9e3 center/cover no-repeat;z-index:0}
.yzd-root .yzd-viewport{position:absolute;left:0;right:0;top:var(--yzd-top);bottom:calc(var(--yzd-bottom-gap) + var(--yzd-dock-h) + var(--yzd-bar-h) + 6px);overflow:hidden;z-index:1}
.yzd-root .yzd-track{display:flex;height:100%;will-change:transform}
.yzd-root .yzd-page{flex:0 0 100%;width:100%;height:100%;padding:4px var(--yzd-padx,14px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr));position:relative}
.yzd-root .yzd-item{position:relative;min-width:0;min-height:0}
.yzd-root .yzd-app-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.yzd-root .yzd-icon{width:var(--yzd-icon);height:var(--yzd-icon);border-radius:var(--yzd-radius,24%);overflow:hidden;isolation:isolate;background-color:var(--yzd-plate,transparent);background-size:var(--yzd-icon-fit,cover);background-position:center;background-repeat:no-repeat;flex:0 0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:transform .15s}
.yzd-root.yzd-icon-original .yzd-icon{background-color:transparent!important;box-shadow:none;background-size:contain}
.yzd-root .yzd-item .yzd-icon,.yzd-root .yzd-dock-app .yzd-icon{backdrop-filter:blur(var(--yzd-plate-blur,0px));-webkit-backdrop-filter:blur(var(--yzd-plate-blur,0px))}
.yzd-root .yzd-pool{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.yzd-root .yzd-pool-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;min-width:0;--yzd-icon:54px}
.yzd-root .yzd-pool-item small{font-size:10.5px;color:#555;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yzd-root .yzd-pool-ic{display:flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:var(--yzd-radius,24%);overflow:hidden;background:#e3e3ea center/var(--yzd-icon-fit,cover) no-repeat;font-style:normal;font-size:20px;color:#666;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.yzd-root.yzd-icon-original .yzd-pool-ic{background-color:transparent;box-shadow:none}
.yzd-root .yzd-pool-ic.plate{background-color:rgba(255,255,255,.9)}
.yzd-root .yzd-pool-ic.up{background:#fff;border:1.5px dashed #c5c5cc;box-shadow:none}
.yzd-root .yzd-pool-dl{position:absolute;top:-4px;right:4px;width:22px;height:22px;border-radius:50%;background:#fff;color:#1677ff;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.yzd-root .yzd-pool-del{position:absolute;top:-4px;left:4px;width:22px;height:22px;border-radius:50%;background:rgba(90,90,98,.88);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.yzd-root .yzd-pool-big{width:120px;height:120px;margin:0 auto 12px;border-radius:22px;background:#eee center/cover no-repeat}
.yzd-root .yzd-icon-cur{display:flex;flex-direction:column;align-items:center;gap:4px;--yzd-icon:68px;padding:6px 0;--yzd-plate:rgba(255,255,255,.85)}
.yzd-root .yzd-icon-cur small{font-size:11px;color:#888}
.yzd-root .yzd-happ .yzd-icon,.yzd-root .yzd-pool-item .yzd-icon{--yzd-plate:rgba(255,255,255,.85);background-color:var(--yzd-plate)}
.yzd-root .yzd-choice{display:block;background:#fff;border-radius:14px;padding:10px 12px;margin:8px 0;cursor:pointer;border:1.5px solid transparent}
.yzd-root .yzd-choice:active{border-color:#1677ff}
.yzd-root .yzd-choice.disabled{opacity:.45;pointer-events:none}
.yzd-root .yzd-choice b{display:block;font-size:14px}
.yzd-root .yzd-choice small{display:block;font-size:11.5px;color:#888;margin-top:2px}
.yzd-root .yzd-choice-prev{display:flex;gap:6px;margin-bottom:6px}
.yzd-root .yzd-choice-prev:empty{display:none}
.yzd-root .yzd-choice-prev i{width:34px;height:34px;border-radius:var(--yzd-radius,24%);background:var(--yzd-plate,#f0f0f5) center/var(--yzd-icon-fit,cover) no-repeat;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.yzd-root .yzd-icon-emoji{display:flex;align-items:center;justify-content:center;font-size:calc(var(--yzd-icon)*.46);color:#fff}
.yzd-root .yzd-label{max-width:100%;font-size:11.5px;line-height:14px;height:14px;color:var(--yzd-label,#2b2b33)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;padding:0 2px;text-shadow:0 1px 3px rgba(0,0,0,.16)}
.yzd-root.yzd-no-labels{--yzd-ioff:calc(var(--yzd-icon)/2)}
.yzd-root.yzd-no-labels .yzd-label{display:none}
.yzd-root .yzd-badge{position:absolute;top:calc(50% - var(--yzd-ioff) - 6px);left:calc(50% + var(--yzd-icon)/2 - 13px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff3b30;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none}
.yzd-root .yzd-widget .yzd-wbox{position:absolute;inset:5px;overflow:hidden;color:var(--yzd-wtext,#2b2b33);container-type:size}
.yzd-root .yzd-wbox-builtin{box-shadow:none}
.yzd-root .yzd-wbox-custom{background:transparent;inset:3px!important}
.yzd-root .yzd-frame{width:100%;height:100%;border:0;display:block;background:transparent;color-scheme:light}
.yzd-root .yzd-shield{position:absolute;inset:0;z-index:4;display:none}
.yzd-root.yzd-editing .yzd-shield{display:block}
.yzd-root .yzd-del{display:none;position:absolute;top:0;left:0;width:22px;height:22px;border-radius:50%;background:rgba(110,110,118,.9);color:#fff;font:700 18px/21px sans-serif;text-align:center;z-index:6;box-shadow:0 1px 4px #0004;cursor:pointer}
.yzd-root .yzd-app .yzd-del,.yzd-root .yzd-dock-app .yzd-del{top:calc(50% - var(--yzd-ioff) - 7px);left:calc(50% - var(--yzd-icon)/2 - 7px)}
.yzd-root .yzd-dock-app{--yzd-ioff:calc(var(--yzd-icon)/2)}
.yzd-root.yzd-editing .yzd-del{display:block}
@keyframes yzd-jig{0%{rotate:-1.6deg}50%{rotate:1.6deg}100%{rotate:-1.6deg}}
@keyframes yzd-jig2{0%{rotate:-.5deg}50%{rotate:.5deg}100%{rotate:-.5deg}}
@keyframes yzd-pop{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
@keyframes yzd-up{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
@keyframes yzd-fade{from{opacity:0}}
@keyframes yzd-spin{to{transform:rotate(360deg)}}
.yzd-root.yzd-editing .yzd-app .yzd-app-body,.yzd-root.yzd-editing .yzd-dock-app .yzd-app-body{animation:yzd-jig .27s ease-in-out infinite}
.yzd-root.yzd-editing .yzd-item:nth-child(2n) .yzd-app-body{animation-delay:-.13s}
.yzd-root.yzd-editing .yzd-widget{animation:yzd-jig2 .34s ease-in-out infinite}
.yzd-root .yzd-lifted{z-index:30;animation:none!important;opacity:.93}
.yzd-root .yzd-lifted .yzd-wbox{box-shadow:0 14px 34px rgba(0,0,0,.28)}
.yzd-root .yzd-origin-hidden{visibility:hidden}
.yzd-root .yzd-floating{position:absolute!important;z-index:60;pointer-events:none;animation:none!important}
.yzd-root .yzd-floating .yzd-app-body{animation:none!important}
.yzd-root .yzd-floating .yzd-del,.yzd-root .yzd-floating .yzd-badge{display:none!important}
.yzd-root .yzd-placeholder{border-radius:20px;margin:4px;border:2px dashed rgba(255,255,255,.9);background:rgba(255,255,255,.2);pointer-events:none}
.yzd-root .yzd-placeholder.swap{border-color:#7ecbff;background:rgba(126,203,255,.18)}
.yzd-root .yzd-placeholder.bad{border-color:rgba(255,80,80,.95);background:rgba(255,80,80,.16)}
.yzd-root .yzd-focus .yzd-icon,.yzd-root .yzd-focus .yzd-wbox{transform:scale(1.05)}
.yzd-root .yzd-bar{position:absolute;left:0;right:0;bottom:calc(var(--yzd-bottom-gap) + var(--yzd-dock-h) + 4px);height:var(--yzd-bar-h);display:flex;align-items:center;justify-content:center;z-index:3}
.yzd-root .yzd-dots{display:flex;gap:7px;padding:5px 9px;border-radius:12px;background:rgba(0,0,0,.14);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.yzd-root .yzd-dots:empty{display:none}
.yzd-root .yzd-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.5);box-shadow:0 0 2px rgba(0,0,0,.3);cursor:pointer}
.yzd-root .yzd-dots i.on{background:#fff}
.yzd-root .yzd-edit-tools{display:none;gap:8px}
.yzd-root.yzd-editing .yzd-edit-tools{display:flex}
.yzd-root.yzd-editing .yzd-dots{display:none}
.yzd-root .yzd-tool{padding:6px 13px;border-radius:16px;background:rgba(255,255,255,.9);color:#222;font-size:13px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.16);cursor:pointer;white-space:nowrap}
.yzd-root .yzd-tool-done{background:#1677ff;color:#fff}
.yzd-root .yzd-dock{position:absolute;left:12px;right:12px;bottom:var(--yzd-bottom-gap);height:var(--yzd-dock-h);border-radius:30px;background:var(--yzd-dock-bg,rgba(255,255,255,.32));backdrop-filter:blur(var(--yzd-dock-blur,18px)) saturate(150%);-webkit-backdrop-filter:blur(var(--yzd-dock-blur,18px)) saturate(150%);display:flex;align-items:center;justify-content:space-evenly;z-index:3;transition:box-shadow .2s}
.yzd-root .yzd-dock.is-empty{min-width:120px}
.yzd-root .yzd-dock.yzd-dock-hot{box-shadow:inset 0 0 0 2px rgba(255,255,255,.85)}
.yzd-root .yzd-dock-app{position:relative;width:calc(var(--yzd-icon) + 14px);height:100%}
.yzd-root .yzd-layer{position:absolute;inset:0;z-index:20;pointer-events:none}
.yzd-root .yzd-layer>*{pointer-events:auto}
.yzd-root .yzd-dim{position:absolute;inset:0;background:rgba(0,0,0,.14)}
.yzd-root .yzd-menu{position:absolute;width:200px;border-radius:14px;background:rgba(248,248,250,.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 10px 40px rgba(0,0,0,.28);overflow:hidden;animation:yzd-pop .18s ease-out;color:#1c1c1e}
.yzd-root .yzd-menu-item{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;font-size:15px;border-bottom:.5px solid rgba(0,0,0,.09);cursor:pointer}
.yzd-root .yzd-menu-item:last-child{border-bottom:0}
.yzd-root .yzd-menu-item:active{background:rgba(0,0,0,.06)}
.yzd-root .yzd-menu-item i{font-style:normal;opacity:.75}
.yzd-root .yzd-menu-item.danger{color:#ff3b30}
.yzd-root .yzd-toast{position:absolute;left:50%;top:calc(var(--yzd-top) + 6px);transform:translateX(-50%);background:rgba(30,30,34,.88);color:#fff;padding:8px 14px;border-radius:18px;font-size:13px;max-width:82%;text-align:center;pointer-events:none!important;transition:opacity .3s;z-index:9}
.yzd-root .yzd-toast.out{opacity:0}
.yzd-root .yzd-mask{position:absolute;inset:0;background:rgba(0,0,0,.32);display:flex;align-items:flex-end;justify-content:center;animation:yzd-fade .2s;touch-action:auto;z-index:10;user-select:text;-webkit-user-select:text;transition:opacity .2s}
.yzd-root .yzd-mask.out{opacity:0}
.yzd-root .yzd-mask-center{align-items:center;padding:20px;z-index:50}
.yzd-root .yzd-sheet{width:100%;max-width:560px;max-height:74%;background:#f4f4f7;color:#1c1c1e;border-radius:22px 22px 0 0;display:flex;flex-direction:column;animation:yzd-up .25s cubic-bezier(.2,.85,.25,1);padding-bottom:env(safe-area-inset-bottom,0px)}
.yzd-root .yzd-sheet.tall{max-height:90%}
.yzd-root .yzd-sheet-grab{width:38px;height:5px;border-radius:3px;background:#c7c7cc;margin:8px auto 2px;flex:0 0 auto}
.yzd-root .yzd-sheet-head{display:flex;align-items:center;gap:8px;padding:6px 16px 10px;flex:0 0 auto}
.yzd-root .yzd-sheet-head b{font-size:17px;flex:1}
.yzd-root .yzd-sheet-extra{display:flex;gap:8px}
.yzd-root .yzd-hbtn{width:30px;height:30px;border-radius:50%;background:#e5e5ea;display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;color:#222}
.yzd-root .yzd-x{width:28px;height:28px;border-radius:50%;background:#e5e5ea;display:inline-flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;color:#555;flex:0 0 auto}
.yzd-root .yzd-x.sm{width:22px;height:22px;font-size:11px}
.yzd-root .yzd-sheet-body{overflow-y:auto;overscroll-behavior:contain;padding:0 16px 20px;-webkit-overflow-scrolling:touch;touch-action:pan-y;flex:1 1 auto;min-height:0}
.yzd-root .yzd-sec{font-size:13px;font-weight:700;color:#6b6b73;margin:16px 2px 8px}
.yzd-root .yzd-sec small{font-weight:400;margin-left:6px;color:#9a9aa0}
.yzd-root .yzd-tip{font-size:12px;color:#8e8e93;margin:6px 2px;line-height:1.55}
.yzd-root .yzd-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:12px;background:#e5e5ea;color:#1c1c1e;font-size:14px;cursor:pointer;user-select:none;-webkit-user-select:none}
.yzd-root .yzd-btn.primary{background:#1677ff;color:#fff}
.yzd-root .yzd-btn.sm{padding:5px 10px;font-size:12.5px;border-radius:9px}
.yzd-root .yzd-btnrow{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.yzd-root .yzd-image-adjust{display:grid;gap:8px;margin:10px 1px 14px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.75)}
.yzd-root .yzd-image-adjust label{display:grid;grid-template-columns:68px minmax(0,1fr) 40px;align-items:center;gap:7px;font-size:12px;color:#555;min-width:0}
.yzd-root .yzd-image-adjust input[type=range]{width:100%;min-width:0;accent-color:#729cbd;margin:0}
.yzd-root .yzd-image-adjust output{text-align:right;font-variant-numeric:tabular-nums;color:#656569}
.yzd-root .yzd-dlg-btns{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
.yzd-root .yzd-dlg-btns.wrap{flex-wrap:wrap}
.yzd-root .yzd-dialog{width:100%;max-width:340px;max-height:80%;overflow:auto;background:#f7f7fa;color:#1c1c1e;border-radius:18px;padding:18px;box-shadow:0 16px 50px rgba(0,0,0,.3);animation:yzd-pop .18s}
.yzd-root .yzd-dlg-title{font-size:16px;font-weight:600;margin-bottom:10px;line-height:1.45}
.yzd-root .yzd-input{display:block;width:100%!important;max-width:100%!important;border:1px solid #d9d9df!important;border-radius:10px!important;background:#fff!important;color:#1c1c1e!important;padding:9px 10px!important;font-size:14px!important;margin:0!important;outline:none!important;user-select:text;-webkit-user-select:text;height:auto!important;min-height:0!important;box-shadow:none!important;font-family:inherit}
.yzd-root textarea.yzd-input{resize:vertical;line-height:1.5}
.yzd-root textarea.yzd-input.mono{font-family:ui-monospace,Menlo,Consolas,monospace!important;font-size:12px!important;white-space:pre;overflow:auto}
.yzd-root .yzd-field{margin:10px 0;position:relative}
.yzd-root .yzd-flabel{display:block;font-size:12.5px;color:#6b6b73;margin-bottom:5px}
.yzd-root .yzd-color{display:flex;gap:8px;align-items:center}
.yzd-root .yzd-color input[type=color]{width:42px;height:36px;border:0;padding:0;background:none;flex:0 0 auto;border-radius:8px}
.yzd-root .yzd-range{display:flex;gap:10px;align-items:center}
.yzd-root .yzd-range input{flex:1;accent-color:#1677ff}
.yzd-root .yzd-range span{width:42px;text-align:right;font-size:12px;color:#666}
.yzd-root .yzd-imgrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.yzd-root .yzd-thumb{width:52px;height:52px;border-radius:10px;background:#e9e9ee center/cover no-repeat;border:1px solid #ddd;flex:0 0 auto}
.yzd-root .yzd-thumb.tall{height:92px}
.yzd-root .yzd-thumb.empty{background-image:none!important}
.yzd-root .yzd-imgkey{position:relative;padding-right:30px}
.yzd-root .yzd-imgkey>.yzd-x{position:absolute;right:0;top:4px}
.yzd-root .yzd-addrow{display:flex;gap:8px;align-items:center;margin:8px 0}
.yzd-root .yzd-addrow.wrap{flex-wrap:wrap}
.yzd-root .yzd-addrow .yzd-input{flex:1;min-width:100px;width:auto!important}
.yzd-root .yzd-code{margin:10px 0;background:#fff;border-radius:12px;padding:8px 10px;border:1px solid #e3e3e8}
.yzd-root .yzd-code summary{font-size:13px;font-weight:600;color:#444;cursor:pointer;padding:4px 0}
.yzd-root .yzd-code .yzd-input{margin-top:8px!important}
.yzd-root .yzd-fdef{display:flex;gap:6px;align-items:center;font-size:12.5px;padding:5px 0;border-bottom:1px solid #f0f0f3}
.yzd-root .yzd-fdef code{background:#f0f0f5;padding:1px 5px;border-radius:5px}
.yzd-root .yzd-fdef .yzd-x{margin-left:auto}
.yzd-root .yzd-chips{display:flex;flex-wrap:wrap;gap:8px}
.yzd-root .yzd-chip{padding:7px 12px;border-radius:14px;background:#e5e5ea;font-size:13px;cursor:pointer;color:#222}
.yzd-root .yzd-chip.on{background:#1677ff;color:#fff}
.yzd-root .yzd-chips.sm{gap:5px}
.yzd-root .yzd-chips.sm .yzd-chip{padding:3px 8px;font-size:11px;border-radius:9px}
.yzd-root .yzd-gal{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.yzd-root .yzd-gcard{position:relative;background:#fff;border-radius:16px;padding:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);cursor:pointer;min-width:0}
.yzd-root .yzd-gcard.span-2{grid-column:span 2}
.yzd-root .yzd-gname{font-size:12.5px;font-weight:600;margin:8px 2px 6px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yzd-root .yzd-gname small{color:#999;font-weight:400}
.yzd-root .yzd-gdel{position:absolute;top:6px;right:6px;z-index:5;font-size:14px!important;font-weight:700}
.yzd-root .yzd-gsrc{font-size:10.5px;color:#9a9aa0;margin:-3px 2px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yzd-root .yzd-gal-filters{position:sticky;top:0;z-index:6;background:#f4f4f7;padding:2px 0 8px;margin:0 -2px}
.yzd-root .yzd-tabs{display:flex;background:#e5e5ea;border-radius:11px;padding:3px;gap:2px}
.yzd-root .yzd-tab{flex:1;text-align:center;padding:7px 0;font-size:13px;border-radius:9px;color:#444;cursor:pointer;white-space:nowrap}
.yzd-root .yzd-tab.on{background:#fff;color:#111;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.yzd-root .yzd-srcs-row{display:flex;align-items:center;gap:6px;padding-top:8px}
.yzd-root .yzd-srcs-label{flex:0 0 auto;font-size:12px;color:#8e8e93}
.yzd-root .yzd-srcs{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none;touch-action:pan-x}
.yzd-root .yzd-srcs::-webkit-scrollbar{display:none}
.yzd-root .yzd-srcs .yzd-chip{flex:0 0 auto;white-space:nowrap}
.yzd-root .yzd-chip.danger{background:#ffe9e8;color:#ff3b30}
.yzd-root .yzd-empty-tip{text-align:center;padding:24px 10px}
.yzd-root .yzd-prev.lazy::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);background-size:200% 100%;animation:yzd-shimmer 1.2s linear infinite}
@keyframes yzd-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.yzd-root .yzd-prev{position:relative;width:100%;overflow:hidden;pointer-events:none;border-radius:12px;background:linear-gradient(135deg,#c9d6ff 0%,#f3d9e8 55%,#e6e9f0 100%);min-height:40px}
.yzd-root .yzd-prev-inner{position:absolute!important;left:0;top:0;transform-origin:0 0;animation:none!important}
.yzd-root .yzd-edit-prev{max-width:340px;margin:4px auto 6px}
.yzd-root .yzd-hidden-apps,.yzd-root .yzd-iconlist{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.yzd-root .yzd-happ{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;--yzd-icon:46px;min-width:0}
.yzd-root .yzd-happ small{font-size:11px;color:#444;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yzd-root .yzd-dot-mark{position:absolute;top:-2px;right:6px;width:9px;height:9px;border-radius:50%;background:#1677ff;border:2px solid #f4f4f7}
.yzd-root .yzd-themes{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.yzd-root .yzd-theme{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:8px}
.yzd-root .yzd-theme.on{box-shadow:inset 0 0 0 2px #1677ff}
.yzd-root .yzd-theme-thumb{width:34px;height:60px;border-radius:7px;background:#ddd center/cover no-repeat;flex:0 0 auto}
.yzd-root .yzd-theme-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.yzd-root .yzd-theme-info b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yzd-root .yzd-theme-info small{font-size:11px;color:#999}
.yzd-root .yzd-assign{display:flex;align-items:center;gap:8px;margin:8px 0}
.yzd-root .yzd-assign small{flex:0 0 72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#777}
.yzd-root .yzd-assign select{flex:1;width:auto!important}

/* ---- 内置组件 ---- */
.yzd-root .yzd-ck{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6%;text-align:center}
.yzd-root .yzd-ck-time{font-weight:300;letter-spacing:-.02em;line-height:1;font-size:min(30cqh,26cqw);font-variant-numeric:tabular-nums;white-space:nowrap}
.yzd-root .yzd-ck-date{font-size:min(11cqh,7cqw);opacity:.82;margin-top:5%;white-space:nowrap}
.yzd-root .yzd-ck-ap{font-size:.34em;margin-left:.12em;font-weight:500;letter-spacing:0}
.yzd-root .yzd-ck-medium{flex-direction:row;gap:7%}
.yzd-root .yzd-ck-medium .yzd-ck-time{font-size:min(50cqh,24cqw)}
.yzd-root .yzd-ck-medium .yzd-ck-date{margin-top:0;font-size:min(11cqh,4.6cqw);white-space:normal;text-align:left;max-width:30%}
.yzd-root .yzd-ck-large .yzd-ck-time{font-size:min(26cqh,30cqw)}
.yzd-root .yzd-ck-large .yzd-ck-date{font-size:min(7cqh,6cqw)}
.yzd-root .yzd-ck-size_2x1,.yzd-root .yzd-ck-size_4x1{flex-direction:row;gap:6%}
.yzd-root .yzd-ck-size_2x1 .yzd-ck-time{font-size:min(56cqh,24cqw)}
.yzd-root .yzd-ck-size_4x1 .yzd-ck-time{font-size:min(60cqh,16cqw)}
.yzd-root .yzd-ck-size_2x1 .yzd-ck-date{display:none}
.yzd-root .yzd-ck-size_4x1 .yzd-ck-date{margin-top:0;font-size:min(20cqh,4.5cqw)}
.yzd-root .yzd-analog{width:100%;height:100%;padding:9%;display:block;color:var(--yzd-wtext)}
.yzd-root .yzd-an-ticks line{stroke:currentColor;stroke-width:1.8;opacity:.5;stroke-linecap:round}
.yzd-root .yzd-an-h{stroke:currentColor;stroke-width:4.2;stroke-linecap:round}
.yzd-root .yzd-an-m{stroke:currentColor;stroke-width:2.8;stroke-linecap:round}
.yzd-root .yzd-an-s{stroke-width:1.3;stroke-linecap:round}
.yzd-root .yzd-cal{height:100%;display:flex;flex-direction:column;justify-content:center;padding:9% 11%}
.yzd-root .yzd-cal-wd{font-size:min(10cqh,9cqw);font-weight:700}
.yzd-root .yzd-cal-day{font-size:min(44cqh,42cqw);font-weight:300;line-height:1.05}
.yzd-root .yzd-cal-mon{font-size:min(9cqh,8cqw);opacity:.7}
.yzd-root .yzd-cal-anc{font-size:min(12cqh,10cqw);margin-top:6%;line-height:1.4}
.yzd-root .yzd-cal-m{flex-direction:row;align-items:center;gap:5%;padding:6%}
.yzd-root .yzd-cal-left{flex:0 0 30%}
.yzd-root .yzd-cal-m .yzd-cal-day{font-size:min(40cqh,14cqw)}
.yzd-root .yzd-cal-m .yzd-cal-wd,.yzd-root .yzd-cal-m .yzd-cal-mon{font-size:min(9cqh,3.6cqw)}
.yzd-root .yzd-cal-grid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:1px;font-size:min(6.5cqh,2.9cqw);text-align:center;align-items:center}
.yzd-root .yzd-cal-grid b{opacity:.5;font-weight:600}
.yzd-root .yzd-cal-grid i{font-style:normal;border-radius:50%;line-height:1.75}
.yzd-root .yzd-cal-grid i.on{color:#fff;font-weight:700}
.yzd-root .yzd-photo{position:absolute;inset:0;background-position:center;background-repeat:no-repeat}
.yzd-root .yzd-ph-cap{position:absolute;left:0;right:0;bottom:0;padding:8% 8% 6%;font-size:min(9cqh,6cqw);color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.45))}
.yzd-root .yzd-ph-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px dashed rgba(127,127,127,.55);border-radius:inherit;font-size:22px;text-align:center;background:rgba(255,255,255,.25)}
.yzd-root .yzd-ph-empty small{font-size:11px;opacity:.75;line-height:1.4}
.yzd-root .yzd-mu{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6%;padding:7%}
.yzd-root .yzd-mu-disc{width:min(62cqh,72cqw);aspect-ratio:1;border-radius:50%;background:repeating-radial-gradient(circle,#141414 0 2px,#262626 2px 4px);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.3);flex:0 0 auto}
.yzd-root .yzd-mu-disc.spin{animation:yzd-spin 9s linear infinite}
.yzd-root .yzd-mu-cover{width:44%;aspect-ratio:1;border-radius:50%;background:#fff center/cover no-repeat;border:2px solid rgba(255,255,255,.65)}
.yzd-root .yzd-mu-side{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.yzd-root .yzd-mu-title{font-size:min(10cqh,8cqw);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.yzd-root .yzd-mu-ctrl{display:flex;gap:16px;font-size:min(9cqh,7cqw);opacity:.75}
.yzd-root .yzd-mu-small .yzd-mu-ctrl{display:none}
.yzd-root .yzd-mu-medium{flex-direction:row;gap:9%}
.yzd-root .yzd-mu-medium .yzd-mu-disc{width:min(80cqh,40cqw)}
.yzd-root .yzd-mu-medium .yzd-mu-title{font-size:min(14cqh,6cqw)}
.yzd-root .yzd-mu-medium .yzd-mu-ctrl{font-size:min(13cqh,5cqw)}
.yzd-root .yzd-cd{height:100%;display:flex;flex-direction:column;justify-content:center;padding:9% 10%;gap:4%}
.yzd-root .yzd-cd-title{font-size:min(11cqh,8cqw);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yzd-root .yzd-cd-row{display:flex;align-items:baseline;gap:4px}
.yzd-root .yzd-cd-row small{font-size:min(9cqh,7cqw);opacity:.75}
.yzd-root .yzd-cd-num{font-size:min(36cqh,26cqw);font-weight:700;line-height:1}
.yzd-root .yzd-cd-date{font-size:min(8cqh,6cqw);opacity:.6}
.yzd-root .yzd-cd-medium .yzd-cd-num{font-size:min(44cqh,16cqw)}
.yzd-root .yzd-cd-medium .yzd-cd-title,.yzd-root .yzd-cd-medium .yzd-cd-row small{font-size:min(12cqh,5cqw)}
.yzd-root .yzd-cd-size_2x1{flex-direction:row;align-items:center;justify-content:space-between;padding:0 9%}
.yzd-root .yzd-cd-size_2x1 .yzd-cd-num{font-size:min(50cqh,18cqw)}
.yzd-root .yzd-cd-size_2x1 .yzd-cd-date{display:none}
.yzd-root .yzd-note{height:100%;padding:9%;white-space:pre-wrap;overflow:hidden;line-height:1.45;word-break:break-word}
`;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.getElementById('yzd-desktop-style-v1')?.remove();
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = DESKTOP_CSS + WIDGETS_CSS;
    document.head.appendChild(st);
}
