# Deployment Instructions for Showdown v1.0

## 🚀 Deploy to GitHub and Railway

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click "New Repository" or go to https://github.com/new
3. Repository settings:
   - **Repository name:** `showdown1`
   - **Description:** `Showdown v1.0 - Multiplayer lobby system`
   - **Visibility:** Public
   - **Initialize:** Do NOT initialize with README, .gitignore, or license (we already have these)
4. Click "Create repository"

### Step 2: Push Code to GitHub

Run these commands in your terminal (from the showdown1 directory):

```bash
# Add GitHub remote (replace 'opeus' with your GitHub username if different)
git remote add origin https://github.com/opeus/showdown1.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Railway

1. Go to [Railway](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `opeus/showdown1` repository
5. Railway will automatically detect it's a Node.js/Next.js project
6. Click "Deploy"

### Step 4: Add Railway Database (Optional)

For production data persistence:

1. In your Railway dashboard
2. Click "New" > "Database" > "PostgreSQL"
3. Connect it to your project
4. Railway will provide `DATABASE_URL` environment variable

### Step 5: Configure Environment Variables

In Railway dashboard > Variables tab, add:

```
RAILWAY_PUBLIC_DOMAIN = your-app-name.railway.app
NODE_ENV = production
```

Railway automatically provides:
- `PORT` (for the server)
- `RAILWAY_PUBLIC_DOMAIN` (your app's domain)

### Step 6: Verify Deployment

Your app will be live at `https://your-app-name.railway.app`

Railway automatically:
- Builds with `npm run build`
- Starts with `npm start` (uses our custom server.js)
- Enables WebSocket support for Socket.IO
- Provides health check monitoring

## 🧪 Testing the Deployment

1. **Create Game:**
   - Visit your deployed URL
   - Click "Create Game" tab
   - Enter a nickname and create game
   - Should get unique game code and QR code

2. **Join Game:**
   - Open another browser/device
   - Click "Join Game" tab
   - Enter the game code
   - Enter different nickname
   - Should join the lobby

3. **Test Gameplay:**
   - With 2+ players, host can start rounds
   - Players submit risks in real-time
   - Elimination and results work correctly

4. **QR Code:**
   - Test QR code scanning on mobile device
   - Should auto-fill game code

## 🔧 Local Development

To run locally:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📊 Monitor the App

- **Railway Logs:** View real-time logs in dashboard
- **Railway Metrics:** Monitor CPU, memory, and network usage
- **Health Check:** Visit `/api/health` to check status
- **WebSocket Status:** Socket.IO connections work natively on Railway

## 🚀 Next Steps

Once deployed, you can:
1. Test the full risk/elimination gameplay flow
2. Share the live URL for multiplayer testing
3. Monitor real-time performance
4. Plan Phase 2 features (showdown mechanics, re-entry system)

## 🔧 Railway Benefits

Railway provides:
- **Native WebSocket Support:** Socket.IO works out of the box
- **Automatic Deployments:** Push to GitHub triggers new deployment
- **Built-in Monitoring:** Logs, metrics, and health checks
- **Environment Management:** Easy variable configuration
- **Custom Domains:** Can add your own domain later

---

**Your Showdown v1.0 app with real-time gameplay is ready for Railway deployment! 🎮**