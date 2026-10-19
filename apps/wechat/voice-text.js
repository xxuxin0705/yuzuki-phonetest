const VOICE_TRANSCRIPT_PREFIX_REGEX = /^(?:语音条?\s*)?(?:转文字|转文本|转写|转录|转化出的文字|转化文字|转换文字|文字内容|内容)\s*[：:]\s*/i;
const WECHAT_TRANSLATION_REGEX = /(?:\[\s*翻译\s*[：:]\s*([^\]\r\n]*)\]|【\s*翻译\s*[：:]\s*([^】\r\n]*)】)/gi;
const WECHAT_INNER_THOUGHT_REGEX = /\[\s*内心\s*\]\s*[（(]\s*([\s\S]*?)\s*[）)]/g;
const WECHAT_TTS_STATUS_REGEX = /\[\s*转线下\s*\]/gi;

function normalizeRemovedSegmentSpacing(value = '') {
    return String(value || '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([，。！？、；：,.!?;:])/g, '$1')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 解析 [翻译:…] / 【翻译:…】：按括号配对扫描，支持译文里再嵌套 [表情包:…]、跨行、以及漏写收尾括号
function extractTranslationTags(text = '') {
    const source = String(text || '');
    const translations = [];
    let out = '';
    let i = 0;
    const openRe = /(\[|【)\s*翻译\s*[：:]/g;
    while (i < source.length) {
        openRe.lastIndex = i;
        const m = openRe.exec(source);
        if (!m) { out += source.slice(i); break; }
        out += source.slice(i, m.index);
        let j = m.index + m[0].length;
        let depth = 1;
        let body = '';
        for (; j < source.length; j++) {
            const ch = source[j];
            if (ch === '[' || ch === '【') depth++;
            else if (ch === ']' || ch === '】') {
                depth--;
                if (depth === 0) { j++; break; }
            }
            body += ch;
        }
        const translation = body.trim();
        // 模型偶尔把同一句译文写两遍：重复的只留一份
        const norm = v => String(v || '').replace(/\s+/g, '');
        if (translation && !translations.some(t => norm(t) === norm(translation))) translations.push(translation);
        i = j;
    }
    return { speechText: out, translations };
}

export function parseWechatTranslationContent(value = '') {
    const displayText = String(value || '').trim();
    const { speechText, translations } = extractTranslationTags(displayText);
    return {
        displayText,
        speechText: normalizeRemovedSegmentSpacing(speechText),
        // 模型会照着聊天记录的格式把「引用 某人: …」也翻进译文里：引用在气泡外已经显示了，译文里去掉
        translationText: translations
            .map(t => String(t || '').replace(/^\s*[「『]\s*引用\s*[^」』]*[」』]\s*/, '').trim())
            .filter(Boolean)
            .join('\n')
    };
}

export function stripWechatTranslationContent(value = '') {
    return parseWechatTranslationContent(value).speechText;
}

export function parseWechatInnerThoughtContent(value = '') {
    const thoughts = [];
    const visibleContent = normalizeRemovedSegmentSpacing(String(value || '').replace(
        WECHAT_INNER_THOUGHT_REGEX,
        (_match, thought) => {
            const text = String(thought || '').trim();
            if (text) thoughts.push(text);
            return '';
        }
    ));

    return {
        visibleContent,
        innerThought: thoughts.join('\n')
    };
}

export function stripWechatTtsNonSpeechContent(value = '') {
    const parsedInnerThought = parseWechatInnerThoughtContent(value);
    return normalizeRemovedSegmentSpacing(
        stripWechatTranslationContent(parsedInnerThought.visibleContent)
            .replace(WECHAT_TTS_STATUS_REGEX, '')
    );
}

export function stripVoiceParentheticalContent(value = '') {
    let text = String(value || '');
    let previous = '';

    do {
        previous = text;
        text = text
            .replace(/\([^()]*\)/g, '')
            .replace(/（[^（）]*）/g, '');
    } while (text !== previous);

    return text
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([，。！？、；：,.!?;:])/g, '$1')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function normalizeWechatVoiceText(value = '') {
    let text = String(value || '').trim();
    const wrappedVoiceMatch = text.match(/^[（(]\s*([\s\S]*?)\s*[)）]$/);
    if (wrappedVoiceMatch) {
        text = String(wrappedVoiceMatch[1] || '').trim();
    }

    text = text
        .replace(VOICE_TRANSCRIPT_PREFIX_REGEX, '')
        .replace(/^语音条转文字内容\s*[：:]\s*/i, '')
        .trim();

    return stripVoiceParentheticalContent(text);
}

export function parseWechatVoiceContent(value = '') {
    const parsedInnerThought = parseWechatInnerThoughtContent(value);

    // 先把整段里的 [翻译:…] 标签取出来（不管写在括号里还是括号外），
    // 否则 “[语音条]（こんにちは）[翻译:你好]” 的括号会被整体当成动作描写剥掉，语音文字就丢了。
    const outerTranslation = parseWechatTranslationContent(parsedInnerThought.visibleContent);
    const voiceText = normalizeWechatVoiceText(outerTranslation.speechText);
    const innerTranslation = parseWechatTranslationContent(voiceText);

    const translationText = [outerTranslation.translationText, innerTranslation.translationText]
        .filter(Boolean)
        .join(' ');
    const speechText = innerTranslation.speechText;

    return {
        voiceText: translationText ? `${speechText} [翻译:${translationText}]`.trim() : speechText,
        ttsText: speechText,
        translationText,
        innerThought: parsedInnerThought.innerThought
    };
}
