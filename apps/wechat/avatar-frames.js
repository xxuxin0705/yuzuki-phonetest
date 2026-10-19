// 🖼️ 头像框：聊天里气泡旁的头像加装饰框（透明 PNG / GIF）
// · 点聊天里的头像直接打开这里（对方 / 自己分开设置）
// · 可以只给这个聊天用，也可以设成所有聊天通用；不开导入主题也能用
// · 数据沿用之前的 nj_avatar_frames_v1，原来设过的头像框不会丢

export const FRAME_KEY = 'nj_avatar_frames_v1';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function readFrames(storage) {
    let v = null;
    try {
        const raw = storage?.get?.(FRAME_KEY, false);
        v = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch (e) { v = null; }
    const f = { them: '', me: '', scale: 1.45, offsetY: 0, chats: {}, ...(v && typeof v === 'object' ? v : {}) };
    if (!f.chats || typeof f.chats !== 'object') f.chats = {};
    return f;
}

export function saveFrames(storage, f) {
    try { storage?.set?.(FRAME_KEY, JSON.stringify(f)); } catch (e) { console.warn('⚠️ 头像框保存失败:', e); }
}

export function frameFor(f, chatId, side) {
    const own = f.chats?.[String(chatId || '')]?.[side];
    return String(own || f[side] || '').trim();
}

export function clearChatFrames(storage, chatId) {
    const f = readFrames(storage);
    if (f.chats?.[chatId]) { delete f.chats[chatId]; saveFrames(storage, f); }
}

// 三个 ID 的权重：导入主题（两个 ID）也盖不住头像框
const FR = 'html :is(#phone-panel-content, body) .wechat-app:not(#yzf-a):not(#yzf-b) .chat-room';
const FRAME_CSS = `
${FR} .message-avatar.yz-has-frame { overflow: visible !important; position: relative !important; }
${FR} .message-avatar.yz-has-frame > :not(.yz-avatar-frame) { border-radius: inherit; overflow: hidden; }
${FR} .message-avatar > i.yz-avatar-frame {
  position: absolute !important; left: 50% !important; top: 50% !important; display: block !important;
  width: calc(var(--yz-frame-scale, 1.45) * 100%) !important; height: calc(var(--yz-frame-scale, 1.45) * 100%) !important;
  max-width: none !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important;
  transform: translate(-50%, calc(-50% + var(--yz-frame-offset-y, 0px))) !important; opacity: 1 !important; visibility: visible !important;
  background-color: transparent !important; background-position: center !important; background-repeat: no-repeat !important; background-size: contain !important;
  box-shadow: none !important; pointer-events: none !important; z-index: 3 !important; filter: none !important;
}
.yzf-mask { position: absolute; inset: 0; z-index: 99990; display: flex; align-items: flex-end; background: rgba(0,0,0,.32); }
.yzf-sheet { width: 100%; background: #fff; color: #222; border-radius: 18px 18px 0 0; padding: 14px 16px 22px; box-sizing: border-box; max-height: 88%; overflow-y: auto; font-size: 13px; }
.yzf-sheet header { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.yzf-sheet header button { border: 0; background: transparent; font-size: 22px; line-height: 1; color: #888; cursor: pointer; }
.yzf-prev { display: flex; justify-content: center; padding: 14px 0 18px; }
.yzf-prev-av { position: relative; width: 64px; height: 64px; border-radius: 50%; background: #eee center/cover no-repeat; }
.yzf-prev-av i { position: absolute; left: 50%; top: 50%; width: calc(var(--s, 1.45) * 100%); height: calc(var(--s, 1.45) * 100%); transform: translate(-50%, calc(-50% + var(--y, 0px) * 1.6)); background: center/contain no-repeat; pointer-events: none; }
.yzf-seg { display: flex; gap: 3px; background: #f2f3f5; border-radius: 10px; padding: 2px; margin-bottom: 10px; }
.yzf-seg button { flex: 1; border: 0; background: transparent; padding: 7px 0; border-radius: 8px; font-size: 12.5px; color: #666; cursor: pointer; }
.yzf-seg button.active { background: #fff; color: #111; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.yzf-btns { display: flex; gap: 8px; }
.yzf-btns button, .yzf-links button { flex: 1; border: 0; border-radius: 10px; padding: 9px 0; font-size: 13px; cursor: pointer; background: #f2f3f5; color: #333; }
.yzf-btns button.is-primary { background: #07c160; color: #fff; font-weight: 600; }
.yzf-btns button:disabled { opacity: .45; }
.yzf-range { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 12.5px; color: #555; }
.yzf-range input { flex: 1; }
.yzf-range b { min-width: 46px; text-align: right; font-weight: 500; color: #333; }
.yzf-note { font-size: 11.5px; color: #999; line-height: 1.5; margin-top: 10px; }
.yzf-links { display: flex; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: .5px solid #eee; }
`;

function ensureCss() {
    let tag = document.getElementById('wechat-avatar-frame-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'wechat-avatar-frame-style';
        document.head.appendChild(tag);
    }
    if (tag.textContent !== FRAME_CSS) tag.textContent = FRAME_CSS;
}

// 聊天消息刷新时调用：给头像挂上 / 摘掉头像框
export function syncAvatarFrames(box, app) {
    if (!box) return;
    const chatId = String(app?.currentChat?.id || '');
    const f = readFrames(app?.storage);
    const urls = { them: frameFor(f, chatId, 'them'), me: frameFor(f, chatId, 'me') };
    const any = !!(urls.them || urls.me);
    if (any) ensureCss();
    const appEl = box.closest('.wechat-app');
    if (appEl && any) {
        appEl.style.setProperty('--yz-frame-scale', String(Number(f.scale) || 1.45));
        appEl.style.setProperty('--yz-frame-offset-y', `${Number(f.offsetY) || 0}px`);
    }
    box.querySelectorAll(':scope > .chat-message > .message-avatar').forEach(av => {
        const side = av.parentElement.classList.contains('message-right') ? 'me' : 'them';
        const url = urls[side];
        let fr = av.querySelector(':scope > .yz-avatar-frame');
        if (!url) {
            if (fr) fr.remove();
            av.classList.remove('yz-has-frame');
            return;
        }
        if (!fr) {
            fr = document.createElement('i');
            fr.className = 'yz-avatar-frame';
            fr.setAttribute('aria-hidden', 'true');
            av.appendChild(fr);
        }
        if (fr.dataset.src !== url) {
            fr.dataset.src = url;
            fr.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
        }
        if (!av.classList.contains('yz-has-frame')) av.classList.add('yz-has-frame');
    });
}

function refreshOpenChat() {
    const box = document.querySelector('.phone-view-current #chat-messages') || document.getElementById('chat-messages');
    return box;
}

/**
 * 头像框面板
 * @param {object} app
 * @param {object} opts { chatId, side: 'them'|'me', avatarSrc, title, links: [{ label, onClick }] }
 */
export function openAvatarFrameSheet(app, opts = {}) {
    ensureCss();
    const chatId = String(opts.chatId || '');
    const side = opts.side === 'me' ? 'me' : 'them';
    const host = document.querySelector('.phone-view-current') || document.querySelector('.phone-screen') || document.body;
    host.querySelector(':scope > .yzf-mask')?.remove();
    const f0 = readFrames(app.storage);
    // 这个聊天单独设过就默认编辑“只这个聊天”，否则编辑“所有聊天”
    let scope = chatId && f0.chats?.[chatId]?.[side] ? 'chat' : (chatId && !f0[side] ? 'chat' : 'all');

    const mask = document.createElement('div');
    mask.className = 'yzf-mask';
    host.appendChild(mask);
    ['touchstart', 'touchmove', 'wheel'].forEach(ev => mask.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    const notify = (t, m, i) => app.phoneShell?.showNotification?.(t, m, i);
    const current = () => {
        const f = readFrames(app.storage);
        return scope === 'chat' ? String(f.chats?.[chatId]?.[side] || '') : String(f[side] || '');
    };
    const effective = () => frameFor(readFrames(app.storage), chatId, side);
    const setUrl = (url) => {
        const f = readFrames(app.storage);
        if (scope === 'chat' && chatId) {
            f.chats[chatId] = { ...(f.chats[chatId] || {}), [side]: url };
            if (!f.chats[chatId].them && !f.chats[chatId].me) delete f.chats[chatId];
        } else {
            f[side] = url;
        }
        saveFrames(app.storage, f);
        const box = refreshOpenChat();
        if (box) syncAvatarFrames(box, app);
        render();
    };

    const render = () => {
        const f = readFrames(app.storage);
        const cur = current();
        const eff = effective();
        const own = chatId && f.chats?.[chatId]?.[side];
        mask.innerHTML = `
            <div class="yzf-sheet" role="dialog">
                <header><span>${esc(opts.title || (side === 'me' ? '我的头像框' : '对方头像框'))}</span><button type="button" data-x aria-label="关闭">×</button></header>
                <div class="yzf-prev"><span class="yzf-prev-av" style="${opts.avatarSrc ? `background-image:url('${esc(opts.avatarSrc)}');` : ''}--s:${Number(f.scale) || 1.45};--y:${Number(f.offsetY) || 0}px">
                    ${eff ? `<i style="background-image:url('${esc(eff)}')"></i>` : ''}
                </span></div>
                ${chatId ? `<div class="yzf-seg">
                    <button type="button" data-scope="chat" class="${scope === 'chat' ? 'active' : ''}">只这个聊天</button>
                    <button type="button" data-scope="all" class="${scope === 'all' ? 'active' : ''}">所有聊天通用</button>
                </div>` : ''}
                <div class="yzf-btns">
                    <button type="button" data-act="upload" class="is-primary">上传图片</button>
                    <button type="button" data-act="link">图片链接</button>
                    <button type="button" data-act="clear" ${cur ? '' : 'disabled'}>去掉</button>
                </div>
                <label class="yzf-range"><span>大小</span><input type="range" min="1" max="2.2" step="0.05" value="${Number(f.scale) || 1.45}" data-num="scale"><b>${(Number(f.scale) || 1.45).toFixed(2)}×</b></label>
                <label class="yzf-range"><span>上下</span><input type="range" min="-12" max="12" step="1" value="${Number(f.offsetY) || 0}" data-num="offsetY"><b>${Number(f.offsetY) || 0}px</b></label>
                <div class="yzf-note">用透明背景的 PNG / GIF。${scope === 'chat' ? (own ? '这个聊天用的是单独的框。' : '这个聊天还没单独设，现在跟随通用框。') : '没单独设过的聊天都用这个框。'}大小、上下所有头像框共用。</div>
                ${(opts.links || []).length ? `<div class="yzf-links">${opts.links.map((l, i) => `<button type="button" data-link="${i}">${esc(l.label)}</button>`).join('')}</div>` : ''}
            </div>`;
    };
    render();

    mask.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === mask || e.target.closest('[data-x]')) { mask.remove(); return; }
        const sc = e.target.closest('[data-scope]');
        if (sc) { scope = sc.dataset.scope; render(); return; }
        const link = e.target.closest('[data-link]');
        if (link) {
            const l = (opts.links || [])[Number(link.dataset.link)];
            mask.remove();
            try { l?.onClick?.(); } catch (err) { console.warn(err); }
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'upload') { fileInput.value = ''; fileInput.click(); return; }
        if (act === 'link') {
            const url = String(window.prompt('头像框图片链接（透明 PNG / GIF）', current() || '') || '').trim();
            if (!url) return;
            if (!/^(https?:|data:image\/|\/)/i.test(url)) { notify('链接不对', '请填 http(s) 开头的图片链接', '⚠️'); return; }
            setUrl(url);
            return;
        }
        if (act === 'clear') setUrl('');
    });
    mask.addEventListener('input', (e) => {
        const inp = e.target.closest('[data-num]');
        if (!inp) return;
        const key = inp.dataset.num;
        const v = Number(inp.value);
        const out = inp.parentElement?.querySelector('b');
        if (out) out.textContent = key === 'scale' ? `${v.toFixed(2)}×` : `${v}px`;
        document.querySelectorAll('.wechat-app').forEach(a => a.style.setProperty(key === 'scale' ? '--yz-frame-scale' : '--yz-frame-offset-y', key === 'scale' ? String(v) : `${v}px`));
        const pv = mask.querySelector('.yzf-prev-av');
        if (pv) pv.style.setProperty(key === 'scale' ? '--s' : '--y', key === 'scale' ? String(v) : `${v}px`);
    });
    mask.addEventListener('change', (e) => {
        const inp = e.target.closest('[data-num]');
        if (!inp) return;
        const f = readFrames(app.storage);
        f[inp.dataset.num] = Number(inp.value);
        saveFrames(app.storage, f);
    });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) { notify('上传失败', '图片不能超过 4MB', '⚠️'); return; }
        try {
            const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = rej; r.readAsDataURL(file); });
            let url = '';
            try { url = await window.VirtualPhone?.imageManager?.uploadDataUrl?.(dataUrl, 'avatar_frame'); } catch (err) { url = ''; }
            setUrl(url || dataUrl);
            notify('头像框', '已更新', '🖼️');
        } catch (err) {
            notify('上传失败', err?.message || '', '❌');
        }
    });
    return mask;
}
