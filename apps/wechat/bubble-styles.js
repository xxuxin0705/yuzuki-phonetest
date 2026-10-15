// 🫧 聊天气泡样式：内置预设 + 自定义 CSS 编译
//
// 写法：用 .bubble 代表气泡本身，例如
//   .bubble { background: #fff; border-radius: 18px; }
//   .bubble::after { content: '👑'; top: -10px; right: -6px; }
// 编译时会把 .bubble 换成对应消息的选择器，并给每条声明加上 !important，保证能盖过聊天主题。

// 装饰（::before / ::after）的通用底座：先清掉主题自带的伪元素样式
const DECO = 'position:absolute; width:auto; height:auto; background:none; border:0; box-shadow:none; line-height:1; pointer-events:none; z-index:2; filter:none; transform:none; margin:0; padding:0;';

const preset = (id, name, css, previewBg = '') => ({ id, name, css: css.trim(), previewBg });

export const WECHAT_BUBBLE_PRESETS = [
    preset('default', '默认', ''),

    preset('frosted', '磨砂玻璃', `
.bubble { background: rgba(255,255,255,.38); border: 1px solid rgba(255,255,255,.75); border-radius: 14px; -webkit-backdrop-filter: blur(14px) saturate(150%); backdrop-filter: blur(14px) saturate(150%); box-shadow: 0 4px 14px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.8); color: #2b2f36; }
`, '#9a9a9a'),

    preset('meow', '简约喵语', `
.bubble { position: relative; overflow: visible; background: #fff; border-radius: 18px; box-shadow: 0 4px 12px rgba(0,0,0,.12); color: #333; }
.bubble::before { ${DECO} content: ''; top: -9px; right: 14px; width: 30px; height: 12px; background: #fff; clip-path: polygon(0 100%, 18% 0, 40% 100%, 60% 100%, 82% 0, 100% 100%); }
.bubble::after { ${DECO} content: '⭐'; top: -12px; left: -6px; font-size: 13px; }
`, '#9a9a9a'),

    preset('bunny', '晶泡兔兔', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #fff2f5 0%, #ffd9e2 100%); border: 1px solid rgba(255,255,255,.9); border-radius: 18px; box-shadow: inset 0 2px 0 rgba(255,255,255,.9), 0 4px 12px rgba(240,150,170,.25); color: #7a3a4c; }
.bubble::after { ${DECO} content: '🐰'; top: -14px; right: -6px; font-size: 16px; }
`, '#f2f2f2'),

    preset('autumn', '秋日倒影', `
.bubble { position: relative; overflow: visible; background: #fff8dc; border: 2px solid #f0d58f; border-radius: 22px; box-shadow: 0 3px 8px rgba(200,160,60,.18); color: #5e4a1f; }
.bubble::before { ${DECO} content: '🍊'; top: -11px; left: -8px; font-size: 15px; }
.bubble::after { ${DECO} content: '✨'; bottom: -9px; right: -6px; font-size: 14px; }
`, '#eeeeee'),

    preset('neumorph', '微拟态透', `
.bubble { background: #eceef1; border: 0; border-radius: 16px; box-shadow: 6px 6px 12px rgba(160,166,176,.55), -5px -5px 10px rgba(255,255,255,.95); color: #3a3f46; }
`, '#e9ebee'),

    preset('icy', '冰蓝梦', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #ffffff 0%, #e2f0ff 100%); border: 1px solid rgba(255,255,255,.95); border-radius: 20px; box-shadow: inset 0 2px 0 #fff, 0 4px 14px rgba(120,170,230,.28); color: #2b4766; }
.bubble::after { ${DECO} content: '✦'; top: -11px; right: -4px; font-size: 16px; color: #fff; text-shadow: 0 0 6px rgba(140,190,255,.95); }
`, '#e6e6e6'),

    preset('halo', '极简半透明', `
.bubble { background: rgba(255,255,255,.22); border: 2px solid rgba(255,255,255,.95); border-radius: 18px; box-shadow: 0 2px 10px rgba(0,0,0,.12), inset 0 0 12px rgba(255,255,255,.35); color: #22262b; }
`, '#9a9a9a'),

    preset('starlight', '星光', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(240,240,245,.85)); border-radius: 16px; box-shadow: 0 0 14px 4px rgba(255,255,255,.85); color: #30343a; }
.bubble::before { ${DECO} content: '✦'; top: -12px; left: -8px; font-size: 15px; color: #fff; text-shadow: 0 0 6px #fff, 0 0 2px #999; }
.bubble::after { ${DECO} content: '✧'; bottom: -11px; right: -7px; font-size: 15px; color: #fff; text-shadow: 0 0 6px #fff, 0 0 2px #999; }
`, '#9a9a9a'),

    preset('paw', '爪爪粉茸茸', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #fff6f7 0%, #f8dfe3 100%); border: 1px solid rgba(255,255,255,.9); border-radius: 22px; box-shadow: inset 0 2px 0 #fff, 0 5px 14px rgba(200,140,150,.25); color: #6e4650; }
.bubble::after { ${DECO} content: '🐾'; top: -11px; right: -5px; font-size: 14px; }
`, '#e8e8e8'),

    preset('ribbon', '夜缎星笺', `
.bubble { position: relative; overflow: visible; background: #fff; border: 2px solid #1f1f1f; border-radius: 22px; box-shadow: 0 0 0 3px #fff, 0 3px 10px rgba(0,0,0,.18); color: #1f1f1f; }
.bubble::before { ${DECO} content: '🎀'; top: -12px; left: -9px; font-size: 15px; }
.bubble::after { ${DECO} content: '✦'; top: -12px; right: -6px; font-size: 14px; color: #1f1f1f; }
`, '#eeeeee'),

    preset('magician', '伪装嘉宾', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #c7a6ff 0%, #9b6cf2 100%); border: 1px solid rgba(255,255,255,.6); border-radius: 18px; box-shadow: inset 0 2px 0 rgba(255,255,255,.55), 0 5px 14px rgba(140,90,230,.35); color: #fff; }
.bubble::after { ${DECO} content: '🎩'; top: -14px; right: -6px; font-size: 17px; transform: rotate(14deg); }
`, '#9a9a9a'),

    preset('crown', '伪装群主', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #ffc46b 0%, #ff8d1f 100%); border: 1px solid rgba(255,255,255,.55); border-radius: 18px; box-shadow: inset 0 2px 0 rgba(255,255,255,.55), 0 5px 14px rgba(255,140,30,.35); color: #fff; }
.bubble::after { ${DECO} content: '👑'; top: -14px; right: -6px; font-size: 17px; transform: rotate(14deg); }
`, '#f4f4f4'),

    preset('dewdrop', '水色露珠', `
.bubble { background: linear-gradient(180deg, #f7faff 0%, #c9dbff 100%); border: 1px solid rgba(255,255,255,.95); border-radius: 22px; box-shadow: inset 0 3px 0 rgba(255,255,255,.95), inset 0 -3px 8px rgba(120,150,230,.25), 0 5px 14px rgba(110,140,220,.3); color: #26406b; }
`, '#a9a9a9'),

    preset('pinkcat', '粉色猫猫', `
.bubble { position: relative; overflow: visible; background: linear-gradient(180deg, #fff0f4 0%, #fbd7e1 100%); border: 1px solid rgba(255,255,255,.9); border-radius: 18px; box-shadow: inset 0 2px 0 #fff, 0 4px 12px rgba(230,150,175,.25); color: #74424f; }
.bubble::before { ${DECO} content: ''; top: -9px; left: 12px; width: 30px; height: 12px; background: #fff0f4; clip-path: polygon(0 100%, 18% 0, 40% 100%, 60% 100%, 82% 0, 100% 100%); }
.bubble::after { ${DECO} content: '🎀'; top: -10px; right: -6px; font-size: 13px; }
`, '#eeeeee'),

    preset('angel', '天使小翅膀', `
.bubble { position: relative; overflow: visible; background: rgba(255,255,255,.92); border: 1.5px solid #c9d1dc; border-radius: 22px; box-shadow: 0 3px 10px rgba(120,140,170,.15); color: #3a4350; }
.bubble::before { ${DECO} content: '👼'; bottom: -9px; left: -10px; font-size: 14px; }
.bubble::after { ${DECO} content: '✧'; top: -12px; right: -5px; font-size: 15px; color: #9aa6b6; }
`, '#f4f4f4'),

    preset('blackstar', '黑色星闪', `
.bubble { position: relative; overflow: visible; background: #151515; border: 0; border-radius: 16px; box-shadow: 0 0 10px 3px rgba(0,0,0,.35); color: #f5f5f5; }
.bubble::before { ${DECO} content: '★'; top: -11px; left: -8px; font-size: 15px; color: #111; text-shadow: 0 0 2px #fff; }
.bubble::after { ${DECO} content: '✦'; bottom: -10px; right: -7px; font-size: 15px; color: #111; text-shadow: 0 0 2px #fff; }
`, '#eeeeee'),

    preset('fluffy', '简约毛边粉', `
.bubble { background: #ffe3ea; border: 3px solid #fff; border-radius: 16px; box-shadow: 0 0 0 1.5px #f3cfd8, 0 3px 10px rgba(0,0,0,.08); color: #6b3f4b; }
`, '#eeeeee'),

    preset('kaomoji', '颜文字猫猫', `
.bubble { position: relative; overflow: visible; background: #fff; border-radius: 20px; box-shadow: 0 3px 10px rgba(0,0,0,.1); color: #333; margin-bottom: 12px; }
.bubble::after { ${DECO} content: '(=^･ω･^=)'; bottom: -15px; right: 2px; font-size: 10px; color: #888; white-space: nowrap; }
`, '#eeeeee'),

    preset('readmark', '消息已读', `
.bubble { position: relative; overflow: visible; background: #111; border: 0; border-radius: 20px; color: #fff; margin-bottom: 12px; }
.bubble::after { ${DECO} content: '已读'; bottom: -15px; right: 4px; font-size: 10px; color: #9a9a9a; white-space: nowrap; }
`, '#eeeeee'),

    preset('rainy', '简透雨天', `
.bubble { position: relative; overflow: visible; background: rgba(20,24,30,.35); border: 1px solid rgba(255,255,255,.75); border-radius: 18px; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; }
.bubble::before { ${DECO} content: '💧'; top: -11px; left: -6px; font-size: 13px; }
.bubble::after { ${DECO} content: '💧'; bottom: -9px; right: -5px; font-size: 11px; }
`, '#3a3a3a')
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
  position: absolute; top: -10px; right: -6px;
  font-size: 15px;
}
*/`;

export function getBubblePreset(id = '') {
    return WECHAT_BUBBLE_PRESETS.find(p => p.id === id) || null;
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
