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

const STYLE_ID = 'yzd-desktop-style-v1';
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

const BG_OPTIONS = [['glass', '毛玻璃'], ['clear', '透明'], ['solid', '纯色'], ['image', '图片']];
const COMMON_FIELDS = [
    { key: 'bg', label: '背景样式', type: 'select', options: BG_OPTIONS },
    { key: 'bgColor', label: '背景颜色', type: 'color' },
    { key: 'bgAlpha', label: '背景不透明度', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'bgImage', label: '背景图片（背景样式选「图片」时生效）', type: 'image' },
    { key: 'textColor', label: '文字颜色', type: 'color' },
    { key: 'radius', label: '圆角', type: 'range', min: 0, max: 44, step: 1 }
];
const COMMON_DEFAULTS = { bg: 'glass', bgColor: '#ffffff', bgAlpha: 0.38, bgImage: '', textColor: '#2b2b33', radius: 24 };

const BUILTINS = {
    clock: {
        name: '时钟', sizes: ['medium', 'small', 'size_2x1', 'size_4x1', 'large'], defaultSize: 'medium',
        defaults: { h24: '24', lang: 'zh' },
        fields: [
            { key: 'h24', label: '时间格式', type: 'select', options: [['24', '24 小时制'], ['12', '12 小时制']] },
            { key: 'lang', label: '日期语言', type: 'select', options: [['zh', '中文'], ['en', 'English']] }
        ],
        timeBased: true
    },
    analog: {
        name: '圆形时钟', sizes: ['small', 'size_1x1'], defaultSize: 'small',
        defaults: { accent: '#ff6b81' },
        fields: [{ key: 'accent', label: '秒针/强调色', type: 'color' }],
        timeBased: true
    },
    calendar: {
        name: '日历', sizes: ['small', 'medium'], defaultSize: 'small', app: 'calendar',
        defaults: { accent: '#ff5a5f' },
        fields: [{ key: 'accent', label: '强调色', type: 'color' }],
        timeBased: true
    },
    photo: {
        name: '图片', sizes: ['small', 'medium', 'large', 'size_2x1', 'size_4x1', 'size_1x2', 'size_1x1'], defaultSize: 'small',
        defaults: { image: '', fit: 'cover', bg: 'clear', caption: '' },
        fields: [
            { key: 'image', label: '图片', type: 'image', maxDim: 1200 },
            { key: 'fit', label: '填充方式', type: 'select', options: [['cover', '铺满裁切'], ['contain', '完整显示']] },
            { key: 'caption', label: '图片文字（可空）', type: 'text' }
        ]
    },
    music: {
        name: '音乐唱片', sizes: ['small', 'medium'], defaultSize: 'small', app: 'music',
        defaults: { title: '', cover: '', spin: 'on' },
        fields: [
            { key: 'title', label: '标题（空=应用名）', type: 'text' },
            { key: 'cover', label: '唱片封面（空=音乐图标）', type: 'image', maxDim: 600 },
            { key: 'spin', label: '唱片转动', type: 'select', options: [['on', '转'], ['off', '不转']] }
        ]
    },
    countdown: {
        name: '纪念日 / 倒数日', sizes: ['small', 'medium', 'size_2x1'], defaultSize: 'small',
        defaults: { title: '在一起', date: '', accent: '#ff7aa2' },
        fields: [
            { key: 'title', label: '标题', type: 'text' },
            { key: 'date', label: '日期（过去=已经N天，未来=还有N天）', type: 'date' },
            { key: 'accent', label: '数字颜色', type: 'color' }
        ],
        timeBased: true
    },
    note: {
        name: '便签', sizes: ['small', 'medium', 'size_2x1', 'size_4x1', 'large', 'size_1x2'], defaultSize: 'small',
        defaults: { text: '写点什么…', fontSize: 15, align: 'left' },
        fields: [
            { key: 'text', label: '内容', type: 'textarea' },
            { key: 'fontSize', label: '字号', type: 'range', min: 10, max: 40, step: 1 },
            { key: 'align', label: '对齐', type: 'select', options: [['left', '左'], ['center', '中'], ['right', '右']] }
        ]
    }
};

const NUO_BUILTIN_TYPE_MAP = { clock: 'clock', calendar: 'calendar', photo: 'photo', image: 'photo', note: 'note', countdown: 'countdown', music: 'music' };

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
            const [state, themes, library] = await Promise.all([idbGet('state'), idbGet('themes'), idbGet('library')]);
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
    const stateJson = JSON.stringify(state || {}).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}</style>
<script>${BRIDGE_JS.replace('__STATE__', stateJson)}<\/script>
<style>${css}</style></head><body>${html}</body></html>`;
}

/* ------------------------------ 默认数据 ------------------------------ */
function defaultStyle() {
    return {
        iconRadius: 24,      // 0-50（百分比）
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
        size: size || def?.defaultSize || 'small',
        page: 0, x: 0, y: 0,
        data: { ...COMMON_DEFAULTS, ...(def?.defaults || {}), ...(wtype === 'photo' ? { bg: 'clear' } : {}), ...data }
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
        s.style = { ...defaultStyle(), ...(s.style || {}) };
        s.pages = Math.max(1, Number(s.pages) || 1);
        if (!Array.isArray(s.dock)) s.dock = this._legacyDock();
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
        const music = makeWidget('music', 'small');
        Object.assign(music, { page: 1, x: 0, y: 0 });
        const cal = makeWidget('calendar', 'small');
        Object.assign(cal, { page: 1, x: 2, y: 0 });
        const note = makeWidget('note', 'medium', { text: '长按桌面空白处进入编辑模式 ✦\n可以拖动、加组件、导入美化～' });
        Object.assign(note, { page: 1, x: 0, y: 2 });
        s.items.push(music, cal, note);
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
        this._tick = setInterval(() => {
            if (!this.root?.isConnected) { clearInterval(this._tick); this._tick = null; return; }
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
        r.style.setProperty('--yzd-radius', `${clamp(Number(st.iconRadius) || 0, 0, 50)}%`);
        r.style.setProperty('--yzd-label', st.labelColor || '#2b2b33');
        r.style.setProperty('--yzd-plate', hexToRgba(normHex(st.plateColor), clamp(Number(st.plateAlpha) || 0, 0, 1)));
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

    _iconUrl(app) {
        return String(this.S.icons?.[app.id] || '').trim() || this.home?._getAppIconImage?.(app) || '';
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
            iframe.srcdoc = buildSrcdoc(item.data || {}, this.S.widgetState[item.id] || {});
            box.appendChild(iframe);
            FRAME_MAP.set(iframe.contentWindow, { desk: this, id: item.id, iframe });
            iframe.addEventListener('load', () => {
                if (iframe.contentWindow) FRAME_MAP.set(iframe.contentWindow, { desk: this, id: item.id, iframe });
            });
            return;
        }
        const d = { ...COMMON_DEFAULTS, ...(BUILTINS[item.wtype]?.defaults || {}), ...(item.data || {}) };
        box.className = 'yzd-wbox yzd-wbox-builtin';
        box.setAttribute('style', this._surfaceStyle(d));
        box.innerHTML = this._renderBuiltin(item, d);
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

    _timeParts() {
        let info = null;
        try { info = this.home?._getCurrentPhoneTimeInfo?.(); } catch (e) { info = null; }
        const now = new Date();
        let y = now.getFullYear(), m = now.getMonth() + 1, day = now.getDate();
        const mt = String(info?.date || '').match(/(\d+)年(\d+)月(\d+)日/);
        if (mt) { y = +mt[1]; m = +mt[2]; day = +mt[3]; }
        let hh = now.getHours(), mm = now.getMinutes();
        const tm = String(info?.time || '').match(/(\d{1,2}):(\d{2})/);
        if (tm) { hh = +tm[1]; mm = +tm[2]; }
        const dt = new Date(y, m - 1, day);
        return { y, m, d: day, hh, mm, ss: now.getSeconds(), wd: dt.getDay(), ancient: !!info?.isAncient, rawDate: String(info?.date || ''), weekdayText: String(info?.weekday || '') };
    }

    _renderBuiltin(item, d) {
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
            this._gStart(e.clientX, e.clientY, itemEl, { delHit: !!e.target.closest('[data-del]') });
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
        const linked = BUILTINS[item.wtype]?.app;
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
            entries.push(['edit', '编辑内容', '✎'], ['style', '更换样式', '▦'], ['resize', '调整大小', '⤢'], ['home', '编辑主画面', '⚙'], ['remove', '移除组件', '⊖', 'danger']);
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
        if (k === 'icon') { await this.pickIconFor(item.appId); return; }
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
        return this._dialog(`<div class="yzd-dlg-title">${esc(text)}</div>
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
                    const paint = () => {
                        row.querySelector('.yzd-thumb').style.backgroundImage = row._val ? cssUrl(row._val) : 'none';
                        row.querySelector('.yzd-thumb').classList.toggle('empty', !row._val);
                    };
                    row.innerHTML = `${label}<div class="yzd-imgrow"><div class="yzd-thumb"></div>
                        <span class="yzd-btn sm" data-i="up">上传</span><span class="yzd-btn sm" data-i="url">链接</span><span class="yzd-btn sm" data-i="clr">清除</span></div>`;
                    paint();
                    row.addEventListener('click', async (e) => {
                        const b = e.target.closest('[data-i]');
                        if (!b) return;
                        if (b.dataset.i === 'up') {
                            const [file] = await pickFiles({ accept: 'image/*' });
                            if (file) row._val = await readImageFile(file, f.maxDim || 1400);
                        } else if (b.dataset.i === 'url') {
                            const u = await this.prompt('图片链接', /^data:/.test(row._val) ? '' : row._val);
                            if (u !== null) row._val = u.trim();
                        } else row._val = '';
                        paint();
                        onChange?.();
                    });
                    get = () => row._val;
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
            row.querySelectorAll('input:not([type=range]):not([type=color]),textarea').forEach(i => i.addEventListener('change', () => onChange?.()));
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
        this.openSheet(`编辑 ${def.name}`, (body, sheet) => {
            const prev = document.createElement('div');
            prev.className = 'yzd-edit-prev';
            body.appendChild(prev);
            const form = document.createElement('div');
            body.appendChild(form);
            const get = this._buildFields(form, [...def.fields, ...COMMON_FIELDS], d, () => paint());
            const paint = () => {
                prev.innerHTML = '';
                prev.appendChild(this._previewBuiltin(item.wtype, item.size, { ...d, ...get() }));
                this._scalePreviews(prev);
            };
            paint();
            body.insertAdjacentHTML('beforeend', `<div class="yzd-dlg-btns"><span class="yzd-btn" data-b="cancel">取消</span><span class="yzd-btn primary" data-b="save">保存</span></div>`);
            body.addEventListener('click', (e) => {
                const b = e.target.closest('[data-b]');
                if (!b) return;
                if (b.dataset.b === 'save') {
                    item.data = { ...d, ...get() };
                    this._rebuildItem(item);
                    this.save();
                }
                sheet.close();
            });
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
                        <span class="yzd-btn" data-b="cancel">取消</span><span class="yzd-btn primary" data-b="save">保存</span></div>`;
                const imgs = body.querySelector('.yzd-imgs');
                const keys = Object.keys(data.images);
                if (!keys.length) imgs.innerHTML = '<div class="yzd-tip">没有图片占位符</div>';
                this._imgGetters = {};
                keys.forEach(k => {
                    const wrap = document.createElement('div');
                    wrap.className = 'yzd-imgkey';
                    imgs.appendChild(wrap);
                    const get = this._buildFields(wrap, [{ key: k, label: `{{${k}}}`, type: 'image', maxDim: 1200 }], data.images);
                    wrap.insertAdjacentHTML('beforeend', `<span class="yzd-x sm" data-delimg="${esc(k)}">✕</span>`);
                    this._imgGetters[k] = () => get()[k];
                });
                const uf = body.querySelector('.yzd-uf');
                if (!data.userFields.length) uf.innerHTML = '<div class="yzd-tip">这个组件没有可填写字段</div>';
                this._ufGet = this._buildFields(uf, data.userFields.map(f => ({ ...f, type: f.type === 'string' ? 'text' : f.type })), stateVals);
            };
            const pull = () => {
                data.name = body.querySelector('[data-f=name]').value;
                size = body.querySelector('[data-f=size]').value;
                data.html = body.querySelector('[data-f=html]').value;
                data.css = body.querySelector('[data-f=css]').value;
                Object.entries(this._imgGetters || {}).forEach(([k, g]) => { data.images[k] = g(); });
                Object.assign(stateVals, this._ufGet ? this._ufGet() : {});
            };
            render();
            body.addEventListener('click', (e) => {
                const b = e.target.closest('[data-b],[data-delimg],[data-delf]');
                if (!b) return;
                pull();
                if (b.dataset.delimg) { delete data.images[b.dataset.delimg]; render(); return; }
                if (b.dataset.delf !== undefined) { data.userFields.splice(Number(b.dataset.delf), 1); render(); return; }
                const act = b.dataset.b;
                if (act === 'addimg') {
                    const k = body.querySelector('[data-f=newimg]').value.trim().replace(/[^\w$-]/g, '');
                    if (k && !(k in data.images)) data.images[k] = '';
                    render();
                } else if (act === 'addf') {
                    const key = body.querySelector('[data-f=fkey]').value.trim().replace(/[^\w$]/g, '');
                    if (!key) { this.toast('请填写字段标识'); return; }
                    const f = { key, label: body.querySelector('[data-f=flabel]').value.trim() || key, type: body.querySelector('[data-f=ftype]').value };
                    if (f.type === 'select') f.options = body.querySelector('[data-f=fopts]').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                    data.userFields = data.userFields.filter(x => x.key !== key).concat(f);
                    render();
                } else if (act === 'export') {
                    downloadText(`${(data.name || 'widget').replace(/[\\/:*?"<>|]/g, '_')}.widget.json`, JSON.stringify(this._toTemplateJson(data, size), null, 2));
                } else if (act === 'lib') {
                    this.addToLibrary({ ...this._toTemplateJson(data, size), templateId: data.templateId || uid('t') });
                    this.toast('已存入组件库');
                } else if (act === 'cancel') {
                    sheet.close();
                    if (isNew) { this.S.items = this.S.items.filter(i => i.id !== item.id); this.syncLayout(); }
                } else if (act === 'save') {
                    item.data = data;
                    const declared = new Set(data.userFields.map(f => f.key));
                    const st = (this.S.widgetState[item.id] = this.S.widgetState[item.id] || {});
                    Object.entries(stateVals).forEach(([k, v]) => { if (declared.has(k)) { if (v === '' || v === undefined) delete st[k]; else st[k] = v; } });
                    if (size !== item.size) this.resizeItem(item, size); else this._rebuildItem(item);
                    this.save();
                    sheet.close();
                }
            });
        }, { tall: true });
    },

    _toTemplateJson(data, size) {
        return {
            type: 'custom_widget_template', version: 2,
            name: data.name || '自定义组件', size: SIZE_DEFS[size] ? size : 'small',
            html: data.html || '', css: data.css || '',
            imageKeys: Object.keys(data.images || {}),
            userFields: clone(data.userFields || [])
        };
    },

    addToLibrary(tpl) {
        const t = {
            tid: tpl.templateId || tpl.tid || uid('t'),
            name: String(tpl.name || '自定义组件'),
            size: SIZE_DEFS[tpl.size] ? tpl.size : 'small',
            html: String(tpl.html || ''), css: String(tpl.css || ''),
            imageKeys: Array.isArray(tpl.imageKeys) ? tpl.imageKeys : Object.keys(tpl.images || {}),
            userFields: clone(tpl.userFields || []),
            images: Object.fromEntries(Object.entries(tpl.images || {}).filter(([, v]) => /^https?:/i.test(String(v || ''))))
        };
        const idx = Store.library.findIndex(x => x.tid === t.tid || (x.name === t.name && x.html.length === t.html.length && x.css.length === t.css.length));
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
        const d = { ...COMMON_DEFAULTS, ...(BUILTINS[wtype]?.defaults || {}), ...(wtype === 'photo' ? { bg: 'clear' } : {}), ...(data || {}) };
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
        iframe.srcdoc = buildSrcdoc({ html: tpl.html, css: tpl.css, images: tpl.images || {} }, {});
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
    openGallery({ mode = 'add', target = null } = {}) {
        const replacing = mode === 'replace' && target;
        const sheet = this.openSheet(replacing ? '更换样式' : '添加组件', (body) => {
            const s = this.S;
            const hiddenApps = s.hidden.map(id => this.getApp(id)).filter(Boolean);
            body.innerHTML = `
                ${!replacing && hiddenApps.length ? `<div class="yzd-sec">已移除的应用（点一下放回桌面）</div>
                    <div class="yzd-hidden-apps">${hiddenApps.map(a => `<div class="yzd-happ" data-happ="${esc(a.id)}">${this._appIconHtml(a)}<small>${esc(this._appName(a))}</small></div>`).join('')}</div>` : ''}
                <div class="yzd-sec">内置组件</div>
                <div class="yzd-gal yzd-gal-builtin"></div>
                <div class="yzd-sec">我的组件库 <small>导入的 .widget.json / 美化里的组件</small></div>
                <div class="yzd-gal yzd-gal-lib"></div>`;
            const gb = body.querySelector('.yzd-gal-builtin');
            Object.entries(BUILTINS).forEach(([type, def]) => {
                const size = replacing && def.sizes.includes(target.size) ? target.size : def.defaultSize;
                const card = document.createElement('div');
                card.className = `yzd-gcard span-${SIZE_DEFS[size].w >= 4 ? 2 : 1}`;
                card.dataset.type = type;
                card.dataset.size = size;
                card.appendChild(this._previewBuiltin(type, size, {}));
                card.insertAdjacentHTML('beforeend', `<div class="yzd-gname">${esc(def.name)}</div>
                    <div class="yzd-chips sm">${def.sizes.map(sz => `<span class="yzd-chip ${sz === size ? 'on' : ''}" data-sz="${sz}">${SIZE_DEFS[sz].label.split(' ')[0]}</span>`).join('')}</div>`);
                gb.appendChild(card);
            });
            const gl = body.querySelector('.yzd-gal-lib');
            if (!Store.library.length) gl.innerHTML = '<div class="yzd-tip">还没有导入的组件，点右上角 ↑ 导入 .widget.json，或 ⊕ 自己写一个。</div>';
            Store.library.forEach((tpl, i) => {
                const card = document.createElement('div');
                card.className = `yzd-gcard span-${SIZE_DEFS[tpl.size].w >= 4 ? 2 : 1}`;
                card.dataset.lib = String(i);
                card.appendChild(this._previewCustom(tpl, tpl.size));
                card.insertAdjacentHTML('beforeend', `<div class="yzd-gname">${esc(tpl.name)} <small>${SIZE_DEFS[tpl.size].label}</small></div><span class="yzd-x sm yzd-gdel" data-libdel="${i}">✕</span>`);
                gl.appendChild(card);
            });
            this._scalePreviews(body);

            body.addEventListener('click', async (e) => {
                const del = e.target.closest('[data-libdel]');
                if (del) {
                    e.stopPropagation();
                    const tpl = Store.library[Number(del.dataset.libdel)];
                    if (tpl && await this.confirm(`从组件库删除「${tpl.name}」？（桌面上已放的不受影响）`, '删除')) {
                        Store.library.splice(Number(del.dataset.libdel), 1);
                        Store.save('library');
                        sheet.close();
                        this.openGallery({ mode, target });
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
                const chip = e.target.closest('[data-sz]');
                let newItem;
                if (card.dataset.type) {
                    const sz = chip ? chip.dataset.sz : card.dataset.size;
                    newItem = makeWidget(card.dataset.type, sz);
                    if (replacing && target.wtype !== 'custom') {
                        const keep = {};
                        ['bg', 'bgColor', 'bgAlpha', 'bgImage', 'textColor', 'radius'].forEach(k => { if (target.data?.[k] !== undefined) keep[k] = target.data[k]; });
                        Object.assign(newItem.data, keep);
                    }
                } else if (card.dataset.lib !== undefined) {
                    const tpl = Store.library[Number(card.dataset.lib)];
                    if (!tpl) return;
                    newItem = makeCustomWidget(tpl, tpl.size);
                }
                if (!newItem) return;
                sheet.close();
                if (replacing) this.replaceWidget(target, newItem);
                else this.placeNewWidget(newItem);
                if (newItem.wtype === 'custom' && ((newItem.data.userFields || []).length || Object.keys(newItem.data.images || {}).length)) {
                    setTimeout(() => this.openCustomEditor(newItem), 260);
                }
            });
        }, {
            tall: true,
            headExtra: `<span class="yzd-hbtn" data-g="new" title="新建自定义组件">⊕</span><span class="yzd-hbtn" data-g="import" title="导入组件">↑</span>`
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

            <div class="yzd-sec">应用图标 <small>点图标单独换 · 主题内生效</small></div>
            <div class="yzd-iconlist">${this.apps.map(a => `<div class="yzd-happ" data-icon="${esc(a.id)}">${this._appIconHtml(a)}<small>${esc(this._appName(a))}</small>${s.icons[a.id] ? '<i class="yzd-dot-mark"></i>' : ''}</div>`).join('')}</div>
            <div class="yzd-btnrow"><span class="yzd-btn" data-t="iconbulk">批量导入图标</span><span class="yzd-btn" data-t="iconreset">全部恢复默认图标</span></div>

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
            { key: 'iconRadius', label: '图标圆角', type: 'range', min: 0, max: 50, step: 1 },
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

        body.onclick = async (e) => {
            const el = e.target.closest('[data-t],[data-apply],[data-exp],[data-del],[data-icon]');
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
            if (el.dataset.icon) { await this.pickIconFor(el.dataset.icon); this._renderThemeBody(body, sheet); return; }
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
            else if (t === 'iconreset') {
                if (await this.confirm('当前主题的应用图标全部恢复默认？')) { s.icons = {}; this.save(); this.refreshAppVisuals(); this._renderThemeBody(body, sheet); }
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
        const ok = downloadText(`${theme.name.replace(/[\\/:*?"<>|]/g, '_')}.yuzuki-theme.json`, JSON.stringify({ type: 'yuzuki_phone_desktop_theme', version: 1, name: theme.name, exportDate: new Date().toISOString(), state: theme.state }));
        this.toast(ok ? '已导出（看浏览器下载）' : '导出失败');
    },

    async bulkImportIcons() {
        const files = await pickFiles({ accept: 'image/*', multiple: true });
        if (!files.length) return;
        const norm = (x) => String(x || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_\-()（）]/g, '');
        const guess = (file) => {
            const n = norm(file.name);
            const hit = this.apps.find(a => [a.id, a.name, this._appName(a)].some(v => norm(v) && (n === norm(v) || n.includes(norm(v)))));
            return hit?.id || '';
        };
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
                await this._importThemeState(state, baseName);
            } else {
                const tpls = this.parseWidgetTemplates(json);
                if (!tpls.length) { this.toast(`「${file.name}」识别不出是美化还是组件`); continue; }
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
        const finalName = (await this.prompt('导入成功，给这个主题起个名字', name)) || name;
        const theme = { id: uid('th'), name: finalName, savedAt: Date.now(), state: { ...state, themeName: finalName } };
        const idx = Store.themes.findIndex(t => t.name === finalName);
        if (idx >= 0) Store.themes[idx] = theme; else Store.themes.unshift(theme);
        Store.save('themes', 50);
        await this.applyTheme(theme);
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
            iconRadius: hs.radius !== undefined ? clamp(Math.round(Number(hs.radius) / 60 * 100), 0, 50) : 24,
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
                    this.addToLibrary({ ...w.data, size });
                    s.widgetState[item.id] = clone(json.customWidgetState?.[w.id] || {});
                } else if (NUO_BUILTIN_TYPE_MAP[w.type]) {
                    const t = NUO_BUILTIN_TYPE_MAP[w.type];
                    item = makeWidget(t, BUILTINS[t].sizes.includes(size) ? size : BUILTINS[t].defaultSize);
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
            Object.entries(json.appCustomizations || {}).forEach(([k, v]) => {
                if (!this.getApp(k)) return;
                const url = typeof v === 'string' ? v : (v?.icon || v?.customIcon || v?.iconUrl || v?.image || '');
                if (typeof url === 'string' && /^(data:image|https?:)/i.test(url)) s.icons[k] = url;
            });
        } finally {
            Store.state = prev;
        }
        return s;
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
.yzd-root .yzd-icon{width:var(--yzd-icon);height:var(--yzd-icon);border-radius:var(--yzd-radius,24%);background-color:var(--yzd-plate,transparent);background-size:cover;background-position:center;background-repeat:no-repeat;flex:0 0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:transform .15s}
.yzd-root .yzd-icon-emoji{display:flex;align-items:center;justify-content:center;font-size:calc(var(--yzd-icon)*.46);color:#fff}
.yzd-root .yzd-label{max-width:100%;font-size:11.5px;line-height:14px;height:14px;color:var(--yzd-label,#2b2b33)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;padding:0 2px;text-shadow:0 1px 3px rgba(0,0,0,.16)}
.yzd-root.yzd-no-labels{--yzd-ioff:calc(var(--yzd-icon)/2)}
.yzd-root.yzd-no-labels .yzd-label{display:none}
.yzd-root .yzd-badge{position:absolute;top:calc(50% - var(--yzd-ioff) - 6px);left:calc(50% + var(--yzd-icon)/2 - 13px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff3b30;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none}
.yzd-root .yzd-widget .yzd-wbox{position:absolute;inset:5px;overflow:hidden;color:var(--yzd-wtext,#2b2b33);container-type:size}
.yzd-root .yzd-wbox-builtin{box-shadow:0 4px 16px rgba(0,0,0,.08)}
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
.yzd-root .yzd-mask{position:absolute;inset:0;background:rgba(0,0,0,.32);display:flex;align-items:flex-end;justify-content:center;animation:yzd-fade .2s;touch-action:auto;user-select:text;-webkit-user-select:text;transition:opacity .2s}
.yzd-root .yzd-mask.out{opacity:0}
.yzd-root .yzd-mask-center{align-items:center;padding:20px;z-index:5}
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
.yzd-root .yzd-gdel{position:absolute;top:6px;right:6px;z-index:5}
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
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = DESKTOP_CSS;
    document.head.appendChild(st);
}
