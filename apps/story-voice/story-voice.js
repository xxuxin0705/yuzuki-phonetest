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
    autoPlay: false,
    markSpeaker: true
});
const MARK_RE = /\[\[([^\[\]\n]{1,24})\]\][ \t]*[:：]?[ \t]*/g;
const PROMPT_KEY = 'yzsv_speaker_mark';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

    // ---------- 酒馆挂钩 ----------
    install() {
        if (this._installed) return;
        this._installed = true;
        this._injectStyle();
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
            if (ev.CHAT_CHANGED) es.on(ev.CHAT_CHANGED, () => { this.stop(); this.updatePrompt(); setTimeout(() => this.refreshAll(), 400); });
            if (ev.MESSAGE_DELETED) es.on(ev.MESSAGE_DELETED, () => this.stop());
            if (ev.GENERATION_ENDED) es.on(ev.GENERATION_ENDED, () => {
                const chat = window.SillyTavern?.getContext?.()?.chat || [];
                const id = chat.length - 1;
                setTimeout(() => {
                    this.processById(id);
                    const s = this.getSettings();
                    const msg = chat[id];
                    if (s.enabled && s.autoPlay && msg && !msg.is_user && !msg.is_system) this.playMessage(id);
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

    processById(id) {
        const el = document.querySelector(`#chat .mes[mesid="${CSS.escape ? CSS.escape(String(id)) : id}"]`);
        if (el) this.processElement(el);
    }

    _clear(box) {
        box.querySelectorAll('.yzsv-bar, .yzsv-all').forEach(n => n.remove());
    }

    processElement(mesEl) {
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

        // 模型标的说话人 [[角色名]]：记下来，显示时藏掉
        const marks = [];
        for (const m of full.matchAll(MARK_RE)) marks.push({ start: m.index, end: m.index + m[0].length, name: m[1].trim() });
        const removeMarks = () => {
            [...marks].reverse().forEach(mk => this._deleteText(nodes, mk.start, mk.end));
        };

        const skips = findRanges(full, parsePairs(s.skips), 3000);
        const inSkip = (a, b) => skips.some(r => a >= r.start && b <= r.end);
        let lines = findRanges(full, parsePairs(s.quotes)).filter(r => !inSkip(r.start, r.end));
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
        if (!lines.length) { removeMarks(); return; }

        const defaultSpeaker = String(msg?.name || '').trim();
        const speakerNames = s.speakers.map(x => x.name).filter(Boolean);
        let prevEnd = 0;
        lines.forEach((r, i) => {
            // 1) 模型标的 [[角色名]]（紧挨在台词前面）
            const mark = marks.find(mk => mk.end <= r.start && r.start - mk.end <= 2 && !/\S/.test(full.slice(mk.end, r.start)));
            if (mark) {
                r.speaker = mark.name;
                r.marked = true;
                r.index = i;
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
            r.speaker = speaker || defaultSpeaker;
            r.index = i;
            prevEnd = r.end;
        });

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
            bar.dataset.speaker = r.speaker;
            bar.dataset.mesid = String(id);
            bar.dataset.line = String(r.index);
            bar.innerHTML = `<button type="button" class="yzsv-btn yzsv-play" title="播放这句：${esc(r.speaker || '默认音色')}${r.marked ? '' : '（自动判断）'}">▶ 播放</button><button type="button" class="yzsv-btn yzsv-regen" title="重新生成这句语音">↻</button>`;
            const range = document.createRange();
            range.setStart(entry.node, offset);
            range.collapse(true);
            range.insertNode(bar);
        });

        if (lines.length > 1) {
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
        const names = [...new Set([...s.speakers.map(x => x.name), String(ctx.name2 || '').trim(), userName].filter(Boolean))];
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
        box.addEventListener('click', (e) => {
            const btn = e.target.closest('.yzsv-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (btn.classList.contains('yzsv-playall')) {
                const mes = btn.closest('.mes');
                this.playMessage(Number(mes?.getAttribute('mesid')), btn);
                return;
            }
            const bar = btn.closest('.yzsv-bar');
            if (!bar) return;
            this.playBars([bar], { regen: btn.classList.contains('yzsv-regen'), trigger: btn });
        }, true);
    }

    // ---------- 合成与播放 ----------
    _voiceFor(speaker = '') {
        const s = this.getSettings();
        const hit = s.speakers.find(x => x.name && x.voice && (x.name === speaker || speaker.includes(x.name)));
        return hit?.voice || s.voice || '';
    }

    async _synth(text, voice, { regen = false, signal } = {}) {
        if (!this.tts?.requestTTS) throw new Error('小手机的语音模块还没加载');
        const key = `${voice}\u0001${text}`;
        if (!regen && this.cache.has(key)) return this.cache.get(key);
        const old = this.cache.get(key);
        const url = await this.tts.requestTTS(text, { voice: voice || undefined, signal });
        if (old && old !== url) { try { URL.revokeObjectURL(old); } catch (e) { /* 忽略 */ } }
        this.cache.set(key, url);
        if (this.cache.size > 120) {
            const first = this.cache.keys().next().value;
            try { URL.revokeObjectURL(this.cache.get(first)); } catch (e) { /* 忽略 */ }
            this.cache.delete(first);
        }
        return url;
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
        try {
            // 先把第一句合成好，后面的边播边合成
            let next = null;
            const prep = (bar) => this._synth(bar.dataset.text, this._voiceFor(bar.dataset.speaker), { regen, signal: abort.signal });
            for (let i = 0; i < bars.length; i++) {
                if (this.playing !== run) return;
                const bar = bars[i];
                bar.classList.add('is-loading');
                const url = await (next || prep(bar));
                next = bars[i + 1] ? prep(bars[i + 1]).catch(err => { throw err; }) : null;
                next?.catch(() => {});
                if (this.playing !== run) return;
                bar.classList.remove('is-loading');
                bar.classList.add('is-playing');
                this.audio.src = url;
                await new Promise((resolve, reject) => {
                    this.audio.onended = resolve;
                    this.audio.onerror = () => reject(new Error('音频播放失败'));
                    this.audio.play().catch(reject);
                });
                bar.classList.remove('is-playing');
            }
        } catch (err) {
            if (abort.signal.aborted || err?.name === 'AbortError') return;
            console.warn('[正文朗读] 失败:', err);
            this._toast('朗读失败', String(err?.message || err).slice(0, 160));
        } finally {
            if (this.playing === run) this.stop();
        }
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
.yzsv-bar { display: inline-flex; align-items: center; gap: 4px; margin: 0 4px; vertical-align: middle; white-space: nowrap; }
.yzsv-btn { border: 1px solid rgba(255,255,255,.18); background: rgba(127,127,127,.16); color: inherit; opacity: .8; border-radius: 999px; padding: 1px 9px; font-size: .78em; line-height: 1.6; cursor: pointer; font-family: inherit; }
.yzsv-btn:hover { opacity: 1; }
.yzsv-regen { padding: 1px 7px; }
.yzsv-bar.is-loading .yzsv-play { opacity: .5; }
.yzsv-bar.is-loading .yzsv-play::after { content: '…'; }
.yzsv-bar.is-playing .yzsv-play { background: rgba(80,160,255,.28); border-color: rgba(80,160,255,.55); opacity: 1; }
.yzsv-all { margin-top: 8px; }
.yzsv-all .yzsv-btn.is-active { background: rgba(80,160,255,.28); border-color: rgba(80,160,255,.55); opacity: 1; }
.yzsv-app { padding: 14px 14px 30px; font-size: 13px; color: #222; }
.yzsv-card { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.yzsv-card h4 { margin: 0 0 10px; font-size: 14px; }
.yzsv-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.yzsv-row:last-child { border-bottom: 0; }
.yzsv-row small, .yzsv-note { display: block; color: #8b8b8b; font-size: 11px; line-height: 1.5; margin-top: 3px; }
.yzsv-input { width: 100%; box-sizing: border-box; border: 1px solid #e6e6e6; border-radius: 9px; padding: 8px 10px; font-size: 13px; background: #fafafa; color: #222; }
.yzsv-field { margin-bottom: 10px; }
.yzsv-field label { display: block; font-size: 12px; color: #555; margin-bottom: 5px; }
.yzsv-spk { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 6px; margin-bottom: 6px; }
.yzsv-mini { border: 0; background: #f0f0f0; border-radius: 8px; padding: 7px 10px; font-size: 12px; color: #333; cursor: pointer; }
.yzsv-mini.is-primary { background: #07c160; color: #fff; }
.yzsv-mini.is-danger { color: #e53935; }
.yzsv-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
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
        const html = `
            <div class="wechat-app" style="background:#f2f2f7;">
                <div class="wechat-header" style="background:#f2f2f7;">
                    <div class="wechat-header-left"><button class="wechat-back-btn" id="yzsv-back" type="button"><i class="fa-solid fa-chevron-left"></i></button></div>
                    <div class="wechat-header-title">正文朗读</div>
                    <div class="wechat-header-right"></div>
                </div>
                <div class="wechat-content" style="background:#f2f2f7;">
                    <div class="yzsv-app">
                        <div class="yzsv-card">
                            <label class="yzsv-row"><span>启用正文朗读<small>酒馆正文里，对白符号中的台词后面会出现 ▶播放 / ↻重新生成</small></span><input type="checkbox" data-k="enabled" ${s.enabled ? 'checked' : ''}></label>
                            <label class="yzsv-row"><span>让模型标出说话人<small>写正文时在台词前加 [[角色名]]，显示时自动藏起来，按这个名字配音色；没标的句子再自动判断</small></span><input type="checkbox" data-k="markSpeaker" ${s.markSpeaker ? 'checked' : ''}></label>
                            <label class="yzsv-row"><span>新回复自动朗读<small>角色回复生成完后，自动按顺序读出全部对白</small></span><input type="checkbox" data-k="autoPlay" ${s.autoPlay ? 'checked' : ''}></label>
                            <label class="yzsv-row"><span>也读我的消息<small>默认只读角色的回复</small></span><input type="checkbox" data-k="readUser" ${s.readUser ? 'checked' : ''}></label>
                        </div>
                        <div class="yzsv-card">
                            <h4>对白符号 · 跳过符号</h4>
                            <div class="yzsv-field"><label>对白符号（这些符号里的是台词）</label><input class="yzsv-input" data-k="quotes" value="${esc(s.quotes)}"></div>
                            <div class="yzsv-field"><label>跳过符号（这些符号里的不读）</label><input class="yzsv-input" data-k="skips" value="${esc(s.skips)}"></div>
                            <div class="yzsv-note">符号成对写，逗号分隔；开合各一个字符时写在一起（「」），多字符或相同字符之间空一格（** **）。比如台词写在引号里、译文写在括号里：对白符号填 “”，跳过符号填 （）。</div>
                        </div>
                        <div class="yzsv-card">
                            <h4>音色</h4>
                            <div class="yzsv-field"><label>默认音色（Fish 填 reference_id，留空用「设置 → 语音」里的音色）</label><input class="yzsv-input" data-k="voice" value="${esc(s.voice)}" placeholder="例如 7f92f8afb8ec43bf81429cc1c9199cb1"></div>
                            <label style="display:block;font-size:12px;color:#555;margin:4px 0 6px;">角色音色（名字要和模型标的说话人一致，比如 五条悟；你自己的角色也可以加一个）</label>
                            <div id="yzsv-spk-list">${spk.map((x, i) => `<div class="yzsv-spk" data-i="${i}"><input class="yzsv-input" data-spk="name" placeholder="角色名" value="${esc(x.name)}"><input class="yzsv-input" data-spk="voice" placeholder="音色 ID" value="${esc(x.voice)}"><button type="button" class="yzsv-mini is-danger" data-spk-del="${i}">删除</button></div>`).join('')}</div>
                            <div class="yzsv-btns">
                                <button type="button" class="yzsv-mini" id="yzsv-spk-add">＋ 添加角色</button>
                                <button type="button" class="yzsv-mini is-primary" id="yzsv-save">保存</button>
                                <button type="button" class="yzsv-mini" id="yzsv-test">试听默认音色</button>
                                <button type="button" class="yzsv-mini" id="yzsv-clear">清除语音缓存</button>
                            </div>
                            <div class="yzsv-note">引擎、API 地址和 Key 用的是小手机「设置 → 语音」里的配置（选 Fish Audio 就用 Fish）。每句语音生成后会缓存，再点播放不重复扣费；点 ↻ 才会重新生成。</div>
                        </div>
                    </div>
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
            autoPlay: !!val('autoPlay')?.checked,
            readUser: !!val('readUser')?.checked,
            markSpeaker: !!val('markSpeaker')?.checked,
            quotes: String(val('quotes')?.value || '').trim() || DEFAULTS.quotes,
            skips: String(val('skips')?.value || '').trim(),
            voice: String(val('voice')?.value || '').trim(),
            speakers
        };
    }

    _bind() {
        const root = this._root();
        const toast = (t, m, i = '🔊') => this.phoneShell?.showNotification?.(t, m, i);
        root.querySelector('#yzsv-back')?.addEventListener('click', () => {
            if (typeof this.phoneShell?.goHome === 'function') this.phoneShell.goHome();
            else window.dispatchEvent(new CustomEvent('phone:goHome'));
        });
        root.querySelectorAll('input[type=checkbox][data-k]').forEach(cb => cb.addEventListener('change', () => this.sv.saveSettings(this._collect())));
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
            list.insertAdjacentHTML('beforeend', '<div class="yzsv-spk"><input class="yzsv-input" data-spk="name" placeholder="角色名"><input class="yzsv-input" data-spk="voice" placeholder="音色 ID"><button type="button" class="yzsv-mini is-danger" data-spk-del>删除</button></div>');
            bindDel(list.lastElementChild.querySelector('[data-spk-del]'));
            list.lastElementChild.querySelector('input')?.focus();
        });
        root.querySelectorAll('[data-spk-del]').forEach(bindDel);
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
