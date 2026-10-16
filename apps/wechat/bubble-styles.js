// 🫧 聊天气泡样式：内置预设 + 自定义 CSS 编译
//
// 写法：用 .bubble 代表气泡本身，例如
//   .bubble { background: #fff; border-radius: 18px; }
//   .bubble::after { content: '👑'; bottom: -10px; right: -6px; }
// 编译时会把 .bubble 换成对应消息的选择器，并给每条声明加上 !important，保证能盖过聊天主题。

// 装饰（::before / ::after）的通用底座：先清掉主题自带的伪元素样式
const DECO = 'display:block; position:absolute; top:auto; bottom:auto; left:auto; right:auto; width:auto; height:auto; background:none; border:0; box-shadow:none; line-height:1; pointer-events:none; z-index:2; filter:none; transform:none; margin:0; padding:0;';


// 装饰小贴图（SVG，统一描边和配色，干净不乱）
const svgUrl = (body, vb) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${body}</svg>`)}")`;
const ANGEL_WING = svgUrl(
    "<ellipse cx='15' cy='4.2' rx='6.2' ry='2.2' fill='none' stroke='#f2cf6b' stroke-width='1.5'/>" +
    "<path d='M14.2 15.5C11 9.5 5.5 8.6 1.6 11.2c2 .6 2.6 1.6 2 3 1.6-.3 2.5.3 2.4 1.9 2.4-1 5-.9 8.2-.6z' fill='#fff' stroke='#c3c7d4' stroke-width='.9' stroke-linejoin='round'/>" +
    "<path d='M15.8 15.5C19 9.5 24.5 8.6 28.4 11.2c-2 .6-2.6 1.6-2 3-1.6-.3-2.5.3-2.4 1.9-2.4-1-5-.9-8.2-.6z' fill='#fff' stroke='#c3c7d4' stroke-width='.9' stroke-linejoin='round'/>" +
    "<circle cx='15' cy='15.8' r='1.6' fill='#fff' stroke='#c3c7d4' stroke-width='.8'/>",
    '0 0 30 22');
const SPARKLE_WHITE = svgUrl(
    "<path d='M9 1c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z' fill='#fff' stroke='#c3c7d4' stroke-width='.9' stroke-linejoin='round'/>" +
    "<path d='M15 11.5c.2 1.3.8 1.9 2.1 2.1-1.3.2-1.9.8-2.1 2.1-.2-1.3-.8-1.9-2.1-2.1 1.3-.2 1.9-.8 2.1-2.1z' fill='#fff' stroke='#c3c7d4' stroke-width='.6'/>",
    '0 0 18 17');
const HEART_STAR = svgUrl(
    "<path d='M8 14S1.5 10 1.5 5.8C1.5 3.6 3 2.2 4.8 2.2c1.3 0 2.5.8 3.2 2 .7-1.2 1.9-2 3.2-2 1.8 0 3.3 1.4 3.3 3.6C14.5 10 8 14 8 14z' fill='#fff' stroke='#9a9ca4' stroke-width='.9' stroke-linejoin='round'/>" +
    "<path d='M19.5 2c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z' fill='#fff' stroke='#9a9ca4' stroke-width='.7' stroke-linejoin='round'/>",
    '0 0 24 15');
const BUTTERFLY = svgUrl(
    "<path d='M9.5 8C7 2.5 2.6 1.2 1.2 3 0 4.6 1.6 8 5.4 8.6 2.4 9.6 2 12.6 3.6 13.6 5.6 14.8 8.4 12.4 9.5 9.2z' fill='#cbb5f2' stroke='#9b7fd6' stroke-width='.8' stroke-linejoin='round'/>" +
    "<path d='M10.5 8C13 2.5 17.4 1.2 18.8 3 20 4.6 18.4 8 14.6 8.6 17.6 9.6 18 12.6 16.4 13.6 14.4 14.8 11.6 12.4 10.5 9.2z' fill='#e3d6fa' stroke='#9b7fd6' stroke-width='.8' stroke-linejoin='round'/>" +
    "<path d='M10 6v8' stroke='#7d62bd' stroke-width='1.2' stroke-linecap='round'/>" +
    "<path d='M10 6 8.4 3.4M10 6l1.6-2.6' stroke='#7d62bd' stroke-width='.6' stroke-linecap='round' fill='none'/>",
    '0 0 20 16');
const CAT_PEEK = svgUrl(
    "<path d='M4 9.2 3 2.4 8 5.3C9.5 4.8 11.2 4.6 13 4.6s3.5.2 5 .7l5-2.9-1 6.8c.7 1.1 1 2.3 1 3.6 0 3.3-4.5 5.2-10 5.2S3 16.4 3 13.1c0-1.4.3-2.7 1-3.9z' fill='#fff' stroke='#a993d8' stroke-width='1' stroke-linejoin='round'/>" +
    "<path d='M4.4 4.6 6.2 6M21.6 4.6 19.8 6' stroke='#f1b9cf' stroke-width='1.1' stroke-linecap='round'/>" +
    "<circle cx='9.4' cy='10.6' r='1.05' fill='#5b4a80'/><circle cx='16.6' cy='10.6' r='1.05' fill='#5b4a80'/>" +
    "<path d='M11.9 12.6c.4.5.7.6 1.1.6s.7-.1 1.1-.6' stroke='#5b4a80' stroke-width='.7' fill='none' stroke-linecap='round'/>" +
    "<ellipse cx='7.4' cy='12.8' rx='1.4' ry='.8' fill='#f6c6d8'/><ellipse cx='18.6' cy='12.8' rx='1.4' ry='.8' fill='#f6c6d8'/>" +
    "",
    '0 0 26 18.5');

const preset = (id, name, css, previewBg = '') => ({ id, name, css: css.trim(), previewBg });

export const WECHAT_BUBBLE_PRESETS = [
    preset('default', '默认', ''),

    // ---------- 简约款 ----------
    preset('frosted', '磨砂玻璃', `
.bubble { background: rgba(255,255,255,.42); border: 1px solid rgba(255,255,255,.8); border-radius: 14px; -webkit-backdrop-filter: blur(14px) saturate(150%); backdrop-filter: blur(14px) saturate(150%); box-shadow: 0 4px 14px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.85); color: #2b2f36; }
`),

    preset('neumorph', '微拟态', `
.bubble { background: #eceef1; border: 0; border-radius: 16px; box-shadow: 5px 5px 10px rgba(160,166,176,.5), -4px -4px 9px rgba(255,255,255,.95); color: #3a3f46; }
`),

    preset('halo', '极简半透明', `
.bubble { background: rgba(255,255,255,.28); border: 2px solid rgba(255,255,255,.95); border-radius: 18px; box-shadow: 0 2px 10px rgba(0,0,0,.10), inset 0 0 10px rgba(255,255,255,.35); color: #22262b; }
`),

    preset('fluffy', '简约毛边粉', `
.bubble { background: #ffe5ec; border: 3px solid #fff; border-radius: 16px; box-shadow: 0 0 0 1.5px #f3d0d9, 0 3px 10px rgba(0,0,0,.07); color: #6b3f4b; }
`),

    preset('dewdrop', '水色露珠', `
.bubble { background: linear-gradient(180deg, #f8fbff 0%, #cfdfff 100%); border: 1px solid rgba(255,255,255,.95); border-radius: 22px; box-shadow: inset 0 3px 0 rgba(255,255,255,.95), inset 0 -3px 8px rgba(120,150,230,.22), 0 4px 12px rgba(110,140,220,.25); color: #26406b; }
`),

    // ---------- 照参考图做的 ----------
    // 天使弥散框：白色弥散光晕 + 左下小翅膀光环、右下闪光
    preset('angelglow', '天使弥散框', `
.bubble { position: relative; overflow: visible; background: #ffffff; border: 0; border-radius: 16px; box-shadow: 0 0 0 1px rgba(232,234,242,.9), 0 0 8px 3px rgba(255,255,255,.95), 0 4px 14px rgba(170,176,200,.28); color: #4a4f57; }
.bubble::before { ${DECO} content: ''; width: 28px; height: 21px; bottom: -10px; left: -9px; background: ${ANGEL_WING} center / contain no-repeat; filter: drop-shadow(0 1px 1.5px rgba(150,155,175,.45)); }
.bubble::after { ${DECO} content: ''; width: 17px; height: 17px; bottom: -8px; right: -6px; background: ${SPARKLE_WHITE} center / contain no-repeat; filter: drop-shadow(0 1px 1.5px rgba(150,155,175,.5)); }
`),

    // 水蓝小海豹：淡蓝弥散光 + 小鱼、泡泡、小海豹
    preset('seal', '水蓝小海豹', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #eef7ff 0%, #d4ebfb 100%); border: 0; border-radius: 16px; box-shadow: 0 0 6px 3px rgba(255,255,255,.95), 0 0 0 1px rgba(255,255,255,.9); color: #3b5f7c; }
.bubble::before { ${DECO} content: '🐟 °'; bottom: -12px; left: 8px; font-size: 12px; color: #a9d4f2; }
.bubble::after { ${DECO} content: '🦭'; bottom: -13px; right: -10px; font-size: 18px; }
`),

    // 灰雾星啵：透明玻璃水泡，左上一道高光，右下小爱心星星
    preset('glassdrop', '灰雾星啵', `
.bubble { position: relative; overflow: visible; border: 1.5px solid rgba(255,255,255,.85); border-radius: 20px; background: linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(178,180,188,.34) 100%); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: inset 0 2px 5px rgba(255,255,255,.85), inset 0 -3px 7px rgba(0,0,0,.12), 0 4px 10px rgba(0,0,0,.14); color: #26282c; }
.bubble::before { ${DECO} content: ''; width: 12px; height: 3.5px; top: 3px; left: 12px; border-radius: 50%; background: rgba(255,255,255,.85); box-shadow: 10px .5px 0 -1px rgba(255,255,255,.6); }
.bubble::after { ${DECO} content: ''; width: 24px; height: 15px; bottom: -8px; right: -7px; background: ${HEART_STAR} center / contain no-repeat; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.28)); }
`),

    // 水色薄雾：蓝白磨砂玻璃，白描边和内发光
    preset('mist', '水色薄雾', `
.bubble { background: linear-gradient(180deg, rgba(255,255,255,.72) 0%, rgba(226,236,248,.62) 100%); border: 1.5px solid rgba(255,255,255,.95); border-radius: 16px; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: inset 0 0 10px rgba(255,255,255,.9), 0 4px 12px rgba(120,150,190,.22); color: #6a7b90; }
`),

    // 紫蝴蝶小猫：淡紫弥散光 + 右上小蝴蝶、左下探头的小猫
    preset('butterflycat', '紫蝴蝶小猫', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #fbf9ff 0%, #eee7fc 100%); border: 1.5px solid #e2d6f7; border-radius: 16px; box-shadow: 0 0 8px 2px rgba(255,255,255,.95), 0 3px 12px rgba(160,135,215,.22); color: #6a5a8c; }
.bubble::before { ${DECO} content: ''; width: 19px; height: 16px; top: -9px; right: -7px; transform: rotate(14deg); background: ${BUTTERFLY} center / contain no-repeat; filter: drop-shadow(0 1px 1px rgba(120,95,180,.3)); }
.bubble::after { ${DECO} content: ''; width: 26px; height: 18px; bottom: -11px; left: -6px; background: ${CAT_PEEK} center / contain no-repeat; filter: drop-shadow(0 1px 1px rgba(120,95,180,.3)); }
`)
];

export const WECHAT_BUBBLE_CSS_TEMPLATE = `/* 用 .bubble 代表气泡本身 */
.bubble {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,.1);
  color: #333;
}
/* 装饰示例：右上角贴一个小表情 */
/*
.bubble { position: relative; overflow: visible; }
.bubble::after {
  content: '🐱';
  position: absolute; bottom: -10px; right: -6px;
  font-size: 15px;
}
*/`;

// 上一版的预设已精简，旧 id 映射到最接近的新预设
const LEGACY_PRESET_MAP = {
    meow: 'halo', bunny: 'fluffy', autumn: 'fluffy', icy: 'dewdrop', starlight: 'angelglow', paw: 'fluffy',
    ribbon: 'halo', magician: 'butterflycat', crown: 'fluffy', pinkcat: 'fluffy', angel: 'angelglow',
    blackstar: 'glassdrop', kaomoji: 'halo', readmark: 'halo', rainy: 'glassdrop',
    glass: 'frosted', frost: 'frosted', cream: 'fluffy', sakura: 'fluffy', mint: 'dewdrop', night: 'glassdrop', outline: 'halo', paper: 'fluffy'
};

export function getBubblePreset(id = '') {
    const key = LEGACY_PRESET_MAP[id] || id;
    return WECHAT_BUBBLE_PRESETS.find(p => p.id === key) || null;
}

// 把 .bubble 写法编译到具体选择器上，并补上 !important
export function compileBubbleCss(source = '', scopeSelectors = []) {
    const css = String(source || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(css)) !== null) {
        const selectorText = m[1].trim();
        const body = m[2].trim();
        if (!selectorText || !body || selectorText.startsWith('@')) continue;
        const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
        const scoped = [];
        selectors.forEach(sel => {
            if (!sel.includes('.bubble')) return; // 只允许作用在气泡上，防止改到整个页面
            scopeSelectors.forEach(scope => scoped.push(sel.replace(/\.bubble\b/g, scope)));
        });
        if (!scoped.length) continue;
        const decls = body.split(';')
            .map(d => d.trim())
            .filter(d => d && d.includes(':'))
            .map(d => (/!important\s*$/i.test(d) ? d : `${d} !important`))
            .join('; ');
        out.push(`${scoped.join(',\n')} { ${decls}; }`);
    }
    return out.join('\n');
}

export function hashBubbleSource(text = '') {
    let h = 5381;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
