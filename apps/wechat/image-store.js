// 柚月小手机 · 独立图片仓库
// 所有头像 / 表情包 / 背景 / 聊天图片都保存到 SillyTavern 的 user/images/yuzuki-phone/ 文件夹，
// 不再写入酒馆的全局背景（/backgrounds/）。

export const PHONE_IMAGE_FOLDER = 'yuzuki-phone';
export const PHONE_IMAGE_BASE = `/user/images/${PHONE_IMAGE_FOLDER}/`;

const MIME_EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
};

function getHeaders() {
    try {
        const ctx = window.SillyTavern?.getContext?.();
        const h = ctx?.getRequestHeaders?.();
        if (h) return { ...h, 'Content-Type': 'application/json' };
    } catch (e) { }
    try {
        if (typeof window.getRequestHeaders === 'function') return { ...window.getRequestHeaders(), 'Content-Type': 'application/json' };
    } catch (e) { }
    const token = window.token || document.querySelector('meta[name="csrf-token"]')?.content || '';
    return { 'Content-Type': 'application/json', ...(token ? { 'X-CSRF-Token': token } : {}) };
}

function safeName(prefix = 'img') {
    const p = String(prefix || 'img').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'img';
    const rand = Math.random().toString(36).slice(2, 8);
    return `phone_${p}_${Date.now()}_${rand}`;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error || new Error('读取图片失败'));
        r.readAsDataURL(blob);
    });
}

export function isPhoneImagePath(value = '') {
    const raw = String(value || '').trim();
    return raw.includes(PHONE_IMAGE_BASE) || raw.startsWith(PHONE_IMAGE_BASE.slice(1));
}

export function normalizePhoneImagePath(value = '') {
    const raw = String(value || '').trim();
    const i = raw.indexOf(PHONE_IMAGE_BASE);
    if (i >= 0) return raw.slice(i).split('?')[0].split('#')[0];
    if (raw.startsWith(PHONE_IMAGE_BASE.slice(1))) return `/${raw}`.split('?')[0].split('#')[0];
    return raw;
}

export async function uploadPhoneDataUrl(dataUrl, prefix = 'img', options = {}) {
    const text = String(dataUrl || '');
    const m = text.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/i);
    if (!m) {
        // 不是 data url（已经是链接），原样返回
        return text;
    }
    const mime = String(m[1] || 'image/png').toLowerCase();
    const format = MIME_EXT[mime] || 'png';
    const filename = safeName(prefix);
    const resp = await fetch('/api/images/upload', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ image: m[2], format, ch_name: PHONE_IMAGE_FOLDER, filename }),
        signal: options?.signal
    });
    if (!resp.ok) throw new Error(`图片保存失败 (${resp.status})`);
    let data = {};
    try { data = await resp.json(); } catch (e) { }
    let path = String(data?.path || '').replace(/\\/g, '/');
    if (!path) path = `${PHONE_IMAGE_BASE}${filename}.${format}`;
    if (!path.startsWith('/')) path = `/${path}`;
    return path;
}

export async function uploadPhoneBlob(blob, prefix = 'img', options = {}) {
    if (!blob) return '';
    const dataUrl = await blobToDataUrl(blob);
    return uploadPhoneDataUrl(dataUrl, prefix, options);
}

function isReferenced(path) {
    try {
        const probe = window.__yuzukiImageRefProbe;
        if (typeof probe === 'function') return !!probe(path);
    } catch (e) { }
    return true; // 无法确认时不删除，宁可留下文件
}

export async function deletePhoneImage(path, options = {}) {
    const p = normalizePhoneImagePath(path);
    if (!isPhoneImagePath(p)) return { attempted: false, success: false };
    if (options?.skipIfReferenced && isReferenced(p)) return { attempted: false, success: false, referenced: true };
    try {
        const resp = await fetch('/api/images/delete', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: p.replace(/^\/+/, '') })
        });
        return { attempted: true, success: resp.ok };
    } catch (e) {
        return { attempted: true, success: false };
    }
}

/**
 * 接管小手机的图片管理器：上传一律走独立文件夹，删除时识别新旧两种路径。
 * 旧的 /backgrounds/phone_ 图片仍交给原方法清理，保证兼容。
 */
export function installPhoneImageStore() {
    const vp = window.VirtualPhone;
    const im = vp?.imageManager;
    if (!im || im.__yuzukiStoreInstalled) return !!im;
    const origDelete = typeof im.deleteManagedBackgroundByPath === 'function' ? im.deleteManagedBackgroundByPath.bind(im) : null;
    const origDataUrl = typeof im.uploadDataUrl === 'function' ? im.uploadDataUrl.bind(im) : null;
    const origBlob = typeof im.uploadBlob === 'function' ? im.uploadBlob.bind(im) : null;

    im.uploadDataUrl = async (dataUrl, prefix, options) => {
        try {
            return await uploadPhoneDataUrl(dataUrl, prefix, options);
        } catch (e) {
            console.warn('⚠️ [柚月图片] 独立文件夹保存失败，改为内嵌保存:', e);
            return String(dataUrl || '');
        }
    };
    im.uploadBlob = async (blob, prefix, options) => {
        try {
            return await uploadPhoneBlob(blob, prefix, options);
        } catch (e) {
            console.warn('⚠️ [柚月图片] 独立文件夹保存失败，改为内嵌保存:', e);
            try { return await blobToDataUrl(blob); } catch (_) { return ''; }
        }
    };
    im.deleteManagedBackgroundByPath = async (path, options = {}) => {
        if (isPhoneImagePath(path)) return deletePhoneImage(path, options);
        if (origDelete) return origDelete(path, options);
        return { attempted: false, success: false };
    };
    im.__yuzukiOriginal = { uploadDataUrl: origDataUrl, uploadBlob: origBlob, deleteManagedBackgroundByPath: origDelete };
    im.__yuzukiStoreInstalled = true;
    return true;
}
