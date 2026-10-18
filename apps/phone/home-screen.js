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
// 主屏幕
import { APPS, PHONE_CONFIG } from '../config/apps.js'; // 🔥🔥🔥 这一行必须改！

const CARD_LAYOUT_CUSTOM_CSS_KEY = 'phone-card-layout-custom-css';
const CARD_LAYOUT_CUSTOM_STYLE_ID = 'phone-card-layout-custom-css-style';
const CARD_LAYOUT_GUARD_STYLE_ID = 'phone-card-layout-guard-css-style';

export class HomeScreen {
    constructor(phoneShell, apps) {
        this.phoneShell = phoneShell;
        this.apps = apps || APPS; // 🔥 修复：确保 apps 有默认值
        this._homeRenderVersion = 0;
        
        // 🔥 修复：确保 window.VirtualPhone 存在
        const storage = window.VirtualPhone?.storage;
        if (storage) {
            this.wallpaper = storage.get('phone-wallpaper') || PHONE_CONFIG.defaultWallpaper;
        } else {
            this.wallpaper = PHONE_CONFIG.defaultWallpaper;
        }
    }

    // 🔥 新增：判断当前是否为主屏幕
    isHomeScreenVisible() {
        const homeScreenElement = this.phoneShell.screen?.querySelector('.home-screen');
        return !!homeScreenElement;
    }
    
    render(options = {}) {
        const forceDomRefresh = !!options.forceDomRefresh;
        if (forceDomRefresh) {
            this._homeRenderVersion += 1;
        }
        const renderKeyAttr = forceDomRefresh ? ` data-render-key="${this._homeRenderVersion}"` : '';

        const wallpaper = this._getWallpaperImage();

        const wallpaperStyle = wallpaper
            ? `background-image: url('${wallpaper}'); background-size: cover; background-position: center;`
            : '';

        const homeLayout = this.getHomeLayout();
        const hasCardCustomCss = homeLayout === 'cards' && !!this.getCardLayoutCustomCssText();
        const cardCustomClass = hasCardCustomCss ? ' home-card-custom-css-active yzp-home-card-custom-css-active' : '';
        this.preloadCardLayoutCustomCss();

        const html = `
            <div class="home-screen yzp-home-screen home-layout-${homeLayout} yzp-home-layout-${homeLayout}${cardCustomClass}"${renderKeyAttr}>
                <div class="wallpaper" style="${wallpaperStyle}"></div>

                ${homeLayout === 'cards' ? this.renderCardLayout() : homeLayout === 'desktop' ? this.renderDesktopLayout() : this.renderIconLayout()}

                <div class="dock yzp-home-dock">
                    ${this.renderDock()}
                </div>
            </div>
        `;

        this.phoneShell.setContent(html);
        this.bindEvents();
        if (homeLayout === 'desktop') this.bindDesktopEvents();
    }

    restore() {
        if (!this.phoneShell?.restoreView?.('home')) {
            this.render();
            return false;
        }

        this.updateWallpaperDisplay();
        this.updateTimeDisplay();
        this.updateAppBadges();
        this.bindEvents();
        if (this.getHomeLayout() === 'desktop') this.bindDesktopEvents();
        return true;
    }

    getHomeLayout() {
        const layout = String(window.VirtualPhone?.storage?.get('phone-home-layout') || 'icons');
        return ['cards', 'desktop'].includes(layout) ? layout : 'desktop';
    }

    _getWallpaperImage() {
        try {
            return window.VirtualPhone?.imageManager?.getWallpaper?.() || PHONE_CONFIG.defaultWallpaper;
        } catch (e) {
            console.warn('获取壁纸失败:', e);
            return PHONE_CONFIG.defaultWallpaper;
        }
    }

    getCardLayoutCustomCssText() {
        return String(window.VirtualPhone?.storage?.get?.(CARD_LAYOUT_CUSTOM_CSS_KEY) || '').trim();
    }

    applyCardLayoutCustomCss() {
        const existing = document.getElementById(CARD_LAYOUT_CUSTOM_STYLE_ID);
        existing?.remove();
        const existingGuard = document.getElementById(CARD_LAYOUT_GUARD_STYLE_ID);
        existingGuard?.remove();

        if (this.getHomeLayout() !== 'cards') return;
        const cssText = this.getCardLayoutCustomCssText();
        if (cssText) {
            const style = document.createElement('style');
            style.id = CARD_LAYOUT_CUSTOM_STYLE_ID;
            style.setAttribute('data-scope', 'phone-card-layout');
            style.textContent = cssText;
            (this.phoneShell?.screen || document.head).appendChild(style);
        }

        this.applyCardLayoutGuardCss();
    }

    preloadCardLayoutCustomCss() {
        document.getElementById(CARD_LAYOUT_CUSTOM_STYLE_ID)?.remove();
        document.getElementById(CARD_LAYOUT_GUARD_STYLE_ID)?.remove();
        if (this.getHomeLayout() !== 'cards') return;

        const cssText = this.getCardLayoutCustomCssText();
        if (cssText) {
            const style = document.createElement('style');
            style.id = CARD_LAYOUT_CUSTOM_STYLE_ID;
            style.setAttribute('data-scope', 'phone-card-layout');
            style.setAttribute('data-owner', 'document-head');
            style.textContent = cssText;
            document.head.appendChild(style);
        }
        this.applyCardLayoutGuardCss(document.head);
    }

    applyCardLayoutGuardCss(host = null) {
        const style = document.createElement('style');
        style.id = CARD_LAYOUT_GUARD_STYLE_ID;
        style.setAttribute('data-scope', 'phone-card-layout-guard');
        style.textContent = `
            #phone-panel-content .phone-screen .home-layout-cards .dock {
                position: absolute !important;
                left: 50% !important;
                right: auto !important;
                top: auto !important;
                width: auto !important;
                max-width: calc(100% - 12%) !important;
                height: auto !important;
                transform: translateX(-50%) !important;
                box-sizing: border-box !important;
            }

            @media (min-width: 501px) {
                #phone-panel-content .phone-screen .home-layout-cards .dock {
                    width: calc(100% - 12%) !important;
                    bottom: 11.5% !important;
                }
            }

        `;
        (host || this.phoneShell?.screen || document.head).appendChild(style);
    }


    // 桌面布局使用单独存储，不覆盖旧卡片桌面配置。
    desktopKey = 'phone-desktop-widgets-v1';
    getDesktopItems() {
        const defaults = [
            {id:'clock',type:'clock',size:'large',title:'今天'},
            {id:'apps',type:'apps',size:'large',title:'我的应用'},
            {id:'calendar',type:'calendar',size:'medium',title:'日历'},
            {id:'note',type:'note',size:'medium',title:'随手记',text:'把喜欢的事情慢慢记下来。'}
        ];
        try {
            const value = window.VirtualPhone?.storage?.get?.(this.desktopKey);
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id === 'string').slice(0,60) : defaults;
        } catch { return defaults; }
    }
    saveDesktopItems(items) {
        window.VirtualPhone?.storage?.set?.(this.desktopKey, items);
        this.render({forceDomRefresh:true});
    }
    desktopEscape(v) { return this._escapeHtml(String(v ?? '')); }
    desktopWidgetContent(item) {
        const safe = v => this.desktopEscape(v);
        const date = new Date();
        const title = safe(item.title || '小组件');
        switch(item.type) {
            case 'clock': return `<div class="pd-clock">${safe(this.getCurrentTime())}</div><div class="pd-sub">${safe(this.getCurrentDateParts().date)} · ${safe(this.getCurrentDateParts().weekday)}</div>`;
            case 'calendar': return `<div class="pd-day">${date.getDate()}</div><div class="pd-sub">${date.toLocaleDateString('zh-CN',{month:'long',weekday:'long'})}</div>`;
            case 'photo': return item.image ? `<img class="pd-photo" src="${safe(item.image)}" alt="${title}">` : '<div class="pd-placeholder">📷<span>编辑组件上传照片</span></div>';
            case 'music': return `<div class="pd-emoji">🎧</div><div class="pd-sub">点按打开音乐</div>`;
            case 'anniversary': {
                const ms = item.date ? new Date(item.date+'T00:00:00').getTime() : NaN;
                const days = Number.isFinite(ms) ? Math.floor((Date.now()-ms)/86400000) : null;
                return `<div class="pd-count">${days === null ? '♡' : Math.abs(days)}</div><div class="pd-sub">${days === null ? '设置纪念日' : days >= 0 ? '已经过了 '+days+' 天' : '还有 '+(-days)+' 天'}</div>`;
            }
            case 'quote': return `<div class="pd-quote">“${safe(item.text || '把今天过成喜欢的样子。')}”</div>`;
            case 'weather': return `<div class="pd-emoji">☁️</div><div class="pd-sub">天气展示位 · 可编辑城市名称</div>`;
            case 'battery': return `<div class="pd-emoji">🔋</div><div class="pd-sub">${Number(this.phoneShell?.batteryLevel ?? 78)}% 电量</div>`;
            case 'apps': return `<div class="pd-widget-apps">${this.apps.map(app => this.renderAppIcon(app)).join('')}</div>`;
            case 'spacer': return `<div class="pd-sub">${safe(item.text || '')}</div>`;
            default: return `<div class="pd-note">${safe(item.text || '点击编辑内容')}</div>`;
        }
    }
    renderDesktopLayout() {
        const items = this.getDesktopItems();
        return `<div class="pd-toolbar"><span class="pd-heading">我的桌面</span><div><button type="button" class="pd-edit-toggle">编辑桌面</button><button type="button" class="pd-close-phone" title="关闭手机，返回酒馆正文">✕</button></div></div>
        <div class="pd-scroll"><div class="pd-grid">${items.map((item,index)=>`<section class="pd-widget pd-size-${['small','medium','large'].includes(item.size)?item.size:'medium'} pd-type-${this.desktopEscape(item.type)}" data-widget="${this.desktopEscape(item.id)}" data-index="${index}" style="--pd-bg:${/^#[0-9a-fA-F]{3,8}$/.test(item.color||'')?item.color:'#ffffffdb'}">
            <div class="pd-widget-top"><span>${this.desktopEscape(item.title || '小组件')}</span><button type="button" class="pd-widget-menu" aria-label="编辑小组件">•••</button></div>${this.desktopWidgetContent(item)}</section>`).join('')}</div></div>
        <div class="pd-editor" hidden><div class="pd-editor-head"><strong>编辑主屏幕</strong><button type="button" class="pd-editor-done">完成</button></div><div class="pd-editor-controls"><button type="button" class="pd-add-widget">＋ 添加组件</button><button type="button" class="pd-reset-widgets">恢复默认</button></div><p class="pd-tip">点击组件上的 ••• 编辑内容、换样式、移动或删除；支持拖动排序。</p></div>
        <div class="pd-modal" hidden><div class="pd-modal-sheet"><header><strong>小组件设置</strong><button type="button" class="pd-modal-close">✕</button></header><div class="pd-form"></div></div></div>`;
    }
    bindDesktopEvents() {
        const root = this.phoneShell.screen.querySelector('.home-layout-desktop');
        if (!root) return;
        let edit = false, selected = null;
        const items = () => this.getDesktopItems();
        const refresh = () => { this.saveDesktopItems(items()); };
        const showEditor = on => {
            edit=on;root.classList.toggle('pd-editing',on);
            root.querySelector('.pd-editor').hidden=!on;
            root.querySelector('.pd-edit-toggle').textContent=on?'完成':'编辑桌面';
        };
        const modal=root.querySelector('.pd-modal'),form=root.querySelector('.pd-form');
        const showModal = item => {
            selected=item;
            const types=['clock','calendar','photo','note','quote','anniversary','music','weather','battery','apps','spacer'];
            const names=['时钟','日历','照片','便签','语录','纪念日','音乐','天气','电量','应用合集','空白装饰'];
            form.innerHTML=`<label>组件类型<select name="type">${types.map((t,i)=>`<option value="${t}" ${item.type===t?'selected':''}>${names[i]}</option>`).join('')}</select></label><label>组件大小<select name="size">${['small','medium','large'].map((v,i)=>`<option value="${v}" ${item.size===v?'selected':''}>${['小型 1×1','中型 2×1','大型 2×2'][i]}</option>`).join('')}</select></label><label>标题<input name="title" maxlength="36" value="${this.desktopEscape(item.title||'')}"></label><label>文字内容<textarea name="text" rows="3">${this.desktopEscape(item.text||'')}</textarea></label><label>纪念日期<input name="date" type="date" value="${this.desktopEscape(item.date||'')}"></label><label>卡片背景颜色<input name="color" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:'#ffffff'}"></label><label>照片地址（或使用下方本地上传）<input name="image" value="${this.desktopEscape(item.image?.startsWith('data:')?'':item.image||'')}"></label><label>上传照片<input name="imageFile" type="file" accept="image/*"></label><div class="pd-form-actions"><button type="button" data-action="back">取消</button><button type="button" data-action="remove">删除</button><button type="button" data-action="up">↑ 上移</button><button type="button" data-action="down">↓ 下移</button><button type="button" data-action="save">保存</button></div>`;
            modal.hidden=false;
        };
        root.querySelector('.pd-edit-toggle').onclick=()=>showEditor(!edit);
        root.querySelector('.pd-editor-done').onclick=()=>showEditor(false);
        root.querySelector('.pd-close-phone').onclick=()=>window.dispatchEvent(new CustomEvent('phone:requestClose'));
        root.querySelector('.pd-modal-close').onclick=()=>{modal.hidden=true};
        root.querySelector('.pd-add-widget').onclick=()=>showModal({id:'w'+Date.now(),type:'note',size:'medium',title:'新组件',text:''});
        root.querySelector('.pd-reset-widgets').onclick=()=>{if(confirm('恢复默认桌面布局？')) {window.VirtualPhone?.storage?.set?.(this.desktopKey,null);this.render({forceDomRefresh:true});}};
        root.querySelectorAll('.pd-widget').forEach(el=>{
            const index=Number(el.dataset.index);
            el.querySelector('.pd-widget-menu').onclick=e=>{e.stopPropagation();showModal(items()[index]);};
            el.draggable=true;
            el.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(index));};
            el.ondragover=e=>{e.preventDefault();};
            el.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));const to=Number(el.dataset.index);const list=items();if(from>=0&&from<list.length&&to>=0&&to<list.length){list.splice(to,0,list.splice(from,1)[0]);this.saveDesktopItems(list);}};
            if(el.classList.contains('pd-type-music'))el.onclick=e=>{if(!e.target.closest('button')&&!edit)this.openApp('music');};
        });
        form.onclick=e=>{
            const action=e.target.closest('button[data-action]')?.dataset.action;
            if(!action)return;
            if(action==='back'){modal.hidden=true;return;}
            const list=items(),position=list.findIndex(x=>x.id===selected.id);
            if(action==='remove'){if(position>=0)list.splice(position,1);this.saveDesktopItems(list);return;}
            if(action==='up'||action==='down'){
                const other=position+(action==='up'?-1:1);
                if(position>=0&&other>=0&&other<list.length){[list[position],list[other]]=[list[other],list[position]];this.saveDesktopItems(list);}return;
            }
            if(action==='save'){
                const data=new FormData();for(const input of form.querySelectorAll('[name]')){if(input.name!=='imageFile')data.set(input.name,input.value);}
                const next={...selected,...Object.fromEntries(data.entries())};
                const file=form.querySelector('[name=imageFile]').files[0];
                const finish=()=>{if(position>=0)list[position]=next;else list.push(next);this.saveDesktopItems(list);};
                if(file){if(file.size>3*1024*1024){alert('请上传小于 3MB 的图片');return;}const reader=new FileReader();reader.onload=()=>{next.image=reader.result;finish();};reader.readAsDataURL(file);}else{if(!next.image&&selected.image)next.image=selected.image;finish();}
            }
        };
    }

    renderIconLayout() {
        const dateInfo = this.getCurrentDateParts();
        return `
            <div class="home-time yzp-home-time${dateInfo.isAncient ? ' is-ancient' : ''}">
                <div class="time-large yzp-home-time-large">${this.getCurrentTime()}</div>
                <div class="date yzp-home-date">${this._escapeHtml(dateInfo.date)}${dateInfo.weekday ? ` ${this._escapeHtml(dateInfo.weekday)}` : ''}</div>
            </div>
            <div class="app-grid yzp-home-app-grid">
                ${this.apps.map(app => this.renderAppIcon(app)).join('')}
            </div>
        `;
    }

    renderCardLayout() {
        const timeCardImage = this.getCardTimeImage();
        const timeCardImageStyle = timeCardImage
            ? ` style="background-image:url('${timeCardImage}');"`
            : '';
        const cardDate = this.getCurrentDateParts();
        return `
            <div class="home-dashboard yzp-home-dashboard">
                <section class="home-time-card yzp-home-time-card yzp-home-floating-time${timeCardImage ? ' has-image' : ''}${cardDate.isAncient ? ' is-ancient' : ''}"${timeCardImageStyle}>
                    <div class="home-time-info yzp-home-time-info">
                        <div class="time-large yzp-home-time-large">${this.getCurrentTime()}</div>
                        <div class="home-time-date yzp-home-time-date">
                            <div class="date yzp-home-date">${this._escapeHtml(cardDate.date)}</div>
                            <div class="home-time-weekday yzp-home-time-weekday"${cardDate.isAncient ? ' hidden' : ''}>${this._escapeHtml(cardDate.weekday)}</div>
                        </div>
                    </div>
                </section>

                <section class="home-app-cluster yzp-home-app-cluster">
                    <div class="home-app-cluster-scroll yzp-home-app-cluster-scroll">
                        ${this.renderClusterApps()}
                    </div>
                </section>
                ${this.renderSocialCard()}
                ${this.renderSettingsCard()}
                ${this.renderMusicCard()}
            </div>
        `;
    }

    getCardTimeImage() {
        return window.VirtualPhone?.storage?.get?.('phone-card-time-image') || null;
    }

    getAppById(appId) {
        return this.apps.find(app => app.id === appId) || null;
    }

    _escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _getCustomIcon(appId) {
        try {
            if (window.VirtualPhone?.imageManager) {
                return window.VirtualPhone.imageManager.getAppIcon(appId);
            }
        } catch (e) {
            console.warn('获取APP图标失败:', e);
        }
        return null;
    }

    _getAppIconImage(app) {
        if (!app) return null;
        return this._getCustomIcon(app.id) || String(app.defaultIcon || '').trim() || null;
    }

    _buildCustomIconStyle(iconUrl, { fit = 'contain' } = {}) {
        const safeUrl = String(iconUrl || '').trim();
        if (!safeUrl) return '';
        const escapedUrl = safeUrl
            .replace(/\\/g, '/')
            .replace(/'/g, "\\'")
            .replace(/\)/g, '\\)');
        return [
            `background-image: url('${escapedUrl}')`,
            `background-size: ${fit}`,
            'background-position: center',
            'background-repeat: no-repeat',
            'background-color: transparent'
        ].join('; ') + ';';
    }

    _renderCustomIconImage(iconUrl, className = 'home-custom-icon-img') {
        const safeUrl = String(iconUrl || '').trim();
        if (!safeUrl) return '';
        return `<img class="${className}" src="${this._escapeHtml(safeUrl)}" alt="" loading="eager" decoding="sync" draggable="false">`;
    }

    _getCustomAppNames() {
        try {
            const raw = window.VirtualPhone?.storage?.get?.('phone-app-custom-names');
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            console.warn('读取自定义APP名称失败:', e);
            return {};
        }
    }

    _getAppDisplayName(app) {
        const customNames = this._getCustomAppNames();
        const customName = String(customNames?.[app?.id] || '').trim();
        return customName || String(app?.name || '');
    }

    renderAppGlyph(app, className = 'home-widget-icon') {
        if (!app) return '';
        const iconImage = this._getAppIconImage(app);
        if (iconImage) {
            return `<span class="${className} custom-icon" style="${this._buildCustomIconStyle(iconImage)}"></span>`;
        }
        return `<span class="${className}" style="--app-color:${app.color};">${this._escapeHtml(app.icon)}</span>`;
    }

    renderAppBadge(app) {
        return app?.badge > 0 ? `<span class="app-badge yzp-home-app-badge">${app.badge}</span>` : '';
    }

    renderMusicCard() {
        const app = this.getAppById('music');
        if (!app) return '';
        return `
            <section class="yzp-home-app-action home-widget-card yzp-home-widget-card home-music-card yzp-home-music-card" data-app="${app.id}">
                <div class="home-vinyl-player yzp-home-vinyl-player" aria-hidden="true">
                    <div class="home-vinyl-record yzp-home-vinyl-record">
                        <div class="home-vinyl-grooves yzp-home-vinyl-grooves"></div>
                        ${this.renderAppGlyph(app, 'home-vinyl-cover yzp-home-vinyl-cover')}
                    </div>
                    <div class="home-tonearm yzp-home-tonearm">
                        <div class="home-tonearm-pivot yzp-home-tonearm-pivot"></div>
                        <div class="home-tonearm-curve yzp-home-tonearm-curve">
                            <div class="home-tonearm-head yzp-home-tonearm-head"></div>
                        </div>
                    </div>
                </div>
                <div class="home-music-panel yzp-home-music-panel">
                    <div class="home-card-title yzp-home-card-title">${this._escapeHtml(this._getAppDisplayName(app))}</div>
                    <div class="home-music-controls yzp-home-music-controls" aria-hidden="true">
                        <span class="home-music-control home-music-control-prev"></span>
                        <span class="home-music-control home-music-control-pause"></span>
                        <span class="home-music-control home-music-control-next"></span>
                    </div>
                </div>
                ${this.renderAppBadge(app)}
            </section>
        `;
    }

    renderSocialCard() {
        const socialIds = ['wechat', 'weibo', 'album', 'wangxiang'];
        const socialApps = socialIds.map(id => this.getAppById(id)).filter(Boolean);
        if (socialApps.length === 0) return '';
        return `
            <section class="home-social-card yzp-home-social-card">
                ${socialApps.map(app => this.renderSocialApp(app)).join('')}
            </section>
        `;
    }

    renderSocialApp(app) {
        if (!app) return '';
        const iconImage = this._getAppIconImage(app);
        const iconStyle = iconImage
            ? this._buildCustomIconStyle(iconImage)
            : `background:${app.color};`;
        const iconContent = iconImage ? '' : this._escapeHtml(app.icon);
        const customClass = iconImage ? 'custom-icon' : '';
        return `
            <div class="app-icon yzp-home-app-action home-social-app yzp-home-social-app" data-app="${app.id}" style="--app-color:${app.color};">
                <div class="home-social-icon yzp-home-social-icon ${customClass}" style="${iconStyle}">
                    ${iconContent}
                </div>
                ${this.renderAppBadge(app)}
                <div class="home-social-name yzp-home-social-name">${this._escapeHtml(this._getAppDisplayName(app))}</div>
            </div>
        `;
    }

    renderClusterApps() {
        const clusterIds = ['x', 'honey', 'games', 'phone', 'diary', 'calendar', 'mofo', 'storyvoice'];
        return clusterIds
            .map(id => this.getAppById(id))
            .filter(Boolean)
            .map(app => this.renderFreeAppIcon(app))
            .join('');
    }

    renderFreeAppIcon(app) {
        if (!app) return '';
        const iconImage = this._getAppIconImage(app);
        const iconStyle = iconImage
            ? this._buildCustomIconStyle(iconImage)
            : `background:${app.color};`;
        const iconContent = iconImage ? '' : this._escapeHtml(app.icon);
        const customClass = iconImage ? 'custom-icon' : '';
        return `
            <div class="app-icon yzp-home-app-action home-free-icon yzp-home-free-icon" data-app="${app.id}" style="--app-color:${app.color};">
                <div class="home-app-squircle yzp-home-app-squircle ${customClass}" style="${iconStyle}">
                    ${iconContent}
                </div>
                ${this.renderAppBadge(app)}
                <div class="home-mini-name yzp-home-mini-name">${this._escapeHtml(this._getAppDisplayName(app))}</div>
            </div>
        `;
    }

    renderDiaryCard() {
        const app = this.getAppById('diary');
        if (!app) return '';
        const diaryPreview = this.getLatestDiaryPreview();
        return `
            <section class="app-icon yzp-home-app-action home-diary-card yzp-home-diary-card" data-app="${app.id}" style="--app-color:${app.color};">
                <div class="home-diary-header yzp-home-diary-header">
                    ${this.renderAppGlyph(app, 'home-diary-icon yzp-home-diary-icon')}
                    <div class="home-card-title yzp-home-card-title">${this._escapeHtml(diaryPreview.title || this._getAppDisplayName(app))}</div>
                </div>
                <div class="home-diary-copy yzp-home-diary-copy">
                    <div class="home-card-desc yzp-home-card-desc">${this._escapeHtml(diaryPreview.preview)}</div>
                </div>
                ${this.renderAppBadge(app)}
            </section>
        `;
    }

    getLatestDiaryPreview() {
        const fallback = {
            title: '日记',
            preview: '记录今天的片段、心情和那些没说出口的话。'
        };

        try {
            const saved = window.VirtualPhone?.storage?.get?.('diary_entries', null);
            const entries = typeof saved === 'string' ? JSON.parse(saved) : saved;
            if (!Array.isArray(entries) || entries.length === 0) return fallback;

            const visibleEntries = entries.filter(entry => entry && entry.offlineHidden !== true && String(entry.content || '').trim());
            if (visibleEntries.length === 0) return fallback;

            const latest = [...visibleEntries].sort((a, b) => {
                const aTime = Number(a.createdAt) || this._dateToTimestamp(a.date || a.content) || 0;
                const bTime = Number(b.createdAt) || this._dateToTimestamp(b.date || b.content) || 0;
                return bTime - aTime;
            })[0];

            const rawContent = String(latest.content || '').replace(/\r\n/g, '\n').trim();
            const title = String(latest.title || this._extractDiaryTitle(rawContent) || '日记').trim();
            const preview = this._buildDiaryPreview(rawContent, title) || fallback.preview;

            return { title, preview };
        } catch (e) {
            console.warn('读取首页日记预览失败:', e);
            return fallback;
        }
    }

    _extractDiaryTitle(content) {
        const titleMatch = String(content || '').match(/【([^】]+)】/);
        if (titleMatch && !/\d{1,6}年/.test(titleMatch[1])) return titleMatch[1];
        const firstLine = String(content || '').split('\n').map(line => line.trim()).find(Boolean);
        return firstLine && firstLine.length <= 24 ? firstLine.replace(/^#+\s*/, '') : '';
    }

    _buildDiaryPreview(content, title) {
        const normalizedTitle = String(title || '').trim();
        return String(content || '')
            .replace(/【[^】]*】/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== normalizedTitle && !/^[-—]{2,}/.test(line))
            .join(' ')
            .replace(/\s+/g, ' ')
            .slice(0, 72);
    }

    _dateToTimestamp(value) {
        const text = String(value || '');
        const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (!match) return 0;
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() || 0;
    }

    renderFeatureCard(appId) {
        const app = this.getAppById(appId);
        if (!app) return '';
        return this.renderFreeAppIcon(app);
    }

    renderSettingsCard() {
        const app = this.getAppById('settings');
        if (!app) return '';
        return `
            <section class="yzp-home-app-action home-settings-card yzp-home-settings-card" data-app="${app.id}">
                <div class="home-settings-left yzp-home-settings-left">
                    ${this.renderAppGlyph(app, 'home-settings-icon yzp-home-settings-icon')}
                    <div class="home-settings-title yzp-home-settings-title">${this._escapeHtml(this._getAppDisplayName(app))}</div>
                </div>
                <div class="home-settings-chevron yzp-home-settings-chevron">›</div>
                ${this.renderAppBadge(app)}
            </section>
        `;
    }

    // 🔥 获取快捷栏配置
    getDockApps() {
        const storage = window.VirtualPhone?.storage;
        let dockAppIds = ['wechat', 'weibo', 'phone', 'settings']; // 默认4个

        if (storage) {
            const saved = storage.get('dock-apps');
            if (saved) {
                try {
                    dockAppIds = JSON.parse(saved);
                } catch (e) {
                    console.warn('解析dock配置失败:', e);
                }
            }
        }

        // 根据ID获取完整的app信息
        return dockAppIds.map(id => this.apps.find(app => app.id === id)).filter(Boolean);
    }

    // 🔥 渲染底部快捷栏
    renderDock() {
        const dockApps = this.getDockApps();

        return dockApps.map(app => {
            const iconImage = this._getAppIconImage(app);

            const iconStyle = iconImage
                ? this._buildCustomIconStyle(iconImage)
                : '';

            const customClass = iconImage ? 'custom-icon' : '';
            const iconContent = iconImage ? '' : app.icon;

            return `
                <div class="dock-app yzp-home-dock-app ${customClass}" data-app="${app.id}" style="${iconStyle}">
                    ${iconContent}
                </div>
            `;
        }).join('');
    }
    
    renderAppIcon(app) {
        const badge = app.badge > 0 ? `<span class="app-badge">${app.badge}</span>` : '';
        const iconImage = this._getAppIconImage(app);
        
        const iconStyle = '';

        const iconContent = iconImage
            ? this._renderCustomIconImage(iconImage, 'home-custom-icon-img yzp-home-custom-icon-img')
            : `<span class="app-icon-emoji yzp-home-app-icon-emoji">${app.icon}</span>`;

        const customClass = iconImage ? 'custom-icon' : '';

        return `
            <div class="app-icon yzp-home-app-icon yzp-home-app-action" data-app="${app.id}" style="--app-color: ${app.color}">
                <div class="app-icon-bg yzp-home-app-icon-bg ${customClass}" style="${iconStyle}">
                    ${iconContent}
                </div>
                ${badge}
                <div class="app-name yzp-home-app-name">${this._escapeHtml(this._getAppDisplayName(app))}</div>
            </div>
        `;
    }
    
    bindEvents() {
        const icons = this.phoneShell.screen.querySelectorAll('.yzp-home-app-action, .yzp-home-dock-app, .app-icon, .dock-app');
        icons.forEach(icon => {
            const releaseGuardForNewPress = () => {
                this.phoneShell?.releaseHomeTapGuard?.();
            };
            icon.onpointerdown = releaseGuardForNewPress;
            icon.ontouchstart = releaseGuardForNewPress;
            icon.onmousedown = releaseGuardForNewPress;
            icon.onclick = (e) => {
                e.stopPropagation();
                const appId = icon.dataset.app;
                this.openApp(appId);
            };
        });

        // 监听壁纸更新
        if (!this._wallpaperEventBound) {
            this._wallpaperEventBound = true;
            window.addEventListener('phone:updateWallpaper', (e) => {
                this.render({ forceDomRefresh: true });
            });
        }

        // 监听APP图标更新
        if (!this._appIconEventBound) {
            this._appIconEventBound = true;
            window.addEventListener('phone:updateAppIcon', () => {
                this.render({ forceDomRefresh: true });
            });
        }

        if (!this._cardLayoutCssEventBound) {
            this._cardLayoutCssEventBound = true;
            window.addEventListener('phone:updateCardLayoutCss', () => {
                this.applyCardLayoutCustomCss();
            });
        }

        if (!this._timeUpdateEventBound) {
            this._timeUpdateEventBound = true;
            window.addEventListener('phone:timeUpdated', () => {
                this.updateTimeDisplay();
            });
        }
    }
    
    openApp(appId) {
        const globalGuardUntil = Number(window.VirtualPhone?._homeReturnGuardUntil || 0);
        if (this.phoneShell?.isHomeReturnGuardActive?.() || Date.now() < globalGuardUntil) {
            return false;
        }
        window.dispatchEvent(new CustomEvent('phone:openApp', { 
            detail: { appId } 
        }));
        return true;
    }

    _isLobbyMode(context = null) {
        const ctx = context || window.VirtualPhone?.storage?.getContext?.() || window.SillyTavern?.getContext?.() || {};
        const charName = String(ctx?.name2 || '').trim();
        if (/^SillyTavern System$/i.test(charName)) return true;
        const chatId = String(ctx?.chatMetadata?.file_name || ctx?.chatId || '').trim();
        if (chatId) return false;
        return !charName;
    }

    _isStorageTruthy(key) {
        const raw = window.VirtualPhone?.storage?.get?.(key);
        return raw === true || raw === 'true' || raw === 1;
    }

    _isStorageEnabledByDefault(key) {
        const raw = window.VirtualPhone?.storage?.get?.(key);
        if (raw === undefined || raw === null || raw === '') return true;
        return raw === true || raw === 'true' || raw === 1;
    }

    _shouldUseRealTimeForPhoneDisplay() {
        const context = window.VirtualPhone?.storage?.getContext?.() || window.SillyTavern?.getContext?.() || {};
        const isLobby = this._isLobbyMode(context);
        const onlineOnlyKey = isLobby ? 'phone_lobby_wechat_online_only_mode' : 'wechat_online_only_mode';
        const interopKey = isLobby ? 'phone_lobby_wechat_online_mode' : 'wechat_online_mode';
        const realTimeKey = isLobby ? 'phone_lobby_wechat_online_only_real_time_enabled' : 'wechat_online_only_real_time_enabled';
        return this._isStorageTruthy(onlineOnlyKey)
            && !this._isStorageTruthy(interopKey)
            && this._isStorageEnabledByDefault(realTimeKey);
    }

    _getCurrentPhoneTimeInfo() {
        const timeManager = window.VirtualPhone?.timeManager;
        if (timeManager) {
            if (this._shouldUseRealTimeForPhoneDisplay() && typeof timeManager.getRealTime === 'function') {
                return timeManager.getRealTime();
            }
            return timeManager.getCurrentStoryTime();
        }

        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return {
            time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            date: `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`,
            weekday: weekdays[now.getDay()],
            isReal: true
        };
    }

    getCurrentTime() {
        return this._getCurrentPhoneTimeInfo()?.time || '';
    }
    
    getCurrentDate() {
        const currentTime = this._getCurrentPhoneTimeInfo();
        if (currentTime?.isAncient && currentTime.date) {
            return String(currentTime.date).trim();
        }
        const dateParts = currentTime?.date?.match(/(\d+)年(\d+)月(\d+)日/);
        if (dateParts) {
            const year = parseInt(dateParts[1]);
            const month = parseInt(dateParts[2]);
            const day = parseInt(dateParts[3]);
            return `${year}年${month}月${day}日 ${currentTime.weekday || ''}`.trim();
        }
    
        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const weekday = weekdays[now.getDay()];
        return `${year}年${month}月${day}日 ${weekday}`;
    }

    getCurrentDateParts() {
        const currentTime = this._getCurrentPhoneTimeInfo();
        if (currentTime?.isAncient && currentTime.date) {
            return {
                date: String(currentTime.date).trim(),
                weekday: '',
                isAncient: true,
            };
        }

        const dateText = this.getCurrentDate() || '';
        const match = dateText.match(/^(.+?日)\s*(.+)$/);
        if (match) {
            return {
                date: match[1],
                weekday: match[2],
                isAncient: false,
            };
        }
        return {
            date: dateText,
            weekday: '',
            isAncient: false,
        };
    }

    updateTimeDisplay() {
        const root = this.phoneShell?.screen?.querySelector('.home-screen');
        if (!root) return false;

        const currentTime = this.getCurrentTime() || '';
        const currentDate = this.getCurrentDate() || '';
        const cardDate = this.getCurrentDateParts();

        root.querySelectorAll('.home-time, .yzp-home-time, .home-time-card, .yzp-home-time-card').forEach(el => {
            el.classList.toggle('is-ancient', cardDate.isAncient);
        });

        root.querySelectorAll('.time-large, .yzp-home-time-large').forEach(el => {
            el.textContent = currentTime;
        });
        root.querySelectorAll('.home-time > .date, .yzp-home-time > .yzp-home-date').forEach(el => {
            el.textContent = currentDate;
        });
        root.querySelectorAll('.home-time-date .date, .yzp-home-time-date .yzp-home-date').forEach(el => {
            el.textContent = cardDate.date;
        });
        root.querySelectorAll('.home-time-weekday, .yzp-home-time-weekday').forEach(el => {
            el.textContent = cardDate.weekday;
            el.hidden = cardDate.isAncient;
        });

        return true;
    }

    updateWallpaperDisplay() {
        const wallpaperElement = this.phoneShell?.screen?.querySelector('.home-screen .wallpaper');
        if (!wallpaperElement) return false;

        const wallpaper = String(this._getWallpaperImage() || '').trim();
        wallpaperElement.style.backgroundImage = wallpaper
            ? `url("${wallpaper.replace(/"/g, '\\"')}")`
            : '';
        wallpaperElement.style.backgroundSize = wallpaper ? 'cover' : '';
        wallpaperElement.style.backgroundPosition = wallpaper ? 'center' : '';
        return true;
    }

    updateAppBadges() {
        const root = this.phoneShell?.screen?.querySelector('.home-screen');
        if (!root) return false;

        root.querySelectorAll('.yzp-home-app-action[data-app]').forEach(element => {
            const app = this.getAppById(element.dataset.app);
            const badgeCount = Math.max(0, Number.parseInt(app?.badge, 10) || 0);
            let badge = Array.from(element.children || [])
                .find(child => child.classList?.contains('app-badge'));

            if (badgeCount <= 0) {
                badge?.remove();
                return;
            }

            if (!badge) {
                badge = document.createElement('span');
                badge.className = root.classList.contains('home-layout-cards')
                    ? 'app-badge yzp-home-app-badge'
                    : 'app-badge';
                element.appendChild(badge);
            }
            badge.textContent = String(badgeCount);
        });
        return true;
    }

}
