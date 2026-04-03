# ♟️ LLM Chess Arena

A web-based chess game where two LLM (Large Language Model) agents play against each other automatically with real-time updates.

## 🎯 Features

- **Automated Chess Game**: Two LLM agents compete as White and Black
- **Real-time Updates**: Live move updates via Socket.io
- **Beautiful UI**: Modern React-based chessboard with animations
- **Move History**: Complete log of all moves with UCI notation
- **Game Controls**: Start, stop, restart with adjustable speed
- **LLM Integration**: Supports OpenAI, Anthropic Claude, Ollama, or any OpenAI-compatible API
- **Mock Mode**: Works without API keys (uses random legal moves)
- **Game Logging**: Track all LLM decisions and game events

## 🏗️ Tech Stack

### Backend
- Node.js with Express
- chess.js for game logic
- Socket.io for real-time communication
- axios for API calls

### Frontend
- React 18
- Socket.io client
- Custom chessboard UI with Unicode pieces

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

1. **Install dependencies for both server and client:**
```bash
npm run install:all
```

Or manually:
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

2. **Configure environment variables (optional):**
```bash
cp .env.example .env
```

Edit `.env` to add your LLM API keys. Leave empty to use mock mode.

### Running the Application

**Option 1: Run both server and client together (recommended)**
```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Server:
```bash
npm run server
```

Terminal 2 - Client:
```bash
npm run client
```

3. **Open your browser:**
Navigate to `http://localhost:3000`

## 🎮 How to Play

1. Click **Start Game** to begin
2. Watch as two LLM agents compete
3. Use **Restart** to reset the game
4. Use **Stop** to pause the game
5. Adjust game speed: Slow / Normal / Fast / Turbo
6. Set maximum moves to prevent infinite games

## 🔐 LLM Configuration

### Shared OpenAI-Compatible Setup (Recommended)
```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-provider/openai/v1
OPENAI_CHAT_MODELS=Kimi-K2.5,DeepSeek-R1

LLM_X_MODEL=Kimi-K2.5
LLM_Y_MODEL=DeepSeek-R1
```

`LLM_X` and `LLM_Y` automatically reuse `OPENAI_API_KEY` and `OPENAI_BASE_URL` if their dedicated vars are empty.

### Per-Player Override (Optional)
```env
LLM_X_API_KEY=
LLM_X_ENDPOINT=
LLM_X_MODEL=Kimi-K2.5

LLM_Y_API_KEY=
LLM_Y_ENDPOINT=
LLM_Y_MODEL=DeepSeek-R1
```

### Ollama (Local)
```env
LLM1_API_KEY=
LLM1_ENDPOINT=http://localhost:11434/api/generate
LLM1_MODEL=llama2
```

### Mock Mode (Default)
Leave all LLM variables empty to use mock mode (random legal moves).

## 📁 Project Structure

```
chess/
├── server/
│   ├── index.js          # Express server with Socket.io
│   ├── game.js           # Chess game logic and loop
│   └── llmController.js  # LLM API integration
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js        # Main app component
│       ├── index.js      # React entry point
│       ├── components/
│       │   ├── ChessBoard.js
│       │   ├── GameControls.js
│       │   ├── GameStatus.js
│       │   ├── MoveHistory.js
│       │   └── LogPanel.js
│       └── styles/
│           ├── App.css
│           ├── ChessBoard.css
│           ├── GameControls.css
│           ├── GameStatus.css
│           ├── MoveHistory.css
│           └── LogPanel.css
├── .env                  # Environment variables
├── .env.example          # Example env file
└── package.json          # Server dependencies
```

## 🛡️ Error Handling

- **Invalid LLM Responses**: Automatic retry (up to 2 attempts)
- **API Timeouts**: Configurable timeout (default 15s)
- **Fallback**: Random legal move if LLM fails all retries
- **Infinite Loop Prevention**: Max moves limit (configurable)

## ⚡ API Endpoints

- `POST /api/game/start` - Start a new game
- `POST /api/game/restart` - Restart the game
- `POST /api/game/stop` - Stop the game
- `POST /api/game/speed` - Change game speed
- `GET /api/game/state` - Get current game state

## 🔌 Socket.io Events

### Server → Client
- `game_state` - Full game state update
- `move_made` - A move was made
- `game_over` - Game ended
- `turn_start` - New turn started
- `log` - Game log entry

## 🎨 Customization

- Adjust board colors in `ChessBoard.css`
- Modify game speed options in `GameControls.js`
- Change max moves default in components
- Add custom LLM providers in `llmController.js`

## 🐛 Troubleshooting

**Client won't connect to server:**
- Ensure server is running on port 4000
- Check CORS settings in `server/index.js`

**LLM not making moves:**
- Verify API keys in `.env`
- Check server logs for API errors
- Use mock mode by leaving API keys empty

**Board not showing:**
- Ensure game is started
- Check browser console for errors

## 📝 License

MIT

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
# Agent-chess
