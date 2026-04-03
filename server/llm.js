/**
 * LLM Integration Module
 * Handles communication with LLM APIs for move generation
 */

const axios = require('axios');

function buildChatCompletionsEndpoint(baseUrl) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function parseSharedModels() {
  return String(process.env.OPENAI_CHAT_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

class LLMClient {
  constructor(playerColor) {
    this.playerColor = playerColor;
    this.playerName = playerColor === 'white' ? 'LLM White' : 'LLM Black';
    
    // Load configuration from environment variables
    if (playerColor === 'white') {
      this.apiKey = process.env.LLM1_API_KEY || '';
      this.endpoint = process.env.LLM1_ENDPOINT || '';
      this.model = process.env.LLM1_MODEL || '';
    } else {
      this.apiKey = process.env.LLM2_API_KEY || '';
      this.endpoint = process.env.LLM2_ENDPOINT || '';
      this.model = process.env.LLM2_MODEL || '';
    }

    // Shared OpenAI-compatible fallback (prevents accidental mock-mode)
    const sharedApiKey = process.env.OPENAI_API_KEY || '';
    const sharedEndpoint = buildChatCompletionsEndpoint(process.env.OPENAI_BASE_URL);
    const sharedModels = parseSharedModels();
    const defaultWhiteModel =
      sharedModels.find((m) => /kimi/i.test(m)) || sharedModels[0] || 'Kimi-K2.5';
    const defaultBlackModel =
      sharedModels.find((m) => /deepseek-r1/i.test(m)) ||
      sharedModels[sharedModels.length - 1] ||
      'DeepSeek-R1';

    if (!this.apiKey && sharedApiKey) this.apiKey = sharedApiKey;
    if (!this.endpoint && sharedEndpoint) this.endpoint = sharedEndpoint;
    if (!this.model) {
      this.model = playerColor === 'white' ? defaultWhiteModel : defaultBlackModel;
    }
    
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '15000');
    this.requestCount = 0;
  }

  /**
   * Get move from LLM given current board position
   * @param {string} fen - FEN string representing board state
   * @param {Array} legalMoves - Array of legal moves (verbose format from chess.js)
   * @returns {Object} - { move: chess.js move object, raw: raw LLM response }
   */
  async getMove(fen, legalMoves) {
    this.requestCount++;
    
    // Build the prompt
    const prompt = this.buildPrompt(fen, legalMoves);
    
    try {
      // Call LLM API
      const response = await this.callLLMAPI(prompt);
      
      // Parse the response to extract move
      const parsedMove = this.parseMove(response, legalMoves);
      
      return {
        move: parsedMove,
        raw: response
      };
    } catch (error) {
      console.error(`[${this.playerName}] API call error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the prompt for the LLM
   */
  buildPrompt(fen, legalMoves) {
    // Convert legal moves to a readable format
    const legalMovesStr = legalMoves.map(m => m.from + m.to + (m.promotion || '')).join(', ');
    
    return `You are playing a game of chess. You are ${this.playerName}.

Current position (FEN): ${fen}

Legal moves in UCI format: ${legalMovesStr}

Your task: Return ONLY the best legal move in UCI format (e.g., e2e4, g1f3, e7e8q for promotion).
Do NOT include any explanation, reasoning, or additional text.
Return ONLY the move.

Important: 
- You MUST choose from the legal moves listed above
- Return ONLY the move in the exact format: from-square to-square (e.g., e2e4)
- For pawn promotion, add the piece letter (e.g., e7e8q for queen promotion)`;
  }

  /**
   * Call the LLM API
   */
  async callLLMAPI(prompt) {
    // If no API key or endpoint is configured, use mock response
    if (!this.apiKey || !this.endpoint) {
      console.log(`[${this.playerName}] No API configuration, using mock mode`);
      return this.getMockResponse(prompt);
    }

    // Determine API format based on endpoint
    const isOpenAI = this.endpoint.includes('openai') || this.endpoint.includes('api.openai.com');
    const isAnthropic = this.endpoint.includes('anthropic') || this.endpoint.includes('claude');
    const isOllama = this.endpoint.includes('ollama') || this.endpoint.includes('11434');
    
    let headers = {
      'Content-Type': 'application/json'
    };

    let body = {};

    if (isOpenAI || (!isAnthropic && !isOllama)) {
      // OpenAI-compatible format
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      body = {
        model: this.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a chess engine. Return ONLY a chess move in UCI format. No explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 50
      };
    } else if (isAnthropic) {
      // Anthropic Claude format
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: this.model || 'claude-3-sonnet-20240229',
        max_tokens: 50,
        system: 'You are a chess engine. Return ONLY a chess move in UCI format. No explanations.',
        messages: [
          { role: 'user', content: prompt }
        ]
      };
    } else if (isOllama) {
      // Ollama format (local, no auth needed)
      body = {
        model: this.model || 'llama2',
        prompt: prompt,
        stream: false
      };
    }

    try {
      const response = await axios.post(this.endpoint, body, {
        headers,
        timeout: this.timeout
      });

      // Parse response based on API format
      if (isOpenAI || (!isAnthropic && !isOllama)) {
        return response.data.choices[0].message.content.trim();
      } else if (isAnthropic) {
        return response.data.content[0].text.trim();
      } else if (isOllama) {
        return response.data.response.trim();
      }
    } catch (error) {
      console.error(`[${this.playerName}] API request failed: ${error.message}`);
      if (error.response) {
        console.error(`[${this.playerName}] Response status: ${error.response.status}`);
        console.error(`[${this.playerName}] Response data:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Parse LLM response to extract move
   */
  parseMove(response, legalMoves) {
    // Clean up the response
    let cleaned = response.trim().toLowerCase();
    
    // Remove any surrounding quotes, backticks, or extra text
    cleaned = cleaned.replace(/["'`]/g, '');
    
    // Try to find a move pattern (4-5 characters: e2e4, e7e8q)
    const movePattern = /([a-h][1-8][a-h][1-8][qrbn]?)/i;
    const match = cleaned.match(movePattern);
    
    if (match) {
      const uciMove = match[1].toLowerCase();
      
      // Find matching legal move
      const legalMove = legalMoves.find(m => {
        const moveUci = m.from + m.to + (m.promotion || '');
        return moveUci === uciMove;
      });
      
      if (legalMove) {
        return legalMove;
      }
    }
    
    // If no valid move found, return null (game will handle retry)
    console.warn(`[${this.playerName}] Could not parse move from response: "${response}"`);
    return null;
  }

  /**
   * Get mock response for testing without API keys
   */
  getMockResponse(prompt) {
    // Extract legal moves from prompt
    const movesMatch = prompt.match(/Legal moves in UCI format: (.+)$/m);
    let legalMoves = [];
    
    if (movesMatch) {
      legalMoves = movesMatch[1].split(',').map(m => m.trim());
    }
    
    // Pick a random move (mock behavior)
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)] || 'e2e4';
    
    console.log(`[${this.playerName}] Mock response: ${randomMove}`);
    return randomMove;
  }
}

module.exports = { LLMClient };
