// 💭 Mind 心情便签：发布便签/状态、可见权限、角色回复便签、角色更新自己的便签

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

const QUICK_EMOJIS = ['😊', '🥺', '😭', '😡', '🥰', '😴', '🤔', '😎', '🎉', '💗', '✨', '🌙', '☕', '🍰', '🐱', '🌸'];
const NOTE_TTL = 24 * 3600 * 1000;

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

    publishMine({ text = '', status = null, image = '', visibility = { type: 'public', names: [] } } = {}) {
        const store = this._store();
        store.mine = {
            id: `mind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: String(text || '').trim().slice(0, 60),
            status: status ? { key: status.key, emoji: status.emoji, label: status.label } : null,
            image: String(image || ''),
            time: Date.now(),
            visibility: { type: visibility.type || 'public', names: Array.isArray(visibility.names) ? [...visibility.names] : [] }
        };
        store.replied = {};
        this._save();
    }

    deleteMine() {
        this._store().mine = null;
        this._save();
    }

    setOtherNote(name, { text = '', status = null } = {}) {
        const n = String(name || '').trim();
        if (!n || (!text && !status)) return;
        this._store().others[n] = {
            id: `mind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: String(text || '').trim().slice(0, 40),
            status,
            time: Date.now()
        };
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
            return `<span class="mind-bubble${note ? '' : ' is-empty'}">${this._esc(line)}</span>`;
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
            </div>`;
    }

    bindMindRow(root = document) {
        root.querySelector('[data-mind-me]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.getMyNote()) this.showMyNoteSheet(); else this.showEditor();
        });
        root.querySelectorAll('[data-mind-other]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showOtherNoteSheet(btn.dataset.mindOther);
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

    showMyNoteSheet() {
        const note = this.getMyNote();
        const info = this.app.wechatData.getUserInfo() || {};
        const visText = { public: '所有朋友', private: '仅自己可见', include: '部分可见', exclude: '不给谁看' }[note?.visibility?.type || 'public'];
        const mask = this._mount(`
            <div class="mind-sheet">
                <div class="mind-sheet-head">
                    <span class="mind-sheet-av">${this.app.renderAvatar(info.avatar, '😊', info.name)}</span>
                    <div class="mind-sheet-main">
                        <div><b>${this._esc(info.name || '我')}</b> <small>· ${this._timeAgo(note?.time)} · ${visText}</small></div>
                        <div class="mind-sheet-text">${this._esc(this._noteLine(note))}</div>
                        ${note?.image ? `<img class="mind-sheet-img" src="${this._esc(note.image)}" alt="">` : ''}
                    </div>
                </div>
                <button type="button" class="mind-btn-primary" data-act="new">写新便签</button>
                <button type="button" class="mind-btn-link" data-act="del">删除便签</button>
            </div>`, 'mind-mask is-bottom');
        mask.querySelector('[data-act="new"]').addEventListener('click', () => { mask.remove(); this.showEditor(); });
        mask.querySelector('[data-act="del"]').addEventListener('click', () => {
            mask.remove();
            this.deleteMine();
            this.app.phoneShell?.showNotification?.('Mind', '便签已删除', '🗑️');
            this._refreshList();
        });
    }

    showOtherNoteSheet(name) {
        const note = this.getNoteOf(name);
        if (!note) return;
        const mask = this._mount(`
            <div class="mind-sheet">
                <div class="mind-sheet-head">
                    <span class="mind-sheet-av">${this.app.renderAvatar(this._avatarOf(name), '👤', name)}</span>
                    <div class="mind-sheet-main">
                        <div><b>${this._esc(this._displayName(name))}</b> <small>· ${this._timeAgo(note.time)}</small></div>
                        <div class="mind-sheet-text">${this._esc(this._noteLine(note))}</div>
                    </div>
                </div>
                <div class="mind-reply-box">
                    <input type="text" maxlength="60" placeholder="回复 TA 的便签…">
                    <button type="button" data-act="send">发送</button>
                </div>
            </div>`, 'mind-mask is-bottom');
        const input = mask.querySelector('.mind-reply-box input');
        setTimeout(() => input?.focus(), 50);
        const send = () => {
            const text = String(input.value || '').trim();
            if (!text) return;
            mask.remove();
            this.replyToOther(name, note, text);
        };
        mask.querySelector('[data-act="send"]').addEventListener('click', send);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
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
            mindNote: { owner: name, text: note.text, status: note.status || null, image: '' },
            content: `[回复便签] 回复了${name}的便签「${this._noteLine(note)}」`,
            ...timeFields
        });
        data.addMessage(chat.id, { from: 'me', type: 'text', content: text, avatar, ...timeFields });
        if (chatView?.isOnlineMode?.()) chatView._enqueuePendingChat?.(chat.id);
        this.app.phoneShell?.showNotification?.('Mind', `已回复 ${this._displayName(name)} 的便签`, '💬');
        this._refreshList();
    }

    // ---------------- 编辑器（参考图：气泡 + 头像 + 权限 + 分享） ----------------
    showEditor() {
        const info = this.app.wechatData.getUserInfo() || {};
        const prev = this.getMyNote();
        const draft = {
            text: prev?.text || '',
            status: prev?.status || null,
            image: prev?.image || '',
            visibility: prev?.visibility ? { type: prev.visibility.type, names: [...(prev.visibility.names || [])] } : { type: 'public', names: [] }
        };
        const contacts = (this.app.wechatData.getContacts() || []).filter(c => String(c?.name || '').trim());
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
                    <div class="mind-emoji-row">${QUICK_EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
                    <div class="mind-tools">
                        <label class="mind-tool"><input type="file" accept="image/*" hidden data-img> <span>🖼️ 贴图</span></label>
                        <button type="button" class="mind-tool" data-status-open>🙂 设个状态</button>
                    </div>
                    <div class="mind-vis-row">
                        <select data-vis>
                            <option value="public">所有朋友</option>
                            <option value="private">仅自己可见</option>
                            <option value="include">部分可见</option>
                            <option value="exclude">不给谁看</option>
                        </select>
                        <button type="button" class="mind-share" data-share>分享</button>
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
        const openStatus = () => this.showStatusPicker(draft.status, (st) => { draft.status = st; paint(); });
        chip.addEventListener('click', openStatus);
        mask.querySelector('[data-status-open]').addEventListener('click', openStatus);
        mask.querySelector('[data-img]').addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
                const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = rej; r.readAsDataURL(file); });
                let uploaded = '';
                try { uploaded = (await window.VirtualPhone?.imageManager?.uploadDataUrl?.(dataUrl, 'mind_note')) || ''; } catch (upErr) { uploaded = ''; }
                draft.image = uploaded || dataUrl;
                paint();
            } catch (err) {
                this.app.phoneShell?.showNotification?.('Mind', '图片读取失败', '⚠️');
            }
        });
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
            this.app.phoneShell?.showNotification?.('Mind', '便签已分享', '💭');
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
        const state = { replyAllowed: false, updateAllowed: false, replier: '' };
        if (!isGroupChat && targetChat) {
            const name = this._contactKeyForChat(targetChat);
            const store = this._store();
            if (note && this.canSee(name, note)) {
                const replied = store.replied[name] === note.id;
                const roll = !replied && Math.random() < 0.85;
                lines.push(`【用户的心情便签】用户在 Mind 里发了一条便签（24小时内可见）：「${this._noteLine(note)}」${note.image ? '（附了一张图）' : ''}。${replied ? '你已经回复过这条便签了，不用再回复。' : ''}`);
                if (roll) {
                    state.replyAllowed = true;
                    state.replier = name;
                    lines.push('【回复便签·本轮要回复】本轮请回复用户的这条便签：在回复的第一行单独写 [回复便签]，下一行起像回复动态一样针对便签内容说话（关心、吐槽、调侃都可以，符合人设和最近剧情）。');
                }
            }
            const own = this.getNoteOf(name);
            if (Math.random() < 0.85) {
                state.updateAllowed = true;
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
        return st?.replyAllowed ? '\n- 【回复便签】本轮第一行先写 [回复便签]，再接着回复用户的 Mind 便签。' : '';
    }

    // 在聊天回复里处理 [回复便签] / [便签:内容|状态]
    handleTags({ chatId = '', chat = null, sender = '', text = '', senderIsMe = false, isGroup = false } = {}) {
        let out = String(text || '');
        let acted = false;
        if (senderIsMe) {
            return { text: out.replace(/\[回复便签\]/g, '').replace(/\[便签[:：][^\]]*\]/g, ''), acted };
        }
        const st = this._round[String(chatId || '')] || {};
        const data = this.app.wechatData;
        const senderKey = isGroup ? (this.app.chatView?._resolveGroupMemberKey?.(chat, sender) || sender) : (this._contactKeyForChat(chat) || sender);

        out = out.replace(/\[便签[:：]\s*([^\]|｜]*?)\s*(?:[|｜]\s*([^\]]*?))?\s*\]/g, (m, rawText, rawStatus) => {
            if (st.updateAllowed !== true) return '';
            const status = findStatus(rawStatus);
            this.setOtherNote(senderKey, { text: String(rawText || '').trim(), status });
            acted = true;
            return '';
        });

        if (/\[回复便签\]/.test(out)) {
            out = out.replace(/\[回复便签\]/g, '');
            const note = this.getMyNote();
            const store = this._store();
            if (!isGroup && note && st.replyAllowed && store.replied[senderKey] !== note.id && this.canSee(senderKey, note)) {
                store.replied[senderKey] = note.id;
                const avatar = data.getContactByName?.(sender)?.avatar || chat?.avatar || '';
                data.addMessage(chatId, {
                    from: sender, type: 'mind_reply', avatar,
                    mindNote: { owner: 'me', text: note.text, status: note.status || null, image: note.image || '' },
                    content: `[回复便签] ${sender}回复了你的便签「${this._noteLine(note)}」`
                });
                st.replyAllowed = false;
                this._save();
                acted = true;
            }
        }
        return { text: out, acted };
    }
}
