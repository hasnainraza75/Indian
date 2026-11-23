import { createDefaultWeaponsInventory } from '../data/weaponsData';
import { GameSettings, SaveData } from '../types';

declare global {
  interface Window {
    AndroidNativeBridge?: {
      saveData: (slot: string, json: string) => boolean;
      loadData: (slot: string) => string;
      removeData: (slot: string) => boolean;
      vibrate: (durationMs: number) => void;
      setOrientationMode: (mode: string) => void;
      exitApp: () => void;
    };
    __handleAndroidBack?: () => boolean;
  }
}

const SAVE_KEY = 'indian_open_world_3d_save_v1';

export function createDefaultSettings(): GameSettings {
  return {
    graphics: 'medium',
    sound: {
      engine: 0.85,
      environment: 0.7,
      effects: 0.85,
      music: 0.4,
      muted: false
    },
    controls: {
      steeringMode: 'buttons',
      cameraSensitivity: 1.0,
      orientation: 'landscape',
      vibration: true
    },
    autoSave: true
  };
}

export function createNewGameSave(existingSettings?: GameSettings): SaveData {
  return {
    version: 1,
    lastSavedAt: Date.now(),
    playerPos: { x: -130, y: 0.1, z: -116, rotY: 0 },
    health: 100,
    armor: 50,
    money: 25000,
    transactions: [
      {
        id: 'init_wallet',
        label: 'Starting Capital',
        amount: 25000,
        type: 'earn',
        timestamp: Date.now()
      }
    ],
    ownedVehicles: ['bullet', 'ktm_duke', 'thar', 'lamborghini', 'tron_bike', 'rickshaw'],
    vehicleColors: {},
    garageStoredVehicleId: 'lamborghini',
    ownedProperties: ['marina_mansion'],
    completedMissions: [],
    weapons: createDefaultWeaponsInventory(),
    activeWeapon: 'pistol',
    cheatHistory: [],
    activeCheats: {
      infinityHealth: false,
      superJump: false,
      ultraSuperJump: false,
      slowMotion: false,
      moonGravity: false,
      nightMode: false
    },
    timeOfDay: 10.5,
    settings: existingSettings ?? createDefaultSettings()
  };
}

export class SaveSystem {
  static hasSave(slot = 'main'): boolean {
    const raw = this.readRaw(`${SAVE_KEY}_${slot}`);
    return Boolean(raw && raw.length > 10);
  }

  static save(data: SaveData, slot = 'main'): boolean {
    const payload: SaveData = {
      ...data,
      lastSavedAt: Date.now()
    };
    const json = JSON.stringify(payload);
    return this.writeRaw(`${SAVE_KEY}_${slot}`, json);
  }

  static load(slot = 'main'): SaveData | null {
    const raw = this.readRaw(`${SAVE_KEY}_${slot}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const fallback = createNewGameSave();
      return {
        ...fallback,
        ...parsed,
        weapons: { ...fallback.weapons, ...(parsed.weapons ?? {}) },
        activeCheats: { ...fallback.activeCheats, ...(parsed.activeCheats ?? {}) },
        settings: {
          ...fallback.settings,
          ...(parsed.settings ?? {}),
          sound: { ...fallback.settings.sound, ...(parsed.settings?.sound ?? {}) },
          controls: { ...fallback.settings.controls, ...(parsed.settings?.controls ?? {}) }
        }
      };
    } catch {
      return null;
    }
  }

  static clear(slot = 'main'): void {
    const key = `${SAVE_KEY}_${slot}`;
    try {
      if (window.AndroidNativeBridge) {
        window.AndroidNativeBridge.removeData(key);
      }
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }

  static vibrate(ms: number, enabled = true): void {
    if (!enabled) return;
    try {
      if (window.AndroidNativeBridge) {
        window.AndroidNativeBridge.vibrate(ms);
      } else if (navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  }

  static applyOrientation(mode: string): void {
    try {
      if (window.AndroidNativeBridge) {
        window.AndroidNativeBridge.setOrientationMode(mode);
      }
    } catch {
      // ignore
    }
  }

  private static writeRaw(key: string, json: string): boolean {
    try {
      if (window.AndroidNativeBridge) {
        window.AndroidNativeBridge.saveData(key, json);
      }
      localStorage.setItem(key, json);
      return true;
    } catch {
      return false;
    }
  }

  private static readRaw(key: string): string {
    try {
      if (window.AndroidNativeBridge) {
        const nativeVal = window.AndroidNativeBridge.loadData(key);
        if (nativeVal && nativeVal.length > 0) return nativeVal;
      }
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  }
}
