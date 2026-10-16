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
// 微信APP主程序
import { ChatView } from './chat-view.js?v=20261021-m10';
import { ContactsView } from './contacts-view.js?v=20261021-m4';
import { MomentsView } from './moments-view.js?v=20261021-m10';
import { MindNotes } from './mind-notes.js?v=20261016-fix15';
import { WechatData } from './wechat-data.js?v=20261020-m2';
import { installPhoneImageStore } from './image-store.js?v=20261020-m2';
import { readWechatSkin, applyWechatSkinAttrs, WECHAT_SKIN_KEY } from './skins.js?v=20261021-m10';
import { renderAliasChips, bindAliasChips, setAliasFixed, renderReadingPairs, bindReadingPairs } from './alias-chips.js?v=20261021-a3';
import { getWalletAssetTotals, parseWalletAssetEvaluation } from './wallet-assets.js?v=20261011-wallet-credit-repayment';
import { ImageCropper } from '../settings/image-cropper.js';
import { formatWechatChatListTime } from './chat-list-time.js?v=20260717-wechat-list-time';
import {
    DEFAULT_WECHAT_CHAT_STYLE_ID,
    WECHAT_NATIVE_CHAT_STYLE_ID,
    getBuiltinWechatChatStyleProfiles
} from './chat-style-presets.js?v=20260906-wechat-back-color';

const CHAT_CSS_VALUE_KEY = 'phone_global_chat_css';
const CHAT_CSS_PROFILES_KEY = 'phone_chat_css_profiles';
const CHAT_CSS_ACTIVE_PROFILE_KEY = 'phone_chat_css_active_profile';

export class WechatApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.wechatData = new WechatData(storage);
        try {
            installPhoneImageStore();
            window.__yuzukiImageRefProbe = (path) => {
                const wd = this.wechatData;
                try {
                    const ids = (wd?.data?.chats || []).map(c => c?.id).filter(Boolean);
                    wd?._loadMessagesForChatIds?.(ids);
                } catch (e) { }
                const name = String(path || '').split('/').pop();
                if (!name) return true;
                const json = JSON.stringify(wd?.data || {});
                let emojis = '';
                try { emojis = String(this.storage?.get?.(wd?._getCustomEmojiGlobalKey?.(), '') || ''); } catch (e) { }
                return json.includes(name) || emojis.includes(name);
            };
        } catch (e) {
            console.warn('⚠️ [柚月图片] 独立图片仓库初始化失败:', e);
        }
        this.currentView = 'chats';
        this.currentChat = null;
        this._avatarPool = { male: [], female: [], male_elder: [], female_elder: [], all: [] };
        this._avatarPoolLoaded = false;
        this._avatarPoolLoading = false;
        this._avatarPoolPromise = null;
        this._missingAvatarPaths = new Set();
        this._isAvatarManagerOpen = false;
        this._wechatPanelMode = 'main'; // main | settings | avatar-manager
        this._isWalletEvaluating = false;
        this._walletLedgerMonth = '';
        this._walletLedgerType = 'all';
        this._walletSection = 'ledger';

        // 初始化视图
        this.chatView = new ChatView(this);
        this.contactsView = new ContactsView(this);
        this.momentsView = new MomentsView(this);
        this.mindNotes = new MindNotes(this);
        this._chatListFilter = 'all';
        this._chatListQuery = '';
        this._ensureWechatAvatarPoolLoaded();

        // 加载样式
        this._ensureChatCssPresetState();
        this.loadStyles();
        // 会话样式模块已移除：样式统一交给“界面风格”和“气泡样式”
        this._applyCustomChatStyle('');
        // 🎨 聊天界面风格（微信 / QQ / LINE · 日间 / 夜间）
        try { applyWechatSkinAttrs(this.getWechatSkin()); } catch (e) { console.warn('⚠️ 界面风格初始化失败:', e); }

        // 🔥 监听滑动返回事件 (防止切换聊天导致重复绑定)
        if (!window._wechatSwipeBackBound) {
            window._wechatSwipeBackBound = true;
            window.addEventListener('phone:swipeBack', (event) => {
                if (window.VirtualPhone && window.VirtualPhone.wechatApp) {
                    window.VirtualPhone.wechatApp.handleSwipeBack(event);
                }
            });
        }
    }

    // 🔥 处理滑动返回（智能模拟点击原生返回按钮）
    handleSwipeBack(event) {
        // 1. 领地保护
        const currentView = document.querySelector('.phone-view-current');
        if (!currentView || !currentView.querySelector('.wechat-app')) return false;

        if (event?.detail && typeof event.detail === 'object') {
            event.detail.handled = true;
        }

        // 2. 模拟点击返回按钮
        const backBtn = currentView.querySelector('.wechat-back-btn');
        if (backBtn) {
            backBtn.click();
        } else {
            window.dispatchEvent(new CustomEvent('phone:goHome'));
        }
        return true;
    }

    deactivate() {
        this.chatView?.releaseInactiveResources?.();
    }

    resumeAfterPanelOpen() {
        if (!this.currentChat) return false;
        return this.chatView?.resumeAfterPanelOpen?.() === true;
    }

    _getUserCustomChatCss() {
        try {
            // 🔥 改为从全局配置中读取，所有会话共享
            return String(this.storage?.get(CHAT_CSS_VALUE_KEY) || '');
        } catch (e) {
            return '';
        }
    }

    _createChatCssProfileId(existingIds = new Set()) {
        let id = '';
        do {
            id = `chat_css_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        } while (existingIds.has(id));
        return id;
    }

    _loadChatCssProfiles() {
        let parsed = [];
        try {
            const raw = this.storage?.get(CHAT_CSS_PROFILES_KEY);
            parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
        } catch (e) {
            parsed = [];
        }
        if (!Array.isArray(parsed)) return [];

        const usedIds = new Set();
        const profiles = [];
        let migrated = false;
        parsed.forEach((item) => {
            if (!item || typeof item !== 'object') {
                migrated = true;
                return;
            }
            const css = String(item.css || '');
            let name = String(item.name || '').trim();
            if (!name && !css) {
                migrated = true;
                return;
            }
            if (!name) {
                name = `预设 ${profiles.length + 1}`;
                migrated = true;
            }

            let id = String(item.id || '').trim();
            if (!id || usedIds.has(id)) {
                id = this._createChatCssProfileId(usedIds);
                migrated = true;
            }
            usedIds.add(id);
            profiles.push({
                id,
                name,
                css,
                createdAt: Number(item.createdAt) || Date.now(),
                updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now()
            });
        });

        if (migrated) {
            this.storage?.set(CHAT_CSS_PROFILES_KEY, JSON.stringify(profiles));
        }
        return profiles;
    }

    _saveChatCssProfiles(profiles) {
        const safeProfiles = Array.isArray(profiles) ? profiles : [];
        return this.storage?.set(CHAT_CSS_PROFILES_KEY, JSON.stringify(safeProfiles));
    }

    _getAllChatCssProfiles() {
        return [
            ...getBuiltinWechatChatStyleProfiles(),
            ...this._loadChatCssProfiles()
        ];
    }

    _getActiveChatCssProfileId() {
        return String(this.storage?.get(CHAT_CSS_ACTIVE_PROFILE_KEY) || '').trim();
    }

    _setActiveChatCssProfileId(profileId) {
        return this.storage?.set(CHAT_CSS_ACTIVE_PROFILE_KEY, String(profileId || '').trim());
    }

    _ensureChatCssPresetState() {
        const customProfiles = this._loadChatCssProfiles();
        const profiles = [
            ...getBuiltinWechatChatStyleProfiles(),
            ...customProfiles
        ];
        let activeId = this._getActiveChatCssProfileId();
        let activeProfile = profiles.find(profile => profile.id === activeId) || null;
        const appliedCss = this._getUserCustomChatCss();

        // 旧版只有“已应用 CSS”而没有当前预设。升级时自动收纳，避免丢失用户样式。
        if (!activeProfile && appliedCss) {
            activeProfile = customProfiles.find(profile => profile.css === appliedCss) || null;
            if (!activeProfile) {
                const usedIds = new Set(customProfiles.map(profile => profile.id));
                activeProfile = {
                    id: this._createChatCssProfileId(usedIds),
                    name: '现有会话样式',
                    css: appliedCss,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                customProfiles.push(activeProfile);
                profiles.push(activeProfile);
                this._saveChatCssProfiles(customProfiles);
            }
            activeId = activeProfile.id;
            this._setActiveChatCssProfileId(activeId);
        } else if (!activeProfile) {
            activeProfile = profiles.find(profile => profile.id === DEFAULT_WECHAT_CHAT_STYLE_ID) || null;
            activeId = activeProfile?.id || '';
            this._setActiveChatCssProfileId(activeId);
            this.storage?.set(CHAT_CSS_VALUE_KEY, activeProfile?.css || '');
        } else if (activeProfile.builtin && appliedCss !== activeProfile.css) {
            // 内置样式每次从代码生成，确保升级后立即使用最新本地素材路径。
            this.storage?.set(CHAT_CSS_VALUE_KEY, activeProfile.css);
        }

        return { profiles, activeId, activeProfile };
    }


    // “我”的音色：正文朗读里读到我说的话时用（也可以填正文里对我的其他叫法）
    _renderMyVoiceHtml() {
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const info = this.wechatData?.data?.userInfo || {};
        const cv = this.contactsView;
        const providers = cv?._getTtsProviderOptions?.() || [];
        const globalProvider = cv?._getCurrentTtsProvider?.() || String(this.storage?.get?.('phone-tts-provider') || 'minimax_cn');
        const voices = info.ttsVoices && typeof info.ttsVoices === 'object' ? info.ttsVoices : {};
        const bound = String(info.ttsProvider || '');
        const active = bound || globalProvider;
        const aliases = Array.isArray(info.voiceAliases) ? info.voiceAliases.join('，') : String(info.voiceAliases || '');
        const activeVoice = String(voices[active] || Object.values(voices).find(v => String(v || '').trim()) || '').trim();
        const myName = String(info.realName || info.name || '').trim();
        return `
                <div class="profile-function-item wx-myvoice-item" id="wx-myvoice-btn">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-microphone-lines" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">我的音色</div>
                        <div class="function-desc">${activeVoice ? `正文朗读读我的台词时使用 · ${esc(activeVoice)}` : '正文朗读读到我的台词时使用（未填写）'}</div>
                    </div>
                    <div class="function-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                </div>
                <div class="wx-myvoice-panel" id="wx-myvoice-panel">
                    <div class="wce-field">
                        <div class="wce-label">语音服务商<small>留空跟随全局设置</small></div>
                        <select class="wce-input" data-myvoice="provider"><option value="" ${!bound ? 'selected' : ''}>跟随全局</option>${providers.map(p => `<option value="${p.id}" ${bound === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
                    </div>
                    ${providers.map(p => `<label class="wce-voice${p.id === active ? ' is-on' : ''}"><span>${esc(p.label)}${p.id === active ? '<i>使用中</i>' : ''}</span><input type="text" class="wce-input" data-myvoice-voice="${p.id}" placeholder="${esc(p.placeholder || '')}" value="${esc(voices[p.id] || '')}"></label>`).join('')}
                    <div class="wce-field" style="margin-top:12px">
                        <div class="wce-label">我的真实姓名<small>正文里怎么称呼我就填什么（比如九月七），会作为默认别名一直比对</small></div>
                        <input type="text" class="wce-input" data-myvoice="realName" placeholder="例如：九月七" value="${esc(info.realName || '')}">
                    </div>
                    <div class="wce-field">
                        <div class="wce-label">别名<small>正文里对我的其他叫法；点一下可以改，× 删除。酒馆里的用户名也会自动比对</small></div>
                        <div data-myvoice-alias-wrap>${renderAliasChips({ key: 'my-alias', fixed: String(info.realName || '').trim(), fixedLabel: '真实姓名', fixedEmpty: '先在上面填真实姓名', aliases: info.voiceAliases || [], placeholder: '添加别名，例如：小七' })}</div>
                    </div>
                    <div class="wce-field">
                        <div class="wce-label">名字读音<small>正文朗读时把名字换成这个读音再念，比如「九月七 → くがつなな」</small></div>
                        ${renderReadingPairs({ key: 'my-reading', readings: info.nameReadings || [] })}
                    </div>
                </div>`;
    }

    _bindMyVoice(root) {
        const btn = root?.querySelector?.('#wx-myvoice-btn');
        const panel = root?.querySelector?.('#wx-myvoice-panel');
        if (!btn || !panel) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !panel.classList.contains('is-open');
            panel.classList.toggle('is-open', open);
            btn.classList.toggle('is-open', open);
        });
        panel.addEventListener('click', e => e.stopPropagation());
        const save = () => {
            const ttsVoices = {};
            panel.querySelectorAll('[data-myvoice-voice]').forEach(inp => { const v = String(inp.value || '').trim(); if (v) ttsVoices[inp.dataset.myvoiceVoice] = v; });
            const ttsProvider = String(panel.querySelector('[data-myvoice="provider"]')?.value || '').trim();
            this.wechatData.updateUserInfo({ ttsVoices, ttsProvider });
            if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = this.wechatData;
            const globalProvider = this.contactsView?._getCurrentTtsProvider?.() || String(this.storage?.get?.('phone-tts-provider') || 'minimax_cn');
            const active = ttsProvider || globalProvider;
            panel.querySelectorAll('.wce-voice').forEach(l => {
                const on = l.querySelector('[data-myvoice-voice]')?.dataset.myvoiceVoice === active;
                l.classList.toggle('is-on', on);
                const tag = l.querySelector('span i');
                if (on && !tag) l.querySelector('span')?.insertAdjacentHTML('beforeend', '<i>使用中</i>');
                if (!on && tag) tag.remove();
            });
            const desc = btn.querySelector('.function-desc');
            const shown = ttsVoices[active] || Object.values(ttsVoices)[0] || '';
            if (desc) desc.textContent = shown ? `正文朗读读我的台词时使用 · ${shown}` : '正文朗读读到我的台词时使用（未填写）';
            try { window.VirtualPhone?.storyVoice?.onVoicesChanged?.(); } catch (err) { /* 忽略 */ }
            this.phoneShell?.showNotification?.('已保存', '我的音色已更新', '✅');
        };
        panel.querySelectorAll('select[data-myvoice], input[data-myvoice-voice]').forEach(el => el.addEventListener('change', save));
        bindReadingPairs(panel.querySelector('[data-yzrd="my-reading"]'), (nameReadings) => {
            this.wechatData.updateUserInfo({ nameReadings });
            if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = this.wechatData;
            try { window.VirtualPhone?.storyVoice?.onVoicesChanged?.(); } catch (err) { /* 忽略 */ }
        });
        bindAliasChips(panel.querySelector('[data-yzac="my-alias"]'), (voiceAliases) => {
            this.wechatData.updateUserInfo({ voiceAliases });
            if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = this.wechatData;
            try { window.VirtualPhone?.storyVoice?.onVoicesChanged?.(); } catch (err) { /* 忽略 */ }
        }, { fixed: () => String(this.wechatData?.data?.userInfo?.realName || '').trim() });
        panel.querySelector('[data-myvoice="realName"]')?.addEventListener('change', (e) => {
            const realName = String(e.target.value || '').trim();
            const info = this.wechatData?.data?.userInfo || {};
            if (realName === String(info.realName || '').trim()) return;
            const voiceAliases = (Array.isArray(info.voiceAliases) ? info.voiceAliases : []).filter(a => a !== realName);
            this.wechatData.updateUserInfo({ realName, voiceAliases });
            if (window.VirtualPhone) window.VirtualPhone.cachedWechatData = this.wechatData;
            setAliasFixed(panel.querySelector('[data-yzac="my-alias"]'), realName, { label: '真实姓名', empty: '先在上面填真实姓名' });
            try { window.VirtualPhone?.storyVoice?.onVoicesChanged?.(); } catch (err) { /* 忽略 */ }
            this.phoneShell?.showNotification?.('已保存', realName ? `正文里的「${realName}」会用我的音色` : '已清空真实姓名', '✅');
        });
    }

    getWechatSkin() {
        return readWechatSkin(this.storage);
    }

    // 切换界面风格；内置的“清透花语”等主题会盖住风格样式，切换时自动改回默认会话样式
    setWechatSkin(patch = {}) {
        const next = { ...this.getWechatSkin(), ...patch };
        try { this.storage?.set?.(WECHAT_SKIN_KEY, JSON.stringify(next)); } catch (e) { /* 忽略 */ }
        applyWechatSkinAttrs(next);
        let profileReset = '';
        if (patch.skin) {
            try {
                const { activeProfile } = this._ensureChatCssPresetState();
                if (activeProfile?.builtin && activeProfile.id !== DEFAULT_WECHAT_CHAT_STYLE_ID) {
                    profileReset = activeProfile.name || '内置会话样式';
                    this._setActiveChatCssProfileId(DEFAULT_WECHAT_CHAT_STYLE_ID);
                    this.storage?.set(CHAT_CSS_VALUE_KEY, '');
                    this._applyCustomChatStyle('');
                }
            } catch (e) { /* 忽略 */ }
        }
        return { ...next, profileReset };
    }

    _applyCustomChatStyle(cssText) {
        let styleTag = document.getElementById('wechat-custom-chat-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wechat-custom-chat-style';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = String(cssText || '');
    }

    loadStyles() {
        if (!document.getElementById('wechat-styles')) {
            const style = document.createElement('style');
            style.id = 'wechat-styles';
            style.textContent = `
/* ========================================
   微信APP完整样式 - 高仿版
   ======================================== */

.wechat-app {
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #ededed;
    display: flex;
    flex-direction: column;
    font-family: inherit;
    position: relative;

    /* 🔥 新增：基础字体大小，使用变量方便调整 */
    font-size: 14px; /* 默认大小 */

    /* 🔥 继承屏幕圆角，防止四角露出 */
    border-radius: inherit;
    overflow: hidden;
}

/* 🔥 新增：响应式字体 */
@media (max-width: 1024px) {
    .wechat-app {
        font-size: 13px; /* 平板 */
    }
}
@media (max-width: 500px) {
    .wechat-app {
        font-size: 12px; /* 手机 */
    }
}

.wechat-detail-card { margin:12px 12px 16px; padding:16px; background:rgba(255,255,255,.91); border-radius:17px; color:#30343b; }
.wechat-detail-heading { font-size:15px; font-weight:650; margin-bottom:14px; }
.wechat-detail-profile { display:flex; gap:14px; align-items:flex-start; }
.wechat-detail-profile.is-compact { gap: 12px; align-items: center; }
.wechat-detail-profile.is-compact .wechat-detail-avatar { display: block; flex: 0 0 62px; position: relative; width: 62px; height: 62px; border-radius: 12px; cursor: pointer; overflow: visible; }
.wechat-detail-profile.is-compact .wdp-avatar-img { display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 26px; width: 100%; height: 100%; border-radius: 12px; overflow: hidden; }
.wechat-detail-profile.is-compact .wdp-avatar-img > *, .wechat-detail-profile.is-compact .wdp-avatar-img img { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 12px !important; }
.wdp-cam { position: absolute; right: -4px; bottom: -4px; width: 20px; height: 20px; border-radius: 50%; background: #fff; color: #6b7a90; font-size: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
.wdp-grid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.wdp-row { display: flex !important; align-items: center; gap: 8px; margin: 0 !important; font-size: 12px; color: #888; }
.wdp-row > span { width: 26px; flex: 0 0 26px; }
.wdp-row input { flex: 1; min-width: 0; height: 30px; box-sizing: border-box; margin: 0 !important; padding: 0 9px !important; border: 1px solid #ececec; border-radius: 8px; background: rgba(255,255,255,.9); font-size: 13px; color: #222; }
.wdp-foot { display: flex; gap: 8px; margin-top: 10px; }
.wdp-foot input { flex: 1; min-width: 0; height: 30px; box-sizing: border-box; padding: 0 9px; border: 1px solid #ececec; border-radius: 8px; background: rgba(255,255,255,.9); font-size: 12px; color: #555; }
.wdp-foot #wechat-detail-save-profile { height: 30px; padding: 0 14px; font-size: 13px; border-radius: 8px; }
.wechat-detail-avatar { width:66px; height:66px; flex-shrink:0; overflow:hidden; border-radius:50%; }
.wechat-detail-avatar img { width:100%; height:100%; object-fit:cover; }
.wechat-detail-profile-fields { min-width:0; flex:1; }
.wechat-detail-profile-fields label { display:block; margin-bottom:10px; font-size:12px; }
.wechat-detail-profile-fields input[type=text] { display:block; box-sizing:border-box; width:100%; margin-top:5px; padding:9px; border:1px solid #e5e5e5; border-radius:9px; background:#fff; font-size:13px; }
.wechat-detail-upload input { display:block; width:100%; margin-top:5px; font-size:11px; }
#wechat-detail-save-profile { padding:9px 13px; background:#5489c8; color:white; border:0; border-radius:9px; }
.wechat-detail-setting-row { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:49px; padding:10px 0; border-bottom:1px solid #e9e9e9; font-size:13px; }
.wechat-detail-setting-row span { flex:1; }
.wechat-detail-setting-row small { display:block; margin-top:4px; color:#8b8b8b; font-size:10px; line-height:1.5; }
.wechat-detail-setting-row select { max-width:140px; padding:8px; border:1px solid #e9e9e9; border-radius:9px; background:#f7f7f7; color:#333; }
.wechat-detail-setting-row input[type=checkbox] { width:19px; height:19px; accent-color:#558ac9; }
.wechat-detail-card .wechat-detail-setting-row:last-child { border-bottom:0; padding-bottom:2px; }
.wechat-detail-setting-row.is-action { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.wechat-detail-setting-row.is-action:active { opacity:.6; }
.wechat-detail-setting-row.is-danger > span { color:#ff3b30; }
.wechat-detail-setting-row.is-ok > span { color:#07c160; }
.wechat-detail-chevron { color:#c8c8c8; font-size:12px; }
.wechat-range-ctl { display:flex; gap:8px; align-items:center; flex:0 0 auto; }
.wechat-range-ctl label { display:flex; align-items:center; gap:5px; font-size:12px; color:#666; }
.wechat-range-ctl select { min-width:54px; max-width:none; padding:7px 6px; border:1px solid #e9e9e9; border-radius:9px; background:#f7f7f7; color:#333; font-size:13px; }
.wechat-chat-trans-tools { display:flex; justify-content:flex-end; padding:3px 12px 1px; }
.wechat-chat-trans-open { background:rgba(255,255,255,.5); border:1px solid rgba(130,145,160,.2); border-radius:12px; color:#566a7b; padding:4px 10px; font-size:11px; cursor:pointer; }
.wechat-chat-trans-modal { position:absolute; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; padding:14px; background:rgba(0,0,0,.32); }
.wechat-chat-trans-panel { width:100%; max-width:370px; max-height:85%; overflow:auto; background:#fff; color:#333; border-radius:18px; padding:16px; box-shadow:0 12px 36px #0003; }
.wechat-chat-trans-panel header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:15px; }
.wechat-chat-trans-panel header button { border:0; background:transparent; font-size:19px; cursor:pointer; }
.wechat-chat-trans-panel label { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #eee; font-size:13px; }
.wechat-chat-trans-panel select { max-width:145px; min-width:110px; padding:5px; border:1px solid #ddd; border-radius:7px; background:#fff; color:#333; }
.wechat-chat-trans-panel p { font-size:11px; color:#888; line-height:1.6; }

/* ========================================
   顶部栏样式
   ======================================== */

.wechat-header {
    /* 🔥 同样降到15%透明度，清水玻璃 */
    background: rgba(255, 255, 255, 0.15); 
    backdrop-filter: blur(35px) saturate(200%);
    -webkit-backdrop-filter: blur(35px) saturate(200%);
    height: 68px;
    padding-top: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 12px;
    padding-right: 12px;
    /* 🔥 边框同样微加深 */
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
    box-sizing: border-box;
}

/* 聊天列表页专用：让外层顶部观感接近聊天内页的玻璃质感 */
.wechat-header-chatlist-glass {
    background:
        linear-gradient(160deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0.46) 58%, rgba(255, 255, 255, 0.38) 100%),
        linear-gradient(120deg, rgba(225, 233, 244, 0.34) 0%, rgba(243, 238, 230, 0.26) 52%, rgba(224, 235, 245, 0.3) 100%);
    backdrop-filter: blur(28px) saturate(170%);
    -webkit-backdrop-filter: blur(28px) saturate(170%);
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.62);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.06);
}
    
.wechat-header-left {
    width: 50px;  /* 🔥 宽度减小 */
}

.wechat-back-btn {
    background: none;
    border: none;
    color: var(--phone-global-text);
    font-size: 14px;  /* 🔥 字号减小 */
    padding: 6px;
    cursor: pointer;
}

.wechat-header-title {
    font-size: 14px;  /* 🔥 字号减小 */
    font-weight: 400;
    color: #000;
    flex: 1;
    text-align: center;
    display: block;
    position: relative;
}

.wechat-header-title-text {
    display: inline-block;
    position: relative;
    line-height: 1.1;
}

.status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: block;
    position: absolute;
    left: 100%;
    margin-left: 4px;
    top: 50%;
    transform: translateY(-50%);
    transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.wechat-header-title-text .wechat-music-listen-indicator {
    display: inline-flex;
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translate(14px, -50%);
    align-items: flex-end;
    gap: 2.5px;
    width: 18px;
    height: 13px;
    color: #34c759 !important;
}

.wechat-header-title-text .wechat-music-listen-indicator span {
    width: 2.5px;
    border-radius: 999px;
    background: #34c759 !important;
    opacity: 0.95;
    animation: wechatMusicListenBars 0.8s ease-in-out infinite;
}

.wechat-header-title-text .wechat-music-listen-indicator span:nth-child(1) {
    height: 6px;
    animation-delay: -0.2s;
}

.wechat-header-title-text .wechat-music-listen-indicator span:nth-child(2) {
    height: 12px;
    animation-delay: -0.4s;
}

.wechat-header-title-text .wechat-music-listen-indicator span:nth-child(3) {
    height: 8px;
    animation-delay: -0.1s;
}

@keyframes wechatMusicListenBars {
    0%, 100% { transform: scaleY(0.58); opacity: 0.64; }
    50% { transform: scaleY(1); opacity: 1; }
}

.dot-green {
    background: #34c759;
    box-shadow: 0 0 4px rgba(52, 199, 89, 0.6);
}

.dot-yellow {
    background: #ffcc00;
    box-shadow: 0 0 4px rgba(255, 204, 0, 0.6);
}

.dot-red {
    background: #ff3b30;
    box-shadow: 0 0 4px rgba(255, 59, 48, 0.62);
}

/* 正在输入动画 */
.typing-status {
    display: block;
    font-size: 12px;
    color: #999;
    font-weight: normal;
    margin-top: 2px;
}

.typing-dots {
    display: inline-block;
    animation: typing 1.4s infinite;
}

@keyframes typing {
    0%, 60%, 100% { opacity: 1; }
    30% { opacity: 0.3; }
}

.header-badge {
    color: #576b95;
    font-size: 14px;
}

.wechat-header-right {
    min-width: 50px;  /* 🔥 宽度减小 */
    display: flex;
    gap: 4px;
    justify-content: flex-end;
}

.wechat-header-btn {
    background: none;
    border: none;
    color: #000;
    font-size: 14px;  /* 🔥 字号减小 */
    cursor: pointer;
}

/* ========================================
   内容区样式
   ======================================== */

.wechat-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: #fff;
    position: relative;
    display: flex;
    flex-direction: column;
}

.wechat-content.wechat-profile-edit-content {
    display: block;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior: contain;
    box-sizing: border-box;
}

/* ========================================
   底部导航栏
   ======================================== */

.wechat-tabbar {
    height: 42px;
    padding-bottom: 5px;  /* 底部空白再缩小 */
    padding-top: 2px;
    background: #f7f7f7;
    border-top: 0.5px solid #d8d8d8;
    display: flex;
    flex-shrink: 0;
    box-sizing: content-box;
    align-items: flex-start;  /* 🔥 内容靠上对齐，图标往下移 */
}

/* 🔥 手机端同样调整 */
@media (max-width: 500px) {
    .wechat-tabbar {
        padding-bottom: 5px;
    }
}

.wechat-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;  /* 🔥 内容从顶部开始 */
    padding-top: 4px;
    cursor: pointer;
    position: relative;
    color: #999;
    font-size: 9px;
    height: 100%;
}

.wechat-tab.active {
    color: #07c160;
}

.wechat-tab i,
.wechat-tab svg {
    font-size: 16px;
    margin-bottom: 1px;
}

.wechat-tab svg {
    width: 17px;
    height: 17px;
    flex: 0 0 17px;
    stroke: currentColor;
}

.tab-badge {
    position: absolute;
    top: 2px;
    right: calc(50% - 17px);
    background: #ff3b30;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
}

.wechat-tab .wechat-moments-unread-dot {
    position: absolute;
    top: 2px;
    left: calc(50% + 7px);
    width: 7px;
    height: 7px;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.92);
    border-radius: 50%;
    background: #fa5151;
    pointer-events: none;
}

/* ========================================
   聊天列表样式
   ======================================== */

.wechat-chat-list {
    flex: 1;
    min-height: 0;
    background: #fff;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

.wechat-chat-list::-webkit-scrollbar {
    display: none; /* Chrome, Safari */
}

.chat-item {
    display: flex;
    align-items: center;
    padding: 8px 12px 8px 10px;
    border-bottom: 0.5px solid #e5e5e5;
    cursor: pointer;
    background: #fff;
    transition: background 0.2s;
}

.chat-item:active {
    background: #ececec;
}

/* 聊天列表启用背景图时，四个主页面切换为轻透明玻璃效果 */
.wechat-app.wechat-chatlist-bg-enabled {
    --wechat-glass-bg: rgba(255, 255, 255, 0.24);
    --wechat-glass-bg-strong: rgba(255, 255, 255, 0.32);
    --wechat-glass-bg-active: rgba(255, 255, 255, 0.42);
    --wechat-glass-border: rgba(255, 255, 255, 0.34);
}

.wechat-app.wechat-chatlist-bg-enabled .wechat-chat-list {
    background: transparent;
}

.wechat-app.wechat-chatlist-bg-enabled .chat-item {
    background: var(--wechat-glass-bg);
    backdrop-filter: blur(10px) saturate(135%);
    -webkit-backdrop-filter: blur(10px) saturate(135%);
    border-bottom: 0.5px solid var(--wechat-glass-border);
}

.wechat-app.wechat-chatlist-bg-enabled .chat-item:active {
    background: var(--wechat-glass-bg-active);
}

.wechat-app.wechat-chatlist-bg-enabled .wechat-tabbar {
    background: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(20px) saturate(145%);
    -webkit-backdrop-filter: blur(20px) saturate(145%);
    border-top: 0.5px solid var(--wechat-glass-border);
}

/* 微信四个主页面统一底栏玻璃风格（微信/通讯录/朋友圈/我） */
.wechat-app.wechat-main-shell .wechat-tabbar {
    background: rgba(255, 255, 255, 0.24);
    backdrop-filter: blur(20px) saturate(145%);
    -webkit-backdrop-filter: blur(20px) saturate(145%);
    border-top: 0.5px solid rgba(255, 255, 255, 0.34);
}

/* 四页统一背景时：通讯录容器改为透明/半透明，避免遮掉主背景 */
.wechat-app.wechat-chatlist-bg-enabled .wechat-contacts,
.wechat-app.wechat-chatlist-bg-enabled .contacts-scrollable,
.wechat-app.wechat-chatlist-bg-enabled .contacts-functions,
.wechat-app.wechat-chatlist-bg-enabled .contacts-list {
    background: transparent;
}

.wechat-app.wechat-chatlist-bg-enabled .function-item,
.wechat-app.wechat-chatlist-bg-enabled .contact-item,
.wechat-app.wechat-chatlist-bg-enabled .contact-group-item,
.wechat-app.wechat-chatlist-bg-enabled .contacts-empty-row {
    background: var(--wechat-glass-bg);
    backdrop-filter: blur(10px) saturate(130%);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
    border-bottom-color: var(--wechat-glass-border);
}

.wechat-app.wechat-chatlist-bg-enabled .group-letter {
    background: var(--wechat-glass-bg-strong);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}

.wechat-app.wechat-chatlist-bg-enabled .function-item:active,
.wechat-app.wechat-chatlist-bg-enabled .contact-item:active {
    background: var(--wechat-glass-bg-active);
}

/* 四页统一背景时：我页面容器改为透明/半透明 */
.wechat-app.wechat-chatlist-bg-enabled .wechat-profile {
    background: transparent;
}

.wechat-app.wechat-chatlist-bg-enabled .profile-card,
.wechat-app.wechat-chatlist-bg-enabled .profile-functions,
.wechat-app.wechat-chatlist-bg-enabled .profile-stats {
    background: var(--wechat-glass-bg);
    backdrop-filter: blur(10px) saturate(130%);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
}

.wechat-app.wechat-chatlist-bg-enabled .profile-function-item:active {
    background: var(--wechat-glass-bg-active);
}

/* 设置页/编辑页大量使用行内白底卡片，这里在全局背景启用时统一压低不透明度 */
.wechat-app.wechat-chatlist-bg-enabled .wechat-content > div[style*="background: #fff"],
.wechat-app.wechat-chatlist-bg-enabled .wechat-content > div[style*="background:#fff"],
.wechat-app.wechat-chatlist-bg-enabled .wechat-content > div[style*="background: rgba(255,255,255"],
.wechat-app.wechat-chatlist-bg-enabled .wechat-content > div[style*="background: rgba(255, 255, 255"] {
    background: var(--wechat-glass-bg-strong) !important;
    backdrop-filter: blur(12px) saturate(135%);
    -webkit-backdrop-filter: blur(12px) saturate(135%);
    border: 1px solid var(--wechat-glass-border);
}

.chat-avatar-wrapper {
    margin-right: 10px;
    flex-shrink: 0;
}

.chat-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #d8d8d8;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    margin-right: 10px;
    flex-shrink: 0;
    overflow: hidden;
}

.chat-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
}

.chat-info {
    flex: 1;
    min-width: 0;
}

.chat-name {
    font-size: 14px;
    color: #000;
    margin-bottom: 3px;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-pin-mark {
    display: inline-block;
    vertical-align: 0;
    margin-right: 5px;
    color: #9a9a9a;
    font-size: 11px;
    line-height: 1;
}

.group-count {
    font-size: inherit;
    color: inherit;
    flex: 0 0 auto;
}

.chat-name.has-count {
    display: flex;
    align-items: center;
    min-width: 0;
}

.chat-name.has-count .chat-name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-last-msg {
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    flex-shrink: 0;
}

.chat-time {
    font-size: 12px;
    color: #999;
    margin-bottom: 5px;
}

.chat-badge {
    background: #fa5151;
    color: #fff;
    font-size: 10px;
    font-weight: 500;
    min-width: 16px;
    height: 16px;
    line-height: 16px;
    padding: 0 5px;
    border-radius: 8px;
    text-align: center;
    box-sizing: border-box;
}

/* ========================================
   聊天室样式 - 高仿微信
   ======================================== */

.wechat-app .chat-room {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: transparent !important; /* 🔥 致命修复：彻底杀掉白底，让背景图透上来！ */
}

.wechat-app .chat-messages {
    flex: 1;
    min-height: 0; /* 防止无限撑开 */
    padding: 10px 6px 5px 6px; /* 顶部和左右留白，底部交由垫片处理 */
    box-sizing: border-box; 
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* 隐藏 Firefox 滚动条 */
    -ms-overflow-style: none; /* 隐藏 IE/Edge 滚动条 */
}

/* 🔥 隐藏 Chrome/Safari/Edge 手机浏览器的滚动条 */
.wechat-app .chat-messages::-webkit-scrollbar {
    display: none;
}

/* 🔥 物理垫片：彻底治愈部分手机浏览器吞掉底部 padding 导致遮挡的绝症 */
.wechat-app .chat-messages::after {
    content: '';
    display: block;
    height: 20px; /* 强制在最底下塞入一个20px的透明方块 */
    width: 100%;
    flex-shrink: 0;
}

/* 时间戳分组 */
.message-time-divider {
    text-align: center;
    margin: 15px 0;
}

.time-divider-text {
    display: inline-block;
    padding: 3px 10px;
    color: #b0b0b0;
    font-size: 10px;
}

/* 聊天消息 */
.chat-message {
    display: flex;
    margin-bottom: 15px;
    align-items: flex-start;
}

.message-left {
    justify-content: flex-start;
}

.message-right {
    justify-content: flex-end;
}

.message-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s;
    overflow: hidden;
}

.message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
}

/* 动态头像装饰独立合成，避免每帧刷新扩大到输入栏毛玻璃。 */
.wechat-app .message-avatar::after {
    contain: paint;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
}

.message-avatar:hover {
    transform: scale(1.05);
}

.message-left .message-avatar {
    margin-right: 8px;
}

.message-right .message-avatar {
    margin-left: 8px;
}

.message-content {
    max-width: 75%;
    position: relative;
}

.message-text {
    padding: 7px 10px; /* 稍微加宽一点左右内边距，更像微信 */
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    word-break: break-word; /* 🔥 优化：防止英文单词被从中间劈开 */
    text-align: left;       /* 🔥 核心修复：强制左对齐，彻底消灭异常字间距 */
    position: relative;
    width: fit-content;
    max-width: 100%;
}

.message-left .message-text {
    background: #fff;
    color: #1c1c1e;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.message-left .message-text::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 10px;
    border: 6px solid transparent;
    border-right-color: #fff;
    border-left: 0;
}

.message-right .message-text {
    background: #95ec69;
    color: #000;
}

.message-right .message-text::before {
    content: '';
    position: absolute;
    right: -6px;
    top: 10px;
    border: 6px solid transparent;
    border-left-color: #95ec69;
    border-right: 0;
}

#phone-panel-content .phone-screen .wechat-translation-card {
    width: max-content;
    max-width: min(100%, calc(100vw - 82px));
    padding: 0 !important;
    overflow: visible;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.62);
    border-radius: 8px !important;
    background: rgba(255, 255, 255, 0.62) !important;
    color: #242424 !important;
    box-shadow: 0 7px 20px rgba(64, 45, 32, 0.14) !important;
    backdrop-filter: blur(14px) saturate(125%);
    -webkit-backdrop-filter: blur(14px) saturate(125%);
    text-align: left;
}

#phone-panel-content .phone-screen .wechat-translation-card.wechat-inner-os-bubble {
    padding-right: 0 !important;
    border-bottom-right-radius: 0 !important;
}

#phone-panel-content .phone-screen .message-left .message-text.wechat-translation-card::before {
    border-right-color: rgba(255, 255, 255, 0.62);
}

#phone-panel-content .phone-screen .message-right .message-text.wechat-translation-card::before {
    border-left-color: rgba(255, 255, 255, 0.62);
}

#phone-panel-content .phone-screen .wechat-translation-source {
    position: relative;
    padding: 11px 38px 11px 13px;
    min-height: 42px;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-translation-source-text,
#phone-panel-content .phone-screen .wechat-translation-target-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
}

#phone-panel-content .phone-screen .wechat-translation-source-text {
    font-size: 14px;
    line-height: 1.45;
    font-weight: 500;
    color: #26211f;
}

#phone-panel-content .phone-screen .wechat-translation-heart {
    position: absolute;
    right: 14px;
    bottom: 8px;
    color: rgba(215, 111, 115, 0.82);
    font-size: 17px;
    line-height: 1;
    text-shadow: 0 1px 4px rgba(174, 77, 82, 0.14);
    pointer-events: none;
}

#phone-panel-content .phone-screen .wechat-translation-target {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    margin: 0 12px;
    padding: 11px 2px 12px;
    border-top: 1px dashed rgba(112, 91, 75, 0.24);
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-translation-card.wechat-inner-os-bubble .wechat-translation-target {
    padding-right: 18px;
}

#phone-panel-content .phone-screen .wechat-translation-target-text {
    font-size: 13px;
    line-height: 1.45;
    color: rgba(48, 42, 39, 0.88);
}

#phone-panel-content .phone-screen .wechat-translation-badge {
    width: 14px;
    height: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    border: 1px solid rgba(126, 104, 83, 0.42);
    border-radius: 2px;
    color: rgba(103, 83, 65, 0.82);
    background: rgba(255, 255, 255, 0.28);
    font-style: normal;
    line-height: 1;
}

#phone-panel-content .phone-screen .wechat-translation-badge b {
    font-size: 8px;
    font-weight: 600;
}

#phone-panel-content .phone-screen .wechat-translation-badge small {
    position: absolute;
    right: -4px;
    bottom: -3px;
    min-width: 9px;
    height: 9px;
    padding: 0 1px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    background: rgba(150, 127, 102, 0.9);
    color: #fff;
    font-size: 6px;
    font-weight: 600;
    line-height: 1;
}

#phone-panel-content .phone-screen .wechat-translation-card .wechat-inner-os-fold::after {
    border-color: rgba(193, 178, 163, 0.9) rgba(255, 255, 255, 0.46) transparent transparent;
}

#phone-panel-content .phone-screen .wechat-call-translation-card {
    width: max-content;
    max-width: 100%;
    padding: 8px !important;
    box-sizing: border-box;
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.66);
    border-radius: 8px !important;
    background: rgba(255, 255, 255, 0.84) !important;
    color: #292525 !important;
    box-shadow: 0 4px 14px rgba(61, 45, 38, 0.11) !important;
    backdrop-filter: blur(10px) saturate(115%);
    -webkit-backdrop-filter: blur(10px) saturate(115%);
    text-align: left;
}

#phone-panel-content .phone-screen .wechat-call-translation-card.wechat-inner-os-bubble {
    padding-right: 8px !important;
    border-bottom-right-radius: 0 !important;
}

#phone-panel-content .phone-screen .wechat-call-translation-source {
    position: relative;
    padding: 0 28px 7px 4px;
    font-size: 13px;
    line-height: 1.42;
    font-weight: 500;
    color: #292525;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
}

#phone-panel-content .phone-screen .wechat-call-spoken-bubble:not(.wechat-call-translation-card) {
    padding-right: 34px !important;
}

#phone-panel-content .phone-screen .wechat-call-speech-wave {
    position: absolute;
    top: 9px;
    right: 10px;
    width: 18px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: rgba(177, 132, 119, 0.78);
    pointer-events: none;
}

#phone-panel-content .phone-screen .wechat-call-translation-source .wechat-call-speech-wave {
    top: 1px;
    right: 4px;
}

#phone-panel-content .phone-screen .wechat-call-speech-wave i {
    display: block !important;
    width: 1.5px;
    min-width: 1.5px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: currentColor;
}

#phone-panel-content .phone-screen .wechat-call-speech-wave i:nth-child(1),
#phone-panel-content .phone-screen .wechat-call-speech-wave i:nth-child(5) {
    height: 5px;
}

#phone-panel-content .phone-screen .wechat-call-speech-wave i:nth-child(2),
#phone-panel-content .phone-screen .wechat-call-speech-wave i:nth-child(4) {
    height: 10px;
}

#phone-panel-content .phone-screen .wechat-call-speech-wave i:nth-child(3) {
    height: 14px;
}

#phone-panel-content .phone-screen .wechat-call-translation-target {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    padding: 6px 9px;
    border-radius: 6px;
    background: rgba(234, 231, 228, 0.82);
    box-sizing: border-box;
    font-size: 11px;
    line-height: 1.4;
}

#phone-panel-content .phone-screen .wechat-call-translation-card.wechat-inner-os-bubble .wechat-call-translation-target {
    padding-right: 22px;
}

#phone-panel-content .phone-screen .wechat-call-translation-label {
    flex: 0 0 auto;
    color: rgba(91, 80, 74, 0.56);
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-call-translation-text {
    min-width: 0;
    color: rgba(54, 48, 45, 0.86);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
}

#phone-panel-content .phone-screen .wechat-call-translation-card .wechat-inner-os-fold::after {
    border-color: rgba(194, 188, 183, 0.92) rgba(255, 255, 255, 0.68) transparent transparent;
}

.wechat-inner-os-wrapper {
    position: relative;
    display: inline-block;
    max-width: 100%;
}

.wechat-inner-os-bubble {
    padding-right: 22px;
    border-bottom-right-radius: 0;
    overflow: visible;
}

.wechat-inner-os-fold {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    z-index: 3;
}

.wechat-inner-os-fold::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-width: 16px 16px 0 0;
    border-style: solid;
    border-color: #d4d4d4 #ededed transparent transparent;
    box-shadow: -2px -2px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
}

.wechat-inner-os-fold:hover::after {
    border-width: 20px 20px 0 0;
    border-color: #c0c0c0 #ededed transparent transparent;
    box-shadow: -3px -3px 5px rgba(0, 0, 0, 0.15);
}

.wechat-inner-os-popup {
    display: none;
    position: relative;
    bottom: auto;
    right: auto;
    left: auto;
    width: min(230px, calc(100vw - 96px));
    min-width: 150px;
    max-width: calc(100vw - 96px);
    box-sizing: border-box;
    margin-top: 6px;
    padding: 9px 12px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(40, 40, 40, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
    color: #fff;
    font-size: 12px;
    line-height: 1.35;
    font-style: italic;
    white-space: pre-wrap;
    z-index: 100;
    gap: 5px;
    flex-direction: column;
    align-items: flex-start;
    transform-origin: top left;
    animation: wechatInnerOsPopUp 0.22s ease-out forwards;
}

.wechat-inner-os-popup::after {
    display: none;
    content: none;
}

.message-left .wechat-inner-os-popup {
    align-self: flex-start;
}

.message-right .wechat-inner-os-popup {
    align-self: flex-end;
}

.wechat-inner-os-title {
    display: block;
    margin: 0;
    padding: 0;
    color: #ff5e5e;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    font-style: normal;
    letter-spacing: 1px;
}

.wechat-inner-os-content {
    display: block;
    margin: 0;
    padding: 0;
    word-break: break-word;
    font-weight: 400;
    line-height: 1.38;
}

.wechat-inner-os-wrapper.show-os .wechat-inner-os-popup {
    display: inline-flex;
}

@media (max-width: 500px) {
    .wechat-inner-os-popup {
        width: min(210px, calc(100vw - 82px));
        max-width: calc(100vw - 82px);
        min-width: 132px;
        padding: 8px 10px 9px;
        font-size: 11px;
        line-height: 1.32;
        gap: 4px;
    }

    .message-left .wechat-inner-os-popup {
        transform-origin: top left;
    }

    .message-right .wechat-inner-os-popup {
        transform-origin: top right;
    }

    .wechat-inner-os-title {
        font-size: 9px;
    }

    .wechat-inner-os-content {
        line-height: 1.34;
    }
}

@keyframes wechatInnerOsPopUp {
    0% {
        opacity: 0;
        transform: scale(0.5);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}

.message-music-listen-card {
    width: 230px;
    max-width: 72vw;
    box-sizing: border-box;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    color: #1c1c1e;
}

.message-music-listen-avatars {
    display: flex;
    align-items: center;
    height: 30px;
    margin-bottom: 8px;
}

.message-music-listen-avatars > span {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    box-sizing: border-box;
    border-radius: 50%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f2f2f2;
    border: 2px solid #fff;
}

.message-music-listen-avatars > span + span {
    margin-left: -8px;
}

.message-music-listen-avatars > span > img,
.message-music-listen-avatars > span > div {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
    display: block;
}

.message-music-listen-title {
    font-size: 13px;
    font-weight: 600;
    color: #222;
}

.message-music-listen-song {
    margin-top: 3px;
    font-size: 12px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-music-listen-sub {
    margin-top: 3px;
    font-size: 11px;
    color: #999;
}

.message-music-listen-cancel {
    margin-top: 9px;
    width: 100%;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.06);
    color: #666;
    font-size: 12px;
    cursor: pointer;
}

.message-music-listen-card.is-cancelled {
    opacity: 0.76;
}

.message-music-listen-card.is-cancelled .message-music-listen-title,
.message-music-listen-card.is-cancelled .message-music-listen-song {
    color: #8e8e93;
}

.message-music-listen-ended {
    margin-top: 9px;
    width: 100%;
    height: 28px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.04);
    color: #9a9a9a;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.message-music-card {
    width: clamp(190px, 56vw, 224px);
    max-width: calc(100vw - 128px);
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
}

.message-left .message-music-card {
    border-radius: 4px 18px 18px 18px;
}

.message-right .message-music-card {
    border-radius: 18px 4px 18px 18px;
}

.message-music-card-bg {
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background-size: cover;
    background-position: center;
    filter: blur(16px) saturate(1.08);
    z-index: 0;
}

.message-music-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%);
    z-index: 1;
}

.message-music-card-content {
    position: relative;
    z-index: 2;
    padding: clamp(9px, 2.5vw, 12px);
    display: flex;
    flex-direction: column;
    gap: clamp(7px, 2vw, 10px);
}

.message-music-card-top,
.message-music-card-bottom {
    display: flex;
    align-items: center;
}

.message-music-card-visual {
    position: relative;
    width: clamp(38px, 10vw, 46px);
    height: clamp(38px, 10vw, 46px);
    flex: 0 0 clamp(38px, 10vw, 46px);
    margin-right: clamp(22px, 6vw, 28px);
}

.message-music-card-cover {
    position: absolute;
    left: 0;
    top: 0;
    width: clamp(38px, 10vw, 46px);
    height: clamp(38px, 10vw, 46px);
    border-radius: 6px;
    object-fit: cover;
    z-index: 2;
    box-shadow: 2px 0 10px rgba(0,0,0,0.4);
}

.message-music-card-vinyl {
    position: absolute;
    right: clamp(-19px, -4.6vw, -15px);
    top: 3px;
    width: clamp(32px, 8.6vw, 39px);
    height: clamp(32px, 8.6vw, 39px);
    background: #111;
    border-radius: 50%;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}

.message-music-card-vinyl::before {
    content: '';
    width: clamp(10px, 2.8vw, 13px);
    height: clamp(10px, 2.8vw, 13px);
    border-radius: 50%;
}

.message-music-card-vinyl::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(255,255,255,0.8);
    border-radius: 50%;
}

.message-music-card-info {
    flex: 1;
    min-width: 0;
}

.message-music-card-status {
    font-size: clamp(8px, 2.2vw, 10px);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 4px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.message-music-card-title {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.message-music-card-artist {
    font-size: clamp(9px, 2.5vw, 11px);
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.message-music-card-bottom {
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: clamp(7px, 1.8vw, 9px);
    gap: 6px;
}

.message-music-card-users {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
}

.message-music-card-avatars {
    display: flex;
    flex: 0 0 auto;
}

.message-music-card-avatars > span {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    border-radius: 50%;
    overflow: hidden;
    border: 1.5px solid rgba(255,255,255,0.5);
    background: rgba(255,255,255,0.18);
}

.message-music-card-avatars > span + span {
    margin-left: -8px;
}

.message-music-card-avatars > span > img,
.message-music-card-avatars > span > div {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
    display: block;
}

.message-music-card-user-text {
    min-width: 0;
    font-size: 10px;
    color: rgba(255,255,255,0.86) !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.message-music-card-actions {
    display: flex;
    gap: 8px;
    flex: 0 0 auto;
}

.message-music-card-btn {
    border: none;
    font-size: 11px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 20px;
    cursor: pointer;
    backdrop-filter: blur(5px);
}

.message-music-card-btn.is-glass {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.message-music-card-btn.is-primary {
    background: #1ed760;
    color: #000;
    font-weight: 600;
}

.message-music-listen-cancel.message-music-card-btn {
    width: clamp(72px, 22vw, 88px);
    height: 22px;
    padding: 0 8px;
    flex: 0 0 clamp(72px, 22vw, 88px);
    color: rgba(255,255,255,0.9) !important;
    font-size: 10px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.65);
    border-radius: 999px;
}

.message-music-card-ended {
    flex: 0 0 auto;
    font-size: 11px;
    color: rgba(255,255,255,0.66) !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.72);
}

.message-music-card.state-invite .message-music-card-status {
    color: #1ed760;
}

.message-music-card.state-invite .message-music-card-vinyl::before {
    background: #1ed760;
}

.message-music-card.state-active .message-music-card-status {
    color: rgba(255,255,255,0.9);
}

.message-music-card.state-active .message-music-card-dot {
    width: 6px;
    height: 6px;
    background-color: #ff3b30;
    border-radius: 50%;
    animation: messageMusicCardPulse 1.5s infinite;
}

.message-music-card.state-active .message-music-card-vinyl {
    animation: messageMusicCardSpin 3s linear infinite;
}

.message-music-card.state-active .message-music-card-vinyl::before {
    background: #ff3b30;
}

.message-music-card.state-ended .message-music-card-bg {
    filter: blur(16px) saturate(0.95);
    opacity: 0.9;
}

.message-music-card.state-ended .message-music-card-overlay {
    background: linear-gradient(135deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.68) 100%);
}

.message-music-card.state-ended .message-music-card-status,
.message-music-card.state-ended .message-music-card-title {
    color: rgba(255,255,255,0.55);
}

.message-music-card.state-ended .message-music-card-artist {
    color: rgba(255,255,255,0.4);
}

.message-music-card.state-ended .message-music-card-cover {
    filter: saturate(0.85) opacity(0.9);
}

.message-music-card.state-ended .message-music-card-vinyl {
    right: -8px;
    opacity: 0.4;
}

.message-music-card.state-ended .message-music-card-vinyl::before {
    background: #555;
}

@keyframes messageMusicCardPulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7); }
    70% { transform: scale(1.2); box-shadow: 0 0 0 4px rgba(255, 59, 48, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}

@keyframes messageMusicCardSpin {
    100% { transform: rotate(360deg); }
}


.message-time {
    font-size: 10px;
    color: #b0b0b0;
    margin-top: 4px;
    text-align: right;
}

.message-left .message-time {
    text-align: left;
}

/* 微信聊天多选删除 */
.chat-message.is-selection-mode {
    position: relative;
    align-items: center;
    min-height: 42px;
    margin-left: -6px;
    margin-right: -6px;
    padding: 4px 6px;
    box-sizing: border-box;
}

.chat-message.is-selection-mode.is-selected {
    background: rgba(0, 0, 0, 0.07);
}

.message-right.is-selection-mode .message-select-check {
    margin-right: auto;
}

.chat-message.is-selection-mode .message-select-check {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    margin-left: 8px;
    margin-right: 10px;
    border-radius: 50%;
    border: 1.5px solid rgba(0, 0, 0, 0.24);
    background: rgba(255, 255, 255, 0.88);
    color: #fff !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    cursor: pointer;
}

.chat-message.is-selection-mode .message-select-check.checked {
    background: #07c160;
    border-color: #07c160;
}

.chat-message.is-selection-mode .message-select-check i {
    color: #fff !important;
    font-size: 11px;
    line-height: 1;
}

.chat-message.is-selection-mode .message-avatar {
    pointer-events: none;
}

.chat-message.is-selection-mode .message-content {
    cursor: pointer;
}

.chat-message.is-selection-mode.message-system {
    justify-content: flex-start !important;
}

.chat-message.is-selection-mode.message-system .system-message-bubble {
    margin-left: auto;
    margin-right: auto;
}

.wechat-message-selection-bar {
    flex-shrink: 0;
    height: 108px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(10px, 4vw, 28px);
    padding: 12px 12px 14px;
    box-sizing: border-box;
    border-top: 0.5px solid rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
}

.wechat-message-selection-action {
    width: 48px;
    min-width: 42px;
    border: none;
    background: transparent;
    color: #222 !important;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 7px;
    padding: 0;
    font-size: 11px;
    line-height: 1.15;
    text-align: center;
    cursor: pointer;
}

.wechat-message-selection-action i {
    color: currentColor !important;
    font-size: 17px;
    line-height: 1;
}

.wechat-message-selection-action span {
    color: currentColor !important;
    width: 100%;
}

.wechat-message-selection-action.is-muted,
.wechat-message-selection-action.is-disabled {
    color: rgba(0, 0, 0, 0.34) !important;
    cursor: default;
}

.wechat-message-selection-action.is-danger {
    color: #1f2329 !important;
}

.wechat-message-selection-action.is-close {
    width: 32px;
    min-width: 32px;
    align-self: center;
    color: rgba(0, 0, 0, 0.36) !important;
}

.wechat-message-selection-action.is-close i {
    font-size: 18px;
}

/* 特殊消息类型 */
.message-image {
    max-width: 100%;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 相册原图只缩小到图片占位框上限，小图保持原始尺寸。 */
#phone-panel-content .phone-screen .wechat-app .chat-room .wechat-chat-photo-box {
    width: fit-content;
    height: fit-content;
    max-width: min(156px, 100%);
    max-height: 156px;
}

#phone-panel-content .phone-screen .wechat-app .chat-room .message-right .message-image-box {
    display: block !important;
    width: fit-content;
    margin-left: auto !important;
    margin-right: 0 !important;
}

#phone-panel-content .phone-screen .wechat-app .chat-room .message-left .message-image-box {
    display: block !important;
    width: fit-content;
    margin-left: 0 !important;
    margin-right: auto !important;
}

#phone-panel-content .phone-screen .wechat-app .chat-room .wechat-chat-photo {
    display: block;
    width: auto !important;
    height: auto !important;
    max-width: min(156px, 100%) !important;
    max-height: 156px !important;
    object-fit: contain;
}

/* 定位卡片：横向紧凑极简版 */
.message-location.style-compact {
    display: flex;
    align-items: center;
    width: 220px;
    max-width: 100%;
    background: #ffffff;
    padding: 10px 12px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    gap: 12px;
    box-sizing: border-box;
}

.message-location.style-compact .icon-area {
    width: 36px;
    height: 36px;
    min-width: 36px;
    background: #f0f7ff;
    color: #1677ff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}

.message-location.style-compact .text-area {
    flex: 1;
    min-width: 0;
}

.message-location.style-compact .title {
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.message-location.style-compact .detail {
    font-size: 10px;
    color: #6b7280;
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 500px) {
    .message-location.style-compact {
        width: 188px;
        padding: 8px 10px;
        border-radius: 10px;
        gap: 10px;
    }

    .message-location.style-compact .icon-area {
        width: 30px;
        height: 30px;
        min-width: 30px;
        font-size: 14px;
    }

    .message-location.style-compact .title {
        font-size: 13px;
    }

    .message-location.style-compact .detail {
        font-size: 9px;
        margin-top: 2px;
    }
}

.message-voice {
    padding: 10px 14px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
    cursor: pointer;
    font-size: 14px;
}

.message-left .message-voice {
    background: #fff;
    border-top-left-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.message-right .message-voice {
    background: #95ec69;
    border-top-right-radius: 4px;
}

/* ========================================
   🧧 红包与转账消息样式 (Fake-world 像素级复刻)
   ======================================== */
.message-redpacket, .message-transfer {
    width: 160px !important;
    border-radius: 4px !important;
    display: flex !important;
    flex-direction: column !important;
    cursor: pointer;
    position: relative;
    overflow: hidden !important;
    background-color: #F79C3E !important; /* 统一使用高级橙黄色 */
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
}

.message-transfer:active, .message-redpacket:active { background-color: #E08D38 !important; }
.message-transfer.opened, .message-redpacket.opened { background-color: #F9C594 !important; }

/* 气泡小尾巴 (与背景色统一) */
.message-left .message-transfer::before, .message-left .message-redpacket::before {
    content: ''; position: absolute; top: 10px; left: -4px;
    border: 4px solid transparent; border-right-color: #F79C3E; border-left: 0;
}
.message-right .message-transfer::before, .message-right .message-redpacket::before {
    content: ''; position: absolute; top: 10px; right: -4px;
    border: 4px solid transparent; border-left-color: #F79C3E; border-right: 0;
}
.message-left .message-redpacket.opened::before, .message-left .message-transfer.opened::before { border-right-color: #F9C594; }
.message-right .message-redpacket.opened::before, .message-right .message-transfer.opened::before { border-left-color: #F9C594; }

/* 主体内容区 */
.rp-main {
    display: flex !important;
    padding: 8px 10px !important;
    align-items: center !important;
    background: transparent !important;
}
.rp-icon {
    width: 24px !important;
    height: 24px !important;
    margin-right: 8px !important;
    flex-shrink: 0 !important;
}
.rp-icon svg { width: 100%; height: 100%; }
.rp-content {
    flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; text-align: left;
}
.rp-title {
    color: #fff !important; font-size: 13px !important; font-weight: 500 !important; line-height: 1.2 !important; margin-bottom: 1px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-subtitle {
    color: rgba(255,255,255,0.75) !important; font-size: 10px !important; font-weight: 400 !important;
}

/* 底部透明分割线与文字 */
.rp-footer {
    display: block !important;
    background-color: transparent !important;
    color: rgba(255,255,255,0.65) !important;
    font-size: 9px !important;
    padding: 2px 0 4px 0 !important;
    line-height: 1.2 !important;
    text-align: left !important;
    margin: 0 10px !important;
    width: auto !important;
    border-top: 0.5px solid rgba(255,255,255,0.2) !important;
}

/* ========================================
   输入区样式
   ======================================== */

.wechat-app .chat-input-area {
    flex-shrink: 0; 
    /* 🔥 透明度降到极限15%，近乎纯透明，拒绝白上加白 */
    background: rgba(255, 255, 255, 0.15) !important; 
    backdrop-filter: blur(35px) saturate(200%);       /* 🔥 加大模糊和饱和度，吸取底部颜色 */
    -webkit-backdrop-filter: blur(35px) saturate(200%);
    /* 🔥 边框稍微加深一点，强行勾勒出玻璃边缘 */
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    padding-bottom: env(safe-area-inset-bottom, 8px);
    position: relative;
    z-index: 10;
    overflow: hidden;
    contain: paint;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
}

.wechat-app .chat-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.6) !important; /* 🔥 纯白改为60%半透明白 */
    color: #000000 !important;
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    padding: 6px 10px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

/* 🔥 聊天输入栏 - 重构后的样式 */
.wechat-app .chat-input-bar {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
}

/* 🔥 输入框包装器 - 自动填充剩余空间 */
.wechat-app .chat-input-wrapper {
    flex: 1;
    min-width: 0;
    position: relative;
}

/* 🔥 输入框样式 */
.wechat-app .chat-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.42) !important;
    color: #111111 !important;
    border: 0.5px solid rgba(255, 255, 255, 0.58);
    border-radius: 8px;
    padding: 6px 10px;
    /* 外层输入栏已经执行毛玻璃，避免动态头像下的嵌套滤镜重复合成。 */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    /* 🔥 移除硬编码字体大小，继承父元素设置 */
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

.wechat-app .chat-input:focus {
    border-color: rgba(7, 193, 96, 0.78);
    background: rgba(255, 255, 255, 0.58) !important;
}

/* 🔥 输入栏按钮 - 统一尺寸 */
.wechat-app .input-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 18px;
    color: #666;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.2s;
}

/* 🔥 重新生成按钮稍小 */
.wechat-app .chat-input-bar #regenerate-btn {
    font-size: 14px;
    color: #888;
}

.wechat-app .input-btn:hover {
    color: #07c160;
}

.wechat-app .input-btn:active {
    transform: scale(0.9);
}

/* 🔥 移动端微调 - 不再限制输入框宽度 */
@media (max-width: 500px) {
    .wechat-app .chat-input-bar {
        padding: 6px 8px;
        gap: 4px;
    }
    /* 🔥 移动端按钮稍大 */
    .wechat-app .input-btn {
        width: 32px;
        height: 32px;
    }
    .wechat-app .input-btn svg {
        width: 22px;
        height: 22px;
    }
}

.wechat-app .send-btn {
    background: #07c160;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    /* 🔥 移除硬编码字体大小，继承父元素设置 */
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
}

.wechat-app .send-btn:hover {
    background: #06a752;
}

.wechat-app .send-btn:active {
    transform: scale(0.95);
}

/* ========================================
   表情面板样式
   ======================================== */

.wechat-app .emoji-panel {
    padding: 8px 10px 6px;
    background: transparent; /* 🔥 去掉死白底色 */
    border-top: 0.5px solid rgba(0,0,0,0.1);
    max-height: 220px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: pan-y;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

/* 🔥 新增：隐藏滚动条 for Chrome, Safari */
.wechat-app .emoji-panel::-webkit-scrollbar {
    display: none;
}

.wechat-app .emoji-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior: contain;
    padding-top: 8px;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.wechat-app .emoji-scroll::-webkit-scrollbar {
    display: none;
}

.emoji-grid {
    display: grid;
    /* ✅ 响应式布局，自动填充，不再有横向滚动条 */
    grid-template-columns: repeat(auto-fill, minmax(30px, 1fr)); 
    gap: 8px;
}

.emoji-item {
    font-size: 20px;
    text-align: center;
    cursor: pointer;
    padding: 1px;
    border-radius: 4px;
    transition: background 0.2s;
}

/* ======================================== 
   表情面板标签样式（新增）
   ======================================== */

.emoji-tabs {
    display: flex;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 2;
    background: transparent; /* 🔥 去掉死白底色 */
    border-bottom: 1px solid rgba(0,0,0,0.1);
}

.emoji-tab {
    flex: 1;
    padding: 8px;
    text-align: center;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
}

.emoji-tab.active {
    color: #07c160;
    border-bottom-color: #07c160;
    font-weight: 600;
}

.emoji-tab:hover {
    background: #f8f8f8;
}

.wechat-app .wechat-emoji-custom-tab {
    position: relative;
    flex: 1;
    min-width: 0;
}

.wechat-app .wechat-emoji-custom-tab > .emoji-tab {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
}

.wechat-app .wechat-emoji-manage-trigger {
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: currentColor;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.72;
}

.wechat-app .wechat-emoji-manage-trigger:hover,
.wechat-app .wechat-emoji-manage-trigger:focus-visible {
    background: rgba(7, 193, 96, 0.12);
    opacity: 1;
    outline: none;
}

.wechat-app .wechat-emoji-manage-menu {
    display: none;
    flex-direction: row;
    gap: 6px;
    padding: 8px 10px 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.wechat-app .wechat-emoji-manage-menu.is-open {
    display: flex;
}

.wechat-app .wechat-emoji-manage-action {
    flex: 1 1 0;
    min-width: 0;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 5px;
    border: 1px solid rgba(7, 193, 96, 0.22);
    border-radius: 9px;
    background: rgba(7, 193, 96, 0.1);
    color: #0b8f52;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
}

.wechat-app .wechat-emoji-manage-action.is-danger {
    border-color: rgba(255, 59, 48, 0.2);
    background: rgba(255, 59, 48, 0.08);
    color: #b54742;
}

.wechat-app .wechat-emoji-manage-action:disabled {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.05);
    color: #aaa;
    cursor: default;
    opacity: 0.75;
}

.wechat-app .wechat-emoji-selection-hint {
    padding: 0 10px 6px;
    color: #888;
    font-size: 11px;
    line-height: 1.4;
}

.wechat-app .wechat-emoji-selection-hint button {
    padding: 0;
    margin-left: 4px;
    border: 0;
    background: transparent;
    color: #07c160;
    font-size: 11px;
    cursor: pointer;
}

/* 自定义表情样式 */
#phone-panel-content .phone-screen .wechat-app .wechat-custom-emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    justify-items: center;
    align-items: center;
    gap: 12px 10px;
    padding: 2px 0 8px;
}

#phone-panel-content .phone-screen .wechat-app .wechat-custom-emoji-empty {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: #7f8792;
    font-size: 12px;
    line-height: 1.35;
    text-align: center;
}

#phone-panel-content .phone-screen .wechat-app .wechat-custom-emoji-empty small {
    color: #a0a6af;
    font-size: 10px;
}

#phone-panel-content .phone-screen .wechat-app .custom-emoji-item,
#phone-panel-content .phone-screen .wechat-app .wechat-custom-emoji-grid .emoji-add {
    width: 56px;
    height: 56px;
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-app .custom-emoji-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.wechat-app .custom-emoji-item.is-broken {
    border: 1px dashed rgba(120, 128, 140, 0.5);
    box-sizing: border-box;
    background: rgba(238, 241, 245, 0.9);
}

.wechat-app .custom-emoji-broken-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8b95a3;
    font-size: 15px;
    pointer-events: none;
}

.emoji-add {
    border: 2px dashed #ccc;
    color: #999;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.emoji-add:hover {
    border-color: #07c160;
    color: #07c160;
    background: #f0f9f4;
}

.emoji-item {
    font-size: 20px;
    text-align: center;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: background 0.2s;
}

.emoji-item:hover {
    background: #f0f0f0;
}

.emoji-item:active {
    background: #e0e0e0;
}

/* ========================================
   更多功能面板样式 (已修复布局和美化)
   ======================================== */

.more-panel {
    padding: 10px 0 6px 0;
    background: transparent; /* 🔥 去掉灰白底色 */
    border-top: 0.5px solid rgba(0,0,0,0.1);
    max-height: 160px;
    overflow-y: auto;
}

.more-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    padding: 0 10px; /* 🔥 缩小左右内边距 */
}

.more-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 25%;
    margin-bottom: 10px; /* 🔥 缩小行间距 */
    cursor: pointer;
    text-align: center;
    padding: 0;
}

.more-icon {
    width: 36px; /* 🔥 缩小图标框 */
    height: 36px;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 8px; /* 🔥 缩小圆角 */
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: #333;
    margin-bottom: 4px; /* 🔥 缩小间距 */
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    line-height: 1;
    padding: 0;
}

/* ========================================
   图标居中和尺寸控制（合并版）
   ======================================== */
.more-icon i,
.more-icon svg {
    display: block !important;
    margin: auto !important;
    fill: currentColor;
    /* 注意：不要在这里设置 font-size、width、height */
    /* 让 HTML 中的内联样式生效 */
}

.more-item:hover .more-icon {
    background: #f8f8f8;
    transform: scale(1.05);
}

.more-item:active .more-icon {
    background: #f0f0f0;
    transform: scale(0.95);
}

.more-name {
    font-size: 10px; /* 🔥 缩小字体 */
    color: #888;
    text-align: center;
    line-height: 1.2;
}

/* 移动端响应式保持不变，但新的样式已足够灵活，这里可以留空或删除 */
@media (max-width: 500px) {
    /* 新的Flex布局已足够好，这里可以不需要特殊规则 */
    /* 如果需要微调，可以在这里添加 */
}

/* ========================================
   头像设置弹窗
   ======================================== */

.avatar-settings-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.avatar-settings-content {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    width: 90%;
    max-width: 300px;
}

.avatar-settings-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 15px;
    text-align: center;
}

.avatar-preview {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    background: #f0f0f0;
    margin: 0 auto 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-upload-btn {
    display: block;
    width: 100%;
    padding: 10px;
    background: #f0f0f0;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    margin-bottom: 10px;
}

.remark-input {
    width: 100%;
    padding: 10px;
    border: 0.5px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 15px;
    outline: none;
}

.remark-input:focus {
    border-color: #07c160;
}

/* ======== 🌐 翻译设定 / 😀 表情回应 / 👑 群管理 新增样式 ======== */
.wechat-trans-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #f5f5f5;
}

.wechat-trans-select {
    flex: 0 0 auto;
    padding: 6px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 12px;
    color: #333;
    background: #fff;
    max-width: 130px;
    outline: none;
}

.wechat-translate-out-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    font-size: 10px;
    color: #8a6d3b;
    background: rgba(255, 193, 7, 0.12);
}

.wechat-translate-out-bar .tt-main {
    font-weight: 600;
    color: #b8860b;
}

.wechat-translate-out-bar .tt-provider {
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.06);
    color: #999;
}

.wechat-translate-out-bar .tt-hint {
    color: #aaa;
}

.wechat-trans-fold {
    margin-top: 6px;
    border-top: 1px dashed rgba(0, 0, 0, 0.12);
    padding-top: 4px;
}

.wechat-trans-fold-btn {
    background: none;
    border: none;
    color: #576b95;
    font-size: 11px;
    cursor: pointer;
    padding: 0;
}

.wechat-trans-fold-body {
    display: none;
    margin-top: 4px;
    font-size: 12px;
    color: #666;
    word-break: break-word;
}

.wechat-trans-fold.expanded .wechat-trans-fold-body {
    display: block;
}

.wechat-trans-pending {
    margin-top: 4px;
    font-size: 10px;
    color: #999;
}

.wechat-reaction-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    max-width: 100%;
}

.wechat-reaction-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 10px;
    border: 0.5px solid rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.85);
    font-size: 11px;
    color: #444;
    cursor: pointer;
    line-height: 1.4;
}

.wechat-reaction-pill.is-mine {
    border-color: #07c160;
    background: rgba(7, 193, 96, 0.12);
    color: #07c160;
}

.wechat-reaction-add {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    padding: 2px 6px;
    border-radius: 10px;
    border: 0.5px dashed rgba(0, 0, 0, 0.15);
    background: transparent;
    font-size: 10px;
    color: #999;
    cursor: pointer;
    opacity: 0.65;
}

.wechat-reaction-add:hover {
    opacity: 1;
}

.wechat-reaction-add span {
    font-size: 9px;
}

/* Reaction panel stays inside the phone's stacking context. */
.wechat-app .wechat-reaction-picker, .phone-view-layer > .wechat-reaction-picker {
    position: absolute !important;
    z-index: 2147483000 !important;
    width: min(330px, calc(100% - 16px));
    max-height: min(350px, 55%);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: 18px;
    padding: 12px;
    touch-action: pan-y;
}
.wechat-reaction-quick, .wechat-reaction-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; width: 100%; }
.wechat-reaction-all-label { font-size: 12px; color: #777; margin: 9px 0 5px; }
.wechat-reaction-pick { min-width: 0; min-height: 35px; font-size: 23px; }
.wechat-reaction-picker {
    position: fixed;
    z-index: 10050;
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.wechat-reaction-pick {
    border: none;
    background: none;
    font-size: 20px;
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    transition: transform 0.1s;
}

.wechat-reaction-pick:hover {
    transform: scale(1.25);
}

/* Reaction picker visual restoration: scoped to the phone only. */
.wechat-app .wechat-reaction-picker, .phone-view-layer > .wechat-reaction-picker {
    width: min(330px, calc(100% - 24px)); max-height: min(340px, 52%);
    padding: 12px 12px 10px; gap: 8px; overflow-y: auto;
    background: rgba(255,255,255,.97); border: 1px solid rgba(255,255,255,.65);
    border-radius: 19px; box-shadow: 0 12px 30px rgba(0,0,0,.13);
    color: #384656;
}
.wechat-reaction-picker button { appearance: none; -webkit-appearance: none; font-family: inherit; cursor: pointer; }
.wechat-reaction-picker .wechat-reaction-quick,
.wechat-reaction-picker .wechat-reaction-grid { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 5px; }
.wechat-reaction-picker .wechat-reaction-pick { border: 0; background: transparent; border-radius: 11px; padding: 4px 0; min-height: 38px; font-size: 24px; line-height: 1.2; }
.wechat-reaction-picker .wechat-reaction-pick:active { background: #edf3fa; }
.wechat-reaction-picker .wechat-reaction-categories { display: flex; flex-wrap: wrap; gap: 5px 7px; margin: 6px 0 10px; }
.wechat-reaction-picker .wechat-reaction-category { border: 1px solid transparent; background: transparent; border-radius: 12px; padding: 6px 9px; color: #444; font-size: 12px; line-height: 1.3; }
.wechat-reaction-picker .wechat-reaction-category.active { border-color: #6289bb; background: #edf3fa; }
.wechat-reaction-picker .wechat-reaction-collapse { border: 0; border-radius: 12px; background: transparent; color: #6289bb; font-size: 22px; }
.wechat-reaction-picker .wechat-reaction-recent-label,
.wechat-reaction-picker .wechat-reaction-all-label { color: #808080; font-size: 12px; margin: 6px 0; }
.wechat-reaction-picker .wechat-reaction-actions { border-top: 1px solid #e1e3e6; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; padding-top: 9px; }
.wechat-reaction-picker .wechat-reaction-action { border: 0; background: transparent; color: #71808e; font-size: 12px; padding: 8px 1px; border-radius: 10px; }
.wechat-reaction-picker .wechat-reaction-action:active { background: #edf3fa; }
.wechat-reaction-pill { border-radius: 12px !important; padding: 4px 9px !important; font-size: 13px !important; }


/* V13: fixed action toolbar, independently scrolling emoji catalogue. */
.wechat-app .wechat-reaction-picker,
.phone-view-layer > .wechat-reaction-picker {
    width: min(330px, calc(100% - 20px));
    max-height: min(440px, 66%);
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 12px;
    touch-action: auto;
}
.wechat-reaction-picker.is-collapsed .wechat-reaction-expanded { display: none !important; }
.wechat-reaction-picker .wechat-reaction-quick {
    display: grid; grid-template-columns: repeat(7,minmax(0,1fr));
    flex: 0 0 auto; gap: 3px; align-items: center;
}
.wechat-reaction-picker .wechat-reaction-expanded {
    flex: 1 1 auto; min-height: 0;
    overflow-y: auto !important; overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    scrollbar-width: thin;
}
.wechat-reaction-picker .wechat-reaction-grid {
    display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 3px;
}
.wechat-reaction-picker .wechat-reaction-pick { font-size: 20px; min-height: 33px; padding: 3px 0; }
.wechat-reaction-picker .wechat-reaction-collapse { font-size: 20px; min-height: 33px; }
.wechat-reaction-picker .wechat-reaction-categories { gap: 4px 6px; margin: 6px 0 8px; }
.wechat-reaction-picker .wechat-reaction-category { font-size: 12px; padding: 5px 8px; }
.wechat-reaction-picker .wechat-reaction-actions {
    flex: 0 0 auto; position: relative; z-index: 1;
    background: rgba(255,255,255,.97);
    display: grid; grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 4px; padding-top: 8px; margin-top: 3px;
    border-top: 1px solid #e1e3e6;
}
.wechat-reaction-picker .wechat-reaction-action { font-size: 12px; padding: 8px 1px; }
/* V15: conservative refinements to the working V13 picker; no component replacement. */
.wechat-reaction-picker .wechat-reaction-expanded {
    max-height: min(225px, 34vh);
    min-height: 0;
    overflow-y: auto !important;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
}
.wechat-reaction-picker .wechat-reaction-quick,
.wechat-reaction-picker .wechat-reaction-actions {
    flex-shrink: 0;
}
.wechat-reaction-picker .wechat-reaction-actions {
    position: relative;
    z-index: 2;
}
/* Restore the reaction chips to the pre-V11 readable size. */
.wechat-app .wechat-reaction-row { gap: 4px; margin-top: 4px; }
.wechat-app .wechat-reaction-pill {
    border-radius: 12px !important;
    padding: 4px 9px !important;
    font-size: 13px !important;
    line-height: 1.4;
    min-height: 24px;
    gap: 3px;
}

/* 引用消息：更醒目的引用块（气泡下方）与输入框上方的引用条 */
.wechat-app .wechat-quote-block {
    display: block;
    box-sizing: border-box;
    max-width: min(240px, 100%);
    margin-top: 4px;
    padding: 6px 10px 6px 11px;
    border-radius: 6px;
    border-left: 3px solid var(--wx-quote, #5b8def);
    background: rgba(0, 0, 0, 0.09);
    color: #3a3a3a;
    font-size: 12.5px;
    line-height: 1.45;
}
/* 超过两行用省略号收尾 */
.wechat-app .wechat-quote-inner {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
    max-height: 2.9em;
}
.wechat-app .wechat-quote-sender { font-weight: 600; color: #1f1f1f; margin-right: 4px; }
.wechat-app .wechat-quote-sender::after { content: '：'; font-weight: 400; }
.wechat-app .wechat-quote-text { color: #4a4a4a; }
.wechat-app .wechat-active-quote-bar {
    display: flex; align-items: stretch; gap: 8px;
    margin: 0 8px 6px; padding: 7px 8px 7px 0;
    border-radius: 8px; background: rgba(0, 0, 0, 0.07);
    overflow: hidden;
}
.wechat-app .wechat-active-quote-accent { flex: 0 0 4px; background: var(--wx-quote, #5b8def) !important; border-radius: 2px; margin-left: 0; }
.wechat-app .wechat-active-quote-body { flex: 1; min-width: 0; }
.wechat-app .wechat-active-quote-label { font-size: 12px; font-weight: 600; color: var(--wx-quote-text, #4a7bd8) !important; line-height: 1.3; }
.wechat-app .wechat-active-quote-text {
    margin-top: 2px; font-size: 13px; line-height: 1.4; color: #333;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word;
}
.wechat-app .wechat-active-quote-cancel {
    flex: 0 0 auto; align-self: center; width: 26px; height: 26px; border: 0; border-radius: 50%;
    background: rgba(0,0,0,.08); color: #555; font-size: 12px; cursor: pointer;
}

/* 贴表情动画：大表情先贴到气泡角上，停留约 1 秒后消失；小标签保留。 */
.wechat-app .wechat-reaction-pop-animation {
    position: absolute;
    z-index: 120;
    pointer-events: none;
    user-select: none;
    line-height: 1;
    font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,.28));
    animation: wechat-reaction-stick 1250ms cubic-bezier(.2,.9,.3,1) forwards;
}
@keyframes wechat-reaction-stick {
    0%   { opacity: 0; transform: translate(-50%, -140%) scale(1.9) rotate(-18deg); }
    18%  { opacity: 1; transform: translate(-50%, -50%) scale(.82) rotate(6deg); }
    30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.12) rotate(-4deg); }
    42%  { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
    78%  { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(.55) rotate(0deg); }
}
.wechat-app .wechat-reaction-pill-new { animation: wechat-reaction-pill-in 420ms cubic-bezier(.2,1.4,.4,1) both; animation-delay: 220ms; }
.wechat-app .wechat-reaction-pop-animation.is-line-top { animation: wechat-reaction-line 1100ms cubic-bezier(.2,.9,.3,1) forwards; }
@keyframes wechat-reaction-line {
    0%   { opacity: 0; transform: translate(-50%, -20%) scale(.3); }
    25%  { opacity: 1; transform: translate(-50%, -95%) scale(1.35) rotate(-8deg); }
    45%  { opacity: 1; transform: translate(-50%, -70%) scale(1.05) rotate(4deg); }
    75%  { opacity: 1; transform: translate(-50%, -60%) scale(1) rotate(0); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(.45); }
}
@keyframes wechat-reaction-pill-in {
    0% { opacity: 0; transform: scale(.4); }
    100% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
    .wechat-app .wechat-reaction-pop-animation { animation-duration: 160ms; }
    .wechat-app .wechat-reaction-pill-new { animation: none; }
}
/* 表情面板：7 列网格 + 彩色字体栈，保证各端显示一致 */
.wechat-reaction-picker .wechat-reaction-quick { grid-template-columns: repeat(7,minmax(0,1fr)); }
.wechat-reaction-picker .wechat-reaction-grid { grid-template-columns: repeat(7,minmax(0,1fr)); gap: 2px; }
.wechat-reaction-picker .wechat-reaction-pick,
.wechat-reaction-picker .wechat-reaction-collapse { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
.wechat-reaction-picker .wechat-reaction-collapse { font-family: inherit; }
.wechat-reaction-picker .wechat-reaction-pick { font-size: 22px; min-height: 34px; }

/* 长按弹窗·紧凑版：表情缩小，下方文字按钮收紧间距 */
.wechat-app .wechat-reaction-picker,
.phone-view-layer > .wechat-reaction-picker {
    width: min(262px, calc(100% - 24px));
    max-height: min(380px, 64%);
    padding: 7px 9px 6px;
    gap: 3px;
    border-radius: 15px;
    box-shadow: 0 8px 22px rgba(0,0,0,.14);
}
.wechat-reaction-picker .wechat-reaction-quick { gap: 1px; }
.wechat-reaction-picker .wechat-reaction-pick { font-size: 18px; min-height: 28px; padding: 1px 0; border-radius: 8px; }
.wechat-reaction-picker .wechat-reaction-collapse { font-size: 16px; min-height: 28px; }
.wechat-reaction-picker .wechat-reaction-grid { gap: 0; }
.wechat-reaction-picker .wechat-reaction-expanded { max-height: min(205px, 34vh); }
.wechat-reaction-picker .wechat-reaction-categories { gap: 2px 3px; margin: 3px 0 5px; }
.wechat-reaction-picker .wechat-reaction-category { font-size: 11px; padding: 3px 6px; border-radius: 9px; }
.wechat-reaction-picker .wechat-reaction-recent-label,
.wechat-reaction-picker .wechat-reaction-all-label { font-size: 11px; margin: 3px 0; }
.wechat-reaction-picker .wechat-reaction-actions {
    gap: 0; padding-top: 3px; margin-top: 1px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
}
.wechat-reaction-picker .wechat-reaction-action { font-size: 11px; padding: 4px 0; line-height: 1.25; border-radius: 7px; }

.wechat-app .wechat-reaction-pill .wechat-reaction-emoji { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
.wechat-app .wechat-reaction-pill .wechat-reaction-by {
    max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 11px; color: #5f6b77;
}
.wechat-app .wechat-reaction-pill.is-mine .wechat-reaction-by { color: #07a050; }
.wechat-reaction-picker .wechat-reaction-recent { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); gap: 0; }

/* ===== 群聊「聊天信息」：群资料卡 / 群成员 / 操作弹窗 / 拍一拍 ===== */
.wechat-group-info-card { padding-top: 18px; }
.wechat-group-hero { text-align: center; margin-bottom: 14px; }
.wechat-group-hero-avatar { width: 64px; height: 64px; margin: 0 auto 8px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 30px; background: #f2f2f2; }
.wechat-group-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wechat-group-hero-name { font-size: 16px; font-weight: 650; color: #222; }
.wechat-group-hero-no { font-size: 11px; color: #9a9a9a; margin-top: 3px; }
.wechat-group-members-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #333; font-weight: 600; margin: 4px 0 8px; }
.wechat-group-members-more { border: 0; background: transparent; color: #8a8a8a; font-size: 12px; cursor: pointer; }
.wechat-group-members-more i { font-size: 10px; margin-left: 2px; }
.wechat-group-members-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px 4px; padding-bottom: 10px; border-bottom: 1px solid #e9e9e9; }
.wechat-group-member-cell { text-align: center; cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.wechat-group-member-avatar { position: relative; width: 42px; height: 42px; margin: 0 auto 4px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.wechat-group-member-avatar > img, .wechat-group-member-avatar > span:first-child, .wechat-group-member-avatar > div:first-child { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; object-fit: cover; }
.wechat-group-member-cell.is-add .wechat-group-member-avatar { background: transparent; border: 1px dashed #c9c9c9; color: #b5b5b5; font-size: 14px; }
.wechat-group-member-name { font-size: 10.5px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wechat-group-member-avatar .wechat-gm-badge { position: absolute; top: -4px; left: 50%; transform: translateX(-50%); white-space: nowrap; }
.wechat-gm-badge { display: inline-block; padding: 1px 6px; border-radius: 6px; font-size: 10px; line-height: 15px; color: #fff; font-weight: 600; margin-left: 6px; vertical-align: middle; }
.wechat-gm-badge.is-compact { font-size: 9px; line-height: 13px; padding: 0 5px; }
.wechat-group-member-avatar .wechat-gm-badge { margin-left: 0; }
.wechat-gm-badge.role-owner { background: #e0a43a; }
.wechat-gm-badge.role-admin { background: #3f9bd6; }
.wechat-gm-badge.role-muted { background: #9aa1a8; }
.wechat-detail-value { font-style: normal; color: #8b8b8b; font-size: 12px; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wechat-detail-mini-avatar { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: #f0f0f0; }
.wechat-detail-mini-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wechat-detail-setting-row > span.wechat-detail-mini-avatar { flex: 0 0 30px; }
.wechat-detail-setting-row > em.wechat-detail-value { flex: 0 1 auto; }
.wechat-seg { display: inline-flex; background: #f0f0f0; border-radius: 9px; padding: 2px; flex: 0 0 auto; }
.wechat-seg-btn { border: 0; background: transparent; padding: 5px 9px; font-size: 12px; color: #666; border-radius: 7px; cursor: pointer; }
.wechat-seg-btn.active { background: #fff; color: #07a050; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.wechat-group-level-row.is-disabled { opacity: .45; pointer-events: none; }

.wechat-gm-list-content { padding-top: 8px; }
.wechat-gm-search { display: flex; align-items: center; gap: 8px; margin: 4px 12px 0; padding: 9px 12px; border-radius: 12px; background: rgba(255,255,255,.85); color: #9a9a9a; font-size: 13px; }
.wechat-gm-search input { flex: 1; border: 0; outline: none; background: transparent; font-size: 14px; color: #333; }
.wechat-gm-list { padding: 4px 14px !important; }
.wechat-gm-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #ededed; cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.wechat-gm-row:last-child { border-bottom: 0; }
.wechat-gm-row:active { opacity: .6; }
.wechat-gm-row-avatar { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 20px; }
.wechat-gm-row-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wechat-gm-row-main { flex: 1; min-width: 0; }
.wechat-gm-row-name { font-size: 15px; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wechat-gm-me { font-size: 12px; color: #999; }
.wechat-gm-row-sub { margin-top: 3px; font-size: 12px; color: #8b8b8b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wechat-gsheet-mask { position: absolute; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0); display: flex; align-items: flex-end; justify-content: center; transition: background .2s ease; }
.wechat-gsheet-mask.is-open { background: rgba(0,0,0,.42); }
.wechat-gsheet-mask.is-center { align-items: center; }
.wechat-gsheet { width: 100%; box-sizing: border-box; background: #fff; border-radius: 18px 18px 0 0; padding: 16px 16px calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateY(100%); transition: transform .22s ease; max-height: 82%; overflow-y: auto; }
.wechat-gsheet-mask.is-open .wechat-gsheet { transform: translateY(0); }
.wechat-gsheet-head { display: flex; align-items: center; gap: 12px; padding: 2px 4px 12px; }
.wechat-gsheet-avatar { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 22px; }
.wechat-gsheet-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wechat-gsheet-name { font-size: 16px; font-weight: 650; color: #222; }
.wechat-gsheet-sub { margin-top: 3px; font-size: 12px; color: #999; }
.wechat-gsheet-items { display: flex; flex-direction: column; }
.wechat-gsheet-item { display: flex; align-items: center; gap: 14px; border: 0; background: transparent; padding: 12px 6px; font-size: 15px; color: #222; text-align: left; cursor: pointer; border-radius: 10px; }
.wechat-gsheet-item:active { background: #f4f4f4; }
.wechat-gsheet-item.is-warn { color: #e69500; }
.wechat-gsheet-item.is-danger { color: #e53935; }
.wechat-gsheet-icon { width: 24px; text-align: center; font-size: 18px; font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
.wechat-gsheet-cancel { width: 100%; margin-top: 8px; border: 0; border-radius: 12px; background: #f2f2f2; padding: 12px; font-size: 15px; color: #555; cursor: pointer; }
.wechat-gprompt { width: calc(100% - 48px); max-width: 320px; border-radius: 16px; transform: scale(.94); opacity: 0; transition: transform .18s ease, opacity .18s ease; padding: 18px 16px 14px; }
.wechat-gsheet-mask.is-open .wechat-gprompt { transform: scale(1); opacity: 1; }
.wechat-gprompt-title { font-size: 15px; font-weight: 650; color: #222; text-align: center; }
.wechat-gprompt-hint { font-size: 11.5px; color: #999; text-align: center; margin-top: 4px; }
.wechat-gprompt-input { display: block; width: 100%; box-sizing: border-box; margin-top: 12px; padding: 10px 12px; border: 1px solid #e3e3e3; border-radius: 10px; font-size: 14px; outline: none; }
.wechat-gprompt-input:focus { border-color: #07c160; }
.wechat-gprompt-input.is-multiline { min-height: 96px; resize: vertical; line-height: 1.5; font-family: inherit; }
.wechat-gprompt-upload { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; color: #576b95; cursor: pointer; }
.wechat-gprompt-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.wechat-gprompt-btn { border: 0; border-radius: 9px; padding: 8px 14px; font-size: 13.5px; background: #f2f2f2; color: #444; cursor: pointer; }
.wechat-gprompt-btn.is-ghost { background: transparent; color: #999; margin-right: auto; padding-left: 4px; }
.wechat-gprompt-btn.is-primary { background: #07c160; color: #fff; }

/* 拍一拍：画面轻微抖动 */
.wechat-pat-shake { animation: wechat-pat-shake 560ms cubic-bezier(.36,.07,.19,.97) both; }
@keyframes wechat-pat-shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(3px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-5px, 1px, 0); }
    40%, 60% { transform: translate3d(5px, -1px, 0); }
}
@media (prefers-reduced-motion: reduce) { .wechat-pat-shake { animation: none; } }

/* 建群时设置群主/管理员 */
.wechat-create-roles { margin: 4px 0 18px; }
.wechat-create-roles-title { font-size: 13px; color: #999; margin-bottom: 8px; }
.wechat-create-role-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; }
.wechat-create-role-row:last-child { border-bottom: 0; }
.wechat-create-role-row .wechat-seg-btn.active[data-role="owner"] { color: #c98a1b; }
.wechat-create-role-row .wechat-seg-btn.active[data-role="admin"] { color: #2f86c2; }

/* ===== 角色气泡样式（私聊设置里选，群聊可沿用） ===== */
.wbs-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 6px 0 4px; }
.wbs-tile { border: 1.5px solid transparent; border-radius: 12px; padding: 10px 6px 7px; background: rgba(120,140,160,.10); cursor: pointer; text-align: center; -webkit-tap-highlight-color: transparent; }
.wbs-tile.active { border-color: #07c160; background: rgba(7,193,96,.08); }
.wbs-tile-bubble { display: inline-block; padding: 6px 10px; border-radius: 9px; font-size: 12px; background: #fff; color: #222; max-width: 100%; box-sizing: border-box; }
.wbs-tile-name { margin-top: 6px; font-size: 11px; color: #666; }
.wbs-tile.is-night-preview { background: rgba(30,36,60,.18); }
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-glass .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-glass .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-glass .message-text,
.wechat-app .chat-message.message-left.wbs-glass .wechat-voice-transcript,
.wbs-tile.wbs-glass .wbs-tile-bubble {
    background: linear-gradient(135deg, rgba(255,255,255,.62), rgba(214,234,255,.30)) !important;
    border: 1px solid rgba(255,255,255,.85) !important;
    -webkit-backdrop-filter: blur(14px) saturate(170%) !important; backdrop-filter: blur(14px) saturate(170%) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(160,200,240,.25), 0 6px 16px rgba(70,110,150,.18) !important;
    color: #1d2b38 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-frost .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-frost .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-frost .message-text,
.wechat-app .chat-message.message-left.wbs-frost .wechat-voice-transcript,
.wbs-tile.wbs-frost .wbs-tile-bubble {
    background: rgba(238,240,243,.66) !important;
    border: 1px solid rgba(255,255,255,.55) !important;
    -webkit-backdrop-filter: blur(20px) !important; backdrop-filter: blur(20px) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,.08) !important;
    color: #2a2e33 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-cream .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-cream .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-cream .message-text,
.wechat-app .chat-message.message-left.wbs-cream .wechat-voice-transcript,
.wbs-tile.wbs-cream .wbs-tile-bubble {
    background: #fff6e8 !important;
    border: 1px solid #f1dcbd !important;
    box-shadow: 0 2px 0 #efd6b2 !important;
    color: #5b4630 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-sakura .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-sakura .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-sakura .message-text,
.wechat-app .chat-message.message-left.wbs-sakura .wechat-voice-transcript,
.wbs-tile.wbs-sakura .wbs-tile-bubble {
    background: linear-gradient(135deg, #ffe7ef, #ffd3e2) !important;
    border: 1px solid #ffc3d7 !important;
    box-shadow: 0 3px 10px rgba(255,140,180,.22) !important;
    color: #7a3350 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-mint .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-mint .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-mint .message-text,
.wechat-app .chat-message.message-left.wbs-mint .wechat-voice-transcript,
.wbs-tile.wbs-mint .wbs-tile-bubble {
    background: linear-gradient(135deg, #e6fbf3, #cdf2e4) !important;
    border: 1px solid #b4e8d3 !important;
    box-shadow: 0 3px 10px rgba(60,180,140,.18) !important;
    color: #1f5946 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-night .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-night .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-night .message-text,
.wechat-app .chat-message.message-left.wbs-night .wechat-voice-transcript,
.wbs-tile.wbs-night .wbs-tile-bubble {
    background: linear-gradient(135deg, #2f3757, #1b2036) !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    box-shadow: 0 5px 16px rgba(20,24,48,.35) !important;
    color: #eef0ff !important;
}
.wechat-app .chat-message.message-left.wbs-night .wechat-trans-fold-body, .wechat-app .chat-message.message-left.wbs-night .wechat-trans-fold-btn { color: rgba(238,240,255,.78) !important; }
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-outline .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-outline .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-outline .message-text,
.wechat-app .chat-message.message-left.wbs-outline .wechat-voice-transcript,
.wbs-tile.wbs-outline .wbs-tile-bubble {
    background: rgba(255,255,255,.95) !important;
    border: 1.5px solid #34383f !important;
    box-shadow: 3px 3px 0 #34383f !important;
    color: #1f2226 !important;
}
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-paper .message-text,
#phone-panel-content .phone-screen .wechat-app .chat-message.message-left.wbs-paper .wechat-voice-transcript,
.wechat-app .chat-message.message-left.wbs-paper .message-text,
.wechat-app .chat-message.message-left.wbs-paper .wechat-voice-transcript,
.wbs-tile.wbs-paper .wbs-tile-bubble {
    background-color: #fffdf5 !important;
    background-image: repeating-linear-gradient(transparent 0 21px, rgba(120,150,190,.18) 21px 22px) !important;
    border: 1px solid #ebe2c7 !important;
    box-shadow: 0 2px 6px rgba(120,100,60,.12) !important;
    color: #3d3a33 !important;
}
/* 群聊发送者标签：群主金色 / 管理员绿色 / 普通成员头衔蓝灰 */
.wechat-sender-chip { display: inline-block; max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; padding: 0 6px; margin-right: 4px; border-radius: 7px; font-size: 10.5px; line-height: 16px; font-weight: 600; color: #fff; }
/* 头衔 + 名字：一行显示，超出气泡宽度才省略（头衔先缩） */
.wechat-app .chat-room .message-sender:has(.wechat-sender-chip) { display: flex !important; align-items: center; gap: 4px; width: 0; min-width: max(100%, 10em); overflow: hidden; white-space: nowrap; }
.wechat-app .chat-room .message-sender.is-me:has(.wechat-sender-chip) { min-width: 100%; justify-content: flex-end; }
.wechat-app .chat-room .message-sender:has(.wechat-sender-chip) .message-sender-name { flex: 0 1 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; }
.wechat-app .chat-room .message-sender .wechat-sender-chip { flex: 0 3 auto; min-width: 2.6em; max-width: none; margin: 0 !important; font-size: 9.5px !important; line-height: 15px; padding: 0 5px; font-weight: 600; }
.message-sender.is-me { text-align: right; }
.message-sender.is-me .wechat-sender-chip { margin-right: 0; margin-left: 4px; }
.wechat-sender-chip.role-owner { background: linear-gradient(135deg, #f2b84b, #e09a22); }
.wechat-sender-chip.role-admin { background: linear-gradient(135deg, #3fd18a, #1fae68); }
.wechat-sender-chip.role-member { background: linear-gradient(135deg, #9db3d6, #7f97be); }


.wbx-card { flex-shrink: 0; }
.wechat-chat-settings-content > .wechat-detail-card { flex-shrink: 0; }
.wbx-preview { border-radius: 14px; padding: 16px 12px; margin-bottom: 12px; background: linear-gradient(160deg, #cfd9e4, #eef2f6); display: flex; flex-direction: column; gap: 14px; }
.wbx-row { display: flex; align-items: center; gap: 8px; }
.wbx-row.is-me { justify-content: flex-end; }
.wbx-av { width: 32px; height: 32px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 16px; }
.wbx-av img { width: 100%; height: 100%; object-fit: cover; }
.wbx-bubble { position: relative; display: inline-block; max-width: 72%; padding: 8px 12px; border-radius: 8px; background: #fff; color: #222; font-size: 13.5px; line-height: 1.4; box-sizing: border-box; }
.wbx-bubble.is-me { background: #95ec69; }
.wbx-sides { display: flex; gap: 4px; background: #f0f0f0; border-radius: 10px; padding: 3px; margin-bottom: 10px; }
.wbx-sides .wechat-seg-btn { flex: 1; padding: 7px 4px; }
.wbx-label { font-size: 12px; color: #888; margin: 2px 0 8px; display: flex; align-items: center; gap: 6px; }
.wbx-chip { font-size: 10.5px; color: #07a050; background: rgba(7,193,96,.1); border-radius: 6px; padding: 1px 6px; }
.wbx-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto; padding: 4px 2px 6px; }
.wbx-tile { position: relative; border: 1.5px solid transparent; border-radius: 12px; padding: 0 0 6px; background: #f6f6f6; cursor: pointer; overflow: visible; -webkit-tap-highlight-color: transparent; }
.wbx-tile.active { border-color: #07c160; }
.wbx-tile-stage { display: flex; align-items: center; justify-content: center; height: 54px; border-radius: 10px 10px 0 0; background: #9e9e9e; padding: 0 8px; }
.wbx-tile-stage .wbx-bubble { font-size: 12px; padding: 6px 12px; max-width: 100%; }
.wbx-tile em { display: block; font-style: normal; font-size: 11px; color: #555; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
.wbx-del { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: #ff3b30; color: #fff; font-style: normal; font-size: 13px; line-height: 18px; text-align: center; z-index: 3; }
.wbx-colors { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 12px 0 10px; font-size: 13px; color: #444; }
.wbx-color { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; position: relative; }
.wbx-color input[type=color] { position: absolute; opacity: 0; width: 34px; height: 34px; left: 0; top: 0; cursor: pointer; }
.wbx-swatch { width: 30px; height: 30px; border-radius: 50%; border: 1px solid #ddd; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%); background-size: 10px 10px; background-position: 0 0, 5px 5px; }
.wbx-swatch.is-text { background: #fff; font-size: 14px; }
.wbx-font { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #444; }
.wbx-font select { padding: 6px 8px; border: 1px solid #e3e3e3; border-radius: 9px; background: #f7f7f7; font-size: 13px; color: #333; }
.wbx-mini { border: 0; background: #f0f0f0; border-radius: 8px; padding: 4px 8px; font-size: 11px; color: #666; cursor: pointer; }
.wbx-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.wbx-btn { border: 1px solid #e3e3e3; background: #f7f7f7; border-radius: 10px; padding: 8px 14px; font-size: 13px; color: #333; cursor: pointer; }
.wbx-btn.is-ghost { background: transparent; color: #999; }
.wbx-editor { max-width: 360px !important; }
.wbx-editor-input { display: block; width: 100%; box-sizing: border-box; min-height: 220px; margin-top: 12px; padding: 10px; border: 1px solid #e3e3e3; border-radius: 10px; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #fafafa; color: #333; resize: vertical; outline: none; white-space: pre-wrap; word-break: break-all; }

/* 语音条 + 转文字合并在同一个气泡里 */
.wechat-voice-message .wechat-voice-transcript-inner { margin-top: 7px; padding-top: 7px; border-top: 1px dashed rgba(0,0,0,.14); font-size: .95em; line-height: 1.45; word-break: break-word; }
.wechat-voice-message .voice-bubble-playable { min-height: 20px; }

/* 我贴的表情：米白底、深色字 */
.wechat-app .wechat-reaction-pill.is-mine { border-color: #ddd3c2 !important; background: #f4efe4 !important; color: #3b352c !important; }
.wechat-app .wechat-reaction-pill.is-mine .wechat-reaction-by { color: #4a4237 !important; }

.wbx-preset-row { display: flex; align-items: center; gap: 8px; margin: 2px 0 4px; }
.wbx-ctl-label { flex: 0 0 auto; font-size: 13px; color: #444; white-space: nowrap; }
.wbx-preset-select { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid #e3e3e3; border-radius: 10px; background: #f7f7f7; font-size: 14px; color: #333; }
.wbx-mini.is-danger { color: #e53935; background: #fdeeee; flex: 0 0 auto; }
.wbx-colors { flex-wrap: nowrap !important; gap: 10px !important; justify-content: space-between; }
.wbx-color, .wbx-font { white-space: nowrap; font-size: 12.5px !important; gap: 5px !important; flex: 0 0 auto; }
.wbx-swatch { position: relative; width: 26px !important; height: 26px !important; flex: 0 0 auto; }
.wbx-font select { padding: 5px 4px !important; font-size: 12.5px !important; }
/* 背景 / 文字 / 字号 / 字体 四个一排；按钮一排 */
.wbx-colors { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px !important; align-items: end; margin: 12px 0 10px !important; }
.wbx-colors.is-five { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px !important; }
.wbx-colors .wbx-color, .wbx-colors .wbx-font { display: flex !important; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px !important; min-width: 0; }
.wbx-colors b { font-weight: 400; font-size: 11.5px; color: #666; line-height: 1; }
.wbx-colors .wbx-swatch { width: 28px !important; height: 28px !important; }
.wbx-colors .wbx-color input[type=color] { left: 50%; transform: translateX(-50%); width: 30px; height: 30px; }
.wbx-colors .wbx-font select { width: 100%; height: 28px; box-sizing: border-box; padding: 0 2px !important; font-size: 12px !important; text-align: center; text-align-last: center; border-radius: 8px; }
.wbx-actions { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 6px !important; flex-wrap: nowrap !important; margin-top: 4px; }
.wbx-actions .wbx-btn { padding: 6px 4px !important; font-size: 12px !important; border-radius: 8px !important; white-space: nowrap; min-width: 0; }
.wbx-actions .wbx-btn.is-ghost { border-color: #ececec; }
/* 质感 / 预设 留出间距 */
.wbx-card .wbx-field { margin-top: 12px; }
.wbx-card .wbx-preset-row { margin: 10px 0 2px !important; }
/* 装饰图：紧凑版，一行四个角 + 一行链接/上传 */
.wbx-card .wbx-deco { margin-top: 10px; padding: 8px 10px; border-radius: 10px; }
.wbx-deco-top { display: flex; align-items: center; gap: 8px; }
.wbx-deco-tiles { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.wbx-deco-tile { height: 30px; border: 1px dashed #d6d6d6; background: #fff; border-radius: 8px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; cursor: pointer; overflow: hidden; -webkit-tap-highlight-color: transparent; }
.wbx-deco-tile.has-img { border-style: solid; border-color: #d9d9d9; }
.wbx-deco-tile.active { border: 1.5px solid #07c160; color: #07c160; background: #f2fbf6; }
.wbx-deco-tile img { max-width: 24px; max-height: 24px; object-fit: contain; }
.wbx-deco-edit { display: flex; align-items: center; gap: 6px; margin-top: 7px; }
.wbx-deco-edit input[type=text] { flex: 1; min-width: 0; height: 28px; box-sizing: border-box; border: 1px solid #e6e6e6 !important; border-radius: 8px; background: #fff !important; box-shadow: none !important; outline: none; font-size: 11.5px; padding: 0 8px !important; color: #333; }
.wbx-deco-edit .wbx-mini { flex: 0 0 auto; height: 28px; display: inline-flex; align-items: center; gap: 3px; padding: 0 8px; box-sizing: border-box; white-space: nowrap; }
.wbx-card .wbx-deco .wbx-deco-size { margin-top: 6px; }
.wbx-card .wbx-deco .wbx-range-val, .wbx-card .wbx-range-val { font-size: 11px; }
.wbx-card .wbx-switch-row { margin-top: 10px; font-size: 12.5px; }
.wbx-card .wbx-switch-row small { font-size: 10px; }
/* 聊天设置卡片：长按拖动排序 */
.wechat-chat-settings-content .wechat-detail-card.is-sortable { transition: box-shadow .18s ease, transform .18s ease; -webkit-touch-callout: none; }
.wechat-chat-settings-content .wechat-detail-card.is-sortable > .wechat-detail-heading { user-select: none; -webkit-user-select: none; }
.wechat-chat-settings-content .wechat-detail-card.is-drag-armed { transform: scale(1.015); box-shadow: 0 10px 28px rgba(0,0,0,.18) !important; position: relative; z-index: 5; }
.wechat-chat-settings-content.is-sorting { user-select: none; -webkit-user-select: none; }
.wechat-chat-settings-content.is-sorting .wechat-detail-card:not(.is-drag-armed) { opacity: .82; }
.wechat-settings-sort-hint { text-align: center; font-size: 11px; color: #9a9a9a; margin: 4px 0 14px; }
.wbx-clear { position: absolute; top: -5px; right: -5px; width: 14px; height: 14px; border-radius: 50%; background: #8e8e93; color: #fff; font-style: normal; font-size: 10px; line-height: 14px; text-align: center; font-weight: 400; z-index: 2; }

.wechat-detail-heading.is-toggle { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.wechat-detail-toggle { margin-left: auto; width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%; border: 0; padding: 0; background: rgba(0,0,0,.05); color: #8e8e93; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.wechat-detail-toggle-icon { font-size: 11px; transition: transform .2s ease; transform: rotate(180deg); }
.wechat-detail-card.is-collapsed .wechat-detail-toggle-icon { transform: rotate(0deg); }
.wechat-detail-card.is-collapsed { padding-bottom: 12px !important; }
.wechat-detail-card.is-collapsed > .wechat-detail-heading { margin-bottom: 0; }
.wechat-detail-card.is-collapsed > .wechat-detail-body { display: none; }

/* ========== 💬 聊天列表 v2：搜索 + Mind + 筛选 ========== */
.wcl-v2 { background: #fff; }
.wcl-search { display: flex; align-items: center; gap: 6px; margin: 8px 12px 2px; padding: 0 12px; height: 32px; border-radius: 10px; background: rgba(118,118,128,.10); border: 0; color: #9aa0a6; font-size: 12px; }
.wcl-search input { flex: 1; min-width: 0; height: 100%; border: 0 !important; box-shadow: none !important; outline: none; background: transparent !important; padding: 0 !important; font-size: 12.5px; color: #222; }
#phone-panel-content .wechat-app .wcl-v2 .wcl-search input#wcl-search-input, .wechat-app .wcl-v2 .wcl-search input#wcl-search-input { -webkit-appearance: none !important; appearance: none !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: transparent !important; margin: 0 !important; padding: 0 !important; height: 100% !important; min-height: 0 !important; outline: none !important; }
.wcl-search:focus-within { background: rgba(118,118,128,.14); }
.wcl-search-clear { border: 0; background: #c9ccd1; color: #fff; width: 16px; height: 16px; border-radius: 50%; font-size: 9px; line-height: 16px; padding: 0; cursor: pointer; }
.wcl-search-clear[hidden] { display: none; }
.mind-row { display: flex; gap: 4px; overflow-x: auto; padding: 6px 12px 2px; scrollbar-width: none; }
.mind-row::-webkit-scrollbar { display: none; }
.mind-cell { flex: 0 0 auto; width: 64px; display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; background: transparent; padding: 0; cursor: pointer; }
.mind-bubble { position: relative; max-width: 64px; min-height: 20px; box-sizing: border-box; padding: 3px 7px; border-radius: 11px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.10); font-size: 10px; color: #333; line-height: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mind-bubble::after { content: ''; position: absolute; left: 14px; bottom: -4px; width: 6px; height: 6px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.mind-bubble.is-empty { color: #8a8f98; }
.mind-av { position: relative; width: 44px; height: 44px; border-radius: 50%; overflow: visible; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 24px; }
.mind-av > img, .mind-av > span, .mind-av > div { width: 44px !important; height: 44px !important; border-radius: 50% !important; overflow: hidden; object-fit: cover; }
.mind-plus { position: absolute; right: -2px; bottom: -2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; color: #666; font-style: normal; font-size: 13px; line-height: 17px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.mind-name { max-width: 62px; font-size: 10px; color: #8a8f98; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wcl-section { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px 4px; }
.wcl-title { font-size: 13.5px; font-weight: 700; color: #222; }
.wcl-filter { display: flex; gap: 2px; background: #f2f3f5; border-radius: 12px; padding: 2px; }
.wcl-filter button { border: 0; background: transparent; padding: 2px 8px; border-radius: 11px; font-size: 11px; line-height: 16px; color: #777; cursor: pointer; }
.wcl-filter button small { font-size: 9px; color: #aaa; }
.wcl-filter button.is-on { background: #fff; color: #111; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.wcl-filter button.is-on small { color: #07c160; }
.wcl-v2 .chat-item { position: relative; padding: 7px 14px; border-bottom: 0; background: transparent; }
.wcl-v2 .chat-item::after { content: ''; position: absolute; left: 66px; right: 0; bottom: 0; height: 0.5px; background: #ececec; }
.wcl-v2 .chat-item[hidden] { display: none; }
.wcl-v2 .chat-item.is-pinned { background: #eef4ff; }
.wcl-v2 .chat-avatar { position: relative; width: 42px; height: 42px; margin-right: 10px; border: 0; box-shadow: none; overflow: visible; }
.wcl-v2 .chat-avatar > img, .wcl-v2 .chat-avatar > span:not(.chat-badge), .wcl-v2 .chat-avatar > div { width: 42px !important; height: 42px !important; border-radius: 50% !important; overflow: hidden; object-fit: cover; }
.wcl-v2 .chat-avatar .chat-badge { position: absolute; top: -3px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 8px; background: #fa5151; color: #fff; font-size: 10px; line-height: 16px; text-align: center; z-index: 2; }
.wcl-v2 .chat-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.wcl-v2 .chat-name { flex: 1; min-width: 0; margin: 0; font-size: 13.5px; font-weight: 600; color: #1d1f23; line-height: 1.35; }
.wcl-v2 .chat-time { flex: 0 0 auto; font-size: 10px; color: #a7abb2; }
.wcl-v2 .chat-last-msg { font-size: 11.5px; color: #8f939a; line-height: 1.35; }
.wcl-v2 .chat-last-msg mark { background: transparent; color: #07c160; font-weight: 600; }
.wcl-noresult { text-align: center; color: #aaa; font-size: 12px; padding: 30px 0; }
.wcl-noresult[hidden] { display: none; }
.wcl-empty { padding: 40px 0; text-align: center; color: #bbb; }
.wcl-empty i { font-size: 36px; color: #ddd; }
.wechat-app.wechat-chatlist-bg-enabled .wcl-v2 { background: transparent; }
.wechat-app.wechat-chatlist-bg-enabled .wcl-v2 .chat-item { background: var(--wechat-glass-bg); }
.wechat-app.wechat-chatlist-bg-enabled .wcl-v2 .chat-item.is-pinned { background: linear-gradient(rgba(61,139,255,.12), rgba(61,139,255,.12)), var(--wechat-glass-bg-strong); }
/* Mind 弹层 */
.mind-mask { position: absolute; inset: 0; z-index: 450; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; animation: momentMaskIn .16s ease; }
.mind-mask.is-bottom { align-items: flex-end; }
.mind-mask.is-full { background: #fff; align-items: stretch; }
.mind-mask.is-status { background: linear-gradient(160deg, #b9a0b0 0%, #9f97b8 100%); }
.mind-sheet { width: 100%; background: #fff; border-radius: 18px 18px 0 0; padding: 18px 16px 22px; box-sizing: border-box; }
.mind-sheet-head { display: flex; gap: 12px; margin-bottom: 16px; }
.mind-sheet-av { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f0f0f0; }
.mind-sheet-av img { width: 100%; height: 100%; object-fit: cover; }
.mind-sheet-main { flex: 1; min-width: 0; font-size: 13px; color: #222; }
.mind-sheet-main small { color: #999; font-weight: 400; }
.mind-sheet-text { margin-top: 4px; font-size: 14px; color: #333; word-break: break-word; }
.mind-sheet-img { margin-top: 6px; max-width: 120px; max-height: 120px; border-radius: 8px; object-fit: cover; }
.mind-btn-primary { width: 100%; height: 44px; border: 0; border-radius: 22px; background: #1677ff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
.mind-btn-link { width: 100%; height: 40px; margin-top: 6px; border: 0; background: transparent; color: #1677ff; font-size: 14px; cursor: pointer; }
.mind-reply-box { display: flex; gap: 8px; }
.mind-reply-box input { flex: 1; min-width: 0; height: 38px; border: 1px solid #e5e5e5; border-radius: 19px; padding: 0 14px; font-size: 13.5px; outline: none; }
.mind-reply-box button { height: 38px; padding: 0 16px; border: 0; border-radius: 19px; background: #07c160; color: #fff; font-size: 13.5px; cursor: pointer; }
.mind-editor { position: relative; width: 100%; height: 100%; overflow-y: auto; }
.mind-close { position: absolute; top: 44px; left: 14px; border: 0; background: transparent; font-size: 20px; color: #222; cursor: pointer; z-index: 2; }
.mind-editor-body { display: flex; flex-direction: column; align-items: center; padding: 110px 22px 30px; gap: 12px; }
.mind-edit-bubble { position: relative; width: 100%; max-width: 280px; background: #fff; border-radius: 22px; box-shadow: 0 4px 20px rgba(0,0,0,.09); padding: 12px 16px; box-sizing: border-box; text-align: center; }
.mind-edit-bubble::after { content: ''; position: absolute; left: 34%; bottom: -10px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.mind-edit-bubble textarea { width: 100%; border: 0; outline: none; resize: none; text-align: center; font-size: 15px; color: #111; background: transparent; font-family: inherit; }
.mind-status-chip { border: 0; background: #f2f3f5; color: #555; font-size: 12px; padding: 3px 10px; border-radius: 12px; margin-bottom: 4px; cursor: pointer; }
.mind-status-chip.is-empty { color: #999; }
.mind-edit-img { position: relative; display: inline-block; }
.mind-edit-img img { max-width: 120px; max-height: 120px; border-radius: 10px; object-fit: cover; margin-top: 4px; }
.mind-edit-img button { position: absolute; top: 0; right: -6px; width: 18px; height: 18px; border-radius: 50%; border: 0; background: rgba(0,0,0,.5); color: #fff; font-size: 10px; cursor: pointer; }
.mind-edit-av { width: 92px; height: 92px; border-radius: 50%; overflow: hidden; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 40px; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
.mind-edit-av img { width: 100%; height: 100%; object-fit: cover; }
.mind-edit-bubble textarea { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 4px 0 !important; }
.mind-vis-row select { border: 0 !important; box-shadow: none !important; background: #f2f3f5 !important; }
.mind-emoji-panel { width: 100%; max-width: 320px; max-height: 230px; overflow-y: auto; border-radius: 14px; background: #f7f7f8; padding: 4px 6px; box-sizing: border-box; }
.mind-emo-group + .mind-emo-group { border-top: 1px solid #ececee; }
.mind-emo-head { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; background: transparent; padding: 7px 4px; font-size: 12px; color: #777; cursor: pointer; }
.mind-emo-head i { font-style: normal; transition: transform .2s; }
.mind-emo-group.is-folded .mind-emo-head i { transform: rotate(-90deg); }
.mind-emo-group.is-folded .mind-emo-grid { display: none; }
.mind-emo-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding-bottom: 6px; }
.mind-emo-grid button { border: 0; background: transparent; height: 32px; font-size: 19px; border-radius: 6px; cursor: pointer; padding: 0; }
.mind-emo-grid button:active { background: #e8e8ea; }
.mind-emo-grid.is-kaomoji { grid-template-columns: repeat(2, 1fr); }
.mind-emo-grid.is-kaomoji button { font-size: 12px; height: 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #444; background: #fff; }
.mind-emo-grid.is-sticker { grid-template-columns: repeat(5, 1fr); }
.mind-emo-grid.is-sticker button { height: 50px; }
.mind-emo-grid.is-sticker img { max-width: 44px; max-height: 44px; object-fit: contain; }
.mind-emoji-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 300px; }
.mind-emoji-row button { border: 0; background: #f6f6f7; width: 30px; height: 30px; border-radius: 8px; font-size: 16px; cursor: pointer; }
.mind-tools { display: flex; gap: 10px; }
.mind-tool { display: inline-flex; align-items: center; gap: 4px; border: 0; background: #f2f3f5; color: #444; padding: 6px 12px; border-radius: 14px; font-size: 12.5px; cursor: pointer; }
.mind-vis-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; max-width: 280px; margin-top: 6px; }
.mind-vis-row select { flex: 1; min-width: 0; height: 34px; border: 0; border-radius: 17px; background: #f2f3f5; padding: 0 12px; font-size: 13px; color: #555; }
.mind-share { flex: 0 0 auto; white-space: nowrap; word-break: keep-all; height: 34px; padding: 0 22px; border: 0; border-radius: 17px; background: #dbe9ff; color: #1677ff; font-size: 14px; font-weight: 600; cursor: pointer; }
.mind-vis-people { display: flex; flex-wrap: wrap; gap: 6px; max-width: 300px; justify-content: center; }
.mind-vis-people[hidden] { display: none; }
.mind-person { border: 1px solid #e5e5e5; background: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; color: #555; cursor: pointer; }
.mind-person.is-on { border-color: #1677ff; background: #eef4ff; color: #1677ff; }
.mind-tip { font-size: 11px; color: #b0b0b0; }
.mind-status-page { width: 100%; height: 100%; overflow-y: auto; padding: 40px 14px 24px; box-sizing: border-box; color: #fff; }
.mind-status-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.mind-status-head button { border: 0; background: transparent; color: #fff; font-size: 14px; cursor: pointer; }
.mind-status-head div { text-align: center; }
.mind-status-head b { display: block; font-size: 16px; }
.mind-status-head small { font-size: 11px; opacity: .7; }
.mind-status-group { background: rgba(255,255,255,.14); border-radius: 14px; padding: 10px 6px 4px; margin-bottom: 10px; }
.mind-status-title { font-size: 12px; opacity: .65; padding: 0 8px 6px; }
.mind-status-grid { display: grid; grid-template-columns: repeat(5, 1fr); }
.mind-status-item { border: 0; background: transparent; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-radius: 10px; cursor: pointer; }
.mind-status-item span { font-size: 22px; }
.mind-status-item em { font-style: normal; font-size: 11px; }
.mind-status-item.is-on { background: rgba(255,255,255,.25); }
/* ☁️ 便签云朵页 */
.mind-mask.is-cloud { background: radial-gradient(circle at 20% 15%, #fde7f3 0%, transparent 45%), radial-gradient(circle at 85% 30%, #e3ecff 0%, transparent 50%), radial-gradient(circle at 50% 90%, #efe4ff 0%, transparent 55%), linear-gradient(180deg, #fbf8ff 0%, #f3f0fb 100%); }
.mind-mask.is-top { z-index: 460; }
.mind-cloud-page { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; overflow-y: auto; }
.mind-cloud-close { position: absolute; top: 44px; left: 16px; border: 0; background: rgba(255,255,255,.7); width: 32px; height: 32px; border-radius: 50%; font-size: 15px; color: #555; cursor: pointer; z-index: 3; box-shadow: 0 2px 8px rgba(120,100,180,.15); }
.mind-sparkles i { position: absolute; font-style: normal; color: #c9b8f0; animation: mindTwinkle 3s ease-in-out infinite; pointer-events: none; }
.mind-sparkles i:nth-child(1) { top: 16%; left: 14%; font-size: 14px; }
.mind-sparkles i:nth-child(2) { top: 22%; right: 16%; font-size: 18px; animation-delay: .6s; color: #f3b5d3; }
.mind-sparkles i:nth-child(3) { top: 58%; left: 10%; font-size: 16px; animation-delay: 1.2s; }
.mind-sparkles i:nth-child(4) { top: 64%; right: 12%; font-size: 12px; animation-delay: 1.8s; color: #a9c5f5; }
.mind-sparkles i:nth-child(5) { top: 82%; left: 46%; font-size: 14px; animation-delay: 2.2s; color: #f3b5d3; }
@keyframes mindTwinkle { 0%, 100% { opacity: .3; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
.mind-cloud-stage { position: relative; width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; padding: 120px 20px 20px; box-sizing: border-box; }
.mind-cloud { position: relative; min-width: 150px; max-width: 250px; padding: 18px 26px; background: #fff; border-radius: 48px; box-shadow: 0 10px 30px rgba(150,120,210,.18), inset 0 -4px 10px rgba(200,190,240,.18); text-align: center; animation: mindFloat 4s ease-in-out infinite; z-index: 1; }
.mind-cloud::before, .mind-cloud::after { content: ''; position: absolute; background: #fff; border-radius: 50%; z-index: -1; }
.mind-cloud::before { width: 70px; height: 70px; top: -26px; left: 22%; box-shadow: 46px 6px 0 -8px #fff; }
.mind-cloud::after { width: 46px; height: 46px; top: -12px; right: 14%; }
.mind-cloud-status { display: inline-block; margin-bottom: 6px; padding: 2px 10px; border-radius: 10px; background: #f4efff; color: #7a63b8; font-size: 12px; }
.mind-cloud-text { font-size: 16px; line-height: 1.5; color: #333; word-break: break-word; }
.mind-cloud-img { margin-top: 8px; max-width: 120px; max-height: 120px; border-radius: 12px; object-fit: cover; }
.mind-cloud-reacts { margin-top: 6px; display: flex; justify-content: center; gap: 4px; font-size: 16px; }
.mind-cloud-dot { position: relative; display: block; background: #fff; border-radius: 50%; box-shadow: 0 4px 10px rgba(150,120,210,.15); animation: mindFloat 4s ease-in-out infinite; }
.mind-cloud-dot.d1 { width: 16px; height: 16px; margin: 10px 0 0 -40px; animation-delay: .3s; }
.mind-cloud-dot.d2 { width: 9px; height: 9px; margin: 4px 0 0 -58px; animation-delay: .6s; }
@keyframes mindFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.mind-cloud-av { width: 96px; height: 96px; margin-top: 8px; border-radius: 50%; overflow: hidden; border: 4px solid #fff; box-shadow: 0 6px 18px rgba(150,120,210,.25); display: flex; align-items: center; justify-content: center; background: #f2eefc; font-size: 40px; }
.mind-cloud-av img { width: 100%; height: 100%; object-fit: cover; }
.mind-cloud-name { margin-top: 10px; font-size: 15px; font-weight: 700; color: #3d3555; }
.mind-cloud-meta { font-size: 11px; color: #9a92b4; margin-top: 2px; }
.mind-float-btns { display: flex; justify-content: center; gap: 10px; margin-top: 20px; flex-wrap: nowrap; width: 100%; }
.mind-float-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: transparent; cursor: pointer; animation: mindFloat 3.6s ease-in-out infinite; }
.mind-float-btn.f1 { animation-delay: .5s; } .mind-float-btn.f2 { animation-delay: 1s; } .mind-float-btn.f3 { animation-delay: 1.5s; }
.mind-float-btn span { width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 6px 16px rgba(150,120,210,.2); display: flex; align-items: center; justify-content: center; font-size: 17px; }
.mind-float-btn em { font-style: normal; font-size: 10.5px; color: #6f6690; white-space: nowrap; }
.mind-float-btn { flex: 0 0 auto; padding: 0; }
.mind-float-btn:active span { transform: scale(.92); }
.mind-cloud-extra { width: 100%; max-width: 320px; padding: 0 20px 30px; box-sizing: border-box; }
.mind-react-picker { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; background: rgba(255,255,255,.85); border-radius: 18px; padding: 10px; box-shadow: 0 6px 16px rgba(150,120,210,.15); }
.mind-react-picker button { border: 0; background: transparent; height: 36px; font-size: 21px; border-radius: 10px; cursor: pointer; }
.mind-react-picker button.is-on { background: #efe8ff; }
.mind-cloud-extra .mind-reply-box input { background: rgba(255,255,255,.92); }
.mind-share-sheet { width: 100%; max-height: 80%; background: #fff; border-radius: 18px 18px 0 0; padding: 14px 16px 18px; box-sizing: border-box; display: flex; flex-direction: column; }
.mind-share-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mind-share-head button { border: 0; background: #f2f2f2; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; }
.mind-share-preview { padding: 8px 12px; margin-bottom: 8px; background: #f6f2ff; border-radius: 14px; font-size: 13px; color: #5c4f86; }
.mind-share-list { flex: 1; min-height: 120px; max-height: 300px; overflow-y: auto; margin-bottom: 10px; }
.mind-share-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 4px; border: 0; background: none; cursor: pointer; text-align: left; }
.mind-share-av { width: 34px; height: 34px; border-radius: 50%; overflow: hidden; flex: 0 0 34px; display: flex; align-items: center; justify-content: center; background: #eee; }
.mind-share-av img { width: 100%; height: 100%; object-fit: cover; }
.mind-share-name { flex: 1; font-size: 14px; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mind-share-check { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #ccc; color: transparent; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.mind-share-row.is-on .mind-share-check { background: #07c160; border-color: #07c160; color: #fff; }
.mind-btn-primary:disabled { background: #e5e5e5; color: #aaa; }
.message-mind-share { width: 200px; max-width: 100%; background: linear-gradient(160deg, #fbf8ff, #f1ecff); border: 1px solid #e8e0fb; border-radius: 14px; padding: 10px 12px; box-sizing: border-box; }
.message-mind-share .mms-head { font-size: 11.5px; color: #7a63b8; margin-bottom: 6px; }
.message-mind-share .mms-cloud { background: #fff; border-radius: 18px; padding: 8px 12px; font-size: 13px; color: #333; box-shadow: 0 2px 8px rgba(150,120,210,.12); word-break: break-word; }
.message-mind-share .mmr-img { max-width: 120px; max-height: 120px; border-radius: 10px; object-fit: cover; margin-top: 6px; }
.message-mind-share .mms-foot { margin-top: 6px; font-size: 10px; color: #a79fc4; }
/* 🫧 气泡设置：质感 / 圆角 / 装饰 / 连续气泡 */
.wce-field { padding: 10px 0; border-bottom: 1px solid #e9e9e9; }
.wce-field:last-child { border-bottom: 0; }
.wce-label { font-size: 13px; margin-bottom: 7px; }
.wce-label small { display: block; margin-top: 3px; color: #8b8b8b; font-size: 10px; line-height: 1.5; }
.wce-label b { font-weight: 600; color: #576b95; margin-left: 4px; }
.wce-textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 8px 10px; border: 1px solid #ececec; border-radius: 10px; background: rgba(255,255,255,.9); font-size: 12.5px; line-height: 1.5; color: #222; resize: vertical; font-family: inherit; outline: none; }
.wce-textarea:focus, .wce-voice input:focus, .wce-input:focus { border-color: #9cc3f5; }
.wce-input { width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; border: 1px solid #ececec; border-radius: 9px; background: rgba(255,255,255,.9); font-size: 12.5px; color: #222; outline: none; }
.wx-myvoice-item .function-arrow i { transition: transform .2s; }
.wx-myvoice-item.is-open .function-arrow i { transform: rotate(90deg); }
.wx-myvoice-panel { display: none; margin: -4px 12px 10px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.72); border: 1px solid rgba(0,0,0,.05); }
.wx-myvoice-panel.is-open { display: block; }
.wx-myvoice-panel .wce-label { font-size: 12.5px; color: #333; font-weight: 600; margin-bottom: 6px; }
.wx-myvoice-panel .wce-label small { display: block; font-weight: 400; color: #999; font-size: 11px; margin-top: 2px; line-height: 1.45; }
.wx-myvoice-panel .wce-field { margin-bottom: 10px; }
.wx-myvoice-panel select.wce-input { appearance: auto; }
.wx-myvoice-panel .wce-voice { display: block; margin-bottom: 8px; }
.wx-myvoice-panel .wce-voice > span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #777; margin-bottom: 4px; }
.wx-myvoice-panel .wce-voice > span i { font-style: normal; font-size: 10px; color: #fff; background: #07c160; border-radius: 6px; padding: 0 5px; }
.wx-myvoice-panel .wce-voice.is-on input { border-color: #9be3bd; background: #f3fff8; }
.wce-voice-now { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; padding: 10px 12px; margin: 0 0 6px; border-radius: 12px; background: linear-gradient(135deg, rgba(91,141,239,.10), rgba(161,140,209,.12)); font-size: 12px; color: #555; }
.wce-voice-now b { font-size: 13px; color: #222; }
.wce-voice-now em { font-style: normal; color: #4a7bd8; word-break: break-all; }
.wce-voices { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 4px; }
.wce-voice { display: flex; flex-direction: column; gap: 4px; }
.wce-voice > span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #666; }
.wce-voice > span i { font-style: normal; font-size: 10px; color: #fff; background: #07c160; border-radius: 6px; padding: 0 5px; }
.wce-voice input { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border: 1px solid #ececec; border-radius: 9px; background: rgba(255,255,255,.9); font-size: 12.5px; color: #222; outline: none; }
.wce-voice.is-on input { border-color: rgba(7,193,96,.5); background: #f6fffa; }
.wce-hint { font-size: 10.5px; color: #8b8b8b; line-height: 1.5; padding: 6px 0 2px; }
.wce-ref { display: flex; gap: 12px; align-items: center; padding: 4px 0 10px; border-bottom: 1px solid #e9e9e9; }
.wce-ref-preview { flex: 0 0 68px; width: 68px; height: 68px; border-radius: 12px; border: 1px dashed #d6d6d6; background: #f6f6f6 center / cover no-repeat; color: #aaa; font-size: 20px; cursor: pointer; }
.wce-ref-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.wce-ref-btns { display: flex; gap: 8px; }
.wce-btn { border: 0; background: #f0f0f0; color: #333; border-radius: 9px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
.wce-btn.is-danger { background: #fff1f0; color: #d93025; }
.wce-btn:disabled { opacity: .45; cursor: default; }
.wce-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555; }
.wce-range { width: 100%; }
.wbx-field { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.wbx-seg { flex: 1; display: flex; gap: 3px; background: #f2f3f5; border-radius: 10px; padding: 2px; }
.wbx-seg-btn { flex: 1; border: 0; background: transparent; padding: 5px 0; border-radius: 8px; font-size: 11.5px; color: #666; cursor: pointer; white-space: nowrap; }
.wbx-seg-btn.active { background: #fff; color: #111; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.wbx-preset-row[hidden] { display: none !important; }
.wbx-range { flex: 1; min-width: 0; accent-color: #07c160; }
.wbx-range-val { font-style: normal; font-size: 11px; color: #888; min-width: 34px; text-align: right; }
.wbx-mini { border: 1px solid #e3e3e3; background: #fff; border-radius: 8px; padding: 3px 8px; font-size: 11px; color: #666; cursor: pointer; }
.wbx-deco { margin-top: 12px; padding: 10px; border-radius: 12px; background: #f7f7f8; }
.wbx-deco-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
.wbx-deco-head small { font-size: 10.5px; color: #aaa; }
.wbx-deco-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.wbx-deco-slot { display: flex; align-items: center; gap: 6px; background: #fff; border: 1px dashed #ddd; border-radius: 10px; padding: 4px 6px; min-width: 0; }
.wbx-deco-slot.has-img { border-style: solid; border-color: #c9e8d6; }
.wbx-deco-thumb { flex: 0 0 26px; width: 26px; height: 26px; border-radius: 6px; background: #f2f2f2; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #aaa; overflow: hidden; }
.wbx-deco-thumb img { width: 100%; height: 100%; object-fit: contain; }
.wbx-deco-slot input { flex: 1; min-width: 0; border: 0 !important; outline: none; background: transparent !important; box-shadow: none !important; font-size: 11px; padding: 4px 0 !important; color: #333; }
.wbx-deco .wbx-field { margin-top: 8px; }
.wbx-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; font-size: 13px; color: #222; }
.wbx-switch-row small { display: block; font-size: 10.5px; color: #999; margin-top: 2px; }
/* 连续气泡 */
.chat-messages.wbx-continuous .chat-message.is-cont { margin-top: -10px !important; }
.chat-messages.wbx-continuous .chat-message.is-cont .message-avatar { visibility: hidden; }
.chat-messages.wbx-continuous .chat-message.is-cont .message-sender { display: none !important; }
.chat-messages.wbx-continuous .chat-message.has-next .wechat-reaction-row:empty { display: none; }
/* 群资料头部：点头像换图、点群名改名 */
.wechat-group-hero-avatar.is-editable { position: relative; cursor: pointer; overflow: visible !important; }
.wechat-group-hero-avatar.is-editable > img, .wechat-group-hero-avatar.is-editable > span:not(.wechat-group-hero-cam), .wechat-group-hero-avatar.is-editable > div { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; object-fit: cover; }
.wechat-group-hero-cam { position: absolute; right: -2px; bottom: -2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; color: #6b7a90; font-size: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
.wechat-group-hero-name.is-editable { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.wechat-group-hero-name.is-editable i { font-size: 11px; color: #b0b0b0; }
/* 🔄 重新生成选择 */
.wechat-regen-mask { position: absolute; inset: 0; z-index: 480; background: rgba(0,0,0,.35); display: flex; align-items: flex-end; animation: momentMaskIn .16s ease; }
.wechat-regen-sheet { width: 100%; background: #fff; border-radius: 18px 18px 0 0; padding: 16px 14px 18px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; }
.wechat-regen-title { font-size: 14px; font-weight: 700; color: #222; text-align: center; margin-bottom: 4px; }
.wechat-regen-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 11px 14px; border: 1px solid #eee; border-radius: 12px; background: #fafafa; cursor: pointer; text-align: left; }
.wechat-regen-opt b { font-size: 14px; color: #222; font-weight: 600; }
.wechat-regen-opt small { font-size: 11.5px; color: #999; }
.wechat-regen-guide[hidden] { display: none; }
.wechat-regen-guide { display: flex; flex-direction: column; gap: 8px; }
.wechat-regen-guide textarea { width: 100%; box-sizing: border-box; border: 1px solid #e3e3e3 !important; border-radius: 10px !important; padding: 8px 10px !important; font-size: 13px; resize: none; outline: none; font-family: inherit; background: #fff !important; }
.wechat-regen-go { height: 38px; border: 0; border-radius: 10px; background: #07c160; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.wechat-regen-cancel { height: 38px; border: 0; background: transparent; color: #888; font-size: 14px; cursor: pointer; }
/* 🎨 便签主题色 */
.mind-theme-lavender { --mt1: #fbf8ff; --mt2: #efe7ff; --mtb: #e3d8fb; --mta: #7a63b8; --mtp1: #fde7f3; --mtp2: #e3ecff; --mtp3: #efe4ff; --mtbase1: #fbf8ff; --mtbase2: #f3f0fb; }
.mind-theme-sky { --mt1: #f5fbff; --mt2: #e1f0ff; --mtb: #cbe2fa; --mta: #4b82c3; --mtp1: #dff0ff; --mtp2: #e9f6ff; --mtp3: #d6e9ff; --mtbase1: #f6fbff; --mtbase2: #eaf3fd; }
.mind-theme-lemon { --mt1: #fffdf3; --mt2: #fff2c4; --mtb: #f3e0a0; --mta: #a07a14; --mtp1: #fff3c9; --mtp2: #fff9e0; --mtp3: #ffeec0; --mtbase1: #fffdf6; --mtbase2: #fff7e2; }
.mind-theme-mint { --mt1: #f5fff9; --mt2: #dcf5e8; --mtb: #bfe6d1; --mta: #3a9466; --mtp1: #d9f6e8; --mtp2: #e8fbf2; --mtp3: #cff0df; --mtbase1: #f7fffb; --mtbase2: #ebf9f2; }
.mind-theme-peach { --mt1: #fff7f9; --mt2: #ffe3ea; --mtb: #f8cad5; --mta: #c25775; --mtp1: #ffe0ea; --mtp2: #ffeef3; --mtp3: #fddbe6; --mtbase1: #fff9fb; --mtbase2: #fff0f4; }
.mind-mask.is-cloud[class*="mind-theme-"] { background: radial-gradient(circle at 20% 15%, var(--mtp1) 0%, transparent 45%), radial-gradient(circle at 85% 30%, var(--mtp2) 0%, transparent 50%), radial-gradient(circle at 50% 90%, var(--mtp3) 0%, transparent 55%), linear-gradient(180deg, var(--mtbase1) 0%, var(--mtbase2) 100%); }
[class*="mind-theme-"] .mind-cloud { background: linear-gradient(170deg, #ffffff 30%, var(--mt2) 100%); }
[class*="mind-theme-"] .mind-cloud::before, [class*="mind-theme-"] .mind-cloud::after { background: #fff; }
[class*="mind-theme-"] .mind-cloud-status { background: var(--mt2); color: var(--mta); }
[class*="mind-theme-"] .mind-cloud-name { color: var(--mta); }
.mind-theme-bubbles { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.mind-theme-bubble { position: absolute; pointer-events: auto; border: 2px solid rgba(255,255,255,.9); border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff 0 18%, var(--tb) 60%); box-shadow: 0 4px 12px rgba(0,0,0,.08); cursor: pointer; animation: mindFloat 4.2s ease-in-out infinite; padding: 0; }
.mind-theme-bubble.is-on { box-shadow: 0 0 0 3px rgba(255,255,255,.95), 0 0 0 5px var(--tb); }
.mind-theme-bubble.b0 { width: 34px; height: 34px; top: 14%; right: 9%; }
.mind-theme-bubble.b1 { width: 26px; height: 26px; top: 30%; left: 7%; animation-delay: .7s; }
.mind-theme-bubble.b2 { width: 30px; height: 30px; top: 46%; right: 6%; animation-delay: 1.4s; }
.mind-theme-bubble.b3 { width: 24px; height: 24px; top: 54%; left: 10%; animation-delay: 2.1s; }
.mind-theme-bubble.b4 { width: 28px; height: 28px; top: 9%; left: 30%; animation-delay: 2.8s; }
.mind-editor[class*="mind-theme-"] { background: linear-gradient(180deg, var(--mtbase1), var(--mtbase2)); }
.mind-editor[class*="mind-theme-"] .mind-edit-bubble { background: linear-gradient(170deg, #fff 35%, var(--mt2) 100%); }
.mind-theme-row { display: flex; gap: 10px; justify-content: center; }
.mind-theme-dot { display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; background: transparent; cursor: pointer; padding: 0; }
.mind-theme-dot span { width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff 0 18%, var(--tb) 65%); border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.1); }
.mind-theme-dot em { font-style: normal; font-size: 10px; color: #999; }
.mind-theme-dot.is-on span { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--tb); }
.mind-theme-dot.is-on em { color: #555; font-weight: 600; }
.mind-bubble[class*="mind-theme-"]:not(.is-empty) { background: linear-gradient(170deg, #fff 30%, var(--mt2) 100%); color: var(--mta); }
.message-mind-share[class*="mind-theme-"] { background: linear-gradient(160deg, var(--mt1), var(--mt2)); border-color: var(--mtb); }
.message-mind-share[class*="mind-theme-"] .mms-head { color: var(--mta); }
.message-mind-share .mms-img { display: block; max-width: 110px !important; max-height: 110px !important; width: auto !important; height: auto !important; }
.message-mind-reply[class*="mind-theme-"] .mmr-cloud { background: linear-gradient(160deg, #fff, var(--mt2)); border-color: var(--mtb); color: var(--mta); }
.message-mind-reply[class*="mind-theme-"] .mmr-status { background: var(--mt2); color: var(--mta); }
.message-mind-reply[class*="mind-theme-"] .mmr-dot { border-color: var(--mtb); }
.message-mind-reply .mmr-thumb { width: 56px !important; height: 56px !important; max-width: 56px !important; }
/* 💭 角色回复便签：标签 + 云朵引用 + 回复气泡，一整条 */
.message-mind-reply { display: flex; flex-direction: column; gap: 3px; max-width: 240px; }
.message-mind-reply .mmr-label { font-size: 10.5px; color: #8e8aa8; padding-left: 4px; }
.message-mind-reply.is-mine .mmr-label { text-align: right; padding-right: 4px; }
.message-mind-reply .mmr-quote { position: relative; align-self: flex-start; margin-left: 6px; padding-bottom: 12px; }
.message-mind-reply.is-mine .mmr-quote { align-self: flex-end; margin-right: 6px; margin-left: 0; }
.message-mind-reply .mmr-cloud { position: relative; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 3px; max-width: 190px; padding: 7px 12px; background: linear-gradient(160deg, #ffffff, #f5f0ff); border: 1px solid #ebe3ff; border-radius: 18px; box-shadow: 0 3px 10px rgba(140,110,210,.14); font-size: 12px; color: #4b4366; }
.message-mind-reply .mmr-status { font-size: 10.5px; color: #7a63b8; background: #f1ebff; padding: 0 7px; border-radius: 8px; }
.message-mind-reply .mmr-note { line-height: 1.4; word-break: break-word; }
.message-mind-reply .mmr-thumb { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; }
.message-mind-reply .mmr-dot { position: absolute; background: #fff; border: 1px solid #ebe3ff; border-radius: 50%; }
.message-mind-reply .mmr-dot.d1 { width: 9px; height: 9px; left: 14px; bottom: 2px; }
.message-mind-reply .mmr-dot.d2 { width: 5px; height: 5px; left: 8px; bottom: -4px; }
.message-mind-reply.is-mine .mmr-dot.d1 { left: auto; right: 14px; }
.message-mind-reply.is-mine .mmr-dot.d2 { left: auto; right: 8px; }
.message-mind-reply .mmr-reply { align-self: flex-start; max-width: 100%; }
.message-mind-reply.is-mine .mmr-reply { align-self: flex-end; }
/* ========== 📸 朋友圈：封面 + 透明顶栏 + 操作条 + 分享/编辑/封面弹窗 ========== */
.wechat-header.moments-header-overlay { position: absolute !important; top: 0; left: 0; right: 0; background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-bottom: 0 !important; box-shadow: none !important; transition: background .2s ease; }
.wechat-header.moments-header-overlay .wechat-back-btn,
.wechat-header.moments-header-overlay .wechat-header-btn { color: #fff !important; text-shadow: 0 1px 3px rgba(0,0,0,.45); font-size: 16px; }
.wechat-header.moments-header-overlay.is-solid { background: rgba(247,247,247,.92) !important; backdrop-filter: blur(18px) !important; -webkit-backdrop-filter: blur(18px) !important; border-bottom: .5px solid rgba(0,0,0,.08) !important; }
.wechat-header.moments-header-overlay.is-solid .wechat-back-btn,
.wechat-header.moments-header-overlay.is-solid .wechat-header-btn { color: #111 !important; text-shadow: none; }
.moments-cover { position: relative; height: 210px; margin-bottom: 40px; background: linear-gradient(160deg, #5d6d7e 0%, #2f3640 100%); background-size: cover; background-position: center; cursor: pointer; flex-shrink: 0; }
.moments-cover-tip { position: absolute; left: 0; right: 0; top: 46%; text-align: center; color: rgba(255,255,255,.72); font-size: 12px; }
.moments-cover-user { position: absolute; right: 14px; bottom: -26px; display: flex; align-items: flex-end; gap: 12px; }
.moments-cover-name { color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 34px; text-shadow: 0 1px 4px rgba(0,0,0,.55); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moments-cover-avatar { width: 58px; height: 58px; border-radius: 12px; overflow: hidden; background: #fff; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.15); display: flex; align-items: center; justify-content: center; font-size: 32px; }
.moments-cover-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wechat-header.moments-header-overlay .wechat-header-title-text { opacity: 0; transition: opacity .2s ease; color: #111; font-size: 15px; }
.wechat-header.moments-header-overlay.is-solid .wechat-header-title-text { opacity: 1; }
.moment-avatar-col[data-moment-profile], .moment-author[data-moment-profile] { cursor: pointer; }
.moment-avatar-col, .moment-avatar-col img, .moment-avatar-col .avatar, .moment-avatar-col > * { border-radius: 6px !important; }
.moment-private-icon { font-size: 10px; color: #b0b0b0; margin-left: 4px; }
.moment-pin-tag { font-size: 10px; color: #3d8bff; background: rgba(61,139,255,.1); padding: 0 5px; border-radius: 4px; margin-left: 4px; }
.moments-album-sign { margin: -6px 16px 14px 16px; text-align: right; font-size: 11.5px; color: #8a8a8a; cursor: pointer; min-height: 16px; word-break: break-word; }
.moments-album-sign.is-empty { color: #b8b8b8; }
.moments-album-sign.is-static { cursor: default; }
.album-row { display: flex; gap: 8px; padding: 8px 14px 12px; }
.album-label { width: 54px; flex: 0 0 54px; line-height: 1; padding-top: 2px; }
.album-label b { font-size: 21px; font-weight: 700; color: #111; letter-spacing: -.5px; }
.album-label b.is-word { font-size: 17px; letter-spacing: 1px; }
.album-label small { font-size: 9.5px; color: #111; margin-left: 2px; font-weight: 600; }
.album-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.album-year { padding: 12px 14px 2px; font-size: 16px; font-weight: 700; color: #111; }
.album-divider { height: 1px; background: #eee; margin: 4px 16px 6px; }
.album-pin-tiles { flex: 1; display: grid; grid-template-columns: repeat(3, 72px); gap: 5px; }
.album-pin-tile { aspect-ratio: 1; background: #f3f3f3; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 4px; box-sizing: border-box; cursor: pointer; }
.album-pin-tile img { width: calc(100% + 8px); height: calc(100% + 8px); object-fit: cover; margin: -4px; }
.album-pin-tile span { font-size: 11px; color: #555; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; word-break: break-word; }
.album-post-tiles { display: flex; gap: 6px; }
.album-post-tile { width: 72px; height: 72px; border: 0; background: #f3f3f3; color: #576b95; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; font-size: 11.5px; cursor: pointer; }
.album-post-tile i { font-size: 16px; }
.album-entry { position: relative; display: flex; gap: 8px; cursor: pointer; }
.album-entry.is-text { background: #f3f3f3; padding: 8px 26px 8px 10px; }
.album-entry-text { font-size: 13px; color: #222; line-height: 1.45; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-break: break-word; }
.album-entry-side { flex: 1; min-width: 0; padding-right: 18px; }
.album-entry-sub { font-size: 11px; color: #aaa; margin-top: 4px; }
.album-thumb { position: relative; width: 72px; height: 72px; flex: 0 0 72px; background: #f0f0f0; overflow: hidden; }
.album-thumb img { width: 100%; height: 100%; object-fit: cover; }
.album-thumb-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #c4c4c4; font-size: 20px; }
.album-thumb-count { position: absolute; right: 3px; bottom: 3px; font-size: 10px; color: #fff; background: rgba(0,0,0,.45); padding: 0 4px; border-radius: 3px; }
.album-lock { position: absolute; right: 6px; top: 8px; font-size: 11px; color: #b5b5b5; }
.album-entry.is-image-only { display: block; }
.album-img-grid { width: 72px; height: 72px; display: grid; gap: 2px; background: #f0f0f0; overflow: hidden; }
.album-img-grid.n2 { grid-template-columns: 1fr 1fr; }
.album-img-grid.n3, .album-img-grid.n4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.album-img-grid.n3 .album-img-tile:first-child { grid-row: span 2; }
.album-img-tile { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 0; overflow: hidden; color: #c4c4c4; background: #eee; }
.album-img-tile img { width: 100%; height: 100%; object-fit: cover; }
.album-entry.is-image-only .album-lock { left: 56px; right: auto; top: 4px; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.5); }
.moment-gen-dialog { max-width: 330px; }
.moment-gen-label { font-size: 12px; color: #888; margin: 12px 0 6px; }
.moment-gen-label small { color: #b5b5b5; margin-left: 4px; }
.moment-gen-count { display: flex; flex-wrap: wrap; gap: 6px; }
.moment-gen-count button { min-width: 34px; height: 30px; border-radius: 8px; border: 1px solid #e5e5e5; background: #fafafa; color: #333; font-size: 13px; cursor: pointer; }
.moment-gen-count button.is-on { background: #07c160; border-color: #07c160; color: #fff; font-weight: 600; }
.moment-gen-people { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 190px; overflow-y: auto; padding: 2px; }
.moment-gen-person { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 5px 2px; border: 1.5px solid transparent; border-radius: 10px; background: #f7f7f8; cursor: pointer; min-width: 0; }
.moment-gen-person.is-on { border-color: #07c160; background: #eefaf3; }
.moment-gen-av { width: 34px; height: 34px; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #e9e9e9; font-size: 16px; }
.moment-gen-av img { width: 100%; height: 100%; object-fit: cover; }
.moment-gen-name { max-width: 100%; font-size: 10.5px; color: #444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moment-gen-only { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12.5px; color: #555; }
.moment-gen-only.is-disabled { opacity: .45; pointer-events: none; }
.moment-gen-summary { margin-top: 8px; font-size: 11.5px; color: #576b95; }
#moments-generate-btn.is-busy i { animation: momentWandSpin 1s linear infinite; }
@keyframes momentWandSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.album-end { text-align: center; font-size: 12px; color: #bbb; padding: 18px 0 30px; }
.moment-location { margin-top: 6px; font-size: 12px; color: #576b95; }
.moment-location i { font-size: 11px; margin-right: 2px; }
.moment-trans-fold { margin-top: 4px; }
.moment-trans-btn { background: none; border: 0; padding: 0; color: #576b95; font-size: 12px; cursor: pointer; }
.moment-trans-body { display: none; margin-top: 4px; padding: 6px 8px; background: rgba(0,0,0,.035); border-radius: 6px; font-size: 13.5px; color: #555; line-height: 1.5; word-break: break-word; }
.moment-trans-fold.expanded .moment-trans-body { display: block; }
.moment-trans-fold.is-inline { margin: 2px 0 0; }
.moment-trans-fold:not(.is-inline) { margin-bottom: 10px; }
.moment-trans-fold + .moment-images, .moment-trans-fold + div[class*="image"], .moment-trans-fold + [class*="moment-img"] { margin-top: 10px !important; }
.album-flags { position: absolute; right: 6px; top: 8px; display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #b5b5b5; line-height: 1; }
.album-flags:empty { display: none; }
.album-pin-icon { width: 12px; height: 12px; color: #3d8bff; }
.album-entry.is-image-only .album-flags { left: 56px; right: auto; top: 4px; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.5); }
.album-entry.is-image-only .album-pin-icon { color: #3d8bff; filter: drop-shadow(0 0 1px rgba(0,0,0,.6)); }
.album-pin-tile { position: relative; }
.album-pin-badge { position: absolute; top: 4px; right: 4px; width: 14px; height: 14px; padding: 2px; border-radius: 50%; background: #3d8bff; color: #fff; z-index: 2; box-sizing: content-box; }
.moment-post-type-sheet { width: 100%; max-width: 300px; background: #fff; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
.moment-post-type-sheet button { display: grid; grid-template-columns: 26px 1fr; grid-template-rows: auto auto; column-gap: 10px; align-items: center; text-align: left; border: 0; border-bottom: .5px solid #eee; background: #fff; padding: 13px 16px; cursor: pointer; }
.moment-post-type-sheet button i { grid-row: 1 / 3; font-size: 18px; color: #07c160; text-align: center; }
.moment-post-type-sheet button span { font-size: 15px; color: #111; }
.moment-post-type-sheet button small { font-size: 11px; color: #999; }
.moment-post-type-sheet button.is-cancel { display: block; text-align: center; color: #576b95; font-size: 15px; border-bottom: 0; border-top: 6px solid #f2f2f2; }
.chat-item.is-pinned { position: relative; }
.chat-item.is-pinned .chat-pin-corner { position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: #3d8bff; clip-path: polygon(0 0, 100% 0, 100% 100%); z-index: 2; }
.chat-item.is-pinned .chat-pin-corner svg { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; color: #fff; }

.moment-trans-fold.is-inline .moment-trans-btn { font-size: 11px; }
.moment-trans-fold.is-inline .moment-trans-body { font-size: 12.5px; padding: 4px 6px; background: rgba(0,0,0,.04); }
.action-popup.moment-action-bar { display: flex !important; flex-direction: row; align-items: center; gap: 2px; padding: 4px 6px !important; border-radius: 10px !important; background: #2b2b2d !important; width: auto !important; height: auto !important; white-space: nowrap; }
.moment-action-bar .moment-bar-btn { display: inline-flex !important; align-items: center; justify-content: center; width: 30px; height: 28px; padding: 0 !important; margin: 0 !important; border: 0 !important; background: transparent; color: #fff !important; font-size: 13px; border-radius: 6px; cursor: pointer; }
.moment-action-bar .moment-bar-btn::after, .moment-action-bar .moment-bar-btn::before { display: none !important; }
.moment-action-bar .moment-bar-btn i { font-size: 13px !important; color: #fff; }
.moment-action-bar .moment-bar-btn:active { background: rgba(255,255,255,.12); }
.moment-action-bar .moment-bar-btn.is-on i { color: #ff5a6e; }
.moment-action-bar .moment-bar-btn[data-act="pin"].is-on i { color: #3d8bff; }
.wx-moments-style-item { cursor: default; }
.wx-moments-style-seg { display: flex; gap: 2px; background: rgba(0,0,0,.05); border-radius: 9px; padding: 2px; flex: 0 0 auto; }
.wx-moments-style-seg button { border: 0; background: transparent; padding: 5px 7px; border-radius: 7px; font-size: 11px; color: #666; cursor: pointer; white-space: nowrap; }
.wx-moments-style-seg button.active { background: #fff; color: #07c160; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.moment-sheet-mask { position: absolute; inset: 0; z-index: 400; background: rgba(0,0,0,.38); display: flex; align-items: center; justify-content: center; padding: 18px; box-sizing: border-box; animation: momentMaskIn .16s ease; }
@keyframes momentMaskIn { from { opacity: 0; } to { opacity: 1; } }
.moment-dialog { width: 100%; max-width: 320px; background: #fff; border-radius: 14px; padding: 16px 16px 12px; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.moment-dialog-title { font-size: 15px; font-weight: 700; color: #111; text-align: left; }
.moment-dialog-sub { font-size: 11px; color: #999; margin-top: 2px; }
.moment-dialog-text { font-size: 13px; color: #555; margin: 10px 0 14px; }
.moment-field { display: block; margin-top: 10px; }
.moment-field > span { display: block; font-size: 11px; color: #999; margin-bottom: 4px; }
.moment-field textarea, .moment-field input { width: 100%; box-sizing: border-box; border: 1px solid #ececec; background: #f7f7f8; border-radius: 10px; padding: 8px 10px; font-size: 13px; color: #222; outline: none; resize: vertical; font-family: inherit; }
.moment-field textarea:focus, .moment-field input:focus { border-color: #8fb3ff; background: #fff; }
.moment-dialog-actions { display: flex; gap: 10px; margin-top: 14px; }
.moment-dialog-actions button { flex: 1; height: 36px; border-radius: 10px; border: 1px solid #ddd; background: #fff; color: #333; font-size: 14px; cursor: pointer; }
.moment-dialog-actions button.is-primary { background: #1677ff; border-color: #1677ff; color: #fff; font-weight: 600; }
.moment-dialog-actions button.is-danger { background: #ff4d4f; border-color: #ff4d4f; }
.moment-share-sheet { width: 100%; max-width: 340px; max-height: 86%; background: #fff; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.moment-share-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; font-size: 15px; font-weight: 700; }
.moment-share-head button, .moment-icon-btn { width: 26px; height: 26px; border-radius: 50%; border: 0; background: #f2f2f2; color: #666; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-left: 6px; }
.moment-share-preview { display: flex; gap: 8px; margin: 0 14px; padding: 10px; background: #eef5f1; border-radius: 10px; font-size: 12px; color: #333; }
.moment-share-preview b { font-size: 12px; }
.moment-share-preview-text { color: #555; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45; }
.moment-share-av { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex: 0 0 32px; display: inline-flex; align-items: center; justify-content: center; background: #eee; font-size: 16px; }
.moment-share-av img { width: 100%; height: 100%; object-fit: cover; }
.moment-share-tabs { display: flex; gap: 16px; padding: 10px 16px 0; border-bottom: 1px solid #f0f0f0; }
.moment-share-tabs button { border: 0; background: none; padding: 6px 0; font-size: 13px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; }
.moment-share-tabs button.is-on { color: #07c160; border-bottom-color: #07c160; font-weight: 600; }
.moment-share-tabs small { font-size: 10px; color: #aaa; }
.moment-share-search { display: flex; align-items: center; gap: 6px; margin: 10px 14px 4px; padding: 0 10px; height: 32px; background: #f4f4f5; border-radius: 9px; color: #aaa; font-size: 12px; }
.moment-share-search input { flex: 1; border: 0; background: transparent; outline: none; font-size: 13px; color: #222; }
.moment-share-list { flex: 1; min-height: 120px; overflow-y: auto; padding: 4px 8px; }
.moment-share-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border: 0; background: none; border-radius: 10px; cursor: pointer; text-align: left; }
.moment-share-row:active { background: #f5f5f5; }
.moment-share-name { flex: 1; font-size: 14px; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moment-share-check { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #ccc; display: inline-flex; align-items: center; justify-content: center; color: transparent; font-size: 11px; flex: 0 0 20px; }
.moment-share-row.is-on .moment-share-check { background: #07c160; border-color: #07c160; color: #fff; }
.moment-share-empty { text-align: center; color: #aaa; font-size: 12px; padding: 30px 0; }
.moment-share-send { margin: 8px 14px 14px; height: 40px; border: 0; border-radius: 12px; background: #07c160; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.moment-share-send:disabled { background: #e5e5e5; color: #aaa; cursor: default; }
.moment-cover-dialog-head { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.moment-cover-tabs { display: flex; gap: 8px; margin: 14px 0 10px; }
.moment-cover-tabs button { flex: 1; height: 34px; border-radius: 9px; border: 0; background: #f2f3f5; color: #555; font-size: 12.5px; cursor: pointer; }
.moment-cover-tabs button.is-on { background: #1677ff; color: #fff; font-weight: 600; }
.moment-cover-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; height: 130px; border: 1.5px dashed #d5d8de; border-radius: 12px; color: #666; cursor: pointer; font-size: 13px; }
.moment-cover-drop[hidden], .moment-cover-url[hidden] { display: none !important; }
.moment-cover-drop i { font-size: 26px; color: #9aa3b2; }
.moment-cover-drop small { font-size: 10.5px; color: #aaa; }
.moment-cover-url { display: flex; flex-direction: column; gap: 8px; }
.moment-cover-url input { height: 36px; border: 1px solid #e6e6e6; border-radius: 10px; padding: 0 10px; font-size: 13px; outline: none; }
.moment-cover-url-ok { height: 36px; border: 0; border-radius: 10px; background: #1677ff; color: #fff; font-size: 13px; cursor: pointer; }
.wechat-moment-location-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 12px 15px; background: #f7f7f7; border-radius: 8px; color: #576b95; font-size: 14px; }
.wechat-moment-location-row input { flex: 1; border: 0; background: transparent; outline: none; font-size: 14px; color: #333; }
.message-moment-card { width: 220px; max-width: 100%; background: #fff; border: 1px solid #ececec; border-radius: 10px; overflow: hidden; }
.message-moment-card .mmc-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px 0; }
.message-moment-card .mmc-av { width: 20px; height: 20px; border-radius: 4px; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; background: #eee; }
.message-moment-card .mmc-av img { width: 100%; height: 100%; object-fit: cover; }
.message-moment-card .mmc-name { font-size: 12.5px; font-weight: 600; color: #576b95; }
.message-moment-card .mmc-body { display: flex; gap: 8px; padding: 6px 10px 8px; }
.message-moment-card .mmc-text { flex: 1; font-size: 12.5px; color: #333; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.message-moment-card .mmc-thumb { width: 48px; height: 48px; border-radius: 4px; object-fit: cover; flex: 0 0 48px; }
.message-moment-card .mmc-thumb-ph { display: inline-flex; align-items: center; justify-content: center; background: #f2f2f2; color: #bbb; }
.message-moment-card .mmc-foot { border-top: 1px solid #f2f2f2; padding: 5px 10px; font-size: 10.5px; color: #999; }

.group-sender-title {
    color: #c27a35;
    margin-right: 3px;
    font-weight: 600;
}

.group-sender-role {
    margin-right: 3px;
    font-weight: 600;
}

.group-sender-role.role-owner {
    color: #e6a23c;
}

.group-sender-role.role-admin {
    color: #576b95;
}

.group-member-role-chip {
    position: absolute;
    top: 34px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0 5px;
    border-radius: 8px;
    font-size: 8px;
    line-height: 13px;
    color: #fff;
    white-space: nowrap;
    z-index: 2;
}

.group-member-role-chip.role-owner {
    background: #e6a23c;
}

.group-member-role-chip.role-admin {
    background: #576b95;
}

.group-member-role-chip.role-member {
    background: #bbb;
}

.group-member-role-chip.inline {
    position: static;
    transform: none;
    display: inline-block;
}

.group-member-title-chip {
    font-size: 9px;
    color: #c27a35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.wechat-member-manage-mask {
    position: fixed;
    inset: 0;
    z-index: 10060;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.wechat-member-manage-sheet {
    width: 100%;
    max-width: 420px;
    background: #fff;
    border-radius: 14px 14px 0 0;
    padding: 16px;
    box-sizing: border-box;
    max-height: 80vh;
    overflow-y: auto;
}

.wmm-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.wmm-avatar {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    overflow: hidden;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    font-size: 22px;
}

.wmm-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.wmm-names {
    flex: 1;
    min-width: 0;
}

.wmm-name {
    font-size: 15px;
    font-weight: 600;
    color: #222;
}

.wmm-sub {
    font-size: 11px;
    color: #999;
    font-weight: 400;
    margin-left: 4px;
}

.wmm-role {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
}

.wmm-title-now {
    font-size: 11px;
    color: #c27a35;
}

.wmm-close {
    border: none;
    background: none;
    color: #999;
    font-size: 16px;
    cursor: pointer;
}

.wmm-field {
    margin-bottom: 14px;
}

.wmm-field label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
}

.wmm-title-row {
    display: flex;
    gap: 8px;
}

.wmm-title-input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    min-width: 0;
}

.wmm-title-input:focus {
    border-color: #07c160;
}

.wmm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.wmm-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    background: #fff;
    font-size: 12px;
    color: #333;
    cursor: pointer;
}

.wmm-btn.primary {
    background: #07c160;
    border-color: #07c160;
    color: #fff;
}

.wmm-btn.danger {
    color: #ff3b30;
    border-color: #ffb3ad;
}

.wmm-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.wmm-hint {
    font-size: 11px;
    color: #bbb;
    margin-top: 6px;
}

.avatar-settings-buttons {
    display: flex;
    gap: 10px;
}

.avatar-settings-buttons button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
}

.save-avatar-btn {
    background: #07c160;
    color: #fff;
}

.cancel-avatar-btn {
    background: #f0f0f0;
    color: #666;
}

/* ========================================
   空状态优化
   ======================================== */

.wechat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 20px;
    color: #b2b2b2;
}

.wechat-empty i {
    font-size: 64px;
    color: #ddd;
    margin-bottom: 15px;
}

/* ========================================
   滚动条美化
   ======================================== */

/* 🔥 默认隐藏 wechat-content 滚动条 */
.wechat-content {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

.wechat-content::-webkit-scrollbar {
    display: none; /* Chrome, Safari */
}

/* 🔥 隐藏聊天消息区的滚动条 */
.wechat-app .chat-messages::-webkit-scrollbar {
    display: none;
}

/* 🔥 当内容区包含朋友圈时隐藏滚动条 */
.wechat-content:has(.moments-page)::-webkit-scrollbar {
    display: none;
}

.wechat-content:has(.moments-page) {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.wechat-app .chat-messages {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* 🔥 新增：隐藏通讯录的滚动条 */
.contacts-scrollable::-webkit-scrollbar {
    display: none;
}

/* ========================================
   个人页样式优化 - 紧凑设计
   ======================================== */

.wechat-profile {
    background: linear-gradient(to bottom, #ededed 0%, #f5f5f5 100%);
    min-height: 100%;
    padding-bottom: 10px;
}

/* 个人信息卡片 */
.profile-card {
    background: #fff;
    padding: 15px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
}

.profile-avatar-large {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #d8d8d8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    flex-shrink: 0;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.profile-avatar-large:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.profile-avatar-large:active {
    transform: scale(0.95);
}

/* 头像编辑提示 */
.avatar-edit-hint {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 10px;
    padding: 2px;
    text-align: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.profile-avatar-large:hover .avatar-edit-hint {
    opacity: 1;
}

.profile-avatar-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.profile-user-info {
    flex: 1;
}

.profile-username {
    font-size: 15px;
    font-weight: 600;
    color: #000;
    margin-bottom: 3px;
}

.profile-signature {
    font-size: 11px;
    color: #888;
    margin-bottom: 2px;
    line-height: 1.3;
}

/* 分隔线 */
.profile-divider {
    height: 6px;
    background: transparent;
}

/* 功能列表 */
.profile-functions {
    background: #fff;
}

.profile-function-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 0.5px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.2s;
}

.profile-function-item:last-child {
    border-bottom: none;
}

.profile-function-item:active {
    background: #f8f8f8;
}

.function-icon-wrapper {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    flex-shrink: 0;
    margin-right: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.function-content {
    flex: 1;
}

.function-title {
    font-size: 13px;
    font-weight: 500;
    color: #000;
    margin-bottom: 1px;
}

.function-desc {
    font-size: 10px;
    color: #999;
}

.function-arrow {
    color: #c8c8c8;
    font-size: 12px;
    margin-left: 8px;
}

/* 数据统计 */
.profile-stats {
    background: #fff;
    display: flex;
    padding: 8px 0;
}

.stat-item {
    flex: 1;
    text-align: center;
}

.stat-number {
    font-size: 14px;
    font-weight: 600;
    color: #07c160;
    margin-bottom: 1px;
}

.stat-label {
    font-size: 10px;
    color: #888;
}

/* 编辑资料弹窗优化 */
.profile-edit-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.profile-edit-content {
    background: #fff;
    border-radius: 16px;
    padding: 25px;
    width: 90%;
    max-width: 320px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s;
}

@keyframes slideUp {
    from { transform: translateY(50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.profile-edit-title {
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 20px;
    color: #000;
}

.profile-edit-avatar {
    width: 90px;
    height: 90px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    margin: 0 auto 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 45px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s;
}

.profile-edit-avatar:hover {
    transform: scale(1.05);
}

.profile-edit-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.profile-edit-input {
    width: 100%;
    padding: 12px 15px;
    border: 1.5px solid #e5e5e5;
    border-radius: 8px;
    font-size: 15px;
    margin-bottom: 12px;
    box-sizing: border-box;
    transition: border-color 0.3s;
}

.profile-edit-input:focus {
    outline: none;
    border-color: #07c160;
}

.profile-edit-upload-btn {
    display: block;
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 15px;
    transition: transform 0.2s, box-shadow 0.3s;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.profile-edit-upload-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.profile-edit-upload-btn:active {
    transform: translateY(0);
}

.profile-edit-buttons {
    display: flex;
    gap: 12px;
    margin-top: 20px;
}

.profile-save-btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    background: #07c160;
    color: #fff;
    transition: background 0.2s;
}

.profile-save-btn:hover {
    background: #06a752;
}

.profile-cancel-btn {
    flex: 1;
    padding: 12px;
    border: 1.5px solid #e5e5e5;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    background: #fff;
    color: #666;
    transition: background 0.2s;
}

.profile-cancel-btn:hover {
    background: #f8f8f8;
}

/* ========================================
   📇 通讯录美化
   ======================================== */

.wechat-contacts {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    overflow: hidden;
}

.contacts-search {
    padding: 10px 15px;
    background: #ededed;
    flex-shrink: 0;
}

.contacts-scrollable {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}

.search-input {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #fff;
    font-size: 14px;
    outline: none;
}

.contacts-functions {
    background: #fff;
    padding: 0;
    margin-bottom: 8px;
}

.function-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 0.5px solid #e5e5e5;  /* 🔥 添加分隔线 */
}

.function-item:last-child {
    border-bottom: none;  /* 🔥 最后一个不要分隔线 */
}

.function-item:active {
    background: #f0f0f0;
}

.function-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 15px;
    margin-right: 10px;
}

.function-name {
    font-size: 13px;
    color: #000;
}

.contacts-function-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.contacts-list {
    background: #fff;
    /* 🔥 删除这行（如果有）：overflow-y: auto; */
}
.contacts-group {
    position: relative;
}

.group-letter {
    position: sticky;
    top: 0;
    background: #f5f5f5;
    padding: 5px 15px;
    font-size: 13px;
    font-weight: 600;
    color: #666;
    z-index: 10;
}

.contacts-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
}

.contacts-group-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
}

.contacts-group-create-btn {
    border: none;
    background: transparent;
    color: #576b95;
    font-size: 18px;
    line-height: 1;
    width: 24px;
    height: 20px;
    padding: 0;
    cursor: pointer;
    font-weight: 400;
    flex-shrink: 0;
}

.contact-item,
.contact-group-item {
    display: flex;
    align-items: center;
    padding: 6px 15px;
    border-bottom: 0.5px solid #e5e5e5;
    cursor: pointer;
    transition: background 0.2s;
}

.contact-item:active,
.contact-group-item:active {
    background: #f0f0f0;
}

.contacts-empty-row {
    padding: 10px 15px;
    color: #999;
    font-size: 13px;
    background: #fff;
    border-bottom: 0.5px solid #e5e5e5;
}

.contact-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #d8d8d8;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-right: 10px;
    flex-shrink: 0;
    overflow: hidden;
}

.contact-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
}

.contact-name {
    font-size: 15px;
    color: #000;
    font-weight: 500;
}

.letter-index {
    position: absolute;
    right: 2px;
    top: 126px;
    bottom: 52px;
    transform: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0;
    z-index: 100;
    padding: 4px 0 8px;
    overflow: visible;
    box-sizing: border-box;
}

.letter-item {
    font-size: 9px;
    color: #667eea;
    font-weight: 600;
    cursor: pointer;
    padding: 0 4px;
    transition: all 0.2s;
    line-height: 1;
    text-align: center;
    box-sizing: border-box;
    min-height: 12px;
}

.letter-item:active {
    background: #667eea;
    color: #fff;
    border-radius: 50%;
}

/* 聊天背景支持 */
.wechat-app .chat-room {
    background-size: cover !important;
    background-position: center !important;
}

/* ========================================
   ⚙️ 设置页面开关样式
   ======================================== */

.toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 28px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 28px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-slider {
    background-color: var(--phone-toggle-active-color);
}

.toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(22px);
}

/* ========================================
   📸 朋友圈样式 - 高仿微信
   ======================================== */

/* 朋友圈页面容器 */
.moments-page {
    min-height: 100%;
}

/* 朋友圈顶部栏特殊样式 */
.moments-header-style {
    /* 保留按钮布局调整，不再覆盖顶部玻璃背景 */
}

/* 🔥 朋友圈头部按钮特殊样式 */
.moments-header-style .wechat-header-right {
    gap: 14px;
    min-width: auto;
    align-items: center;
    padding-top: 2px;
}

.moments-header-style .wechat-header-btn {
    font-size: 13px;
    padding: 6px;
}

.moments-header-style .wechat-header-title {
    white-space: nowrap;
    text-align: center;
}

.moments-header-style .wechat-header-left {
    min-width: 30px;
}

/* 🔥 删除白色强制样式，跟随全局文字颜色 */

/* 朋友圈列表 */
.moments-feed {
    padding: 0;
    /* 🔥 移除硬编码背景，由内联样式控制 */
}

.moments-pull-refresh-indicator {
    height: 0;
    overflow: hidden;
    transition: height 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a8a8a;
    font-size: 12px;
}

.moments-pull-refresh-inner {
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.moments-pull-refresh-indicator.ready .moments-pull-refresh-inner {
    color: #07c160;
}

.moments-pull-refresh-indicator.loading .moments-pull-refresh-inner {
    color: #576b95;
}

.moments-pull-refresh-indicator.success .moments-pull-refresh-inner {
    color: #07c160;
}

.moments-pull-refresh-indicator.error .moments-pull-refresh-inner {
    color: #d93025;
}

.moments-empty-tip {
    text-align: center;
    padding: 60px 20px;
    color: #999;
}

.moments-empty-tip p {
    margin: 8px 0;
}

.moments-empty-tip .tip-sub {
    font-size: 12px;
    color: #bbb;
}

/* 单条朋友圈 */
.moment-item {
    display: flex;
    padding: 12px 15px;
    border-bottom: 0.5px solid #e5e5e5;
    position: relative;
}

.moment-delete-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    display: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: #ff4d4f;
    font-size: 12px;
    line-height: 1;
    box-shadow: none;
    z-index: 6;
    cursor: pointer;
    padding: 0;
}

.moment-item.show-delete .moment-delete-btn {
    display: inline-flex;
}

/* 头像列 */
.moment-avatar-col {
    width: 44px;
    height: 44px;
    margin-right: 10px;
    flex-shrink: 0;
    border-radius: 6px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    overflow: hidden;
}

.moment-avatar-col img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
}

.moment-avatar-img {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    object-fit: cover;
}

.moment-avatar-emoji {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
}

.moment-image-prompt-box,
.moment-image-generated-box {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 86px;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    background: #f3f3f3;
}

.moment-image-prompt-front {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
}

.moment-image-prompt-box.is-desc-open .moment-image-prompt-front,
.moment-image-generated-box.is-desc-open > .moment-img,
.moment-image-generated-box.is-desc-open > .moment-image-regenerate,
.moment-image-generated-box.is-desc-open > .moment-image-show-desc {
    display: none !important;
}

.moment-image-prompt-box.is-desc-open .moment-image-desc-panel,
.moment-image-generated-box.is-desc-open .moment-image-desc-panel {
    display: flex;
}

.moment-image-prompt-mask {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.52));
}

.moment-image-prompt-generate {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    box-sizing: border-box;
    color: #fff;
    text-align: center;
}

.moment-image-prompt-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.24);
    font-size: 15px;
}

.moment-image-prompt-text {
    font-size: 10px;
    line-height: 1.2;
    font-weight: 600;
}

.moment-image-prompt-error {
    max-width: 100%;
    font-size: 9px;
    line-height: 1.25;
    color: rgba(255,255,255,0.9);
    word-break: break-word;
}

.moment-image-show-desc,
.moment-image-regenerate,
.moment-image-restore {
    position: absolute;
    z-index: 4;
    appearance: none;
    -webkit-appearance: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    background: transparent;
    color: #fff;
    box-shadow: none;
    text-shadow: 0 1px 3px rgba(0,0,0,0.55);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}

.moment-image-show-desc {
    right: 5px;
    bottom: 5px;
    max-width: calc(100% - 8px);
    padding: 4px 7px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.moment-image-regenerate {
    left: 5px;
    bottom: 5px;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 400;
    line-height: 1;
}

.moment-image-desc-panel {
    display: none;
    position: absolute;
    inset: 0;
    padding: 8px;
    padding-bottom: 30px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    background: #f7f7f7;
    border: 1px dashed #dedede;
    border-radius: 4px;
    color: #666;
    z-index: 3;
}

.moment-image-desc-text {
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    font-size: 10px;
    line-height: 1.45;
    text-align: center;
    white-space: pre-wrap;
    word-break: break-word;
}

.moment-image-restore {
    right: 5px;
    bottom: 5px;
    padding: 4px 7px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 1.1;
}

/* 内容列 */
.moment-content-col {
    flex: 1;
    min-width: 0;
}

.moment-author {
    font-size: 15px;
    font-weight: 500;
    color: #576b95;
    margin-bottom: 4px;
}

.moment-text {
    font-size: 15px;
    color: #000;
    line-height: 1.5;
    margin-bottom: 8px;
    word-wrap: break-word;
}

/* 图片网格 */
.moment-images {
    display: grid;
    gap: 4px;
    margin-bottom: 8px;
}

.moment-images.single {
    grid-template-columns: 1fr;
    max-width: 180px;
}

.moment-images.double {
    grid-template-columns: repeat(2, 1fr);
    max-width: 180px;
}

.moment-images.quad {
    grid-template-columns: repeat(2, 1fr);
    max-width: 180px;
}

.moment-images.grid {
    grid-template-columns: repeat(3, 1fr);
    max-width: 220px;
}

.moment-img-wrapper {
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 4px;
    background: #f5f5f5;
}

.moment-images.double .moment-image-prompt-generate,
.moment-images.quad .moment-image-prompt-generate,
.moment-images.grid .moment-image-prompt-generate {
    gap: 3px;
    padding: 5px;
}

.moment-images.double .moment-image-prompt-icon,
.moment-images.quad .moment-image-prompt-icon,
.moment-images.grid .moment-image-prompt-icon {
    width: clamp(20px, 22%, 26px);
    height: clamp(20px, 22%, 26px);
    border-radius: 6px;
    font-size: clamp(11px, 3vw, 13px);
}

.moment-images.double .moment-image-prompt-text,
.moment-images.quad .moment-image-prompt-text,
.moment-images.grid .moment-image-prompt-text {
    max-width: 100%;
    font-size: clamp(8px, 2.5vw, 9px);
    line-height: 1.1;
}

.moment-images.double .moment-image-show-desc,
.moment-images.quad .moment-image-show-desc,
.moment-images.grid .moment-image-show-desc,
.moment-images.double .moment-image-restore,
.moment-images.quad .moment-image-restore,
.moment-images.grid .moment-image-restore {
    right: 3px;
    bottom: 3px;
    padding: 3px 5px;
    border-radius: 3px;
    font-size: clamp(8px, 2.45vw, 9px);
    line-height: 1;
}

.moment-images.grid .moment-image-show-desc,
.moment-images.grid .moment-image-restore {
    padding: 2px 4px;
}

.moment-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.moment-img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e8e8e8;
    color: #999;
    font-size: 11px;
    text-align: center;
    padding: 4px;
    box-sizing: border-box;
}

/* 底部：时间+操作 */
.moment-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.moment-time {
    font-size: 12px;
    color: #b2b2b2;
}

.moment-action-btn {
    width: 28px;
    height: 20px;
    background: #f7f7f7;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
}

.moment-action-btn i {
    font-size: 12px;
    color: #576b95;
}

/* 操作弹窗 - 白色玻璃风格 */
.action-popup {
    position: absolute;
    right: 30px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 6px;
    display: flex;
    z-index: 100;
    animation: popupFade 0.15s ease;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

@keyframes popupFade {
    from { opacity: 0; transform: translateY(-50%) scale(0.9); }
    to { opacity: 1; transform: translateY(-50%) scale(1); }
}

.action-popup-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px 10px;
    color: #576b95;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
}

.action-popup-btn:first-child {
    border-right: 1px solid #e5e5e5;
}

.action-popup-btn i {
    font-size: 10px;
}

.action-popup-btn:active {
    background: rgba(0, 0, 0, 0.05);
}

/* 互动区（点赞+评论） */
.moment-interactions {
    background: #f7f7f7;
    border-radius: 4px;
    overflow: hidden;
}

.interaction-likes {
    padding: 6px 10px;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    border-bottom: 0.5px solid #e5e5e5;
}

.interaction-likes i {
    color: #576b95;
    font-size: 12px;
    margin-top: 2px;
}

.like-names {
    font-size: 13px;
    color: #576b95;
    line-height: 1.4;
}

.interaction-comments {
    padding: 6px 10px;
}

.comment-row {
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 2px;
    cursor: pointer;
    padding: 2px 4px;
    margin-left: -4px;
    margin-right: -4px;
    border-radius: 4px;
    transition: background 0.2s;
}

.comment-row:hover {
    background: rgba(0, 0, 0, 0.05);
}

.comment-row:active {
    background: rgba(0, 0, 0, 0.1);
}

.comment-row:last-child {
    margin-bottom: 0;
}

.comment-author {
    color: #576b95;
    font-weight: 500;
}

.comment-reply {
    color: #000;
    margin: 0 4px;
}

.comment-colon {
    color: #000;
}

.comment-content {
    color: #000;
}

/* ========================================
   📝 朋友圈内嵌评论输入框
   ======================================== */

.inline-comment-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: #fff;
    border-top: 0.5px solid #e5e5e5;
    margin-top: 4px;
}

.inline-comment-input {
    flex: 1;
    padding: 6px 10px;
    border: 0.5px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    background: #f7f7f7;
    outline: none;
    min-width: 0;
}

.inline-comment-input:focus {
    border-color: #576b95;
    background: #fff;
}

.inline-comment-send {
    background: none;
    color: #576b95;
    border: none;
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    padding: 4px 8px;
}

.inline-comment-send:active {
    color: #4a5a7a;
}

/* 🔥 禁止朋友圈下拉刷新 */
.moments-page {
    overscroll-behavior: none !important;
    -webkit-overflow-scrolling: touch;
    /* 🔥 隐藏滚动条 */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    /* 🔥 相对定位，让评论输入框能正确定位 */
    position: relative;
    height: 100%;
    overflow-y: auto;
}

.moments-page::-webkit-scrollbar {
    display: none;
}

/* 🔥 朋友圈内容区也隐藏滚动条 */
.moments-feed {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.moments-feed::-webkit-scrollbar {
    display: none;
}

/* ========================================
   微信钱包
   ======================================== */
#phone-panel-content .phone-screen .wechat-app.wechat-wallet-ledger-page {
    background: #f2f4f1;
    color: #242824;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 18px;
    touch-action: pan-y;
    overscroll-behavior: contain;
    scrollbar-width: none;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-scroll::-webkit-scrollbar {
    display: none;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-hero {
    position: relative;
    overflow: hidden;
    padding: 28px 14px 20px;
    border-radius: 0 0 24px 24px;
    background: #e2eed9;
    color: #273128;
    box-shadow: 0 8px 20px rgba(55, 78, 56, 0.08);
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-nav {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    align-items: center;
    min-height: 34px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-nav button {
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #283229;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-nav button:active {
    background: rgba(48, 66, 48, 0.09);
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-title {
    min-width: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 650;
    line-height: 1.3;
}

#phone-panel-content .phone-screen .wechat-wallet-hero-emblem {
    height: 64px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

#phone-panel-content .phone-screen .wechat-wallet-hero-emblem span {
    width: 54px;
    height: 54px;
    border: 1px solid rgba(92, 117, 89, 0.14);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.48);
    color: #8da287;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 23px;
    box-shadow: inset 0 0 0 7px rgba(255, 255, 255, 0.18);
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stats {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 8px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat {
    min-width: 0;
    padding: 0 7px;
    text-align: center;
    border-right: 1px solid rgba(72, 90, 70, 0.16);
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat:last-child {
    border-right: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat-icon {
    width: 24px;
    height: 24px;
    margin: 0 auto 6px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.58);
    color: #5b6b59;
    font-size: 11px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat-label {
    display: block;
    color: #667064;
    font-size: 10px;
    line-height: 1.3;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat-value {
    display: block;
    margin-top: 6px;
    color: #202720;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-stat-value.is-compact { font-size: 14px; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-stat-value.is-tight { font-size: 12px; }

#phone-panel-content .phone-screen .wechat-wallet-shortcuts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 12px 12px 10px;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-card {
    appearance: none;
    -webkit-appearance: none;
    min-width: 0;
    min-height: 88px;
    padding: 9px 7px 10px;
    border: 1px solid #e5e8e3;
    border-radius: 8px;
    box-sizing: border-box;
    background: #fff;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 12px;
    grid-template-rows: 30px minmax(20px, auto);
    column-gap: 3px;
    row-gap: 8px;
    align-items: start;
    box-shadow: 0 5px 14px rgba(47, 59, 48, 0.05);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-card.is-active {
    border-color: #b7c9af;
    background: #f8fbf6;
    box-shadow: 0 5px 14px rgba(58, 87, 58, 0.09), inset 0 0 0 1px rgba(112, 146, 104, 0.08);
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-card:active {
    transform: translateY(1px);
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-card:focus-visible {
    outline: 2px solid #78966f;
    outline-offset: 1px;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-icon {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 13px;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-icon.is-balance {
    background: #efb94c;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-icon.is-card {
    background: #4aa8dc;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-icon.is-credit {
    background: #ef6b70;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-title {
    min-width: 0;
    align-self: center;
    color: #262a27;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-value {
    grid-column: 1 / -1;
    min-width: 0;
    align-self: end;
    transform: translateY(-7px);
    color: #252925;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-value.is-compact {
    font-size: 12px;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-value.is-tight {
    font-size: 10px;
}

#phone-panel-content .phone-screen .wechat-wallet-shortcut-chevron {
    width: 12px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #767d75;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    align-self: center;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-overlay {
    position: absolute;
    inset: 0;
    z-index: 2300;
    padding: 14px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(20, 24, 20, 0.62);
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-dialog {
    width: 100%;
    max-width: 320px;
    max-height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 12px 34px rgba(18, 24, 18, 0.28);
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-header {
    min-height: 58px;
    padding: 12px 12px 10px 14px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px;
    gap: 10px;
    align-items: center;
    border-bottom: 1px solid #e7eae5;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-header span {
    display: block;
    color: #8a9188;
    font-size: 9px;
    line-height: 1.3;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-header h3 {
    margin: 2px 0 0;
    color: #262b27;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.35;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-close {
    appearance: none;
    -webkit-appearance: none;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #5f675f;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-body {
    min-height: 0;
    padding: 14px;
    overflow-y: auto;
    touch-action: pan-y;
    overscroll-behavior: contain;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-note {
    margin: 0 0 12px;
    color: #555d55;
    font-size: 11px;
    line-height: 1.55;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-section > strong {
    color: #2c312d;
    font-size: 11px;
    font-weight: 650;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-response {
    width: 100%;
    min-height: 170px;
    margin: 8px 0 0;
    padding: 10px;
    overflow: auto;
    box-sizing: border-box;
    border: 1px solid #e1e5df;
    border-radius: 6px;
    background: #f6f7f5;
    color: #303530;
    font: 11px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    touch-action: pan-y;
    overscroll-behavior: contain;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-footer {
    padding: 10px 14px 14px;
    border-top: 1px solid #e7eae5;
    flex-shrink: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-parse-error-confirm {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #6e8c65;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-account-panel {
    margin: 0 12px 10px;
}

#phone-panel-content .phone-screen .wechat-wallet-account-section {
    margin-bottom: 10px;
    overflow: hidden;
    border: 1px solid #e4e7e2;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 6px 18px rgba(46, 58, 47, 0.06);
}

#phone-panel-content .phone-screen .wechat-wallet-account-section:last-child {
    margin-bottom: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-account-section-header {
    min-height: 48px;
    padding: 0 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    border-bottom: 1px solid #eceeea;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-wallet-account-section-title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    color: #2c302d;
    font-size: 13px;
    font-weight: 650;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-account-section-title i {
    color: #606760;
    font-size: 13px;
}

#phone-panel-content .phone-screen .wechat-wallet-account-section-summary {
    min-width: 0;
    color: #747a74;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-account-empty {
    min-height: 156px;
    padding: 28px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    color: #a5aaa4;
    text-align: center;
}

#phone-panel-content .phone-screen .wechat-wallet-account-empty i {
    margin-bottom: 12px;
    color: #b7bdb5;
    font-size: 28px;
}

#phone-panel-content .phone-screen .wechat-wallet-account-empty strong {
    color: #737973;
    font-size: 12px;
    font-weight: 500;
}

#phone-panel-content .phone-screen .wechat-wallet-account-empty span {
    margin-top: 6px;
    font-size: 10px;
    line-height: 1.5;
}

#phone-panel-content .phone-screen .wechat-wallet-savings-row {
    min-height: 72px;
    padding: 10px;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    border-bottom: 1px solid #eef0ed;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-wallet-savings-row:last-child,
#phone-panel-content .phone-screen .wechat-wallet-liability-row:last-child {
    border-bottom: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-account-logo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 15px;
    flex: 0 0 auto;
}

#phone-panel-content .phone-screen .wechat-wallet-account-logo.is-savings { background: #4aa8dc; }
#phone-panel-content .phone-screen .wechat-wallet-account-logo.is-credit { background: #e86267; }
#phone-panel-content .phone-screen .wechat-wallet-account-logo.is-loan { background: #418fd0; }

#phone-panel-content .phone-screen .wechat-wallet-account-copy {
    min-width: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-account-name {
    overflow: hidden;
    color: #2a2e2a;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-account-detail {
    margin-top: 5px;
    overflow: hidden;
    color: #929792;
    font-size: 9px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-savings-balance {
    max-width: 112px;
    overflow: hidden;
    color: #222722;
    font-size: 14px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-savings-balance.is-compact {
    font-size: 11px;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-row {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    padding: 9px 9px 8px;
    border: 0;
    border-bottom: 1px solid #eceeea;
    background: #fff;
    color: inherit;
    font: inherit;
    text-align: left;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen button.wechat-wallet-liability-row {
    cursor: pointer;
}

#phone-panel-content .phone-screen button.wechat-wallet-liability-row:active {
    background: #f7f8f6;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-top {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto 10px;
    gap: 7px;
    align-items: center;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-top .wechat-wallet-account-logo {
    width: 32px;
    height: 32px;
    font-size: 13px;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-status {
    padding: 3px 7px;
    border-radius: 999px;
    background: #fff0f0;
    color: #e56569;
    font-size: 9px;
    line-height: 1.25;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-status.is-clear {
    background: #edf6ea;
    color: #5f9262;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-status.is-overdue {
    background: #fff0e8;
    color: #d76d3d;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-chevron {
    color: #929792;
    font-size: 9px;
    text-align: right;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 8px;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-metric {
    min-width: 0;
    padding: 0 7px;
    border-left: 1px solid #eceeea;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-metric:first-child {
    padding-left: 0;
    border-left: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-metric:last-child {
    padding-right: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-label,
#phone-panel-content .phone-screen .wechat-wallet-liability-value {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-label {
    color: #999e99;
    font-size: 8px;
    line-height: 1.35;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-value {
    margin-top: 3px;
    color: #303530;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
}

#phone-panel-content .phone-screen .wechat-wallet-liability-value.is-amount {
    color: #202520;
    font-size: 14px;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-overlay {
    position: absolute;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(25, 29, 25, 0.46);
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-dialog {
    width: 100%;
    max-height: 88%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 12px 12px 0 0;
    background: #f7f8f6;
    box-shadow: 0 -10px 30px rgba(28, 34, 29, 0.18);
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-header {
    min-height: 50px;
    padding: 0 14px;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) 32px;
    align-items: center;
    border-bottom: 1px solid #e6e9e4;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-header strong {
    grid-column: 2;
    justify-self: center;
    color: #282d29;
    font-size: 14px;
    font-weight: 650;
    text-align: center;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-close {
    grid-column: 3;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #6e746e;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-body {
    min-height: 0;
    padding: 12px;
    overflow-y: auto;
    touch-action: pan-y;
    overscroll-behavior: contain;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-summary {
    padding: 13px 14px;
    border: 1px solid #e3e7e1;
    border-radius: 8px;
    background: #fff;
    text-align: center;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-summary span,
#phone-panel-content .phone-screen .wechat-wallet-repayment-summary small {
    display: block;
    color: #858c85;
    font-size: 10px;
    line-height: 1.45;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-summary strong {
    display: block;
    margin: 4px 0 2px;
    color: #222722;
    font-size: 25px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-section-title {
    margin: 14px 2px 7px;
    color: #727972;
    font-size: 10px;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-sources {
    overflow: hidden;
    border: 1px solid #e3e7e1;
    border-radius: 8px;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source {
    min-height: 56px;
    padding: 8px 11px;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    border-bottom: 1px solid #eceeea;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source:last-child {
    border-bottom: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: #6e8c65;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source-copy {
    min-width: 0;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source-copy strong,
#phone-panel-content .phone-screen .wechat-wallet-repayment-source-copy span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source-copy strong {
    color: #2b302c;
    font-size: 12px;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source-copy span {
    margin-top: 3px;
    color: #929892;
    font-size: 9px;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-source-balance {
    color: #303530;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-error {
    min-height: 18px;
    margin-top: 8px;
    color: #d85f5f;
    font-size: 10px;
    line-height: 1.5;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-actions {
    padding: 10px 12px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    border-top: 1px solid #e3e7e1;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-actions button {
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-cancel {
    background: #eef0ed;
    color: #535953;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-confirm {
    background: #6e8c65;
    color: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-repayment-confirm:disabled {
    opacity: 0.65;
    cursor: wait;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-panel {
    min-height: 330px;
    margin: 0 12px;
    overflow: hidden;
    border: 1px solid #e4e7e2;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 6px 18px rgba(46, 58, 47, 0.06);
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-panel-header {
    min-height: 54px;
    padding: 0 10px;
    display: grid;
    grid-template-columns: minmax(80px, 1fr) auto;
    align-items: center;
    border-bottom: 1px solid #eceeea;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-heading {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #2c302d;
    font-size: 14px;
    font-weight: 650;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-heading i {
    color: #6f746f;
    font-size: 15px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filters {
    position: relative !important;
    display: grid !important;
    grid-template-columns: 96px 88px !important;
    align-items: stretch !important;
    gap: 8px !important;
    width: 192px !important;
    height: 52px !important;
    min-height: 52px !important;
    max-height: 52px !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filters::after {
    content: "";
    position: absolute;
    z-index: 1;
    left: 100px;
    top: 50%;
    height: 12px;
    transform: translateY(-50%);
    width: 1px;
    background: #e3e6e1;
    pointer-events: none;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filter {
    position: relative !important;
    display: block !important;
    min-width: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    height: 52px !important;
    min-height: 52px !important;
    max-height: 52px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    line-height: normal !important;
    overflow: hidden !important;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filter select {
    position: absolute !important;
    inset: 0 !important;
    z-index: 2 !important;
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: 52px !important;
    min-height: 52px !important;
    max-height: 52px !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    border: 0 !important;
    border-radius: 0 !important;
    outline: none !important;
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    color: transparent !important;
    font-family: inherit !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    line-height: normal !important;
    appearance: none !important;
    -webkit-appearance: none !important;
    opacity: 0 !important;
    transform: none !important;
    cursor: pointer !important;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filter-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    width: 100%;
    height: 52px;
    padding: 0 24px 0 2px;
    box-sizing: border-box;
    color: #535853;
    font-size: 12px;
    font-weight: 400;
    line-height: normal;
    white-space: nowrap;
    pointer-events: none;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-filter i {
    position: absolute;
    z-index: 1;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    color: #656a65;
    font-size: 9px;
    pointer-events: none;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-list {
    min-height: 276px;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-day {
    height: 34px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    background: #f5f6f4;
    color: #8a8d89;
    font-size: 11px;
    border-bottom: 1px solid #eceeea;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-row {
    min-height: 66px;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) minmax(74px, auto);
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    background: #fff;
    box-sizing: border-box;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-icon {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-transfer { background: #2d8cf0; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-redpacket { background: #e45b4b; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-honey { background: #cf4f8d; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-shopping { background: #e5a33b; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-repayment { background: #d95f65; }
#phone-panel-content .phone-screen .wechat-wallet-ledger-icon.is-other { background: #56a16a; }

#phone-panel-content .phone-screen .wechat-wallet-ledger-copy,
#phone-panel-content .phone-screen .wechat-wallet-ledger-money {
    min-width: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-bottom: 1px solid #ececec;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-name {
    color: #252925;
    font-size: 13px;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-detail {
    margin-top: 4px;
    color: #929792;
    font-size: 10px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-money {
    align-items: flex-end;
    text-align: right;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-amount {
    color: #202520;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-amount.is-income {
    color: #4d9c64;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-time {
    margin-top: 4px;
    color: #9a9e99;
    font-size: 10px;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-empty {
    min-height: 276px;
    padding: 34px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    text-align: center;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-empty-icon {
    width: 58px;
    height: 58px;
    margin-bottom: 16px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f0f3ed;
    color: #b4bbb1;
    font-size: 25px;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-empty strong {
    color: #777d76;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-empty > span:not(.wechat-wallet-ledger-empty-icon) {
    margin-top: 7px;
    color: #acb0aa;
    font-size: 10px;
    line-height: 1.5;
}

#phone-panel-content .phone-screen .wechat-wallet-ledger-footer {
    padding: 15px 0 22px;
    text-align: center;
    color: #a1a5a0;
    font-size: 10px;
    background: #fff;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-overlay {
    position: absolute;
    inset: 0;
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.42);
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-dialog {
    width: 100%;
    max-width: 320px;
    max-height: 82%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-header {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px 0 16px;
    border-bottom: 0.5px solid #ececec;
    flex-shrink: 0;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-title {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    color: #c62828;
    font-size: 15px;
    font-weight: 600;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-close {
    width: 30px;
    height: 30px;
    min-width: 30px;
    margin: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: #f2f2f2;
    color: #666;
    font-size: 14px;
    cursor: pointer;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-body {
    min-height: 0;
    overflow-y: auto;
    padding: 14px 16px 16px;
    box-sizing: border-box;
    touch-action: pan-y;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-summary {
    margin-bottom: 14px;
    padding: 10px 11px;
    border-left: 3px solid #ff5a52;
    background: #fff5f4;
    color: #7c2d28;
    font-size: 12px;
    line-height: 1.55;
    overflow-wrap: anywhere;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-label {
    margin-bottom: 7px;
    color: #666;
    font-size: 11px;
    font-weight: 600;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-response {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: #333;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    line-height: 1.55;
    user-select: text;
    -webkit-user-select: text;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-footer {
    padding: 10px 16px 14px;
    border-top: 0.5px solid #ececec;
    background: #fff;
    flex-shrink: 0;
}

#phone-panel-content .phone-screen .wechat-contact-generation-error-confirm {
    width: 100%;
    min-height: 38px;
    margin: 0;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: #07c160;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}

/* ========================================
   其他组件样式保持原样
   ======================================== */

/* 这里保留原有的发现页、个人页、通讯录、朋友圈等样式... */

/* 🔥 只要手机屏幕内存在聊天输入区，就自动隐藏底部的 Home 指示器三个点 */
.phone-screen:has(.chat-input-area) .phone-home-indicator {
    display: none !important;
}
        `;
            document.head.appendChild(style);
        }
    }

    _getMainShellBackgroundConfig() {
        const rawBg = String(this.wechatData?.getUserInfo?.()?.chatListBackground || '').trim();
        if (!rawBg) {
            return {
                appClass: 'wechat-app',
                appStyle: '',
                contentBgStyle: ''
            };
        }

        let appStyle = '';
        if (rawBg.startsWith('data:') || rawBg.startsWith('/') || rawBg.startsWith('http')) {
            appStyle = `background-image: url('${rawBg}'); background-size: cover; background-position: center;`;
        } else {
            appStyle = `background: ${rawBg};`;
        }

        return {
            appClass: 'wechat-app wechat-main-shell wechat-chatlist-bg-enabled',
            appStyle,
            contentBgStyle: 'background: transparent;'
        };
    }

    // 显示提示词编辑器
    showPromptEditor(app, feature) {
        const promptManager = window.VirtualPhone?.promptManager;

        // 🔥 确保提示词已加载（修复懒加载导致的 null 问题）
        if (promptManager && !promptManager._loaded) {
            promptManager.ensureLoaded();
        }

        let prompt = promptManager?.prompts?.[app]?.[feature];


        // 🔥 如果提示词不存在，尝试从默认配置获取
        if (!prompt) {
            console.warn('⚠️ 提示词不存在，尝试从默认配置获取');
            const defaults = promptManager?.getDefaultPrompts();
            prompt = defaults?.[app]?.[feature];
            if (prompt) prompt = { ...prompt };
        }

        if (!prompt) {
            console.error('❌ 无法找到提示词:', app, feature);
            this.phoneShell.showNotification('错误', '无法找到该提示词配置', '❌');
            return;
        }
        const shellBg = this._getMainShellBackgroundConfig();
        const editorContentStyle = `${shellBg.contentBgStyle || 'background: #ededed;'} padding: 15px;`;

        const html = `
        <div class="${shellBg.appClass}" style="${shellBg.appStyle}">
            <div class="wechat-header">
                <div class="wechat-header-left">
                    <button class="wechat-back-btn" id="back-from-editor">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div class="wechat-header-title">编辑提示词</div>
                <div class="wechat-header-right">
                    <button class="wechat-header-btn" id="copy-prompt" style="color: #07c160; font-size: 14px;">
                        复制
                    </button>
                </div>
            </div>
            
            <div class="wechat-content" style="${editorContentStyle}">
                <div style="background: rgba(255,255,255,0.94); color: #1f2933; border-radius: 12px; padding: 15px;">
                    <div style="font-size: 16px; font-weight: 500; color: #1f2933; margin-bottom: 8px;">
                        ${prompt.name}
                    </div>
                    <div style="font-size: 12px; color: #5f6368; margin-bottom: 15px;">
                        ${prompt.description}
                    </div>
                    
                    ${promptManager?.renderPromptPresetControls?.(app, feature) || ''}

                    <textarea id="prompt-editor" style="
                        width: 100%;
                        min-height: 300px;
                        padding: 12px;
                        background: #f7f7f7;
                        color: #1f2933;
                        caret-color: #07c160;
                        border: 1px solid #e5e5e5;
                        border-radius: 8px;
                        font-size: 14px;
                        font-family: monospace;
                        resize: vertical;
                        box-sizing: border-box;
                    ">${prompt.content}</textarea>
                    
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button id="reset-prompt" style="
                            flex: 1;
                            padding: 10px;
                            background: #f0f0f0;
                            color: #666;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            cursor: pointer;
                        ">恢复默认</button>

                        <button id="save-prompt" style="
                            flex: 1;
                            padding: 10px;
                            background: #07c160;
                            color: #fff;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            cursor: pointer;
                        ">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;

        this.phoneShell.setContent(html);
        promptManager?.bindPromptPresetControls?.(
            document.querySelector('.phone-view-current') || document,
            app,
            feature,
            '#prompt-editor',
            {
                notify: (title, message, icon) => this.phoneShell.showNotification(title, message, icon)
            }
        );

        // 返回按钮
        document.getElementById('back-from-editor')?.addEventListener('click', () => {
            this.showSettings();
        });

        // 保存按钮
        document.getElementById('save-prompt')?.addEventListener('click', () => {
            const content = document.getElementById('prompt-editor').value;
            try {
                promptManager?.updateActivePromptUserPreset?.(app, feature, content) ?? promptManager?.updatePrompt(app, feature, content);
                this.phoneShell.showNotification('保存成功', '提示词已更新', '✅');
            } catch (e) {
                this.phoneShell.showNotification('不能保存默认', e?.message || '请先新增预设再保存', '⚠️');
            }
        });

        // 恢复默认按钮
        document.getElementById('reset-prompt')?.addEventListener('click', () => {
            const defaultContent = promptManager?.resetPromptToDefault?.(app, feature)
                ?? promptManager?.getDefaultPrompts?.()?.[app]?.[feature]?.content
                ?? '';
            document.getElementById('prompt-editor').value = defaultContent;
            this.phoneShell.showNotification('已恢复', '已恢复为默认提示词', '🔄');
        });

        // 复制按钮
        document.getElementById('copy-prompt')?.addEventListener('click', () => {
            const textarea = document.getElementById('prompt-editor');
            textarea.select();
            document.execCommand('copy');
            this.phoneShell.showNotification('已复制', '提示词已复制到剪贴板', '📋');
        });
    }

    // 🔥 新增：批量添加联系人（支持AI生成的联系人）
    addContacts(contactsArray) {
        if (!Array.isArray(contactsArray)) {
            console.error('❌ addContacts 参数必须是数组');
            return;
        }

        let addedCount = 0;

        contactsArray.forEach(contact => {
            // 检查是否已存在（外部应用的 remark 是旧语义“真实姓名” → 映射到 realName）
            const syncedRealName = String(contact.realName || contact.remark || '').trim();
            const exists = this.wechatData.findContactAliasConflict?.(
                [contact.name, syncedRealName].filter(Boolean)
            );

            if (!exists) {
                const addedContact = this.wechatData.addContact({
                    id: `contact_${Date.now()}_${Math.random()}`,
                    name: contact.name,
                    avatar: contact.avatar || '👤',
                    realName: syncedRealName,
                    remark: String(contact.displayRemark || '').trim(),
                    relation: contact.relation || '',
                    letter: this.wechatData.getFirstLetter(contact.name)
                });
                if (contact.gender) {
                    this.wechatData.setContactGender?.(addedContact?.id || contact.name, contact.gender);
                }
                addedCount++;
            } else if (contact.gender && this.wechatData.getContactGender?.(exists.id || exists.name) === 'unknown') {
                this.wechatData.setContactGender?.(exists.id || exists.name, contact.gender);
            }
        });

        if (addedCount > 0) {

            // 如果当前在通讯录页面，刷新界面
            if (this.currentView === 'contacts') {
                this.render();
            }
        }

        return addedCount;
    }

    render() {
        try { installPhoneImageStore(); } catch (e) { }
        try { if (!document.documentElement.hasAttribute('data-wx-skin')) applyWechatSkinAttrs(this.getWechatSkin()); } catch (e) { }
        // 🔥 终极修复：强制从存储重新加载数据，彻底解决前后台实例脱步（Desync）问题
        // 🔥🔥🔥 核心修复：loadData() 返回 messages:{} 空对象（懒加载机制），
        // 所以必须同时重置 _messagesLoaded 标记，否则 getMessages() 会误以为已加载而跳过从存储读取！
        this.wechatData._messagesLoaded = {};
        this.wechatData._messagesDirty = {};
        this.wechatData.data = this.wechatData.loadData();

        // 🔥🔥🔥 核心修复：loadData() 后 currentChat 仍指向旧对象，必须重新绑定到新数据中的同ID聊天！
        // 否则 currentChat.unread = 0 只修改了旧对象，新数据中的未读数不变，红点无法消除。
        if (this.currentChat) {
            const refreshedChat = this.wechatData.getChat(this.currentChat.id);
            if (refreshedChat) {
                this.currentChat = refreshedChat;
            }
        }
        this._reconcileMusicListeningWithPlayback();

        this._wechatPanelMode = 'main';
        this._isAvatarManagerOpen = false;
        if (!this.currentChat) {
            this.chatView?.resetTransientInputPanels?.();
        }
        this._applyCustomChatStyle('');
        const chatList = this.wechatData.getChatList();

        // 🔥 强制消红点：只要用户看到了这个聊天，立即清空未读
        if (this.currentChat && this.currentChat.unread > 0) {
            this.currentChat.unread = 0;
            this.wechatData.saveData();
        }

        // 重新计算真实的未读总数
        const unreadCount = chatList.reduce((sum, chat) => sum + chat.unread, 0);

        // 🔥 始终同步最新的未读总数到全局 App 图标
        if (window.VirtualPhone?.home) {
            const apps = window.VirtualPhone.home.apps;
            if (apps) {
                const wechatAppIcon = apps.find(a => a.id === 'wechat');
                if (wechatAppIcon && wechatAppIcon.badge !== unreadCount) {
                    wechatAppIcon.badge = unreadCount;
                    window.dispatchEvent(new CustomEvent('phone:updateGlobalBadge'));

                    // 🔥 核心修复：必须持久化存储修改后的全局角标，否则页面刷新又会把旧的错误角标读出来
                    if (window.VirtualPhone.storage) {
                        window.VirtualPhone.storage.saveApps(apps);
                    }
                }
            }
        }

        // 根据当前视图决定顶部栏内容
        const getHeaderTitle = () => {
            if (this.currentChat) {
                // 🔥 群聊：标题可点击，显示群人数（+1 代表用户自己）
                if (this.currentChat.type === 'group') {
                    const memberCount = (this.currentChat.members?.length || 0) + 1;
                    const shortName = this.getShortGroupName(this.currentChat.name, 6);
                    return `<span id="group-header-title" style="cursor: pointer;">${shortName}<span style="color:#666;">(${memberCount})</span></span>`;
                }
                const currentContact = this.currentChat.contactId
                    ? this.wechatData.getContact(this.currentChat.contactId)
                    : this.wechatData.getContactByName(this.currentChat.name);
                // 🏷️ 有显示备注时，聊天窗口标题优先显示备注
                const nickname = String(currentContact?.remark || '').trim()
                    || String(currentContact?.name || this.currentChat.name || '').trim();
                const isHoneyContact = currentContact?.sourceApp === 'honey' || currentContact?.sourceLabel === '蜜语' || currentContact?.sourceLabel === '主播';
                if (!isHoneyContact) return nickname;
                const honeyLabel = currentContact?.sourceLabel === '主播' || String(currentContact?.relation || '').includes('主播') ? '主播' : '蜜语';
                return `
                    <span style="position:relative; display:inline-flex; align-items:center; justify-content:center; line-height:1.1; overflow:visible;">
                        <span style="position:absolute; left:50%; top:-11px; transform:translateX(-50%); display:inline-flex; align-items:center; gap:3px; padding:1px 5px; border-radius:999px; background:rgba(255,105,180,0.14); color:#ff5fa2; font-size:8px; line-height:1; border:1px solid rgba(255,105,180,0.24); white-space:nowrap;">
                            <i class="fa-solid fa-heart" style="font-size:7px;"></i>${honeyLabel}
                        </span>
                        <span>${nickname}</span>
                    </span>
                `;
            }
            if (this.currentView === 'discover') return '';
            return '微信';
        };

        const getMusicListenIndicator = () => {
            if (!this.currentChat) return '';
            const session = this.wechatData.getMusicListening?.(this.currentChat.id);
            if (!session) return '';
            return `
                <span class="wechat-music-listen-indicator" title="正在一起听歌" aria-label="正在一起听歌">
                    <span></span><span></span><span></span>
                </span>
            `;
        };

        const getHeaderRight = () => {
            if (this.currentChat) {
                return `<button class="wechat-header-btn" id="chat-info" aria-label="聊天设置">
                    <i class="fa-solid fa-ellipsis"></i>
                    <svg class="wx-bars-icon" viewBox="0 0 20 16" width="19" height="15" aria-hidden="true"><path d="M2 2h16M2 8h16M2 14h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>`;
            }
            if (this.currentView === 'discover') {
                return `
                    <button class="wechat-header-btn${this.momentsView?.isLoading ? ' is-busy' : ''}" id="moments-generate-btn" title="生成朋友圈">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                    <button class="wechat-header-btn" id="moments-post-btn" title="发朋友圈">
                        <i class="fa-solid fa-camera"></i>
                    </button>`;
            }
            return `
                <button class="wechat-header-btn" id="wechat-search">
                    <i class="fa-solid fa-search"></i>
                </button>
                <button class="wechat-header-btn" id="wechat-add">
                    <i class="fa-solid fa-plus"></i>
                </button>
            `;
        };

        const userInfo = this.wechatData.getUserInfo();
        const isMainRootView = !this.currentChat;
        const chatListBg = String(userInfo?.chatListBackground || '').trim();
        const hasMainShellBackground = isMainRootView && !!chatListBg;

        // 🔥 新增：把背景贴在整个APP最底层
        let appBgStyle = '';
        // 🎨 聊天背景只铺在消息区域（顶栏、输入栏跟随界面风格）；没设背景时用风格自带的底色
        let chatAreaBgStyle = '';
        if (this.currentChat) {
            const targetBg = this.wechatData.getChatBackground(this.currentChat.id, '');
            if (targetBg && (targetBg.startsWith('data:') || targetBg.startsWith('/') || targetBg.startsWith('http'))) {
                chatAreaBgStyle = `background-image: url('${targetBg}'); background-size: cover; background-position: center;`;
            } else if (targetBg) {
                chatAreaBgStyle = `background: ${targetBg};`;
            }
        } else if (hasMainShellBackground) {
            if (chatListBg.startsWith('data:') || chatListBg.startsWith('/') || chatListBg.startsWith('http')) {
                appBgStyle = `background-image: url('${chatListBg}'); background-size: cover; background-position: center;`;
            } else {
                appBgStyle = `background: ${chatListBg};`;
            }
        }

        const headerClass = [
            'wechat-header',
            this.currentView === 'discover' && !this.currentChat ? 'moments-header-style moments-header-overlay' : '',
            isMainRootView && this.currentView !== 'discover' ? 'wechat-header-chatlist-glass' : ''
        ].filter(Boolean).join(' ');
        const appClass = [
            'wechat-app',
            isMainRootView ? 'wechat-main-shell' : '',
            hasMainShellBackground ? 'wechat-chatlist-bg-enabled' : ''
        ].filter(Boolean).join(' ');
        const contentBgStyle = this.currentChat
            ? (chatAreaBgStyle || 'background: transparent;')
            : (hasMainShellBackground ? 'background: transparent;' : '');

        const html = `
            <div class="${appClass}" style="${appBgStyle}">
                <!-- 顶部栏 -->
                <div class="${headerClass}">
                    <div class="wechat-header-left">
                        <button class="wechat-back-btn" id="wechat-back" type="button"
                                aria-label="${this.currentChat ? '返回微信列表' : '返回手机桌面'}"
                                title="${this.currentChat ? '返回微信列表' : '返回桌面'}">
                            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="wechat-header-title">
                        ${this.currentChat ? `<span class="wx-head-avatar">${(() => {
                            try {
                                if (this.currentChat.type === 'group') return this.renderAvatar(this.currentChat.avatar, '👥', this.currentChat.name);
                                const c = this.currentChat.contactId ? this.wechatData.getContact(this.currentChat.contactId) : this.wechatData.getContactByName(this.currentChat.name);
                                return this.renderAvatar(c?.avatar || this.currentChat.avatar, '👤', c?.name || this.currentChat.name);
                            } catch (e) { return ''; }
                        })()}</span>` : ''}
                        <span class="wechat-header-title-text">
                            ${getHeaderTitle()}
                            ${this.currentChat ? `<span class="status-dot ${this.chatView?.getHeaderStatusDotClass?.(this.currentChat.id) || 'dot-green'}"></span>` : ''}
                            ${getMusicListenIndicator()}
                        </span>
                        ${this.currentChat ? (() => {
                            if (this.currentChat.type === 'group') return '';
                            const dot = this.chatView?.getHeaderStatusDotClass?.(this.currentChat.id) || 'dot-green';
                            return dot === 'dot-red' ? '<span class="wx-head-sub is-off">离开</span>' : (dot === 'dot-yellow' ? '<span class="wx-head-sub is-busy">忙碌</span>' : '<span class="wx-head-sub">在线</span>');
                        })() : ''}
                        ${unreadCount > 0 && !this.currentChat && this.currentView !== 'discover' ? `<span class="header-badge">(${unreadCount})</span>` : ''}
                    </div>
                    <div class="wechat-header-right">
                        ${getHeaderRight()}
                    </div>
                </div>

                <!-- 内容区 (如果在聊天中，让内容区变透明以透出底部背景) -->
                <div class="wechat-content" id="wechat-content" style="${contentBgStyle}">
                    ${this.renderContent()}
                </div>

                <!-- 底部导航（主页才显示）-->
                ${!this.currentChat ? `
                    <div class="wechat-tabbar">
                        <div class="wechat-tab ${this.currentView === 'chats' ? 'active' : ''}" data-view="chats">
                            <i class="fa-solid fa-comment"></i>
                            <span>微信</span>
                            ${unreadCount > 0 ? `<span class="tab-badge">${unreadCount}</span>` : ''}
                        </div>
                        <div class="wechat-tab ${this.currentView === 'contacts' ? 'active' : ''}" data-view="contacts">
                            <i class="fa-solid fa-address-book"></i>
                            <span>通讯录</span>
                        </div>
                        <div class="wechat-tab ${this.currentView === 'discover' ? 'active' : ''}" data-view="discover">
                            <svg class="wechat-moments-tab-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="m14.31 8 5.74 9.94"></path>
                                <path d="M9.69 8h11.48"></path>
                                <path d="m7.38 12 5.74-9.94"></path>
                                <path d="M9.69 16 3.95 6.06"></path>
                                <path d="M14.31 16H2.83"></path>
                                <path d="m16.62 12-5.74 9.94"></path>
                            </svg>
                            <span>${({ qq: '空间', line: '动态' })[this.getWechatSkin?.().moments] || '朋友圈'}</span>
                            ${this.wechatData.hasUnreadMoments?.() ? '<span class="wechat-moments-unread-dot" aria-label="有未查看的朋友圈"></span>' : ''}
                        </div>
                        <div class="wechat-tab ${this.currentView === 'me' ? 'active' : ''}" data-view="me">
                            <i class="fa-solid fa-user"></i>
                            <span>我</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // 🔥 让4个主页面共享同一个底层 ID，防止互相切换时不断增加历史记录栈
        const viewId = this.currentChat ? `wechat-chat-${this.currentChat.id}` : `wechat-main`;
        this.phoneShell.setContent(html, viewId);
        this.bindEvents();

        if (this.currentView === 'contacts' && !this.currentChat) {
            setTimeout(() => {
                this.contactsView.bindEvents();
            }, 50);
        }
    }

    // ========================================
    // 🔥 头像渲染辅助函数
    // ========================================
    _getWechatBaseUrl() {
        const normalizeBase = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            return raw.endsWith('/') ? raw : `${raw}/`;
        };

        const configured = normalizeBase(window.VirtualPhone?.extensionBaseUrl);
        if (configured) return configured;

        const metaBase = normalizeBase(new URL('../../', import.meta.url).href);
        const runtimePath = String(window.location?.pathname || '');
        const runtimeMatch = runtimePath.match(/(\/scripts\/extensions\/third-party\/)([^/]+)(\/)/i);
        const metaMatch = metaBase.match(/(\/scripts\/extensions\/third-party\/)([^/]+)(\/)/i);
        if (!runtimeMatch || !metaMatch || runtimeMatch[2] === metaMatch[2]) {
            return metaBase;
        }

        return metaBase.replace(metaMatch[0], `${metaMatch[1]}${runtimeMatch[2]}${metaMatch[3]}`);
    }

    _getWechatAssetUrl(relPath) {
        const safeRel = String(relPath || '').replace(/^\/+/, '');
        const base = this._getWechatBaseUrl();
        return new URL(`apps/wechat/${safeRel}`, base).href;
    }

    _resolveWechatAvatarAssetUrl(inputPath) {
        const raw = String(inputPath || '').trim().replace(/\\/g, '/');
        if (!raw || raw.includes('..')) return '';
        if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) {
            return raw;
        }
        return this._getWechatAssetUrl(`avatars/${raw.replace(/^\.?\//, '')}`);
    }

    _normalizeWechatAvatarList(list) {
        const src = Array.isArray(list) ? list : [];
        const out = [];
        const seen = new Set();
        src.forEach((item) => {
            const resolved = this._resolveWechatAvatarAssetUrl(item);
            if (!resolved || seen.has(resolved)) return;
            seen.add(resolved);
            out.push(resolved);
        });
        return out;
    }

    _normalizeWechatAvatarPool(rawPayload) {
        const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};
        const male = this._normalizeWechatAvatarList([
            ...(Array.isArray(payload.male) ? payload.male : []),
            ...(Array.isArray(payload.maleAvatars) ? payload.maleAvatars : [])
        ]);
        const female = this._normalizeWechatAvatarList([
            ...(Array.isArray(payload.female) ? payload.female : []),
            ...(Array.isArray(payload.femaleAvatars) ? payload.femaleAvatars : [])
        ]);
        const maleElder = this._normalizeWechatAvatarList([
            ...(Array.isArray(payload.male_elder) ? payload.male_elder : []),
            ...(Array.isArray(payload.maleElder) ? payload.maleElder : []),
            ...(Array.isArray(payload.elderMale) ? payload.elderMale : [])
        ]);
        const femaleElder = this._normalizeWechatAvatarList([
            ...(Array.isArray(payload.female_elder) ? payload.female_elder : []),
            ...(Array.isArray(payload.femaleElder) ? payload.femaleElder : []),
            ...(Array.isArray(payload.elderFemale) ? payload.elderFemale : [])
        ]);
        const all = this._normalizeWechatAvatarList([
            ...(Array.isArray(payload.all) ? payload.all : []),
            ...male,
            ...female,
            ...maleElder,
            ...femaleElder
        ]);
        return { male, female, male_elder: maleElder, female_elder: femaleElder, all };
    }

    async _probeAvatarUrlExists(url) {
        const target = String(url || '').trim();
        if (!target) return false;
        try {
            let resp = await fetch(target, { method: 'HEAD', cache: 'no-cache' });
            if (resp.ok) return true;
            if (resp.status === 405 || resp.status === 403) {
                resp = await fetch(target, { method: 'GET', cache: 'no-cache' });
                return !!resp.ok;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    async _discoverWechatAvatarSeries(prefix, maxCount = 200) {
        const safePrefix = String(prefix || '').trim().toLowerCase();
        if (!safePrefix) return [];
        const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        const out = [];
        let missBeforeStart = 0;
        let missStreakAfterStart = 0;
        let hasFoundAny = false;

        for (let idx = 1; idx <= maxCount; idx++) {
            const num = String(idx).padStart(3, '0');
            let foundUrl = '';
            for (const ext of exts) {
                const url = this._getWechatAssetUrl(`avatars/${safePrefix}${num}.${ext}`);
                // eslint-disable-next-line no-await-in-loop
                const exists = await this._probeAvatarUrlExists(url);
                if (exists) {
                    foundUrl = url;
                    break;
                }
            }

            if (foundUrl) {
                out.push(foundUrl);
                hasFoundAny = true;
                missStreakAfterStart = 0;
                continue;
            }

            if (!hasFoundAny) {
                missBeforeStart += 1;
                if (missBeforeStart >= 6) break;
            } else {
                missStreakAfterStart += 1;
                if (missStreakAfterStart >= 8) break;
            }
        }

        return out;
    }

    _hashText(text) {
        const input = String(text || '');
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    _getAvatarPoolByGender(gender = 'unknown', avatarGroup = '') {
        const safeGender = String(gender || '').trim().toLowerCase();
        const safeGroup = String(avatarGroup || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
        const male = Array.isArray(this._avatarPool?.male) ? this._avatarPool.male : [];
        const female = Array.isArray(this._avatarPool?.female) ? this._avatarPool.female : [];
        const maleElder = Array.isArray(this._avatarPool?.male_elder) ? this._avatarPool.male_elder : [];
        const femaleElder = Array.isArray(this._avatarPool?.female_elder) ? this._avatarPool.female_elder : [];

        if (safeGroup === 'male_elder') return maleElder.length > 0 ? maleElder : male;
        if (safeGroup === 'female_elder') return femaleElder.length > 0 ? femaleElder : female;
        if (safeGroup === 'male') return male.length > 0 ? male : maleElder;
        if (safeGroup === 'female') return female.length > 0 ? female : femaleElder;
        if (safeGender === 'male') return male.length > 0 ? male : maleElder;
        if (safeGender === 'female') return female.length > 0 ? female : femaleElder;

        // 未识别性别时保留文字头像，避免从男女混合池抽到明显不匹配的头像。
        return [];
    }

    _isCustomAvatarValue(avatarStr = '') {
        const raw = String(avatarStr || '').trim();
        if (!raw) return false;
        return raw.startsWith('data:image')
            || raw.startsWith('http://')
            || raw.startsWith('https://')
            || raw.startsWith('/');
    }

    _isWechatAvatarPoolAssetValue(avatarStr = '') {
        const normalized = this._normalizeAvatarPathForLookup(avatarStr).replace(/\\/g, '/');
        if (!normalized) return false;
        if (/(?:^|\/)apps\/wechat\/avatars\/(?:male|female)(?:_elder)?\d+\.(?:png|jpe?g|webp|gif)$/i.test(normalized)) {
            return true;
        }
        return (Array.isArray(this._avatarPool?.all) ? this._avatarPool.all : [])
            .some(item => this._normalizeAvatarPathForLookup(item).replace(/\\/g, '/') === normalized);
    }

    _resolveContactGenderByName(name = '') {
        const safeName = String(name || '').trim();
        if (!safeName) return 'unknown';
        const contact = this.wechatData?.findContactByNameLoose?.(safeName, { includeChats: false })
            || this.wechatData?.getContactByName?.(safeName);
        return this.wechatData?.getContactGender?.(contact?.id || safeName) || 'unknown';
    }

    _resolveContactAvatarGroupByName(name = '') {
        const safeName = String(name || '').trim();
        if (!safeName) return '';
        const contact = this.wechatData?.findContactByNameLoose?.(safeName, { includeChats: false })
            || this.wechatData?.getContactByName?.(safeName);
        return this.wechatData?.getContactAvatarGroup?.(contact?.id || safeName) || '';
    }

    _pickStableAvatarFromPool(pool = [], seed = '') {
        if (!Array.isArray(pool) || pool.length === 0) return '';
        const idx = this._hashText(String(seed || '')) % pool.length;
        return String(pool[idx] || '').trim();
    }

    _collectUsedAutoAvatarsInPool(pool = [], ignoreContactId = '') {
        const out = new Set();
        if (!Array.isArray(pool) || pool.length === 0) return out;
        const contacts = Array.isArray(this.wechatData?.getContacts?.()) ? this.wechatData.getContacts() : [];
        const poolSet = new Set(pool);
        contacts.forEach((contact) => {
            const contactId = String(contact?.id || '').trim();
            if (!contactId || contactId === ignoreContactId) return;
            if (this._isCustomAvatarValue(contact?.avatar || '')) return;
            const assigned = String(this.wechatData?.getContactAutoAvatar?.(contactId) || '').trim();
            if (assigned && poolSet.has(assigned)) {
                out.add(assigned);
            }
        });
        return out;
    }

    _resolveAutoAvatarForName(name = '', gender = 'unknown', avatarGroup = '') {
        const safeName = String(name || '').trim();
        if (!safeName || !this._avatarPoolLoaded) return '';
        const safeGroup = String(avatarGroup || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
        const pool = this._getAvatarPoolByGender(gender, safeGroup);
        if (!Array.isArray(pool) || pool.length === 0) return '';

        const contact = this.wechatData?.findContactByNameLoose?.(safeName, { includeChats: false })
            || this.wechatData?.getContactByName?.(safeName);
        const contactId = String(contact?.id || '').trim();
        const stableSeed = `${safeName}|${gender}|${safeGroup}`;

        // 非通讯录临时对象：使用稳定映射，避免每次重绘随机跳变
        if (!contactId) {
            return this._pickStableAvatarFromPool(pool, stableSeed);
        }

        const existing = String(this.wechatData?.getContactAutoAvatar?.(contactId) || '').trim();
        const poolSet = new Set(pool);
        const usedByOthers = this._collectUsedAutoAvatarsInPool(pool, contactId);

        // 已分配头像仍有效且未与他人冲突，直接复用
        if (existing && poolSet.has(existing) && !usedByOthers.has(existing)) {
            return existing;
        }

        // 优先选未被其他角色占用的头像；池耗尽后允许复用
        const available = pool.filter(url => !usedByOthers.has(url));
        const candidatePool = available.length > 0 ? available : pool;
        const picked = this._pickStableAvatarFromPool(candidatePool, stableSeed);
        if (picked) {
            this.wechatData?.setContactAutoAvatar?.(contactId, picked);
        }
        return picked;
    }

    _shouldApplyContactPoolAvatar(defaultEmoji = '👤', fallbackName = '') {
        if (String(defaultEmoji || '') === '👥') return false;
        const safeName = String(fallbackName || '').trim();
        if (!safeName) return false;
        const selfName = String(this.wechatData?.getUserInfo?.()?.name || '').trim();
        return !selfName || safeName !== selfName;
    }

    _ensureWechatAvatarPoolLoaded() {
        if (this._avatarPoolLoaded || this._avatarPoolLoading) return this._avatarPoolPromise;
        this._avatarPoolLoading = true;
        const manifestUrl = this._getWechatAssetUrl(`avatars/manifest.json?t=${Date.now()}`);

        const finalize = (pool) => {
            this._avatarPool = this._normalizeWechatAvatarPool(pool);
            this._avatarPoolLoaded = true;
            this._avatarPoolLoading = false;
            const isWechatActive = !!document.querySelector('.phone-view-current .wechat-app');
            const isCallOverlayVisible = !!document.querySelector('.phone-view-current .call-fullscreen');

            if (this._wechatPanelMode === 'avatar-manager' || this._isAvatarManagerOpen) {
                this.showAvatarManager();
                return;
            }

            // 仅在微信主界面可见且不在通话全屏时刷新，避免打断设置页/通话页
            const isChatSending = !!this.chatView?.isSending;
            if (this._wechatPanelMode === 'main' && isWechatActive && !isCallOverlayVisible && !isChatSending) {
                this.render();
            }
        };

        this._avatarPoolPromise = fetch(manifestUrl, { cache: 'no-store' })
            .then(resp => (resp.ok ? resp.text() : ''))
            .then(async (rawText) => {
                let payload = null;
                try {
                    const normalizedText = String(rawText || '').replace(/^\uFEFF/, '').trim();
                    payload = normalizedText ? JSON.parse(normalizedText) : null;
                } catch (e) {
                    payload = null;
                }

                let pool = this._normalizeWechatAvatarPool(payload);
                const groups = [
                    ['male', 'male'],
                    ['female', 'female'],
                    ['male_elder', 'male_elder'],
                    ['female_elder', 'female_elder']
                ];
                const discovered = await Promise.all(groups.map(([key, prefix]) => (
                    pool[key].length > 0
                        ? Promise.resolve([])
                        : this._discoverWechatAvatarSeries(prefix, 200)
                )));
                pool = this._normalizeWechatAvatarPool({
                    all: pool.all,
                    male: pool.male.length > 0 ? pool.male : discovered[0],
                    female: pool.female.length > 0 ? pool.female : discovered[1],
                    male_elder: pool.male_elder.length > 0 ? pool.male_elder : discovered[2],
                    female_elder: pool.female_elder.length > 0 ? pool.female_elder : discovered[3]
                });
                finalize(pool);
            })
            .catch(() => finalize(null));
        return this._avatarPoolPromise;
    }

    _normalizeAvatarPathForLookup(value = '') {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            if (/^https?:\/\//i.test(raw)) {
                return new URL(raw).pathname.split('?')[0].split('#')[0];
            }
        } catch (e) { }
        return raw.split('?')[0].split('#')[0];
    }

    _isManagedWechatAvatarPath(value = '') {
        return /^(?:\/backgrounds\/|\/user\/images\/yuzuki-phone\/)phone_(?:contact|avatar|wechat|chat|group|friend)_/i.test(this._normalizeAvatarPathForLookup(value));
    }

    handleWechatAvatarImageError(img, avatarValue = '') {
        const normalizedPath = this._normalizeAvatarPathForLookup(avatarValue || img?.getAttribute?.('data-avatar-src') || img?.getAttribute?.('src') || '');
        img?.remove?.();
        if (!normalizedPath || !this._isManagedWechatAvatarPath(normalizedPath) || this._missingAvatarPaths.has(normalizedPath)) return;
        this._missingAvatarPaths.add(normalizedPath);
        this._clearMissingWechatAvatarPath(normalizedPath);
    }

    _clearMissingWechatAvatarPath(pathLike = '') {
        const path = this._normalizeAvatarPathForLookup(pathLike);
        if (!path) return false;
        const data = this.wechatData?.data;
        if (!data) return false;
        let changed = false;
        const samePath = (value) => this._normalizeAvatarPathForLookup(value) === path;

        if (samePath(data.userInfo?.avatar)) {
            data.userInfo.avatar = '';
            changed = true;
        }
        (Array.isArray(data.contacts) ? data.contacts : []).forEach((contact) => {
            if (samePath(contact?.avatar)) {
                contact.avatar = '';
                changed = true;
                this.wechatData?._syncHoneyContactToGlobalStore?.(contact);
            }
        });
        (Array.isArray(data.chats) ? data.chats : []).forEach((chat) => {
            if (samePath(chat?.avatar)) {
                chat.avatar = '';
                changed = true;
            }
        });
        Object.values(data.messages || {}).forEach((messages) => {
            if (!Array.isArray(messages)) return;
            messages.forEach((message) => {
                if (samePath(message?.avatar)) {
                    message.avatar = '';
                    changed = true;
                }
                if (samePath(message?.senderAvatar)) {
                    message.senderAvatar = '';
                    changed = true;
                }
            });
        });

        if (changed) {
            this.wechatData.saveData?.();
            this.render?.();
        }
        return changed;
    }

    renderAvatar(avatar, defaultEmoji = '👤', fallbackName = '') {
        const avatarStr = String(avatar || '').trim();
        this._ensureWechatAvatarPoolLoaded();

        const pickFirstChar = (text) => {
            const arr = Array.from(String(text || '').trim());
            return arr.length > 0 ? arr[0] : '';
        };
        const isEmojiLike = (text) => /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(String(text || ''));
        const escapeHtml = (text) => String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const escapeAttr = (text) => escapeHtml(text);

        // 优先使用显示名首字；其次使用非emoji头像文本首字
        let initial = pickFirstChar(fallbackName);
        if (!initial && avatarStr && !isEmojiLike(avatarStr)) {
            initial = pickFirstChar(avatarStr);
        }

        if (!initial) {
            if (defaultEmoji === '👥') {
                initial = '群';
            } else {
                initial = '我';
            }
        }

        const initialHtml = `<div style="position:relative;width:100%;height:100%;background:#fff;color:#000;border:none;outline:none;box-shadow:none;"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);line-height:1;white-space:nowrap;">${escapeHtml(initial)}</span></div>`;
        const imageStyle = 'display:block;width:100%;height:100%;object-fit:cover;border:none;outline:none;box-shadow:none;border-radius:inherit;';

        let autoAvatar = '';
        if (this._shouldApplyContactPoolAvatar(defaultEmoji, fallbackName)) {
            const resolvedGender = this._resolveContactGenderByName(fallbackName);
            const resolvedGroup = this._resolveContactAvatarGroupByName(fallbackName);
            autoAvatar = this._resolveAutoAvatarForName(fallbackName, resolvedGender, resolvedGroup);
        }

        // 用户自定义头像优先；如果图片资源被删除/失效，自动回退到性别默认头像。
        if (this._isCustomAvatarValue(avatarStr) && !this._isWechatAvatarPoolAssetValue(avatarStr)) {
            if (this._missingAvatarPaths.has(this._normalizeAvatarPathForLookup(avatarStr))) return autoAvatar
                ? `<span style="display:block;position:relative;width:100%;height:100%;">${initialHtml}<img src="${escapeAttr(autoAvatar)}" style="${imageStyle};position:absolute;inset:0;" onerror="this.remove();"></span>`
                : initialHtml;
            const errorHandler = 'window.VirtualPhone?.wechatApp?.handleWechatAvatarImageError?.(this)';
            if (autoAvatar) {
                return `<span style="display:block;position:relative;width:100%;height:100%;">${initialHtml}<img src="${escapeAttr(avatarStr)}" data-avatar-src="${escapeAttr(avatarStr)}" style="${imageStyle};position:absolute;inset:0;" onerror="${errorHandler};this.onerror=function(){this.remove();};this.src='${escapeAttr(autoAvatar)}';"></span>`;
            }
            return `<span style="display:block;position:relative;width:100%;height:100%;">${initialHtml}<img src="${escapeAttr(avatarStr)}" data-avatar-src="${escapeAttr(avatarStr)}" style="${imageStyle};position:absolute;inset:0;" onerror="${errorHandler}"></span>`;
        }

        // 联系人头像池：无自定义头像时，按性别随机分配（稳定映射）
        if (autoAvatar) {
            return `<span style="display:block;position:relative;width:100%;height:100%;">${initialHtml}<img src="${escapeAttr(autoAvatar)}" style="${imageStyle};position:absolute;inset:0;" onerror="this.remove();"></span>`;
        }

        return initialHtml;
    }

    syncMusicListenHeaderIndicator(chatId = '') {
        const safeChatId = String(chatId || this.currentChat?.id || '').trim();
        if (!safeChatId || String(this.currentChat?.id || '').trim() !== safeChatId) return;
        const title = document.querySelector('.phone-view-current .wechat-header-title-text')
            || document.querySelector('.wechat-header-title-text');
        if (!title) return;

        title.querySelector('.wechat-music-listen-indicator')?.remove();
        const session = this.wechatData.getMusicListening?.(safeChatId);
        if (!session) return;

        const indicator = document.createElement('span');
        indicator.className = 'wechat-music-listen-indicator';
        indicator.title = '正在一起听歌';
        indicator.setAttribute('aria-label', '正在一起听歌');
        indicator.innerHTML = '<span></span><span></span><span></span>';
        title.appendChild(indicator);
    }

    endMusicListening(chatId = '', options = {}) {
        const safeChatId = String(chatId || this.currentChat?.id || '').trim();
        if (!safeChatId) return false;
        const changed = this.wechatData.endMusicListening?.(safeChatId, options)
            || this.wechatData.stopMusicListening?.(safeChatId);
        if (!changed) return false;

        if (String(this.currentChat?.id || '').trim() === safeChatId) {
            const messages = this.wechatData.getMessages(safeChatId);
            const userInfo = this.wechatData.getUserInfo();
            this.chatView?.smartUpdateMessages?.(messages, userInfo);
            this.syncMusicListenHeaderIndicator(safeChatId);
        }
        return true;
    }

    _reconcileMusicListeningWithPlayback() {
        const sessions = this.wechatData?.data?.musicListening || {};
        const activeChatIds = Object.keys(sessions).filter(chatId => sessions[chatId]?.active !== false);
        if (activeChatIds.length === 0) return;

        const musicData = window.VirtualPhone?.musicApp?.musicData || null;
        const isActuallyPlaying = !!(
            musicData
            && musicData.isPlaying
            && musicData.audioPlayer
            && !musicData.audioPlayer.paused
        );
        if (isActuallyPlaying) return;

        activeChatIds.forEach(chatId => {
            this.wechatData.endMusicListening?.(chatId, { reason: 'playback_not_active' });
        });
    }

    // 群名显示：超过6个字时缩写，人数不参与缩写
    getShortGroupName(name, maxLen = 6) {
        const chars = Array.from(String(name || '').trim());
        if (chars.length <= maxLen) return chars.join('');
        return `${chars.slice(0, maxLen).join('')}...`;
    }

    renderContent() {
        if (this.currentChat) {
            return this.chatView.renderChatRoom(this.currentChat);
        }

        switch (this.currentView) {
            case 'chats':
                return this.renderChatList();
            case 'contacts':
                return this.contactsView.render();
            case 'discover':
                return this.renderDiscover();
            case 'me':
                return this.renderProfile();
            default:
                return this.renderChatList();
        }
    }

    renderChatList() {
        const chats = this.wechatData.getChatList();
        const storyTime = window.VirtualPhone?.timeManager?.getCurrentStoryTime?.() || {};
        const filter = this._chatListFilter || 'all';
        const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const singles = chats.filter(c => c.type !== 'group').length;
        const groups = chats.filter(c => c.type === 'group').length;
        const shown = chats.filter(c => filter === 'all' || (filter === 'group' ? c.type === 'group' : c.type !== 'group'));
        const itemHtml = chat => {
            const pinned = Number(chat.pinnedAt || 0) > 0;
            const display = chat.type === 'group' ? chat.name : this._getChatDisplayName(chat);
            const searchKey = [chat.name, display].join(' ').toLowerCase();
            return `
                    <div class="chat-item${pinned ? ' is-pinned' : ''}" data-chat-id="${chat.id}" data-search="${esc(searchKey)}">
                        ${pinned ? '<span class="chat-pin-corner" title="已置顶"><svg viewBox="0 0 16 16"><path d="M3 2.2h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 4.6 3.6 9.2h2.8V14h3.2V9.2h2.8z" fill="currentColor"/></svg></span>' : ''}
                        <div class="chat-avatar">
                            ${this.renderAvatar(chat.avatar, chat.type === 'group' ? '👥' : '👤', chat.name)}
                            ${chat.unread > 0 ? `<span class="chat-badge">${chat.unread > 99 ? '99+' : chat.unread}</span>` : ''}
                        </div>
                        <div class="chat-info">
                            <div class="chat-row-top">
                                <div class="chat-name${chat.type === 'group' ? ' has-count' : ''}">${chat.type === 'group' ? `<span class="chat-name-text">${chat.name}</span><span class="group-count">(${(chat.members?.length || 0) + 1})</span>` : display}</div>
                                <div class="chat-time">${formatWechatChatListTime(chat, storyTime)}</div>
                            </div>
                            <div class="chat-last-msg" data-orig="${esc(chat.lastMessage || '暂无消息')}">${chat.lastMessage || '暂无消息'}</div>
                        </div>
                    </div>`;
        };
        return `
            <div class="wechat-chat-list wcl-v2">
                <div class="wcl-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="wcl-search-input" placeholder="搜索聊天内容或联系人" value="${esc(this._chatListQuery || '')}">
                    <button type="button" class="wcl-search-clear" id="wcl-search-clear" ${this._chatListQuery ? '' : 'hidden'}>✕</button>
                </div>
                ${this.mindNotes?.renderMindRow?.() || ''}
                <div class="wcl-section">
                    <span class="wcl-title">消息</span>
                    <div class="wcl-filter">
                        <button type="button" data-wcl-filter="all" class="${filter === 'all' ? 'is-on' : ''}">全部 <small>${chats.length}</small></button>
                        <button type="button" data-wcl-filter="single" class="${filter === 'single' ? 'is-on' : ''}">单聊 <small>${singles}</small></button>
                        <button type="button" data-wcl-filter="group" class="${filter === 'group' ? 'is-on' : ''}">群聊 <small>${groups}</small></button>
                    </div>
                </div>
                <div class="wcl-items">
                    ${shown.length ? shown.map(itemHtml).join('') : `<div class="wechat-empty wcl-empty"><i class="fa-solid fa-comments"></i><p>${chats.length ? '这里还没有聊天' : '暂无聊天'}</p></div>`}
                </div>
                <div class="wcl-noresult" hidden>没有找到相关的聊天</div>
            </div>
        `;
    }

    // 🔎 聊天列表：搜索联系人 / 聊天内容（不重绘，避免输入框失焦）
    _applyChatListSearch(root) {
        const list = root?.querySelector?.('.wcl-v2');
        if (!list) return;
        const q = String(this._chatListQuery || '').trim().toLowerCase();
        const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let visible = 0;
        list.querySelectorAll('.chat-item').forEach(item => {
            const last = item.querySelector('.chat-last-msg');
            if (last && last.dataset.orig !== undefined) last.innerHTML = last.dataset.orig;
            if (!q) { item.hidden = false; visible++; return; }
            if (String(item.dataset.search || '').includes(q)) { item.hidden = false; visible++; return; }
            let hit = null;
            try {
                const msgs = this.wechatData.getMessages(item.dataset.chatId) || [];
                for (let i = msgs.length - 1; i >= 0; i--) {
                    const c = String(msgs[i]?.content || '');
                    if (msgs[i]?.type !== 'system' && c.toLowerCase().includes(q)) { hit = c; break; }
                }
            } catch (e) { hit = null; }
            item.hidden = !hit;
            if (hit) {
                visible++;
                const idx = hit.toLowerCase().indexOf(q);
                const start = Math.max(0, idx - 8);
                const snippet = hit.slice(start, idx + q.length + 20);
                const i2 = snippet.toLowerCase().indexOf(q);
                if (last) last.innerHTML = `${start > 0 ? '…' : ''}${esc(snippet.slice(0, i2))}<mark>${esc(snippet.slice(i2, i2 + q.length))}</mark>${esc(snippet.slice(i2 + q.length))}`;
            }
        });
        const nr = list.querySelector('.wcl-noresult');
        if (nr) nr.hidden = !(q && visible === 0);
    }

    _bindChatListTools(root) {
        const list = root?.querySelector?.('.wcl-v2');
        if (!list || list.dataset.toolsBound === '1') return;
        list.dataset.toolsBound = '1';
        const input = list.querySelector('#wcl-search-input');
        const clear = list.querySelector('#wcl-search-clear');
        let timer = null;
        input?.addEventListener('input', () => {
            this._chatListQuery = input.value;
            if (clear) clear.hidden = !input.value;
            clearTimeout(timer);
            timer = setTimeout(() => this._applyChatListSearch(root), 160);
        });
        clear?.addEventListener('click', () => {
            this._chatListQuery = '';
            if (input) input.value = '';
            clear.hidden = true;
            this._applyChatListSearch(root);
        });
        list.querySelectorAll('[data-wcl-filter]').forEach(btn => btn.addEventListener('click', () => {
            this._chatListFilter = btn.dataset.wclFilter;
            this.render();
        }));
        this.mindNotes?.bindMindRow?.(list);
        if (this._chatListQuery) this._applyChatListSearch(root);
    }

    // 🏷️ 聊天列表/窗口显示名：有备注优先显示备注（@与引用仍用昵称）
    _getChatDisplayName(chat) {
        if (!chat) return '';
        if (chat.type === 'group') return chat.name;
        const contact = chat.contactId
            ? this.wechatData.getContact(chat.contactId)
            : this.wechatData.getContactByName(chat.name);
        const remark = String(contact?.remark || '').trim();
        return remark || chat.name;
    }

    renderDiscover() {
        // 直接渲染朋友圈
        return this.momentsView.renderMomentsPage();
    }

    renderProfile() {
        const userInfo = this.wechatData.getUserInfo();
        return `
        <div class="wechat-profile">
            <!-- 🎨 个人信息卡片 -->
            <div class="profile-card">
                <div class="profile-avatar-large" id="edit-avatar-btn">
                    ${this.renderAvatar(userInfo.avatar, '😊', userInfo.name)}
                    <div class="avatar-edit-hint">
                        <i class="fa-solid fa-camera"></i>
                    </div>
                </div>
                <div class="profile-user-info">
                    <div class="profile-username">${userInfo.name || '用户'}</div>
                    <div class="profile-signature">${userInfo.signature || '设置个性签名'}</div>
                </div>
            </div>

            <div class="profile-divider"></div>

            <!-- 🔧 功能区 -->
            <div class="profile-functions">
                <div class="profile-function-item" id="wechat-wallet-btn">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-wallet" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">服务</div>
                        <div class="function-desc">零钱、银行卡、收支明细</div>
                    </div>
                    <div class="function-arrow">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>

                <div class="profile-function-item" id="smart-load-contacts">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-user-group" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">智能加载联系人</div>
                        <div class="function-desc">从角色卡和聊天记录生成</div>
                    </div>
                    <div class="function-arrow">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>

                <div class="profile-function-item" id="edit-profile-btn">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-user-pen" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">编辑个人资料</div>
                        <div class="function-desc">修改昵称、头像、签名</div>
                    </div>
                    <div class="function-arrow">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>

                <div class="profile-function-item wx-moments-style-item">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-camera-retro" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">朋友圈样式</div>
                        <div class="function-desc">朋友圈 / QQ空间 / LINE</div>
                    </div>
                    <div class="wx-moments-style-seg">
                        ${[['wechat', '朋友圈'], ['qq', 'QQ空间'], ['line', 'LINE']].map(([v, l]) => `<button type="button" data-moments-style="${v}" class="${(this.getWechatSkin?.().moments || 'wechat') === v ? 'active' : ''}">${l}</button>`).join('')}
                    </div>
                </div>

                ${this._renderMyVoiceHtml()}

                <div class="profile-function-item" id="wechat-settings-btn">
                    <div class="function-icon-wrapper" style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                        <i class="fa-solid fa-gear" style="color: #666;"></i>
                    </div>
                    <div class="function-content">
                        <div class="function-title">设置</div>
                        <div class="function-desc">通用、隐私、数据管理</div>
                    </div>
                    <div class="function-arrow">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </div>
            
            <!-- 📊 数据统计（可选显示） -->
            <div class="profile-divider"></div>
            <div class="profile-stats">
                <div class="stat-item">
                    <div class="stat-number">${this.wechatData.getContacts().length}</div>
                    <div class="stat-label">联系人</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.wechatData.getChatList().length}</div>
                    <div class="stat-label">聊天</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.wechatData.getMoments().length}</div>
                    <div class="stat-label">朋友圈</div>
                </div>
            </div>
        </div>
    `;
    }

    syncMomentsUnreadIndicator() {
        const currentView = document.querySelector('.phone-view-current') || document;
        const momentsTab = currentView.querySelector?.('.wechat-app .wechat-tab[data-view="discover"]');
        if (!momentsTab) return;

        const shouldShow = this.wechatData.hasUnreadMoments?.() === true;
        const existingDot = momentsTab.querySelector('.wechat-moments-unread-dot');
        if (shouldShow && !existingDot) {
            const dot = document.createElement('span');
            dot.className = 'wechat-moments-unread-dot';
            dot.setAttribute('aria-label', '有未查看的朋友圈');
            momentsTab.appendChild(dot);
        } else if (!shouldShow && existingDot) {
            existingDot.remove();
        }
    }

    bindEvents() {
        // 🔥🔥 统一管理事件监听，避免重复绑定 🔥🔥
        const currentView = document.querySelector('.phone-view-current') || document;
        const wechatRoot = currentView.querySelector?.('.wechat-app') || currentView;
        const addClickListener = (selector, handler) => {
            // 🔥 核心修复1：强制在当前可视图层中查找元素，防止被历史栈中残留的隐藏旧页面拦截事件！
            const element = wechatRoot.querySelector?.(selector);
            if (element) element.onclick = handler; // 🔥 使用 onclick 覆盖
        };

        // 首页的“+”号和搜索按钮
        addClickListener('#wechat-search', () => this.showSearch());
        addClickListener('#wechat-add', () => this.showAddFriendMenu());

        // 通用返回按钮
        addClickListener('#wechat-back', () => {
            if (this.currentChat) {
                this.chatView?.resetTransientInputPanels?.();
                this.currentChat = null;
                this.render();
            } else {
                if (typeof this.phoneShell?.goHome === 'function') {
                    this.phoneShell.goHome();
                } else {
                    window.dispatchEvent(new CustomEvent('phone:goHome'));
                }
            }
        });

        // 底部导航切换
        wechatRoot.querySelectorAll?.('.wechat-tab').forEach(tab => {
            tab.onclick = (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) {
                    this.currentView = view;
                    this.render();
                }
            };
        });

        // 聊天列表点击
        wechatRoot.querySelectorAll?.('.wechat-chat-list .chat-item').forEach(item => {
            item.onclick = (e) => {
                const chatId = e.currentTarget.dataset.chatId;
                if (chatId) {
                    this.openChat(chatId);
                }
            };
        });
        this.bindChatListLongPressDelete();
        this._bindChatListTools(wechatRoot);

        // "发现"页面现在直接是朋友圈，绑定朋友圈事件
        if (this.currentView === 'discover') {
            this.momentsView.bindMomentsEvents();

            // 🔥 发朋友圈按钮
            addClickListener('#moments-post-btn', () => this.momentsView.showPostTypeSheet());
            addClickListener('#moments-generate-btn', () => this.momentsView.showGenerateMomentsSheet());
        }

        // “我”页面的功能入口
        addClickListener('#edit-avatar-btn', () => this.showEditProfile());
        addClickListener('#wechat-wallet-btn', () => this.showWalletPage({ resetMonth: true, section: 'ledger' }));
        addClickListener('#smart-load-contacts', () => this.showLoadContactsConfirm());
        addClickListener('#edit-profile-btn', () => this.showEditProfile());
        addClickListener('#wechat-settings-btn', () => this.showSettings());
        this._bindMyVoice(wechatRoot);
        wechatRoot?.querySelectorAll?.('[data-moments-style]').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setWechatSkin({ moments: btn.dataset.momentsStyle });
            this.render();
        }));

        // 聊天窗口右上角的"..."按钮
        addClickListener('#chat-info', () => {
            this.chatView?.resetTransientInputPanels?.();
            this.chatView.showChatMenu();
        });

        // 🔥 群聊头部标题点击 - 进入群设置页面
        addClickListener('#group-header-title', () => {
            this.chatView?.resetTransientInputPanels?.();
            this.chatView.showGroupSettings();
        });

        // 🔥 确保子视图的事件也被绑定
        if (this.currentChat) {
            this.chatView.bindEvents();
        }

        if (this.currentView === 'contacts' && !this.currentChat) {
            // 使用 setTimeout 确保 DOM 渲染完成
            setTimeout(() => {
                if (this.contactsView) {
                    this.contactsView.bindEvents();
                }
            }, 50);
        }
    }

    _escapeWalletHtml(value = '') {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    _getWalletDateParts(record = {}) {
        const rawDate = String(record?.date || '').trim();
        const match = rawDate.match(/(\d{1,6})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})/);
        if (match) {
            return {
                year: Number(match[1]),
                month: Number(match[2]),
                day: Number(match[3])
            };
        }
        const timestamp = Number(record?.timestamp || record?.realTimestamp || 0);
        const date = timestamp > 0 ? new Date(timestamp) : null;
        if (date && !Number.isNaN(date.getTime())) {
            return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
        }
        return null;
    }

    _getWalletMonthKey(record = {}) {
        const parts = this._getWalletDateParts(record);
        if (!parts) return '';
        return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}`;
    }

    _getWalletDateKey(record = {}) {
        const parts = this._getWalletDateParts(record);
        if (!parts) return 'unknown';
        return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    }

    _formatWalletMonthLabel(monthKey = '') {
        const match = String(monthKey || '').match(/^(\d+)-(\d{2})$/);
        return match ? `${Number(match[1])}年${match[2]}月` : '本月';
    }

    _formatWalletDateLabel(record = {}) {
        const parts = this._getWalletDateParts(record);
        return parts ? `${parts.year}年${String(parts.month).padStart(2, '0')}月${String(parts.day).padStart(2, '0')}日` : '日期未记录';
    }

    _formatWalletNumber(value) {
        const amount = Number(value || 0);
        return Number.isFinite(amount)
            ? amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00';
    }

    _getWalletTransactionVisual(type = 'other') {
        const visuals = {
            transfer: { className: 'is-transfer', icon: 'fa-user' },
            redpacket: { className: 'is-redpacket', icon: 'fa-envelope' },
            honey: { className: 'is-honey', icon: 'fa-droplet' },
            shopping: { className: 'is-shopping', icon: 'fa-cart-shopping' },
            repayment: { className: 'is-repayment', icon: 'fa-credit-card' },
            other: { className: 'is-other', icon: 'fa-wallet' }
        };
        return visuals[type] || visuals.other;
    }

    _renderWalletTransactionRows(transactions = []) {
        if (!transactions.length) {
            return `
                <div class="wechat-wallet-ledger-empty">
                    <span class="wechat-wallet-ledger-empty-icon"><i class="fa-solid fa-receipt"></i></span>
                    <strong>本月暂无收支记录</strong>
                    <span>每一份收支，都是生活的可爱印记</span>
                </div>
            `;
        }

        let currentDateKey = '';
        return transactions.map(record => {
            const dateKey = this._getWalletDateKey(record);
            const dateHeader = dateKey !== currentDateKey
                ? `<div class="wechat-wallet-ledger-day">${this._escapeWalletHtml(this._formatWalletDateLabel(record))}</div>`
                : '';
            currentDateKey = dateKey;
            const visual = this._getWalletTransactionVisual(record.type);
            const delta = Number(record.delta || 0);
            const amountText = `${delta > 0 ? '+' : '-'}${this._formatWalletNumber(Math.abs(delta))}`;
            const timeText = String(record.time || '').trim() || (() => {
                const date = new Date(Number(record.realTimestamp || record.timestamp || 0));
                return Number.isNaN(date.getTime())
                    ? '--:--'
                    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            })();
            const detail = String(record.detail || ({
                transfer: '微信转账',
                redpacket: '微信红包',
                honey: '蜜语',
                shopping: '线下支付',
                repayment: '信用卡还款'
            }[record.type] || '微信零钱')).trim();
            return `${dateHeader}
                <div class="wechat-wallet-ledger-row">
                    <span class="wechat-wallet-ledger-icon ${visual.className}"><i class="fa-solid ${visual.icon}"></i></span>
                    <div class="wechat-wallet-ledger-copy">
                        <div class="wechat-wallet-ledger-name">${this._escapeWalletHtml(record.title || '零钱收支')}</div>
                        <div class="wechat-wallet-ledger-detail">${this._escapeWalletHtml(detail)}</div>
                    </div>
                    <div class="wechat-wallet-ledger-money">
                        <div class="wechat-wallet-ledger-amount ${delta > 0 ? 'is-income' : ''}">${amountText}</div>
                        <div class="wechat-wallet-ledger-time">${this._escapeWalletHtml(timeText)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    _renderWalletLedgerPanel({
        monthOptions = '',
        typeOptions = '',
        selectedMonthLabel = '',
        selectedTypeLabel = '',
        visibleTransactions = []
    } = {}) {
        return `
            <section class="wechat-wallet-ledger-panel" data-wallet-panel="ledger">
                <div class="wechat-wallet-ledger-panel-header">
                    <div class="wechat-wallet-ledger-heading"><i class="fa-solid fa-receipt"></i><span>收支明细</span></div>
                    <div class="wechat-wallet-ledger-filters">
                        <div class="wechat-wallet-ledger-filter">
                            <select id="wechat-wallet-month-filter" aria-label="选择月份">${monthOptions}</select>
                            <span class="wechat-wallet-ledger-filter-label">${this._escapeWalletHtml(selectedMonthLabel)}</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                        <div class="wechat-wallet-ledger-filter">
                            <select id="wechat-wallet-type-filter" aria-label="选择收支类型">${typeOptions}</select>
                            <span class="wechat-wallet-ledger-filter-label">${this._escapeWalletHtml(selectedTypeLabel)}</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
                <div class="wechat-wallet-ledger-list">
                    ${this._renderWalletTransactionRows(visibleTransactions)}
                    ${visibleTransactions.length ? '<div class="wechat-wallet-ledger-footer">— 已加载全部 —</div>' : ''}
                </div>
            </section>
        `;
    }

    _renderWalletAccountEmpty(icon, title, description) {
        return `
            <div class="wechat-wallet-account-empty">
                <i class="fa-solid ${icon}"></i>
                <strong>${this._escapeWalletHtml(title)}</strong>
                <span>${this._escapeWalletHtml(description)}</span>
            </div>
        `;
    }

    _renderWalletSavingsPanel(profile = {}, totals = {}) {
        const accounts = Array.isArray(profile?.savingsAccounts) ? profile.savingsAccounts : [];
        const rows = accounts.map((account) => {
            const balanceText = this._formatWalletNumber(account.balance);
            const balanceClass = balanceText.length > 13 ? 'is-compact' : '';
            return `
                <div class="wechat-wallet-savings-row">
                    <span class="wechat-wallet-account-logo is-savings"><i class="fa-solid fa-building-columns"></i></span>
                    <div class="wechat-wallet-account-copy">
                        <div class="wechat-wallet-account-name">${this._escapeWalletHtml(account.bankName)}</div>
                        <div class="wechat-wallet-account-detail">储蓄卡 · 尾号 ${this._escapeWalletHtml(account.tailNumber)}</div>
                    </div>
                    <div class="wechat-wallet-savings-balance ${balanceClass}">¥${balanceText}</div>
                </div>
            `;
        }).join('');
        const summary = accounts.length ? `合计 ¥${this._formatWalletNumber(totals.savingsBalance)}` : '尚未配置';
        return `
            <div class="wechat-wallet-account-panel" data-wallet-panel="bank">
                <section class="wechat-wallet-account-section">
                    <div class="wechat-wallet-account-section-header">
                        <div class="wechat-wallet-account-section-title"><i class="fa-solid fa-building-columns"></i><span>储蓄账户 (${accounts.length})</span></div>
                        <div class="wechat-wallet-account-section-summary">${this._escapeWalletHtml(summary)}</div>
                    </div>
                    ${rows || this._renderWalletAccountEmpty('fa-credit-card', '暂无银行卡', '完成资产评估后显示储蓄账户')}
                </section>
            </div>
        `;
    }

    _renderWalletCreditPanel(profile = {}, totals = {}, billingStatuses = []) {
        const creditCards = Array.isArray(profile?.creditCards) ? profile.creditCards : [];
        const debts = Array.isArray(profile?.debts) ? profile.debts : [];
        const creditRows = creditCards.map((card, cardIndex) => {
            const rawDue = Math.max(0, Number(card.currentDue || 0));
            const status = billingStatuses[cardIndex] || {
                state: rawDue > 0 ? 'pending' : 'clear',
                label: rawDue > 0 ? '待还款' : '无欠款',
                amountDue: rawDue
            };
            const currentDue = Number(status.amountDue || 0);
            const isPayable = ['pending', 'overdue'].includes(status.state) && currentDue > 0;
            const statusClass = status.state === 'overdue'
                ? 'is-overdue'
                : (isPayable ? '' : 'is-clear');
            const limitText = card.limitLabel
                ? (/无预设|动态额度|∞|无限/i.test(card.limitLabel) ? '无预设上限' : card.limitLabel)
                : (Number.isFinite(Number(card.limit)) ? `¥${this._formatWalletNumber(card.limit)}` : '未记录');
            const tailText = card.tailNumber ? `信用卡 · 尾号 ${card.tailNumber}` : '信用卡账户';
            const detailText = card.installmentStatus ? `${tailText} · ${card.installmentStatus}` : tailText;
            const rowTag = isPayable ? 'button' : 'div';
            const rowAttributes = isPayable
                ? `type="button" data-wallet-credit-card-index="${cardIndex}" aria-label="偿还${this._escapeWalletHtml(card.bankName)}账单"`
                : '';
            return `
                <${rowTag} class="wechat-wallet-liability-row" ${rowAttributes}>
                    <div class="wechat-wallet-liability-top">
                        <span class="wechat-wallet-account-logo is-credit"><i class="fa-solid fa-credit-card"></i></span>
                        <div class="wechat-wallet-account-copy">
                            <div class="wechat-wallet-account-name">${this._escapeWalletHtml(card.bankName)}</div>
                            <div class="wechat-wallet-account-detail">${this._escapeWalletHtml(detailText)}</div>
                        </div>
                        <span class="wechat-wallet-liability-status ${statusClass}">${this._escapeWalletHtml(status.label)}</span>
                        ${isPayable ? '<i class="fa-solid fa-chevron-right wechat-wallet-liability-chevron" aria-hidden="true"></i>' : '<span></span>'}
                    </div>
                    <div class="wechat-wallet-liability-metrics">
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">本期应还(元)</span>
                            <strong class="wechat-wallet-liability-value is-amount">${this._formatWalletNumber(currentDue)}</strong>
                        </div>
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">信用额度</span>
                            <strong class="wechat-wallet-liability-value" title="${this._escapeWalletHtml(card.limitLabel || limitText)}">${this._escapeWalletHtml(limitText)}</strong>
                        </div>
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">还款日</span>
                            <strong class="wechat-wallet-liability-value">${this._escapeWalletHtml(card.repaymentDay || '未记录')}</strong>
                        </div>
                    </div>
                </${rowTag}>
            `;
        }).join('');
        const debtRows = debts.map((debt) => {
            const amount = Number(debt.amount || 0);
            const hasDue = amount > 0;
            return `
                <div class="wechat-wallet-liability-row">
                    <div class="wechat-wallet-liability-top">
                        <span class="wechat-wallet-account-logo is-loan"><i class="fa-solid fa-hand-holding-dollar"></i></span>
                        <div class="wechat-wallet-account-copy">
                            <div class="wechat-wallet-account-name">${this._escapeWalletHtml(debt.name)}</div>
                            <div class="wechat-wallet-account-detail">${this._escapeWalletHtml(debt.detail || '借贷账户')}</div>
                        </div>
                        <span class="wechat-wallet-liability-status ${hasDue ? '' : 'is-clear'}">${hasDue ? '待还款' : '已结清'}</span>
                        <i class="fa-solid fa-chevron-right wechat-wallet-liability-chevron" aria-hidden="true"></i>
                    </div>
                    <div class="wechat-wallet-liability-metrics">
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">本期应还(元)</span>
                            <strong class="wechat-wallet-liability-value is-amount">${this._formatWalletNumber(amount)}</strong>
                        </div>
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">分期状态</span>
                            <strong class="wechat-wallet-liability-value">${this._escapeWalletHtml(debt.installmentStatus || '未分期')}</strong>
                        </div>
                        <div class="wechat-wallet-liability-metric">
                            <span class="wechat-wallet-liability-label">还款日</span>
                            <strong class="wechat-wallet-liability-value">${this._escapeWalletHtml(debt.repaymentDay || '未记录')}</strong>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return `
            <div class="wechat-wallet-account-panel" data-wallet-panel="credit">
                <section class="wechat-wallet-account-section">
                    <div class="wechat-wallet-account-section-header">
                        <div class="wechat-wallet-account-section-title"><i class="fa-solid fa-credit-card"></i><span>信用卡账单 (${creditCards.length})</span></div>
                        <div class="wechat-wallet-account-section-summary">待还 ¥${this._formatWalletNumber(totals.creditDue)}</div>
                    </div>
                    ${creditRows || this._renderWalletAccountEmpty('fa-credit-card', '暂无信用卡账单', '当前评估未生成信用卡账户')}
                </section>
                <section class="wechat-wallet-account-section">
                    <div class="wechat-wallet-account-section-header">
                        <div class="wechat-wallet-account-section-title"><i class="fa-solid fa-hand-holding-dollar"></i><span>借贷记录 (${debts.length})</span></div>
                        <div class="wechat-wallet-account-section-summary">待还 ¥${this._formatWalletNumber(totals.loanDue)}</div>
                    </div>
                    ${debtRows || this._renderWalletAccountEmpty('fa-file-invoice-dollar', '暂无借贷记录', '当前评估未生成其它负债')}
                </section>
            </div>
        `;
    }

    // 显示微信钱包
    showWalletPage({ resetMonth = false, section = null } = {}) {
        if (section && ['ledger', 'bank', 'credit'].includes(section)) {
            this._walletSection = section;
        }
        if (!['ledger', 'bank', 'credit'].includes(this._walletSection)) {
            this._walletSection = 'ledger';
        }
        const balance = this.wechatData.getWalletBalance();
        const isInitialized = balance !== null;
        const displayBalance = isInitialized ? this._formatWalletNumber(balance) : '***';
        const isEvaluating = !!this._isWalletEvaluating;
        const storyTime = window.VirtualPhone?.timeManager?.getCurrentStoryTime?.() || {};
        const creditBillingStatuses = this.wechatData.getWalletCreditCardStatuses?.(storyTime) || [];
        const assetProfile = this.wechatData.getWalletAssetProfile?.() || {
            savingsAccounts: [],
            creditCards: [],
            debts: []
        };
        const assetTotals = {
            ...getWalletAssetTotals(assetProfile),
            creditDue: creditBillingStatuses.reduce((sum, status) => sum + Number(status.amountDue || 0), 0)
        };
        const bankCardCount = assetProfile.savingsAccounts.length;
        const creditCardCount = assetProfile.creditCards.length;
        const creditCardDueText = this._formatWalletNumber(assetTotals.creditDue);
        const loanDueText = this._formatWalletNumber(assetTotals.loanDue);
        const transactions = this.wechatData.getWalletTransactions?.() || [];
        const fallbackMonth = this._getWalletMonthKey(storyTime)
            || this._getWalletMonthKey({ timestamp: Date.now() });
        const monthKeys = [...new Set(transactions.map(record => this._getWalletMonthKey(record)).filter(Boolean))];
        if (monthKeys.length === 0 && fallbackMonth) monthKeys.push(fallbackMonth);
        monthKeys.sort((a, b) => b.localeCompare(a));
        const latestMonth = monthKeys[0] || fallbackMonth;
        if (resetMonth || !monthKeys.includes(this._walletLedgerMonth)) {
            this._walletLedgerMonth = latestMonth;
        }
        if (!['all', 'transfer', 'redpacket', 'honey', 'shopping', 'repayment'].includes(this._walletLedgerType)) {
            this._walletLedgerType = 'all';
        }

        const monthlyTransactions = transactions.filter(record => this._getWalletMonthKey(record) === this._walletLedgerMonth);
        const visibleTransactions = this._walletLedgerType === 'all'
            ? monthlyTransactions
            : monthlyTransactions.filter(record => record.type === this._walletLedgerType);
        const longestStatValueLength = Math.max(creditCardDueText.length, loanDueText.length, displayBalance.length);
        const statValueClass = longestStatValueLength > 12 ? 'is-tight' : (longestStatValueLength > 9 ? 'is-compact' : '');
        const shortcutBalanceClass = displayBalance.length > 13 ? 'is-tight' : (displayBalance.length > 10 ? 'is-compact' : '');
        const monthOptions = monthKeys.map(monthKey => `
            <option value="${monthKey}" ${monthKey === this._walletLedgerMonth ? 'selected' : ''}>${this._formatWalletMonthLabel(monthKey)}</option>
        `).join('');
        const typeOptionEntries = [
            ['all', '全部类型'],
            ['transfer', '转账'],
            ['redpacket', '红包'],
            ['honey', '蜜语'],
            ['shopping', '线下支付'],
            ['repayment', '信用卡还款']
        ];
        const typeOptions = typeOptionEntries
            .map(([value, label]) => `<option value="${value}" ${value === this._walletLedgerType ? 'selected' : ''}>${label}</option>`)
            .join('');
        const selectedMonthLabel = this._formatWalletMonthLabel(this._walletLedgerMonth);
        const selectedTypeLabel = typeOptionEntries.find(([value]) => value === this._walletLedgerType)?.[1] || '全部类型';
        const evalLabel = isEvaluating ? '资产评估中' : (isInitialized ? '重新评估资产' : '初始资产评估');
        const lowerPanelHtml = this._walletSection === 'bank'
            ? this._renderWalletSavingsPanel(assetProfile, assetTotals)
            : (this._walletSection === 'credit'
                ? this._renderWalletCreditPanel(assetProfile, assetTotals, creditBillingStatuses)
                : this._renderWalletLedgerPanel({
                    monthOptions,
                    typeOptions,
                    selectedMonthLabel,
                    selectedTypeLabel,
                    visibleTransactions
                }));
        const html = `
        <div class="wechat-app wechat-wallet-ledger-page">
            <div class="wechat-wallet-ledger-scroll">
                <section class="wechat-wallet-ledger-hero">
                    <div class="wechat-wallet-ledger-nav">
                        <button class="wechat-back-btn" id="back-from-wallet" type="button" title="返回" aria-label="返回">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <div class="wechat-wallet-ledger-title">钱包</div>
                        <button class="wechat-wallet-eval-action" id="ai-eval-wallet-btn" type="button" title="${evalLabel}" aria-label="${evalLabel}">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                    <div class="wechat-wallet-hero-emblem"><span><i class="fa-solid fa-wallet"></i></span></div>
                    <div class="wechat-wallet-ledger-stats">
                        <div class="wechat-wallet-ledger-stat">
                            <span class="wechat-wallet-ledger-stat-icon"><i class="fa-solid fa-shield-halved"></i></span>
                            <span class="wechat-wallet-ledger-stat-label">零钱余额(元)</span>
                            <strong class="wechat-wallet-ledger-stat-value ${statValueClass}">${displayBalance}</strong>
                        </div>
                        <div class="wechat-wallet-ledger-stat">
                            <span class="wechat-wallet-ledger-stat-icon"><i class="fa-solid fa-credit-card"></i></span>
                            <span class="wechat-wallet-ledger-stat-label">信用卡待还(元)</span>
                            <strong class="wechat-wallet-ledger-stat-value ${statValueClass}">${creditCardDueText}</strong>
                        </div>
                        <div class="wechat-wallet-ledger-stat">
                            <span class="wechat-wallet-ledger-stat-icon"><i class="fa-solid fa-chart-column"></i></span>
                            <span class="wechat-wallet-ledger-stat-label">借贷待还(元)</span>
                            <strong class="wechat-wallet-ledger-stat-value ${statValueClass}">${loanDueText}</strong>
                        </div>
                    </div>
                </section>
                <div class="wechat-wallet-shortcuts">
                    <button class="wechat-wallet-shortcut-card ${this._walletSection === 'ledger' ? 'is-active' : ''}" type="button" data-wallet-section="ledger" aria-pressed="${this._walletSection === 'ledger'}">
                        <span class="wechat-wallet-shortcut-icon is-balance"><i class="fa-solid fa-yen-sign"></i></span>
                        <div class="wechat-wallet-shortcut-title">零钱</div>
                        <span class="wechat-wallet-shortcut-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>
                        <div class="wechat-wallet-shortcut-value ${shortcutBalanceClass}">¥${displayBalance}</div>
                    </button>
                    <button class="wechat-wallet-shortcut-card ${this._walletSection === 'bank' ? 'is-active' : ''}" type="button" data-wallet-section="bank" aria-pressed="${this._walletSection === 'bank'}">
                        <span class="wechat-wallet-shortcut-icon is-card"><i class="fa-solid fa-credit-card"></i></span>
                        <div class="wechat-wallet-shortcut-title">银行卡</div>
                        <span class="wechat-wallet-shortcut-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>
                        <div class="wechat-wallet-shortcut-value">${bankCardCount} 张</div>
                    </button>
                    <button class="wechat-wallet-shortcut-card ${this._walletSection === 'credit' ? 'is-active' : ''}" type="button" data-wallet-section="credit" aria-pressed="${this._walletSection === 'credit'}">
                        <span class="wechat-wallet-shortcut-icon is-credit"><i class="fa-solid fa-credit-card"></i></span>
                        <div class="wechat-wallet-shortcut-title">信用卡</div>
                        <span class="wechat-wallet-shortcut-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>
                        <div class="wechat-wallet-shortcut-value">${creditCardCount} 张</div>
                    </button>
                </div>
                ${lowerPanelHtml}
            </div>
        </div>
        `;
        this.phoneShell.setContent(html);

        const currentView = document.querySelector('.phone-view-current') || document;
        currentView.querySelector('#back-from-wallet')?.addEventListener('click', () => this.render());
        const evalBtn = currentView.querySelector('#ai-eval-wallet-btn');
        if (evalBtn) {
            evalBtn.disabled = isEvaluating;
            evalBtn.addEventListener('click', () => this.evaluateWalletByAI());
        }
        currentView.querySelectorAll('[data-wallet-section]').forEach((button) => {
            button.addEventListener('click', () => {
                const nextSection = String(button.dataset.walletSection || 'ledger');
                if (!['ledger', 'bank', 'credit'].includes(nextSection)) return;
                this._walletSection = nextSection;
                this.showWalletPage();
            });
        });
        currentView.querySelector('#wechat-wallet-month-filter')?.addEventListener('change', (event) => {
            this._walletLedgerMonth = String(event.currentTarget.value || '');
            this.showWalletPage();
        });
        currentView.querySelector('#wechat-wallet-type-filter')?.addEventListener('change', (event) => {
            this._walletLedgerType = String(event.currentTarget.value || 'all');
            this.showWalletPage();
        });
        currentView.querySelectorAll('[data-wallet-credit-card-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const cardIndex = Number.parseInt(button.dataset.walletCreditCardIndex, 10);
                if (Number.isInteger(cardIndex)) this.showWalletCreditRepaymentModal(cardIndex);
            });
        });
    }

    showWalletCreditRepaymentModal(cardIndex) {
        document.querySelectorAll('#wechat-wallet-repayment-modal').forEach(el => el.remove());

        const storyTime = window.VirtualPhone?.timeManager?.getCurrentStoryTime?.() || {};
        const profile = this.wechatData.getWalletAssetProfile?.() || {};
        const card = profile.creditCards?.[cardIndex];
        const status = this.wechatData.getWalletCreditCardStatuses?.(storyTime)?.[cardIndex];
        if (!card || !status || !['pending', 'overdue'].includes(status.state) || Number(status.amountDue) <= 0) {
            this.phoneShell.showNotification('信用卡账单', '当前账单无需还款', '✓');
            this.showWalletPage({ section: 'credit' });
            return;
        }

        const sources = this.wechatData.getWalletRepaymentSources?.() || [];
        const sourceRows = sources.map((source, index) => `
            <label class="wechat-wallet-repayment-source">
                <input type="radio" name="wechat-wallet-repayment-source" value="${this._escapeWalletHtml(source.id)}" ${index === 0 ? 'checked' : ''}>
                <span class="wechat-wallet-repayment-source-copy">
                    <strong>${this._escapeWalletHtml(source.label)}</strong>
                    <span>${this._escapeWalletHtml(source.detail)}</span>
                </span>
                <span class="wechat-wallet-repayment-source-balance">¥${this._formatWalletNumber(source.balance)}</span>
            </label>
        `).join('');
        const cardLabel = `${card.bankName}${card.tailNumber ? ` · 尾号${card.tailNumber}` : ''}`;
        const modalHtml = `
            <div id="wechat-wallet-repayment-modal" class="wechat-wallet-repayment-overlay">
                <section class="wechat-wallet-repayment-dialog" role="dialog" aria-modal="true" aria-labelledby="wechat-wallet-repayment-title">
                    <header class="wechat-wallet-repayment-header">
                        <strong id="wechat-wallet-repayment-title">信用卡还款</strong>
                        <button type="button" class="wechat-wallet-repayment-close" data-wallet-repayment-close aria-label="关闭" title="关闭">
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </header>
                    <div class="wechat-wallet-repayment-body">
                        <div class="wechat-wallet-repayment-summary">
                            <span>${this._escapeWalletHtml(cardLabel)}</span>
                            <strong>¥${this._formatWalletNumber(status.amountDue)}</strong>
                            <small>${this._escapeWalletHtml(status.label)} · ${this._escapeWalletHtml(card.repaymentDay || '还款日未记录')}</small>
                        </div>
                        <div class="wechat-wallet-repayment-section-title">选择还款方式</div>
                        <div class="wechat-wallet-repayment-sources">${sourceRows}</div>
                        <div class="wechat-wallet-repayment-error" data-wallet-repayment-error aria-live="polite"></div>
                    </div>
                    <footer class="wechat-wallet-repayment-actions">
                        <button type="button" class="wechat-wallet-repayment-cancel" data-wallet-repayment-close>取消</button>
                        <button type="button" class="wechat-wallet-repayment-confirm" data-wallet-repayment-confirm>确认还款</button>
                    </footer>
                </section>
            </div>
        `;

        const currentView = document.querySelector('.phone-view-current') || document;
        currentView.insertAdjacentHTML('beforeend', modalHtml);
        const modal = currentView.querySelector('#wechat-wallet-repayment-modal');
        const confirmButton = modal?.querySelector('[data-wallet-repayment-confirm]');
        const errorEl = modal?.querySelector('[data-wallet-repayment-error]');
        if (!modal || !confirmButton || !errorEl) return;

        const closeModal = () => modal.remove();
        modal.querySelectorAll('[data-wallet-repayment-close]').forEach(button => {
            button.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
        confirmButton.addEventListener('click', async () => {
            const selected = modal.querySelector('input[name="wechat-wallet-repayment-source"]:checked');
            if (!selected) {
                errorEl.textContent = '请选择还款方式。';
                return;
            }

            confirmButton.disabled = true;
            errorEl.textContent = '';
            try {
                const result = await this.wechatData.repayCreditCard({
                    cardIndex,
                    sourceId: selected.value,
                    storyTime
                });
                if (!result.success) {
                    if (result.reason === 'insufficient_balance') {
                        errorEl.textContent = `该账户余额不足，当前 ¥${this._formatWalletNumber(result.balanceBefore)}，需还 ¥${this._formatWalletNumber(result.amount)}。`;
                    } else if (result.reason === 'not_due' || result.reason === 'billing_cycle_changed') {
                        errorEl.textContent = '账单状态已变化，请返回后重新查看。';
                    } else {
                        errorEl.textContent = '还款失败，请重新选择还款方式。';
                    }
                    return;
                }

                closeModal();
                this.phoneShell.showNotification('还款成功', `已从${result.source.label}扣款 ¥${this._formatWalletNumber(result.amount)}`, '✓');
                this.showWalletPage({ section: 'credit' });
            } catch (error) {
                console.error('信用卡还款失败:', error);
                errorEl.textContent = error?.message || '还款失败，请稍后重试。';
            } finally {
                if (confirmButton.isConnected) confirmButton.disabled = false;
            }
        });
    }

    _updateWalletEvalButtonState(buttonEl, isLoading) {
        if (!buttonEl) return;
        const isInitialized = this.wechatData.getWalletBalance() !== null;
        buttonEl.disabled = isLoading;
        buttonEl.style.opacity = isLoading ? '0.78' : '';
        buttonEl.style.cursor = isLoading ? 'not-allowed' : '';
        if (buttonEl.classList.contains('wechat-wallet-eval-action')) {
            const label = isLoading ? '资产评估中' : (isInitialized ? '重新评估资产' : '初始资产评估');
            buttonEl.title = label;
            buttonEl.setAttribute('aria-label', label);
            buttonEl.innerHTML = '<i class="fa-solid fa-gear"></i>';
            return;
        }
        buttonEl.innerHTML = isLoading
            ? '<i class="fa-solid fa-spinner fa-spin"></i> 评估中...'
            : (isInitialized ? '<i class="fa-solid fa-rotate"></i> 重新评估资产' : '<i class="fa-solid fa-wand-magic-sparkles"></i> 初始资产评估');
    }

    // AI 评估完整资产
    async evaluateWalletByAI() {
        if (this._isWalletEvaluating) {
            this.phoneShell.showNotification('资产评估中', '请稍候，正在生成评估结果...', '⏳');
            return;
        }

        const isWalletReset = this.wechatData.getWalletBalance() !== null;
        if (isWalletReset) {
            const confirmed = window.confirm(
                '确定要重新评估全部资产吗？\n\n' +
                '评估成功后，微信零钱、银行卡、信用卡与借贷数据都会被新结果替换，全部零钱收支明细也会永久清空，且无法恢复。\n\n' +
                '如果评估失败，现有资产数据和明细不会变更。'
            );
            if (!confirmed) return;
        }

        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        if (!context) return;

        this._isWalletEvaluating = true;
        const currentView = document.querySelector('.phone-view-current') || document;
        const evalBtn = currentView.querySelector('#ai-eval-wallet-btn');
        this._updateWalletEvalButtonState(evalBtn, true);

        this.phoneShell.showNotification('资产评估中', '正在让AI查你的底细...', '⏳');
        
        // 1. 收集信息
        const userName = context.name1 || '用户';
        let charInfo = '', userInfo = '';

        const char = (context.characters && context.characterId !== undefined)
            ? context.characters[context.characterId]
            : null;

        // 钱包评估只需要身份背景；角色扮演提示词、示例和内置世界书不应进入请求。
        if (char) {
            const limitContext = (value, maxChars) => this.wechatData?._truncateAiContextText?.(value, maxChars) || '';
            const charLines = [];
            charLines.push(`名字: ${char.name || context.name2 || '角色'}`);
            const description = limitContext(char.description, 2400);
            const personality = limitContext(char.personality, 1200);
            const scenario = limitContext(char.scenario, 1600);
            if (description) charLines.push(`描述: ${description}`);
            if (personality) charLines.push(`性格: ${personality}`);
            if (scenario) charLines.push(`场景/背景: ${scenario}`);
            charInfo = charLines.join('\n');
        } else {
            charInfo = `名字: ${context.name2 || '角色'}`;
        }

        // 用户信息：同时带入微信昵称/签名 + Persona
        const wxUser = this.wechatData?.getUserInfo?.() || {};
        const personaTextarea = document.getElementById('persona_description');
        const personaText = (personaTextarea?.value || '').trim();
        const userLines = [];
        userLines.push(`名字: ${userName}`);
        if (wxUser?.name) userLines.push(`微信昵称: ${wxUser.name}`);
        if (wxUser?.signature) userLines.push(`微信签名: ${wxUser.signature}`);
        if (personaText) {
            const limitedPersona = this.wechatData?._truncateAiContextText?.(personaText, 1600) || personaText.substring(0, 1600);
            userLines.push(`设定: ${limitedPersona}`);
        }
        userInfo = userLines.join('\n');

        // 2. 获取提示词
        const promptManager = window.VirtualPhone?.promptManager;
        if (promptManager && !promptManager._loaded && typeof promptManager.ensureLoaded === 'function') {
            promptManager.ensureLoaded();
        }
        const promptTemplate = typeof promptManager?.renderPromptForFeature === 'function'
            ? promptManager.renderPromptForFeature('wechat', 'walletEval', { user: userName })
            : String(promptManager?.getPromptForFeature('wechat', 'walletEval') || '').split('{{user}}').join(userName);
        if (!promptTemplate) {
            this.phoneShell.showNotification('错误', '找不到钱包评估提示词', '❌');
            this._isWalletEvaluating = false;
            this._updateWalletEvalButtonState(evalBtn, false);
            return;
        }

        const messages = [];
        await window.VirtualPhone?.worldbookManager?.appendWorldbookMessages?.(messages, 'wechat');
        messages.push({
            role: 'system',
            content: `【当前主角角色卡】\n${charInfo || '无'}`
        });
        messages.push({
            role: 'system',
            content: '以上是参考背景，以下是 user 的信息。你是一个数据处理引擎，只负责根据背景和用户信息评估微信零钱、储蓄账户、信用卡与其它负债，不要进行角色扮演。'
        });
        messages.push({
            role: 'system',
            content: `【用户信息】\n${userInfo || '无'}`
        });
        messages.push({
            role: 'user',
            content: promptTemplate
        });

        try {
            const apiManager = window.VirtualPhone?.apiManager;
            const result = await apiManager.callAI(messages, { appId: 'wechat' });

            if (!result.success) throw new Error(result.error);

            // 3. 只解析新版 <初始资产评估> 标签，不再兼容旧 JSON。
            const rawResponse = String(result.summary ?? '');
            let evaluation;
            try {
                evaluation = parseWalletAssetEvaluation(rawResponse);
            } catch (parseError) {
                console.error('钱包资产评估解析失败:', parseError, rawResponse);
                this.showWalletParseFailureModal(rawResponse, parseError);
                return;
            }

            // 4. 首次评估写入完整资产；重新评估则整体替换并清空旧流水。
            await this.wechatData.applyWalletAssetEvaluation(evaluation, {
                resetTransactions: isWalletReset
            });
            if (isWalletReset) {
                this._walletLedgerMonth = '';
                this._walletLedgerType = 'all';
            }

            // 5. 渲染结果弹窗
            this.showWalletResultModal(evaluation);
            
        } catch (e) {
            console.error('钱包评估失败:', e);
            this.phoneShell.showNotification('评估失败', e.message, '❌');
        } finally {
            this._isWalletEvaluating = false;
            const activeView = document.querySelector('.phone-view-current') || document;
            const activeBtn = activeView.querySelector('#ai-eval-wallet-btn');
            this._updateWalletEvalButtonState(activeBtn, false);
        }
    }

    showWalletResultModal(evaluation = {}) {
        // 清理遗留弹窗，避免旧图层中的同名ID干扰事件绑定
        document.querySelectorAll('#wallet-eval-modal').forEach(el => el.remove());

        const totals = getWalletAssetTotals(evaluation);
        const walletBalance = this._formatWalletNumber(evaluation.walletBalance);
        const savingsCount = Array.isArray(evaluation.savingsAccounts) ? evaluation.savingsAccounts.length : 0;
        const creditCount = Array.isArray(evaluation.creditCards) ? evaluation.creditCards.length : 0;
        const safeReasoning = this._escapeWalletHtml(evaluation.reasoning || '评估已完成。').replace(/\n/g, '<br>');

        const modalHtml = `
        <div id="wallet-eval-modal" class="wallet-eval-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box; animation: fadeIn 0.3s;">
            <div class="wallet-eval-modal-panel" style="background: #fff; width: 100%; max-width: 320px; max-height: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: slideUp 0.3s; display: flex; flex-direction: column;">
                <div style="background: #dfeeda; padding: 20px 16px 15px; text-align: center; color: #253026; flex-shrink: 0;">
                    <i class="fa-solid fa-wallet" style="font-size: 34px; margin-bottom: 8px; color: #77906f;"></i>
                    <div style="font-size: 13px; color: #637061;">资产评估完成</div>
                    <div style="font-size: 29px; font-weight: bold; margin-top: 4px;">¥ ${walletBalance}</div>
                </div>
                <div class="wallet-eval-modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px;">
                        <div style="padding: 9px; border: 1px solid #e8ebe6; border-radius: 8px;"><div style="font-size: 9px; color: #8a9189;">储蓄账户</div><strong style="display: block; margin-top: 3px; font-size: 13px; color: #2b302b;">${savingsCount} 张 · ¥${this._formatWalletNumber(totals.savingsBalance)}</strong></div>
                        <div style="padding: 9px; border: 1px solid #e8ebe6; border-radius: 8px;"><div style="font-size: 9px; color: #8a9189;">信用卡待还</div><strong style="display: block; margin-top: 3px; font-size: 13px; color: #2b302b;">${creditCount} 张 · ¥${this._formatWalletNumber(totals.creditDue)}</strong></div>
                        <div style="grid-column: 1 / -1; padding: 9px; border: 1px solid #e8ebe6; border-radius: 8px;"><div style="font-size: 9px; color: #8a9189;">其它借贷待还</div><strong style="display: block; margin-top: 3px; font-size: 13px; color: #2b302b;">¥${this._formatWalletNumber(totals.loanDue)}</strong></div>
                    </div>
                    <div style="font-size: 11px; color: #858b84; margin-top: 2px;">AI 评估报告</div>
                    <div class="wallet-eval-reasoning" style="font-size: 12px; color: #333; line-height: 1.6; background: #f5f6f4; padding: 11px; border-radius: 8px; max-height: 150px; overflow-y: auto;">
                        ${safeReasoning}
                    </div>
                    <button id="close-wallet-modal" style="width: 100%; padding: 12px; background: #6e8c65; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; margin-top: 5px; cursor: pointer; flex-shrink: 0;">
                        查看钱包
                    </button>
                </div>
            </div>
        </div>
        `;
        
        const currentView = document.querySelector('.phone-view-current') || document;
        currentView.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = currentView.querySelector('#wallet-eval-modal');
        const closeBtn = modalEl?.querySelector('#close-wallet-modal');
        if (!modalEl || !closeBtn) return;

        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modalEl.remove();
            this.showWalletPage(); // 刷新钱包页面显示最新余额
        };
    }

    showWalletParseFailureModal(rawResponse, error) {
        document.querySelectorAll('#wallet-eval-parse-error-modal').forEach(el => el.remove());

        const responseText = String(rawResponse ?? '');
        const safeResponse = this._escapeWalletHtml(responseText || '[AI 返回为空]');
        const safeError = this._escapeWalletHtml(error?.message || '返回内容不符合资产评估标签格式。');
        const modalHtml = `
        <div id="wallet-eval-parse-error-modal" class="wechat-wallet-parse-error-overlay">
            <section class="wechat-wallet-parse-error-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-eval-parse-error-title" tabindex="-1">
                <header class="wechat-wallet-parse-error-header">
                    <div>
                        <span>AI 回复诊断</span>
                        <h3 id="wallet-eval-parse-error-title">资产评估解析失败</h3>
                    </div>
                    <button type="button" class="wechat-wallet-parse-error-close" data-wallet-parse-close aria-label="关闭" title="关闭">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </header>
                <div class="wechat-wallet-parse-error-body">
                    <p class="wechat-wallet-parse-error-note">${safeError} 以下是本次 AI 返回的完整原文，资产数据未发生变化。</p>
                    <section class="wechat-wallet-parse-error-section">
                        <strong>模型原始回复（完整）</strong>
                        <pre class="wechat-wallet-parse-error-response">${safeResponse}</pre>
                    </section>
                </div>
                <footer class="wechat-wallet-parse-error-footer">
                    <button type="button" class="wechat-wallet-parse-error-confirm" data-wallet-parse-close>关闭</button>
                </footer>
            </section>
        </div>`;

        const currentView = document.querySelector('.phone-view-current') || document;
        currentView.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = currentView.querySelector('#wallet-eval-parse-error-modal');
        if (!modalEl) return false;
        const close = () => modalEl.remove();
        modalEl.querySelectorAll('[data-wallet-parse-close]').forEach(button => {
            button.addEventListener('click', close, { once: true });
        });
        modalEl.addEventListener('click', event => {
            if (event.target === modalEl) close();
        });
        modalEl.querySelector('.wechat-wallet-parse-error-dialog')?.focus?.();
        return true;
    }

    // 会话列表：长按松开后弹出“编辑/删除”操作
    bindChatListLongPressDelete() {
        if (this.currentChat || this.currentView !== 'chats') return;
        const currentView = document.querySelector('.phone-view-current') || document;
        const list = currentView.querySelector?.('.wechat-chat-list');
        if (!list) return;

        const closeDeleteMenu = () => {
            const old = document.querySelector('.wechat-chat-delete-pop');
            if (old) old.remove();
        };

        const openChatEditor = (chatId) => {
            const chat = this.wechatData.getChat(chatId);
            if (!chat) return;

            if (chat.type === 'group') {
                this.currentView = 'chats';
                this.currentChat = chat;
                this.wechatData.getMessages(chat.id);
                this.chatView?.showGroupSettings?.({ returnToChatList: true });
                return;
            }

            const contact = (chat.contactId ? this.wechatData.getContact(chat.contactId) : null)
                || this.wechatData.getContactByName?.(chat.name)
                || this.wechatData.findContactByNameLoose?.(chat.name, { includeChats: false });
            if (contact?.id && this.contactsView?.showEditContactPage) {
                this.currentView = 'contacts';
                this.currentChat = null;
                this.contactsView.showEditContactPage(contact.id, { returnToChatList: true });
                return;
            }

            this.phoneShell.showNotification('提示', '未找到对应联系人，请先到通讯录添加', '⚠️');
        };

        const showDeleteMenu = (chatId, itemEl) => {
            closeDeleteMenu();

            const rect = itemEl.getBoundingClientRect();
            const host = document.querySelector('.phone-screen') || document.body;
            const hostRect = host.getBoundingClientRect ? host.getBoundingClientRect() : { top: 0, left: 0 };
            const isBodyHost = host === document.body;
            const topPx = Math.max(8, rect.top + (rect.height / 2) - 16);
            const leftPx = Math.max(8, rect.right - 176);
            const menu = document.createElement('div');
            menu.className = 'wechat-chat-delete-pop';
            menu.style.cssText = `
                position: ${isBodyHost ? 'fixed' : 'absolute'};
                top: ${isBodyHost ? topPx : (topPx - hostRect.top)}px;
                left: ${isBodyHost ? leftPx : (leftPx - hostRect.left)}px;
                z-index: 2147483646;
                background: #fff;
                border: 1px solid #e5e5e5;
                border-radius: 6px;
                padding: 0;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                overflow: hidden;
                display: flex;
            `;

            const baseBtnStyle = `
                border: none;
                background: transparent;
                color: #111;
                font-size: 12px;
                padding: 5px 9px;
                line-height: 1.2;
                cursor: pointer;
            `;

            const chat = this.wechatData.getChat(chatId);
            const isPinned = Number(chat?.pinnedAt || 0) > 0;

            const pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.textContent = isPinned ? '取消置顶' : '置顶';
            pinBtn.style.cssText = `${baseBtnStyle}border-right: 0.5px solid #e5e5e5;color:#3d8bff;`;
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetChat = this.wechatData.getChat(chatId);
                if (!targetChat) {
                    closeDeleteMenu();
                    return;
                }
                const nextPinned = !(Number(targetChat.pinnedAt || 0) > 0);
                this.wechatData.setChatPinned?.(chatId, nextPinned);
                this.phoneShell.showNotification('微信', nextPinned ? `已置顶${targetChat.name}` : `已取消置顶${targetChat.name}`, '✅');
                closeDeleteMenu();
                this.render();
            });

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.textContent = '编辑';
            editBtn.style.cssText = `${baseBtnStyle}border-right: 0.5px solid #e5e5e5;color:#576b95;`;
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDeleteMenu();
                openChatEditor(chatId);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = '删除';
            deleteBtn.style.cssText = baseBtnStyle;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chat = this.wechatData.getChat(chatId);
                if (!chat) {
                    closeDeleteMenu();
                    return;
                }

                const ok = confirm(`确定删除与「${chat.name}」的聊天吗？\n\n删除后将清空该会话的聊天记录与相关零钱流水，且不可恢复。`);
                if (!ok) return;

                this.wechatData.deleteChat(chatId);
                this.phoneShell.showNotification('已删除', `已删除与${chat.name}的聊天`, '✅');
                closeDeleteMenu();
                this.render();
            });

            menu.appendChild(pinBtn);
            void editBtn; // “编辑”已移到私聊的聊天设置里
            menu.appendChild(deleteBtn);
            host.appendChild(menu);

            setTimeout(() => {
                document.addEventListener('click', function closeOnOutside(ev) {
                    if (!menu.contains(ev.target)) {
                        closeDeleteMenu();
                    }
                }, { once: true });
            }, 0);
        };

        // 桌面端兜底：容器级捕获，保证右键一定能弹出删除菜单
        list.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.chat-item');
            if (!item || !list.contains(item)) return;
            const chatId = item.dataset.chatId;
            if (!chatId) return;
            e.preventDefault();
            e.stopPropagation();
            showDeleteMenu(chatId, item);
        }, true);

        list.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            const item = e.target.closest('.chat-item');
            if (!item || !list.contains(item)) return;
            const chatId = item.dataset.chatId;
            if (!chatId) return;
            e.preventDefault();
            e.stopPropagation();
            showDeleteMenu(chatId, item);
        }, true);

        list.querySelectorAll?.('.chat-item').forEach(item => {
            const chatId = item.dataset.chatId;
            if (!chatId) return;

            let pressTimer = null;
            let longPressReady = false;
            let startX = 0;
            let startY = 0;
            let suppressOpen = false;

            const clearPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const startPress = (x, y) => {
                startX = x;
                startY = y;
                longPressReady = false;
                clearPress();
                pressTimer = setTimeout(() => {
                    longPressReady = true;
                }, 450);
            };

            const movePress = (x, y) => {
                if (!pressTimer) return;
                if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) {
                    clearPress();
                }
            };

            const endPress = () => {
                clearPress();
                if (!longPressReady) return;
                longPressReady = false;
                suppressOpen = true;
                showDeleteMenu(chatId, item);
                setTimeout(() => { suppressOpen = false; }, 350);
            };

            item.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length === 0) return;
                const t = e.touches[0];
                startPress(t.clientX, t.clientY);
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (!e.touches || e.touches.length === 0) return;
                const t = e.touches[0];
                movePress(t.clientX, t.clientY);
            }, { passive: true });

            item.addEventListener('touchend', () => {
                endPress();
            });

            item.addEventListener('touchcancel', () => {
                clearPress();
                longPressReady = false;
            });

            item.addEventListener('mousedown', (e) => {
                // 桌面端右键：立即弹出删除菜单（不依赖 contextmenu 事件）
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    suppressOpen = true;
                    showDeleteMenu(chatId, item);
                    setTimeout(() => { suppressOpen = false; }, 350);
                    return;
                }
                if (e.button !== 0) return;
                startPress(e.clientX, e.clientY);
            });

            item.addEventListener('mousemove', (e) => {
                movePress(e.clientX, e.clientY);
            });

            item.addEventListener('mouseup', () => {
                endPress();
            });

            item.addEventListener('mouseleave', () => {
                clearPress();
                longPressReady = false;
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                suppressOpen = true;
                showDeleteMenu(chatId, item);
                setTimeout(() => { suppressOpen = false; }, 350);
            });

            item.onclick = (e) => {
                if (suppressOpen || document.querySelector('.wechat-chat-delete-pop')) return;
                const targetChatId = e.currentTarget.dataset.chatId;
                if (targetChatId) this.openChat(targetChatId);
            };
        });
    }

    openChat(chatId) {
        if (this.phoneShell?.isHomeReturnGuardActive?.()) return false;

        const chat = this.wechatData.getChat(chatId);
        if (chat) {
            if (String(this.currentChat?.id || '') !== String(chatId || '')) {
                this.chatView?.resetTransientInputPanels?.();
            }
            // 🔥 核心修复：在进入聊天窗口之前，强行触发一次 getMessages 拉取独立存储，防止界面白板
            this.wechatData.getMessages(chatId);
            this.currentChat = chat;
            this.render();
            return true;
        }
        return false;
    }

    enqueueExternalMessageForAI(chatId) {
        const safeChatId = String(chatId || '').trim();
        if (!safeChatId || !this.chatView?.isOnlineMode?.()) return false;
        const queued = this.chatView._enqueuePendingChat?.(safeChatId, {
            shouldStartTimer: false,
            shouldShowStatus: true
        });
        if (queued) this.chatView._restartPendingTimerIfNeeded?.(safeChatId);
        return !!queued;
    }

    openMoments() {
        this.momentsView.render();
    }

    // 接收新消息（从AI正文）
    receiveMessage(data) {
        const fromName = data.from || 'AI助手';
        const isGroup = data.type === 'group' || data.isGroup;
        const groupName = data.groupName || data.chatId; // 群名
        const senderInGroup = data.sender || fromName; // 群内发送者
        let chatId = data.chatId || null;
        let chat = null;

        // 🔥 优先通过 chatId 查找聊天
        if (chatId) {
            chat = this.wechatData.getChat(chatId);
        }

        // 🔥 如果没找到聊天，根据类型查找
        if (!chat) {
            const allChats = this.wechatData.getChatList();

            if (isGroup) {
                // 🔥 群聊：通过群名查找是否有同名的群
                const searchName = groupName || fromName;
                chat = allChats.find(c => c.type === 'group' && c.name === searchName);

                if (chat) {
                    chatId = chat.id;
                } else {
                    // 🔥 群不存在，创建新群聊
                    chatId = `group_${Date.now()}`;
                    chat = this.wechatData.createChat({
                        id: chatId,
                        name: searchName,
                        type: 'group',
                        avatar: data.avatar || '👥',
                        members: data.members || [senderInGroup]
                    });
                }
            } else {
                // 🔥 单聊：通过发送者名字在通讯录中查找联系人
                const existingContact = this.wechatData.findContactByAlias?.(fromName);

                if (existingContact) {
                    // 🔥 联系人存在，查找或创建对应的聊天窗口
                    chat = this.wechatData.getChatByContactId(existingContact.id);

                    if (!chat) {
                        // 也尝试通过名字查找聊天（兼容旧数据）
                        chat = allChats.find(c => c.type !== 'group' && c.name === fromName);
                    }

                    if (!chat) {
                        // 联系人存在但没有聊天窗口，创建聊天（不重复添加联系人）
                        chat = this.wechatData.createChat({
                            id: `chat_${existingContact.id}`,
                            contactId: existingContact.id,
                            name: existingContact.name,
                            type: 'single',
                            avatar: existingContact.avatar || '👤'
                        });
                    }
                    chatId = chat.id;
                } else {
                    // 🔥 也尝试通过名字直接查找聊天（可能之前没关联联系人）
                    chat = allChats.find(c => c.type !== 'group' && c.name === fromName);

                    if (chat) {
                        chatId = chat.id;
                    } else {
                        // 🔥 联系人不存在，先添加联系人再创建聊天
                        const newContactId = `contact_${Date.now()}`;
                        const createdContact = this.wechatData.addContact({
                            id: newContactId,
                            name: fromName,
                            avatar: data.avatar || '👤',
                            letter: this.wechatData.getFirstLetter(fromName)
                        });

                        const resolvedContactId = createdContact?.id || newContactId;
                        chatId = `chat_${resolvedContactId}`;
                        chat = this.wechatData.createChat({
                            id: chatId,
                            contactId: resolvedContactId,
                            name: createdContact?.name || fromName,
                            type: 'single',
                            avatar: createdContact?.avatar || data.avatar || '👤'
                        });
                    }
                }
            }
        }

        // 添加消息
        const msgSender = isGroup ? senderInGroup : (chat?.name || fromName);

        if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach(msg => {
                this.wechatData.addMessage(chatId, {
                    from: isGroup ? (msg.sender || msgSender) : msgSender,
                    content: msg.text || msg.message,
                    time: msg.timestamp || data.timestamp || '刚刚',
                    type: 'text'
                });
            });

            // 如果不在当前聊天，增加未读
            if (!this.currentChat || this.currentChat.id !== chatId) {
                chat.unread = (chat.unread || 0) + data.messages.length;
            }
        } else if (data.message) {
            this.wechatData.addMessage(chatId, {
                from: msgSender,
                content: data.message,
                time: data.timestamp || '刚刚',
                type: 'text'
            });

            if (!this.currentChat || this.currentChat.id !== chatId) {
                chat.unread = (chat.unread || 0) + 1;
            }
        }

        // 刷新界面
        if (this.currentChat && this.currentChat.id === chatId) {
            this.render();
        }

        this.wechatData.saveData();
    }

    /// ✅ 编辑个人资料（手机内部界面，不用弹窗）
    showEditProfile() {
        const userInfo = this.wechatData.getUserInfo();
        const shellBg = this._getMainShellBackgroundConfig();
        const profileContentStyle = `${shellBg.contentBgStyle || 'background: #f2f2f7;'} padding: 16px 12px;`;
        const ttsProviderOptions = this.contactsView?._getTtsProviderOptions?.() || [];
        const currentTtsProvider = this.contactsView?._getCurrentTtsProvider?.() || 'minimax_cn';
        const userTtsProvider = String(userInfo.ttsProvider || '').trim();
        const userTtsVoices = (userInfo.ttsVoices && typeof userInfo.ttsVoices === 'object')
            ? userInfo.ttsVoices
            : {};
        const legacyTtsVoice = String(userInfo.ttsVoice || '').trim();
        const ttsHistoryOptions = this.contactsView?._getTtsVoiceHistoryOptions?.() || '';
        const escapeAttr = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const safeNaiPromptTags = String(userInfo.naiPromptTags || userInfo.imageTags || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            
        const avatarHtml = this.renderAvatar(userInfo.avatar, '😊', userInfo.name);

        const html = `
        <div class="${shellBg.appClass}" style="${shellBg.appStyle}">
            <div class="wechat-header">
                <div class="wechat-header-left">
                    <button class="wechat-back-btn" id="back-from-profile-edit">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div class="wechat-header-title">编辑个人资料</div>
                <div class="wechat-header-right"></div>
            </div>

            <div class="wechat-content wechat-profile-edit-content" style="${profileContentStyle}">
                
                <!-- 📸 头像卡片 -->
                <div style="background: #fff; border-radius: 12px; padding: 24px 16px; text-align: center; margin-bottom: 16px;">
                    <div id="user-avatar-preview" style="
                        width: 72px;
                        height: 72px;
                        border-radius: 50%;
                        background: #f0f0f0;
                        margin: 0 auto 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                        overflow: hidden;
                        border: 0.5px solid #e5e5ea;
                    ">${avatarHtml}</div>
                    <div id="upload-user-avatar-btn" style="
                        color: #576b95;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: inline-block;
                        padding: 4px 12px;
                    ">更换头像</div>
                    <input type="file" id="user-avatar-upload" accept="image/png, image/jpeg, image/gif, image/webp, image/*" style="display: none;">
                </div>

                <!-- 📝 基础资料卡片 (iOS 列表风格) -->
                <div style="background: #fff; border-radius: 12px; padding: 0 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; padding: 16px 0; border-bottom: 0.5px solid #f0f0f0;">
                        <div style="width: 70px; font-size: 15px; color: #000;">昵称</div>
                        <input type="text" id="user-name-input" placeholder="未设置" value="${userInfo.name || ''}" maxlength="20" style="
                            flex: 1; border: none; outline: none; background: transparent; 
                            font-size: 15px; color: #333; text-align: right; min-width: 0;
                        ">
                    </div>
                    <div style="display: flex; align-items: center; padding: 16px 0;">
                        <div style="width: 70px; font-size: 15px; color: #000;">签名</div>
                        <input type="text" id="user-signature-input" placeholder="未设置" value="${userInfo.signature || ''}" maxlength="50" style="
                            flex: 1; border: none; outline: none; background: transparent; 
                            font-size: 15px; color: #333; text-align: right; min-width: 0;
                        ">
                    </div>
                    <div style="padding: 14px 0; border-top: 0.5px solid #f0f0f0;">
                        <div style="font-size: 15px; color: #000; margin-bottom: 6px;">用户固定形象Tag</div>
                        <textarea id="user-nai-prompt-tags-input" placeholder="例如：1girl, long black hair, brown eyes, casual outfit" style="
                            width: 100%; min-height: 70px; padding: 10px; border: none; border-radius: 8px;
                            background: #f9f9f9; font-size: 13px; color: #333; line-height: 1.45;
                            font-family: inherit; resize: vertical; outline: none; box-sizing: border-box;
                        ">${safeNaiPromptTags}</textarea>
                        <div style="font-size: 11px; color: #8e8e93; line-height: 1.45; margin-top: 5px;">
                            生成 [用户照片] 时会拼在 AI 图片描述前面，用于固定用户外观。
                        </div>
                    </div>
                </div>

                <div class="phone-prompt-fold wechat-user-tts-fold" data-default-open="false" style="margin-bottom: 16px;">
                    <div class="phone-prompt-fold-header" id="edit-user-tts-fold-header" role="button" tabindex="0"
                         aria-expanded="false" aria-controls="edit-user-tts-fold-content">
                        <div class="phone-prompt-fold-main">
                            <div class="phone-prompt-fold-title"><i class="fa-solid fa-microphone" aria-hidden="true" style="margin-right: 6px;"></i>专属语音音色</div>
                            <div class="phone-prompt-fold-desc">点击展开查看各服务商音色</div>
                        </div>
                        <i class="fa-solid fa-chevron-right phone-prompt-fold-arrow" aria-hidden="true"></i>
                    </div>
                    <div class="phone-prompt-fold-content" id="edit-user-tts-fold-content" aria-hidden="true">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #666;">历史音色快速填入</div>
                            <select id="edit-user-tts-history-select" style="border: 1px solid #ddd; background: rgba(255,255,255,0.82); border-radius: 4px; font-size: 11px; padding: 2px 4px; outline: none; max-width: 128px;">
                                <option value="">-- 历史音色 --</option>
                                ${ttsHistoryOptions}
                            </select>
                        </div>
                        <label style="display: block; margin-bottom: 7px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 3px;">用户默认语音服务商</div>
                            <select id="edit-user-tts-provider-select" style="width: 100%; height: 30px; padding: 0 8px; border: 1px solid #ddd; background: rgba(255,255,255,0.82); border-radius: 6px; font-size: 12px; box-sizing: border-box;">
                                <option value="" ${!userTtsProvider ? 'selected' : ''}>跟随全局设置</option>
                                ${ttsProviderOptions.map(option => `
                                    <option value="${escapeAttr(option.id)}" ${userTtsProvider === option.id ? 'selected' : ''}>${escapeAttr(option.label)}</option>
                                `).join('')}
                            </select>
                        </label>
                        <div style="display: flex; flex-direction: column; gap: 7px;">
                            ${ttsProviderOptions.map(option => {
                                const providerVoice = String(userTtsVoices?.[option.id] || '').trim();
                                const value = providerVoice || (option.id === currentTtsProvider ? legacyTtsVoice : '');
                                return `
                                    <label style="display: block;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                                            <span style="font-size: 11px; color: #666;">${escapeAttr(option.label)}</span>
                                            ${option.id === currentTtsProvider ? '<span style="font-size: 10px; color: #07c160;">当前</span>' : ''}
                                        </div>
                                        <input type="text" class="edit-user-tts-provider-input" data-provider="${escapeAttr(option.id)}"
                                               placeholder="${escapeAttr(option.placeholder)}" value="${escapeAttr(value)}" style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; background: rgba(255,255,255,0.82); border-radius: 6px; font-size: 12px; box-sizing: border-box;">
                                    </label>
                                `;
                            }).join('')}
                        </div>
                        <div style="font-size: 10px; color: #8e8e93; line-height: 1.4; margin-top: 7px;">点击自己发送的文字语音条时，会优先使用这里设置的音色。</div>
                    </div>
                </div>

                <!-- iOS蓝按钮 -->
                <button id="save-user-profile" style="
                    width: 100%; padding: 14px; background: #ffffff; color: #050505; 
                    border: none; border-radius: 12px; font-size: 16px; font-weight: 500; 
                    cursor: pointer; margin-bottom: 20px; transition: transform 0.1s;
                ">应用并保存所有更改</button>

            </div>
        </div>
        `;

        this.phoneShell.setContent(html);

        const userTtsFold = document.querySelector('.wechat-user-tts-fold');
        const userTtsFoldHeader = document.getElementById('edit-user-tts-fold-header');
        const userTtsFoldContent = document.getElementById('edit-user-tts-fold-content');
        const setUserTtsFoldExpanded = (expanded) => {
            const isExpanded = expanded === true;
            userTtsFold?.classList.toggle('is-open', isExpanded);
            userTtsFoldHeader?.setAttribute('aria-expanded', String(isExpanded));
            userTtsFoldContent?.setAttribute('aria-hidden', String(!isExpanded));
        };
        const toggleUserTtsFold = () => {
            setUserTtsFoldExpanded(!userTtsFold?.classList.contains('is-open'));
        };
        userTtsFoldHeader?.addEventListener('click', toggleUserTtsFold);
        userTtsFoldHeader?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleUserTtsFold();
        });
        setUserTtsFoldExpanded(false);

        document.getElementById('edit-user-tts-history-select')?.addEventListener('change', (event) => {
            const selectedVoice = String(event.target?.value || '').trim();
            if (!selectedVoice) return;
            const targetProvider = String(document.getElementById('edit-user-tts-provider-select')?.value || currentTtsProvider).trim() || currentTtsProvider;
            const targetInput = Array.from(document.querySelectorAll('.edit-user-tts-provider-input'))
                .find(input => String(input.dataset.provider || '').trim() === targetProvider)
                || document.querySelector('.edit-user-tts-provider-input');
            if (targetInput) targetInput.value = selectedVoice;
        });

        // 返回按钮
        document.getElementById('back-from-profile-edit')?.addEventListener('click', () => {
            this.render();
        });

        // ==================================================
        // 📸 头像上传
        // ==================================================
        document.getElementById('upload-user-avatar-btn')?.addEventListener('click', () => {
            document.getElementById('user-avatar-upload').click();
        });

        document.getElementById('user-avatar-upload')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = '';

            if (file.size > 5 * 1024 * 1024) {
                this.phoneShell.showNotification('提示', '图片太大，请选择小于5MB的图片', '⚠️');
                return;
            }

            try {
                const cropper = new ImageCropper({
                    title: '裁剪头像',
                    aspectRatio: 1,
                    outputWidth: 512,
                    outputHeight: 512,
                    quality: 0.92,
                    maxFileSize: 5 * 1024 * 1024
                });
                const croppedImage = await cropper.open(file);

                const preview = document.getElementById('user-avatar-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${croppedImage}" style="width:100%;height:100%;object-fit:cover;">`;
                }

                this.phoneShell.showNotification('处理中', '正在上传头像...', '⏳');

                const imageManager = window.VirtualPhone?.imageManager;
                const finalUrl = await imageManager?.uploadDataUrl?.(croppedImage, 'wechat_avatar');
                if (!finalUrl) throw new Error('图片上传管理器未初始化');
                if (finalUrl) {
                    const oldAvatar = String(this.wechatData.getUserInfo()?.avatar || '').trim();
                    this.wechatData.updateUserInfo({ avatar: finalUrl });
                    if (oldAvatar && oldAvatar !== finalUrl) {
                        const cleanupTask = window.VirtualPhone?.imageManager?.deleteManagedBackgroundByPath?.(oldAvatar, { quiet: true, skipIfReferenced: true });
                        cleanupTask?.catch?.(() => { });
                    }
                    this.phoneShell.showNotification('成功', '头像已上传并保存', '✅');
                } else {
                    throw new Error('上传接口返回错误');
                }
            } catch (err) {
                if (String(err?.message || '') === '用户取消') return;
                console.warn('微信头像上传服务器失败:', err);
                this.phoneShell.showNotification('提示', '上传服务器失败，请检查酒馆后台', '⚠️');
            }
        });

        // ==================================================
        // 💾 保存所有设置
        // ==================================================
        const saveBtn = document.getElementById('save-user-profile');
        saveBtn?.addEventListener('click', async () => {
            saveBtn.style.transform = 'scale(0.96)';
            setTimeout(() => saveBtn.style.transform = 'scale(1)', 100);

            const newName = document.getElementById('user-name-input').value.trim();
            const newSignature = document.getElementById('user-signature-input').value.trim();
            const naiPromptTags = document.getElementById('user-nai-prompt-tags-input')?.value?.trim() || '';
            const ttsProvider = String(document.getElementById('edit-user-tts-provider-select')?.value || '').trim();
            const ttsVoices = {};
            let currentProviderTtsVoice = '';
            document.querySelectorAll('.edit-user-tts-provider-input').forEach((input) => {
                const provider = String(input.dataset.provider || '').trim();
                const value = String(input.value || '').trim();
                if (provider && value) ttsVoices[provider] = value;
                if (provider === currentTtsProvider) currentProviderTtsVoice = value;
            });

            if (!newName) {
                this.phoneShell.showNotification('提示', '请输入昵称', '⚠️');
                return;
            }

            this.wechatData.updateUserInfo({
                name: newName,
                signature: newSignature,
                naiPromptTags,
                ttsProvider,
                ttsVoices,
                ttsVoice: currentProviderTtsVoice
            });
            
            setTimeout(() => this.render(), 200);
        });
    }

    showSettings() {
        this._isAvatarManagerOpen = false;
        this._wechatPanelMode = 'settings';
        const promptManager = window.VirtualPhone?.promptManager;
        const prompts = promptManager?.prompts?.wechat || {};
        const shellBg = this._getMainShellBackgroundConfig();
        const settingsContentStyle = shellBg.contentBgStyle || 'background: #ededed;';
        const useWechatWorldbook = window.VirtualPhone?.worldbookManager?.getEnabled?.('wechat') ?? true;
        const userInfo = this.wechatData.getUserInfo();
        const momentsBackground = String(userInfo?.momentsBackground || '').trim();
        // 🌐 翻译设定（仿电波手机）
        const transSettings = this.wechatData.getTranslationSettings?.() || {};
        const transLangOptions = this.wechatData.getTranslationLanguageOptions?.() || [];
        const buildLangOptions = (selected, withFollow = false) => [
            ...(withFollow ? [{ value: '', label: '跟随角色卡' }] : []),
            ...transLangOptions
        ].map(opt => `<option value="${opt.value}" ${String(selected || '') === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
        const chatCssState = this._ensureChatCssPresetState();
        const escapeChatCssHtml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const safeCustomCss = escapeChatCssHtml(chatCssState.activeProfile?.css || '');
        const chatCssProfileOptions = chatCssState.profiles.map(profile => `
            <option value="${escapeChatCssHtml(profile.id)}" ${profile.id === chatCssState.activeId ? 'selected' : ''}>${escapeChatCssHtml(profile.name)}${profile.builtin ? '（内置）' : ''}</option>
        `).join('');
        const hasActiveChatCssProfile = !!chatCssState.activeProfile;
        const isActiveChatCssProfileBuiltin = chatCssState.activeProfile?.builtin === true;
        const canEditActiveChatCssProfile = hasActiveChatCssProfile && !isActiveChatCssProfileBuiltin;
        const momentsBackgroundPreview = momentsBackground
            ? `background-image:url('${momentsBackground}');background-size:cover;background-position:center;`
            : 'background:linear-gradient(135deg,#f3f4f6,#e9edf2);';
        const html = `
        <div class="${shellBg.appClass}" style="${shellBg.appStyle}">
            <div class="wechat-header">
                <div class="wechat-header-left">
                    <button class="wechat-back-btn" id="back-from-settings">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div class="wechat-header-title">微信设置</div>
                <div class="wechat-header-right"></div>
            </div>
            
            <div class="wechat-content" style="${settingsContentStyle}">
                <!-- 模式提示 -->
<div style="background: #e3f2fd; border-radius: 12px; padding: 15px; margin: 15px;">
    <div style="font-size: 14px; color: #1976d2;">
        <i class="fa-solid fa-info-circle"></i> 
        互动模式状态：${(() => {
            const storage = window.VirtualPhone?.storage;
            if (!storage) return '❌ 未开启';
            const isOn = (value) => value === true || value === 'true' || value === 1;
            const interopOn = storage.get(this.wechatData.getOnlineModeStorageKey?.() || 'wechat_online_mode');
            const onlineOnlyOn = storage.get(this.wechatData.getOnlineOnlyModeStorageKey?.() || 'wechat_online_only_mode');
            return (isOn(interopOn) || isOn(onlineOnlyOn)) ? '✅ 已开启' : '❌ 未开启';
        })()}
        <div style="font-size: 12px; margin-top: 5px; color: #666;">
            如需修改，请前往手机"设置"APP（每个会话独立设置）
        </div>
    </div>
</div>

                <!-- 生成上下文设置 -->
                <div style="background: #fff; border-radius: 12px; margin: 15px; padding: 15px;">
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px;">
                        生成上下文
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div style="min-width: 0;">
                            <div style="font-size: 14px; color: #222;">使用酒馆世界书</div>
                            <div style="font-size: 12px; color: #888; line-height: 1.45; margin-top: 4px;">
                                开启后，微信生成会注入下方勾选的酒馆世界书；不受酒馆启用状态影响。
                            </div>
                        </div>
                        <label class="toggle-switch" style="flex: 0 0 auto;">
                            <input type="checkbox" id="wechat-use-worldbook" ${useWechatWorldbook ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="phone-prompt-fold wechat-worldbook-fold" data-default-open="false" style="margin-top: 12px;">
                        <div class="phone-prompt-fold-header">
                            <div class="phone-prompt-fold-main">
                                <div class="phone-prompt-fold-title">世界书选择</div>
                                <div class="phone-prompt-fold-desc">展开后勾选要注入的酒馆世界书</div>
                            </div>
                            <i class="fa-solid fa-chevron-right phone-prompt-fold-arrow"></i>
                        </div>
                        <div class="phone-prompt-fold-content">
                            <div id="wechat-worldbook-list">
                                <div style="font-size: 12px; color: #888; padding: 8px 0;">正在读取当前可用世界书...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 功能提示词设置 -->
                <div style="background: #fff; border-radius: 12px; margin: 15px; padding: 15px;">
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 15px;">
                        📝 功能提示词
                    </div>

                    <!-- 线上破限词 -->
                    <div class="prompt-item" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; margin-bottom: 12px;">
                        <div class="prompt-header" style="display: flex; align-items: center; cursor: pointer;"
                             data-feature="override">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <i class="fa-solid fa-chevron-right prompt-arrow"
                                   style="color: #999; font-size: 12px; margin-right: 8px; transition: transform 0.2s;"></i>
                                <span style="font-size: 15px;">${prompts.override?.name || '🧩 线上破限词'}</span>
                            </div>
                        </div>
                        <div class="prompt-content" style="display: none; margin-top: 10px; padding-left: 20px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                ${prompts.override?.description || '微信线上聊天、语音、通话、视频请求开头注入'}
                            </div>
                            <button class="edit-prompt-btn" data-feature="override" style="
                                padding: 6px 12px;
                                background: #f0f0f0;
                                border: none;
                                border-radius: 4px;
                                font-size: 12px;
                                color: #333;
                                cursor: pointer;
                            ">编辑提示词</button>
                        </div>
                    </div>

                    <!-- 线下模式 -->
                    <div class="prompt-item" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; margin-bottom: 12px;">
                        <div class="prompt-header" style="display: flex; align-items: center; cursor: pointer;"
                             data-feature="offline">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <i class="fa-solid fa-chevron-right prompt-arrow"
                                   style="color: #999; font-size: 12px; margin-right: 8px; transition: transform 0.2s;"></i>
                                <span style="font-size: 15px;">📴 线下模式</span>
                            </div>
                        </div>
                        <div class="prompt-content" style="display: none; margin-top: 10px; padding-left: 20px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                ${prompts.offline?.description || '酒馆正文中的微信消息规则'}
                            </div>
                            <button class="edit-prompt-btn" data-feature="offline" style="
                                padding: 6px 12px;
                                background: #f0f0f0;
                                border: none;
                                border-radius: 4px;
                                font-size: 12px;
                                color: #333;
                                cursor: pointer;
                            ">编辑提示词</button>
                        </div>
                    </div>

                    <!-- 线上模式（展开式父级） -->
                    <div class="prompt-item" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; margin-bottom: 12px;">
                        <div class="prompt-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;"
                             data-feature="online-group">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <i class="fa-solid fa-chevron-right prompt-arrow"
                                   style="color: #999; font-size: 12px; margin-right: 8px; transition: transform 0.2s;"></i>
                                <span style="font-size: 15px;">📱 线上模式</span>
                            </div>
                        </div>
                        <!-- 🔥 展开后显示三个子项 -->
                        <div class="prompt-content" style="display: none; margin-top: 10px; padding-left: 20px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                                手机内在线聊天和通话规则
                            </div>

                            <!-- 子项1：微信聊天 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">💬 微信聊天</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.online?.description || '手机内微信聊天规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="online" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>

                            <!-- 子项2：语音通话 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">📞 语音通话</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.voiceCall?.description || '微信语音通话规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="voiceCall" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>

                            <!-- 子项3：视频通话 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">📹 视频通话</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.videoCall?.description || '微信视频通话规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="videoCall" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>

                            <!-- 子项4：群聊 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-top: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">👥 群聊</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.groupChat?.description || '微信群聊规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="groupChat" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>

                            <!-- 子项5：群语音通话 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-top: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">👥📞 群语音通话</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.groupVoiceCall?.description || '微信群语音通话规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="groupVoiceCall" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>

                            <!-- 子项6：群视频通话 -->
                            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-top: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 14px;">👥📹 群视频通话</span>
                                </div>
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    ${prompts.groupVideoCall?.description || '微信群视频通话规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="groupVideoCall" style="
                                    padding: 5px 10px;
                                    background: #fff;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑提示词</button>
                            </div>
                        </div>
                    </div>

                    <!-- 朋友圈 -->
                    <div class="prompt-item" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; margin-bottom: 12px;">
                        <div class="prompt-header" style="display: flex; align-items: center; cursor: pointer;" 
                             data-feature="moments">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <i class="fa-solid fa-chevron-right prompt-arrow" 
                                   style="color: #999; font-size: 12px; margin-right: 8px; transition: transform 0.2s;"></i>
                                <span style="font-size: 15px;">${prompts.moments?.name || '📸 朋友圈'}</span>
                            </div>
                        </div>
                        <div class="prompt-content" style="display: none; margin-top: 10px; padding-left: 20px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                ${prompts.moments?.description || '朋友圈动态生成规则'}
                            </div>
                            <button class="edit-prompt-btn" data-feature="moments" style="
                                padding: 6px 12px;
                                background: #f0f0f0;
                                border: none;
                                border-radius: 4px;
                                font-size: 12px;
                                color: #333;
                                cursor: pointer;
                            ">编辑提示词</button>

                            <div style="margin-top: 10px;">
                                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                    ${prompts.momentsInteraction?.description || '发圈后好友点赞/评论互动规则'}
                                </div>
                                <button class="edit-prompt-btn" data-feature="momentsInteraction" style="
                                    padding: 6px 12px;
                                    background: #f0f0f0;
                                    border: none;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    color: #333;
                                    cursor: pointer;
                                ">编辑互动提示词</button>
                            </div>
                        </div>
                    </div>

                    <!-- 智能加载联系人 -->
                    <div class="prompt-item">
                        <div class="prompt-header" style="display: flex; align-items: center; cursor: pointer;" 
                             data-feature="loadContacts">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <i class="fa-solid fa-chevron-right prompt-arrow" 
                                   style="color: #999; font-size: 12px; margin-right: 8px; transition: transform 0.2s;"></i>
                                <span style="font-size: 15px;">${prompts.loadContacts?.name || '🤖 智能加载联系人'}</span>
                            </div>
                        </div>
                        <div class="prompt-content" style="display: none; margin-top: 10px; padding-left: 20px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                ${prompts.loadContacts?.description || '从角色卡生成联系人'}
                            </div>
                            <button class="edit-prompt-btn" data-feature="loadContacts" style="
                                padding: 6px 12px;
                                background: #f0f0f0;
                                border: none;
                                border-radius: 4px;
                                font-size: 12px;
                                color: #333;
                                cursor: pointer;
                            ">编辑提示词</button>
                        </div>
                    </div>
                </div>

                <!-- 表情包 API 设置 -->
                <div style="background: #fff; border-radius: 12px; margin: 15px; padding: 12px;">
                    <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">
                        🖼️ 表情包 API 密钥
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <div class="phone-secret-field" style="flex: 1; min-width: 0; border: 1px solid #e5e5e5; border-radius: 6px; background: #fff;">
                            <input type="text" class="phone-secret-input phone-secret-masked" id="alapi-token-input" placeholder="输入 ALAPI Token"
                                   value="${window.VirtualPhone?.storage?.get('global_alapi_token') || ''}" style="
                                width: 100%;
                                min-width: 0;
                                padding: 8px 34px 8px 8px;
                                border: none;
                                font-size: 12px;
                                outline: none;
                                box-sizing: border-box;
                                background: transparent;
                            ">
                            <button type="button" class="phone-password-toggle" id="toggle-alapi-token-visibility" aria-label="显示表情包 API 密钥" title="显示表情包 API 密钥">
                                <i class="fa-regular fa-eye"></i>
                            </button>
                        </div>
                        <button id="save-alapi-token-btn" style="
                            padding: 8px 12px;
                            background: #07c160;
                            color: #fff;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            cursor: pointer;
                            flex-shrink: 0;
                        ">保存</button>
                    </div>
                </div>

                <!-- 头像管理 -->
                <div style="background: #fff; border-radius: 12px; margin: 15px; padding: 15px;">
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 10px;">
                        👤 头像管理器
                    </div>
                    <div style="font-size: 12px; color: #888; line-height: 1.45; margin-bottom: 10px;">
                        为通讯录联系人标记男女。无自定义头像时，将从 <code>apps/wechat/avatars/</code> 里按性别随机分配默认头像。
                    </div>
                    <button id="wechat-avatar-manager-btn" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #e7e7e7;
                        border-radius: 8px;
                        background: #fafafa;
                        color: #333;
                        font-size: 13px;
                        cursor: pointer;
                    ">打开头像管理器</button>
                </div>

                <!-- 外观背景设置 -->
                <div style="background: #fff; border-radius: 12px; margin: 15px; padding: 15px;">
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px;">
                        外观背景
                    </div>
                    <input type="file" id="wechat-settings-moments-bg-upload" accept="image/png, image/jpeg, image/gif, image/webp, image/*" style="display: none;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 54px; height: 78px; border-radius: 10px; overflow: hidden; flex: 0 0 auto; border: 1px solid #e7e7e7; ${momentsBackgroundPreview}">
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-size: 14px; color: #222;">朋友圈背景</div>
                            <div style="font-size: 12px; color: #888; line-height: 1.45; margin-top: 4px;">
                                设置朋友圈列表页背景图，适合放角色、场景或主题图。
                            </div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                        <button id="wechat-settings-change-moments-bg" style="
                            padding: 9px 10px;
                            border: 1px solid #e7e7e7;
                            border-radius: 8px;
                            background: #fafafa;
                            color: #222;
                            font-size: 13px;
                            cursor: pointer;
                        ">更换背景</button>
                        <button id="wechat-settings-clear-moments-bg" ${momentsBackground ? '' : 'disabled'} style="
                            padding: 9px 10px;
                            border: 1px solid ${momentsBackground ? '#ffd0d0' : '#ececec'};
                            border-radius: 8px;
                            background: ${momentsBackground ? '#fff7f7' : '#f7f7f7'};
                            color: ${momentsBackground ? '#d93025' : '#aaa'};
                            font-size: 13px;
                            cursor: ${momentsBackground ? 'pointer' : 'default'};
                        ">清除背景</button>
                    </div>
                </div>

                <!-- 数据管理 -->
                <div style="background: #fff3cd; border-radius: 12px; padding: 15px; margin: 15px; border: 1px solid #ffc107;">
                    <div style="font-size: 14px; font-weight: 600; color: #856404; margin-bottom: 12px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> 数据管理
                    </div>
                    <button id="clear-wechat-data" style="
                        width: 100%;
                        padding: 12px;
                        background: #fff;
                        border: 1px solid #ffc107;
                        border-radius: 8px;
                        color: #856404;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        margin-bottom: 8px;
                    ">管理微信数据</button>
                </div>
            </div>
        </div>
    `;

        this.phoneShell.setContent(html);
        this.renderWechatWorldbookList();

        // 返回按钮
        const backBtn = document.getElementById('back-from-settings');
        if (backBtn) backBtn.onclick = () => {
            this._wechatPanelMode = 'main';
            this.render();
        };

        document.getElementById('wechat-settings-change-moments-bg')?.addEventListener('click', () => {
            document.getElementById('wechat-settings-moments-bg-upload')?.click();
        });

        document.getElementById('wechat-settings-clear-moments-bg')?.addEventListener('click', async () => {
            const currentUserInfo = this.wechatData.getUserInfo();
            const oldBackground = String(currentUserInfo?.momentsBackground || '').trim();
            if (!oldBackground) return;
            currentUserInfo.momentsBackground = null;
            this.wechatData.saveData();
            const cleanupTask = window.VirtualPhone?.imageManager?.deleteManagedBackgroundByPath?.(oldBackground, { quiet: true });
            cleanupTask?.catch?.(() => { });
            this.phoneShell.showNotification('成功', '朋友圈背景已清除', '✅');
            this.showSettings();
        });

        document.getElementById('wechat-settings-moments-bg-upload')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = '';

            try {
                const cropper = new ImageCropper({
                    title: '裁剪朋友圈背景',
                    outputWidth: 1080,
                    outputHeight: 1920,
                    quality: 0.9,
                    maxFileSize: 5 * 1024 * 1024
                });

                const croppedImage = await cropper.open(file);
                const finalUrl = await window.VirtualPhone?.imageManager?.uploadDataUrl?.(croppedImage, 'moments_bg');
                if (!finalUrl) throw new Error('图片上传管理器未初始化');
                const currentUserInfo = this.wechatData.getUserInfo();
                const oldBackground = String(currentUserInfo?.momentsBackground || '').trim();
                currentUserInfo.momentsBackground = finalUrl;
                this.wechatData.saveData();
                if (oldBackground && oldBackground !== finalUrl) {
                    const cleanupTask = window.VirtualPhone?.imageManager?.deleteManagedBackgroundByPath?.(oldBackground, { quiet: true, skipIfReferenced: true });
                    cleanupTask?.catch?.(() => { });
                }
                this.phoneShell.showNotification('成功', '朋友圈背景已更新', '✅');
                this.showSettings();
            } catch (error) {
                if (error?.message !== '用户取消') {
                    this.phoneShell.showNotification('提示', error?.message || String(error || '背景上传失败'), '⚠️');
                }
            }
        });

        // 折叠展开功能
        document.querySelectorAll('.phone-prompt-fold').forEach(fold => {
            if (fold.dataset.foldInited !== '1') {
                fold.dataset.foldInited = '1';
                fold.classList.toggle('is-open', String(fold.dataset.defaultOpen || '').toLowerCase() === 'true');
            }
        });
        document.querySelectorAll('.phone-prompt-fold-header').forEach(header => {
            if (header.dataset.foldBound === '1') return;
            header.dataset.foldBound = '1';
            header.addEventListener('click', () => {
                const fold = header.closest('.phone-prompt-fold');
                if (!fold) return;
                fold.classList.toggle('is-open');
            });
        });

        document.querySelectorAll('.prompt-header').forEach(header => {
            header.onclick = (e) => {
                const content = header.nextElementSibling;
                const arrow = header.querySelector('.prompt-arrow');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    arrow.style.transform = 'rotate(90deg)';
                } else {
                    content.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                }
            };
        });

        // 功能开关切换
        document.querySelectorAll('.feature-toggle').forEach(toggle => {
            toggle.onchange = (e) => {
                const feature = e.target.dataset.feature;
                promptManager?.toggleFeature('wechat', feature);

                this.phoneShell.showNotification(
                    e.target.checked ? '已启用' : '已禁用',
                    `${feature} 功能${e.target.checked ? '已启用' : '已禁用'}`,
                    e.target.checked ? '✅' : '❌'
                );
            };
        });

        // 编辑提示词按钮
        document.querySelectorAll('.edit-prompt-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                const feature = btn.dataset.feature;
                this.showPromptEditor('wechat', feature);
            };
        });

        // 清空数据按钮
        const clearDataBtn = document.getElementById('clear-wechat-data');
        if (clearDataBtn) clearDataBtn.onclick = () => {
            this.showDataManagePopup();
        };
        const avatarManagerBtn = document.getElementById('wechat-avatar-manager-btn');
        if (avatarManagerBtn) avatarManagerBtn.onclick = () => {
            this.showAvatarManager();
        };

        const profileSelect = document.getElementById('chat-css-profile-select');
        const newProfileBtn = document.getElementById('new-css-profile-btn');
        const importProfileBtn = document.getElementById('import-css-profile-btn');
        const importProfileFile = document.getElementById('import-css-profile-file');
        const saveProfileBtn = document.getElementById('save-css-profile-btn');
        const deleteProfileBtn = document.getElementById('delete-css-profile-btn');
        const cssTextarea = document.getElementById('wechat-chat-custom-css');
        let cssProfiles = this._getAllChatCssProfiles();

        const setCssProfileControlsState = (profile) => {
            const hasProfile = !!profile;
            const isBuiltin = profile?.builtin === true;
            const canEdit = hasProfile && !isBuiltin;
            if (cssTextarea) {
                cssTextarea.disabled = !hasProfile;
                cssTextarea.readOnly = isBuiltin;
                cssTextarea.placeholder = hasProfile
                    ? '.message-right .message-text { border-radius: 14px; background: #c9f7b9; }'
                    : '请先新增或选择一个会话样式预设';
                cssTextarea.style.background = canEdit ? '#fbfbfb' : '#f3f3f3';
            }
            [saveProfileBtn, deleteProfileBtn].forEach((button) => {
                if (!button) return;
                button.disabled = !canEdit;
                button.style.opacity = canEdit ? '1' : '0.45';
                button.style.cursor = canEdit ? 'pointer' : 'default';
            });
        };

        const applyChatCssValue = async (css) => {
            const safeCss = String(css || '');
            await this.storage?.set(CHAT_CSS_VALUE_KEY, safeCss);
            this._applyCustomChatStyle(safeCss);
        };

        const renderCssSelect = (selectedId = this._getActiveChatCssProfileId()) => {
            if (!profileSelect) return;
            cssProfiles = this._getAllChatCssProfiles();
            profileSelect.replaceChildren();

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- 请选择会话样式预设 --';
            placeholder.disabled = true;
            profileSelect.appendChild(placeholder);

            cssProfiles.forEach((profile) => {
                const option = document.createElement('option');
                option.value = profile.id;
                option.textContent = profile.builtin ? `${profile.name}（内置）` : profile.name;
                profileSelect.appendChild(option);
            });

            const activeProfile = cssProfiles.find(profile => profile.id === selectedId) || null;
            profileSelect.value = activeProfile?.id || '';
            if (!activeProfile) placeholder.selected = true;
            setCssProfileControlsState(activeProfile);
        };

        renderCssSelect();

        profileSelect?.addEventListener('change', async () => {
            const profile = cssProfiles.find(item => item.id === profileSelect.value) || null;
            if (!profile) return;
            await this._setActiveChatCssProfileId(profile.id);
            if (cssTextarea) cssTextarea.value = profile.css;
            setCssProfileControlsState(profile);
            await applyChatCssValue(profile.css);
            this.phoneShell.showNotification('已切换', `会话样式「${profile.name}」已应用`, '✅');
        });

        newProfileBtn?.addEventListener('click', async () => {
            const name = String(window.prompt('请输入会话样式预设名称', '') || '').trim();
            if (!name) return;
            const profiles = this._loadChatCssProfiles();
            if (this._getAllChatCssProfiles().some(profile => profile.name === name)) {
                this.phoneShell.showNotification('新增失败', `预设「${name}」已存在`, '⚠️');
                return;
            }

            const now = Date.now();
            const profile = {
                id: this._createChatCssProfileId(new Set(profiles.map(item => item.id))),
                name,
                css: '',
                createdAt: now,
                updatedAt: now
            };
            profiles.push(profile);
            await this._saveChatCssProfiles(profiles);
            await this._setActiveChatCssProfileId(profile.id);
            await applyChatCssValue('');
            renderCssSelect(profile.id);
            if (cssTextarea) {
                cssTextarea.value = '';
                cssTextarea.focus();
            }
            this.phoneShell.showNotification('已新增预设', profile.name, '✅');
        });

        importProfileBtn?.addEventListener('click', () => {
            if (!importProfileFile) return;
            importProfileFile.value = '';
            importProfileFile.click();
        });

        importProfileFile?.addEventListener('change', async () => {
            const file = importProfileFile.files?.[0] || null;
            importProfileFile.value = '';
            if (!file) return;

            const fileName = String(file.name || '').trim();
            if (!/\.txt$/i.test(fileName)) {
                this.phoneShell.showNotification('导入失败', '请选择 TXT 文件', '⚠️');
                return;
            }
            if (Number(file.size || 0) > 1024 * 1024) {
                this.phoneShell.showNotification('导入失败', 'TXT 文件不能超过 1MB', '⚠️');
                return;
            }

            try {
                const css = String(await file.text()).replace(/^\uFEFF/, '');
                if (!css.trim()) {
                    this.phoneShell.showNotification('导入失败', 'TXT 文件内容为空', '⚠️');
                    return;
                }

                const name = fileName.replace(/\.txt$/i, '').trim() || '导入会话样式';
                if (getBuiltinWechatChatStyleProfiles().some(profile => profile.name === name)) {
                    this.phoneShell.showNotification('导入失败', `「${name}」是内置样式，请修改 TXT 文件名后再导入`, '⚠️');
                    return;
                }
                const profiles = this._loadChatCssProfiles();
                let profile = profiles.find(item => item.name === name) || null;
                const now = Date.now();

                if (profile) {
                    if (!window.confirm(`会话样式预设「${name}」已存在，是否用该 TXT 覆盖？`)) return;
                    profile.css = css;
                    profile.updatedAt = now;
                } else {
                    profile = {
                        id: this._createChatCssProfileId(new Set(profiles.map(item => item.id))),
                        name,
                        css,
                        createdAt: now,
                        updatedAt: now
                    };
                    profiles.push(profile);
                }

                await this._saveChatCssProfiles(profiles);
                await this._setActiveChatCssProfileId(profile.id);
                await applyChatCssValue(profile.css);
                renderCssSelect(profile.id);
                if (cssTextarea) cssTextarea.value = profile.css;
                this.phoneShell.showNotification('导入成功', `预设「${profile.name}」已设为当前样式`, '✅');
            } catch (error) {
                console.warn('[Wechat] 导入会话样式 TXT 失败:', error);
                this.phoneShell.showNotification('导入失败', error?.message || '无法读取 TXT 文件', '❌');
            }
        });

        saveProfileBtn?.addEventListener('click', async () => {
            const activeId = String(profileSelect?.value || '').trim();
            const selectedProfile = this._getAllChatCssProfiles().find(item => item.id === activeId) || null;
            if (selectedProfile?.builtin) {
                this.phoneShell.showNotification('保存失败', '内置样式不能覆盖，请新增自定义预设', '⚠️');
                return;
            }
            const profiles = this._loadChatCssProfiles();
            const profile = profiles.find(item => item.id === activeId) || null;
            if (!profile) {
                this.phoneShell.showNotification('保存失败', '请先新增或选择一个会话样式预设', '⚠️');
                return;
            }
            profile.css = String(cssTextarea?.value || '');
            profile.updatedAt = Date.now();
            await this._saveChatCssProfiles(profiles);
            await this._setActiveChatCssProfileId(profile.id);
            await applyChatCssValue(profile.css);
            this.phoneShell.showNotification('已保存', `预设「${profile.name}」已更新并应用`, '✅');
        });

        deleteProfileBtn?.addEventListener('click', async () => {
            const activeId = String(profileSelect?.value || '').trim();
            const selectedProfile = this._getAllChatCssProfiles().find(item => item.id === activeId) || null;
            if (selectedProfile?.builtin) {
                this.phoneShell.showNotification('删除失败', '内置样式不能删除', '⚠️');
                return;
            }
            const profiles = this._loadChatCssProfiles();
            const profileIndex = profiles.findIndex(item => item.id === activeId);
            const profile = profileIndex >= 0 ? profiles[profileIndex] : null;
            if (!profile) {
                renderCssSelect();
                this.phoneShell.showNotification('删除失败', '请先选择一个会话样式预设', '⚠️');
                return;
            }
            if (!window.confirm(`删除会话样式预设「${profile.name}」？`)) return;

            profiles.splice(profileIndex, 1);
            await this._saveChatCssProfiles(profiles);
            const fallbackProfile = getBuiltinWechatChatStyleProfiles()
                .find(item => item.id === WECHAT_NATIVE_CHAT_STYLE_ID) || null;
            await this._setActiveChatCssProfileId(fallbackProfile?.id || '');
            await applyChatCssValue(fallbackProfile?.css || '');
            if (cssTextarea) cssTextarea.value = fallbackProfile?.css || '';
            renderCssSelect(fallbackProfile?.id || '');
            this.phoneShell.showNotification('已删除预设', profile.name, '✅');
        });

        document.getElementById('wechat-use-worldbook')?.addEventListener('change', async (e) => {
            const enabled = !!e.target.checked;
            await window.VirtualPhone?.worldbookManager?.setEnabled?.('wechat', enabled);
            if (enabled) this.renderWechatWorldbookList();
            this.phoneShell.showNotification(
                enabled ? '已开启' : '已关闭',
                `微信生成${enabled ? '会' : '不会'}注入勾选的世界书`,
                enabled ? '✅' : 'ℹ️'
            );
        });

        // 🌐 翻译设定绑定
        const saveTransSetting = (key, value) => {
            this.wechatData.saveTranslationSettings?.({ [key]: value });
        };
        document.getElementById('wechat-trans-auto')?.addEventListener('change', (e) => {
            saveTransSetting('autoTranslate', !!e.target.checked);
            this.phoneShell.showNotification(
                e.target.checked ? '已开启' : '已关闭',
                e.target.checked ? '角色消息将附带译文显示' : '已关闭自动翻译',
                e.target.checked ? '✅' : 'ℹ️'
            );
        });
        document.getElementById('wechat-trans-autoexpand')?.addEventListener('change', (e) => saveTransSetting('autoExpandTranslation', !!e.target.checked));
        document.getElementById('wechat-trans-charlang')?.addEventListener('change', (e) => saveTransSetting('charOutputLanguage', e.target.value));
        document.getElementById('wechat-trans-mix')?.addEventListener('change', (e) => saveTransSetting('mixSecondLanguage', !!e.target.checked));
        document.getElementById('wechat-trans-to')?.addEventListener('change', (e) => saveTransSetting('translateTo', e.target.value));
        document.getElementById('wechat-trans-useapi')?.addEventListener('change', (e) => saveTransSetting('charUseTranslationApi', !!e.target.checked));
        document.getElementById('wechat-trans-out')?.addEventListener('change', (e) => {
            saveTransSetting('autoTranslateOut', !!e.target.checked);
            this.phoneShell.showNotification(
                e.target.checked ? '已开启' : '已关闭',
                e.target.checked ? '你发出的消息将自动译出，角色收到译文' : '已关闭自动译出',
                e.target.checked ? '✅' : 'ℹ️'
            );
        });
        document.getElementById('wechat-trans-out-lang')?.addEventListener('change', (e) => saveTransSetting('translateOutTo', e.target.value));

        const toggleAlapiTokenBtn = document.getElementById('toggle-alapi-token-visibility');
        if (toggleAlapiTokenBtn) toggleAlapiTokenBtn.onclick = () => {
            const input = document.getElementById('alapi-token-input');
            if (!input) return;
            const isMasked = input.classList.toggle('phone-secret-masked');
            const nextAction = isMasked ? '显示' : '隐藏';
            toggleAlapiTokenBtn.setAttribute('aria-label', `${nextAction}表情包 API 密钥`);
            toggleAlapiTokenBtn.setAttribute('title', `${nextAction}表情包 API 密钥`);
            const icon = toggleAlapiTokenBtn.querySelector('i');
            if (icon) {
                icon.className = isMasked ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
            }
        };

        // 保存 ALAPI Token
        const saveAlapiBtn = document.getElementById('save-alapi-token-btn');
        if (saveAlapiBtn) saveAlapiBtn.onclick = async () => {
            const token = document.getElementById('alapi-token-input').value.trim();
            await window.VirtualPhone?.storage?.set('global_alapi_token', token);
            this.phoneShell.showNotification('保存成功', '表情包密钥已更新', '✅');
        };
    }

    async renderWechatWorldbookList() {
        const container = document.getElementById('wechat-worldbook-list');
        const manager = window.VirtualPhone?.worldbookManager;
        if (!container || !manager) return;
        await manager.renderWorldbookSelector(container, 'wechat');
    }

    showAvatarManager() {
        this._isAvatarManagerOpen = true;
        this._wechatPanelMode = 'avatar-manager';
        this._ensureWechatAvatarPoolLoaded();
        const shellBg = this._getMainShellBackgroundConfig();
        const avatarManagerContentStyle = `${shellBg.contentBgStyle || 'background:#ededed;'} padding:12px; box-sizing:border-box;`;
        const contacts = [...(this.wechatData?.getContacts?.() || [])]
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hans-CN'));

        const maleCount = Array.isArray(this._avatarPool?.male) ? this._avatarPool.male.length : 0;
        const femaleCount = Array.isArray(this._avatarPool?.female) ? this._avatarPool.female.length : 0;
        const maleElderCount = Array.isArray(this._avatarPool?.male_elder) ? this._avatarPool.male_elder.length : 0;
        const femaleElderCount = Array.isArray(this._avatarPool?.female_elder) ? this._avatarPool.female_elder.length : 0;
        const emptyPoolHint = (maleCount + femaleCount + maleElderCount + femaleElderCount) === 0
            ? '<div style="font-size:11px;color:#d46b08;margin-top:6px;">未检测到头像素材，请将 male001/female001 系列图片放入目录后点击刷新。</div>'
            : '';
        const escapeHtml = (text) => String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const rowsHtml = contacts.length > 0
            ? contacts.map((contact) => {
                const contactId = String(contact?.id || '').trim();
                const contactName = String(contact?.name || '').trim() || '未命名';
                const safeContactName = escapeHtml(contactName);
                const gender = this.wechatData?.getContactGender?.(contactId) || 'unknown';
                const avatarGroup = this.wechatData?.getContactAvatarGroup?.(contactId) || '';
                const avatarGroupOptions = [
                    { value: 'unknown', label: '未标记' },
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'male_elder', label: '年长男' },
                    { value: 'female_elder', label: '年长女' }
                ];
                const selectedAvatarGroup = avatarGroup || gender || 'unknown';
                return `
                    <div class="wechat-avatar-row" style="display:grid; grid-template-columns:minmax(0,1fr); row-gap:7px; padding:10px 0; border-bottom:0.5px solid #f1f1f1;">
                        <div style="min-width:0; font-size:14px; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${safeContactName}</div>
                        <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                            <span style="font-size:11px; color:#888; flex:0 0 auto;">头像类型</span>
                            <select class="wechat-contact-avatar-group-select" data-contact-id="${contactId}" style="flex:1; min-width:0; height:28px; border:1px solid #e1e1e1; border-radius:8px; background:#fafafa; color:#333; font-size:11px; padding:0 7px;">
                                ${avatarGroupOptions.map(option => `<option value="${option.value}" ${selectedAvatarGroup === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="font-size:13px; color:#888; text-align:center; padding:24px 12px;">通讯录为空，先添加联系人。</div>';

        const html = `
            <div class="${shellBg.appClass}" style="${shellBg.appStyle}">
                <div class="wechat-header">
                    <div class="wechat-header-left">
                        <button class="wechat-back-btn" id="back-from-avatar-manager">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                    </div>
                    <div class="wechat-header-title">头像管理器</div>
                    <div class="wechat-header-right"></div>
                </div>
                <div class="wechat-content" style="${avatarManagerContentStyle}">
                    <div style="background:#fff; border-radius:12px; padding:12px; margin-bottom:10px;">
                        <div style="font-size:13px; color:#333; font-weight:600;">默认头像池与性别标记</div>
                        <div style="font-size:11px; color:#888; margin-top:4px; line-height:1.45;">
                            素材目录：\`apps/wechat/avatars/\`<br>
                            普通头像：\`male001.png\`、\`female001.jpg\`；年长头像：\`male_elder001.png\`、\`female_elder001.jpg\`<br>
                            当前已识别：男 ${maleCount} 张，女 ${femaleCount} 张，年长男 ${maleElderCount} 张，年长女 ${femaleElderCount} 张<br>
                            通讯录联系人：${contacts.length} 人（显示姓名与头像类型）
                        </div>
                        ${emptyPoolHint}
                        <button id="wechat-avatar-pool-refresh" style="margin-top:8px; padding:6px 10px; border:1px solid #e1e1e1; border-radius:8px; background:#fafafa; font-size:12px; cursor:pointer;">刷新头像池</button>
                    </div>
                    <div style="background:#fff; border-radius:12px; padding:0 12px;">
                        ${rowsHtml}
                    </div>
                </div>
            </div>
        `;

        this.phoneShell.setContent(html);

        document.getElementById('back-from-avatar-manager')?.addEventListener('click', () => {
            this._isAvatarManagerOpen = false;
            this._wechatPanelMode = 'settings';
            this.showSettings();
        });

        document.getElementById('wechat-avatar-pool-refresh')?.addEventListener('click', () => {
            this._avatarPoolLoaded = false;
            this._avatarPoolLoading = false;
            this._ensureWechatAvatarPoolLoaded();
            this.phoneShell.showNotification('头像池', '正在刷新头像素材...', '🔄');
        });

        document.querySelectorAll('.wechat-contact-avatar-group-select').forEach((selectEl) => {
            selectEl.addEventListener('change', (e) => {
                const select = e.currentTarget;
                const contactId = String(select?.dataset?.contactId || '').trim();
                const value = String(select.value || 'unknown').trim();
                if (!contactId) return;
                const gender = value.includes('female') ? 'female' : (value.includes('male') ? 'male' : 'unknown');
                const avatarGroup = value === 'male_elder' || value === 'female_elder' ? value : '';
                this.wechatData?.setContactGender?.(contactId, gender);
                this.wechatData?.setContactAvatarGroup?.(contactId, avatarGroup);
                this.wechatData?.setContactAutoAvatar?.(contactId, '');
            });
        });
    }

    _resetWechatSingletonCaches() {
        if (window.VirtualPhone) {
            window.VirtualPhone.wechatApp = null;
            window.VirtualPhone.cachedWechatData = null;

            // 🔥 核心修复：同步清除桌面图标上的微信角标，防止幽灵红点残留
            if (window.VirtualPhone.home && window.VirtualPhone.home.apps) {
                const wechatIcon = window.VirtualPhone.home.apps.find(a => a.id === 'wechat');
                if (wechatIcon) {
                    wechatIcon.badge = 0;
                }
                if (window.VirtualPhone.storage) {
                    window.VirtualPhone.storage.saveApps(window.VirtualPhone.home.apps);
                }
            }
            window.dispatchEvent(new CustomEvent('phone:updateGlobalBadge'));
        }
        window.currentWechatApp = null;
        window.ggp_currentWechatApp = null;
    }

    // 🧭 数据管理小弹窗：聊天 / 朋友圈 / 全清
    showDataManagePopup() {
        const host = document.querySelector('.phone-view-current') || document.body;
        document.getElementById('wechat-data-manage-modal')?.remove();

        const html = `
        <div id="wechat-data-manage-modal" style="position:absolute; inset:0; background:rgba(0,0,0,0.34); z-index:2200; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;">
            <div style="width:100%; max-width:300px; background:#fff; border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,0.22); overflow:hidden;">
                <div style="padding:14px 14px 10px; border-bottom:0.5px solid #efefef;">
                    <div style="font-size:15px; color:#111; text-align:center; font-weight:500;">微信数据管理</div>
                    <div style="font-size:11px; color:#888; text-align:center; margin-top:4px;">选择要清理的范围</div>
                </div>
                <button class="wechat-data-action-btn" data-action="chat" style="width:100%; border:none; background:#fff; padding:12px 14px; text-align:left; border-bottom:0.5px solid #f0f0f0; cursor:pointer;">
                    <div style="font-size:14px; color:#222;">清理聊天数据</div>
                    <div style="font-size:11px; color:#999; margin-top:2px;">清空会话、消息与零钱流水，保留联系人和朋友圈</div>
                </button>
                <button class="wechat-data-action-btn" data-action="moments" style="width:100%; border:none; background:#fff; padding:12px 14px; text-align:left; border-bottom:0.5px solid #f0f0f0; cursor:pointer;">
                    <div style="font-size:14px; color:#222;">清理朋友圈</div>
                    <div style="font-size:11px; color:#999; margin-top:2px;">仅清空朋友圈动态与互动</div>
                </button>
                <button class="wechat-data-action-btn" data-action="all" style="width:100%; border:none; background:#fff; padding:12px 14px; text-align:left; border-bottom:0.5px solid #f0f0f0; cursor:pointer;">
                    <div style="font-size:14px; color:#d93025;">全清（含联系人）</div>
                    <div style="font-size:11px; color:#999; margin-top:2px;">清空聊天、朋友圈、联系人与设置数据</div>
                </button>
                <button id="wechat-data-manage-cancel" style="width:100%; border:none; background:#fff; color:#666; padding:11px 0; font-size:14px; cursor:pointer;">取消</button>
            </div>
        </div>
        `;

        host.insertAdjacentHTML('beforeend', html);
        const modal = document.getElementById('wechat-data-manage-modal');
        if (!modal) return;

        const closeModal = () => modal.remove();
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.getElementById('wechat-data-manage-cancel')?.addEventListener('click', closeModal);

        modal.querySelectorAll('.wechat-data-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'chat') {
                    const ok = confirm('确定清理微信聊天数据吗？\n\n将清空全部会话、消息和零钱流水，但保留联系人与朋友圈。');
                    if (!ok) return;
                    const chatCount = this.wechatData.getChatList().length;
                    this.wechatData.clearAllChatData();
                    this._resetWechatSingletonCaches();
                    closeModal();
                    this.phoneShell.showNotification('已清理', `聊天数据已清空（${chatCount} 个会话）`, '✅');
                    this.currentView = 'chats';
                    this.currentChat = null;
                    setTimeout(() => {
                        // 🔥 核心修复：清空聊天后遣返桌面，销毁僵尸UI并同步角标
                        window.dispatchEvent(new CustomEvent('phone:goHome'));
                    }, 300);
                    return;
                }

                if (action === 'moments') {
                    const ok = confirm('确定清理微信朋友圈吗？\n\n将清空所有朋友圈动态与互动记录。');
                    if (!ok) return;
                    const moments = this.wechatData.getMoments();
                    const momentsCount = moments.length;
                    const managedImageUrls = moments.flatMap(moment => this.momentsView?._collectMomentManagedImageUrls?.(moment) || []);
                    this.wechatData.clearMomentsData();
                    this.momentsView?._cleanupManagedMomentImages?.(managedImageUrls);
                    closeModal();
                    this.phoneShell.showNotification('已清理', `朋友圈已清空（${momentsCount} 条）`, '✅');
                    return;
                }

                if (action === 'all') {
                    const ok = confirm('确定全清微信数据吗？\n\n将删除聊天、朋友圈、联系人等所有微信数据，且不可恢复。');
                    if (!ok) return;
                    this.wechatData.resetAllData();
                    this._resetWechatSingletonCaches();
                    closeModal();
                    this.phoneShell.showNotification('已清空', '微信数据已重置', '✅');
                    setTimeout(() => {
                        // 🔥 核心修复：全清数据后直接遣返桌面，彻底销毁僵尸UI，强制下次打开时重建同步实例
                        window.dispatchEvent(new CustomEvent('phone:goHome'));
                    }, 300);
                }
            });
        });
    }

    _showContactGenerationErrorModal(message = '生成失败', rawResponse = '') {
        const host = document.querySelector('.phone-view-current') || document.querySelector('.phone-screen') || document.body;
        document.getElementById('wechat-contact-generation-error-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'wechat-contact-generation-error-modal';
        modal.className = 'wechat-contact-generation-error-overlay';
        modal.innerHTML = `
            <div class="wechat-contact-generation-error-dialog" role="dialog" aria-modal="true" aria-labelledby="wechat-contact-generation-error-title">
                <div class="wechat-contact-generation-error-header">
                    <div class="wechat-contact-generation-error-title" id="wechat-contact-generation-error-title">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>联系人生成失败</span>
                    </div>
                    <button type="button" class="wechat-contact-generation-error-close" data-action="close" aria-label="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="wechat-contact-generation-error-body">
                    <div class="wechat-contact-generation-error-summary"></div>
                    <div class="wechat-contact-generation-error-label">AI 实际返回</div>
                    <pre class="wechat-contact-generation-error-response"></pre>
                </div>
                <div class="wechat-contact-generation-error-footer">
                    <button type="button" class="wechat-contact-generation-error-confirm" data-action="close">关闭</button>
                </div>
            </div>
        `;

        modal.querySelector('.wechat-contact-generation-error-summary').textContent = String(message || '生成失败');
        modal.querySelector('.wechat-contact-generation-error-response').textContent = String(rawResponse || '').trim() || '未收到可显示的 API 原始返回。';
        host.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelectorAll('[data-action="close"]').forEach(button => button.addEventListener('click', closeModal));
        modal.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeModal();
        });
        modal.querySelector('.wechat-contact-generation-error-close')?.focus?.();
    }

    // 📋 显示智能加载联系人确认界面
    showLoadContactsConfirm() {
        const shellBg = this._getMainShellBackgroundConfig();
        const loadContactsContentStyle = `${shellBg.contentBgStyle || 'background: #ededed;'} padding: 20px;`;
        const html = `
        <div class="${shellBg.appClass}" style="${shellBg.appStyle}">
            <div class="wechat-header">
                <div class="wechat-header-left">
                    <button class="wechat-back-btn" id="back-from-load">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div class="wechat-header-title">智能加载联系人</div>
                <div class="wechat-header-right"></div>
            </div>
            
            <div class="wechat-content" style="${loadContactsContentStyle}">
                <div style="background: #fff; border-radius: 12px; padding: 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.1); margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-robot" style="font-size: 28px; color: #666;"></i>
                    </div>
                    <div style="font-size: 16px; font-weight: 500; color: #000; margin-bottom: 8px;">使用AI生成联系人</div>
                    <div style="font-size: 12px; color: #999; margin-bottom: 24px; line-height: 1.5;">
                        将使用AI分析当前角色卡和聊天记录，智能生成联系人。
                    </div>

                    <button id="confirm-load" style="
                        padding: 10px 20px;
                        background: rgba(255,255,255,0.6);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(0,0,0,0.1);
                        color: #333;
                        border-radius: 8px;
                        font-size: 12px;
                        cursor: pointer;
                    ">开始生成</button>

                </div>
            </div>
        </div>
    `;

        this.phoneShell.setContent(html);

        document.getElementById('back-from-load')?.addEventListener('click', () => {
            this.render();
        });

        document.getElementById('confirm-load')?.addEventListener('click', async () => {
            const shouldClear = confirm('智能加载联系人前，是否先清空当前微信里的所有联系人、群聊和聊天记录？\n\n点击“确定”会先清空再生成，避免重复联系人/群聊；点击“取消”则保留现有数据并继续追加补全。');
            const confirmBtn = document.getElementById('confirm-load');
            if (confirmBtn?.dataset?.loading === '1') return;
            document.getElementById('wechat-contact-generation-error-modal')?.remove();
            if (confirmBtn) {
                confirmBtn.dataset.loading = '1';
                confirmBtn.disabled = true;
                confirmBtn.textContent = '生成中...';
                confirmBtn.style.opacity = '0.7';
                confirmBtn.style.cursor = 'not-allowed';
            }
            this.phoneShell.showNotification('AI分析中', '正在生成联系人...', '⏳');

            try {
                if (shouldClear) {
                    this.wechatData.clearContactsAndGroupsForSmartLoad?.();
                }

                const result = await this.wechatData.loadContactsFromCharacter();

                if (result.success) {
                    let message = result.message;

                    // 🔥 如果生成了时间，显示在通知中
                    if (result.time) {
                        message += `\n⏰ 剧情时间: ${result.time.date} ${result.time.time}`;

                        // 🔥 刷新主屏幕时间显示
                        if (window.VirtualPhone?.home) {
                            setTimeout(() => window.VirtualPhone.home.render(), 500);
                        }
                    }

                    this.phoneShell.showNotification('✅ 生成成功', message, '✅');
                    setTimeout(() => {
                        this.currentView = 'contacts';
                        this.render();
                    }, 800);
                } else {
                    this.phoneShell.showNotification('❌ 生成失败', result.message, '❌');
                    this._showContactGenerationErrorModal(result.message, result.rawResponse);
                    if (confirmBtn) {
                        confirmBtn.dataset.loading = '0';
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '重试生成';
                        confirmBtn.style.opacity = '1';
                        confirmBtn.style.cursor = 'pointer';
                    }
                }

            } catch (error) {
                console.error('❌ 加载联系人失败:', error);
                this.phoneShell.showNotification('❌ 错误', error.message, '❌');
                this._showContactGenerationErrorModal(error.message, '');
                if (confirmBtn) {
                    confirmBtn.dataset.loading = '0';
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '重试生成';
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';
                }
            }
        });
    }
    // 🗑️ 显示清空数据确认界面
    showClearDataConfirm() {
        const html = `
        <div class="wechat-app">
            <div class="wechat-header">
                <div class="wechat-header-left">
                    <button class="wechat-back-btn" id="back-from-clear">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div class="wechat-header-title">清空数据</div>
                <div class="wechat-header-right"></div>
            </div>
            
            <div class="wechat-content" style="background: #ededed; padding: 20px;">
                <div style="background: #fff; border-radius: 12px; padding: 30px; text-align: center;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 64px; color: #ff3b30; margin-bottom: 20px;"></i>
                    <div style="font-size: 20px; font-weight: 600; color: #000; margin-bottom: 15px;">确定要清空所有微信数据吗？</div>
                    <div style="font-size: 14px; color: #999; margin-bottom: 10px; line-height: 1.6;">
                        此操作将删除：<br>
                        • 所有聊天记录<br>
                        • 所有联系人<br>
                        • 朋友圈内容<br>
                    </div>
                    <div style="font-size: 16px; color: #ff3b30; font-weight: 600; margin-bottom: 30px;">
                        ⚠️ 此操作不可恢复！
                    </div>
                    
                    <button id="confirm-clear-data" style="
                        width: 100%;
                        padding: 14px;
                        background: #ff3b30;
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-bottom: 10px;
                    ">确定清空</button>
                    
                    <button id="cancel-clear-data" style="
                        width: 100%;
                        padding: 14px;
                        background: #f0f0f0;
                        color: #666;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                    ">取消</button>
                </div>
            </div>
        </div>
    `;

        this.phoneShell.setContent(html);

        document.getElementById('back-from-clear')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('cancel-clear-data')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('confirm-clear-data')?.addEventListener('click', () => {
            // 🔥 使用 resetAllData 彻底清空（包括独立存储的消息键）
            this.wechatData.resetAllData();

            // 🔥 清空内存单例缓存，防止残留
            this._resetWechatSingletonCaches();

            this.phoneShell.showNotification('已清空', '微信数据已重置', '✅');
            setTimeout(() => {
                this.currentView = 'chats';
                this.currentChat = null;
                this.render();
            }, 1000);
        });
    }
    showSearch() {
        const html = `
        <div class="wechat-app">
            <div class="wechat-header" style="background: #f7f7f7; gap: 10px;">
               <div style="flex-grow: 1; display:flex; align-items:center; background:#fff; border-radius:6px; padding: 8px 10px;">
    <i class="fa-solid fa-search" style="color:#aaa; margin-right: 5px;"></i>
    <input type="text" id="search-input" placeholder="搜索" style="border:none; width: 100%; padding:0; background:transparent; outline:none;" autofocus>
</div>
                <button id="cancel-search" class="wechat-back-btn" style="border:none; background:none; color:#576b95; padding:0; cursor:pointer; flex-shrink: 0;">取消</button>
            </div>
            <div class="wechat-content" id="search-results" style="background:#fff; padding-top: 10px;">
                <div style="text-align:center;color:#999;padding-top:50px;">输入关键词搜索聊天记录或联系人</div>
            </div>
        </div>
    `;
        this.phoneShell.setContent(html);

        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const cancelBtn = document.getElementById('cancel-search');

        if (searchInput && searchResults) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                if (!query) {
                    searchResults.innerHTML = '<div style="text-align:center;color:#999;padding-top:50px;">输入关键词搜索...</div>';
                    return;
                }

                const contacts = this.wechatData.getContacts().filter(c =>
                    [c.name, c.nickname, c.realName, c.remark].some(value => String(value || '').toLowerCase().includes(query))
                );
                const chats = this.wechatData.getChatList().filter(c => c.name.toLowerCase().includes(query));

                let resultsHtml = '';

                if (contacts.length > 0) {
                    resultsHtml += '<div style="font-size:12px;color:#888;padding:5px 15px;">联系人</div>';
                    resultsHtml += contacts.map(contact => `
                    <div class="contact-item" data-contact-id="${contact.id}" style="padding: 8px 15px; cursor:pointer;">
                        <div class="contact-avatar" style="width:36px;height:36px;">${this.renderAvatar(contact.avatar, '👤', contact.name)}</div>
                        <div class="contact-name">${contact.name}</div>
                    </div>
                `).join('');
                }

                if (chats.length > 0) {
                    resultsHtml += '<div style="font-size:12px;color:#888;padding:15px 15px 5px;">聊天</div>';
                    resultsHtml += chats.map(chat => `
                    <div class="chat-item" data-chat-id="${chat.id}" style="padding: 8px 15px; cursor:pointer;">
                        <div class="chat-avatar" style="width:36px;height:36px;">${this.renderAvatar(chat.avatar, '👤', chat.name)}</div>
                        <div class="chat-info">
                            <div class="chat-name">${chat.name}</div>
                            <div class="chat-last-msg">${chat.lastMessage}</div>
                        </div>
                    </div>
                `).join('');
                }

                if (resultsHtml === '') {
                    searchResults.innerHTML = `<div style="text-align:center;color:#999;padding-top:50px;">未找到相关内容</div>`;
                } else {
                    searchResults.innerHTML = resultsHtml;
                }

                this.bindSearchResultsEvents();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.render();
            });
        } else {
            console.error('未找到取消按钮');
        }
    }

    // 🔥 新增：绑定搜索结果点击事件
    bindSearchResultsEvents() {
        document.querySelectorAll('#search-results .contact-item').forEach(item => {
            item.addEventListener('click', () => {
                const contactId = item.dataset.contactId;
                this.contactsView.openContactChat(contactId);
            });
        });
        document.querySelectorAll('#search-results .chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });
    }

    // 🔥 新增：显示添加菜单（替代 showAddMenu）
    showAddFriendMenu() {
        this.currentView = 'contacts';
        this.render(); // 先渲染通讯录视图
        setTimeout(() => {
            this.contactsView.showAddFriendPage(); // 再打开添加好友页面
        }, 50);
    }
}
