import * as THREE from 'three';
import { VEHICLE_MAP } from '../data/vehiclesData';
import { createVehicleRig, VehicleRig } from '../entities/MeshFactory';
import { PhysicsWorld, RapierVehicleHandle } from '../physics/PhysicsWorld';
import { VehicleDef } from '../types';
import { WorldBuilder } from '../world/WorldBuilder';

export interface ActiveVehicle {
  uid: string;
  def: VehicleDef;
  rig: VehicleRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  pitchX: number;
  rollZ: number;
  speed: number; // forward signed m/s
  airspeedMs: number; // 3D speed magnitude m/s
  altitudeM: number;
  steerAngle: number;
  wheelSpinRad: number;
  suspensionOffsetY: number;
  fuel: number;
  health: number;
  nitroCharge: number;
  nitroActive: boolean;
  gear: number;
  rpmNorm: number;
  skidIntensity: number;
  airborneTime: number;
  groundedWheels: number;
  // Helicopter flight state
  isHelicopter: boolean;
  heliEngineOn: boolean;
  heliRotorRpm: number; // 0..1
  heliHover: boolean;
  heliAutoLanding: boolean;
  heliHoverTargetY: number;
  isPoliceUnit?: boolean;
  occupiedByPlayer?: boolean;
  physicsHandle?: RapierVehicleHandle;
}

export interface VehicleInputState {
  throttle: boolean;
  brakeReverse: boolean;
  steer: number; // -1..1 (right positive)
  handbrake: boolean;
  nitro: boolean;
  ascend: boolean;
  descend: boolean;
  // Helicopter specific controls
  heliCyclicX: number; // -1..1 (left/right strafe)
  heliCyclicY: number; // -1..1 (forward/back cyclic)
  heliYaw: number; // -1..1 (rotate left/right)
  heliLand: boolean;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export function isHelicopterDef(def: VehicleDef): boolean {
  return def.modelShape === 'helicopter' || def.modelShape === 'apache' || def.modelShape === 'heicarrier';
}

export class VehicleSystem {
  readonly scene: THREE.Scene;
  readonly vehicles: ActiveVehicle[] = [];
  private physics: PhysicsWorld | null = null;
  private trailTimer = 0;
  private particleTimer = 0;
  private trails: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private trailGeo = new THREE.BoxGeometry(0.18, 0.14, 1.4);

  private particles: PooledParticle[] = [];
  private particleGeo = new THREE.DodecahedronGeometry(0.28, 0);

  private tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private tmpQuat = new THREE.Quaternion();
  private tmpVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, physics?: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics ?? null;
  }

  setPhysicsWorld(physics: PhysicsWorld): void {
    this.physics = physics;
    for (const v of this.vehicles) {
      if (!v.physicsHandle) {
        v.physicsHandle = physics.createVehicleBody(v.def, v.pos.x, v.pos.y, v.pos.z, v.rotY);
      }
    }
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

    const physicsHandle = this.physics
      ? this.physics.createVehicleBody(def, x, y, z, rotY)
      : undefined;

    const v: ActiveVehicle = {
      uid: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      def,
      rig,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      rotY,
      pitchX: 0,
      rollZ: 0,
      speed: 0,
      airspeedMs: 0,
      altitudeM: 0,
      steerAngle: 0,
      wheelSpinRad: 0,
      suspensionOffsetY: 0,
      fuel: def.maxFuel,
      health: def.maxHealth,
      nitroCharge: 100,
      nitroActive: false,
      gear: 1,
      rpmNorm: 0.12,
      skidIntensity: 0,
      airborneTime: 0,
      groundedWheels: 4,
      isHelicopter: isHelicopterDef(def),
      heliEngineOn: false,
      heliRotorRpm: 0,
      heliHover: true,
      heliAutoLanding: false,
      heliHoverTargetY: y,
      isPoliceUnit,
      physicsHandle
    };
    this.vehicles.push(v);
    return v;
  }

  removeVehicleAt(index: number): void {
    const v = this.vehicles[index];
    if (!v) return;
    if (v.physicsHandle && this.physics) {
      this.physics.removeBody(v.physicsHandle.body);
    }
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
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }

  populateInitialWorldVehicles(
    world: WorldBuilder,
    storedGarageVehicleId: string,
    vehicleColors: Record<string, string>
  ): void {
    const spawns: Array<{ id: string; x: number; z: number; rot: number }> = [
      { id: 'bullet', x: -136, z: -112, rot: Math.PI / 2 },
      { id: 'ktm_duke', x: -140, z: -112, rot: Math.PI / 2 },
      { id: storedGarageVehicleId || 'lamborghini', x: -124, z: -127, rot: 0 },
      { id: 'thar', x: -116, z: -114, rot: 0 },
      { id: 'rickshaw', x: -12, z: -15, rot: 0 },
      { id: 'fortuner', x: 16, z: -18, rot: -Math.PI / 2 },
      { id: 'supra', x: 42, z: -64, rot: 0 },
      { id: 'ferrari', x: 48, z: -64, rot: 0 },
      { id: 'city_bus', x: -86, z: -36, rot: 0 },
      { id: 'tron_bike', x: -128, z: 160, rot: Math.PI / 4 },
      { id: 'police_jeep', x: 54, z: 46, rot: Math.PI },
      { id: 'helicopter', x: -275, z: -235, rot: 0 },
      { id: 'plane', x: -290, z: -295, rot: 0 },
      { id: 'boat', x: 175, z: 32, rot: 0.4 },
      { id: 'tractor', x: 318, z: -225, rot: -Math.PI / 2 },
      { id: 'truck', x: 140, z: -34, rot: Math.PI / 2 }
    ];

    for (const s of spawns) {
      const y = world.getGroundHeight(s.x, s.z, 2) + 0.12;
      this.spawnVehicle(s.id, s.x, y, s.z, s.rot, vehicleColors[s.id]);
    }
  }

  findNearestEnterable(pos: THREE.Vector3, maxDist = 4.5): ActiveVehicle | null {
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

  teleportVehicle(v: ActiveVehicle, x: number, y: number, z: number, rotY = v.rotY): void {
    v.pos.set(x, y, z);
    v.vel.set(0, 0, 0);
    v.speed = 0;
    v.rotY = rotY;
    v.pitchX = 0;
    v.rollZ = 0;
    v.heliHoverTargetY = y;
    if (v.physicsHandle) {
      this.tmpEuler.set(0, rotY, 0, 'YXZ');
      this.tmpQuat.setFromEuler(this.tmpEuler);
      v.physicsHandle.body.setTranslation({ x, y, z }, true);
      v.physicsHandle.body.setRotation({ x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w }, true);
      v.physicsHandle.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      v.physicsHandle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    v.rig.group.position.copy(v.pos);
    v.rig.group.rotation.set(0, rotY, 0);
  }

  toggleHelicopterEngine(v: ActiveVehicle): boolean {
    if (!v.isHelicopter) return false;
    v.heliEngineOn = !v.heliEngineOn;
    if (v.heliEngineOn) {
      v.heliAutoLanding = false;
      v.heliHoverTargetY = v.pos.y;
    }
    return v.heliEngineOn;
  }

  toggleHelicopterHover(v: ActiveVehicle): boolean {
    if (!v.isHelicopter) return false;
    v.heliHover = !v.heliHover;
    if (v.heliHover) {
      v.heliAutoLanding = false;
      v.heliHoverTargetY = v.pos.y;
    }
    return v.heliHover;
  }

  triggerHelicopterLand(v: ActiveVehicle): void {
    if (!v.isHelicopter) return;
    v.heliAutoLanding = true;
    v.heliHover = false;
  }

  /**
   * Step physics forces BEFORE physicsWorld.step(dt).
   */
  prepareVehiclePhysicsStep(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder
  ): void {
    if (!v.physicsHandle) return;
    const body = v.physicsHandle.body;
    body.wakeUp();

    const maxSpeedMs = v.def.topSpeedKmh / 3.6;
    const hasFuel = v.fuel > 0.2 || v.def.soundProfile === 'silent' || v.def.category === 'creature';

    v.nitroActive = Boolean(input.nitro && v.nitroCharge > 4 && hasFuel && (input.throttle || v.isHelicopter));
    if (v.nitroActive) {
      v.nitroCharge = Math.max(0, v.nitroCharge - dt * 26);
    } else {
      v.nitroCharge = Math.min(100, v.nitroCharge + dt * 7.5);
    }

    const boostMult = v.nitroActive ? 1.32 : 1.0;

    if (v.isHelicopter) {
      this.stepHelicopterForces(v, dt, input, world, maxSpeedMs * boostMult, hasFuel);
    } else if (v.def.canFly) {
      this.stepGeneralAircraftForces(v, dt, input, world, maxSpeedMs * boostMult, hasFuel);
    } else if (v.def.canFloat) {
      this.stepBoatForces(v, dt, input, world, maxSpeedMs * boostMult, hasFuel);
    } else {
      this.stepGroundVehicleForces(v, dt, input, world, maxSpeedMs * boostMult, hasFuel);
    }
  }

  /**
   * Synchronize post-step Rapier body state, detect collisions, update animations & particles.
   */
  syncPostPhysicsStep(
    v: ActiveVehicle,
    dt: number,
    prevVel: THREE.Vector3,
    input: VehicleInputState,
    world: WorldBuilder,
    timeSec: number,
    onImpact: (severity: number) => void
  ): void {
    if (v.physicsHandle) {
      const body = v.physicsHandle.body;
      const t = body.translation();
      const r = body.rotation();
      const lv = body.linvel();

      // World boundary containment
      if (Math.abs(t.x) > 465 || Math.abs(t.z) > 465) {
        const cx = THREE.MathUtils.clamp(t.x, -460, 460);
        const cz = THREE.MathUtils.clamp(t.z, -460, 460);
        body.setTranslation({ x: cx, y: t.y, z: cz }, true);
        body.setLinvel({ x: lv.x * -0.25, y: lv.y, z: lv.z * -0.25 }, true);
      }

      const postT = body.translation();
      const postLv = body.linvel();
      v.pos.set(postT.x, postT.y, postT.z);
      v.vel.set(postLv.x, postLv.y, postLv.z);

      this.tmpQuat.set(r.x, r.y, r.z, r.w);
      this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ');
      v.rotY = this.tmpEuler.y;

      const fwdX = Math.sin(v.rotY);
      const fwdZ = Math.cos(v.rotY);
      v.speed = v.vel.x * fwdX + v.vel.z * fwdZ;
      v.airspeedMs = v.vel.length();

      // Detect sudden Rapier collision impulse
      const deltaV = prevVel.distanceTo(v.vel);
      if (deltaV > 4.8) {
        const severity = Math.min(1, (deltaV - 4.0) / 26);
        onImpact(severity);
        v.health = Math.max(0, v.health - severity * 20);
      }

      const terrainH = world.getMountainBaseHeight(v.pos.x, v.pos.z);
      v.altitudeM = Math.max(0, v.pos.y - terrainH);
    }

    // Consume fuel while moving or engine running
    const hasFuel = v.fuel > 0.2 || v.def.soundProfile === 'silent' || v.def.category === 'creature';
    if (hasFuel && (Math.abs(v.speed) > 1.5 || (v.isHelicopter && v.heliEngineOn)) && v.def.soundProfile !== 'silent' && v.def.category !== 'creature') {
      v.fuel = Math.max(0, v.fuel - dt * (v.nitroActive ? 1.2 : 0.35));
    }

    this.animateVehicleRig(v, dt, input, timeSec);
    this.updateTrails(v, dt);
    this.updateParticles(v, dt);
  }

  /**
   * Idle coasting physics for unmanned vehicles so they settle on slopes/ramps naturally.
   */
  stepUnmannedVehicles(dt: number, world: WorldBuilder): void {
    for (const v of this.vehicles) {
      if (v.occupiedByPlayer || !v.physicsHandle) continue;
      const body = v.physicsHandle.body;
      const t = body.translation();
      const r = body.rotation();
      const lv = body.linvel();
      v.pos.set(t.x, t.y, t.z);
      v.vel.set(lv.x, lv.y, lv.z);
      this.tmpQuat.set(r.x, r.y, r.z, r.w);
      this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ');
      v.rotY = this.tmpEuler.y;
      v.rig.group.position.copy(v.pos);
      v.rig.group.quaternion.copy(this.tmpQuat);

      if (v.isHelicopter && v.heliRotorRpm > 0) {
        v.heliRotorRpm = Math.max(0, v.heliRotorRpm - dt * 0.25);
        if (v.rig.rotorMain) v.rig.rotorMain.rotation.y += dt * 32 * v.heliRotorRpm;
        if (v.rig.rotorTail) v.rig.rotorTail.rotation.x += dt * 40 * v.heliRotorRpm;
      }

      if (v.def.canFloat && world.isWaterAt(v.pos.x, v.pos.z) && v.pos.y < 0.4) {
        const sub = Math.max(0, -0.1 - v.pos.y);
        body.setLinvel({ x: lv.x * (1 - dt * 2), y: lv.y * 0.85 + sub * 18 * dt, z: lv.z * (1 - dt * 2) }, false);
      }
    }
  }

  private stepGroundVehicleForces(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number,
    hasFuel: boolean
  ): void {
    const handle = v.physicsHandle!;
    const body = handle.body;
    const spec = handle.spec;
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    const av = body.angvel();

    this.tmpQuat.set(r.x, r.y, r.z, r.w);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.tmpQuat);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.tmpQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tmpQuat);

    // 4-point (or 2-point for bikes) wheel raycast against terrain/bridges/ramps
    const hw = spec.isTwoWheeler ? 0 : v.def.width * 0.36;
    const hl = v.def.length * 0.33;
    const wheelOffsets: Array<[number, number]> = spec.isTwoWheeler
      ? [[0, hl], [0, -hl]]
      : [[-hw, hl], [hw, hl], [-hw, -hl], [hw, -hl]];

    const rayOriginLocalY = handle.localMinY + 0.52;
    const rayMaxDist = rayOriginLocalY + spec.suspensionRestLen;

    let groundedCount = 0;
    const avgNormal = new THREE.Vector3(0, 0, 0);
    let minGap = 999;
    let gapSum = 0;

    for (const [lx, lz] of wheelOffsets) {
      const origin = new THREE.Vector3(lx, rayOriginLocalY, lz).applyQuaternion(this.tmpQuat).add(new THREE.Vector3(t.x, t.y, t.z));
      const hit = this.physics!.castWheelRay(
        origin.x,
        origin.y,
        origin.z,
        -up.x,
        -up.y,
        -up.z,
        rayMaxDist,
        body
      );
      if (hit) {
        groundedCount++;
        avgNormal.x += hit.normal.x;
        avgNormal.y += hit.normal.y;
        avgNormal.z += hit.normal.z;
        const groundGap = hit.toi - rayOriginLocalY;
        gapSum += groundGap;
        if (groundGap < minGap) minGap = groundGap;
      }
    }

    v.groundedWheels = groundedCount;
    const avgGap = groundedCount > 0 ? gapSum / groundedCount : 999;
    const effGap = groundedCount > 0 ? avgGap * 0.5 + minGap * 0.5 : 999;
    const isGrounded = groundedCount > 0 && minGap < spec.suspensionRestLen * 0.92;

    if (groundedCount > 0) {
      avgNormal.normalize();
    } else {
      avgNormal.set(0, 1, 0);
    }

    // Project forward/right onto ground surface normal so climbing bridges/ramps stays glued cleanly
    const roadFwd = fwd.clone().addScaledVector(avgNormal, -fwd.dot(avgNormal));
    if (roadFwd.lengthSq() > 0.001) roadFwd.normalize();
    else roadFwd.copy(fwd);

    const roadRight = right.clone().addScaledVector(avgNormal, -right.dot(avgNormal));
    if (roadRight.lengthSq() > 0.001) roadRight.normalize();
    else roadRight.copy(right);

    const vel = new THREE.Vector3(lv.x, lv.y, lv.z);
    const forwardSpeed = vel.dot(roadFwd);
    const lateralSpeed = vel.dot(roadRight);
    v.speed = forwardSpeed;

    // Suspension bounce visual offset & airborne tracker
    if (isGrounded) {
      v.airborneTime = 0;
      v.suspensionOffsetY = THREE.MathUtils.clamp((0.03 - effGap) * 0.45, -0.09, 0.09);
    } else {
      v.airborneTime += dt;
      v.suspensionOffsetY *= Math.max(0, 1 - dt * 6);
    }

    // Smooth Steering
    const targetSteer = input.steer * 0.52;
    v.steerAngle += (targetSteer - v.steerAngle) * Math.min(1, dt * 10);

    let nextVx = vel.x;
    let nextVy = vel.y;
    let nextVz = vel.z;

    if (isGrounded) {
      // Wheel spring-damper suspension keeping chassis smoothly floating on tires above terrain seams
      const comp = Math.max(0, 0.27 - effGap);
      if (comp > 0) {
        const kSpring = 9.81 / 0.24; // Equilibrium at effGap = +0.03m
        const damp = 8.4;
        const vAlongN = vel.dot(avgNormal);
        const suspAccel = Math.max(0, comp * kSpring - vAlongN * damp);
        nextVx += avgNormal.x * suspAccel * dt;
        nextVy += avgNormal.y * suspAccel * dt;
        nextVz += avgNormal.z * suspAccel * dt;
      }

      // Longitudinal engine, braking & reverse gear
      const accelBase = v.def.acceleration * (v.nitroActive ? 1.48 : 1.0);
      const maxRevMs = Math.min(18, maxSpeedMs * 0.32);

      let longDelta = 0;
      if (hasFuel && input.throttle) {
        if (forwardSpeed < maxSpeedMs) {
          const ratio = Math.max(0, forwardSpeed / maxSpeedMs);
          const torqueCurve = Math.max(0.22, 1.0 - Math.pow(ratio, 1.8));
          longDelta = accelBase * torqueCurve * dt;
        }
      } else if (hasFuel && input.brakeReverse) {
        if (forwardSpeed > 1.2) {
          // Smooth braking
          longDelta = -Math.min(forwardSpeed, v.def.braking * dt);
        } else if (forwardSpeed > -maxRevMs) {
          // Reverse gear
          longDelta = -accelBase * 0.55 * dt;
        }
      } else {
        // Natural rolling resistance
        const drag = Math.min(Math.abs(forwardSpeed), 1.6 * dt);
        longDelta = -Math.sign(forwardSpeed) * drag;
      }

      if (input.handbrake) {
        const hb = Math.min(Math.abs(forwardSpeed), v.def.braking * 0.92 * dt);
        longDelta -= Math.sign(forwardSpeed) * hb;
      }

      // Aerodynamic quadratic drag
      const aero = spec.dragCoeff * forwardSpeed * Math.abs(forwardSpeed) * dt;
      longDelta -= aero;

      // Water bogging for land vehicles
      if (world.isWaterAt(t.x, t.z) && t.y < 0.75) {
        longDelta -= forwardSpeed * Math.min(0.85, dt * 4.5);
      }

      nextVx += roadFwd.x * longDelta;
      nextVy += roadFwd.y * longDelta;
      nextVz += roadFwd.z * longDelta;

      // Clamp max forward & reverse speed
      const newVel = new THREE.Vector3(nextVx, nextVy, nextVz);
      const newFwd = newVel.dot(roadFwd);
      if (newFwd > maxSpeedMs) {
        newVel.addScaledVector(roadFwd, maxSpeedMs - newFwd);
      } else if (newFwd < -maxRevMs) {
        newVel.addScaledVector(roadFwd, -maxRevMs - newFwd);
      }

      // Tire lateral friction & drifting
      const grip = input.handbrake ? spec.driftLateralGrip : spec.maxLateralGrip;
      const latKill = Math.min(1, grip * dt);
      newVel.addScaledVector(roadRight, -lateralSpeed * latKill);

      // Gentle downforce at high speed to keep supercars planted over bumps
      if (Math.abs(forwardSpeed) > 18) {
        newVel.y -= spec.downforceCoeff * Math.min(1, Math.abs(forwardSpeed) / 70) * dt * 1.6;
      }

      nextVx = newVel.x;
      nextVy = newVel.y;
      nextVz = newVel.z;

      // Skid intensity telemetry for sound & smoke
      v.skidIntensity =
        Math.abs(forwardSpeed) > 7 && (input.handbrake || Math.abs(lateralSpeed) > 4.2)
          ? Math.min(1, (Math.abs(lateralSpeed) + (input.handbrake ? 5 : 0)) / 16)
          : 0;
    } else {
      v.skidIntensity = 0;
    }

    body.setLinvel({ x: nextVx, y: nextVy, z: nextVz }, true);

    // Steering Yaw + Slope/Upright Alignment Torque (no wild tumbling or bike falling over)
    const speedFactor = Math.min(1, Math.abs(forwardSpeed) / 5.5);
    const reverseSign = forwardSpeed >= -0.35 ? 1 : -1;
    const driftSteerMult = input.handbrake ? 1.32 : 1.0;
    const targetYawRate = isGrounded
      ? -input.steer * v.def.handling * speedFactor * driftSteerMult * reverseSign
      : -input.steer * 0.4;

    // Desired upright alignment toward terrain normal (vertical world up for 2-wheelers & tall trucks)
    const targetUp = spec.isTwoWheeler
      ? new THREE.Vector3(0, 1, 0)
      : avgNormal.clone().lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();

    const alignAxis = new THREE.Vector3().crossVectors(up, targetUp);
    const alignStrength = isGrounded ? 10.5 : 3.2;

    body.setAngvel(
      {
        x: THREE.MathUtils.clamp(av.x * 0.72 + alignAxis.x * alignStrength, -4, 4),
        y: targetYawRate,
        z: THREE.MathUtils.clamp(av.z * 0.72 + alignAxis.z * alignStrength, -4, 4)
      },
      true
    );

    // Gear & RPM telemetry
    const speedRatio = Math.min(1, Math.abs(forwardSpeed) / maxSpeedMs);
    v.gear = forwardSpeed < -0.5 ? 0 : Math.min(6, Math.max(1, Math.ceil(speedRatio * 6)));
    const gearSpan = 1 / 6;
    const gearLocal = v.gear === 0 ? speedRatio * 3 : (speedRatio - (v.gear - 1) * gearSpan) / gearSpan;
    v.rpmNorm =
      Math.abs(forwardSpeed) < 0.25 && !input.throttle
        ? 0.14
        : Math.min(1, Math.max(0.24, gearLocal * 0.78 + (input.throttle ? 0.22 : 0)));
  }

  private stepHelicopterForces(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number,
    hasFuel: boolean
  ): void {
    const body = v.physicsHandle!.body;
    const t = body.translation();
    const lv = body.linvel();
    const r = body.rotation();

    this.tmpQuat.set(r.x, r.y, r.z, r.w);
    this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ');
    const yaw = this.tmpEuler.y;

    // Engine & Rotor RPM spooling
    if (!hasFuel) v.heliEngineOn = false;
    if (v.heliEngineOn) {
      v.heliRotorRpm = Math.min(1, v.heliRotorRpm + dt * 0.58);
    } else {
      v.heliRotorRpm = Math.max(0, v.heliRotorRpm - dt * 0.32);
    }

    const liftReady = THREE.MathUtils.smoothstep(v.heliRotorRpm, 0.55, 0.88);
    const groundHit = this.physics!.castWheelRay(t.x, t.y + 0.5, t.z, 0, -1, 0, 2.2, body);
    const distToSurface = groundHit ? groundHit.toi - 0.5 : 99;
    const isOnGround = distToSurface <= 0.22;

    if (input.heliLand) {
      v.heliAutoLanding = true;
      v.heliHover = false;
    }

    // Cyclic input: combine dedicated cyclic + fallback W/S throttle/brake
    const cyclicY =
      Math.abs(input.heliCyclicY) > 0.05
        ? input.heliCyclicY
        : (input.throttle ? 1 : 0) - (input.brakeReverse ? 1 : 0);
    const cyclicX = Math.abs(input.heliCyclicX) > 0.05 ? input.heliCyclicX : 0;
    const yawIn = Math.abs(input.heliYaw) > 0.05 ? input.heliYaw : input.steer;

    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    let vx = lv.x;
    let vy = lv.y;
    let vz = lv.z;

    const GRAVITY = 9.81;

    if (v.heliEngineOn && liftReady > 0.15) {
      // Vertical Collective Thrust (gravity already integrated by Rapier world at -9.81)
      let desiredLiftAccel = GRAVITY * 0.96 * liftReady;

      if (input.ascend) {
        v.heliAutoLanding = false;
        desiredLiftAccel = GRAVITY + 11.5 * liftReady;
        v.heliHoverTargetY = t.y;
      } else if (input.descend) {
        v.heliAutoLanding = false;
        desiredLiftAccel = Math.max(0, GRAVITY - 10.5);
        v.heliHoverTargetY = t.y;
      } else if (v.heliAutoLanding) {
        if (isOnGround && Math.abs(vy) < 1.2) {
          // Safely settled on ground/helipad
          vx *= Math.max(0, 1 - dt * 8);
          vz *= Math.max(0, 1 - dt * 8);
          vy = Math.min(0, vy);
          desiredLiftAccel = 0;
        } else {
          // Controlled smooth auto-descent
          const targetVy = -4.2;
          desiredLiftAccel = GRAVITY + (targetVy - vy) * 4.5;
          vx *= Math.max(0, 1 - dt * 2.5);
          vz *= Math.max(0, 1 - dt * 2.5);
        }
      } else if (v.heliHover && !isOnGround) {
        // Altitude hold PID hover
        const altErr = v.heliHoverTargetY - t.y;
        const targetVy = THREE.MathUtils.clamp(altErr * 2.6, -7, 9);
        desiredLiftAccel = (GRAVITY + (targetVy - vy) * 5.2) * liftReady;
      } else if (!isOnGround) {
        v.heliHoverTargetY = t.y;
      }

      // Compensate Rapier's -9.81 gravity integration
      vy += desiredLiftAccel * dt;

      // Vertical aerodynamic damping & ceiling cap
      if (input.ascend && vy > 18) vy = 18;
      if (input.descend && vy < -15) vy = -15;
      if (t.y > 155 && vy > 0) vy *= 0.7;

      // Cyclic Horizontal Thrust (only effective when airborne or lifting off)
      const cyclicAuthority = (isOnGround ? 0.25 : 1.0) * liftReady;
      const accelMag = v.def.acceleration * 1.15 * cyclicAuthority;
      vx += (fwdX * cyclicY + rightX * cyclicX) * accelMag * dt;
      vz += (fwdZ * cyclicY + rightZ * cyclicX) * accelMag * dt;
    } else {
      // Engine off: rotor autorotation damping only
      if (v.heliRotorRpm > 0.2 && vy < -4) {
        vy += v.heliRotorRpm * 3.5 * dt;
      }
      if (isOnGround) {
        vx *= Math.max(0, 1 - dt * 4.5);
        vz *= Math.max(0, 1 - dt * 4.5);
      }
    }

    // Air resistance & speed cap (stronger natural flare damping when cyclic stick is centered)
    const horizSpeed = Math.hypot(vx, vz);
    const baseDrag = Math.abs(cyclicX) < 0.05 && Math.abs(cyclicY) < 0.05 ? 0.95 : 0.48;
    const drag = (baseDrag + horizSpeed * 0.0085) * dt;
    const dragScale = Math.max(0, 1 - drag);
    vx *= dragScale;
    vz *= dragScale;

    const postHoriz = Math.hypot(vx, vz);
    if (postHoriz > maxSpeedMs) {
      const s = maxSpeedMs / postHoriz;
      vx *= s;
      vz *= s;
    }

    body.setLinvel({ x: vx, y: vy, z: vz }, true);

    // Keep helicopter physics collider upright while applying yaw angular velocity
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tmpQuat);
    const uprightAxis = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0));
    const yawRate = v.heliRotorRpm > 0.35 ? -yawIn * v.def.handling * 0.88 : 0;

    body.setAngvel(
      {
        x: uprightAxis.x * 12,
        y: yawRate,
        z: uprightAxis.z * 12
      },
      true
    );

    // Visual fuselage pitch & roll lean into flight direction
    const airFactor = isOnGround ? 0.15 : liftReady;
    const targetPitch = cyclicY * 0.26 * airFactor;
    const targetRoll = cyclicX * 0.26 * airFactor;
    v.pitchX += (targetPitch - v.pitchX) * Math.min(1, dt * 6);
    v.rollZ += (targetRoll - v.rollZ) * Math.min(1, dt * 6);

    v.gear = 1;
    v.rpmNorm = v.heliEngineOn
      ? Math.min(1, 0.35 + v.heliRotorRpm * 0.45 + (input.ascend || Math.abs(cyclicY) > 0.2 ? 0.2 : 0))
      : v.heliRotorRpm * 0.35;
    v.skidIntensity = 0;

    // Prevent underwater sinking below seafloor
    const minWorldY = world.getMountainBaseHeight(t.x, t.z);
    if (t.y < minWorldY - 0.5) {
      body.setTranslation({ x: t.x, y: minWorldY + 0.1, z: t.z }, true);
    }
  }

  private stepGeneralAircraftForces(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    _world: WorldBuilder,
    maxSpeedMs: number,
    hasFuel: boolean
  ): void {
    const body = v.physicsHandle!.body;
    const lv = body.linvel();
    const r = body.rotation();
    this.tmpQuat.set(r.x, r.y, r.z, r.w);
    this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ');
    const yaw = this.tmpEuler.y;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    let fSpeed = lv.x * fwdX + lv.z * fwdZ;
    if (hasFuel && input.throttle) fSpeed += v.def.acceleration * dt;
    else if (hasFuel && input.brakeReverse) fSpeed -= v.def.acceleration * 0.7 * dt;
    else fSpeed *= Math.max(0, 1 - dt * 0.75);
    fSpeed = THREE.MathUtils.clamp(fSpeed, -14, maxSpeedMs);

    let vy = lv.y;
    // Counteract gravity when powered flight / hover
    vy += 9.81 * dt;
    if (input.ascend) vy += (14 - vy) * Math.min(1, dt * 6);
    else if (input.descend) vy += (-14 - vy) * Math.min(1, dt * 6);
    else if (v.def.modelShape === 'airplane' && fSpeed > 24) vy += (5.2 - vy) * Math.min(1, dt * 3);
    else vy *= Math.max(0, 1 - dt * 4.5);

    body.setLinvel({ x: fwdX * fSpeed, y: vy, z: fwdZ * fSpeed }, true);

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tmpQuat);
    const uprightAxis = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0));
    body.setAngvel(
      {
        x: uprightAxis.x * 10,
        y: -input.steer * v.def.handling * 0.85,
        z: uprightAxis.z * 10
      },
      true
    );

    v.pitchX += ((input.ascend ? -0.18 : input.descend ? 0.16 : 0) - v.pitchX) * Math.min(1, dt * 5);
    v.rollZ += (input.steer * 0.25 - v.rollZ) * Math.min(1, dt * 5);
    v.gear = 1;
    v.rpmNorm = Math.min(1, 0.35 + (Math.abs(fSpeed) / maxSpeedMs) * 0.65);
    v.skidIntensity = 0;
  }

  private stepBoatForces(
    v: ActiveVehicle,
    dt: number,
    input: VehicleInputState,
    world: WorldBuilder,
    maxSpeedMs: number,
    hasFuel: boolean
  ): void {
    const body = v.physicsHandle!.body;
    const t = body.translation();
    const lv = body.linvel();
    const r = body.rotation();
    this.tmpQuat.set(r.x, r.y, r.z, r.w);
    this.tmpEuler.setFromQuaternion(this.tmpQuat, 'YXZ');
    const yaw = this.tmpEuler.y;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    const inWater = world.isWaterAt(t.x, t.z);
    const effectiveMax = inWater ? maxSpeedMs : maxSpeedMs * 0.18;
    let fSpeed = lv.x * fwdX + lv.z * fwdZ;

    if (hasFuel && input.throttle) fSpeed += v.def.acceleration * dt;
    else if (hasFuel && input.brakeReverse) fSpeed -= v.def.braking * 0.6 * dt;
    else fSpeed *= Math.max(0, 1 - dt * 1.2);
    fSpeed = THREE.MathUtils.clamp(fSpeed, -8, effectiveMax);

    let vy = lv.y;
    if (inWater) {
      const targetY = -0.14;
      const err = targetY - t.y;
      vy = lv.y * 0.8 + (9.81 + err * 24 - lv.y * 4) * dt;
    }

    body.setLinvel({ x: fwdX * fSpeed, y: vy, z: fwdZ * fSpeed }, true);

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tmpQuat);
    const uprightAxis = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0));
    body.setAngvel(
      {
        x: uprightAxis.x * 10,
        y: -input.steer * v.def.handling * 0.9,
        z: uprightAxis.z * 10
      },
      true
    );

    v.gear = Math.min(4, Math.max(1, Math.ceil((Math.abs(fSpeed) / Math.max(1, effectiveMax)) * 4)));
    v.rpmNorm = Math.min(1, 0.2 + (Math.abs(fSpeed) / Math.max(1, effectiveMax)) * 0.8);
    v.skidIntensity = 0;
  }

  private animateVehicleRig(v: ActiveVehicle, dt: number, input: VehicleInputState, timeSec: number): void {
    v.rig.group.position.copy(v.pos);
    if (v.physicsHandle) {
      const r = v.physicsHandle.body.rotation();
      v.rig.group.quaternion.set(r.x, r.y, r.z, r.w);
    } else {
      v.rig.group.rotation.y = v.rotY;
    }

    if (v.isHelicopter || v.def.canFly) {
      v.rig.bodyGroup.rotation.x = v.pitchX;
      v.rig.bodyGroup.rotation.z = v.rollZ;
      v.rig.bodyGroup.position.y = 0;
    } else {
      // Visual suspension pitch, cornering roll, & bike lean
      const targetRoll =
        v.def.category === 'motorcycle' && v.def.modelShape !== 'atv'
          ? input.steer * Math.min(0.42, Math.abs(v.speed) * 0.018)
          : -input.steer * Math.min(0.08, Math.abs(v.speed) * 0.003) / v.def.suspensionStiffness;
      const targetPitch =
        (input.brakeReverse && v.speed > 2 ? 0.05 : input.throttle ? -0.04 : 0) / v.def.suspensionStiffness;

      v.rig.bodyGroup.rotation.z += (targetRoll - v.rig.bodyGroup.rotation.z) * Math.min(1, dt * 8);
      v.rig.bodyGroup.rotation.x += (targetPitch - v.rig.bodyGroup.rotation.x) * Math.min(1, dt * 8);
      v.rig.bodyGroup.position.y += (v.suspensionOffsetY - v.rig.bodyGroup.position.y) * Math.min(1, dt * 14);
    }

    // Wheel spin & steering
    if (v.def.category === 'creature' || v.def.modelShape === 'robot_ai') {
      const stride = Math.abs(v.speed) > 0.5 ? Math.sin(timeSec * 10) * 0.55 : 0;
      v.rig.wheels.forEach((leg, i) => {
        leg.rotation.x = i % 2 === 0 ? stride : -stride;
      });
    } else {
      const spin = (v.speed / Math.max(0.2, v.def.wheelRadius)) * dt;
      v.wheelSpinRad += spin;
      for (const w of v.rig.wheels) {
        w.rotation.x += spin;
      }
      for (const fp of v.rig.frontWheelPivots) {
        fp.rotation.y = -v.steerAngle;
      }
    }

    // Rotor rotation scaled accurately by helicopter RPM
    const rotorFactor = v.isHelicopter ? v.heliRotorRpm : 1.0;
    if (v.rig.rotorMain) v.rig.rotorMain.rotation.y += dt * 34 * rotorFactor;
    if (v.rig.rotorTail) v.rig.rotorTail.rotation.x += dt * 42 * rotorFactor;

    if (v.rig.wings && v.rig.wings.length === 2) {
      const flap = Math.sin(timeSec * 7.5) * 0.45;
      v.rig.wings[0].rotation.z = flap;
      v.rig.wings[1].rotation.z = -flap;
    }

    for (const fl of v.rig.nitroFlames) {
      fl.visible = Boolean(v.nitroActive || (v.def.canFly && !v.isHelicopter && input.throttle));
      if (fl.visible) {
        fl.scale.y = 0.8 + Math.random() * 0.65;
      }
    }

    if (v.rig.electricAura) {
      v.rig.electricAura.visible = v.nitroActive || Math.abs(v.speed) > 18;
      v.rig.electricAura.rotation.z += dt * 3;
    }

    if (v.rig.sirenBar) {
      const flash = Math.floor(timeSec * 8) % 2 === 0;
      v.rig.sirenBar.red.visible = flash;
      v.rig.sirenBar.blue.visible = !flash;
    }
  }

  private updateTrails(v: ActiveVehicle, dt: number): void {
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
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
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

  private updateParticles(v: ActiveVehicle, dt: number): void {
    this.particleTimer += dt;
    const isDamaged = v.health < v.def.maxHealth * 0.45;
    const isSkidding = v.skidIntensity > 0.28;
    const isHeliWash = v.isHelicopter && v.heliRotorRpm > 0.72 && v.altitudeM < 5.5;

    if ((isDamaged || isSkidding || isHeliWash) && this.particleTimer > 0.06 && this.particles.length < 48) {
      this.particleTimer = 0;
      const color = isDamaged && !isSkidding ? '#334155' : '#CBD5E1';
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      const fwdX = Math.sin(v.rotY);
      const fwdZ = Math.cos(v.rotY);
      const px = isHeliWash
        ? v.pos.x + (Math.random() - 0.5) * 3.5
        : v.pos.x - fwdX * (v.def.length * 0.35) + (Math.random() - 0.5) * 0.9;
      const py = isHeliWash ? Math.max(0.2, v.pos.y - v.altitudeM + 0.3) : v.pos.y + 0.35;
      const pz = isHeliWash
        ? v.pos.z + (Math.random() - 0.5) * 3.5
        : v.pos.z - fwdZ * (v.def.length * 0.35) + (Math.random() - 0.5) * 0.9;
      mesh.position.set(px, py, pz);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * (isHeliWash ? 5 : 1.5),
          isDamaged ? 2.6 : 1.2,
          (Math.random() - 0.5) * (isHeliWash ? 5 : 1.5)
        ),
        life: 0.65,
        maxLife: 0.65
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mat.dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        const s = 1 + (1 - p.life / p.maxLife) * 1.6;
        p.mesh.scale.setScalar(s);
        p.mat.opacity = (p.life / p.maxLife) * 0.5;
      }
    }
  }
}
