const { Chess } = require('chess.js');
const {
  getMoveFromLLM_X,
  getMoveFromLLM_Y,
  normalizeUci
} = require('./llmController');

class ChessGame {
  constructor(io, options = {}) {
    this.io = io;
    this.chess = new Chess();

    this.speed = Number.parseInt(options.speed, 10) || 1000;
    this.maxMoves = Number.parseInt(options.maxMoves, 10) || 100;

    this.whitePlayer = options.whitePlayer || 'LLM_X';
    this.blackPlayer = options.blackPlayer || 'LLM_Y';

    this.isRunning = false;
    this.gameOver = false;
    this.winner = null;
    this.reason = null;

    this.moveHistory = [];

    this.loopPromise = null;
    this.loopToken = 0;
    this.turnLock = false;

    this.logDecision('Game initialized', {
      whitePlayer: this.whitePlayer,
      blackPlayer: this.blackPlayer,
      speed: this.speed,
      maxMoves: this.maxMoves
    });
  }

  async start() {
    if (this.isRunning || this.loopPromise) {
      return false;
    }

    this.isRunning = true;
    this.logDecision('Game started', {
      whitePlayer: this.whitePlayer,
      blackPlayer: this.blackPlayer
    });
    this.emitState();

    this.loopPromise = this.runLoop();
    return true;
  }

  stop(reason = 'Stopped by user') {
    this.isRunning = false;
    this.loopToken += 1;
    this.turnLock = false;

    if (!this.gameOver) {
      this.reason = reason;
    }

    this.logDecision('Game stopped', { reason });
    this.emitState();
  }

  setSpeed(speed) {
    const parsed = Number.parseInt(speed, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.speed = parsed;
      this.logDecision('Speed updated', { speed: this.speed });
      this.emitState();
    }
  }

  getCurrentPlayerForTurn() {
    return this.chess.turn() === 'w' ? this.whitePlayer : this.blackPlayer;
  }

  getState() {
    return {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      isRunning: this.isRunning,
      gameOver: this.gameOver,
      winner: this.winner,
      reason: this.reason,
      moveCount: this.moveHistory.length,
      maxMoves: this.maxMoves,
      speed: this.speed,
      whitePlayer: this.whitePlayer,
      blackPlayer: this.blackPlayer,
      moveHistory: [...this.moveHistory],
      board: this.chess.board()
    };
  }

  async runLoop() {
    const activeToken = ++this.loopToken;

    try {
      while (this.isRunning && !this.gameOver && activeToken === this.loopToken) {
        if (this.moveHistory.length >= this.maxMoves) {
          this.endGame(null, 'Max move limit reached');
          break;
        }

        if (this.chess.isGameOver()) {
          const result = this.getGameResult();
          this.endGame(result.winner, result.reason);
          break;
        }

        if (!this.turnLock) {
          await this.executeTurn();
        }

        if (!this.isRunning || this.gameOver || activeToken !== this.loopToken) {
          break;
        }

        await this.delay(this.speed);
      }
    } finally {
      this.loopPromise = null;
      this.turnLock = false;
    }
  }

  async executeTurn() {
    if (this.turnLock || !this.isRunning || this.gameOver) {
      return;
    }

    this.turnLock = true;

    try {
      const fen = this.chess.fen();
      const turnColor = this.chess.turn();
      const playerKey = this.getCurrentPlayerForTurn();
      const legalMoves = this.chess.moves({ verbose: true });
      const legalUciMoves = legalMoves.map((move) => this.toUci(move));

      if (legalUciMoves.length === 0) {
        const result = this.getGameResult();
        this.endGame(result.winner, result.reason || 'No legal moves available');
        return;
      }

      this.io.emit('turn_start', {
        player: playerKey,
        color: turnColor,
        fen,
        legalMoveCount: legalUciMoves.length
      });

      let selection = await this.getValidatedMoveWithRetry({
        fen,
        playerKey,
        legalUciMoves,
        maxRetries: 2
      });

      if (!selection) {
        const fallbackMove =
          legalUciMoves[Math.floor(Math.random() * legalUciMoves.length)];

        selection = {
          move: fallbackMove,
          rawResponse: 'RANDOM_FALLBACK',
          source: 'fallback_random'
        };

        this.logDecision('Using random fallback move', {
          player: playerKey,
          move: fallbackMove
        });
      }

      const appliedMove = this.chess.move(selection.move);

      if (!appliedMove) {
        const fallbackMove =
          legalUciMoves[Math.floor(Math.random() * legalUciMoves.length)];
        const fallbackApplied = this.chess.move(fallbackMove);

        if (!fallbackApplied) {
          this.endGame(null, 'Unable to apply any legal move');
          return;
        }

        this.recordMove(fallbackApplied, {
          playerKey,
          rawResponse: selection.rawResponse,
          source: 'fallback_random_apply_error'
        });
      } else {
        this.recordMove(appliedMove, {
          playerKey,
          rawResponse: selection.rawResponse,
          source: selection.source
        });
      }

      if (this.chess.isGameOver()) {
        const result = this.getGameResult();
        this.endGame(result.winner, result.reason);
      }
    } catch (error) {
      this.logDecision('Turn execution error', {
        error: error.message
      });
    } finally {
      this.turnLock = false;
    }
  }

  async getValidatedMoveWithRetry({ fen, playerKey, legalUciMoves, maxRetries }) {
    const legalSet = new Set(legalUciMoves);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await this.requestMoveFromPlayer(playerKey, fen);

      this.logDecision('LLM response', {
        player: playerKey,
        attempt: attempt + 1,
        rawResponse: response.rawResponse,
        error: response.error || null
      });

      const normalizedMove = normalizeUci(response.move);

      if (normalizedMove && legalSet.has(normalizedMove)) {
        return {
          move: normalizedMove,
          rawResponse: response.rawResponse,
          source: attempt === 0 ? 'llm' : 'llm_retry'
        };
      }

      this.logDecision('Invalid LLM move, retrying', {
        player: playerKey,
        attempt: attempt + 1,
        candidate: normalizedMove,
        legalMoveCount: legalUciMoves.length
      });
    }

    return null;
  }

  async requestMoveFromPlayer(playerKey, fen) {
    if (playerKey === 'LLM_X') {
      return getMoveFromLLM_X(fen);
    }

    return getMoveFromLLM_Y(fen);
  }

  recordMove(move, metadata) {
    const moveRecord = {
      san: move.san,
      uci: this.toUci(move),
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured || null,
      promotion: move.promotion || null,
      player: metadata.playerKey,
      color: move.color,
      source: metadata.source,
      rawResponse: metadata.rawResponse,
      timestamp: Date.now()
    };

    this.moveHistory.push(moveRecord);

    this.logDecision('Move applied', {
      player: metadata.playerKey,
      san: move.san,
      uci: moveRecord.uci,
      source: metadata.source
    });

    this.io.emit('move_made', {
      move: moveRecord,
      fen: this.chess.fen(),
      status: {
        turn: this.chess.turn(),
        moveCount: this.moveHistory.length,
        isGameOver: this.chess.isGameOver()
      }
    });

    this.emitState();
  }

  getGameResult() {
    if (this.chess.isCheckmate()) {
      const winnerColor = this.chess.turn() === 'w' ? 'b' : 'w';
      return {
        winner: winnerColor === 'w' ? this.whitePlayer : this.blackPlayer,
        reason: 'Checkmate'
      };
    }

    if (this.chess.isDraw()) {
      let reason = 'Draw';
      if (this.chess.isStalemate()) reason = 'Stalemate';
      else if (this.chess.isThreefoldRepetition()) reason = 'Threefold repetition';
      else if (this.chess.isInsufficientMaterial()) reason = 'Insufficient material';
      else if (this.chess.isDrawByFiftyMoves()) reason = 'Fifty-move rule';

      return { winner: null, reason };
    }

    return { winner: null, reason: 'Game over' };
  }

  endGame(winner, reason) {
    this.gameOver = true;
    this.isRunning = false;
    this.winner = winner;
    this.reason = reason;
    this.loopToken += 1;

    this.logDecision('Game ended', { winner, reason });
    this.io.emit('game_over', { winner, reason });
    this.emitState();
  }

  emitState() {
    this.io.emit('game_state', this.getState());
  }

  logDecision(message, data) {
    const log = {
      timestamp: new Date().toISOString(),
      message,
      data
    };

    console.log(`[GAME LOG] ${message}`, data ? JSON.stringify(data) : '');
    this.io.emit('log', log);
  }

  toUci(move) {
    if (!move) return null;
    return `${move.from}${move.to}${move.promotion || ''}`;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { ChessGame };
