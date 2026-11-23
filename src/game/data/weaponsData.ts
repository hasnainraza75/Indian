import { WeaponDef, WeaponId, WeaponInventoryState } from '../types';

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fists: {
    id: 'fists',
    name: 'Combat Fists',
    price: 0,
    ammoCost: 0,
    magSize: 0,
    maxReserve: 0,
    damage: 28,
    fireRateMs: 420,
    reloadTimeMs: 0,
    range: 3.2,
    spread: 0,
    recoil: 0.08,
    isMelee: true,
    color: '#F59E0B'
  },
  pistol: {
    id: 'pistol',
    name: '9mm Tactical Pistol',
    price: 800,
    ammoCost: 120,
    magSize: 15,
    maxReserve: 120,
    damage: 34,
    fireRateMs: 260,
    reloadTimeMs: 1100,
    range: 75,
    spread: 0.015,
    recoil: 0.14,
    color: '#94A3B8'
  },
  smg: {
    id: 'smg',
    name: 'Viper Micro SMG',
    price: 2500,
    ammoCost: 240,
    magSize: 32,
    maxReserve: 256,
    damage: 22,
    fireRateMs: 95,
    reloadTimeMs: 1350,
    range: 65,
    spread: 0.035,
    recoil: 0.09,
    color: '#38BDF8'
  },
  rifle: {
    id: 'rifle',
    name: 'Bharat Carbine AR',
    price: 5200,
    ammoCost: 350,
    magSize: 30,
    maxReserve: 240,
    damage: 38,
    fireRateMs: 125,
    reloadTimeMs: 1600,
    range: 115,
    spread: 0.018,
    recoil: 0.16,
    color: '#64748B'
  },
  shotgun: {
    id: 'shotgun',
    name: 'Striker 12G Shotgun',
    price: 4000,
    ammoCost: 300,
    magSize: 8,
    maxReserve: 64,
    damage: 85,
    fireRateMs: 720,
    reloadTimeMs: 1850,
    range: 38,
    spread: 0.075,
    recoil: 0.34,
    color: '#EA580C'
  },
  electric_blaster: {
    id: 'electric_blaster',
    name: 'Volt Arc Disruptor',
    price: 9500,
    ammoCost: 450,
    magSize: 20,
    maxReserve: 160,
    damage: 54,
    fireRateMs: 240,
    reloadTimeMs: 1400,
    range: 95,
    spread: 0.01,
    recoil: 0.12,
    isElectric: true,
    color: '#06B6D4'
  },
  launcher: {
    id: 'launcher',
    name: 'Thunder Pulse Launcher',
    price: 16000,
    ammoCost: 900,
    magSize: 4,
    maxReserve: 24,
    damage: 180,
    fireRateMs: 1250,
    reloadTimeMs: 2300,
    range: 130,
    spread: 0.008,
    recoil: 0.45,
    isExplosive: true,
    color: '#F43F5E'
  }
};

export const WEAPON_ORDER: WeaponId[] = [
  'fists',
  'pistol',
  'smg',
  'rifle',
  'shotgun',
  'electric_blaster',
  'launcher'
];

export function createDefaultWeaponsInventory(): Record<WeaponId, WeaponInventoryState> {
  return {
    fists: { owned: true, magAmmo: 0, reserveAmmo: 0 },
    pistol: { owned: true, magAmmo: 15, reserveAmmo: 90 },
    smg: { owned: false, magAmmo: 32, reserveAmmo: 128 },
    rifle: { owned: false, magAmmo: 30, reserveAmmo: 120 },
    shotgun: { owned: false, magAmmo: 8, reserveAmmo: 32 },
    electric_blaster: { owned: true, magAmmo: 20, reserveAmmo: 80 },
    launcher: { owned: false, magAmmo: 4, reserveAmmo: 12 }
  };
}
