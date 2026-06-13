const IMAGE_URL_RE = /https?:\/\/[^\s<>"'，。！？；：、（）()[\]{}]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s<>"'，。！？；：、（）()[\]{}]*)?/gi;

function extractImageUrls(text = '') {
  const urls = String(text).match(IMAGE_URL_RE) || [];
  return [...new Set(urls.map(url => url.replace(/[，。,.;；:：)）\]}]+$/g, '')))];
}

function normalizeAnswer(raw, type) {
  let answer = String(raw || '').trim();
  answer = answer.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  answer = answer.replace(/^(答案|答案是|正确答案|选项)\s*[：:为是]?\s*/i, '').trim();

  if (type === 'judgement') {
    const compact = answer.replace(/\s+/g, '');
    if (/^(错误|错|否|非|不是|不对|不正确|×|false|f|no|0)$/i.test(compact)) return '错误';
    if (/^(正确|对|是|√|true|t|yes|1)$/i.test(compact)) return '正确';
    return '';
  }

  if (type === 'single') {
    if (/^[A-Z]$/.test(answer)) return answer;
    const match = answer.match(/(?:答案|选项|选择)?\s*[：:为是]?\s*([A-Z])(?:\s|$|。|，|\.|,)/);
    return match ? match[1] : '';
  }

  if (type === 'multiple') {
    if (/^[A-Z]+$/.test(answer)) {
      return [...new Set(answer.split(''))].sort().join('');
    }
    const match = answer.match(/(?:答案|选项|选择)?\s*[：:为是]?\s*([A-Z]{2,})(?:\s|$|。|，|\.|,)/);
    return match ? [...new Set(match[1].split(''))].sort().join('') : '';
  }

  const lines = answer.split('\n').map(line => line.trim()).filter(Boolean);
  return (lines[0] || answer).trim();
}

function parseLlmAnswer(data, type) {
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (!choice || !message) {
    return { answer: '', error: { message: 'LLM 响应格式异常' } };
  }

  const rawContent = String(message.content || '').trim();
  if (!rawContent) {
    if (choice.finish_reason === 'length') {
      return { answer: '', error: { message: 'LLM 响应被截断，已拒绝从推理过程猜答案' } };
    }
    return { answer: '', error: { message: 'LLM 未返回最终答案 content，已拒绝从 reasoning_content 猜答案' } };
  }

  let rawAnswer = rawContent;
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed && typeof parsed === 'object' && 'answer' in parsed) {
      rawAnswer = parsed.answer;
    }
  } catch {
    // Plain answer fallback for OpenAI-compatible providers that ignore JSON-only prompts.
  }

  const answer = normalizeAnswer(rawAnswer, type);
  if (!answer) {
    if (choice.finish_reason === 'length') {
      return { answer: '', error: { message: 'LLM 响应被截断且最终答案不可解析' } };
    }
    return { answer: '', error: { message: `无法解析 ${type || 'unknown'} 题答案` } };
  }

  return { answer };
}

function normalizeIncomingImages(images) {
  const imageList = [];
  const providedUrlSet = new Set();
  const failedBrowserUrls = [];

  if (!Array.isArray(images)) {
    return { imageList, providedUrlSet, failedBrowserUrls };
  }

  for (const image of images) {
    if (typeof image === 'string') {
      if (image.startsWith('data:image/')) imageList.push(image);
      continue;
    }

    if (!image || typeof image !== 'object') continue;

    const url = typeof image.url === 'string' ? image.url : '';
    const data = typeof image.data === 'string'
      ? image.data
      : typeof image.base64 === 'string'
        ? image.base64
        : '';

    if (data.startsWith('data:image/')) {
      imageList.push(data);
      if (url) providedUrlSet.add(url);
    } else if (url && image.error) {
      failedBrowserUrls.push(url);
    }
  }

  return { imageList, providedUrlSet, failedBrowserUrls };
}

function getMissingImageUrls(urls, providedUrlSet) {
  return [...new Set(urls)].filter(url => !providedUrlSet.has(url));
}

function buildVisionUserContent(imageList, text) {
  return [
    { type: 'text', text },
    ...imageList.map(url => ({
      type: 'image_url',
      image_url: { url }
    }))
  ];
}

module.exports = {
  extractImageUrls,
  normalizeAnswer,
  parseLlmAnswer,
  normalizeIncomingImages,
  getMissingImageUrls,
  buildVisionUserContent
};
