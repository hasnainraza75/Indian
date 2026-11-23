export type GameScreen =
  | 'main_menu'
  | 'playing'
  | 'paused'
  | 'garage'
  | 'missions'
  | 'map'
  | 'profile'
  | 'settings';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'thunderstorm' | 'fog';
export type SteeringMode = 'buttons' | 'joystick';
export type OrientationMode = 'landscape' | 'auto' | 'portrait';

export interface SoundSettings {
  engine: number;
  environment: number;
  effects: number;
  music: number;
  muted: boolean;
}

export interface ControlSettings {
  steeringMode: SteeringMode;
  cameraSensitivity: number;
  orientation: OrientationMode;
  vibration: boolean;
}

export interface GameSettings {
  graphics: GraphicsQuality;
  sound: SoundSettings;
  controls: ControlSettings;
  autoSave: boolean;
}

export type VehicleCategory =
  | 'motorcycle'
  | 'car'
  | 'suv'
  | 'heavy'
  | 'aircraft'
  | 'watercraft'
  | 'special'
  | 'creature';

export type EngineSoundProfile =
  | 'bullet'
  | 'sport_bike'
  | 'supercar'
  | 'muscle'
  | 'suv'
  | 'diesel'
  | 'electric'
  | 'helicopter'
  | 'plane'
  | 'boat'
  | 'creature'
  | 'silent';

export type VehicleModelShape =
  | 'cruiser_bike'
  | 'sport_bike'
  | 'naked_bike'
  | 'scooter'
  | 'cycle'
  | 'tron_bike'
  | 'ghost_bike'
  | 'supercar'
  | 'hypercar'
  | 'muscle_car'
  | 'luxury_sedan'
  | 'suv'
  | 'thar'
  | 'jeep'
  | 'rickshaw'
  | 'truck'
  | 'truck_trailer'
  | 'fire_truck'
  | 'bus'
  | 'tractor'
  | 'jcb'
  | 'tank'
  | 'monster_truck'
  | 'atv'
  | 'helicopter'
  | 'apache'
  | 'airplane'
  | 'boat'
  | 'ufo'
  | 'balloon'
  | 'jetpack'
  | 'heicarrier'
  | 'bull_kart'
  | 'dragon'
  | 'dinosaur'
  | 'quadruped'
  | 'robot_ai';

export type CameraMode = 'third_person' | 'far' | 'first_person';

export interface VehicleDef {
  id: string;
  name: string;
  category: VehicleCategory;
  price: number;
  topSpeedKmh: number;
  acceleration: number;
  handling: number;
  braking: number;
  suspensionStiffness: number;
  maxFuel: number;
  maxHealth: number;
  primaryColor: string;
  accentColor: string;
  isElectric?: boolean;
  isInvisible?: boolean;
  isSpecial?: boolean;
  isPolice?: boolean;
  canFly?: boolean;
  canFloat?: boolean;
  soundProfile: EngineSoundProfile;
  modelShape: VehicleModelShape;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
}

export type WeaponId =
  | 'fists'
  | 'pistol'
  | 'smg'
  | 'rifle'
  | 'shotgun'
  | 'electric_blaster'
  | 'launcher';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  price: number;
  ammoCost: number;
  magSize: number;
  maxReserve: number;
  damage: number;
  fireRateMs: number;
  reloadTimeMs: number;
  range: number;
  spread: number;
  recoil: number;
  isMelee?: boolean;
  isElectric?: boolean;
  isExplosive?: boolean;
  color: string;
}

export interface WeaponInventoryState {
  owned: boolean;
  magAmmo: number;
  reserveAmmo: number;
}

export interface PropertyDef {
  id: string;
  name: string;
  district: string;
  price: number;
  description: string;
  x: number;
  y: number;
  z: number;
  garageX: number;
  garageY: number;
  garageZ: number;
  spawnRotY: number;
  isStarter?: boolean;
}

export type MissionCategory =
  | 'racing'
  | 'stunt'
  | 'delivery'
  | 'police_escape'
  | 'collection'
  | 'driving'
  | 'time_trial'
  | 'offroad'
  | 'transport'
  | 'combat'
  | 'special';

export interface MissionCheckpoint {
  x: number;
  y: number;
  z: number;
  radius: number;
  label: string;
}

export interface MissionDef {
  id: string;
  order: number;
  title: string;
  category: MissionCategory;
  description: string;
  reward: number;
  bonus: number;
  timeLimitSec: number;
  startX: number;
  startY: number;
  startZ: number;
  suggestedVehicleId?: string;
  minWantedStars?: number;
  targetKills?: number;
  targetAirtimeSec?: number;
  checkpoints: MissionCheckpoint[];
}

export interface ActiveMissionState {
  missionId: string;
  title: string;
  category: MissionCategory;
  objectiveText: string;
  checkpointIndex: number;
  totalCheckpoints: number;
  targetX: number;
  targetZ: number;
  timeRemainingSec: number;
  progress: number;
  killsDone: number;
  killsRequired: number;
  airtimeDone: number;
  airtimeRequired: number;
}

export type CheatEffectType =
  | { kind: 'spawn_vehicle'; vehicleId: string; label: string }
  | { kind: 'spawn_zombie' }
  | { kind: 'toggle_cheat'; flag: CheatFlagKey; label: string }
  | { kind: 'set_night_mode' }
  | { kind: 'trigger_skyfall' }
  | { kind: 'refuel_all' }
  | { kind: 'increase_population'; target: 'npc' | 'traffic' };

export type CheatFlagKey =
  | 'infinityHealth'
  | 'superJump'
  | 'ultraSuperJump'
  | 'slowMotion'
  | 'moonGravity'
  | 'nightMode';

export interface CheatEntry {
  id: string;
  code: string;
  name: string;
  category: 'Vehicle' | 'Bike' | 'Aircraft' | 'Creature' | 'Power' | 'World';
  priority: number;
  effect: CheatEffectType;
}

export interface CheatHistoryItem {
  code: string;
  name: string;
  timestamp: number;
}

export interface TransactionEntry {
  id: string;
  label: string;
  amount: number;
  type: 'earn' | 'spend';
  timestamp: number;
}

export interface SaveData {
  version: number;
  lastSavedAt: number;
  playerPos: { x: number; y: number; z: number; rotY: number };
  health: number;
  armor: number;
  money: number;
  transactions: TransactionEntry[];
  ownedVehicles: string[];
  vehicleColors: Record<string, string>;
  garageStoredVehicleId: string;
  ownedProperties: string[];
  completedMissions: string[];
  weapons: Record<WeaponId, WeaponInventoryState>;
  activeWeapon: WeaponId;
  cheatHistory: CheatHistoryItem[];
  activeCheats: Record<CheatFlagKey, boolean>;
  timeOfDay: number;
  settings: GameSettings;
}

export interface MinimapMarker {
  id: string;
  x: number;
  z: number;
  type: 'police' | 'mission' | 'house' | 'garage' | 'pump' | 'shop' | 'vehicle' | 'waypoint' | 'hostile';
  color: string;
}

export interface HudSnapshot {
  screen: GameScreen;
  health: number;
  maxHealth: number;
  armor: number;
  money: number;
  wantedStars: number;
  wantedCooldown: number;
  zoneName: string;
  inSafeZone: boolean;
  timeOfDay: number;
  weather: WeatherType;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerRotY: number;
  inVehicle: boolean;
  vehicleId: string | null;
  vehicleName: string;
  vehicleCategory: VehicleCategory | null;
  speedKmh: number;
  rpmNormalized: number;
  gear: number;
  fuel: number;
  maxFuel: number;
  vehicleHealth: number;
  vehicleMaxHealth: number;
  isElectric: boolean;
  canFly: boolean;
  isHelicopter: boolean;
  canFloat: boolean;
  heliEngineOn: boolean;
  heliRotorRpm: number;
  heliHover: boolean;
  heliLanding: boolean;
  altitudeM: number;
  airspeedKmh: number;
  cameraMode: CameraMode;
  nitroCharge: number;
  nitroActive: boolean;
  activeWeapon: WeaponId;
  weaponName: string;
  weaponMag: number;
  weaponReserve: number;
  isReloading: boolean;
  isAiming: boolean;
  isSwimming: boolean;
  isCrouching: boolean;
  nearbyVehicleName: string | null;
  nearbyDoorLabel: string | null;
  nearbyPump: boolean;
  nearbyGarageId: string | null;
  nearbyPropertyId: string | null;
  nearbyWeaponShop: boolean;
  nearbyMissionId: string | null;
  activeMission: ActiveMissionState | null;
  missionResult: {
    won: boolean;
    title: string;
    reward: number;
    bonus: number;
    reason: string;
  } | null;
  activeCheats: Record<CheatFlagKey, boolean>;
  markers: MinimapMarker[];
  waypoint: { x: number; z: number } | null;
  fps: number;
  toast: { text: string; kind: 'info' | 'success' | 'warning' | 'cheat' } | null;
  damageFlash: number;
  bustedOrWasted: { kind: 'wasted' | 'busted'; fine: number } | null;
  duplicateCheatPrompt: { code: string; options: CheatEntry[] } | null;
  stuntBanner: string | null;
}
