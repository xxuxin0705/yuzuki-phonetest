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
// APP配置文件
export const DEFAULT_APP_ICONS = Object.freeze({
    wechat: new URL('../phone/微信.png', import.meta.url).href,
    weibo: new URL('../phone/微博.png', import.meta.url).href,
    x: new URL('../phone/X.png', import.meta.url).href,
    honey: new URL('../phone/蜜语.png', import.meta.url).href,
    mofo: new URL('../phone/魔坊.png', import.meta.url).href,
    wangxiang: new URL('../phone/万象.png', import.meta.url).href,
    phone: new URL('../phone/电话.png', import.meta.url).href,
    diary: new URL('../phone/日记.png', import.meta.url).href,
    music: new URL('../phone/音乐.png', import.meta.url).href,
    album: new URL('../phone/相册.png', import.meta.url).href,
    calendar: new URL('../phone/日历.png', import.meta.url).href,
    settings: new URL('../phone/设置.png', import.meta.url).href,
    storyvoice: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20120%20120%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%23ff9a8b%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23a18cd1%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%27120%27%20height%3D%27120%27%20rx%3D%2728%27%20fill%3D%27url%28%23g%29%27/%3E%3Cpath%20d%3D%27M34%2050h14l18-15v50L48%2070H34z%27%20fill%3D%27%23fff%27/%3E%3Cpath%20d%3D%27M76%2046c6%206%206%2022%200%2028M84%2038c11%2011%2011%2033%200%2044%27%20stroke%3D%27%23fff%27%20stroke-width%3D%276%27%20fill%3D%27none%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E"
});

export const DEFAULT_PHONE_WALLPAPER = new URL('../phone/手机背景.jpg', import.meta.url).href;

export const APPS = [
    // 第一行
    {
        id: 'wechat',
        name: '微信',
        icon: '💬',
        defaultIcon: DEFAULT_APP_ICONS.wechat,
        color: '#07c160',
        badge: 0,
        data: {
            contacts: [],
            messages: [],
            moments: []
        }
    },
    {
        id: 'weibo',
        name: '微博',
        icon: '👁️‍🗨️',
        defaultIcon: DEFAULT_APP_ICONS.weibo,
        color: '#ff8200',
        badge: 0,
        data: {
            hotSearches: [],
            recommends: [],
            cacheTopic: null // 用于记录当前打开的热搜词
        }
    },
    {
        id: 'x',
        name: 'X',
        icon: 'X',
        defaultIcon: DEFAULT_APP_ICONS.x,
        color: '#000000',
        badge: 0,
        data: {}
    },
    {
        id: 'honey',
        name: '蜜语',
        icon: '💕',
        defaultIcon: DEFAULT_APP_ICONS.honey,
        color: '#ff6b9d',
        badge: 0,
        data: {
            messages: []
        }
    },
    {
        id: 'mofo',
        name: '魔坊',
        icon: '🪄',
        defaultIcon: DEFAULT_APP_ICONS.mofo,
        color: '#1677ff',
        data: {
            scenes: [],
            presets: []
        }
    },
    {
        id: 'wangxiang',
        name: '万象',
        icon: '🧿',
        defaultIcon: DEFAULT_APP_ICONS.wangxiang,
        color: '#315c50',
        data: {}
    },
    // 第二行
    {
        id: 'phone',
        name: '通话',
        icon: '📞',
        defaultIcon: DEFAULT_APP_ICONS.phone,
        color: '#52c41a',
        data: {
            contacts: [],
            callHistory: []
        }
    },
    {
        id: 'diary',
        name: '日记',
        icon: '📔',
        defaultIcon: DEFAULT_APP_ICONS.diary,
        color: '#faad14',
        data: {
            entries: []
        }
    },
    {
        id: 'music',
        name: '音乐',
        icon: '🎵',
        defaultIcon: DEFAULT_APP_ICONS.music,
        color: '#eb2f96',
        data: {
            playlists: [],
            nowPlaying: null
        }
    },
    {
        id: 'album',
        name: '相册',
        icon: '🖼️',
        defaultIcon: DEFAULT_APP_ICONS.album,
        color: '#4096ff',
        data: {
            images: []
        }
    },
    {
        id: 'calendar',
        name: '日历',
        icon: '📅',
        defaultIcon: DEFAULT_APP_ICONS.calendar,
        color: '#5d83a8',
        data: {
            memos: []
        }
    },
    // 第三行
    {
        id: 'storyvoice',
        name: '朗读',
        icon: '🔊',
        defaultIcon: DEFAULT_APP_ICONS.storyvoice,
        color: '#a18cd1',
        badge: 0,
        data: {}
    },
    {
        id: 'settings',
        name: '设置',
        icon: '⚙️',
        defaultIcon: DEFAULT_APP_ICONS.settings,
        color: '#8c8c8c',
        data: {}
    }
];

// 手机配置
export const PHONE_CONFIG = {
    brand: 'iPhone',
    model: 'iPhone 14 Pro',
    theme: 'light',
    wallpaper: DEFAULT_PHONE_WALLPAPER,
    defaultWallpaper: DEFAULT_PHONE_WALLPAPER,
    position: 'right',
    size: 'medium'
};
