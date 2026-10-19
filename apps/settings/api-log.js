// 📜 小手机 API 调用日志
// 记录小手机发出的每一次 AI / 生图 / 语音等请求：哪个应用、模型、输入、输出、耗时、成功与否。
// 做法：包一层 window.fetch（所有网络请求都会经过）+ 包一层 VirtualPhone.apiManager.callAI（应用层调用）。
// 只记录 AI 相关请求，酒馆自己的保存设置、读角色卡等请求不记。
// 也可以由应用手动写「步骤」（apiLog.step），用来排查卡在哪一步（比如朋友圈一直转圈却没发请求）。

const STORE_KEY = 'yuzuki_phone_api_log_v1';
const MAX_ENTRIES = 150;
const MAX_STORED = 40;
const MAX_TEXT = 60000;
const MAX_STORED_TEXT = 8000;

// 同源（酒馆后端）里算作 AI 调用的接口
const SAME_ORIGIN_AI = [
    '/api/backends/', '/api/openai/', '/api/sd/', '/api/novelai/', '/api/horde/',
    '/api/tts/', '/api/speech/', '/api/translate/', '/api/extra/', '/api/google/', '/proxy/'
];
// 这些同源接口就算命中上面的前缀也不记（状态轮询之类）
const SAME_ORIGIN_SKIP = [/\/status\b/, /\/ping\b/, /\/models?\b(?!.*generat)/];
const CROSS_ORIGIN_AI = /(chat\/completions|\/completions|\/v1\/|\/v1beta\/|generat|images|image|\/audio|\/tts|speech|synthes|voice|\/models|\/messages|\/embeddings|translate|minimax|siliconflow|pollinations|novelai|openrouter|anthropic|gemini|deepseek|mimo)/i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|mp3|wav|ogg|m4a|mp4|webm|woff2?|ttf|otf|css|js)(\?|#|$)/i;

// 按调用栈里的文件判断是哪个应用发的请求
const APP_BY_FILE = [
    [/moments-view/, '朋友圈'],
    [/honey/, '蜜语'],
    [/\/x\/|x-app|x-view/, 'X'],
    [/weibo/, '微博'],
    [/catbox/, '猫箱'],
    [/wangxiang|games\//, '游戏'],
    [/story-image|image-gen|imagegen|sd-|novelai|生图|comfy/i, '生图'],
    [/tts|voice|speech|reading/i, '语音'],
    [/settings-app/, '设置（测试）'],
    [/contacts-view/, '微信 · 通讯录'],
    [/chat-view|wechat-app|wechat-/, '微信聊天'],
    [/forum|tieba/, '论坛'],
    [/album/, '相册'],
    [/diary|notes|memo/, '日记'],
    [/music/, '音乐'],
    [/map|travel/, '地图'],
    [/shop|taobao|wallet/, '购物']
];
const APP_BY_ID = {
    wechat: '微信', honey: '蜜语', x: 'X', weibo: '微博', image: '生图', tts: '语音', forum: '论坛', story: '正文',
    moments: '朋友圈', diary: '日记', music: '音乐', settings: '设置'
};

const clip = (v, n = MAX_TEXT) => {
    const s = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } })();
    return s.length > n ? `${s.slice(0, n)}\n…（已截断，共 ${s.length} 字）` : s;
};

function appFromStack() {
    let stack = '';
    try { stack = String(new Error().stack || ''); } catch (e) { stack = ''; }
    const lines = stack.split('\n').slice(2).filter(l => !/api-log\.js/.test(l));
    for (const line of lines) {
        for (const [re, name] of APP_BY_FILE) if (re.test(line)) return name;
    }
    if (lines.some(l => /\/scripts\/extensions\/third-party\//.test(l))) return '小手机';
    return '';
}

function messagesToText(msgs) {
    if (!Array.isArray(msgs)) return clip(msgs);
    return clip(msgs.map(m => {
        let c = m?.content;
        if (Array.isArray(c)) c = c.map(p => (p?.type === 'text' ? p.text : `[${p?.type || '附件'}]`)).join('\n');
        return `【${m?.role || '?'}${m?.name ? ` · ${m.name}` : ''}】\n${typeof c === 'string' ? c : clip(c, 4000)}`;
    }).join('\n\n'));
}

// 把 SSE 流式返回拼成正文
function joinStream(text) {
    if (!/^\s*data:/m.test(text)) return '';
    let out = '';
    text.split('\n').forEach(line => {
        const m = line.match(/^\s*data:\s*(.*)$/);
        if (!m || m[1] === '[DONE]') return;
        try {
            const j = JSON.parse(m[1]);
            const d = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.text ?? j?.delta?.text
                ?? j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
            if (typeof d === 'string') out += d;
        } catch (e) { /* 忽略 */ }
    });
    return out;
}

function pickOutput(text) {
    const stream = joinStream(text);
    if (stream) return stream;
    try {
        const j = JSON.parse(text);
        const c = j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? j?.content?.[0]?.text
            ?? j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? j?.output ?? j?.text;
        if (typeof c === 'string' && c) return c;
        if (Array.isArray(c)) return c.map(p => p?.text || '').join('');
    } catch (e) { /* 不是 JSON */ }
    return text;
}

class PhoneApiLog {
    constructor() {
        this.entries = [];
        this.listeners = new Set();
        this._seq = 0;
        this._activeAi = [];
        this._load();
    }

    // ---------- 存取 ----------
    _load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (Array.isArray(list)) this.entries = list.map(e => ({ ...e, pending: false, restored: true }));
        } catch (e) { this.entries = []; }
    }
    _save() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            try {
                const slim = this.entries.filter(e => !e.pending).slice(0, MAX_STORED).map(e => ({
                    ...e,
                    input: clip(e.input || '', MAX_STORED_TEXT),
                    output: clip(e.output || '', MAX_STORED_TEXT),
                    raw: ''
                }));
                localStorage.setItem(STORE_KEY, JSON.stringify(slim));
            } catch (e) { /* 存不下就算了 */ }
        }, 400);
    }
    _emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) { /* 忽略 */ } }); this._save(); }
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    clear() { this.entries = []; this._emit(); }

    _add(entry) {
        const e = { id: `log_${Date.now().toString(36)}_${(++this._seq).toString(36)}`, ts: Date.now(), pending: true, ...entry };
        this.entries.unshift(e);
        if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
        this._emit();
        return e;
    }
    _finish(e, patch) {
        Object.assign(e, patch, { pending: false, ms: Date.now() - e.ts });
        this._emit();
    }

    // 应用手动记一步（排查卡在哪）
    step(app, text, extra = {}) {
        return this._add({ kind: 'step', app: app || appFromStack() || '小手机', label: String(text || ''), pending: false, ok: extra.ok !== false, ms: 0, ...extra });
    }

    // ---------- 安装 ----------
    install() {
        if (this._installed) return this;
        this._installed = true;
        // ⚠️ 不再包裹全局 window.fetch：酒馆正文和小手机的所有请求都会经过它，
        //    在 TauriTavern 等环境里会拖住请求（一直“进行中”）。原版没有这层，请求链路要和原版保持一致。
        //    现在只记录小手机自己的 AI 调用（apiManager.callAI），应用 / 输入 / 输出 / 耗时照样能看。
        this._wrapManagers();
        this._mgrTimer = setInterval(() => this._wrapManagers(), 2000);
        return this;
    }

    _shouldLog(url, method) {
        let u;
        try { u = new URL(url, location.href); } catch (e) { return false; }
        if (u.protocol === 'data:' || u.protocol === 'blob:') return false;
        const sameOrigin = u.origin === location.origin;
        // 酒馆 App（Tauri）自己的内部通信，不是 AI 请求。
        // 注意：TauriTavern 的页面本身就在 tauri.localhost 上，酒馆后端接口（/api/backends/...）也是这个域名，
        // 不能整个域名都跳过，否则 Tauri 里所有 AI 请求都会显示“没有抓到”。
        if (!sameOrigin && (/^ipc\.localhost$|^tauri\.localhost$/i.test(u.hostname) || /^(ipc|tauri|asset):$/i.test(u.protocol))) return false;
        if (/__TAURI/i.test(u.href)) return false;
        if (sameOrigin) {
            if (method === 'GET') return false;
            if (!SAME_ORIGIN_AI.some(p => u.pathname.startsWith(p))) return false;
            return !SAME_ORIGIN_SKIP.some(re => re.test(u.pathname));
        }
        if (method === 'GET' && IMG_EXT.test(u.pathname)) return false;
        if (method === 'GET' && !CROSS_ORIGIN_AI.test(u.href)) return false;
        return true;
    }

    _wrapFetch() {
        const orig = window.fetch;
        if (typeof orig !== 'function' || orig.__yzApiLog) return;
        const self = this;
        const wrapped = function (input, init) {
            let url = '';
            let method = 'GET';
            try {
                url = typeof input === 'string' ? input : (input?.url || String(input));
                method = String(init?.method || input?.method || 'GET').toUpperCase();
            } catch (e) { /* 忽略 */ }
            if (!self._shouldLog(url, method)) return orig.apply(window, arguments);

            let bodyText = '';
            let model = '';
            let input2 = '';
            try {
                const b = init?.body;
                if (typeof b === 'string') {
                    bodyText = b;
                    try {
                        const j = JSON.parse(b);
                        model = j?.model || j?.model_id || j?.custom_model_id || j?.parameters?.model || '';
                        if (Array.isArray(j?.messages)) input2 = messagesToText(j.messages);
                        else if (j?.prompt) input2 = clip(j.prompt);
                        else if (j?.input) input2 = clip(j.input);
                        else if (j?.text) input2 = clip(j.text);
                        else input2 = clip(b);
                    } catch (e) { input2 = clip(b); }
                } else if (b) {
                    input2 = `[${b?.constructor?.name || '二进制'} 数据]`;
                }
            } catch (e) { /* 忽略 */ }

            const parent = self._activeAi.length === 1 ? self._activeAi[0] : null;
            const entry = self._add({
                kind: 'net',
                app: parent?.app || appFromStack() || '小手机',
                label: '网络请求',
                method,
                url: url.length > 300 ? `${url.slice(0, 300)}…` : url,
                model,
                input: input2,
                parent: parent?.id || ''
            });
            if (parent && model && !parent.model) parent.model = model;

            let p;
            try { p = orig.apply(window, arguments); } catch (err) {
                self._finish(entry, { ok: false, error: String(err?.message || err) });
                throw err;
            }
            Promise.resolve(p).then(resp => {
                entry.status = resp.status;
                const type = String(resp.headers?.get?.('content-type') || '');
                if (/audio|image|video|octet-stream/.test(type)) {
                    const len = resp.headers?.get?.('content-length');
                    self._finish(entry, { ok: resp.ok, output: `[${type}${len ? `，${Math.round(len / 1024)} KB` : ''}]` });
                    return;
                }
                // ⚠️ 不复制（clone）流式 / 酒馆后端的响应体：clone 会把响应流一分为二（tee），
                // 在 TauriTavern 这类自己接管 fetch 的环境里可能拖住原本的读取，导致请求一直挂着。
                // 这类请求的输出由上层「AI 调用」记录（apiManager 返回的正文），这里只记状态码。
                const isStream = /event-stream/i.test(type);
                let sameOriginBackend = false;
                try { sameOriginBackend = new URL(url, location.href).origin === location.origin; } catch (e) { /* 忽略 */ }
                if (isStream || sameOriginBackend) {
                    self._finish(entry, { ok: resp.ok, output: resp.ok ? '（流式 / 酒馆后端响应，正文见上层 AI 调用记录）' : '', error: resp.ok ? '' : `HTTP ${resp.status}` });
                    return;
                }
                let clone;
                try { clone = resp.clone(); } catch (e) { self._finish(entry, { ok: resp.ok }); return; }
                clone.text().then(text => {
                    self._finish(entry, { ok: resp.ok, output: clip(pickOutput(text)), raw: clip(text, 20000), error: resp.ok ? '' : clip(text, 2000) });
                }).catch(err => self._finish(entry, { ok: resp.ok, error: `读取返回失败：${err?.message || err}` }));
            }, err => {
                self._finish(entry, { ok: false, error: err?.name === 'AbortError' ? '已取消（被中止）' : String(err?.message || err) });
            });
            return p;
        };
        wrapped.__yzApiLog = true;
        wrapped.__yzOrig = orig;
        window.fetch = wrapped;
    }

    _wrapManagers() {
        const mgr = window.VirtualPhone?.apiManager;
        if (!mgr || mgr.__yzApiLogWrapped) return;
        const orig = mgr.callAI;
        if (typeof orig !== 'function') return;
        const self = this;
        mgr.callAI = async function (messages, options = {}) {
            const stackApp = appFromStack();
            const entry = self._add({
                kind: 'ai',
                app: stackApp || APP_BY_ID[options?.appId] || options?.appId || '小手机',
                label: 'AI 调用',
                appId: options?.appId || '',
                input: messagesToText(messages),
                options: clip({ ...options, signal: undefined }, 2000)
            });
            self._activeAi.push(entry);
            try {
                const res = await orig.apply(this, arguments);
                const out = res?.summary ?? res?.content ?? res?.text ?? res;
                self._finish(entry, {
                    ok: res?.success !== false,
                    output: clip(typeof out === 'string' ? out : out),
                    error: res?.success === false ? String(res?.error || '失败') : ''
                });
                return res;
            } catch (err) {
                self._finish(entry, { ok: false, error: String(err?.message || err) });
                throw err;
            } finally {
                self._activeAi = self._activeAi.filter(x => x !== entry);
            }
        };
        mgr.__yzApiLogWrapped = true;
    }

    // ---------- 界面 ----------
    stats() {
        const list = this.entries.filter(e => e.kind !== 'step');
        return { total: list.length, fail: list.filter(e => !e.pending && e.ok === false).length, pending: list.filter(e => e.pending).length };
    }
}

export function getPhoneApiLog() {
    if (!window.__yzPhoneApiLog) window.__yzPhoneApiLog = new PhoneApiLog().install();
    return window.__yzPhoneApiLog;
}

// 模块一加载就开始记录
try { getPhoneApiLog(); } catch (e) { console.warn('[小手机日志] 初始化失败', e); }

// ================= 日志查看面板 =================
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const fmtMs = ms => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} 秒` : `${ms} 毫秒`);

const PANEL_CSS = `
.yzlog-mask { position: absolute; inset: 0; z-index: 99995; background: #f2f2f7; display: flex; flex-direction: column; font-size: 13px; color: #1c1c1e; overflow: hidden; height: 100%; max-height: 100%; box-sizing: border-box; }
.yzlog-head, .yzlog-tools { flex: 0 0 auto; }
.yzlog-head { display: flex; align-items: center; gap: 8px; padding: 40px 12px 10px; background: #fff; border-bottom: .5px solid #ddd; }
.yzlog-head b { flex: 1; font-size: 16px; text-align: center; }
.yzlog-head button, .yzlog-tools button { border: 0; background: #f0f1f3; border-radius: 8px; padding: 6px 10px; font-size: 12px; color: #333; cursor: pointer; }
.yzlog-tools { display: flex; gap: 6px; padding: 8px 12px; flex-wrap: wrap; align-items: center; background: #fff; border-bottom: .5px solid #e5e5e5; }
.yzlog-tools select { border: 1px solid #e3e5e8; border-radius: 8px; padding: 5px 8px; font-size: 12px; background: #fafafa; }
.yzlog-tools .yzlog-sum { margin-left: auto; color: #888; font-size: 11.5px; }
.yzlog-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; padding: 8px 10px 30px; }
.yzlog-item { background: #fff; border-radius: 10px; padding: 9px 11px; margin-bottom: 7px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.yzlog-item.is-child { margin-left: 16px; background: #fbfbfd; }
.yzlog-row1 { display: flex; align-items: center; gap: 6px; }
.yzlog-app { font-weight: 650; white-space: nowrap; }
.yzlog-tag, .yzlog-time { white-space: nowrap; flex-shrink: 0; }
.yzlog-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 6px; background: #eef0f4; color: #555; }
.yzlog-tag.ok { background: #e6f7ec; color: #12813b; }
.yzlog-tag.fail { background: #fdecec; color: #c62828; }
.yzlog-tag.pend { background: #fff4e0; color: #b26a00; }
.yzlog-tag.step { background: #eef2ff; color: #3949ab; }
.yzlog-time { margin-left: auto; color: #999; font-size: 11px; white-space: nowrap; }
.yzlog-row2 { color: #666; font-size: 11.5px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.yzlog-empty { text-align: center; color: #999; padding: 40px 10px; line-height: 1.7; }
.yzlog-detail { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; padding: 10px 12px 30px; }
.yzlog-kv { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; line-height: 1.6; word-break: break-all; }
.yzlog-kv span { color: #888; display: inline-block; min-width: 64px; }
.yzlog-block { background: #fff; border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
.yzlog-block h4 { margin: 0; padding: 8px 12px; font-size: 12.5px; background: #fafafa; border-bottom: .5px solid #eee; display: flex; align-items: center; }
.yzlog-block.is-fold h4 { cursor: pointer; user-select: none; }
.yzlog-block.is-fold:not(.is-open) h4 { border-bottom: 0; }
.yzlog-fold-arrow { display: inline-block; width: 14px; color: #888; }
.yzlog-block h4 em { font-style: normal; font-weight: 400; color: #999; font-size: 11px; margin-left: 8px; }
.yzlog-block h4 button { margin-left: auto; border: 0; background: #f0f1f3; border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
.yzlog-block pre { margin: 0; padding: 10px 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font: 11.5px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #222; }
`;

export function openApiLogPanel(host = null) {
    const log = getPhoneApiLog();
    const root = host || document.querySelector('.phone-view-current .phone-screen') || document.querySelector('.phone-screen') || document.querySelector('.phone-view-current') || document.body;
    let st = document.getElementById('yzlog-style');
    if (!st) {
        st = document.createElement('style');
        st.id = 'yzlog-style';
        document.head.appendChild(st);
    }
    if (st.textContent !== PANEL_CSS) st.textContent = PANEL_CSS;
    root.querySelector(':scope > .yzlog-mask')?.remove();
    const mask = document.createElement('div');
    mask.className = 'yzlog-mask';
    if (root === document.body) Object.assign(mask.style, { position: 'fixed' });
    root.appendChild(mask);
    // 手机外壳有左右滑动返回之类的手势，会吃掉滑动：日志面板里的触摸 / 滑动事件都不往外传
    ['click', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'pointerdown', 'pointermove', 'wheel'].forEach(ev => mask.addEventListener(ev, e => e.stopPropagation(), { passive: true }));

    let filter = 'all';
    let detailId = '';
    const openBlocks = new Set();
    const apps = () => Array.from(new Set(log.entries.map(e => e.app).filter(Boolean)));

    const itemHtml = (e) => {
        const tag = e.kind === 'step' ? '<i class="yzlog-tag step">步骤</i>'
            : (e.pending ? '<i class="yzlog-tag pend">进行中</i>' : (e.ok === false ? '<i class="yzlog-tag fail">失败</i>' : '<i class="yzlog-tag ok">成功</i>'));
        const kind = e.kind === 'ai' ? 'AI 调用' : (e.kind === 'net' ? (e.method || '请求') : '');
        const ms = e.kind === 'step' ? '' : (e.pending ? `${fmtMs(Date.now() - e.ts)}…` : fmtMs(e.ms || 0));
        const sub = e.kind === 'step' ? e.label
            : [e.model, e.status ? `HTTP ${e.status}` : '', ms, e.error ? `❗${String(e.error).slice(0, 60)}` : (e.url ? e.url.replace(/^https?:\/\//, '').slice(0, 60) : '')].filter(Boolean).join(' · ');
        return `<div class="yzlog-item${e.parent ? ' is-child' : ''}" data-id="${esc(e.id)}">
            <div class="yzlog-row1"><span class="yzlog-app">${esc(e.app || '小手机')}</span>${kind ? `<i class="yzlog-tag">${esc(kind)}</i>` : ''}${tag}<span class="yzlog-time">${fmtTime(e.ts)}</span></div>
            <div class="yzlog-row2">${esc(sub)}</div>
        </div>`;
    };

    const listView = () => {
        const s = log.stats();
        const list = log.entries.filter(e => filter === 'all' || (filter === 'fail' ? (e.ok === false && !e.pending) : e.app === filter));
        mask.innerHTML = `
            <div class="yzlog-head"><button data-act="close">关闭</button><b>API 调用日志</b><button data-act="refresh">刷新</button></div>
            <div class="yzlog-tools">
                <select data-act="filter">
                    <option value="all">全部应用</option>
                    <option value="fail" ${filter === 'fail' ? 'selected' : ''}>只看失败</option>
                    ${apps().map(a => `<option value="${esc(a)}" ${filter === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
                </select>
                <button data-act="clear">清空</button>
                <span class="yzlog-sum">共 ${s.total} 次 · 失败 ${s.fail}${s.pending ? ` · 进行中 ${s.pending}` : ''}</span>
            </div>
            <div class="yzlog-list">${list.length ? list.map(itemHtml).join('') : '<div class="yzlog-empty">还没有记录。<br>在小手机里聊天、生成朋友圈、生图、语音后，这里会显示每次调用。<br>（刷新酒馆后只保留最近 40 条，内容会截短）</div>'}</div>`;
    };

    const detailView = (id) => {
        const e = log.entries.find(x => x.id === id);
        if (!e) { detailId = ''; listView(); return; }
        const children = log.entries.filter(x => x.parent === e.id);
        // 「AI 调用」和它下面的「网络请求」是同一次请求的两层记录：字段互相补齐，看哪一条都一样
        const parentEntry = e.parent ? log.entries.find(x => x.id === e.parent) : null;
        const shownModel = e.model || children.find(c => c.model)?.model || parentEntry?.model || '';
        const shownAppId = e.appId || parentEntry?.appId || '';
        const shownUrl = e.url || children[0]?.url || '';
        const shownMethod = e.method || children[0]?.method || '';
        // 输入 / 原始返回 很长：默认折叠，点标题展开；展开状态在自动刷新时保留
        const FOLD_KEYS = new Set(['input', 'raw', 'options']);
        const block = (title, text, key) => {
            if (!text) return '';
            const str = String(text);
            if (!FOLD_KEYS.has(key)) {
                return `<div class="yzlog-block"><h4>${title}<button data-copy="${key}">复制</button></h4><pre>${esc(str)}</pre></div>`;
            }
            const open = openBlocks.has(`${e.id}:${key}`);
            return `<div class="yzlog-block is-fold${open ? ' is-open' : ''}"><h4 data-fold="${key}"><span class="yzlog-fold-arrow">${open ? '▾' : '▸'}</span>${title}<em>${str.length} 字${open ? '' : ' · 点开查看'}</em><button data-copy="${key}">复制</button></h4>${open ? `<pre>${esc(str)}</pre>` : ''}</div>`;
        };
        mask.innerHTML = `
            <div class="yzlog-head"><button data-act="back">返回</button><b>${esc(e.app || '小手机')}</b><button data-act="close">关闭</button></div>
            <div class="yzlog-detail">
                <div class="yzlog-kv">
                    <div><span>类型</span>${esc(e.kind === 'ai' ? 'AI 调用（应用层）' : (e.kind === 'step' ? '步骤记录' : '网络请求'))}</div>
                    <div><span>时间</span>${fmtTime(e.ts)}</div>
                    ${e.kind !== 'step' ? `<div><span>耗时</span>${e.pending ? `进行中（已 ${fmtMs(Date.now() - e.ts)}）` : fmtMs(e.ms || 0)}</div>` : ''}
                    ${e.kind === 'net' && parentEntry ? '<div><span>说明</span>列表里紧挨着的那条「AI 调用」实际发出的网络请求</div>' : ''}
                    ${e.kind !== 'step' ? `<div><span>结果</span>${e.pending ? '等待返回…' : (e.ok === false ? '失败' : '成功')}${e.status ? `（HTTP ${e.status}）` : ''}</div>` : ''}
                    ${shownModel ? `<div><span>模型</span>${esc(shownModel)}</div>` : ''}
                    ${shownAppId ? `<div><span>应用 ID</span>${esc(shownAppId)}</div>` : ''}
                    ${shownUrl ? `<div><span>地址</span>${esc(shownMethod)} ${esc(shownUrl)}</div>` : ''}
                    ${e.kind === 'step' ? `<div><span>内容</span>${esc(e.label)}</div>` : ''}
                    ${children.length ? `<div><span>网络请求</span>${children.length} 次（列表里缩进显示）</div>` : (e.kind === 'ai' && !e.pending ? '<div><span>网络请求</span>没有抓到（可能走了酒馆当前预设，或请求没发出去）</div>' : '')}
                    ${e.restored ? '<div style="color:#999">这条是刷新前的记录，内容已截短</div>' : ''}
                </div>
                ${block('错误', e.error, 'error')}
                ${block('输入', e.input, 'input')}
                ${block('输出', e.output, 'output')}
                ${e.raw && e.raw !== e.output ? block('原始返回', e.raw, 'raw') : ''}
                ${e.options ? block('参数', e.options, 'options') : ''}
            </div>`;
        mask.querySelectorAll('[data-fold]').forEach(h => h.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-copy]')) return;
            const k = `${e.id}:${h.dataset.fold}`;
            if (openBlocks.has(k)) openBlocks.delete(k); else openBlocks.add(k);
            const top = mask.querySelector('.yzlog-detail')?.scrollTop || 0;
            detailView(id);
            const d = mask.querySelector('.yzlog-detail');
            if (d) d.scrollTop = top;
        }));
        mask.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const text = String(e[b.dataset.copy] || '');
            try { navigator.clipboard?.writeText(text); b.textContent = '已复制'; } catch (err) { b.textContent = '复制失败'; }
        }));
    };

    const render = () => (detailId ? detailView(detailId) : listView());
    mask.addEventListener('click', (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'close') { off(); mask.remove(); return; }
        if (act === 'back') { detailId = ''; render(); return; }
        if (act === 'refresh') { render(); return; }
        if (act === 'clear') { if (confirm('清空全部调用日志？')) { log.clear(); } return; }
        const item = ev.target.closest('.yzlog-item');
        if (item) { detailId = item.dataset.id; render(); }
    });
    mask.addEventListener('change', (ev) => {
        if (ev.target.matches('[data-act="filter"]')) { filter = ev.target.value; render(); }
    });
    // 列表页自动刷新（进行中的耗时会跳动）；详情页只在这条结束时刷新一次
    let timer = null;
    const tick = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!mask.isConnected) return;
            if (!detailId) { const top = mask.querySelector('.yzlog-list')?.scrollTop || 0; listView(); const l = mask.querySelector('.yzlog-list'); if (l) l.scrollTop = top; }
            else { const e = log.entries.find(x => x.id === detailId); if (e?.pending) { const top = mask.querySelector('.yzlog-detail')?.scrollTop || 0; detailView(detailId); const d = mask.querySelector('.yzlog-detail'); if (d) d.scrollTop = top; } }
        }, 250);
    };
    const off = log.onChange(tick);
    const pulse = setInterval(() => { if (!mask.isConnected) { clearInterval(pulse); off(); return; } if (!detailId && log.stats().pending) tick(); }, 1000);
    render();
    return mask;
}

// 任何地方放一个 data-yz-apilog-open 的按钮都能打开日志
if (!window.__yzApiLogDelegated) {
    window.__yzApiLogDelegated = true;
    document.addEventListener('click', (e) => {
        const btn = e.target.closest?.('[data-yz-apilog-open]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const host = btn.closest('.phone-screen') || null;
        openApiLogPanel(host);
    }, true);
}
