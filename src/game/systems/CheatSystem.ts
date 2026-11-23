import { findCheatsByCode } from '../data/cheatsData';
import { CheatEntry, CheatFlagKey, CheatHistoryItem } from '../types';

export interface CheatExecutionContext {
  spawnVehicleInFront: (vehicleId: string, label: string) => boolean;
  spawnZombieSwarm: () => void;
  toggleFlag: (flag: CheatFlagKey) => boolean;
  activateNightMode: () => void;
  triggerSkyfall: () => void;
  refuelAllVehicles: () => void;
  increasePopulation: (target: 'npc' | 'traffic') => void;
}

export class CheatSystem {
  history: CheatHistoryItem[] = [];
  activeFlags: Record<CheatFlagKey, boolean> = {
    infinityHealth: false,
    superJump: false,
    ultraSuperJump: false,
    slowMotion: false,
    moonGravity: false,
    nightMode: false
  };

  syncFromSave(history: CheatHistoryItem[], flags: Record<CheatFlagKey, boolean>): void {
    this.history = [...history];
    this.activeFlags = { ...flags };
  }

  lookupCode(code: string): CheatEntry[] {
    return findCheatsByCode(code);
  }

  executeCheat(
    entry: CheatEntry,
    ctx: CheatExecutionContext
  ): { ok: boolean; message: string } {
    const eff = entry.effect;
    let ok = false;
    let message = '';

    switch (eff.kind) {
      case 'spawn_vehicle': {
        ok = ctx.spawnVehicleInFront(eff.vehicleId, eff.label);
        message = ok ? `Spawned ${eff.label}!` : `Failed to spawn ${eff.label}`;
        break;
      }
      case 'spawn_zombie': {
        ctx.spawnZombieSwarm();
        ok = true;
        message = 'Zombie Swarm unleashed nearby!';
        break;
      }
      case 'toggle_cheat': {
        const enabled = ctx.toggleFlag(eff.flag);
        this.activeFlags[eff.flag] = enabled;
        ok = true;
        message = `${eff.label} ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`;
        break;
      }
      case 'set_night_mode': {
        ctx.activateNightMode();
        this.activeFlags.nightMode = !this.activeFlags.nightMode;
        ok = true;
        message = this.activeFlags.nightMode ? 'Night Mode ACTIVATED' : 'Daylight Restored';
        break;
      }
      case 'trigger_skyfall': {
        ctx.triggerSkyfall();
        ok = true;
        message = 'Skyfall Activated — Brace for impact!';
        break;
      }
      case 'refuel_all': {
        ctx.refuelAllVehicles();
        ok = true;
        message = 'Fuel Tank Refilled (100%)!';
        break;
      }
      case 'increase_population': {
        ctx.increasePopulation(eff.target);
        ok = true;
        message = eff.target === 'npc' ? 'City NPC density increased!' : 'Highway Traffic increased!';
        break;
      }
    }

    if (ok) {
      this.history.unshift({
        code: entry.code,
        name: entry.name,
        timestamp: Date.now()
      });
      if (this.history.length > 50) {
        this.history.length = 50;
      }
    }

    return { ok, message };
  }
}
