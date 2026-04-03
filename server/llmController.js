const axios = require('axios');

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.LLM_TIMEOUT || '15000', 10);
const DEFAULT_MAX_TOKENS = Number.parseInt(process.env.LLM_MAX_TOKENS || '512', 10);
const MOVE_REGEX = /([a-h][1-8][a-h][1-8][qrbn]?)/i;
const MOVE_REGEX_GLOBAL = /[a-h][1-8][a-h][1-8][qrbn]?/gi;
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

function extractCandidateMoves(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.toLowerCase().match(MOVE_REGEX_GLOBAL) || [];
  return [...new Set(matches)];
}

function pickLegalCandidate(text, legalMoves) {
  const legalSet = new Set((legalMoves || []).map((move) => String(move).toLowerCase()));
  if (legalSet.size === 0) {
    return normalizeUci(text);
  }

  const candidates = extractCandidateMoves(text);
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (legalSet.has(candidates[i])) {
      return candidates[i];
    }
  }

  return null;
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
    if (Array.isArray(content)) {
      const textPart = content.find((part) => typeof part?.text === 'string');
      if (textPart?.text) {
        return String(textPart.text);
      }
    }
  }

  // Some OpenAI-compatible gateways/models return reasoning content separately.
  if (Array.isArray(data.choices) && data.choices[0]?.message?.reasoning_content) {
    return String(data.choices[0].message.reasoning_content);
  }

  if (Array.isArray(data.choices) && typeof data.choices[0]?.text === 'string') {
    return String(data.choices[0].text);
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

  if (Array.isArray(data.output)) {
    for (const outputItem of data.output) {
      if (Array.isArray(outputItem?.content)) {
        const textPart = outputItem.content.find(
          (part) => part?.type === 'output_text' && typeof part?.text === 'string'
        );
        if (textPart?.text) {
          return String(textPart.text);
        }
      }
    }
  }

  // Avoid returning JSON blobs; it can accidentally match a fake UCI pattern.
  return '';
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

async function requestMove(playerKey, fen, legalMoves = []) {
  const config = getConfigFor(playerKey);
  const legalMovesList = legalMoves.join(', ');
  const prompt = [
    'You are a chess engine.',
    `Position FEN: ${fen}`,
    `Legal moves (UCI): ${legalMovesList}`,
    'Return exactly one move from the legal list in UCI format (example: e2e4).',
    'Output only the move and nothing else.'
  ].join('\n');
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
      system: 'Reply with a single chess move in UCI format (example: e2e4).',
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
      headers['api-key'] = config.apiKey;
    }
    body = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'Reply with a single chess move in UCI format (example: e2e4).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: DEFAULT_MAX_TOKENS
    };
  }

  try {
    const response = await axios.post(config.endpoint, body, {
      headers,
      timeout: DEFAULT_TIMEOUT_MS
    });

    const rawText = extractTextFromResponse(response.data).trim();
    const move = pickLegalCandidate(rawText, legalMoves);

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

async function getMoveFromLLM_X(fen, legalMoves = []) {
  return requestMove('LLM_X', fen, legalMoves);
}

async function getMoveFromLLM_Y(fen, legalMoves = []) {
  return requestMove('LLM_Y', fen, legalMoves);
}

module.exports = {
  getMoveFromLLM_X,
  getMoveFromLLM_Y,
  normalizeUci
};
