require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sharp = require('sharp');
const {
  extractImageUrls,
  parseLlmAnswer
} = require('./server-utils');

const app = express();
const PORT = process.env.PORT || 3000;

// LLM 配置
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const LLM_VISION_MODEL = process.env.LLM_VISION_MODEL || '';
const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 0);

// 服务自身地址（用于配置中的 url 回指）
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS === '*'
  ? '*'
  : process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || '*';

// 下载图片并转为 base64
// 方案一：修复图片下载，添加 Referer 绕过防盗链
// 方案优化：用 sharp 给透明图片加白色背景，解决黑字+透明背景看不见的问题
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mooc1.chaoxing.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      console.error(`下载图片失败: ${response.status} ${url}`);
      return null;
    }
    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.error(`下载图片失败: 非图片响应 ${contentType} ${url}`);
      return null;
    }
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    if (rawBuffer.length < 64) {
      console.error(`下载图片失败: 图片内容过小 ${rawBuffer.length} bytes ${url}`);
      return null;
    }
    // 给透明图片加白色背景
    const buffer = await sharp(rawBuffer)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    const base64 = buffer.toString('base64');
    console.log(`下载图片成功: ${contentType} -> png+白底 ${buffer.length} bytes ${url}`);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`下载图片错误: ${error.message} ${url}`);
    return null;
  }
}

// OCS 5.x 会在浏览器端把图片转成 base64，这里统一白底并限制尺寸
async function normalizeClientImage(dataUrl) {
  try {
    const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s.exec(dataUrl);
    if (!match) return null;
    const input = Buffer.from(match[1], 'base64');
    if (input.length < 64 || input.length > 8 * 1024 * 1024) {
      console.error(`浏览器图片大小异常: ${input.length} bytes`);
      return null;
    }
    const image = sharp(input).rotate();
    const meta = await image.metadata();
    image.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    const buffer = await image
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    console.log(`浏览器图片规范化: ${meta.width}x${meta.height} -> png+白底 ${buffer.length} bytes`);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error(`浏览器图片处理失败: ${error.message}`);
    return null;
  }
}

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: process.env.JSON_LIMIT || '15mb' }));

// 检查 API Key
function checkApiKey() {
  if (!LLM_API_KEY || LLM_API_KEY === 'your_api_key_here') {
    return false;
  }
  return true;
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      url: LLM_API_URL,
      model: LLM_MODEL,
      keyConfigured: checkApiKey()
    }
  });
});

// 获取配置（供油猴脚本使用）- 不暴露 API Key
app.get('/api/config', (req, res) => {
  if (!checkApiKey()) {
    return res.status(500).json({
      error: 'API Key 未配置，请在 .env 文件中设置 LLM_API_KEY'
    });
  }

  const proxyUrl = `${SERVER_BASE_URL}/api/proxy`;

  const config = [{
    name: 'LLM 大模型',
    url: proxyUrl,
    method: 'post',
    type: 'GM_xmlhttpRequest',
    contentType: 'json',
    responseType: 'json',
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      question: '${title}',
      options: '${options}',
      type: '${type}',
      suggestion_title: '${suggestion_title}',
      suggestion_options: '${suggestion_options}',
      images: {
        handler: 'return (env) => env.images'
      }
    },
    handler: `return function(res) {
  if (res.error) return ['', res.error.message || '请求失败'];
  try {
    var c = res.answer.trim();
    var m = c.match(/^[A-Z]+$/);
    if (m) return ['', m[0]];
    if (/^(对|是|正确|√|True|T)$/i.test(c)) return ['', '正确'];
    if (/^(错|否|错误|×|False|F)$/i.test(c)) return ['', '错误'];
    return ['', c.trim()];
  } catch(e) {
    return ['', '解析失败'];
  }
}`
  }];

  res.json(config);
});

// 题目类型对应的提示词
const TYPE_PROMPTS = {
  single: '单选题。只输出一个大写字母，如：A。禁止输出任何其他文字、解释、标点。',
  multiple: '多选题。只输出正确选项的大写字母连写，如：ABC。禁止输出任何其他文字、解释、标点。',
  judgement: '判断题。只输出"正确"或"错误"这两个字之一。禁止输出任何其他文字。',
  completion: '简答题/填空题。直接作答：简答题用完整通顺的中文句子，按要点分条作答，每个要点必须单独一行（要点之间使用换行符分隔，例如 1. 第一点\\n2. 第二点），保留正常标点；填空题只写答案内容。不要输出解题过程、元说明或 Markdown 标记。'
};

// 为选项添加 ABCD 标签
function formatOptions(options) {
  if (!options) return '';
  const lines = options.split('\n').filter(line => line.trim());
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return lines.map((line, i) => `${labels[i]}. ${line.trim()}`).join('\n');
}

// 旧版 OCS 没有 suggestion_* 字段，占位符会被替换成字面量 "undefined"
function hasUsableSuggestion(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text !== '' && text !== 'undefined' && text !== 'null';
}

// 清理填空题的 options（去除 HTML/JS 代码）
function cleanCompletionOptions(options) {
  if (!options) return '';
  // 如果包含 HTML 标签或 JavaScript 代码，返回空
  if (options.includes('<') || options.includes('var ') || options.includes('function')) {
    return '';
  }
  return options;
}

// OCS 5.x 题库状态检测会向题库 URL 发 HEAD 请求，成功条件是 HTTP 200-399
app.head('/api/proxy', (req, res) => {
  res.status(200).end();
});

app.get('/api/proxy', (req, res) => {
  res.json({
    status: 'ok',
    message: '答题请使用 POST /api/proxy'
  });
});

// 代理端点 - 接收题目，服务器端调用 LLM，不暴露 Key
app.post('/api/proxy', async (req, res) => {
  console.log(`[${new Date().toISOString()}] 收到请求:`, JSON.stringify({
    question: req.body.question?.substring(0, 100),
    type: req.body.type,
    images: Array.isArray(req.body.images) ? req.body.images.length : 0
  }));
  const { question, options, type, images, suggestion_title, suggestion_options } = req.body;

  if (!checkApiKey()) {
    return res.status(500).json({
      error: { message: 'API Key 未配置' }
    });
  }

  if (!question) {
    return res.status(400).json({
      error: { message: '缺少题目 (question)' }
    });
  }

  const typeHint = TYPE_PROMPTS[type] || '根据题目类型输出答案：单选输出字母，多选输出字母连写，判断输出正确/错误，填空输出答案文本';

  // OCS 5.x 图片题优化：浏览器端已转好 base64，直接使用
  const clientImages = Array.isArray(images)
    ? images.filter(item => typeof item === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(item))
    : [];
  const useClientImages = clientImages.length > 0;
  let imageList = [];
  let cleanQuestion = question;
  let cleanOptions = options;

  if (useClientImages) {
    if (clientImages.length > 8) {
      return res.status(422).json({
        answer: '',
        error: { message: '图片数量超过 8 张，已拒绝猜测' }
      });
    }
    console.log(`[${new Date().toISOString()}] 使用 OCS 浏览器端图片 ${clientImages.length} 张`);
    imageList = await Promise.all(clientImages.map(normalizeClientImage));
    if (imageList.some(item => !item)) {
      return res.status(422).json({
        answer: '',
        error: { message: '图片数据无效，题干不完整，已拒绝猜测' }
      });
    }
    cleanQuestion = hasUsableSuggestion(suggestion_title) ? suggestion_title : question;
    cleanOptions = hasUsableSuggestion(suggestion_options) ? suggestion_options : options;
  } else {
    // 旧版 OCS 或未开启图片优化：从题干 URL 服务端下载
    const imageUrls = extractImageUrls(question);
    if (options && type !== 'judgement') {
      imageUrls.push(...extractImageUrls(options));
    }
    const uniqueUrls = [...new Set(imageUrls)];
    const failedImageUrlSet = new Set();

    if (uniqueUrls.length > 0) {
      console.log(`[${new Date().toISOString()}] 发现 ${uniqueUrls.length} 个图片URL，服务端下载...`);
      const downloadPromises = uniqueUrls.map(async url => {
        const result = await downloadImageAsBase64(url);
        if (result) {
          return { url, base64: result };
        } else {
          failedImageUrlSet.add(url);
          return null;
        }
      });
      const results = await Promise.all(downloadPromises);
      for (const result of results.filter(Boolean)) {
        imageList.push(result.base64);
      }
      console.log(`[${new Date().toISOString()}] 图片下载完成: 成功 ${imageList.length} 张，失败 ${failedImageUrlSet.size} 张`);
    }

    // 图片 URL 替换逻辑 - 成功的替换为标记，失败的替换为占位符
    const imageUrlPattern = /https?:\/\/[^\s<>"'，。！？；：、（）()[\]{}]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s<>"'，。！？；：、（）()[\]{}]*)?/gi;
    const imageUrlIndex = new Map(uniqueUrls.map((url, index) => [url, index + 1]));

    function replaceImageUrls(text) {
      if (!text) return text;
      return text.replace(imageUrlPattern, (url) => {
        if (failedImageUrlSet.has(url)) {
          return '[图片加载失败]';
        }
        return `[图${imageUrlIndex.get(url) || ''}]`;
      }).replace(/[ \t]+/g, ' ').trim();
    }

    cleanQuestion = replaceImageUrls(question);
    cleanOptions = options ? replaceImageUrls(options) : options;

    const failedUrls = [...failedImageUrlSet];
    if (failedUrls.length > 0) {
      console.log(`[${new Date().toISOString()}] 图片加载失败，拒绝猜测:`, failedUrls);
      return res.status(422).json({
        answer: '',
        error: {
          message: '图片加载失败，题干不完整，已拒绝猜测',
          failedUrls
        }
      });
    }
  }

  // 根据题目类型处理选项
  let formattedPrompt = cleanQuestion;
  if (type === 'judgement') {
    formattedPrompt = cleanQuestion;
  } else if (type === 'completion') {
    const cleanOpts = cleanCompletionOptions(cleanOptions);
    if (cleanOpts) {
      formattedPrompt = `${cleanQuestion}\n${cleanOpts}`;
    }
  } else if (cleanOptions && (type === 'single' || type === 'multiple')) {
    formattedPrompt = `${cleanQuestion}\n${formatOptions(cleanOptions)}`;
  } else if (cleanOptions) {
    formattedPrompt = `${cleanQuestion}\n${cleanOptions}`;
  }

  // 构建 user message content
  let userContent;
  if (imageList.length > 0) {
    // 有图片：使用 vision API 格式
    userContent = [
      { type: 'text', text: formattedPrompt },
      ...imageList.map(url => ({ type: 'image_url', image_url: { url } }))
    ];
    console.log(`[${new Date().toISOString()}] 使用 vision API 格式，${imageList.length}张图片`);
  } else {
    userContent = formattedPrompt;
  }

  try {
    const requestModel = imageList.length > 0 ? (LLM_VISION_MODEL || LLM_MODEL) : LLM_MODEL;

    const requestBody = {
      model: requestModel,
      messages: [
        {
          role: 'system',
          content: `你是答题机器，严格遵守以下规则：
1. ${typeHint}
2. 禁止输出解题过程、推理步骤，以及与答案无关的说明
3. 禁止输出"答案是"、"因为"等引导词
4. 只输出 JSON，格式必须是 {"answer":"最终答案"}
5. 如果是图片题，题干中的 [图片N] 或 [图N] 占位符与上传图片顺序一一对应，仔细看图片内容再回答`
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0,
      max_tokens: LLM_MAX_TOKENS
    };

    // 打印发送给 LLM 的完整请求（图片 base64 截断）
    const logBody = JSON.parse(JSON.stringify(requestBody));
    if (Array.isArray(logBody.messages[1].content)) {
      logBody.messages[1].content = logBody.messages[1].content.map(item => {
        if (item.type === 'image_url') {
          const url = item.image_url.url || '';
          return { ...item, image_url: { url: url.substring(0, 80) + '...(base64截断)' } };
        }
        return item;
      });
    }
    console.log(`[${new Date().toISOString()}] ===== 发送给 LLM 的请求 =====`);
    console.log(JSON.stringify(logBody, null, 2));
    console.log(`[${new Date().toISOString()}] ============================`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    // 打印 LLM 返回的完整内容
    console.log(`[${new Date().toISOString()}] ===== LLM 返回的完整内容 =====`);
    console.log(`状态码: ${response.status}`);
    console.log(JSON.stringify(data, null, 2));
    console.log(`[${new Date().toISOString()}] ==============================`);

    if (!response.ok) {
      return res.status(response.status).json({
        answer: '',
        error: {
          message: data?.error?.message || `LLM API 请求失败: ${response.status}`
        }
      });
    }

    const parsed = parseLlmAnswer(data, type);
    if (parsed.error) {
      console.log(`[${new Date().toISOString()}] 答案解析失败:`, parsed.error.message);
      return res.json({ answer: '', error: parsed.error });
    }

    console.log(`[${new Date().toISOString()}] 提取的答案:`, parsed.answer);
    res.json({ answer: parsed.answer });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] LLM 请求错误:`, error.message);
    if (error.name === 'AbortError') {
      res.status(504).json({
        error: { message: 'LLM API 请求超时' }
      });
    } else {
      res.status(500).json({
        error: { message: '服务内部错误: ' + error.message }
      });
    }
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`OCS LLM 代理服务已启动: http://localhost:${PORT}`);
  console.log(`LLM API: ${LLM_API_URL}`);
  console.log(`LLM Model: ${LLM_MODEL}`);
  console.log(`API Key: ${checkApiKey() ? '已配置' : '未配置'}`);
  console.log('');
  console.log(`接口:`);
  console.log(`  GET  /health      - 健康检查`);
  console.log(`  GET  /api/config  - 获取配置`);
  console.log(`  POST /api/proxy   - 代理答题`);
});
