# Finance Ledger - Android Application

This folder contains the standalone Android application for **Finance Ledger** (a double-entry accounting wallet) powered by **Ionic Capacitor**.

## Project Details
- **App Name:** Finance Ledger
- **Package ID:** `com.finance.ledger`
- **Framework:** React 19 + TypeScript + Tailwind CSS v4 + Capacitor
- **Android Target:** Android API 34+ (minSdk 22)

---

## Getting Started & Workflow

### 1. Build & Sync Web Assets to Android
Whenever you modify files in `src/`, compile and sync the assets into the native Android folder:
```bash
npm run build:android
```
Or separately:
```bash
npm run build
npm run cap:sync
```

### 2. Open in Android Studio
To open the native Android project in Android Studio:
```bash
npm run cap:open
```
Or manually open the folder `E:\androidapp\android` inside Android Studio.

---

## Building the APK / App Bundle

### Option A: Via Android Studio (Recommended)
1. Open the `E:\androidapp\android` project in **Android Studio**.
2. Let Gradle sync and download any required SDK platforms.
3. To test:
   - Select an Android Virtual Device (AVD Emulator) or plug in a physical Android phone via USB (with Developer Options & USB Debugging enabled).
   - Click the green **Run ▶** button.
4. To build a standalone APK:
   - Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Once completed, Android Studio will display a notification with a link to locate the generated `app-debug.apk`.
5. To build a release signed bundle for Google Play:
   - Go to **Build** > **Generate Signed Bundle / APK...**.
   - Follow the wizard to sign the `.aab` bundle with your release keystore.

### Option B: Via Command Line (Gradle Wrapper)
*Requires Java Development Kit (JDK 17 or 21) and Android SDK configured in your system environment variables.*

Open a terminal in `E:\androidapp\android`:
```bash
# On Windows (PowerShell or CMD):
.\gradlew.bat assembleDebug
```
The output APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## Project Structure
```
androidapp/
├── android/                   # Native Android Studio project (Gradle, manifests, Java)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/finance/ledger/MainActivity.java
│   │   │   ├── res/          # App icons, splash screens, strings
│   │   │   └── assets/public # Compiled web assets
│   │   └── build.gradle
│   └── build.gradle
├── capacitor.config.ts        # Capacitor configuration
├── src/                       # React 19 + TypeScript source code
├── public/                    # Static assets & icons
└── package.json               # Node scripts and dependencies
```
