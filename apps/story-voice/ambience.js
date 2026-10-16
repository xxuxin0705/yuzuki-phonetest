// 柚月小手机 · 正文朗读：环境声（雨、风、海浪、虫鸣、室内、篝火、人群、咖啡馆）
// 全部用 WebAudio 现场合成，不用下载音频文件；播台词时在底下轻轻垫一层，停了就淡出。

export const AMBIENCE_LABELS = Object.freeze({
    none: '无', rain: '雨声', storm: '暴雨雷声', wind: '风声', waves: '海浪', night: '夜晚虫鸣',
    room: '安静室内', fire: '篝火噼啪', crowd: '人声嘈杂', cafe: '咖啡馆'
});

let CTX = null;
let REG = null; // 正在搭建的这一层用到的音源，停的时候一起关掉
const BUF = {};

function ctx() {
    if (!CTX) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        CTX = new AC();
    }
    if (CTX.state === 'suspended') CTX.resume().catch(() => {});
    return CTX;
}

// 4 秒循环的噪声：white / pink / brown
function noise(type) {
    const c = ctx();
    if (BUF[type]) return BUF[type];
    const len = c.sampleRate * 4;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'pink') {
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else if (type === 'brown') {
            last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
        } else d[i] = w;
    }
    BUF[type] = buf;
    return buf;
}

function src(type) {
    const c = ctx();
    const s = c.createBufferSource();
    s.buffer = noise(type);
    s.loop = true;
    s.loopStart = Math.random() * 3;
    s.start(0, Math.random() * 3);
    REG?.push(s);
    return s;
}

function filter(type, freq, q = 0.7) {
    const f = ctx().createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
}

function gain(v) {
    const g = ctx().createGain();
    g.gain.value = v;
    return g;
}

// 慢慢起伏：LFO → 目标参数
function lfo(param, rate, depth) {
    const c = ctx();
    const o = c.createOscillator();
    o.frequency.value = rate;
    const g = gain(depth);
    o.connect(g).connect(param);
    o.start();
    REG?.push(o);
    return o;
}

function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
}

// 短促的一下（雨滴、柴火噼啪、碰杯）
function burst(out, { type = 'white', hp = 2000, lp = 9000, peak = 0.3, decay = 0.04, tone = 0 } = {}) {
    const c = ctx();
    const t = c.currentTime;
    const g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    let s;
    if (tone) {
        s = c.createOscillator();
        s.frequency.value = tone;
        s.connect(g);
    } else {
        s = c.createBufferSource();
        s.buffer = noise(type);
        chain(s, filter('highpass', hp), filter('lowpass', lp), g);
    }
    g.connect(out);
    s.start(t, tone ? 0 : Math.random() * 3);
    s.stop(t + decay + 0.05);
}

function every(min, max, fn, timers) {
    const go = () => { try { fn(); } catch (e) { /* 忽略 */ } timers.t = setTimeout(go, min + Math.random() * (max - min)); };
    timers.t = setTimeout(go, Math.random() * max);
}

const BUILD = {
    rain(out, add) {
        chain(src('pink'), filter('highpass', 500), filter('lowpass', 7000), gain(0.55), out);
        add(250, 900, () => burst(out, { hp: 2500, lp: 7000, peak: 0.12 + Math.random() * 0.15, decay: 0.03 }));
    },
    storm(out, add) {
        chain(src('pink'), filter('highpass', 300), filter('lowpass', 8000), gain(0.8), out);
        chain(src('brown'), filter('lowpass', 180), gain(0.6), out);
        add(60, 220, () => burst(out, { hp: 2000, lp: 8000, peak: 0.12 + Math.random() * 0.15, decay: 0.03 }));
        add(9000, 20000, () => burst(out, { type: 'brown', hp: 20, lp: 300, peak: 1.4, decay: 3.5 })); // 远处的雷
    },
    wind(out) {
        const bp = filter('bandpass', 500, 0.9);
        const g = gain(0.6);
        chain(src('pink'), bp, g, out);
        lfo(bp.frequency, 0.09, 260);
        lfo(g.gain, 0.06, 0.35);
    },
    waves(out) {
        const g = gain(0.5);
        chain(src('brown'), filter('lowpass', 1100), g, out);
        lfo(g.gain, 0.085, 0.45);
        const g2 = gain(0.08);
        chain(src('pink'), filter('highpass', 2500), g2, out);
        lfo(g2.gain, 0.085, 0.07);
    },
    night(out, add) {
        chain(src('pink'), filter('lowpass', 900), gain(0.08), out);
        // 蟋蟀：三下一组的高频短鸣
        add(700, 1600, () => {
            const f = 4300 + Math.random() * 600;
            for (let i = 0; i < 3; i++) setTimeout(() => burst(out, { tone: f, peak: 0.05, decay: 0.035 }), i * 55);
        });
    },
    room(out) {
        chain(src('brown'), filter('lowpass', 260), gain(0.35), out);
        chain(src('pink'), filter('bandpass', 1200, 0.5), gain(0.025), out);
    },
    fire(out, add) {
        chain(src('brown'), filter('lowpass', 700), gain(0.45), out);
        add(60, 420, () => burst(out, { hp: 1800, lp: 9000, peak: 0.08 + Math.random() * 0.35, decay: 0.012 + Math.random() * 0.03 }));
    },
    crowd(out) {
        // 远处很多人在说话：几条不同共振峰的噪声，各自按说话的节奏起伏
        [320, 520, 800, 1150, 1700, 2400].forEach((f, i) => {
            const g = gain(0.13);
            chain(src(i % 2 ? 'pink' : 'brown'), filter('bandpass', f, 3.5), g, out);
            lfo(g.gain, 2 + Math.random() * 4, 0.1);
        });
        chain(src('pink'), filter('lowpass', 2500), gain(0.08), out);
    },
    cafe(out, add) {
        [380, 650, 1000, 1500, 2200].forEach((f, i) => {
            const g = gain(0.07);
            chain(src(i % 2 ? 'pink' : 'brown'), filter('bandpass', f, 3.5), g, out);
            lfo(g.gain, 2 + Math.random() * 3, 0.055);
        });
        chain(src('brown'), filter('lowpass', 300), gain(0.15), out);
        add(2500, 7000, () => burst(out, { tone: 2600 + Math.random() * 2400, peak: 0.05, decay: 0.35 })); // 杯碟轻碰
    }
};

/**
 * 开始一层环境声。返回 { stop() }，stop 会淡出。
 * @param {string} kind  AMBIENCE_LABELS 里的 key
 * @param {number} volume 0~1
 */
export function startAmbience(kind, volume = 0.3) {
    const build = BUILD[kind];
    const c = build ? ctx() : null;
    if (!build || !c) return { stop() {} };
    const master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    const v = Math.max(0, Math.min(1, Number(volume) || 0)) * 0.6;
    master.gain.linearRampToValueAtTime(v, c.currentTime + 1.2);
    const timers = [];
    const add = (min, max, fn) => { const t = {}; timers.push(t); every(min, max, fn, t); };
    REG = [];
    try { build(master, add); } catch (e) { console.warn('[环境声] 失败', e); }
    const nodes = REG;
    REG = null;
    let stopped = false;
    return {
        kind,
        stop(fade = 0.8) {
            if (stopped) return;
            stopped = true;
            timers.forEach(t => clearTimeout(t.t));
            try {
                const now = c.currentTime;
                master.gain.cancelScheduledValues(now);
                master.gain.setValueAtTime(master.gain.value, now);
                master.gain.linearRampToValueAtTime(0, now + fade);
            } catch (e) { /* 忽略 */ }
            setTimeout(() => {
                nodes.forEach(n => { try { n.stop(); } catch (e) { /* 忽略 */ } });
                try { master.disconnect(); } catch (e) { /* 忽略 */ }
            }, (fade + 0.3) * 1000);
        }
    };
}
