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
import { ImageCropper } from '../settings/image-cropper.js';
import { uploadPhoneDataUrl, deletePhoneImage } from './image-store.js?v=20261020-m2';
import { applyPhoneTagFilter } from '../../config/tag-filter.js';
import {
    extractImagePromptItems,
    parseImagePromptDescriptionPair,
    removeImagePromptItems
} from '../../config/image-prompt-format.js';
import { readPhoneContextLimit } from '../../config/context-settings.js';
import { replacePhoneEmojiTokens } from '../../config/phone-emoji.js';
import { parseWechatTranslationContent } from './voice-text.js?v=20261016-fix4';

// 朋友圈视图 - 高仿微信版
export class MomentsView {
    constructor(wechatApp) {
        this.app = wechatApp;
        this.isLoading = false;
        this.newPostText = '';
        this.currentCommentMomentId = null;
        this.currentReplyTo = null;
        this.pendingMomentImages = [];
        this.pendingMomentVisibility = {
            type: 'public',
            contactIds: [],
            contactNames: []
        };
        this._postMomentDraftActive = false;
        this._postMomentDraftCommitted = false;
        this._postMomentDraftObserver = null;
        this._momentImageTasks = new Map();
        this._momentImageStateSavePending = false;
    }

    // 在wechat-app的renderDiscover中调用
    renderMomentsPage() {
        this._currentPage = null;
        this.app.wechatData.markAllMomentsRead?.();
        this._migrateMomentTextImages();
        const moments = this.app.wechatData.getMoments();
        const userInfo = this.app.wechatData.getUserInfo();
        const momentsSkin = this._getMomentsSkin();
        const bgImage = momentsSkin === 'wechat' ? userInfo.momentsBackground : '';
        const mainShellBg = String(userInfo.chatListBackground || '').trim();
        const hasMainShellBg = !!mainShellBg;
        const hasBackdrop = !!bgImage || hasMainShellBg;
        const cover = String(userInfo.momentsCover || '').trim();
        const coverStyle = cover
            ? `background-image:url('${this._escapeAttr(cover)}');`
            : '';

        return `
            <div class="moments-page mz-skin-${momentsSkin}" style="overscroll-behavior: none; ${bgImage ? `background-image: url('${bgImage}'); background-size: cover; background-position: center;` : (hasMainShellBg ? 'background: transparent;' : 'background: #fff;')}">
                <div class="moments-pull-refresh-indicator" id="moments-pull-refresh-indicator">
                    <div class="moments-pull-refresh-inner" id="moments-pull-refresh-inner"></div>
                </div>
                <!-- 封面：朋友圈=相册封面；QQ空间=空间头部；LINE=个人主页卡片 -->
                ${momentsSkin === 'qq' ? this._renderQzoneHeaderHtml(moments) : (momentsSkin === 'line' ? this._renderInsTopHtml() : this._renderCoverHtml(''))}
                ${`
                <!-- 朋友圈列表 - 有背景图时透明，无背景图时白色 -->
                <div class="moments-feed" style="background: ${hasBackdrop || momentsSkin !== 'wechat' ? 'transparent' : '#fff'};">
                    ${moments.length === 0 ? `
                        <div class="moments-empty-tip" style="${hasBackdrop ? 'background: rgba(255,255,255,0.34); backdrop-filter: blur(12px) saturate(135%); -webkit-backdrop-filter: blur(12px) saturate(135%); border: 1px solid rgba(255,255,255,0.34); border-radius: 12px; margin: 20px;' : ''}">
                            <p>${momentsSkin === 'line' ? 'No posts yet' : '朋友圈空空如也'}</p>
                            <p class="tip-sub">${momentsSkin === 'line' ? 'Tap the magic wand to generate posts' : '点右上角的魔法棒生成朋友圈'}</p>
                        </div>
                    ` : moments.map(moment => (momentsSkin === 'line' ? this._renderInsPostHtml(moment) : this.renderMomentItem(moment, hasBackdrop && momentsSkin === 'wechat'))).join('')}
                </div>`}
            </div>
        `;
    }

    // 当前风格下“朋友圈”叫什么：微信=朋友圈，QQ=空间，LINE=动态
    _momentsLabel() {
        return ({ qq: '空间', line: '动态' })[this._getMomentsSkin()] || '朋友圈';
    }

    _getMomentsSkin() {
        const attr = document.documentElement.getAttribute('data-wx-moments');
        if (['wechat', 'qq', 'line'].includes(attr)) return attr;
        const st = this.app.getWechatSkin?.() || {};
        const m = st.moments && st.moments !== 'auto' ? st.moments : st.skin;
        return ['wechat', 'qq', 'line'].includes(m) ? m : 'wechat';
    }

    _myMomentStats(moments = []) {
        const mine = moments.filter(m => this._isSelfMoment(m));
        const likes = mine.reduce((n, m) => n + (Array.isArray(m.likeList) ? m.likeList.length : 0), 0);
        const comments = mine.reduce((n, m) => n + (Array.isArray(m.commentList) ? m.commentList.length : 0), 0);
        const friends = (this.app.wechatData.getContacts?.() || []).length;
        return { posts: mine.length, likes, comments, friends };
    }

    // QQ空间头部：头像 + 昵称 + 总量 + 功能入口 + “分享新鲜事”
    _renderQzoneHeaderHtml(moments = []) {
        const info = this.app.wechatData.getUserInfo() || {};
        const cover = String(info.momentsCover || '').trim();
        const st = this._myMomentStats(moments);
        const total = moments.reduce((n, m) => n + 1 + (m.likeList?.length || 0) + (m.commentList?.length || 0), 0) * 7 + 100;
        const lv = Math.max(1, Math.min(64, Math.floor(st.posts / 3) + 1));
        const icon = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
        const items = [
            ['post-text', '说说', icon('<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>')],
            ['post', '发图', icon('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20 16-4.5-4.5L7 19.5"/>')],
            ['album', '相册', icon('<path d="M6 3.5h10.5L19 6v14.5H6z"/><path d="M9 3.5v6l2-1.5 2 1.5v-6"/>')],
            ['generate', '生成', icon('<path d="M5 19 15 9"/><path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="m19 12 .6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z"/>')],
            ['more', '更多', icon('<path d="M4 7h16M4 12h16M4 17h16"/>')]
        ];
        return `
            <div class="mz-head"${cover ? ` style="--mz-cover:url('${this._escapeAttr(cover)}')"` : ''}>
                <div class="mz-profile">
                    <div class="mz-avatar" data-mz-act="album">${this.app.renderAvatar(info.avatar, '😊', info.name)}</div>
                    <div class="mz-info">
                        <div class="mz-name">${this._escapeHtml(info.name || '我')}</div>
                        <div class="mz-badges"><span class="mz-lv">LV${lv}</span><span class="mz-tag">${this._escapeHtml(String(info.signature || '').trim() ? info.signature : '这个人很懒，什么都没写')}</span></div>
                        <div class="mz-total"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>总量 <b>${total}</b><span class="mz-dot">·</span>说说 <b>${st.posts}</b></div>
                    </div>
                </div>
                <div class="mz-icons">${items.map(([act, label, svg]) => `<button type="button" class="mz-icon" data-mz-act="${act}">${svg}<span>${label}</span></button>`).join('')}</div>
                <div class="mz-share" data-mz-act="post" role="button" tabindex="0"><span>分享新鲜事...</span><i class="fa-regular fa-image"></i></div>
            </div>`;
    }

    // LINE（ins 推文风格）：顶部标题
    _renderInsTopHtml() {
        const info = this.app.wechatData.getUserInfo() || {};
        return `<div class="ins-top"><span class="ins-logo">Moments</span><span class="ins-me" data-moment-profile="__me__" role="button" tabindex="0">${this.app.renderAvatar(info.avatar, '😊', info.name)}</span></div>`;
    }

    // ins 推文：头像+名字 → 大图 → 赞/评论/分享 → 赞数 → 配文 → 评论 → 时间
    _renderInsPostHtml(moment, { inProfile = false } = {}) {
        const self = this._isSelfMoment(moment);
        const info = this.app.wechatData.getUserInfo() || {};
        const avatar = self ? (info.avatar || moment.avatar || '😊') : (this.getContactAvatar(moment.name) || moment.avatar || '👤');
        const profileKey = self ? '__me__' : moment.name;
        const shownName = self ? (this._getInsProfile('__me__').name || info.name || moment.name) : (this._getInsProfile(moment.name).name || this._displayName(moment.name));
        const images = Array.isArray(moment.images) ? moment.images : [];
        const t = moment.text ? this._renderTranslatableText(moment.name, moment.text) : null;
        const liked = moment.likeList?.includes(info.name);
        const likeCount = moment.likeList?.length || 0;
        const location = String(moment.location || '').trim();
        const heart = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.3s-7.5-4.6-7.5-10.1C4.5 7.3 6.6 5.3 9 5.3c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.4 0 4.5 2 4.5 4.9 0 5.5-7.5 10.1-7.5 10.1z"/></svg>`;
        const bubble = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 11.5a8 8 0 1 1-3.6-6.7A8 8 0 0 1 20 11.5z"/><path d="M20 20l-2.6-3"/></svg>`;
        const plane = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 10 13.5M21 3l-6.5 18-4.5-7.5L2.5 9z"/></svg>`;
        const mid = this._escapeAttr(moment.id);
        const pinned = this._isPinned(moment.id);
        void likeCount;
        return `
            <div class="moment-item ins-post" data-moment-id="${this._escapeAttr(moment.id)}">
                <div class="ins-head">
                    <div class="ins-avatar" data-moment-profile="${this._escapeAttr(profileKey)}" role="button" tabindex="0">${this.app.renderAvatar(avatar, '👤', moment.name)}</div>
                    <div class="ins-name" data-moment-profile="${this._escapeAttr(profileKey)}" role="button" tabindex="0">${this._escapeHtml(shownName)}${location ? `<span class="ins-loc">${this._escapeHtml(location)}</span>` : ''}</div>
                </div>
                ${images.length && t ? `<div class="ins-caption ins-caption-top">${t.main}</div>` : ''}
                ${images.length ? `<div class="ins-media">${this.renderImages(images, moment)}</div>` : (t ? `<div class="ins-textcard">${t.main}</div>` : '')}
                <div class="ins-acts">
                    <button type="button" data-mz-act="like" data-moment-id="${mid}" class="${liked ? 'is-on' : ''}" aria-label="Like">${heart}</button>
                    <button type="button" data-mz-act="comment" data-moment-id="${mid}" aria-label="Comment">${bubble}</button>
                    <span class="ins-acts-gap"></span>
                    ${this._isMomentShareable(moment) ? `<button type="button" class="ins-sub" data-mz-act="share" data-moment-id="${mid}" aria-label="Share" title="Share"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10 13.5M21 3l-6.5 18-4.5-7.5L2.5 9z"/></svg></button>` : ''}
                    ${this._isPrivateMoment(moment) ? '' : `<button type="button" class="ins-sub" data-mz-act="ai" data-moment-id="${mid}" aria-label="Friends react" title="Friends react"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 15 9"/><path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="m19 12 .6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z"/></svg></button>`}
                    ${self || inProfile ? `<button type="button" class="ins-sub${pinned ? ' is-on' : ''}" data-mz-act="pin" data-moment-id="${mid}" aria-label="${pinned ? 'Unpin' : 'Pin'}" title="${pinned ? 'Unpin' : 'Pin'}"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5z"/><path d="M12 12v8.5"/></svg></button>` : ''}
                    <button type="button" class="ins-sub" data-mz-act="edit" data-moment-id="${mid}" aria-label="Edit" title="Edit"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></button>
                    <button type="button" class="ins-sub" data-mz-act="delete" data-moment-id="${mid}" aria-label="Delete" title="Delete"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5h15"/><path d="M9 6.5V4.5h6v2"/><path d="M6.5 6.5 7.5 20h9l1-13.5"/><path d="M10 10.5v6M14 10.5v6"/></svg></button>
                </div>
                ${this._renderInsLikesHtml(moment)}
                ${t ? t.fold : ''}
                ${this.renderInteractions(moment)}
                <div class="ins-time">${this._escapeHtml(this.formatTime(moment.time))}</div>
            </div>`;
    }

    // ins 的点赞数：认识的人 + 自动生成的路人点赞（按动态固定，不会每次刷新都变）
    _insExtraLikes(moment) {
        const v = Number(moment?.insExtraLikes);
        if (Number.isFinite(v) && v >= 0) return v;
        const h = this._insHash(`likes_${moment?.id || moment?.text || ''}`);
        const self = this._isSelfMoment(moment);
        return self ? 3 + (h % 58) : 8 + (h % 240);
    }

    _insLikeTotal(moment) {
        return (moment?.likeList?.length || 0) + this._insExtraLikes(moment);
    }

    // “Liked by A, B and 23 others”
    _renderInsLikesHtml(moment) {
        const rawLikes = Array.isArray(moment?.likeList) ? moment.likeList : [];
        // 我点了赞就排第一个（显示我的网名）
        const sorted = [...rawLikes.filter(n => this._isSelfName(n)), ...rawLikes.filter(n => !this._isSelfName(n))];
        const names = [...new Set(sorted.map(n => this._displayName(n)).filter(Boolean))];
        const total = this._insLikeTotal(moment);
        if (!total) return '';
        const fmt = (n) => n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : n.toLocaleString('en-US');
        if (!names.length) return `<div class="ins-likes"><b>${fmt(total)} likes</b></div>`;
        const shown = names.slice(0, 2);
        const others = total - shown.length;
        const who = shown.map(n => `<b>${this._escapeHtml(n)}</b>`).join(', ');
        return `<div class="ins-likes">Liked by ${who}${others > 0 ? ` and <b>${fmt(others)} other${others > 1 ? 's' : ''}</b>` : ''}</div>`;
    }

    // ins 主页资料：可编辑（名字 / 签名 / 动态 / 获赞 / 关注 / 粉丝）
    _getInsProfile(key = '__me__') {
        const map = this.app.wechatData.getUserInfo()?.momentsInsProfiles;
        const p = map && typeof map === 'object' ? map[key] : null;
        return p && typeof p === 'object' ? p : {};
    }

    _insHash(text = '') {
        let h = 7;
        for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return h;
    }

    _insProfileData(key = '__me__') {
        const data = this.app.wechatData;
        const info = data.getUserInfo() || {};
        const self = key === '__me__' || this._isSelfName(key);
        const norm = v => String(v || '').trim();
        let list;
        let name;
        let sign;
        if (self) {
            list = (data.getMoments() || []).filter(m => this._isSelfMoment(m));
            name = info.name || '我';
            sign = info.signature || '';
        } else {
            const contact = data.getContactByName?.(key);
            const aliases = new Set([key, contact?.name, contact?.realName].map(norm).filter(Boolean));
            list = (data.getMoments() || []).filter(m => !this._isSelfMoment(m) && aliases.has(norm(m?.name)));
            name = this._displayName(key);
            sign = this._getContactSignature(key, contact);
        }
        const p = this._getInsProfile(self ? '__me__' : key);
        const h = this._insHash(self ? `me_${name}` : key);
        const likes = list.reduce((n, m) => n + this._insLikeTotal(m), 0);
        const pick = (v, d) => (v === '' || v === undefined || v === null ? d : v);
        return {
            self,
            key: self ? '__me__' : key,
            list,
            avatar: self ? info.avatar : (this.getContactAvatar(key) || '👤'),
            name: pick(p.name, name),
            sign: pick(p.sign, sign),
            posts: pick(p.posts, String(list.length)),
            likes: pick(p.likes, String(likes)),
            following: pick(p.following, String(self ? (data.getContacts?.() || []).length : 40 + (h % 260))),
            followers: pick(p.followers, String(self ? (data.getContacts?.() || []).length : 120 + (h % 4800))),
            cover: String(p.cover || '')
        };
    }

    showInsProfilePage(key = '__me__') {
        const d = this._insProfileData(key);
        const view = this._insProfileView === 'list' ? 'list' : 'grid';
        const tiles = d.list.map(m => {
            const imgs = Array.isArray(m.images) ? m.images : [];
            const url = imgs.length ? this._momentThumbUrl(m, 0) : '';
            const text = this._momentPlainText(m);
            return `<div class="ins-tile${url ? '' : ' is-text'}" data-mz-open="${this._escapeAttr(m.id)}" role="button" tabindex="0">${url ? `<img src="${this._escapeAttr(url)}" alt="">` : `<span>${this._escapeHtml(text.slice(0, 40) || '…')}</span>`}${imgs.length > 1 ? `<em>${imgs.length}</em>` : ''}</div>`;
        }).join('');
        const stat = (field, label) => `<div data-ins-edit="${field}" role="button" tabindex="0"><b>${this._escapeHtml(d[field])}</b><span>${label}</span></div>`;
        const body = `
            <div class="moments-page is-profile ins-profile-page" style="background:#fff;">
                <div class="ins-pf${d.cover ? ' has-cover' : ''}"${d.cover ? ` style="--ins-cover:url('${this._escapeAttr(d.cover)}')"` : ''}>
                    ${d.cover ? '<div class="ins-pf-cover"></div>' : ''}
                    <button type="button" class="ins-pf-cover-btn" data-ins-cover aria-label="背景图" title="${d.cover ? '更换 / 移除背景图' : '上传背景图'}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8.5 8"/></svg></button>
                    <input type="file" accept="image/*" data-ins-cover-file hidden>
                    <div class="ins-pf-avatar">${this.app.renderAvatar(d.avatar, d.self ? '😊' : '👤', d.name)}</div>
                    <div class="ins-pf-name" data-ins-edit="name" role="button" tabindex="0">${this._escapeHtml(d.name)}</div>
                    <div class="ins-pf-sign" data-ins-edit="sign" role="button" tabindex="0">${this._escapeHtml(d.sign || 'Add bio')}</div>
                    <div class="ins-pf-stats">${stat('posts', 'Posts')}${stat('likes', 'Likes')}${stat('following', 'Following')}${stat('followers', 'Followers')}</div>
                    ${d.self ? `<div class="ins-pf-btns"><button type="button" data-mz-act="post"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg> New post</button></div>` : ''}
                </div>
                <div class="ins-pf-tabs">
                    <button type="button" class="${view === 'grid' ? 'active' : ''}" data-ins-view="grid" aria-label="宫格"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg></button>
                    <button type="button" class="${view === 'list' ? 'active' : ''}" data-ins-view="list" aria-label="列表"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg></button>
                </div>
                ${!d.list.length ? `<div class="ins-empty">${d.self ? 'No posts yet' : 'No posts yet'}</div>` : (view === 'grid' ? `<div class="ins-grid">${tiles}</div>` : `<div class="moments-feed">${d.list.map(m => this._renderInsPostHtml(m, { inProfile: true })).join('')}</div>`)}
            </div>`;
        const reopen = () => this.showInsProfilePage(key);
        this._showSubPage(this._renderSubPageShell(body, { title: '' }), 'wechat-moments-ins-profile', reopen);
        const root = this._root();
        root.querySelectorAll('[data-ins-view]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._insProfileView = btn.dataset.insView;
            reopen();
        }));
        root.querySelectorAll('[data-ins-edit]').forEach(el => el.addEventListener('click', (e) => {
            e.stopPropagation();
            this._editInsProfileField(d.key, el.dataset.insEdit, d[el.dataset.insEdit], reopen);
        }));
        // 🖼️ 主页背景图：存到小手机自己的图片文件夹（不进酒馆全局背景）
        const fileInput = root.querySelector('[data-ins-cover-file]');
        root.querySelector('[data-ins-cover]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!d.cover) { fileInput?.click(); return; }
            const mask = this._mountMomentSheet(`
                <div class="moment-dialog" role="dialog">
                    <div class="moment-dialog-title">主页背景图</div>
                    <div class="moment-dialog-actions">
                        <button type="button" data-cover-del>移除</button>
                        <button type="button" data-sheet-close>取消</button>
                        <button type="button" class="is-primary" data-cover-new>更换</button>
                    </div>
                </div>`);
            mask.querySelector('[data-cover-new]')?.addEventListener('click', () => { mask.remove(); fileInput?.click(); });
            mask.querySelector('[data-cover-del]')?.addEventListener('click', () => {
                mask.remove();
                this._setInsCover(d.key, '', d.cover).then(reopen);
            });
        });
        fileInput?.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (!file) return;
            try {
                this.app.phoneShell?.showNotification?.('背景图', '正在保存…', '🖼️');
                const dataUrl = await this._shrinkImageFile(file, 1080);
                const path = await uploadPhoneDataUrl(dataUrl, 'ins_cover');
                await this._setInsCover(d.key, path, d.cover);
                reopen();
            } catch (err) {
                console.warn('⚠️ 主页背景图保存失败:', err);
                this.app.phoneShell?.showNotification?.('背景图', '保存失败，请换一张图试试', '❌');
            }
        });
    }

    async _setInsCover(key, path, oldPath = '') {
        const store = this._userInfoStore();
        if (!store.momentsInsProfiles || typeof store.momentsInsProfiles !== 'object') store.momentsInsProfiles = {};
        const p = { ...(store.momentsInsProfiles[key] || {}) };
        if (path) p.cover = path; else delete p.cover;
        store.momentsInsProfiles[key] = p;
        await this.app.wechatData.saveData();
        if (oldPath && oldPath !== path) {
            try { await deletePhoneImage(oldPath, { skipIfReferenced: false }); } catch (e) { /* 忽略 */ }
        }
    }

    // 图片缩到合适大小再存（手机拍的原图太大）
    _shrinkImageFile(file, maxSide = 1080) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('图片格式不支持'));
                img.onload = () => {
                    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.86));
                };
                img.src = String(reader.result || '');
            };
            reader.readAsDataURL(file);
        });
    }

    _editInsProfileField(key, field, current, done) {
        const labels = { name: 'Name', sign: 'Bio', posts: 'Posts', likes: 'Likes', following: 'Following', followers: 'Followers' };
        const isNum = ['posts', 'likes', 'following', 'followers'].includes(field);
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog" role="dialog">
                <div class="moment-dialog-title">Edit ${labels[field] || ''}</div>
                <label class="moment-field">${field === 'sign'
                    ? `<textarea data-f="v" rows="3" maxlength="80" placeholder="Write something…">${this._escapeHtml(current || '')}</textarea>`
                    : `<input data-f="v" type="text" maxlength="${isNum ? 12 : 24}" value="${this._escapeAttr(current || '')}" placeholder="${isNum ? 'e.g. 1.2K, 52K' : ''}">`}</label>
                <div class="moment-dialog-actions">
                    <button type="button" data-reset>Reset</button>
                    <button type="button" data-sheet-close>Cancel</button>
                    <button type="button" class="is-primary" data-ok>Save</button>
                </div>
            </div>`);
        const write = (value) => {
            const store = this._userInfoStore();
            if (!store.momentsInsProfiles || typeof store.momentsInsProfiles !== 'object') store.momentsInsProfiles = {};
            const p = { ...(store.momentsInsProfiles[key] || {}) };
            if (value === null) delete p[field]; else p[field] = value;
            store.momentsInsProfiles[key] = p;
            this.app.wechatData.saveData();
            mask.remove();
            done?.();
        };
        mask.querySelector('[data-ok]')?.addEventListener('click', () => write(String(mask.querySelector('[data-f="v"]')?.value || '').trim()));
        mask.querySelector('[data-reset]')?.addEventListener('click', () => write(null));
    }

    _bindMomentsSkinEvents() {
        const root = this._root();
        const page = root.querySelector('.moments-page');
        if (!page || page.dataset.mzBound === '1') return;
        page.dataset.mzBound = '1';
        page.addEventListener('click', (e) => {
            const open = e.target.closest('[data-mz-open]');
            if (open) {
                e.stopPropagation();
                this.showMomentDetailPage(open.dataset.mzOpen, null);
                return;
            }
            const delBtn = e.target.closest('.mc-del');
            if (delBtn) {
                e.stopPropagation();
                const row = delBtn.closest('.comment-row');
                if (row) this._confirmDeleteMyComment(row.dataset.momentId, Number(row.dataset.commentIdx));
                return;
            }
            const replyBtn = e.target.closest('.mc-reply');
            if (replyBtn) {
                const row = replyBtn.closest('.comment-row');
                if (row) {
                    e.stopPropagation();
                    this.showCommentInput(row.dataset.momentId, row.dataset.author);
                }
                return;
            }
            const el = e.target.closest('[data-mz-act]');
            if (!el) return;
            e.stopPropagation();
            const act = el.dataset.mzAct;
            const id = el.dataset.momentId || el.closest('.moment-item')?.dataset.momentId || '';
            if (act === 'post-text') return this.showPostMomentPage({ textOnly: true });
            if (act === 'post') return this.showPostTypeSheet();
            if (act === 'album') return this.showMyAlbumPage();
            if (act === 'sign') return this.editSignature();
            if (act === 'generate') return this.showGenerateMomentsSheet?.();
            if (act === 'more') return this.showPostTypeSheet();
            if (act === 'line-grid' || act === 'line-list') {
                this._lineMomentsView = act === 'line-list' ? 'list' : 'grid';
                this.app.render();
                return;
            }
            if (!id) return;
            if (act === 'like') return this.toggleLike(id);
            if (act === 'comment') return this.showCommentInput(id);
            if (act === 'ai') return this._triggerFriendsReact(id);
            if (act === 'pin') return this.togglePinMoment(id);
            if (act === 'edit') return this.showEditMomentSheet(id);
            if (act === 'delete') return this.confirmDeleteMoment(id);
            if (act === 'share') {
                const m = this.app.wechatData.getMoment(id);
                if (this._isMomentShareable(m)) return this.showShareMomentSheet(id);
                this.app.phoneShell?.showNotification?.('提示', '私密或设了可见范围的动态不能分享', 'ℹ️');
            }
        });
    }

    // 把正文里残留的 [图片-xx]（描述）（tag） 标签挪到图片里（旧数据 / AI 写进正文的）
    _splitInlineMomentImageTokens(rawText = '') {
        const text = String(rawText || '');
        const re = /\[(图片(?:-[^\]\r\n]*)?|用户照片|视频)\]/g;
        const images = [];
        let out = '';
        let last = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
            let j = m.index + m[0].length;
            let groups = 0;
            while (groups < 2) {
                let k = j;
                while (k < text.length && /[ \t]/.test(text[k])) k++;
                if (text[k] !== '（' && text[k] !== '(') break;
                let depth = 0;
                let e = k;
                for (; e < text.length; e++) {
                    const ch = text[e];
                    if (ch === '（' || ch === '(') depth++;
                    else if (ch === '）' || ch === ')') { depth--; if (depth === 0) { e++; break; } }
                }
                j = e;
                groups++;
            }
            if (groups === 0) continue;
            images.push(text.slice(m.index, j).trim());
            out += text.slice(last, m.index);
            last = j;
            re.lastIndex = j;
        }
        out += text.slice(last);
        return { text: out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), images };
    }

    _cleanMomentTextAndImages(rawText = '', rawImages = []) {
        const parsed = parseWechatTranslationContent(String(rawText || ''));
        const hasTag = /\[\s*翻译\s*[:：]|【\s*翻译\s*[:：]/.test(String(rawText || ''));
        let body = hasTag ? parsed.speechText : String(rawText || '');
        let zh = hasTag ? parsed.translationText : '';
        let extracted = { text: body, images: [] };
        try { extracted = this._extractMomentImageTagsFromText(body); } catch (e) { /* 忽略 */ }
        const local = this._splitInlineMomentImageTokens(extracted.text);
        const images = [...(Array.isArray(rawImages) ? rawImages : []), ...(extracted.images || []), ...local.images];
        body = local.text;
        if (zh) zh = this._splitInlineMomentImageTokens(zh).text;
        const text = zh ? `${body} [翻译:${zh}]` : body;
        return { text, images: images.slice(0, 9) };
    }

    _migrateMomentTextImages() {
        const moments = this.app.wechatData.data?.moments;
        if (!Array.isArray(moments)) return;
        let changed = false;
        moments.forEach(moment => {
            const text = String(moment?.text || '');
            if (!/\[(?:图片|用户照片|视频)/.test(text)) return;
            const cleaned = this._cleanMomentTextAndImages(text, moment.images);
            if (cleaned.text !== text) {
                moment.text = cleaned.text;
                moment.images = cleaned.images;
                changed = true;
            }
        });
        if (changed) this.app.wechatData.saveData();
    }

    // 🌐 发帖人/评论人的翻译设置（跟随 TA 私聊窗口）
    _getAuthorTranslation(name = '') {
        const userName = String(this.app.wechatData.getUserInfo()?.name || '').trim();
        const key = String(name || '').trim();
        if (!key || key === userName) return { on: false, autoExpand: false, label: '' };
        const t = this.app.wechatData.getMemberTranslationSettings?.(key) || {};
        const on = !!t.autoTranslate && !!t.translateTo && t.translateTo !== 'zh-CN';
        const label = on ? (this.app.wechatData.getTranslationLanguageLabel?.(t.translateTo) || t.translateTo) : '';
        return { on, autoExpand: !!t.autoExpandTranslation, label };
    }

    // 正文 / 评论：开了翻译 → 先显示译文（外语），紧跟一个「查看翻译」；点一下换成中文、按钮变「查看原文」，再点换回来
    //   我自己发的评论如果翻译过（带 [翻译:] 标签），同样可以切换
    _renderTranslatableText(author, rawText, { size = 16, inline = false } = {}) {
        void inline;
        const raw = String(rawText || '');
        const hasTag = /\[\s*翻译\s*[:：]|【\s*翻译\s*[:：]/.test(raw);
        const parsed = hasTag ? parseWechatTranslationContent(raw) : { speechText: raw, translationText: '' };
        const body = String(parsed.speechText || '').trim();
        const zh = String(parsed.translationText || '').trim();
        const trans = this._getAuthorTranslation(author);
        const mine = this._isSelfName(author);
        const norm = v => String(v || '').replace(/[\s，。！？、,.!?~～…"“”'‘’「」]/g, '');
        // 「译文」其实也是中文（模型偷懒没用外语写）：就别给切换按钮了，免得两边都是中文
        const looksForeign = (v) => {
            const t = String(v || '');
            if (/[\u3040-\u30ff\uac00-\ud7af]/.test(t)) return true;
            const latin = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
            const han = (t.match(/[\u4e00-\u9fff]/g) || []).length;
            return latin > 0 && latin >= han;
        };
        const canToggle = !!zh && norm(body) !== norm(zh) && (trans.on || mine) && looksForeign(body);
        if (!canToggle) {
            // 没开翻译：有中文译文就直接显示中文
            return { main: this._renderEmojiText(trans.on || mine ? body : (zh || body), size), fold: '' };
        }
        this._ensureTransToggleBound();
        const startZh = false; // 默认显示译文（外语），点「查看翻译」才显示中文
        const main = `<span class="mtx${startZh ? ' is-zh' : ''}"><span class="mtx-o">${this._renderEmojiText(body, size)}</span><span class="mtx-z">${this._renderEmojiText(zh, size)}</span><button type="button" class="mtx-btn">${startZh ? '查看原文' : '查看翻译'}</button></span>`;
        return { main, fold: '' };
    }

    // 「查看翻译 / 查看原文」切换：全局只绑一次，正文、评论、详情页、主页都能用
    _ensureTransToggleBound() {
        if (window.__yzMomentTransBound) return;
        window.__yzMomentTransBound = true;
        document.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.mtx-btn');
            if (!btn) return;
            e.stopPropagation();
            e.preventDefault();
            const box = btn.closest('.mtx');
            const zh = !box.classList.contains('is-zh');
            box.classList.toggle('is-zh', zh);
            btn.textContent = zh ? '查看原文' : '查看翻译';
        }, true);
    }

    // 渲染单条朋友圈
    renderMomentItem(moment, hasBgImage = false) {
        const timeStr = this.formatTime(moment.time);
        // 🔥 优先实时从联系人/聊天获取头像，确保头像同步更新
        const contactAvatar = this._isSelfMoment(moment)
            ? (this.app.wechatData.getUserInfo()?.avatar || moment.avatar || '😊')
            : (this.getContactAvatar(moment.name) || moment.avatar || '👤');

        // 🔥 有背景图时，给每条朋友圈添加毛玻璃效果，让背景透出来
        // 使用 rgba 白色背景作为降级方案，确保移动端兼容
        const itemStyle = hasBgImage ? 'background: rgba(255,255,255,0.28); backdrop-filter: blur(10px) saturate(135%); -webkit-backdrop-filter: blur(10px) saturate(135%); border: 1px solid rgba(255,255,255,0.32); margin: 8px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);' : '';
        const textHtml = moment.text ? this._renderTranslatableText(moment.name, moment.text) : null;
        const location = String(moment.location || '').trim();

        return `
            <div class="moment-item" data-moment-id="${moment.id}" style="${itemStyle}">
                <button class="moment-delete-btn" data-moment-id="${moment.id}" title="删除朋友圈">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <!-- 头像 -->
                <div class="moment-avatar-col" data-moment-profile="${this._escapeAttr(this._isSelfMoment(moment) ? '__me__' : moment.name)}" role="button" tabindex="0">
                    ${this.app.renderAvatar(contactAvatar, '👤', moment.name)}
                </div>

                <!-- 内容区 -->
                <div class="moment-content-col">
                    <!-- 发布者名字 -->
                    <div class="moment-author" data-moment-profile="${this._escapeAttr(this._isSelfMoment(moment) ? '__me__' : moment.name)}" role="button" tabindex="0">${this._escapeHtml(this._isSelfMoment(moment) ? (this.app.wechatData.getUserInfo()?.name || moment.name) : this._displayName(moment.name))}</div>

                    <!-- 文字内容 -->
                    ${textHtml ? `<div class="moment-text">${textHtml.main}</div>${textHtml.fold}` : ''}

                    <!-- 图片 -->
                    ${this.renderImages(moment.images, moment)}

                    ${location ? `<div class="moment-location"><i class="fa-solid fa-location-dot"></i> ${this._escapeHtml(location)}</div>` : ''}

                    <!-- 底部：时间 + 操作 -->
                    <div class="moment-footer">
                        <span class="moment-time">${this._escapeHtml(timeStr)}${!this._isSelfMoment(moment) ? '' : (this._isPrivateMoment(moment) ? ' <i class="fa-solid fa-lock moment-private-icon" title="仅自己可见"></i>' : (this._momentVisibilityType(moment) === 'public' ? '' : ' <i class="fa-solid fa-user-group moment-private-icon" title="部分可见"></i>'))}</span>
                        <div class="moment-action-btn" data-moment-id="${moment.id}">
                            <i class="fa-solid fa-ellipsis"></i>
                        </div>
                    </div>

                    <div class="mz-acts">
                        <button type="button" data-mz-act="like" data-moment-id="${this._escapeAttr(moment.id)}" class="${moment.likeList?.includes(this.app.wechatData.getUserInfo()?.name) ? 'is-on' : ''}" aria-label="赞"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7.5 10.5v9H4.5v-9zM7.5 10.5 11 3.8c1.3 0 2.2 1 2 2.3l-.6 3.4h5.7c1.2 0 2 1 1.8 2.2l-1.3 6.2c-.2 1-1 1.6-2 1.6H7.5"/></svg></button>
                        <button type="button" data-mz-act="comment" data-moment-id="${this._escapeAttr(moment.id)}" aria-label="评论"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4c4.7 0 8.5 3.2 8.5 7.2s-3.8 7.2-8.5 7.2c-1 0-2-.1-2.9-.4L4.5 20l1.3-3.6C4.4 15 3.5 13.2 3.5 11.2 3.5 7.2 7.3 4 12 4z"/></svg></button>
                        <button type="button" data-mz-act="share" data-moment-id="${this._escapeAttr(moment.id)}" aria-label="分享"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M13.5 5.5 20 11.5l-6.5 6v-3.6c-4.5 0-7.4 1.4-9.5 4.6.6-4.9 3.4-9.1 9.5-9.6z"/></svg></button>
                    </div>

                    <!-- 点赞和评论区 -->
                    ${this.renderInteractions(moment)}
                    <div class="mz-say" data-mz-act="comment" data-moment-id="${this._escapeAttr(moment.id)}" role="button" tabindex="0">${this.app.renderAvatar(this.app.wechatData.getUserInfo()?.avatar, '😊', this.app.wechatData.getUserInfo()?.name)}<span>说点什么吧...</span></div>
                </div>
            </div>
        `;
    }

    // 渲染图片
    renderImages(images, moment = null) {
        if (!images || images.length === 0) return '';

        const gridClass = images.length === 1 ? 'single' :
                         images.length === 2 ? 'double' :
                         images.length === 4 ? 'quad' : 'grid';

        return `
            <div class="moment-images ${gridClass}">
                ${images.map((img, index) => `
                    <div class="moment-img-wrapper">
                        ${this.renderMomentImage(img, index, moment)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderMomentImage(rawImage, index, moment = null) {
        const parsed = this._parseMomentImageItem(rawImage);
        const state = this._getMomentImageState(moment, index);
        const statePrompt = this._parsePromptDescriptionPair(state?.prompt || '');
        const promptText = statePrompt.prompt || parsed.promptText || String(rawImage || '').trim();
        const descriptionText = state?.description || statePrompt.description || parsed.descriptionText || promptText;
        const safePrompt = this._escapeHtml(descriptionText || '图片描述');
        const safeTags = this._escapeHtml(promptText);
        if (parsed.isDirectImage) {
            return `
                <div class="moment-image-generated-box">
                    <img src="${this._escapeAttr(parsed.realUrl)}" class="moment-img" data-moment-image-url="${this._escapeAttr(parsed.realUrl)}">
                    <button class="moment-image-regenerate" data-index="${index}" data-prompt="${this._escapeAttr(promptText)}" data-description="${this._escapeAttr(descriptionText)}" title="重新生成">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button class="moment-image-show-desc" title="查看图片描述">描述</button>
                    <div class="moment-image-desc-panel">
                        <div class="moment-image-desc-text">
                            <div style="font-weight:700; margin-bottom:4px;">中文描述</div>
                            <div>${safePrompt || '暂无图片描述'}</div>
                            <div style="font-weight:700; margin:8px 0 4px;">英文Tag</div>
                            <div>${safeTags}</div>
                        </div>
                        <button class="moment-image-restore" title="恢复图片">恢复</button>
                    </div>
                </div>
            `;
        }

        const status = state?.status || '';
        const error = state?.error || '';
        const statusText = status === 'loading'
            ? '正在生成，点击取消'
            : (status === 'failed' ? '生成失败，点击重试' : '生成图片');
        const icon = status === 'loading'
            ? '<i class="fa-solid fa-spinner fa-spin"></i>'
            : '<i class="fa-regular fa-image"></i>';
        const previewSeed = encodeURIComponent(`moments_${index}_${promptText}`);
        const previewUrl = `https://picsum.photos/seed/${previewSeed}/480/480`;

        return `
            <div class="moment-image-prompt-box" data-index="${index}" data-prompt="${this._escapeAttr(promptText)}" data-description="${this._escapeAttr(descriptionText)}" title="${this._escapeAttr(descriptionText)}">
                <div class="moment-image-prompt-front">
                    <img src="${previewUrl}" alt="${this._escapeAttr(promptText)}" class="moment-img" style="filter:${status === 'failed' ? 'grayscale(0.2)' : 'none'};">
                    <div class="moment-image-prompt-mask"></div>
                    <div class="moment-image-prompt-generate" data-index="${index}" data-prompt="${this._escapeAttr(promptText)}" data-description="${this._escapeAttr(descriptionText)}">
                        <div class="moment-image-prompt-icon">${icon}</div>
                        <div class="moment-image-prompt-text">${statusText}</div>
                        ${error ? `<div class="moment-image-prompt-error">${this._escapeHtml(error)}</div>` : ''}
                    </div>
                    <button class="moment-image-show-desc" title="查看图片描述">描述</button>
                </div>
                <div class="moment-image-desc-panel">
                    <div class="moment-image-desc-text">
                        <div style="font-weight:700; margin-bottom:4px;">中文描述</div>
                        <div>${safePrompt || '暂无图片描述'}</div>
                        <div style="font-weight:700; margin:8px 0 4px;">英文Tag</div>
                        <div>${safeTags}</div>
                    </div>
                    <button class="moment-image-restore" title="恢复卡片正面">恢复</button>
                </div>
            </div>
        `;
    }

    // 渲染互动区（点赞+评论）
    renderInteractions(moment) {
        const hasLikes = moment.likeList && moment.likeList.length > 0;
        const hasComments = moment.commentList && moment.commentList.length > 0;
        const replyableNames = new Set();
        const displayComments = hasComments
            ? moment.commentList.map((comment) => {
                const name = String(comment?.name || '').trim();
                const replyTo = String(comment?.replyTo || '').trim();
                const visibleReplyTo = replyTo && replyTo !== name && replyableNames.has(replyTo)
                    ? replyTo
                    : '';
                if (name) replyableNames.add(name);
                return { ...comment, visibleReplyTo };
            })
            : [];

        if (!hasLikes && !hasComments) return '';

        return `
            <div class="moment-interactions">
                ${hasLikes ? `
                    <div class="interaction-likes">
                        <i class="fa-solid fa-heart"></i>
                        <span class="like-names">${moment.likeList.map(name => this._escapeHtml(this._displayName(name))).join('，')}</span>
                    </div>
                ` : ''}

                ${hasComments ? `
                    <div class="interaction-comments">
                        ${displayComments.map((comment, idx) => `
                            <div class="comment-row" data-moment-id="${this._escapeAttr(moment.id)}" data-comment-idx="${idx}" data-author="${this._escapeAttr(comment.name)}">
                                <span class="comment-author">${this._escapeHtml(this._displayName(comment.name))}</span>
                                ${comment.visibleReplyTo ? `<span class="comment-reply">回复</span><span class="comment-author">${this._escapeHtml(this._displayName(comment.visibleReplyTo))}</span>` : ''}
                                <span class="comment-colon">：</span>
                                ${(() => { const t = this._renderTranslatableText(comment.name, comment.text, { size: 15, inline: true }); return `<span class="comment-content">${t.main}</span>${t.fold}`; })()}${this._isSelfName(comment.name) ? '<button type="button" class="mc-reply mc-del">删除</button>' : '<button type="button" class="mc-reply">回复</button>'}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 绑定朋友圈事件
    bindMomentsEvents() {
        try { this._bindMomentsSkinEvents(); } catch (e) { /* 忽略 */ }
        // 🔥 禁止下拉刷新/拖拽
        const momentsPage = this._root().querySelector('.moments-page');
        if (momentsPage) {
            momentsPage.style.overscrollBehavior = 'none';
        }

        this._bindMomentsCoverAndHeader();

        // 🌐 翻译折叠（正文与评论共用；捕获阶段处理，避免触发评论回复）
        const pageEl = this._root().querySelector('.moments-page');
        if (pageEl && pageEl.dataset.transBound !== '1') {
            pageEl.dataset.transBound = '1';
            pageEl.addEventListener('click', (e) => {
                const btn = e.target?.closest?.('.moment-trans-btn');
                if (!btn) return;
                e.stopPropagation();
                e.preventDefault();
                const fold = btn.closest('.moment-trans-fold');
                const open = !fold.classList.contains('expanded');
                fold.classList.toggle('expanded', open);
                btn.textContent = open ? '收起翻译' : '翻译';
            }, true);
        }

        // 操作按钮（点赞/评论弹窗）
        this._root().querySelectorAll('.moment-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const momentId = btn.dataset.momentId;
                this.showActionPopup(btn, momentId);
            });
        });

        this.bindMomentDeleteEvents();

        // 👤 点头像/名字进入个人朋友圈（自己 → 我的相册）
        this._root().querySelectorAll('[data-moment-profile]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openMomentsProfile(el.dataset.momentProfile);
            });
        });
        this._root().querySelector('#moments-cover-avatar')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const page = this._root().querySelector('.moments-page');
            this.openMomentsProfile(page?.dataset.profileName || this.app.wechatData.getUserInfo()?.name || '');
        });
        this._root().querySelectorAll('[data-moments-back]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._goBack();
        }));

        this._root().querySelectorAll('.moment-image-prompt-generate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const momentEl = btn.closest('.moment-item');
                const momentId = momentEl?.dataset?.momentId || '';
                const index = Number.parseInt(btn.dataset.index, 10);
                const parsedPrompt = this._parsePromptDescriptionPair(btn.dataset.prompt || '');
                const promptText = String(parsedPrompt.prompt || btn.dataset.prompt || '').trim();
                const descriptionText = String(btn.dataset.description || '').trim();
                const moment = this._getMomentById(momentId);
                const state = this._getMomentImageState(moment, index);
                if (state?.status === 'loading') {
                    await this.cancelMomentImageGeneration(momentId, index);
                    return;
                }
                await this.generateMomentImage({ momentId, index, promptText, descriptionText });
            });
        });

        this._root().querySelectorAll('.moment-image-regenerate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const momentEl = btn.closest('.moment-item');
                const momentId = momentEl?.dataset?.momentId || '';
                const index = Number.parseInt(btn.dataset.index, 10);
                const parsedPrompt = this._parsePromptDescriptionPair(btn.dataset.prompt || '');
                const promptText = String(parsedPrompt.prompt || btn.dataset.prompt || '').trim();
                const descriptionText = String(btn.dataset.description || '').trim();
                await this.generateMomentImage({ momentId, index, promptText, descriptionText, clearPreviousImage: true });
            });
        });

        this._root().querySelectorAll('.moment-image-show-desc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const box = btn.closest('.moment-image-prompt-box, .moment-image-generated-box');
                if (!box) return;
                box.classList.add('is-desc-open');
            });
        });

        this._root().querySelectorAll('.moment-image-restore').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const box = btn.closest('.moment-image-prompt-box, .moment-image-generated-box');
                if (!box) return;
                box.classList.remove('is-desc-open');
            });
        });

        this._root().querySelectorAll('.moment-img[data-moment-image-url]').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                const imageUrl = e.currentTarget?.dataset?.momentImageUrl || e.currentTarget?.src || '';
                if (imageUrl) {
                    this.app?.phoneShell?.showImageViewer?.(imageUrl, { alt: '朋友圈图片' });
                }
            });
        });

        // 点击评论可以回复（包括自己的评论，方便和其他NPC互动）
        this._root().querySelectorAll('.comment-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // 只有点「回复」才回复，误触评论不再弹输入框
                if (!e.target.closest('.mc-reply') || e.target.closest('.mc-del')) return;
                e.stopPropagation();
                e.preventDefault();
                const momentId = row.dataset.momentId;
                const author = row.dataset.author;
                this.showCommentInput(momentId, author);
            });
        });

        // 🔥 点击其他区域移除内嵌输入框
        this._root().querySelector('.moments-page')?.addEventListener('click', (e) => {
            if (!e.target.closest('.inline-comment-box') &&
                !e.target.closest('[data-mz-act="comment"]') &&
                !e.target.closest('.mc-reply') &&
                !e.target.closest('.action-popup') &&
                !e.target.closest('.comment-row')) {
                this._root().querySelectorAll('.inline-comment-box').forEach(el => el.remove());
                this.currentCommentMomentId = null;
                this.currentReplyTo = null;
            }
            if (!e.target.closest('.moment-delete-btn')) {
                this._root().querySelectorAll('.moment-item.show-delete').forEach(item => item.classList.remove('show-delete'));
            }
        });
    }

    bindMomentDeleteEvents() {
        const longPressMs = 480;
        const clearOtherDeleteStates = () => {
            this._root().querySelectorAll('.moment-item.show-delete').forEach(item => item.classList.remove('show-delete'));
        };

        this._root().querySelectorAll('.moment-item').forEach(item => {
            let pressTimer = null;
            let moved = false;
            let startX = 0;
            let startY = 0;

            const clearTimer = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const showDelete = () => {
                clearOtherDeleteStates();
                item.classList.add('show-delete');
            };

            item.addEventListener('touchstart', (e) => {
                if (e.target?.closest?.('.moment-action-btn, .moment-delete-btn, .inline-comment-box, .action-popup, .comment-row, button, input, textarea')) return;
                const touch = e.touches?.[0];
                if (!touch) return;
                moved = false;
                startX = touch.clientX;
                startY = touch.clientY;
                clearTimer();
                pressTimer = setTimeout(() => {
                    if (!moved) showDelete();
                }, longPressMs);
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                const touch = e.touches?.[0];
                if (!touch) return;
                if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                    moved = true;
                    clearTimer();
                }
            }, { passive: true });

            item.addEventListener('touchend', clearTimer, { passive: true });
            item.addEventListener('touchcancel', clearTimer, { passive: true });
            item.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target?.closest?.('.moment-action-btn, .moment-delete-btn, .inline-comment-box, .action-popup, .comment-row, button, input, textarea')) return;
                clearTimer();
                pressTimer = setTimeout(showDelete, longPressMs);
            });
            item.addEventListener('mouseup', clearTimer);
            item.addEventListener('mouseleave', clearTimer);
            item.addEventListener('mousemove', clearTimer);
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showDelete();
            });
        });

        this._root().querySelectorAll('.moment-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const momentId = String(btn.dataset.momentId || '').trim();
                if (!momentId) return;
                const ok = confirm('确定删除这条朋友圈吗？删除后不可恢复。');
                if (!ok) return;
                const targetMoment = this.app.wechatData.getMoment(momentId);
                const managedImageUrls = this._collectMomentManagedImageUrls(targetMoment);
                const deleted = this.app.wechatData.deleteMoment(momentId);
                if (deleted) {
                    this._cleanupManagedMomentImages(managedImageUrls);
                    this.app.phoneShell.showNotification('已删除', '朋友圈已删除', '✅');
                    this._rerender();
                }
            });
        });
    }

    bindMomentsPullRefresh() {
        const momentsPage = this._root().querySelector('.moments-page');
        if (!momentsPage || momentsPage.dataset.pullRefreshBound === '1' || momentsPage.classList.contains('is-profile')) return;
        momentsPage.dataset.pullRefreshBound = '1';

        let startY = 0;
        let startX = 0;
        let pullDistance = 0;
        let pressing = false;
        let pressType = '';
        let previousUserSelect = '';
        const maxPull = 92;
        const triggerThreshold = 62;

        const canPull = () => !this.isLoading && momentsPage.scrollTop <= 2;

        const startPress = (clientX, clientY, type) => {
            if (!canPull()) return false;
            pressing = true;
            pressType = type;
            pullDistance = 0;
            startX = clientX;
            startY = clientY;
            if (type === 'mouse') {
                previousUserSelect = document.body.style.userSelect;
                document.body.style.userSelect = 'none';
            }
            return true;
        };

        const movePress = (clientX, clientY, e) => {
            if (!pressing) return;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
                pressing = false;
                pullDistance = 0;
                pressType = '';
                this.syncMomentsPullIndicator();
                return;
            }
            if (deltaY <= 0 || deltaY < 6) return;

            pullDistance = Math.min(maxPull, Math.round(deltaY * 0.55));
            const ready = pullDistance >= triggerThreshold;
            this.setMomentsPullHint(pullDistance, ready ? '松手刷新朋友圈' : '下拉刷新朋友圈', ready);
            if (e?.cancelable) e.preventDefault();
        };

        const endPress = () => {
            if (!pressing) return;
            const shouldTrigger = pullDistance >= triggerThreshold;
            pressing = false;
            pullDistance = 0;
            if (pressType === 'mouse') {
                document.body.style.userSelect = previousUserSelect || '';
                previousUserSelect = '';
            }
            pressType = '';

            if (shouldTrigger) {
                this.loadMomentsFromAI();
            } else {
                this.syncMomentsPullIndicator();
            }
        };

        momentsPage.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            startPress(e.touches[0].clientX, e.touches[0].clientY, 'touch');
        }, { passive: true });
        momentsPage.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            movePress(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });
        momentsPage.addEventListener('touchend', () => {
            if (pressType === 'touch') endPress();
        });
        momentsPage.addEventListener('touchcancel', () => {
            if (pressType === 'touch') endPress();
        });

        let removeMouseGlobalListeners = null;
        const addMouseGlobalListeners = () => {
            const onMouseMove = (e) => {
                if (pressType !== 'mouse') return;
                movePress(e.clientX, e.clientY, e);
            };
            const onMouseUp = () => {
                if (pressType !== 'mouse') return;
                removeMouseGlobalListeners?.();
                endPress();
            };
            const onWindowBlur = () => {
                if (pressType !== 'mouse') return;
                removeMouseGlobalListeners?.();
                endPress();
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('blur', onWindowBlur);
            removeMouseGlobalListeners = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('blur', onWindowBlur);
                removeMouseGlobalListeners = null;
            };
        };

        momentsPage.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target?.closest?.('.moment-action-btn, .moment-image-prompt-generate, .inline-comment-box, .action-popup, input, textarea, button')) return;
            if (!startPress(e.clientX, e.clientY, 'mouse')) return;
            e.preventDefault();
            addMouseGlobalListeners();
        });
    }

    setMomentsPullHint(height, text, ready = false) {
        const wrap = document.getElementById('moments-pull-refresh-indicator');
        const inner = document.getElementById('moments-pull-refresh-inner');
        if (!wrap || !inner) return;
        wrap.classList.remove('loading', 'success', 'error');
        wrap.classList.toggle('ready', !!ready);
        wrap.style.height = `${Math.max(0, height)}px`;
        inner.innerHTML = `<i class="fa-solid fa-arrow-down"></i> ${text}`;
    }

    syncMomentsPullIndicator(status = '') {
        const wrap = document.getElementById('moments-pull-refresh-indicator');
        const inner = document.getElementById('moments-pull-refresh-inner');
        if (!wrap || !inner) return;
        wrap.classList.remove('ready', 'loading', 'success', 'error');

        if (this.isLoading || status === 'loading') {
            wrap.classList.add('loading');
            wrap.style.height = '40px';
            inner.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在生成中...';
            return;
        }
        if (status === 'success') {
            wrap.classList.add('success');
            wrap.style.height = '36px';
            inner.innerHTML = '<i class="fa-solid fa-check"></i> 已刷新';
            return;
        }
        if (status === 'error') {
            wrap.classList.add('error');
            wrap.style.height = '36px';
            inner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 刷新失败';
            return;
        }
        wrap.style.height = '0px';
        inner.innerHTML = '';
    }

    _renderEmojiText(value, size = 16) {
        return replacePhoneEmojiTokens(this._escapeHtml(value), {
            size,
            className: 'wechat-inline-system-emoji'
        }).replace(/\r?\n/g, '<br>');
    }

    _escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _escapeAttr(value) {
        return this._escapeHtml(value).replace(/`/g, '&#96;');
    }

    _normalizeImageGenerationError(error) {
        const message = String(error?.message || error || '').trim();
        if (!message) return '生成失败，请重试';
        if (/缺少.*API Key|api key/i.test(message)) return '缺少生图 API Key';
        if (/未启用/.test(message)) return '生图功能未启用';
        if (/rate|429|too many/i.test(message)) return '请求过快，请稍后重试';
        return message.slice(0, 80);
    }

    _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('read_blob_failed'));
                reader.readAsDataURL(blob);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _resolveMomentImageForAi(imageValue, cacheMap = null) {
        const raw = String(imageValue || '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:image')) return raw;
        if (cacheMap && cacheMap.has(raw)) return cacheMap.get(raw);

        const normalizedUrl = (() => {
            try {
                if (/^\/(?:backgrounds|user\/images)\//i.test(raw)) return raw;
                if (/^https?:\/\//i.test(raw)) return raw;
                return new URL(raw, window.location.origin).href;
            } catch (e) {
                return raw;
            }
        })();

        let dataUrl = '';
        try {
            const resp = await fetch(normalizedUrl, { credentials: 'include' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            if (!String(blob?.type || '').startsWith('image/')) {
                throw new Error(`not_image_blob:${blob?.type || 'unknown'}`);
            }
            dataUrl = await this._blobToDataUrl(blob);
        } catch (err) {
            console.warn('[Moments] 图片发送给AI失败，已降级为文字图片标记:', raw, err?.message || err);
            dataUrl = '';
        }

        if (cacheMap) {
            cacheMap.set(raw, dataUrl);
            cacheMap.set(normalizedUrl, dataUrl);
        }
        return dataUrl;
    }

    _isDirectMomentImageUrl(value) {
        const text = String(value || '').trim();
        return /^(data:image\/|data:application\/octet-stream;base64,|https?:\/\/|\/backgrounds\/|\/user\/images\/)/i.test(text);
    }

    _normalizeMomentReferenceNames(value = '') {
        const seen = new Set();
        return String(value || '')
            .split(/[,，、]+/)
            .map(name => name.trim().replace(/[<>"'`]/g, '').slice(0, 80))
            .filter(name => {
                if (!name || seen.has(name)) return false;
                seen.add(name);
                return true;
            });
    }

    _normalizeMomentImageTags(value = '') {
        return String(value || '')
            .split(/[,，\n]+/)
            .map(tag => tag.trim())
            .filter(Boolean);
    }

    _mergeMomentImageTags(...tagGroups) {
        const seen = new Set();
        return tagGroups
            .flatMap(group => this._normalizeMomentImageTags(group))
            .filter(tag => {
                if (seen.has(tag)) return false;
                seen.add(tag);
                return true;
            })
            .join(', ');
    }

    _parseMomentImageItem(rawValue) {
        const imageStr = String(rawValue || '').trim();
        let body = imageStr;
        const taggedMatch = imageStr.match(/^\[(用户照片|图片(?:-[^\]\r\n]+)?|视频)\]\s*([\s\S]*)$/);
        let mediaType = taggedMatch ? String(taggedMatch[1] || '').trim() : '图片';
        if (taggedMatch) body = String(taggedMatch[2] || '').trim();
        const namedImageMatch = /^图片-(.+)$/.exec(mediaType);
        const referenceNames = this._normalizeMomentReferenceNames(namedImageMatch?.[1] || '');
        if (namedImageMatch) {
            mediaType = referenceNames.length > 0 ? `图片-${referenceNames.join(',')}` : '图片';
        }
        const unwrappedBody = body.replace(/^[（(]\s*|\s*[)）]$/g, '').trim();
        const directUrl = this._isDirectMomentImageUrl(body)
            ? body
            : (this._isDirectMomentImageUrl(unwrappedBody) ? unwrappedBody : '');

        let promptText = '';
        let descriptionText = '';
        if (!directUrl) {
            const parsedPrompt = this._parsePromptDescriptionPair(body);
            promptText = parsedPrompt.prompt || unwrappedBody || body;
            descriptionText = parsedPrompt.description || promptText;
            if (!taggedMatch && /^\[[^\]]+\]$/.test(imageStr)) {
                promptText = imageStr.slice(1, -1).trim();
                descriptionText = promptText;
            }
        }

        return {
            realUrl: directUrl,
            isDirectImage: !!directUrl,
            promptText: promptText.trim(),
            descriptionText: descriptionText.trim(),
            mediaType,
            useUserReference: mediaType === '用户照片',
            referenceNames
        };
    }

    _extractMomentImageTagsFromText(rawText = '') {
        const raw = String(rawText || '');
        const promptItems = extractImagePromptItems(raw, {
            acceptMediaType: mediaType => mediaType !== '个人图片'
        });
        const images = promptItems.map(item => item.raw.trim()).filter(Boolean);
        const cleanedText = removeImagePromptItems(raw, promptItems)
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return { text: cleanedText, images };
    }

    _insertMomentTextImageTemplate(textInput) {
        if (!textInput) return false;
        const uploadedCount = Array.isArray(this.pendingMomentImages) ? this.pendingMomentImages.length : 0;
        const textImageCount = this._extractMomentImageTagsFromText(textInput.value).images.length;
        if (uploadedCount + textImageCount >= 9) {
            this.app.phoneShell.showNotification('提示', '上传图片和文字图片合计最多9张', '⚠️');
            return false;
        }

        const template = '[图片]（输入描述）';
        const selectionStart = Number.isInteger(textInput.selectionStart) ? textInput.selectionStart : textInput.value.length;
        const selectionEnd = Number.isInteger(textInput.selectionEnd) ? textInput.selectionEnd : selectionStart;
        const before = textInput.value.slice(0, selectionStart);
        const after = textInput.value.slice(selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        const suffix = after && !after.startsWith('\n') ? '\n' : '';
        const insertion = `${prefix}${template}${suffix}`;
        textInput.setRangeText(insertion, selectionStart, selectionEnd, 'end');

        const placeholderStart = selectionStart + prefix.length + '[图片]（'.length;
        textInput.focus();
        textInput.setSelectionRange(placeholderStart, placeholderStart + '输入描述'.length);
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    _parsePromptDescriptionPair(rawValue = '') {
        const parsed = parseImagePromptDescriptionPair(rawValue);
        return {
            description: parsed.description,
            prompt: parsed.prompt
        };
    }

    _hasCjkText(value = '') {
        return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(value || ''));
    }

    _collectMomentManagedImageUrls(moment) {
        if (!moment || !Array.isArray(moment.images)) return [];
        const urls = moment.images
            .map((item) => this._parseMomentImageItem(item))
            .filter((parsed) => parsed?.isDirectImage && parsed?.realUrl)
            .map((parsed) => String(parsed.realUrl || '').trim())
            .filter((url) => (url.startsWith('/backgrounds/') || url.startsWith('/user/images/')));
        return [...new Set(urls)];
    }

    _cleanupManagedMomentImages(urls = [], options = {}) {
        const uniqueUrls = [...new Set((Array.isArray(urls) ? urls : [])
            .map((url) => String(url || '').trim())
            .filter((url) => (url.startsWith('/backgrounds/') || url.startsWith('/user/images/'))))];
        if (uniqueUrls.length === 0) return;
        const imageManager = window.VirtualPhone?.imageManager;
        if (!imageManager?.deleteManagedBackgroundByPath) return;
        uniqueUrls.forEach((url) => {
            imageManager.deleteManagedBackgroundByPath(url, {
                quiet: true,
                skipIfReferenced: true,
                ...(options || {})
            }).catch(() => {});
        });
    }

    _mountPostDraftObserver() {
        this._unmountPostDraftObserver();
        if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
        this._postMomentDraftObserver = new MutationObserver(() => {
            if (!this._postMomentDraftActive) return;
            // 发圈输入框已离开DOM，说明用户切离了发圈页
            if (!document.getElementById('moment-text-input')) {
                this._leavePostMomentDraft({ published: this._postMomentDraftCommitted });
            }
        });
        this._postMomentDraftObserver.observe(document.body, { childList: true, subtree: true });
    }

    _unmountPostDraftObserver() {
        if (this._postMomentDraftObserver) {
            this._postMomentDraftObserver.disconnect();
            this._postMomentDraftObserver = null;
        }
    }

    _leavePostMomentDraft({ published = false } = {}) {
        if (!this._postMomentDraftActive && (!this.pendingMomentImages || this.pendingMomentImages.length === 0)) {
            this._postMomentDraftCommitted = false;
            this._unmountPostDraftObserver();
            return;
        }
        if (!published && Array.isArray(this.pendingMomentImages) && this.pendingMomentImages.length > 0) {
            this._cleanupManagedMomentImages(this.pendingMomentImages);
        }
        this.pendingMomentImages = [];
        this._postMomentDraftActive = false;
        this._postMomentDraftCommitted = false;
        this._unmountPostDraftObserver();
    }

    _startPostMomentDraft() {
        // 若有上一轮未发布草稿残留，先清掉，避免孤儿图片
        this._leavePostMomentDraft({ published: false });
        this._postMomentDraftActive = true;
        this._postMomentDraftCommitted = false;
        this.pendingMomentImages = [];
        this.pendingMomentVisibility = {
            type: 'public',
            contactIds: [],
            contactNames: []
        };
        this._mountPostDraftObserver();
    }

    _getMomentById(momentId) {
        const safeId = String(momentId || '').trim();
        const moments = this.app.wechatData.getMoments();
        return Array.isArray(moments) ? moments.find(item => String(item?.id || '').trim() === safeId) : null;
    }

    _getMomentImageTaskKey(momentOrId, index) {
        const momentId = typeof momentOrId === 'object'
            ? String(momentOrId?.id || '').trim()
            : String(momentOrId || '').trim();
        const safeIndex = Number.parseInt(String(index), 10);
        if (!momentId || !Number.isInteger(safeIndex) || safeIndex < 0) return '';
        return `${momentId}:${safeIndex}`;
    }

    _getRawMomentImageState(moment, index) {
        if (!moment || !Array.isArray(moment.imageGenerationStates)) return null;
        const state = moment.imageGenerationStates[index];
        return state && typeof state === 'object' ? state : null;
    }

    _isMomentImageTaskActive(moment, index, generationId = '') {
        const key = this._getMomentImageTaskKey(moment, index);
        const task = key ? this._momentImageTasks.get(key) : null;
        return !!task
            && task.generationId === String(generationId || '')
            && task.controller?.signal?.aborted !== true;
    }

    _queueMomentImageStateSave() {
        if (this._momentImageStateSavePending) return;
        this._momentImageStateSavePending = true;
        Promise.resolve().then(async () => {
            this._momentImageStateSavePending = false;
            await this.app?.wechatData?.saveData?.();
        }).catch(error => {
            this._momentImageStateSavePending = false;
            console.warn('[Moments] 保存中断的生图状态失败:', error);
        });
    }

    _getMomentImageState(moment, index) {
        const state = this._getRawMomentImageState(moment, index);
        if (state?.status !== 'loading') return state;
        if (this._isMomentImageTaskActive(moment, index, state.generationId)) return state;

        const interruptedState = {
            ...state,
            status: 'failed',
            error: '生成已中断，点击重试',
            generationId: ''
        };
        moment.imageGenerationStates[index] = interruptedState;
        this._queueMomentImageStateSave();
        return interruptedState;
    }

    _setMomentImageState(moment, index, nextState) {
        if (!moment || !Number.isInteger(index) || index < 0) return;
        if (!Array.isArray(moment.imageGenerationStates)) moment.imageGenerationStates = [];
        if (nextState === null) {
            delete moment.imageGenerationStates[index];
            return;
        }
        const prev = this._getMomentImageState(moment, index) || {};
        moment.imageGenerationStates[index] = { ...prev, ...nextState };
    }

    _createMomentImageAbortError() {
        const error = new Error('朋友圈生图已取消');
        error.name = 'AbortError';
        return error;
    }

    _assertMomentImageTaskActive(momentId, index, generationId) {
        const key = this._getMomentImageTaskKey(momentId, index);
        const task = key ? this._momentImageTasks.get(key) : null;
        if (!task || task.generationId !== generationId || task.controller?.signal?.aborted) {
            throw this._createMomentImageAbortError();
        }
        return task;
    }

    async cancelMomentImageGeneration(momentId, index) {
        const moment = this._getMomentById(momentId);
        const state = this._getRawMomentImageState(moment, index);
        if (!moment || state?.status !== 'loading') return false;

        const key = this._getMomentImageTaskKey(momentId, index);
        const task = key ? this._momentImageTasks.get(key) : null;
        if (task && task.generationId === state.generationId) {
            task.controller?.abort?.();
            this._momentImageTasks.delete(key);
        }

        this._setMomentImageState(moment, index, {
            status: 'failed',
            error: task ? '生成已取消，点击重试' : '生成已中断，点击重试',
            generationId: ''
        });
        await this.app.wechatData.saveData();
        this._refreshMomentImageUI(momentId);
        return true;
    }

    _refreshMomentImageUI(momentId) {
        const momentsPage = this._root().querySelector('.moments-page');
        const scrollTop = momentsPage?.scrollTop || 0;
        this._rerender();
        setTimeout(() => {
            const nextPage = this._root().querySelector('.moments-page');
            if (nextPage) nextPage.scrollTop = scrollTop;
        }, 0);
    }

    async generateMomentImage({ momentId, index, promptText, descriptionText = '', clearPreviousImage = false } = {}) {
        const parsedIncomingPrompt = this._parsePromptDescriptionPair(promptText);
        promptText = String(parsedIncomingPrompt.prompt || promptText || '').trim();
        descriptionText = String(descriptionText || parsedIncomingPrompt.description || '').trim();
        if (!momentId || !Number.isInteger(index) || index < 0 || !promptText) return;
        const moment = this._getMomentById(momentId);
        if (!moment) return;
        const currentState = this._getMomentImageState(moment, index);
        if (currentState?.status === 'loading') return;

        const imageManager = window.VirtualPhone?.imageGenerationManager;
        const imageStorage = this.app?.storage || window.VirtualPhone?.storage || null;
        if (!imageManager || typeof imageManager.generate !== 'function') {
            this._setMomentImageState(moment, index, {
                status: 'failed',
                error: '生图管理器未初始化',
                prompt: promptText,
                description: descriptionText || promptText
            });
            await this.app.wechatData.saveData();
            this._refreshMomentImageUI(momentId);
            this.app.phoneShell.showNotification('生图失败', '生图管理器未初始化', '❌');
            return;
        }

        if (imageStorage && imageManager.storage !== imageStorage) {
            imageManager.storage = imageStorage;
        }
        const resolvedImageProvider = String(imageManager.resolveProvider?.({ app: 'wechat' }) || imageStorage?.get?.('phone-image-provider') || '').trim();

        const previousImageUrl = this._getManagedMomentGeneratedImageUrl(moment, index);
        const parsedImage = this._parseMomentImageItem(Array.isArray(moment.images) ? moment.images[index] : '');
        const mediaType = parsedImage.mediaType || '图片';
        const displayDescription = String(descriptionText || parsedImage.descriptionText || promptText || '').trim();
        if (clearPreviousImage && Array.isArray(moment.images)) {
            moment.images[index] = displayDescription && displayDescription !== promptText
                ? `[${mediaType}]（${displayDescription}）（${promptText}）`
                : `[${mediaType}]（${promptText}）`;
        }
        const generationId = `moment_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const taskKey = this._getMomentImageTaskKey(momentId, index);
        const taskController = new AbortController();
        this._momentImageTasks.set(taskKey, { generationId, controller: taskController });

        this._setMomentImageState(moment, index, {
            status: 'loading',
            error: '',
            prompt: promptText,
            description: displayDescription,
            generationId,
            mediaType,
            useUserReference: parsedImage.useUserReference,
            referenceNames: parsedImage.referenceNames,
            generatedImageUrl: '',
            imageProvider: resolvedImageProvider
        });
        await this.app.wechatData.saveData();
        this._refreshMomentImageUI(momentId);

        let storedImageUrl = '';
        try {
            const shouldTranslateUserPrompt = moment?.isUserPost === true
                && this._hasCjkText(promptText)
                && typeof imageManager.translatePromptToEnglish === 'function';
            const translatedPrompt = shouldTranslateUserPrompt
                ? await imageManager.translatePromptToEnglish(promptText, 'wechat')
                : promptText;
            this._assertMomentImageTaskActive(momentId, index, generationId);
            promptText = String(translatedPrompt || promptText).trim();
            const generationContext = await this._buildMomentImageGenerationContext(
                moment,
                index,
                promptText,
                taskController.signal
            );
            this._assertMomentImageTaskActive(momentId, index, generationId);
            const generationPrompt = generationContext.prompt;
            const novelAIReferences = generationContext.references;
            const referenceNames = generationContext.referenceNames;
            const useUserReference = generationContext.useUserReference;
            this._setMomentImageState(moment, index, {
                prompt: promptText,
                description: displayDescription,
                useUserReference,
                referenceNames
            });
            await this.app.wechatData.saveData();
            this._refreshMomentImageUI(momentId);

            const result = await imageManager.generate({
                app: 'wechat',
                prompt: generationPrompt,
                novelAIReferences,
                signal: taskController.signal
            });
            this._assertMomentImageTaskActive(momentId, index, generationId);
            const rawImageUrl = String(result?.imageUrl || result?.imageData || '').trim();
            storedImageUrl = await this._persistMomentGeneratedImage(rawImageUrl, {
                momentId,
                index,
                promptText,
                generationId,
                signal: taskController.signal
            });
            this._assertMomentImageTaskActive(momentId, index, generationId);
            if (!storedImageUrl) throw new Error('生图成功但未返回图片URL');

            const latestMoment = this._getMomentById(momentId) || moment;
            const latestState = this._getRawMomentImageState(latestMoment, index);
            if (latestState?.generationId !== generationId) throw this._createMomentImageAbortError();
            if (!Array.isArray(latestMoment.images)) latestMoment.images = [];
            latestMoment.images[index] = `[${mediaType}]${storedImageUrl}`;
            this._setMomentImageState(latestMoment, index, {
                status: 'done',
                error: '',
                generationId: '',
                prompt: promptText,
                description: displayDescription,
                mediaType,
                useUserReference,
                referenceNames,
                generatedImageUrl: storedImageUrl,
                imageModel: String(result?.model || '').trim(),
                imageProvider: String(result?.provider || '').trim(),
                imageGenerationWidth: Number(result?.width || result?.requestedWidth || 0) || '',
                imageGenerationHeight: Number(result?.height || result?.requestedHeight || 0) || ''
            });
            await this.app.wechatData.saveData();
            this._cleanupReplacedMomentGeneratedImage(previousImageUrl, storedImageUrl);
            this._refreshMomentImageUI(momentId);
            this.app.phoneShell.showNotification('成功', '朋友圈配图生成完成', '✅');
        } catch (error) {
            const aborted = taskController.signal.aborted || error?.name === 'AbortError';
            const friendlyMessage = this._normalizeImageGenerationError(error);
            const latestMoment = this._getMomentById(momentId) || moment;
            const latestState = this._getRawMomentImageState(latestMoment, index);
            if (aborted) {
                if (storedImageUrl) {
                    this._cleanupManagedMomentImages([storedImageUrl], { skipIfReferenced: false });
                }
                if (latestState?.generationId === generationId && latestState?.status === 'loading') {
                    this._setMomentImageState(latestMoment, index, {
                        status: 'failed',
                        error: '生成已取消，点击重试',
                        generationId: ''
                    });
                    await this.app.wechatData.saveData();
                    this._refreshMomentImageUI(momentId);
                }
                return;
            }
            if (latestState?.generationId !== generationId) return;
            this._setMomentImageState(latestMoment, index, {
                status: 'failed',
                error: friendlyMessage,
                generationId: '',
                prompt: promptText,
                description: displayDescription,
                mediaType,
                useUserReference,
                referenceNames,
                generatedImageUrl: '',
                imageProvider: resolvedImageProvider
            });
            await this.app.wechatData.saveData();
            this._refreshMomentImageUI(momentId);
            this.app.phoneShell.showNotification('生图失败', friendlyMessage, '❌');
        } finally {
            const activeTask = this._momentImageTasks.get(taskKey);
            if (activeTask?.generationId === generationId) this._momentImageTasks.delete(taskKey);
        }
    }

    async _persistMomentGeneratedImage(imageUrl, { momentId = '', index = 0, promptText = '', generationId = '', signal = null } = {}) {
        const safeUrl = String(imageUrl || '').trim();
        if (!safeUrl) return '';
        if (/^(?:\/backgrounds\/|\/user\/images\/yuzuki-phone\/)phone_[^?#]+/i.test(safeUrl)) return safeUrl;

        const imageUploader = window.VirtualPhone?.imageManager;
        if (!imageUploader?.uploadBlob) {
            throw new Error('图片上传管理器未初始化，无法保存朋友圈生图');
        }

        const blob = await this._loadGeneratedMomentImageBlob(safeUrl, signal);
        const uniquePart = String(generationId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
        const seed = `${momentId || 'moment'}_${index}_${this._simpleImageHash(promptText || safeUrl).toString(36)}_${uniquePart}`;
        const uploadedUrl = await imageUploader.uploadBlob(blob, `moment_img_${seed}`, { signal });
        const normalized = String(uploadedUrl || '').trim();
        if (!/^(?:\/backgrounds\/|\/user\/images\/yuzuki-phone\/)phone_[^?#]+/i.test(normalized)) {
            throw new Error('朋友圈生图保存失败：未得到有效本地图片路径');
        }
        return normalized;
    }

    async _loadGeneratedMomentImageBlob(imageUrl, signal = null) {
        const safeUrl = String(imageUrl || '').trim();
        if (!safeUrl) throw new Error('生图结果为空');
        const response = await fetch(safeUrl, { cache: 'no-store', signal });
        if (!response.ok) {
            throw new Error(`读取朋友圈生图失败（HTTP ${response.status}）`);
        }
        const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
            throw new Error('朋友圈生图结果不是有效图片');
        }
        const bytes = new Uint8Array(arrayBuffer);
        const mime = /^image\//i.test(contentType)
            ? contentType
            : this._detectGeneratedMomentImageMime(bytes);
        if (!mime) throw new Error('朋友圈生图结果不是有效图片');
        const blob = new Blob([arrayBuffer], { type: mime });
        return blob;
    }

    _detectGeneratedMomentImageMime(bytes) {
        if (!bytes || bytes.length < 4) return '';
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
        if (
            bytes.length >= 12 &&
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        ) {
            return 'image/webp';
        }
        return '';
    }

    _simpleImageHash(text) {
        const str = String(text || '');
        let hash = 2166136261;
        for (let i = 0; i < str.length; i += 1) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    _getManagedMomentGeneratedImageUrl(moment, index) {
        const candidates = [
            Array.isArray(moment?.images) ? moment.images[index] : '',
            this._getMomentImageState(moment, index)?.generatedImageUrl
        ];
        for (const item of candidates) {
            const parsed = this._parseMomentImageItem(item);
            const raw = String(parsed?.realUrl || item || '').trim();
            const match = raw.match(/(?:\/backgrounds\/|\/user\/images\/yuzuki-phone\/)phone_moment_img_[^?#\s)）]+/i);
            if (match?.[0]) return match[0];
        }
        return '';
    }

    _cleanupReplacedMomentGeneratedImage(oldUrl, nextUrl = '') {
        const oldPath = String(oldUrl || '').trim();
        const nextPath = String(nextUrl || '').trim();
        if (!oldPath || oldPath === nextPath || !/^(?:\/backgrounds\/|\/user\/images\/yuzuki-phone\/)phone_moment_img_/i.test(oldPath)) return;
        this._cleanupManagedMomentImages([oldPath]);
    }

    async _imageUrlToMomentReferenceDataUrl(url, signal = null) {
        const safeUrl = String(url || '').trim();
        if (!safeUrl) return '';
        if (safeUrl.startsWith('data:image/')) return safeUrl;
        const response = await fetch(safeUrl, {
            credentials: 'include',
            cache: 'no-store',
            signal
        });
        if (!response.ok) {
            throw new Error(`个人形象参考图读取失败 (${response.status})`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('个人形象参考图读取失败'));
            reader.readAsDataURL(blob);
        });
        if (!dataUrl.startsWith('data:image/')) return '';
        return dataUrl;
    }

    _normalizeMomentIdentityName(value = '') {
        return String(value || '')
            .trim()
            .replace(/^@+/, '')
            .replace(/\s+/g, '')
            .replace(/[（(][^（）()]*[）)]/g, '')
            .toLowerCase();
    }

    _isMomentUserReferenceName(name = '') {
        const lookupName = this._normalizeMomentIdentityName(name);
        if (!lookupName) return false;
        const userInfo = this.app?.wechatData?.getUserInfo?.() || {};
        let storyUserName = '';
        try {
            const context = typeof SillyTavern !== 'undefined' && SillyTavern.getContext
                ? SillyTavern.getContext()
                : null;
            storyUserName = String(context?.name1 || '').trim();
        } catch (e) {
            storyUserName = '';
        }
        return [userInfo?.name, storyUserName, '{{user}}']
            .some(alias => this._normalizeMomentIdentityName(alias) === lookupName);
    }

    _resolveMomentReferenceContact(name = '', contacts = []) {
        const safeName = String(name || '').trim();
        if (!safeName) return null;
        return this.app?.wechatData?.findContactByNameLoose?.(safeName, { includeChats: false })
            || contacts.find(contact => this.app?.wechatData?._isSameLookupName?.(contact?.name, safeName))
            || contacts.find(contact => String(contact?.name || '').trim() === safeName)
            || null;
    }

    async _buildMomentImageGenerationContext(moment = null, index = 0, promptText = '', signal = null) {
        const parsedPrompt = this._parsePromptDescriptionPair(promptText);
        const basePrompt = String(parsedPrompt.prompt || promptText || '').trim();
        const parsed = this._parseMomentImageItem(Array.isArray(moment?.images) ? moment.images[index] : '');
        const state = this._getMomentImageState(moment, index);
        const referenceNames = parsed.referenceNames.length > 0
            ? parsed.referenceNames
            : this._normalizeMomentReferenceNames(state?.referenceNames || '');
        let useUserReference = parsed.useUserReference === true
            || state?.useUserReference === true
            || String(state?.mediaType || '').trim() === '用户照片';

        if (!useUserReference && referenceNames.length === 0) {
            return { prompt: basePrompt, references: [], referenceNames: [], useUserReference: false };
        }

        const contacts = this.app?.wechatData?.getContacts?.() || [];
        const identityTagGroups = [];
        const referenceTasks = [];
        const skippedNames = [];
        const seenEntities = new Set();

        const addEntity = (entity, fallbackName = '') => {
            if (!entity) return;
            const entityName = String(entity?.name || fallbackName || '').trim();
            const entityKey = String(entity?.id || '').trim()
                || this._normalizeMomentIdentityName(entityName);
            if (entityKey && seenEntities.has(entityKey)) return;
            if (entityKey) seenEntities.add(entityKey);

            const tags = String(entity?.naiPromptTags || entity?.imageTags || '').trim();
            if (tags) identityTagGroups.push(tags);

            const referenceImage = String(entity?.naiReferenceImage || entity?.referenceImage || '').trim();
            const referenceEnabled = entity?.naiReferenceEnabled !== false
                && entity?.naiReferenceEnabled !== 'false';
            if (!referenceImage || !referenceEnabled) return;

            referenceTasks.push((async () => {
                try {
                    const image = await this._imageUrlToMomentReferenceDataUrl(referenceImage, signal);
                    if (!image) throw new Error('参考图不是可用图片');
                    const rawStrength = Number(entity?.naiReferenceStrength ?? 0.7);
                    const rawInformation = Number(entity?.naiReferenceInformationExtracted ?? 1);
                    return {
                        name: entityName || fallbackName,
                        reference: {
                            image,
                            strength: Math.max(0, Math.min(1, Number.isFinite(rawStrength) ? rawStrength : 0.7)),
                            informationExtracted: Math.max(0, Math.min(1, Number.isFinite(rawInformation) ? rawInformation : 1))
                        }
                    };
                } catch (error) {
                    if (signal?.aborted || error?.name === 'AbortError') throw error;
                    return { name: entityName || fallbackName, error };
                }
            })());
        };

        referenceNames.forEach(name => {
            if (this._isMomentUserReferenceName(name)) {
                useUserReference = true;
                return;
            }
            const contact = this._resolveMomentReferenceContact(name, contacts);
            if (!contact) {
                skippedNames.push(name);
                return;
            }
            addEntity(contact, name);
        });

        if (useUserReference) {
            addEntity(this.app?.wechatData?.getUserInfo?.() || {}, '{{user}}');
        }

        const referenceResults = await Promise.all(referenceTasks);
        const references = referenceResults
            .map(item => item?.reference || null)
            .filter(Boolean);
        const failedNames = referenceResults
            .filter(item => item?.error)
            .map(item => item.name)
            .filter(Boolean);

        if (skippedNames.length > 0) {
            console.warn('[Moments Image] 未找到对应微信好友，已跳过固定Tag与参考图:', skippedNames);
        }
        if (failedNames.length > 0) {
            console.warn('[Moments Image] 参考图读取失败，已跳过:', failedNames);
            this.app?.phoneShell?.showNotification?.('朋友圈', `参考图读取失败：${failedNames.join('、')}`, '⚠️');
        }

        return {
            prompt: this._mergeMomentImageTags(...identityTagGroups, basePrompt),
            references,
            referenceNames,
            useUserReference
        };
    }

    // 显示操作弹窗
    showActionPopup(btn, momentId) {
        // 🔥 检查当前按钮是否已有弹窗
        const existingPopup = btn.querySelector('.action-popup');

        // 移除所有弹窗
        document.querySelectorAll('.action-popup').forEach(p => p.remove());

        // 🔥 如果当前按钮已有弹窗，移除后直接返回（切换关闭）
        if (existingPopup) {
            return;
        }

        const moment = this.app.wechatData.getMoment(momentId);
        const userInfo = this.app.wechatData.getUserInfo();
        const isLiked = moment?.likeList?.includes(userInfo.name);

        const popup = document.createElement('div');
        popup.className = 'action-popup moment-action-bar';
        const isMine = this._isSelfMoment(moment);
        const items = [
            ['like', isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart', isLiked ? '取消' : '赞'],
            ['comment', 'fa-regular fa-comment', '评论'],
            this._isMomentShareable(moment) ? ['share', 'fa-solid fa-share-nodes', '分享'] : null,
            this._isPrivateMoment(moment) ? null : ['ai', 'fa-solid fa-wand-magic-sparkles', '好友互动'],
            // 主列表里只能置顶自己的；别人的要进 TA 的朋友圈里置顶
            (isMine || this._currentPage) ? ['pin', 'fa-solid fa-thumbtack', this._isPinned(momentId) ? '取消置顶' : '置顶'] : null,
            ['edit', 'fa-solid fa-pen', '编辑'],
            ['delete', 'fa-regular fa-trash-can', '删除']
        ].filter(Boolean);
        popup.innerHTML = items.map(([act, icon, label]) => `
            <button type="button" class="action-popup-btn moment-bar-btn${(act === 'like' && isLiked) || (act === 'pin' && this._isPinned(momentId)) ? ' is-on' : ''}" data-act="${act}" title="${label}" aria-label="${label}">
                <i class="${icon}"></i>
            </button>`).join('');

        // 🔥 直接添加到按钮内部（按钮已经是 position: relative）
        btn.appendChild(popup);

        popup.addEventListener('click', async (e) => {
            const actBtn = e.target.closest('[data-act]');
            if (!actBtn) return;
            e.stopPropagation();
            const act = actBtn.dataset.act;
            popup.remove();
            if (act === 'like') return this.toggleLike(momentId);
            if (act === 'comment') return this.showCommentInput(momentId);
            if (act === 'share') return this.showShareMomentSheet(momentId);
            if (act === 'ai') {
                this._triggerFriendsReact(momentId);
                return;
            }
            if (act === 'pin') { this.togglePinMoment(momentId); return; }
            if (act === 'edit') return this.showEditMomentSheet(momentId);
            if (act === 'delete') return this.confirmDeleteMoment(momentId);
        });

        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && !btn.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 10);
    }

    // ================= 👤 个人朋友圈 / 我的相册 =================
    _root() {
        // 子页面（角色朋友圈/我的相册/详情）：直接用刚挂上去的那个页面，避免切换动画期间绑到旧页面上
        if (this._currentPage && this._subRoot?.isConnected) return this._subRoot;
        const mains = Array.from(document.querySelectorAll('.moments-page:not(.is-profile)'));
        const main = mains[mains.length - 1];
        return main?.closest('.wechat-app') || document.querySelector('.phone-view-current') || document;
    }

    // 写入用户资料要写到原始对象上（getUserInfo 有时返回副本）
    _userInfoStore() {
        return this.app.wechatData.data?.userInfo || this.app.wechatData.getUserInfo();
    }

    _isSelfName(name = '') {
        const n = String(name || '').trim();
        if (!n) return false;
        if (n === '__me__' || n === '我' || n === 'me' || n === '{{user}}') return true;
        const info = this.app.wechatData.getUserInfo() || {};
        const names = [info.name, info.nickname, this.app.wechatData.data?.userInfo?.name];
        try { names.push(window.SillyTavern?.getContext?.()?.name1); } catch (e) { /* 忽略 */ }
        return names.map(x => String(x || '').trim()).filter(Boolean).includes(n);
    }

    _isSelfMoment(moment) {
        return !!moment && (moment.isUserPost === true || this._isSelfName(moment.name));
    }

    // 朋友圈里显示的名字：自己显示网名，其他人优先显示备注
    _displayName(name = '') {
        const n = String(name || '').trim();
        if (!n) return '';
        if (this._isSelfName(n)) return String(this.app.wechatData.getUserInfo()?.name || n);
        return this.app.wechatData.getContactDisplayName?.(n) || n;
    }

    _momentVisibilityType(moment) {
        return this.app.wechatData.normalizeMomentVisibility?.(moment)?.type || 'public';
    }

    _isPrivateMoment(moment) {
        const v = this.app.wechatData.normalizeMomentVisibility?.(moment) || { type: 'public' };
        return v.type === 'include' && !(v.contactIds?.length || v.contactNames?.length);
    }

    // 只有公开的朋友圈可以分享
    _isMomentShareable(moment) {
        // 公开的动态（自己的、好友的）都能转发；自己设了私密或指定可见范围的不能
        return !!moment && this._momentVisibilityType(moment) === 'public';
    }

    // 置顶：自己的放 momentsPinned，角色的按名字放 momentsPinnedMap
    _getPinnedIds(ownerName = '') {
        const info = this.app.wechatData.getUserInfo() || {};
        if (!ownerName || this._isSelfName(ownerName)) return Array.isArray(info.momentsPinned) ? info.momentsPinned : [];
        const map = info.momentsPinnedMap && typeof info.momentsPinnedMap === 'object' ? info.momentsPinnedMap : {};
        return Array.isArray(map[ownerName]) ? map[ownerName] : [];
    }

    _pinOwnerOf(moment) {
        return !moment || this._isSelfMoment(moment) ? '' : String(moment.name || '').trim();
    }

    _isPinned(momentId) {
        const moment = this.app.wechatData.getMoment?.(String(momentId || ''));
        return this._getPinnedIds(this._pinOwnerOf(moment)).includes(String(momentId || ''));
    }

    togglePinMoment(momentId) {
        const info = this._userInfoStore();
        const id = String(momentId || '');
        const owner = this._pinOwnerOf(this.app.wechatData.getMoment?.(id));
        let list = this._getPinnedIds(owner).filter(x => x !== id);
        const pinning = !this._isPinned(id);
        if (pinning) list = [id, ...list];
        if (!owner) {
            info.momentsPinned = list.slice(0, 9);
        } else {
            if (!info.momentsPinnedMap || typeof info.momentsPinnedMap !== 'object') info.momentsPinnedMap = {};
            info.momentsPinnedMap[owner] = list.slice(0, 9);
        }
        this.app.wechatData.saveData();
        this.app.phoneShell.showNotification('朋友圈', pinning ? '已置顶' : '已取消置顶', '📌');
        this._rerender();
    }

    _renderPinRow(list = [], ownerName = '') {
        const pinned = this._getPinnedIds(ownerName).map(id => list.find(m => String(m.id) === id)).filter(Boolean);
        if (!pinned.length) return '';
        const tile = m => {
            const url = this._momentThumbUrl(m, 0);
            const txt = this._momentPlainText(m);
            return `<div class="album-pin-tile" data-album-open="${this._escapeAttr(m.id)}" role="button" tabindex="0">${url ? `<img src="${this._escapeAttr(url)}" alt="">` : `<span>${this._escapeHtml(txt.slice(0, 18) || '[图片]')}</span>`}</div>`;
        };
        return `
                <div class="album-row album-pin-row">
                    <div class="album-label"><b class="is-word">置顶</b></div>
                    <div class="album-pin-tiles">${pinned.slice(0, 3).map(tile).join('')}</div>
                </div>
                <div class="album-divider"></div>`;
    }

    _getCoverFor(name = '') {
        const info = this.app.wechatData.getUserInfo() || {};
        if (!name || this._isSelfName(name)) return String(info.momentsCover || '').trim();
        const map = info.momentsCoverMap && typeof info.momentsCoverMap === 'object' ? info.momentsCoverMap : {};
        return String(map[name] || '').trim();
    }

    _renderCoverHtml(name = '') {
        const info = this.app.wechatData.getUserInfo() || {};
        const self = !name || this._isSelfName(name);
        const realName = self ? (info.name || '我') : name;
        const cover = this._getCoverFor(realName);
        const avatar = self ? info.avatar : (this.getContactAvatar(realName) || '👤');
        return `
                <div class="moments-cover${cover ? ' has-cover' : ''}" id="moments-cover" style="${cover ? `background-image:url('${this._escapeAttr(cover)}');` : ''}" role="button" tabindex="0" title="更换封面">
                    ${cover ? '' : '<div class="moments-cover-tip"><i class="fa-regular fa-image"></i> 轻触设置相册封面</div>'}
                    <div class="moments-cover-user">
                        <span class="moments-cover-name">${this._escapeHtml(this._displayName(realName))}</span>
                        <div class="moments-cover-avatar" id="moments-cover-avatar">${this.app.renderAvatar(avatar, self ? '😊' : '👤', realName)}</div>
                    </div>
                </div>`;
    }

    _renderSubPageShell(bodyHtml, { title = '', rightHtml = '' } = {}) {
        return `
            <div class="wechat-app wechat-main-shell">
                <div class="wechat-header moments-header-style moments-header-overlay has-title">
                    <div class="wechat-header-left">
                        <button class="wechat-back-btn" type="button" data-moments-back aria-label="返回"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                    </div>
                    <div class="wechat-header-title"><span class="wechat-header-title-text">${this._escapeHtml(title)}</span></div>
                    <div class="wechat-header-right">${rightHtml}</div>
                </div>
                <div class="wechat-content" style="background:#fff;">${bodyHtml}</div>
            </div>`;
    }

    _showSubPage(html, key, pageFn, parentFn = null) {
        this._currentPage = pageFn;
        this._currentParent = parentFn;
        const token = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.app.phoneShell.setContent(html.replace('<div class="wechat-app wechat-main-shell">', `<div class="wechat-app wechat-main-shell" data-moments-sub="${token}">`), key);
        this._subRoot = document.querySelector(`[data-moments-sub="${token}"]`);
        this.bindMomentsEvents();
        this._root().querySelectorAll('[data-moments-post]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPostMomentPage({ privateMode: btn.dataset.momentsPost === 'private', textOnly: btn.dataset.momentsPost === 'text' });
        }));
    }

    _goBack() {
        const parent = this._currentParent;
        this._currentPage = null;
        this._currentParent = null;
        if (typeof parent === 'function') { parent(); return; }
        // 从聊天里点头像进来的：返回聊天
        const ext = this._externalBack;
        this._externalBack = null;
        if (typeof ext === 'function') { ext(); return; }
        this.app.currentView = 'discover';
        this.app.render();
    }

    _rerender() {
        const onSubPage = !!this._root().querySelector('.moments-page.is-profile');
        if (onSubPage && typeof this._currentPage === 'function') {
            const page = this._root().querySelector('.moments-page');
            const top = page?.scrollTop || 0;
            this._currentPage();
            setTimeout(() => { const next = this._root().querySelector('.moments-page'); if (next) next.scrollTop = top; }, 0);
            return;
        }
        this.app.render();
    }

    _returnFromPost() {
        const back = this._postReturnPage;
        this._postReturnPage = null;
        if (typeof back === 'function') { back(); return; }
        this.app.currentView = 'discover';
        this.app.render();
    }

    openMomentsProfile(name = '') {
        if (this._getMomentsSkin() === 'line') return this.showInsProfilePage(!name || this._isSelfName(name) ? '__me__' : name);
        if (!name || this._isSelfName(name)) return this.showMyAlbumPage();
        return this.showContactMomentsPage(name);
    }

    // 角色的朋友圈：和“我的相册”同样的排版，只显示 TA 发过的内容
    showContactMomentsPage(name) {
        const data = this.app.wechatData;
        const norm = v => String(v || '').trim();
        const contact = data.getContactByName?.(name);
        const aliases = new Set([name, contact?.name, contact?.realName].map(norm).filter(Boolean));
        const list = (data.getMoments() || []).filter(m => !this._isSelfMoment(m) && aliases.has(norm(m?.name)));
        const sign = this._getContactSignature(name, contact);
        const body = `
            <div class="moments-page is-profile is-album" data-profile-name="${this._escapeAttr(name)}" style="background:#fff;">
                ${this._renderCoverHtml(name)}
                <div class="moments-album-sign" id="moments-album-sign" role="button" tabindex="0">${this._escapeHtml(sign)}</div>
                ${this._renderPinRow(list, list[0]?.name || name)}
                ${this._renderAlbumTimeline(list, { showPostTiles: false })}
                <div class="album-end">${list.length ? '' : 'TA 还没有发过朋友圈'}</div>
            </div>`;
        const reopen = () => this.showContactMomentsPage(name);
        this._showSubPage(this._renderSubPageShell(body, { title: this._displayName(name) }), `wechat-moments-user`, reopen);
        this._bindAlbumOpen(reopen);
        this._root().querySelector('#moments-album-sign')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editSignature(name);
        });
    }

    _bindAlbumOpen(parentFn) {
        this._root().querySelectorAll('[data-album-open]').forEach(el => el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMomentDetailPage(el.dataset.albumOpen, parentFn);
        }));
    }

    // 按日期排列的时间线（今天 / 22 8月 …）
    _renderAlbumTimeline(list = [], { showPostTiles = false } = {}) {
        const now = this._getCurrentPhoneTimeSnapshot();
        const today = this._parseMomentDateParts({ date: now.date, timestamp: now.timestamp });
        const groups = [];
        const byKey = new Map();
        list.forEach(m => {
            const d = this._parseMomentDateParts(m);
            if (!byKey.has(d.key)) { const g = { d, items: [] }; byKey.set(d.key, g); groups.push(g); }
            byKey.get(d.key).items.push(m);
        });
        const todayGroup = byKey.get(today.key);
        let lastYear = today.y;
        const rest = groups.filter(g => g !== todayGroup).map(g => {
            const yearLine = g.d.y && g.d.y !== lastYear ? `<div class="album-year">${g.d.y}年</div>` : '';
            if (g.d.y) lastYear = g.d.y;
            return `${yearLine}<div class="album-row">
                <div class="album-label">${g.d.d ? `<b>${String(g.d.d).padStart(2, '0')}</b><small>${g.d.mo}月</small>` : '<small>更早</small>'}</div>
                <div class="album-col">${g.items.map(m => this._renderAlbumEntry(m)).join('')}</div>
            </div>`;
        }).join('');
        const todayRow = (showPostTiles || todayGroup) ? `
                <div class="album-row">
                    <div class="album-label"><b class="is-word">今天</b></div>
                    <div class="album-col">
                        ${showPostTiles ? `<div class="album-post-tiles">
                            <button type="button" class="album-post-tile" data-moments-post="public"><i class="fa-solid fa-camera"></i><span>发表</span></button>
                            <button type="button" class="album-post-tile" data-moments-post="text"><i class="fa-solid fa-pen"></i><span>发文字</span></button>
                            <button type="button" class="album-post-tile" data-moments-post="private"><i class="fa-solid fa-lock"></i><span>私密发表</span></button>
                        </div>` : ''}
                        ${todayGroup ? todayGroup.items.map(m => this._renderAlbumEntry(m)).join('') : ''}
                    </div>
                </div>` : '';
        return todayRow + rest;
    }

    _getContactSignature(name, contact = null) {
        const map = this.app.wechatData.getUserInfo()?.momentsSignMap || {};
        const custom = String(map[name] || '').trim();
        if (custom) return custom;
        const own = String(contact?.signature || contact?.extra?.signature || '').trim();
        return own || '这个人很神秘，什么也没留下~';
    }

    _parseMomentDateParts(moment) {
        const text = String(moment?.date || '');
        const m = text.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/);
        if (m) return { y: +m[1], mo: +m[2], d: +m[3], key: `${m[1]}-${m[2]}-${m[3]}` };
        const ts = Number(moment?.timestamp || 0);
        if (ts > 0) {
            const dt = new Date(ts);
            return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate(), key: `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}` };
        }
        return { y: 0, mo: 0, d: 0, key: 'unknown' };
    }

    // 相册缩略图：已生成/上传的用真图，没生成的用和朋友圈里一样的预览图
    _momentThumbUrl(moment, index = 0) {
        const raw = (moment?.images || [])[index];
        if (!raw) return '';
        const parsed = this._parseMomentImageItem(raw);
        if (parsed.isDirectImage) return parsed.realUrl;
        const state = this._getMomentImageState(moment, index);
        const statePrompt = this._parsePromptDescriptionPair(state?.prompt || '');
        const promptText = statePrompt.prompt || parsed.promptText || String(raw || '').trim();
        return `https://picsum.photos/seed/${encodeURIComponent(`moments_${index}_${promptText}`)}/480/480`;
    }

    _momentPlainText(moment) {
        const raw = String(moment?.text || '');
        const text = /\[\s*翻译\s*[:：]/.test(raw) ? parseWechatTranslationContent(raw).speechText : raw;
        if (text.trim()) return text;
        const first = (moment?.images || []).map(i => this._parseMomentImageItem(i))[0];
        return first ? `[图片] ${first.descriptionText || ''}`.trim() : '';
    }

    _renderAlbumEntry(moment) {
        const images = Array.isArray(moment.images) ? moment.images : [];
        const text = this._momentPlainText(moment);
        const pinIcon = '';
        const lock = `<span class="album-flags">${pinIcon}${this._isPrivateMoment(moment) ? '<i class="fa-solid fa-lock"></i>' : ''}</span>`;
        if (!images.length) {
            return `<div class="album-entry is-text" data-album-open="${this._escapeAttr(moment.id)}" role="button" tabindex="0"><div class="album-entry-text">${this._renderEmojiText(text, 14)}</div>${lock}</div>`;
        }
        const rawText = String(moment?.text || '').trim();
        const thumbUrl = this._momentThumbUrl(moment, 0);
        if (!rawText) {
            // 只有图片：只放图，点图片进详情
            const tiles = images.slice(0, 4).map((_, i) => {
                const u = this._momentThumbUrl(moment, i);
                return `<span class="album-img-tile">${u ? `<img src="${this._escapeAttr(u)}" alt="">` : '<i class="fa-regular fa-image"></i>'}</span>`;
            }).join('');
            return `<div class="album-entry is-image-only" data-album-open="${this._escapeAttr(moment.id)}" role="button" tabindex="0"><div class="album-img-grid n${Math.min(images.length, 4)}">${tiles}</div>${lock}</div>`;
        }
        const thumb = thumbUrl
            ? `<img src="${this._escapeAttr(thumbUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'album-thumb-ph',innerHTML:'<i class=&quot;fa-regular fa-image&quot;></i>'}))">`
            : `<span class="album-thumb-ph"><i class="fa-regular fa-image"></i></span>`;
        return `<div class="album-entry" data-album-open="${this._escapeAttr(moment.id)}" role="button" tabindex="0">
                    <div class="album-thumb">${thumb}${images.length > 1 ? `<span class="album-thumb-count">${images.length}</span>` : ''}</div>
                    <div class="album-entry-side"><div class="album-entry-text">${this._renderEmojiText(text, 15)}</div>${images.length > 1 ? `<div class="album-entry-sub">共${images.length}张</div>` : ''}</div>${lock}
                </div>`;
    }

    // 我的相册：个性签名 + 置顶 + 今天(发表/私密发表) + 按日期排列
    showMyAlbumPage() {
        const data = this.app.wechatData;
        const info = data.getUserInfo() || {};
        const mine = (data.getMoments() || []).filter(m => this._isSelfMoment(m));
        const sign = String(info.signature || '').trim();
        const body = `
            <div class="moments-page is-profile is-album" data-profile-name="${this._escapeAttr(info.name || '')}" style="background:#fff;">
                ${this._renderCoverHtml('')}
                <div class="moments-album-sign${sign ? '' : ' is-empty'}" id="moments-album-sign" role="button" tabindex="0">${this._escapeHtml(sign || '编辑个性签名')}</div>
                ${this._renderPinRow(mine, '')}
                ${this._renderAlbumTimeline(mine, { showPostTiles: true })}
                <div class="album-end">${mine.length ? '' : '还没有发过朋友圈'}</div>
            </div>`;
        const reopen = () => this.showMyAlbumPage();
        this._showSubPage(this._renderSubPageShell(body, { title: info.name || '我的朋友圈' }), 'wechat-moments-album', reopen);
        this._bindAlbumOpen(reopen);
        this._root().querySelector('#moments-album-sign')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editSignature();
        });
    }

    editSignature(targetName = '') {
        const info = this.app.wechatData.getUserInfo();
        const isOther = !!targetName && !this._isSelfName(targetName);
        const current = isOther ? this._getContactSignature(targetName, this.app.wechatData.getContactByName?.(targetName)) : (info.signature || '');
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog" role="dialog">
                <div class="moment-dialog-title">${isOther ? `${this._escapeHtml(this._displayName(targetName))} 的个性签名` : '个性签名'}</div>
                <label class="moment-field"><textarea data-f="sign" rows="3" maxlength="50" placeholder="写点什么吧">${this._escapeHtml(current)}</textarea></label>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary" data-ok>保存</button>
                </div>
            </div>`);
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            const value = String(mask.querySelector('[data-f="sign"]')?.value || '').trim().slice(0, 50);
            const store = this._userInfoStore();
            if (isOther) {
                if (!store.momentsSignMap || typeof store.momentsSignMap !== 'object') store.momentsSignMap = {};
                if (value) store.momentsSignMap[targetName] = value; else delete store.momentsSignMap[targetName];
            } else {
                store.signature = value;
            }
            this.app.wechatData.saveData();
            mask.remove();
            this._rerender();
        });
    }

    // 单条详情（从相册/置顶点进来）
    showMomentDetailPage(momentId, parentFn = null) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) { if (parentFn) parentFn(); return; }
        const body = `
            <div class="moments-page is-profile is-detail" style="background:#fff; padding-top: 76px;">
                <div class="moments-feed" style="background:#fff;">${this._getMomentsSkin() === 'line' ? this._renderInsPostHtml(moment) : this.renderMomentItem(moment, false)}</div>
            </div>`;
        this._showSubPage(this._renderSubPageShell(body, { title: '详情' }).replace('moments-header-overlay has-title', 'moments-header-overlay has-title is-solid is-fixed-solid'), 'wechat-moments-detail', () => this.showMomentDetailPage(momentId, parentFn), parentFn);
    }

    _mountMomentSheet(html) {
        const r = this._root();
        const host = (r.matches?.('.wechat-app') ? r : r.querySelector?.('.wechat-app')) || document.querySelector('.phone-view-current .wechat-app') || document.body;
        const mask = document.createElement('div');
        mask.className = 'moment-sheet-mask';
        mask.innerHTML = html;
        host.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
        mask.querySelectorAll('[data-sheet-close]').forEach(b => b.addEventListener('click', () => mask.remove()));
        return mask;
    }

    confirmDeleteMoment(momentId) {
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog" role="dialog">
                <div class="moment-dialog-title">确认</div>
                <div class="moment-dialog-text">删除这条朋友圈？删除后不可恢复。</div>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary is-danger" data-ok>删除</button>
                </div>
            </div>`);
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            mask.remove();
            const targetMoment = this.app.wechatData.getMoment(momentId);
            const managedImageUrls = this._collectMomentManagedImageUrls(targetMoment);
            if (this.app.wechatData.deleteMoment(momentId)) {
                this._cleanupManagedMomentImages(managedImageUrls);
                const info = this._userInfoStore();
                if (Array.isArray(info.momentsPinned)) info.momentsPinned = info.momentsPinned.filter(x => x !== String(momentId));
                this.app.phoneShell.showNotification('已删除', '朋友圈已删除', '✅');
                if (this._root().querySelector('.moments-page.is-detail')) { this._goBack(); return; }
                this._rerender();
            }
        });
    }

    // ✏️ 编辑帖子：文案 / 位置 / 发布时间
    showEditMomentSheet(momentId) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;
        const timeText = [moment.date, moment.time].filter(Boolean).join(' ');
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog moment-edit-dialog" role="dialog">
                <div class="moment-dialog-title">编辑帖子</div>
                <div class="moment-dialog-sub">${this._escapeHtml(moment.name || '')}</div>
                <label class="moment-field"><span>文案</span><textarea data-f="text" rows="5">${this._escapeHtml(moment.text || '')}</textarea></label>
                ${(moment.images || []).length ? `<div class="moment-field"><span>图片（点 × 删除）</span><div class="moment-edit-imgs">${(moment.images || []).map((img, i) => {
                    const url = this._momentThumbUrl(moment, i);
                    const desc = this._parseMomentImageItem(img)?.descriptionText || '';
                    return `<div class="moment-edit-img" data-img-idx="${i}">${url ? `<img src="${this._escapeAttr(url)}" alt="">` : `<span>${this._escapeHtml(desc.slice(0, 16) || '图片')}</span>`}<button type="button" data-img-del="${i}" aria-label="删除这张图">×</button></div>`;
                }).join('')}</div></div>` : ''}
                <label class="moment-field"><span>位置</span><input data-f="location" type="text" placeholder="不填则不显示" value="${this._escapeAttr(moment.location || '')}"></label>
                <label class="moment-field"><span>发布时间</span><input data-f="time" type="text" placeholder="如：2026年9月15日 23:45" value="${this._escapeAttr(timeText)}"></label>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary" data-ok>保存</button>
                </div>
            </div>`);
        // 删除图片：先在弹窗里标记，保存时才真正删掉
        const removed = new Set();
        mask.querySelectorAll('[data-img-del]').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const i = Number(btn.dataset.imgDel);
            removed.add(i);
            btn.closest('.moment-edit-img')?.remove();
        }));
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            const live = this.app.wechatData.getMoment(momentId);
            if (!live) return mask.remove();
            const get = f => String(mask.querySelector(`[data-f="${f}"]`)?.value || '');
            const oldImages = Array.isArray(live.images) ? live.images : [];
            const keep = oldImages.map((_, i) => i).filter(i => !removed.has(i));
            const keptImages = keep.map(i => oldImages[i]);
            if (removed.size && Array.isArray(live.imageGenerationStates)) {
                live.imageGenerationStates = keep.map(i => live.imageGenerationStates[i]);
            }
            const cleaned = this._cleanMomentTextAndImages(get('text').trim(), keptImages);
            live.text = cleaned.text;
            live.images = cleaned.images;
            live.location = get('location').trim();
            const t = get('time').trim();
            const clock = t.match(/(\d{1,2}[:：]\d{2})\s*$/);
            if (clock) {
                live.time = clock[1].replace('：', ':');
                const datePart = t.slice(0, clock.index).trim();
                if (datePart) live.date = datePart;
            } else if (t) {
                live.time = t;
            }
            this.app.wechatData.saveData();
            mask.remove();
            this._rerender();
        });
    }

    // 📤 分享到私聊 / 群聊
    showShareMomentSheet(momentId) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;
        if (!this._isMomentShareable(moment)) {
            this.app.phoneShell.showNotification('无法分享', '私密或设了可见范围的动态不能转发', '🔒');
            return;
        }
        const chats = (this.app.wechatData.getChatList?.() || []).filter(c => c && c.id);
        const singles = chats.filter(c => c.type !== 'group');
        const groups = chats.filter(c => c.type === 'group');
        const preview = this._renderTranslatableText(moment.name, moment.text || '[图片]', { size: 14 });
        let tab = 'single';
        const selected = new Set();
        const rowHtml = c => `
            <button type="button" class="moment-share-row${selected.has(c.id) ? ' is-on' : ''}" data-chat-id="${this._escapeAttr(c.id)}" data-search="${this._escapeAttr(String(c.name || '').toLowerCase())}">
                <span class="moment-share-av">${this.app.renderAvatar(c.avatar, c.type === 'group' ? '👥' : '👤', c.name)}</span>
                <span class="moment-share-name">${this._escapeHtml(this.app._getChatDisplayName?.(c) || c.name || '')}</span>
                <span class="moment-share-check"><i class="fa-solid fa-check"></i></span>
            </button>`;
        const mask = this._mountMomentSheet(`
            <div class="moment-share-sheet" role="dialog">
                <div class="moment-share-head"><span>分享</span><button type="button" data-sheet-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="moment-share-preview">
                    <span class="moment-share-av">${this.app.renderAvatar(this.getContactAvatar(moment.name) || moment.avatar, '👤', moment.name)}</span>
                    <div><b>${this._escapeHtml(moment.name || '')}</b><div class="moment-share-preview-text">${preview.main}</div></div>
                </div>
                <div class="moment-share-tabs">
                    <button type="button" class="is-on" data-tab="single">联系人 <small>${singles.length}</small></button>
                    <button type="button" data-tab="group">群组 <small>${groups.length}</small></button>
                </div>
                <div class="moment-share-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="搜索"></div>
                <div class="moment-share-list"></div>
                <button type="button" class="moment-share-send" disabled>请选择发送对象</button>
            </div>`);
        const list = mask.querySelector('.moment-share-list');
        const sendBtn = mask.querySelector('.moment-share-send');
        const search = mask.querySelector('.moment-share-search input');
        const paint = () => {
            const source = tab === 'single' ? singles : groups;
            const kw = String(search.value || '').trim().toLowerCase();
            const rows = source.filter(c => !kw || String(c.name || '').toLowerCase().includes(kw));
            list.innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="moment-share-empty">没有可分享的聊天</div>';
            sendBtn.disabled = selected.size === 0;
            sendBtn.textContent = selected.size ? `发送（${selected.size}）` : '请选择发送对象';
        };
        mask.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
            tab = b.dataset.tab;
            mask.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('is-on', x === b));
            paint();
        }));
        search.addEventListener('input', paint);
        list.addEventListener('click', (e) => {
            const row = e.target.closest('[data-chat-id]');
            if (!row) return;
            const id = row.dataset.chatId;
            if (selected.has(id)) selected.delete(id); else selected.add(id);
            paint();
        });
        sendBtn.addEventListener('click', () => {
            const ids = [...selected];
            mask.remove();
            this._shareMomentToChats(momentId, ids);
        });
        paint();
    }

    _shareMomentToChats(momentId, chatIds = []) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment || !chatIds.length) return;
        const raw = String(moment.text || '');
        const parsed = parseWechatTranslationContent(raw);
        const body = /\[\s*翻译\s*[:：]/.test(raw) ? parsed.speechText : raw;
        const firstImage = (moment.images || []).map(i => this._parseMomentImageItem(i)).find(p => p.isDirectImage)?.realUrl || '';
        const imageDesc = (moment.images || []).map(i => this._parseMomentImageItem(i)).map(p => p.descriptionText).filter(Boolean).slice(0, 3);
        const momentData = {
            id: moment.id,
            author: moment.name || '',
            avatar: this.getContactAvatar(moment.name) || moment.avatar || '',
            text: body.trim(),
            zh: String(parsed.translationText || '').trim(),
            image: firstImage,
            imageCount: Array.isArray(moment.images) ? moment.images.length : 0,
            imageDesc,
            location: moment.location || '',
            time: [moment.date, moment.time].filter(Boolean).join(' ')
        };
        const chatView = this.app.chatView;
        const timeFields = chatView?._shouldUseRealTimeForOnlineChat?.() ? (chatView._buildWechatRealTimeFields?.() || {}) : {};
        chatIds.forEach(chatId => {
            this.app.wechatData.addMessage(chatId, {
                from: 'me',
                type: 'moment_card',
                content: `[朋友圈分享] ${momentData.author}：${momentData.text || '[图片]'}`,
                momentData,
                avatar: this.app.wechatData.getUserInfo().avatar,
                ...timeFields
            });
            if (chatView?.isOnlineMode?.()) chatView._enqueuePendingChat?.(chatId);
        });
        this.app.wechatData.saveData();
        this.app.phoneShell.showNotification('已分享', `已发送到 ${chatIds.length} 个聊天`, '✅');
    }

    // 🖼️ 封面（相册图）与顶部栏
    _bindMomentsCoverAndHeader() {
        const page = this._root().querySelector('.moments-page');
        const cover = this._root().querySelector('#moments-cover');
        if (cover && cover.dataset.bound !== '1') {
            cover.dataset.bound = '1';
            cover.addEventListener('click', (e) => {
                if (e.target.closest('#moments-cover-avatar')) return;
                this.showChangeCoverSheet(page?.dataset.profileName || '');
            });
        }
        const header = this._root().querySelector('.wechat-header.moments-header-overlay') || document.querySelector('.phone-view-current .wechat-header.moments-header-overlay');
        if (page && header && page.dataset.headerBound !== '1') {
            page.dataset.headerBound = '1';
            const sync = () => {
                const limit = Math.max(60, (cover?.offsetHeight || 260) - 90);
                header.classList.toggle('is-solid', header.classList.contains('is-fixed-solid') || page.scrollTop > limit);
            };
            page.addEventListener('scroll', sync, { passive: true });
            sync();
        }
    }

    showChangeCoverSheet(targetName = '') {
        const userInfo = this.app.wechatData.getUserInfo();
        const isOther = !!targetName && !this._isSelfName(targetName);
        const hasCover = !!String(isOther ? this._getCoverFor(targetName) : (userInfo.momentsCover || '')).trim();
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog moment-cover-dialog" role="dialog">
                <div class="moment-cover-dialog-head">
                    <span>更换封面</span>
                    <span>
                        ${hasCover ? '<button type="button" class="moment-icon-btn" data-remove title="移除封面"><i class="fa-regular fa-trash-can"></i></button>' : ''}
                        <button type="button" class="moment-icon-btn" data-sheet-close title="关闭"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                </div>
                <div class="moment-cover-tabs">
                    <button type="button" class="is-on" data-ctab="local"><i class="fa-solid fa-upload"></i> 本地上传</button>
                    <button type="button" data-ctab="url"><i class="fa-solid fa-link"></i> URL 图床</button>
                </div>
                <label class="moment-cover-drop" data-cpane="local">
                    <input type="file" accept="image/*" hidden>
                    <i class="fa-regular fa-image"></i>
                    <span>点击选择图片</span>
                    <small>支持 JPG · PNG · GIF，大图自动压缩</small>
                </label>
                <div class="moment-cover-url" data-cpane="url" hidden>
                    <input type="text" placeholder="粘贴图片链接 https://...">
                    <button type="button" class="moment-cover-url-ok">使用这张图</button>
                </div>
            </div>`);
        const setCover = (url) => {
            const info = this._userInfoStore();
            let old = '';
            if (isOther) {
                if (!info.momentsCoverMap || typeof info.momentsCoverMap !== 'object') info.momentsCoverMap = {};
                old = String(info.momentsCoverMap[targetName] || '').trim();
                if (url) info.momentsCoverMap[targetName] = url; else delete info.momentsCoverMap[targetName];
            } else {
                old = String(info.momentsCover || '').trim();
                info.momentsCover = url || null;
            }
            this.app.wechatData.saveData();
            if (old && old !== url && (old.startsWith('/backgrounds/') || old.startsWith('/user/images/'))) {
                window.VirtualPhone?.imageManager?.deleteManagedBackgroundByPath?.(old, { quiet: true, skipIfReferenced: true })?.catch?.(() => {});
            }
            mask.remove();
            this._rerender();
        };
        mask.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => {
            mask.querySelectorAll('[data-ctab]').forEach(x => x.classList.toggle('is-on', x === b));
            mask.querySelectorAll('[data-cpane]').forEach(p => { p.hidden = p.dataset.cpane !== b.dataset.ctab; });
        }));
        mask.querySelector('[data-remove]')?.addEventListener('click', () => setCover(null));
        mask.querySelector('.moment-cover-url-ok')?.addEventListener('click', () => {
            const url = String(mask.querySelector('.moment-cover-url input')?.value || '').trim();
            if (!/^(https?:\/\/|data:image\/|\/)/i.test(url)) {
                this.app.phoneShell.showNotification('提示', '请输入有效的图片链接', '⚠️');
                return;
            }
            setCover(url);
        });
        mask.querySelector('.moment-cover-drop input')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
                const cropper = new ImageCropper({ title: '裁剪封面', outputWidth: 1080, outputHeight: 800, quality: 0.9, maxFileSize: 5 * 1024 * 1024 });
                const cropped = await cropper.open(file);
                const finalUrl = await window.VirtualPhone?.imageManager?.uploadDataUrl?.(cropped, 'moments_cover');
                setCover(finalUrl || cropped);
            } catch (error) {
                if (error?.message !== '用户取消') {
                    this.app.phoneShell.showNotification('提示', error?.message || '封面上传失败', '⚠️');
                }
            }
        });
    }

    // 点赞/取消点赞
    toggleLike(momentId) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;

        const userInfo = this.app.wechatData.getUserInfo();
        if (!moment.likeList) moment.likeList = [];

        const index = moment.likeList.indexOf(userInfo.name);

        if (index === -1) {
            moment.likeList.push(userInfo.name);
        } else {
            moment.likeList.splice(index, 1);
        }

        moment.likes = moment.likeList.length;
        this.app.wechatData.saveData();

        // 🔥 局部更新点赞区域，不刷新整个页面
        this.updateMomentInteractions(momentId);
    }

    // 🔥 局部更新朋友圈互动区
    updateMomentInteractions(momentId) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;

        // LINE（ins）帖子：整条重画（点赞心形、Liked by 都要变）
        const insEls = Array.from(document.querySelectorAll(`.ins-post[data-moment-id="${CSS.escape ? CSS.escape(String(momentId)) : momentId}"]`));
        if (insEls.length) {
            insEls.forEach(el => {
                const tmp = document.createElement('div');
                tmp.innerHTML = this._renderInsPostHtml(moment, { inProfile: !!el.closest('.ins-profile-page') }).trim();
                const fresh = tmp.firstElementChild;
                if (!fresh) return;
                el.replaceWith(fresh);
                fresh.querySelectorAll('[data-moment-profile]').forEach(n => n.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openMomentsProfile(n.dataset.momentProfile);
                }));
            });
            return;
        }

        const momentEl = this._root().querySelector(`.moment-item[data-moment-id="${momentId}"]`);
        if (!momentEl) return;

        // 🔥 保存滚动位置，防止页面跳动
        const momentsPage = this._root().querySelector('.moments-page');
        const scrollTop = momentsPage?.scrollTop || 0;

        // 找到或创建互动区
        let interactionsEl = momentEl.querySelector('.moment-interactions');
        const contentCol = momentEl.querySelector('.moment-content-col');

        const hasLikes = moment.likeList && moment.likeList.length > 0;
        const hasComments = moment.commentList && moment.commentList.length > 0;

        if (!hasLikes && !hasComments) {
            // 没有互动，移除互动区
            if (interactionsEl) interactionsEl.remove();
            // 🔥 恢复滚动位置
            if (momentsPage) momentsPage.scrollTop = scrollTop;
            return;
        }

        // 生成新的互动区HTML
        const newHtml = this.renderInteractions(moment);

        if (interactionsEl) {
            // 更新现有互动区
            interactionsEl.outerHTML = newHtml;
        } else {
            // 插入新互动区
            contentCol.insertAdjacentHTML('beforeend', newHtml);
        }

        // 🔥 恢复滚动位置
        if (momentsPage) momentsPage.scrollTop = scrollTop;

        // 重新绑定评论点击事件
        const newInteractionsEl = momentEl.querySelector('.moment-interactions');
        if (newInteractionsEl) {
            newInteractionsEl.querySelectorAll('.comment-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (!e.target.closest('.mc-reply') || e.target.closest('.mc-del')) return;
                    e.stopPropagation();
                    e.preventDefault();
                    const rowMomentId = row.dataset.momentId;
                    const author = row.dataset.author;
                    this.showCommentInput(rowMomentId, author);
                });
            });
        }
    }

    // 显示评论输入框（内嵌版）
    showCommentInput(momentId, replyTo = null) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) {
            return;
        }

        // 先移除之前的输入框
        this._root().querySelectorAll('.inline-comment-box').forEach(el => el.remove());

        // 保存当前评论目标
        this.currentCommentMomentId = momentId;
        this.currentReplyTo = replyTo;

        // 找到对应的朋友圈元素
        const momentEl = this._root().querySelector(`.moment-item[data-moment-id="${momentId}"]`);
        if (!momentEl) return;

        // 找到互动区或创建一个
        let interactionsEl = momentEl.querySelector('.moment-interactions');
        if (!interactionsEl) {
            interactionsEl = document.createElement('div');
            interactionsEl.className = 'moment-interactions';
            const host = momentEl.querySelector('.moment-content-col');
            if (host) host.appendChild(interactionsEl);
            else {
                const timeEl = momentEl.querySelector('.ins-time');
                if (timeEl) timeEl.before(interactionsEl); else momentEl.appendChild(interactionsEl);
            }
        }

        // 创建内嵌输入框
        const inputBox = document.createElement('div');
        inputBox.className = 'inline-comment-box';
        inputBox.innerHTML = `
            <input type="text" class="inline-comment-input" placeholder="${replyTo ? `回复 ${replyTo}` : '评论'}" autofocus>
            <button class="inline-comment-send"><i class="fa-solid fa-paper-plane"></i></button>
        `;
        interactionsEl.appendChild(inputBox);

        // 绑定事件
        const input = inputBox.querySelector('.inline-comment-input');
        const sendBtn = inputBox.querySelector('.inline-comment-send');

        input.focus();

        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.submitInlineComment(input.value, inputBox);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                this.submitInlineComment(input.value, inputBox);
            }
        });

        input.addEventListener('click', (e) => e.stopPropagation());
        inputBox.addEventListener('click', (e) => e.stopPropagation());

        // 滚动到输入框可见
        inputBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 🗑️ 删除我自己的评论
    _confirmDeleteMyComment(momentId, idx) {
        const moment = this.app.wechatData.getMoment(momentId);
        const c = moment?.commentList?.[idx];
        if (!c || !this._isSelfName(c.name)) return;
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog" role="dialog">
                <div class="moment-dialog-title">删除这条评论？</div>
                <div class="moment-dialog-sub">${this._escapeHtml(String(c.text || '').replace(/\s*\[\s*翻译\s*[:：][^\]]*\]\s*$/, '').slice(0, 60))}</div>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary" data-ok>删除</button>
                </div>
            </div>`);
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            const live = this.app.wechatData.getMoment(momentId);
            const list = live?.commentList || [];
            const i = list[idx] && list[idx].text === c.text ? idx : list.findIndex(x => x && x.name === c.name && x.text === c.text);
            if (i >= 0) list.splice(i, 1);
            if (live) live.comments = list.length;
            this.app.wechatData.saveData();
            mask.remove();
            this._rerender();
        });
    }

    // ✨ 好友互动：有我还没被回应的评论/回复，就让大家回应这些；没有就围绕这条动态互动
    _triggerFriendsReact(momentId) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;
        const mine = (moment.commentList || []).filter(c => c?.pendingAI && this._isSelfName(c.name));
        if (!mine.length) {
            this.triggerAIReaction(momentId, 'post', moment.text || '').catch(() => {});
            return;
        }
        const plain = (t) => {
            const raw = String(t || '');
            return /\[\s*翻译\s*[:：]/.test(raw) ? (parseWechatTranslationContent(raw).translationText || raw) : raw;
        };
        const text = mine.map(c => (c.replyTo ? `（回复${c.replyTo}）` : '') + plain(c.text)).join('\n');
        const replyTo = mine[mine.length - 1].replyTo || null;
        mine.forEach(c => { delete c.pendingAI; });
        this.app.wechatData.saveData();
        this.triggerAIReaction(momentId, 'comment', text, replyTo).catch(() => {});
    }

    // 我的评论要不要翻译：''=不翻译，'auto'=跟随对方私聊的「自动翻译我发出的消息」，其他=固定翻成这种语言
    _myCommentLangPref() {
        const v = this.app.wechatData.getUserInfo()?.momentsCommentLang;
        return v === undefined || v === null ? 'auto' : String(v);
    }

    // 🌐 我的评论：对方（被回复的人，没有就是发帖人）私聊里开了「自动翻译我发出的消息」，
    //   就把评论翻成对应语言显示，「查看翻译」能看回中文原文
    _translateMyComment(moment, commentObj, replyTo = null) {
        try {
            const pref = this._myCommentLangPref();
            if (!pref) return;
            let lang = '';
            if (pref === 'auto') {
                const target = String(replyTo || (this._isSelfMoment(moment) ? '' : moment?.name) || '').trim();
                if (!target || this._isSelfName(target)) return;
                const t = this.app.wechatData.getMemberTranslationSettings?.(target) || {};
                if (!t.autoTranslateOut) return;
                lang = String(t.translateOutTo || '').trim();
            } else {
                lang = pref;
            }
            if (!lang || lang === 'zh-CN') return;
            const translator = this.app.chatView?._translateTextViaProvider?.bind(this.app.chatView);
            if (!translator) return;
            const original = String(commentObj.text || '').trim();
            if (!original || /\[\s*翻译\s*[:：]/.test(original)) return;
            translator(original, lang).then(out => {
                const translated = String(out || '').trim();
                if (!translated || translated === original) return;
                const live = this.app.wechatData.getMoment(moment?.id) || moment;
                const list = Array.isArray(live?.commentList) ? live.commentList : [];
                const target2 = list.includes(commentObj) ? commentObj
                    : [...list].reverse().find(c => this._isSelfName(c?.name) && String(c?.text || '').trim() === original);
                if (!target2) return;
                target2.text = `${translated} [翻译:${original}]`;
                this.app.wechatData.saveData();
                this._rerender();
            }).catch(err => console.warn('⚠️ 朋友圈评论翻译失败:', err));
        } catch (e) { /* 忽略 */ }
    }

    // 提交内嵌评论
    submitInlineComment(text, inputBox) {
        const comment = text?.trim();
        if (!comment || !this.currentCommentMomentId) return;

        const moment = this.app.wechatData.getMoment(this.currentCommentMomentId);
        if (!moment) return;

        if (!moment.commentList) moment.commentList = [];

        const userInfo = this.app.wechatData.getUserInfo();
        const myComment = {
            name: userInfo.name,
            text: comment,
            replyTo: this.currentReplyTo || null,
            pendingAI: true
        };
        moment.commentList.push(myComment);
        this._translateMyComment(moment, myComment, this.currentReplyTo || null);

        moment.comments = moment.commentList.length;
        this.app.wechatData.saveData();

        // 保存用于AI回复
        const momentId = this.currentCommentMomentId;
        const replyTo = this.currentReplyTo;

        // 清空状态
        this.currentCommentMomentId = null;
        this.currentReplyTo = null;

        // 刷新界面
        this._rerender();

        // 不自动召唤好友互动：可以连发几条、发错了还能删改，想要大家回应时再点 ✨（好友互动）
        void momentId; void replyTo;
    }

    // 🔥 提交评论
    async submitComment() {
        const input = document.getElementById('moments-comment-input');
        const commentBar = document.getElementById('moments-comment-bar');
        const comment = input?.value?.trim();

        if (!comment || !this.currentCommentMomentId) return;

        const moment = this.app.wechatData.getMoment(this.currentCommentMomentId);
        if (!moment) return;

        if (!moment.commentList) moment.commentList = [];

        const userInfo = this.app.wechatData.getUserInfo();
        const myComment = {
            name: userInfo.name,
            text: comment,
            replyTo: this.currentReplyTo || null,
            pendingAI: true
        };
        moment.commentList.push(myComment);
        this._translateMyComment(moment, myComment, this.currentReplyTo || null);

        moment.comments = moment.commentList.length;
        this.app.wechatData.saveData();

        // 隐藏输入框
        if (commentBar) commentBar.style.display = 'none';

        // 保存momentId用于AI回复
        const momentId = this.currentCommentMomentId;
        const replyTo = this.currentReplyTo;

        // 清空状态
        this.currentCommentMomentId = null;
        this.currentReplyTo = null;

        // 刷新界面
        this.app.render();

        // 不自动召唤好友互动，等用户点 ✨（好友互动）
        void momentId; void replyTo;
    }

    // 触发AI反应（回复评论、回赞等）
    async triggerAIReaction(momentId, actionType, userComment = '', replyTo = null) {
        const moment = this.app.wechatData.getMoment(momentId);
        if (!moment) return;

        const userInfo = this.app.wechatData.getUserInfo();
        const aiImageDataCache = new Map();
        const aiImageNotes = [];
        const momentImages = Array.isArray(moment.images) ? moment.images : [];
        for (let i = 0; i < momentImages.length; i++) {
            const parsed = this._parseMomentImageItem(momentImages[i]);
            const imageLabel = parsed.descriptionText || parsed.promptText || `图片${i + 1}`;
            if (parsed.isDirectImage && parsed.realUrl) {
                const resolvedImageData = await this._resolveMomentImageForAi(parsed.realUrl, aiImageDataCache);
                if (resolvedImageData && resolvedImageData.startsWith('data:image')) {
                    const imgId = `__ST_PHONE_IMAGE_${Date.now()}_${Math.random().toString(36).substr(2, 5)}__`;
                    if (!window.VirtualPhone._pendingImages) {
                        window.VirtualPhone._pendingImages = {};
                    }
                    window.VirtualPhone._pendingImages[imgId] = resolvedImageData;
                    aiImageNotes.push(`- 图片${i + 1}：${imageLabel} ${imgId}`);
                } else {
                    aiImageNotes.push(`- 图片${i + 1}：${imageLabel || '[图片]'}`);
                }
                continue;
            }
            if (imageLabel) {
                aiImageNotes.push(`- 图片${i + 1}：${imageLabel}`);
            }
        }
        const visibleContacts = this.app.wechatData.getMomentVisibleContacts?.(moment)
            || (this.app.wechatData.getContacts() || []);
        const contactNames = visibleContacts
            .map(c => String(c?.name || '').trim())
            .filter(Boolean);
        const allowedContactSet = new Set(contactNames);
        if (allowedContactSet.size === 0) {
            console.info('ℹ️ [朋友圈] 当前动态没有可互动的可见好友，跳过AI互动');
            return;
        }

        const visibility = this.app.wechatData.normalizeMomentVisibility?.(moment)
            || { type: 'public', contactNames: [] };
        const visibilityRule = visibility.type === 'exclude'
            ? `仅允许以下可见好友互动；被设为“不给谁看”的好友完全不知道此动态，绝对不能点赞、评论或被写进回复：${contactNames.join('、') || '无'}`
            : (visibility.type === 'include'
                ? `本动态仅向以下好友开放，名单外任何人都完全不知道此动态，绝对不能点赞、评论或被写进回复：${contactNames.join('、') || '无'}`
                : `本动态公开，但互动者仍只能从以下通讯录好友中选择：${contactNames.join('、') || '无'}`);
        const currentLikes = (Array.isArray(moment.likeList) ? moment.likeList : [])
            .map(name => String(name || '').trim())
            .filter(name => name && allowedContactSet.has(name));
        const currentComments = (Array.isArray(moment.commentList) ? moment.commentList : [])
            .filter(comment => {
                const name = String(comment?.name || '').trim();
                return name === String(userInfo.name || '').trim() || allowedContactSet.has(name);
            });

        const promptManager = window.VirtualPhone?.promptManager;
        const interactionTemplate = promptManager?.getPromptForFeature?.('wechat', 'momentsInteraction') || '';
        const actionTypeText = actionType === 'like' ? '点赞' : actionType === 'comment' ? '评论' : '发布朋友圈';
        const promptVars = {
            '{{userName}}': userInfo.name || '用户',
            '{{momentAuthor}}': moment.name || '未知',
            '{{momentContent}}': this._momentTextForPrompt(moment.text) || '[图片]',
            '{{currentLikes}}': currentLikes.join('、') || '无',
            '{{currentComments}}': currentComments.map(c => `${c.name}${c.replyTo ? '回复' + c.replyTo : ''}：${c.text}`).join('\n') || '无',
            '{{contactNames}}': contactNames.join('、') || '无',
            '{{visibilityRule}}': visibilityRule,
            '{{imageNotes}}': aiImageNotes.length > 0 ? `\n- 图片内容参考（含多模态图片数据）：\n${aiImageNotes.join('\n')}` : '',
            '{{actionType}}': actionTypeText,
            '{{userCommentLine}}': actionType === 'comment' ? `- 评论内容：${userComment}` : '',
            '{{postContentLine}}': actionType === 'post' ? `- 发布内容：${userComment || moment.text || '[图片]'}${moment.images?.length ? `（含${moment.images.length}张图片）` : ''}` : '',
            '{{replyToLine}}': replyTo ? `- 回复对象：${replyTo}` : ''
        };

        const buildPromptFromTemplate = (template) => {
            let next = String(template || '');
            Object.entries(promptVars).forEach(([key, value]) => {
                next = next.split(key).join(String(value || ''));
            });
            return next;
        };

        const fallbackPrompt = `【朋友圈互动回复任务】
用户"${userInfo.name}"在朋友圈进行了互动，请生成合适的回复。
朋友圈信息：
- 发布者：${moment.name}
- 内容：${this._momentTextForPrompt(moment.text) || '[图片]'}
- 现有点赞：${currentLikes.join('、') || '无'}
- 现有评论：${currentComments.map(c => `${c.name}${c.replyTo ? '回复' + c.replyTo : ''}：${c.text}`).join('\n') || '无'}
- 可用通讯录好友（仅可从这里选择回复者/点赞者）：${contactNames.join('、') || '无'}
- 隐私硬约束：${visibilityRule}
${aiImageNotes.length > 0 ? `\n- 图片内容参考（含多模态图片数据）：\n${aiImageNotes.join('\n')}` : ''}
用户行为：
- 类型：${actionTypeText}
${actionType === 'comment' ? `- 评论内容：${userComment}` : ''}
${actionType === 'post' ? `- 发布内容：${userComment || moment.text || '[图片]'}${moment.images?.length ? `（含${moment.images.length}张图片）` : ''}` : ''}
${replyTo ? `- 回复对象：${replyTo}` : ''}
请只返回JSON，包含 shouldReply 与 reactions（type 仅 comment/like，name 必须来自通讯录好友）。`;
        const prompt = (interactionTemplate ? buildPromptFromTemplate(interactionTemplate) : fallbackPrompt)
            + this._buildMomentLanguageRule(contactNames);

        try {
            this.app.phoneShell.showNotification(this._momentsLabel(), ({ line: '好友正在回应…', qq: '好友正在空间里互动…' })[this._getMomentsSkin()] || '好友正在互动…', '👀');

            const result = await this.callAI(prompt);
            const defaultReplyTo = actionType === 'comment' ? userInfo.name : null;
            const reactions = this._normalizeMomentReactions(result, allowedContactSet, defaultReplyTo, {
                momentAuthor: moment.name || '',
                userName: userInfo.name || '',
                existingCommentNames: currentComments.map(comment => comment?.name)
            });

            if (reactions.length > 0) {
                let appliedCount = 0;
                let commentAppliedCount = 0;
                let likeAppliedCount = 0;
                // 延迟添加回复，模拟真实感
                for (let i = 0; i < reactions.length; i++) {
                    const reaction = reactions[i];
                    const reactionName = reaction.name;

                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                    // 每轮都重新获取最新 moment，避免 await 期间对象已被 loadData/render 替换
                    const liveMoment = this.app.wechatData.getMoment(momentId);
                    if (!liveMoment) {
                        console.warn('⚠️ [朋友圈] 目标动态已不存在，停止写入互动:', momentId);
                        break;
                    }
                    const liveContact = this.app.wechatData.findContactByNameLoose?.(
                        reactionName,
                        { includeChats: false }
                    ) || reactionName;
                    if (this.app.wechatData.canContactViewMoment?.(liveMoment, liveContact) === false) {
                        console.warn('⚠️ [朋友圈] 已拦截无权查看动态的好友互动:', reactionName);
                        continue;
                    }

                    if (reaction.type === 'comment' && reaction.text) {
                        if (!liveMoment.commentList) liveMoment.commentList = [];
                        liveMoment.commentList.push({
                            name: reactionName,
                            text: reaction.text,
                            replyTo: reaction.replyTo || null
                        });
                        liveMoment.comments = liveMoment.commentList.length;
                        appliedCount++;
                        commentAppliedCount++;
                    } else if (reaction.type === 'like') {
                        if (!liveMoment.likeList) liveMoment.likeList = [];
                        if (!liveMoment.likeList.includes(reactionName)) {
                            liveMoment.likeList.push(reactionName);
                            liveMoment.likes = liveMoment.likeList.length;
                            appliedCount++;
                            likeAppliedCount++;
                        }
                    }
                }

                if (appliedCount > 0) {
                    this.app.wechatData.saveData();
                    this._rerender();
                    const notifyText = commentAppliedCount > 0
                        ? (likeAppliedCount > 0 ? '收到新评论和点赞' : '收到新评论')
                        : '收到新点赞';
                    this.app.phoneShell.showNotification('朋友圈', notifyText, '💬');
                } else {
                    console.warn('⚠️ [朋友圈] AI返回了互动，但全部被过滤或去重，未落库');
                }
            }
        } catch (error) {
            console.error('❌ AI回复失败:', error);
            // 静默失败，不打扰用户
        }
    }

    _normalizeMomentReactions(result, allowedContactSet, defaultReplyTo, options = {}) {
        const normalizeName = (value) => String(value || '')
            .trim()
            .replace(/^@+/, '')
            .replace(/[，,。；;：:\s]+$/g, '')
            .trim();
        const momentAuthor = String(options?.momentAuthor || '').trim();
        const userName = String(options?.userName || '').trim();
        const existingCommentNames = Array.isArray(options?.existingCommentNames)
            ? options.existingCommentNames.map(name => normalizeName(name)).filter(Boolean)
            : [];
        const authorAliases = new Set(['发布者', '作者', '博主', '楼主']);
        const canonicalName = (value) => {
            const raw = normalizeName(value);
            if (!raw) return '';
            if (authorAliases.has(raw)) {
                // 发布者就是用户本人时，禁止自动代替用户发言
                if (momentAuthor && userName && momentAuthor === userName) return '';
                if (momentAuthor && allowedContactSet.has(momentAuthor)) return momentAuthor;
                return '';
            }
            if (raw === '我' || raw === '自己' || raw === '{{user}}') {
                return '';
            }
            if (allowedContactSet.has(raw)) return raw;
            const key = raw.replace(/\s+/g, '').toLowerCase();
            const matched = [...allowedContactSet].find((name) => String(name || '').replace(/\s+/g, '').toLowerCase() === key);
            return matched || '';
        };
        const ensureReplyTo = (replyTo) => {
            const cleaned = normalizeName(replyTo || '');
            if (!cleaned) return String(defaultReplyTo || '').trim() || null;
            if (authorAliases.has(cleaned)) {
                if (momentAuthor === userName || allowedContactSet.has(momentAuthor)) return momentAuthor;
                return null;
            }
            if (cleaned === userName || allowedContactSet.has(cleaned)) return cleaned;
            return null;
        };

        const parseXmlLike = (rawText) => {
            const text = String(rawText || '').trim();
            if (!text) return [];
            const blockMatch = text.match(/<朋友圈互动>([\s\S]*?)<\/朋友圈互动>/i);
            const payload = (blockMatch ? blockMatch[1] : text).trim();
            if (!payload) return [];

            const rows = payload.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const parsed = [];
            rows.forEach((line) => {
                const likeMatch = /^\[点赞\]\s*(.+)$/i.exec(line);
                if (likeMatch) {
                    likeMatch[1]
                        .split(/[，,]/)
                        .map(item => canonicalName(item))
                        .filter(Boolean)
                        .forEach((name) => parsed.push({ type: 'like', name }));
                    return;
                }

                const replyMatch = /^(.+?)\s*回复\s*(.+?)\s*[：:]\s*(.+)$/.exec(line);
                if (replyMatch) {
                    const name = canonicalName(replyMatch[1]);
                    const replyTo = ensureReplyTo(replyMatch[2]);
                    const textValue = String(replyMatch[3] || '').trim();
                    if (!name || !textValue) return;
                    parsed.push({ type: 'comment', name, text: textValue, replyTo });
                    return;
                }

                const commentMatch = /^(.+?)[：:]\s*(.+)$/.exec(line);
                if (commentMatch) {
                    const name = canonicalName(commentMatch[1]);
                    const textValue = String(commentMatch[2] || '').trim();
                    if (!name || !textValue) return;
                    parsed.push({ type: 'comment', name, text: textValue, replyTo: ensureReplyTo('') });
                }
            });

            return parsed;
        };

        const rows = Array.isArray(result?.reactions)
            ? result.reactions
            : (Array.isArray(result?.data?.reactions) ? result.data.reactions : []);
        const output = [];
        const pushReaction = (item) => {
            const typeRaw = String(item?.type || '').trim().toLowerCase();
            const type = typeRaw === '点赞' ? 'like' : (typeRaw === '评论' ? 'comment' : typeRaw);
            if (type !== 'comment' && type !== 'like') return;

            const name = canonicalName(item?.name || '');
            if (!name) return;

            if (type === 'comment') {
                const text = String(item?.text || item?.content || '').trim();
                if (!text) return;
                output.push({
                    type: 'comment',
                    name,
                    text,
                    replyTo: ensureReplyTo(item?.replyTo)
                });
                return;
            }

            output.push({
                type: 'like',
                name
            });
        };

        if (rows.length > 0) {
            rows.forEach(pushReaction);
        } else {
            const xmlSource = String(result?.raw || result?.text || result?.content || result?.summary || '').trim();
            parseXmlLike(xmlSource).forEach(pushReaction);
        }

        if (output.length === 0) {
            const fallbackText = String(result?.content || '').trim();
            parseXmlLike(fallbackText).forEach(pushReaction);
        }

        const replyableNames = new Set(existingCommentNames);
        return output.map((reaction) => {
            if (reaction.type !== 'comment') return reaction;

            const replyTarget = normalizeName(reaction.replyTo || '');
            const hasVisibleTarget = replyTarget
                && replyTarget !== reaction.name
                && replyableNames.has(replyTarget);
            replyableNames.add(reaction.name);

            return {
                ...reaction,
                replyTo: hasVisibleTarget ? replyTarget : null
            };
        });
    }

    _normalizeAiMomentsPayload(result) {
        if (!result || typeof result !== 'object') return [];

        let rows = [];
        if (Array.isArray(result?.moments)) {
            rows = result.moments;
        } else if (Array.isArray(result?.data?.moments)) {
            rows = result.data.moments;
        } else if (Array.isArray(result?.posts)) {
            rows = result.posts;
        } else if (Array.isArray(result?.data?.posts)) {
            rows = result.data.posts;
        }

        if (!Array.isArray(rows) || rows.length === 0) return [];

        const normalized = rows.map((item) => {
            const name = String(item?.name || item?.author || '').trim();
            if (!name) return null;

            const cleaned = this._cleanMomentTextAndImages(String(item?.text || item?.content || '').trim(), Array.isArray(item?.images) ? item.images : []);
            const text = cleaned.text;
            const images = cleaned.images;
            const time = String(item?.time || '').trim() || '刚刚';
            const location = String(item?.location || '').trim();

            const likeList = Array.isArray(item?.likeList)
                ? item.likeList
                : (Array.isArray(item?.likes) ? item.likes : []);

            const commentListRaw = Array.isArray(item?.commentList)
                ? item.commentList
                : (Array.isArray(item?.comments) ? item.comments : []);
            const commentList = commentListRaw
                .map((c) => ({
                    name: String(c?.name || c?.user || '').trim(),
                    text: String(c?.text || c?.content || '').trim(),
                    replyTo: String(c?.replyTo || c?.reply_to || '').trim() || null
                }))
                .filter((c) => c.name && c.text);

            return {
                name,
                avatar: String(item?.avatar || '').trim() || '👤',
                text,
                images,
                time,
                location,
                likeList: likeList.map(v => String(v || '').trim()).filter(Boolean),
                commentList
            };
        }).filter(Boolean);

        return normalized;
    }

    // 🌐 按各好友私聊里的翻译设置，告诉 AI 谁用外语发帖/评论
    _buildMomentLanguageRule(names = []) {
        const rows = [];
        const plain = [];
        [...new Set((names || []).map(n => String(n || '').trim()).filter(Boolean))].forEach(name => {
            const t = this._getAuthorTranslation(name);
            if (t.on) rows.push(`- ${name}：用「${t.label}」`);
            else plain.push(name);
        });
        if (!rows.length) return '\n\n【语言】所有朋友圈正文和评论都用简体中文，不要附 [翻译:] 标签。';
        return `\n\n【语言·先译文后中文（必须遵守）】以下好友无论是发朋友圈正文，还是写评论、回复别人的评论（commentList 里的 text），都必须直接用指定语言书写，并在该段文字末尾附上简体中文译文标签 [翻译:中文译文]（例如：今日は疲れた [翻译:今天好累]）。看评论者是谁，就按谁的语言写，不能因为发帖人说中文就改用中文；其他人${plain.length ? `（${plain.slice(0, 20).join('、')}）` : ''}直接用中文、不要加 [翻译:] 标签：\n${rows.join('\n')}\n评论示例：{"name":"${(rows[0] || '').replace(/^- (.*?)：.*$/, '$1')}","text":"（用TA的语言写的评论） [翻译:中文意思]"}\n图片只放进 images 数组，正文里不要写 [图片] 标签。`;
    }

    _momentTextForPrompt(text = '') {
        const raw = String(text || '');
        if (!/\[\s*翻译\s*[:：]/.test(raw)) return raw;
        const p = parseWechatTranslationContent(raw);
        return `${p.speechText}（中文意思：${p.translationText}）`;
    }

    _isHoneyMomentContact(contact = {}) {
        const sourceApp = String(contact?.sourceApp || contact?.extra?.sourceApp || '').trim().toLowerCase();
        const sourceLabel = String(contact?.sourceLabel || contact?.extra?.sourceLabel || '').trim();
        const relation = String(contact?.relation || contact?.extra?.relation || '').trim();
        return sourceApp === 'honey'
            || sourceLabel.includes('蜜语')
            || sourceLabel.includes('主播')
            || relation.includes('蜜语')
            || relation.includes('主播');
    }

    _trimMomentPromptText(value, maxLength = 260) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
    }

    async _getHoneyMomentHistorySummary(contact = {}) {
        const hostName = String(contact?.honeyHostName || contact?.honeySource || contact?.name || '').trim();
        if (!hostName) return '';
        try {
            const mod = await import('../honey/honey-data.js');
            const HoneyData = mod?.HoneyData;
            if (!HoneyData) return '';
            const honeyData = window.VirtualPhone?.honeyApp?.honeyData || new HoneyData(this.app.storage || window.VirtualPhone?.storage);
            const summary = honeyData.getHostHistorySummary?.(hostName);
            const summaryText = typeof honeyData.formatHostHistorySummaryForContext === 'function'
                ? honeyData.formatHostHistorySummaryForContext(summary)
                : String(summary?.text || '').trim();
            return this._trimMomentPromptText(summaryText, 360);
        } catch (error) {
            console.warn('[朋友圈] 读取蜜语好友资料失败:', error);
            return '';
        }
    }

    async _buildMomentContactInfo(contact = {}) {
        const name = String(contact?.name || '').trim();
        if (!name) return '';

        const relation = String(contact?.relation || '好友').trim() || '好友';
        const notes = [];

        if (this._isHoneyMomentContact(contact)) {
            const sourceLabel = String(contact?.sourceLabel || '').trim();
            const honeySource = String(contact?.honeySource || sourceLabel || '蜜语').trim();
            const visibleIntro = this._trimMomentPromptText(contact?.honeyVisibleIntro || '', 260);
            const hiddenBackground = this._trimMomentPromptText(contact?.honeyHiddenBackground || '', 320);
            const historySummary = await this._getHoneyMomentHistorySummary(contact);

            notes.push(`蜜语资料: ${honeySource}`);
            if (visibleIntro) notes.push(`对外申请话术: ${visibleIntro}`);
            if (hiddenBackground) notes.push(`隐藏设定: ${hiddenBackground}`);
            if (historySummary) notes.push(`蜜语互动摘要: ${historySummary}`);
        }

        return `${name}(${relation}${notes.length ? `；${notes.join('；')}` : ''})`;
    }

    // ⏱️ 等某一步最多 ms 毫秒，超时就用兜底值继续（避免某一步卡住导致一直转圈、根本没发请求）
    _momentStep(text, ok = true) {
        try { window.__yzPhoneApiLog?.step?.('朋友圈', text, { ok }); } catch (e) { /* 忽略 */ }
    }

    async _withTimeout(promise, ms, fallback, label = '') {
        let timer = null;
        const timeout = new Promise(resolve => {
            timer = setTimeout(() => {
                if (label) this._momentStep(`${label}超过 ${Math.round(ms / 1000)} 秒没完成，已跳过`, false);
                resolve(fallback);
            }, ms);
        });
        try {
            return await Promise.race([Promise.resolve(promise).catch(err => {
                if (label) this._momentStep(`${label}出错：${err?.message || err}，已跳过`, false);
                return fallback;
            }), timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    // 从AI加载朋友圈
    async loadMomentsFromAI(options = {}) {
        // 上一次生成异常卡死超过 5 分钟：允许重新开始
        if (this.isLoading && this._loadingSince && Date.now() - this._loadingSince > 5 * 60 * 1000) {
            this.isLoading = false;
            this._setGenerateBusy(false);
        }
        if (this.isLoading) {
            // 正在生成时再点：可以停掉（请求会被真正取消，不会一直挂着）
            if (this._momentsAbort && confirm('朋友圈还在生成中，要停止这次生成吗？')) {
                try { this._momentsAbort.abort(new Error('已手动停止')); } catch (e) { this._momentsAbort.abort(); }
            }
            return;
        }
        this._loadingSince = Date.now();
        this._momentStep('开始生成动态');
        const genCount = Math.max(1, Math.min(10, Number.parseInt(options.count, 10) || 0)) || 0;
        const mustNames = Array.isArray(options.mustInclude) ? options.mustInclude.map(n => String(n || '').trim()).filter(Boolean) : [];
        const onlySelected = !!options.onlySelected && mustNames.length > 0;

        this.isLoading = true;
        this.syncMomentsPullIndicator('loading');
        this._setGenerateBusy(true);
        this.app.phoneShell.showNotification(this._momentsLabel(), `正在生成${this._momentsLabel()}…`, '✨');

        try {
            // 获取联系人列表
            const contacts = this.app.wechatData.getContacts();
            if (contacts.length === 0) {
                this.app.phoneShell.showNotification('提示', '请先添加联系人', '⚠️');
                this.isLoading = false;
                this.syncMomentsPullIndicator('error');
                return;
            }

            // 获取朋友圈提示词
            const promptManager = window.VirtualPhone?.promptManager;
            if (!promptManager?.renderPromptForFeature) {
                throw new Error('朋友圈提示词管理器未初始化');
            }

            // 获取时间
            const timeManager = window.VirtualPhone?.timeManager;
            const currentTime = timeManager?.getCurrentStoryTime?.() || { date: '2024年1月1日', time: '12:00' };

            // 🔥 收集记忆表格信息（如果Gaigai插件存在）
            let memoryInfo = '';
            if (window.Gaigai?.m?.s && Array.isArray(window.Gaigai.m.s)) {
                const memoryLines = [];
                window.Gaigai.m.s.forEach(section => {
                    if (section.r && section.r.length > 0) {
                        section.r.slice(0, 5).forEach(row => { // 每个section最多5条
                            const rowText = Object.values(row).join(' ').substring(0, 200);
                            if (rowText.trim()) {
                                memoryLines.push(rowText);
                            }
                        });
                    }
                });
                if (memoryLines.length > 0) {
                    memoryInfo = `【记忆信息】
${memoryLines.slice(0, 10).join('\n')}
`;
                }
            }

            // 构建联系人信息（蜜语好友要读额外资料，单个最多等 6 秒，卡住就只用名字和关系）
            const contactsInfo = (await Promise.all(contacts.map(c => this._withTimeout(
                this._buildMomentContactInfo(c),
                6000,
                `${String(c?.name || '').trim()}(${String(c?.relation || '好友').trim() || '好友'})`,
                `读取「${String(c?.name || '').trim()}」的资料`
            ))))
                .filter(Boolean)
                .join('、');
            this._momentStep(`联系人资料准备好了（${contacts.length} 人）`);
            const prompt = promptManager.renderPromptForFeature('wechat', 'moments', {
                currentStoryTime: `${currentTime.date} ${currentTime.time}`,
                memoryInfo,
                contactsInfo
            });
            if (!String(prompt || '').trim()) {
                throw new Error('朋友圈提示词为空，请在微信设置中恢复默认提示词');
            }
            let promptWithLang = String(prompt) + this._buildMomentLanguageRule(contacts.map(c => c?.name));
            if (genCount) promptWithLang += `\n\n【本次数量】本次只生成 ${genCount} 条朋友圈动态，不多不少。`;
            if (mustNames.length) {
                promptWithLang += onlySelected
                    ? `\n\n【指定发布者】本次的朋友圈只能由以下好友发布（每人至少一条，发布者不得出现名单外的人）：${mustNames.join('、')}`
                    : `\n\n【必定出现】以下好友本次必须各发至少一条朋友圈：${mustNames.join('、')}；其余名额从通讯录里随机挑合适的人。`;
            } else {
                promptWithLang += '\n\n【发布者】从通讯录好友里随机挑选合适的人发布，不要总是同几个人。';
            }
            const recentExisting = (this.app.wechatData.getMoments() || []).slice(0, 12)
                .map(m => `- ${m.name}：${this._momentTextForPrompt(m.text).slice(0, 40)}`).join('\n');
            if (recentExisting) promptWithLang += `\n\n【已发布的动态（不要重复或高度相似）】\n${recentExisting}`;
            promptWithLang += '\n\n【配图不是必须的】像真人一样：很多动态只发文字（这时 images 写空数组 []），只有确实拍了照片、适合配图的内容才配图；本次大约一半左右的动态是纯文字，按角色习惯决定，不要每条都配图。';


            // 调用AI
            this._momentStep('提示词已生成，准备发送请求');
            const result = await this.callAI(promptWithLang);
            this._momentStep('AI 已返回，正在解析');

            let normalizedMoments = this._normalizeAiMomentsPayload(result);
            if (onlySelected) {
                const allow = new Set(mustNames);
                normalizedMoments = normalizedMoments.filter(m => allow.has(String(m.name || '').trim()));
            }
            if (genCount) normalizedMoments = normalizedMoments.slice(0, genCount);
            if (normalizedMoments.length > 0) {
                const currentUserName = String(this.app.wechatData.getUserInfo()?.name || '').trim();
                const existingMoments = Array.isArray(this.app.wechatData.data.moments)
                    ? this.app.wechatData.data.moments
                    : [];
                const preservedMoments = existingMoments.filter(moment => {
                    const authorName = String(moment?.name || '').trim();
                    const likeList = Array.isArray(moment?.likeList) ? moment.likeList : [];
                    const isOwnMoment = !!currentUserName && authorName === currentUserName;
                    const isLikedByUser = !!currentUserName && likeList.includes(currentUserName);
                    return isOwnMoment || isLikedByUser;
                });

                const newMoments = normalizedMoments.map(m => {
                    // 🔥 优先使用联系人的真实头像，如果没有才用AI返回的
                    const contactAvatar = this.getContactAvatar(m.name);
                    const finalAvatar = (contactAvatar && contactAvatar !== '👤') ? contactAvatar : (m.avatar || '👤');
                    const momentStoryTime = this._resolveMomentStoryTime(m.time, currentTime);

                    return {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        name: m.name,
                        avatar: finalAvatar,
                        text: m.text,
                        images: m.images || [],
                        location: m.location || '',
                        time: momentStoryTime.time,
                        date: momentStoryTime.date,
                        weekday: momentStoryTime.weekday,
                        timestamp: momentStoryTime.timestamp,
                        likes: m.likeList?.length || 0,
                        likeList: m.likeList || [],
                        comments: m.commentList?.length || 0,
                        commentList: m.commentList || []
                    };
                });

                // 新生成的放在最前面，旧朋友圈全部保留（每个人的朋友圈都能看到历史动态）
                void preservedMoments;
                this.app.wechatData.data.moments = [...newMoments, ...existingMoments];
                this.app.phoneShell.showNotification(this._momentsLabel(), `新增 ${newMoments.length} 条${this._momentsLabel()}`, '✅');
                // 先等保存写进存储再刷新：刷新时会从存储重新读一遍数据，没写完就会把新动态“读丢”
                try { if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = this.app.wechatData; } catch (e) { /* 忽略 */ }
                try { await this.app.wechatData.saveData(); } catch (e) { /* 忽略 */ }
                this.syncMomentsPullIndicator('success');
                this.app.render();
                // 生成期间酒馆可能触发别的模块用旧数据回存，把新动态冲掉：稍后检查一遍，丢了就补回去
                const newIds = new Set(newMoments.map(m => m.id));
                const ensure = async () => {
                    const live = this.app.wechatData;
                    try { live.data = live.loadData(); } catch (e) { /* 忽略 */ }
                    const list = Array.isArray(live.data?.moments) ? live.data.moments : [];
                    const have = new Set(list.map(m => m?.id));
                    const missing = newMoments.filter(m => !have.has(m.id));
                    if (!missing.length) return;
                    live.data.moments = [...missing, ...list.filter(m => !newIds.has(m?.id))];
                    try { if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = live; } catch (e) { /* 忽略 */ }
                    try { await live.saveData(); } catch (e) { /* 忽略 */ }
                    if (this.app.currentView === 'discover' && !this.app.currentChat) this.app.render();
                };
                setTimeout(ensure, 800);
                setTimeout(ensure, 2500);
            } else {
                this.syncMomentsPullIndicator('error');
                this.app.phoneShell.showNotification('朋友圈', '这次没有生成出内容，再试一次吧', '⚠️');
            }

        } catch (error) {
            console.error('❌ 加载朋友圈失败:', error);
            this._momentStep(`生成失败：${error?.message || error}`, false);
            this.syncMomentsPullIndicator('error');
            this.app.phoneShell.showNotification('错误', error.message, '❌');
        } finally {
            this.isLoading = false;
            this._loadingSince = 0;
            this._setGenerateBusy(false);
            setTimeout(() => this.syncMomentsPullIndicator(), 1300);
        }
    }

    _setGenerateBusy(busy) {
        document.querySelectorAll('#moments-generate-btn').forEach(btn => btn.classList.toggle('is-busy', !!busy));
    }

    // 🪄 生成朋友圈：选条数 + 必定出现的人 / 随机
    showGenerateMomentsSheet() {
        if (this.isLoading) {
            this.app.phoneShell.showNotification('朋友圈', '正在生成中，请稍等', '⏳');
            return;
        }
        const contacts = (this.app.wechatData.getContacts() || []).filter(c => String(c?.name || '').trim());
        if (!contacts.length) {
            this.app.phoneShell.showNotification('提示', '请先添加联系人', '⚠️');
            return;
        }
        let count = 3;
        const picked = new Set();
        let onlySelected = false;
        const mask = this._mountMomentSheet(`
            <div class="moment-dialog moment-gen-dialog" role="dialog">
                <div class="moment-dialog-title">生成${this._momentsLabel()}</div>
                <div class="moment-gen-label">生成条数</div>
                <div class="moment-gen-count">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<button type="button" data-count="${n}" class="${n === count ? 'is-on' : ''}">${n}</button>`).join('')}</div>
                <div class="moment-gen-label">必定出现的人 <small>不选 = 随机</small></div>
                <div class="moment-gen-people">
                    ${contacts.map(c => `<button type="button" class="moment-gen-person" data-name="${this._escapeAttr(c.name)}"><span class="moment-gen-av">${this.app.renderAvatar(this.getContactAvatar(c.name) || c.avatar, '👤', c.name)}</span><span class="moment-gen-name">${this._escapeHtml(this._displayName(c.name))}</span></button>`).join('')}
                </div>
                <label class="moment-gen-only"><input type="checkbox" data-only> 只让选中的人发</label>
                <div class="moment-gen-summary"></div>
                <div class="moment-dialog-actions">
                    <button type="button" data-sheet-close>取消</button>
                    <button type="button" class="is-primary" data-ok>生成</button>
                </div>
            </div>`);
        const summary = mask.querySelector('.moment-gen-summary');
        const paint = () => {
            mask.querySelectorAll('[data-count]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.count) === count));
            mask.querySelectorAll('.moment-gen-person').forEach(b => b.classList.toggle('is-on', picked.has(b.dataset.name)));
            mask.querySelector('.moment-gen-only').classList.toggle('is-disabled', picked.size === 0);
            summary.textContent = picked.size
                ? `${count} 条，${onlySelected ? '只由' : '必定包含'}：${[...picked].map(n => this._displayName(n)).join('、')}`
                : `${count} 条，随机挑人发`;
        };
        mask.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => { count = Number(b.dataset.count); paint(); }));
        mask.querySelectorAll('.moment-gen-person').forEach(b => b.addEventListener('click', () => {
            const n = b.dataset.name;
            if (picked.has(n)) picked.delete(n); else picked.add(n);
            if (picked.size > count) count = Math.min(10, picked.size);
            paint();
        }));
        mask.querySelector('[data-only]')?.addEventListener('change', (e) => { onlySelected = !!e.target.checked; paint(); });
        mask.querySelector('[data-ok]')?.addEventListener('click', () => {
            mask.remove();
            this.loadMomentsFromAI({ count, mustInclude: [...picked], onlySelected });
        });
        paint();
    }

    async _buildWechatMomentsContextMessages(context) {
        const messages = [];
        if (!context) return messages;

        const userName = context?.name1 || '用户';
        const charName = context?.name2 || '角色';

        if (context.characterId !== undefined && context.characters?.[context.characterId]) {
            const char = context.characters[context.characterId];
            let charInfo = `【角色信息】\n角色名: ${char.name || charName}\n`;
            if (char.description) charInfo += `描述: ${char.description}\n`;
            if (char.personality) charInfo += `性格: ${char.personality}\n`;
            if (char.scenario) charInfo += `场景/背景: ${char.scenario}\n`;
            if (char.data?.system_prompt) charInfo += `\n${char.data.system_prompt}\n`;
            messages.push({
                role: 'system',
                content: charInfo.trim(),
                name: 'SYSTEM (角色卡)',
                isPhoneMessage: true
            });
        }

        // 世界书最多等 10 秒：读世界书卡住时跳过，不让整个生成一直转圈
        {
            const wbMessages = [];
            const appended = await this._withTimeout(
                Promise.resolve(window.VirtualPhone?.worldbookManager?.appendWorldbookMessages?.(wbMessages, 'wechat')).then(() => true),
                10000,
                false,
                '读取世界书'
            );
            if (appended) messages.push(...wbMessages);
        }

        const personaTextarea = document.getElementById('persona_description');
        if (personaTextarea && personaTextarea.value && personaTextarea.value.trim()) {
            messages.push({
                role: 'system',
                content: `【用户信息】\n${personaTextarea.value.trim()}`,
                name: 'SYSTEM (用户Persona)',
                isPhoneMessage: true
            });
        }

        const storage = window.VirtualPhone?.storage;
        const contextLimit = readPhoneContextLimit(storage || this.app?.storage);
        if (Array.isArray(context.chat) && context.chat.length > 0) {
            const collectedContextMessages = [];
            for (let idx = context.chat.length - 1; idx >= 0 && collectedContextMessages.length < contextLimit; idx--) {
                const msg = context.chat[idx];
                if (!msg || msg.isGaigaiPrompt || msg.isGaigaiData || msg.isPhoneMessage) continue;
                let content = msg.mes || msg.content || '';
                content = applyPhoneTagFilter(content, { storage: this.app?.storage || window.VirtualPhone?.storage });
                content = String(content).replace(/<[^>]*>/g, '').replace(/\*.*?\*/g, '').trim();
                if (!content) continue;
                const isUser = msg.is_user || msg.role === 'user';
                const speaker = isUser ? userName : charName;
                collectedContextMessages.unshift({
                    role: isUser ? 'user' : 'assistant',
                    content: `${speaker}: ${content}`,
                    isPhoneMessage: true
                });
            }
            messages.push(...collectedContextMessages);
        }

        return messages;
    }

    // 调用AI（静默调用，不显示在酒馆聊天界面）
    async callAI(prompt) {
        const context = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext)
            ? SillyTavern.getContext()
            : null;

        if (!context) {
            throw new Error('无法访问SillyTavern');
        }

        try {
            const apiManager = window.VirtualPhone?.apiManager;
            if (!apiManager) throw new Error('API Manager 未初始化');

            const resolvedMaxTokens = Number.parseInt(context?.max_response_length, 10)
                || Number.parseInt(context?.max_length, 10)
                || Number.parseInt(context?.amount_gen, 10);
            // 朋友圈和聊天走同一套流式设置（跟随 API 预设里的「流式」开关）。
            // 以前这里强制 stream:false，TauriTavern 等客户端的后端在非流式请求上会一直挂住、
            // 请求根本到不了中转站（中转站无记录、日志里也抓不到），聊天却正常——就是因为聊天走的是流式。
            // 流式读取在收到 [DONE] / 结束事件时就会主动收尾，不会再出现“流一直不结束”的问题。
            const abortCtrl = new AbortController();
            this._momentsAbort = abortCtrl;
            // AI 最多等 3 分钟没动静：每收到一段流式内容就重新计时，长回复不会被误杀
            const AI_TIMEOUT = 180000;
            let aiTimer = null;
            let timedOut = false;
            let rejectTimeout = null;
            let settled = false;
            const armAiTimer = () => {
                if (settled) return;
                clearTimeout(aiTimer);
                aiTimer = setTimeout(() => {
                    timedOut = true;
                    try { abortCtrl.abort(new Error('timeout')); } catch (e) { abortCtrl.abort(); }
                    rejectTimeout?.(new Error('AI 3 分钟没有返回，已取消这次请求。可能是中转站卡住了，换个模型 / 线路再试；在「设置 → API → API 调用日志」能看到请求情况'));
                }, AI_TIMEOUT);
            };
            const callAiOptions = {
                appId: 'wechat',
                signal: abortCtrl.signal,
                onResponseChunk: () => { if (!timedOut) armAiTimer(); }
            };
            if (Number.isFinite(resolvedMaxTokens) && resolvedMaxTokens > 0) {
                callAiOptions.max_tokens = resolvedMaxTokens;
            }

            const contextMessages = await this._withTimeout(this._buildWechatMomentsContextMessages(context), 15000, [], '整理上下文');
            this._momentStep(`上下文 ${contextMessages.length} 条，已发送 AI 请求`);

            const callPromise = apiManager.callAI([
                { role: 'system', content: '你是一个朋友圈内容生成助手。严格遵守本次任务指定的输出格式，不要附加解释。', isPhoneMessage: true },
                ...contextMessages,
                { role: 'user', content: prompt, isPhoneMessage: true }
            ], callAiOptions);
            // 超时就真正取消这次请求（不只是不等了），按钮恢复，可以马上重试
            const result = await Promise.race([
                callPromise,
                new Promise((_, reject) => {
                    rejectTimeout = reject;
                    armAiTimer();
                }),
                new Promise((_, reject) => {
                    abortCtrl.signal.addEventListener('abort', () => { if (!timedOut) reject(new Error('已停止生成')); }, { once: true });
                })
            ]).finally(() => {
                settled = true;
                clearTimeout(aiTimer);
                if (this._momentsAbort === abortCtrl) this._momentsAbort = null;
            });
            if (!result || typeof result !== 'object') throw new Error('AI 没有返回内容');
            if (result.aborted) throw new Error('已停止生成');
            if (!result.success) throw new Error(result.error || 'AI调用失败');
            const response = result.summary || '';


            // 🔥 解析JSON - 多种格式兼容
            let jsonStr = null;

            // 方式1: ```json ... ```
            const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            }

            // 方式2: 直接找 { "moments": ... }
            if (!jsonStr) {
                const directMatch = response.match(/\{\s*"moments"\s*:\s*\[[\s\S]*\]\s*\}/);
                if (directMatch) {
                    jsonStr = directMatch[0];
                }
            }

            // 方式3: 找任何 JSON 对象
            if (!jsonStr) {
                const anyJsonMatch = response.match(/\{[\s\S]*\}/);
                if (anyJsonMatch) {
                    jsonStr = anyJsonMatch[0];
                }
            }

            if (jsonStr) {
                const result = JSON.parse(jsonStr);
                if (result && typeof result === 'object') {
                    result.raw = response;
                }
                return result;
            }

            // 兼容 XML/纯文本格式（例如 <朋友圈互动> ... </朋友圈互动>）
            if (response && response.trim()) {
                return {
                    raw: response,
                    text: response,
                    content: response
                };
            }

            console.error('❌ [朋友圈] 无法解析结果，响应内容:', response.substring(0, 500));
            throw new Error('AI返回格式错误');
        } catch (e) {
            console.error('❌ [朋友圈] AI调用失败:', e);
            throw e;
        }
    }

    // 获取联系人头像（优先获取图片头像）
    getContactAvatar(name) {
        // 辅助函数：检查是否为图片URL或base64
        const isImageAvatar = (avatar) => {
            if (!avatar) return false;
            return avatar.startsWith('data:image') ||
                   avatar.startsWith('http://') ||
                   avatar.startsWith('https://') ||
                   avatar.startsWith('blob:') ||
                   avatar.startsWith('/');
        };

        // 🔥 从聊天列表找（聊天列表头像通常是用户上传的，优先级最高）
        const chats = this.app.wechatData.getChatList();
        const chat = chats.find(c => c.name === name);
        if (chat?.avatar && isImageAvatar(chat.avatar)) {
            return chat.avatar;
        }

        // 从联系人列表找图片头像
        const contact = this.app.wechatData.getContacts().find(c => c.name === name);
        if (contact?.avatar && isImageAvatar(contact.avatar)) {
            return contact.avatar;
        }

        // 使用 getContactByName 方法找图片头像
        const contactByName = this.app.wechatData.getContactByName(name);
        if (contactByName?.avatar && isImageAvatar(contactByName.avatar)) {
            return contactByName.avatar;
        }

        // 🔥 如果没有图片头像，返回任何可用的头像（包括emoji）
        if (chat?.avatar) return chat.avatar;
        if (contact?.avatar) return contact.avatar;
        if (contactByName?.avatar) return contactByName.avatar;

        return null;
    }

    _getCurrentPhoneTimeSnapshot() {
        const timeManager = window.VirtualPhone?.timeManager;
        const storyTime = timeManager?.getCurrentStoryTime?.() || {};
        const time = String(storyTime?.time || this.app?.phoneShell?.getCurrentTime?.() || '').trim() || '00:00';
        const date = String(storyTime?.date || '').trim();
        const weekday = String(storyTime?.weekday || '').trim();
        const parsedTimestamp = date && typeof timeManager?.parseTimeToTimestamp === 'function'
            ? Number(timeManager.parseTimeToTimestamp({ time, date, weekday }))
            : Number(storyTime?.timestamp || 0);
        return {
            time,
            date,
            weekday,
            timestamp: Number.isFinite(parsedTimestamp) && parsedTimestamp > 0 ? parsedTimestamp : Date.now()
        };
    }

    _resolveMomentStoryTime(rawTime = '', baseTime = null) {
        const timeManager = window.VirtualPhone?.timeManager;
        const fallback = this._getCurrentPhoneTimeSnapshot();
        const base = baseTime?.time
            ? {
                time: String(baseTime.time || '').trim(),
                date: String(baseTime.date || fallback.date).trim(),
                weekday: String(baseTime.weekday || fallback.weekday).trim(),
                timestamp: Number(baseTime.timestamp || fallback.timestamp)
            }
            : fallback;
        const label = String(rawTime || '').trim();

        let minutesOffset = 0;
        const minuteMatch = label.match(/(\d+)\s*分钟前/);
        const hourMatch = label.match(/(\d+(?:\.\d+)?)\s*小时前/);
        if (minuteMatch) {
            minutesOffset = -Math.max(0, Number.parseInt(minuteMatch[1], 10) || 0);
        } else if (hourMatch) {
            minutesOffset = -Math.max(0, Math.round((Number.parseFloat(hourMatch[1]) || 0) * 60));
        } else if (/半小时前/.test(label)) {
            minutesOffset = -30;
        }

        if (minutesOffset < 0 && base.date && typeof timeManager?.addMinutesToStoryTime === 'function') {
            return timeManager.addMinutesToStoryTime(base, minutesOffset);
        }

        const clockMatch = label.match(/^(\d{1,2})[:：](\d{2})$/);
        if (clockMatch && base.date) {
            const time = `${String(Number.parseInt(clockMatch[1], 10) || 0).padStart(2, '0')}:${clockMatch[2]}`;
            const timestamp = typeof timeManager?.parseTimeToTimestamp === 'function'
                ? Number(timeManager.parseTimeToTimestamp({ ...base, time }))
                : base.timestamp;
            return { ...base, time, timestamp };
        }

        return base;
    }

    // 格式化时间
    formatTime(phoneTime) {
        const value = typeof phoneTime === 'string' ? phoneTime.trim() : '';
        return value || '手机时间未知';
    }

    // 旧版render方法（保持兼容）
    render() {
        this.app.currentView = 'discover';
        this.app.render();
    }

    // ========================================
    // 📝 发朋友圈功能
    // ========================================

    _getPendingMomentVisibilitySummary() {
        const visibility = this.pendingMomentVisibility || {};
        const selectedCount = Math.max(
            Array.isArray(visibility.contactIds) ? visibility.contactIds.length : 0,
            Array.isArray(visibility.contactNames) ? visibility.contactNames.length : 0
        );
        if (visibility.type === 'exclude' && selectedCount > 0) return `不给${selectedCount}人看`;
        if (visibility.type === 'include') return selectedCount > 0 ? `仅${selectedCount}人可看` : '仅自己可见';
        return '公开';
    }

    _updatePendingMomentVisibilitySummary() {
        const summary = document.getElementById('wechat-moment-visibility-summary');
        if (summary) summary.textContent = this._getPendingMomentVisibilitySummary();
    }

    _bindMomentVisibilityScrollGuard(overlay) {
        if (!overlay) return;

        let activeList = null;
        let lastTouchY = null;
        const resolveList = target => target?.closest?.('.wechat-moment-visibility-list') || null;
        const shouldContainScroll = (list, deltaY) => {
            if (!list) return true;
            const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
            if (maxScrollTop <= 1) return true;
            if (deltaY < 0 && list.scrollTop >= maxScrollTop - 1) return true;
            if (deltaY > 0 && list.scrollTop <= 1) return true;
            return false;
        };
        const resetTouch = () => {
            activeList = null;
            lastTouchY = null;
        };

        overlay.addEventListener('touchstart', event => {
            activeList = resolveList(event.target);
            lastTouchY = event.touches?.[0]?.clientY ?? null;
            event.stopPropagation();
        }, { passive: true });

        overlay.addEventListener('touchmove', event => {
            const currentY = event.touches?.[0]?.clientY;
            const currentList = resolveList(event.target);
            const deltaY = Number.isFinite(currentY) && Number.isFinite(lastTouchY)
                ? currentY - lastTouchY
                : 0;

            event.stopPropagation();
            if (currentList !== activeList || shouldContainScroll(currentList, deltaY)) {
                if (event.cancelable) event.preventDefault();
            }
            if (Number.isFinite(currentY)) lastTouchY = currentY;
        }, { passive: false });

        overlay.addEventListener('touchend', resetTouch, { passive: true });
        overlay.addEventListener('touchcancel', resetTouch, { passive: true });

        overlay.addEventListener('wheel', event => {
            const list = resolveList(event.target);
            event.stopPropagation();
            if (shouldContainScroll(list, -event.deltaY) && event.cancelable) {
                event.preventDefault();
            }
        }, { passive: false });
    }

    showMomentVisibilityPicker() {
        document.querySelector('.wechat-moment-visibility-overlay')?.remove();

        const contacts = (this.app.wechatData.getContacts() || [])
            .filter(contact => String(contact?.name || '').trim());
        const current = this.pendingMomentVisibility || {
            type: 'public',
            contactIds: [],
            contactNames: []
        };
        let draftType = ['exclude', 'include'].includes(current.type) ? current.type : 'public';
        const currentIds = new Set(Array.isArray(current.contactIds) ? current.contactIds : []);
        const currentNames = new Set(Array.isArray(current.contactNames) ? current.contactNames : []);
        const getContactKey = (contact) => {
            const id = String(contact?.id || '').trim();
            const name = String(contact?.name || '').trim();
            return id ? `id:${id}` : `name:${name}`;
        };
        const selectedContactKeys = new Set(
            contacts
                .filter(contact => {
                    const id = String(contact?.id || '').trim();
                    const name = String(contact?.name || '').trim();
                    return (id && currentIds.has(id)) || (name && currentNames.has(name));
                })
                .map(getContactKey)
        );

        const overlay = document.createElement('div');
        overlay.className = 'wechat-moment-visibility-overlay';
        overlay.innerHTML = `
            <div class="wechat-moment-visibility-dialog" role="dialog" aria-modal="true" aria-label="谁可以看">
                <div class="wechat-moment-visibility-header">
                    <button type="button" class="wechat-moment-visibility-close" aria-label="关闭" title="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div class="wechat-moment-visibility-title">谁可以看</div>
                    <button type="button" class="wechat-moment-visibility-done">完成</button>
                </div>
                <div class="wechat-moment-visibility-modes">
                    <button type="button" class="wechat-moment-visibility-mode" data-mode="public">
                        <span>公开</span>
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button type="button" class="wechat-moment-visibility-mode" data-mode="exclude">
                        <span>不给谁看</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button type="button" class="wechat-moment-visibility-mode" data-mode="include">
                        <span>仅给谁看</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div class="wechat-moment-visibility-picker"></div>
            </div>
        `;

        const dialog = overlay.querySelector('.wechat-moment-visibility-dialog');
        const picker = overlay.querySelector('.wechat-moment-visibility-picker');
        const doneButton = overlay.querySelector('.wechat-moment-visibility-done');
        const close = () => overlay.remove();
        const isContactSelected = (contact) => selectedContactKeys.has(getContactKey(contact));
        const updateModeState = () => {
            overlay.querySelectorAll('.wechat-moment-visibility-mode').forEach(button => {
                const active = button.dataset.mode === draftType;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            doneButton.style.visibility = draftType === 'public' ? 'hidden' : 'visible';
        };
        const renderContactPicker = () => {
            if (draftType === 'public') {
                picker.innerHTML = '';
                picker.classList.remove('is-visible');
                updateModeState();
                return;
            }

            picker.classList.add('is-visible');
            picker.innerHTML = contacts.length > 0
                ? `
                    <div class="wechat-moment-visibility-selection-bar">
                        <span>${draftType === 'exclude' ? '不给谁看' : '仅给谁看'}</span>
                        <span class="wechat-moment-visibility-count">已选 0 人</span>
                    </div>
                    <div class="wechat-moment-visibility-list">
                        ${contacts.map((contact, index) => `
                            <label class="wechat-moment-visibility-contact" role="checkbox" aria-checked="${isContactSelected(contact) ? 'true' : 'false'}">
                                <input type="checkbox" data-contact-index="${index}" tabindex="-1" hidden ${isContactSelected(contact) ? 'checked' : ''}>
                                <span class="wechat-moment-visibility-avatar">
                                    ${this.app.renderAvatar(contact.avatar, '👤', contact.name)}
                                </span>
                                <span class="wechat-moment-visibility-name">${this._escapeHtml(contact.name)}</span>
                                <span class="wechat-moment-visibility-check"><i class="fa-solid fa-check"></i></span>
                            </label>
                        `).join('')}
                    </div>
                `
                : '<div class="wechat-moment-visibility-empty">通讯录暂无好友</div>';

            const updateCount = () => {
                const count = picker.querySelectorAll('input[type="checkbox"]:checked').length;
                const countNode = picker.querySelector('.wechat-moment-visibility-count');
                if (countNode) countNode.textContent = `已选 ${count} 人`;
            };
            picker.querySelectorAll('.wechat-moment-visibility-contact').forEach(row => {
                const input = row.querySelector('input[data-contact-index]');
                if (!input) return;
                row.addEventListener('click', event => {
                    event.preventDefault();
                    input.checked = !input.checked;
                    row.setAttribute('aria-checked', input.checked ? 'true' : 'false');
                    const contact = contacts[Number(input.dataset.contactIndex)];
                    if (!contact) return;
                    const key = getContactKey(contact);
                    if (input.checked) {
                        selectedContactKeys.add(key);
                    } else {
                        selectedContactKeys.delete(key);
                    }
                    updateCount();
                });
            });
            updateCount();
            updateModeState();
        };

        overlay.querySelectorAll('.wechat-moment-visibility-mode').forEach(button => {
            button.addEventListener('click', () => {
                draftType = button.dataset.mode || 'public';
                if (draftType === 'public') {
                    this.pendingMomentVisibility = {
                        type: 'public',
                        contactIds: [],
                        contactNames: []
                    };
                    this._updatePendingMomentVisibilitySummary();
                    close();
                    return;
                }
                renderContactPicker();
            });
        });
        doneButton.addEventListener('click', () => {
            const selectedContacts = contacts.filter(isContactSelected);
            const resolvedType = draftType === 'exclude' && selectedContacts.length === 0
                ? 'public'
                : draftType;
            this.pendingMomentVisibility = {
                type: resolvedType,
                contactIds: selectedContacts.map(contact => String(contact.id || '').trim()).filter(Boolean),
                contactNames: selectedContacts.map(contact => String(contact.name || '').trim()).filter(Boolean)
            };
            this._updatePendingMomentVisibilitySummary();
            close();
        });
        overlay.querySelector('.wechat-moment-visibility-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });
        dialog?.addEventListener('click', event => event.stopPropagation());

        document.querySelector('#phone-panel-content .phone-screen')?.appendChild(overlay);
        this._bindMomentVisibilityScrollGuard(overlay);
        renderContactPicker();
    }

    // 显示发朋友圈页面
    // 📸 发朋友圈入口：选“发图片”或“只发文字”
    showPostTypeSheet({ privateMode = false } = {}) {
        const mask = this._mountMomentSheet(`
            <div class="moment-post-type-sheet" role="dialog">
                <button type="button" data-post-type="photo"><i class="fa-solid fa-image"></i><span>发图片</span><small>可配文字，最多 9 张</small></button>
                <button type="button" data-post-type="text"><i class="fa-solid fa-pen"></i><span>发表文字</span><small>只发一段文字</small></button>
                <button type="button" class="is-cancel" data-sheet-close>取消</button>
            </div>`);
        mask.querySelectorAll('[data-post-type]').forEach(btn => btn.addEventListener('click', () => {
            mask.remove();
            this.showPostMomentPage({ privateMode, textOnly: btn.dataset.postType === 'text' });
        }));
    }

    showPostMomentPage({ privateMode = false, textOnly = false } = {}) {
        this._postReturnPage = this._currentPage || null;
        this._startPostMomentDraft();
        if (privateMode) {
            this.pendingMomentVisibility = { type: 'include', contactIds: [], contactNames: [] };
        }
        const userInfo = this.app.wechatData.getUserInfo();

        const html = `
            <div class="wechat-app">
                <div class="wechat-header">
                    <div class="wechat-header-left">
                        <button class="wechat-back-btn" id="back-from-post">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                    </div>
                    <div class="wechat-header-title">${textOnly ? '发表文字' : '发朋友圈'}</div>
                    <div class="wechat-header-right">
                        <button class="wechat-header-btn" id="publish-moment-btn" style="color: #07c160; font-size: 14px; font-weight: 500;">
                            发表
                        </button>
                    </div>
                </div>

                <div class="wechat-content" style="background: #fff; padding: 15px;">
                    <!-- 用户头像和输入框 -->
                    <div style="display: flex; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 22px;">
                            ${this.app.renderAvatar(userInfo.avatar, '😊', userInfo.name)}
                        </div>
                        <div style="flex: 1;">
                            <textarea id="moment-text-input" placeholder="这一刻的想法..." style="
                                width: 100%;
                                min-height: ${textOnly ? '200px' : '120px'};
                                padding: 10px;
                                border: none;
                                font-size: 15px;
                                line-height: 1.6;
                                resize: none;
                                outline: none;
                                box-sizing: border-box;
                            "></textarea>
                        </div>
                    </div>

                    ${textOnly ? '' : `<!-- 图片预览区 -->
                    <div id="moment-images-preview" style="display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0;">
                    </div>

                    <!-- 添加图片按钮 -->
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 0.5px solid #e5e5e5;">
                        <input type="file" id="moment-image-upload" accept="image/png, image/jpeg, image/gif, image/webp, image/*" multiple style="display: none;">
                        <label for="moment-image-upload" id="add-moment-image-btn" style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            padding: 12px 15px;
                            background: #f7f7f7;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #333;
                            cursor: pointer;
                            width: 100%;
                            box-sizing: border-box;
                        ">
                            <i class="fa-solid fa-image" style="font-size: 18px; color: #07c160;"></i>
                            <span>添加图片</span>
                            <span style="margin-left: auto; color: #999; font-size: 12px;">最多9张</span>
                        </label>
                        <button type="button" class="wechat-moment-text-image-trigger" id="wechat-moment-text-image-trigger" style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            margin-top: 8px;
                            padding: 12px 15px;
                            background: #f7f7f7;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #333;
                            cursor: pointer;
                            width: 100%;
                            box-sizing: border-box;
                        ">
                            <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 18px; color: #07c160;"></i>
                            <span>文字图片</span>
                            <span style="margin-left: auto; color: #999; font-size: 12px;">最多9张</span>
                        </button>
                    </div>`}

                    <label class="wechat-moment-location-row">
                        <i class="fa-solid fa-location-dot"></i>
                        <input type="text" id="moment-location-input" placeholder="所在位置（选填）" maxlength="40">
                    </label>

                    <button type="button" class="wechat-moment-visibility-trigger" id="wechat-moment-visibility-trigger">
                        <span>谁可以看</span>
                        <span class="wechat-moment-visibility-value">
                            <span id="wechat-moment-visibility-summary">${this._getPendingMomentVisibilitySummary()}</span>
                            <i class="fa-solid fa-chevron-right"></i>
                        </span>
                    </button>
                </div>
            </div>
        `;

        this.app.phoneShell.setContent(html);

        // 绑定事件
        this.bindPostMomentEvents();
    }

    // 绑定发朋友圈页面事件
    bindPostMomentEvents() {
        // 返回按钮
        document.getElementById('back-from-post')?.addEventListener('click', () => {
            this._leavePostMomentDraft({ published: false });
            this._returnFromPost();
        });

        // 图片上传
        document.getElementById('moment-image-upload')?.addEventListener('change', (e) => {
            const rawFiles = e.target.files;
            if (!rawFiles || rawFiles.length === 0) return;
            
            // 🔥 提取为静态数组并重置 input，修复无法连续选择同一张图的bug
            const fileArray = Array.from(rawFiles);
            e.target.value = ''; 
            
            this.handleImageUpload(fileArray);
        });

        document.getElementById('wechat-moment-visibility-trigger')?.addEventListener('click', () => {
            this.showMomentVisibilityPicker();
        });

        document.getElementById('wechat-moment-text-image-trigger')?.addEventListener('click', () => {
            this._insertMomentTextImageTemplate(document.getElementById('moment-text-input'));
        });

        // 发表按钮
        document.getElementById('publish-moment-btn')?.addEventListener('click', () => {
            this.publishMoment();
        });
    }

    // 处理图片上传 - 支持裁剪
    async handleImageUpload(files) {
        if (!files || files.length === 0) return;

        const maxImages = 9;
        const currentCount = this.pendingMomentImages?.length || 0;
        const textInput = document.getElementById('moment-text-input');
        const textImageCount = this._extractMomentImageTagsFromText(textInput?.value || '').images.length;
        const remainingSlots = maxImages - currentCount - textImageCount;

        if (remainingSlots <= 0) {
            this.app.phoneShell.showNotification('提示', '上传图片和文字图片合计最多9张', '⚠️');
            return;
        }

        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        for (const file of filesToProcess) {
            try {
                const cropper = new ImageCropper({
                    title: '裁剪图片',
                    aspectRatio: 1, // 朋友圈图片用正方形
                    outputWidth: 600,
                    outputHeight: 600,
                    quality: 0.85,
                    maxFileSize: 5 * 1024 * 1024
                });

                const croppedImage = await cropper.open(file);

                const finalUrl = await window.VirtualPhone?.imageManager?.uploadDataUrl?.(croppedImage, 'moment_image');
                if (!finalUrl) throw new Error('图片上传管理器未初始化');

                if (!this.pendingMomentImages) {
                    this.pendingMomentImages = [];
                }
                this.pendingMomentImages.push(finalUrl); // 存入 URL
                this.updateImagePreview();
            } catch (error) {
                if (error.message !== '用户取消') {
                    this.app.phoneShell.showNotification('上传失败', error.message, '❌');
                }
            }
        }
    }

    // 更新图片预览
    updateImagePreview() {
        const previewContainer = document.getElementById('moment-images-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = this.pendingMomentImages.map((img, index) => `
            <div style="position: relative; width: 80px; height: 80px;">
                <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                <button class="remove-moment-image" data-index="${index}" style="
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.6);
                    color: #fff;
                    border: none;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
        `).join('');

        // 绑定删除图片事件
        previewContainer.querySelectorAll('.remove-moment-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                const removed = this.pendingMomentImages[index];
                this.pendingMomentImages.splice(index, 1);
                // 草稿里删图时立即清理托管图片；若草稿内还有同图则不清理
                if (removed && !this.pendingMomentImages.includes(removed)) {
                    this._cleanupManagedMomentImages([removed]);
                }
                this.updateImagePreview();
            });
        });
    }

    // 发表朋友圈
    publishMoment() {
        const textInput = document.getElementById('moment-text-input');
        const rawText = textInput?.value?.trim() || '';
        const extracted = this._extractMomentImageTagsFromText(rawText);
        const textOnlyPost = !document.getElementById('moment-images-preview');
        const uploadedImages = !textOnlyPost && Array.isArray(this.pendingMomentImages)
            ? this.pendingMomentImages.filter(item => typeof item === 'string' && item.trim())
            : [];
        const images = textOnlyPost ? [] : [...uploadedImages, ...extracted.images];
        const text = textOnlyPost ? rawText : extracted.text;
        if (textOnlyPost && !text) {
            this.app.phoneShell.showNotification('提示', '写点什么再发表吧', '⚠️');
            return;
        }

        // 验证内容
        if (!text && images.length === 0) {
            this.app.phoneShell.showNotification('提示', '请输入内容或添加图片', '⚠️');
            return;
        }
        if (images.length > 9) {
            this.app.phoneShell.showNotification('提示', '上传图片和生图标签合计最多9张', '⚠️');
            return;
        }

        // 获取用户信息
        const userInfo = this.app.wechatData.getUserInfo();
        const currentPhoneTime = this._getCurrentPhoneTimeSnapshot();
        const visibility = this.pendingMomentVisibility || {
            type: 'public',
            contactIds: [],
            contactNames: []
        };

        // 创建朋友圈
        const moment = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: userInfo.name || '我',
            avatar: userInfo.avatar || '😊',
            text: text,
            images: images,
            time: currentPhoneTime.time,
            date: currentPhoneTime.date,
            weekday: currentPhoneTime.weekday,
            timestamp: currentPhoneTime.timestamp,
            likes: 0,
            likeList: [],
            comments: 0,
            commentList: [],
            imageGenerationStates: [],
            isUserPost: true,
            location: String(document.getElementById('moment-location-input')?.value || '').trim(),
            visibility: {
                type: visibility.type,
                contactIds: Array.isArray(visibility.contactIds) ? [...visibility.contactIds] : [],
                contactNames: Array.isArray(visibility.contactNames) ? [...visibility.contactNames] : []
            }
        };

        // 添加到数据
        this.app.wechatData.addMoment(moment);

        // 标记草稿已发布，避免离开页面时被误清理
        this._postMomentDraftCommitted = true;

        // 清空待发送数据
        this.pendingMomentImages = [];

        // 显示成功提示
        this.app.phoneShell.showNotification('发布成功', '你的朋友圈已发布', '✅');

        // 发布后触发一次AI互动（通讯录好友点赞/评论）
        this.triggerAIReaction(moment.id, 'post', text).catch(error => {
            console.error('❌ [朋友圈] 发布后触发AI互动失败:', error);
        });

        // 返回朋友圈列表
        setTimeout(() => {
            this._leavePostMomentDraft({ published: true });
            this._returnFromPost();
        }, 500);
    }
}
