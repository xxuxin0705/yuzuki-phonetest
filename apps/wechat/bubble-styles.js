// 🫧 聊天气泡样式：内置预设 + 自定义 CSS 编译
//
// 写法：用 .bubble 代表气泡本身，例如
//   .bubble { background: #fff; border-radius: 18px; }
//   .bubble::after { content: '👑'; bottom: -10px; right: -6px; }
// 编译时会把 .bubble 换成对应消息的选择器，并给每条声明加上 !important，保证能盖过聊天主题。

// 装饰（::before / ::after）的通用底座：先清掉主题自带的伪元素样式
const DECO = 'display:block; position:absolute; top:auto; bottom:auto; left:auto; right:auto; width:auto; height:auto; background:none; border:0; box-shadow:none; line-height:1; pointer-events:none; z-index:2; filter:none; transform:none; margin:0; padding:0;';

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
    // 天使弥散框：白色弥散光晕 + 十字和光环
    preset('angelglow', '天使弥散框', `
.bubble { position: relative; overflow: visible; background: #ffffff; border: 0; border-radius: 16px; box-shadow: 0 0 6px 3px rgba(255,255,255,.95), 0 3px 12px 2px rgba(255,255,255,.6); color: #4a4f57; }
.bubble::before { ${DECO} content: '✝ ✦'; bottom: -12px; left: 8px; font-size: 13px; letter-spacing: 1px; color: #fff; text-shadow: 0 0 3px rgba(120,120,120,.75), 0 0 6px #fff; }
.bubble::after { ${DECO} content: '° ✝'; bottom: -12px; right: -10px; font-size: 13px; color: #fff; text-shadow: 0 0 3px rgba(120,120,120,.75), 0 0 6px #fff; }
`),

    // 水蓝小海豹：淡蓝弥散光 + 小鱼、泡泡、小海豹
    preset('seal', '水蓝小海豹', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #eef7ff 0%, #d4ebfb 100%); border: 0; border-radius: 16px; box-shadow: 0 0 6px 3px rgba(255,255,255,.95), 0 0 0 1px rgba(255,255,255,.9); color: #3b5f7c; }
.bubble::before { ${DECO} content: '🐟 °'; bottom: -12px; left: 8px; font-size: 12px; color: #a9d4f2; }
.bubble::after { ${DECO} content: '🦭'; bottom: -13px; right: -10px; font-size: 18px; }
`),

    // 灰雾星啵：透明玻璃水泡，带高光和小星星爱心
    preset('glassdrop', '灰雾星啵', `
.bubble { position: relative; overflow: visible; border: 1.5px solid rgba(255,255,255,.85); border-radius: 22px; background: radial-gradient(circle at 16px 9px, rgba(255,255,255,.95) 0 3px, transparent 4px), radial-gradient(circle at 28px 11px, rgba(255,255,255,.8) 0 2px, transparent 3px), linear-gradient(180deg, rgba(255,255,255,.45) 0%, rgba(150,150,155,.28) 100%); box-shadow: inset 0 3px 6px rgba(255,255,255,.85), inset 0 -4px 8px rgba(0,0,0,.18), 0 4px 10px rgba(0,0,0,.18); color: #26282c; }
.bubble::before { ${DECO} content: '♡ ✦'; bottom: -12px; left: 8px; font-size: 11px; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.45); }
.bubble::after { ${DECO} content: '✦ ♡'; bottom: -12px; right: -8px; font-size: 11px; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.45); }
`),

    // 水色薄雾：蓝白磨砂玻璃，白描边和内发光
    preset('mist', '水色薄雾', `
.bubble { background: linear-gradient(180deg, rgba(255,255,255,.72) 0%, rgba(226,236,248,.62) 100%); border: 1.5px solid rgba(255,255,255,.95); border-radius: 16px; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: inset 0 0 10px rgba(255,255,255,.9), 0 4px 12px rgba(120,150,190,.22); color: #6a7b90; }
`),

    // 紫蝴蝶小猫：淡紫弥散光 + 蝴蝶和小猫
    preset('butterflycat', '紫蝴蝶小猫', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #faf7ff 0%, #ece4fb 100%); border: 1.5px solid #ddd0f5; border-radius: 16px; box-shadow: 0 0 8px 3px rgba(255,255,255,.95), 0 0 0 3px rgba(230,220,250,.6); color: #6a5a8c; }
.bubble::before { ${DECO} content: '🦋'; bottom: -12px; left: 8px; font-size: 14px; }
.bubble::after { ${DECO} content: '🐱 ⭐'; bottom: -12px; right: -10px; font-size: 13px; }
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
