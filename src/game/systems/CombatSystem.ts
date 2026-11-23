import * as THREE from 'three';
import { WEAPONS } from '../data/weaponsData';
import { WeaponId, WeaponInventoryState } from '../types';
import { PlayerController } from './PlayerController';
import { PoliceSystem } from './PoliceSystem';
import { TrafficAndNpcSystem } from './TrafficAndNpcSystem';
import { VehicleSystem } from './VehiclePhysics';

interface VisualTracer {
  mesh: THREE.Mesh;
  life: number;
  isExplosion?: boolean;
}

export class CombatSystem {
  readonly scene: THREE.Scene;
  private tracers: VisualTracer[] = [];
  private lastFireAt = 0;
  reloadTimer = 0;
  isReloading = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  startReload(weaponId: WeaponId, inv: WeaponInventoryState): boolean {
    const def = WEAPONS[weaponId];
    if (def.isMelee || this.isReloading) return false;
    if (inv.magAmmo >= def.magSize || inv.reserveAmmo <= 0) return false;
    this.isReloading = true;
    this.reloadTimer = def.reloadTimeMs / 1000;
    return true;
  }

  update(dt: number, weaponId: WeaponId, inv: WeaponInventoryState): void {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const def = WEAPONS[weaponId];
        const needed = def.magSize - inv.magAmmo;
        const take = Math.min(needed, inv.reserveAmmo);
        inv.magAmmo += take;
        inv.reserveAmmo -= take;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.isExplosion) {
        tr.mesh.scale.addScalar(dt * 12);
      }
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        (tr.mesh.material as THREE.Material).dispose();
        tr.mesh.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  tryFire(
    weaponId: WeaponId,
    inv: WeaponInventoryState,
    player: PlayerController,
    cameraYaw: number,
    isAiming: boolean,
    npcs: TrafficAndNpcSystem,
    police: PoliceSystem,
    vehicles: VehicleSystem,
    inSafeZone: boolean,
    callbacks: {
      onFired: (weapon: WeaponId) => void;
      onAutoReload: () => void;
      onEnemyKilled: (wasHostile: boolean) => void;
      onCrimeCommitted: (stars: number) => void;
      onExplosion: () => void;
    }
  ): boolean {
    if (this.isReloading) return false;
    const def = WEAPONS[weaponId];
    const now = performance.now();
    if (now - this.lastFireAt < def.fireRateMs) return false;

    if (inSafeZone && !def.isMelee) {
      return false;
    }

    if (!def.isMelee) {
      if (inv.magAmmo <= 0) {
        if (this.startReload(weaponId, inv)) {
          callbacks.onAutoReload();
        }
        return false;
      }
      inv.magAmmo--;
    }

    this.lastFireAt = now;
    player.triggerAttackAnim();
    callbacks.onFired(weaponId);

    // Muzzle flash
    if (!def.isMelee) {
      player.rig.muzzleFlash.visible = true;
      setTimeout(() => {
        player.rig.muzzleFlash.visible = false;
      }, 65);
    }

    const yaw = isAiming ? cameraYaw + Math.PI : player.rotY;
    const dir = new THREE.Vector3(
      Math.sin(yaw) + (Math.random() - 0.5) * def.spread,
      0,
      Math.cos(yaw) + (Math.random() - 0.5) * def.spread
    ).normalize();

    const origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.35, player.pos.z);

    let closestDist = def.range;
    let hitPoint = origin.clone().addScaledVector(dir, def.range);
    let hitNpcIdx = -1;
    let hitPoliceIdx = -1;
    let hitVehicleIdx = -1;

    // Check NPC hits
    npcs.npcs.forEach((npc, idx) => {
      if (npc.health <= 0) return;
      const toTarget = new THREE.Vector3(npc.pos.x - origin.x, 0, npc.pos.z - origin.z);
      const proj = toTarget.dot(dir);
      if (proj > 0 && proj < closestDist) {
        const perp = Math.hypot(toTarget.x - dir.x * proj, toTarget.z - dir.z * proj);
        if (perp < (def.isMelee ? 1.35 : 0.85)) {
          closestDist = proj;
          hitPoint = origin.clone().addScaledVector(dir, proj);
          hitNpcIdx = idx;
          hitPoliceIdx = -1;
          hitVehicleIdx = -1;
        }
      }
    });

    // Check Police hits
    police.units.forEach((unit, idx) => {
      if (unit.health <= 0) return;
      const toTarget = new THREE.Vector3(unit.pos.x - origin.x, 0, unit.pos.z - origin.z);
      const proj = toTarget.dot(dir);
      if (proj > 0 && proj < closestDist) {
        const perp = Math.hypot(toTarget.x - dir.x * proj, toTarget.z - dir.z * proj);
        if (perp < (unit.kind === 'officer' ? 0.9 : 2.2)) {
          closestDist = proj;
          hitPoint = origin.clone().addScaledVector(dir, proj);
          hitPoliceIdx = idx;
          hitNpcIdx = -1;
          hitVehicleIdx = -1;
        }
      }
    });

    // Check parked vehicle hits
    if (!def.isMelee) {
      vehicles.vehicles.forEach((veh, idx) => {
        if (veh.occupiedByPlayer || veh.health <= 0) return;
        const toTarget = new THREE.Vector3(veh.pos.x - origin.x, 0, veh.pos.z - origin.z);
        const proj = toTarget.dot(dir);
        if (proj > 0 && proj < closestDist) {
          const perp = Math.hypot(toTarget.x - dir.x * proj, toTarget.z - dir.z * proj);
          if (perp < veh.def.width * 0.7) {
            closestDist = proj;
            hitPoint = origin.clone().addScaledVector(dir, proj);
            hitVehicleIdx = idx;
            hitNpcIdx = -1;
            hitPoliceIdx = -1;
          }
        }
      });
    }

    // Apply damage
    if (hitNpcIdx >= 0) {
      const npc = npcs.npcs[hitNpcIdx];
      npc.health -= def.damage;
      if (npc.health <= 0) {
        callbacks.onEnemyKilled(npc.isHostile);
        if (!npc.isHostile) callbacks.onCrimeCommitted(1);
      } else if (!npc.isHostile) {
        npc.fleeTimer = 6;
        callbacks.onCrimeCommitted(1);
      }
    } else if (hitPoliceIdx >= 0) {
      police.units[hitPoliceIdx].health -= def.damage;
      callbacks.onCrimeCommitted(2);
    } else if (hitVehicleIdx >= 0) {
      vehicles.vehicles[hitVehicleIdx].health = Math.max(0, vehicles.vehicles[hitVehicleIdx].health - def.damage);
      callbacks.onCrimeCommitted(1);
    }

    // Scatter nearby civilians on gunfire
    if (!def.isMelee) {
      npcs.scatterAround(origin, 28);
    }

    // Visual beam / electric arc / explosion
    if (!def.isMelee) {
      const len = Math.max(0.5, origin.distanceTo(hitPoint));
      const beamGeo = new THREE.CylinderGeometry(
        def.isElectric ? 0.08 : 0.035,
        def.isElectric ? 0.08 : 0.035,
        len,
        5
      );
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: def.isElectric ? '#00F0FF' : def.isExplosive ? '#F43F5E' : '#FDE047',
        transparent: true,
        opacity: 0.9
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(origin).lerp(hitPoint, 0.5);
      beam.lookAt(hitPoint);
      this.scene.add(beam);
      this.tracers.push({ mesh: beam, life: def.isElectric ? 0.14 : 0.07 });

      if (def.isExplosive) {
        this.spawnExplosion(hitPoint, npcs, police, callbacks);
      }
    }

    return true;
  }

  private spawnExplosion(
    center: THREE.Vector3,
    npcs: TrafficAndNpcSystem,
    police: PoliceSystem,
    callbacks: { onEnemyKilled: (wasHostile: boolean) => void; onExplosion: () => void; onCrimeCommitted: (s: number) => void }
  ): void {
    callbacks.onExplosion();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#F97316', transparent: true, opacity: 0.85 })
    );
    sphere.position.copy(center);
    this.scene.add(sphere);
    this.tracers.push({ mesh: sphere, life: 0.36, isExplosion: true });

    for (const npc of npcs.npcs) {
      if (npc.health > 0 && npc.pos.distanceTo(center) < 11) {
        npc.health = 0;
        callbacks.onEnemyKilled(npc.isHostile);
      }
    }
    for (const p of police.units) {
      if (p.health > 0 && p.pos.distanceTo(center) < 12) {
        p.health -= 160;
      }
    }
    callbacks.onCrimeCommitted(2);
  }
}
