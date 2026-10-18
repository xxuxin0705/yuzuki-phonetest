// 🍡 糯叽机兼容底座：让糯叽机的 CSS 变量在柚月的元素上生效
// R / L 是根选择器（带两个 :not(#id) 提高优先级，盖过柚月自带样式）；
// 底座规则尽量只用「根 + 一个 class」，这样导入的美化写同样的选择器时会因为排在后面而赢。

const BTN_KEYS = [
    ['back', '.header-btn-back'], ['phone', '.header-btn-phone'], ['video', '.header-btn-video'], ['info', '.header-btn-info'],
    ['plus', '.input-btn-plus'], ['mic', '.input-btn-mic'], ['sticker', '.input-btn-sticker'], ['ai', '.input-btn-ai'],
    ['send', '.send-btn-custom'], ['stop', '.stop-btn-custom']
];

const ICON_KEYS = [
    ['.header-btn-back', '--back-btn-icon'], ['.header-btn-phone', '--phone-btn-icon'], ['.header-btn-video', '--video-btn-icon'],
    ['.header-btn-info', '--info-btn-icon'], ['.input-btn-plus', '--plus-btn-icon'], ['.input-btn-mic', '--mic-btn-icon'],
    ['.input-btn-sticker', '--sticker-btn-icon'], ['.input-btn-ai', '--ai-btn-icon'], ['.send-btn-custom', '--send-btn-icon'],
    ['.stop-btn-custom', '--stop-btn-icon']
];
export const NJ_ICON_KEYS = ICON_KEYS;

const decoLayer = (sel, n) => `
${sel} { position: absolute; display: block; pointer-events: none; box-sizing: border-box;
  top: var(--nj-item-deco-${n}-top, auto); left: var(--nj-item-deco-${n}-left, auto); right: var(--nj-item-deco-${n}-right, auto); bottom: var(--nj-item-deco-${n}-bottom, auto);
  width: var(--nj-item-deco-${n}-width, auto); height: var(--nj-item-deco-${n}-height, auto);
  background-image: var(--nj-item-deco-${n}-image, none); background-color: var(--nj-item-deco-${n}-bg, transparent);
  background-size: var(--nj-item-deco-${n}-size, contain); background-position: var(--nj-item-deco-${n}-position, center); background-repeat: var(--nj-item-deco-${n}-repeat, no-repeat);
  border-radius: var(--nj-item-deco-${n}-radius, 0); border: var(--nj-item-deco-${n}-border, none); box-shadow: var(--nj-item-deco-${n}-shadow, none);
  opacity: var(--nj-item-deco-${n}-opacity, 1); z-index: var(--nj-item-deco-${n}-z, ${n + 1}); transform: var(--nj-item-deco-${n}-transform, none);
  filter: var(--nj-item-deco-${n}-filter, none); mix-blend-mode: var(--nj-item-deco-${n}-mix-blend, normal);
  animation: var(--nj-item-deco-${n}-animation, none); animation-delay: var(--nj-item-deco-${n}-delay, 0s);
  font-size: var(--nj-item-deco-${n}-font-size, 14px); color: var(--nj-item-deco-${n}-color, inherit); text-align: var(--nj-item-deco-${n}-text-align, center); line-height: 1; }
${sel}::before { content: var(--nj-item-deco-${n}-content, none); }`;

// 内置动画（全局名字，和糯叽机同名）
export const NJ_KEYFRAMES = `
@keyframes nj-item-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes nj-item-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes nj-item-slide-in-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes nj-item-slide-in-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
@keyframes nj-item-pop { 0% { transform: scale(.92); opacity: .4; } 60% { transform: scale(1.03); opacity: 1; } 100% { transform: none; } }
@keyframes nj-item-blur-in { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: none; } }
@keyframes nj-item-unfold { from { opacity: 0; transform: scaleY(.6); transform-origin: top; } to { opacity: 1; transform: none; } }
@keyframes nj-item-flash { 0% { background-color: rgba(255,214,10,.45); } 100% { background-color: transparent; } }
@keyframes nj-item-shake { 0%,100% { transform: none; } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
@keyframes nj-tab-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes nj-tab-slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes nj-tab-zoom-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes nj-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes nj-spin { to { transform: rotate(360deg); } }
@keyframes nj-breathe { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: .8; } }
@keyframes nj-twinkle { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
@keyframes nj-drift { 0%,100% { transform: translateX(0) rotate(0); } 50% { transform: translateX(6px) rotate(6deg); } }
@keyframes nj-shimmer { 0% { filter: brightness(1); } 50% { filter: brightness(1.35); } 100% { filter: brightness(1); } }
@keyframes nuo-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -4px; } }
@keyframes nuo-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes nuo-spin { to { rotate: 360deg; } }
@keyframes nuo-shake { 0%,100% { rotate: 0deg; } 25% { rotate: -8deg; } 75% { rotate: 8deg; } }
@keyframes nuo-unread-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: .6; } }
`;

// 头像框（不开美化也能用）
export const NJ_FRAME_CSS = `
.wechat-app .chat-room .message-avatar.nj-has-frame { overflow: visible !important; position: relative; }
.wechat-app .chat-room .message-avatar.nj-has-frame > :not(.nuo-avatar-frame) { border-radius: inherit; overflow: hidden; }
.wechat-app .chat-room .message-avatar > i.nuo-avatar-frame {
  position: absolute !important; left: 50% !important; top: 50% !important; display: block !important;
  width: calc(var(--nuo-avatar-frame-scale, 1.45) * 100%) !important; height: calc(var(--nuo-avatar-frame-scale, 1.45) * 100%) !important;
  max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important;
  transform: translate(-50%, calc(-50% + var(--nuo-avatar-frame-offset-y, 0px))) !important;
  background-color: transparent !important; background-position: center !important; background-repeat: no-repeat !important; background-size: contain !important;
  box-shadow: none !important; pointer-events: none !important; z-index: 3 !important;
}
`;

export function buildChatBaseCss(R) {
    const btnVars = BTN_KEYS.map(([k, sel]) => `${R} ${sel} { translate: var(--btn-${k}-translate-x, 0) var(--btn-${k}-translate-y, 0); rotate: var(--btn-${k}-rotate, 0deg); scale: var(--btn-${k}-scale, 1); filter: var(--btn-${k}-filter, none); opacity: var(--btn-${k}-opacity, 1); animation: var(--btn-${k}-animation, none); clip-path: var(--btn-${k}-clip-path, none); z-index: var(--btn-${k}-z, auto); }`).join('\n');
    const icons = ICON_KEYS.map(([sel, v]) => `${R} ${sel}:where(.nj-has-icon) { background-image: var(${v}); background-position: center; background-repeat: no-repeat; background-size: 76% auto; }`).join('\n');
    const headerDeco = [1, 2, 3, 4, 5, 6].map(n => `${R} .nuo-chat-header-deco-${n} { position: absolute; pointer-events: none; display: block;
  background-image: var(--chat-header-deco-${n}-image, none); background-size: var(--chat-header-deco-${n}-size, contain); background-position: var(--chat-header-deco-${n}-position, center); background-repeat: var(--chat-header-deco-${n}-repeat, no-repeat);
  width: var(--chat-header-deco-${n}-width, 40px); height: var(--chat-header-deco-${n}-height, 40px);
  top: var(--chat-header-deco-${n}-top, 0); left: var(--chat-header-deco-${n}-left, auto); right: var(--chat-header-deco-${n}-right, auto); bottom: var(--chat-header-deco-${n}-bottom, auto);
  opacity: var(--chat-header-deco-${n}-opacity, 1); z-index: var(--chat-header-deco-${n}-z, ${n}); transform: var(--chat-header-deco-${n}-transform, none); }`).join('\n');

    return `
/* ===== 根 / 背景 ===== */
${R} { --nuo-safe-top: 32px; --nuo-safe-bottom: 0px;
  background: linear-gradient(var(--chat-bg-overlay, transparent), var(--chat-bg-overlay, transparent)), var(--chat-bg-image, none) center / cover no-repeat, var(--chat-bg-color, #f2f2f7); }
${R}::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: var(--nuo-safe-top); background: var(--chat-header-bg, rgba(255,255,255,.9)); z-index: 9; pointer-events: none; }
${R} > .wechat-content { position: relative; }

/* ===== 顶栏 ===== */
${R} .chat-header-custom { margin-top: var(--nuo-safe-top); padding: 0 12px; height: var(--chat-header-height, 56px); min-height: 0; box-sizing: border-box;
  display: flex; align-items: center; justify-content: flex-start; gap: 10px; position: relative; z-index: 10; flex-shrink: 0; overflow: visible;
  background: var(--chat-header-bg-image, none) var(--chat-header-bg-position, center) / var(--chat-header-bg-size, cover) no-repeat, var(--chat-header-bg, rgba(255,255,255,.9));
  -webkit-backdrop-filter: blur(var(--chat-header-blur, 15px)); backdrop-filter: blur(var(--chat-header-blur, 15px));
  border-bottom: 1px solid var(--chat-header-border, #efefef); box-shadow: none; }
${R} .nj-header-left { display: contents; }
${R} .header-profile-section { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto;
  column-gap: 10px; align-items: center; align-content: center; justify-items: start; text-align: left; font-size: inherit; color: inherit; position: static; }
${R} .header-avatar-container { display: flex; grid-row: 1 / span 2; grid-column: 1; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
  width: var(--chat-header-avatar-size, 32px); height: var(--chat-header-avatar-size, 32px); border-radius: var(--chat-header-avatar-radius, 50%);
  border: var(--chat-header-avatar-border, none); box-shadow: var(--chat-header-avatar-shadow, none); background: #eee; font-size: 16px; box-sizing: border-box; }
${R} .chat-header-avatar { width: 100% !important; height: 100% !important; border-radius: inherit; overflow: hidden; }
${R} .chat-header-avatar img { width: 100% !important; height: 100% !important; object-fit: cover; }
${R} .chat-header-title { grid-column: 2; grid-row: 1; align-self: end; display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--chat-header-title-color, #262626); font-size: var(--chat-header-title-size, 16px); font-weight: var(--chat-header-title-weight, 700); line-height: 1.25; text-shadow: none; }
${R} .header-profile-section:not(:has(.chat-header-subtitle)) .chat-header-title { grid-row: 1 / span 2; align-self: center; }
${R} .chat-header-subtitle { display: block; grid-column: 2; grid-row: 2; align-self: start; color: var(--chat-header-subtitle-color, #8e8e8e); font-size: var(--chat-header-subtitle-size, 12px); line-height: 1.25; margin: 0; }
${R} .chat-header-title :where(.status-dot) { display: none; }
${R} .header-profile-section :where(.header-badge) { display: none; }
${R} .nj-header-right { display: flex; align-items: center; justify-content: flex-end; gap: var(--header-btn-gap, 18px); flex: 0 0 auto; width: auto; min-width: 0; position: relative; z-index: 3; }
${R} .header-action-btn { display: inline-flex; align-items: center; justify-content: center; width: var(--header-btn-size, 40px); height: var(--header-btn-size, 40px); min-width: 0; min-height: 0; margin: 0; padding: 0;
  border: 0; background-color: transparent; color: var(--chat-header-icon-color, #262626); font-size: 18px; cursor: pointer; position: relative; flex-shrink: 0; text-shadow: none; }
${R} .header-action-btn svg { width: 22px; height: 22px; }
${R} .header-btn-info .wx-bars-icon { display: none; }
${R} :where(.nj-has-icon) > svg, ${R} :where(.nj-has-icon) > i, ${R} :where(.nj-has-icon) > span:not([class*="unread"]) { opacity: 0; }
${R} .nuo-chat-header-unread-dot { position: absolute; pointer-events: none; display: block;
  top: var(--chat-header-unread-top, 6px); left: var(--chat-header-unread-left, 16px); right: var(--chat-header-unread-right, auto); bottom: var(--chat-header-unread-bottom, auto);
  width: var(--chat-header-unread-size, 8px); height: var(--chat-header-unread-size, 8px); border-radius: var(--chat-header-unread-radius, 50%);
  background: var(--chat-header-unread-bg-image, none) var(--chat-header-unread-bg-position, center) / var(--chat-header-unread-bg-size, cover) no-repeat, var(--chat-header-unread-bg, #ff3b30);
  border: var(--chat-header-unread-border, none); box-shadow: var(--chat-header-unread-shadow, none); outline: var(--chat-header-unread-outline, none);
  transform: var(--chat-header-unread-transform, none); animation: var(--chat-header-unread-animation, none); z-index: var(--chat-header-unread-z, 1); }
${R} .nuo-chat-header-unread-num { position: absolute; pointer-events: none; display: var(--chat-header-unread-num-display, flex); align-items: center; justify-content: center; box-sizing: border-box; white-space: nowrap;
  top: var(--chat-header-unread-num-top, 2px); left: var(--chat-header-unread-num-left, 22px); right: var(--chat-header-unread-num-right, auto); bottom: var(--chat-header-unread-num-bottom, auto);
  min-width: var(--chat-header-unread-num-min-width, 16px); height: var(--chat-header-unread-num-height, 16px); padding: var(--chat-header-unread-num-padding, 0 5px);
  border-radius: var(--chat-header-unread-num-radius, 999px); color: var(--chat-header-unread-num-color, #fff);
  background: var(--chat-header-unread-num-bg-image, none) var(--chat-header-unread-num-bg-position, center) / var(--chat-header-unread-num-bg-size, cover) no-repeat, var(--chat-header-unread-num-bg, #ff3b30);
  font-size: var(--chat-header-unread-num-size, 11px); font-weight: var(--chat-header-unread-num-weight, 600); line-height: var(--chat-header-unread-num-line-height, 1);
  letter-spacing: var(--chat-header-unread-num-letter-spacing, 0); font-family: var(--chat-header-unread-num-font-family, inherit);
  border: var(--chat-header-unread-num-border, none); box-shadow: var(--chat-header-unread-num-shadow, none); outline: var(--chat-header-unread-num-outline, none);
  transform: var(--chat-header-unread-num-transform, none); animation: var(--chat-header-unread-num-animation, none); z-index: var(--chat-header-unread-num-z, 2); }
${headerDeco}

/* ===== 消息区 ===== */
${R} .chat-messages-area { padding: var(--chat-messages-padding, 12px 14px); }
${R} .chat-messages-area::-webkit-scrollbar { width: var(--scrollbar-width, 4px); }
${R} .chat-messages-area::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); }
${R} .chat-messages-area::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(0,0,0,.2)); border-radius: 4px; }
${R} .msg-bubble-wrapper { margin-top: var(--chat-messages-gap, 4px); margin-bottom: 0; align-items: flex-start; }
${R} .msg-bubble-wrapper:where(.is-first, .is-single) { margin-top: var(--nj-group-gap, 14px); }
${R} .msg-bubble-wrapper:where(.has-reactions) { margin-bottom: 6px; }
${R} .msg-avatar-them-container, ${R} .msg-avatar-me-container { width: var(--avatar-size, 40px); height: var(--avatar-size, 40px); border-radius: var(--avatar-radius, 50%);
  border: var(--avatar-border, none); box-shadow: var(--avatar-shadow, none); background: var(--avatar-placeholder-bg, #ccc); flex-shrink: 0; box-sizing: border-box; }
${R} .msg-avatar-them-container { margin: 0 var(--avatar-margin, 8px) 0 0; }
${R} .msg-avatar-me-container { margin: 0 0 0 var(--avatar-margin, 8px); }
${R} .msg-avatar-them-container:where(.is-mid, .is-last) { visibility: var(--nj-avatar-grouped-visibility, visible); }
${R} .msg-avatar-me-container:where(.is-mid, .is-last) { visibility: var(--nj-avatar-grouped-visibility, visible); }
${R} .msg-content-stack { max-width: var(--chat-message-max-width, 75%); }

/* ===== 气泡 ===== */
${R} .bubble-me-custom, ${R} .bubble-them-custom { display: inline-block; position: relative; max-width: 100%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; text-align: left; vertical-align: top; }
${R} .bubble-me-custom { background: var(--bubble-me-bg-gradient, var(--bubble-me-bg, #0095f6)); color: var(--bubble-me-color, #fff);
  font-size: var(--bubble-me-font-size, 15px); line-height: var(--bubble-me-line-height, 1.4); padding: var(--bubble-me-padding, 10px 14px);
  border-radius: var(--bubble-me-radius, 20px); box-shadow: var(--bubble-me-shadow, none); border: var(--bubble-me-border, none);
  text-shadow: var(--bubble-me-text-shadow, none); letter-spacing: var(--bubble-me-letter-spacing, normal);
  -webkit-backdrop-filter: var(--bubble-me-backdrop, none); backdrop-filter: var(--bubble-me-backdrop, none);
  filter: var(--bubble-me-filter, none); opacity: var(--bubble-me-opacity, 1); transform: var(--bubble-me-transform, none);
  min-width: var(--bubble-me-min-width, 0); min-height: var(--bubble-me-min-height, 0); }
${R} .bubble-them-custom { background: var(--bubble-them-bg-gradient, var(--bubble-them-bg, #efefef)); color: var(--bubble-them-color, #262626);
  font-size: var(--bubble-them-font-size, 15px); line-height: var(--bubble-them-line-height, 1.4); padding: var(--bubble-them-padding, 10px 14px);
  border-radius: var(--bubble-them-radius, 20px); box-shadow: var(--bubble-them-shadow, none); border: var(--bubble-them-border, 1px solid #efefef);
  text-shadow: var(--bubble-them-text-shadow, none); letter-spacing: var(--bubble-them-letter-spacing, normal);
  -webkit-backdrop-filter: var(--bubble-them-backdrop, none); backdrop-filter: var(--bubble-them-backdrop, none);
  filter: var(--bubble-them-filter, none); opacity: var(--bubble-them-opacity, 1); transform: var(--bubble-them-transform, none);
  min-width: var(--bubble-them-min-width, 0); min-height: var(--bubble-them-min-height, 0); }
${R} .bubble-me-custom:where(.first) { border-radius: var(--bubble-me-radius-first, var(--bubble-me-radius, 20px)); }
${R} .bubble-me-custom:where(.mid) { border-radius: var(--bubble-me-radius-mid, var(--bubble-me-radius, 20px)); }
${R} .bubble-me-custom:where(.last) { border-radius: var(--bubble-me-radius-last, var(--bubble-me-radius, 20px)); }
${R} .bubble-them-custom:where(.first) { border-radius: var(--bubble-them-radius-first, var(--bubble-them-radius, 20px)); }
${R} .bubble-them-custom:where(.mid) { border-radius: var(--bubble-them-radius-mid, var(--bubble-them-radius, 20px)); }
${R} .bubble-them-custom:where(.last) { border-radius: var(--bubble-them-radius-last, var(--bubble-them-radius, 20px)); }
${R} .bubble-me-custom a { color: var(--bubble-me-link-color, inherit); }
${R} .bubble-them-custom a { color: var(--bubble-them-link-color, inherit); }
/* 文字类气泡：柚月原来的气泡（.message-text）变成透明内层，外观交给糯叽机气泡 */
${R} :where(.nj-bubble-text) .message-text { background: none; padding: 0; margin: 0; border: 0; border-radius: 0; box-shadow: none; color: inherit;
  font-size: inherit; line-height: inherit; min-height: 0; width: auto; max-width: 100%; text-shadow: inherit; letter-spacing: inherit; -webkit-backdrop-filter: none; backdrop-filter: none; }
${R} :where(.nj-bubble-text) .message-text::before { content: none; display: none; }
/* 卡片类消息（转账、图片、表情、各种卡）：气泡本身不画底 */
${R} .bubble-me-custom.nj-bubble-card:not(#nj-c), ${R} .bubble-them-custom.nj-bubble-card:not(#nj-c) {
  background: none; padding: 0; border: 0; box-shadow: none; border-radius: 0; -webkit-backdrop-filter: none; backdrop-filter: none; filter: none; min-width: 0; min-height: 0; }

/* 翻译 */
${R} .msg-translation-wrapper { border-top: var(--translation-separator, 1px dashed rgba(0,0,0,.12)); margin: var(--translation-margin, 6px 0 0); }
${R} .msg-translation-btn { display: var(--translation-btn-display, inline-flex); align-items: center; gap: var(--translation-btn-gap, 4px); color: var(--translation-btn-color, inherit);
  font-size: var(--translation-btn-size, 11px); font-weight: var(--translation-btn-weight, 600); opacity: var(--translation-btn-opacity, .8); padding: var(--translation-btn-padding, 2px 0); }
${R} .msg-translation-content { color: var(--translation-text-color, inherit); font-size: var(--translation-size, .9em); line-height: var(--translation-line-height, 1.4);
  background: var(--translation-bg, transparent); padding: var(--translation-padding, 2px 0 0); border-radius: var(--translation-radius, 0); border: var(--translation-border, none);
  box-shadow: var(--translation-shadow, none); opacity: var(--translation-opacity, 1); text-shadow: var(--translation-text-shadow, none); font-style: var(--translation-font-style, normal); }
${R}:where(.msg-translation-always-show) .msg-translation-content { display: block; }
${R}:where(.msg-translation-always-show) .msg-translation-btn { display: none; }

/* 语音 */
${R} .msg-me .voice-msg { color: var(--voice-me-color, inherit); }
${R} .msg-them .voice-msg { color: var(--voice-them-color, inherit); }
${R} .voice-transcription { color: var(--voice-transcription-color, inherit); background: var(--voice-transcription-bg, transparent); }

/* 图片 */
${R} .msg-me .msg-image-card img { border-radius: var(--image-me-radius, var(--image-msg-radius, 8px)); box-shadow: var(--image-me-shadow, var(--image-msg-shadow, none));
  max-width: var(--image-me-max-width, var(--image-msg-max-width, 220px)); border: var(--image-me-border, var(--image-msg-border, none)); filter: var(--image-me-filter, none); opacity: var(--image-me-opacity, 1); }
${R} .msg-them .msg-image-card img { border-radius: var(--image-them-radius, var(--image-msg-radius, 8px)); box-shadow: var(--image-them-shadow, var(--image-msg-shadow, none));
  max-width: var(--image-them-max-width, var(--image-msg-max-width, 220px)); border: var(--image-them-border, var(--image-msg-border, none)); filter: var(--image-them-filter, none); opacity: var(--image-them-opacity, 1); }

/* 转账卡：美化里写了 --transfer-* 变量时，换成糯叽机的卡片样子；没写就保留柚月原样 */
${R} .msg-transfer-card { --nj-tf-bg: var(--transfer-card-bg, #fff); --nj-tf-radius: var(--transfer-card-radius, 24px); --nj-tf-shadow: var(--transfer-card-shadow, 0 2px 8px rgba(0,0,0,.04));
  --nj-tf-border: var(--transfer-card-border, 1px solid rgba(0,0,0,.08)); --nj-tf-icon: var(--transfer-icon-bg, #1a1a1a); --nj-tf-icon-color: #fff;
  --nj-tf-amount: var(--transfer-amount-color, #111827); --nj-tf-label: #6b7280; --nj-tf-sub: #6b7280; --nj-tf-status: #6b7280; --nj-tf-divider: rgba(0,0,0,.06); }
${R} .msg-me .msg-transfer-card { --nj-tf-bg: var(--transfer-me-card-bg, var(--transfer-card-bg, #fff)); --nj-tf-radius: var(--transfer-me-card-radius, var(--transfer-card-radius, 24px));
  --nj-tf-shadow: var(--transfer-me-card-shadow, var(--transfer-card-shadow, 0 2px 8px rgba(0,0,0,.04))); --nj-tf-border: var(--transfer-me-card-border, var(--transfer-card-border, 1px solid rgba(0,0,0,.08)));
  --nj-tf-icon: var(--transfer-me-icon-bg, var(--transfer-icon-bg, #1a1a1a)); --nj-tf-amount: var(--transfer-me-amount-color, var(--transfer-amount-color, #111827));
  --nj-tf-label: var(--transfer-me-label-color, #6b7280); --nj-tf-sub: var(--transfer-me-subtitle-color, #6b7280); --nj-tf-status: var(--transfer-me-status-color, #6b7280); --nj-tf-divider: var(--transfer-me-divider-color, rgba(0,0,0,.06)); }
${R} .msg-them .msg-transfer-card { --nj-tf-bg: var(--transfer-them-card-bg, var(--transfer-card-bg, #fff)); --nj-tf-radius: var(--transfer-them-card-radius, var(--transfer-card-radius, 24px));
  --nj-tf-shadow: var(--transfer-them-card-shadow, var(--transfer-card-shadow, 0 2px 8px rgba(0,0,0,.04))); --nj-tf-border: var(--transfer-them-card-border, var(--transfer-card-border, 1px solid rgba(0,0,0,.08)));
  --nj-tf-icon: var(--transfer-them-icon-bg, var(--transfer-icon-bg, #1a1a1a)); --nj-tf-amount: var(--transfer-them-amount-color, var(--transfer-amount-color, #111827));
  --nj-tf-label: var(--transfer-them-label-color, #6b7280); --nj-tf-sub: var(--transfer-them-subtitle-color, #6b7280); --nj-tf-status: var(--transfer-them-status-color, #6b7280); --nj-tf-divider: var(--transfer-them-divider-color, rgba(0,0,0,.06)); }
${R} .msg-transfer-card.msg-transfer-success { --nj-tf-bg: var(--transfer-success-card-bg, var(--transfer-card-bg, #fafafa)); --nj-tf-border: var(--transfer-success-card-border, 1px solid rgba(0,0,0,.04));
  --nj-tf-icon: var(--transfer-success-icon-bg, rgba(34,197,94,.1)); --nj-tf-icon-color: var(--transfer-success-icon-color, #22c55e); --nj-tf-label: var(--transfer-success-label-color, #22c55e); }
${R} .msg-transfer-card.msg-transfer-rejected { --nj-tf-label: var(--transfer-rejected-label-color, #9ca3af); }
${R} .msg-transfer-card.msg-transfer-expired-card { --nj-tf-label: var(--transfer-expired-label-color, #9ca3af); }
${R} .nj-tf-themed { background: var(--nj-tf-bg) !important; border-radius: var(--nj-tf-radius) !important; box-shadow: var(--nj-tf-shadow) !important; border: var(--nj-tf-border) !important; width: 200px !important; }
${R} .nj-tf-themed::before { display: none !important; }
${R} :where(.nj-tf-themed) .msg-transfer-amount { color: var(--nj-tf-amount) !important; }
${R} :where(.nj-tf-themed) .msg-transfer-subtitle { color: var(--nj-tf-sub) !important; }
${R} :where(.nj-tf-themed) .msg-transfer-footer { color: var(--nj-tf-label) !important; border-top-color: var(--nj-tf-divider) !important; background: transparent !important; }
${R} :where(.nj-tf-themed) .msg-transfer-icon { background: var(--nj-tf-icon) !important; border-radius: 50% !important; color: var(--nj-tf-icon-color) !important; }
${R} :where(.nj-tf-themed) .msg-transfer-icon svg { fill: var(--nj-tf-icon-color) !important; }

/* 时间 / 系统 / 旁白 */
${R} .msg-time-row { display: flex; justify-content: center; margin: var(--timestamp-margin, 12px 0); }
${R} .timestamp-custom { display: inline-block; color: var(--timestamp-color, #8e8e8e); font-size: var(--timestamp-size, 11px); font-weight: var(--timestamp-weight, 400); padding: 2px 8px; background: transparent; border-radius: 10px; }
${R} .timestamp-custom:where(.date-divider-custom) { color: var(--date-divider-color, var(--timestamp-color, #8e8e8e)); font-size: var(--date-divider-size, 12px); font-weight: var(--date-divider-weight, 600);
  background: var(--date-divider-bg, transparent); border-radius: var(--date-divider-radius, 10px); }
${R} .msg-time-marker-pill { background: var(--time-marker-bg, rgba(0,0,0,.05)); color: var(--time-marker-color, var(--timestamp-color, #8e8e8e)); border-radius: var(--time-marker-radius, 10px); }
${R} .msg-system-row { display: flex; justify-content: center; margin: 10px 0; }
${R} .msg-system { background: var(--system-msg-bg, rgba(0,0,0,.05)); color: var(--system-msg-color, #999); border-radius: var(--system-msg-radius, 10px);
  padding: var(--system-msg-padding, 4px 10px); font-size: var(--system-msg-size, 12px); line-height: 1.5; max-width: 80%; text-align: center; border: var(--system-msg-border, none); }
${R} .msg-narration-custom { color: var(--narration-color, #8e8e8e); font-style: var(--narration-style, italic); }

/* 引用（柚月的引用就是糯叽机的「独立引用条」） */
${R} .msg-reply-block-detached { background: var(--reply-detached-bg, var(--reply-block-bg, rgba(0,0,0,.06))); border-left: var(--reply-detached-border-left, var(--reply-block-border-left, 3px solid rgba(0,0,0,.15)));
  padding: var(--reply-detached-padding, 6px 10px); border-radius: var(--reply-detached-radius, var(--reply-block-radius, 6px)); color: var(--reply-detached-text-color, var(--reply-block-text-color, #4a4a4a)); }
${R} .msg-reply-detached-me { background: var(--reply-me-bg, var(--reply-detached-bg, var(--reply-block-bg, rgba(0,0,0,.06)))); border-left: var(--reply-me-border-left, var(--reply-detached-border-left, var(--reply-block-border-left, 3px solid rgba(0,0,0,.15)))); }
${R} .msg-reply-detached-them { background: var(--reply-them-bg, var(--reply-detached-bg, var(--reply-block-bg, rgba(0,0,0,.06)))); border-left: var(--reply-them-border-left, var(--reply-detached-border-left, var(--reply-block-border-left, 3px solid rgba(0,0,0,.15)))); }
${R} .msg-reply-detached-name { color: var(--reply-detached-name-color, var(--reply-block-name-color, #1f1f1f)); font-weight: var(--reply-detached-name-weight, 600); }
${R} .msg-reply-detached-name::after { content: var(--reply-detached-name-suffix, '：'); font-weight: 400; }
${R} .msg-reply-detached-text { color: var(--reply-detached-text-color, var(--reply-block-text-color, #4a4a4a)); }
${R} .msg-reply-detached-me .msg-reply-detached-name { color: var(--reply-me-name-color, var(--reply-detached-name-color, var(--reply-block-name-color, #1f1f1f))); }
${R} .msg-reply-detached-me .msg-reply-detached-text { color: var(--reply-me-text-color, var(--reply-detached-text-color, var(--reply-block-text-color, #4a4a4a))); }
${R} .msg-reply-detached-them .msg-reply-detached-name { color: var(--reply-them-name-color, var(--reply-detached-name-color, var(--reply-block-name-color, #1f1f1f))); }
${R} .msg-reply-detached-them .msg-reply-detached-text { color: var(--reply-them-text-color, var(--reply-detached-text-color, var(--reply-block-text-color, #4a4a4a))); }

/* ===== 输入区 ===== */
${R} .input-area-custom { background: var(--input-area-bg-image, none) var(--input-area-bg-position, center) / var(--input-area-bg-size, cover) no-repeat, var(--input-area-bg, #fff) !important;
  -webkit-backdrop-filter: blur(var(--input-area-blur, 0px)); backdrop-filter: blur(var(--input-area-blur, 0px));
  border-top: var(--input-area-border-top, 1px solid #efefef); min-height: var(--input-area-min-height, 56px); box-sizing: border-box;
  overflow: visible; contain: none; transform: none; -webkit-transform: none; padding-bottom: var(--nuo-safe-bottom, 0px); }
${R} .input-row-wrapper { display: flex; align-items: center; gap: 8px; padding: var(--input-area-padding, 10px 12px); position: relative; background: transparent; border: 0; box-sizing: border-box; }
${R} .nj-empty-group { display: none; }
${R} .input-action-bar-custom { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 2px; position: relative; box-sizing: border-box; margin: 0;
  background: var(--input-box-bg, #fff); border: var(--input-box-border, 1px solid #dbdbdb); border-radius: var(--input-box-radius, 24px);
  -webkit-backdrop-filter: var(--input-box-blur, none); backdrop-filter: var(--input-box-blur, none); box-shadow: var(--input-box-shadow, none); padding: 0 6px 0 0; }
${R} .input-box-custom { flex: 1 1 auto; min-width: 0; width: auto; background: transparent !important; color: var(--input-box-color, #262626) !important; border: 0 !important; box-shadow: none !important;
  border-radius: var(--input-box-radius, 24px); padding: var(--input-box-padding, 9px 14px); font-size: var(--input-box-font-size, 15px); caret-color: var(--input-caret-color, #0095f6); outline: none; }
${R} .input-box-custom::placeholder { color: var(--input-box-placeholder, #8e8e8e); opacity: 1; }
${R} .input-btn-plus { width: var(--plus-btn-size, 28px); height: var(--plus-btn-size, 28px); color: var(--plus-btn-color, #262626); background-color: var(--plus-btn-bg, transparent); border-radius: 50%; flex-shrink: 0; }
${R} .input-btn-plus svg { width: 100%; height: 100%; }
${R} .input-btn-mic, ${R} .input-btn-sticker, ${R} .input-btn-ai { color: var(--input-btn-color, #262626); width: 30px; height: 30px; background-color: transparent; }
${R} .send-btn-custom { color: var(--send-btn-color, #0095f6); background-color: var(--send-btn-bg, transparent); border-radius: var(--send-btn-radius, 50%); box-shadow: var(--send-btn-shadow, none); width: var(--send-btn-size, 30px); height: var(--send-btn-size, 30px); }
${R} .send-btn-custom:hover { background-color: var(--send-btn-bg-hover, var(--send-btn-bg, transparent)); }
${R} .stop-btn-custom { color: var(--stop-btn-color, #ff3b30); background-color: var(--stop-btn-bg, transparent); border-radius: var(--stop-btn-radius, 50%); box-shadow: var(--stop-btn-shadow, none); width: var(--stop-btn-size, 30px); height: var(--stop-btn-size, 30px); }
${R} .stop-btn-custom:hover { background-color: var(--stop-btn-bg-hover, var(--stop-btn-bg, transparent)); }
${R} .input-action-bar-custom :where(.wx-send-label) { display: none; }
${R} .input-reply-preview-bar { background: var(--reply-bar-bg, rgba(0,0,0,.04)); border: var(--reply-bar-border, none); border-radius: var(--reply-bar-radius, 10px); margin-bottom: var(--reply-bar-margin-bottom, 6px); }
${R} .input-reply-preview-bar :where(.wechat-active-quote-accent) { background: var(--reply-bar-accent, #0095f6); }
${R} .input-reply-preview-bar :where(.wechat-active-quote-label) { color: var(--reply-bar-accent, #0095f6); }
${R} .input-reply-preview-bar :where(.wechat-active-quote-text) { color: var(--reply-bar-text-color, #8e8e8e); }
${R} .input-reply-preview-bar :where(.wechat-active-quote-cancel) { color: var(--reply-bar-close-color, #8e8e8e); }
${R} .emoji-panel-custom { background: var(--emoji-panel-bg, #fff); border-radius: var(--emoji-panel-radius, 0); box-shadow: var(--emoji-panel-shadow, none); }
${R} .more-panel-custom { background: var(--more-options-bg-solid, var(--more-options-bg, rgba(255,255,255,.98))); color: var(--more-options-color, inherit); }

${btnVars}
${icons}
`;
}

export function buildListBaseCss(L) {
    const tabBg = (cls, key) => `${L}.${cls} { background: linear-gradient(var(--nj-msg-${key}-bg-overlay, var(--nj-msg-bg-overlay, transparent)), var(--nj-msg-${key}-bg-overlay, var(--nj-msg-bg-overlay, transparent))),
  var(--nj-msg-${key}-bg-image, var(--nj-msg-bg-image, none)) var(--nj-msg-bg-image-position, center) / var(--nj-msg-bg-image-size, cover) no-repeat, var(--nj-msg-${key}-bg, var(--nj-msg-bg, #fff)); }`;
    return `
${L} { font-family: var(--nj-msg-font-family, inherit);
  background: linear-gradient(var(--nj-msg-bg-overlay, transparent), var(--nj-msg-bg-overlay, transparent)), var(--nj-msg-bg-image, none) var(--nj-msg-bg-image-position, center) / var(--nj-msg-bg-image-size, cover) no-repeat, var(--nj-msg-bg, #fff); }
${tabBg('nj-messaging-chat-tab', 'chat')}
${tabBg('nj-messaging-moments-tab', 'moments')}
${tabBg('nj-messaging-profile-tab', 'profile')}
${tabBg('nj-messaging-favorites-tab', 'fav')}
${L} > .wechat-content { background: transparent; }
${L}[data-tab-anim="enter"] > .wechat-content { animation: nj-tab-fade-in var(--nj-msg-fade-in-duration, 0s) ease both; }
${L} :where(.wcl-v2, .wechat-profile, .moments-page:not(.is-profile)) { background-color: transparent; }

/* ===== 顶部 ===== */
${L} .nj-chat-tab-header-title { color: var(--nj-msg-chat-header-title-color, inherit); font-family: var(--nj-msg-font-family-heading, inherit); }

/* ===== 搜索 / 便签 / 小标题 ===== */
${L} .nj-chat-tab-search { background: var(--nj-msg-chat-search-bg, rgba(118,118,128,.10)); border-radius: var(--nj-msg-chat-search-radius, 10px); }
${L} .nj-chat-tab-search input { color: var(--nj-msg-text, #222); }
${L}:where(.nj-v-note) .nj-chat-tab-note-bubble { background: var(--nj-msg-chat-note-bubble-bg, rgba(0,0,0,.04)); color: var(--nj-msg-chat-note-bubble-color, inherit); }
${L} .nj-chat-tab-section-title { color: var(--nj-msg-chat-section-title-color, #222); }
${L} .nj-chat-tab-section-title :where(.wcl-title) { color: inherit; font-family: var(--nj-msg-font-family-heading, inherit); }
${L} .nj-decor { display: block; position: relative; height: 0; pointer-events: none; flex-shrink: 0; }

/* ===== 聊天项 ===== */
${L} .nj-chat-item { background: var(--nj-msg-card-bg, transparent); border-radius: var(--nj-msg-card-radius, 0); border: var(--nj-msg-card-border, 0);
  padding: var(--nj-msg-card-padding, 7px 14px); gap: var(--nj-msg-card-gap, 10px); transition: var(--nj-msg-card-transition, background .2s ease, transform .2s ease); overflow: visible; }
${L} .nj-chat-item:where(.nj-chat-item-pinned) { background: var(--nj-msg-card-bg-pinned, #eef4ff); }
${L} .nj-chat-item:active { transform: var(--nj-msg-card-active-transform, none); }
@media (hover: hover) { ${L} .nj-chat-item:hover { transform: var(--nj-msg-card-hover-transform, none); } }
${L} .nj-chat-item::after { content: none; }
${L} .nj-chat-item-avatar { margin-right: 0; border-radius: var(--nj-msg-avatar-radius, 50%); box-shadow: var(--nj-msg-avatar-shadow, none); position: relative; flex-shrink: 0; }
${L} .nj-chat-item-avatar > :where(:not(.nj-chat-item-unread-badge)) { border-radius: var(--nj-msg-avatar-radius, 50%) !important; }
${L} .nj-chat-item-avatar::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--nj-msg-avatar-bg-image, none) center / cover no-repeat; z-index: 1; pointer-events: none; }
${L} .nj-chat-item-unread-badge { background: var(--nj-msg-unread-bg-image, none) center / contain no-repeat, var(--nj-msg-unread-bg, #fa5151); color: var(--nj-msg-unread-color, #fff); font-family: var(--nj-msg-font-family-mono, inherit); }
${L} .nj-chat-item-name { color: var(--nj-msg-text, #1d1f23); }
${L} .nj-chat-item-preview { color: var(--nj-msg-text-muted, #8f939a); }
${L} .nj-chat-item-time { color: var(--nj-msg-text-time, #a7abb2); font-family: var(--nj-msg-font-family-mono, inherit); }
${L} .nj-chat-item-badge { color: var(--nj-msg-accent, #0b84ff); }
${decoLayer(`${L} .nj-item-deco-1`, 1)}
${decoLayer(`${L} .nj-item-deco-2`, 2)}

/* ===== 朋友圈 ===== */
${L}:where(.nj-v-mpost) .nj-moments-post { background: var(--nj-msg-moments-post-card-bg, transparent) !important; border-radius: var(--nj-msg-moments-post-card-radius, 0) !important; }
${L} .nj-moments-post { position: relative; }
${L} .nj-moments-post-name { color: var(--nj-msg-moments-post-name-color, #576b95); }
${L} .nj-moments-likes { color: var(--nj-msg-moments-like-color, #576b95); }
${L}:where(.nj-v-mcomment) .nj-moments-engagement { background: var(--nj-msg-moments-comment-bg, transparent) !important; }
${L} .nj-moments-cover-username { color: var(--nj-msg-moments-cover-username-color, #fff); font-family: var(--nj-msg-font-family-heading, inherit); }
${L} .nj-moments-post-text { color: var(--nj-msg-text, inherit); }
${L} .nj-moments-post-time { color: var(--nj-msg-text-time, #a7abb2); }

/* ===== 我 ===== */
${L}:where(.nj-v-pavatar) .nj-profile-avatar { width: var(--nj-msg-profile-avatar-size, 84px) !important; height: var(--nj-msg-profile-avatar-size, 84px) !important; border-radius: var(--nj-msg-profile-avatar-radius, 50%) !important; overflow: hidden; }
${L}:where(.nj-v-pavatar) .nj-profile-avatar img { border-radius: inherit !important; }
${L} .nj-profile-name { color: var(--nj-msg-profile-name-color, var(--nj-msg-text, inherit)); font-family: var(--nj-msg-font-family-heading, inherit); }
${L} .nj-profile-signature { color: var(--nj-msg-profile-signature-color, var(--nj-msg-text-muted, #6b7280)); }

/* ===== 底栏 ===== */
${L} .nj-tab-bottom-bar { position: relative; isolation: isolate; background: var(--nj-msg-tabbar-bg, #f7f7f7); border-radius: var(--nj-msg-tabbar-radius, 0);
  border: var(--nj-msg-tabbar-border, 0); border-top: var(--nj-msg-tabbar-border, .5px solid #d8d8d8); box-shadow: var(--nj-msg-tabbar-shadow, none); padding: var(--nj-msg-tabbar-padding, 2px 0 5px); }
${L} .nj-tab-bottom-bar::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--nj-msg-tabbar-overlay, transparent); pointer-events: none; z-index: -1; }
${L} .nj-tab-bottom-item { color: var(--nj-msg-tabbar-inactive, #999); position: relative; }
${L} .nj-tab-bottom-item:where(.nj-tab-bottom-item-active) { color: var(--nj-msg-tabbar-active, #07c160); }
${L} .nj-tab-bottom-item-active .nj-tab-bottom-icon { transform: var(--nj-msg-tabbar-active-transform, none); transition: transform .25s ease; }
${L} .nj-tab-bottom-total-unread { background: var(--nj-msg-unread-bg, #ff3b30); color: var(--nj-msg-unread-color, #fff); }
`;
}
