// 🎨 聊天主题转换器：把「糯叽机」的聊天界面美化 CSS 自动转换成柚月小手机的聊天界面
//
// 思路（不靠一一对照硬改）：
//   1. 解析 CSS（注释 / 字符串 / @media / @supports / @keyframes 都能处理）
//   2. 把糯叽机的类名换成柚月聊天界面里对应的元素（气泡、头像、顶栏、输入栏、翻译、引用、转账……）
//      对不上的选择器直接丢弃，不会误伤别的页面
//   3. 糯叽机里那一大套 CSS 变量（--bubble-me-bg、--chat-header-bg ……）在这里重新“接线”到柚月的元素上
//   4. 界面按钮（返回、设置、快捷回复、重新生成、表情、更多、发送）一律不允许被隐藏或挪出界面；
//      主题如果给按钮换了图标就换上，没换就保留柚月原本的图标并染成主题颜色
//   5. 所有规则都限定在「开启了导入主题的聊天界面」里，并加上 !important，原来的气泡样式不再起作用

// :not(#yzt-none) 多加一层 ID 权重，保证盖过原来的气泡样式（它们本身带 ID + !important）
export const YZT_ROOT = 'html[data-yzt-theme][data-yzt-theme] :is(#phone-panel-content, body) .wechat-app:not(#yzt-none):has(.chat-room)';
const ROOT = YZT_ROOT;
const PHONE_WIDTH = 390; // 媒体查询按手机宽度来判断

// ───────────────────────────── 1. CSS 解析 ─────────────────────────────

function stripComments(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
            out += src.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? n : end + 2;
            out += ' ';
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

// 读到 stopChars 中任一字符（深度 0、不在字符串里）为止
function readUntil(src, i, stopChars) {
    let depth = 0;
    const n = src.length;
    let j = i;
    while (j < n) {
        const c = src[j];
        if (c === '"' || c === "'") {
            let k = j + 1;
            while (k < n && src[k] !== c) { if (src[k] === '\\') k++; k++; }
            j = k + 1;
            continue;
        }
        if (depth === 0 && stopChars.includes(c)) return j;
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        j++;
    }
    return n;
}

// 从 { 后面开始，找到配对的 }
function readBlock(src, i) {
    let depth = 1;
    const n = src.length;
    let j = i;
    while (j < n) {
        const c = src[j];
        if (c === '"' || c === "'") {
            let k = j + 1;
            while (k < n && src[k] !== c) { if (src[k] === '\\') k++; k++; }
            j = k + 1;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return j; }
        j++;
    }
    return n;
}

const NESTED_AT = /^@(media|supports|container|layer|document|-moz-document)\b/i;

function parseList(src) {
    const nodes = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
        while (i < n && /\s|;/.test(src[i])) i++;
        if (i >= n) break;
        if (src[i] === '}') { i++; continue; }
        const stop = readUntil(src, i, '{;}');
        const prelude = src.slice(i, stop).trim();
        if (stop >= n) break;
        if (src[stop] === ';' || src[stop] === '}') {
            if (prelude.startsWith('@')) nodes.push({ type: 'at-stmt', text: prelude });
            i = stop + 1;
            continue;
        }
        const end = readBlock(src, stop + 1);
        const body = src.slice(stop + 1, end);
        i = end + 1;
        if (!prelude) continue;
        if (prelude.startsWith('@')) {
            if (NESTED_AT.test(prelude)) nodes.push({ type: 'at-block', prelude, children: parseList(body) });
            else nodes.push({ type: 'at-raw', prelude, body });
            continue;
        }
        // CSS 嵌套写法：只取声明部分，嵌套的子规则展开成普通规则
        const decls = [];
        const nested = [];
        let k = 0;
        while (k < body.length) {
            const s = readUntil(body, k, '{;');
            if (s >= body.length) { const t = body.slice(k).trim(); if (t) decls.push(t); break; }
            if (body[s] === ';') { const t = body.slice(k, s).trim(); if (t) decls.push(t); k = s + 1; continue; }
            const e = readBlock(body, s + 1);
            const sub = body.slice(k, s).trim();
            if (sub && !sub.startsWith('@')) {
                const parentSels = splitTopLevel(prelude, ',');
                const childSels = splitTopLevel(sub, ',');
                const combined = [];
                parentSels.forEach(p => childSels.forEach(c => {
                    combined.push(c.includes('&') ? c.replace(/&/g, p.trim()) : `${p.trim()} ${c.trim()}`);
                }));
                nested.push({ type: 'rule', selector: combined.join(', '), decls: parseDecls(body.slice(s + 1, e)) });
            }
            k = e + 1;
        }
        nodes.push({ type: 'rule', selector: prelude, decls: parseDecls(decls.join(';')) });
        nested.forEach(r => nodes.push(r));
    }
    return nodes;
}

function splitTopLevel(text, sep) {
    const parts = [];
    let i = 0;
    while (i <= text.length) {
        const j = readUntil(text, i, sep);
        parts.push(text.slice(i, j));
        if (j >= text.length) break;
        i = j + 1;
    }
    return parts.map(s => s.trim()).filter(Boolean);
}

function parseDecls(body) {
    const out = [];
    splitTopLevel(body, ';').forEach(raw => {
        const idx = raw.indexOf(':');
        if (idx <= 0) return;
        const prop = raw.slice(0, idx).trim();
        let value = raw.slice(idx + 1).trim();
        let important = false;
        const m = value.match(/!\s*important\s*$/i);
        if (m) { important = true; value = value.slice(0, m.index).trim(); }
        if (!prop || (!value && !prop.startsWith('--'))) return;
        out.push({ prop: prop.startsWith('--') ? prop : prop.toLowerCase(), value, important });
    });
    return out;
}

// ───────────────────────────── 2. 选择器解析 ─────────────────────────────

const IDENT = /[-_a-zA-Z0-9\u00a0-\uffff\\]/;

function parseCompoundsAndCombinators(sel) {
    // 返回 { compounds: [...], combs: [...] }，combs[i] 是 compounds[i] 与 compounds[i+1] 之间的连接符
    const compounds = [];
    const combs = [];
    let i = 0;
    const s = sel.trim();
    const n = s.length;
    let cur = null;
    let pendingComb = null;
    const newCompound = () => ({ tag: '', classes: [], ids: [], attrs: [], pseudos: [] });
    const flush = () => {
        if (cur) {
            if (compounds.length) combs.push(pendingComb || ' ');
            compounds.push(cur);
            cur = null;
            pendingComb = null;
        }
    };
    const readIdent = () => {
        let j = i;
        while (j < n && IDENT.test(s[j])) { if (s[j] === '\\') j++; j++; }
        const id = s.slice(i, j);
        i = j;
        return id;
    };
    while (i < n) {
        const c = s[i];
        if (/\s/.test(c) || c === '>' || c === '+' || c === '~') {
            let comb = ' ';
            while (i < n && (/\s/.test(s[i]) || s[i] === '>' || s[i] === '+' || s[i] === '~')) {
                if (s[i] !== ' ' && !/\s/.test(s[i])) comb = s[i];
                i++;
            }
            if (cur) { flush(); pendingComb = comb; }
            else if (!compounds.length) pendingComb = comb; // 以连接符开头（:has 里的相对选择器）
            else pendingComb = comb;
            continue;
        }
        if (!cur) cur = newCompound();
        if (c === '.') { i++; cur.classes.push(readIdent()); continue; }
        if (c === '#') { i++; cur.ids.push(readIdent()); continue; }
        if (c === '[') {
            const j = readUntil(s, i + 1, ']');
            cur.attrs.push(s.slice(i, j + 1));
            i = j + 1;
            continue;
        }
        if (c === ':') {
            const isEl = s[i + 1] === ':';
            i += isEl ? 2 : 1;
            const name = readIdent().toLowerCase();
            let arg = null;
            if (s[i] === '(') {
                const j = readUntil(s, i + 1, ')');
                arg = s.slice(i + 1, j);
                i = j + 1;
            }
            // 旧写法 :before / :after 也算伪元素
            const el = isEl || ['before', 'after', 'first-line', 'first-letter', 'placeholder', 'selection'].includes(name);
            cur.pseudos.push({ name, arg, el });
            continue;
        }
        if (c === '*') { cur.tag = '*'; i++; continue; }
        if (c === '&') { cur.tag = '&'; i++; continue; }
        if (IDENT.test(c)) { cur.tag = readIdent().toLowerCase(); continue; }
        // 无法识别的字符：放弃这个选择器
        return null;
    }
    flush();
    return { compounds, combs, leadingComb: compounds.length && combs.length === compounds.length ? combs.shift() : null };
}

const SELECTOR_LIST_PSEUDOS = new Set(['is', 'where', 'matches', '-webkit-any', 'not', 'has']);

// 把 :is(a, b) 展开成多个选择器（参数只是一个复合选择器时）
function expandIs(parsed, limit = 96) {
    let variants = [parsed];
    for (let ci = 0; ci < parsed.compounds.length; ci++) {
        const next = [];
        for (const v of variants) {
            const comp = v.compounds[ci];
            const isIdx = comp.pseudos.findIndex(p => ['is', 'where', 'matches', '-webkit-any'].includes(p.name) && p.arg != null);
            if (isIdx < 0) { next.push(v); continue; }
            const p = comp.pseudos[isIdx];
            const args = splitTopLevel(p.arg, ',');
            let ok = true;
            const subs = args.map(a => {
                const sub = parseCompoundsAndCombinators(a);
                if (!sub || sub.compounds.length !== 1 || sub.leadingComb) { ok = false; return null; }
                return sub.compounds[0];
            });
            if (!ok) return null; // :is 里面有组合选择器，放弃
            subs.forEach(sc => {
                const merged = {
                    tag: comp.tag || sc.tag,
                    classes: [...comp.classes, ...sc.classes],
                    ids: [...comp.ids, ...sc.ids],
                    attrs: [...comp.attrs, ...sc.attrs],
                    pseudos: [...comp.pseudos.slice(0, isIdx), ...sc.pseudos, ...comp.pseudos.slice(isIdx + 1)]
                };
                const compounds = v.compounds.slice();
                compounds[ci] = merged;
                next.push({ ...v, compounds });
            });
        }
        variants = next;
        if (variants.length > limit) return null;
        // 同一个复合选择器里可能还有第二个 :is，再处理一遍
        if (variants.some(v => v.compounds[ci].pseudos.some(p => ['is', 'where', 'matches', '-webkit-any'].includes(p.name) && p.arg != null))) ci--;
    }
    return variants;
}

// ───────────────────────────── 3. 类名对照表 ─────────────────────────────
// lvl: 'root' = 顶层（顶栏），'room' = 聊天区（输入栏、时间、系统消息），'msg' = 消息行里面
// side: 'L' 对方 / 'R' 自己；role: 用来决定哪些属性能保留

const SIDE_CLASS = { L: '.message-left', R: '.message-right' };

const HEADER = '> .wechat-header';
const INPUT_AREA = '.chat-input-area';

const MAP = {
    // ── 根 ──
    'chat-detail-screen': { root: true },
    // ── 消息区 ──
    'chat-messages-area': { lvl: 'room', path: ['.chat-messages'], role: 'messages' },
    'chat-message-list-custom': { lvl: 'room', path: ['.chat-messages'], role: 'messages' },
    // ── 顶栏 ──
    'chat-header-custom': { lvl: 'root', path: [HEADER], role: 'header' },
    'glass-header': { lvl: 'root', path: [HEADER], role: 'header' },
    'header-profile-section': { lvl: 'root', path: [HEADER, '.wechat-header-title'], role: 'hpart' },
    'header-avatar-container': { lvl: 'root', path: [HEADER, '.wx-head-avatar'], role: 'hpart' },
    'chat-header-avatar': { lvl: 'root', path: [HEADER, '.wx-head-avatar', ':is(img, span, div)'], role: 'hpart' },
    'chat-header-title': { lvl: 'root', path: [HEADER, '.wechat-header-title-text'], role: 'hpart' },
    'chat-header-subtitle': { lvl: 'root', path: [HEADER, '.wx-head-sub'], role: 'hpart' },
    'chat-header-icon': { lvl: 'root', path: [HEADER, ':is(.wechat-back-btn, .wechat-header-btn)'], role: 'btn', btn: 'icons' },
    'header-btn-back': { lvl: 'root', path: [HEADER, '.wechat-back-btn'], role: 'btn', btn: 'back' },
    'header-btn-info': { lvl: 'root', path: [HEADER, '#chat-info'], role: 'btn', btn: 'info' },
    'header-action-btn': { lvl: 'root', path: [HEADER, '.wechat-header-right .wechat-header-btn'], role: 'btn', btn: 'action', chrome: true },
    // ── 输入栏 ──
    'input-area-custom': { lvl: 'room', path: [INPUT_AREA], role: 'inputArea' },
    'input-row-wrapper': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar'], role: 'inputBar' },
    'input-action-bar-custom': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '.yzt-action-bar'], role: 'actionBar' },
    'input-btns-right': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '.yzt-btns-right'], role: 'btnGroup' },
    'input-box-custom': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#chat-input'], role: 'input' },
    'input-btn-plus': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#send-btn'], role: 'btn', btn: 'plus' },
    'input-btn-sticker': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#emoji-btn'], role: 'btn', btn: 'sticker' },
    'input-btn-mic': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', ':is(#quick-reply-btn, #regenerate-btn)'], role: 'btn', btn: 'mic', chrome: true },
    'input-btn-ai': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#send-now-btn:not(.has-text):not([data-mode="stop"])'], role: 'btn', btn: 'ai' },
    'send-btn-custom': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#send-now-btn.has-text:not([data-mode="stop"])'], role: 'btn', btn: 'send' },
    'stop-btn-custom': { lvl: 'room', path: [INPUT_AREA, '.chat-input-bar', '#send-now-btn[data-mode="stop"]'], role: 'btn', btn: 'stop' },
    'more-options-popup': { lvl: 'room', path: [INPUT_AREA, '.more-panel'], role: 'panel' },
    'more-options-item-row': { lvl: 'room', path: [INPUT_AREA, '.more-panel', '.more-item'], role: 'panel' },
    'input-reply-preview-bar': { lvl: 'room', path: [INPUT_AREA, '.wechat-active-quote-bar'], role: 'panel' },
    // ── 时间 / 系统 ──
    'timestamp-custom': { lvl: 'room', path: ['.time-divider-text'], role: 'misc' },
    'date-divider-custom': { lvl: 'room', path: ['.time-divider-text'], role: 'misc' },
    'msg-system': { lvl: 'room', path: ['.system-message-bubble'], role: 'misc' },
    'msg-narration-custom': { lvl: 'room', path: ['.system-message-bubble'], role: 'misc' },
    // ── 消息行 ──
    'msg-bubble-wrapper': { wrap: true },
    'msg-content-stack': { lvl: 'msg', path: ['> .message-content'], role: 'msg' },
    'bubble-me-custom': { lvl: 'msg', side: 'R', path: ['.message-text'], role: 'bubble' },
    'bubble-them-custom': { lvl: 'msg', side: 'L', path: ['.message-text'], role: 'bubble' },
    'msg-plain': { lvl: 'msg', path: ['.message-text'], role: 'bubble' },
    'msg-plain-me': { lvl: 'msg', side: 'R', path: ['.message-text'], role: 'bubble' },
    'msg-plain-them': { lvl: 'msg', side: 'L', path: ['.message-text'], role: 'bubble' },
    'msg-avatar-them-container': { lvl: 'msg', side: 'L', path: ['> .message-avatar'], role: 'avatar' },
    'msg-avatar-container': { lvl: 'msg', side: 'L', path: ['> .message-avatar'], role: 'avatar' },
    'msg-avatar-me-container': { lvl: 'msg', side: 'R', path: ['> .message-avatar'], role: 'avatar' },
    'msg-avatar-them-inner': { lvl: 'msg', side: 'L', path: ['> .message-avatar', '> *'], role: 'avatar' },
    'msg-avatar-me-inner': { lvl: 'msg', side: 'R', path: ['> .message-avatar', '> *'], role: 'avatar' },
    'msg-avatar-custom': { lvl: 'msg', path: ['> .message-avatar', 'img'], role: 'avatar' },
    // 翻译
    'msg-translation-wrapper': { lvl: 'msg', path: ['.wechat-trans-fold'], role: 'msg' },
    'msg-translation-content': { lvl: 'msg', path: ['.wechat-trans-fold-body'], role: 'msg' },
    'msg-translation-btn': { lvl: 'msg', path: ['.wechat-trans-fold-btn'], role: 'msg' },
    'msg-translation-detached': { lvl: 'msg', path: ['.yzt-trans-detached'], role: 'msg' },
    'msg-translation-detached-them': { lvl: 'msg', side: 'L', path: ['.yzt-trans-detached'], role: 'msg' },
    'msg-translation-detached-me': { lvl: 'msg', side: 'R', path: ['.yzt-trans-detached'], role: 'msg' },
    'msg-translation-detached-content': { lvl: 'msg', path: ['.yzt-trans-detached', '.yzt-trans-detached-content'], role: 'msg' },
    // 引用（具体对哪一个，取决于主题用的是气泡内还是气泡外，见 buildQuoteMap）
    // 转账 / 红包 / 图片 / 定位 / 音乐 / 语音
    'msg-transfer-card': { lvl: 'msg', path: [':is(.message-transfer, .message-redpacket)'], role: 'card' },
    'msg-transfer-container': { lvl: 'msg', path: [':is(.message-transfer, .message-redpacket)'], role: 'card' },
    'msg-transfer-wrapper': { lvl: 'msg', path: [':is(.message-transfer, .message-redpacket)'], role: 'card' },
    'msg-redpacket-card': { lvl: 'msg', path: ['.message-redpacket'], role: 'card', prio: 2 },
    'msg-transfer-amount': { lvl: 'msg', path: ['.rp-title'], role: 'card' },
    'msg-transfer-subtitle': { lvl: 'msg', path: ['.rp-subtitle'], role: 'card' },
    'msg-transfer-status': { lvl: 'msg', path: ['.rp-subtitle'], role: 'card' },
    'msg-transfer-status-text': { lvl: 'msg', path: ['.rp-subtitle'], role: 'card' },
    'msg-transfer-label': { lvl: 'msg', path: ['.rp-footer'], role: 'card' },
    'msg-transfer-footer': { lvl: 'msg', path: ['.rp-footer'], role: 'card' },
    'msg-transfer-note': { lvl: 'msg', path: ['.rp-subtitle'], role: 'card' },
    'msg-transfer-icon': { lvl: 'msg', path: ['.rp-icon'], role: 'card' },
    'msg-redpacket-emoji': { lvl: 'msg', path: ['.rp-icon'], role: 'card' },
    'msg-image-wrapper': { lvl: 'msg', path: ['.message-image-box'], role: 'card' },
    'msg-image-card': { lvl: 'msg', path: ['.message-image-box'], role: 'card' },
    'msg-loc-card': { lvl: 'msg', path: ['.message-location'], role: 'card' },
    'msg-music-card': { lvl: 'msg', path: ['.message-music-card'], role: 'card' },
    'voice-msg': { lvl: 'msg', path: ['.wechat-voice-message'], role: 'bubble' },
    'voice-controls-row': { lvl: 'msg', path: ['.voice-bubble-playable'], role: 'msg' },
    'voice-play-btn': { lvl: 'msg', path: ['.voice-wave-icon'], role: 'msg' },
    'voice-transcription': { lvl: 'msg', path: ['.wechat-voice-transcript-inner'], role: 'msg' },
    // 表情回应
    'msg-reaction-badge': { lvl: 'msg', path: ['.wechat-reaction-row'], role: 'msg' },
    'msg-reaction-badge-me': { lvl: 'msg', side: 'R', path: ['.wechat-reaction-row'], role: 'msg' },
    'msg-reaction-badge-them': { lvl: 'msg', side: 'L', path: ['.wechat-reaction-row'], role: 'msg' },
    'msg-reaction-emoji': { lvl: 'msg', path: ['.wechat-reaction-pill'], role: 'msg' },
    // 群聊：名字行 / 头衔
    'grp-sender-row': { lvl: 'msg', path: ['.message-sender'], role: 'msg' },
    'grp-sender-row-them': { lvl: 'msg', side: 'L', path: ['.message-sender'], role: 'msg' },
    'grp-sender-row-me': { lvl: 'msg', side: 'R', path: ['.message-sender'], role: 'msg' },
    'grp-sender-name': { lvl: 'msg', path: ['.message-sender-name'], role: 'msg' },
    'grp-title-badge': { lvl: 'msg', path: ['.wechat-sender-chip'], role: 'msg' },
    'grp-title-inner': { lvl: 'msg', path: ['.wechat-sender-chip'], role: 'msg', collapse: true },
    'grp-title-text': { lvl: 'msg', path: ['.wechat-sender-chip'], role: 'msg', collapse: true },
    'grp-title-level': { lvl: 'msg', path: ['.wechat-sender-chip'], role: 'msg', collapse: true }
};

// 消息行上的状态类（糯叽机写在行或气泡上，柚月统一挂在 .chat-message 上）
const WRAP_MODS = {
    'is-first': '.yzt-first', 'is-mid': '.yzt-mid', 'is-last': '.yzt-last', 'is-single': '.yzt-single',
    'first': '.yzt-first', 'mid': '.yzt-mid', 'last': '.yzt-last', 'single': '.yzt-single',
    'plain-first': '.yzt-first', 'plain-mid': '.yzt-mid', 'plain-last': '.yzt-last', 'plain-single': '.yzt-single',
    'has-reactions': ':has(.wechat-reaction-row)',
    'msg-streaming': '.yzt-never'
};
const WRAP_SIDE = { 'msg-me': 'R', 'msg-them': 'L' };
// 元素自身的状态类
const SELF_MODS = {
    'msg-transfer-success': '.opened', 'success': '', 'is-opened': '.opened',
    'is-owner': '.role-owner', 'is-admin': '.role-admin', 'is-member': '.role-member', 'is-lv3': '.role-member', 'is-lv5': '.role-member',
    'msg-translation-always-show': '', 'is-playing': '.yzt-never'
};

function buildQuoteMap(mode) {
    const q = {};
    const block = { lvl: 'msg', path: ['.wechat-quote-block'], role: 'msg' };
    const name = { lvl: 'msg', path: ['.wechat-quote-block', '.wechat-quote-sender'], role: 'msg' };
    const text = { lvl: 'msg', path: ['.wechat-quote-block', '.wechat-quote-text'], role: 'msg' };
    if (mode === 'detached') {
        q['msg-reply-block-detached'] = block;
        q['msg-reply-detached-them'] = { ...block, side: 'L' };
        q['msg-reply-detached-me'] = { ...block, side: 'R' };
        q['msg-reply-detached-name'] = name;
        q['msg-reply-detached-text'] = text;
        q['msg-reply-detached-media'] = text;
    } else {
        q['msg-reply-block'] = block;
        q['msg-reply-block-name'] = name;
        q['msg-reply-block-text'] = text;
        q['msg-reply-block-media'] = text;
    }
    return q;
}

// ───────────────────────────── 4. 选择器翻译 ─────────────────────────────

class Unmatched extends Error { }
const NEVER = () => { throw new Unmatched(); };

function translateAttr(attr, ctx) {
    const m = attr.match(/^\[\s*([-\w]+)\s*(?:([~|^$*]?=)\s*(["']?)(.*?)\3\s*)?(?:\s+[is])?\]$/);
    if (!m) return null;
    const [, name, op, , val] = m;
    if (name === 'data-chat-kind') return op ? `[data-yzt-kind${op}"${val}"]` : '[data-yzt-kind]';
    if (name === 'data-theme-style') {
        if (!ctx.themeStyle) return '';
        if (op === '=' && val !== ctx.themeStyle) return null;
        return '';
    }
    return null; // 其他属性（class*= / style*= / 自定义 data-）都对不上
}

const KEEP_PSEUDO = new Set(['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'first-child', 'last-child', 'only-child',
    'nth-child', 'nth-last-child', 'nth-of-type', 'first-of-type', 'last-of-type', 'empty', 'disabled', 'checked',
    'placeholder-shown', 'before', 'after', 'placeholder', 'first-line', 'first-letter', 'selection', '-webkit-scrollbar',
    '-webkit-scrollbar-thumb', '-webkit-scrollbar-track', 'marker']);

// 把一个复合选择器解析成“它代表柚月里的什么东西”
function resolveCompound(comp, ctx) {
    const desc = { kind: null, side: null, wrapMods: [], selfMods: [], pseudos: [], entry: null, tag: comp.tag || '' };
    if (comp.tag === '&') NEVER();
    const isRootTag = ['html', 'body'].includes(comp.tag);
    if (comp.ids.length) {
        for (const id of comp.ids) {
            if (id === 'chat-detail-screen') desc.kind = desc.kind || 'root';
            else if (id === 'chat-message-list-root') { desc.kind = 'el'; desc.entry = { lvl: 'room', path: ['.chat-messages'], role: 'messages' }; }
            else NEVER();
        }
    }
    if (isRootTag) desc.kind = desc.kind || 'root';
    const map = ctx.map;
    let best = null;
    for (const cls of comp.classes) {
        const e = map[cls];
        if (e) {
            if (e.root) { if (!desc.kind) desc.kind = 'root'; continue; }
            if (e.wrap) { if (!best) desc.kind = 'wrap'; continue; }
            if (!best || (e.prio || 1) > (best.prio || 1)) best = e;
            continue;
        }
        if (WRAP_SIDE[cls]) {
            const s = WRAP_SIDE[cls];
            if (desc.side && desc.side !== s) NEVER();
            desc.side = s;
            continue;
        }
        if (cls in WRAP_MODS) { desc.wrapMods.push(WRAP_MODS[cls]); continue; }
        if (cls in SELF_MODS) { if (SELF_MODS[cls]) desc.selfMods.push(SELF_MODS[cls]); continue; }
        NEVER();
    }
    if (best) {
        desc.kind = 'el';
        desc.entry = best;
        if (best.side) {
            if (desc.side && desc.side !== best.side) NEVER();
            desc.side = best.side;
        }
    } else if (!desc.kind && (desc.side || desc.wrapMods.length)) {
        desc.kind = 'wrap';
    }
    for (const a of comp.attrs) {
        const t = translateAttr(a, ctx);
        if (t == null) NEVER();
        if (t) desc.selfMods.push(t);
    }
    if (!desc.kind) {
        if (comp.tag && comp.tag !== '*') desc.kind = 'tag';
        else if (comp.tag === '*') desc.kind = 'tag';
        else if (comp.pseudos.some(p => p.name === 'root')) desc.kind = 'root';
        else if (comp.pseudos.length) desc.kind = 'bare';
        else NEVER();
    }
    if (comp.pseudos.some(p => p.name === 'root')) desc.kind = desc.kind === 'tag' || !desc.kind ? 'root' : desc.kind;
    for (const p of comp.pseudos) {
        if (p.name === 'root') continue;
        if (p.name === 'not') {
            const t = translateNot(p.arg, desc, ctx);
            if (t) (t.wrap ? desc.wrapMods : desc.pseudos).push(t.sel);
            continue;
        }
        if (p.name === 'has') {
            const t = translateHas(p.arg, desc, ctx);
            desc.pseudos.push(t);
            continue;
        }
        if (KEEP_PSEUDO.has(p.name)) {
            desc.pseudos.push(`${p.el ? '::' : ':'}${p.name}${p.arg != null ? `(${p.arg})` : ''}`);
            continue;
        }
        NEVER();
    }
    return desc;
}

function translateNot(arg, desc, ctx) {
    const parts = splitTopLevel(arg, ',');
    const sels = [];
    let wrapLevel = false;
    for (const part of parts) {
        const parsed = parseCompoundsAndCombinators(part);
        if (!parsed || parsed.compounds.length !== 1) continue; // 复杂的 :not 直接忽略（按“永远成立”处理）
        const c = parsed.compounds[0];
        try {
            const d = resolveCompound(c, ctx);
            // :not(.msg-me) 这类：变成消息行上的 :not(.message-right)
            if (d.kind === 'wrap' && !d.entry) {
                const s = `${d.side ? SIDE_CLASS[d.side] : ''}${d.wrapMods.join('')}${d.pseudos.join('')}`;
                if (s) { sels.push(s); wrapLevel = desc.kind !== 'wrap'; }
                continue;
            }
            if (d.kind === 'bare' || (d.kind === desc.kind && d.entry === desc.entry)) {
                const s = `${d.selfMods.join('')}${d.pseudos.join('')}`;
                if (s) sels.push(s);
                continue;
            }
            if (d.kind === 'el' && d.entry && desc.kind === 'el' && d.entry !== desc.entry) {
                // :not(.另一种元素) → 永远成立
                continue;
            }
        } catch (e) {
            if (!(e instanceof Unmatched)) throw e;
            // 对不上的类 → :not 永远成立，直接去掉
        }
    }
    if (!sels.length) return null;
    return { sel: `:not(${sels.join(', ')})`, wrap: wrapLevel };
}

function translateHas(arg, desc, ctx) {
    const parts = splitTopLevel(arg, ',');
    const frags = [];
    let side = null;
    for (const part of parts) {
        try {
            const parsed = parseCompoundsAndCombinators(part);
            if (!parsed) continue;
            const variants = expandIs(parsed);
            if (!variants) continue;
            for (const v of variants) {
                const r = buildSelector(v, ctx, { inner: true });
                if (!r) continue;
                frags.push(r.frag);
                if (r.side) side = side && side !== r.side ? 'X' : r.side;
            }
        } catch (e) {
            if (!(e instanceof Unmatched)) throw e;
        }
    }
    if (!frags.length) NEVER();
    if (side && side !== 'X' && desc.kind === 'wrap') {
        if (desc.side && desc.side !== side) NEVER();
        desc.side = side;
    }
    return `:has(${[...new Set(frags)].join(', ')})`;
}

function lastSeg(path) { return path[path.length - 1]; }

// 把一个已经展开 :is 的选择器拼成柚月选择器
function buildSelector(parsed, ctx, { inner = false } = {}) {
    const descs = parsed.compounds.map(c => resolveCompound(c, ctx));
    let rootMods = '';
    let wrap = null;              // { side, mods:[], pseudos:[] }
    let pre = [];                 // 消息行之前（聊天区里）的片段
    const segsOut = [];           // 当前正在拼的片段（没有消息行时就是全部）
    let curPath = null;           // 当前元素的路径（数组），用于前缀合并
    let lvl = null;
    let subject = null;
    let subjectPseudoEl = false;
    let seenRoot = false;
    let roleEntry = null;

    const pseudoStr = d => d.selfMods.join('') + d.pseudos.join('');
    const openWrap = (side = null) => {
        wrap = { side, mods: [], pseudos: [] };
        pre = segsOut.splice(0);
        curPath = null;
    };

    descs.forEach((d) => {
        if (d.kind === 'root') {
            if (inner || curPath || wrap || segsOut.length) NEVER();
            seenRoot = true;
            rootMods += d.selfMods.join('') + d.pseudos.filter(p => !p.startsWith('::')).join('');
            subject = { kind: 'root' };
            subjectPseudoEl = d.pseudos.some(p => p.startsWith('::'));
            return;
        }
        if (d.kind === 'wrap') {
            if (inner) NEVER();
            if (wrap) {
                if (lvl !== 'wrap') NEVER(); // 消息行里面不会再套消息行
                if (d.side && wrap.side && d.side !== wrap.side) NEVER();
                wrap.side = wrap.side || d.side;
            } else {
                if (lvl === 'root') NEVER();
                openWrap(d.side);
            }
            wrap.mods.push(...d.wrapMods);
            wrap.pseudos.push(pseudoStr(d));
            lvl = 'wrap';
            subject = { kind: 'wrap' };
            roleEntry = null;
            subjectPseudoEl = d.pseudos.some(p => p.startsWith('::'));
            return;
        }
        if (d.kind === 'el') {
            const e = d.entry;
            const p = pseudoStr(d);
            if (e.lvl === 'msg') {
                if ((d.side || d.wrapMods.length) && !inner) {
                    if (!wrap) { if (lvl === 'root') NEVER(); openWrap(null); lvl = 'wrap'; }
                    if (d.side && wrap.side && d.side !== wrap.side) NEVER();
                    wrap.side = wrap.side || d.side;
                    wrap.mods.push(...d.wrapMods);
                }
                if (lvl === 'root') NEVER();
                let segs = e.path.slice();
                if (curPath && lvl === 'msg') {
                    let k = 0;
                    while (k < curPath.length && k < segs.length && curPath[k] === segs[k]) k++;
                    if (k === curPath.length) segs = segs.slice(k);
                    else if (e.collapse && lastSeg(curPath) === lastSeg(e.path)) segs = [];
                }
                const rightAfterWrap = wrap && lvl === 'wrap' && !segsOut.length;
                segs = segs.map((s, i) => (i === 0 && s.startsWith('> ') && !rightAfterWrap ? s.slice(2) : s));
                if (segs.length) { segs[segs.length - 1] += p; segsOut.push(...segs); }
                else if (p) segsOut[segsOut.length - 1] += p;
                curPath = (curPath && lvl === 'msg' && segs.length < e.path.length) ? e.path.slice() : e.path.slice();
                lvl = 'msg';
                subject = { kind: 'el', entry: e, side: d.side || null };
                roleEntry = e;
                subjectPseudoEl = d.pseudos.some(x => x.startsWith('::'));
                return;
            }
            // 顶层 / 聊天区元素
            if (wrap) NEVER();
            let segs = e.path.slice();
            if (curPath) {
                let k = 0;
                while (k < curPath.length && k < segs.length && curPath[k] === segs[k]) k++;
                if (k === curPath.length) segs = segs.slice(k);
                else {
                    if (segs[0] === HEADER || curPath[0] === HEADER) NEVER();
                    if (segs[0] === INPUT_AREA && curPath[0] !== INPUT_AREA) NEVER();
                    if (segs[0] === INPUT_AREA) segs = segs.slice(1);
                }
            } else if (inner) {
                segs = [lastSeg(segs)];
            }
            if (segs.length) { segs[segs.length - 1] += p; segsOut.push(...segs); }
            else if (p && segsOut.length) segsOut[segsOut.length - 1] += p;
            curPath = e.path.slice();
            lvl = e.lvl;
            subject = { kind: 'el', entry: e };
            roleEntry = e;
            subjectPseudoEl = d.pseudos.some(x => x.startsWith('::'));
            return;
        }
        if (d.kind === 'tag' || d.kind === 'bare') {
            if (!curPath && !wrap && !inner) {
                if (seenRoot && d.kind === 'bare') { rootMods += pseudoStr(d); return; }
                NEVER(); // 光秃秃的 img / div / * 太宽泛，不要
            }
            let tag = d.kind === 'bare' ? '*' : (d.tag || '*');
            if (tag === 'svg' || tag === 'i') tag = ':is(svg, i)';
            segsOut.push(`${tag}${pseudoStr(d)}`);
            subject = { kind: 'tag', tag: d.tag, parentEntry: roleEntry, parentKind: wrap && !roleEntry ? 'wrap' : null };
            subjectPseudoEl = d.pseudos.some(x => x.startsWith('::'));
            return;
        }
        NEVER();
    });

    if (inner) {
        const frag = segsOut.join(' ').replace(/^>\s*/, '');
        if (!frag) NEVER();
        return { frag, side: subject?.side || null };
    }

    let sel = `${ROOT}${rootMods}`;
    if (wrap) {
        if (pre.length) sel += ' ' + pre.join(' ').replace(/^>\s*/, '');
        sel += ` .chat-message:not(.message-system)${wrap.side ? SIDE_CLASS[wrap.side] : ''}${wrap.mods.join('')}${wrap.pseudos.join('')}`;
    }
    if (segsOut.length) sel += ' ' + segsOut.join(' ');
    sel = sel.replace(/\s+/g, ' ').trim();
    return {
        sel,
        subject,
        pseudoEl: subjectPseudoEl,
        entry: subject?.kind === 'el' ? subject.entry : (subject?.kind === 'tag' ? subject.parentEntry : null),
        isTag: subject?.kind === 'tag',
        isRoot: subject?.kind === 'root',
        isWrap: subject?.kind === 'wrap' || (subject?.kind === 'tag' && subject.parentKind === 'wrap')
    };
}

function translateSelectorList(selectorText, ctx) {
    const out = [];
    let dropped = 0;
    for (const raw of splitTopLevel(selectorText, ',')) {
        const parsed = parseCompoundsAndCombinators(raw);
        if (!parsed || !parsed.compounds.length || parsed.leadingComb) { dropped++; continue; }
        if (parsed.combs.some(c => c === '+' || c === '~')) { dropped++; continue; }
        const variants = expandIs(parsed);
        if (!variants) { dropped++; continue; }
        let any = false;
        for (const v of variants) {
            try {
                const r = buildSelector(v, ctx);
                if (r) { out.push(r); any = true; }
            } catch (e) {
                if (!(e instanceof Unmatched)) throw e;
            }
        }
        if (!any) { dropped++; if (ctx.droppedList) ctx.droppedList.push(raw.trim()); }
    }
    return { items: out, dropped };
}

// ───────────────────────────── 5. 属性过滤 / 改写 ─────────────────────────────

function splitSpaces(value) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of String(value).trim()) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (/\s/.test(ch) && depth === 0) { if (cur) parts.push(cur); cur = ''; continue; }
        cur += ch;
    }
    if (cur) parts.push(cur);
    return parts;
}

const OFFSETS = new Set(['top', 'left', 'right', 'bottom', 'inset', 'inset-block', 'inset-inline', 'inset-block-start', 'inset-inline-start']);

function rewriteValue(value) {
    return String(value)
        .replace(/env\(\s*safe-area-inset-top\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/gi, 'var(--yzt-safe-top)')
        .replace(/env\(\s*safe-area-inset-(?:bottom|left|right)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/gi, '0px')
        .replace(/(-?\d*\.?\d+)\s*vw\b/g, (m, num) => `calc(${num} * var(--yzt-vw, 3.9px))`)
        .replace(/(-?\d*\.?\d+)\s*d?vh\b/g, (m, num) => `calc(${num} * var(--yzt-vh, 8px))`);
}

const isHidingDecl = (prop, value) => {
    const v = String(value).trim().toLowerCase();
    if (prop === 'display' && v === 'none') return true;
    if (prop === 'visibility' && (v === 'hidden' || v === 'collapse')) return true;
    if (prop === 'opacity' && parseFloat(v) < 0.25) return true;
    if (prop === 'content-visibility' && v === 'hidden') return true;
    return false;
};

const hasIconImage = (value, vars) => {
    const v = String(value);
    if (/url\(/i.test(v)) return true;
    const m = v.match(/var\(\s*(--[-\w]+)/);
    if (m && vars[m[1]] && /url\(/i.test(vars[m[1]])) return true;
    return false;
};

const tinySize = v => {
    const m = String(v).trim().match(/^(-?\d*\.?\d+)(px)?$/);
    return m ? parseFloat(m[1]) < 14 : false;
};

// 每种元素允许保留哪些属性
function filterDecls(decls, item, ctx) {
    const role = item.entry?.role || (item.isRoot ? 'root' : (item.isWrap ? 'wrap' : 'misc'));
    const isIcon = item.isTag && item.entry?.role === 'btn';
    const btnKey = item.entry?.btn;
    const chrome = !!item.entry?.chrome;
    const out = [];
    const hadFixed = decls.some(d => d.prop === 'position' && /fixed/i.test(d.value));
    const hadAbs = decls.some(d => d.prop === 'position' && /absolute/i.test(d.value));
    for (const d0 of decls) {
        const d = { ...d0, value: rewriteValue(d0.value) };
        const prop = d.prop;
        if (prop.startsWith('--')) {
            // 安全区变量统一换成柚月的状态栏高度
            if (/safe/i.test(prop)) {
                if (/top/i.test(prop)) d.value = 'var(--yzt-safe-top)';
                else if (/bottom|left|right/i.test(prop)) d.value = '0px';
            }
            out.push(d);
            continue;
        }
        if (prop === 'position' && /fixed/i.test(d.value)) {
            if (['header', 'hpart', 'btn', 'messages', 'inputArea', 'inputBar', 'input', 'actionBar', 'btnGroup', 'root'].includes(role)) continue;
            d.value = 'absolute';
        }
        // 翻译块往上拽得太狠会压住正文，最多只往上收 2px
        if (prop === 'margin-top' && item.entry?.path?.[0] === '.wechat-trans-fold' && /^-/.test(String(d.value).trim())) d.value = '-2px';
        if (role === 'root') {
            // 根节点只留颜色 / 背景 / 字体
            if (!/^(background|color|font|letter-spacing|line-height|text-|-webkit-font-smoothing|color-scheme|accent-color|caret-color)/.test(prop)) continue;
            out.push(d);
            continue;
        }
        if (role === 'header') {
            if (OFFSETS.has(prop) || ['display', 'position', 'width', 'flex', 'flex-direction', 'contain', 'padding-top', 'margin', 'margin-top', 'transform', 'inset'].includes(prop)) continue;
            if (prop === 'padding') {
                const parts = splitSpaces(d.value);
                const t = parts[0] || '0';
                const r = parts[1] || t;
                const b = parts[2] || t;
                const l = parts[3] || r;
                out.push({ prop: 'padding-right', value: r }, { prop: 'padding-bottom', value: b }, { prop: 'padding-left', value: l });
                continue;
            }
            if (isHidingDecl(prop, d.value)) continue;
            out.push(d);
            continue;
        }
        if (role === 'hpart') {
            if (hadFixed && (OFFSETS.has(prop) || prop === 'width')) continue;
            out.push(d);
            continue;
        }
        if (role === 'messages') {
            if (['margin-top', 'margin', 'position', 'height', 'max-height', 'min-height', 'flex', 'z-index', 'display', 'overflow', 'overflow-y'].includes(prop) || OFFSETS.has(prop)) continue;
            out.push(d);
            continue;
        }
        if (['inputArea', 'inputBar', 'actionBar', 'btnGroup', 'input'].includes(role) && !item.pseudoEl) {
            if (isHidingDecl(prop, d.value)) continue;
            if (prop === 'display' && /contents/i.test(d.value)) continue;
            if (role === 'inputArea' && (prop === 'position' && /absolute/i.test(d.value))) continue;
            if (role === 'inputArea' && OFFSETS.has(prop)) continue;
            if (role === 'input' && (prop === 'height' || prop === 'max-height') && tinySize(d.value)) continue;
            if (role === 'actionBar' && prop === 'display' && !/flex|grid/i.test(d.value)) continue;
            out.push(d);
            continue;
        }
        if (role === 'btn') {
            const repl = ctx.btnReplaced[btnKey];
            if (isIcon) {
                // 按钮里的原图标：主题换了图标才隐藏，否则保留
                if (isHidingDecl(prop, d.value) || prop === 'pointer-events') {
                    if (!repl || chrome) continue;
                }
                if (chrome && (prop === 'fill' || prop === 'stroke' || prop === 'color')) { out.push(d); continue; }
                out.push(d);
                continue;
            }
            if (item.pseudoEl) {
                if (chrome) continue; // 近似对应的按钮不接主题的装饰字/图
                out.push(d);
                continue;
            }
            if (isHidingDecl(prop, d.value)) continue;
            if (prop === 'pointer-events' && /none/i.test(d.value)) continue;
            if (prop === 'position' && /absolute|fixed/i.test(d.value)) continue;
            if (OFFSETS.has(prop)) continue;
            if (prop === 'clip' || prop === 'clip-path') continue;
            if (['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'flex-basis'].includes(prop) && tinySize(d.value)) continue;
            if (prop === 'font-size' && tinySize(d.value) && parseFloat(d.value) < 6 && !repl) continue;
            if (prop === 'color' && /transparent/i.test(d.value) && !repl) continue;
            if (chrome && (prop === 'background-image' || ((prop === 'background') && hasIconImage(d.value, ctx.vars)))) {
                if (prop === 'background') {
                    // 只保留底色
                    const color = d.value.replace(/url\([^)]*\)|var\([^)]*\)|no-repeat|repeat-x|repeat-y|repeat|center|top|left|right|bottom|\/|\d+px|\d+%|contain|cover|auto/gi, ' ').trim().split(/\s+/)[0];
                    if (color) out.push({ prop: 'background-color', value: color, important: true });
                }
                continue;
            }
            out.push(d);
            continue;
        }
        out.push(d);
    }
    void hadAbs;
    return out;
}

// ───────────────────────────── 6. 变量接线 ─────────────────────────────

function isRootSelector(sel) {
    return splitTopLevel(sel, ',').every(part => {
        const t = part.trim();
        if (/^(:root|html|body|\.chat-detail-screen|#chat-detail-screen)$/.test(t)) return true;
        const m = t.match(/^:(?:is|where)\((.*)\)$/);
        return !!m && isRootSelector(m[1]);
    });
}

function collectVars(nodes, ctx, out = {}) {
    for (const node of nodes) {
        if (node.type === 'rule') {
            if (!isRootSelector(node.selector)) continue;
            node.decls.forEach(d => { if (d.prop.startsWith('--')) out[d.prop] = d.value; });
        } else if (node.type === 'at-block' && (!/^@media/i.test(node.prelude) || mediaApplies(node.prelude) !== false)) {
            collectVars(node.children, ctx, out);
        }
    }
    return out;
}

const V = (vars, name) => (Object.prototype.hasOwnProperty.call(vars, name) ? `var(${name})` : null);
const isNoneLike = v => /^(none|initial|unset|inherit|transparent\s*none)?$/i.test(String(v || '').trim());

function buildVarConsumers(vars) {
    const rules = [];
    const has = n => Object.prototype.hasOwnProperty.call(vars, n);
    const rule = (sel, decls) => {
        const body = decls.filter(([, v]) => v).map(([p, v]) => `${p}: ${v} !important;`).join(' ');
        if (body) rules.push(`${sel} { ${body} }`);
    };
    const H = `${ROOT} > .wechat-header`;
    const MSG = `${ROOT} .chat-message:not(.message-system)`;
    const IA = `${ROOT} .chat-input-area`;

    // 背景
    const content = `${ROOT} > .wechat-content`;
    rule(content, [
        ['background-color', V(vars, '--chat-bg-color')],
        ['background-image', has('--chat-bg-image') ? 'var(--chat-bg-image)' : null],
        ['background-size', has('--chat-bg-image') && !isNoneLike(vars['--chat-bg-image']) ? 'cover' : null],
        ['background-position', has('--chat-bg-image') && !isNoneLike(vars['--chat-bg-image']) ? 'center' : null]
    ]);
    if (has('--chat-bg-overlay')) rule(`${ROOT} .chat-messages`, [['background-color', 'var(--chat-bg-overlay)']]);
    rule(`${ROOT} .chat-messages`, [['padding', V(vars, '--chat-messages-padding')]]);
    rule(`${ROOT} .chat-message:not(.message-system) > .message-content`, [['max-width', V(vars, '--chat-message-max-width')]]);

    // 顶栏
    rule(H, [
        ['background-color', V(vars, '--chat-header-bg') || V(vars, '--wa-header-bg')],
        ['background-image', V(vars, '--chat-header-bg-image')],
        ['background-size', V(vars, '--chat-header-bg-size')],
        ['background-position', V(vars, '--chat-header-bg-position')],
        ['background-repeat', has('--chat-header-bg-image') ? 'no-repeat' : null],
        ['backdrop-filter', has('--chat-header-blur') ? 'blur(var(--chat-header-blur))' : null],
        ['-webkit-backdrop-filter', has('--chat-header-blur') ? 'blur(var(--chat-header-blur))' : null],
        ['border-bottom-color', V(vars, '--chat-header-border')],
        ['height', has('--chat-header-height') ? 'calc(var(--chat-header-height) + var(--yzt-safe-top))' : null]
    ]);
    rule(`${H} .wechat-header-title-text`, [
        ['color', V(vars, '--chat-header-title-color') || V(vars, '--wa-header-color')],
        ['font-size', V(vars, '--chat-header-title-size')],
        ['font-weight', V(vars, '--chat-header-title-weight')]
    ]);
    rule(`${H} .wx-head-sub`, [['color', V(vars, '--chat-header-subtitle-color')], ['font-size', V(vars, '--chat-header-subtitle-size')]]);
    rule(`${H} :is(.wechat-back-btn, .wechat-header-btn)`, [['color', V(vars, '--chat-header-icon-color') || V(vars, '--wa-header-color')]]);
    rule(`${H} .wechat-header-right`, [['gap', V(vars, '--header-btn-gap')]]);
    rule(`${H} .wx-head-avatar`, [
        ['width', V(vars, '--chat-header-avatar-size')], ['height', V(vars, '--chat-header-avatar-size')],
        ['flex-basis', V(vars, '--chat-header-avatar-size')],
        ['border-radius', V(vars, '--chat-header-avatar-radius')], ['border', V(vars, '--chat-header-avatar-border')],
        ['box-shadow', V(vars, '--chat-header-avatar-shadow')]
    ]);
    rule(`${H} .wx-head-avatar :is(img, span, div)`, [['border-radius', V(vars, '--chat-header-avatar-radius')]]);

    // 气泡
    for (const [side, key] of [['R', 'me'], ['L', 'them']]) {
        const B = `${MSG}${SIDE_CLASS[side]} .message-text`;
        const bgVar = has(`--bubble-${key}-bg`) ? `var(--bubble-${key}-bg)` : (has(`--wa-bubble-${key}`) ? `var(--wa-bubble-${key})` : null);
        const grad = has(`--bubble-${key}-bg-gradient`) && !isNoneLike(vars[`--bubble-${key}-bg-gradient`]) ? `var(--bubble-${key}-bg-gradient)` : null;
        rule(B, [
            ['background-color', bgVar],
            ['background-image', grad || (bgVar ? 'none' : null)],
            ['color', V(vars, `--bubble-${key}-color`)],
            ['font-size', V(vars, `--bubble-${key}-font-size`)],
            ['line-height', V(vars, `--bubble-${key}-line-height`)],
            ['padding', V(vars, `--bubble-${key}-padding`)],
            ['border-radius', V(vars, `--bubble-${key}-radius`)],
            ['box-shadow', V(vars, `--bubble-${key}-shadow`)],
            ['border', V(vars, `--bubble-${key}-border`)],
            ['text-shadow', V(vars, `--bubble-${key}-text-shadow`)],
            ['letter-spacing', V(vars, `--bubble-${key}-letter-spacing`)],
            ['backdrop-filter', V(vars, `--bubble-${key}-backdrop`)],
            ['-webkit-backdrop-filter', V(vars, `--bubble-${key}-backdrop`)],
            ['filter', V(vars, `--bubble-${key}-filter`)],
            ['opacity', V(vars, `--bubble-${key}-opacity`)],
            ['transform', V(vars, `--bubble-${key}-transform`)],
            ['min-width', V(vars, `--bubble-${key}-min-width`)],
            ['min-height', V(vars, `--bubble-${key}-min-height`)]
        ]);
        rule(`${B} a`, [['color', V(vars, `--bubble-${key}-link-color`)]]);
        for (const pos of ['first', 'mid', 'last']) {
            if (has(`--bubble-${key}-radius-${pos}`)) rule(`${MSG}${SIDE_CLASS[side]}.yzt-${pos} .message-text`, [['border-radius', `var(--bubble-${key}-radius-${pos})`]]);
        }
        rule(`${MSG}${SIDE_CLASS[side]} .wechat-voice-message`, [['color', V(vars, `--voice-${key}-color`)]]);
        rule(`${MSG}${SIDE_CLASS[side]} .message-image-box :is(img, .message-image)`, [
            ['border-radius', V(vars, `--image-${key}-radius`) || V(vars, '--image-msg-radius')],
            ['box-shadow', V(vars, `--image-${key}-shadow`) || V(vars, '--image-msg-shadow')],
            ['border', V(vars, `--image-${key}-border`) || V(vars, '--image-msg-border')],
            ['filter', V(vars, `--image-${key}-filter`)]
        ]);
        // 转账卡
        const T = `${MSG}${SIDE_CLASS[side]} :is(.message-transfer, .message-redpacket)`;
        rule(T, [
            ['background', V(vars, `--transfer-${key}-card-bg`) || V(vars, '--transfer-card-bg')],
            ['border', V(vars, `--transfer-${key}-card-border`) || V(vars, '--transfer-card-border')],
            ['border-radius', V(vars, `--transfer-${key}-card-radius`) || V(vars, '--transfer-card-radius')],
            ['box-shadow', V(vars, `--transfer-${key}-card-shadow`) || V(vars, '--transfer-card-shadow')]
        ]);
        rule(`${T} .rp-title`, [['color', V(vars, `--transfer-${key}-amount-color`) || V(vars, '--transfer-amount-color')]]);
        rule(`${T} .rp-subtitle`, [['color', V(vars, `--transfer-${key}-subtitle-color`)]]);
        rule(`${T} .rp-footer`, [['color', V(vars, `--transfer-${key}-label-color`)]]);
        rule(`${T} .rp-icon`, [['background', V(vars, `--transfer-${key}-icon-bg`) || V(vars, '--transfer-icon-bg')]]);
    }

    // 头像
    rule(`${MSG} > .message-avatar`, [
        ['width', V(vars, '--avatar-size') || V(vars, '--plain-avatar-size')],
        ['height', V(vars, '--avatar-size') || V(vars, '--plain-avatar-size')],
        ['border-radius', V(vars, '--avatar-radius') || V(vars, '--plain-avatar-radius')],
        ['border', V(vars, '--avatar-border')],
        ['box-shadow', V(vars, '--avatar-shadow')]
    ]);

    // 时间 / 系统消息
    rule(`${ROOT} .time-divider-text`, [
        ['color', V(vars, '--timestamp-color') || V(vars, '--date-divider-color')],
        ['font-size', V(vars, '--timestamp-size')], ['font-weight', V(vars, '--timestamp-weight')],
        ['background', V(vars, '--date-divider-bg')], ['border-radius', V(vars, '--date-divider-radius')],
        ['padding', V(vars, '--date-divider-padding')], ['border', V(vars, '--date-divider-border')],
        ['box-shadow', V(vars, '--date-divider-shadow')]
    ]);
    rule(`${ROOT} .system-message-bubble`, [
        ['color', V(vars, '--system-msg-color') || V(vars, '--narration-color')],
        ['background', V(vars, '--system-msg-bg')], ['border-radius', V(vars, '--system-msg-radius')],
        ['padding', V(vars, '--system-msg-padding')], ['font-size', V(vars, '--system-msg-size')],
        ['font-weight', V(vars, '--system-msg-weight')], ['border', V(vars, '--system-msg-border')],
        ['box-shadow', V(vars, '--system-msg-shadow')]
    ]);

    // 翻译
    const F = `${MSG} .wechat-trans-fold`;
    rule(F, [
        ['background', V(vars, '--translation-bg')], ['border', V(vars, '--translation-border')],
        ['border-top', V(vars, '--translation-separator')],
        ['border-radius', V(vars, '--translation-radius')], ['box-shadow', V(vars, '--translation-shadow')],
        ['padding', V(vars, '--translation-padding')], ['margin', V(vars, '--translation-margin')],
        ['opacity', V(vars, '--translation-opacity')]
    ]);
    rule(`${F} .wechat-trans-fold-body`, [
        ['color', V(vars, '--translation-text-color')], ['font-size', V(vars, '--translation-size')],
        ['line-height', V(vars, '--translation-line-height')], ['font-style', V(vars, '--translation-font-style')],
        ['text-shadow', V(vars, '--translation-text-shadow')]
    ]);
    rule(`${F} .wechat-trans-fold-btn`, [
        ['color', V(vars, '--translation-btn-color')], ['font-size', V(vars, '--translation-btn-size')],
        ['font-weight', V(vars, '--translation-btn-weight')], ['opacity', V(vars, '--translation-btn-opacity')],
        ['display', V(vars, '--translation-btn-display')]
    ]);
    if (has('--translation-always-show') && String(vars['--translation-always-show']).trim() === '1') {
        rules.push(`${F} .wechat-trans-fold-body { display: block !important; }`);
        rules.push(`${MSG} .yzt-trans-detached { --yzt-trans-open: 1; }`);
    }

    // 引用
    const Q = `${MSG} .wechat-quote-block`;
    if (ctx_quoteMode === 'detached') {
        rule(Q, [
            ['background', V(vars, '--reply-detached-bg')], ['border-left', V(vars, '--reply-detached-border-left')],
            ['padding', V(vars, '--reply-detached-padding')], ['border-radius', V(vars, '--reply-detached-radius')],
            ['box-shadow', V(vars, '--reply-detached-shadow')], ['margin-top', V(vars, '--reply-detached-margin-top')],
            ['max-width', V(vars, '--reply-detached-max-width')]
        ]);
        rule(`${Q} .wechat-quote-sender`, [['color', V(vars, '--reply-detached-name-color')], ['font-weight', V(vars, '--reply-detached-name-weight')]]);
        rule(`${Q} .wechat-quote-sender::after`, [['content', V(vars, '--reply-detached-name-suffix')]]);
        rule(`${Q} .wechat-quote-text`, [['color', V(vars, '--reply-detached-text-color')]]);
        for (const [side, key] of [['R', 'me'], ['L', 'them']]) {
            rule(`${MSG}${SIDE_CLASS[side]} .wechat-quote-block`, [['background', V(vars, `--reply-detached-${key}-bg`)], ['border-left', V(vars, `--reply-detached-${key}-border-left`)]]);
            rule(`${MSG}${SIDE_CLASS[side]} .wechat-quote-block .wechat-quote-sender`, [['color', V(vars, `--reply-detached-${key}-name-color`)]]);
            rule(`${MSG}${SIDE_CLASS[side]} .wechat-quote-block .wechat-quote-text`, [['color', V(vars, `--reply-detached-${key}-text-color`)]]);
        }
    } else {
        rule(Q, [
            ['background', V(vars, '--reply-block-bg')], ['border', V(vars, '--reply-block-border')],
            ['border-left', V(vars, '--reply-block-border-left')], ['padding', V(vars, '--reply-block-padding')],
            ['border-radius', V(vars, '--reply-block-radius')], ['box-shadow', V(vars, '--reply-block-shadow')]
        ]);
        rule(`${Q} .wechat-quote-sender`, [['color', V(vars, '--reply-block-name-color')], ['font-size', V(vars, '--reply-block-name-size')], ['font-weight', V(vars, '--reply-block-name-weight')]]);
        rule(`${Q} .wechat-quote-text`, [['color', V(vars, '--reply-block-text-color')], ['font-size', V(vars, '--reply-block-text-size')]]);
    }
    const RB = `${IA} .wechat-active-quote-bar`;
    rule(RB, [
        ['background', V(vars, '--reply-bar-bg')], ['border', V(vars, '--reply-bar-border')],
        ['border-radius', V(vars, '--reply-bar-radius')], ['padding', V(vars, '--reply-bar-padding')],
        ['margin-bottom', V(vars, '--reply-bar-margin-bottom')],
        ['backdrop-filter', V(vars, '--reply-bar-backdrop')]
    ]);
    rule(`${RB} .wechat-active-quote-accent`, [['background', V(vars, '--reply-bar-accent')]]);
    rule(`${RB} .wechat-active-quote-label`, [['color', V(vars, '--reply-bar-accent')]]);
    rule(`${RB} .wechat-active-quote-text`, [['color', V(vars, '--reply-bar-text-color')]]);
    rule(`${RB} .wechat-active-quote-cancel`, [['color', V(vars, '--reply-bar-close-color')]]);

    // 输入栏
    rule(IA, [
        ['background-color', V(vars, '--input-area-bg')],
        ['background-image', V(vars, '--input-area-bg-image')],
        ['background-size', V(vars, '--input-area-bg-size')],
        ['background-position', V(vars, '--input-area-bg-position')],
        ['backdrop-filter', has('--input-area-blur') ? 'blur(var(--input-area-blur))' : null],
        ['-webkit-backdrop-filter', has('--input-area-blur') ? 'blur(var(--input-area-blur))' : null],
        ['border-top-color', V(vars, '--input-area-border-top')],
        ['min-height', V(vars, '--input-area-min-height')],
        ['padding', V(vars, '--input-area-padding')]
    ]);
    // 糯叽机的“输入框胶囊”= 输入框 + 右侧按钮那一整条
    rule(`${IA} .chat-input-bar .yzt-action-bar`, [
        ['background', V(vars, '--input-box-bg')],
        ['border-radius', V(vars, '--input-box-radius')], ['border', V(vars, '--input-box-border')],
        ['box-shadow', V(vars, '--input-box-shadow')],
        ['backdrop-filter', has('--input-box-blur') ? 'blur(var(--input-box-blur))' : null],
        ['-webkit-backdrop-filter', has('--input-box-blur') ? 'blur(var(--input-box-blur))' : null]
    ]);
    rule(`${IA} #chat-input`, [
        ['color', V(vars, '--input-box-color')], ['caret-color', V(vars, '--input-caret-color')],
        ['font-size', V(vars, '--input-box-font-size')], ['padding', V(vars, '--input-box-padding')]
    ]);
    rule(`${IA} #chat-input::placeholder`, [['color', V(vars, '--input-box-placeholder')]]);
    rule(`${IA} .chat-input-bar .input-btn`, [['color', V(vars, '--input-btn-color')]]);
    rule(`${IA} #send-btn`, [['background-color', V(vars, '--plus-btn-bg')], ['color', V(vars, '--plus-btn-color')], ['width', V(vars, '--plus-btn-size')], ['height', V(vars, '--plus-btn-size')]]);
    rule(`${IA} #send-now-btn:not([data-mode="stop"])`, [['background-color', V(vars, '--send-btn-bg')], ['color', V(vars, '--send-btn-color')], ['border-radius', V(vars, '--send-btn-radius')], ['box-shadow', V(vars, '--send-btn-shadow')]]);
    rule(`${IA} #send-now-btn:not(.has-text):not([data-mode="stop"])`, [['background-color', V(vars, '--ai-btn-bg')], ['color', V(vars, '--ai-btn-color')]]);
    rule(`${IA} #send-now-btn[data-mode="stop"]`, [['background-color', V(vars, '--stop-btn-bg')], ['color', V(vars, '--stop-btn-color')], ['border-radius', V(vars, '--stop-btn-radius')]]);
    rule(`${IA} .more-panel`, [['background', V(vars, '--more-options-bg-solid') || V(vars, '--more-options-bg')], ['color', V(vars, '--more-options-color')], ['box-shadow', V(vars, '--more-options-shadow')]]);
    rule(`${IA} .emoji-panel`, [['background', V(vars, '--emoji-panel-bg')], ['border-radius', V(vars, '--emoji-panel-radius')], ['box-shadow', V(vars, '--emoji-panel-shadow')]]);

    // 表情回应
    rule(`${MSG} .wechat-reaction-pill`, [
        ['background', V(vars, '--reaction-badge-bg')], ['border', V(vars, '--reaction-badge-border')],
        ['border-radius', V(vars, '--reaction-badge-radius')], ['box-shadow', V(vars, '--reaction-badge-shadow')],
        ['color', V(vars, '--reaction-badge-color')], ['padding', V(vars, '--reaction-badge-padding')]
    ]);
    return rules;
}
let ctx_quoteMode = 'inline';

// 按钮图标变量：有图就换上，同时把原图标藏起来
const ICON_VARS = [
    { v: '--back-btn-icon', btn: 'back', sel: '> .wechat-header .wechat-back-btn' },
    { v: '--info-btn-icon', btn: 'info', sel: '> .wechat-header #chat-info' },
    { v: '--plus-btn-icon', btn: 'plus', sel: '.chat-input-area .chat-input-bar #send-btn' },
    { v: '--sticker-btn-icon', btn: 'sticker', sel: '.chat-input-area .chat-input-bar #emoji-btn' },
    { v: '--send-btn-icon', btn: 'send', sel: '.chat-input-area .chat-input-bar #send-now-btn.has-text:not([data-mode="stop"])' },
    { v: '--ai-btn-icon', btn: 'ai', sel: '.chat-input-area .chat-input-bar #send-now-btn:not(.has-text):not([data-mode="stop"])' },
    { v: '--stop-btn-icon', btn: 'stop', sel: '.chat-input-area .chat-input-bar #send-now-btn[data-mode="stop"]' }
];

// ───────────────────────────── 7. 媒体查询 ─────────────────────────────

function mediaApplies(prelude) {
    const q = prelude.replace(/^@media\s*/i, '').trim().toLowerCase();
    if (!/(min|max)-(device-)?width/.test(q)) return null; // 和宽度无关：原样保留
    // 只处理简单的 and 组合
    if (/,|\bor\b|\bnot\b/.test(q)) return null;
    let ok = true;
    q.replace(/\((min|max)-(?:device-)?width\s*:\s*([\d.]+)(px|em|rem)?\s*\)/g, (_, kind, num, unit) => {
        const px = unit === 'em' || unit === 'rem' ? parseFloat(num) * 16 : parseFloat(num);
        if (kind === 'max' && !(PHONE_WIDTH <= px)) ok = false;
        if (kind === 'min' && !(PHONE_WIDTH >= px)) ok = false;
        return '';
    });
    const rest = q.replace(/\((min|max)-(?:device-)?width\s*:[^)]*\)/g, '').replace(/\band\b|\bscreen\b|\ball\b|only/g, '').trim();
    if (rest) return null;
    return ok;
}

// ───────────────────────────── 8. 主入口 ─────────────────────────────

function detectThemeStyle(src) {
    const m = src.match(/nuojiji-bubble-config:\s*(\{[^*]*\})/);
    if (!m) return '';
    try { return String(JSON.parse(m[1]).themeStyle || ''); } catch (e) { return ''; }
}

function detectQuoteMode(nodes) {
    let detached = false;
    const walk = list => list.forEach(n => {
        if (n.type === 'rule' && /msg-reply-block-detached/.test(n.selector)) {
            if (n.decls.some(d => d.prop === 'display' && !/none/i.test(d.value))) detached = true;
        } else if (n.type === 'at-block') walk(n.children);
    });
    walk(nodes);
    return detached ? 'detached' : 'inline';
}

function serializeDecls(decls) {
    return decls.map(d => `${d.prop}: ${d.value} !important;`).join(' ');
}

/**
 * 转换糯叽机 CSS → 柚月聊天界面 CSS
 * @returns {{ css: string, report: object, preview: object }}
 */
export function convertNuojiChatCss(source = '') {
    const raw = String(source || '');
    const themeStyle = detectThemeStyle(raw);
    const cleaned = stripComments(raw);
    const nodes = parseList(cleaned);
    const quoteMode = detectQuoteMode(nodes);
    ctx_quoteMode = quoteMode;
    const map = { ...MAP, ...buildQuoteMap(quoteMode) };
    const report = { rules: 0, kept: 0, dropped: 0, selectorsKept: 0, selectorsDropped: 0, quoteMode, themeStyle, imports: 0 };
    const ctx = { map, themeStyle, btnReplaced: {}, btnInk: {}, btnTextWidth: {}, vars: {}, droppedList: [] };
    ctx.vars = collectVars(nodes, ctx);

    // 第一遍：翻译选择器，顺便看看主题给哪些按钮换了图标
    const translated = [];
    const atTop = [];
    const walk = (list, wrapPrelude = []) => {
        for (const node of list) {
            if (node.type === 'at-stmt') {
                if (/^@import/i.test(node.text)) { atTop.push(`${node.text};`); report.imports++; }
                continue;
            }
            if (node.type === 'at-raw') {
                const name = node.prelude.split(/[\s(]/)[0].toLowerCase();
                if (['@keyframes', '@-webkit-keyframes', '@font-face', '@property', '@counter-style'].includes(name)) {
                    translated.push({ raw: `${node.prelude} {${node.body}}`, wrap: wrapPrelude });
                }
                continue;
            }
            if (node.type === 'at-block') {
                if (/^@media/i.test(node.prelude)) {
                    const applies = mediaApplies(node.prelude);
                    if (applies === false) continue;
                    if (applies === true) { walk(node.children, wrapPrelude); continue; }
                }
                walk(node.children, [...wrapPrelude, node.prelude]);
                continue;
            }
            if (node.type !== 'rule') continue;
            report.rules++;
            const { items, dropped } = translateSelectorList(node.selector, ctx);
            report.selectorsDropped += dropped;
            report.selectorsKept += items.length;
            if (!items.length) { report.dropped++; continue; }
            report.kept++;
            translated.push({ items, decls: node.decls, wrap: wrapPrelude });
            // 记录按钮的替换图标 / 主题给按钮的颜色
            items.forEach(it => {
                const key = it.entry?.btn;
                if (!key || it.isTag) return;
                const decls = node.decls;
                if (!it.pseudoEl && !wrapPrelude.length) {
                    const c = decls.find(d => d.prop === 'color' && !/transparent|inherit|currentcolor/i.test(d.value));
                    if (c) ctx.btnInk[key] = c.value;
                }
                if (it.pseudoEl) {
                    const c = decls.find(d => d.prop === 'content');
                    const m = c && c.value.trim().match(/^(["'])(.+)\1$/);
                    if (m && decls.some(d => d.prop === 'position' && /absolute/i.test(d.value))) {
                        const fsD = decls.find(d => d.prop === 'font-size');
                        const fs = fsD ? parseFloat(fsD.value) || 15 : 15;
                        const width = Math.ceil(Array.from(m[2]).reduce((w, ch) => w + (/[\x00-\xff]/.test(ch) ? 0.6 : 1), 0) * fs + 6);
                        ctx.btnTextWidth[key] = Math.max(ctx.btnTextWidth[key] || 0, width);
                    }
                }
                if (!it.pseudoEl) {
                    if (decls.some(d => (d.prop === 'background' || d.prop === 'background-image' || d.prop === 'mask-image' || d.prop === '-webkit-mask-image') && hasIconImage(d.value, ctx.vars))) ctx.btnReplaced[key] = true;
                } else {
                    const c = decls.find(d => d.prop === 'content');
                    const cv = c ? c.value.trim() : '';
                    const textContent = cv && !/^(none|normal|""|'')$/i.test(cv);
                    const imgContent = decls.some(d => /background|mask-image/.test(d.prop) && hasIconImage(d.value, ctx.vars));
                    if (textContent || (cv && imgContent)) ctx.btnReplaced[key] = true;
                }
            });
        }
    };
    walk(nodes);
    ICON_VARS.forEach(iv => {
        if (ctx.vars[iv.v] && /url\(/i.test(ctx.vars[iv.v])) ctx.btnReplaced[iv.btn] = true;
    });
    // 「图标」那一组（chat-header-icon）跟着返回键走
    if (ctx.btnReplaced.back) ctx.btnReplaced.icons = ctx.btnReplaced.icons || false;

    // 第二遍：输出
    const out = [];
    out.push(...atTop);
    out.push('/* ── 变量接线 ── */');
    out.push(...buildVarConsumers(ctx.vars));
    // 按钮图标变量
    ICON_VARS.forEach(iv => {
        if (!ctx.vars[iv.v] || !/url\(/i.test(ctx.vars[iv.v])) return;
        out.push(`${ROOT} ${iv.sel} { background-image: var(${iv.v}) !important; background-repeat: no-repeat !important; background-position: center !important; background-size: 22px 22px !important; }`);
    });
    // 被换了图标的按钮：把柚月原图标藏起来（按钮本身一直在）
    const hideSel = [];
    const btnSel = {
        back: `${ROOT} > .wechat-header .wechat-back-btn`,
        info: `${ROOT} > .wechat-header #chat-info`,
        plus: `${ROOT} .chat-input-area #send-btn`,
        sticker: `${ROOT} .chat-input-area #emoji-btn`,
        send: `${ROOT} .chat-input-area #send-now-btn.has-text:not([data-mode="stop"])`,
        ai: `${ROOT} .chat-input-area #send-now-btn:not(.has-text):not([data-mode="stop"])`,
        stop: `${ROOT} .chat-input-area #send-now-btn[data-mode="stop"]`
    };
    Object.entries(btnSel).forEach(([k, s]) => { if (ctx.btnReplaced[k]) hideSel.push(`${s} > :is(svg, i, .wx-send-label)`); });
    if (hideSel.length) out.push(`${hideSel.join(',\n')} { display: none !important; }`);
    // 文字做的按钮（例如「もどる」）：给按钮留够宽度，别挤出屏幕
    Object.entries(ctx.btnTextWidth).forEach(([k, w]) => {
        if (btnSel[k]) out.push(`${btnSel[k]} { min-width: ${w}px !important; }`);
    });
    // 按钮统一用主题的颜色（主题只给某一个按钮上了色时，其他按钮也跟着它走）
    const inputInk = ctx.vars['--input-btn-color'] ? 'var(--input-btn-color)'
        : (ctx.btnInk.send || ctx.btnInk.ai || ctx.btnInk.sticker || ctx.btnInk.plus || ctx.btnInk.mic || '');
    if (inputInk) out.push(`${ROOT} .chat-input-area .chat-input-bar .input-btn { color: ${rewriteValue(inputInk)} !important; }`);
    const headInk = ctx.vars['--chat-header-icon-color'] ? 'var(--chat-header-icon-color)' : (ctx.btnInk.back || ctx.btnInk.info || ctx.btnInk.icons || '');
    if (headInk) out.push(`${ROOT} > .wechat-header :is(.wechat-back-btn, .wechat-header-btn) { color: ${rewriteValue(headInk)} !important; }`);

    out.push('/* ── 主题规则 ── */');
    for (const t of translated) {
        let text = '';
        if (t.raw) text = t.raw;
        else {
            // 同一条规则里，不同目标元素允许的属性不同：按过滤结果分组输出
            const groups = new Map();
            for (const it of t.items) {
                const decls = filterDecls(t.decls, it, ctx);
                if (!decls.length) continue;
                const body = serializeDecls(decls);
                if (!groups.has(body)) groups.set(body, new Set());
                groups.get(body).add(it.sel);
            }
            text = [...groups.entries()].map(([body, sels]) => `${[...sels].join(',\n')} { ${body} }`).join('\n');
        }
        if (!text) continue;
        for (let i = t.wrap.length - 1; i >= 0; i--) text = `${t.wrap[i]} {\n${text}\n}`;
        out.push(text);
    }

    const preview = buildPreview(ctx.vars, translated);
    report.droppedSelectors = ctx.droppedList;
    return { css: out.join('\n'), report, preview, quoteMode };
}

// 设置页小预览用的配色（尽量从主题里读，读不到用中性色）
function buildPreview(vars, translated) {
    const pickColor = v => {
        if (!v) return '';
        const m = String(v).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(white|black|transparent)\b/i);
        return m ? m[0] : '';
    };
    const resolve = v => {
        const s = String(v || '');
        const m = s.match(/^var\(\s*(--[-\w]+)/);
        return m ? vars[m[1]] || '' : s;
    };
    const find = (re, props) => {
        for (let i = translated.length - 1; i >= 0; i--) {
            const t = translated[i];
            if (!t.items) continue;
            if (!t.items.some(it => re.test(it.sel) && !it.pseudoEl && !it.isTag)) continue;
            for (const p of props) {
                const d = [...t.decls].reverse().find(x => x.prop === p);
                const c = d && pickColor(resolve(d.value));
                if (c && !/transparent/i.test(c)) return c;
            }
        }
        return '';
    };
    const head = pickColor(vars['--chat-header-bg']) || find(/> \.wechat-header$/, ['background', 'background-color']) || '#f7f7f7';
    const page = pickColor(vars['--chat-bg-color']) || find(/\.chat-messages$/, ['background', 'background-color']) || '#f2f2f2';
    // 气泡是贴图（border-image）时读不到底色，就用气泡文字 / 边框的颜色代替
    const outBg = find(/message-right[^ ]* \.message-text$/, ['background', 'background-color']) || pickColor(vars['--bubble-me-bg']) || pickColor(vars['--wa-bubble-me'])
        || find(/message-right[^ ]* \.message-text$/, ['border-color', 'color']) || '#0095f6';
    const inBg = find(/message-left[^ ]* \.message-text$/, ['background', 'background-color']) || pickColor(vars['--bubble-them-bg']) || pickColor(vars['--wa-bubble-them'])
        || find(/message-left[^ ]* \.message-text$/, ['border-color', 'color']) || '#efefef';
    const bar = pickColor(vars['--input-area-bg']) || find(/\.chat-input-area$/, ['background', 'background-color']) || head;
    const border = find(/\.message-text$/, ['border-color', 'border']) || '';
    return { head: /transparent/.test(head) ? page : head, page, inBg, outBg, bar: /transparent/.test(bar) ? page : bar, border };
}
