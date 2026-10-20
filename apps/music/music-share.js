/* ========================================================
 *  柚月小手机 (Yuzuki's Little Phone)
 *  作者 (Author): yuzuki
 *
 * ⚠️ 版权声明 (Copyright Notice):
 * 1. 禁止商业化：本项目仅供交流学习，严禁任何形式的倒卖、盈利等商业行为。
 * 2. 禁止二改发布：严禁未经授权修改代码后作为独立项目二次发布或分发。
 * 3. 禁止抄袭：严禁盗用本项目的核心逻辑、UI设计与相关原代码。
 *
 * Copyright (c) yuzuki. All rights reserved.
 * ======================================================== */
// ========================================
// 🎵 音乐APP - 微信联动（分享到私聊/群聊、一起听）
// ========================================

const newMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export async function getWechatData(storage) {
    let wechatData = window.VirtualPhone?.wechatApp?.wechatData || window.VirtualPhone?.cachedWechatData;
    if (wechatData) return wechatData;
    try {
        const module = await import('../wechat/wechat-data.js');
        wechatData = new module.WechatData(window.VirtualPhone?.storage || storage);
        if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = wechatData;
        return wechatData;
    } catch (error) {
        console.error('🎵 [音乐] 加载微信数据失败:', error);
        return null;
    }
}

export function normalizeAvatarPath(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '👤' || raw === '👥') return '';
    if (/^(?:data:image|https?:\/\/|\/|blob:)/i.test(raw)) return raw;
    const cleaned = raw
        .replace(/^['"]|['"]$/g, '')
        .replace(/^\.?\/*/, '')
        .replace(/^apps\/wechat\/avatars\//i, '')
        .replace(/^wechat\/avatars\//i, '')
        .replace(/^avatars\//i, '');
    if (!cleaned || /\s/.test(cleaned)) return '';
    if (/^(?:male|female)(?:_elder)?\d+$/i.test(cleaned)) {
        return new URL(`../wechat/avatars/${cleaned}.png`, import.meta.url).href;
    }
    if (/^[a-z0-9._-]+\.(?:png|jpg|jpeg|webp|gif)$/i.test(cleaned)) {
        return new URL(`../wechat/avatars/${cleaned}`, import.meta.url).href;
    }
    return '';
}

function resolveContactAvatar(contact, wechatData, excludeAvatar = '') {
    const excluded = normalizeAvatarPath(excludeAvatar);
    const ok = (value) => {
        const normalized = normalizeAvatarPath(value);
        return normalized && normalized !== excluded ? normalized : '';
    };
    const direct = ok(contact?.avatar);
    if (direct) return direct;
    for (const key of [contact?.id, contact?.contactId, contact?.name].filter(Boolean)) {
        const auto = ok(wechatData?.getContactAutoAvatar?.(key));
        if (auto) return auto;
    }
    return '';
}

/**
 * 分享对象列表
 * @returns {{ singles: Array, groups: Array, userAvatar: string }}
 */
export async function listShareTargets(storage) {
    const wechatData = await getWechatData(storage);
    if (!wechatData) return { singles: [], groups: [], userAvatar: '' };

    const userAvatar = wechatData.getUserInfo?.()?.avatar || '';
    const chats = wechatData.getChatList?.() || [];
    const contacts = (wechatData.getContacts?.() || []).filter(c => c && !c.blocked && String(c.name || '').trim());

    const singles = [];
    const seen = new Set();
    // 先按最近聊天排序
    chats.filter(chat => chat && chat.type !== 'group').forEach(chat => {
        const contact = (chat.contactId && wechatData.getContact?.(chat.contactId))
            || contacts.find(c => c.name === chat.name)
            || { id: chat.contactId || '', name: chat.name, avatar: chat.avatar };
        const key = contact.id || contact.name;
        if (!key || seen.has(key)) return;
        seen.add(key);
        singles.push({
            kind: 'single',
            chatId: chat.id,
            contact,
            name: contact.name || chat.name,
            avatar: resolveContactAvatar({ ...contact, avatar: contact.avatar || chat.avatar }, wechatData, userAvatar)
        });
    });
    contacts.forEach(contact => {
        const key = contact.id || contact.name;
        if (seen.has(key)) return;
        seen.add(key);
        singles.push({
            kind: 'single',
            chatId: '',
            contact,
            name: contact.name,
            avatar: resolveContactAvatar(contact, wechatData, userAvatar)
        });
    });

    const groups = chats
        .filter(chat => chat && chat.type === 'group')
        .map(chat => ({
            kind: 'group',
            chatId: chat.id,
            contact: null,
            name: chat.name || '群聊',
            avatar: normalizeAvatarPath(chat.avatar),
            memberCount: Array.isArray(chat.members) ? chat.members.length : 0
        }));

    return { singles, groups, userAvatar };
}

function ensureChat(wechatData, target) {
    if (target.chatId && wechatData.getChat?.(target.chatId)) return wechatData.getChat(target.chatId);
    if (target.kind === 'group') return null;
    const contact = target.contact || {};
    const contactId = String(contact.id || '').trim();
    let chat = contactId ? wechatData.getChatByContactId?.(contactId) : null;
    if (!chat) {
        chat = (wechatData.getChatList?.() || []).find(item =>
            item?.type !== 'group'
            && (typeof wechatData._isSameLookupName === 'function'
                ? wechatData._isSameLookupName(item.name, contact.name)
                : item.name === contact.name));
    }
    if (!chat) {
        chat = wechatData.createChat?.({
            id: contactId ? `chat_${contactId}` : `chat_${Date.now()}`,
            contactId: contactId || undefined,
            name: contact.name,
            type: 'single',
            avatar: contact.avatar || target.avatar || ''
        });
    }
    return chat;
}

function refreshWechat(wechatData, chatId) {
    const wechatApp = window.VirtualPhone?.wechatApp;
    if (!wechatApp) return;
    if (wechatApp.currentChat?.id === chatId && typeof wechatApp.chatView?.smartUpdateMessages === 'function') {
        wechatApp.chatView.smartUpdateMessages(wechatData.getMessages(chatId), wechatData.getUserInfo());
        wechatApp.syncMusicListenHeaderIndicator?.(chatId);
    } else if (!wechatApp.currentChat && wechatApp.currentView === 'chats' && typeof wechatApp.render === 'function') {
        wechatApp.render();
    }
}

const songLabel = (song) => `《${song.name || '未知歌曲'}》${song.artist ? ` - ${song.artist}` : ''}`;

/**
 * 分享歌曲卡片
 * @param {object} target listShareTargets 返回的条目
 * @param {object} song
 * @param {{excerpt?: Array<{txt:string,tr?:string}>, note?: string, text?: string}} extra
 */
export async function shareSongToWechat(storage, target, song, extra = {}) {
    const wechatData = await getWechatData(storage);
    if (!wechatData) throw new Error('微信数据未初始化');
    const chat = ensureChat(wechatData, target);
    if (!chat?.id) throw new Error('找不到这个聊天');

    const userAvatar = wechatData.getUserInfo?.()?.avatar || '';
    const text = String(extra.text || '').trim();
    if (text) {
        wechatData.addMessage(chat.id, { from: 'me', type: 'text', content: text, avatar: userAvatar });
    }

    const excerpt = (extra.excerpt || []).map(line => ({
        txt: String(line.txt || '').trim(),
        tr: String(line.tr || '').trim()
    })).filter(line => line.txt).slice(0, 8);
    const note = String(extra.note || '').trim();

    wechatData.addMessage(chat.id, {
        id: newMessageId(),
        from: 'me',
        type: 'music_share',
        content: `[分享音乐] ${songLabel(song)}`,
        musicShare: {
            songId: song.id || '',
            songName: song.name || '',
            artist: song.artist || '',
            album: song.album || '',
            cover: song.pic || '',
            excerpt,
            note
        },
        avatar: userAvatar
    });
    await Promise.resolve(wechatData.saveData?.());
    refreshWechat(wechatData, chat.id);
    return chat;
}

/** 发起一起听（私聊、群聊都可以） */
export async function inviteListenInWechat(storage, target, snapshot) {
    if (!snapshot) throw new Error('当前没有正在播放的歌曲');
    const wechatData = await getWechatData(storage);
    if (!wechatData) throw new Error('微信数据未初始化');
    const chat = ensureChat(wechatData, target);
    if (!chat?.id) throw new Error('找不到这个聊天');

    const isGroup = target.kind === 'group';
    const partner = isGroup
        ? { id: '', name: chat.name || target.name || '群聊', avatar: target.avatar || chat.avatar || '' }
        : { ...(target.contact || {}), avatar: target.avatar || target.contact?.avatar || '' };

    const listenMessageId = newMessageId();
    wechatData.startMusicListening?.(chat.id, partner, { ...snapshot, sourceMessageId: listenMessageId });
    wechatData.addMessage(chat.id, {
        id: listenMessageId,
        from: 'me',
        type: 'music_listen',
        content: isGroup
            ? `用户在群聊“${partner.name}”发起了一起听歌，当前正在一起听${songLabel({ name: snapshot.songName, artist: snapshot.artist })}。`
            : `用户邀请了“${partner.name || '好友'}”一起听歌。当前正在一起听${songLabel({ name: snapshot.songName, artist: snapshot.artist })}。`,
        musicListen: {
            ...snapshot,
            isGroup,
            contactId: partner.id || '',
            contactName: partner.name || '',
            contactAvatar: partner.avatar || ''
        },
        avatar: wechatData.getUserInfo?.()?.avatar || ''
    });
    await Promise.resolve(wechatData.saveData?.());
    refreshWechat(wechatData, chat.id);
    return chat;
}

/** 在音乐 App 里直接邀请（不往聊天里发卡片），对方加入后微信那边也知道你们在一起听 */
export async function inviteListenInApp(storage, target, snapshot) {
    if (!snapshot) throw new Error('当前没有正在播放的歌曲');
    const wechatData = await getWechatData(storage);
    if (!wechatData) throw new Error('微信数据未初始化');
    const chat = ensureChat(wechatData, target);
    if (!chat?.id) throw new Error('找不到这个好友');
    const partner = { ...(target.contact || {}), name: target.name, avatar: target.avatar || target.contact?.avatar || '' };
    const session = wechatData.startMusicListening?.(chat.id, partner, { ...snapshot, sourceMessageId: '' });
    if (session) session.via = 'app';
    await Promise.resolve(wechatData.saveData?.());
    return chat;
}
