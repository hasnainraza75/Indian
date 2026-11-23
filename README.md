# Indian Open World 3D

A playable, mobile-first 3D open-world action & driving Android game built with **Three.js**, **React**, **TypeScript**, **Vite**, **Capacitor**, and **Kotlin WebView Bridge**.

## Key Features
- **3D Open World Map**: Modern Indian city, rural village, coastal cable-stayed bridge, mountain ghat roads, airport & helipad, petrol pumps, hospital, police station, shopping bazaar, vehicle showroom, and luxury player mansion with walkable interior & garage.
- **60+ Playable Vehicles & Entities**: Royal Enfield Bullet, KTM Duke, Yamaha R15, Ninja H2R, Hayabusa, Ducati, Ghost Rider Bike, Tron Bike, Lamborghini, Bugatti, Ferrari, Fortuner, Thar, Scorpio, Rolls Royce, Supra, Mustang, Auto-Rickshaw, Truck, Tank, JCB, Helicopter, Airplane, Boat, UFO, Dragon, Dinosaurs, RobotAi, and more.
- **Procedural Vehicle & Environment Audio**: Web Audio API synthesized engines, gear shifts, horn, brakes/skids, sirens with Doppler effect, gunfire, weather, and separate Engine / Environment / Effects / Music sliders.
- **Mobile Phone & 85+ Cheat Codes**: Full dial pad, duplicate-code priority/selection dialog, cheat history, and real in-game spawns/effects.
- **Missions, Economy, Police & Save System**: 12 playable story & side missions, persistent wallet & transaction history, 5-star police pursuit & roadblocks, and persistent auto/manual save.

## Development & Android Build

### Local Web Preview
```bash
npm install
npm run dev
```

### Build Android Assets & Debug APK
```bash
npm run build:android
gradle :app:assembleDebug
```
The debug APK is generated at `app/build/outputs/apk/debug/app-debug.apk`.

### Build Release APK / AAB
1. Generate an upload keystore:
   ```bash
   keytool -genkey -v -keystore my-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Export signing environment variables:
   ```bash
   export KEYSTORE_PATH=/path/to/my-upload-key.jks
   export STORE_PASSWORD=your_store_password
   export KEY_PASSWORD=your_key_password
   ```
3. Build release bundle/APK:
   ```bash
   npm run build:android
   gradle :app:assembleRelease :app:bundleRelease
   ```
