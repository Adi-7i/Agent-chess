const axios = require('axios');

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.LLM_TIMEOUT || '15000', 10);
const MOVE_REGEX = /([a-h][1-8][a-h][1-8][qrbn]?)/i;
const SHARED_OPENAI_MODELS = String(process.env.OPENAI_CHAT_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

function buildChatCompletionsEndpoint(baseUrl) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function pickModelForPlayer(playerKey) {
  if (SHARED_OPENAI_MODELS.length === 0) {
    return playerKey === 'LLM_X' ? 'Kimi-K2.5' : 'DeepSeek-R1';
  }

  if (playerKey === 'LLM_X') {
    const kimiModel = SHARED_OPENAI_MODELS.find((model) => /kimi/i.test(model));
    return kimiModel || SHARED_OPENAI_MODELS[0];
  }

  const deepseekR1Model = SHARED_OPENAI_MODELS.find((model) => /deepseek-r1/i.test(model));
  return deepseekR1Model || SHARED_OPENAI_MODELS[SHARED_OPENAI_MODELS.length - 1];
}

function getConfigFor(playerKey) {
  const isX = playerKey === 'LLM_X';
  const sharedApiKey = process.env.OPENAI_API_KEY || '';
  const sharedEndpoint = buildChatCompletionsEndpoint(process.env.OPENAI_BASE_URL);

  if (isX) {
    return {
      playerKey,
      apiKey: process.env.LLM_X_API_KEY || process.env.LLM1_API_KEY || sharedApiKey,
      endpoint: process.env.LLM_X_ENDPOINT || process.env.LLM1_ENDPOINT || sharedEndpoint,
      model: process.env.LLM_X_MODEL || process.env.LLM1_MODEL || pickModelForPlayer('LLM_X')
    };
  }

  return {
    playerKey,
    apiKey: process.env.LLM_Y_API_KEY || process.env.LLM2_API_KEY || sharedApiKey,
    endpoint: process.env.LLM_Y_ENDPOINT || process.env.LLM2_ENDPOINT || sharedEndpoint,
    model: process.env.LLM_Y_MODEL || process.env.LLM2_MODEL || pickModelForPlayer('LLM_Y')
  };
}

function normalizeUci(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const match = candidate.toLowerCase().replace(/["'`\s]/g, '').match(MOVE_REGEX);
  return match ? match[1] : null;
}

function extractTextFromResponse(data) {
  if (!data) return '';

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
    const content = data.choices[0].message.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content) && content[0]?.text) {
      return String(content[0].text);
    }
  }

  if (Array.isArray(data.content) && data.content[0]?.text) {
    return String(data.content[0].text);
  }

  if (typeof data.response === 'string') {
    return data.response;
  }

  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  return JSON.stringify(data);
}

function detectProvider(endpoint) {
  const normalized = String(endpoint || '').toLowerCase();
  if (normalized.includes('anthropic') || normalized.includes('/v1/messages')) {
    return 'anthropic';
  }
  if (normalized.includes('ollama') || normalized.includes(':11434')) {
    return 'ollama';
  }
  return 'openai';
}

async function requestMove(playerKey, fen) {
  const config = getConfigFor(playerKey);
  const prompt = `You are a chess engine. Given FEN: ${fen}, return ONLY a legal move in UCI format.`;
  const provider = detectProvider(config.endpoint);

  if (!config.endpoint) {
    return {
      move: null,
      rawResponse: 'NO_ENDPOINT_CONFIGURED',
      error: 'Missing endpoint configuration'
    };
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  let body;

  if (provider === 'anthropic') {
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: config.model || 'claude-3-5-sonnet-latest',
      max_tokens: 32,
      system: 'You are a chess engine. Output exactly one move in UCI format only.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
  } else if (provider === 'ollama') {
    body = {
      model: config.model || 'llama3',
      prompt,
      stream: false
    };
  } else {
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    body = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a chess engine. Output exactly one move in UCI format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 12
    };
  }

  try {
    const response = await axios.post(config.endpoint, body, {
      headers,
      timeout: DEFAULT_TIMEOUT_MS
    });

    const rawText = extractTextFromResponse(response.data).trim();
    const move = normalizeUci(rawText);

    return {
      move,
      rawResponse: rawText,
      error: move ? null : 'Malformed or missing UCI move in response'
    };
  } catch (error) {
    const errorMessage = error?.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    return {
      move: null,
      rawResponse: '',
      error: `Request failed: ${errorMessage}`
    };
  }
}

async function getMoveFromLLM_X(fen) {
  return requestMove('LLM_X', fen);
}

async function getMoveFromLLM_Y(fen) {
  return requestMove('LLM_Y', fen);
}

module.exports = {
  getMoveFromLLM_X,
  getMoveFromLLM_Y,
  normalizeUci
};
