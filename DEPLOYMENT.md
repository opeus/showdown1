# Deployment Instructions for Showdown v1.0

## 🚀 Deploy to GitHub and Vercel

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

### Step 3: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import `opeus/showdown1` repository
4. Project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
5. Click "Deploy"

### Step 4: Add Vercel KV Database

1. Go to your Vercel dashboard
2. Select your `showdown1` project
3. Go to "Storage" tab
4. Click "Create Database"
5. Select "KV" (Redis-compatible)
6. Name: `showdown1-kv`
7. Click "Create"

Vercel will automatically add these environment variables:
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### Step 5: Add Custom Environment Variables

In Vercel dashboard > Settings > Environment Variables, add:

```
NEXT_PUBLIC_APP_URL = https://your-app-name.vercel.app
NODE_ENV = production
```

### Step 6: Redeploy

After adding environment variables:
1. Go to "Deployments" tab
2. Click "Redeploy" on the latest deployment
3. Your app will be live at `https://your-app-name.vercel.app`

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

3. **QR Code:**
   - Test QR code scanning on mobile device
   - Should auto-fill game code

## 🔧 Local Development

To run locally:

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Vercel KV credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📊 Monitor the App

- **Vercel Analytics:** Enable in project settings
- **Vercel Logs:** View real-time logs in dashboard
- **Health Check:** Visit `/api/health` to check status

## 🚀 Next Steps

Once deployed, you can:
1. Test with multiple users
2. Share the live URL for feedback
3. Monitor usage and performance
4. Plan v1.1 features (real-time Socket.IO)

---

**Your Showdown v1.0 app should be live and ready for testing! 🎮**