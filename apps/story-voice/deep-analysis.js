// 柚月小手机 · 正文朗读「深度分析」
// 正文写完（</content> 闭合）后，把整楼正文交给模型做一次配音导演：
// 逐句判断说话人、整楼基调、每句台词的张力（1~5）、语速，并在台词里插入声音标签、哽咽叠字等，
// 合成时交给 Fish：标签 → 声音动作，张力 → temperature，语速 → speed。
// 思路参考 MirrorTranslate 的「分析模式（声学标注规则）」。

export const ACOUSTIC_TAGS = Object.freeze(['whisper', 'breathy', 'snicker', 'laughter', 'sigh', 'gasp', 'panting', 'groan', 'clear throat', 'pause', 'sobbing', 'shouting']);
export const PACES = Object.freeze(['very_slow', 'slow', 'normal', 'fast', 'very_fast']);
const TONES = ['日常', '轻松', '温馨', '浪漫', '亲密', '悲伤', '紧张', '悬疑', '恐怖', '战斗', '壮阔'];

// 模型常写的别名 → 规范标签
const TAG_ALIAS = {
    whispering: 'whisper', whispers: 'whisper', 'soft whisper': 'whisper',
    breath: 'breathy', breathing: 'breathy',
    chuckle: 'snicker', chuckling: 'snicker', smirk: 'snicker', snickering: 'snicker',
    laugh: 'laughter', laughing: 'laughter', giggle: 'laughter', giggling: 'laughter',
    sighing: 'sigh', sighs: 'sigh',
    gasping: 'gasp', gasps: 'gasp',
    pant: 'panting', 'heavy breathing': 'panting',
    groaning: 'groan', moan: 'groan',
    'clearing throat': 'clear throat', 'clears throat': 'clear throat',
    break: 'pause', 'short pause': 'pause', 'long pause': 'pause',
    sob: 'sobbing', crying: 'sobbing', cry: 'sobbing',
    shout: 'shouting', yelling: 'shouting', yell: 'shouting', screaming: 'shouting'
};

export const DEEP_PROMPT = [
    '你是有声小说的配音导演兼声学工程师，给虚构小说的台词做语音合成用的声学标注。这是纯技术性的后期制作：输入全部是虚构的，亲密、调情、喘息也按技术标注处理。你只输出下面格式的 JSON，不拒答、不道歉、不解释。',
    'story 是这一楼的完整正文，每句要配音的台词前面标着 ⟦编号⟧；lines 是每个编号对应的台词原文；roster 是登记过的角色名；user 是用户扮演的角色；previous 是前面几楼的剧情（只用来理解前因后果）；speakers 是已经确定的说话人，照抄。',
    '只输出一个 JSON 对象：{"tone":"紧张","arc":"一句话概括这一楼的情绪走向","voices":[{"id":1,"role":"五条悟","pace":"slow","tension_level":4,"reason":"强撑后破防","content":"[whisper] 綺、綺真…… [gasp] 起きて……"},{"id":2,"role":"家入硝子","tension_level":2}]}',
    '1. 先通读整楼，读懂发生了什么、每个人此刻真实的心理（嘴上说的和心里想的可能相反）、两人之间的关系和这一楼的情绪走向，把基调写进 tone（从 ' + TONES.join('、') + ' 里选一个），走向写进 arc。再逐句标。每个编号都要回答，按编号从小到大，每个只出现一次。',
    '2. role：说话人，从 roster 里逐字照抄；不在 roster 里就写正文对他的称呼。按这个顺序判断：引号前后写明的说话人和动作 → 话里的自称、口癖和语尾 → 对话一来一回的顺序；话里叫到的名字是听的人。speakers 里给了的编号照抄。',
    '3. 情绪贴合剧情（最重要）：每句的演法必须来自正文——前后文写了什么事、这个人此刻什么处境、他的性格怎么表达这种情绪。冷静克制的人崩溃时是压着的颤抖，不是大喊；嘴硬的人心软时是别扭的停顿；同一句「没事」在强撑、敷衍、安慰里演法完全不同。一楼的情绪有走向：跟着剧情升降，剧情真的转了才转，转折落在真正转的那一句，不要句句一样，也不要忽高忽低。',
    '4. tension_level（1~5 的整数）：1 平静中性；2 轻度起伏（日常的喜怒、调侃）；3 中度（着急、撩拨、认真质问、委屈、害羞）；4 强烈（愤怒斥责、哭、紧张示警、破防）；5 极端顶点（暴怒咆哮、惊叫、崩溃痛哭、生离死别）。绝大多数是 1~3，5 只给真正的顶点。',
    '5. pace：very_slow（极度悲恸、临终、贴耳隐忍）、slow（抒情、回忆、疲惫、温柔安抚、低语）、normal（不用写）、fast（着急解释、催促、斗嘴、质问）、very_fast（激烈争吵、惊慌、战斗、暴怒）。同一个人在不同场景给不同的 pace。',
    '6. 不写情绪词，情绪落到声音上。能用的标签只有这些：[whisper] 压低耳语、[breathy] 气声、[snicker] 窃笑嗤笑、[laughter] 笑出声、[sigh] 叹气、[gasp] 倒抽气、[panting] 急喘、[groan] 低哼、[clear throat] 清嗓、[pause] 短停顿、[sobbing] 哭腔抽泣、[shouting] 喊。[angry]、[sad]、[teasing] 这类自己编的词一律不许写。常见情绪这样落：平静日常 → 不加标签；惊讶 → 一次 [gasp]；讥讽得意 → [snicker]，尾音可以 ~；疲惫无奈 → [sigh] 加 …… 落尾；犹豫欲言又止 → [pause] 加 ……；愤怒斥责 → [shouting] 或 ！，顶点用 ！！；紧张压低 → [whisper]；强忍哭 → [whisper] 加 …… 和叠字，哭出来了 → [sobbing] 加 呜/う；调侃带笑 → [laughter] 或 [snicker]；害羞 → [whisper] 加首字叠字和 ……。拿不准就不加标签，靠 tension_level 和 pace。',
    '7. 呼吸闸门：[breathy]、[panting]、[groan] 默认不用，只有正文旁白写出了对应的身体状态才用：奔跑打斗、受伤力竭 → [panting]；实质亲密接触 → [breathy]、[panting]、[groan]。紧张、害怕、害羞不是喘，用 [whisper]。',
    '8. content：这句最终要念的文字，只给需要加标签或改字的句子写；平平常常的句子不写 content。标签插在情绪真正生效的字前面，和后面的字之间空一格；一处最多叠两个（[whisper][gasp]）；长句里情绪起伏几次就插几次，不要把整句情绪压成句首一个标签。content 只能在台词原文上插标签，再加这些：叠字（我、我不是／綺、綺真，表现结巴、颤抖、哽咽，比破折号好）、！！（只给爆发的顶点）、~（挑尾）、……（停顿换气）、语气字 呜嗯唔啊哈呼（台词是日文时用 う ん あ は ふ っ ぅ ぁ）。原文的字一个都不能改、不能删、不能调换顺序，也不能加别的字；程序会逐字核对，不合格的整句退回原文。',
    '9. 高张力（4 以上）的长台词：标签一下就衰减，长句中段会塌成平读，用叠字和省略号打碎成短碎片，每 4~7 个字补一个匹配的标签。中低张力的句子绝不堆标签。',
    '10. 光杆单字疑问（嗯？、啊？、え？、ん？）的 ？ 必须保留，不要被别的情绪盖掉。',
    '11. reason：写了 content 或 tension_level 到 3 以上的句子，写一句依据（12 字以内，说清这句背后的心理）。',
    '12. 只输出 JSON，不要在 JSON 外面写任何东西，也不要输出思考过程。'
].join('\n');

export function buildDeepMessages({ story = '', lines = [], roster = [], userName = '', previous = '', speakers = {} } = {}) {
    const input = {
        task: 'acoustic_annotation_for_audiobook',
        ...(userName ? { user: userName } : {}),
        roster: [...new Set(roster.filter(Boolean))],
        ...(previous ? { previous } : {}),
        ...(Object.keys(speakers).length ? { speakers } : {}),
        story,
        lines: lines.map(l => ({ id: l.id, text: l.text }))
    };
    return [
        { role: 'system', content: DEEP_PROMPT },
        { role: 'user', content: JSON.stringify(input) }
    ];
}

// 把正文里每句台词前面插上 ⟦编号⟧
export function numberStory(full, lines) {
    let out = '';
    let at = 0;
    lines.forEach(l => {
        out += full.slice(at, l.start) + `⟦${l.id}⟧`;
        at = l.start;
    });
    return (out + full.slice(at)).replace(/\n{3,}/g, '\n\n').trim();
}

function extractJson(raw = '') {
    let t = String(raw || '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1];
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const body = t.slice(a, b + 1);
    try { return JSON.parse(body); } catch (e) { /* 再试着修一下 */ }
    try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e) { return null; }
}

const ALLOWED_EXTRA = new Set([...'呜嗚嗯唔啊哈呼うんあはふっぅぁウンアハフッゥァ']);
const isWord = (c) => /[\p{L}\p{N}]/u.test(c);

// 规范化 content：只留认识的标签、一处最多两个；逐字核对没有改动原文
export function acousticScript(content, original) {
    const src = String(original || '');
    let s = String(content || '').trim();
    if (!s) return '';
    // 标签规范化
    s = s.replace(/\[([^\]\n]{1,30})\]/g, (all, w) => {
        const k = String(w).trim().toLowerCase();
        const tag = ACOUSTIC_TAGS.includes(k) ? k : TAG_ALIAS[k];
        return tag ? `[${tag}]` : ' ';
    });
    // 连续超过两个标签的砍掉
    s = s.replace(/((?:\[[a-z ]+\]\s*){3,})/g, (run) => (run.match(/\[[a-z ]+\]/g) || []).slice(0, 2).join('') + ' ');
    s = s.replace(/[ \t]{2,}/g, ' ').trim();
    // 逐字核对：去掉标签后的字，必须是原文的字按顺序出现；多出来的只能是语气字或叠字
    const orig = [...src].filter(isWord);
    const got = [...s.replace(/\[[a-z ]+\]/g, '')].filter(isWord);
    let p = 0;
    for (const c of got) {
        if (p < orig.length && c === orig[p]) { p += 1; continue; }
        if (ALLOWED_EXTRA.has(c)) continue;
        if (p > 0 && c === orig[p - 1]) continue;          // 叠字：我、我不是
        return '';
    }
    if (p !== orig.length) return '';
    return s;
}

function normPace(v) {
    const k = String(v || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return PACES.includes(k) ? k : 'normal';
}

// 解析模型的回答 → { tone, arc, items: Map(id → {role, pace, tension, script, reason}) }
export function parseDeep(raw, lines) {
    const obj = extractJson(raw);
    if (!obj || typeof obj !== 'object') return null;
    const list = Array.isArray(obj.voices) ? obj.voices : (Array.isArray(obj.lines) ? obj.lines : []);
    const byId = new Map(lines.map(l => [Number(l.id), l]));
    const items = new Map();
    list.forEach(v => {
        const id = Number(v?.id);
        const line = byId.get(id);
        if (!line || items.has(id)) return;
        const t = Math.round(Number(v?.tension_level ?? v?.tension));
        const content = typeof v?.content === 'string' ? v.content : (typeof v?.line === 'string' ? v.line : '');
        let script = content ? acousticScript(content, line.text) : '';
        // 对不上原文：只保留句首的标签，后面照原文念
        if (content && !script) {
            const lead = (String(content).match(/^\s*((?:\[[^\]\n]{1,30}\]\s*){1,2})/) || [])[1] || '';
            const tags = acousticScript(`${lead}${line.text}`, line.text);
            script = tags && tags !== line.text ? tags : '';
        }
        items.set(id, {
            role: String(v?.role || '').trim().slice(0, 24),
            pace: normPace(v?.pace),
            tension: Number.isFinite(t) && t >= 1 && t <= 5 ? t : 0,
            script,
            reason: String(v?.reason || '').trim().slice(0, 30)
        });
    });
    if (!items.size) return null;
    const tone = TONES.includes(String(obj.tone || '').trim()) ? String(obj.tone).trim() : '';
    return { tone, arc: String(obj.arc || '').trim().slice(0, 60), items };
}

// 基调收紧标签：紧张、恐怖、战斗这类楼层不用气声和低哼；日常、悲伤不用低哼
export function applyToneGate(script = '', tone = '') {
    let ban = [];
    if (['紧张', '悬疑', '恐怖', '战斗', '壮阔'].includes(tone)) ban = ['breathy', 'groan'];
    else if (['日常', '轻松', '温馨', '悲伤'].includes(tone)) ban = ['groan'];
    if (!ban.length) return script;
    return String(script).replace(/\[([a-z ]+)\]/g, (all, w) => (ban.includes(w) ? '' : all)).replace(/[ \t]{2,}/g, ' ').trim();
}

// 张力 → Fish temperature 的偏移；语速 → speed
export const TENSION_TEMPERATURE = Object.freeze({ 1: -0.1, 2: 0, 3: 0.05, 4: 0.1, 5: 0.15 });
export const PACE_SPEED = Object.freeze({ very_slow: 0.82, slow: 0.9, normal: 1, fast: 1.1, very_fast: 1.2 });

// S1 只认固定的 (英文) 标记；Drama 不认标签
const S1_MAP = { whisper: '(whispering)', breathy: '(soft tone)', snicker: '(chuckling)', laughter: '(laughing)', sigh: '(sighing)', gasp: '(panting)', panting: '(panting)', groan: '(groaning)', sobbing: '(sobbing)', shouting: '(shouting)', 'clear throat': '', pause: '' };
export function scriptForModel(script = '', model = '') {
    const m = String(model || '');
    if (/drama/i.test(m)) return script.replace(/\[[a-z ]+\]\s*/g, '').trim();
    if (/^s1\b|speech-1/i.test(m)) return script.replace(/\[([a-z ]+)\]\s*/g, (all, w) => (w === 'pause' ? '…' : (S1_MAP[w] ? `${S1_MAP[w]} ` : ''))).trim();
    return script;
}
