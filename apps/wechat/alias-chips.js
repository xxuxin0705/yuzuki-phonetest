// 柚月小手机 · 别名编辑（正文朗读用来比对说话人）
// 固定的名字（真实姓名）排第一个、不能删；其余别名可以添加、点一下编辑、× 删除。

const STYLE_ID = 'yz-alias-chips-style';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function normalizeAliases(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(/[,，、;；\n]/);
    return [...new Set(list.map(x => String(x || '').trim()).filter(Boolean))];
}

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
.yzac { display: flex; flex-direction: column; gap: 8px; }
.yzac-list { display: flex; flex-wrap: wrap; gap: 6px; }
.yzac-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 4px 6px 4px 10px; border-radius: 999px; background: #eef6ff; border: 1px solid #cfe3fb; color: #2b5d94; font-size: 12.5px; line-height: 1.3; box-sizing: border-box; }
.yzac-chip.is-fixed { background: #f1fbf5; border-color: #c4ead3; color: #1f7a4a; padding-right: 10px; }
.yzac-chip.is-fixed em { font-style: normal; font-size: 10px; color: #fff; background: #07c160; border-radius: 6px; padding: 0 5px; }
.yzac-chip.is-empty { background: #f7f7f7; border-style: dashed; border-color: #ddd; color: #aaa; }
.yzac-text { cursor: text; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.yzac-del { border: 0; background: rgba(0,0,0,.06); color: #6a7d92; width: 18px; height: 18px; border-radius: 50%; font-size: 12px; line-height: 18px; padding: 0; cursor: pointer; flex: 0 0 18px; }
.yzac-edit { border: 0; outline: none; background: transparent; font: inherit; color: inherit; width: 90px; padding: 0; }
.yzac-add { display: flex; gap: 6px; }
.yzac-add input { flex: 1; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 10px; border: 1px solid #ececec; border-radius: 9px; background: rgba(255,255,255,.9); font-size: 12.5px; color: #222; outline: none; }
.yzac-add input:focus { border-color: #9cc3f5; }
.yzac-add button { flex: 0 0 auto; height: 32px; padding: 0 14px; border: 0; border-radius: 9px; background: #07c160; color: #fff; font-size: 12.5px; cursor: pointer; }
`;
    document.head.appendChild(st);
}

/**
 * @param {object} opt
 * @param {string} opt.fixed   默认比对的名字（真实姓名），可为空
 * @param {string} opt.fixedLabel  固定名字的小标签，默认“默认”
 * @param {string[]} opt.aliases  额外别名
 * @param {string} opt.key  data-yzac 标识
 */
export function renderAliasChips({ fixed = '', fixedLabel = '默认', fixedEmpty = '', aliases = [], key = 'aliases', placeholder = '添加别名，例如：小七' } = {}) {
    injectStyle();
    const list = normalizeAliases(aliases).filter(a => a !== fixed);
    const fixedHtml = fixed
        ? `<span class="yzac-chip is-fixed"><span class="yzac-text">${esc(fixed)}</span><em>${esc(fixedLabel)}</em></span>`
        : (fixedEmpty ? `<span class="yzac-chip is-empty">${esc(fixedEmpty)}</span>` : '');
    return `
        <div class="yzac" data-yzac="${esc(key)}">
            <div class="yzac-list">${fixedHtml}${list.map(a => `<span class="yzac-chip" data-alias="${esc(a)}"><span class="yzac-text" title="点一下编辑">${esc(a)}</span><button type="button" class="yzac-del" title="删除">×</button></span>`).join('')}</div>
            <div class="yzac-add"><input type="text" placeholder="${esc(placeholder)}" enterkeyhint="done"><button type="button">添加</button></div>
        </div>`;
}

/** onChange(list) 在每次增删改后调用，返回值不用管 */
export function bindAliasChips(root, onChange, { fixed = '' } = {}) {
    if (!root || root.__yzacBound) return;
    root.__yzacBound = true;
    const listEl = root.querySelector('.yzac-list');
    const read = () => Array.from(root.querySelectorAll('.yzac-chip[data-alias]')).map(c => c.dataset.alias).filter(Boolean);
    const chipHtml = (a) => `<span class="yzac-text" title="点一下编辑">${esc(a)}</span><button type="button" class="yzac-del" title="删除">×</button>`;
    const emit = () => { try { onChange?.(normalizeAliases(read())); } catch (e) { console.warn('[别名] 保存失败', e); } };
    const fixedName = () => String(typeof fixed === 'function' ? fixed() : fixed || '').trim();
    const exists = (name, except = null) => name === fixedName() || Array.from(root.querySelectorAll('.yzac-chip[data-alias]')).some(c => c !== except && c.dataset.alias === name);

    const add = () => {
        const input = root.querySelector('.yzac-add input');
        const names = normalizeAliases(input.value);
        input.value = '';
        let changed = false;
        names.forEach(n => {
            if (exists(n)) return;
            const chip = document.createElement('span');
            chip.className = 'yzac-chip';
            chip.dataset.alias = n;
            chip.innerHTML = chipHtml(n);
            listEl.appendChild(chip);
            changed = true;
        });
        if (changed) emit();
    };
    root.querySelector('.yzac-add button')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); add(); });
    root.querySelector('.yzac-add input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.querySelector('.yzac-add input')?.addEventListener('change', (e) => e.stopPropagation());

    listEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = e.target.closest('.yzac-chip[data-alias]');
        if (!chip) return;
        if (e.target.closest('.yzac-del')) { chip.remove(); emit(); return; }
        if (!e.target.closest('.yzac-text') || chip.querySelector('.yzac-edit')) return;
        const old = chip.dataset.alias;
        chip.innerHTML = `<input type="text" class="yzac-edit" value="${esc(old)}" enterkeyhint="done">`;
        const inp = chip.querySelector('.yzac-edit');
        inp.focus();
        inp.select?.();
        let done = false;
        const finish = (save) => {
            if (done) return;
            done = true;
            const v = normalizeAliases(inp.value)[0] || '';
            if (save && !v) { chip.remove(); emit(); return; }
            if (save && v !== old && !exists(v, chip)) { chip.dataset.alias = v; chip.innerHTML = chipHtml(v); emit(); return; }
            chip.innerHTML = chipHtml(old);
        };
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } if (ev.key === 'Escape') finish(false); });
        inp.addEventListener('blur', () => finish(true));
        inp.addEventListener('change', (ev) => ev.stopPropagation());
    });
}

/** 只改第一个固定名字（不重画整块，不打断正在输入的框） */
export function setAliasFixed(root, name, { label = '真实姓名', empty = '' } = {}) {
    const list = root?.querySelector?.('.yzac-list');
    if (!list) return;
    list.querySelector('.yzac-chip.is-fixed, .yzac-chip.is-empty')?.remove();
    const n = String(name || '').trim();
    list.querySelectorAll('.yzac-chip[data-alias]').forEach(c => { if (c.dataset.alias === n) c.remove(); });
    if (!n && !empty) return;
    const chip = document.createElement('span');
    chip.className = n ? 'yzac-chip is-fixed' : 'yzac-chip is-empty';
    chip.innerHTML = n ? `<span class="yzac-text">${esc(n)}</span><em>${esc(label)}</em>` : esc(empty);
    list.prepend(chip);
}
