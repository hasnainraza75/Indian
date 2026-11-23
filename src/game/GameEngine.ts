import * as THREE from 'three';
import { AudioEngine } from './audio/AudioEngine';
import { MISSIONS } from './data/missionsData';
import { PROPERTIES } from './data/propertiesData';
import { VEHICLE_MAP } from './data/vehiclesData';
import { WEAPON_ORDER, WEAPONS } from './data/weaponsData';
import { PhysicsWorld } from './physics/PhysicsWorld';
import {
  CameraMode,
  CheatEntry,
  CheatFlagKey,
  GameScreen,
  GameSettings,
  HudSnapshot,
  MinimapMarker,
  SaveData,
  WeaponId,
  WeatherType
} from './types';
import { WorldBuilder } from './world/WorldBuilder';
import { CameraSystem } from './systems/CameraSystem';
import { CheatSystem } from './systems/CheatSystem';
import { CombatSystem } from './systems/CombatSystem';
import { MissionSystem } from './systems/MissionSystem';
import { PlayerController, PlayerInputState } from './systems/PlayerController';
import { PoliceSystem } from './systems/PoliceSystem';
import { createNewGameSave, SaveSystem } from './systems/SaveSystem';
import { TrafficAndNpcSystem } from './systems/TrafficAndNpcSystem';
import { ActiveVehicle, isHelicopterDef, VehicleInputState, VehicleSystem } from './systems/VehiclePhysics';
import { WalletSystem } from './systems/WalletSystem';

export interface ControlInputBridge {
  moveX: number;
  moveY: number;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  throttle: boolean;
  brakeReverse: boolean;
  steer: number;
  handbrake: boolean;
  nitro: boolean;
  ascend: boolean;
  descend: boolean;
  heliCyclicX: number;
  heliCyclicY: number;
  heliYaw: number;
  heliLand: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private world: WorldBuilder;
  private physics: PhysicsWorld | null = null;
  private cameraSystem: CameraSystem;
  private player: PlayerController;
  private vehicles: VehicleSystem;
  private trafficAndNpcs: TrafficAndNpcSystem;
  private police: PoliceSystem;
  private combat: CombatSystem;
  private missions: MissionSystem;
  private cheats: CheatSystem;
  private wallet: WalletSystem;
  readonly audio: AudioEngine;

  private saveData: SaveData;
  private screen: GameScreen = 'main_menu';
  private activeVehicle: ActiveVehicle | null = null;
  private weather: WeatherType = 'clear';
  private weatherTimer = 95;
  private waypoint: { x: number; z: number } | null = null;
  private damageFlash = 0;
  private stuntBanner: string | null = null;
  private stuntBannerTimer = 0;
  private toast: HudSnapshot['toast'] = null;
  private toastTimer = 0;
  private heliHintCooldown = 0;
  private missionResult: HudSnapshot['missionResult'] = null;
  private bustedOrWasted: HudSnapshot['bustedOrWasted'] = null;
  private duplicateCheatPrompt: HudSnapshot['duplicateCheatPrompt'] = null;

  private keys = new Set<string>();
  private touchInput: ControlInputBridge = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    jump: false,
    crouch: false,
    fire: false,
    aim: false,
    throttle: false,
    brakeReverse: false,
    steer: 0,
    handbrake: false,
    nitro: false,
    ascend: false,
    descend: false,
    heliCyclicX: 0,
    heliCyclicY: 0,
    heliYaw: 0,
    heliLand: false
  };
  private cameraTouchDelta = { x: 0, y: 0, active: false };

  private rafId: number | null = null;
  private lastFrameMs = 0;
  private physicsAccum = 0;
  private readonly FIXED_DT = 1 / 60;
  private hudEmitAccum = 0;
  private autoSaveAccum = 0;
  private fpsCounter = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private elapsedSec = 0;
  private disposed = false;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    const loaded = SaveSystem.load();
    this.saveData = loaded ?? createNewGameSave();

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.saveData.settings.graphics !== 'low',
      powerPreference: 'high-performance'
    });
    this.applyGraphicsQuality(this.saveData.settings.graphics);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.world = new WorldBuilder(this.scene);
    this.world.build(this.saveData.settings.graphics);

    this.cameraSystem = new CameraSystem(
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight)
    );
    this.player = new PlayerController(this.scene);
    this.vehicles = new VehicleSystem(this.scene);
    this.trafficAndNpcs = new TrafficAndNpcSystem(this.scene);
    this.police = new PoliceSystem(this.scene);
    this.combat = new CombatSystem(this.scene);
    this.missions = new MissionSystem(this.scene);
    this.cheats = new CheatSystem();
    this.wallet = new WalletSystem(this.saveData.money, this.saveData.transactions);
    this.audio = new AudioEngine();
    this.audio.applySettings(this.saveData.settings.sound);
    SaveSystem.applyOrientation(this.saveData.settings.controls.orientation);

    this.vehicles.populateInitialWorldVehicles(
      this.world,
      this.saveData.garageStoredVehicleId,
      this.saveData.vehicleColors
    );
    this.trafficAndNpcs.initPopulation();
    this.applySaveToWorld(this.saveData);

    this.bindEvents();
    this.emitHud();
    this.startLoop();
  }

  async initPhysics(): Promise<void> {
    if (this.physics || this.disposed) return;
    const physics = await PhysicsWorld.create(this.world);
    if (this.disposed) {
      physics.free();
      return;
    }
    this.physics = physics;
    this.player.attachPhysics(physics);
    this.vehicles.setPhysicsWorld(physics);
    this.trafficAndNpcs.setPhysicsWorld(physics);
    this.police.setPhysicsWorld(physics);
    this.cameraSystem.setPhysicsWorld(physics);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraSystem.resize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.audio.initOnUserGesture();
    this.keys.add(e.code);
    if (this.screen !== 'playing') return;

    if (e.code === 'KeyF') {
      this.toggleEnterExitVehicle();
    } else if (e.code === 'KeyC') {
      this.cycleCameraMode();
    } else if (e.code === 'KeyG' && this.activeVehicle?.isHelicopter) {
      this.toggleHelicopterEngine();
    } else if (e.code === 'KeyV' && this.activeVehicle?.isHelicopter) {
      this.toggleHelicopterHover();
    } else if (e.code === 'KeyL' && this.activeVehicle?.isHelicopter) {
      this.triggerHelicopterLand();
    } else if (e.code === 'KeyR' && !this.activeVehicle) {
      this.triggerReload();
    } else if (e.code === 'KeyH') {
      this.triggerHorn();
    } else if (e.code === 'KeyE' && !this.activeVehicle) {
      this.cycleWeapon();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private applyGraphicsQuality(quality: GameSettings['graphics']): void {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(
      quality === 'low' ? Math.min(1, dpr) : quality === 'medium' ? Math.min(1.5, dpr) : Math.min(2, dpr)
    );
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  private applySaveToWorld(data: SaveData): void {
    const safeY = Math.max(data.playerPos.y, this.world.getGroundHeight(data.playerPos.x, data.playerPos.z, data.playerPos.y + 1));
    this.player.setPosition(data.playerPos.x, safeY, data.playerPos.z);
    this.player.rotY = data.playerPos.rotY;
    this.player.health = data.health;
    this.player.armor = data.armor;
    this.player.rig.group.rotation.y = this.player.rotY;

    this.wallet.syncFromSave(data.money, data.transactions);
    this.cheats.syncFromSave(data.cheatHistory, data.activeCheats);
    this.cameraSystem.snapBehind(this.player.pos, this.player.rotY);
  }

  // ==================== PUBLIC CONTROLS & UI ACTIONS ====================

  setTouchInput(patch: Partial<ControlInputBridge>): void {
    Object.assign(this.touchInput, patch);
  }

  addCameraDrag(dx: number, dy: number): void {
    this.cameraTouchDelta.x += dx;
    this.cameraTouchDelta.y += dy;
    this.cameraTouchDelta.active = true;
  }

  endCameraDrag(): void {
    this.cameraTouchDelta.active = false;
  }

  cycleCameraMode(): CameraMode {
    const mode = this.cameraSystem.cycleMode();
    const label = mode === 'first_person' ? 'FIRST PERSON VIEW' : mode === 'far' ? 'FAR CHASE VIEW' : '3RD PERSON VIEW';
    this.showToast(`Camera: ${label}`, 'info');
    this.emitHud();
    return mode;
  }

  adjustCameraZoom(delta: number): void {
    this.cameraSystem.adjustZoom(delta);
  }

  toggleHelicopterEngine(): void {
    if (!this.activeVehicle?.isHelicopter) return;
    const on = this.vehicles.toggleHelicopterEngine(this.activeVehicle);
    if (on) {
      this.audio.playEngineStart();
      this.showToast('Helicopter Engine STARTED — Spooling Rotors', 'success');
    } else {
      this.showToast('Helicopter Engine SHUT DOWN', 'warning');
    }
    this.emitHud();
  }

  toggleHelicopterHover(): void {
    if (!this.activeVehicle?.isHelicopter) return;
    const hover = this.vehicles.toggleHelicopterHover(this.activeVehicle);
    this.showToast(hover ? 'Auto-Hover LOCKED' : 'Auto-Hover OFF', 'info');
    this.emitHud();
  }

  triggerHelicopterLand(): void {
    if (!this.activeVehicle?.isHelicopter) return;
    this.vehicles.triggerHelicopterLand(this.activeVehicle);
    this.showToast('Auto-Landing Engaged', 'info');
    this.emitHud();
  }

  setScreen(screen: GameScreen): void {
    this.audio.initOnUserGesture();
    this.screen = screen;
    const paused = screen !== 'playing' && screen !== 'main_menu';
    this.audio.setPaused(screen === 'paused');
    if (paused && this.saveData.settings.autoSave) {
      this.saveGame('auto');
    }
    this.emitHud();
  }

  startNewGame(): void {
    this.audio.initOnUserGesture();
    const fresh = createNewGameSave(this.saveData.settings);
    this.saveData = fresh;
    this.activeVehicle = null;
    this.player.setInVehicle(false);
    this.player.setVisible(true);
    this.police.clearHeat();
    this.missions.abortMission();
    this.vehicles.clearAll();
    this.vehicles.populateInitialWorldVehicles(this.world, fresh.garageStoredVehicleId, fresh.vehicleColors);
    this.applySaveToWorld(fresh);
    SaveSystem.save(fresh);
    this.screen = 'playing';
    this.showToast('Welcome to Indian Open World 3D!', 'success');
    this.emitHud();
  }

  continueGame(): void {
    this.audio.initOnUserGesture();
    const loaded = SaveSystem.load();
    if (loaded) {
      this.saveData = loaded;
      this.applySaveToWorld(loaded);
    }
    this.screen = 'playing';
    this.showToast('Progress loaded!', 'info');
    this.emitHud();
  }

  saveGame(source: 'manual' | 'auto' = 'manual'): void {
    this.saveData.playerPos = {
      x: this.player.pos.x,
      y: this.player.pos.y,
      z: this.player.pos.z,
      rotY: this.player.rotY
    };
    this.saveData.health = Math.round(this.player.health);
    this.saveData.armor = Math.round(this.player.armor);
    this.saveData.money = this.wallet.getBalance();
    this.saveData.transactions = this.wallet.getTransactions();
    this.saveData.cheatHistory = this.cheats.history;
    this.saveData.activeCheats = { ...this.cheats.activeFlags };
    SaveSystem.save(this.saveData);
    if (source === 'manual') {
      this.audio.playUiSuccess(false);
      this.showToast('Game Saved Successfully!', 'success');
    }
  }

  updateSettings(next: GameSettings): void {
    const graphicsChanged = next.graphics !== this.saveData.settings.graphics;
    this.saveData.settings = next;
    this.audio.applySettings(next.sound);
    SaveSystem.applyOrientation(next.controls.orientation);
    if (graphicsChanged) {
      this.applyGraphicsQuality(next.graphics);
    }
    SaveSystem.save(this.saveData);
    this.emitHud();
  }

  toggleEnterExitVehicle(): void {
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      v.occupiedByPlayer = false;
      this.activeVehicle = null;
      this.player.setInVehicle(false);
      this.player.setVisible(true);

      const exitX = v.pos.x + Math.cos(v.rotY) * (v.def.width * 0.75 + 0.9);
      const exitZ = v.pos.z - Math.sin(v.rotY) * (v.def.width * 0.75 + 0.9);
      const exitY = v.isHelicopter && v.altitudeM > 2.5
        ? v.pos.y
        : this.world.getGroundHeight(exitX, exitZ, v.pos.y + 0.5);

      this.player.setPosition(exitX, exitY, exitZ);
      this.showToast(`Exited ${v.def.name}`, 'info');
      this.emitHud();
      return;
    }

    const nearest = this.vehicles.findNearestEnterable(this.player.pos, 4.8);
    if (nearest) {
      this.activeVehicle = nearest;
      nearest.occupiedByPlayer = true;
      this.player.setInVehicle(true);
      if (!nearest.isHelicopter) {
        this.audio.playEngineStart();
      }
      if (nearest.def.isPolice) {
        this.police.addHeat(1);
      }
      this.showToast(
        nearest.isHelicopter
          ? `Boarded ${nearest.def.name} — Press START ENG to fly`
          : `Entered ${nearest.def.name}`,
        'info'
      );
      this.emitHud();
    }
  }

  triggerHorn(): void {
    if (!this.activeVehicle) return;
    const isHeavy = this.activeVehicle.def.category === 'heavy';
    this.audio.playHorn(isHeavy);
    this.trafficAndNpcs.scatterAround(this.activeVehicle.pos, 18);
  }

  triggerReload(): void {
    const w = this.saveData.activeWeapon;
    if (this.combat.startReload(w, this.saveData.weapons[w])) {
      this.audio.playReload();
      this.emitHud();
    }
  }

  cycleWeapon(specific?: WeaponId): void {
    if (specific && this.saveData.weapons[specific]?.owned) {
      this.saveData.activeWeapon = specific;
      this.combat.isReloading = false;
      this.emitHud();
      return;
    }
    const owned = WEAPON_ORDER.filter((id) => this.saveData.weapons[id]?.owned);
    const idx = owned.indexOf(this.saveData.activeWeapon);
    const next = owned[(idx + 1) % owned.length] ?? 'fists';
    this.saveData.activeWeapon = next;
    this.combat.isReloading = false;
    this.emitHud();
  }

  buyWeaponOrAmmo(weaponId: WeaponId): { ok: boolean; msg: string } {
    const def = WEAPONS[weaponId];
    const inv = this.saveData.weapons[weaponId];
    if (!inv.owned) {
      if (!this.wallet.spend(def.price, `Bought ${def.name}`)) {
        return { ok: false, msg: `Need $${def.price.toLocaleString()} for ${def.name}` };
      }
      inv.owned = true;
      inv.magAmmo = def.magSize;
      inv.reserveAmmo = Math.min(def.maxReserve, def.magSize * 4);
      this.saveData.activeWeapon = weaponId;
      this.audio.playUiSuccess(false);
      this.saveGame('auto');
      this.emitHud();
      return { ok: true, msg: `Purchased ${def.name}!` };
    }
    if (def.ammoCost <= 0) return { ok: true, msg: 'Unlimited melee' };
    if (!this.wallet.spend(def.ammoCost, `Ammo: ${def.name}`)) {
      return { ok: false, msg: `Need $${def.ammoCost} for ammo` };
    }
    inv.reserveAmmo = Math.min(def.maxReserve, inv.reserveAmmo + def.magSize * 2);
    this.audio.playUiSuccess(false);
    this.saveGame('auto');
    this.emitHud();
    return { ok: true, msg: `Refilled ${def.name} ammo!` };
  }

  refuelAtPump(): void {
    if (!this.activeVehicle) {
      this.showToast('Drive a vehicle into the pump bay to refuel!', 'warning');
      return;
    }
    const cost = 150;
    if (!this.wallet.spend(cost, `Fuel: ${this.activeVehicle.def.name}`)) {
      this.showToast('Not enough money ($150) for fuel!', 'warning');
      return;
    }
    this.activeVehicle.fuel = this.activeVehicle.def.maxFuel;
    this.activeVehicle.health = this.activeVehicle.def.maxHealth;
    this.audio.playUiSuccess(false);
    this.showToast(`Refueled & repaired ${this.activeVehicle.def.name} (-$150)`, 'success');
    this.emitHud();
  }

  buyOrSpawnVehicle(vehicleId: string, customColor?: string): { ok: boolean; msg: string } {
    const def = VEHICLE_MAP[vehicleId];
    if (!def) return { ok: false, msg: 'Unknown vehicle' };

    const owned = this.saveData.ownedVehicles.includes(vehicleId);
    if (!owned) {
      if (!this.wallet.spend(def.price, `Bought ${def.name}`)) {
        return { ok: false, msg: `Insufficient funds! Need $${def.price.toLocaleString()}` };
      }
      this.saveData.ownedVehicles.push(vehicleId);
    }

    if (customColor) {
      this.saveData.vehicleColors[vehicleId] = customColor;
    }
    this.saveData.garageStoredVehicleId = vehicleId;

    this.spawnVehicleNearPlayer(vehicleId, def.name, customColor ?? this.saveData.vehicleColors[vehicleId]);
    this.audio.playUiSuccess(false);
    this.saveGame('auto');
    this.screen = 'playing';
    this.emitHud();
    return { ok: true, msg: `${def.name} delivered nearby!` };
  }

  buyProperty(propertyId: string): { ok: boolean; msg: string } {
    const prop = PROPERTIES.find((p) => p.id === propertyId);
    if (!prop) return { ok: false, msg: 'Property not found' };
    if (this.saveData.ownedProperties.includes(propertyId)) {
      if (this.activeVehicle) {
        this.vehicles.teleportVehicle(this.activeVehicle, prop.garageX, prop.y + 0.15, prop.garageZ);
        this.player.setPosition(prop.garageX, prop.y + 0.15, prop.garageZ);
      } else {
        this.player.setPosition(prop.garageX, prop.y + 0.15, prop.garageZ);
      }
      this.screen = 'playing';
      this.showToast(`Arrived at ${prop.name}`, 'info');
      this.emitHud();
      return { ok: true, msg: `Teleported to ${prop.name}` };
    }

    if (!this.wallet.spend(prop.price, `Bought ${prop.name}`)) {
      return { ok: false, msg: `Need $${prop.price.toLocaleString()} to buy ${prop.name}` };
    }
    this.saveData.ownedProperties.push(propertyId);
    this.audio.playUiSuccess(false);
    this.saveGame('auto');
    this.emitHud();
    return { ok: true, msg: `Purchased ${prop.name}!` };
  }

  startMission(missionId: string): void {
    const def = this.missions.startMission(missionId);
    if (!def) return;

    this.missionResult = null;
    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle = null;
      this.player.setInVehicle(false);
      this.player.setVisible(true);
    }

    this.player.setPosition(def.startX, def.startY + 0.25, def.startZ);

    if (def.suggestedVehicleId) {
      const veh = this.vehicles.spawnVehicle(
        def.suggestedVehicleId,
        def.startX + 4.2,
        this.world.getGroundHeight(def.startX + 4.2, def.startZ, 2) + 0.2,
        def.startZ,
        0
      );
      if (veh) {
        this.activeVehicle = veh;
        veh.occupiedByPlayer = true;
        this.player.setInVehicle(true);
        if (!veh.isHelicopter) this.audio.playEngineStart();
      }
    }

    if (def.minWantedStars) {
      this.police.addHeat(def.minWantedStars);
    }
    if (def.targetKills && def.checkpoints[0]) {
      this.trafficAndNpcs.spawnMissionHostiles(
        def.checkpoints[0].x,
        def.checkpoints[0].z,
        def.targetKills + 2
      );
    }

    this.cameraSystem.snapBehind(this.player.pos, this.player.rotY);
    this.screen = 'playing';
    this.showToast(`Mission Started: ${def.title}`, 'info');
    this.emitHud();
  }

  abandonMission(): void {
    this.missions.abortMission();
    this.missionResult = null;
    this.emitHud();
  }

  dismissMissionResult(): void {
    this.missionResult = null;
    this.emitHud();
  }

  dialCheatCode(rawCode: string): { status: 'activated' | 'duplicate' | 'invalid'; message: string; options?: CheatEntry[] } {
    const matches = this.cheats.lookupCode(rawCode);
    if (matches.length === 0) {
      return { status: 'invalid', message: `Invalid cheat code: ${rawCode}` };
    }
    if (matches.length > 1) {
      this.duplicateCheatPrompt = { code: rawCode, options: matches };
      this.emitHud();
      return { status: 'duplicate', message: `Select cheat for ${rawCode}`, options: matches };
    }
    const res = this.executeCheatEntry(matches[0]);
    return { status: res.ok ? 'activated' : 'invalid', message: res.message };
  }

  executeCheatEntry(entry: CheatEntry): { ok: boolean; message: string } {
    this.duplicateCheatPrompt = null;
    const res = this.cheats.executeCheat(entry, {
      spawnVehicleInFront: (vehicleId, label) => this.spawnVehicleNearPlayer(vehicleId, label) !== null,
      spawnZombieSwarm: () => this.trafficAndNpcs.spawnZombieSwarm(this.player.pos, 9),
      toggleFlag: (flag: CheatFlagKey) => !this.cheats.activeFlags[flag],
      activateNightMode: () => {
        this.saveData.timeOfDay = this.cheats.activeFlags.nightMode ? 12.0 : 23.0;
      },
      triggerSkyfall: () => {
        if (this.activeVehicle) {
          this.activeVehicle.occupiedByPlayer = false;
          this.activeVehicle = null;
          this.player.setInVehicle(false);
          this.player.setVisible(true);
        }
        this.player.setPosition(this.player.pos.x, 95, this.player.pos.z);
        this.player.vel.set(0, -4, 0);
      },
      refuelAllVehicles: () => {
        for (const v of this.vehicles.vehicles) {
          v.fuel = v.def.maxFuel;
          v.health = v.def.maxHealth;
        }
      },
      increasePopulation: (target) => this.trafficAndNpcs.increasePopulation(target)
    });

    if (res.ok) {
      this.audio.playUiSuccess(true);
      SaveSystem.vibrate(45, this.saveData.settings.controls.vibration);
      this.showToast(`CHEAT: ${res.message}`, 'cheat');
      this.saveGame('auto');
    }
    this.emitHud();
    return res;
  }

  dismissDuplicateCheat(): void {
    this.duplicateCheatPrompt = null;
    this.emitHud();
  }

  setWeather(weather: WeatherType): void {
    this.weather = weather;
    this.showToast(`Weather changed to ${weather.toUpperCase()}`, 'info');
    this.emitHud();
  }

  setTimeOfDay(hour: number): void {
    this.saveData.timeOfDay = ((hour % 24) + 24) % 24;
    this.emitHud();
  }

  setWaypoint(x: number | null, z: number | null): void {
    this.waypoint = x !== null && z !== null ? { x, z } : null;
    this.emitHud();
  }

  private spawnVehicleNearPlayer(vehicleId: string, _label: string, customColor?: string): ActiveVehicle | null {
    const yaw = this.activeVehicle ? this.activeVehicle.rotY : this.player.rotY;
    const def = VEHICLE_MAP[vehicleId];
    const dist = def && isHelicopterDef(def) ? 8.5 : 5.8;
    const sx = THREE.MathUtils.clamp(this.player.pos.x + Math.sin(yaw) * dist, -445, 445);
    const sz = THREE.MathUtils.clamp(this.player.pos.z + Math.cos(yaw) * dist, -445, 445);
    const sy = this.world.getGroundHeight(sx, sz, this.player.pos.y + 3);
    return this.vehicles.spawnVehicle(vehicleId, sx, sy + 0.35, sz, yaw, customColor);
  }

  private showToast(text: string, kind: NonNullable<HudSnapshot['toast']>['kind']): void {
    this.toast = { text, kind };
    this.toastTimer = 3.2;
  }

  // ==================== MAIN SIMULATION LOOP ====================

  private startLoop(): void {
    this.lastFrameMs = performance.now();
    const tick = (nowMs: number) => {
      this.rafId = requestAnimationFrame(tick);
      const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
      this.lastFrameMs = nowMs;

      this.fpsAccum += rawDt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.5) {
        this.fpsCounter = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      if (this.screen === 'main_menu') {
        this.elapsedSec += rawDt;
        const orbitAng = this.elapsedSec * 0.08;
        const camPos = new THREE.Vector3(Math.cos(orbitAng) * 145, 58, Math.sin(orbitAng) * 145);
        this.cameraSystem.camera.position.copy(camPos);
        this.cameraSystem.camera.lookAt(0, 14, 0);
        this.world.update(rawDt, this.saveData.timeOfDay, this.weather, new THREE.Vector3(0, 0, 0));
        this.renderer.render(this.scene, this.cameraSystem.camera);
        return;
      }

      if (this.screen === 'playing') {
        const dt = this.cheats.activeFlags.slowMotion ? rawDt * 0.45 : rawDt;
        this.stepSimulation(dt, rawDt);
      }

      this.renderer.render(this.scene, this.cameraSystem.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stepSimulation(dt: number, realDt: number): void {
    this.elapsedSec += dt;

    if (!this.cheats.activeFlags.nightMode) {
      this.saveData.timeOfDay = (this.saveData.timeOfDay + dt * 0.032) % 24;
    }

    this.weatherTimer -= realDt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 85 + Math.random() * 65;
      const pool: WeatherType[] = ['clear', 'clear', 'cloudy', 'rain', 'thunderstorm', 'fog'];
      this.weather = pool[Math.floor(Math.random() * pool.length)];
    }

    let manualCam = false;
    if (Math.abs(this.cameraTouchDelta.x) > 0.01 || Math.abs(this.cameraTouchDelta.y) > 0.01) {
      this.cameraSystem.addInput(
        this.cameraTouchDelta.x,
        this.cameraTouchDelta.y,
        this.saveData.settings.controls.cameraSensitivity
      );
      this.cameraTouchDelta.x = 0;
      this.cameraTouchDelta.y = 0;
      manualCam = true;
    }

    const kbMoveX =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const kbMoveY =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);

    const playerInSafeZone = this.isPlayerInSafeZone();

    if (Math.hypot(this.player.pos.x - this.world.zones.hospital.x, this.player.pos.z - this.world.zones.hospital.z) < 8) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 18);
    }

    const onDamagePlayer = (dmg: number) => {
      if (this.cheats.activeFlags.infinityHealth || playerInSafeZone) return;
      this.player.applyDamage(dmg);
      this.damageFlash = 0.65;
      if (this.player.health <= 0) {
        this.handleWastedOrBusted('wasted');
      }
    };

    const isAiming = this.touchInput.aim || this.keys.has('KeyK');

    // Fixed Timestep Physics Accumulator (1/60s, max 3 substeps)
    this.physicsAccum = Math.min(this.FIXED_DT * 3, this.physicsAccum + dt);
    const subDt = this.physics ? this.FIXED_DT : dt;
    const iterations = this.physics ? Math.floor(this.physicsAccum / this.FIXED_DT) : 1;
    if (this.physics) {
      this.physicsAccum -= iterations * this.FIXED_DT;
    }

    let lastVehInput: VehicleInputState | null = null;

    for (let step = 0; step < Math.max(1, iterations); step++) {
      // Sync animated doors with Rapier colliders
      if (this.physics) {
        for (const door of this.world.doors) {
          this.physics.setDoorOpen(door.id, door.open);
        }
      }

      if (this.activeVehicle) {
        const v = this.activeVehicle;
        const vehInput: VehicleInputState = {
          throttle: this.touchInput.throttle || this.keys.has('KeyW') || this.keys.has('ArrowUp'),
          brakeReverse: this.touchInput.brakeReverse || this.keys.has('KeyS') || this.keys.has('ArrowDown'),
          steer: Math.abs(this.touchInput.steer) > 0.05 ? this.touchInput.steer : kbMoveX,
          handbrake: this.touchInput.handbrake || this.keys.has('Space'),
          nitro: this.touchInput.nitro || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
          ascend: this.touchInput.ascend || this.keys.has('KeyQ') || this.keys.has('Space'),
          descend: this.touchInput.descend || this.keys.has('KeyZ') || this.keys.has('ControlLeft'),
          heliCyclicX: Math.abs(this.touchInput.heliCyclicX) > 0.05
            ? this.touchInput.heliCyclicX
            : (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0),
          heliCyclicY: Math.abs(this.touchInput.heliCyclicY) > 0.05
            ? this.touchInput.heliCyclicY
            : (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
              (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0),
          heliYaw: Math.abs(this.touchInput.heliYaw) > 0.05
            ? this.touchInput.heliYaw
            : (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
          heliLand: this.touchInput.heliLand
        };
        this.touchInput.heliLand = false;
        lastVehInput = vehInput;

        if (v.isHelicopter && !v.heliEngineOn && vehInput.ascend && this.heliHintCooldown <= 0) {
          this.heliHintCooldown = 2.5;
          this.showToast('Tap ENG button (or G) to start helicopter engine!', 'warning');
        }

        const prevVel = v.vel.clone();
        const prevAirborne = v.airborneTime;
        this.vehicles.prepareVehiclePhysicsStep(v, subDt, vehInput, this.world);
        this.vehicles.stepUnmannedVehicles(subDt, this.world);

        this.trafficAndNpcs.update(subDt, this.player.pos, this.world, playerInSafeZone, onDamagePlayer);
        this.police.update(
          subDt,
          this.player.pos,
          v.speed,
          playerInSafeZone,
          this.world,
          this.elapsedSec,
          onDamagePlayer,
          () => this.handleWastedOrBusted('busted')
        );

        if (this.physics) {
          this.physics.step(subDt);
        }

        this.vehicles.syncPostPhysicsStep(v, subDt, prevVel, vehInput, this.world, this.elapsedSec, (sev) => {
          this.audio.playCollision(sev);
          this.cameraSystem.addShake(sev * 0.45);
          SaveSystem.vibrate(Math.round(sev * 60), this.saveData.settings.controls.vibration);
        });

        if (!v.isHelicopter && !v.def.canFly) {
          if (v.airborneTime > 0.25) {
            this.missions.recordAirtime(subDt);
          } else if (prevAirborne > 1.1) {
            const bonusCash = Math.round(prevAirborne * 150);
            this.wallet.earn(bonusCash, 'Bike/Car Stunt Bonus');
            this.stuntBanner = `STUNT AIRTIME ${prevAirborne.toFixed(1)}s  +$${bonusCash}`;
            this.stuntBannerTimer = 2.8;
          }
        }

        this.player.pos.copy(v.pos);
        this.player.rotY = v.rotY;
        const isFirstPerson = this.cameraSystem.mode === 'first_person';
        this.player.setVisible(!isFirstPerson);
        this.player.rig.group.position.set(
          v.pos.x,
          v.pos.y + (v.def.category === 'motorcycle' ? 0.22 : 0.05),
          v.pos.z
        );
        this.player.rig.group.rotation.y = v.rotY;
        this.player.update(
          subDt,
          { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, crouchToggle: false },
          this.cameraSystem.yaw,
          this.world,
          this.cheats.activeFlags,
          this.saveData.activeWeapon,
          false
        );
      } else {
        const pInput: PlayerInputState = {
          moveX: Math.abs(this.touchInput.moveX) > 0.05 ? this.touchInput.moveX : kbMoveX,
          moveY: Math.abs(this.touchInput.moveY) > 0.05 ? this.touchInput.moveY : kbMoveY,
          sprint: this.touchInput.sprint || this.keys.has('ShiftLeft'),
          jumpPressed: this.touchInput.jump || this.keys.has('Space'),
          crouchToggle: this.touchInput.crouch
        };
        this.touchInput.crouch = false;
        this.touchInput.jump = false;

        this.player.setVisible(this.cameraSystem.mode !== 'first_person');
        this.player.update(
          subDt,
          pInput,
          this.cameraSystem.yaw,
          this.world,
          this.cheats.activeFlags,
          this.saveData.activeWeapon,
          isAiming
        );
        this.vehicles.stepUnmannedVehicles(subDt, this.world);
        this.trafficAndNpcs.update(subDt, this.player.pos, this.world, playerInSafeZone, onDamagePlayer);
        const pSpeed = Math.hypot(this.player.vel.x, this.player.vel.z);
        this.police.update(
          subDt,
          this.player.pos,
          pSpeed,
          playerInSafeZone,
          this.world,
          this.elapsedSec,
          onDamagePlayer,
          () => this.handleWastedOrBusted('busted')
        );

        if (this.physics) {
          this.physics.step(subDt);
        }
      }
    }

    // Audio & Combat (per render frame)
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const throttleOn = lastVehInput?.throttle || v.heliEngineOn || false;
      this.audio.updateVehicleAudio(
        true,
        v.def.soundProfile,
        v.rpmNorm,
        throttleOn,
        v.gear,
        v.skidIntensity,
        v.heliRotorRpm
      );

      if ((this.touchInput.fire || this.keys.has('KeyJ')) && (v.def.id === 'tank' || v.def.id === 'apache')) {
        this.combat.tryFire(
          'launcher',
          { owned: true, magAmmo: 99, reserveAmmo: 99 },
          this.player,
          v.rotY + Math.PI,
          false,
          this.trafficAndNpcs,
          this.police,
          this.vehicles,
          playerInSafeZone,
          {
            onFired: () => this.audio.playWeaponFire('launcher'),
            onAutoReload: () => {},
            onEnemyKilled: (wasHostile) => {
              if (wasHostile) {
                this.missions.recordHostileKill();
                this.wallet.earn(250, 'Hostile Takedown');
              }
            },
            onCrimeCommitted: (stars) => this.police.addHeat(stars),
            onExplosion: () => {
              this.audio.playExplosion();
              this.cameraSystem.addShake(0.45);
            }
          }
        );
      }
    } else {
      this.audio.updateVehicleAudio(false, 'silent', 0, false, 1, 0, 0);
      const wId = this.saveData.activeWeapon;
      this.combat.update(dt, wId, this.saveData.weapons[wId]);
      if (this.touchInput.fire || this.keys.has('KeyJ')) {
        this.combat.tryFire(
          wId,
          this.saveData.weapons[wId],
          this.player,
          this.cameraSystem.yaw,
          isAiming,
          this.trafficAndNpcs,
          this.police,
          this.vehicles,
          playerInSafeZone,
          {
            onFired: (firedW) => {
              this.audio.playWeaponFire(firedW);
              this.cameraSystem.addShake(WEAPONS[firedW].recoil * 0.25);
              SaveSystem.vibrate(22, this.saveData.settings.controls.vibration);
            },
            onAutoReload: () => this.audio.playReload(),
            onEnemyKilled: (wasHostile) => {
              if (wasHostile) {
                this.missions.recordHostileKill();
                this.wallet.earn(200, 'Combat Takedown');
              }
            },
            onCrimeCommitted: (stars) => this.police.addHeat(stars),
            onExplosion: () => {
              this.audio.playExplosion();
              this.cameraSystem.addShake(0.5);
            }
          }
        );
      }
    }

    this.world.update(dt, this.saveData.timeOfDay, this.weather, this.player.pos, () => {
      this.audio.playThunder();
    });

    const nearPolice = this.police.getNearestPoliceTelemetry(this.player.pos);
    this.audio.updateEnvironmentAudio(this.weather, nearPolice.dist, nearPolice.relSpeed, this.elapsedSec);

    const mRes = this.missions.update(dt, this.player.pos, this.police.wantedStars);
    if (mRes.status === 'completed') {
      this.wallet.earn(mRes.reward + mRes.bonus, `Mission: ${mRes.title}`);
      if (!this.saveData.completedMissions.includes(mRes.title)) {
        this.saveData.completedMissions.push(mRes.title);
      }
      this.audio.playUiSuccess(false);
      this.missionResult = {
        won: true,
        title: mRes.title,
        reward: mRes.reward,
        bonus: mRes.bonus,
        reason: mRes.reason
      };
      this.saveGame('auto');
    } else if (mRes.status === 'failed') {
      this.missionResult = {
        won: false,
        title: mRes.title,
        reward: 0,
        bonus: 0,
        reason: mRes.reason
      };
    }

    const isIndoors =
      this.player.pos.x >= -156 &&
      this.player.pos.x <= -134 &&
      this.player.pos.z >= -144 &&
      this.player.pos.z <= -126 &&
      this.player.pos.y < 4.2;

    this.cameraSystem.update(
      realDt,
      this.player.pos,
      this.activeVehicle ? this.activeVehicle.rotY : this.player.rotY,
      Boolean(this.activeVehicle),
      Boolean(this.activeVehicle?.isHelicopter),
      this.activeVehicle ? this.activeVehicle.def.length : 1,
      this.activeVehicle ? this.activeVehicle.def.height : 1.75,
      this.activeVehicle ? Math.abs(this.activeVehicle.speed) * 3.6 : 0,
      isAiming,
      Boolean(this.activeVehicle?.nitroActive),
      isIndoors,
      manualCam || this.cameraTouchDelta.active
    );

    if (this.heliHintCooldown > 0) this.heliHintCooldown = Math.max(0, this.heliHintCooldown - realDt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - realDt * 2.2);
    if (this.toastTimer > 0) {
      this.toastTimer -= realDt;
      if (this.toastTimer <= 0) this.toast = null;
    }
    if (this.stuntBannerTimer > 0) {
      this.stuntBannerTimer -= realDt;
      if (this.stuntBannerTimer <= 0) this.stuntBanner = null;
    }

    if (this.saveData.settings.autoSave) {
      this.autoSaveAccum += realDt;
      if (this.autoSaveAccum >= 25) {
        this.autoSaveAccum = 0;
        this.saveGame('auto');
      }
    }

    this.hudEmitAccum += realDt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private handleWastedOrBusted(kind: 'wasted' | 'busted'): void {
    const fine = Math.min(this.wallet.getBalance(), kind === 'busted' ? 1200 : 800);
    if (fine > 0) {
      this.wallet.spend(fine, kind === 'busted' ? 'Police Bail Fine' : 'Hospital Medical Bill', true);
    }
    this.police.clearHeat();
    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle = null;
      this.player.setInVehicle(false);
      this.player.setVisible(true);
    }
    if (this.missions.activeDef) {
      this.missions.abortMission();
    }

    const spawn = kind === 'busted' ? this.world.zones.policeStation : this.world.zones.hospital;
    this.player.setPosition(spawn.x, 0.25, spawn.z + 14);
    this.player.health = this.player.maxHealth;
    this.player.armor = 25;
    this.bustedOrWasted = { kind, fine };
    this.saveGame('auto');
    this.emitHud();
    setTimeout(() => {
      this.bustedOrWasted = null;
      this.emitHud();
    }, 3200);
  }

  private isPlayerInSafeZone(): boolean {
    const h = this.world.zones.hospital;
    if (Math.hypot(this.player.pos.x - h.x, this.player.pos.z - h.z) < 16) return true;
    const m = this.world.zones.mansionSafeBounds;
    return (
      this.player.pos.x >= m.minX &&
      this.player.pos.x <= m.maxX &&
      this.player.pos.z >= m.minZ &&
      this.player.pos.z <= m.maxZ
    );
  }

  private emitHud(): void {
    const wId = this.saveData.activeWeapon;
    const wDef = WEAPONS[wId];
    const wInv = this.saveData.weapons[wId];

    const nearbyVeh = !this.activeVehicle ? this.vehicles.findNearestEnterable(this.player.pos, 4.8) : null;
    const nearbyDoor = this.world.doors.find((d) => Math.hypot(this.player.pos.x - d.x, this.player.pos.z - d.z) < 4.5);
    const nearbyPump = this.world.zones.petrolPumps.some(
      (p) => Math.hypot(this.player.pos.x - p.x, this.player.pos.z - p.z) < p.radius
    );
    const nearbyGarage = this.world.zones.garages.find(
      (g) => Math.hypot(this.player.pos.x - g.x, this.player.pos.z - g.z) < g.radius
    );
    const nearbyWeaponShop =
      Math.hypot(this.player.pos.x - this.world.zones.weaponShop.x, this.player.pos.z - this.world.zones.weaponShop.z) <
      this.world.zones.weaponShop.radius;
    const nearbyMission = !this.missions.activeDef
      ? MISSIONS.find((m) => Math.hypot(this.player.pos.x - m.startX, this.player.pos.z - m.startZ) < 9)
      : null;

    const markers: MinimapMarker[] = [];
    for (const p of this.police.units) {
      markers.push({ id: p.id, x: p.pos.x, z: p.pos.z, type: 'police', color: '#3B82F6' });
    }
    for (const prop of PROPERTIES) {
      markers.push({
        id: prop.id,
        x: prop.x,
        z: prop.z,
        type: 'house',
        color: this.saveData.ownedProperties.includes(prop.id) ? '#22C55E' : '#FACC15'
      });
    }
    for (const pump of this.world.zones.petrolPumps) {
      markers.push({ id: pump.id, x: pump.x, z: pump.z, type: 'pump', color: '#FB923C' });
    }
    markers.push({
      id: 'armory',
      x: this.world.zones.weaponShop.x,
      z: this.world.zones.weaponShop.z,
      type: 'shop',
      color: '#F43F5E'
    });
    const mState = this.missions.getActiveState();
    if (mState) {
      markers.push({
        id: 'mission_target',
        x: mState.targetX,
        z: mState.targetZ,
        type: 'mission',
        color: '#FACC15'
      });
    }
    if (this.waypoint) {
      markers.push({
        id: 'waypoint',
        x: this.waypoint.x,
        z: this.waypoint.z,
        type: 'waypoint',
        color: '#A855F7'
      });
    }

    this.onHudUpdate({
      screen: this.screen,
      health: Math.round(this.player.health),
      maxHealth: this.player.maxHealth,
      armor: Math.round(this.player.armor),
      money: this.wallet.getBalance(),
      wantedStars: this.police.wantedStars,
      wantedCooldown: Math.ceil(this.police.wantedCooldown),
      zoneName: this.world.getZoneName(this.player.pos.x, this.player.pos.z),
      inSafeZone: this.isPlayerInSafeZone(),
      timeOfDay: this.saveData.timeOfDay,
      weather: this.weather,
      playerX: this.player.pos.x,
      playerY: this.player.pos.y,
      playerZ: this.player.pos.z,
      playerRotY: this.activeVehicle ? this.activeVehicle.rotY : this.player.rotY,
      inVehicle: Boolean(this.activeVehicle),
      vehicleId: this.activeVehicle?.def.id ?? null,
      vehicleName: this.activeVehicle?.def.name ?? '',
      vehicleCategory: this.activeVehicle?.def.category ?? null,
      speedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6) : 0,
      rpmNormalized: this.activeVehicle?.rpmNorm ?? 0,
      gear: this.activeVehicle?.gear ?? 1,
      fuel: this.activeVehicle ? Math.round(this.activeVehicle.fuel) : 100,
      maxFuel: this.activeVehicle?.def.maxFuel ?? 100,
      vehicleHealth: this.activeVehicle ? Math.round(this.activeVehicle.health) : 100,
      vehicleMaxHealth: this.activeVehicle?.def.maxHealth ?? 100,
      isElectric: Boolean(this.activeVehicle?.def.isElectric),
      canFly: Boolean(this.activeVehicle?.def.canFly),
      canFloat: Boolean(this.activeVehicle?.def.canFloat),
      isHelicopter: Boolean(this.activeVehicle?.isHelicopter),
      heliEngineOn: Boolean(this.activeVehicle?.heliEngineOn),
      heliRotorRpm: this.activeVehicle?.heliRotorRpm ?? 0,
      heliHover: Boolean(this.activeVehicle?.heliHover),
      heliLanding: Boolean(this.activeVehicle?.heliAutoLanding),
      altitudeM: this.activeVehicle ? Math.round(this.activeVehicle.altitudeM) : 0,
      airspeedKmh: this.activeVehicle ? Math.round(this.activeVehicle.airspeedMs * 3.6) : 0,
      cameraMode: this.cameraSystem.mode,
      nitroCharge: this.activeVehicle ? Math.round(this.activeVehicle.nitroCharge) : 100,
      nitroActive: Boolean(this.activeVehicle?.nitroActive),
      activeWeapon: wId,
      weaponName: wDef.name,
      weaponMag: wInv.magAmmo,
      weaponReserve: wInv.reserveAmmo,
      isReloading: this.combat.isReloading,
      isAiming: this.touchInput.aim || this.keys.has('KeyK'),
      isSwimming: this.player.isSwimming,
      isCrouching: this.player.isCrouching,
      nearbyVehicleName: nearbyVeh?.def.name ?? null,
      nearbyDoorLabel: nearbyDoor?.label ?? null,
      nearbyPump,
      nearbyGarageId: nearbyGarage?.propertyId ?? null,
      nearbyPropertyId: nearbyGarage?.propertyId ?? null,
      nearbyWeaponShop,
      nearbyMissionId: nearbyMission?.id ?? null,
      activeMission: mState,
      missionResult: this.missionResult,
      activeCheats: { ...this.cheats.activeFlags },
      markers,
      waypoint: this.waypoint,
      fps: this.fpsCounter,
      toast: this.toast,
      damageFlash: this.damageFlash,
      bustedOrWasted: this.bustedOrWasted,
      duplicateCheatPrompt: this.duplicateCheatPrompt,
      stuntBanner: this.stuntBanner
    });
  }

  getSaveSnapshot(): SaveData {
    return {
      ...this.saveData,
      money: this.wallet.getBalance(),
      transactions: this.wallet.getTransactions(),
      cheatHistory: this.cheats.history,
      activeCheats: { ...this.cheats.activeFlags }
    };
  }

  hasExistingSave(): boolean {
    return SaveSystem.hasSave();
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.physics?.free();
    this.physics = null;
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

