# Showdown Game - Next Phase Plan

## 🎯 Game Vision
Transform the current lobby system into a full trivia/quiz game where players compete in real-time to answer questions correctly and quickly.

## 🎮 Game Flow Architecture

### Game States
```
LOBBY → STARTING → QUESTION → ANSWERING → RESULTS → (NEXT_ROUND | GAME_OVER)
```

1. **LOBBY** (✅ Complete)
   - Players join and wait
   - Host can start game when ready

2. **STARTING** (🔄 New)
   - 3-2-1 countdown
   - All players see "Game Starting..." transition

3. **QUESTION** (🔄 New)
   - Display question to all players simultaneously
   - Show question number (e.g., "Question 3 of 10")

4. **ANSWERING** (🔄 New)
   - Players select from multiple choice answers
   - Countdown timer (15-30 seconds)
   - Show who has answered (without revealing answers)

5. **RESULTS** (🔄 New)
   - Reveal correct answer
   - Show player scores for this question
   - Update overall leaderboard
   - Brief pause before next question

6. **GAME_OVER** (🔄 New)
   - Final leaderboard
   - Winner announcement
   - Option to play again

## 🗄️ Data Models

### Extended Game Types
```typescript
interface GameSession {
  id: string;
  code: string;
  status: 'lobby' | 'starting' | 'question' | 'answering' | 'results' | 'game_over';
  hostId: string;
  players: Player[];
  currentQuestionIndex: number;
  questions: Question[];
  gameSettings: GameSettings;
  createdAt: number;
  lastActivity: number;
}

interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  status: 'connected' | 'away' | 'disconnected' | 'left';
  score: number;
  currentAnswer?: string;
  answeredAt?: number;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // index of correct option
  timeLimit: number; // seconds
  category?: string;
}

interface GameSettings {
  questionCount: number;
  timePerQuestion: number;
  categories: string[];
  pointsForCorrect: number;
  speedBonus: boolean;
}
```

## 🎨 UI Design System

### Color Palette
```css
:root {
  --primary: #6366f1;     /* Indigo - main brand */
  --secondary: #8b5cf6;   /* Purple - accent */
  --success: #10b981;     /* Green - correct answers */
  --danger: #ef4444;      /* Red - wrong answers */
  --warning: #f59e0b;     /* Amber - timers/alerts */
  --info: #3b82f6;        /* Blue - info states */
  --dark: #1f2937;        /* Dark gray - text */
  --light: #f9fafb;       /* Light gray - backgrounds */
}
```

### Component System
1. **GameCard** - Main container for game content
2. **QuestionDisplay** - Question text and formatting
3. **AnswerGrid** - Multiple choice answer buttons
4. **TimerBar** - Animated countdown progress bar
5. **ScoreBoard** - Live scoring display
6. **PlayerStatus** - Who has answered indicator
7. **GameTransition** - Smooth state transitions

### Responsive Design
- Mobile-first approach (game is primarily played on phones)
- Large touch targets for answers
- Clear typography for readability
- Proper spacing for thumb navigation

## 🔧 Implementation Plan

### Phase 1: Core Game Engine (Priority: High)
1. **Game State Management**
   - Extend server.js with game state handlers
   - Add state transition logic
   - Implement question progression

2. **Question System**
   - Create question database/data source
   - Implement question selection and rotation
   - Add category filtering

3. **Real-time Synchronization**
   - Sync game state across all players
   - Handle timing synchronization
   - Manage answer submission

### Phase 2: Game UI Components (Priority: High)
1. **Replace Bootstrap with Custom Components**
   - GameLayout component
   - QuestionView component  
   - AnswerSelection component
   - ResultsView component

2. **Add Game-Specific Styling**
   - Custom CSS with game color palette
   - Typography optimized for questions/answers
   - Responsive grid for answer options

3. **Interactive Elements**
   - Animated answer selection
   - Progress indicators
   - Loading states and transitions

### Phase 3: Scoring & Competition (Priority: Medium)
1. **Scoring System**
   - Points for correct answers
   - Speed bonus calculations
   - Running score totals

2. **Leaderboard**
   - Real-time score updates
   - Position changes animations
   - Final rankings

### Phase 4: Polish & Enhancement (Priority: Low)
1. **Animations & Feedback**
   - Answer reveal animations
   - Score increment effects
   - State transition animations

2. **Sound Effects** (Optional)
   - Correct/incorrect answer sounds
   - Timer countdown sounds
   - Winner celebration

## 🗂️ File Structure Changes

```
src/
├── components/
│   ├── game/
│   │   ├── GameLayout.tsx
│   │   ├── QuestionDisplay.tsx
│   │   ├── AnswerGrid.tsx
│   │   ├── TimerBar.tsx
│   │   ├── ScoreBoard.tsx
│   │   └── GameTransition.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Progress.tsx
├── styles/
│   ├── globals.css
│   ├── game.css
│   └── components.css
├── data/
│   └── questions.ts
└── utils/
    ├── gameLogic.ts
    └── scoring.ts
```

## 🚀 Getting Started

The next immediate steps:
1. Create game state data models in types/game.ts
2. Design the core game UI components
3. Implement basic question/answer flow
4. Add real-time state synchronization

This builds on the solid connection foundation we have, extending it into a full multiplayer game experience.