# Seematti Billing Mobile App Build Guide

This guide explains how to build native Android and iOS mobile apps from your Seematti Billing application.

## Prerequisites

### For Android
- **Android Studio** (latest version recommended)
  - Download from: https://developer.android.com/studio
- **Java Development Kit (JDK)** 17 or higher (Required for latest Android Gradle Plugin)
- **Android SDK** (installed with Android Studio)

### For iOS (macOS only)
- **Xcode** 15 or higher
  - Download from Mac App Store
- **CocoaPods** (usually installed with Xcode)
- **Apple Developer Account** (for device testing and App Store distribution)

## Quick Start

### 1. Build Web Assets
First, build your React web application:

```bash
npm run build
```

This creates optimized production files in the `dist` folder.

### 2. Sync to Native Platforms

**Sync to both platforms:**
```bash
npm run build:mobile
```

**Or sync individually:**
```bash
# Android only
npm run sync:android

# iOS only
npm run sync:ios
```

### 3. Open in Native IDE

**Android Studio:**
```bash
npm run open:android
```

**Xcode (macOS only):**
```bash
npm run open:ios
```

## Building for Android

### Development Build (APK)

1. Open the project in Android Studio:
   ```bash
   npm run open:android
   ```

2. Wait for Gradle sync to complete.

3. Connect an Android device or start an emulator.

4. Click **Run** (green play button) or press `Shift + F10`.

### Release Build (Signed APK)

1. **Generate a keystore** (first time only):
   ```bash
   cd android/app
   keytool -genkey -v -keystore seematti-release.keystore -alias seematti -keyalg RSA -keysize 2048 -validity 10000
   ```
   cd
   **IMPORTANT:** Save the keystore password securely! If you lose it, you cannot update the app on the Play Store.

2. **Create `android/key.properties`:**
   Create a file named `key.properties` in the `android` folder (not inside `app`) with the following content:
   ```properties
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=seematti
   storeFile=app/seematti-release.keystore
   ```

3. **Update `android/app/build.gradle`** to add signing config:
   ```gradle
   // Add before android { }
   def keystoreProperties = new Properties()
   def keystorePropertiesFile = rootProject.file('key.properties')
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       // ... existing config ...
       
       signingConfigs {
           release {
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
               storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
               storePassword keystoreProperties['storePassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

4. **Build the release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. **Find your APK:**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

## Building for iOS

### Development Build

1. Open the project in Xcode:
   ```bash
   npm run open:ios
   ```

2. Select a simulator or connected device.

3. Click **Run** (play button) or press `Cmd + R`.

### Release Build (App Store or TestFlight)

1. **Configure signing:**
   - Open project in Xcode.
   - Select the **App** target.
   - Go to **Signing & Capabilities**.
   - Select your **Team** (requires Apple Developer account).
   - Xcode will automatically manage provisioning profiles.

2. **Archive the app:**
   - Select **Product** → **Archive**.
   - Wait for the archive to complete.

3. **Distribute:**
   - In the Organizer window, click **Distribute App**.
   - Choose distribution method:
     - **App Store Connect** (for TestFlight or App Store)
     - **Ad Hoc** (for limited device testing)
     - **Enterprise** (if you have enterprise account)

## App Configuration

### App Metadata
- **App ID:** `freedompos.netlify.app`
- **App Name:** Seematti Billing
- **Version:** Controlled by `android/app/build.gradle` (versionCode/versionName) and Xcode Project settings.

### Permissions
The app uses these permissions (Capacitor plugins handle these):
- **Camera** - For QR code scanning (via `html5-qrcode` / `react-qr-code` if native plugin used).
- **Internet** - For online sync.
- **Storage** - For backup/restore features.
- **Bluetooth** - For thermal printer connection (`web-bluetooth` via Chrome/WebView).

## Update Notes
When you change the React code (e.g. `src/pages/Billing.tsx`):
1.  Run `npm run build`
2.  Run `npx cap sync` to copy `dist` to native folders.
3.  Rebuild/Run from Android Studio/Xcode.

## Prerequisites

### For Android
- **Android Studio** (latest version recommended)
  - Download from: https://developer.android.com/studio
- **Java Development Kit (JDK)** 11 or higher
- **Android SDK** (installed with Android Studio)

### For iOS (macOS only)
- **Xcode** 14 or higher
  - Download from Mac App Store
- **CocoaPods** (usually installed with Xcode)
- **Apple Developer Account** (for device testing and App Store distribution)

## Quick Start

### 1. Build Web Assets
First, build your React web application:

```bash
npm run build
```

This creates optimized production files in the `dist` folder.

### 2. Sync to Native Platforms

**Sync to both platforms:**
```bash
npm run build:mobile
```

**Or sync individually:**
```bash
# Android only
npm run sync:android

# iOS only
npm run sync:ios
```

### 3. Open in Native IDE

**Android Studio:**
```bash
npm run open:android
```

**Xcode (macOS only):**
```bash
npm run open:ios
```

## Building for Android

### Development Build (APK)

1. Open the project in Android Studio:
   ```bash
   npm run open:android
   ```

2. Wait for Gradle sync to complete

3. Connect an Android device or start an emulator

4. Click **Run** (green play button) or press `Shift + F10`

### Release Build (Signed APK)

1. **Generate a keystore** (first time only):
   ```bash
   cd android/app
   keytool -genkey -v -keystore freedompos-release.keystore -alias freedompos -keyalg RSA -keysize 2048 -validity 10000
   ```
   
   Save the keystore password securely!

2. **Create `android/key.properties`:**
   ```properties
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=freedompos
   storeFile=app/freedompos-release.keystore
   ```

3. **Update `android/app/build.gradle`** to add signing config:
   ```gradle
   // Add before android { }
   def keystoreProperties = new Properties()
   def keystorePropertiesFile = rootProject.file('key.properties')
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       // ... existing config ...
       
       signingConfigs {
           release {
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
               storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
               storePassword keystoreProperties['storePassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

4. **Build the release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. **Find your APK:**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

## Building for iOS

### Development Build

1. Open the project in Xcode:
   ```bash
   npm run open:ios
   ```

2. Select a simulator or connected device

3. Click **Run** (play button) or press `Cmd + R`

### Release Build (App Store or TestFlight)

1. **Configure signing:**
   - Open project in Xcode
   - Select the **App** target
   - Go to **Signing & Capabilities**
   - Select your **Team** (requires Apple Developer account)
   - Xcode will automatically manage provisioning profiles

2. **Archive the app:**
   - Select **Product** → **Archive**
   - Wait for the archive to complete

3. **Distribute:**
   - In the Organizer window, click **Distribute App**
   - Choose distribution method:
     - **App Store Connect** (for TestFlight or App Store)
     - **Ad Hoc** (for limited device testing)
     - **Enterprise** (if you have enterprise account)

## App Configuration

### App Metadata
- **App ID:** `com.freedompos.app`
- **App Name:** FreedomPOS
- **Version:** 1.0.0 (Android), 1.0 (iOS)

### Permissions
The app requires these permissions (already configured):
- **Camera** - For QR code scanning
- **Internet** - For online sync (when available)
- **Storage** - For offline data storage

## Troubleshooting

### Android Issues

**Gradle sync failed:**
- Ensure Android SDK is properly installed
- Check internet connection for dependency downloads
- Try: `cd android && ./gradlew clean`

**App crashes on startup:**
- Check `android/app/src/main/AndroidManifest.xml` for proper permissions
- Verify `capacitor.config.ts` matches `build.gradle` app ID

### iOS Issues

**Pod install failed:**
```bash
cd ios/App
pod repo update
pod install
```

**Code signing error:**
- Ensure you're logged into Xcode with your Apple ID
- Check that bundle identifier matches in both Xcode and `capacitor.config.ts`

**App doesn't launch:**
- Clean build folder: **Product** → **Clean Build Folder** (`Cmd + Shift + K`)
- Delete derived data and rebuild

## Updating the App

When you make changes to your web code:

1. Build the web assets:
   ```bash
   npm run build
   ```

2. Sync to native platforms:
   ```bash
   npm run build:mobile
   ```

3. Rebuild in Android Studio or Xcode

## Native Features

Your app includes:
- ✅ Offline-first architecture with IndexedDB
- ✅ QR code scanning
- ✅ Print functionality
- ✅ Google Drive sync
- ✅ Multi-language support (English, Tamil, Hindi)

## Next Steps

- **Test thoroughly** on real devices
- **Set up app icons** (use existing PWA icons)
- **Configure splash screens**
- **Submit to app stores** when ready

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [iOS Developer Guide](https://developer.apple.com/documentation/)
