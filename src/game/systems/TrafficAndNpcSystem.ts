import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CharacterRig, createCharacterRig, createVehicleRig, VehicleRig } from '../entities/MeshFactory';
import { VEHICLE_MAP } from '../data/vehiclesData';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { WorldBuilder } from '../world/WorldBuilder';

export interface NpcPedestrian {
  id: string;
  rig: CharacterRig;
  pos: THREE.Vector3;
  rotY: number;
  speed: number;
  health: number;
  isHostile: boolean;
  isZombie: boolean;
  fleeTimer: number;
  turnTimer: number;
  animPhase: number;
  deadTimer: number;
}

export interface TrafficUnit {
  id: string;
  rig: VehicleRig;
  pos: THREE.Vector3;
  rotY: number;
  speed: number;
  maxSpeed: number;
  laneAxis: 'x' | 'z';
  laneDir: 1 | -1;
  laneCoord: number;
  width: number;
  height: number;
  length: number;
  body?: RAPIER.RigidBody;
}

export class TrafficAndNpcSystem {
  readonly scene: THREE.Scene;
  readonly npcs: NpcPedestrian[] = [];
  readonly traffic: TrafficUnit[] = [];

  private physics: PhysicsWorld | null = null;
  private maxNpcs = 18;
  private maxTraffic = 12;

  constructor(scene: THREE.Scene, physics?: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics ?? null;
  }

  setPhysicsWorld(physics: PhysicsWorld): void {
    this.physics = physics;
    for (const t of this.traffic) {
      if (!t.body) {
        t.body = physics.createKinematicTrafficBody(t.width, t.height, t.length, t.pos.x, t.pos.y, t.pos.z, t.rotY);
      }
    }
  }

  initPopulation(): void {
    this.clear();
    for (let i = 0; i < this.maxNpcs; i++) {
      this.spawnRandomPedestrian(false, false);
    }
    for (let i = 0; i < this.maxTraffic; i++) {
      this.spawnRandomTraffic(i);
    }
  }

  increasePopulation(target: 'npc' | 'traffic'): void {
    if (target === 'npc') {
      this.maxNpcs = Math.min(40, this.maxNpcs + 12);
      while (this.npcs.length < this.maxNpcs) {
        this.spawnRandomPedestrian(false, false);
      }
    } else {
      this.maxTraffic = Math.min(26, this.maxTraffic + 8);
      while (this.traffic.length < this.maxTraffic) {
        this.spawnRandomTraffic(this.traffic.length);
      }
    }
  }

  spawnZombieSwarm(around: THREE.Vector3, count = 8): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 12 + Math.random() * 14;
      this.spawnPedestrianAt(
        around.x + Math.cos(ang) * dist,
        around.z + Math.sin(ang) * dist,
        true,
        true
      );
    }
  }

  spawnMissionHostiles(centerX: number, centerZ: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const r = 8 + Math.random() * 14;
      this.spawnPedestrianAt(centerX + Math.cos(ang) * r, centerZ + Math.sin(ang) * r, true, false);
    }
  }

  private spawnRandomPedestrian(isHostile: boolean, isZombie: boolean): void {
    const x = (Math.random() - 0.5) * 320;
    const z = (Math.random() - 0.5) * 320;
    this.spawnPedestrianAt(x, z, isHostile, isZombie);
  }

  private spawnPedestrianAt(x: number, z: number, isHostile: boolean, isZombie: boolean): void {
    const shirts = ['#38BDF8', '#F43F5E', '#10B981', '#FACC15', '#A855F7', '#FB923C'];
    const shirt = isHostile && !isZombie ? '#991B1B' : shirts[Math.floor(Math.random() * shirts.length)];
    const rig = createCharacterRig(shirt, '#1E293B', '#C68642', false, isZombie);
    rig.weaponMesh.visible = isHostile && !isZombie;
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);

    this.npcs.push({
      id: `npc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rig,
      pos: new THREE.Vector3(x, 0, z),
      rotY: Math.random() * Math.PI * 2,
      speed: isHostile ? 4.4 : 2.1 + Math.random() * 1.1,
      health: isZombie ? 95 : isHostile ? 110 : 60,
      isHostile,
      isZombie,
      fleeTimer: 0,
      turnTimer: 2 + Math.random() * 5,
      animPhase: Math.random() * 6,
      deadTimer: 0
    });
  }

  private spawnRandomTraffic(seedIdx: number): void {
    const pool = [
      'innova',
      'rickshaw',
      'bolero',
      'splendor',
      'pulsar',
      'truck',
      'city_bus',
      'bmw',
      'fortuner',
      'scorpio_s11'
    ];
    const def = VEHICLE_MAP[pool[seedIdx % pool.length]] ?? VEHICLE_MAP.innova;
    const lanes = [-90, 0, 90];
    const laneAxis: 'x' | 'z' = seedIdx % 2 === 0 ? 'x' : 'z';
    const laneDir: 1 | -1 = seedIdx % 4 < 2 ? 1 : -1;
    const laneCoord = lanes[seedIdx % lanes.length] + laneDir * 4.0;
    const travelCoord = ((seedIdx * 47) % 320) - 160;

    const x = laneAxis === 'x' ? travelCoord : laneCoord;
    const z = laneAxis === 'z' ? travelCoord : laneCoord;
    const rotY =
      laneAxis === 'x'
        ? laneDir > 0
          ? Math.PI / 2
          : -Math.PI / 2
        : laneDir > 0
          ? 0
          : Math.PI;

    const rig = createVehicleRig(def);
    rig.group.position.set(x, 0, z);
    rig.group.rotation.y = rotY;
    this.scene.add(rig.group);

    const body = this.physics
      ? this.physics.createKinematicTrafficBody(def.width, def.height, def.length, x, 0, z, rotY)
      : undefined;

    this.traffic.push({
      id: `traf_${seedIdx}_${Date.now()}`,
      rig,
      pos: new THREE.Vector3(x, 0, z),
      rotY,
      speed: 10 + Math.random() * 6,
      maxSpeed: def.id === 'city_bus' || def.id === 'truck' ? 11 + Math.random() * 3 : 12 + Math.random() * 6,
      laneAxis,
      laneDir,
      laneCoord,
      width: def.width,
      height: def.height,
      length: def.length,
      body
    });
  }

  scatterAround(origin: THREE.Vector3, radius: number): void {
    for (const npc of this.npcs) {
      if (npc.health <= 0 || npc.isHostile) continue;
      const d = npc.pos.distanceTo(origin);
      if (d < radius) {
        npc.fleeTimer = 5.0;
        npc.rotY = Math.atan2(npc.pos.x - origin.x, npc.pos.z - origin.z);
      }
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    world: WorldBuilder,
    playerInSafeZone: boolean,
    onDamagePlayer: (dmg: number) => void
  ): void {
    // Update Pedestrians
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];
      if (npc.health <= 0) {
        npc.deadTimer += dt;
        npc.rig.group.rotation.x = Math.PI / 2;
        npc.rig.group.position.y = npc.pos.y + 0.25;
        if (npc.deadTimer > 4) {
          this.scene.remove(npc.rig.group);
          this.npcs.splice(i, 1);
          if (!npc.isHostile) this.spawnRandomPedestrian(false, false);
        }
        continue;
      }

      const distToPlayer = npc.pos.distanceTo(playerPos);
      if (distToPlayer > 260 && !npc.isHostile) {
        npc.pos.set(
          playerPos.x + (Math.random() - 0.5) * 140,
          0,
          playerPos.z + (Math.random() - 0.5) * 140
        );
      }

      let moveSpeed = npc.speed;
      if (npc.isHostile) {
        if (playerInSafeZone) {
          moveSpeed = 0;
        } else {
          npc.rotY = Math.atan2(playerPos.x - npc.pos.x, playerPos.z - npc.pos.z);
          if (distToPlayer < (npc.isZombie ? 2.1 : 18)) {
            npc.turnTimer -= dt;
            if (npc.turnTimer <= 0) {
              npc.turnTimer = npc.isZombie ? 1.1 : 1.5;
              onDamagePlayer(npc.isZombie ? 7 : 5);
              npc.rig.muzzleFlash.visible = !npc.isZombie;
              setTimeout(() => {
                npc.rig.muzzleFlash.visible = false;
              }, 70);
            }
            if (!npc.isZombie && distToPlayer < 11) moveSpeed = 0;
          }
        }
      } else {
        if (npc.fleeTimer > 0) {
          npc.fleeTimer -= dt;
          moveSpeed = 6.8;
        } else {
          npc.turnTimer -= dt;
          if (npc.turnTimer <= 0) {
            npc.turnTimer = 3 + Math.random() * 5;
            npc.rotY += (Math.random() - 0.5) * 2.2;
          }
        }
      }

      const nextX = THREE.MathUtils.clamp(npc.pos.x + Math.sin(npc.rotY) * moveSpeed * dt, -420, 420);
      const nextZ = THREE.MathUtils.clamp(npc.pos.z + Math.cos(npc.rotY) * moveSpeed * dt, -420, 420);
      const res = world.resolveHorizontalCollision(nextX, nextZ, npc.pos.y, 0.48, 1.75);
      if (res.hit && !npc.isHostile) {
        npc.rotY += Math.PI * 0.65;
      }
      npc.pos.x = res.x;
      npc.pos.z = res.z;
      npc.pos.y = world.getGroundHeight(npc.pos.x, npc.pos.z, npc.pos.y);

      npc.rig.group.position.copy(npc.pos);
      npc.rig.group.rotation.y = npc.rotY;

      npc.animPhase += dt * (moveSpeed > 0.2 ? moveSpeed * 2.1 : 1);
      const swing = moveSpeed > 0.2 ? Math.sin(npc.animPhase) * 0.6 : 0;
      npc.rig.leftLeg.rotation.x = swing;
      npc.rig.rightLeg.rotation.x = -swing;
      npc.rig.leftArm.rotation.x = npc.isZombie ? -1.4 : -swing * 0.6;
      npc.rig.rightArm.rotation.x = npc.isZombie ? -1.4 : npc.isHostile ? -1.35 : swing * 0.6;
    }

    // Update Road Traffic & sync Kinematic Rapier bodies
    for (const t of this.traffic) {
      const stopForSignal = world.isSignalRedForDirection(t.pos.x, t.pos.z, t.laneAxis === 'z');
      const nearPlayer = t.pos.distanceTo(playerPos) < 9.5;
      const targetSpeed = stopForSignal || nearPlayer ? 0 : t.maxSpeed;
      t.speed += (targetSpeed - t.speed) * Math.min(1, dt * 4);

      if (t.laneAxis === 'x') {
        t.pos.x += t.laneDir * t.speed * dt;
        if (t.pos.x > 185) t.pos.x = -185;
        if (t.pos.x < -185) t.pos.x = 185;
      } else {
        t.pos.z += t.laneDir * t.speed * dt;
        if (t.pos.z > 185) t.pos.z = -185;
        if (t.pos.z < -185) t.pos.z = 185;
      }
      t.pos.y = world.getGroundHeight(t.pos.x, t.pos.z, t.pos.y);
      t.rig.group.position.copy(t.pos);
      t.rig.group.rotation.y = t.rotY;

      if (t.body && this.physics) {
        this.physics.updateKinematicBody(t.body, t.pos.x, t.pos.y, t.pos.z, t.rotY);
      }

      for (const w of t.rig.wheels) {
        w.rotation.x += t.speed * dt * 2.2;
      }
    }
  }

  clear(): void {
    for (const n of this.npcs) this.scene.remove(n.rig.group);
    for (const t of this.traffic) {
      this.scene.remove(t.rig.group);
      if (t.body && this.physics) this.physics.removeBody(t.body);
    }
    this.npcs.length = 0;
    this.traffic.length = 0;
  }
}

