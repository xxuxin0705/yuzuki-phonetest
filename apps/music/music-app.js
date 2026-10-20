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
// 🎵 音乐APP - 控制器
// ========================================

import { MusicData } from './music-data.js';
import { MusicView } from './music-view.js';

export class MusicApp {
    constructor(phoneShell, storage) {
        this.phoneShell = phoneShell;
        this.storage = storage;
        this.musicData = new MusicData(storage);
        this.view = new MusicView(this);

        this.musicData.onStateChange = () => this._scheduleUpdate();
        this.musicData.onTimeUpdate = (t, d) => this.view.onTime(t, d);
        this.musicData.onToast = (msg) => this.view.toast(msg);
        this.musicData.onPlaybackStopped = (reason) => this.endWechatListening(reason);

        // 全局可替换 handler，避免热更新/重复实例留下旧监听
        if (window._musicSwipeBackHandler) {
            window.removeEventListener('phone:swipeBack', window._musicSwipeBackHandler);
        }
        window._musicSwipeBackHandler = (event) => window.VirtualPhone?.musicApp?.handleSwipeBack?.(event);
        window.addEventListener('phone:swipeBack', window._musicSwipeBackHandler);

        if (window._musicGoHomeHandler) {
            window.removeEventListener('phone:goHome', window._musicGoHomeHandler);
        }
        window._musicGoHomeHandler = () => window.VirtualPhone?.musicApp?.handlePhoneNavigation?.();
        if (window._musicGoHomeCaptureGuard) {
            window.removeEventListener('phone:goHome', window._musicGoHomeCaptureGuard, true);
        }
        window._musicGoHomeCaptureGuard = () => {
            window._musicSuppressNavigationPauseUntil = Date.now() + 800;
        };
        window.addEventListener('phone:goHome', window._musicGoHomeCaptureGuard, true);
        window.addEventListener('phone:goHome', window._musicGoHomeHandler);
    }

    // 合并同一帧内的多次状态刷新，避免频繁重绘
    _scheduleUpdate() {
        if (this._updateQueued) return;
        this._updateQueued = true;
        const run = () => {
            this._updateQueued = false;
            this.view.updateDisplay();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 16);
    }

    render() {
        this.view.render();
    }

    handlePhoneNavigation() {
        // 回桌面不打断音乐，也不结束一起听；只收起弹层
        this.view?._closeOverlay?.();
        this.view?._stopQr?.();
        this.view?._hideThought?.();
        this.view?._stopListenTimer?.();
        if (this.view) this.view.stack = ['music'];
    }

    deactivate() {
        this.view?._closeOverlay?.();
        this.view?._stopQr?.();
        this.view?._stopListenTimer?.();
    }

    endWechatListening(reason = '') {
        const wechatData = window.VirtualPhone?.wechatApp?.wechatData || window.VirtualPhone?.cachedWechatData;
        const sessions = wechatData?.data?.musicListening || {};
        Object.keys(sessions).forEach(chatId => {
            if (sessions[chatId]?.active === false) return;
            const ended = window.VirtualPhone?.wechatApp?.endMusicListening?.(chatId, { reason })
                || wechatData?.endMusicListening?.(chatId, { reason });
            if (ended && window.VirtualPhone?.wechatApp?.currentChat?.id === chatId) {
                window.VirtualPhone.wechatApp.syncMusicListenHeaderIndicator?.(chatId);
            }
        });
        this.view?._paintListen?.();
    }

    addSongToQueue(name, artist) {
        return this.musicData.addSong(name, artist);
    }

    updateCardData(parsed) {
        this.musicData.setCardData(parsed);
        this._scheduleUpdate();
    }

    handleSwipeBack(event) {
        const currentView = document.querySelector('.phone-view-current');
        if (!currentView || !currentView.querySelector('.mz-app')) return false;

        if (event?.detail && typeof event.detail === 'object') {
            event.detail.handled = true;
        }
        this.view.back();
        return true;
    }

    initFloatingWidget() {
        if (this.storage.get('music_show_floating', false)) {
            this.view.renderFloatingWidget();
        }
    }

    clearCache() {
        this.musicData.clearCache();
    }

    onChatChanged(newStorage) {
        this.musicData.clearCache();
        this.storage = newStorage;
        this.musicData.storage = newStorage;
        this.musicData.syncVolume();

        this.view.destroyFloatingWidget();
        if (newStorage.get('music_show_floating', false)) {
            this.view.renderFloatingWidget();
        }
        this._scanLastMessageForCard(true);
        this._scheduleUpdate();
    }

    // 扫描当前会话最后一条 <Music> 标签。isSafeScan=true 时只恢复卡片，不重新入队歌曲
    _scanLastMessageForCard(isSafeScan = false) {
        try {
            const context = window.SillyTavern?.getContext?.()
                || (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null);
            if (!context?.chat) return;

            for (let i = context.chat.length - 1; i >= 0; i--) {
                const msg = context.chat[i];
                if (msg.is_user) continue;
                const text = (msg.swipes && msg.swipes[msg.swipe_id || 0]) || msg.mes || '';
                const matches = [...text.matchAll(/<Music>([\s\S]*?)<\/Music>/gi)];
                if (!matches.length) continue;

                const lastMatch = matches[matches.length - 1];
                if (typeof window.VirtualPhone?._parseMusicCard === 'function') {
                    const parsed = window.VirtualPhone._parseMusicCard(lastMatch[1]);
                    this.musicData.setCardData(parsed);
                    if (!isSafeScan && parsed.media && parsed.media.length >= 2) {
                        for (let j = 0; j < parsed.media.length - 1; j += 2) {
                            const songName = parsed.media[j].trim();
                            const artistName = parsed.media[j + 1].trim();
                            if (songName && artistName) this.addSongToQueue(songName, artistName);
                        }
                    }
                    this._scheduleUpdate();
                }
                return;
            }

            if (!isSafeScan) {
                this.musicData.setCardData(null);
                this._scheduleUpdate();
            }
        } catch (e) {
            console.warn('🎵 [音乐] 扫描历史消息失败:', e);
        }
    }
}
