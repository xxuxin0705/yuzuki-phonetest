// 💭 Mind 心情便签：发布便签/状态、可见权限、角色回复便签、角色更新自己的便签
import { WECHAT_REACTION_QUICK_DEFAULT } from './emoji-catalog.js';

export const MIND_STATUS_GROUPS = [
    {
        title: '心情想法',
        items: [
            ['meizizi', '😊', '美滋滋'], ['liekai', '💔', '裂开'], ['jinli', '🐟', '求锦鲤'], ['tianqing', '🌤️', '等天晴'],
            ['pibei', '😮‍💨', '疲惫'], ['fadai', '😶', '发呆'], ['chong', '🏃', '冲'], ['emo', '🌧️', 'emo'],
            ['husi', '💭', '胡思乱想'], ['yuanqi', '✨', '元气满满'], ['bot', '🤖', 'bot']
        ]
    },
    {
        title: '工作学习',
        items: [
            ['banzhuan', '🧱', '搬砖'], ['xuexi', '📚', '沉迷学习'], ['mang', '⏳', '忙'], ['moyu', '🐠', '摸鱼'],
            ['chuchai', '✈️', '出差'], ['huijia', '🏠', '飞奔回家'], ['wurao', '🌙', '勿扰模式']
        ]
    },
    {
        title: '活动',
        items: [
            ['lang', '🌊', '浪'], ['daka', '📍', '打卡'], ['yundong', '🏸', '运动'], ['kafei', '☕', '喝咖啡'],
            ['naicha', '🧋', '喝奶茶'], ['zhuiju', '📺', '追剧'], ['youxi', '🎮', '打游戏'], ['shuijiao', '💤', '睡觉']
        ]
    }
];

// 和聊天表情面板同一套表情，分类显示
const MIND_EMOJI_GROUPS = [
    ['表情', ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
        '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '🤩',
        '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
        '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫',
        '🫢', '🫣', '🫡', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '😶', '🙄', '😬']],
    ['手势', ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
        '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🙏']],
    ['符号', ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
        '⭐', '✨', '⚡', '🔥', '💧', '🌈', '☀️', '🌙', '🍀', '🎉', '🎊', '🎁']],
    ['动物', ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐤', '🐧', '🐦']],
    ['食物出行', ['🍎', '🍓', '🍉', '🍔', '🍟', '🍕', '☕', '🍺', '🍰', '🧋', '🚗', '🚕', '🚌', '🚇', '✈️', '🚀']]
];
const MIND_KAOMOJI = ['(´･ω･`)', '(｡•̀ᴗ-)✧', 'ヾ(≧▽≦*)o', '(╥﹏╥)', '(ง •̀_•́)ง', '( ˘ω˘ )ｽﾔｧ', '╮(╯▽╰)╭', '(*/ω＼*)',
    '(｀へ´)', '(っ˘̩╭╮˘̩)っ', '(｡･ω･｡)ﾉ♡', '┭┮﹏┭┮', '( •̀ ω •́ )✧', '(๑•̀ㅂ•́)و✧', '(；´д｀)ゞ', '(o゜▽゜)o☆',
    'ಠ_ಠ', '(=^･ω･^=)', '(*^▽^*)', '(⊙_⊙)？', '(￣▽￣)"', '(ﾉ´ヮ`)ﾉ*: ･ﾟ', '(｡>﹏<｡)', 'Σ(っ °Д °;)っ'];
const NOTE_TTL = 24 * 3600 * 1000;

// 便签主题色
export const MIND_THEMES = [
    ['lavender', '粉紫', '#d9c8ff'],
    ['sky', '淡蓝', '#bfe0ff'],
    ['lemon', '淡黄', '#ffe9a8'],
    ['mint', '淡绿', '#bfeed6'],
    ['peach', '樱粉', '#ffcfdc']
];
const themeKey = (k) => (MIND_THEMES.some(t => t[0] === k) ? k : 'lavender');

const findStatus = (keyOrLabel = '') => {
    const k = String(keyOrLabel || '').trim();
    if (!k) return null;
    for (const g of MIND_STATUS_GROUPS) {
        for (const [key, emoji, label] of g.items) {
            if (key === k || label === k) return { key, emoji, label };
        }
    }
    return null;
};

export class MindNotes {
    constructor(app) {
        this.app = app;
        this._round = {};
        this._draft = null;
    }

    // ---------------- 数据 ----------------
    _store() {
        const info = this.app.wechatData.data?.userInfo || this.app.wechatData.getUserInfo();
        if (!info.mindNotes || typeof info.mindNotes !== 'object') info.mindNotes = { mine: null, others: {}, replied: {} };
        if (!info.mindNotes.others || typeof info.mindNotes.others !== 'object') info.mindNotes.others = {};
        if (!info.mindNotes.replied || typeof info.mindNotes.replied !== 'object') info.mindNotes.replied = {};
        return info.mindNotes;
    }

    _save() {
        this.app.wechatData.saveData?.();
    }

    _alive(note) {
        return !!note && (note.text || note.status || note.image) && (Date.now() - Number(note.time || 0) < NOTE_TTL);
    }

    getMyNote() {
        const note = this._store().mine;
        return this._alive(note) ? note : null;
    }

    getNoteOf(name = '') {
        const note = this._store().others[String(name || '').trim()];
        return this._alive(note) ? note : null;
    }

    getActiveOthers() {
        const others = this._store().others;
        return Object.keys(others)
            .filter(name => this._alive(others[name]))
            .map(name => ({ name, note: others[name] }))
            .sort((a, b) => Number(b.note.time || 0) - Number(a.note.time || 0));
    }

    canSee(name = '', note = this.getMyNote()) {
        if (!note) return false;
        const v = note.visibility || { type: 'public', names: [] };
        const names = Array.isArray(v.names) ? v.names : [];
        const n = String(name || '').trim();
        const contact = this.app.wechatData.getContactByName?.(n);
        const aliases = [n, contact?.name, contact?.realName, contact?.remark].filter(Boolean);
        const hit = aliases.some(a => names.includes(a));
        if (v.type === 'private') return false;
        if (v.type === 'include') return hit;
        if (v.type === 'exclude') return !hit;
        return true;
    }

    publishMine({ text = '', status = null, image = '', theme = 'lavender', visibility = { type: 'public', names: [] } } = {}) {
        const store = this._store();
        store.mine = {
            id: `mind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: String(text || '').trim().slice(0, 60),
            status: status ? { key: status.key, emoji: status.emoji, label: status.label } : null,
            image: String(image || ''),
            time: Date.now(),
            theme: themeKey(theme),
            visibility: { type: visibility.type || 'public', names: Array.isArray(visibility.names) ? [...visibility.names] : [] }
        };
        store.replied = {};
        this._save();
    }

    deleteMine() {
        this._store().mine = null;
        this._save();
    }

    setOtherNote(name, { text = '', status = null } = {}, { chatId = '', roundId = '' } = {}) {
        const n = String(name || '').trim();
        if (!n || (!text && !status)) return;
        const others = this._store().others;
        const prev = others[n] ? { ...others[n] } : null;
        if (prev) delete prev.prev;
        others[n] = {
            id: `mind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: String(text || '').trim().slice(0, 40),
            status,
            theme: prev?.theme || 'lavender',
            time: Date.now(),
            chatId: String(chatId || ''),
            roundId: String(roundId || ''),
            prev
        };
        this._save();
    }

    deleteOther(name) {
        delete this._store().others[String(name || '').trim()];
        this._save();
    }

    // 这个角色有没有在这个聊天里回复过这条便签（看聊天记录，重roll删掉后会自动变回“没回复”）
    _hasReplied(chatId, noteId) {
        if (!chatId || !noteId) return false;
        const msgs = this.app.wechatData.getMessages?.(chatId) || [];
        return msgs.some(m => m && m.type === 'mind_reply' && m.from !== 'me' && m.mindNote?.noteId === noteId);
    }

    // 重新生成：撤销上一轮里角色新发的便签（下一轮会按档位重新生成）
    onReroll(chatId) {
        const id = String(chatId || '');
        const roundId = this._lastRoundId?.[id];
        if (!roundId) return;
        const others = this._store().others;
        Object.keys(others).forEach(name => {
            const n = others[name];
            if (n && n.chatId === id && n.roundId === roundId) {
                if (n.prev) others[name] = n.prev; else delete others[name];
            }
        });
        this._save();
    }

    _timeAgo(ts) {
        const diff = Math.max(0, Date.now() - Number(ts || 0));
        const m = Math.floor(diff / 60000);
        if (m < 1) return '刚刚';
        if (m < 60) return `${m}分钟前`;
        return `${Math.floor(m / 60)}小时前`;
    }

    _noteLine(note) {
        if (!note) return '';
        const s = note.status ? `${note.status.emoji}${note.status.label}` : '';
        return [s, note.text].filter(Boolean).join(' ');
    }

    _esc(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    _avatarOf(name) {
        return this.app.momentsView?.getContactAvatar?.(name) || this.app.wechatData.getContactByName?.(name)?.avatar || '👤';
    }

    _displayName(name) {
        return this.app.wechatData.getContactDisplayName?.(name) || name;
    }

    // ---------------- 聊天列表顶部的 Mind 一排 ----------------
    renderMindRow() {
        const info = this.app.wechatData.getUserInfo() || {};
        const mine = this.getMyNote();
        const others = this.getActiveOthers();
        const bubble = (note, placeholder = '') => {
            const line = note ? this._noteLine(note) : placeholder;
            return `<span class="mind-bubble mind-theme-${themeKey(note?.theme)}${note ? '' : ' is-empty'}">${this._esc(line)}</span>`;
        };
        return `
            <div class="mind-row" id="wechat-mind-row">
                <button type="button" class="mind-cell is-me" data-mind-me>
                    ${bubble(mine, 'Mind?')}
                    <span class="mind-av">${this.app.renderAvatar(info.avatar, '😊', info.name)}${mine ? '' : '<i class="mind-plus">+</i>'}</span>
                    <span class="mind-name">我</span>
                </button>
                ${others.map(({ name, note }) => `
                    <button type="button" class="mind-cell" data-mind-other="${this._esc(name)}">
                        ${bubble(note)}
                        <span class="mind-av">${this.app.renderAvatar(this._avatarOf(name), '👤', name)}</span>
                        <span class="mind-name">${this._esc(this._displayName(name))}</span>
                    </button>`).join('')}
                <button type="button" class="mind-cell is-gen" data-mind-gen title="按剧情生成联系人的心情便签">
                    <span class="mind-bubble is-empty">🎲 生成</span>
                    <span class="mind-av mind-gen-av">✨</span>
                    <span class="mind-name">生成便签</span>
                </button>
            </div>`;
    }

    bindMindRow(root = document) {
        root.querySelector('[data-mind-gen]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showGenerateNotesSheet();
        });
        root.querySelector('[data-mind-me]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.getMyNote()) this.showNoteCloud('me'); else this.showEditor();
        });
        root.querySelectorAll('[data-mind-other]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showNoteCloud(btn.dataset.mindOther);
        }));
    }

    _mount(html, cls = 'mind-mask') {
        const host = document.querySelector('.phone-view-current .wechat-app') || document.querySelector('.wechat-app') || document.body;
        const mask = document.createElement('div');
        mask.className = cls;
        mask.innerHTML = html;
        host.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
        mask.querySelectorAll('[data-mind-close]').forEach(b => b.addEventListener('click', () => mask.remove()));
        return mask;
    }

    _refreshList() {
        if (!this.app.currentChat && this.app.currentView === 'chats') this.app.render();
    }

    // ☁️ 便签云朵页：中间头像 + 云朵气泡，周围飘着按钮
    showNoteCloud(owner = 'me') {
        const isMe = owner === 'me';
        const note = isMe ? this.getMyNote() : this.getNoteOf(owner);
        if (!note) { if (isMe) this.showEditor(); return; }
        const info = this.app.wechatData.getUserInfo() || {};
        const name = isMe ? (info.name || '我') : this._displayName(owner);
        const avatar = isMe ? info.avatar : this._avatarOf(owner);
        const visText = isMe ? ({ public: '所有朋友', private: '仅自己可见', include: '部分可见', exclude: '不给谁看' }[note.visibility?.type || 'public']) : '';
        const reactions = Array.isArray(note.reactions) ? note.reactions : [];
        const floatBtns = isMe
            ? [['edit', '✏️', '编辑'], ['new', '➕', '新建'], ['share', '💌', '分享'], ['del', '🗑️', '删除']]
            : [['react', '😊', '贴表情'], ['reply', '💬', '回复'], ['roll', '🎲', '重roll'], ['share', '💌', '分享'], ['delOther', '🗑️', '删除']];
        const mask = this._mount(`
            <div class="mind-cloud-page">
                <button type="button" class="mind-cloud-close" data-mind-close aria-label="关闭">✕</button>
                <div class="mind-sparkles"><i>✦</i><i>✧</i><i>⋆</i><i>✦</i><i>✧</i></div>
                <div class="mind-theme-bubbles">
                    ${MIND_THEMES.map(([k, label, color], i) => `<button type="button" class="mind-theme-bubble b${i}${themeKey(note.theme) === k ? ' is-on' : ''}" data-theme="${k}" style="--tb:${color}" title="${label}"></button>`).join('')}
                </div>
                <div class="mind-cloud-stage">
                    <div class="mind-cloud">
                        ${note.status ? `<span class="mind-cloud-status">${this._esc(note.status.emoji)} ${this._esc(note.status.label)}</span>` : ''}
                        ${note.text ? `<div class="mind-cloud-text">${this._esc(note.text)}</div>` : ''}
                        ${note.image ? `<img class="mind-cloud-img" src="${this._esc(note.image)}" alt="">` : ''}
                        ${reactions.length ? `<div class="mind-cloud-reacts">${reactions.map(e => `<span>${this._esc(e)}</span>`).join('')}</div>` : ''}
                    </div>
                    <span class="mind-cloud-dot d1"></span><span class="mind-cloud-dot d2"></span>
                    <div class="mind-cloud-av">${this.app.renderAvatar(avatar, isMe ? '😊' : '👤', name)}</div>
                    <div class="mind-cloud-name">${this._esc(name)}</div>
                    <div class="mind-cloud-meta">${this._timeAgo(note.time)}${visText ? ` · ${visText}` : ''}</div>
                    <div class="mind-float-btns n${floatBtns.length}">
                        ${floatBtns.map(([act, icon, label], i) => `<button type="button" class="mind-float-btn f${i}" data-act="${act}"><span>${icon}</span><em>${label}</em></button>`).join('')}
                    </div>
                </div>
                <div class="mind-cloud-extra"></div>
            </div>`, `mind-mask is-full is-cloud mind-theme-${themeKey(note.theme)}`);
        mask.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = isMe ? this._store().mine : this._store().others[owner];
            if (target) { target.theme = themeKey(b.dataset.theme); this._save(); }
            mask.remove();
            this._refreshList();
            this.showNoteCloud(owner);
        }));
        const extra = mask.querySelector('.mind-cloud-extra');
        const rerender = () => { mask.remove(); this.showNoteCloud(owner); };
        mask.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = btn.dataset.act;
            if (act === 'edit') { mask.remove(); this.showEditor({ fresh: false }); return; }
            if (act === 'new') { mask.remove(); this.showEditor({ fresh: true }); return; }
            if (act === 'del') {
                mask.remove();
                this.deleteMine();
                this.app.phoneShell?.showNotification?.('Mind', '便签已删除', '🗑️');
                this._refreshList();
                return;
            }
            if (act === 'share') { this.showShareNote(owner); return; }
            if (act === 'roll') {
                if (btn.dataset.busy === '1') return;
                btn.dataset.busy = '1';
                const label = btn.querySelector('em');
                if (label) label.textContent = '生成中…';
                this.generateNoteFor('', owner, { manual: true }).then(ok => {
                    if (!ok) {
                        btn.dataset.busy = '';
                        if (label) label.textContent = '重roll';
                        this.app.phoneShell?.showNotification?.('Mind', '生成失败，请检查 API 设置后再试', '⚠️');
                        return;
                    }
                    if (mask.isConnected) rerender();
                });
                return;
            }
            if (act === 'delOther') {
                mask.remove();
                this.deleteOther(owner);
                this.app.phoneShell?.showNotification?.('Mind', '已删除 TA 的便签', '🗑️');
                this._refreshList();
                return;
            }
            if (act === 'react') {
                const list = (WECHAT_REACTION_QUICK_DEFAULT && WECHAT_REACTION_QUICK_DEFAULT.length ? WECHAT_REACTION_QUICK_DEFAULT : ['👍', '❤️', '😂', '😮', '😢', '🎉']).slice(0, 12);
                extra.innerHTML = `<div class="mind-react-picker">${list.map(e2 => `<button type="button" data-react="${this._esc(e2)}" class="${reactions.includes(e2) ? 'is-on' : ''}">${this._esc(e2)}</button>`).join('')}</div>`;
                extra.querySelectorAll('[data-react]').forEach(b2 => b2.addEventListener('click', () => {
                    this.toggleReaction(owner, b2.dataset.react);
                    rerender();
                }));
                return;
            }
            if (act === 'reply') {
                extra.innerHTML = `<div class="mind-reply-box"><input type="text" maxlength="60" placeholder="回复 ${this._esc(name)} 的便签…"><button type="button" data-send>发送</button></div>`;
                const input = extra.querySelector('input');
                setTimeout(() => input?.focus(), 50);
                const send = () => {
                    const text = String(input.value || '').trim();
                    if (!text) return;
                    mask.remove();
                    this.replyToOther(owner, note, text);
                };
                extra.querySelector('[data-send]').addEventListener('click', send);
                input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') send(); });
            }
        }));
    }

    toggleReaction(owner, emoji) {
        const note = this._store().others[owner];
        if (!note || !emoji) return;
        const list = Array.isArray(note.reactions) ? note.reactions : [];
        const i = list.indexOf(emoji);
        if (i >= 0) list.splice(i, 1); else list.push(emoji);
        note.reactions = list.slice(-6);
        note.reactionsSeen = false;
        this._save();
        this._refreshList();
    }

    // 💌 分享便签到私聊 / 群聊
    showShareNote(owner = 'me') {
        const isMe = owner === 'me';
        const note = isMe ? this.getMyNote() : this.getNoteOf(owner);
        if (!note) return;
        const chats = (this.app.wechatData.getChatList?.() || []).filter(c => c && c.id);
        const selected = new Set();
        const mask = this._mount(`
            <div class="mind-share-sheet">
                <div class="mind-share-head"><b>分享便签</b><button type="button" data-mind-close>✕</button></div>
                <div class="mind-share-preview">${this._esc(this._noteLine(note) || '[便签]')}</div>
                <div class="mind-share-list">
                    ${chats.map(c => `<button type="button" class="mind-share-row" data-chat="${this._esc(c.id)}"><span class="mind-share-av">${this.app.renderAvatar(c.avatar, c.type === 'group' ? '👥' : '👤', c.name)}</span><span class="mind-share-name">${this._esc(this.app._getChatDisplayName?.(c) || c.name)}</span><span class="mind-share-check">✓</span></button>`).join('')}
                </div>
                <button type="button" class="mind-btn-primary" data-send disabled>请选择聊天</button>
            </div>`, 'mind-mask is-bottom is-top');
        const sendBtn = mask.querySelector('[data-send]');
        mask.querySelectorAll('[data-chat]').forEach(row => row.addEventListener('click', () => {
            const id = row.dataset.chat;
            if (selected.has(id)) selected.delete(id); else selected.add(id);
            row.classList.toggle('is-on', selected.has(id));
            sendBtn.disabled = !selected.size;
            sendBtn.textContent = selected.size ? `发送（${selected.size}）` : '请选择聊天';
        }));
        sendBtn.addEventListener('click', () => {
            const data = this.app.wechatData;
            const chatView = this.app.chatView;
            const timeFields = chatView?._shouldUseRealTimeForOnlineChat?.() ? (chatView._buildWechatRealTimeFields?.() || {}) : {};
            const ownerName = isMe ? (data.getUserInfo()?.name || '我') : owner;
            [...selected].forEach(chatId => {
                data.addMessage(chatId, {
                    from: 'me', type: 'mind_share', avatar: data.getUserInfo()?.avatar,
                    mindNote: { owner: isMe ? 'me' : owner, text: note.text, status: note.status || null, image: note.image || '', theme: themeKey(note.theme) },
                    content: `[分享便签] ${ownerName}的便签「${this._noteLine(note)}」`,
                    ...timeFields
                });
                if (chatView?.isOnlineMode?.()) chatView._enqueuePendingChat?.(chatId);
            });
            this._save();
            mask.remove();
            document.querySelectorAll('.mind-mask').forEach(m => m.remove());
            this.app.phoneShell?.showNotification?.('Mind', `已分享到 ${selected.size} 个聊天`, '💌');
            const first = [...selected][0];
            if (first) {
                this.app.currentView = 'chats';
                if (typeof this.app.openChat === 'function') this.app.openChat(first);
                else { this.app.currentChat = data.getChat(first); this.app.render(); }
            }
        });
    }

    // 我回复角色的便签 → 进私聊：便签卡片 + 我的话
    replyToOther(name, note, text) {
        const data = this.app.wechatData;
        const chat = data.findSingleChatForMember?.(name);
        if (!chat) {
            this.app.phoneShell?.showNotification?.('Mind', '还没有和 TA 的私聊窗口', '⚠️');
            return;
        }
        const chatView = this.app.chatView;
        const timeFields = chatView?._shouldUseRealTimeForOnlineChat?.() ? (chatView._buildWechatRealTimeFields?.() || {}) : {};
        const avatar = data.getUserInfo()?.avatar;
        data.addMessage(chat.id, {
            from: 'me', type: 'mind_reply', avatar,
            mindNote: { owner: name, text: note.text, status: note.status || null, image: note.image || '', theme: themeKey(note.theme) },
            replyText: text,
            content: text,
            ...timeFields
        });
        if (chatView?.isOnlineMode?.()) chatView._enqueuePendingChat?.(chat.id);
        this.app.phoneShell?.showNotification?.('Mind', `已回复 ${this._displayName(name)} 的便签`, '💬');
        this._refreshList();
    }

    // ---------------- 编辑器（参考图：气泡 + 头像 + 权限 + 分享） ----------------
    showEditor({ fresh = false } = {}) {
        const info = this.app.wechatData.getUserInfo() || {};
        const prev = fresh ? null : this.getMyNote();
        const draft = {
            text: prev?.text || '',
            status: prev?.status || null,
            image: prev?.image || '',
            theme: themeKey(prev?.theme),
            visibility: prev?.visibility ? { type: prev.visibility.type, names: [...(prev.visibility.names || [])] } : { type: 'public', names: [] }
        };
        const contacts = (this.app.wechatData.getContacts() || []).filter(c => String(c?.name || '').trim());
        const customEmojis = (this.app.wechatData.getCustomEmojis?.() || []).filter(em => em?.image);
        const mask = this._mount(`
            <div class="mind-editor">
                <button type="button" class="mind-close" data-mind-close aria-label="关闭">✕</button>
                <div class="mind-editor-body">
                    <div class="mind-edit-bubble">
                        <button type="button" class="mind-status-chip" data-status></button>
                        <textarea maxlength="60" rows="2" placeholder="分享此刻的想法…">${this._esc(draft.text)}</textarea>
                        <div class="mind-edit-img"></div>
                    </div>
                    <div class="mind-edit-av">${this.app.renderAvatar(info.avatar, '😊', info.name)}</div>
                    <div class="mind-emoji-panel">
                        ${MIND_EMOJI_GROUPS.map(([title, list], gi) => `
                            <div class="mind-emo-group${gi === 0 ? '' : ' is-folded'}">
                                <button type="button" class="mind-emo-head" data-fold>${title}<i>⌄</i></button>
                                <div class="mind-emo-grid">${list.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
                            </div>`).join('')}
                        <div class="mind-emo-group is-folded">
                            <button type="button" class="mind-emo-head" data-fold>颜文字<i>⌄</i></button>
                            <div class="mind-emo-grid is-kaomoji">${MIND_KAOMOJI.map(e => `<button type="button" data-emoji="${this._esc(e)}">${this._esc(e)}</button>`).join('')}</div>
                        </div>
                        ${customEmojis.length ? `
                        <div class="mind-emo-group is-folded">
                            <button type="button" class="mind-emo-head" data-fold>我的表情<i>⌄</i></button>
                            <div class="mind-emo-grid is-sticker">${customEmojis.map(em => `<button type="button" data-sticker="${this._esc(em.image || '')}"><img src="${this._esc(em.image || '')}" alt=""></button>`).join('')}</div>
                        </div>` : ''}
                    </div>
                    <div class="mind-theme-row">${MIND_THEMES.map(([k, label, color]) => `<button type="button" class="mind-theme-dot" data-edit-theme="${k}" style="--tb:${color}"><span></span><em>${label}</em></button>`).join('')}</div>
                    <div class="mind-vis-row">
                        <select data-vis>
                            <option value="public">所有朋友</option>
                            <option value="private">仅自己可见</option>
                            <option value="include">部分可见</option>
                            <option value="exclude">不给谁看</option>
                        </select>
                        <button type="button" class="mind-share" data-share>发布</button>
                    </div>
                    <div class="mind-vis-people" hidden>
                        ${contacts.map(c => `<button type="button" class="mind-person" data-name="${this._esc(c.name)}">${this._esc(this._displayName(c.name))}</button>`).join('')}
                    </div>
                    <div class="mind-tip">便签 24 小时内可见；角色看得到才会回复</div>
                </div>
            </div>`, 'mind-mask is-full');
        const ta = mask.querySelector('textarea');
        const chip = mask.querySelector('[data-status]');
        const imgBox = mask.querySelector('.mind-edit-img');
        const vis = mask.querySelector('[data-vis]');
        const people = mask.querySelector('.mind-vis-people');
        vis.value = draft.visibility.type;
        const paint = () => {
            chip.textContent = draft.status ? `${draft.status.emoji} ${draft.status.label}` : '+ 状态';
            chip.classList.toggle('is-empty', !draft.status);
            imgBox.innerHTML = draft.image ? `<img src="${this._esc(draft.image)}" alt=""><button type="button" data-img-del>✕</button>` : '';
            imgBox.querySelector('[data-img-del]')?.addEventListener('click', () => { draft.image = ''; paint(); });
            const needPeople = draft.visibility.type === 'include' || draft.visibility.type === 'exclude';
            people.hidden = !needPeople;
            people.querySelectorAll('.mind-person').forEach(b => b.classList.toggle('is-on', draft.visibility.names.includes(b.dataset.name)));
        };
        vis.addEventListener('change', () => { draft.visibility.type = vis.value; paint(); });
        people.querySelectorAll('.mind-person').forEach(b => b.addEventListener('click', () => {
            const n = b.dataset.name;
            const list = draft.visibility.names;
            const i = list.indexOf(n);
            if (i >= 0) list.splice(i, 1); else list.push(n);
            paint();
        }));
        mask.querySelectorAll('[data-emoji]').forEach(b => b.addEventListener('click', () => {
            const pos = ta.selectionStart ?? ta.value.length;
            ta.value = (ta.value.slice(0, pos) + b.dataset.emoji + ta.value.slice(pos)).slice(0, 60);
            ta.focus();
        }));
        const editorRoot = mask.querySelector('.mind-editor');
        const paintTheme = () => {
            MIND_THEMES.forEach(([k]) => editorRoot.classList.toggle(`mind-theme-${k}`, draft.theme === k));
            mask.querySelectorAll('[data-edit-theme]').forEach(b => b.classList.toggle('is-on', b.dataset.editTheme === draft.theme));
        };
        mask.querySelectorAll('[data-edit-theme]').forEach(b => b.addEventListener('click', () => { draft.theme = b.dataset.editTheme; paintTheme(); }));
        paintTheme();
        const openStatus = () => this.showStatusPicker(draft.status, (st) => { draft.status = st; paint(); });
        chip.addEventListener('click', openStatus);
        mask.querySelectorAll('[data-fold]').forEach(b => b.addEventListener('click', () => b.parentElement.classList.toggle('is-folded')));
        mask.querySelectorAll('[data-sticker]').forEach(b => b.addEventListener('click', () => { draft.image = b.dataset.sticker; paint(); }));
        mask.querySelector('[data-share]').addEventListener('click', () => {
            draft.text = String(ta.value || '').trim();
            if (!draft.text && !draft.status && !draft.image) {
                this.app.phoneShell?.showNotification?.('Mind', '写点什么或设个状态吧', '⚠️');
                return;
            }
            if ((draft.visibility.type === 'include' || draft.visibility.type === 'exclude') && !draft.visibility.names.length) {
                this.app.phoneShell?.showNotification?.('Mind', '请选择可见/不可见的人', '⚠️');
                return;
            }
            this.publishMine(draft);
            mask.remove();
            this.app.phoneShell?.showNotification?.('Mind', '便签已发布', '💭');
            this._refreshList();
        });
        paint();
    }

    showStatusPicker(current, onPick) {
        const mask = this._mount(`
            <div class="mind-status-page">
                <div class="mind-status-head"><button type="button" data-mind-close>✕</button><div><b>设个状态</b><small>朋友24小时内可见</small></div><button type="button" data-clear>清除</button></div>
                ${MIND_STATUS_GROUPS.map(g => `
                    <div class="mind-status-group">
                        <div class="mind-status-title">${g.title}</div>
                        <div class="mind-status-grid">
                            ${g.items.map(([key, emoji, label]) => `<button type="button" class="mind-status-item${current?.key === key ? ' is-on' : ''}" data-key="${key}"><span>${emoji}</span><em>${label}</em></button>`).join('')}
                        </div>
                    </div>`).join('')}
            </div>`, 'mind-mask is-full is-status');
        mask.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => {
            onPick?.(findStatus(b.dataset.key));
            mask.remove();
        }));
        mask.querySelector('[data-clear]').addEventListener('click', () => { onPick?.(null); mask.remove(); });
    }

    // ---------------- 提示词 / 标签 ----------------
    _contactKeyForChat(chat) {
        if (!chat || chat.type === 'group') return '';
        const contact = chat.contactId ? this.app.wechatData.getContact?.(chat.contactId) : this.app.wechatData.getContactByName?.(chat.name);
        return String(contact?.name || chat.name || '').trim();
    }

    buildPromptRules({ isGroupChat = false, targetChat = null, isProactive = false } = {}) {
        const chatId = String(targetChat?.id || '');
        const note = this.getMyNote();
        const lines = [];
        const state = { replyAllowed: false, updateAllowed: false, replier: '', level: '', noteOwner: '', updatedThisRound: false, attachNext: false, roundId: `r${Date.now()}` };
        if (!this._lastRoundId) this._lastRoundId = {};
        this._lastRoundId[chatId] = state.roundId;
        if (!isGroupChat && targetChat) {
            const name = this._contactKeyForChat(targetChat);
            const store = this._store();
            if (note && this.canSee(name, note)) {
                void store;
                const replied = this._hasReplied(chatId, note.id);
                const noteDesc = `「${this._noteLine(note)}」${note.status ? `（状态：${note.status.label}）` : ''}${note.image ? '（附了一张图）' : ''}`;
                lines.push(`【用户的心情便签】用户在 Mind 里发了一条便签（24小时内可见）：${noteDesc}。${replied ? '你已经回复过这条便签了，不用再专门回复，但可以记得这件事。' : ''}`);
                if (!replied) {
                    state.replyAllowed = true;
                    state.replier = name;
                    lines.push(`【回复便签·本轮必须回复·最高优先级】你看到了用户的这条便签，本轮回复里必须有一条消息专门回应这条便签，必须作为聊天窗口里一条真实可见的回复消息出现，内容必须针对用户这条便签，不得用新发布的便签代替回复。在那条消息的上一行单独写 [回复便签]。那条消息必须直接、明确地回应便签里的内容和状态——便签说了什么就针对什么：例如便签是“emo/难过”就问 TA 为什么 emo、发生了什么；是“熬夜/修仙”就催 TA 睡觉；是开心的事就追问细节。要让人一看就知道你是在回应这条便签${noteDesc}，不能泛泛带过或忽略它。`);
                }
            }
            const own = this.getNoteOf(name);
            if (own && Array.isArray(own.reactions) && own.reactions.length && !own.reactionsSeen) {
                lines.push(`【便签互动】用户给你的心情便签「${this._noteLine(own)}」贴了表情：${own.reactions.join(' ')}。你可以自然地提一句。`);
                own.reactionsSeen = true;
                this._save();
            }
            const level = String(targetChat?.mindNoteLevel || 'medium');
            state.level = level;
            state.noteOwner = name;
            const updateChance = { low: 0.15, medium: 0.4, high: 0.7, extreme: 1 }[level] ?? 0.4;
            if (Math.random() < updateChance) {
                state.updateAllowed = true;
                if (level === 'extreme') lines.push('【你的心情便签·本轮必须更新】本轮请务必按剧情发一条新的 Mind 便签。');
                lines.push(`【你的心情便签】你可以按剧情和聊天记录更新自己的 Mind 便签（${own ? `当前是「${this._noteLine(own)}」` : '目前没有'}）：单独一行写 [便签:便签内容|状态]，内容 20 字以内，状态从这些里选一个或留空：${MIND_STATUS_GROUPS.flatMap(g => g.items.map(i => i[2])).join('、')}。这一行不会作为消息显示。`);
            }
        } else if (isGroupChat && targetChat && !isProactive) {
            if (Math.random() < 0.25) {
                state.updateAllowed = true;
                lines.push('【群成员的心情便签】群成员可以按剧情更新自己的 Mind 便签：在自己的发言里单独一行写 [便签:便签内容|状态]（20 字以内），这一行不会显示。');
            }
        }
        this._round[chatId] = state;
        return lines.join('\n');
    }

    reminderLine(chatId) {
        const st = this._round[String(chatId || '')];
        let out = st?.replyAllowed ? '\n- 【回复便签】本轮必须在聊天窗口发出一条明确回应用户 Mind 便签内容的消息，不得用新便签代替，在那条消息上一行单独写 [回复便签]。' : '';
        if (st?.updateAllowed && st.level === 'extreme') out += '\n- 【心情便签】本轮必须单独一行写 [便签:便签内容|状态] 发一条新便签（不显示为消息）。';
        else if (st?.updateAllowed) out += '\n- 【心情便签】本轮可以单独一行写 [便签:便签内容|状态] 更新你的便签。';
        return out;
    }

    // 一轮结束：极高档位但模型没写 [便签:]（或这一行被回复条数上限截掉了），单独让 AI 按剧情补一条便签
    async afterRound(chatId) {
        const st = this._round[String(chatId || '')];
        if (!st) return;
        // 模型这一轮忘了写 [回复便签]：挑一条最贴近便签内容的消息（没有就用最后一条）补上便签引用
        try { this._ensureReplyCard(chatId, st); } catch (e) { console.warn('[Mind] 补便签回复失败', e); }
        if (st.level !== 'extreme' || st.updatedThisRound || !st.noteOwner) return;
        st.updatedThisRound = true;
        const ok = await this.generateNoteFor(chatId, st.noteOwner, { roundId: st.roundId });
        if (!ok) console.warn('[Mind] 极高档位补发便签失败（模型没有返回可用内容）');
    }

    // 角色资料：酒馆角色卡（名字对得上时）+ 通讯录里的人设字段
    _personaOf(owner) {
        const parts = [];
        try {
            const ctx = window.SillyTavern?.getContext?.();
            const ch = ctx?.characters?.[ctx?.characterId];
            const same = ch && (String(ch.name || '').trim() === owner || String(ctx?.name2 || '').trim() === owner);
            if (same) {
                [ch.description, ch.personality, ch.scenario].forEach(t => { const v = String(t || '').trim(); if (v) parts.push(v.slice(0, 1200)); });
            }
        } catch (e) { /* 忽略 */ }
        try {
            const c = this.app.wechatData.getContactByName?.(owner);
            ['persona', 'personality', 'description', 'intro', 'setting', 'relation', 'honeyVisibleIntro'].forEach(k => {
                const v = String(c?.[k] || '').trim();
                if (v && !parts.some(p => p.includes(v.slice(0, 30)))) parts.push(`${k}: ${v.slice(0, 400)}`);
            });
        } catch (e) { /* 忽略 */ }
        return parts.join('\n').slice(0, 2400);
    }

    // 酒馆正文里最近的剧情（去掉 HTML / 状态栏等标签，只留文字）
    _recentStory() {
        try {
            const ctx = window.SillyTavern?.getContext?.();
            const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
            return chat.filter(m => m && !m.is_system && String(m.mes || '').trim()).slice(-6).map(m => {
                const text = String(m.mes || '')
                    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(-500);
                return `${m.is_user ? (ctx.name1 || '用户') : (m.name || ctx.name2 || '角色')}: ${text}`;
            }).join('\n');
        } catch (e) {
            return '';
        }
    }

    _findChatIdFor(owner) {
        const chats = this.app.wechatData.getChatList?.() || [];
        const hit = chats.find(c => c && c.type !== 'group' && this._contactKeyForChat(c) === owner);
        return hit ? String(hit.id) : '';
    }

    /**
     * 按当前剧情 + 微信聊天，让 AI 给某个联系人写一条新的心情便签
     * @returns {Promise<boolean>} 是否成功写入
     */
    async generateNoteFor(chatId, owner, { roundId = '', manual = false } = {}) {
        const name = String(owner || '').trim();
        if (!name) return false;
        const apiManager = window.VirtualPhone?.apiManager;
        if (!apiManager?.callAI) return false;
        const cid = String(chatId || this._findChatIdFor(name) || '');
        const userName = this.app.wechatData.getUserInfo?.()?.name || '用户';
        const msgs = (cid ? (this.app.wechatData.getMessages(cid) || []) : []).slice(-20)
            .filter(m => m && m.type !== 'system')
            .map(m => `${m.from === 'me' ? userName : (m.from || name)}: ${String(m.replyText || m.content || '').replace(/\s+/g, ' ').slice(0, 120)}`)
            .join('\n');
        const story = this._recentStory();
        const persona = this._personaOf(name);
        const statusList = MIND_STATUS_GROUPS.flatMap(g => g.items.map(i => i[2])).join('、');
        const own = this.getNoteOf(name);
        const myNote = this.getMyNote();
        const prompt = [
            `你是「${name}」。请根据你的人设、当前剧情和最近的微信聊天，用你自己的口吻写一条新的 Mind 心情便签（像状态签名，20 字以内，可带 emoji，要能看出你此刻的心情/在做什么/在想谁）。`,
            own ? `不要和你上一条便签「${this._noteLine(own)}」重复。` : '',
            myNote && this.canSee(name, myNote) ? `${userName} 现在的便签是「${this._noteLine(myNote)}」，可以有呼应但不要照抄。` : '',
            persona ? `\n【你的人设】\n${persona}` : '',
            story ? `\n【当前剧情（最近）】\n${story}` : '',
            msgs ? `\n【最近的微信聊天】\n${msgs}` : '',
            `\n只输出一行，格式：便签内容|状态\n状态从这些里选一个（也可以留空）：${statusList}\n不要输出解释、引号或其它内容。`
        ].filter(Boolean).join('\n');
        let raw = '';
        try {
            const res = await apiManager.callAI([
                { role: 'system', content: '你是角色扮演助手，只按要求的格式输出一行。', isPhoneMessage: true },
                { role: 'user', content: prompt, isPhoneMessage: true }
            ], { appId: 'wechat', max_tokens: 400 });
            if (res && res.success === false) { console.warn('[Mind] 生成便签失败:', res.error); return false; }
            raw = String(res?.summary || res?.content || res?.text || '');
        } catch (e) {
            console.warn('[Mind] 生成便签失败', e);
            return false;
        }
        const parsed = parseNoteLine(raw, name);
        if (!parsed) return false;
        this.setOtherNote(name, { text: parsed.text, status: findStatus(parsed.status) }, { chatId: cid, roundId: manual ? '' : roundId });
        this._refreshList();
        return true;
    }

    // 🎲 生成便签弹窗：选条数（几个人）+ 必定出现的人 / 只让选中的人发（和生成朋友圈一样）
    showGenerateNotesSheet() {
        if (this._genBusy) { this.app.phoneShell?.showNotification?.('Mind', '正在生成中，请稍等', '⏳'); return; }
        const contacts = (this.app.wechatData.getContacts?.() || []).filter(c => String(c?.name || '').trim());
        if (!contacts.length) { this.app.phoneShell?.showNotification?.('提示', '请先添加联系人', '⚠️'); return; }
        let count = Math.min(3, contacts.length);
        const picked = new Set();
        let onlySelected = false;
        const counts = [1, 2, 3, 4, 5, 6, 8, 10].filter(n => n <= Math.max(1, contacts.length));
        const host = document.querySelector('.phone-view-current .wechat-app') || document.querySelector('.wechat-app') || document.body;
        const mask = document.createElement('div');
        mask.className = 'moment-sheet-mask';
        mask.innerHTML = `
            <div class="moment-dialog moment-gen-dialog" role="dialog">
                <div class="moment-dialog-title">生成心情便签</div>
                <div class="moment-gen-label">生成几个人 <small>每人只保留一条，新生成的会顶替旧的</small></div>
                <div class="moment-gen-count">${counts.map(n => `<button type="button" data-count="${n}">${n}</button>`).join('')}</div>
                <div class="moment-gen-label">必定出现的人 <small>不选 = 随机</small></div>
                <div class="moment-gen-people">
                    ${contacts.map(c => `<button type="button" class="moment-gen-person" data-name="${this._esc(c.name)}"><span class="moment-gen-av">${this.app.renderAvatar(this._avatarOf(c.name) || c.avatar, '👤', c.name)}</span><span class="moment-gen-name">${this._esc(this._displayName(c.name))}</span></button>`).join('')}
                </div>
                <label class="moment-gen-only"><input type="checkbox" data-only> 只让选中的人发</label>
                <div class="moment-gen-summary"></div>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary" data-ok>生成</button>
                </div>
            </div>`;
        host.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
        mask.querySelectorAll('[data-sheet-close]').forEach(b => b.addEventListener('click', () => mask.remove()));
        const summary = mask.querySelector('.moment-gen-summary');
        const paint = () => {
            const n = onlySelected && picked.size ? picked.size : count;
            mask.querySelectorAll('[data-count]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.count) === count));
            mask.querySelector('.moment-gen-count').classList.toggle('is-disabled', onlySelected && picked.size > 0);
            mask.querySelectorAll('.moment-gen-person').forEach(b => b.classList.toggle('is-on', picked.has(b.dataset.name)));
            mask.querySelector('.moment-gen-only').classList.toggle('is-disabled', picked.size === 0);
            summary.textContent = picked.size
                ? `${n} 个人，${onlySelected ? '只由' : '必定包含'}：${[...picked].map(x => this._displayName(x)).join('、')}`
                : `${n} 个人，随机挑人发`;
        };
        mask.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => { count = Number(b.dataset.count); paint(); }));
        mask.querySelectorAll('.moment-gen-person').forEach(b => b.addEventListener('click', () => {
            const n = b.dataset.name;
            if (picked.has(n)) picked.delete(n); else picked.add(n);
            if (picked.size > count) count = Math.min(Math.max(...counts), picked.size);
            paint();
        }));
        mask.querySelector('[data-only]')?.addEventListener('change', (e) => { onlySelected = !!e.target.checked; paint(); });
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            mask.remove();
            const names = this._pickNoteOwners(contacts.map(c => c.name), { count, mustInclude: [...picked], onlySelected });
            this.generateNotesFor(names);
        });
        paint();
    }

    // 挑人：必选的先放进去，不够再从其他人里随机补（有聊天记录的人优先）
    _pickNoteOwners(all = [], { count = 3, mustInclude = [], onlySelected = false } = {}) {
        const must = mustInclude.filter(n => all.includes(n));
        if (onlySelected && must.length) return must;
        const out = [...must];
        const rest = all.filter(n => !out.includes(n));
        const chatted = rest.filter(n => this._findChatIdFor(n));
        const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        const pool = [...shuffle(chatted), ...shuffle(rest.filter(n => !chatted.includes(n)))];
        while (out.length < count && pool.length) out.push(pool.shift());
        return out;
    }

    /**
     * 一次给多个人生成便签（一个请求），没写到的人再单独补
     * @returns {Promise<string[]>} 成功的人
     */
    async generateNotesFor(names = []) {
        const list = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))];
        if (!list.length) return [];
        if (list.length === 1) {
            this._genBusy = true;
            this.app.phoneShell?.showNotification?.('Mind', `正在按剧情生成 ${this._displayName(list[0])} 的便签…`, '🎲');
            try {
                const ok = await this.generateNoteFor('', list[0], { manual: true });
                this.app.phoneShell?.showNotification?.('Mind', ok ? `${this._displayName(list[0])}：${this._noteLine(this.getNoteOf(list[0]))}` : '生成失败，请检查 API 设置后再试', ok ? '💭' : '⚠️');
                return ok ? list : [];
            } finally { this._genBusy = false; }
        }
        const apiManager = window.VirtualPhone?.apiManager;
        if (!apiManager?.callAI) { this.app.phoneShell?.showNotification?.('Mind', '没有可用的 API', '⚠️'); return []; }
        this._genBusy = true;
        this.app.phoneShell?.showNotification?.('Mind', `正在按剧情生成 ${list.length} 条便签…`, '🎲');
        const done = [];
        try {
            const userName = this.app.wechatData.getUserInfo?.()?.name || '用户';
            const statusList = MIND_STATUS_GROUPS.flatMap(g => g.items.map(i => i[2])).join('、');
            const blocks = list.map(name => {
                const cid = this._findChatIdFor(name);
                const msgs = (cid ? (this.app.wechatData.getMessages(cid) || []) : []).slice(-8)
                    .filter(m => m && m.type !== 'system')
                    .map(m => `  ${m.from === 'me' ? userName : name}: ${String(m.replyText || m.content || '').replace(/\s+/g, ' ').slice(0, 80)}`).join('\n');
                const own = this.getNoteOf(name);
                const persona = this._personaOf(name).slice(0, 500);
                return [`【${name}】`, persona ? `人设：${persona}` : '', own ? `旧便签（不要重复）：${this._noteLine(own)}` : '', msgs ? `和${userName}最近的聊天：\n${msgs}` : ''].filter(Boolean).join('\n');
            }).join('\n\n');
            const story = this._recentStory();
            const prompt = [
                `请分别以下面每个人的口吻，按各自的人设、当前剧情和最近的聊天，给每人写一条新的 Mind 心情便签（像状态签名，20 字以内，可带 emoji，要能看出此刻的心情/在做什么/在想谁），每人一条，风格要有区别。`,
                story ? `\n【当前剧情（最近）】\n${story}` : '',
                `\n${blocks}`,
                `\n每人输出一行，共 ${list.length} 行，格式：名字|便签内容|状态\n名字必须是：${list.join('、')}\n状态从这些里选一个（可留空）：${statusList}\n不要输出解释或其它内容。`
            ].filter(Boolean).join('\n');
            let raw = '';
            try {
                const res = await apiManager.callAI([
                    { role: 'system', content: '你是角色扮演助手，只按要求的格式输出。', isPhoneMessage: true },
                    { role: 'user', content: prompt, isPhoneMessage: true }
                ], { appId: 'wechat', max_tokens: 200 + list.length * 120 });
                if (!(res && res.success === false)) raw = String(res?.summary || res?.content || res?.text || '');
            } catch (e) { console.warn('[Mind] 批量生成便签失败', e); }
            const cleaned = raw.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
            cleaned.split(/\r?\n/).forEach(line => {
                const parts = line.replace(/^[-*•\d.、\s]+/, '').replace(/^【|】/g, '').split(/[|｜]/).map(x => x.trim());
                if (parts.length < 2) return;
                const who = list.find(n => parts[0] === n || parts[0].replace(/[\[\]【】「」:：\s]/g, '') === n || this._displayName(n) === parts[0]);
                if (!who || done.includes(who)) return;
                const text = String(parts[1] || '').replace(/^["“「『]|["”」』]$/g, '').trim().slice(0, 40);
                if (!text) return;
                this.setOtherNote(who, { text, status: findStatus(parts[2] || '') }, { chatId: this._findChatIdFor(who), roundId: '' });
                done.push(who);
            });
            // 模型漏掉的人：单独补
            for (const name of list.filter(n => !done.includes(n))) {
                if (await this.generateNoteFor('', name, { manual: true })) done.push(name);
            }
            this._refreshList();
            this.app.phoneShell?.showNotification?.('Mind', done.length ? `已生成 ${done.length} 条便签：${done.map(n => this._displayName(n)).join('、')}` : '生成失败，请检查 API 设置后再试', done.length ? '💭' : '⚠️');
            return done;
        } finally {
            this._genBusy = false;
        }
    }

    _ensureReplyCard(chatId, st) {
        if (!st.replyAllowed) return;
        const note = this.getMyNote();
        if (!note || this._hasReplied(chatId, note.id)) return;
        const batch = this.app.chatView?._currentResponseBatchId;
        const data = this.app.wechatData;
        const msgs = data.getMessages?.(chatId) || [];
        const round = msgs.filter(m => m && m.from !== 'me' && (!m.type || m.type === 'text') && String(m.content || '').trim() && (!batch || m.replyBatchId === batch));
        if (!round.length) return;
        const keys = [note.status?.label, ...String(note.text || '').replace(/[\s\p{P}\p{S}]/gu, '').split('')].filter(Boolean);
        let best = null; let bestScore = 0;
        round.forEach(m => {
            const c = String(m.content || '');
            let score = 0;
            if (note.status?.label && c.includes(note.status.label)) score += 5;
            if (/便签|状态|心情|mind/i.test(c)) score += 4;
            keys.forEach(k => { if (k.length === 1 && c.includes(k)) score += 0.3; });
            if (score > bestScore) { bestScore = score; best = m; }
        });
        const target = best && bestScore >= 1 ? best : round[Math.min(round.length - 1, Math.floor(round.length / 2))];
        target.type = 'mind_reply';
        target.replyText = target.content;
        target.mindNote = { owner: 'me', noteId: note.id, text: note.text, status: note.status || null, image: note.image || '', theme: themeKey(note.theme) };
        st.replyAllowed = false;
        if (data._messagesDirty) data._messagesDirty[chatId] = true;
        data._saveMessages?.(chatId);
        data.saveData?.();
        const viewing = this.app.currentChat?.id === chatId;
        if (viewing) this.app.chatView?._refreshVisibleChatMessages?.(chatId);
    }

    // 在聊天回复里处理 [回复便签] / [便签:内容|状态]
    handleTags({ chatId = '', chat = null, sender = '', text = '', senderIsMe = false, isGroup = false } = {}) {
        let out = String(text || '');
        let acted = false;
        if (senderIsMe) {
            return { text: out.replace(/\[回复便签\]/g, '').replace(/\[便签[:：][^\]]*\]/g, ''), acted };
        }
        // 模型偶尔会写成全角括号：【便签：…】/【回复便签】
        out = out.replace(/【\s*回复便签\s*】/g, '[回复便签]').replace(/【\s*便签\s*[:：]([^】]*)】/g, '[便签:$1]');
        const st = this._round[String(chatId || '')] || {};
        const data = this.app.wechatData;
        const senderKey = isGroup ? (this.app.chatView?._resolveGroupMemberKey?.(chat, sender) || sender) : (this._contactKeyForChat(chat) || sender);

        out = out.replace(/\[便签[:：]\s*([^\]|｜]*?)\s*(?:[|｜]\s*([^\]]*?))?\s*\]/g, (m, rawText, rawStatus) => {
            if (st.updateAllowed !== true) return '';
            st.updatedThisRound = true;
            const status = findStatus(rawStatus);
            this.setOtherNote(senderKey, { text: String(rawText || '').trim(), status }, { chatId, roundId: st.roundId });
            acted = true;
            return '';
        });

        const hadTag = /\[回复便签\]/.test(out) || st.attachNext === true;
        if (/[\[【]\s*便签\s*[:：]/.test(text) && st.updateAllowed === true) st.updatedThisRound = true;
        out = out.replace(/\[回复便签\]/g, '');
        // 必定回复：本轮角色的第一条消息就算没写标签，也当作对便签的回复
        if (hadTag) {
            const note = this.getMyNote();
            const store = this._store();
            if (!isGroup && note && st.replyAllowed && !this._hasReplied(chatId, note.id) && this.canSee(senderKey, note)) {
                const body = out.trim();
                // 只有标签这一行 → 记下来，挂到下一条消息上
                if (!body) {
                    st.attachNext = true;
                    return { text: '', acted: true };
                }
                const replyText = /^\[(?:语音条|语音|表情包|图片|视频|用户照片|转账|红包|定位|音乐)/.test(body) ? '' : body;
                store.replied[senderKey] = note.id;
                const avatar = data.getContactByName?.(sender)?.avatar || chat?.avatar || '';
                data.addMessage(chatId, {
                    from: sender, type: 'mind_reply', avatar,
                    replyBatchId: this.app.chatView?._currentResponseBatchId || undefined,
                    mindNote: { owner: 'me', noteId: note.id, text: note.text, status: note.status || null, image: note.image || '', theme: themeKey(note.theme) },
                    replyText,
                    content: replyText || `[回复便签] ${sender}回复了你的便签「${this._noteLine(note)}」`
                });
                st.replyAllowed = false;
                st.attachNext = false;
                this._save();
                acted = true;
                if (replyText) out = '';
            }
        }
        return { text: out, acted };
    }
}

// 从模型输出里取出「便签内容|状态」：容忍思考段落、前缀、引号、代码块
function parseNoteLine(raw = '', owner = '') {
    const text = String(raw || '')
        .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
        .replace(/```[a-z]*|```/gi, '');
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!lines.length) return null;
    // 模型照着聊天格式写成「名字: [便签:内容|状态]」时，直接取标签里面
    const tagged = text.match(/[\[【]\s*(?:新)?便签\s*[:：]\s*([^\]】]+)[\]】]/);
    const own = String(owner || '').trim();
    const ownLine = own ? lines.find(l => l.replace(/^[-*•\d.、\s【\[]+/, '').startsWith(own)) : null;
    const pick = tagged ? tagged[1] : (ownLine || lines.find(l => /[|｜]/.test(l) && !/^(状态|格式)[:：]/.test(l)) || lines.find(l => /便签/.test(l)) || lines[lines.length - 1]);
    let line = pick.replace(/^[-*•\d.、\s]+/, '').replace(/^\[?\s*(?:新)?便签\s*[:：]?/, '').replace(/\]\s*$/, '').trim();
    if (!tagged) line = line.replace(/^[^:：|｜\s]{1,12}\s*[:：]\s*(?=\S)/, '');
    line = line.replace(/^["“「『]|["”」』]$/g, '').trim();
    let segs = line.split(/[|｜]/).map(x => x.trim());
    // 「名字|内容|状态」：去掉开头的名字
    if (segs.length >= 3 || (own && segs.length >= 2 && segs[0].replace(/[【】\[\]:：\s]/g, '') === own)) segs = segs.slice(1);
    const [t, st] = segs;
    const body = String(t || '').replace(/^["“「『]|["”」』]$/g, '').trim().slice(0, 40);
    if (!body && !st) return null;
    return { text: body, status: String(st || '').trim() };
}
