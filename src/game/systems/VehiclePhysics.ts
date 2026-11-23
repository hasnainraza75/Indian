import * as THREE from 'three';
import { VEHICLE_MAP } from '../data/vehiclesData';
import { createVehicleRig, VehicleRig } from '../entities/MeshFactory';
import { VehicleDef } from '../types';
import { WorldBuilder } from '../world/WorldBuilder';

export interface ActiveVehicle {
  uid: string;
  def: VehicleDef;
  rig: VehicleRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  speed: number; // m/s forward signed
  steerAngle: number;
  fuel: number;
  health: number;
  nitroCharge: number;
  nitroActive: boolean;
  gear: number;
  rpmNorm: number;
  skidIntensity: number;
  airborneTime: number;
  isPoliceUnit?: boolean;
  occupiedByPlayer?: boolean;
}

export interface VehicleInputState {
  throttle: boolean;
  brakeReverse: boolean;
  steer: number; // -1..1 (right positive)
  handbrake: boolean;
  nitro: boolean;
  ascend: boolean; // aircraft up
  descend: boolean; // aircraft down
}

export class VehicleSystem {
  readonly scene: THREE.Scene;
  readonly vehicles: ActiveVehicle[] = [];
  private trailTimer = 0;
  private trails: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private trailGeo = new THREE.BoxGeometry(0.18, 0.14, 1.4);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnVehicle(
    vehicleId: string,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    customColor?: string,
    isPoliceUnit = false
  ): ActiveVehicle | null {
    const def = VEHICLE_MAP[vehicleId];
    if (!def) return null;

    // Cap active non-police world vehicles for mobile memory efficiency
    if (!isPoliceUnit && this.vehicles.length >= 28) {
      const oldestIdx = this.vehicles.findIndex((v) => !v.occupiedByPlayer && !v.isPoliceUnit);
      if (oldestIdx >= 0) {
        this.removeVehicleAt(oldestIdx);
      }
    }

    const rig = createVehicleRig(def, customColor);
    rig.group.position.set(x, y, z);
    rig.group.rotation.y = rotY;
    this.scene.add(rig.group);

    const v: ActiveVehicle = {
      uid: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      def,
      rig,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      rotY,
      speed: 0,
      steerAngle: 0,
      fuel: def.maxFuel,
      health: def.maxHealth,
      nitroCharge: 100,
      nitroActive: false,
      gear: 1,
      rpmNorm: 0.15,
      skidIntensity: 0,
      airborneTime: 0,
      isPoliceUnit
    };
    this.vehicles.push(v);
    return v;
  }

  removeVehicleAt(index: number): void {
    const v = this.vehicles[index];
    if (!v) return;
    this.scene.remove(v.rig.group);
    this.vehicles.splice(index, 1);
  }

  clearAll(): void {
    while (this.vehicles.length > 0) {
      this.removeVehicleAt(0);
    }
    for (const t of this.trails) {
      this.scene.remove(t.mesh);
    }
    this.trails = [];
  }

  populateInitialWorldVehicles(world: WorldBuilder, storedGarageVehicleId: string, vehicleColors: Record<string, string>): void {
    const spawns: Array<{ id: string; x: number; z: number; rot: number }> = [
      { id: 'bullet', x: -136, z: -112, rot: Math.PI / 2 },
      { id: 'ktm_duke', x: -140, z: -112, rot: Math.PI / 2 },
      { id: storedGarageVehicleId || 'lamborghini', x: -124, z: -127, rot: 0 },
      { id: 'thar', x: -116, z: -114, rot: 0 },
      { id: 'rickshaw', x: -12, z: -15, rot: 0 },
      { id: 'fortuner', x: 16, z: -18, rot: -Math.PI / 2 },
      { id: 'supra', x: 42, z: -64, rot: 0 },
      { id: 'ferrari', x: 48, z: -64, rot: 0 },
      { id: 'tron_bike', x: -128, z: 160, rot: Math.PI / 4 },
      { id: 'police_jeep', x: 54, z: 46, rot: Math.PI },
      { id: 'helicopter', x: -275, z: -235, rot: 0 },
      { id: 'plane', x: -290, z: -295, rot: 0 },
      { id: 'boat', x: 175, z: 32, rot: 0.4 },
      { id: 'tractor', x: 318, z: -225, rot: -Math.PI / 2 },
      { id: 'truck', x: 140, z: -34, rot: Math.PI / 2 }
    ];

    for (const s of spawns) {
      const y = world.getGroundHeight(s.x, s.z, 2);
      this.spawnVehicle(s.id, s.x, y, s.z, s.rot, vehicleColors[s.id]);
    }
  }

  findNearestEnterable(pos: THREE.Vector3, maxDist = 4.2): ActiveVehicle | null {
    let best: ActiveVehicle | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.health <= 0) continue;
      const d = v.pos.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  updatePlayerVehicle(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    timeSec: number,
    onImpact: (severity: number) => void
  ): void {
    const maxSpeedMs = v.def.topSpeedKmh / 3.6;
    const hasFuel = v.fuel > 0.2 || v.def.soundProfile === 'silent' || v.def.category === 'creature';

    // Nitro / Electric Boost handling
    v.nitroActive = Boolean(input.nitro && v.nitroCharge > 4 && hasFuel && input.throttle);
    if (v.nitroActive) {
      v.nitroCharge = Math.max(0, v.nitroCharge - dt * 26);
    } else {
      v.nitroCharge = Math.min(100, v.nitroCharge + dt * 7.5);
    }

    const boostMult = v.nitroActive ? 1.38 : 1.0;

    if (v.def.canFly) {
      this.updateAircraftPhysics(v, dt, input, world, maxSpeedMs * boostMult);
    } else if (v.def.canFloat) {
      this.updateBoatPhysics(v, dt, input, world, maxSpeedMs * boostMult);
    } else {
      this.updateGroundVehiclePhysics(v, dt, input, world, maxSpeedMs * boostMult, hasFuel, onImpact);
    }

    // Consume fuel slowly
    if (hasFuel && Math.abs(v.speed) > 1.5 && v.def.soundProfile !== 'silent' && v.def.category !== 'creature') {
      v.fuel = Math.max(0, v.fuel - dt * (v.nitroActive ? 1.4 : 0.45));
    }

    // Visual animations: wheels, steering, suspension lean, rotors, wings, nitro flames, electric trails
    this.animateVehicleRig(v, dt, input, timeSec);
    this.updateTrails(v, dt);
  }

  private updateGroundVehiclePhysics(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number,
    hasFuel: boolean,
    onImpact: (severity: number) => void
  ): void {
    const accel = v.def.acceleration * (v.nitroActive ? 1.55 : 1.0);
    if (hasFuel && input.throttle) {
      v.speed += accel * dt;
    } else if (hasFuel && input.brakeReverse) {
      if (v.speed > 1.5) {
        v.speed -= v.def.braking * dt;
      } else {
        v.speed -= accel * 0.55 * dt;
      }
    } else {
      // Rolling drag
      v.speed *= Math.max(0, 1 - dt * 1.4);
    }

    if (input.handbrake) {
      v.speed *= Math.max(0, 1 - dt * 3.8);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, -maxSpeedMs * 0.35, maxSpeedMs);

    // Steering response
    const targetSteer = input.steer * 0.55;
    v.steerAngle += (targetSteer - v.steerAngle) * Math.min(1, dt * 10);
    const speedFactor = Math.min(1, Math.abs(v.speed) / 6.5);
    const reverseSign = v.speed >= -0.2 ? 1 : -1;
    const driftBoost = input.handbrake ? 1.35 : 1.0;
    v.rotY -= input.steer * v.def.handling * speedFactor * driftBoost * reverseSign * dt;

    const fwdX = Math.sin(v.rotY);
    const fwdZ = Math.cos(v.rotY);

    v.vel.x = fwdX * v.speed;
    v.vel.z = fwdZ * v.speed;
    v.vel.y -= 24 * dt;

    const nextX = THREE.MathUtils.clamp(v.pos.x + v.vel.x * dt, -460, 460);
    const nextZ = THREE.MathUtils.clamp(v.pos.z + v.vel.z * dt, -460, 460);

    // Building collision check
    const hitRadius = Math.max(1.0, v.def.width * 0.52);
    let collided = false;
    let rx = nextX;
    let rz = nextZ;

    for (const c of world.colliders) {
      if (v.pos.y >= c.maxY - 0.3) continue;
      if (
        rx + hitRadius > c.minX &&
        rx - hitRadius < c.maxX &&
        rz + hitRadius > c.minZ &&
        rz - hitRadius < c.maxZ
      ) {
        collided = true;
        const pL = Math.abs(rx + hitRadius - c.minX);
        const pR = Math.abs(c.maxX - (rx - hitRadius));
        const pT = Math.abs(rz + hitRadius - c.minZ);
        const pB = Math.abs(c.maxZ - (rz - hitRadius));
        const m = Math.min(pL, pR, pT, pB);
        if (m === pL) rx = c.minX - hitRadius;
        else if (m === pR) rx = c.maxX + hitRadius;
        else if (m === pT) rz = c.minZ - hitRadius;
        else rz = c.maxZ + hitRadius;
      }
    }

    if (collided && Math.abs(v.speed) > 4) {
      const impactSev = Math.min(1, Math.abs(v.speed) / 35);
      onImpact(impactSev);
      v.health = Math.max(0, v.health - impactSev * 22);
      v.speed *= -0.25;
    }

    v.pos.x = rx;
    v.pos.z = rz;
    v.pos.y += v.vel.y * dt;

    const prevGroundH = world.getGroundHeight(v.pos.x - fwdX * 0.5, v.pos.z - fwdZ * 0.5, v.pos.y);
    const groundH = world.getGroundHeight(v.pos.x, v.pos.z, v.pos.y);

    // Water slowdown for non-floating cars
    if (world.isWaterAt(v.pos.x, v.pos.z) && v.pos.y < 0.8) {
      v.speed *= Math.max(0, 1 - dt * 4.5);
    }

    if (v.pos.y <= groundH) {
      // Launch ramp vertical kick if climbing steep ramp fast
      const slope = groundH - prevGroundH;
      if (slope > 0.14 && v.speed > 14 && v.airborneTime === 0) {
        v.vel.y = Math.min(14, v.speed * slope * 0.85);
      } else {
        v.vel.y = 0;
      }
      v.pos.y = groundH;
      v.airborneTime = 0;
    } else {
      v.airborneTime += dt;
    }

    // Skid & Gear/RPM telemetry
    v.skidIntensity =
      v.pos.y <= groundH + 0.15 && Math.abs(v.speed) > 9 && (input.handbrake || Math.abs(input.steer) > 0.78)
        ? Math.min(1, Math.abs(v.speed) / 28)
        : 0;

    const speedRatio = Math.min(1, Math.abs(v.speed) / maxSpeedMs);
    v.gear = Math.min(6, Math.max(1, Math.ceil(speedRatio * 6)));
    const gearSpan = 1 / 6;
    const gearLocal = (speedRatio - (v.gear - 1) * gearSpan) / gearSpan;
    v.rpmNorm = v.speed === 0 ? 0.12 : Math.min(1, Math.max(0.22, gearLocal * 0.8 + (input.throttle ? 0.2 : 0)));
  }

  private updateAircraftPhysics(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number
  ): void {
    const accel = v.def.acceleration;
    if (input.throttle) v.speed += accel * dt;
    else if (input.brakeReverse) v.speed -= accel * 0.7 * dt;
    else v.speed *= Math.max(0, 1 - dt * 0.85);

    v.speed = THREE.MathUtils.clamp(v.speed, -14, maxSpeedMs);
    v.rotY -= input.steer * v.def.handling * 0.8 * dt;

    if (input.ascend) v.vel.y = 14;
    else if (input.descend) v.vel.y = -14;
    else if (v.def.modelShape === 'airplane' && v.speed > 26) v.vel.y = 4.5;
    else v.vel.y *= Math.max(0, 1 - dt * 5);

    const fwdX = Math.sin(v.rotY);
    const fwdZ = Math.cos(v.rotY);
    v.pos.x = THREE.MathUtils.clamp(v.pos.x + fwdX * v.speed * dt, -460, 460);
    v.pos.z = THREE.MathUtils.clamp(v.pos.z + fwdZ * v.speed * dt, -460, 460);
    v.pos.y = THREE.MathUtils.clamp(v.pos.y + v.vel.y * dt, world.getGroundHeight(v.pos.x, v.pos.z, v.pos.y), 140);

    v.gear = 1;
    v.rpmNorm = Math.min(1, 0.35 + Math.abs(v.speed) / maxSpeedMs * 0.65);
    v.skidIntensity = 0;
  }

  private updateBoatPhysics(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number
  ): void {
    const inWater = world.isWaterAt(v.pos.x, v.pos.z);
    const effectiveMax = inWater ? maxSpeedMs : maxSpeedMs * 0.18;
    if (input.throttle) v.speed += v.def.acceleration * dt;
    else if (input.brakeReverse) v.speed -= v.def.braking * 0.6 * dt;
    else v.speed *= Math.max(0, 1 - dt * 1.2);

    v.speed = THREE.MathUtils.clamp(v.speed, -8, effectiveMax);
    v.rotY -= input.steer * v.def.handling * 0.9 * dt;

    const fwdX = Math.sin(v.rotY);
    const fwdZ = Math.cos(v.rotY);
    v.pos.x = THREE.MathUtils.clamp(v.pos.x + fwdX * v.speed * dt, -460, 460);
    v.pos.z = THREE.MathUtils.clamp(v.pos.z + fwdZ * v.speed * dt, -460, 460);
    v.pos.y = inWater ? -0.15 + Math.sin(performance.now() * 0.004) * 0.08 : world.getGroundHeight(v.pos.x, v.pos.z, v.pos.y);

    v.gear = Math.min(4, Math.max(1, Math.ceil((Math.abs(v.speed) / effectiveMax) * 4)));
    v.rpmNorm = Math.min(1, 0.2 + Math.abs(v.speed) / effectiveMax * 0.8);
    v.skidIntensity = 0;
  }

  private animateVehicleRig(v: ActiveVehicle, dt: number, input: VehicleInputState, timeSec: number): void {
    v.rig.group.position.copy(v.pos);
    v.rig.group.rotation.y = v.rotY;

    // Suspension pitch & roll lean
    const targetRoll =
      v.def.category === 'motorcycle'
        ? -input.steer * Math.min(0.42, Math.abs(v.speed) * 0.018)
        : input.steer * Math.min(0.08, Math.abs(v.speed) * 0.003) / v.def.suspensionStiffness;
    const targetPitch = (input.brakeReverse && v.speed > 2 ? 0.05 : input.throttle ? -0.04 : 0) / v.def.suspensionStiffness;

    v.rig.bodyGroup.rotation.z += (targetRoll - v.rig.bodyGroup.rotation.z) * Math.min(1, dt * 8);
    v.rig.bodyGroup.rotation.x += (targetPitch - v.rig.bodyGroup.rotation.x) * Math.min(1, dt * 8);

    // Wheel spin & front wheel turn
    if (v.def.category === 'creature' || v.def.modelShape === 'robot_ai') {
      const stride = Math.abs(v.speed) > 0.5 ? Math.sin(timeSec * 10) * 0.55 : 0;
      v.rig.wheels.forEach((leg, i) => {
        leg.rotation.x = i % 2 === 0 ? stride : -stride;
      });
    } else {
      const spin = (v.speed / Math.max(0.2, v.def.wheelRadius)) * dt;
      for (const w of v.rig.wheels) {
        w.rotation.x += spin;
      }
      for (const fp of v.rig.frontWheelPivots) {
        fp.rotation.y = -v.steerAngle;
      }
    }

    if (v.rig.rotorMain) v.rig.rotorMain.rotation.y += dt * 26;
    if (v.rig.rotorTail) v.rig.rotorTail.rotation.x += dt * 32;
    if (v.rig.wings && v.rig.wings.length === 2) {
      const flap = Math.sin(timeSec * 7.5) * 0.45;
      v.rig.wings[0].rotation.z = flap;
      v.rig.wings[1].rotation.z = -flap;
    }

    for (const fl of v.rig.nitroFlames) {
      fl.visible = Boolean(v.nitroActive || (v.def.canFly && input.throttle));
      if (fl.visible) {
        fl.scale.y = 0.8 + Math.random() * 0.65;
      }
    }

    if (v.rig.electricAura) {
      v.rig.electricAura.visible = v.nitroActive || Math.abs(v.speed) > 18;
      v.rig.electricAura.rotation.z += dt * 3;
    }

    // Siren light bar flash
    if (v.rig.sirenBar) {
      const flash = Math.floor(timeSec * 8) % 2 === 0;
      v.rig.sirenBar.red.visible = flash;
      v.rig.sirenBar.blue.visible = !flash;
    }
  }

  private updateTrails(v: ActiveVehicle, dt: number): void {
    // Blue energy trails / Tron / Ghost Rider fire trail when boosting or special
    const shouldEmit =
      v.nitroActive ||
      ((v.def.isElectric || v.def.modelShape === 'ghost_bike' || v.def.modelShape === 'tron_bike') &&
        Math.abs(v.speed) > 14);

    if (shouldEmit) {
      this.trailTimer += dt;
      if (this.trailTimer > 0.045) {
        this.trailTimer = 0;
        const color = v.def.modelShape === 'ghost_bike' ? '#FF5500' : '#00F0FF';
        const mesh = new THREE.Mesh(
          this.trailGeo,
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 })
        );
        mesh.position.set(v.pos.x, v.pos.y + 0.32, v.pos.z);
        mesh.rotation.y = v.rotY;
        this.scene.add(mesh);
        this.trails.push({ mesh, life: 0.55 });
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        (t.mesh.material as THREE.Material).dispose();
        this.trails.splice(i, 1);
      } else {
        (t.mesh.material as THREE.MeshBasicMaterial).opacity = t.life * 1.4;
      }
    }
  }
}
