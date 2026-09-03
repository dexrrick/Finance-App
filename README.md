# Antigravity Ledger - Double-Entry Finance Wallet

A modern, local-first finance wallet web application built with **full double-entry accounting logic**, intuitive everyday income & expense tracking with direct debit & credit editing, financial statements, long-term memory backups, Cloudflare Worker synchronization, and interactive financial mini-games.

Deployable with zero configuration to **GitHub Pages** and **Cloudflare Workers / Pages**.

---

## Key Features

### 1. Rigorous Double-Entry Bookkeeping
- Adheres strictly to the foundational accounting equation:
  $$\text{Assets} = \text{Liabilities} + \text{Equity} + \text{Net Income}$$
- Pre-populated, customizable **Chart of Accounts** across all 5 standard categories:
  - **1000s - Assets** (Cash in Hand, Bank Checking, Savings, Digital Wallets, Investments)
  - **2000s - Liabilities** (Credit Cards, Personal Loans)
  - **3000s - Equity** (Opening Balance Equity, Retained Earnings)
  - **4000s - Revenue** (Salary, Freelance, Investment Income, Other)
  - **5000s - Expenses** (Groceries, Dining, Rent, Utilities, Transport, Shopping, Subscriptions)

### 2. Dual-Mode Transaction Entry
- **Standard Everyday Mode**:
  - Intuitive input for **Expense**, **Income**, and **Transfer**.
  - Automatically generates and previews the underlying balanced Debit and Credit legs.
- **Advanced Journal Entry Mode**:
  - One-click toggle to edit raw multi-leg transactions with custom Debit and Credit legs.
  - Real-time balance validation: prevents saving any entry where $\sum \text{Debits} \neq \sum \text{Credits}$.

### 3. Financial Statements & Reports
- **Dashboard**: Net Worth, Total Liquid Assets, Liabilities, Monthly Net Cash Flow, and Equation Health.
- **General Ledger**: Complete searchable audit trail with expandable debit/credit legs and CSV export.
- **Balance Sheet**: Assets vs. Liabilities & Equity with real-time equality check.
- **Income Statement (P&L)**: Categorized revenue vs. expenses with net income calculation.
- **Trial Balance**: Verifies that total debits equal total credits to the penny.

### 4. Long-Term Storage & Backup
- **Local-First**: Runs offline in your browser with zero mandatory sign-up or server setup.
- **Downloadable Backup**: Export your complete wallet history into a standalone `.json` backup file.
- **Restore Anywhere**: Drag-and-drop or select your `.json` file to restore your entire financial history when starting a new day on a new device.
- **Spreadsheet Compatibility**: Export your entire ledger to `.csv` format for Microsoft Excel or Google Sheets.

### 5. Cloudflare Worker Cloud Sync
- Ready-to-deploy Cloudflare Worker script in `worker/index.ts` with KV storage support.
- Push and pull your encrypted or password-protected wallet data to your Cloudflare account in one click.

### 6. Built-in Financial Mini-Games
- **Ledger Balance Challenge**: A speed-run puzzle game where you match incoming financial transactions to their correct Debit and Credit accounts before the timer runs out.
- **Cashflow Tycoon**: A 7-day turn-based strategy simulation where you manage cash, debt, and investments to maximize Net Worth.
- **Gamification**: XP progression, level-ups, and daily streak tracking to encourage disciplined financial habits.

---

## Deployment Guide

### Option A: Host on GitHub Pages
This repository is already configured with an automated GitHub Actions deployment workflow at `.github/workflows/deploy.yml`.

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Antigravity Ledger Wallet"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push any commit to `main`, and your site will be live at `https://<your-username>.github.io/<your-repo-name>/`!

---

### Option B: Deploy Frontend & Worker on Cloudflare

#### 1. Deploy the Static Frontend (Cloudflare Pages)
```bash
npm run build
npx wrangler pages deploy dist --project-name=antigravity-wallet
```

#### 2. Deploy the Cloudflare Worker Backend (Optional for Cloud Sync)
```bash
cd worker
npm install
npx wrangler deploy
```
Copy the generated Worker URL (e.g., `https://antigravity-finance-sync.<your-subdomain>.workers.dev`), open your wallet app, click **Backup & Sync** > **Cloudflare Worker Sync**, paste the URL and your personal secret key, and click **Push to Cloud**!

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
