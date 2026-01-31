# 🚀 Capacitor Setup Guide for RemiderMe

## ✅ Completed Steps

1. ✅ Installed Capacitor Core & CLI
2. ✅ Initialized Capacitor project
3. ✅ Added Android platform
4. ✅ Installed Filesystem plugin
5. ✅ Configured Next.js for static export
6. ✅ Updated Capacitor config

---

## 📱 Next Steps to Build Android App

### Step 1: Build the Next.js App

```bash
npm run build
```

This creates the static export in the `out/` folder.

### Step 2: Add Android Platform

```bash
npx cap add android
```

This creates the `android/` folder with native Android project.

### Step 3: Sync Web Assets to Android

```bash
npx cap sync android
```

This copies your `out/` folder into the Android project.

### Step 4: Open Android Studio

```bash
npx cap open android
```

This will:

- Launch Android Studio
- Load your project
- Allow you to run on emulator or physical device

---

## 🔧 For Folder Monitoring Feature

Since the native filesystem observer plugin doesn't exist, you have two options:

### Option A: Use Background Service (Advanced)

You'll need to create a custom Capacitor plugin:

1. Create plugin: `npx @capacitor/cli plugin:generate`
2. Write native Android code to monitor a folder
3. Use Android's `FileObserver` API
4. Report changes back to JavaScript

**Example Native Code (Java/Kotlin):**

```java
// In your Android plugin
FileObserver observer = new FileObserver(folderPath) {
    @Override
    public void onEvent(int event, String file) {
        if (event == FileObserver.CREATE && file.endsWith(".jpg")) {
            // Notify JavaScript layer
            notifyListeners("newImageDetected", data);
        }
    }
};
observer.startWatching();
```

### Option B: Periodic Check with Capacitor Filesystem

Use the existing `@capacitor/filesystem` plugin with polling:

**Implementation:**

```javascript
import { Filesystem, Directory } from "@capacitor/filesystem";

// Poll every 10 seconds (when app is open)
setInterval(async () => {
  const result = await Filesystem.readdir({
    path: "BankSlips",
    directory: Directory.Documents,
  });

  // Check for new files since last scan
  // Process with OCR
}, 10000);
```

---

## 🎯 Recommended Approach

Since you want **true auto-scanning**, I recommend:

1. **For now:** Start with Option B (polling) - it works immediately
2. **Later:** Build custom native plugin for true background monitoring

---

## 🛠️ Build Commands Reference

```bash
# Development: Build & sync
npm run build && npx cap sync android

# Run on device/emulator
npx cap run android

# Update native code after changing plugins
npx cap sync

# Clean rebuild
npx cap sync android --inline
```

---

## 📦 Required Android Permissions

You'll need to add these to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.CAMERA" />
```

For Android 13+, also add:

```xml
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

---

## 🔍 Troubleshooting

**"Cannot find module '@capacitor/core'"**

- Run: `npm install`

**"webDir does not exist"**

- Run: `npm run build` first

**Android Studio won't open**

- Make sure Android Studio is installed
- Add JAVA_HOME to environment

**APK won't install**

- Check app signing in Android Studio
- Use Debug build for testing

---

## 📲 Testing on Physical Device

1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect phone via USB
4. Run: `npx cap run android --target=<device-id>`
5. Find device ID: `adb devices`

---

## 🎉 Success Criteria

You'll know it's working when:

- ✅ App installs on Android device
- ✅ Camera opens correctly
- ✅ OCR processes receipts
- ✅ All PWA features work
- ✅ Auto-scan detects new files (with polling implementation)

---

## 📝 Notes

- The folder auto-scan will work differently on Android:
  - **Web**: Uses `showDirectoryPicker()`
  - **Android**: Uses Capacitor Filesystem API + polling or native plugin
- You'll need to update `app/page.js` to detect platform and use appropriate API

Would you like me to create the platform-detection code next?
