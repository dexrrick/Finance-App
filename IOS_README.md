# Finance Ledger - iOS Application

This project contains iOS support for **Finance Ledger**, powered by **Ionic Capacitor 8**.

The exact same React 19 + TypeScript + Tailwind CSS code from `src/` powers both the Android and iOS apps.

---

## Project Details
- **App Name:** Finance Ledger
- **Bundle Identifier:** `com.finance.ledger`
- **Framework:** React 19 + TypeScript + Tailwind CSS v4 + Capacitor 8
- **Native Project:** `ios/App/App.xcodeproj`
- **Package Manager:** Swift Package Manager (SPM)

---

## Development Workflow

### 1. Build and Sync Web Assets to iOS
Whenever you update your code in `src/`, run:
```bash
npm run build:ios
```
This runs `tsc -b && vite build` and then syncs the compiled bundle (`dist/`) directly into the native iOS workspace (`ios/App/App/public`).

---

## Building the iOS App

### Method 1: GitHub Actions (Automated Cloud Build - Recommended for Windows)
Since building iOS apps locally requires a Mac and Xcode, an automated GitHub Actions workflow is set up at `.github/workflows/ios-build.yml`:
1. Push your latest code to GitHub.
2. In your GitHub repository, navigate to the **Actions** tab.
3. Click on the **Build iOS App** workflow.
4. Click **Run workflow** (or simply push to `main` to trigger automatically).
5. Once complete, download the **`ios-unsigned-ipa`** artifact from the build summary.

#### Installing the Unsigned IPA on your iPhone:
You can sideload the generated `.ipa` file onto your iPhone using:
- **[Sideloadly](https://sideloadly.io/)** (Windows & Mac) - Drag and drop the `.ipa`, sign in with your regular Apple ID, and install directly via USB or Wi-Fi.
- **[AltStore](https://altstore.io/)** - Self-host and refresh apps using your personal Apple ID.

---

### Method 2: On a Mac with Xcode
If you have access to a Mac:
1. Clone or copy this repository to the Mac.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the project in Xcode:
   ```bash
   npm run cap:open:ios
   ```
   *(Or open `ios/App/App.xcodeproj` in Xcode directly)*
4. Select an iOS Simulator or your connected iPhone.
5. Click the **Play ▶** button to run!

---

## Project Structure
```
Androidapp/
├── ios/                       # Native iOS Xcode project
│   ├── App/
│   │   ├── App.xcodeproj      # Xcode project configuration
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── Info.plist
│   │   │   └── public/        # Synced web assets from dist/
│   │   └── CapApp-SPM/        # Swift Package Manager plugin dependencies
├── android/                   # Native Android project
├── src/                       # Shared React 19 + TypeScript source code
├── capacitor.config.ts        # Capacitor configuration
└── package.json               # Scripts and dependencies
```
