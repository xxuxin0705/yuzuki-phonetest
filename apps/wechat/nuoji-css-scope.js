// 🍡 糯叽机美化 CSS → 柚月小手机：作用域改写
// 把糯叽机写法（:root / #messaging-chat-tab / .chat-detail-screen / [data-time-of-day] …）
// 改写成只在柚月微信里生效的选择器，避免污染酒馆页面。

// 这些属性在糯叽机里挂在根容器上，选择器开头出现时直接并到根上
const ROOT_ATTRS = new Set([
    'data-time-of-day', 'data-color-scheme', 'data-time-slot', 'data-hour',
    'data-active-tab', 'data-prev-tab', 'data-tab-anim', 'data-view-mode',
    'data-scrolled', 'data-unread-total', 'data-searching', 'data-post-count', 'data-empty',
    'data-theme-style', 'data-chat-kind'
]);

// 糯叽机的 id 根容器改成 class（柚月里同一时间可能有多个视图，不能重复 id）
const ID_MAP = [
    [/#messaging-(chat|moments|profile|favorites|contacts)-tab(?![\w-])/g, '.nj-messaging-$1-tab'],
    [/#messaging-favorites-detail(?![\w-])/g, '.nj-messaging-favorites-detail'],
    [/#messaging-user-switch(?![\w-])/g, '.nj-user-switch-panel']
];

export function stripCssComments(css) {
    const s = String(css || '');
    let out = '';
    let q = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) {
            out += c;
            if (c === '\\') { out += s[i + 1] || ''; i++; continue; }
            if (c === q) q = null;
            continue;
        }
        if (c === '"' || c === "'") { q = c; out += c; continue; }
        if (c === '/' && s[i + 1] === '*') {
            const end = s.indexOf('*/', i + 2);
            // 常见笔误修复：行尾写成「/* 注释 /」少了星号，浏览器会把后面整段吃掉。
            // 糯叽机能正常显示这类美化，这里也按「这一行就是注释结尾」处理
            const nl = s.indexOf('\n', i + 2);
            if (nl > 0 && (end < 0 || end > nl)) {
                const firstLine = s.slice(i + 2, nl).replace(/\s+$/, '');
                if (firstLine.endsWith('/') && !firstLine.endsWith('*/')) { out += '\n'; i = nl; continue; }
            }
            i = end < 0 ? s.length : end + 1;
            continue;
        }
        out += c;
    }
    return out;
}

// 只拆一层：{type:'rule'|'at'|'stmt', prelude, body}
export function parseCssBlocks(s) {
    const nodes = [];
    const n = s.length;
    let i = 0;
    while (i < n) {
        while (i < n && /\s/.test(s[i])) i++;
        if (i >= n) break;
        const start = i;
        let depth = 0;
        let q = null;
        for (; i < n; i++) {
            const c = s[i];
            if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
            if (c === '"' || c === "'") { q = c; continue; }
            if (c === '(' || c === '[') depth++;
            else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
            else if (depth === 0 && (c === '{' || c === ';' || c === '}')) break;
        }
        const prelude = s.slice(start, i).trim();
        if (i >= n) break;
        if (s[i] === ';') { if (prelude) nodes.push({ type: 'stmt', prelude }); i++; continue; }
        if (s[i] === '}') { i++; continue; }
        let j = i + 1;
        let d = 1;
        q = null;
        for (; j < n; j++) {
            const c = s[j];
            if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
            if (c === '"' || c === "'") { q = c; continue; }
            if (c === '{') d++;
            else if (c === '}') { d--; if (d === 0) break; }
        }
        nodes.push({ type: prelude.startsWith('@') ? 'at' : 'rule', prelude, body: s.slice(i + 1, j) });
        i = j + 1;
    }
    return nodes;
}

function splitTopLevel(text, sep = ',') {
    const parts = [];
    let cur = '';
    let depth = 0;
    let q = null;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { cur += c; if (c === '\\') { cur += text[i + 1] || ''; i++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; cur += c; continue; }
        if (c === '(' || c === '[') depth++;
        if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
        cur += c;
    }
    parts.push(cur);
    return parts;
}

function splitCompounds(sel) {
    const parts = [];
    let cur = '';
    let depth = 0;
    let q = null;
    for (let i = 0; i < sel.length; i++) {
        const c = sel[i];
        if (q) { cur += c; if (c === '\\') { cur += sel[i + 1] || ''; i++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; cur += c; continue; }
        if (c === '(' || c === '[') { depth++; cur += c; continue; }
        if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); cur += c; continue; }
        if (depth === 0 && (/\s/.test(c) || c === '>' || c === '+' || c === '~')) {
            if (cur) { parts.push({ comp: cur }); cur = ''; }
            let comb = ' ';
            while (i < sel.length && (/\s/.test(sel[i]) || '>+~'.includes(sel[i]))) {
                if ('>+~'.includes(sel[i])) comb = sel[i];
                i++;
            }
            i--;
            parts.push({ comb });
            continue;
        }
        cur += c;
    }
    if (cur) parts.push({ comp: cur });
    return parts;
}

const SIMPLE_RE = /(\[[^\]]*\]|::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?|\.[\w-]+|#[\w-]+|\*|[\w-]+)/g;

// 判断一个复合选择器是不是「根」：返回要并到根上的部分（可能是空串），不是根返回 null
function rootPart(comp, ctx) {
    const simples = comp.match(SIMPLE_RE) || [];
    if (simples.join('') !== comp) return null;
    let isRoot = false;
    let keep = '';
    for (const s of simples) {
        if (s === ':root' || s === 'html' || s === 'body') { isRoot = true; continue; }
        if (s.startsWith('.') && ctx.rootClasses.has(s.slice(1))) { isRoot = true; keep += s; continue; }
        if (s.startsWith('[')) {
            const name = s.slice(1).split(/[~|^$*]?=|\]/)[0].trim();
            if (ROOT_ATTRS.has(name)) { isRoot = true; keep += s; continue; }
            return null;
        }
        if (s.startsWith(':')) { keep += s; continue; }
        return null;
    }
    return isRoot ? keep : null;
}

function scopeOneSelector(raw, ctx) {
    let sel = String(raw || '').trim();
    if (!sel) return '';
    ID_MAP.forEach(([re, rep]) => { sel = sel.replace(re, rep); });
    const parts = splitCompounds(sel).filter((p, idx, arr) => !(p.comb && (idx === 0 || idx === arr.length - 1)));
    let rootExtra = '';
    let k = 0;
    while (k < parts.length && parts[k].comp !== undefined) {
        const r = rootPart(parts[k].comp, ctx);
        if (r === null) break;
        rootExtra += r;
        k++;
        if (k < parts.length && parts[k].comb !== undefined) {
            const next = parts[k + 1];
            if (next && next.comp !== undefined && rootPart(next.comp, ctx) !== null && parts[k].comb === ' ') { k++; continue; }
            break;
        }
    }
    const rest = parts.slice(k).map(p => (p.comp !== undefined ? p.comp : (p.comb === ' ' ? ' ' : ` ${p.comb} `))).join('');
    if (!rest) return `${ctx.root}${rootExtra}`;
    if (k > 0) return `${ctx.root}${rootExtra}${rest.startsWith(' ') ? rest : ` ${rest}`}`;
    return `${ctx.root} ${rest}`;
}

function sanitizeBody(body) {
    return String(body || '')
        .replace(/javascript\s*:/gi, '')
        .replace(/expression\s*\(/gi, '(')
        .replace(/-moz-binding\s*:[^;}]*/gi, '')
        // 糯叽机会自动补 -webkit- 前缀，这里照做
        .replace(/(^|[;{\s])backdrop-filter\s*:\s*([^;}]+)/g, (m, pre, val) => `${pre}-webkit-backdrop-filter:${val};backdrop-filter:${val}`);
}

function compileNodes(nodes, ctx, imports) {
    return nodes.map((nd) => {
        if (nd.type === 'stmt') {
            if (/^@import\b/i.test(nd.prelude)) {
                if (!/javascript:/i.test(nd.prelude)) imports.push(`${nd.prelude};`);
                return '';
            }
            if (/^@(charset|namespace|layer)\b/i.test(nd.prelude)) return '';
            return '';
        }
        if (nd.type === 'at') {
            const name = (nd.prelude.match(/^@([\w-]+)/)?.[1] || '').toLowerCase();
            if (/keyframes$/.test(name) || ['font-face', 'property', 'counter-style', 'font-feature-values', 'page'].includes(name)) {
                return `${nd.prelude}{${sanitizeBody(nd.body)}}`;
            }
            // @layer 的规则优先级比普通规则低，会被底座盖掉，直接拆掉 layer 外壳
            if (name === 'layer') return compileNodes(parseCssBlocks(nd.body), ctx, imports);
            if (['media', 'supports', 'container', 'document', 'scope'].includes(name)) {
                return `${nd.prelude}{${compileNodes(parseCssBlocks(nd.body), ctx, imports)}}`;
            }
            return '';
        }
        const selectors = splitTopLevel(nd.prelude).map(s => scopeOneSelector(s, ctx)).filter(Boolean);
        if (!selectors.length) return '';
        return `${selectors.join(',\n')}{${sanitizeBody(nd.body)}}`;
    }).filter(Boolean).join('\n');
}

/**
 * @param {string} css 糯叽机格式的 CSS
 * @param {{root:string, rootClasses:string[]}} options
 */
export function scopeNuojiCss(css, { root, rootClasses = [] } = {}) {
    const clean = stripCssComments(String(css || '').replace(/^\uFEFF/, ''));
    const ctx = { root, rootClasses: new Set(rootClasses) };
    const imports = [];
    const body = compileNodes(parseCssBlocks(clean), ctx, imports);
    return `${imports.join('\n')}\n${body}`;
}
