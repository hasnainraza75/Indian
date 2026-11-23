import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { createNewGameSave } from './game/systems/SaveSystem';
import { HudSnapshot } from './game/types';
import { GameMenus } from './ui/GameMenus';
import { MobilePhoneModal } from './ui/MobilePhoneModal';
import { TouchControls } from './ui/TouchControls';

const INITIAL_HUD: HudSnapshot = {
  screen: 'main_menu',
  health: 100,
  maxHealth: 100,
  armor: 50,
  money: 25000,
  wantedStars: 0,
  wantedCooldown: 0,
  zoneName: 'Marina Luxury Mansion',
  inSafeZone: true,
  timeOfDay: 10.5,
  weather: 'clear',
  playerX: -130,
  playerY: 0,
  playerZ: -116,
  playerRotY: 0,
  inVehicle: false,
  vehicleId: null,
  vehicleName: '',
  vehicleCategory: null,
  speedKmh: 0,
  rpmNormalized: 0,
  gear: 1,
  fuel: 100,
  maxFuel: 100,
  vehicleHealth: 100,
  vehicleMaxHealth: 100,
  isElectric: false,
  canFly: false,
  canFloat: false,
  isHelicopter: false,
  heliEngineOn: false,
  heliRotorRpm: 0,
  heliHover: false,
  heliLanding: false,
  altitudeM: 0,
  airspeedKmh: 0,
  cameraMode: 'third_person',
  nitroCharge: 100,
  nitroActive: false,
  activeWeapon: 'pistol',
  weaponName: '9mm Tactical Pistol',
  weaponMag: 15,
  weaponReserve: 90,
  isReloading: false,
  isAiming: false,
  isSwimming: false,
  isCrouching: false,
  nearbyVehicleName: null,
  nearbyDoorLabel: null,
  nearbyPump: false,
  nearbyGarageId: null,
  nearbyPropertyId: null,
  nearbyWeaponShop: false,
  nearbyMissionId: null,
  activeMission: null,
  missionResult: null,
  activeCheats: {
    infinityHealth: false,
    superJump: false,
    ultraSuperJump: false,
    slowMotion: false,
    moonGravity: false,
    nightMode: false
  },
  markers: [],
  waypoint: null,
  fps: 60,
  toast: null,
  damageFlash: 0,
  bustedOrWasted: null,
  duplicateCheatPrompt: null,
  stuntBanner: null
};

export const App: React.FC = () => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const engine = new GameEngine(el, (snap) => {
      setHud(snap);
    });
    engineRef.current = engine;

    let cancelled = false;
    const minSplash = new Promise((r) => window.setTimeout(r, 450));
    Promise.all([engine.initPhysics(), minSplash]).then(() => {
      if (!cancelled) setLoading(false);
    });

    const onLifecycle = (e: Event) => {
      const detail = (e as CustomEvent<{ state: string }>).detail;
      if (!detail) return;
      if (detail.state === 'pause') {
        engine.saveGame('auto');
        engine.audio.setPaused(true);
        if (engine.getSaveSnapshot() && hudScreenRef.current === 'playing') {
          engine.setScreen('paused');
        }
      } else if (detail.state === 'resume') {
        if (hudScreenRef.current === 'playing') {
          engine.audio.setPaused(false);
        }
      }
    };
    window.addEventListener('android-lifecycle', onLifecycle);

    return () => {
      cancelled = true;
      window.removeEventListener('android-lifecycle', onLifecycle);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const hudScreenRef = useRef(hud.screen);
  hudScreenRef.current = hud.screen;

  // Hardware Android Back Button integration
  useEffect(() => {
    window.__handleAndroidBack = () => {
      const eng = engineRef.current;
      if (!eng) return false;
      if (phoneOpen) {
        setPhoneOpen(false);
        return true;
      }
      if (hud.screen === 'playing') {
        eng.setScreen('paused');
        return true;
      }
      if (
        hud.screen === 'paused' ||
        hud.screen === 'garage' ||
        hud.screen === 'missions' ||
        hud.screen === 'map' ||
        hud.screen === 'profile' ||
        hud.screen === 'settings'
      ) {
        eng.setScreen('playing');
        return true;
      }
      if (hud.screen === 'main_menu') {
        window.AndroidNativeBridge?.exitApp();
        return true;
      }
      return false;
    };
  }, [phoneOpen, hud.screen]);

  const engine = engineRef.current;
  const saveSnap = engine ? engine.getSaveSnapshot() : createNewGameSave();

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#090D16' }}>
      {/* 3D WebGL Canvas Mount */}
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Initial Loading Splash */}
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: '#090D16',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 1,
              background: 'linear-gradient(135deg, #F97316, #38BDF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            INDIAN OPEN WORLD 3D
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
            Loading City, Vehicles, Audio & Physics...
          </div>
        </div>
      )}

      {/* Active Gameplay HUD & Touch Controls */}
      {hud.screen === 'playing' && engine && (
        <TouchControls
          hud={hud}
          steeringMode={saveSnap.settings.controls.steeringMode}
          onInput={(patch) => engine.setTouchInput(patch)}
          onCameraDrag={(dx, dy) => engine.addCameraDrag(dx, dy)}
          onCameraEnd={() => engine.endCameraDrag()}
          onCycleCamera={() => engine.cycleCameraMode()}
          onZoomCamera={(delta) => engine.adjustCameraZoom(delta)}
          onToggleHeliEngine={() => engine.toggleHelicopterEngine()}
          onToggleHeliHover={() => engine.toggleHelicopterHover()}
          onTriggerHeliLand={() => engine.triggerHelicopterLand()}
          onEnterExit={() => engine.toggleEnterExitVehicle()}
          onHorn={() => engine.triggerHorn()}
          onReload={() => engine.triggerReload()}
          onCycleWeapon={() => engine.cycleWeapon()}
          onRefuel={() => engine.refuelAtPump()}
          onOpenPhone={() => setPhoneOpen(true)}
          onOpenMap={() => engine.setScreen('map')}
          onOpenPause={() => engine.setScreen('paused')}
          onOpenGarage={() => engine.setScreen('garage')}
          onOpenArmory={() => engine.setScreen('profile')}
          onStartMission={(id) => engine.startMission(id)}
        />
      )}

      {/* In-Game Mobile Phone & Cheats Overlay */}
      {engine && (
        <MobilePhoneModal
          isOpen={phoneOpen}
          onClose={() => setPhoneOpen(false)}
          onDial={(code) => engine.dialCheatCode(code)}
          onSelectDuplicate={(entry) => engine.executeCheatEntry(entry)}
          duplicatePrompt={hud.duplicateCheatPrompt}
          onDismissDuplicate={() => engine.dismissDuplicateCheat()}
          cheatHistory={saveSnap.cheatHistory}
          weather={hud.weather}
          onChangeWeather={(w) => engine.setWeather(w)}
          timeOfDay={hud.timeOfDay}
          onChangeTime={(h) => engine.setTimeOfDay(h)}
        />
      )}

      {/* Menus (Main, Pause, Garage, Missions, Map, Profile, Settings) */}
      {engine && (
        <GameMenus
          screen={hud.screen}
          hasSave={engine.hasExistingSave()}
          hud={hud}
          saveSnapshot={saveSnap}
          onNavigate={(s) => engine.setScreen(s)}
          onNewGame={() => engine.startNewGame()}
          onContinue={() => engine.continueGame()}
          onSaveGame={() => engine.saveGame('manual')}
          onResetSave={() => engine.startNewGame()}
          onUpdateSettings={(s) => engine.updateSettings(s)}
          onBuyOrSpawnVehicle={(id, col) => engine.buyOrSpawnVehicle(id, col)}
          onStartMission={(id) => engine.startMission(id)}
          onAbortMission={() => engine.abandonMission()}
          onBuyProperty={(id) => engine.buyProperty(id)}
          onBuyWeaponOrAmmo={(id) => engine.buyWeaponOrAmmo(id)}
          onSetWaypoint={(x, z) => engine.setWaypoint(x, z)}
          onExitApp={() => window.AndroidNativeBridge?.exitApp()}
        />
      )}

      {/* Mission Completion / Failure Overlay */}
      {hud.missionResult && engine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: 'min(380px, 90vw)',
              borderRadius: 20,
              padding: 20,
              textAlign: 'center',
              border: `2px solid ${hud.missionResult.won ? '#22C55E' : '#EF4444'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: hud.missionResult.won ? '#4ADE80' : '#F87171'
              }}
            >
              {hud.missionResult.won ? 'MISSION PASSED!' : 'MISSION FAILED'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{hud.missionResult.title}</div>
            <div style={{ fontSize: 12, color: '#CBD5E1' }}>{hud.missionResult.reason}</div>
            {hud.missionResult.won && (
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#FACC15' }}>
                +${(hud.missionResult.reward + hud.missionResult.bonus).toLocaleString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => engine.dismissMissionResult()}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0EA5E9',
                  color: '#0F172A',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Continue
              </button>
              {!hud.missionResult.won && (
                <button
                  type="button"
                  onClick={() => {
                    engine.dismissMissionResult();
                    engine.setScreen('missions');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#F97316',
                    color: '#0F172A',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Busted / Wasted Banner */}
      {hud.bustedOrWasted && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: 4,
              color: hud.bustedOrWasted.kind === 'wasted' ? '#EF4444' : '#3B82F6'
            }}
          >
            {hud.bustedOrWasted.kind.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700 }}>
            {hud.bustedOrWasted.kind === 'busted'
              ? `Released from Police HQ · Bail -$${hud.bustedOrWasted.fine}`
              : `Discharged from City Hospital · Bill -$${hud.bustedOrWasted.fine}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
