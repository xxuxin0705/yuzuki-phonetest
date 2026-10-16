// 🎨 聊天界面风格：微信 / QQ / LINE，各自有日间、夜间两种模式。
// 只改样式不改功能：通过 <html data-wx-skin="..." data-wx-mode="..."> 切换。
// 聊天背景只铺在消息区域，顶栏和输入栏始终使用风格自己的颜色。

export const WECHAT_SKIN_KEY = 'wechat_ui_skin_v1';
export const WECHAT_MOMENTS_SKINS = [
    { id: 'auto', name: '跟随风格' },
    { id: 'wechat', name: '朋友圈' },
    { id: 'qq', name: 'QQ空间' },
    { id: 'line', name: 'LINE' }
];
export const WECHAT_SKINS = [
    { id: 'wechat', name: '微信' },
    { id: 'qq', name: 'QQ' },
    { id: 'line', name: 'LINE' }
];

// 设置页小预览用的配色
export const WECHAT_SKIN_PALETTE = {
    wechat: {
        day: { head: '#ededed', page: '#ededed', bar: '#f7f7f7', inBg: '#ffffff', inFg: '#191919', outBg: '#95ec69', outFg: '#111111', radius: '3px', avatar: '3px' },
        night: { head: '#191919', page: '#111111', bar: '#1e1e1e', inBg: '#2c2c2c', inFg: '#dadada', outBg: '#3eb575', outFg: '#0b1f12', radius: '3px', avatar: '3px' }
    },
    qq: {
        day: { head: '#f1f2f6', page: '#f1f2f6', bar: '#f6f6f9', inBg: '#ffffff', inFg: '#111111', outBg: '#0099ff', outFg: '#ffffff', radius: '7px', avatar: '50%' },
        night: { head: '#17171a', page: '#0f0f11', bar: '#17171a', inBg: '#26262a', inFg: '#e8e8e8', outBg: '#1f7ae0', outFg: '#ffffff', radius: '7px', avatar: '50%' }
    },
    line: {
        day: { head: '#f4f0ef', page: '#ebe3e1', bar: '#fbfafa', inBg: '#ffffff', inFg: '#3b3b3b', outBg: '#b3aba8', outFg: '#2f2a29', radius: '9px', avatar: '50%' },
        night: { head: '#221f21', page: '#191618', bar: '#221f21', inBg: '#3a3436', inFg: '#efe9ea', outBg: '#6a6062', outFg: '#f5f0f0', radius: '9px', avatar: '50%' }
    }
};

const V = (sel, vars) => `${sel} { ${Object.entries(vars).map(([k, v]) => `--wx-${k}: ${v};`).join(' ')} }`;
const R = 'html[data-wx-skin]';
const ROOM = `${R} .wechat-app:has(.chat-room)`;
const SET = `${R} .wechat-app.wx-settings-page`;
const NIGHT = 'html[data-wx-skin][data-wx-mode="night"]';

const VARS = [
    V('html[data-wx-skin="wechat"] .wechat-app', {
        'quote': '#07c160', 'quote-text': '#06a957', 
        'head-bg': '#ededed', 'head-fg': '#111111', 'head-border': '#d9d9d9', 'page-bg': '#ededed',
        'in-bg': '#ffffff', 'in-fg': '#191919', 'out-bg': '#95ec69', 'out-fg': '#111111', 'in-shadow': 'none',
        'radius': '4px', 'avatar-radius': '4px', 'avatar-size': '38px',
        'bar-bg': '#f7f7f7', 'bar-border': '#dcdcdc', 'input-bg': '#ffffff', 'input-fg': '#111111', 'input-border': 'transparent', 'input-radius': '4px',
        'icon': '#181818', 'accent': '#07c160', 'time-fg': '#9a9a9a', 'time-bg': 'transparent', 'sys-bg': 'rgba(0,0,0,.06)', 'sys-fg': '#8a8a8a', 'name-fg': '#8a8a8a',
        'settings-bg': '#ededed'
    }),
    V('html[data-wx-skin="wechat"][data-wx-mode="night"] .wechat-app', {
        'quote': '#3eb575', 'quote-text': '#4cc483', 
        'head-bg': '#191919', 'head-fg': '#e8e8e8', 'head-border': '#262626', 'page-bg': '#111111',
        'in-bg': '#2c2c2c', 'in-fg': '#f2f2f2', 'out-bg': '#3eb575', 'out-fg': '#ffffff',
        'bar-bg': '#1e1e1e', 'bar-border': '#2a2a2a', 'input-bg': '#2c2c2c', 'input-fg': '#e6e6e6',
        'icon': '#d0d0d0', 'time-fg': '#9a9a9a', 'sys-bg': 'rgba(255,255,255,.08)', 'sys-fg': '#b0b0b0', 'name-fg': '#a8a8a8',
        'ph': '#6f6f6f', 'settings-bg': '#111111', 'card-bg': '#1f1f1f', 'card-fg': '#e6e6e6', 'card-sub': '#b4b4b4', 'line': '#2c2c2c', 'ctl-bg': '#2a2a2a', 'panel-bg': '#1e1e1e'
    }),
    V('html[data-wx-skin="qq"] .wechat-app', {
        'quote': '#0099ff', 'quote-text': '#0a84e0', 
        'head-bg': '#f1f2f6', 'head-fg': '#111111', 'head-border': 'transparent', 'page-bg': '#f1f2f6',
        'in-bg': '#ffffff', 'in-fg': '#111111', 'out-bg': '#0099ff', 'out-fg': '#ffffff', 'in-shadow': 'none',
        'radius': '12px', 'avatar-radius': '50%', 'avatar-size': '40px',
        'bar-bg': '#f6f6f9', 'bar-border': '#e5e6eb', 'input-bg': '#ffffff', 'input-fg': '#111111', 'input-border': '#e9e9ee', 'input-radius': '8px',
        'icon': '#2b2b2b', 'accent': '#0099ff', 'time-fg': '#a3a3a8', 'time-bg': 'transparent', 'sys-bg': 'transparent', 'sys-fg': '#a0a0a8', 'name-fg': '#8d8d93',
        'settings-bg': '#f1f2f6'
    }),
    V('html[data-wx-skin="qq"][data-wx-mode="night"] .wechat-app', {
        'quote': '#3a8ee6', 'quote-text': '#5ea5f0', 
        'head-bg': '#17171a', 'head-fg': '#f2f2f2', 'head-border': '#222225', 'page-bg': '#0f0f11',
        'in-bg': '#26262a', 'in-fg': '#f2f2f2', 'out-bg': '#1f7ae0', 'out-fg': '#ffffff',
        'bar-bg': '#17171a', 'bar-border': '#222225', 'input-bg': '#26262a', 'input-fg': '#eeeeee', 'input-border': '#2e2e33',
        'icon': '#cfcfd4', 'time-fg': '#9a9aa0', 'sys-fg': '#a8a8ae', 'name-fg': '#a8a8ae',
        'ph': '#6c6c72', 'settings-bg': '#0f0f11', 'card-bg': '#1c1c1f', 'card-fg': '#eaeaea', 'card-sub': '#b0b0b6', 'line': '#2a2a2e', 'ctl-bg': '#29292d', 'panel-bg': '#17171a'
    }),
    V('html[data-wx-skin="line"] .wechat-app', {
        'quote': '#9c918d', 'quote-text': '#7d7370', 
        'head-bg': '#f4f0ef', 'head-fg': '#222222', 'head-border': '#e6dfdd', 'page-bg': '#ebe3e1',
        'in-bg': '#ffffff', 'in-fg': '#3b3b3b', 'out-bg': '#b3aba8', 'out-fg': '#2f2a29', 'in-shadow': '0 1px 2px rgba(80,60,55,.06)',
        'radius': '18px', 'avatar-radius': '50%', 'avatar-size': '40px',
        'bar-bg': '#fbfafa', 'bar-border': '#e9e4e3', 'input-bg': '#ffffff', 'input-fg': '#333333', 'input-border': '#ece6e5', 'input-radius': '18px',
        'ph': '#b0a8a6', 'icon': '#222222', 'accent': '#222222', 'time-fg': '#ffffff', 'time-bg': 'rgba(120,105,100,.32)', 'sys-bg': 'rgba(120,105,100,.22)', 'sys-fg': '#ffffff', 'name-fg': '#6b6260',
        'settings-bg': '#f4f0ef'
    }),
    V('html[data-wx-skin="line"][data-wx-mode="night"] .wechat-app', {
        'quote': '#8a7f81', 'quote-text': '#c4b9bb', 
        'head-bg': '#221f21', 'head-fg': '#f1eeee', 'head-border': '#2f2a2c', 'page-bg': '#191618',
        'in-bg': '#3a3436', 'in-fg': '#efe9ea', 'out-bg': '#6a6062', 'out-fg': '#f5f0f0', 'in-shadow': 'none',
        'bar-bg': '#221f21', 'bar-border': '#2f2a2c', 'input-bg': '#332e30', 'input-fg': '#eeeeee', 'input-border': '#3a3436',
        'icon': '#e6e0e0', 'accent': '#f1eeee', 'time-fg': '#d8d0cf', 'time-bg': 'rgba(255,255,255,.12)', 'sys-bg': 'rgba(255,255,255,.1)', 'sys-fg': '#d8d0cf', 'name-fg': '#a49a98',
        'ph': '#8a8082', 'settings-bg': '#191618', 'card-bg': '#262224', 'card-fg': '#efe9ea', 'card-sub': '#c2b8ba', 'line': '#36302f', 'ctl-bg': '#332e30', 'panel-bg': '#221f21'
    })
].join('\n');

export const WECHAT_SKIN_CSS = `
${VARS}

/* ===== 通用：顶栏 / 背景只在消息区 ===== */
${ROOM}, ${SET} { background: var(--wx-page-bg) !important; }
${SET} { background: var(--wx-settings-bg) !important; }
${ROOM} > .wechat-header, ${SET} > .wechat-header {
    background: var(--wx-head-bg) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border-bottom: .5px solid var(--wx-head-border) !important; box-shadow: none !important;
}
${ROOM} > .wechat-header .wechat-header-title, ${SET} > .wechat-header .wechat-header-title,
${ROOM} > .wechat-header .wechat-header-title-text, ${SET} > .wechat-header .wechat-header-title-text { color: var(--wx-head-fg) !important; text-shadow: none !important; }
${ROOM} > .wechat-header .wechat-back-btn, ${SET} > .wechat-header .wechat-back-btn,
${ROOM} > .wechat-header .wechat-header-btn, ${SET} > .wechat-header .wechat-header-btn { color: var(--wx-head-fg) !important; text-shadow: none !important; }
${SET} > .wechat-content { background: var(--wx-settings-bg) !important; }
.wx-head-avatar, .wx-head-sub { display: none; }

/* ===== 消息 ===== */
${ROOM} .chat-room .message-left .message-text { background: var(--wx-in-bg); color: var(--wx-in-fg); border-radius: var(--wx-radius); box-shadow: var(--wx-in-shadow); }
${ROOM} .chat-room .message-right .message-text { background: var(--wx-out-bg); color: var(--wx-out-fg); border-radius: var(--wx-radius); box-shadow: none; }
${ROOM} .chat-room .message-left .message-text::before { border-right-color: var(--wx-in-bg); }
${ROOM} .chat-room .message-right .message-text::before { border-left-color: var(--wx-out-bg); }
${ROOM} .chat-room .message-text .wechat-trans-fold-body { color: inherit; opacity: .8; }
${ROOM} .chat-room .message-text .wechat-trans-fold-btn { color: inherit; opacity: .65; }
${ROOM} .chat-room .message-text .wechat-trans-fold { border-top-color: rgba(128,128,128,.28); }
${ROOM} .chat-room .message-avatar { width: var(--wx-avatar-size) !important; height: var(--wx-avatar-size) !important; border-radius: var(--wx-avatar-radius) !important; }
${ROOM} .chat-room .message-avatar img { border-radius: var(--wx-avatar-radius) !important; }
${ROOM} .chat-room .time-divider-text { color: var(--wx-time-fg) !important; background: var(--wx-time-bg) !important; border-radius: 10px; }
${ROOM} .chat-room .system-message-bubble { background: var(--wx-sys-bg) !important; color: var(--wx-sys-fg) !important; }
${ROOM} .chat-room .message-sender, ${ROOM} .chat-room .message-sender-name { color: var(--wx-name-fg) !important; }

/* ===== 输入栏 ===== */
${ROOM} .chat-room .chat-input-area { background: var(--wx-bar-bg) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-top: .5px solid var(--wx-bar-border) !important; }
${ROOM} .chat-room .chat-input-bar { background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-top: 0 !important; }
${ROOM} .chat-room .chat-input { background: var(--wx-input-bg) !important; color: var(--wx-input-fg) !important; border: .5px solid var(--wx-input-border) !important; border-radius: var(--wx-input-radius) !important; }
${ROOM} .chat-room .chat-input::placeholder { color: var(--wx-ph, #a3a3a3); opacity: 1; }
${ROOM} .chat-room .chat-input:focus { border-color: var(--wx-accent) !important; }
${ROOM} .chat-room .input-btn { color: var(--wx-icon) !important; }
${ROOM} .chat-room #send-btn[data-mode="send"] { color: var(--wx-accent) !important; }
${ROOM} .chat-room #send-btn[data-mode="stop"] { color: #ff3b30 !important; }

/* ===== 微信 ===== */
html[data-wx-skin="wechat"] .wechat-app:has(.chat-room) .chat-room .message-text { padding: 9px 11px; }

/* ===== QQ：标题靠左 + 状态小字；圆角气泡无尾巴；输入框一行、功能按钮一行 ===== */
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wechat-header-left { width: 34px; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wechat-header-title { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wechat-header-title-text { font-size: 16px; font-weight: 600; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .status-dot { display: none !important; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-sub { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 10.5px; line-height: 1; color: var(--wx-time-fg); }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-sub::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #34c759; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-sub.is-busy::before { background: #ffb020; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-sub.is-off::before { background: #ff5a5f; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) .chat-room .message-text { padding: 9px 12px; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) .chat-room .message-text::before { display: none; }

/* ===== LINE：顶栏头像在名字上面；大圆角气泡，尾巴在上角；时间胶囊 ===== */
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header { height: 88px !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .wechat-header-title { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-avatar { display: flex; width: 36px; height: 36px; border-radius: 50%; overflow: hidden; align-items: center; justify-content: center; background: #fff; box-shadow: 0 0 0 1.5px #fff, 0 1px 4px rgba(0,0,0,.12); font-size: 18px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-avatar > *, html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .wx-head-avatar img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 50% !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .wechat-header-title-text { font-size: 12px; font-weight: 600; letter-spacing: .2px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) > .wechat-header .status-dot { display: none !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-text { padding: 9px 14px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-left .message-text { border-top-left-radius: 5px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-right .message-text { border-top-right-radius: 5px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-left .message-text::before { left: -5px; right: auto; top: 0; width: 10px; height: 10px; border: 0; background: var(--wx-in-bg); clip-path: polygon(0 0, 100% 0, 100% 100%); }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-right .message-text::before { right: -5px; left: auto; top: 0; width: 10px; height: 10px; border: 0; background: var(--wx-out-bg); clip-path: polygon(0 0, 100% 0, 0 100%); }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-avatar { box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 2px 6px rgba(0,0,0,.12); }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .time-divider-text { padding: 3px 11px !important; font-size: 10.5px !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .system-message-bubble { border-radius: 10px !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .chat-input { height: 34px; padding: 6px 14px !important; }

/* QQ / LINE 右上角改成“≡” */
.wx-bars-icon { display: none; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) #chat-info .fa-ellipsis, html[data-wx-skin="line"] .wechat-app:has(.chat-room) #chat-info .fa-ellipsis { display: none !important; }
html[data-wx-skin="qq"] .wechat-app:has(.chat-room) #chat-info .wx-bars-icon, html[data-wx-skin="line"] .wechat-app:has(.chat-room) #chat-info .wx-bars-icon { display: block !important; }
${ROOM} > .wechat-header .wechat-header-right { position: relative; z-index: 3; min-width: 40px; display: flex !important; visibility: visible !important; opacity: 1 !important; }
${ROOM} > .wechat-header #chat-info { display: inline-flex !important; align-items: center; justify-content: center; min-width: 32px; min-height: 32px; visibility: visible !important; opacity: 1 !important; }

/* ===== 单独的发送按钮 ===== */
.wx-send-label { display: none; }
${R} .chat-room #send-now-btn { color: var(--wx-accent) !important; background: none !important; }
${R} .chat-room #send-now-btn svg { display: block !important; width: 22px; height: 22px; }
${R} .chat-room #send-now-btn[data-mode="stop"] { color: #ff3b30 !important; }

/* ===== LINE：已读 / 表情贴在气泡角上 ===== */
.wx-line-meta { display: none; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .wx-line-meta { display: flex; align-items: center; gap: 3px; margin-top: 3px; font-size: 10px; line-height: 1; color: var(--wx-name-fg); }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .wx-line-meta.is-me { justify-content: flex-end; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .wx-read-check { width: 14px; height: 8px; color: #3d8bff; }
html[data-wx-skin="line"][data-wx-mode="night"] .wechat-app:has(.chat-room) .wx-read-check { color: #6aa8ff; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-content { position: relative; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .chat-message:has(.wechat-reaction-row) .message-content:not(:has(> .message-sender)) { margin-top: 16px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-row { position: absolute; top: -27px; right: -10px; left: auto; margin: 0 !important; gap: 0; flex-wrap: nowrap; z-index: 3; justify-content: flex-end !important; pointer-events: auto; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-content:has(> .message-sender) .wechat-reaction-row { top: -6px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-right .wechat-reaction-row { right: auto; left: -10px; justify-content: flex-start !important; flex-direction: row-reverse; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill { position: relative; width: 28px; height: 28px; padding: 0 !important; margin-left: -6px; border-radius: 50% !important; justify-content: center; background: rgba(150,140,138,.32) !important; border: 0 !important; box-shadow: none !important; font-size: 15px !important; line-height: 1; overflow: visible; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill:first-child { margin-left: 0; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill .wechat-reaction-by { display: none !important; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill::after { content: ''; position: absolute; width: 6px; height: 6px; border-radius: 50%; background: inherit; right: 0; left: auto; bottom: -5px; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .message-right .wechat-reaction-pill::after { right: auto; left: 0; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill + .wechat-reaction-pill::after { display: none; }
html[data-wx-skin="line"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill.is-mine { background: rgba(150,140,138,.32) !important; }
html[data-wx-skin="line"][data-wx-mode="night"] .wechat-app:has(.chat-room) .chat-room .wechat-reaction-pill { background: rgba(255,255,255,.16) !important; }

/* ===== 夜间：聊天里的面板 ===== */
${NIGHT} .wechat-app:has(.chat-room) .emoji-panel, ${NIGHT} .wechat-app:has(.chat-room) .more-panel { background: var(--wx-panel-bg) !important; color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app:has(.chat-room) .more-panel .more-item, ${NIGHT} .wechat-app:has(.chat-room) .more-panel span { color: var(--wx-card-sub) !important; }
${NIGHT} .wechat-app:has(.chat-room) .more-panel .more-icon { background: var(--wx-ctl-bg) !important; color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app:has(.chat-room) .wechat-active-quote-bar { background: var(--wx-ctl-bg) !important; color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app:has(.chat-room) .wechat-active-quote-text { color: var(--wx-card-sub) !important; }

/* ===== 夜间：聊天设置页 ===== */
${NIGHT} .wechat-app.wx-settings-page .wechat-detail-card { background: var(--wx-card-bg) !important; color: var(--wx-card-fg) !important; box-shadow: none !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-detail-heading, ${NIGHT} .wechat-app.wx-settings-page .wechat-detail-setting-row,
${NIGHT} .wechat-app.wx-settings-page .wbx-ctl-label, ${NIGHT} .wechat-app.wx-settings-page .wbx-switch-row, ${NIGHT} .wechat-app.wx-settings-page label { color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app.wx-settings-page small, ${NIGHT} .wechat-app.wx-settings-page .wbx-colors b, ${NIGHT} .wechat-app.wx-settings-page .wbx-range-val,
${NIGHT} .wechat-app.wx-settings-page .wechat-detail-value, ${NIGHT} .wechat-app.wx-settings-page .wechat-settings-sort-hint { color: var(--wx-card-sub) !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-detail-setting-row { border-bottom-color: var(--wx-line) !important; }
${NIGHT} .wechat-app.wx-settings-page input[type=text], ${NIGHT} .wechat-app.wx-settings-page input:not([type]), ${NIGHT} .wechat-app.wx-settings-page select,
${NIGHT} .wechat-app.wx-settings-page textarea { background: var(--wx-ctl-bg) !important; color: var(--wx-card-fg) !important; border-color: var(--wx-line) !important; }
${NIGHT} .wechat-app.wx-settings-page .wbx-seg, ${NIGHT} .wechat-app.wx-settings-page .wechat-seg, ${NIGHT} .wechat-app.wx-settings-page .wbx-deco,
${NIGHT} .wechat-app.wx-settings-page .wbx-side-tabs, ${NIGHT} .wechat-app.wx-settings-page .wsk-modes { background: var(--wx-ctl-bg) !important; }
${NIGHT} .wechat-app.wx-settings-page .wbx-seg-btn, ${NIGHT} .wechat-app.wx-settings-page .wechat-seg-btn { color: var(--wx-card-sub) !important; }
${NIGHT} .wechat-app.wx-settings-page .wbx-seg-btn.active, ${NIGHT} .wechat-app.wx-settings-page .wechat-seg-btn.active { background: var(--wx-card-bg) !important; color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app.wx-settings-page .wbx-btn, ${NIGHT} .wechat-app.wx-settings-page .wbx-mini, ${NIGHT} .wechat-app.wx-settings-page .wbx-deco-tile,
${NIGHT} .wechat-app.wx-settings-page .wdp-foot button { background: var(--wx-ctl-bg) !important; color: var(--wx-card-fg) !important; border-color: var(--wx-line) !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-detail-toggle { background: rgba(255,255,255,.08) !important; }


/* ===== 夜间：文字统一变白，看得清 ===== */
${NIGHT} .wechat-app.wx-settings-page .wechat-content :where(*:not(.wbx-preview, .wbx-preview *, .wsk-mock, .wsk-mock *, .wbx-swatch, .wbx-swatch *)) { color: var(--wx-card-fg) !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-content small, ${NIGHT} .wechat-app.wx-settings-page .wechat-content .wechat-detail-value,
${NIGHT} .wechat-app.wx-settings-page .wechat-content .wbx-colors b, ${NIGHT} .wechat-app.wx-settings-page .wechat-content .wbx-range-val,
${NIGHT} .wechat-app.wx-settings-page .wechat-content .wsk-note, ${NIGHT} .wechat-app.wx-settings-page .wechat-content .wechat-settings-sort-hint,
${NIGHT} .wechat-app.wx-settings-page .wechat-content input::placeholder { color: var(--wx-card-sub) !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-content .wechat-detail-setting-row.is-danger > span { color: #ff6b6b !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-content .wechat-detail-setting-row.is-ok > span { color: #4cd38a !important; }
${NIGHT} .wechat-app.wx-settings-page .wechat-content .wbx-side-tab.active, ${NIGHT} .wechat-app.wx-settings-page .wechat-content [data-bx-side].active { color: #4cd38a !important; }
${NIGHT} .wechat-app:has(.chat-room) .chat-room .mmr-label, ${NIGHT} .wechat-app:has(.chat-room) .chat-room .wx-line-meta { color: var(--wx-card-sub) !important; }
${NIGHT} .wechat-app:has(.chat-room) .chat-room .message-left .message-text, ${NIGHT} .wechat-app:has(.chat-room) .chat-room .message-right .message-text { text-shadow: none; }
${NIGHT} .wechat-app:has(.chat-room) .chat-room .wechat-trans-fold-btn { color: inherit !important; opacity: .75; }

/* ===== 风格选择卡片 ===== */
.wsk-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.wsk-tile { border: 1.5px solid transparent; background: transparent; border-radius: 12px; padding: 0 0 6px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.wsk-tile.active { border-color: #07c160; }
.wsk-mock { display: block; position: relative; height: 74px; border-radius: 10px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.wsk-mock i { position: absolute; display: block; }
.wsk-mock .wsk-h { left: 0; right: 0; top: 0; height: 15px; }
.wsk-mock .wsk-in { left: 7px; top: 24px; width: 46%; height: 13px; }
.wsk-mock .wsk-out { right: 7px; top: 42px; width: 40%; height: 13px; }
.wsk-mock .wsk-f { left: 0; right: 0; bottom: 0; height: 12px; }
.wsk-mock .wsk-av { width: 8px; height: 8px; left: 50%; top: 2px; transform: translateX(-50%); border-radius: 50%; background: #c9c3c1; }
.wsk-tile em { display: block; font-style: normal; font-size: 12px; margin-top: 5px; color: inherit; }
.wsk-modes { display: flex; gap: 3px; margin-top: 12px; background: #f2f3f5; border-radius: 10px; padding: 2px; }
.wsk-modes button { flex: 1; border: 0; background: transparent; padding: 6px 0; border-radius: 8px; font-size: 12px; color: #666; cursor: pointer; }
.wsk-modes button.active { background: #fff; color: #111; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
${NIGHT} .wechat-app.wx-settings-page .wsk-modes button.active { background: var(--wx-card-bg) !important; color: var(--wx-card-fg) !important; }
.wsk-note { font-size: 10.5px; color: #999; margin-top: 8px; }
.wsk-sub { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.wsk-sub > span { flex: 0 0 auto; font-size: 12.5px; color: #444; }
.wsk-sub .wsk-modes { flex: 1; margin-top: 0; }

/* ===================== 朋友圈：朋友圈 / QQ空间 / LINE ===================== */
.mz-acts, .mz-say { display: none; }

/* QQ空间 / LINE 是浅色头部：顶栏按钮改成深色 */
html[data-wx-moments="qq"] .wechat-header.moments-header-overlay .wechat-back-btn, html[data-wx-moments="qq"] .wechat-header.moments-header-overlay .wechat-header-btn,
html[data-wx-moments="line"] .wechat-header.moments-header-overlay .wechat-back-btn, html[data-wx-moments="line"] .wechat-header.moments-header-overlay .wechat-header-btn { color: #222 !important; text-shadow: none !important; }

/* ---- QQ空间 ---- */
html[data-wx-moments="qq"] .moments-page.mz-skin-qq { background: #fff !important; }
html[data-wx-moments="qq"] .mz-head { position: relative; padding: 84px 16px 14px; background: linear-gradient(180deg, #dce8fb 0%, #eef4ff 50%, #ffffff 100%); }
html[data-wx-moments="qq"] .mz-head[style*="--mz-cover"] { background: linear-gradient(180deg, rgba(255,255,255,.25) 0%, rgba(255,255,255,.82) 55%, #fff 100%), var(--mz-cover) center / cover no-repeat; }
html[data-wx-moments="qq"] .mz-profile { display: flex; align-items: center; gap: 14px; }
html[data-wx-moments="qq"] .mz-avatar { flex: 0 0 68px; width: 68px; height: 68px; border-radius: 50%; overflow: hidden; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12); background: #fff; display: flex; align-items: center; justify-content: center; font-size: 30px; cursor: pointer; }
html[data-wx-moments="qq"] .mz-avatar > *, html[data-wx-moments="qq"] .mz-avatar img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 50% !important; }
html[data-wx-moments="qq"] .mz-info { flex: 1; min-width: 0; }
html[data-wx-moments="qq"] .mz-name { font-size: 19px; font-weight: 700; color: #111; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
html[data-wx-moments="qq"] .mz-badges { display: flex; align-items: center; gap: 6px; margin-top: 6px; min-width: 0; }
html[data-wx-moments="qq"] .mz-lv { flex: 0 0 auto; font-size: 10px; font-weight: 700; color: #a86a00; background: linear-gradient(90deg, #ffe9a8, #ffd36b); border-radius: 8px; padding: 1px 7px; }
html[data-wx-moments="qq"] .mz-tag { min-width: 0; font-size: 11px; color: #3e64a8; background: rgba(90,140,230,.12); border-radius: 9px; padding: 2px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
html[data-wx-moments="qq"] .mz-total { display: flex; align-items: center; gap: 4px; margin-top: 7px; font-size: 13px; color: #333; }
html[data-wx-moments="qq"] .mz-total b { font-size: 15px; }
html[data-wx-moments="qq"] .mz-dot { margin: 0 3px; color: #999; }
html[data-wx-moments="qq"] .mz-icons { display: grid; grid-template-columns: repeat(5, 1fr); margin: 18px -4px 14px; }
html[data-wx-moments="qq"] .mz-icon { display: flex; flex-direction: column; align-items: center; gap: 5px; border: 0; background: none; color: #222; font-size: 12.5px; cursor: pointer; padding: 2px 0; }
html[data-wx-moments="qq"] .mz-share { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; border: 1px solid #e2e5ec; border-radius: 14px; background: #fff; color: #9a9a9a; font-size: 14px; cursor: pointer; }
html[data-wx-moments="qq"] .mz-share i { color: #333; font-size: 18px; }
html[data-wx-moments="qq"] .moment-item { position: relative; display: grid !important; grid-template-columns: 44px 1fr auto; column-gap: 10px; padding: 14px 16px 12px !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; border-bottom: 8px solid #f4f5f7 !important; background: #fff !important; box-shadow: none !important; backdrop-filter: none !important; }
html[data-wx-moments="qq"] .moment-item .moment-content-col { display: contents; }
html[data-wx-moments="qq"] .moment-item .moment-avatar-col { grid-column: 1; grid-row: 1; width: 44px !important; height: 44px !important; border-radius: 50% !important; overflow: hidden; }
html[data-wx-moments="qq"] .moment-item .moment-avatar-col img { border-radius: 50% !important; }
html[data-wx-moments="qq"] .moment-item .moment-author { grid-column: 2; grid-row: 1; align-self: center; font-size: 16px !important; font-weight: 600; color: #3d5a99 !important; padding-right: 30px; }
html[data-wx-moments="qq"] .moment-item .moment-content-col > *:not(.moment-author):not(.moment-footer):not(.mz-acts) { grid-column: 1 / -1; }
html[data-wx-moments="qq"] .moment-item .moment-text { margin-top: 10px; font-size: 15px; }
html[data-wx-moments="qq"] .moment-item .moment-images { margin-top: 8px; }
html[data-wx-moments="qq"] .moment-item .moment-footer { grid-column: 1 / 3; align-self: center; margin-top: 10px; }
html[data-wx-moments="qq"] .moment-item .moment-time { color: #9a9a9a; font-size: 12.5px; }
html[data-wx-moments="qq"] .moment-item .moment-action-btn { position: absolute; top: 14px; right: 12px; }
html[data-wx-moments="qq"] .moment-item .mz-acts { display: flex; grid-column: 3; align-self: center; gap: 22px; margin-top: 10px; }
html[data-wx-moments="qq"] .moment-item .mz-acts button { border: 0; background: none; padding: 0; color: #222; cursor: pointer; display: flex; }
html[data-wx-moments="qq"] .moment-item .mz-acts button.is-on { color: #0099ff; }
html[data-wx-moments="qq"] .moment-item .moment-interactions { background: none !important; padding: 6px 0 0 !important; margin-top: 4px; }
html[data-wx-moments="qq"] .moment-item .interaction-likes { color: #3d5a99; font-size: 14px; padding: 0 0 4px !important; border: 0 !important; }
html[data-wx-moments="qq"] .moment-item .interaction-likes i { color: #3d5a99 !important; }
html[data-wx-moments="qq"] .moment-item .mz-say { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 7px 12px; background: #f5f6f8; border-radius: 18px; color: #aaa; font-size: 13.5px; cursor: pointer; }
html[data-wx-moments="qq"] .moment-item .mz-say > :first-child { flex: 0 0 24px; width: 24px; height: 24px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 13px; }
html[data-wx-moments="qq"] .moment-item .mz-say img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 50%; }

/* ---- LINE ---- */
html[data-wx-moments="line"] .moments-page.mz-skin-line { background: #fff !important; }
html[data-wx-moments="line"] .ln-profile { padding: 78px 18px 0; color: #222; }
html[data-wx-moments="line"] .ln-top { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
html[data-wx-moments="line"] .ln-row { display: flex; align-items: center; gap: 16px; }
html[data-wx-moments="line"] .ln-avatar { flex: 0 0 86px; width: 86px; height: 86px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 3px #fff, 0 2px 10px rgba(0,0,0,.12); display: flex; align-items: center; justify-content: center; font-size: 34px; background: #f2f2f2; cursor: pointer; }
html[data-wx-moments="line"] .ln-avatar > *, html[data-wx-moments="line"] .ln-avatar img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 50% !important; }
html[data-wx-moments="line"] .ln-stats { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
html[data-wx-moments="line"] .ln-stats b { display: block; font-size: 19px; font-weight: 700; color: #222; }
html[data-wx-moments="line"] .ln-stats span { display: block; margin-top: 3px; font-size: 12px; color: #9a9a9a; }
html[data-wx-moments="line"] .ln-name { margin-top: 16px; font-size: 15px; font-weight: 700; }
html[data-wx-moments="line"] .ln-handle { margin-top: 3px; font-size: 12.5px; color: #9a9a9a; }
html[data-wx-moments="line"] .ln-sign { margin-top: 10px; font-size: 13.5px; color: #777; cursor: pointer; line-height: 1.5; }
html[data-wx-moments="line"] .ln-actions { display: flex; gap: 8px; margin: 16px 0 12px; }
html[data-wx-moments="line"] .ln-actions button { flex: 1; border: 1px solid #ececec; background: #f8f8f9; border-radius: 12px; padding: 9px 0; font-size: 12.5px; color: #333; cursor: pointer; }
html[data-wx-moments="line"] .ln-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #eee; margin: 0 -18px; }
html[data-wx-moments="line"] .ln-tabs button { border: 0; background: none; padding: 10px 0; color: #c2c2c2; cursor: pointer; display: flex; justify-content: center; }
html[data-wx-moments="line"] .ln-tabs button.active { color: #111; box-shadow: inset 0 -2.5px 0 #111; }
html[data-wx-moments="line"] .ln-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 2px 0 30px; }
html[data-wx-moments="line"] .ln-tile { position: relative; aspect-ratio: 1; background: #f4f4f5; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; }
html[data-wx-moments="line"] .ln-tile img { width: 100%; height: 100%; object-fit: cover; }
html[data-wx-moments="line"] .ln-tile.is-text span { padding: 10px; font-size: 12.5px; color: #333; line-height: 1.45; text-align: center; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
html[data-wx-moments="line"] .ln-tile em { position: absolute; top: 6px; right: 6px; font-style: normal; font-size: 11px; color: #fff; background: rgba(0,0,0,.45); border-radius: 6px; padding: 1px 6px; }
html[data-wx-moments="line"] .ln-grid-empty { padding: 40px 20px; text-align: center; color: #aaa; font-size: 13px; }
html[data-wx-moments="line"] .moments-feed { padding: 6px 0 20px; }
html[data-wx-moments="line"] .moment-item { margin: 10px 12px !important; padding: 14px !important; border-radius: 16px !important; background: #fff !important; border: 1px solid #f0f0f0 !important; box-shadow: 0 2px 10px rgba(0,0,0,.05) !important; backdrop-filter: none !important; }
html[data-wx-moments="line"] .moment-item .moment-avatar-col, html[data-wx-moments="line"] .moment-item .moment-avatar-col img { border-radius: 50% !important; }
html[data-wx-moments="line"] .moment-item .moment-author { color: #222 !important; font-weight: 700; }
`;

export function readWechatSkin(storage) {
    let raw = null;
    try { raw = storage?.get?.(WECHAT_SKIN_KEY, false); } catch (e) { raw = null; }
    let obj = {};
    try { obj = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}; } catch (e) { obj = {}; }
    const skin = WECHAT_SKINS.some(s => s.id === obj?.skin) ? obj.skin : 'wechat';
    const mode = obj?.mode === 'night' ? 'night' : 'day';
    const moments = ['auto', 'wechat', 'qq', 'line'].includes(obj?.moments) ? obj.moments : 'auto';
    return { skin, mode, moments };
}

export function applyWechatSkinAttrs(state) {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-wx-skin', state?.skin || 'wechat');
    root.setAttribute('data-wx-mode', state?.mode === 'night' ? 'night' : 'day');
    const mm = state?.moments && state.moments !== 'auto' ? state.moments : (state?.skin || 'wechat');
    root.setAttribute('data-wx-moments', mm);
    let tag = document.getElementById('wechat-skin-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'wechat-skin-style';
        document.head.appendChild(tag);
    }
    if (tag.textContent !== WECHAT_SKIN_CSS) tag.textContent = WECHAT_SKIN_CSS;
}
