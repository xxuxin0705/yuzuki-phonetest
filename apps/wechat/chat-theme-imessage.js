// 📱 iOS26 iMessage 类主题（糯叽机「粉_实 iOS26 iMessage」系列）的柚月原生适配
//
// 这类主题大量依赖糯叽机自己的页面结构（伪元素画气泡、绝对定位顶栏 / 底栏），逐条翻译选择器在柚月里会失效：
// 气泡底色丢失、消息被挤出屏幕、顶栏按钮叠在一起。所以识别到这类主题时，直接按柚月的界面尺寸
// （和内置 微信 / QQ / LINE 一样的尺寸体系）手写一套同款样式，只从主题里读取配色变量。
// 聊天背景不由主题决定，仍然使用聊天里设置的背景图。

const SVG = s => `url("data:image/svg+xml,${s}")`;
const TAIL = SVG("%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 28'%3E%3Cpath d='M2 0L22 0A20 20 0 0 1 12.7 16.9C12 17.7 11.4 18.8 11.6 20.2C11.9 22.5 13.6 24.2 14.2 25.4Q14.4 26.7 13 26.3C9.5 25.2 5.5 22.4 2.4 20.9C1.4 20.4 .8 20 0 20L2 20Z'/%3E%3C/svg%3E");
const VIDEO = SVG("%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M4 18h9a2 2 0 002-2V8a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2z'/%3E%3C/svg%3E");
const BACK = SVG("%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 5l-7 7 7 7'/%3E%3C/svg%3E");
const LOCK = SVG("%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -2 12 18' width='8' height='12' fill='%233c3c43' fill-opacity='.6'%3E%3Cpath d='M3 6V4a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 11 7.5v6A1.5 1.5 0 0 1 9.5 15h-7A1.5 1.5 0 0 1 1 13.5v-6A1.5 1.5 0 0 1 2.5 6zm1.5 0h3V4a1.5 1.5 0 0 0-3 0z'/%3E%3C/svg%3E");

// 白字黑描边（16 个方向，够平滑又不会太重）
const OUTLINE = (() => {
    const out = [];
    for (let i = 0; i < 16; i++) {
        const a = (Math.PI * 2 * i) / 16;
        out.push(`${(Math.cos(a) * 0.11).toFixed(3)}em ${(Math.sin(a) * 0.11).toFixed(3)}em 0 #000`);
    }
    return out.join(', ');
})();

export function isIMessageTheme(source = '') {
    const s = String(source || '');
    let score = 0;
    if (/iMessage\s*信息/.test(s)) score++;
    if (/--them-rim\s*:/.test(s)) score++;
    if (/--q-shape-them\s*:/.test(s)) score++;
    if (/\.msg-translation-detached\b/.test(s) && /--tr-outline\s*:/.test(s)) score++;
    if (/nuo-typing-bubble/.test(s) && /--r-me-bg/.test(s)) score++;
    return score >= 2;
}

/**
 * @param {string} R 主题根选择器（YZT_ROOT）
 * @param {object} vars 主题里 :root 上的变量（最后一次赋值为准）
 * @param {(v:string)=>string} rewrite 值改写（vw / 安全区）
 */
export function buildIMessageCss(R, vars = {}, rewrite = v => v) {
    // 多一层 ID 权重，压过底座和其它气泡样式
    const I = R.replace('.wechat-app:not(#yzt-none)', '.wechat-app:not(#yzt-none):not(#yzt-im)');
    const MSG = `${I} .chat-message:not(.message-system)`;
    const H = `${I} > .wechat-header`;
    const IA = `${I} .chat-input-area`;
    const v = (name, fallback) => (Object.prototype.hasOwnProperty.call(vars, name) ? `var(${name}, ${fallback})` : fallback);
    const alwaysTrans = String(vars['--translation-always-show'] ?? '1').trim() !== '0';

    const varDecls = Object.entries(vars)
        .filter(([k, val]) => /^--[-\w]+$/.test(k) && String(val).length < 4000 && !/[{}]/.test(String(val)))
        .map(([k, val]) => `${k}: ${rewrite(val)};`).join(' ');

    const themBg = v('--bubble-them-bg', '#e9e9eb');
    const themFg = v('--bubble-them-color', '#000');
    const meBg = v('--bubble-me-bg', '#2c63c8');
    const meFg = v('--bubble-me-color', '#fff');
    const ink = v('--light-ink', '#1c1c1e');
    const inkSoft = v('--light-ink-soft', 'rgba(60, 60, 67, 0.60)');
    const themBadge = v('--r-them-bg', '#e5e5ea');
    const glass = 'rgba(255, 255, 255, 0.55)';
    const glassShadow = 'inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 .6px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.10)';
    const headH = 'calc(var(--yzt-safe-top) + 96px)';

    return `
/* ═══ iOS26 iMessage · 柚月原生适配 ═══ */
${I} { ${varDecls} --yim-head-h: ${headH}; }

/* ── 顶栏：浮在聊天背景上，渐隐毛玻璃 ── */
${H} {
    position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 30 !important;
    height: var(--yim-head-h) !important; padding: 0 !important; display: block !important;
    background: transparent !important; border: 0 !important; box-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important; pointer-events: none !important; overflow: visible !important;
}
${H}::before {
    content: "" !important; display: block !important; position: absolute !important; inset: 0 0 -14px 0 !important; z-index: -1 !important; pointer-events: none !important;
    background: linear-gradient(to bottom, rgba(255,255,255,.86) 0%, rgba(255,255,255,.86) 28%, rgba(255,255,255,.75) 44%, rgba(255,255,255,.52) 60%, rgba(255,255,255,.24) 76%, rgba(255,255,255,.03) 92%, transparent 100%) !important;
    backdrop-filter: blur(22px) saturate(150%) !important; -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 30%, rgba(0,0,0,.76) 52%, rgba(0,0,0,.44) 68%, rgba(0,0,0,.14) 84%, transparent 100%) !important;
    mask-image: linear-gradient(to bottom, #000 0%, #000 30%, rgba(0,0,0,.76) 52%, rgba(0,0,0,.44) 68%, rgba(0,0,0,.14) 84%, transparent 100%) !important;
    border: 0 !important; transform: none !important;
}
${H}::after { content: none !important; }
${H} :is(.wechat-header-left, .wechat-header-right, .wechat-header-title) { position: static !important; display: block !important; width: auto !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; background: none !important; }
${H} :is(.wechat-back-btn, .wechat-header-btn, .wx-head-avatar, .wechat-header-title-text) { pointer-events: auto !important; }
/* 圆形毛玻璃按钮 */
${H} :is(.wechat-back-btn, #chat-info) {
    position: absolute !important; top: calc(var(--yzt-safe-top) + 8px) !important; z-index: 3 !important;
    width: 38px !important; height: 38px !important; min-width: 38px !important; min-height: 38px !important; padding: 0 !important; margin: 0 !important;
    border-radius: 50% !important; border: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;
    background: ${glass} !important; box-shadow: ${glassShadow} !important; color: ${ink} !important;
    backdrop-filter: blur(6px) saturate(140%) !important; -webkit-backdrop-filter: blur(6px) saturate(140%) !important;
    visibility: visible !important; opacity: 1 !important; transform: none !important; cursor: pointer !important;
}
${H} .wechat-back-btn { left: 12px !important; right: auto !important; }
${H} #chat-info { right: 12px !important; left: auto !important; }
${H} :is(.wechat-back-btn, #chat-info) > * { display: none !important; }
${H} :is(.wechat-back-btn, #chat-info)::before {
    content: "" !important; display: block !important; position: static !important; width: 24px !important; height: 24px !important;
    background: ${ink} !important; border: 0 !important; transform: none !important;
}
${H} .wechat-back-btn::before { -webkit-mask: ${BACK} no-repeat center / contain !important; mask: ${BACK} no-repeat center / contain !important; }
${H} #chat-info::before { width: 23px !important; height: 23px !important; -webkit-mask: ${VIDEO} no-repeat center / contain !important; mask: ${VIDEO} no-repeat center / contain !important; }
${H} :is(.wechat-back-btn, #chat-info)::after { content: none !important; }
${H} :is(.wechat-back-btn, #chat-info):active { transform: scale(.92) !important; }
${H} .wechat-header-right > :not(#chat-info) { display: none !important; }
/* 中间：大头像 + 名字胶囊 */
${H} .wx-head-avatar {
    position: absolute !important; left: 50% !important; top: calc(var(--yzt-safe-top) + 2px) !important; transform: translateX(-50%) !important;
    width: 54px !important; height: 54px !important; min-width: 54px !important; flex: none !important; margin: 0 !important; border-radius: 50% !important;
    overflow: hidden !important; display: block !important; box-shadow: 0 2px 8px rgba(0,0,0,.22) !important; border: 0 !important; z-index: 1 !important;
}
${H} .wx-head-avatar > *, ${H} .wx-head-avatar img { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 50% !important; }
${H} .wechat-header-title-text {
    position: absolute !important; left: 50% !important; top: calc(var(--yzt-safe-top) + 48px) !important; transform: translateX(-50%) !important; z-index: 2 !important;
    display: inline-flex !important; align-items: center !important; gap: 0 !important; max-width: calc(100% - 130px) !important; width: auto !important;
    padding: 5px 12px 5px 14px !important; margin: 0 !important; border-radius: 999px !important; box-sizing: border-box !important;
    background: ${glass} !important; box-shadow: ${glassShadow} !important; color: ${ink} !important;
    backdrop-filter: blur(6px) saturate(140%) !important; -webkit-backdrop-filter: blur(6px) saturate(140%) !important;
    font-size: 14.5px !important; font-weight: 700 !important; letter-spacing: -.3px !important; line-height: 1.15 !important;
    white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; text-shadow: none !important; cursor: pointer !important;
}
${H} .wechat-header-title-text::after {
    content: "" !important; flex: none !important; display: inline-block !important; width: 6px !important; height: 6px !important; margin-left: 7px !important;
    border-top: 2px solid ${inkSoft} !important; border-right: 2px solid ${inkSoft} !important; transform: rotate(45deg) !important; border-radius: .6px !important;
}
${H} :is(.wx-head-sub, .status-dot, .header-badge) { display: none !important; }

/* ── 消息区 ── */
${I} > .wechat-content { position: relative !important; }
${I} .chat-messages { padding: calc(var(--yim-head-h) + 10px) 14px 10px !important; }
${MSG} { margin-bottom: 12px !important; gap: 0 !important; }
${MSG}:is(.yzt-first, .yzt-mid) { margin-bottom: 3px !important; }
${MSG} > .message-avatar, ${MSG} .yzf-frame { display: none !important; }
${MSG} > .message-content { max-width: 76% !important; margin: 0 !important; }
${MSG} .message-sender { color: ${inkSoft} !important; font-size: 11.5px !important; margin: 0 0 3px 12px !important; }
${MSG}.message-right .message-sender { margin: 0 12px 3px 0 !important; }
/* 群聊名字行浮在气泡上方、不占内容区：这样表情回应量的是气泡自己的上角，不会被名字行顶到上一条消息底下 */
${MSG}:has(> .message-content > .message-sender) { padding-top: 19px !important; }
${MSG} > .message-content > .message-sender {
    position: absolute !important; bottom: 100% !important; top: auto !important; left: 0 !important; right: auto !important;
    white-space: nowrap !important; z-index: 1 !important;
}
${MSG}.message-right > .message-content > .message-sender { left: auto !important; right: 0 !important; justify-content: flex-end !important; }
${MSG}:has(.wechat-reaction-row) { padding-top: 24px !important; }
/* 既有名字又有表情回应：名字让到回应泡泡上面，不叠在一起 */
${MSG}:has(> .message-content > .message-sender):has(.wechat-reaction-row) { padding-top: 42px !important; }
${MSG}:has(.wechat-reaction-row) > .message-content > .message-sender { bottom: calc(100% + 24px) !important; }
/* 气泡 */
${MSG} .message-text {
    position: relative !important; overflow: visible !important; isolation: isolate;
    border-radius: 20px !important; padding: 8px 13px !important; font-size: 15.5px !important; line-height: 1.32 !important;
    background: ${themBg} !important; color: ${themFg} !important; border: 0 !important; box-shadow: none !important; text-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important; word-break: break-word !important; min-height: 0 !important;
}
${MSG}.message-right .message-text { background: ${meBg} !important; color: ${meFg} !important; }
${MSG} .message-text a { color: inherit !important; text-decoration: underline !important; }
/* iOS 尾巴：只画在一组消息的最后一条 */
${MSG}:is(.yzt-last, .yzt-single) .message-text::after {
    content: "" !important; position: absolute !important; display: block !important; top: auto !important; bottom: -8px !important;
    width: 22px !important; height: 28px !important; z-index: -1 !important; pointer-events: none !important;
    background: ${themBg} !important; -webkit-mask: ${TAIL} no-repeat 0 0 / 100% 100% !important; mask: ${TAIL} no-repeat 0 0 / 100% 100% !important;
    left: 0 !important; right: auto !important; transform: scaleX(-1) !important; opacity: 1 !important;
}
${MSG}.message-right:is(.yzt-last, .yzt-single) .message-text::after { background: ${meBg} !important; left: auto !important; right: 0 !important; transform: none !important; }
${MSG}:is(.yzt-last, .yzt-single):not(:has(.yzt-trans-detached)) > .message-content { padding-bottom: 2px !important; }
/* 翻译：白字黑描边，压在气泡下沿 */
${MSG} .message-text .wechat-trans-fold { ${alwaysTrans ? 'display: none !important;' : 'border-top: 0 !important; margin-top: 2px !important; padding: 0 !important;'} }
${alwaysTrans ? '' : `${MSG} .message-text .wechat-trans-fold-body { display: none !important; }
${MSG} .message-text .wechat-trans-fold-btn { font-size: 11px !important; opacity: .55 !important; padding: 0 !important; background: none !important; border: 0 !important; color: inherit !important; }`}
${MSG} > .message-content > .yzt-trans-detached {
    ${alwaysTrans ? 'display: block !important;' : ''} position: relative !important; z-index: 6 !important; margin: -8px 0 0 0 !important; pointer-events: none !important;
    color: #fff !important; background: none !important;
}
${alwaysTrans ? '' : `html[data-yzt-theme] :is(#phone-panel-content, body) .wechat-app:not(#yzt-none):not(#yzt-im):has(.chat-room) .chat-message:not(.message-system) > .message-content:has(.wechat-trans-fold.expanded) > .yzt-trans-detached.yzt-trans-detached { display: block !important; }`}
${MSG} > .message-content > .yzt-trans-detached > .yzt-trans-detached-content {
    padding: 0 0 0 14px !important; background: none !important; border: 0 !important; box-shadow: none !important;
    color: #fff !important; font-size: 12px !important; font-weight: 800 !important; line-height: 1.3 !important; letter-spacing: .2px !important;
    text-shadow: ${OUTLINE} !important; opacity: 1 !important; text-align: left !important;
}
${MSG}.message-right > .message-content > .yzt-trans-detached > .yzt-trans-detached-content { padding: 0 14px 0 0 !important; text-align: right !important; }
/* 表情回应：气泡上角的「思考泡泡」 */
${MSG} > .message-content > .wechat-reaction-row {
    position: absolute !important; top: -25px !important; bottom: auto !important; z-index: 7 !important; margin: 0 !important;
    display: inline-flex !important; align-items: center !important; gap: 2px !important; flex-wrap: nowrap !important;
    height: 32px !important; min-width: 32px !important; padding: 0 6px !important; box-sizing: border-box !important; border-radius: 999px !important;
    background: var(--yim-r-bg) !important; box-shadow: none !important; border: 0 !important; width: auto !important;
}
${MSG}.message-left > .message-content > .wechat-reaction-row { --yim-r-bg: ${meBg}; right: -14px !important; left: auto !important; }
${MSG}.message-right > .message-content > .wechat-reaction-row { --yim-r-bg: ${themBadge}; left: -14px !important; right: auto !important; }
${MSG} > .message-content > .wechat-reaction-row::before, ${MSG} > .message-content > .wechat-reaction-row::after {
    content: "" !important; position: absolute !important; border-radius: 50% !important; background: var(--yim-r-bg) !important; pointer-events: none !important;
}
${MSG} > .message-content > .wechat-reaction-row::before { width: 9px !important; height: 9px !important; top: 27px !important; }
${MSG} > .message-content > .wechat-reaction-row::after { width: 5px !important; height: 5px !important; top: 37px !important; }
${MSG}.message-left > .message-content > .wechat-reaction-row::before { right: 2px !important; }
${MSG}.message-left > .message-content > .wechat-reaction-row::after { right: -3px !important; }
${MSG}.message-right > .message-content > .wechat-reaction-row::before { left: 2px !important; }
${MSG}.message-right > .message-content > .wechat-reaction-row::after { left: -3px !important; }
${MSG} .wechat-reaction-pill {
    background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 1px !important; margin: 0 !important;
    min-width: 0 !important; height: auto !important; display: inline-flex !important; align-items: center !important; cursor: pointer !important;
}
${MSG} .wechat-reaction-pill .wechat-reaction-emoji { font-size: 16px !important; line-height: 1 !important; }
${MSG} .wechat-reaction-pill .wechat-reaction-by { display: none !important; }
/* 引用：像 iOS 一样，被引用的那句缩小显示在气泡上方，用一条弧线连到气泡 */
${MSG}:has(> .message-content > .wechat-quote-block) { margin-top: 8px !important; }
${MSG} > .message-content > .wechat-quote-block {
    order: -1 !important; position: relative !important; display: block !important; box-sizing: border-box !important;
    margin: 0 0 6px 0 !important; max-width: 100% !important; width: auto !important; padding: 6px 12px !important; border-radius: 16px !important; border: 0 !important;
    background: ${themBg} !important; color: ${themFg} !important; opacity: .62 !important; font-size: 13px !important; line-height: 1.3 !important;
    box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
}
${MSG}.message-left > .message-content > .wechat-quote-block { margin-left: 22px !important; }
${MSG}.message-right > .message-content > .wechat-quote-block { margin-right: 22px !important; }
${MSG} > .message-content > .wechat-quote-block::before {
    content: "" !important; position: absolute !important; top: 50% !important; width: 14px !important; height: calc(50% + 8px) !important;
    border: 2px solid ${inkSoft} !important; pointer-events: none !important; opacity: .7 !important; background: none !important;
}
${MSG}.message-left > .message-content > .wechat-quote-block::before { left: -16px !important; border-right: 0 !important; border-bottom: 0 !important; border-top-left-radius: 12px !important; }
${MSG}.message-right > .message-content > .wechat-quote-block::before { right: -16px !important; border-left: 0 !important; border-bottom: 0 !important; border-top-right-radius: 12px !important; }
${MSG} > .message-content > .wechat-quote-block .wechat-quote-inner {
    display: block !important; background: none !important; border: 0 !important; padding: 0 !important; margin: 0 !important;
    white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; max-width: 100% !important;
}
${MSG} > .message-content > .wechat-quote-block :is(.wechat-quote-sender, .wechat-quote-text) { color: inherit !important; font-size: inherit !important; display: inline !important; }
${MSG} > .message-content > .wechat-quote-block .wechat-quote-sender { font-weight: 600 !important; }
${MSG} > .message-content > .wechat-quote-block .wechat-quote-sender::after { content: "：" !important; }
/* 图片 / 表情包 */
${MSG} .message-image-box { border-radius: 18px !important; overflow: hidden !important; box-shadow: 0 0 0 1px rgba(0,0,0,.08) !important; }
${MSG} .message-image-box :is(img, .message-image) { border-radius: 18px !important; }
${MSG} .message-sticker-box { background: transparent !important; box-shadow: none !important; }
/* 时间：iMessage 信息 · 已加密 */
${I} .message-time-divider { margin: 10px 0 8px !important; }
${I} .time-divider-text {
    display: block !important; background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important;
    color: ${inkSoft} !important; font-size: 11.5px !important; font-weight: 500 !important; text-align: center !important; line-height: 1.5 !important; text-shadow: none !important;
}
${I} .time-divider-text::before {
    content: "iMessage 信息\\A" ${LOCK} " 已加密\\A" !important; white-space: pre-wrap !important; display: block !important;
    font-size: 11px !important; line-height: 1.55 !important; color: ${inkSoft} !important; margin-bottom: 6px !important;
}
${I} .system-message-bubble { background: transparent !important; color: ${inkSoft} !important; font-size: 12px !important; box-shadow: none !important; }

/* ── 输入栏：浮在背景上的玻璃胶囊 ── */
${IA} { background: transparent !important; border-top: 0 !important; box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; isolation: isolate; }
${IA}::before {
    content: "" !important; position: absolute !important; inset: -16px 0 0 0 !important; z-index: -1 !important; pointer-events: none !important;
    background: linear-gradient(to top, rgba(255,255,255,.55) 0%, rgba(255,255,255,.32) 35%, rgba(255,255,255,.12) 65%, transparent 100%) !important;
    backdrop-filter: blur(8px) saturate(120%) !important; -webkit-backdrop-filter: blur(8px) saturate(120%) !important;
    -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.6) 35%, rgba(0,0,0,.2) 65%, transparent 90%) !important;
    mask-image: linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.6) 35%, rgba(0,0,0,.2) 65%, transparent 90%) !important;
}
${IA} .chat-input-bar { padding: 8px 10px 10px !important; gap: 6px !important; }
${IA} .chat-input-bar .input-btn { color: ${ink} !important; width: 30px !important; height: 30px !important; min-width: 28px !important; }
${IA} .yzt-btns-left .input-btn {
    width: 34px !important; height: 34px !important; border-radius: 50% !important; background: ${glass} !important; box-shadow: ${glassShadow} !important;
    backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; margin-right: 4px !important;
}
${IA} .yzt-btns-left .input-btn > svg { width: 18px !important; height: 18px !important; }
${IA} .yzt-action-bar {
    position: relative !important; min-height: 36px !important; padding: 2px 4px 2px 14px !important; border-radius: 999px !important;
    background: rgba(255,255,255,.35) !important; border: 1px solid rgba(0,0,0,.08) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,.08), inset 0 1.2px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(0,0,0,.06) !important;
    backdrop-filter: blur(10px) saturate(130%) !important; -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
}
${IA} .chat-input-wrapper { position: relative !important; }
${IA} #chat-input { color: ${ink} !important; caret-color: #2c63c8 !important; font-size: 15px !important; padding: 6px 0 !important; line-height: 22px !important; }
${IA} #chat-input::placeholder { color: transparent !important; }
${IA} .chat-input-wrapper:has(#chat-input:placeholder-shown)::before {
    content: "iMessage 信息" !important; position: absolute !important; left: 0 !important; top: 50% !important; transform: translateY(-50%) !important;
    font-size: 15px !important; color: rgba(60,60,67,.45) !important; letter-spacing: -.2px !important; pointer-events: none !important; white-space: nowrap !important;
}
${IA} #send-now-btn .wx-send-label { display: none !important; }
${IA} #send-now-btn.has-text:not([data-mode="stop"]) { background: ${meBg} !important; color: ${meFg} !important; border-radius: 50% !important; }
${IA} #send-now-btn[data-mode="stop"] { color: #ff3b30 !important; }
`;
}
