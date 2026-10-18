/**
 * 糯叽机 -> 柚月聊天页 CSS 适配器。
 * 只作用于当前 .wechat-app.yz-chat-theme-active；不读取/修改聊天数据，也不改按钮事件。
 * 导入素材版权仍归原 CSS 作者所有，本模块不附带他人的主题文件。
 */
export const YZ_CHAT_THEME_BUILTINS = Object.freeze([
  { id: 'wechat', name: '微信', desc: '经典绿白消息气泡' },
  { id: 'qq', name: 'QQ', desc: '蓝白圆角聊天风格' },
  { id: 'line', name: 'LINE', desc: '柔和的 LINE 聊天风格' }
]);

const ROOT = '#phone-panel-content .phone-screen .wechat-app.yz-chat-theme-active';
const CHAT = `${ROOT} .chat-room`;

// 同一张对应表服务单聊、群聊。未找到对应 DOM 的装饰会被保留在作用域内，但不能凭 CSS 生成业务控件。
const MAP = [
  ['chat-detail-screen', '.wechat-app.yz-chat-theme-active'],
  ['chat-messages-area', '.chat-messages'],
  ['chat-message-list-custom', '.chat-messages'],
  ['chat-header-custom', '.wechat-header'],
  ['glass-header', '.wechat-header'],
  ['header-profile-section', '.wechat-header-title'],
  ['header-avatar-container', '.wx-head-avatar'],
  ['chat-header-avatar', '.wx-head-avatar img'],
  ['chat-header-title', '.wechat-header-title-text'],
  ['chat-header-subtitle', '.wx-head-sub'],
  ['chat-header-icon', '.wechat-header-btn'],
  ['header-btn-back', '.wechat-back-btn'],
  ['header-action-btn', '.wechat-header-btn'],
  ['header-btn-info', '#chat-info'],
  ['header-btn-video', '#yz-chat-video-action'],
  ['header-btn-phone', '#yz-chat-call-action'],
  ['bubble-me-custom', '.message-right .message-text'],
  ['bubble-them-custom', '.message-left .message-text'],
  ['msg-bubble-wrapper', '.chat-message'],
  ['msg-me', '.message-right'],
  ['msg-them', '.message-left'],
  ['msg-content-stack', '.message-content'],
  ['msg-avatar-them-container', '.message-left .message-avatar'],
  ['msg-avatar-me-container', '.message-right .message-avatar'],
  ['msg-avatar-container', '.message-left .message-avatar'],
  ['msg-avatar-them-inner', '.message-left .message-avatar'],
  ['msg-avatar-me-inner', '.message-right .message-avatar'],
  ['msg-avatar-custom', '.message-avatar img'],
  ['msg-plain', '.message-text'],
  ['msg-plain-me', '.message-right .message-text'],
  ['msg-plain-them', '.message-left .message-text'],
  ['msg-translation-wrapper', '.wechat-trans-fold'],
  ['msg-translation-content', '.wechat-trans-fold-body'],
  ['msg-translation-btn', '.wechat-trans-fold-btn'],
  ['msg-translation-detached', '.wechat-trans-fold'],
  ['msg-translation-detached-content', '.wechat-trans-fold-body'],
  ['msg-reply-block', '.wechat-quote-block'],
  ['msg-reply-block-detached', '.wechat-quote-block'],
  ['msg-reply-detached-me', '.message-right .wechat-quote-block'],
  ['msg-reply-detached-them', '.message-left .wechat-quote-block'],
  ['msg-reply-detached-text', '.wechat-quote-text'],
  ['msg-reply-detached-name', '.wechat-quote-sender'],
  ['msg-reply-block-name', '.wechat-quote-sender'],
  ['msg-reply-block-text', '.wechat-quote-text'],
  ['input-area-custom', '.chat-input-area'],
  ['input-row-wrapper', '.chat-input-bar'],
  ['input-action-bar-custom', '.chat-input-wrapper'],
  ['input-box-custom', '.chat-input'],
  ['input-btn-plus', '#send-btn'],
  ['input-btn-sticker', '#emoji-btn'],
  ['input-btn-ai', '#quick-reply-btn'],
  ['input-btn-mic', '#regenerate-btn'],
  ['input-btns-right', '.chat-input-bar > div:last-child'],
  ['send-btn-custom', '#send-now-btn'],
  ['stop-btn-custom', '#send-now-btn[data-mode="stop"]'],
  ['input-reply-preview-bar', '.active-quote-bar'],
  ['timestamp-custom', '.time-divider-text'],
  ['date-divider-custom', '.time-divider-text'],
  ['msg-system', '.system-message-bubble'],
  ['msg-narration-custom', '.message-narration'],
  ['msg-status-custom', '.message-time'],
  ['msg-wa-meta', '.message-time'],
  ['msg-wa-time', '.message-time'],
  ['msg-wa-checks', '.message-time'],
  ['voice-msg', '.message-voice'],
  ['voice-waveform-bar', '.wechat-voice-waveform-bar'],
  ['voice-transcription', '.wechat-voice-transcript'],
  ['voice-transcription-toggle', '.wechat-voice-transcript-toggle'],
  ['msg-transfer-card', '.message-transfer'],
  ['msg-transfer-container', '.message-transfer'],
  ['msg-transfer-wrapper', '.message-transfer'],
  ['msg-transfer-amount', '.message-transfer .rp-title'],
  ['msg-transfer-label', '.message-transfer .rp-title'],
  ['msg-transfer-subtitle', '.message-transfer .rp-subtitle'],
  ['msg-redpacket-card', '.message-redpacket'],
  ['msg-call-card', '.message-call-record'],
  ['msg-videocall-card', '.message-call-record'],
  ['msg-image-wrapper', '.message-image-box'],
  ['msg-image-card', '.message-image-box'],
  ['msg-video-card', '.message-video-box'],
  ['msg-loc-card', '.message-location'],
  ['msg-music-card', '.message-music-card'],
  ['msg-sim-card', '.message-sim-card'],
  ['grp-sender-row', '.message-sender'],
  ['grp-sender-row-me', '.message-sender.is-me'],
  ['grp-sender-row-them', '.message-left .message-sender'],
  ['grp-sender-name', '.message-sender-name'],
  ['grp-title-badge', '.wechat-sender-chip'],
  ['grp-title-inner', '.wechat-sender-chip'],
  ['grp-title-text', '.wechat-sender-chip'],
  ['grp-pinned-banner', '.wechat-group-announcement'],
  ['msg-reaction-badge', '.wechat-reaction-pill'],
  ['msg-reaction-badge-me', '.message-right .wechat-reaction-pill'],
  ['msg-reaction-badge-them', '.message-left .wechat-reaction-pill'],
  ['msg-reaction-emoji', '.wechat-reaction-emoji'],
  ['msg-thought-wrapper', '.wechat-inner-os-wrapper'],
  ['msg-thought-cloud', '.wechat-inner-os-bubble'],
  ['msg-thought-body', '.wechat-inner-os-bubble']
].sort((a, b) => b[0].length - a[0].length);

// 所有按钮都是真实 DOM，不会把音量、发送、更多、表情或返回变成不可点的透明热区。
const SAFETY = `
${ROOT} > .wechat-header {position:relative !important; flex-shrink:0 !important; max-width:100% !important; box-sizing:border-box !important; z-index:30 !important;}
${ROOT} .chat-room { min-width:0 !important; overflow:hidden !important; }
${CHAT} .chat-messages {min-height:0 !important; overflow-y:auto !important; overscroll-behavior:contain;}
${CHAT} .chat-message {min-width:0 !important;}
${CHAT} .message-content {min-width:0 !important; overflow-wrap:anywhere;}
${CHAT} .message-text {box-sizing:border-box !important; overflow-wrap:anywhere;}
${CHAT} .chat-input-area {position:relative !important; flex-shrink:0 !important; max-width:100% !important; z-index:35 !important; overflow:visible !important;}
${CHAT} .chat-input-bar {display:flex !important; align-items:center !important; width:100% !important; min-height:46px !important; box-sizing:border-box !important; transform:none !important;}
${CHAT} .chat-input-bar > div {min-width:0;flex-shrink:0;}
${CHAT} .chat-input-bar > .chat-input-wrapper {flex:1 1 auto !important; min-width:38px !important;}
${CHAT} .chat-input {min-width:0 !important; width:100% !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important;}
${CHAT} .chat-input-bar .input-btn, ${CHAT} .chat-input-bar .wx-send-now,
${ROOT} > .wechat-header button {display:inline-flex !important; align-items:center !important; justify-content:center !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; min-width:28px !important; min-height:32px !important; position:relative !important; inset:auto !important; transform:none !important; flex-shrink:0 !important; z-index:2 !important;}
${CHAT} .chat-input-bar .input-btn svg, ${CHAT} .chat-input-bar .wx-send-now svg,
${ROOT} > .wechat-header button svg, ${ROOT} > .wechat-header button i {display:block !important; opacity:1 !important; visibility:visible !important; max-width:24px !important; max-height:24px !important;}
${CHAT} .chat-input-bar :is(#send-btn,#emoji-btn,#quick-reply-btn,#regenerate-btn,#send-now-btn) {
  display:inline-flex !important; position:relative !important; inset:auto !important; transform:none !important;
  opacity:1 !important; visibility:visible !important; pointer-events:auto !important; flex-shrink:0 !important;
}
${CHAT} .chat-input-bar :is(#send-btn,#emoji-btn,#quick-reply-btn,#regenerate-btn,#send-now-btn) svg,
${ROOT} > .wechat-header :is(#chat-info,#wechat-back) :is(svg,i) {
  display:block !important; opacity:1 !important; visibility:visible !important;
}
${CHAT} .chat-input-bar .input-btn::after, ${ROOT} > .wechat-header button::after {pointer-events:none !important;}
${ROOT} > .wechat-header .wechat-header-right {display:flex !important; align-items:center !important; gap:3px !important; flex-shrink:0 !important;}
${ROOT} > .wechat-header .wechat-header-left {display:flex !important; align-items:center !important; flex-shrink:0 !important;}
${ROOT} > .wechat-header .wechat-header-title {min-width:0 !important; flex:1 1 auto !important;}
${ROOT} > .wechat-header .wechat-header-title-text {max-width:100% !important; overflow-wrap:anywhere !important;}
${CHAT} .chat-input-bar #send-now-btn {font-size:12px !important;}
`;

const VARIABLE_BRIDGE = `
${ROOT} > .wechat-header {
  background-color:var(--chat-header-bg,var(--wx-head-bg,#f2f2f2)) !important;
  color:var(--chat-header-title-color,var(--wx-head-fg,#222)) !important;
  border-color:var(--chat-header-border,transparent) !important;
  min-height:var(--chat-header-height,48px) !important;
}
${ROOT} > .wechat-header .wechat-header-title-text { color:var(--chat-header-title-color,var(--wx-head-fg,#222)) !important; }
${CHAT} .chat-messages {
  background-color:var(--chat-bg-color,transparent) !important;
  background-image:var(--chat-bg-image,none) !important;
  background-size:cover;
  background-position:center;
}
${ROOT} > .wechat-content { background:transparent !important; }
${CHAT} .chat-input-area {background:var(--input-area-bg,var(--wx-bar-bg,#fff)) !important;min-height:var(--input-area-min-height,48px) !important;}
${CHAT} .chat-input {background:var(--input-box-bg,var(--wx-input-bg,#fff)) !important;color:var(--input-box-color,var(--wx-input-fg,#222)) !important;border-color:var(--input-box-border,var(--wx-input-border,transparent)) !important;border-radius:var(--input-box-radius,var(--wx-input-radius,8px)) !important;}
${CHAT} .time-divider-text {color:var(--timestamp-color,var(--wx-time-fg,#999)) !important;}
${CHAT} .message-left .message-text {
  color:var(--bubble-them-color,var(--wx-in-fg,#242424)) !important;
  background:var(--bubble-them-bg,var(--wa-bubble-them,var(--wx-in-bg,#fff))) !important;
  border-radius:var(--bubble-them-radius,var(--wx-radius,7px)) !important;
  box-shadow:var(--bubble-them-shadow,none) !important;
  padding:var(--bubble-them-padding,7px 10px) !important;
}
${CHAT} .message-right .message-text {
  color:var(--bubble-me-color,var(--wx-out-fg,#242424)) !important;
  background:var(--bubble-me-bg,var(--wa-bubble-me,var(--wx-out-bg,#dbedd9))) !important;
  border-radius:var(--bubble-me-radius,var(--wx-radius,7px)) !important;
  box-shadow:var(--bubble-me-shadow,none) !important;
  padding:var(--bubble-me-padding,7px 10px) !important;
}
${CHAT} .chat-input::placeholder {color:var(--input-box-placeholder,var(--wx-ph,#999));}
${CHAT} .chat-input {caret-color:var(--input-caret-color,currentColor); box-shadow:var(--input-box-shadow,none) !important;}
${CHAT} .chat-input-bar .input-btn {color:var(--input-btn-color,var(--wx-icon,#444)) !important;}
${CHAT} .chat-input-bar #send-now-btn {color:var(--send-btn-color,var(--wx-icon,#444)) !important;}
${CHAT} .message-sender-name {color:var(--group-sender-name-color,var(--wx-name-fg,#778)) !important;}
${CHAT} .message-image-box {border-radius:var(--image-msg-radius,9px) !important;box-shadow:var(--image-msg-shadow,none) !important;}
`;

const BUILTIN_CSS = `
${ROOT}[data-yz-chat-theme="wechat"] {--wx-head-bg:#ededed;--wx-head-fg:#171717;--wx-page-bg:#ededed;--wx-in-bg:#fff;--wx-in-fg:#191919;--wx-out-bg:#95ec69;--wx-out-fg:#111;--wx-radius:5px;--wx-avatar-radius:5px;--wx-avatar-size:38px;--wx-bar-bg:#f7f7f7;--wx-input-bg:#fff;--wx-input-fg:#161616;--wx-input-border:#ddd;--wx-input-radius:5px;--wx-icon:#262626;--wx-time-fg:#999;}
${ROOT}[data-yz-chat-theme="qq"] {--wx-head-bg:#f1f2f6;--wx-head-fg:#192c3b;--wx-page-bg:#f1f2f6;--wx-in-bg:#fff;--wx-in-fg:#191919;--wx-out-bg:#0099ff;--wx-out-fg:#fff;--wx-radius:13px;--wx-avatar-radius:50%;--wx-avatar-size:40px;--wx-bar-bg:#f6f6f9;--wx-input-bg:#fff;--wx-input-fg:#222;--wx-input-border:#e9e9ee;--wx-input-radius:12px;--wx-icon:#2b2b2b;--wx-time-fg:#9da1af;}
${ROOT}[data-yz-chat-theme="line"] {--wx-head-bg:#f4f0ef;--wx-head-fg:#222;--wx-page-bg:#ebe3e1;--wx-in-bg:#fff;--wx-in-fg:#333;--wx-out-bg:#b3aba8;--wx-out-fg:#2f2a29;--wx-radius:18px;--wx-avatar-radius:50%;--wx-avatar-size:40px;--wx-bar-bg:#fbfafa;--wx-input-bg:#fff;--wx-input-fg:#333;--wx-input-border:#ece6e5;--wx-input-radius:18px;--wx-icon:#222;--wx-time-fg:#9a9292;}
${ROOT}[data-yz-chat-theme="qq"] .chat-room .message-text, ${ROOT}[data-yz-chat-theme="line"] .chat-room .message-text {padding:9px 13px !important;line-height:1.5 !important;}
${ROOT}[data-yz-chat-theme="qq"] .chat-room .chat-message, ${ROOT}[data-yz-chat-theme="line"] .chat-room .chat-message {margin-bottom:13px !important;}
${ROOT}[data-yz-chat-theme="qq"] .chat-room .message-avatar, ${ROOT}[data-yz-chat-theme="line"] .chat-room .message-avatar {overflow:hidden;}
`;

function mapSelector(selector) {
  // 不让糯叽机的根/伪根跳出柚月当前聊天页。
  let result = String(selector || '').trim();
  if (!result || result.includes('@')) return '';
  result = result.replace(/#chat-detail-screen\b/g, '.wechat-app.yz-chat-theme-active');
  result = result.replace(/#chat-message-list-root\b/g, '.chat-messages');
  result = result.replace(/\.grp-title-badge\.is-(owner|admin|member)\b/g, (_, role) => `.wechat-sender-chip.role-${role}`);
  // 连发位置属于消息行，而不是文字气泡；同时去掉重复嵌套的同一方向。
  result = result.replace(/\.bubble-(me|them)-custom\.(first|mid|last|single)\b/g, (_, side, pos) =>
    `${side === 'me' ? '.message-right' : '.message-left'}.yz-${pos} .message-text`);
  const hasOuterMessage = /\.(?:msg-(?:bubble-wrapper|me|them)|message-(?:left|right))\b/.test(result);
  result = result.replace(/\.bubble-(me|them)-custom\b/g, (_, side) =>
    hasOuterMessage ? '.message-text' : `${side === 'me' ? '.message-right' : '.message-left'} .message-text`);
  for (const [from, to] of MAP) {
    if (from === 'bubble-me-custom' || from === 'bubble-them-custom') continue;
    result = result.replace(new RegExp(`\\.${from}(?![\\w-])`, 'g'), to);
  }
  result = result.replace(/\.message-(left|right)\s+\.message-\1\s+\.message-text/g,
     (_, dir) => `.message-${dir} .message-text`);
  result = result.replace(/\.(?:plain-|is-)(first|mid|last|single)\b/g, (_, p) => `.yz-${p}`)
    .replace(/\.first\b/g, '.yz-first').replace(/\.mid\b/g, '.yz-mid')
    .replace(/\.last\b/g, '.yz-last').replace(/\.single\b/g, '.yz-single');
  // 保留通用嵌套选择器，但不把未知命名的选择器应用到其它 app。
  result = result.replace(/:root\b/g, '.wechat-app.yz-chat-theme-active');
  // 原生 CSS 对 html/body 的布局不能带入小手机容器。
  result = result.replace(/\bhtml\b|\bbody\b/g, '.wechat-app.yz-chat-theme-active');
  result = result.replace(/:is\(\s*\.wechat-app\.yz-chat-theme-active\s*,\s*\.wechat-app\.yz-chat-theme-active\s*\)/g, '.wechat-app.yz-chat-theme-active');
  const rootClass = '.wechat-app.yz-chat-theme-active';
  const scoped = result.startsWith(rootClass)
    ? ROOT + result.slice(rootClass.length)
    : `${ROOT} ${result}`;
  return scoped.replace(/\s+/g, ' ').trim();
}

/** 浏览器 CSSOM 正规解析规则/媒体查询；图片 URL、border-image、伪元素原样保留。 */
export function convertNuoChatCss(rawCss) {
  const raw = String(rawCss || '').replace(/^\uFEFF/, '');
  if (!raw.trim()) return { css:'', warnings:['CSS 内容为空'], stats:{ rules:0, selectors:0 } };
  if (raw.length > 1024 * 1024) throw new Error('单份 CSS 不能超过 1MB');
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(raw); }
  catch (error) { throw new Error('CSS 无法解析：' + (error?.message || '请检查语法')); }
  const stats = {rules:0, selectors:0, unmapped: new Set()};
  const warn = [];
  const walk = rules => {
    let output = '';
    for (const rule of Array.from(rules || [])) {
      if (rule.type === 1) { // CSSStyleRule
        const selectors = rule.selectorText.split(/,(?![^()]*\))/g).map(s => mapSelector(s)).filter(Boolean);
        if (!selectors.length) continue;
        stats.rules++; stats.selectors += selectors.length;
        const unknown = rule.selectorText.match(/\.[a-z][a-z0-9_-]*/gi) || [];
        for (const name of unknown) {
          if ((name.startsWith('.msg-') || name.startsWith('.grp-') || name.startsWith('.nuo-')) && !MAP.some(([s]) => '.' + s === name)) stats.unmapped.add(name);
        }
        // 不让原 CSS 通过显示/定位规则破坏功能区及真实按钮；底部统一防护也会覆盖这些规则。
        let body = rule.style.cssText;
        const targetIsHeader = /(?:header-btn-|chat-header-custom|glass-header|header-profile-section|header-avatar-container)/.test(rule.selectorText);
        if (targetIsHeader) body = body.replace(/(?:^|;)\s*position\s*:\s*fixed\s*!important\s*(?=;|$)/gi, ';position:relative !important');
        output += `${selectors.join(',\n')} {${body}}\n`;
      } else if (rule.type === 4 || rule.type === 12) { // @media, @supports
        output += `${rule.conditionText ? `@${rule.type === 4 ? 'media' : 'supports'} ${rule.conditionText}` : ''} {${walk(rule.cssRules)}}\n`;
      } else if (rule.type === 7) { // @keyframes 保留动画
        output += `${rule.cssText}\n`;
      } else if (rule.type === 5) { // @font-face：不载入任意外部字体
        warn.push('已忽略 @font-face 字体下载声明');
      } else if (rule.type === 3) { warn.push('已忽略 @import 外部样式表'); }
    }
    return output;
  };
  const converted = walk(sheet.cssRules);
  if (stats.unmapped.size) warn.push(`有 ${stats.unmapped.size} 个糯叽机专属结构没有柚月同名组件，已保留相应选择器，不保证装饰效果`);
  if (/url\(\s*['"]?https?:/i.test(raw)) warn.push('外链图片需要联网且原图地址仍可访问');
  if (/url\(\s*['"]?(?:\.\.?\/)/i.test(raw)) warn.push('相对路径图片需改成可访问的绝对网址或 data: 地址');
  return {css: converted, warnings:warn, stats:{rules:stats.rules,selectors:stats.selectors,unmapped:[...stats.unmapped].slice(0,28)}};
}

export function buildYzChatThemeCss(theme, raw = '') {
  if (!theme) return '';
  if (theme === 'wechat' || theme === 'qq' || theme === 'line') return BUILTIN_CSS + SAFETY;
  const translated = convertNuoChatCss(raw);
  // 自定义主题不再受历史微信气泡色、边框、头像圆角等预设控制。
  const reset = `${CHAT} .message-text {background:#eee;color:#242424;border:0;border-radius:10px;box-shadow:none;}
${CHAT} .message-left .message-text {background:#fff;}
${CHAT} .message-right .message-text {background:#d9f1d4;}
${CHAT} .message-text::before {content:none;}
${CHAT} .message-avatar {border-radius:10px;}
${CHAT} .chat-messages {background:transparent;}`;
  return reset + '\n' + VARIABLE_BRIDGE + '\n' + translated.css + '\n' + SAFETY;
}
