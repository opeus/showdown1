# Showdown v1.0

A multiplayer lobby system for the Showdown card game. This v1.0 focuses on core infrastructure without gameplay mechanics.

## Features

- 🎮 **Create Games** - Host creates game with unique 8-character code
- 📱 **QR Code Sharing** - Easy mobile joining via QR code
- 👥 **Player Management** - Up to 8 players per game
- 🔄 **Real-time Lobby** - Live player list updates (coming in next version)
- 📱 **Mobile Responsive** - Works great on phones and tablets

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **UI:** Bootstrap 5, Bootstrap Icons
- **Backend:** Next.js API Routes
- **Database:** Vercel KV (Redis)
- **Deployment:** Vercel
- **Real-time:** Socket.IO (planned for v1.1)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/opeus/showdown1.git
cd showdown1
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your Vercel KV credentials
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

Create a `.env.local` file with:

```bash
# Vercel KV (get these from Vercel dashboard)
KV_URL="your_kv_url"
KV_REST_API_URL="your_kv_rest_api_url"
KV_REST_API_TOKEN="your_kv_rest_api_token"
KV_REST_API_READ_ONLY_TOKEN="your_kv_rest_api_read_only_token"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Connect repository to Vercel
3. Add Vercel KV database in dashboard
4. Deploy automatically

The app will be available at your Vercel URL.

## API Endpoints

- `POST /api/games/create` - Create new game
- `GET /api/games/[code]` - Get game info by code
- `POST /api/games/[code]/join` - Join game with nickname
- `GET /api/health` - Health check

## Project Structure

```
src/
├── app/                 # Next.js 14 app router
│   ├── api/            # API routes
│   ├── host/           # Host lobby pages
│   ├── game/           # Player lobby pages
│   └── join/           # Direct join page
├── components/         # React components
├── lib/               # Utilities and helpers
└── types/             # TypeScript definitions
```

## Development Roadmap

### v1.0 ✅ (Current)
- [x] Game creation with unique codes
- [x] QR code generation and sharing
- [x] Player joining with validation
- [x] Basic lobby interface
- [x] Mobile-responsive design

### v1.1 (Next)
- [ ] Real-time Socket.IO integration
- [ ] Live player list updates
- [ ] Connection status indicators
- [ ] Basic "Start Game" functionality

### v2.0 (Future)
- [ ] Core gameplay mechanics
- [ ] Risk submission system
- [ ] Elimination logic
- [ ] Points and scoring

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on GitHub or contact the development team.

---

**Showdown v1.0** - Building the foundation for real-time multiplayer gaming 🎮