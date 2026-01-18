---
description: How to build and run the mobile application
---

# Mobile Application Workflow

This project is configured with [Capacitor](https://capacitorjs.com/) to run as a native mobile application.

## Prerequisites

- **Android Studio**: Required for building and running the Android app.
- **Java Development Kit (JDK) 11+**: Required for Android builds.

## Workflow

### 1. Update Web Application
Whenever you make changes to your React code, you must rebuild the web assets first.

```powershell
npm run build
```

### 2. Sync with Native Projects
Copy the updated web assets to the native Android/iOS projects.

```powershell
npx cap sync
```

### 3. Run on Android
Open the project in Android Studio to run on a simulator or connected device.

```powershell
npx cap open android
```

Alternatively, you can run it directly from the command line if you have a connected device/emulator:
```powershell
npx cap run android
```

## Troubleshooting

- **Local API Config**: If your app connects to a local backend (localhost), remember that `localhost` on the Android emulator refers to the emulator itself, not your computer. Use `10.0.2.2` instead of `localhost`, or use your computer's LAN IP address.
- **Sync Issues**: If native plugins aren't working, try deleting the `android` folder and recreating it:
  ```powershell
  rm -r android
  npx cap add android
  npx cap sync
  ```
