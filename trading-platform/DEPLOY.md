# 🚀 How to Put FinanceAI Live on the Internet

**No technical knowledge required.** Follow every step exactly as written.
This guide will give you a permanent link like `https://financeai-trading.onrender.com`
that works on any phone, laptop, or tablet, anywhere in the world.

---

## What You'll Need
- A computer with internet access
- An email address
- About 30–45 minutes
- A credit card (optional — free tier available, but has limitations explained below)

---

## Overview of What We're Doing

Think of it like this:
1. We upload your app to **GitHub** (a free code storage service — like Google Drive for code)
2. We connect GitHub to **Render.com** (a free cloud computer that runs your app 24/7)
3. Render automatically builds and starts your app, giving you a public link

---

# PART 1 — Upload Your Code to GitHub

## Step 1: Create a GitHub Account

1. Open your web browser and go to **https://github.com**
2. Click the big green button that says **"Sign up"**
3. Enter your email address and click **"Continue"**
4. Create a password and click **"Continue"**
5. Type a username (e.g., `johntrader2024`) and click **"Continue"**
6. GitHub will ask you to verify you're human — solve the puzzle
7. Click **"Create account"**
8. GitHub sends a verification email — open it and click the link inside
9. When asked "How many team members will be working with you?" — choose **"Just me"**
10. When asked about features — you can skip by clicking **"Continue"** at the bottom
11. Choose the **Free** plan
12. You now have a GitHub account ✅

---

## Step 2: Create a New Repository (Storage Space)

A "repository" is just a folder on GitHub that holds your app's code.

1. Once logged in to GitHub, look at the top-right corner — click the **"+"** button
2. Click **"New repository"** from the dropdown
3. Fill in the form:
   - **Repository name**: `financeai-trading` (no spaces, use dashes)
   - **Description**: `AI-powered trading platform`
   - **Public or Private**: Click **"Private"** (keeps your code private)
   - Leave everything else unchecked
4. Click the green **"Create repository"** button
5. You'll see a page with some instructions — **don't close this tab**, you'll need it next

---

## Step 3: Install Git on Your Computer

Git is a free tool that lets you upload code to GitHub.

### On Windows:
1. Go to **https://git-scm.com/download/windows**
2. Click the first download link (it will say something like "64-bit Git for Windows")
3. Once downloaded, double-click the installer file
4. Click **"Next"** through all the steps — the default settings are fine
5. Click **"Install"** then **"Finish"**
6. Press the **Windows key**, type `Git Bash`, and press Enter — a black window opens ✅

### On Mac:
1. Press **Command + Space**, type `Terminal`, press Enter — a white window opens
2. Type this exactly and press Enter:
   ```
   git --version
   ```
3. If a dialog box appears asking to install developer tools — click **"Install"** and wait
4. Once done, you have Git ✅

---

## Step 4: Upload Your Code to GitHub

Now we'll tell Git who you are and upload your code.

**Open Git Bash (Windows) or Terminal (Mac)** and type these commands one at a time, pressing Enter after each:

### Tell Git your name and email (use the same email as your GitHub):
```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

### Navigate to the project folder:
```bash
cd /home/user/Healthcare/trading-platform
```
> **Note for Windows users**: Your path will look different, like `cd C:/Users/John/Healthcare/trading-platform`

### Connect to your GitHub repository:
```bash
git remote add origin https://github.com/YOUR-USERNAME/financeai-trading.git
```
> Replace `YOUR-USERNAME` with your actual GitHub username (e.g., `johntrader2024`)

### Upload your code:
```bash
git add .
git commit -m "Initial deployment"
git branch -M main
git push -u origin main
```

GitHub will ask for your username and password:
- **Username**: your GitHub username
- **Password**: this is **NOT your GitHub password** — you need a "Personal Access Token"

### Get a GitHub Personal Access Token:
1. In your browser, go to **https://github.com/settings/tokens/new**
2. In the **"Note"** field type: `financeai-deploy`
3. Set **"Expiration"** to: **No expiration**
4. Under **"Select scopes"**, check the box next to **"repo"** (the first one)
5. Scroll down and click the green **"Generate token"** button
6. GitHub shows you a long code starting with `ghp_` — **copy it immediately** (you won't see it again)
7. Paste this token as your password in the terminal

If it works, you'll see something like:
```
remote: Resolving deltas: 100% (...)
To https://github.com/YOUR-USERNAME/financeai-trading.git
 * [new branch]      main -> main
```

**Your code is now on GitHub** ✅

---

# PART 2 — Deploy to Render.com (Make It Live on the Internet)

## Step 5: Create a Render.com Account

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Click **"GitHub"** to sign up with your GitHub account (easiest)
4. Click **"Authorize Render"**
5. You now have a Render account connected to GitHub ✅

---

## Step 6: Create Your Web Service

1. On the Render dashboard, click the big blue **"New +"** button
2. Click **"Web Service"**
3. Under "Connect a repository", find **`financeai-trading`** in the list and click **"Connect"**
4. Fill in the settings form:

   | Field | What to Enter |
   |-------|--------------|
   | **Name** | `financeai-trading` |
   | **Region** | Pick the one closest to you (US East, Frankfurt, Singapore, etc.) |
   | **Branch** | `main` |
   | **Runtime** | `Docker` |
   | **Instance Type** | See pricing note below |

5. Scroll down to **"Environment Variables"** — click **"Add Environment Variable"** for each:

   | Key | Value |
   |-----|-------|
   | `SECRET_KEY` | Click "Generate" — Render makes one automatically |
   | `DATABASE_URL` | `sqlite+aiosqlite:////app/data/trading.db` |
   | `PAPER_TRADING` | `true` |
   | `INITIAL_BALANCE` | `100000.0` |
   | `MAX_POSITION_SIZE` | `0.10` |
   | `STOP_LOSS_PCT` | `0.05` |
   | `TAKE_PROFIT_PCT` | `0.15` |
   | `DEBUG` | `false` |

6. Click the blue **"Create Web Service"** button at the bottom

---

## Step 7: Wait for the Build

Render will now:
1. Download your code from GitHub
2. Build the React frontend (takes 3–5 minutes)
3. Install Python packages (takes 5–10 minutes)
4. Start the server

You'll see a live log of what's happening. When you see a line that says:
```
INFO:     Application startup complete.
```
...your app is live! 🎉

The build takes about **10–15 minutes** the first time.

---

## Step 8: Get Your Public Link

1. Look at the top of your Render service page
2. You'll see a link like: **`https://financeai-trading.onrender.com`**
3. Click it — your trading platform opens in the browser
4. This link works on **any device, anywhere in the world**

---

## Step 9: Test on Your Phone

1. Open this link on your phone's browser: `https://financeai-trading.onrender.com`
2. You should see the FinanceAI login page
3. Click **"Register"** and create an account
4. You're trading! 📱

---

# PART 3 — Pricing and Plan Options

## Free Plan (Fine for Testing)
- **Cost**: $0/month
- **Limitation**: The app goes to "sleep" after 15 minutes of no visitors
- **Wake-up time**: Takes about 30–60 seconds to wake up when someone visits
- **Good for**: Testing, showing friends, personal use

## Starter Plan (Recommended for Real Use)
- **Cost**: $7/month
- **Benefit**: App stays awake 24/7, instant load times
- **How to upgrade**: On your service page, click "Upgrade" and choose "Starter"

---

# PART 4 — Keeping Your App Updated

Whenever you change your code and want the live website to update:

1. Open Git Bash or Terminal
2. Navigate to your project:
   ```bash
   cd /home/user/Healthcare/trading-platform
   ```
3. Upload the changes:
   ```bash
   git add .
   git commit -m "Update: describe what you changed"
   git push
   ```
4. Render **automatically detects** the push and rebuilds your app within minutes

---

# PART 5 — Troubleshooting

### "The build failed"
- On your Render service page, click **"Logs"** to see what went wrong
- Most common fix: check that all the environment variables were entered correctly

### "I see a blank white page"
- Wait 2 more minutes — the app might still be starting up
- Try hard-refreshing: **Ctrl+Shift+R** (Windows) or **Command+Shift+R** (Mac)

### "It says 503 Service Unavailable"
- The app is asleep (free plan) — wait 30 seconds and refresh the page

### "My data disappeared"
- The free plan doesn't include persistent storage — upgrade to Starter plan
- The Starter plan includes a disk that saves your data between restarts

### "The login isn't working"
- Make sure `SECRET_KEY` is set in your Render environment variables
- Make sure `DATABASE_URL` is set exactly as shown in Step 6

---

# PART 6 — Optional: Add a Custom Domain

If you want `www.mytrading.com` instead of `financeai.onrender.com`:

1. Buy a domain from **https://namecheap.com** (about $10/year)
2. On your Render service page, click **"Settings"** → **"Custom Domains"**
3. Click **"Add Custom Domain"** and follow the instructions
4. Render will guide you step-by-step — it takes about 5 minutes to set up

---

# PART 7 — Security Reminders

- **Never share your `SECRET_KEY`** — it's like a master password
- **PAPER_TRADING is set to `true`** — this means no real money is ever used
- **Your Render dashboard URL** (with the API keys) should only be accessed by you
- If you ever think your account was compromised, go to Render → Settings → Regenerate API key

---

## Summary: What Your Live App Can Do

Once deployed, anyone with your Render link can:
- ✅ Register an account
- ✅ See live simulated market prices (updating every second)
- ✅ Set an investment goal (e.g., deposit $10,000, target 20% return in 30 days)
- ✅ Let the AI agents trade automatically to reach that goal
- ✅ Watch trades happen in real time
- ✅ View their portfolio, positions, and trade history
- ✅ Access from phone, tablet, laptop — any device with a browser

---

*Questions? The app also has API documentation at `https://your-app.onrender.com/api/docs`*
