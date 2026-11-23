import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { VEHICLE_MAP } from '../data/vehiclesData';
import { CharacterRig, createCharacterRig, createVehicleRig, VehicleRig } from '../entities/MeshFactory';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { WorldBuilder } from '../world/WorldBuilder';

export interface PoliceChaser {
  id: string;
  kind: 'officer' | 'car' | 'bike' | 'heli';
  pos: THREE.Vector3;
  rotY: number;
  speed: number;
  health: number;
  fireCooldown: number;
  charRig?: CharacterRig;
  vehRig?: VehicleRig;
  body?: RAPIER.RigidBody;
}

export class PoliceSystem {
  readonly scene: THREE.Scene;
  readonly units: PoliceChaser[] = [];

  private physics: PhysicsWorld | null = null;
  wantedStars = 0;
  wantedCooldown = 0; // seconds until star decays
  bustedTimer = 0;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, physics?: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics ?? null;
  }

  setPhysicsWorld(physics: PhysicsWorld): void {
    this.physics = physics;
  }

  addHeat(starsToAdd: number): void {
    this.wantedStars = Math.min(5, Math.max(this.wantedStars, starsToAdd));
    this.wantedCooldown = 22;
  }

  escalateHeat(): void {
    this.wantedStars = Math.min(5, this.wantedStars + 1);
    this.wantedCooldown = 25;
  }

  clearHeat(): void {
    this.wantedStars = 0;
    this.wantedCooldown = 0;
    this.bustedTimer = 0;
    for (const u of this.units) {
      if (u.charRig) this.scene.remove(u.charRig.group);
      if (u.vehRig) this.scene.remove(u.vehRig.group);
      if (u.body && this.physics) this.physics.removeBody(u.body);
    }
    this.units.length = 0;
  }

  getNearestPoliceTelemetry(playerPos: THREE.Vector3): { dist: number; relSpeed: number } {
    let bestDist = 9999;
    let relSpeed = 0;
    for (const u of this.units) {
      const d = u.pos.distanceTo(playerPos);
      if (d < bestDist) {
        bestDist = d;
        relSpeed = u.speed;
      }
    }
    return { dist: bestDist, relSpeed };
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerSpeedMs: number,
    playerInSafeZone: boolean,
    world: WorldBuilder,
    timeSec: number,
    onDamagePlayer: (dmg: number) => void,
    onBusted: () => void
  ): void {
    if (this.wantedStars <= 0) {
      if (this.units.length > 0) this.clearHeat();
      return;
    }

    const nearest = this.getNearestPoliceTelemetry(playerPos);
    if (playerInSafeZone || nearest.dist > 85) {
      this.wantedCooldown -= dt * (playerInSafeZone ? 2.5 : 1.0);
      if (this.wantedCooldown <= 0) {
        this.wantedStars = Math.max(0, this.wantedStars - 1);
        this.wantedCooldown = this.wantedStars > 0 ? 18 : 0;
        if (this.wantedStars === 0) {
          this.clearHeat();
          return;
        }
      }
    } else {
      this.wantedCooldown = Math.max(this.wantedCooldown, 14);
    }

    const desiredCount = Math.min(7, this.wantedStars + 1);
    this.spawnTimer -= dt;
    if (this.units.length < desiredCount && this.spawnTimer <= 0) {
      this.spawnTimer = 2.6;
      this.spawnPursuitUnit(playerPos, world);
    }

    let closeArrestUnits = 0;

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.health <= 0) {
        if (u.charRig) this.scene.remove(u.charRig.group);
        if (u.vehRig) this.scene.remove(u.vehRig.group);
        if (u.body && this.physics) this.physics.removeBody(u.body);
        this.units.splice(i, 1);
        continue;
      }

      const dx = playerPos.x - u.pos.x;
      const dz = playerPos.z - u.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 175) {
        const ang = Math.random() * Math.PI * 2;
        u.pos.set(playerPos.x + Math.cos(ang) * 75, u.kind === 'heli' ? 28 : 0, playerPos.z + Math.sin(ang) * 75);
      }

      u.rotY = Math.atan2(dx, dz);
      const targetSpeed =
        u.kind === 'heli'
          ? 24
          : u.kind === 'officer'
            ? 5.6
            : u.kind === 'bike'
              ? 24
              : 21;

      if (dist > (u.kind === 'heli' ? 22 : u.kind === 'officer' ? 5 : 10)) {
        u.speed += (targetSpeed - u.speed) * Math.min(1, dt * 3);
      } else {
        u.speed *= Math.max(0, 1 - dt * 4);
      }

      const nextX = u.pos.x + Math.sin(u.rotY) * u.speed * dt;
      const nextZ = u.pos.z + Math.cos(u.rotY) * u.speed * dt;

      if (u.kind === 'heli') {
        u.pos.x = nextX;
        u.pos.z = nextZ;
        u.pos.y = 26 + Math.sin(timeSec * 1.5) * 1.8;
      } else {
        const radius = u.kind === 'officer' ? 0.5 : u.kind === 'bike' ? 0.9 : 1.55;
        const height = u.kind === 'officer' ? 1.8 : 2.1;
        const colRes = world.resolveHorizontalCollision(nextX, nextZ, u.pos.y, radius, height);
        u.pos.x = colRes.x;
        u.pos.z = colRes.z;
        u.pos.y = world.getGroundHeight(u.pos.x, u.pos.z, u.pos.y);
      }

      if (u.body && this.physics) {
        this.physics.updateKinematicBody(u.body, u.pos.x, u.pos.y, u.pos.z, u.rotY);
      }

      if (u.charRig) {
        u.charRig.group.position.copy(u.pos);
        u.charRig.group.rotation.y = u.rotY;
        const swing = u.speed > 0.5 ? Math.sin(timeSec * 11) * 0.65 : 0;
        u.charRig.leftLeg.rotation.x = swing;
        u.charRig.rightLeg.rotation.x = -swing;
        u.charRig.rightArm.rotation.x = -1.45;
      }
      if (u.vehRig) {
        u.vehRig.group.position.copy(u.pos);
        u.vehRig.group.rotation.y = u.rotY;
        for (const w of u.vehRig.wheels) w.rotation.x += u.speed * dt * 2.5;
        if (u.vehRig.rotorMain) u.vehRig.rotorMain.rotation.y += dt * 26;
        if (u.vehRig.rotorTail) u.vehRig.rotorTail.rotation.x += dt * 30;
        if (u.vehRig.sirenBar) {
          const flash = Math.floor(timeSec * 9) % 2 === 0;
          u.vehRig.sirenBar.red.visible = flash;
          u.vehRig.sirenBar.blue.visible = !flash;
        }
      }

      if (!playerInSafeZone && dist < (u.kind === 'heli' ? 48 : 26)) {
        u.fireCooldown -= dt;
        if (u.fireCooldown <= 0) {
          u.fireCooldown = u.kind === 'heli' ? 1.4 : 1.25;
          onDamagePlayer(u.kind === 'heli' ? 6 : 4);
        }
      }

      if (!playerInSafeZone && u.kind !== 'heli' && dist < 5.5 && Math.abs(playerSpeedMs) < 2.2) {
        closeArrestUnits++;
      }
    }

    if (closeArrestUnits > 0) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 3.2) {
        this.bustedTimer = 0;
        onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }

  private spawnPursuitUnit(playerPos: THREE.Vector3, world: WorldBuilder): void {
    const ang = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 25;
    const sx = THREE.MathUtils.clamp(playerPos.x + Math.cos(ang) * dist, -430, 430);
    const sz = THREE.MathUtils.clamp(playerPos.z + Math.sin(ang) * dist, -430, 430);
    const sy = world.getGroundHeight(sx, sz, 2);

    const hasHeli = this.units.some((u) => u.kind === 'heli');
    let kind: PoliceChaser['kind'] = 'car';
    if (this.wantedStars >= 4 && !hasHeli) kind = 'heli';
    else if (this.wantedStars === 1 && Math.random() < 0.5) kind = 'officer';
    else if (Math.random() < 0.35) kind = 'bike';

    const id = `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (kind === 'officer') {
      const charRig = createCharacterRig('#D4B483', '#B89763', '#C68642', true, false);
      charRig.weaponMesh.visible = true;
      charRig.group.position.set(sx, sy, sz);
      this.scene.add(charRig.group);
      this.units.push({ id, kind, pos: new THREE.Vector3(sx, sy, sz), rotY: 0, speed: 0, health: 90, fireCooldown: 1.0, charRig });
    } else {
      const defId = kind === 'heli' ? 'police_helicopter' : kind === 'bike' ? 'pulsar' : 'police_jeep';
      const def = VEHICLE_MAP[defId];
      const vehRig = createVehicleRig(def, kind === 'bike' ? '#1D4ED8' : undefined);
      const startY = kind === 'heli' ? 28 : sy;
      vehRig.group.position.set(sx, startY, sz);
      this.scene.add(vehRig.group);
      const body =
        kind !== 'heli' && this.physics
          ? this.physics.createKinematicTrafficBody(def.width, def.height, def.length, sx, startY, sz, 0)
          : undefined;

      this.units.push({
        id,
        kind,
        pos: new THREE.Vector3(sx, startY, sz),
        rotY: 0,
        speed: 0,
        health: kind === 'heli' ? 260 : 180,
        fireCooldown: 1.2,
        vehRig,
        body
      });
    }
  }
}

