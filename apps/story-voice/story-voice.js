// 🔊 正文朗读：在酒馆正文里，把「对白符号」里的台词挂上 ▶播放 / ↻重新生成 按钮，用小手机的 TTS（Fish 等）读出来。
// 只改页面显示，不改聊天记录；引擎、API Key 沿用小手机「设置 → 语音」里的配置。

const STORE_KEY = 'phone-story-voice';
const STYLE_ID = 'yz-story-voice-style';
const DEFAULTS = Object.freeze({
    enabled: true,
    quotes: '「」, 『』, “”',
    skips: '（）, ()',
    voice: '',
    speakers: [],
    readUser: false,
    markSpeaker: true
});
const MARK_RE = /\[\[([^\[\]\n]{1,24})\]\][ \t]*[:：]?[ \t]*/g;
const PROMPT_KEY = 'yzsv_speaker_mark';
const SILENT_WAV = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 长对白按标点切为短片段，避免语音服务对长输入只返回前半段。
export function splitSpeech(text, max = 120) {
    const value = String(text || '').trim();
    if (!value) return [];
    const out = [];
    let rest = value;
    while (rest.length > max) {
        const window = rest.slice(0, max + 1);
        let at = -1;
        for (const re of [/[。！？!?；;\n]/g, /[，,、：:]/g, /\s/g]) {
            let m;
            while ((m = re.exec(window)) !== null) if (m.index >= Math.floor(max * .35)) at = Math.max(at, m.index + m[0].length);
            if (at > 0) break;
        }
        if (at < 1) at = max;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trimStart();
    }
    if (rest) out.push(rest);
    return out;
}

// “「」, 『』, ** **” → [['「','」'],['『','』'],['**','**']]
export function parsePairs(text = '') {
    const out = [];
    String(text || '').split(/[,，、\n]/).map(s => s.trim()).filter(Boolean).forEach(part => {
        let pair = null;
        if (/\s/.test(part)) {
            const bits = part.split(/\s+/).filter(Boolean);
            if (bits.length === 2) pair = bits;
        } else {
            const chars = Array.from(part);
            if (chars.length === 2) pair = chars;
            else if (chars.length >= 2 && chars.length % 2 === 0) pair = [chars.slice(0, chars.length / 2).join(''), chars.slice(chars.length / 2).join('')];
        }
        if (pair && pair[0] && pair[1]) out.push(pair);
    });
    return out;
}

function findRanges(text, pairs, maxLen = 1200) {
    const ranges = [];
    pairs.forEach(([open, close]) => {
        const body = open === close ? `[^${reEsc(open)}\\n]` : `[^\\n]`;
        const re = new RegExp(`${reEsc(open)}(${body}{1,${maxLen}}?)${reEsc(close)}`, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            ranges.push({ start: m.index, end: m.index + m[0].length, innerStart: m.index + open.length, innerEnd: m.index + m[0].length - close.length });
        }
    });
    return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

function encodeWav(pcm, rate) {
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
        const x = Math.max(-1, Math.min(1, pcm[i]));
        v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
}

export class StoryVoice {
    constructor({ storage, ttsManager, phoneShell } = {}) {
        this.storage = storage;
        this.tts = ttsManager;
        this.phoneShell = phoneShell;
        this.cache = new Map();
        this.audio = new Audio();
        this.playing = null; // { btn, queue, stop }
        this._timers = new Map();
        this._installed = false;
        this.speakerOverrides = this._loadOverrides();
        this._speakerMemo = new Map(); // 模型标的 [[名字]] 显示时会被藏掉，重新处理时靠这里记住
    }

    // ---------- 设置 ----------
    getSettings() {
        let raw = null;
        try { raw = this.storage?.get?.(STORE_KEY, false); } catch (e) { raw = null; }
        let obj = {};
        try { obj = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}; } catch (e) { obj = {}; }
        const s = { ...DEFAULTS, ...(obj && typeof obj === 'object' ? obj : {}) };
        s.speakers = Array.isArray(s.speakers) ? s.speakers.filter(x => x && typeof x === 'object').map(x => ({ name: String(x.name || '').trim(), voice: String(x.voice || '').trim() })) : [];
        return s;
    }

    saveSettings(patch = {}) {
        const next = { ...this.getSettings(), ...patch };
        try { this.storage?.set?.(STORE_KEY, JSON.stringify(next)); } catch (e) { /* 忽略 */ }
        this.updatePrompt();
        this.refreshAll();
        return next;
    }

    _loadOverrides() {
        try { return JSON.parse(this.storage?.get?.('phone-story-voice-overrides', false) || '{}') || {}; }
        catch (_) { return {}; }
    }

    _overrideKey(id, line, text) {
        const chatId = String(window.SillyTavern?.getContext?.()?.chatId || 'current');
        return `${chatId}:${id}:${line}:${text.slice(0, 40)}`;
    }

    _chooseSpeaker(bar) {
        const speakers = this.getSettings().speakers.filter(x => x.name && x.voice);
        if (!speakers.length) { this._toast('未配置音色', '请先在朗读 App 配置角色名称和音色 ID'); return; }
        const options = speakers.map((x, i) => `${i + 1}. ${x.name}`).join('\n');
        const choice = window.prompt(`这句台词由谁来说？\n${options}\n输入序号，保存后点击 ↻ 重生成：`, '1');
        if (choice === null) return;
        const chosen = speakers[Number(choice.trim()) - 1];
        if (!chosen) { this._toast('选择无效', '请输入列表中的序号'); return; }
        this.stop();
        bar.dataset.speaker = chosen.name;
        bar.dataset.manualSpeaker = '1';
        const label = bar.querySelector('.yzsv-speaker');
        if (label) { label.textContent = `👤${chosen.name}`; label.title = `手动指定：${chosen.name}（点击修改）`; }
        const key = this._overrideKey(bar.dataset.mesid, bar.dataset.line, bar.dataset.text);
        this.speakerOverrides[key] = chosen.name;
        const keys = Object.keys(this.speakerOverrides);
        if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(k => delete this.speakerOverrides[k]);
        this.storage?.set?.('phone-story-voice-overrides', JSON.stringify(this.speakerOverrides));
        this.playBars([bar], { regen: true });
    }

    // 台词正前方的「名字 [02:22]：」「名字：」「名字说：」
    _labelBefore(full, start) {
        const before = full.slice(Math.max(0, start - 60), start);
        const m = before.match(/(?:^|[\n。！？!?」』”）)\]])\s*([^\s\n:：「」『』“”（）()\[\]【】，,。！？!?…~～、]{1,12}?)\s*(?:[\[［(（【]\s*\d{1,2}[:：]\d{2}(?:[:：]\d{2})?\s*[\]］)）】])?\s*(?:说道|说|问道|问|道|喊道|喊)?\s*[:：]\s*$/);
        if (!m) return '';
        const name = m[1].trim();
        if (!name || /^(?:他|她|我|你|它|对方|旁白)$/.test(name)) return '';
        if (!this._canonicalName(name) && /^(?:他|她|我|你|它|那|这|对方)/.test(name)) return '';
        return name;
    }

    // 「硝子」「家入」「家入硝子」都对到登记的同一个角色
    _canonicalName(name = '') {
        const n = String(name || '').trim();
        if (!n) return '';
        const hit = this._findAppSpeaker(n);
        if (hit) return hit.name;
        const wx = this._findWechatVoice(n);
        return wx ? wx.primary : '';
    }

    _saveOverride(bar, name) {
        const key = this._overrideKey(bar.dataset.mesid, bar.dataset.line, bar.dataset.text);
        if (name) this.speakerOverrides[key] = name; else delete this.speakerOverrides[key];
        const keys = Object.keys(this.speakerOverrides);
        if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(k => delete this.speakerOverrides[k]);
        try { this.storage?.set?.('phone-story-voice-overrides', JSON.stringify(this.speakerOverrides)); } catch (e) { /* 忽略 */ }
        bar.dataset.speaker = name || bar.dataset.speaker;
        bar.querySelector('.yzsv-play')?.setAttribute('title', `播放（${bar.dataset.speaker || '默认音色'}）`);
    }

    // ↻：先让 AI 快速判断这句是谁说的，再按那个人的音色重新生成
    // ↻：按现在定好的说话人直接重新生成（不再让 AI 判断），生成好自动播放；
    // 长按 ↻ 可以自己选这句是谁说的
    async _regen(bar, btn, speaker = '') {
        if (bar._regenJob) return;
        this.stop();
        if (speaker && speaker !== bar.dataset.speaker) this._saveOverride(bar, speaker);
        btn?.classList.add('is-busy');
        bar.classList.add('is-loading');
        const job = (async () => {
            const vi = await this._voiceFor(bar.dataset.speaker || '');
            const urls = await Promise.all(splitSpeech(bar.dataset.text).map(part => this._synthRetry(part, vi, { regen: true })));
            return this._joinAudio(urls);
        })();
        bar._regenJob = job;
        try {
            await job;
        } catch (err) {
            this._toast('重新生成失败', String(err?.message || err).slice(0, 120));
            return;
        } finally {
            bar._regenJob = null;
            btn?.classList.remove('is-busy');
            bar.classList.remove('is-loading');
        }
        this.playBars([bar], { trigger: bar.querySelector('.yzsv-play') });
    }

    // 长按 ↻：选说话人
    _openSpeakerPicker(bar, btn) {
        document.querySelectorAll('.yzsv-pop').forEach(n => n.remove());
        const names = [...new Set([...this.getSettings().speakers.filter(x => x.voice).map(x => x.name), ...this._wechatVoiceNames()].filter(Boolean))];
        const cur = bar.dataset.speaker || '';
        const pop = document.createElement('div');
        pop.className = 'yzsv-pop';
        pop.innerHTML = `
            <div class="yzsv-pop-title">这句是谁说的？<span>现在：${esc(cur || '未识别')}</span></div>
            ${names.length ? `<div class="yzsv-pop-names" style="margin-top:0">${names.map(n => `<button type="button" data-name="${esc(n)}" class="${n === cur ? 'is-on' : ''}">${esc(n)}</button>`).join('')}</div>` : '<div class="yzsv-pop-empty" style="margin-top:0">还没有填过音色的人：在微信私聊的「聊天设置 → 专属音色」里填音色ID</div>'}
            <div class="yzsv-pop-empty">选好后会按这个人的音色重新生成并播放</div>`;
        document.body.appendChild(pop);
        const r = btn.getBoundingClientRect();
        const w = Math.min(280, window.innerWidth - 16);
        pop.style.width = `${w}px`;
        pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
        const below = r.bottom + 8;
        pop.style.top = `${below + pop.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - pop.offsetHeight - 8) : below}px`;
        const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); };
        const outside = (e) => { if (!pop.contains(e.target)) close(); };
        setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
        pop.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-name]');
            if (!b) return;
            e.stopPropagation();
            close();
            this._unlockAudio();
            this._regen(bar, btn, b.dataset.name);
        });
    }

    async _askSpeaker(bar) {
        const ctx = window.SillyTavern?.getContext?.();
        const context = this._lineContext?.get(`${bar.dataset.mesid}:${bar.dataset.line}`) || `【${bar.dataset.text}】`;
        const names = [...new Set([...this.getSettings().speakers.filter(x => x.voice).map(x => x.name), ...this._wechatVoiceNames()].filter(Boolean))];
        const prompt = `【】里这句话是谁说的？只回答名字。${names.length ? `从中选：${names.join('、')}` : ''}\n${context}`;
        let out = '';
        if (typeof ctx?.generateRaw === 'function') {
            try { out = await ctx.generateRaw({ prompt, responseLength: 12 }); }
            catch (e) { out = await ctx.generateRaw(prompt, null, false, false, '', 12); }
        } else if (typeof ctx?.generateQuietPrompt === 'function') {
            out = await ctx.generateQuietPrompt(prompt, false, true);
        } else {
            throw new Error('当前酒馆版本不支持后台调用模型');
        }
        const text = String(out || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().split(/\n/)[0].replace(/[「」『』“”"'【】\[\]：:。.!！\s]/g, '');
        if (!text) return '';
        return this._canonicalName(text) || names.find(n => text.includes(n)) || text.slice(0, 12);
    }

    // ---------- 酒馆挂钩 ----------
    install() {
        if (this._installed) return;
        this._installed = true;
        this._injectStyle();
        // 先把微信联系人（音色ID）读进来，再挂按钮：只有对得上音色的台词才显示按钮
        this._getWechatData().catch(() => null).then(() => setTimeout(() => this.refreshAll(), 50));
        const ctx = window.SillyTavern?.getContext?.();
        const es = ctx?.eventSource;
        const ev = ctx?.event_types || ctx?.eventTypes || {};
        const later = (id, delay = 120) => {
            const key = String(id);
            clearTimeout(this._timers.get(key));
            this._timers.set(key, setTimeout(() => { this._timers.delete(key); this.processById(id); }, delay));
        };
        if (es?.on) {
            ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED'].forEach(name => {
                if (ev[name]) es.on(ev[name], (id) => later(id, name === 'MESSAGE_EDITED' ? 300 : 120));
            });
            if (ev.CHAT_CHANGED) es.on(ev.CHAT_CHANGED, () => { this.stop(); this._wxDirty = true; this._getWechatData().catch(() => null).then(() => { this.updatePrompt(); setTimeout(() => this.refreshAll(), 400); }); });
            if (ev.MESSAGE_DELETED) es.on(ev.MESSAGE_DELETED, () => this.stop());
            if (ev.STREAM_TOKEN_RECEIVED) es.on(ev.STREAM_TOKEN_RECEIVED, () => this._onStreamToken());
            ['GENERATION_STOPPED', 'CHARACTER_MESSAGE_RENDERED', 'CHAT_CHANGED'].forEach(name => { if (ev[name]) es.on(ev[name], () => { this._streaming = false; }); });
            if (ev.GENERATION_ENDED) es.on(ev.GENERATION_ENDED, () => {
                this._streaming = false;
                const chat = window.SillyTavern?.getContext?.()?.chat || [];
                const id = chat.length - 1;
                setTimeout(() => {
                    this.processById(id);
                    const s = this.getSettings();
                    const msg = chat[id];
                    if (s.enabled && msg && !msg.is_system) this._prefetchMessage(id);
                }, 250);
            });
        }
        // 往上加载更早的消息时，新出现的楼层也挂上按钮
        const chatEl = document.getElementById('chat');
        if (chatEl && window.MutationObserver) {
            const obs = new MutationObserver((list) => {
                list.forEach(m => m.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && n.classList?.contains('mes')) later(n.getAttribute('mesid'), 200);
                }));
            });
            obs.observe(chatEl, { childList: true });
        }
        setTimeout(() => { this.updatePrompt(); this.refreshAll(); }, 600);
    }

    refreshAll() {
        document.querySelectorAll('#chat .mes[mesid]').forEach(el => this.processElement(el));
    }

    // 微信里改了音色ID：重新判断哪些台词能显示按钮
    onVoicesChanged() {
        clearTimeout(this._voiceRefreshTimer);
        this._wxDirty = true;
        this._voiceRefreshTimer = setTimeout(() => {
            if (this.playing) this.stop();
            this.refreshAll();
        }, 200);
    }

    // 这个说话人有没有能用的音色（「朗读」App 登记的，或微信里填过音色）
    _hasVoice(speaker = '') {
        return !!(this._findAppSpeaker(speaker) || this._findWechatVoice(speaker));
    }

    processById(id) {
        const el = document.querySelector(`#chat .mes[mesid="${CSS.escape ? CSS.escape(String(id)) : id}"]`);
        if (el) this.processElement(el);
    }

    _clear(box) {
        box.querySelectorAll('.yzsv-bar, .yzsv-all').forEach(n => n.remove());
    }

    // 从一段正文文字里找出台词和说话人（显示的正文、生成中的原文都用它）
    _analyze(full, { id = -1, msg = null, useMemo = true, hints = null } = {}) {
        const s = this.getSettings();
        // 模型标的说话人 [[角色名]]：记下来，显示时藏掉
        const marks = [];
        for (const m of full.matchAll(MARK_RE)) marks.push({ start: m.index, end: m.index + m[0].length, name: m[1].trim() });

        const skips = findRanges(full, parsePairs(s.skips), 3000);
        const inSkip = (a, b) => skips.some(r => a >= r.start && b <= r.end);
        let lines = findRanges(full, parsePairs(s.quotes), 10000).filter(r => !inSkip(r.start, r.end));
        // 去掉互相重叠的（保留先出现、更长的）
        const kept = [];
        lines.forEach(r => { if (!kept.some(k => r.start < k.end && r.end > k.start)) kept.push(r); });
        lines = kept.map(r => {
            // 台词里夹的跳过符号内容（比如括号里的译文）不读
            let text = full.slice(r.innerStart, r.innerEnd);
            skips.filter(k => k.start >= r.innerStart && k.end <= r.innerEnd).sort((a, b) => b.start - a.start).forEach(k => {
                text = text.slice(0, k.start - r.innerStart) + text.slice(k.end - r.innerStart);
            });
            text = text.replace(/\s+/g, ' ').trim();
            return { ...r, text };
        }).filter(r => /[\p{L}\p{N}]/u.test(r.text));
        if (!lines.length) return { marks, lines };

        const defaultSpeaker = String(msg?.name || '').trim();
        const speakerNames = [...new Set([...s.speakers.filter(x => x.voice).map(x => x.name), ...this._wechatVoiceAliases()].filter(Boolean))];
        let prevEnd = 0;
        lines.forEach((r, i) => {
            r.index = i;
            // 0) 台词正前方写着「名字 [时间]：」「名字：」这种标签（群聊记录、对话体），最可靠
            const label = this._labelBefore(full, r.start);
            if (label) {
                r.speaker = this._canonicalName(label) || label;
                r.marked = true;
                prevEnd = r.end;
                return;
            }
            // 1) 模型标的 [[角色名]]（紧挨在台词前面）
            const mark = marks.find(mk => mk.end <= r.start && r.start - mk.end <= 2 && !/\S/.test(full.slice(mk.end, r.start)));
            if (mark) {
                r.speaker = this._canonicalName(mark.name) || mark.name;
                r.marked = true;
                if (useMemo) this._speakerMemo.set(`${id}:${i}:${r.text}`, r.speaker);
                if (this._speakerMemo.size > 2000) this._speakerMemo.delete(this._speakerMemo.keys().next().value);
                prevEnd = r.end;
                return;
            }
            // 1.5) 之前处理时模型标过（标记已经藏掉了），或者聊天记录原文里标过
            const memo = this._speakerMemo.get(`${id}:${i}:${r.text}`) || hints?.get(r.text);
            if (memo) {
                r.speaker = memo;
                r.marked = true;
                prevEnd = r.end;
                return;
            }
            // 2) 没标：这句台词前面最近出现的已登记角色名，再没有就用这条消息的角色
            const before = full.slice(Math.max(prevEnd, r.start - 120), r.start);
            let speaker = '';
            let best = -1;
            speakerNames.forEach(name => {
                const at = before.lastIndexOf(name);
                if (at > best) { best = at; speaker = name; }
            });
            // 识别引号后面的“硝子说/硝子问”等归属说明，避免整条五条消息全部按五条配音。
            {
                const after = full.slice(r.end, Math.min(full.length, r.end + 90));
                const candidate = speakerNames.find(name => {
                    const aliases = [name, name.replace(/^家入/, ''), name.replace(/^五条/, '')].filter(x => x.length >= 2);
                    return aliases.some(alias => new RegExp(`^\\s*[,，。！？!?]*\\s*${reEsc(alias)}(?:\\s*|[，,])(?:说|问|答|道|喊|笑|叹|低声|轻声|开口|接话)`).test(after));
                });
                if (candidate) speaker = candidate;
            }
            r.speaker = (speaker && (this._canonicalName(speaker) || speaker)) || defaultSpeaker;
            prevEnd = r.end;
        });
        return { marks, lines };
    }

    processElement(mesEl, { live = false } = {}) {
        const box = mesEl?.querySelector?.('.mes_text');
        if (!box) return;
        this._clear(box);
        const s = this.getSettings();
        if (!s.enabled) return;
        if (box.querySelector('textarea')) return; // 正在编辑
        const id = Number(mesEl.getAttribute('mesid'));
        const msg = window.SillyTavern?.getContext?.()?.chat?.[id];
        if (msg?.is_system) return;
        if (msg?.is_user && !s.readUser) return;

        // 收集正文文字节点（跳过代码、按钮、其他插件的控件）
        const nodes = [];
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                const p = n.parentElement;
                if (!p || p.closest('script,style,code,pre,button,textarea,iframe,select,.yzsv-bar,.yzsv-all')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let full = '';
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const block = n.parentElement.closest('p,div,li,blockquote,h1,h2,h3,h4,h5,h6,td') || box;
            if (nodes.length && nodes[nodes.length - 1].block !== block) full += '\n';
            nodes.push({ node: n, start: full.length, block });
            full += n.nodeValue;
        }
        if (!full.trim()) return;

        // 聊天记录原文里的 [[名字]] 一直都在，显示的正文里就算被藏掉了也能照着认
        let hints = null;
        if (msg?.mes && String(msg.mes).includes('[[')) {
            hints = new Map();
            try {
                this._analyze(this._rawToText(msg.mes), { id, msg, useMemo: false }).lines.forEach(r => { if (r.marked && !hints.has(r.text)) hints.set(r.text, r.speaker); });
            } catch (e) { hints = null; }
        }
        const { marks, lines: found } = this._analyze(full, { id, msg, hints });
        let lines = found;
        if (!lines.length) { [...marks].reverse().forEach(mk => this._deleteText(nodes, mk.start, mk.end)); return; }

        // 记下每句的上下文，↻ 时可以让 AI 重新判断
        this._lineContext = this._lineContext || new Map();
        // 只给对得上音色的台词挂按钮（说话人在微信里没填音色ID就不显示）
        lines = lines.filter(r => this._hasVoice(this.speakerOverrides[this._overrideKey(id, r.index, r.text)] || r.speaker));
        // 还在生成中：只给语音已经准备好的台词挂按钮
        if (live) lines = lines.filter(r => this._ready?.has(this._readyKey(this.speakerOverrides[this._overrideKey(id, r.index, r.text)] || r.speaker, r.text)));

        // 从后往前改（插按钮、藏标记），前面的位置不会被打乱
        const ops = [
            ...lines.map(r => ({ at: r.end, kind: 'bar', r })),
            ...marks.map(mk => ({ at: mk.start, kind: 'mark', mk }))
        ].sort((a, b) => b.at - a.at);
        ops.forEach(op => {
            if (op.kind === 'mark') { this._deleteText(nodes, op.mk.start, op.mk.end); return; }
            const r = op.r;
            const entry = [...nodes].reverse().find(x => x.start <= r.end - 1);
            if (!entry) return;
            const offset = Math.min(entry.node.nodeValue.length, r.end - entry.start);
            const bar = document.createElement('span');
            bar.className = 'yzsv-bar';
            bar.dataset.text = r.text;
            const override = this.speakerOverrides[this._overrideKey(id, r.index, r.text)];
            bar.dataset.speaker = override || r.speaker;
            bar.dataset.manualSpeaker = override ? '1' : '0';
            bar.dataset.mesid = String(id);
            bar.dataset.line = String(r.index);
            this._lineContext.set(`${id}:${r.index}`, full.slice(Math.max(0, r.start - 120), r.start) + '【' + full.slice(r.start, r.end) + '】' + full.slice(r.end, r.end + 30));
            bar.innerHTML = `<button type="button" class="yzsv-btn yzsv-play" title="播放（${esc(bar.dataset.speaker || '默认音色')}）">▶</button><button type="button" class="yzsv-btn yzsv-regen" title="重新生成（长按：选说话人）">↻</button>`;
            const range = document.createRange();
            range.setStart(entry.node, offset);
            range.collapse(true);
            range.insertNode(bar);
        });

        if (!live && lines.length > 1) {
            const all = document.createElement('div');
            all.className = 'yzsv-all';
            all.innerHTML = `<button type="button" class="yzsv-btn yzsv-playall">▶ 朗读本条全部对白（${lines.length} 句）</button>`;
            box.appendChild(all);
        }
        this._bindBox(box);
    }

    // 删掉正文里 [start, end) 这段文字（可能跨多个文字节点）
    _deleteText(nodes, start, end) {
        nodes.forEach(entry => {
            const len = entry.node.nodeValue.length;
            const a = Math.max(start, entry.start);
            const b = Math.min(end, entry.start + len);
            if (a >= b) return;
            const v = entry.node.nodeValue;
            entry.node.nodeValue = v.slice(0, a - entry.start) + v.slice(b - entry.start);
        });
    }

    // 让模型在台词前写 [[说话人]]（只加在发给模型的提示里，不改聊天记录）
    updatePrompt() {
        const ctx = window.SillyTavern?.getContext?.();
        if (typeof ctx?.setExtensionPrompt !== 'function') return;
        const s = this.getSettings();
        const types = ctx.extension_prompt_types || {};
        const roles = ctx.extension_prompt_roles || {};
        if (!s.enabled || !s.markSpeaker) {
            ctx.setExtensionPrompt(PROMPT_KEY, '', types.IN_CHAT ?? 1, 0);
            return;
        }
        const quotes = parsePairs(s.quotes).map(([a, b]) => `${a}${b}`).join('、') || '「」';
        const [qa, qb] = parsePairs(s.quotes)[0] || ['「', '」'];
        const userName = String(ctx.name1 || '').trim();
        const names = [...new Set([...s.speakers.map(x => x.name), ...this._wechatVoiceNames(), String(ctx.name2 || '').trim(), userName].filter(Boolean))];
        const text = [
            '【台词说话人标注】正文中每一句角色说出口的台词，在开头的对白符号前面紧贴写上说话人：[[角色名]]。',
            `对白符号：${quotes}。例：[[${names[0] || '角色名'}]]${qa}……${qb}`,
            userName ? `用户角色说的话标 [[${userName}]]。` : '',
            names.length ? `同一角色始终用同一个名字：${names.join('、')}。` : '',
            '旁白、动作、心理描写、括号里的译文都不要标；不要解释这个标记，也不要漏标。'
        ].filter(Boolean).join('\n');
        ctx.setExtensionPrompt(PROMPT_KEY, text, types.IN_CHAT ?? 1, 0, false, roles.SYSTEM ?? 0);
    }

    _bindBox(box) {
        if (box.dataset.yzsvBound === '1') return;
        box.dataset.yzsvBound = '1';
        // 长按 ↻ 选说话人
        let pressTimer = null;
        const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
        box.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.yzsv-regen');
            if (!btn) return;
            cancelPress();
            pressTimer = setTimeout(() => {
                pressTimer = null;
                const bar = btn.closest('.yzsv-bar');
                if (!bar) return;
                this._longPressAt = Date.now();
                this._openSpeakerPicker(bar, btn);
            }, 500);
        }, true);
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => box.addEventListener(t, cancelPress, true));
        box.addEventListener('contextmenu', (e) => {
            const btn = e.target.closest('.yzsv-regen');
            if (!btn) return;
            e.preventDefault();
            cancelPress();
            const bar = btn.closest('.yzsv-bar');
            if (bar && Date.now() - (this._longPressAt || 0) > 600) { this._longPressAt = Date.now(); this._openSpeakerPicker(bar, btn); }
        }, true);
        box.addEventListener('click', (e) => {
            const btn = e.target.closest('.yzsv-btn');
            if (!btn) return;
            if (btn.classList.contains('yzsv-regen') && Date.now() - (this._longPressAt || 0) < 700) { e.preventDefault(); e.stopPropagation(); return; }
            e.preventDefault();
            e.stopPropagation();
            this._unlockAudio();
            if (btn.classList.contains('yzsv-playall')) {
                const mes = btn.closest('.mes');
                this.playMessage(Number(mes?.getAttribute('mesid')), btn);
                return;
            }
            const bar = btn.closest('.yzsv-bar');
            if (!bar) return;
            if (btn.classList.contains('yzsv-regen')) { this._regen(bar, btn); return; }
            if (bar._regenJob) { this._toast('正在重新生成', '生成好会自动播放'); return; }
            this.playBars([bar], { trigger: btn });
        }, true);
    }

    // ---------- 合成与播放 ----------
    // 手机浏览器要求“点了才能出声”：点按钮的那一刻先用一段静音把播放器解锁，
    // 后面不管 AI 判断、合成要多久，生成好就能直接播
    _unlockAudio() {
        if (this.playing) return;
        try {
            const a = this.audio;
            a.src = SILENT_WAV;
            const p = a.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* 忽略 */ }
    }

    // ---------- 提前生成 ----------
    _prefetchLines(items = []) {
        if (!this.getSettings().enabled) return;
        this._prefetchQ = this._prefetchQ || [];
        this._prefetchSeen = this._prefetchSeen || new Set();
        items.forEach(({ speaker, text }) => {
            if (!text || !this._hasVoice(speaker)) return;
            const key = `${speaker}\u0001${text}`;
            if (this._prefetchSeen.has(key)) return;
            this._prefetchSeen.add(key);
            this._prefetchQ.push({ speaker, text });
        });
        if (this._prefetchSeen.size > 1000) this._prefetchSeen = new Set([...this._prefetchSeen].slice(-500));
        this._pumpPrefetch();
    }

    _pumpPrefetch() {
        this._prefetchActive = this._prefetchActive || 0;
        while (this._prefetchActive < 3 && this._prefetchQ?.length) {
            const job = this._prefetchQ.shift();
            this._prefetchActive += 1;
            (async () => {
                try {
                    const vi = await this._voiceFor(job.speaker);
                    await Promise.all(splitSpeech(job.text).map(part => this._synth(part, vi)));
                    this._ready = this._ready || new Set();
                    this._ready.add(this._readyKey(job.speaker, job.text));
                    if (this._ready.size > 2000) this._ready = new Set([...this._ready].slice(-1000));
                    if (this._streaming) this._scheduleLive();
                } catch (err) {
                    console.warn('[正文朗读] 提前生成失败:', err);
                    this._prefetchSeen?.delete(`${job.speaker}\u0001${job.text}`);
                } finally {
                    this._prefetchActive -= 1;
                    this._pumpPrefetch();
                }
            })();
        }
    }

    // 原文（可能带思考、<content> 标签和 HTML）→ 纯文字；生成到一半也能用
    _rawToText(raw) {
        let t = String(raw || '');
        t = t.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').replace(/<think(?:ing)?>[\s\S]*$/i, '');
        const open = t.search(/<content>/i);
        if (open >= 0) {
            t = t.slice(open + 9);
            const close = t.search(/<\/content>/i);
            if (close >= 0) t = t.slice(0, close);
        }
        return t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n').replace(/<[^>]*>?/g, '')
            .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
            .replace(/\*+/g, '');
    }

    // 找出已经说完（引号闭合）的台词，马上提前生成
    _prefetchRaw(raw, id, msg) {
        const { lines } = this._analyze(this._rawToText(raw), { id, msg });
        this._prefetchLines(lines.map(r => ({ speaker: this.speakerOverrides[this._overrideKey(id, r.index, r.text)] || r.speaker, text: r.text })));
    }

    // 已经挂好按钮的楼层：把按钮对应的台词提前生成
    _prefetchMessage(id) {
        const el = document.querySelector(`#chat .mes[mesid="${id}"]`);
        const bars = Array.from(el?.querySelectorAll('.mes_text .yzsv-bar') || []);
        this._prefetchLines(bars.map(b => ({ speaker: b.dataset.speaker || '', text: b.dataset.text || '' })));
    }

    // 流式生成中：藏掉 [[名字]]；每句台词一说完（引号闭合）就马上开始生成语音
    _onStreamToken() {
        this._streaming = true;
        this._scheduleLive();
        if (this._streamTimer) return;
        this._streamTimer = setTimeout(() => {
            this._streamTimer = null;
            const s = this.getSettings();
            if (!s.enabled) return;
            const ctx = window.SillyTavern?.getContext?.();
            const chat = ctx?.chat || [];
            const id = chat.length - 1;
            const msg = chat[id];
            if (!msg || msg.is_system || (msg.is_user && !s.readUser)) return;
            const raw = String(msg.mes || '');
            if (!raw) return;
            const go = () => this._prefetchRaw(raw, id, msg);
            if (this._wxData) go();
            else this._getWechatData().catch(() => null).then(go);
        }, 150);
    }

    // 生成中：每次正文刷新后，把已经生成好语音的台词按钮挂回去（藏掉 [[名字]]）
    _scheduleLive() {
        if (this._markRaf) return;
        this._markRaf = requestAnimationFrame(() => {
            this._markRaf = 0;
            this._hideLiveMarks();
            if (!this._streaming) return;
            const chat = window.SillyTavern?.getContext?.()?.chat || [];
            const el = document.querySelector(`#chat .mes[mesid="${chat.length - 1}"]`);
            if (el) { try { this.processElement(el, { live: true }); } catch (e) { /* 忽略 */ } }
        });
    }

    _readyKey(speaker, text) {
        return `${speaker || ''}\u0001${text || ''}`;
    }

    _hideLiveMarks() {
        const all = document.querySelectorAll('#chat .mes .mes_text');
        const box = all[all.length - 1];
        if (!box) return;
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.nodeValue && n.nodeValue.includes('[[')) n.nodeValue = n.nodeValue.replace(MARK_RE, '');
        }
    }

    // 当前酒馆聊天的标识：换聊天后微信数据（联系人、音色）也要跟着换
    _chatSig() {
        const ctx = window.SillyTavern?.getContext?.() || {};
        let key = '';
        try { key = String(this.storage?.getContextKey?.() || ''); } catch (e) { key = ''; }
        return `${ctx.chatId || ''}|${ctx.characterId ?? ''}|${ctx.groupId ?? ''}|${key}`;
    }

    // 自己单独读一份微信数据（只读，不碰小手机里正在用的那份），聊天一换就重新读
    _wx() {
        const d = this._wxData;
        if (!d) return null;
        const sig = this._chatSig();
        if (sig !== this._wxSig || this._wxDirty) {
            try { d.data = d.loadData(); } catch (e) { /* 忽略 */ }
            this._wxSig = sig;
            this._wxDirty = false;
        }
        return d;
    }

    async _getWechatData() {
        if (this._wxData) return this._wx();
        if (!this.storage) return null;
        if (!this._wxLoading) {
            this._wxLoading = import('../wechat/wechat-data.js?v=20261011-wallet-credit-repayment').then(mod => {
                this._wxData = new mod.WechatData(this.storage);
                this._wxSig = this._chatSig();
                this._wxDirty = false;
                return this._wxData;
            }).catch(e => { console.warn('[正文朗读] 读取微信联系人失败:', e); this._wxLoading = null; return null; });
        }
        await this._wxLoading;
        return this._wx();
    }

    // 按小手机的规则算出某人（联系人或“我”）当前该用的音色
    _pickVoice(obj = {}) {
        const globalProvider = String(this.storage?.get?.('phone-tts-provider') || 'minimax_cn').trim() || 'minimax_cn';
        const voices = obj.ttsVoices && typeof obj.ttsVoices === 'object' ? obj.ttsVoices : {};
        const bound = String(obj.ttsProvider || '').trim();
        const lang = String(obj.ttsLanguageBoost || 'auto').trim() || 'auto';
        const has = Object.entries(voices).filter(([, v]) => String(v || '').trim());
        if (String(voices[globalProvider] || '').trim()) return { voice: String(voices[globalProvider]).trim(), provider: globalProvider, languageBoost: lang };
        const provider = bound || globalProvider;
        if (String(voices[provider] || '').trim()) return { voice: String(voices[provider]).trim(), provider, languageBoost: lang };
        if (has.length) return { voice: String(has[0][1]).trim(), provider: has[0][0], languageBoost: lang };
        if (String(obj.ttsVoice || '').trim()) return { voice: String(obj.ttsVoice).trim(), provider, languageBoost: lang };
        return null;
    }

    _splitAliases(v) {
        return (Array.isArray(v) ? v : String(v || '').split(/[,，、;；\n]/)).map(x => String(x || '').trim()).filter(Boolean);
    }

    // 微信里填了音色的人：联系人（真实姓名 + 自己加的可识别名字）和“我”
    _wechatVoiceContacts() {
        const data = this._wx();
        const out = [];
        let list = [];
        try { list = data?.getContacts?.() || []; } catch (e) { list = []; }
        list.forEach(c => {
            const vi = this._pickVoice(c || {});
            if (!vi) return;
            const aliases = [...new Set([String(c.realName || c.name || '').trim(), ...this._splitAliases(c.voiceAliases)].filter(Boolean))];
            if (aliases.length) out.push({ primary: aliases[0], aliases, voiceInfo: vi });
        });
        const me = data?.data?.userInfo;
        const myVoice = me ? this._pickVoice(me) : null;
        if (myVoice) {
            const ctxName = String(window.SillyTavern?.getContext?.()?.name1 || '').trim();
            const aliases = [...new Set([ctxName, String(me.realName || me.name || '').trim(), ...this._splitAliases(me.voiceAliases)].filter(Boolean))];
            if (aliases.length) out.push({ primary: aliases[0], aliases, voiceInfo: myVoice, isMe: true });
        }
        return out;
    }

    _wechatVoiceNames() {
        return this._wechatVoiceContacts().map(x => x.primary);
    }

    _wechatVoiceAliases() {
        return this._wechatVoiceContacts().flatMap(x => x.aliases);
    }

    _findWechatVoice(name = '') {
        const n = String(name || '').trim();
        if (!n) return null;
        const list = this._wechatVoiceContacts();
        return list.find(x => x.aliases.includes(n))
            || list.find(x => x.aliases.some(a => a.length >= 2 && n.length >= 2 && (a.includes(n) || n.includes(a))))
            || null;
    }

    _findAppSpeaker(name = '') {
        const sp = String(name || '').trim();
        if (!sp) return null;
        const list = this.getSettings().speakers.filter(x => x.name && x.voice);
        return list.find(x => x.name === sp)
            || list.find(x => sp.length >= 2 && x.name.length >= 2 && (sp.includes(x.name) || x.name.includes(sp)))
            || null;
    }

    // 说话人 → 音色：先看「朗读」App 里登记的，再看微信（联系人 / 我的音色），最后用默认
    async _voiceFor(speaker = '') {
        const s = this.getSettings();
        const hit = this._findAppSpeaker(speaker);
        if (hit) return { voice: hit.voice };
        if (String(speaker || '').trim()) {
            await this._getWechatData();
            const wx = this._findWechatVoice(speaker);
            if (wx) return { ...wx.voiceInfo };
        }
        return { voice: s.voice || '' };
    }

    // 缓存按「平台+音色+文本」区分：联系人音色改了，点 ▶ 就会自动重新生成
    async _synth(text, voiceInfo, { regen = false, signal } = {}) {
        if (!this.tts?.requestTTS) throw new Error('小手机的语音模块还没加载');
        const vi = typeof voiceInfo === 'object' && voiceInfo ? voiceInfo : { voice: voiceInfo || '' };
        const provider = vi.provider || String(this.storage?.get?.('phone-tts-provider') || '');
        text = this._applyReadings(text);
        const key = `${provider}\u0001${vi.voice || ''}\u0001${vi.languageBoost || ''}\u0001${text}`;
        if (!regen && this.cache.has(key)) return this.cache.get(key);
        this._inflight = this._inflight || new Map();
        if (!regen && this._inflight.has(key)) return this._inflight.get(key);
        const job = this._synthNow(key, text, vi, signal);
        this._inflight.set(key, job);
        try { return await job; } finally { if (this._inflight.get(key) === job) this._inflight.delete(key); }
    }

    async _synthNow(key, text, vi, signal) {
        this._gen = this._gen || new Map();
        const token = (this._gen.get(key) || 0) + 1;
        this._gen.set(key, token);
        const opts = { voice: vi.voice || undefined, signal };
        if (vi.provider) opts.provider = vi.provider;
        if (vi.languageBoost) opts.languageBoost = vi.languageBoost;
        const url = await this.tts.requestTTS(text, opts);
        // 晚回来的旧请求不能盖掉新生成的语音
        if (this._gen.get(key) !== token) return this.cache.get(key) || url;
        const old = this.cache.get(key);
        this.cache.set(key, url);
        if (old && old !== url) this._safeRevoke(old);
        if (this.cache.size > 300) {
            const first = this.cache.keys().next().value;
            this._safeRevoke(this.cache.get(first));
            this.cache.delete(first);
        }
        return url;
    }

    // 正在播的音频不能回收，否则会播到一半断掉
    _safeRevoke(url) {
        if (!url) return;
        const playingNow = () => { try { return this.audio.src === url && !this.audio.paused; } catch (e) { return false; } };
        const go = () => { if (playingNow()) { setTimeout(go, 30000); return; } try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } };
        setTimeout(go, 30000);
    }

    // 名字读音：微信联系人 / 我的音色里填的「写法 → 读音」，合成前替换
    _readingRules() {
        const data = this._wx();
        const rules = [];
        const add = (list) => (Array.isArray(list) ? list : []).forEach(r => {
            const t = String(r?.text || '').trim(); const rd = String(r?.reading || '').trim();
            if (t && rd) rules.push([t, rd]);
        });
        try { (data?.getContacts?.() || []).forEach(c => add(c?.nameReadings)); } catch (e) { /* 忽略 */ }
        add(data?.data?.userInfo?.nameReadings);
        const seen = new Set();
        return rules.filter(([t]) => !seen.has(t) && seen.add(t)).sort((a, b) => b[0].length - a[0].length);
    }

    _applyReadings(text) {
        const rules = this._readingRules();
        if (!rules.length) return text;
        const re = new RegExp(rules.map(([t]) => reEsc(t)).join('|'), 'g');
        const map = new Map(rules);
        return String(text).replace(re, m => map.get(m) || m);
    }

    stop() {
        const p = this.playing;
        this.playing = null;
        try { this.audio.pause(); } catch (e) { /* 忽略 */ }
        if (p) {
            p.abort?.abort?.();
            p.bars.forEach(b => b.classList.remove('is-playing', 'is-loading'));
            p.trigger?.classList.remove('is-active');
        }
    }

    playMessage(id, trigger = null) {
        const el = document.querySelector(`#chat .mes[mesid="${id}"]`);
        const bars = Array.from(el?.querySelectorAll('.mes_text .yzsv-bar') || []);
        if (!bars.length) return;
        this.playBars(bars, { trigger });
    }

    async playBars(bars, { regen = false, trigger = null } = {}) {
        const same = this.playing && this.playing.trigger === trigger && trigger;
        this.stop();
        if (same) return; // 再点一次 = 停止
        const abort = new AbortController();
        const run = { bars, trigger, abort };
        this.playing = run;
        trigger?.classList.add('is-active');
        // 每句台词：长句拆成几段并行合成，合成完拼成一整段再播（不会播到一半断掉）；
        // 播这一句的时候，下一句已经在后台合成
        const queue = [];
        const voiceMemo = new Map();
        for (const bar of bars) {
            const sp = bar.dataset.speaker || '';
            if (!voiceMemo.has(sp)) voiceMemo.set(sp, await this._voiceFor(sp));
            if (this.playing !== run) return;
            const parts = splitSpeech(bar.dataset.text);
            if (parts.length) queue.push({ bar, parts, voice: voiceMemo.get(sp) });
        }
        const jobs = new Array(queue.length);
        const start = (i) => {
            if (i >= queue.length || jobs[i]) return;
            const q = queue[i];
            jobs[i] = Promise.all(q.parts.map(part => this._synthRetry(part, q.voice, { regen, signal: abort.signal })))
                .then(urls => this._joinAudio(urls));
            jobs[i].catch(() => {});
        };
        try {
            start(0); start(1);
            for (let i = 0; i < queue.length; i++) {
                if (this.playing !== run) return;
                const q = queue[i];
                q.bar.classList.add('is-loading');
                const urls = await jobs[i];
                start(i + 1); start(i + 2);
                if (this.playing !== run) return;
                q.bar.classList.remove('is-loading');
                q.bar.classList.add('is-playing');
                for (const url of urls) {
                    if (this.playing !== run) return;
                    await this._playUrl(url, run);
                }
                q.bar.classList.remove('is-playing');
            }
        } catch (err) {
            if (abort.signal.aborted || err?.name === 'AbortError') return;
            console.warn('[正文朗读] 失败:', err);
            this._toast('朗读失败', String(err?.message || err).slice(0, 160));
        } finally {
            if (this.playing === run) this.stop();
        }
    }

    // 合成失败（比如免费额度并发限制）自动再试一次
    async _synthRetry(text, voice, opts) {
        try { return await this._synth(text, voice, opts); }
        catch (err) {
            if (opts?.signal?.aborted || err?.name === 'AbortError') throw err;
            await new Promise(r => setTimeout(r, 800));
            return this._synth(text, voice, { ...opts, regen: true });
        }
    }

    // 几段 mp3 直接首尾相接成一段；不是 mp3 的就按顺序分开播
    // 几段语音解码后拼成一段 WAV（时长准确，不会只播第一段）；解码不了就按顺序分开播
    async _joinAudio(urls) {
        if (urls.length <= 1) return urls;
        const key = urls.join('|');
        this._joined = this._joined || new Map();
        if (this._joined.has(key)) return [this._joined.get(key)];
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return urls;
            this._decoder = this._decoder || new Ctx();
            const bufs = [];
            for (const u of urls) {
                const ab = await (await fetch(u)).arrayBuffer();
                bufs.push(await new Promise((res, rej) => {
                    const p = this._decoder.decodeAudioData(ab, res, rej);
                    if (p && p.then) p.then(res, rej);
                }));
            }
            const rate = bufs[0].sampleRate;
            const gap = Math.round(rate * 0.12);
            const total = bufs.reduce((n, b) => n + b.length, 0) + gap * (bufs.length - 1);
            const pcm = new Float32Array(total);
            let at = 0;
            bufs.forEach((b, i) => {
                const ch0 = b.getChannelData(0);
                if (b.numberOfChannels > 1) {
                    const ch1 = b.getChannelData(1);
                    for (let k = 0; k < b.length; k++) pcm[at + k] = (ch0[k] + ch1[k]) / 2;
                } else pcm.set(ch0, at);
                at += b.length + (i < bufs.length - 1 ? gap : 0);
            });
            const url = URL.createObjectURL(encodeWav(pcm, rate));
            this._joined.set(key, url);
            if (this._joined.size > 80) {
                const first = this._joined.keys().next().value;
                this._safeRevoke(this._joined.get(first));
                this._joined.delete(first);
            }
            return [url];
        } catch (e) {
            console.warn('[正文朗读] 拼接失败，改为分段播放:', e);
            return urls;
        }
    }

    // 播一段，真正播完才进入下一段
    _playUrl(url, run) {
        return new Promise((resolve, reject) => {
            const a = this.audio;
            let finished = false;
            const cleanup = () => { finished = true; a.onended = null; a.onerror = null; a.onpause = null; clearInterval(timer); };
            const done = () => { if (!finished) { cleanup(); resolve(); } };
            const fail = (err) => { if (!finished) { cleanup(); reject(err || new Error('音频播放失败')); } };
            // 有的手机浏览器播完不发 ended：暂停在结尾也算播完；被 stop() 打断也结束
            const timer = setInterval(() => {
                if (this.playing !== run) return done();
                if (a.paused && a.duration && a.currentTime >= a.duration - 0.25) done();
            }, 400);
            a.onended = done;
            a.onerror = () => fail();
            a.preload = 'auto';
            a.src = url;
            const p = a.play();
            if (p && typeof p.catch === 'function') p.catch(err => fail(err));
        });
    }

    _toast(title, text) {
        if (this.phoneShell?.showNotification) this.phoneShell.showNotification(title, text, '🔊');
        else if (window.toastr) window.toastr.warning(text, title);
        else console.warn(title, text);
    }

    async test(voice = '') {
        const url = await this._synth('你好呀，这是正文朗读的试听。', voice || this.getSettings().voice, { regen: true });
        this.stop();
        this.audio.src = url;
        await this.audio.play();
    }

    clearCache() {
        this.cache.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } });
        this.cache.clear();
    }

    _injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent = `
.yzsv-bar { display: inline-flex; align-items: center; gap: 3px; margin: 0 3px; vertical-align: middle; white-space: nowrap; }
.yzsv-btn { border: 1px solid rgba(255,255,255,.18); background: rgba(127,127,127,.16); color: inherit; opacity: .8; border-radius: 999px; padding: 0 8px; min-width: 26px; height: 22px; font-size: .75em; line-height: 20px; cursor: pointer; font-family: inherit; }
.yzsv-btn:hover { opacity: 1; }
.yzsv-regen { padding: 1px 7px; }
.yzsv-btn { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
.yzsv-regen.is-busy { animation: yzsv-spin .8s linear infinite; opacity: .8; pointer-events: none; }
@keyframes yzsv-spin { to { transform: rotate(360deg); } }
.yzsv-bar.is-loading .yzsv-play { opacity: .5; }
.yzsv-bar.is-loading .yzsv-play::after { content: '…'; }
.yzsv-bar.is-playing .yzsv-play { background: rgba(80,160,255,.28); border-color: rgba(80,160,255,.55); opacity: 1; }
.yzsv-all { margin-top: 8px; }
.yzsv-all .yzsv-btn.is-active { background: rgba(80,160,255,.28); border-color: rgba(80,160,255,.55); opacity: 1; }
.yzsv-pop { position: fixed; z-index: 100000; background: rgba(32,32,38,.96); color: #f2f2f2; border-radius: 14px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.yzsv-pop-title { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-weight: 600; margin-bottom: 10px; }
.yzsv-pop-title span { font-weight: 400; font-size: 11px; opacity: .6; }
.yzsv-pop button { font-family: inherit; cursor: pointer; }
.yzsv-pop-ai { width: 100%; border: 0; border-radius: 10px; padding: 9px; background: linear-gradient(135deg, #7f7fd5, #86a8e7); color: #fff; font-size: 13px; }
.yzsv-pop-ai:disabled { opacity: .7; }
.yzsv-pop-names { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.yzsv-pop-names button { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: inherit; border-radius: 999px; padding: 5px 12px; font-size: 12.5px; }
.yzsv-pop-names button.is-on { background: rgba(134,168,231,.35); border-color: rgba(134,168,231,.8); }
.yzsv-pop-empty { margin-top: 10px; font-size: 11.5px; opacity: .75; line-height: 1.5; padding: 8px 10px; border-radius: 10px; border: 1px dashed rgba(255,255,255,.25); background: rgba(255,255,255,.05); }
.yzsv-pop-same { width: 100%; margin-top: 10px; border: 1px solid rgba(134,168,231,.65); background: rgba(134,168,231,.16); color: #dfe6ff; border-radius: 10px; font-size: 12.5px; padding: 8px 9px; line-height: 1.4; }
.yzsv-pop-same:active { background: rgba(134,168,231,.32); }

/* ---- 朗读 App ---- */
.yzsv-page { position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; background: linear-gradient(180deg, #f3f0ff 0%, #f6f6fa 220px, #f6f6fa 100%); color: #222; overflow: hidden; font-size: 13px; box-sizing: border-box; }
.yzsv-head { flex: 0 0 auto; height: 68px; padding: 32px 10px 0; box-sizing: border-box; display: flex; align-items: center; gap: 4px; }
.yzsv-back { width: 34px; height: 34px; border: 0; background: transparent; color: #222; font-size: 16px; cursor: pointer; border-radius: 50%; }
.yzsv-head-title { flex: 1; text-align: center; font-size: 15px; font-weight: 600; margin-right: 38px; }
.yzsv-page .yzsv-body { flex: 1 1 0 !important; height: 0 !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: auto !important; overscroll-behavior: contain; touch-action: pan-y !important; padding: 6px 14px 60px !important; box-sizing: border-box; scrollbar-width: none; }
.yzsv-page .yzsv-body::-webkit-scrollbar { display: none; }
.yzsv-hero { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); color: #fff; box-shadow: 0 8px 22px rgba(161,140,209,.35); margin-bottom: 16px; }
.yzsv-hero-icon { flex: 0 0 46px; height: 46px; border-radius: 14px; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 22px; }
.yzsv-hero b { display: block; font-size: 16px; }
.yzsv-hero small { display: block; margin-top: 3px; font-size: 11.5px; opacity: .9; }
.yzsv-sec { font-size: 12px; color: #8a8a99; margin: 0 6px 6px; font-weight: 600; letter-spacing: .5px; }
.yzsv-card { background: #fff; border-radius: 16px; padding: 4px 14px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
.yzsv-card.pad { padding: 14px; }
.yzsv-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f1f4; cursor: pointer; }
.yzsv-row:last-child { border-bottom: 0; }
.yzsv-row > span:first-child { flex: 1; min-width: 0; font-size: 14px; }
.yzsv-row small, .yzsv-note { display: block; color: #9a9aa6; font-size: 11px; line-height: 1.5; margin-top: 3px; font-weight: 400; }
.yzsv-switch { position: relative; flex: 0 0 44px; width: 44px; height: 26px; }
.yzsv-switch input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.yzsv-switch i { position: absolute; inset: 0; border-radius: 13px; background: #e2e2e8; transition: background .2s; pointer-events: none; }
.yzsv-switch i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .2s; }
.yzsv-switch input:checked + i { background: #a18cd1; }
.yzsv-switch input:checked + i::after { transform: translateX(18px); }
.yzsv-field { margin-bottom: 12px; }
.yzsv-field:last-child { margin-bottom: 0; }
.yzsv-field label { display: block; font-size: 12.5px; color: #555; margin-bottom: 6px; font-weight: 600; }
.yzsv-input { width: 100%; box-sizing: border-box; border: 1px solid #ececf2; border-radius: 11px; padding: 9px 11px; font-size: 13px; background: #f8f8fb; color: #222; outline: none; }
.yzsv-input:focus { border-color: #a18cd1; background: #fff; }
.yzsv-spk { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 12px; background: #f8f8fb; margin-bottom: 8px; }
.yzsv-spk-av { flex: 0 0 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #a18cd1, #fbc2eb); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
.yzsv-spk .yzsv-input { background: #fff; padding: 7px 9px; }
.yzsv-spk .yzsv-input[data-spk="name"] { flex: 0 0 34%; }
.yzsv-spk-del { flex: 0 0 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: #c9c9d3; font-size: 15px; cursor: pointer; }
.yzsv-mini { border: 0; background: #f1f0f7; border-radius: 10px; padding: 9px 12px; font-size: 12.5px; color: #444; cursor: pointer; font-family: inherit; }
.yzsv-mini.is-primary { background: #a18cd1; color: #fff; font-weight: 600; }
.yzsv-mini.is-wide { width: 100%; border: 1.5px dashed #d9d4ec; background: transparent; color: #8a7bbf; }
.yzsv-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
`;
        document.head.appendChild(st);
    }
}

// ---------- 小手机里的「朗读」App：设置页 ----------
export class StoryVoiceApp {
    constructor(phoneShell, storyVoice) {
        this.phoneShell = phoneShell;
        this.sv = storyVoice;
    }

    render() {
        const s = this.sv.getSettings();
        const spk = s.speakers.length ? s.speakers : [{ name: '', voice: '' }];
        const sw = (k, title, desc) => `<label class="yzsv-row"><span>${title}<small>${desc}</small></span><span class="yzsv-switch"><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}><i></i></span></label>`;
        const row = (x) => `<div class="yzsv-spk"><span class="yzsv-spk-av">${esc((x.name || '?').slice(0, 1))}</span><input class="yzsv-input" data-spk="name" placeholder="角色名" value="${esc(x.name)}"><input class="yzsv-input" data-spk="voice" placeholder="音色 ID" value="${esc(x.voice)}"><button type="button" class="yzsv-spk-del" data-spk-del title="删除">✕</button></div>`;
        const count = s.speakers.filter(x => x.name && x.voice).length;
        const html = `
            <div class="yzsv-page">
                <div class="yzsv-head">
                    <button class="yzsv-back" id="yzsv-back" type="button" aria-label="返回"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="yzsv-head-title">正文朗读</div>
                </div>
                <div class="yzsv-body app-body">
                    <div class="yzsv-hero">
                        <div class="yzsv-hero-icon">🔊</div>
                        <div><b>${s.enabled ? '朗读已开启' : '朗读已关闭'}</b><small>角色音色 ${count} 个 · 对白符号 ${esc(s.quotes || '未设置')}</small></div>
                    </div>

                    <div class="yzsv-sec">基础</div>
                    <div class="yzsv-card">
                        ${sw('enabled', '启用正文朗读', '正文里对白符号中的台词后面出现 ▶ 和 ↻')}
                        ${sw('markSpeaker', '让模型标出说话人', '写正文时在台词前加 [[角色名]]，显示时自动藏起来')}
                        ${sw('readUser', '也读我的消息', '默认只读角色的回复')}
                    </div>

                    <div class="yzsv-sec">对白符号 · 跳过符号</div>
                    <div class="yzsv-card pad">
                        <div class="yzsv-field"><label>对白符号（这些符号里的是台词）</label><input class="yzsv-input" data-k="quotes" value="${esc(s.quotes)}"></div>
                        <div class="yzsv-field"><label>跳过符号（这些符号里的不读）</label><input class="yzsv-input" data-k="skips" value="${esc(s.skips)}"></div>
                        <div class="yzsv-note">成对写，逗号分隔；开合各一个字符写在一起（「」），多字符或相同字符中间空一格（** **）。台词在引号里、译文在括号里：对白填 “”，跳过填 （）。</div>
                    </div>

                    <div class="yzsv-sec">音色</div>
                    <div class="yzsv-card pad">
                        <div class="yzsv-field"><label>默认音色</label><input class="yzsv-input" data-k="voice" value="${esc(s.voice)}" placeholder="Fish 的 reference_id，留空用「设置 → 语音」的音色"></div>
                        <div class="yzsv-field"><label>角色音色</label>
                            <div id="yzsv-spk-list">${spk.map(row).join('')}</div>
                            <button type="button" class="yzsv-mini is-wide" id="yzsv-spk-add">＋ 添加角色</button>
                            <div class="yzsv-note">名字写全名或常用称呼都行（家入硝子 / 硝子 会自动对上）。识别错了就点正文里的 ↻，可以直接选人或让 AI 重新判断。</div>
                        </div>
                        <div class="yzsv-btns">
                            <button type="button" class="yzsv-mini is-primary" id="yzsv-save">保存</button>
                            <button type="button" class="yzsv-mini" id="yzsv-test">试听</button>
                            <button type="button" class="yzsv-mini" id="yzsv-clear">清缓存</button>
                        </div>
                    </div>
                    <div class="yzsv-note" style="margin:0 6px;">引擎、API 地址和 Key 用的是小手机「设置 → 语音」里的配置。每句语音生成后会缓存，再点 ▶ 不会重复扣费。</div>
                </div>
            </div>`;
        this.phoneShell.setContent(html, 'story-voice');
        this._bind();
    }

    _root() {
        return document.querySelector('.phone-view-current') || document;
    }

    _collect() {
        const root = this._root();
        const val = k => root.querySelector(`[data-k="${k}"]`);
        const speakers = Array.from(root.querySelectorAll('.yzsv-spk')).map(row => ({
            name: String(row.querySelector('[data-spk="name"]')?.value || '').trim(),
            voice: String(row.querySelector('[data-spk="voice"]')?.value || '').trim()
        })).filter(x => x.name || x.voice);
        return {
            enabled: !!val('enabled')?.checked,
            readUser: !!val('readUser')?.checked,
            markSpeaker: !!val('markSpeaker')?.checked,
            quotes: String(val('quotes')?.value || '').trim() || DEFAULTS.quotes,
            skips: String(val('skips')?.value || '').trim(),
            voice: String(val('voice')?.value || '').trim(),
            speakers
        };
    }

    // 手机浏览器里滚到底/顶后，下一次滑动会被外层接走，看起来就“滑不动”了：
    // 每次手指按下时，让列表离开边缘 1px，滑动始终交给列表自己
    _fixScroll(root) {
        const body = root?.querySelector?.('.yzsv-body');
        if (!body || body.__yzsvScrollFix) return;
        body.__yzsvScrollFix = true;
        const nudge = () => {
            const max = body.scrollHeight - body.clientHeight;
            if (max <= 0) return;
            if (body.scrollTop <= 0) body.scrollTop = 1;
            else if (body.scrollTop >= max) body.scrollTop = max - 1;
        };
        body.addEventListener('touchstart', nudge, { passive: true });
        body.addEventListener('pointerdown', nudge, { passive: true });
        // 点输入框时浏览器可能把外层容器也顶上去，复位
        root.addEventListener('focusin', () => {
            setTimeout(() => {
                const page = root.querySelector('.yzsv-page');
                [page, page?.parentElement].forEach(el => { if (el && el.scrollTop) el.scrollTop = 0; });
            }, 300);
        });
        // 兜底：连续几下手指在动、列表却纹丝不动，就由我们自己滚（只在“卡住”时接管）
        let lastY = null, lastTop = 0, stuck = 0, manual = false;
        body.addEventListener('touchstart', (e) => { lastY = e.touches?.[0]?.clientY ?? null; lastTop = body.scrollTop; stuck = 0; manual = false; }, { passive: true });
        body.addEventListener('touchmove', (e) => {
            const y = e.touches?.[0]?.clientY;
            if (lastY == null || y == null) return;
            const dy = lastY - y;
            lastY = y;
            const max = body.scrollHeight - body.clientHeight;
            if (max <= 0 || Math.abs(dy) < 1) return;
            if (!manual) {
                const want = dy > 0 ? body.scrollTop < max : body.scrollTop > 0;
                if (want && body.scrollTop === lastTop) stuck += 1; else stuck = 0;
                lastTop = body.scrollTop;
                if (stuck >= 3) manual = true;
            }
            if (manual) {
                body.scrollTop = Math.max(0, Math.min(max, body.scrollTop + dy));
                lastTop = body.scrollTop;
            }
        }, { passive: true });
    }

    _bind() {
        const root = this._root();
        this._fixScroll(root);
        const toast = (t, m, i = '🔊') => this.phoneShell?.showNotification?.(t, m, i);
        root.querySelector('#yzsv-back')?.addEventListener('click', () => {
            if (typeof this.phoneShell?.goHome === 'function') this.phoneShell.goHome();
            else window.dispatchEvent(new CustomEvent('phone:goHome'));
        });
        root.querySelectorAll('input[type=checkbox][data-k]').forEach(cb => cb.addEventListener('change', () => {
            const s = this.sv.saveSettings(this._collect());
            const hero = root.querySelector('.yzsv-hero b');
            if (hero) hero.textContent = s.enabled ? '朗读已开启' : '朗读已关闭';
        }));
        root.querySelector('#yzsv-save')?.addEventListener('click', () => {
            const s = this.sv.saveSettings(this._collect());
            toast('已保存', `对白符号 ${s.quotes || '（空）'}，角色音色 ${s.speakers.length} 个`, '✅');
        });
        const bindDel = (btn) => btn.addEventListener('click', () => {
            btn.closest('.yzsv-spk')?.remove();
            this.sv.saveSettings(this._collect());
        });
        root.querySelector('#yzsv-spk-add')?.addEventListener('click', () => {
            const list = root.querySelector('#yzsv-spk-list');
            if (!list) return;
            list.insertAdjacentHTML('beforeend', '<div class="yzsv-spk"><span class="yzsv-spk-av">?</span><input class="yzsv-input" data-spk="name" placeholder="角色名"><input class="yzsv-input" data-spk="voice" placeholder="音色 ID"><button type="button" class="yzsv-spk-del" data-spk-del title="删除">✕</button></div>');
            bindDel(list.lastElementChild.querySelector('[data-spk-del]'));
            bindName(list.lastElementChild.querySelector('[data-spk="name"]'));
            list.lastElementChild.querySelector('input')?.focus();
        });
        const bindName = (input) => input?.addEventListener('input', () => {
            const av = input.closest('.yzsv-spk')?.querySelector('.yzsv-spk-av');
            if (av) av.textContent = (input.value.trim() || '?').slice(0, 1);
        });
        root.querySelectorAll('[data-spk-del]').forEach(bindDel);
        root.querySelectorAll('[data-spk="name"]').forEach(bindName);
        root.querySelectorAll('input.yzsv-input[data-k]').forEach(inp => inp.addEventListener('change', () => this.sv.saveSettings(this._collect())));
        root.querySelector('#yzsv-test')?.addEventListener('click', async () => {
            const s = this.sv.saveSettings(this._collect());
            try {
                toast('试听', '正在生成…', '⏳');
                await this.sv.test(s.voice);
            } catch (e) {
                toast('试听失败', String(e?.message || e).slice(0, 160), '⚠️');
            }
        });
        root.querySelector('#yzsv-clear')?.addEventListener('click', () => {
            this.sv.clearCache();
            toast('已清除', '语音缓存已清空', '🧹');
        });
    }
}

// 小手机启动时调用一次
let INSTANCE = null;
export function installStoryVoice(options = {}) {
    if (!INSTANCE) {
        INSTANCE = new StoryVoice(options);
        INSTANCE.install();
    } else {
        if (options.ttsManager) INSTANCE.tts = options.ttsManager;
        if (options.phoneShell) INSTANCE.phoneShell = options.phoneShell;
    }
    try {
        if (!window.VirtualPhone) window.VirtualPhone = {};
        window.VirtualPhone.storyVoice = INSTANCE;
    } catch (e) { /* 忽略 */ }
    return INSTANCE;
}
