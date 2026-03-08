# SomomKang - เกมไพ่เล่นออนไลน์

A web-based multiplayer card game for 2-6 players.

## Step 1: UI/UX & Lobby Setup ✅

### Prerequisites

- **Node.js** (v18 or newer) — [Download](https://nodejs.org/)
- A terminal (PowerShell, Command Prompt, or VS Code Terminal)

### Installation & Run

1. **Open a terminal** in the project folder (`c:\SomomKang`).

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**  
   Go to [http://localhost:3000](http://localhost:3000)

### Folder Structure

```
c:\SomomKang\
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Lobby page (home)
│   │   └── game/
│   │       └── page.tsx     # Game board page
│   └── components/
│       ├── Card.tsx         # Playing card with multi-select
│       ├── GameBoard.tsx    # Main game layout
│       └── OpponentAvatar.tsx # Opponent display
├── package.json
├── tailwind.config.ts
└── README.md
```

### What You Can Test (Step 1)

- **Lobby:** Enter username, create or join a room, generate random room ID
- **Game Board:** See draw pile (คว่ำไพ่), discard pile (หงายไพ่), your hand, opponent avatars
- **Multi-Select:** Tap cards to select (pairs, three-of-a-kind); non-matching cards dim automatically
- **Mobile:** Layout is mobile-first; test on phone or browser DevTools

### Next Step

Once Step 1 works on your machine, say **"Proceed to Step 2"** and we’ll add Socket.io and game logic.
