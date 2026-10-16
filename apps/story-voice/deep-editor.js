// 柚月小手机 · 正文朗读：查看 / 编辑深度分析结果
// 点楼层下面的「🎭 …」打开：逐句看模型给的说话人、张力、语速、演法（带标签的台词）和理由，
// 可以直接改；改完点 ▶ 就按改后的演法单独调用一次 Fish 生成（不会再调用分析模型）。

const STYLE_ID = 'yzsv-editor-style';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 一键演法：张力 + 语速 + 句首标签（+ 首字叠字 / 句尾符号），点一下整句套用
export const PRESETS = [
    { label: '平静日常', tags: [], t: 1, p: 'normal' },
    { label: '温柔安抚', tags: ['gentle', 'soft tone'], t: 2, p: 'slow' },
    { label: '宠溺', tags: ['tender', 'chuckling'], t: 2, p: 'slow', tail: '~' },
    { label: '撒娇', tags: ['coquettish', 'whiny'], t: 3, p: 'normal', tail: '~' },
    { label: '开心', tags: ['happy'], t: 2, p: 'normal' },
    { label: '兴奋', tags: ['excited'], t: 3, p: 'fast', tail: '！' },
    { label: '调侃坏笑', tags: ['teasing', 'chuckling'], t: 2, p: 'normal' },
    { label: '得意', tags: ['proud', 'smug'], t: 2, p: 'normal' },
    { label: '害羞结巴', tags: ['embarrassed', 'whisper'], t: 3, p: 'normal', stutter: true },
    { label: '委屈', tags: ['upset', 'voice trembling'], t: 3, p: 'slow' },
    { label: '强忍哭', tags: ['whisper', 'holding back tears'], t: 4, p: 'slow', stutter: true },
    { label: '哭着说', tags: ['sobbing'], t: 4, p: 'slow', stutter: true },
    { label: '崩溃大哭', tags: ['crying loudly', 'hysterical'], t: 5, p: 'slow', stutter: true },
    { label: '心疼', tags: ['heartbroken', 'soft tone'], t: 3, p: 'slow' },
    { label: '疲惫叹气', tags: ['exhausted', 'sigh'], t: 2, p: 'slow' },
    { label: '无奈', tags: ['resigned', 'sigh'], t: 2, p: 'slow' },
    { label: '紧张小声', tags: ['nervous', 'whisper'], t: 3, p: 'fast' },
    { label: '害怕发抖', tags: ['scared', 'voice trembling'], t: 4, p: 'fast', stutter: true },
    { label: '惊慌', tags: ['panicked', 'gasp'], t: 4, p: 'very_fast' },
    { label: '惊讶', tags: ['surprised', 'gasp'], t: 3, p: 'normal' },
    { label: '生气质问', tags: ['angry'], t: 4, p: 'fast', tail: '！' },
    { label: '暴怒吼', tags: ['furious', 'shouting'], t: 5, p: 'very_fast', tail: '！！' },
    { label: '咬牙切齿', tags: ['angry', 'through gritted teeth'], t: 4, p: 'slow' },
    { label: '冷淡', tags: ['indifferent', 'cold'], t: 1, p: 'slow' },
    { label: '嘲讽', tags: ['sarcastic', 'snicker'], t: 2, p: 'normal' },
    { label: '严肃', tags: ['serious'], t: 2, p: 'slow' },
    { label: '绝望', tags: ['desperate', 'voice breaking'], t: 5, p: 'slow' },
    { label: '释然', tags: ['relieved', 'sigh'], t: 2, p: 'slow' },
    { label: '慵懒', tags: ['lazy', 'sleepy'], t: 1, p: 'slow' },
    { label: '喘着说', tags: ['panting'], t: 3, p: 'fast' }
];

// 插在光标处的选项，按类分页
export const OPTION_GROUPS = [
    { key: 'emo', label: '情绪', items: [
        ['开心', '[happy]'], ['兴奋', '[excited]'], ['得意', '[proud]'], ['宠溺', '[tender]'], ['温柔', '[gentle]'], ['撒娇', '[coquettish]'],
        ['害羞', '[embarrassed]'], ['调侃', '[teasing]'], ['好奇', '[curious]'], ['感动', '[moved]'], ['释然', '[relieved]'], ['期待', '[hopeful]'],
        ['悲伤', '[sad]'], ['委屈', '[upset]'], ['心疼', '[heartbroken]'], ['失落', '[disappointed]'], ['孤独', '[lonely]'], ['愧疚', '[guilty]'],
        ['绝望', '[desperate]'], ['疲惫', '[exhausted]'], ['无奈', '[resigned]'], ['紧张', '[nervous]'], ['焦急', '[anxious]'], ['害怕', '[scared]'],
        ['惊慌', '[panicked]'], ['惊讶', '[surprised]'], ['困惑', '[confused]'], ['怀疑', '[doubtful]'], ['生气', '[angry]'], ['暴怒', '[furious]'],
        ['烦躁', '[frustrated]'], ['嫉妒', '[jealous]'], ['不屑', '[disdainful]'], ['嘲讽', '[sarcastic]'], ['冷淡', '[indifferent]'], ['严肃', '[serious]'],
        ['坚定', '[determined]'], ['歇斯底里', '[hysterical]'], ['慵懒', '[lazy]'], ['醉醺醺', '[drunk]']
    ] },
    { key: 'voice', label: '声音', items: [
        ['哭腔', '[sobbing]'], ['大哭', '[crying loudly]'], ['强忍泪', '[holding back tears]'], ['声音发抖', '[voice trembling]'], ['破音', '[voice breaking]'],
        ['耳语', '[whisper]'], ['小声', '[soft tone]'], ['气声', '[breathy]'], ['大声', '[loud]'], ['喊', '[shouting]'], ['尖叫', '[screaming]'],
        ['咬牙', '[through gritted teeth]'], ['叹气', '[sigh]'], ['倒抽气', '[gasp]'], ['急喘', '[panting]'], ['吸鼻子', '[sniffling]'], ['哽咽', '[choked up]'],
        ['轻笑', '[chuckling]'], ['笑出声', '[laughing]'], ['大笑', '[laughing loudly]'], ['冷笑', '[snicker]'], ['苦笑', '[bitter laugh]'], ['打哈欠', '[yawning]'],
        ['清嗓', '[clear throat]'], ['低哼', '[groan]'], ['急促', '[in a hurry tone]'], ['拖长音', '[drawn out]']
    ] },
    { key: 'pause', label: '停顿/标点', items: [
        ['短停顿', '[pause]'], ['长停顿', '[long pause]'], ['……', '……'], ['…', '…'], ['、', '、'], ['！', '！'], ['！！', '！！'],
        ['？', '？'], ['？！', '？！'], ['~', '~'], ['～？', '~？'], ['っ', 'っ'], ['——', '……']
    ] },
    { key: 'zh', label: '语气词·中', items: [
        ['嗯', '嗯'], ['嗯？', '嗯？'], ['唔', '唔'], ['呜', '呜'], ['呜呜', '呜呜'], ['啊', '啊'], ['啊？', '啊？'], ['哈', '哈'], ['哈啊', '哈啊'],
        ['呼', '呼……'], ['诶', '诶'], ['欸？', '欸？'], ['哼', '哼'], ['切', '切'], ['呀', '呀'], ['嘛', '嘛'], ['啦', '啦'], ['呢', '呢'], ['喂', '喂'], ['噗', '噗']
    ] },
    { key: 'ja', label: '语气词·日', items: [
        ['ん', 'ん'], ['ん？', 'ん？'], ['うん', 'うん'], ['う', 'う'], ['うぅ', 'うぅ'], ['あ', 'あ'], ['あっ', 'あっ'], ['え', 'え'], ['えっ', 'えっ'],
        ['は', 'は'], ['はぁ', 'はぁ……'], ['ふ', 'ふ'], ['ふふ', 'ふふ'], ['へへ', 'へへ'], ['ちっ', 'ちっ'], ['ねぇ', 'ねぇ'], ['よ', 'よ'], ['っ', 'っ'], ['ぐすっ', 'ぐすっ']
    ] },
    { key: 'rep', label: '叠字/结巴', items: [
        ['首字结巴', '@stutter-first'], ['光标前一个字叠一下', '@stutter-cursor'], ['首字拖长', '@drag-first'], ['句尾拖长', '@drag-tail'], ['整句打碎', '@shatter']
    ] }
];
const PACES = [['very_slow', '1 很慢'], ['slow', '2 慢'], ['normal', '3 正常'], ['fast', '4 快'], ['very_fast', '5 很快']];
const TENSIONS = [[1, '1 平静'], [2, '2 轻微'], [3, '3 明显'], [4, '4 强烈'], [5, '5 爆发']];
const isWordCh = (c) => /[\p{L}\p{N}]/u.test(c);
const TONES = ['日常', '轻松', '温馨', '浪漫', '亲密', '悲伤', '紧张', '悬疑', '恐怖', '战斗', '壮阔'];

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
.yzsv-ed-mask { position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
.yzsv-ed { width: min(560px, 100vw); max-height: 86vh; display: flex; flex-direction: column; background: #f6f6f9; color: #222; border-radius: 18px 18px 0 0; box-shadow: 0 -8px 30px rgba(0,0,0,.25); font-size: 14px; font-family: inherit; overflow: hidden; }
@media (min-width: 700px) { .yzsv-ed-mask { align-items: center; } .yzsv-ed { border-radius: 18px; } }
.yzsv-ed-head { padding: 14px 16px 10px; border-bottom: 1px solid #e6e6ee; background: #fff; }
.yzsv-ed-head b { font-size: 16px; }
.yzsv-ed-head .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.yzsv-ed-head select, .yzsv-ed-head input { border: 1px solid #e3e3ea; border-radius: 9px; padding: 6px 8px; font-size: 13px; background: #f8f8fb; color: #222; font-family: inherit; }
.yzsv-ed-head input { flex: 1; min-width: 0; }
.yzsv-ed-close { float: right; border: 0; background: rgba(0,0,0,.06); width: 30px; height: 30px; border-radius: 50%; font-size: 16px; cursor: pointer; color: #555; }
.yzsv-ed-tip { font-size: 12px; color: #888; margin-top: 6px; line-height: 1.5; }
.yzsv-ed-body { overflow-y: auto; padding: 10px 12px 16px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.yzsv-ed-line { background: #fff; border: 1px solid #ececf2; border-radius: 14px; padding: 11px 12px; margin-bottom: 10px; }
.yzsv-ed-line.is-focus { border-color: #a18cd1; box-shadow: 0 0 0 2px rgba(161,140,209,.25); }
.yzsv-ed-line.is-edited .yzsv-ed-no::after { content: '已改'; margin-left: 6px; font-size: 10px; color: #fff; background: #a18cd1; border-radius: 6px; padding: 1px 5px; }
.yzsv-ed-top { display: flex; align-items: center; gap: 8px; }
.yzsv-ed-no { font-size: 12px; color: #999; flex: 0 0 auto; }
.yzsv-ed-spk { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; font-weight: 600; font-size: 14px; color: #333; border-radius: 8px; padding: 3px 6px; font-family: inherit; }
.yzsv-ed-spk:focus { border-color: #d8d0ee; background: #faf9fe; outline: none; }
.yzsv-ed-why { font-size: 12px; color: #8a6fc0; margin: 4px 0 0; }
.yzsv-ed-orig { font-size: 12px; color: #999; margin: 6px 0; line-height: 1.5; word-break: break-all; }
.yzsv-ed-script { width: 100%; box-sizing: border-box; min-height: 58px; border: 1px solid #e3e3ea; border-radius: 10px; padding: 8px 10px; font-size: 14px; line-height: 1.55; background: #fbfbfd; color: #222; resize: vertical; font-family: inherit; }
.yzsv-ed-script:focus { outline: none; border-color: #a18cd1; background: #fff; }
.yzsv-ed-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 7px 0 2px; }
.yzsv-ed-chips button { border: 1px solid #e0daf1; background: #f6f3fd; color: #6b54a8; border-radius: 999px; padding: 3px 9px; font-size: 12px; cursor: pointer; font-family: inherit; }
.yzsv-ed-tabs { display: flex; gap: 4px; margin-top: 10px; overflow-x: auto; scrollbar-width: none; }
.yzsv-ed-tabs::-webkit-scrollbar { display: none; }
.yzsv-ed-tabs button { flex: 0 0 auto; border: 0; background: transparent; color: #888; font-size: 12.5px; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-family: inherit; }
.yzsv-ed-tabs button.is-on { background: #efeaf9; color: #6b54a8; font-weight: 600; }
.yzsv-ed-chips[hidden] { display: none !important; }
.yzsv-ed-chips button[data-preset] { background: #fff4f0; border-color: #f4d9cf; color: #b0603f; }
.yzsv-ed-hint { font-size: 11px; color: #aaa; margin-top: 4px; line-height: 1.45; }
.yzsv-ed-set { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.yzsv-ed-set > span { font-size: 12px; color: #888; width: 34px; flex: 0 0 34px; }
.yzsv-ed-seg { display: inline-flex; background: #f1f1f5; border-radius: 9px; padding: 2px; flex-wrap: wrap; }
.yzsv-ed-seg button { border: 0; background: transparent; padding: 4px 9px; font-size: 12px; border-radius: 7px; cursor: pointer; color: #555; font-family: inherit; }
.yzsv-ed-seg button.is-on { background: #fff; color: #6b54a8; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }
.yzsv-ed-acts { display: flex; gap: 8px; margin-top: 10px; }
.yzsv-ed-acts button { border: 0; border-radius: 9px; padding: 7px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.yzsv-ed-play { background: #a18cd1; color: #fff; }
.yzsv-ed-play.is-busy { opacity: .6; }
.yzsv-ed-reset { background: #f1f1f5; color: #666; }
.yzsv-ed-foot { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid #e6e6ee; background: #fff; display: flex; gap: 8px; }
.yzsv-ed-foot button { flex: 1; border: 0; border-radius: 11px; padding: 10px; font-size: 14px; cursor: pointer; font-family: inherit; }
.yzsv-ed-foot .primary { background: #a18cd1; color: #fff; }
.yzsv-ed-foot .ghost { background: #f1f1f5; color: #555; }
`;
    document.head.appendChild(st);
}

/**
 * @param {import('./story-voice.js').StoryVoice} sv
 * @param {number} mesid
 * @param {string|number} focusLine  打开后滚到这一句
 */
export function openDeepEditor(sv, mesid, focusLine = null) {
    injectStyle();
    document.querySelectorAll('.yzsv-ed-mask').forEach(n => n.remove());
    const ctx = window.SillyTavern?.getContext?.();
    const msg = ctx?.chat?.[mesid];
    const entry = sv._deepEntry(msg);
    if (!entry) { sv._toast('还没有分析', '先点 ▶ 或「分析」让模型分析这一楼'); return; }
    const bars = Array.from(document.querySelectorAll(`#chat .mes[mesid="${mesid}"] .mes_text .yzsv-bar`));
    if (!bars.length) { sv._toast('没有可编辑的台词', '这一楼没有找到挂了按钮的台词'); return; }

    const lineHtml = (bar, i) => {
        const text = bar.dataset.text || '';
        const v = entry.lines?.[text] || {};
        const script = v.s || text;
        const t = Number(v.t) || 2;
        const pace = v.pace || 'normal';
        return `
        <div class="yzsv-ed-line${v.edited ? ' is-edited' : ''}" data-line="${esc(bar.dataset.line)}" data-text="${esc(text)}">
            <div class="yzsv-ed-top"><span class="yzsv-ed-no">#${i + 1}</span><input class="yzsv-ed-spk" value="${esc(bar.dataset.speaker || v.role || '')}" title="说话人（改了会按这个人的音色读）"></div>
            ${v.why ? `<div class="yzsv-ed-why">💭 ${esc(v.why)}</div>` : ''}
            <div class="yzsv-ed-orig">原文：${esc(text)}</div>
            <textarea class="yzsv-ed-script" rows="2" spellcheck="false">${esc(script)}</textarea>
            <div class="yzsv-ed-set"><span>张力</span><div class="yzsv-ed-seg" data-k="t">${TENSIONS.map(([n, l]) => `<button type="button" data-v="${n}" class="${n === t ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="yzsv-ed-set"><span>语速</span><div class="yzsv-ed-seg" data-k="pace">${PACES.map(([k, l]) => `<button type="button" data-v="${k}" class="${k === pace ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="yzsv-ed-tabs">${[['preset', '一键演法'], ...OPTION_GROUPS.map(g => [g.key, g.label])].map(([k, l], j) => `<button type="button" data-tab="${k}" class="${(k === 'preset') ? 'is-on' : ''}">${l}</button>`).join('')}</div>
            <div class="yzsv-ed-chips" data-pane="preset">${PRESETS.map((p, j) => `<button type="button" data-preset="${j}" title="张力 ${p.t} · ${esc(p.p)}${p.tags.length ? ' · ' + esc(p.tags.map(x => `[${x}]`).join('')) : ''}">${esc(p.label)}</button>`).join('')}</div>
            ${OPTION_GROUPS.map(g => `<div class="yzsv-ed-chips" data-pane="${g.key}" hidden>${g.items.map(([l, v]) => `<button type="button" data-ins="${esc(v)}" title="${esc(v)}">${esc(l)}</button>`).join('')}</div>`).join('')}
            <div class="yzsv-ed-hint">情绪、声音放在要生效的字前面（光标在哪就插在哪，没点过就插在句首）；一键演法会换掉句首的标签并设好张力和语速。</div>
            <div class="yzsv-ed-acts"><button type="button" class="yzsv-ed-play">▶ 按这样生成并播放</button><button type="button" class="yzsv-ed-reset">去掉标签</button></div>
        </div>`;
    };

    const mask = document.createElement('div');
    mask.className = 'yzsv-ed-mask';
    mask.innerHTML = `
        <div class="yzsv-ed" role="dialog">
            <div class="yzsv-ed-head">
                <button type="button" class="yzsv-ed-close" title="关闭">✕</button>
                <b>🎭 深度分析结果</b>
                <div class="row"><select class="yzsv-ed-tone">${['', ...TONES].map(x => `<option value="${esc(x)}" ${x === (entry.tone || '') ? 'selected' : ''}>${x || '基调'}</option>`).join('')}</select><input class="yzsv-ed-arc" value="${esc(entry.arc || '')}" placeholder="情绪走向"></div>
                <div class="yzsv-ed-tip">张力 1 平静 → 5 崩溃，越高 Fish 起伏越大。演法里 [方括号] 是声音标签，放在要生效的字前面，可以点下面的按钮插入，也可以自己写 [crying softly] 这类英文描述；可以加叠字（我、我不是）、……、！！、呜。改完点 ▶ 只会调用 Fish 重新生成这一句。</div>
            </div>
            <div class="yzsv-ed-body">${bars.map(lineHtml).join('')}</div>
            <div class="yzsv-ed-foot"><button type="button" class="ghost yzsv-ed-cancel">关闭</button><button type="button" class="primary yzsv-ed-save">保存全部</button></div>
        </div>`;
    document.body.appendChild(mask);

    const read = (row) => {
        const seg = (k) => row.querySelector(`.yzsv-ed-seg[data-k="${k}"] button.is-on`)?.dataset.v;
        return {
            text: row.dataset.text,
            line: row.dataset.line,
            speaker: row.querySelector('.yzsv-ed-spk').value.trim(),
            script: row.querySelector('.yzsv-ed-script').value.replace(/\s*\n\s*/g, ' ').trim(),
            t: Number(seg('t')) || 2,
            pace: seg('pace') || 'normal'
        };
    };

    // 存一句：写回分析结果（标记为已改）；说话人改了就记成手动指定
    const saveRow = (row) => {
        const r = read(row);
        const old = entry.lines[r.text] || {};
        const script = r.script && r.script !== r.text ? r.script : '';
        const next = { ...old, role: r.speaker || old.role || '', pace: r.pace, t: r.t, s: script };
        const changed = ['role', 'pace', 't', 's'].some(k => String(next[k] ?? '') !== String(old[k] ?? ''));
        if (changed) { next.edited = true; entry.lines[r.text] = next; row.classList.add('is-edited'); }
        const bar = document.querySelector(`#chat .mes[mesid="${mesid}"] .mes_text .yzsv-bar[data-line="${CSS.escape(r.line)}"]`);
        if (bar && r.speaker && r.speaker !== (bar.dataset.speaker || '')) sv._saveOverride(bar, r.speaker);
        return changed;
    };
    const saveAll = () => {
        let n = 0;
        mask.querySelectorAll('.yzsv-ed-line').forEach(row => { if (saveRow(row)) n += 1; });
        entry.tone = mask.querySelector('.yzsv-ed-tone').value;
        entry.arc = mask.querySelector('.yzsv-ed-arc').value.trim();
        sv._deepSave(sv._deepHashOf(msg), entry);
        sv.processById(mesid);
        return n;
    };

    // 记住每个输入框最后的光标位置（点按钮时输入框会失焦）
    mask.querySelectorAll('.yzsv-ed-script').forEach(ta => {
        const keep = () => { ta._sel = [ta.selectionStart, ta.selectionEnd]; };
        ['select', 'keyup', 'click', 'input', 'blur'].forEach(ev => ta.addEventListener(ev, keep));
        ta.addEventListener('input', () => { ta._base = null; }); // 手动改过：下次一键演法以改后的为底
    });
    // 日文台词：语气词默认给日文那组
    mask.querySelectorAll('.yzsv-ed-line').forEach(row => {
        if (!/[\u3040-\u30ff]/.test(row.dataset.text || '')) row.querySelector('[data-tab="ja"]')?.remove();
        else row.querySelector('[data-tab="zh"]')?.remove();
    });

    // 正文开始的位置（跳过句首的标签和空格）
    const leadEnd = (v) => (v.match(/^\s*(?:\[[^\]\n]{1,40}\]\s*)*/) || [''])[0].length;
    const insertAt = (ta, ins) => {
        ta._base = null;
        const v = ta.value;
        let [a, b] = ta._sel || [null, null];
        if (a == null) { a = b = /^\[/.test(ins) ? 0 : leadEnd(v); }
        // 标签和后面的字之间留一个空格；前面紧贴的字后面也补空格
        let text = ins;
        if (/^\[/.test(ins) && a > 0 && !/\s|\]/.test(v[a - 1])) text = ` ${text}`;
        ta.value = v.slice(0, a) + text + v.slice(b);
        const at = a + text.length;
        ta._sel = [at, at];
        ta.focus();
        try { ta.setSelectionRange(at, at); } catch (err) { /* 忽略 */ }
    };
    // 叠字 / 结巴 / 拖长
    const SMALL = 'っッぁぃぅぇぉゃゅょゎァィゥェォャュョヮー';
    const firstWordAt = (v) => { const s0 = leadEnd(v); for (let i = s0; i < v.length; i++) if (isWordCh(v[i]) && !SMALL.includes(v[i])) return i; return -1; };
    const transform = (ta, kind, fromPreset = false) => {
        if (!fromPreset) ta._base = null;
        let v = ta.value;
        if (kind === 'stutter-first') {
            const i = firstWordAt(v);
            if (i >= 0) v = v.slice(0, i) + v[i] + '、' + v.slice(i);
        } else if (kind === 'stutter-cursor') {
            const a = (ta._sel || [v.length])[0];
            let i = a - 1;
            while (i >= 0 && !isWordCh(v[i])) i -= 1;
            if (i >= 0) v = v.slice(0, i + 1) + '、' + v[i] + v.slice(i + 1);
        } else if (kind === 'drag-first') {
            const i = firstWordAt(v);
            if (i >= 0) v = v.slice(0, i + 1) + '……' + v.slice(i + 1);
        } else if (kind === 'drag-tail') {
            v = v.replace(/[。．.！!？?~～…]*\s*$/, '') + '~……';
        } else if (kind === 'shatter') {
            // 逗号、顿号处变成省略号，长句碎成短片段（适合哭、崩溃、喘）
            const lead = v.slice(0, leadEnd(v));
            v = lead + v.slice(lead.length).replace(/[，,、]\s*/g, '……').replace(/(……){2,}/g, '……');
        }
        ta.value = v;
        ta._sel = null;
    };
    const applyPreset = (row, ta, p) => {
        if (!p) return;
        // 连着点几个一键演法：都在同一个底稿上套，不会把上一个的 ~ 、叠字累积起来
        if (!ta._base) ta._base = ta.value.replace(/^\s*(?:\[[^\]\n]{1,40}\]\s*)*/, '').trim() || row.dataset.text;
        const body = ta._base;
        const tags = p.tags.map(x => `[${x}]`).join('');
        let v = `${tags}${tags ? ' ' : ''}${body}`;
        ta.value = v;
        if (p.stutter) {
            const i = firstWordAt(v);
            if (i >= 0 && !(v[i + 1] === '、' && v[i + 2] === v[i])) transform(ta, 'stutter-first', true);
        }
        if (p.tail) ta.value = ta.value.replace(/[。．.！!~～]*\s*$/, '') + p.tail;
        const setSeg = (k, val) => row.querySelectorAll(`.yzsv-ed-seg[data-k="${k}"] button`).forEach(b => b.classList.toggle('is-on', String(b.dataset.v) === String(val)));
        setSeg('t', p.t);
        setSeg('pace', p.p);
        ta._sel = null;
    };

    const close = () => mask.remove();
    mask.addEventListener('click', async (e) => {
        if (e.target === mask || e.target.closest('.yzsv-ed-close, .yzsv-ed-cancel')) { saveAll(); close(); return; }
        if (e.target.closest('.yzsv-ed-save')) {
            const n = saveAll();
            sv._toast('已保存', n ? `改了 ${n} 句，点 ▶ 会按新的演法生成` : '没有改动', 'success');
            close();
            return;
        }
        const row = e.target.closest('.yzsv-ed-line');
        if (!row) return;
        const segBtn = e.target.closest('.yzsv-ed-seg button');
        if (segBtn) {
            segBtn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === segBtn));
            return;
        }
        const tab = e.target.closest('.yzsv-ed-tabs button');
        if (tab) {
            row.querySelectorAll('.yzsv-ed-tabs button').forEach(b => b.classList.toggle('is-on', b === tab));
            row.querySelectorAll('.yzsv-ed-chips').forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
            return;
        }
        const ta = row.querySelector('.yzsv-ed-script');
        const presetBtn = e.target.closest('[data-preset]');
        if (presetBtn) { applyPreset(row, ta, PRESETS[Number(presetBtn.dataset.preset)]); return; }
        const insBtn = e.target.closest('[data-ins]');
        if (insBtn) {
            const v = insBtn.dataset.ins;
            if (v.startsWith('@')) { transform(ta, v.slice(1)); return; }
            insertAt(ta, /^\[.*\]$/.test(v) ? `${v} ` : v);
            return;
        }
        if (e.target.closest('.yzsv-ed-reset')) {
            const ta = row.querySelector('.yzsv-ed-script');
            ta.value = ta.value.replace(/\[[^\]\n]{1,40}\]\s*/g, '').trim() || row.dataset.text;
            return;
        }
        const play = e.target.closest('.yzsv-ed-play');
        if (play) {
            if (play.classList.contains('is-busy')) return;
            sv._unlockAudio();
            saveAll();
            const line = row.dataset.line;
            const bar = document.querySelector(`#chat .mes[mesid="${mesid}"] .mes_text .yzsv-bar[data-line="${CSS.escape(line)}"]`);
            if (!bar) { sv._toast('找不到这一句', '正文可能刷新了，关掉再打开试试'); return; }
            play.classList.add('is-busy');
            play.textContent = '生成中…';
            try {
                await sv.playBars([bar], { trigger: bar.querySelector('.yzsv-play') });
            } finally {
                play.classList.remove('is-busy');
                play.textContent = '▶ 按这样生成并播放';
            }
        }
    });

    if (focusLine !== null && focusLine !== undefined) {
        const row = mask.querySelector(`.yzsv-ed-line[data-line="${CSS.escape(String(focusLine))}"]`);
        if (row) { row.classList.add('is-focus'); setTimeout(() => row.scrollIntoView({ block: 'center' }), 30); }
    }
}
