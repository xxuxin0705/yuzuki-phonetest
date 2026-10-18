/* ========================================================
 *  柚月小手机 - 自由桌面 内置组件库
 *  phone/home-widgets.js
 *  按糯叽机的内置组件重做：小组件 17 个 / 中组件 11 个 / 大组件 9 个
 *  每个组件：name / sizes / defaults / fields / render(item, d, ctx) / onTap(item, act, ctx)
 * ======================================================== */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// This string is written inside HTML style="..." attributes. Using double
// quotes in url("...") truncated the style attribute for uploaded badges,
// portraits, albums and other image widgets.
const bg = (u) => {
    const s = String(u || '').trim();
    if (!s) return '';
    // CSS single quotes don't terminate the enclosing HTML double-quoted attr.
    const safe = s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E')
        .replace(/[\r\n]/g, '');
    return `background-image:url('${safe}')`;
};
const pad = (n) => String(n).padStart(2, '0');
const WD_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------- 小图标 ---------------- */
const I = {
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" class="fill"><path d="M7 6h2v12H7zM20 6v12l-9-6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" class="fill"><path d="M15 6h2v12h-2zM4 6v12l9-6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" class="fill"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M4 7h11M4 12h11M4 17h7M18 8v9"/><circle cx="16.5" cy="17" r="1.6"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M5 11V9a3 3 0 013-3h10l-2.5-2.5M19 13v2a3 3 0 01-3 3H6l2.5 2.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    heartO: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/></svg>',
    hang: '<svg viewBox="0 0 24 24" class="fill"><path d="M3 14.5c5-5 13-5 18 0l-2.2 2.4-3.6-1.5v-2.6a11 11 0 00-6.4 0v2.6l-3.6 1.5z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" class="fill"><rect x="3" y="7" width="12" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 107-7H8.5M8.5 5L11 2.5M8.5 5L11 7.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    home: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 4l8 7h-2.5v8h-4v-5h-3v5h-4v-8H4z"/></svg>',
    more: '<svg viewBox="0 0 24 24" class="fill"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4.5 17l4.5-4 4 3.5 2.5-2 4 3"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M5 17.5V7a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H8.5z"/></svg>',
    at: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 005 0V12a8.5 8.5 0 10-3.4 6.8"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6.5 16.5V11a5.5 5.5 0 0111 0v5.5l1.5 1.5H5zM10 20h4"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4.5 7l7.5 6 7.5-6"/></svg>',
    wave: '<svg viewBox="0 0 24 24"><path d="M3 12h3l2-5 3 11 3-8 2 4h5"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9.5 17V6.5l9-2V15"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="15" r="2"/></svg>'
};
const avatar = (url, cls = '') => url
    ? `<div class="yzw-av ${cls}" style="${bg(url)}"></div>`
    : `<div class="yzw-av yzw-av-empty ${cls}">${I.person}</div>`;
const photoBox = (url, label, cls = '') => url
    ? `<div class="yzw-ph ${cls}" style="${bg(url)}"></div>`
    : `<div class="yzw-ph yzw-ph-empty ${cls}"><span>${esc(label)}</span></div>`;

/* ---------------- 农历 / 月相 ---------------- */
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function lunarText(y, m, d) {
    try {
        const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(new Date(y, m - 1, d));
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
        if (!month || !day) return '';
        let dayTxt;
        if (day <= 10) dayTxt = `初${CN_NUM[day]}`;
        else if (day < 20) dayTxt = `十${CN_NUM[day - 10]}`;
        else if (day === 20) dayTxt = '二十';
        else if (day < 30) dayTxt = `廿${CN_NUM[day - 20]}`;
        else dayTxt = '三十';
        return `农历${month.replace(/^(\d+)月$/, (x, n) => `${CN_NUM[+n] || n}月`)}${dayTxt}`;
    } catch (e) { return ''; }
}
const SYNODIC = 29.530588853;
function moonInfo(date) {
    const ref = Date.UTC(2000, 0, 6, 18, 14);
    const age = (((date.getTime() - ref) / 86400000) % SYNODIC + SYNODIC) % SYNODIC;
    const illum = (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;
    const names = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
    const idx = Math.floor(((age / SYNODIC) * 8) + 0.5) % 8;
    return { age, illum, name: names[idx] };
}
function moonSvg(age) {
    const r = 40, cx = 50, cy = 50;
    const phase = age / SYNODIC;               // 0 新月 → 0.5 满月 → 1
    const waxing = phase < 0.5;
    const k = Math.cos(2 * Math.PI * phase);   // 1 → -1 → 1
    const rx = Math.abs(k) * r;
    // 亮面：半圆（右亮=上弦，左亮=下弦）+ 明暗交界的椭圆弧
    const sweepOuter = waxing ? 1 : 0;
    const sweepInner = (k > 0) === waxing ? 0 : 1;
    const lit = `M${cx} ${cy - r} A${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A${rx} ${r} 0 0 ${sweepInner} ${cx} ${cy - r}Z`;
    return `<svg viewBox="0 0 100 100" class="yzw-moon-svg"><circle cx="50" cy="50" r="40" fill="#3a3a44"/><path d="${lit}" fill="#f3e7c3"/><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.12)"/></svg>`;
}
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const VS = '\uFE0E'; // 文字样式（不要彩色 emoji）
const ZODIAC = [['♈', '白羊座'], ['♉', '金牛座'], ['♊', '双子座'], ['♋', '巨蟹座'], ['♌', '狮子座'], ['♍', '处女座'], ['♎', '天秤座'], ['♏', '天蝎座'], ['♐', '射手座'], ['♑', '摩羯座'], ['♒', '水瓶座'], ['♓', '双鱼座']].map(([a, b]) => [a + VS, b]);
const LUCK_COLORS = ['樱花粉', '天空蓝', '奶油白', '薄荷绿', '香芋紫', '柠檬黄', '珊瑚橘', '雾霾灰'];
const LUCK_WORDS = ['适合主动联系想念的人', '会有小小的惊喜', '慢下来，好运在路上', '适合整理房间和心情', '今天说出口的话会被认真听见', '适合吃一顿好的', '灵感很多，记得写下来', '有人在偷偷关心你'];

/* 通用：小组件统一的「白色卡片」默认外观 */
const WHITE = { bg: 'clear', bgColor: '#ffffff', textColor: '#1f1f24', radius: 22 };
const DARK = { bg: 'clear', bgColor: '#1c1c22', textColor: '#ffffff', radius: 22 };

/* ======================================================================
 *  组件定义
 * ==================================================================== */
export const BUILTINS = {
    /* ---------------- 三种尺寸都有 ---------------- */
    text: {
        name: 'Widget', names: { small: '小型 Widget', medium: '中型 Widget', large: '大型 Widget' },
        sizes: ['small', 'medium', 'large'],
        defaults: { ...WHITE, text: 'Widget', fontSize: 16, align: 'center', textColor: '#8e8e93' },
        fields: [
            { key: 'text', label: '文字', type: 'textarea' },
            { key: 'fontSize', label: '字号', type: 'range', min: 10, max: 48, step: 1 },
            { key: 'align', label: '对齐', type: 'select', options: [['left', '左'], ['center', '中'], ['right', '右']] }
        ],
        render: (it, d) => `<div class="yzw yzw-text" style="font-size:${Number(d.fontSize) || 16}px;text-align:${esc(d.align)};justify-content:${d.align === 'left' ? 'flex-start' : d.align === 'right' ? 'flex-end' : 'center'}"><div>${esc(d.text)}</div></div>`
    },
    photo: {
        name: '图片', sizes: ['small', 'medium', 'large'],
        defaults: { ...WHITE, image: '', fit: 'cover', caption: '', textColor: '#8e8e93' },
        fields: [
            { key: 'image', label: '图片', type: 'image', maxDim: 1400 },
            { key: 'fit', label: '填充方式', type: 'select', options: [['cover', '铺满裁切'], ['contain', '完整显示']] },
            { key: 'caption', label: '图片文字（可空）', type: 'text' }
        ],
        render: (it, d) => d.image
            ? `<div class="yzw yzw-photo" style="${bg(d.image)};background-size:${d.fit === 'contain' ? 'contain' : 'cover'}">${d.caption ? `<div class="yzw-cap">${esc(d.caption)}</div>` : ''}</div>`
            : `<div class="yzw yzw-text"><div>图片 Widget</div></div>`
    },
    zodiac: {
        name: '星座运势', sizes: ['small', 'medium'],
        defaults: { ...DARK, bgColor: '#1d1f4a', sign: '' },
        fields: [{ key: 'sign', label: '星座', type: 'select', options: [['', '未选择'], ...ZODIAC.map(([s, n]) => [n, `${s} ${n}`])] }],
        timeBased: true,
        render: (it, d, ctx) => {
            const z = ZODIAC.find(x => x[1] === d.sign);
            if (!z) return `<div class="yzw yzw-zodiac"><div class="yzw-zd-sym">♈${VS} ♌${VS} ♐${VS}</div><b>星座运势</b><small>点一下选择星座</small></div>`;
            const h = hashStr(`${d.sign}${ctx.t.y}${ctx.t.m}${ctx.t.d}`);
            const stars = 3 + (h % 3);
            const word = LUCK_WORDS[(h >>> 3) % LUCK_WORDS.length];
            const color = LUCK_COLORS[(h >>> 7) % LUCK_COLORS.length];
            return `<div class="yzw yzw-zodiac on ${it.size === 'medium' ? 'm' : ''}">
                <div class="yzw-zd-head"><span class="yzw-zd-big">${z[0]}</span><div><b>${z[1]}</b><div class="yzw-zd-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div></div></div>
                <small>${esc(word)}</small><small class="dim">幸运色 ${color} · 幸运数 ${(h >>> 11) % 9 + 1}</small></div>`;
        },
        onTap: async (it, act, ctx) => {
            const v = await ctx.choose('选择星座', ZODIAC.map(([s, n]) => [n, `${s} ${n}`]));
            if (!v) return false;
            it.data.sign = v;
            return true;
        }
    },

    /* ---------------- 小组件 ---------------- */
    vinyl: {
        name: '黑胶唱片', sizes: ['small'], app: 'music',
        defaults: { ...DARK, bgColor: '#101012', cover: '', label: 'NO COVER', spin: 'on' },
        fields: [
            { key: 'cover', label: '唱片中心封面', type: 'image', maxDim: 600 },
            { key: 'label', label: '没封面时的文字', type: 'text' },
            { key: 'spin', label: '转动', type: 'select', options: [['on', '转'], ['off', '不转']] }
        ],
        render: (it, d) => `<div class="yzw yzw-vinyl"><div class="yzw-vy-disc ${d.spin === 'off' ? '' : 'spin'}">
            <div class="yzw-vy-label" style="${bg(d.cover)}">${d.cover ? '' : `<span>${esc(d.label)}</span>`}</div></div>
            <div class="yzw-vy-arm"><i class="knob"></i><i class="bar"></i><i class="head"></i></div></div>`
    },
    badge: {
        name: '吧唧', sizes: ['small'],
        defaults: { ...WHITE, bgColor: '#f2f2f4', image: '', text: 'Badge' },
        fields: [{ key: 'image', label: '吧唧图片', type: 'image', maxDim: 700 }, { key: 'text', label: '没图片时的文字', type: 'text' }],
        render: (it, d) => `<div class="yzw yzw-badge"><div class="yzw-bd-pin" style="${bg(d.image)}">${d.image ? '' : `<span>${esc(d.text)}</span>`}<i class="gloss"></i></div></div>`
    },
    heart_badge: {
        name: '爱心吧唧', sizes: ['small'],
        defaults: { ...WHITE, bgColor: '#f2f2f4', image: '', text: 'Badge' },
        fields: [{ key: 'image', label: '吧唧图片', type: 'image', maxDim: 700 }, { key: 'text', label: '没图片时的文字', type: 'text' }],
        render: (it, d) => `<div class="yzw yzw-badge"><div class="yzw-bd-heart"><div class="in" style="${bg(d.image)}">${d.image ? '' : `<span>${esc(d.text)}</span>`}</div><i class="gloss"></i></div></div>`
    },
    newmsg: {
        name: '新消息提示', sizes: ['small'], app: 'wechat',
        defaults: { ...WHITE, bgColor: '#f2f2f4', avatar: '', name: 'User', tag: 'NEW' },
        fields: [{ key: 'avatar', label: '头像', type: 'image', maxDim: 500 }, { key: 'name', label: '没头像时的文字', type: 'text' }, { key: 'tag', label: '红点旁的字', type: 'text' }],
        render: (it, d) => `<div class="yzw yzw-newmsg"><div class="yzw-nm-card"><div class="yzw-nm-av" style="${bg(d.avatar)}">${d.avatar ? '' : `<span>${esc(d.name)}</span>`}</div>
            <div class="yzw-nm-tag"><i></i>${esc(d.tag)}</div></div></div>`
    },
    videocall: {
        name: '视频通话', sizes: ['small'], app: 'phone',
        defaults: { ...DARK, bgColor: '#202024', name: '用户', status: 'STATUS', photo: '' },
        fields: [{ key: 'name', label: '名字', type: 'text' }, { key: 'status', label: '状态文字', type: 'text' }, { key: 'photo', label: '通话背景', type: 'image', maxDim: 900 }],
        render: (it, d) => `<div class="yzw yzw-vc" ${d.photo ? `style="${bg(d.photo)}"` : ''}><div class="yzw-vc-shade"></div>
            <div class="yzw-vc-top"><div><b>${esc(d.name)}</b><span class="live"><i></i>LIVE <em>▂▄▆</em></span></div><span class="add">${I.plus}</span></div>
            <div class="yzw-vc-status">— ${esc(d.status)}</div>${d.photo ? '' : '<div class="yzw-vc-hint">上传背景</div>'}
            <div class="yzw-vc-btns"><span>${I.mic}</span><span class="red">${I.hang}</span><span>${I.cam}</span></div></div>`
    },
    analog: {
        name: '圆形时钟', sizes: ['small'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#f4f4f6', accent: '#ff3b30' },
        fields: [{ key: 'accent', label: '秒针颜色', type: 'color' }],
        render: (it, d, ctx) => {
            const t = ctx.t;
            const sec = new Date().getSeconds();
            const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="${i % 3 === 0 ? 9 : 10}" x2="50" y2="${i % 3 === 0 ? 17 : 14}" transform="rotate(${i * 30} 50 50)"/>`).join('');
            return `<div class="yzw yzw-analog"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="face"/><g class="ticks">${ticks}</g>
                <line class="h" x1="50" y1="50" x2="50" y2="29" transform="rotate(${(t.hh % 12) * 30 + t.mm * 0.5} 50 50)"/>
                <line class="m" x1="50" y1="50" x2="50" y2="17" transform="rotate(${t.mm * 6} 50 50)"/>
                <line class="s" style="stroke:${esc(d.accent)}" x1="50" y1="58" x2="50" y2="13" transform="rotate(${sec * 6} 50 50)"/>
                <circle cx="50" cy="50" r="2.4" style="fill:${esc(d.accent)}"/></svg></div>`;
        }
    },
    muyu: {
        name: '敲木鱼', sizes: ['small'],
        defaults: { ...WHITE, bgColor: '#fdf8ef', textColor: '#d1780e', count: 0, color: '#f0a020' },
        fields: [{ key: 'color', label: '木鱼颜色', type: 'color' }, { key: 'count', label: '功德', type: 'number' }],
        render: (it, d) => `<div class="yzw yzw-muyu"><div class="yzw-my-top"><b>功德 ${Number(d.count) || 0}</b><span data-wact="reset">${I.reset}</span></div>
            <div class="yzw-my-fish" style="--c:${esc(d.color)}"><i class="dome"></i><i class="base"></i><i class="stick"></i></div></div>`,
        onTap: (it, act, ctx) => {
            if (act === 'reset') it.data.count = 0;
            else { it.data.count = (Number(it.data.count) || 0) + 1; ctx.float('功德 +1'); }
            return true;
        }
    },
    capsule: {
        name: '液态胶囊', sizes: ['small'],
        defaults: { ...WHITE, bgColor: '#f4f4f6', title: '我爱你一如七年前', msg1: '直到你的…', av1: '', msg2: '其为我下…', av2: '' },
        fields: [
            { key: 'title', label: '标题', type: 'text' },
            { key: 'msg1', label: '第一条消息', type: 'text' }, { key: 'av1', label: '第一条头像', type: 'image', maxDim: 300 },
            { key: 'msg2', label: '第二条消息', type: 'text' }, { key: 'av2', label: '第二条头像', type: 'image', maxDim: 300 }
        ],
        render: (it, d) => `<div class="yzw yzw-capsule"><div class="yzw-cp-title">${esc(d.title)}</div>
            <div class="yzw-cp-b l">${avatar(d.av1)}<span>${esc(d.msg1)}</span></div>
            <div class="yzw-cp-b r"><span>${esc(d.msg2)}</span>${avatar(d.av2)}</div></div>`
    },
    couple: {
        name: '情侣纪念日', sizes: ['small'],
        defaults: { ...WHITE, bg: 'clear', av1: '', av2: '', date: '', showDays: 'off' },
        fields: [
            { key: 'av1', label: '左边头像', type: 'image', maxDim: 500 }, { key: 'av2', label: '右边头像', type: 'image', maxDim: 500 },
            { key: 'date', label: '纪念日', type: 'date' },
            { key: 'showDays', label: '显示在一起天数', type: 'select', options: [['off', '只显示日期'], ['on', '显示天数']] }
        ],
        timeBased: true,
        render: (it, d, ctx) => {
            const dt = String(d.date || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            const dateTxt = dt ? `${dt[1]}.${pad(dt[2])}.${pad(dt[3])}` : `${ctx.t.y}.${pad(ctx.t.m)}.${pad(ctx.t.d)}`;
            let days = '';
            if (dt && d.showDays === 'on') days = `<em>${Math.max(0, Math.round((new Date(ctx.t.y, ctx.t.m - 1, ctx.t.d) - new Date(+dt[1], dt[2] - 1, +dt[3])) / 86400000))} 天</em>`;
            return `<div class="yzw yzw-couple"><div class="yzw-cpl-avs">${avatar(d.av1, 'a')}${avatar(d.av2, 'b')}</div><div class="yzw-cpl-date">${days}${dateTxt}</div></div>`;
        }
    },
    companion: {
        name: '陪伴时长', sizes: ['small'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#fff7f6', textColor: '#5b5b66', avatar: '', who: '小手机', start: '' },
        fields: [{ key: 'avatar', label: '头像', type: 'image', maxDim: 400 }, { key: 'who', label: '陪伴对象', type: 'text' }, { key: 'start', label: '开始日期（空=放上桌面那天）', type: 'date' }],
        render: (it, d) => {
            const st = d.start ? new Date(`${d.start}T00:00:00`).getTime() : (Number(d._created) || Date.now());
            const mins = Math.max(0, Math.floor((Date.now() - st) / 60000));
            return `<div class="yzw yzw-comp"><div class="yzw-comp-av">${avatar(d.avatar)}</div><div class="yzw-comp-t">你陪伴了${esc(d.who)}</div>
                <div class="yzw-comp-n"><b>${Math.floor(mins / 1440)}</b>天 <b>${Math.floor(mins / 60) % 24}</b>小时</div><div class="yzw-comp-n"><b>${mins % 60}</b>分钟</div></div>`;
        }
    },
    simple_cal: {
        name: '简约日历', sizes: ['small'], app: 'calendar', timeBased: true,
        defaults: { ...WHITE, bgColor: '#f7f7f8' },
        fields: [],
        render: (it, d, ctx) => {
            const t = ctx.t;
            if (t.ancient) return `<div class="yzw yzw-scal"><small>今日</small><b class="anc">${esc(t.rawDate)}</b></div>`;
            return `<div class="yzw yzw-scal"><small>${t.y}年${t.m}月 ${WD_ZH[t.wd]}</small><b>${t.d}</b><small>${esc(lunarText(t.y, t.m, t.d))}</small></div>`;
        }
    },
    countdown: {
        name: '倒数日', sizes: ['small'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#f6efe4', textColor: '#8a7a68', title: '距离新年', date: '', accent: '#b5653f' },
        fields: [{ key: 'title', label: '标题', type: 'text' }, { key: 'date', label: '目标日期（空=明年元旦）', type: 'date' }, { key: 'accent', label: '数字颜色', type: 'color' }],
        render: (it, d, ctx) => {
            const t = ctx.t;
            const m = String(d.date || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            const tgt = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(t.y + 1, 0, 1);
            const diff = Math.round((tgt - new Date(t.y, t.m - 1, t.d)) / 86400000);
            const label = diff >= 0 ? '天后' : '天前';
            return `<div class="yzw yzw-cd"><small>${esc(d.title)}</small><div class="yzw-cd-n"><b style="color:${esc(d.accent)}">${Math.abs(diff)}</b><span>${label}</span></div>
                <small class="dim">${tgt.getFullYear()}.${pad(tgt.getMonth() + 1)}.${pad(tgt.getDate())}</small><i class="deco"></i></div>`;
        }
    },
    water: {
        name: '喝水打卡', sizes: ['small'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#eaf3fd', textColor: '#2f6fbf', goal: 8, count: 0, day: '' },
        fields: [{ key: 'goal', label: '每日目标（杯）', type: 'number' }, { key: 'count', label: '今天已喝', type: 'number' }],
        render: (it, d, ctx) => {
            const today = `${ctx.t.y}-${ctx.t.m}-${ctx.t.d}`;
            const count = d.day === today ? (Number(d.count) || 0) : 0;
            const goal = Math.max(1, Number(d.goal) || 8);
            return `<div class="yzw yzw-water"><small>喝水</small><div class="yzw-wt-n"><b>${count}</b><span>/${goal} 杯</span></div>
                <div class="yzw-wt-bar"><i style="height:${Math.min(100, count / goal * 100)}%"></i></div><small class="dim">点一下 +1 杯</small></div>`;
        },
        onTap: (it, act, ctx) => {
            const today = `${ctx.t.y}-${ctx.t.m}-${ctx.t.d}`;
            if (it.data.day !== today) { it.data.day = today; it.data.count = 0; }
            it.data.count = (Number(it.data.count) || 0) + 1;
            ctx.float('+1 杯 💧');
            return true;
        }
    },
    moon: {
        name: '今夜月相', sizes: ['small'], timeBased: true,
        defaults: { ...DARK, bgColor: '#15151d' },
        fields: [],
        render: (it, d, ctx) => {
            const t = ctx.t;
            const mi = moonInfo(new Date(t.y, t.m - 1, t.d, 21, 0));
            return `<div class="yzw yzw-moon"><i class="stars"></i>${moonSvg(mi.age)}<b>${mi.name}</b><small>亮度 ${Math.round(mi.illum * 100)}%</small></div>`;
        }
    },

    /* ---------------- 中组件 ---------------- */
    movie_cal: {
        name: '电影日历', sizes: ['medium'], timeBased: true,
        defaults: { ...WHITE, label: '本月书影音', poster: '', title: '', sub: '' },
        fields: [{ key: 'label', label: '左侧文字', type: 'text' }, { key: 'poster', label: '海报', type: 'image', maxDim: 700 }, { key: 'title', label: '片名 / 书名', type: 'text' }, { key: 'sub', label: '副标题（空=今天日期）', type: 'text' }],
        render: (it, d, ctx) => `<div class="yzw yzw-movie"><div class="yzw-mv-l">${esc(d.label)}</div>
            <div class="yzw-mv-card"><div class="yzw-mv-poster" style="${bg(d.poster)}">${d.poster ? '' : I.image}</div>
            <b>${esc(d.title || '还没有填写…')}</b><small>${esc(d.sub || `${ctx.t.m}月 ${WD_ZH[ctx.t.wd]}`)}</small></div></div>`
    },
    clock: {
        name: '时钟', sizes: ['medium'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#ececef', textColor: '#f7f7f9', h24: '24', lang: 'zh', timeSource: 'story' },
        fields: [
            { key: 'h24', label: '时间格式', type: 'select', options: [['24', '24 小时制'], ['12', '12 小时制']] },
            { key: 'lang', label: '日期语言', type: 'select', options: [['zh', '中文'], ['en', 'English']] },
            { key: 'timeSource', label: '时间来源', type: 'select', options: [['story', '酒馆当前剧情时间'], ['real', '现实真实时间']] }
        ],
        render: (it, d, ctx) => {
            const t = ctx.t;
            const is12 = String(d.h24) === '12';
            const h = is12 ? ((t.hh % 12) || 12) : t.hh;
            const date = t.ancient ? esc(t.rawDate) : (d.lang === 'en' ? `${MON_EN[t.m - 1]} ${t.d} ${WD_EN[t.wd]}` : `${t.m}月${t.d}日 ${WD_ZH[t.wd]}`);
            return `<div class="yzw yzw-clock"><div class="yzw-ck-t">${pad(h)}:${pad(t.mm)}${is12 ? `<small class="yzw-ck-ampm">${t.hh < 12 ? 'AM' : 'PM'}</small>` : ''}</div><div class="yzw-ck-d">${date}</div></div>`;
        }
    },
    memo: {
        name: '便签', sizes: ['medium'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#f7f7f8', avatar: '', items: '…\n\n', done: '' },
        fields: [{ key: 'avatar', label: '头像', type: 'image', maxDim: 400 }, { key: 'items', label: '待办（一行一条，最多 3 条）', type: 'textarea' }],
        render: (it, d, ctx) => {
            const items = String(d.items ?? '').split('\n').slice(0, 3);
            while (items.length < 3) items.push('');
            const done = String(d.done || '').split(',');
            return `<div class="yzw yzw-memo"><div class="yzw-mm-l">${avatar(d.avatar)}<b>${ctx.t.d}</b></div>
                <div class="yzw-mm-r">${items.map((x, i) => `<div class="yzw-mm-row ${done.includes(String(i)) ? 'done' : ''}" data-wact="todo:${i}"><i></i><span>${esc(x)}</span></div>`).join('')}</div></div>`;
        },
        onTap: (it, act) => {
            if (!String(act || '').startsWith('todo:')) return false;
            const i = act.slice(5);
            const done = new Set(String(it.data.done || '').split(',').filter(Boolean));
            if (done.has(i)) done.delete(i); else done.add(i);
            it.data.done = [...done].join(',');
            return true;
        }
    },
    daily_info: {
        name: '日常信息', sizes: ['medium'], timeBased: true,
        defaults: { ...WHITE, line1: '☀️ 晴 · 23°', line2: '💭 今天也要开心', line3: '📌 记得按时吃饭' },
        fields: [{ key: 'line1', label: '第一行', type: 'text' }, { key: 'line2', label: '第二行', type: 'text' }, { key: 'line3', label: '第三行', type: 'text' }],
        render: (it, d, ctx) => `<div class="yzw yzw-daily"><div class="yzw-di-l"><b>${ctx.t.d}</b><small>${ctx.t.m}月 ${WD_ZH[ctx.t.wd]}</small></div>
            <div class="yzw-di-r">${[d.line1, d.line2, d.line3].filter(Boolean).map(x => `<div>${esc(x)}</div>`).join('')}</div></div>`
    },
    player: {
        name: '播放器', sizes: ['medium'], app: 'music',
        defaults: { ...WHITE, cover: '', title: 'Into the New World', artist: '', progress: 35 },
        fields: [{ key: 'cover', label: '封面', type: 'image', maxDim: 600 }, { key: 'title', label: '歌名', type: 'text' }, { key: 'artist', label: '歌手', type: 'text' }, { key: 'progress', label: '进度 %', type: 'range', min: 0, max: 100, step: 1 }],
        render: (it, d) => `<div class="yzw yzw-player"><div class="yzw-pl-cover" style="${bg(d.cover)}">${d.cover ? '' : I.music}</div>
            <div class="yzw-pl-r"><b>${esc(d.title)}</b>${d.artist ? `<small>${esc(d.artist)}</small>` : ''}<div class="yzw-prog"><i style="width:${Number(d.progress) || 0}%"></i></div>
            <div class="yzw-pl-ctrl">${I.prev}${I.play}${I.next}${I.list}${I.repeat}</div></div></div>`
    },
    gameboy: {
        name: '游戏机', sizes: ['medium'],
        defaults: { ...WHITE, bg: 'clear', screen: '', body: '#f6c9d8', hint: '点击编辑上传图片' },
        fields: [{ key: 'screen', label: '屏幕图片', type: 'image', maxDim: 900 }, { key: 'body', label: '机身颜色', type: 'color' }, { key: 'hint', label: '没图片时的文字', type: 'text' }],
        render: (it, d) => `<div class="yzw yzw-gb" style="--gb:${esc(d.body)}"><div class="yzw-gb-l"><i class="btn s"></i><i class="dpad"></i><i class="btn s2"></i></div>
            <div class="yzw-gb-screen" style="${bg(d.screen)}">${d.screen ? '' : `<span>${esc(d.hint)}</span>`}<em>♡ ♡</em></div>
            <div class="yzw-gb-r"><i class="ab x"></i><i class="ab y"></i><i class="ab a"></i><i class="ab b"></i><i class="btn s3"></i></div></div>`
    },
    three_photos: {
        name: '三张相片', sizes: ['medium'],
        defaults: { ...WHITE, bgColor: '#f4f4f6', p1: '', p2: '', p3: '' },
        fields: [{ key: 'p1', label: '照片 1', type: 'image', maxDim: 700 }, { key: 'p2', label: '照片 2', type: 'image', maxDim: 700 }, { key: 'p3', label: '照片 3', type: 'image', maxDim: 700 }],
        render: (it, d) => `<div class="yzw yzw-three">${[d.p1, d.p2, d.p3].map((p, i) => `<div class="yzw-pol r${i}">${photoBox(p, `照片${i + 1}`)}</div>`).join('')}</div>`
    },
    love_frame: {
        name: 'LOVE 相框', sizes: ['medium'],
        defaults: { ...WHITE, photo: '', font: 'classic', textColor: '#1a1a1a' },
        fields: [
            { key: 'photo', label: 'O 的照片', type: 'image', maxDim: 600 },
            { key: 'font', label: '字体样式', type: 'select', options: [['classic', '经典'], ['balloon', '气球'], ['script', '花体'], ['hand', '手写'], ['spray', '喷漆']] }
        ],
        render: (it, d) => `<div class="yzw yzw-love f-${esc(d.font)}"><span>L</span><div class="yzw-love-o" style="${bg(d.photo)}">${d.photo ? '' : I.heartO}</div><span>VE</span></div>`
    },

    /* ---------------- 大组件 ---------------- */
    imessage: {
        name: '仿iMessage', sizes: ['large'],
        defaults: { ...WHITE, cover: '', avatar: '', name: '娜帶鹽', handle: '404 Not Found', stats: '1 回忆, 26 照片, 05 收藏, 2026 开始', t1: '⋆.˚The meaning of love⋆', c1: '「我们在晴天里遇见」\n没有你的宇宙不叫太空', t2: '*关于我*', c2: '★ 个人喜欢的 都要分享哦' },
        fields: [
            { key: 'cover', label: '封面图片', type: 'image', maxDim: 1000 }, { key: 'avatar', label: '头像', type: 'image', maxDim: 400 },
            { key: 'name', label: '名称', type: 'text' }, { key: 'handle', label: 'ID / 签名', type: 'text' },
            { key: 'stats', label: '数据（数字 名称, 用逗号分隔，最多 4 个）', type: 'text' },
            { key: 't1', label: '卡片 1 标题', type: 'text' }, { key: 'c1', label: '卡片 1 内容', type: 'textarea' },
            { key: 't2', label: '卡片 2 标题', type: 'text' }, { key: 'c2', label: '卡片 2 内容', type: 'textarea' }
        ],
        render: (it, d) => {
            const stats = String(d.stats || '').split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 4).map(s => {
                const m = s.match(/^(\S+)\s*(.*)$/);
                return `<div><b>${esc(m?.[1] || s)}</b><small>${esc(m?.[2] || '')}</small></div>`;
            }).join('');
            return `<div class="yzw yzw-imsg" ${d.cover ? `style="${bg(d.cover)}"` : ''}><div class="yzw-im-top"><span>☆</span><span class="r">${I.globe}${I.bell}${I.mail}${avatar(d.avatar, 'xs')}</span></div>
                ${avatar(d.avatar, 'big')}<b class="yzw-im-name">${esc(d.name)}</b><small class="yzw-im-h">${esc(d.handle)}</small>
                <div class="yzw-im-stats">${stats}</div>
                <div class="yzw-im-card"><b>${esc(d.t1)}</b><p>${esc(d.c1)}</p><hr><b>${esc(d.t2)}</b><p>${esc(d.c2)}</p></div></div>`;
        }
    },
    profile: {
        name: '个人资料', sizes: ['large'],
        defaults: { ...WHITE, cover: '', avatar: '', name: 'Preview', handle: '@user', bio: 'Preview Content', loc: '' },
        fields: [
            { key: 'cover', label: '封面图片', type: 'image', maxDim: 1000 }, { key: 'avatar', label: '头像', type: 'image', maxDim: 400 },
            { key: 'name', label: '名称', type: 'text' }, { key: 'handle', label: 'ID (@handle)', type: 'text' },
            { key: 'bio', label: '个人签名', type: 'textarea' }, { key: 'loc', label: '地点', type: 'text' }
        ],
        render: (it, d) => `<div class="yzw yzw-prof"><div class="yzw-pf-cover" style="${bg(d.cover)}"></div>${avatar(d.avatar, 'pf')}
            <div class="yzw-pf-body"><b>${esc(d.name)}</b><small>${esc(d.handle)}</small><p>${esc(d.bio)}</p>${d.loc ? `<small class="loc">📍 ${esc(d.loc)}</small>` : ''}</div></div>`
    },
    month_cal: {
        name: '日历', sizes: ['large'], app: 'calendar', timeBased: true,
        defaults: { ...WHITE, accent: '#ff3b30' },
        fields: [{ key: 'accent', label: '今天的颜色', type: 'color' }],
        render: (it, d, ctx) => {
            const t = ctx.t;
            const first = new Date(t.y, t.m - 1, 1).getDay();
            const days = new Date(t.y, t.m, 0).getDate();
            let cells = ['日', '一', '二', '三', '四', '五', '六'].map(x => `<b>${x}</b>`).join('');
            for (let i = 0; i < first; i++) cells += '<i></i>';
            for (let i = 1; i <= days; i++) cells += i === t.d ? `<i class="on" style="background:${esc(d.accent)}">${i}</i>` : `<i>${i}</i>`;
            return `<div class="yzw yzw-mcal"><div class="yzw-mc-h"><b>${t.m}月</b><span>${t.y}年</span></div><div class="yzw-mc-g">${cells}</div></div>`;
        }
    },
    polaroid_stack: {
        name: '拍立得堆叠', sizes: ['large'],
        defaults: { ...WHITE, bgColor: '#f4f4f6', p1: '', p2: '', p3: '', caption: 'nikki~~ok//(•^▽^•)' },
        fields: [{ key: 'p1', label: '主图', type: 'image', maxDim: 900 }, { key: 'p2', label: '照片 2', type: 'image', maxDim: 600 }, { key: 'p3', label: '照片 3', type: 'image', maxDim: 600 }, { key: 'caption', label: '手写文字', type: 'text' }],
        render: (it, d) => `<div class="yzw yzw-pstack"><div class="yzw-pol main">${photoBox(d.p1, '主图')}<span class="cap">${esc(d.caption)}</span></div>
            <div class="yzw-pol s2">${photoBox(d.p2, '2')}</div><div class="yzw-pol s3">${photoBox(d.p3, '3')}</div></div>`
    },
    scrapbook: {
        name: '剪贴簿相片', sizes: ['large'], timeBased: true,
        defaults: { ...WHITE, bgColor: '#f8e9ee', photo: '', caption: '写点什么吧', date: '', likes: 99 },
        fields: [{ key: 'photo', label: '照片', type: 'image', maxDim: 900 }, { key: 'caption', label: '文字', type: 'text' }, { key: 'date', label: '日期（空=今天）', type: 'date' }, { key: 'likes', label: '爱心数', type: 'number' }],
        render: (it, d, ctx) => {
            const m = String(d.date || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            const date = m ? `${m[1]}.${pad(m[2])}.${pad(m[3])}` : `${ctx.t.y}.${pad(ctx.t.m)}.${pad(ctx.t.d)}`;
            return `<div class="yzw yzw-scrap"><span class="yzw-sc-like">${I.heart}${esc(d.likes)}</span><span class="yzw-sc-date">${date}</span>
                <div class="yzw-sc-photo">${photoBox(d.photo, '上传照片')}<i class="tape t1"></i><i class="tape t2"></i></div>
                <div class="yzw-sc-cap">${esc(d.caption)}<i class="tape t3"></i></div></div>`;
        }
    },
    big_player: {
        name: '大型播放器', sizes: ['large'], app: 'music',
        defaults: { ...WHITE, bgColor: '#f4f4f6', lAv: '', lTxt: '在找什么', rAv: '', rTxt: '找你的手', quote: '没有所谓的仪式感，只是猝不及防地被命运狠狠推了一把。', title: 'Endless Love', artist: '☆*: .｡. o(≧▽≦)o .｡.:*☆', pColor: '#1a1a1a', progress: 38 },
        fields: [
            { key: 'lAv', label: '左边头像', type: 'image', maxDim: 400 }, { key: 'lTxt', label: '左边气泡', type: 'text' },
            { key: 'rAv', label: '右边头像', type: 'image', maxDim: 400 }, { key: 'rTxt', label: '右边气泡', type: 'text' },
            { key: 'quote', label: '中间文字', type: 'textarea' },
            { key: 'title', label: '歌曲标题', type: 'text' }, { key: 'artist', label: '歌手名称', type: 'text' },
            { key: 'progress', label: '进度 %', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'pColor', label: '播放器文字颜色', type: 'color' }
        ],
        render: (it, d) => `<div class="yzw yzw-bplay"><div class="yzw-bp-bub"><span>${esc(d.lTxt)}</span><span>${esc(d.rTxt)}</span></div>
            <div class="yzw-bp-avs">${avatar(d.lAv)}${avatar(d.rAv)}<svg viewBox="0 0 100 40" preserveAspectRatio="none" class="wire"><path d="M18 2C2 10 4 30 30 34S70 36 82 30 98 10 82 2"/></svg></div>
            <p class="yzw-bp-q">${esc(d.quote)}</p>
            <div class="yzw-bp-card" style="color:${esc(d.pColor)}"><div class="yzw-bp-tt"><div><b>${esc(d.title)}</b><small>${esc(d.artist)}</small></div>${I.wave}</div>
            <div class="yzw-prog"><i style="width:${Number(d.progress) || 0}%"></i></div><div class="yzw-bp-time"><span>1:26</span><span>3:48</span></div>
            <div class="yzw-bp-ctrl">${I.star}${I.prev}${I.play}${I.next}${I.heart}</div></div></div>`
    },
    moments: {
        name: '动态界面', sizes: ['large'],
        defaults: { ...WHITE, title: '我的动态', mood: '心情不错 100%', i1: '', i2: '', i3: '', avatar: '', name: '用户名称', time: '12:00', sub: 'Preview Content', date: '01/01/2026', post: '今天天气真好，和朋友一起出去走走～\n#日常分享 #周末' },
        fields: [
            { key: 'title', label: '标题', type: 'text' }, { key: 'mood', label: '心情', type: 'text' },
            { key: 'i1', label: '图 1', type: 'image', maxDim: 600 }, { key: 'i2', label: '图 2', type: 'image', maxDim: 600 }, { key: 'i3', label: '图 3', type: 'image', maxDim: 600 },
            { key: 'avatar', label: '头像', type: 'image', maxDim: 300 }, { key: 'name', label: '用户名', type: 'text' },
            { key: 'time', label: '时间', type: 'text' }, { key: 'sub', label: '副标题', type: 'text' }, { key: 'date', label: '日期文字', type: 'text' },
            { key: 'post', label: '动态内容', type: 'textarea' }
        ],
        render: (it, d) => `<div class="yzw yzw-mom"><div class="yzw-mo-h">${I.back}<b>${esc(d.title)}</b><span>${I.home}${I.more}</span></div>
            <div class="yzw-mo-mood">${I.heartO}${esc(d.mood)}</div>
            <div class="yzw-mo-imgs">${[d.i1, d.i2, d.i3].map(x => photoBox(x, '')).join('')}</div>
            <div class="yzw-mo-user">${d.avatar ? avatar(d.avatar) : `<div class="yzw-av yzw-mo-u">${esc(String(d.name || 'U').slice(0, 1))}</div>`}
                <div class="yzw-mo-meta"><div><span class="pill">${esc(d.time)}</span><b>${esc(d.name)}</b></div><small>${esc(d.sub)}</small></div><span class="ic">${I.image}</span></div>
            <small class="yzw-mo-date">${esc(d.date)}</small>
            <div class="yzw-mo-post">${esc(d.post)}<div class="ics">${I.at}${I.comment}${I.heartO}</div></div></div>`
    }
};

/** 旧版内置组件 → 新组件（老桌面不会坏） */
export const LEGACY_WIDGET_MAP = {
    clock: (size) => size === 'medium' ? 'clock' : (size === 'large' ? 'clock' : 'clock'),
    calendar: (size) => size === 'large' ? 'month_cal' : 'simple_cal',
    music: (size) => size === 'medium' ? 'player' : 'vinyl',
    note: () => 'text',
    photo: () => 'photo',
    countdown: () => 'countdown',
    analog: () => 'analog'
};

/* ======================================================================
 *  样式（全部用容器单位 cqw/cqh/cqmin，自动跟着组件大小缩放）
 * ==================================================================== */
export const WIDGETS_CSS = `
.yzd-root .yzw{position:absolute;inset:0;overflow:hidden;color:var(--yzd-wtext,#1f1f24);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif}
.yzd-root .yzw svg{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.yzd-root .yzw svg.fill{fill:currentColor;stroke:none}
.yzd-root .yzw small{font-size:inherit}
.yzd-root .yzw .dim{opacity:.55}
.yzd-root .yzw-av{border-radius:50%;background:#e6e6ea center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#a8a8b0;flex:0 0 auto;overflow:hidden}
.yzd-root .yzw-av-empty svg{width:55%;height:55%;stroke-width:1.6}
.yzd-root .yzw-ph{background:#e9e9ed center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#a6a6ae}
.yzd-root .yzw-ph-empty span{font-size:max(9px,7cqmin)}
.yzd-root .yzw-prog{height:max(3px,1.4cqmin);border-radius:9px;background:rgba(127,127,127,.25);overflow:hidden}
.yzd-root .yzw-prog i{display:block;height:100%;background:currentColor;border-radius:9px}

/* 通用 Widget / 图片 */
.yzd-root .yzw-text{align-items:center;justify-content:center;padding:8%;white-space:pre-wrap;line-height:1.4;flex-direction:row}
.yzd-root .yzw-photo{background-position:center;background-repeat:no-repeat}
.yzd-root .yzw-cap{position:absolute;left:0;right:0;bottom:0;padding:8% 8% 6%;font-size:max(10px,7cqmin);color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.45))}

/* 星座 */
.yzd-root .yzw-zodiac{align-items:center;justify-content:center;gap:4%;background:radial-gradient(120% 80% at 50% 0%,rgba(120,110,255,.35),transparent 60%);text-align:center;padding:8%}
.yzd-root .yzw-zd-sym,.yzd-root .yzw-zd-big{font-variant-emoji:text;font-family:"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2",serif}
.yzd-root .yzw-zd-sym{color:#e8c77a;font-size:13cqmin;letter-spacing:.3em}
.yzd-root .yzw-zodiac b{font-size:11cqmin}
.yzd-root .yzw-zodiac small{font-size:max(9px,7cqmin);opacity:.75;line-height:1.35}
.yzd-root .yzw-zodiac.on{align-items:flex-start;text-align:left;justify-content:center}
.yzd-root .yzw-zd-head{display:flex;align-items:center;gap:6%;width:100%}
.yzd-root .yzw-zd-big{font-size:22cqmin;color:#e8c77a;line-height:1}
.yzd-root .yzw-zd-stars{color:#e8c77a;font-size:8cqmin;letter-spacing:.05em}

/* 黑胶 */
.yzd-root .yzw-vinyl{align-items:center;justify-content:center}
.yzd-root .yzw-vy-disc{width:86cqmin;height:86cqmin;border-radius:50%;background:repeating-radial-gradient(circle,#0b0b0c 0 1.2cqmin,#1d1d20 1.2cqmin 2cqmin);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px #333 inset}
.yzd-root .yzw-vy-disc.spin{animation:yzd-spin 10s linear infinite}
.yzd-root .yzw-vy-label{width:34%;height:34%;border-radius:50%;background:#26262a center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#888;font-size:5cqmin;letter-spacing:.1em}
.yzd-root .yzw-vy-arm{position:absolute;right:8%;top:6%;width:40%;height:52%}
.yzd-root .yzw-vy-arm .knob{position:absolute;right:0;top:0;width:15cqmin;height:15cqmin;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#cfcfd4 60%,#9a9aa2);box-shadow:0 2px 6px rgba(0,0,0,.4)}
.yzd-root .yzw-vy-arm .bar{position:absolute;right:6cqmin;top:7cqmin;width:2.2cqmin;height:34cqmin;background:#f2f2f4;border-radius:2px;transform-origin:top center;transform:rotate(28deg)}
.yzd-root .yzw-vy-arm .head{position:absolute;right:20cqmin;top:35cqmin;width:7cqmin;height:9cqmin;background:#fff;border-radius:2px;transform:rotate(28deg);box-shadow:0 1px 3px rgba(0,0,0,.4)}

/* 吧唧 */
.yzd-root .yzw-badge{align-items:center;justify-content:center}
.yzd-root .yzw-bd-pin{position:relative;width:80cqmin;height:80cqmin;border-radius:50%;background:radial-gradient(circle at 50% 45%,#f4f4f6,#d9d9de 70%,#c6c6cc) center/cover no-repeat;box-shadow:0 1.5cqmin 4cqmin rgba(0,0,0,.22),inset 0 0 0 1.4cqmin rgba(255,255,255,.65),inset 0 -1cqmin 2cqmin rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;color:#9a9aa2;font-size:8cqmin}
.yzd-root .yzw-badge .gloss{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(140deg,rgba(255,255,255,.75) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 70%,rgba(255,255,255,.25) 100%);pointer-events:none}
.yzd-root .yzw-bd-heart{position:relative;width:84cqmin;height:76cqmin;filter:drop-shadow(0 1.5cqmin 2.5cqmin rgba(0,0,0,.22))}
.yzd-root .yzw-bd-heart .in,.yzd-root .yzw-bd-heart .gloss{position:absolute;inset:0;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 90'%3E%3Cpath d='M50 88C20 66 2 50 2 28 2 12 14 2 28 2c10 0 17 5 22 13C55 7 62 2 72 2c14 0 26 10 26 26 0 22-18 38-48 60z'/%3E%3C/svg%3E") center/100% 100% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 90'%3E%3Cpath d='M50 88C20 66 2 50 2 28 2 12 14 2 28 2c10 0 17 5 22 13C55 7 62 2 72 2c14 0 26 10 26 26 0 22-18 38-48 60z'/%3E%3C/svg%3E") center/100% 100% no-repeat}
.yzd-root .yzw-bd-heart .in{background:radial-gradient(circle at 50% 40%,#f6f6f8,#d6d6dc) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#9a9aa2;font-size:8cqmin}

/* 新消息 */
.yzd-root .yzw-newmsg{align-items:center;justify-content:center}
.yzd-root .yzw-nm-card{position:relative;width:84%;height:84%;border-radius:18%;background:#fff;box-shadow:0 1cqmin 4cqmin rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center}
.yzd-root .yzw-nm-av{width:66cqmin;height:66cqmin;border-radius:50%;background:#dcdce1 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9cqmin;box-shadow:inset 0 0 0 1.5cqmin rgba(255,255,255,.7)}
.yzd-root .yzw-nm-tag{position:absolute;top:6%;right:-4%;display:flex;align-items:center;gap:1.5cqmin;font-size:6.5cqmin;font-weight:800;color:#111}
.yzd-root .yzw-nm-tag i{width:6cqmin;height:6cqmin;border-radius:50%;background:#ff3b30}

/* 视频通话 */
.yzd-root .yzw-vc{background-size:cover;background-position:center;padding:9% 9%;color:#fff}
.yzd-root .yzw-vc-shade{position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.05) 40%,rgba(0,0,0,.45))}
.yzd-root .yzw-vc>*:not(.yzw-vc-shade){position:relative}
.yzd-root .yzw-vc-top{display:flex;justify-content:space-between;align-items:flex-start}
.yzd-root .yzw-vc-top b{display:block;font-size:12cqmin;line-height:1.05}
.yzd-root .yzw-vc .live{display:flex;align-items:center;gap:1.4cqmin;font-size:5.2cqmin;color:#34c759;font-weight:700;margin-top:1cqmin}
.yzd-root .yzw-vc .live i{width:3cqmin;height:3cqmin;border-radius:50%;background:#34c759}
.yzd-root .yzw-vc .live em{font-style:normal;color:#fff;letter-spacing:-.1em}
.yzd-root .yzw-vc .add{width:15cqmin;height:15cqmin;border:1px solid rgba(255,255,255,.6);border-radius:4cqmin;display:flex;align-items:center;justify-content:center;font-size:9cqmin}
.yzd-root .yzw-vc-status{font-size:5.5cqmin;letter-spacing:.15em;opacity:.75;margin-top:2cqmin}
.yzd-root .yzw-vc-hint{font-size:6cqmin;opacity:.5;margin-top:2cqmin}
.yzd-root .yzw-vc-btns{position:absolute!important;left:9%;right:9%;bottom:9%;display:flex;justify-content:space-between}
.yzd-root .yzw-vc-btns span{width:17cqmin;height:17cqmin;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:8cqmin}
.yzd-root .yzw-vc-btns span.red{background:#ff3b30;width:20cqmin;height:20cqmin;margin-top:-1.5cqmin}

/* 圆形时钟 */
.yzd-root .yzw-analog{padding:7%}
.yzd-root .yzw-analog svg{width:100%;height:100%}
.yzd-root .yzw-analog .face{fill:#fff;stroke:rgba(0,0,0,.06);stroke-width:.6;filter:drop-shadow(0 1px 2px rgba(0,0,0,.12))}
.yzd-root .yzw-analog .ticks line{stroke:#2b2b33;stroke-width:1.6;stroke-linecap:round;opacity:.75}
.yzd-root .yzw-analog .h{stroke:#1f1f24;stroke-width:4;stroke-linecap:round}
.yzd-root .yzw-analog .m{stroke:#1f1f24;stroke-width:2.6;stroke-linecap:round}
.yzd-root .yzw-analog .s{stroke-width:1.1;stroke-linecap:round}

/* 敲木鱼 */
.yzd-root .yzw-muyu{padding:9%}
.yzd-root .yzw-my-top{display:flex;justify-content:space-between;align-items:center;font-size:8.5cqmin}
.yzd-root .yzw-my-top span{font-size:10cqmin;padding:1cqmin;opacity:.75}
.yzd-root .yzw-my-fish{position:absolute;left:8%;right:8%;bottom:8%;height:58%}
.yzd-root .yzw-my-fish .dome{position:absolute;left:0;right:0;bottom:7%;height:100%;border-radius:50% 50% 8% 8%/70% 70% 8% 8%;background:radial-gradient(circle at 35% 25%,#ffd26a,var(--c) 55%,#c56f0a);box-shadow:inset 0 -2cqmin 4cqmin rgba(0,0,0,.15)}
.yzd-root .yzw-my-fish .base{position:absolute;left:-2%;right:-2%;bottom:0;height:9%;border-radius:2cqmin;background:#1e2a4a}
.yzd-root .yzw-my-fish .stick{position:absolute;left:44%;top:30%;width:60%;height:5cqmin;background:#141414;border-radius:3cqmin}
.yzd-root .yzw-my-fish .stick::before{content:'';position:absolute;left:-5cqmin;top:-4cqmin;width:13cqmin;height:13cqmin;border-radius:50%;background:#141414}

/* 液态胶囊 */
.yzd-root .yzw-capsule{padding:9% 7%;gap:6%}
.yzd-root .yzw-cp-title{font-size:8cqmin;color:#9a9aa4;line-height:1.3}
.yzd-root .yzw-cp-b{display:flex;align-items:center;gap:3cqmin;padding:2cqmin 3cqmin;border-radius:20cqmin;background:rgba(255,255,255,.85);box-shadow:0 1cqmin 3cqmin rgba(0,0,0,.07),inset 0 0 0 1px rgba(255,255,255,.9);font-size:6.5cqmin;color:#8e8e98;backdrop-filter:blur(6px)}
.yzd-root .yzw-cp-b.l{margin-right:10%}
.yzd-root .yzw-cp-b.r{margin-left:10%;justify-content:space-between}
.yzd-root .yzw-cp-b .yzw-av{width:13cqmin;height:13cqmin}
.yzd-root .yzw-cp-b span{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}

/* 情侣纪念日 */
.yzd-root .yzw-couple{align-items:center;justify-content:center}
.yzd-root .yzw-cpl-avs{position:relative;width:96cqmin;height:70cqmin}
.yzd-root .yzw-cpl-avs .yzw-av{position:absolute;width:58cqmin;height:58cqmin;top:0;border:1.6cqmin solid #fff;box-shadow:0 1cqmin 4cqmin rgba(0,0,0,.15)}
.yzd-root .yzw-cpl-avs .a{left:4cqmin}
.yzd-root .yzw-cpl-avs .b{right:4cqmin;top:8cqmin}
.yzd-root .yzw-cpl-date{position:absolute;bottom:7%;left:0;right:0;text-align:center;font-weight:800;font-size:8cqmin;color:#fff;-webkit-text-stroke:.5px rgba(0,0,0,.35);text-shadow:0 1px 3px rgba(0,0,0,.35);letter-spacing:.06em}
.yzd-root .yzw-cpl-date em{display:block;font-style:normal;font-size:11cqmin}

/* 陪伴时长 */
.yzd-root .yzw-comp{align-items:center;justify-content:center;text-align:center;gap:2%;padding:6%}
.yzd-root .yzw-comp-av .yzw-av{width:34cqmin;height:34cqmin;box-shadow:0 0 0 1.5cqmin #fff,0 0 0 2.6cqmin #ffc4cc}
.yzd-root .yzw-comp-t{font-size:7.5cqmin;margin-top:4cqmin}
.yzd-root .yzw-comp-n{font-size:7cqmin}
.yzd-root .yzw-comp-n b{color:#ff5470;font-size:10cqmin;margin:0 .6cqmin}

/* 简约日历 */
.yzd-root .yzw-scal{align-items:center;justify-content:center;text-align:center;gap:3%}
.yzd-root .yzw-scal small{font-size:6.5cqmin;opacity:.75}
.yzd-root .yzw-scal b{font-size:30cqmin;font-weight:700;line-height:1.05}
.yzd-root .yzw-scal b.anc{font-size:9cqmin;line-height:1.4}

/* 倒数日 */
.yzd-root .yzw-cd{padding:11% 11%;gap:4%}
.yzd-root .yzw-cd small{font-size:7cqmin}
.yzd-root .yzw-cd-n{display:flex;align-items:baseline;gap:2cqmin;margin-top:auto}
.yzd-root .yzw-cd-n b{font-size:28cqmin;font-weight:800;line-height:1}
.yzd-root .yzw-cd-n span{font-size:7cqmin}
.yzd-root .yzw-cd .deco{position:absolute;right:-14%;bottom:-14%;width:60%;height:60%;border-radius:50%;background:rgba(181,101,63,.08)}

/* 喝水 */
.yzd-root .yzw-water{padding:11%;gap:4%}
.yzd-root .yzw-water small{font-size:7cqmin;font-weight:700}
.yzd-root .yzw-water small.dim{font-weight:400;font-size:5.5cqmin;margin-top:auto}
.yzd-root .yzw-wt-n{display:flex;align-items:baseline;gap:1.5cqmin;margin-top:16%}
.yzd-root .yzw-wt-n b{font-size:28cqmin;line-height:1;font-weight:800}
.yzd-root .yzw-wt-n span{font-size:6.5cqmin;opacity:.7}
.yzd-root .yzw-wt-bar{position:absolute;right:9%;top:16%;bottom:16%;width:4.5cqmin;border-radius:3cqmin;background:rgba(47,111,191,.15);display:flex;align-items:flex-end;overflow:hidden}
.yzd-root .yzw-wt-bar i{width:100%;background:linear-gradient(#7ab8ff,#2f6fbf);border-radius:3cqmin;transition:height .3s}

/* 月相 */
.yzd-root .yzw-moon{align-items:center;justify-content:center;gap:2%;text-align:center}
.yzd-root .yzw-moon .stars{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 20% 25%,#fff8,transparent),radial-gradient(1px 1px at 70% 15%,#fff9,transparent),radial-gradient(1.5px 1.5px at 85% 60%,#fff7,transparent),radial-gradient(1px 1px at 30% 75%,#fff6,transparent),radial-gradient(1px 1px at 55% 45%,#fff5,transparent)}
.yzd-root .yzw-moon .yzw-moon-svg{width:46cqmin;height:46cqmin;stroke:none;filter:drop-shadow(0 0 4cqmin rgba(243,231,195,.35))}
.yzd-root .yzw-moon b{font-size:8cqmin;margin-top:3cqmin}
.yzd-root .yzw-moon small{font-size:6cqmin;opacity:.6}

/* 电影日历 */
.yzd-root .yzw-movie{flex-direction:row;align-items:center;padding:5% 4% 5% 7%;gap:4%}
.yzd-root .yzw-mv-l{flex:1;font-size:8cqh;font-weight:600;opacity:.8}
.yzd-root .yzw-mv-card{width:38%;height:100%;border-radius:4cqmin;background:#fff;box-shadow:0 1cqmin 4cqmin rgba(0,0,0,.12);padding:3cqmin;display:flex;flex-direction:column;gap:1.5cqmin}
.yzd-root .yzw-mv-poster{flex:1;border-radius:2cqmin;background:#eee center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12cqh}
.yzd-root .yzw-mv-card b{font-size:7.5cqh;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.yzd-root .yzw-mv-card small{font-size:6cqh;opacity:.6}

/* 时钟（浮雕） */
.yzd-root .yzw-clock{align-items:center;justify-content:center;text-align:center}
.yzd-root .yzw-ck-t{font-size:min(52cqh,27cqw);font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--yzd-wtext);text-shadow:.6cqh .6cqh 1.2cqh rgba(0,0,0,.2),-.4cqh -.4cqh .8cqh rgba(255,255,255,.9);font-variant-numeric:tabular-nums}
.yzd-root .yzw-ck-t small,.yzd-root .yzw-ck-t .yzw-ck-ampm{font-size:.3em;margin-left:.15em;color:inherit!important;-webkit-text-fill-color:currentColor!important;text-shadow:inherit!important;opacity:1!important;font-weight:inherit}
.yzd-root .yzw-ck-d{font-size:min(11cqh,5cqw);margin-top:2cqh;font-weight:600;color:var(--yzd-wtext);text-shadow:.3cqh .3cqh .8cqh rgba(0,0,0,.22),-.2cqh -.2cqh .5cqh rgba(255,255,255,.8)}

/* 便签 */
.yzd-root .yzw-memo{flex-direction:row;padding:6%}
.yzd-root .yzw-mm-l{width:32%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4cqh;border-right:1px dashed rgba(0,0,0,.15)}
.yzd-root .yzw-mm-l .yzw-av{width:min(46cqh,22cqw);height:min(46cqh,22cqw);box-shadow:0 0 0 1.4cqh #fff,0 1cqh 3cqh rgba(0,0,0,.1)}
.yzd-root .yzw-mm-l b{font-size:17cqh;line-height:1}
.yzd-root .yzw-mm-r{flex:1;display:flex;flex-direction:column;justify-content:space-around;padding-left:5%}
.yzd-root .yzw-mm-row{display:flex;align-items:center;gap:3cqh;font-size:9cqh;border-bottom:1px dashed rgba(0,0,0,.12);padding:2cqh 0;min-height:0}
.yzd-root .yzw-mm-row i{width:9cqh;height:9cqh;border:1.5px solid #aaa;border-radius:2cqh;flex:0 0 auto}
.yzd-root .yzw-mm-row.done i{background:#34c759;border-color:#34c759}
.yzd-root .yzw-mm-row.done span{text-decoration:line-through;opacity:.5}

/* 日常信息 */
.yzd-root .yzw-daily{flex-direction:row;align-items:center;padding:7%;gap:6%}
.yzd-root .yzw-di-l{display:flex;flex-direction:column;align-items:center;padding-right:6%;border-right:1px solid rgba(0,0,0,.08)}
.yzd-root .yzw-di-l b{font-size:36cqh;line-height:1}
.yzd-root .yzw-di-l small{font-size:8cqh;opacity:.6;white-space:nowrap}
.yzd-root .yzw-di-r{flex:1;display:flex;flex-direction:column;gap:5cqh;font-size:9.5cqh;min-width:0}
.yzd-root .yzw-di-r div{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}

/* 播放器 */
.yzd-root .yzw-player{flex-direction:row;align-items:center;padding:6%;gap:6%}
.yzd-root .yzw-pl-cover{height:100%;aspect-ratio:1;border-radius:4cqh;background:#ececf0 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#a0a0a8;font-size:22cqh}
.yzd-root .yzw-pl-r{flex:1;min-width:0;display:flex;flex-direction:column;gap:4cqh}
.yzd-root .yzw-pl-r b{font-size:11cqh;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.yzd-root .yzw-pl-r small{font-size:8cqh;opacity:.6;margin-top:-3cqh}
.yzd-root .yzw-pl-ctrl{display:flex;justify-content:space-between;font-size:12cqh;margin-top:2cqh}

/* 游戏机 */
.yzd-root .yzw-gb{flex-direction:row;align-items:stretch;background:var(--gb);border-radius:inherit;padding:4% 3%;box-shadow:inset 0 0 0 1.2cqh rgba(255,255,255,.55);gap:3%}
.yzd-root .yzw-gb-l,.yzd-root .yzw-gb-r{position:relative;width:18%}
.yzd-root .yzw-gb .dpad{position:absolute;left:50%;top:50%;width:22cqh;height:22cqh;transform:translate(-50%,-50%);background:linear-gradient(#fff,#fff) center/34% 100% no-repeat,linear-gradient(#fff,#fff) center/100% 34% no-repeat;filter:drop-shadow(0 .8cqh 0 rgba(0,0,0,.12))}
.yzd-root .yzw-gb .btn{position:absolute;width:12cqh;height:12cqh;border-radius:50%;background:#fff;opacity:.85;left:50%;transform:translateX(-50%)}
.yzd-root .yzw-gb .s{top:6%}.yzd-root .yzw-gb .s2{bottom:6%}.yzd-root .yzw-gb .s3{bottom:6%}
.yzd-root .yzw-gb .ab{position:absolute;width:11cqh;height:11cqh;border-radius:50%;background:#fff;box-shadow:0 .6cqh 0 rgba(0,0,0,.12)}
.yzd-root .yzw-gb .x{left:calc(50% - 5.5cqh);top:calc(50% - 17cqh)}.yzd-root .yzw-gb .b{left:calc(50% - 5.5cqh);top:calc(50% + 6cqh)}
.yzd-root .yzw-gb .y{left:calc(50% - 17cqh);top:calc(50% - 5.5cqh)}.yzd-root .yzw-gb .a{left:calc(50% + 6cqh);top:calc(50% - 5.5cqh)}
.yzd-root .yzw-gb-screen{flex:1;border-radius:3cqh;background:#fff center/cover no-repeat;box-shadow:inset 0 0 0 1cqh rgba(255,255,255,.9),0 0 0 .5cqh rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;font-size:8cqh;color:#888;position:relative}
.yzd-root .yzw-gb-screen em{position:absolute;right:4%;top:2%;font-style:normal;color:#ff8fb1;font-size:8cqh}

/* 相片 / 拍立得 */
.yzd-root .yzw-pol{background:#fff;padding:3%;padding-bottom:9%;box-shadow:0 1cqmin 4cqmin rgba(0,0,0,.15);border-radius:1.5cqmin;display:flex;flex-direction:column}
.yzd-root .yzw-pol .yzw-ph{flex:1;border-radius:1cqmin}
.yzd-root .yzw-three{flex-direction:row;align-items:center;justify-content:center;gap:3%;padding:5%}
.yzd-root .yzw-three .yzw-pol{width:29%;height:84%}
.yzd-root .yzw-three .r0{transform:rotate(-4deg)}.yzd-root .yzw-three .r1{transform:rotate(2deg) translateY(-3%)}.yzd-root .yzw-three .r2{transform:rotate(-2deg)}
.yzd-root .yzw-pstack .yzw-pol{position:absolute}
.yzd-root .yzw-pstack .main{left:6%;top:9%;width:60%;height:72%;transform:rotate(-4deg);padding-bottom:13%}
.yzd-root .yzw-pstack .main .cap{position:absolute;left:6%;bottom:2%;font-size:6.5cqmin;font-family:"Segoe Print","Comic Sans MS",cursive;transform:rotate(-2deg);white-space:nowrap}
.yzd-root .yzw-pstack .s2{right:7%;top:7%;width:32%;height:36%;transform:rotate(8deg)}
.yzd-root .yzw-pstack .s3{right:9%;top:46%;width:32%;height:36%;transform:rotate(-3deg)}

/* LOVE 相框 */
.yzd-root .yzw-love{flex-direction:row;align-items:center;justify-content:center;font-size:58cqh;line-height:1;gap:1cqw;font-family:"Didot","Bodoni 72","Times New Roman",serif;font-weight:700;color:var(--yzd-wtext)}
.yzd-root .yzw-love-o{width:.78em;height:.78em;border-radius:50%;border:.08em solid currentColor;background:center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:inherit}
.yzd-root .yzw-love-o svg{width:.32em;height:.32em;stroke-width:1.4}
.yzd-root .yzw-love.f-balloon{font-family:"Arial Rounded MT Bold","Varela Round",sans-serif;font-weight:900;-webkit-text-stroke:.03em currentColor;color:#fff;text-shadow:0 0 0 currentColor,.03em .05em 0 rgba(0,0,0,.25)}
.yzd-root .yzw-love.f-balloon span{color:#fff;-webkit-text-stroke:.05em #1a1a1a}
.yzd-root .yzw-love.f-script{font-family:"Snell Roundhand","Brush Script MT","Segoe Script",cursive;font-style:italic;font-weight:400}
.yzd-root .yzw-love.f-hand{font-family:"Segoe Print","Comic Sans MS","Bradley Hand",cursive;font-weight:400}
.yzd-root .yzw-love.f-spray{font-family:Impact,"Arial Black",sans-serif;font-weight:900;filter:blur(.012em);text-shadow:0 0 .08em currentColor}

/* 仿 iMessage */
.yzd-root .yzw-imsg{align-items:center;padding:5% 6%;gap:1.4%;background-size:100% 30%;background-repeat:no-repeat;background-position:top}
.yzd-root .yzw-im-top{display:flex;justify-content:space-between;width:100%;font-size:5cqmin;color:#666}
.yzd-root .yzw-im-top .r{display:flex;gap:2.5cqmin;align-items:center}
.yzd-root .yzw-im-top .yzw-av.xs{width:5.5cqmin;height:5.5cqmin}
.yzd-root .yzw-av.big{width:17cqmin;height:17cqmin;box-shadow:0 0 0 1cqmin #fff}
.yzd-root .yzw-im-name{font-size:5cqmin}
.yzd-root .yzw-im-h{font-size:3.4cqmin;opacity:.55}
.yzd-root .yzw-im-stats{display:flex;justify-content:space-around;width:100%;text-align:center;margin:1.5% 0}
.yzd-root .yzw-im-stats div{display:flex;flex-direction:column}
.yzd-root .yzw-im-stats b{font-size:4.5cqmin;color:#4a8ff0}
.yzd-root .yzw-im-stats small{font-size:3.2cqmin;opacity:.6}
.yzd-root .yzw-im-card{width:100%;flex:1;border-radius:3cqmin;background:#f6f6f8;padding:4% 5%;font-size:3.6cqmin;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
.yzd-root .yzw-im-card b{color:#4a8ff0;font-size:3.8cqmin}
.yzd-root .yzw-im-card p{margin:1.5cqmin 0;white-space:pre-wrap;line-height:1.45}
.yzd-root .yzw-im-card hr{border:0;border-top:1px dashed rgba(0,0,0,.12);margin:2.5cqmin 0}

/* 个人资料 */
.yzd-root .yzw-prof{align-items:center}
.yzd-root .yzw-pf-cover{position:absolute;left:0;right:0;top:0;height:42%;background:linear-gradient(160deg,#e9eaee,#cfd2da) center/cover no-repeat}
.yzd-root .yzw-av.pf{position:relative;margin-top:26%;width:30cqmin;height:30cqmin;box-shadow:0 0 0 1.8cqmin #fff,0 2cqmin 5cqmin rgba(0,0,0,.12)}
.yzd-root .yzw-pf-body{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.4cqmin;margin-top:3cqmin;padding:0 8%}
.yzd-root .yzw-pf-body b{font-size:7cqmin}
.yzd-root .yzw-pf-body small{font-size:4.4cqmin;opacity:.55}
.yzd-root .yzw-pf-body p{margin:1.5cqmin 0 0;font-size:4.8cqmin;opacity:.75;white-space:pre-wrap;line-height:1.45}

/* 月历 */
.yzd-root .yzw-mcal{padding:7%}
.yzd-root .yzw-mc-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3cqmin}
.yzd-root .yzw-mc-h b{font-size:10cqmin}
.yzd-root .yzw-mc-h span{font-size:6cqmin;opacity:.7}
.yzd-root .yzw-mc-g{flex:1;display:grid;grid-template-columns:repeat(7,1fr);align-content:space-around;text-align:center;font-size:5.4cqmin}
.yzd-root .yzw-mc-g b{opacity:.5;font-weight:600}
.yzd-root .yzw-mc-g i{font-style:normal;width:8.5cqmin;height:8.5cqmin;line-height:8.5cqmin;border-radius:50%;margin:0 auto}
.yzd-root .yzw-mc-g i.on{color:#fff;font-weight:700}

/* 剪贴簿 */
.yzd-root .yzw-scrap{background-image:linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px);background-size:6cqmin 6cqmin}
.yzd-root .yzw-sc-like{position:absolute;left:6%;top:5%;display:flex;align-items:center;gap:1cqmin;background:#ff3b30;color:#fff;font-size:4.6cqmin;padding:1cqmin 2.4cqmin;border-radius:3cqmin;font-weight:700}
.yzd-root .yzw-sc-date{position:absolute;left:5%;top:24%;writing-mode:vertical-rl;font-size:5cqmin;letter-spacing:.2em;opacity:.55;font-family:"Segoe Print","Comic Sans MS",cursive}
.yzd-root .yzw-sc-photo{position:absolute;left:18%;right:10%;top:13%;height:58%;background:#fff;padding:3cqmin;box-shadow:0 1.5cqmin 4cqmin rgba(0,0,0,.12);transform:rotate(1.5deg)}
.yzd-root .yzw-sc-photo .yzw-ph{width:100%;height:100%}
.yzd-root .yzw-scrap .tape{position:absolute;width:20cqmin;height:5.5cqmin;background:rgba(255,182,200,.75)}
.yzd-root .yzw-scrap .t1{left:-6cqmin;top:-2cqmin;transform:rotate(-32deg)}
.yzd-root .yzw-scrap .t2{right:-5cqmin;bottom:2cqmin;transform:rotate(-30deg)}
.yzd-root .yzw-sc-cap{position:absolute;left:24%;right:12%;bottom:9%;background:#fff;padding:3cqmin;text-align:center;font-size:5.5cqmin;box-shadow:0 1cqmin 3cqmin rgba(0,0,0,.08);transform:rotate(-1.5deg)}
.yzd-root .yzw-scrap .t3{right:-6cqmin;top:-2.5cqmin;width:15cqmin;transform:rotate(25deg)}

/* 大型播放器 */
.yzd-root .yzw-bplay{padding:5% 6%;align-items:center}
.yzd-root .yzw-bp-bub{display:flex;gap:6%;width:70%;justify-content:space-around}
.yzd-root .yzw-bp-bub span{background:#fff;border-radius:5cqmin;padding:1.5cqmin 4cqmin;font-size:4.4cqmin;box-shadow:0 1cqmin 3cqmin rgba(0,0,0,.08);white-space:nowrap}
.yzd-root .yzw-bp-avs{position:relative;display:flex;gap:6cqmin;margin-top:3%}
.yzd-root .yzw-bp-avs .yzw-av{width:21cqmin;height:21cqmin;border:.8cqmin solid #1a1a1a;position:relative;z-index:1;background-color:#f1f1f4}
.yzd-root .yzw-bp-avs .wire{position:absolute;left:-14%;right:-14%;top:30%;height:130%;width:128%;stroke:#1a1a1a;stroke-width:.9;fill:none}
.yzd-root .yzw-bp-q{position:relative;font-size:3.8cqmin;text-align:center;margin:4% 6% 0;line-height:1.5;opacity:.8}
.yzd-root .yzw-bp-card{position:relative;margin-top:auto;width:100%;background:rgba(255,255,255,.75);backdrop-filter:blur(10px);border-radius:4cqmin;padding:4% 6%;box-shadow:0 1cqmin 4cqmin rgba(0,0,0,.08);display:flex;flex-direction:column;gap:2cqmin}
.yzd-root .yzw-bp-tt{display:flex;justify-content:space-between;align-items:center;font-size:6cqmin}
.yzd-root .yzw-bp-tt div{display:flex;flex-direction:column;align-items:center;flex:1}
.yzd-root .yzw-bp-tt b{font-size:5cqmin}
.yzd-root .yzw-bp-tt small{font-size:3.4cqmin;opacity:.6}
.yzd-root .yzw-bp-time{display:flex;justify-content:space-between;font-size:3.2cqmin;opacity:.6;margin-top:-1cqmin}
.yzd-root .yzw-bp-ctrl{display:flex;justify-content:space-around;align-items:center;font-size:6cqmin}
.yzd-root .yzw-bp-ctrl svg:nth-child(3){font-size:8cqmin}

/* 动态界面 */
.yzd-root .yzw-mom{padding:5% 6%;gap:2.4%;font-size:4.2cqmin}
.yzd-root .yzw-mo-h{display:flex;align-items:center;gap:2cqmin;font-size:4.6cqmin}
.yzd-root .yzw-mo-h b{flex:1;font-weight:500;opacity:.8}
.yzd-root .yzw-mo-h span{display:flex;gap:3cqmin}
.yzd-root .yzw-mo-mood{display:flex;align-items:center;gap:1.5cqmin;font-size:4.8cqmin;font-weight:600}
.yzd-root .yzw-mo-imgs{display:grid;grid-template-columns:repeat(3,1fr);gap:2cqmin;height:22%}
.yzd-root .yzw-mo-imgs .yzw-ph{border-radius:1.5cqmin}
.yzd-root .yzw-mo-user{display:flex;align-items:center;gap:3cqmin;margin-top:1%}
.yzd-root .yzw-mo-user .yzw-av{width:11cqmin;height:11cqmin}
.yzd-root .yzw-mo-u{background:#8ec9b8!important;color:#fff!important;font-size:5cqmin;font-weight:700}
.yzd-root .yzw-mo-meta{flex:1;display:flex;flex-direction:column}
.yzd-root .yzw-mo-meta div{display:flex;align-items:center;gap:2cqmin}
.yzd-root .yzw-mo-meta .pill{background:#e8e8ec;border-radius:3cqmin;padding:.4cqmin 2cqmin;font-size:3.6cqmin}
.yzd-root .yzw-mo-meta b{font-size:4.8cqmin}
.yzd-root .yzw-mo-meta small{font-size:3.6cqmin;opacity:.55}
.yzd-root .yzw-mo-user .ic{font-size:5cqmin;opacity:.6}
.yzd-root .yzw-mo-date{font-size:3.4cqmin;opacity:.5;margin-left:14cqmin}
.yzd-root .yzw-mo-post{flex:1;background:#f6f6f8;border-radius:3cqmin;padding:3.5% 4.5%;white-space:pre-wrap;line-height:1.5;position:relative;overflow:hidden}
.yzd-root .yzw-mo-post .ics{position:absolute;right:4%;bottom:6%;display:flex;gap:2.5cqmin;font-size:4.6cqmin;opacity:.6}

/* 点一下的小浮字 */
.yzd-root .yzw-float{position:absolute;left:50%;top:40%;transform:translate(-50%,0);font-size:13px;font-weight:700;color:#ff8a00;pointer-events:none;animation:yzw-float .8s ease-out forwards;z-index:5;white-space:nowrap;text-shadow:0 1px 2px #fff}
@keyframes yzw-float{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,-36px)}}
`;
