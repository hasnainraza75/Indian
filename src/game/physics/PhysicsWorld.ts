import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { VehicleDef } from '../types';
import { StaticBoxCollider, WorldBuilder } from '../world/WorldBuilder';

export const GROUP_WORLD = 0x0001;
export const GROUP_VEHICLE = 0x0002;
export const GROUP_PLAYER = 0x0004;
export const GROUP_TRAFFIC = 0x0008;
export const GROUP_DOOR = 0x0010;
export const GROUP_ALL = 0xffff;

export function makeGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

let rapierInitPromise: Promise<void> | null = null;
export async function ensureRapierInit(): Promise<void> {
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init();
  }
  await rapierInitPromise;
}

export interface VehiclePhysicsSpec {
  massKg: number;
  maxLateralGrip: number;
  driftLateralGrip: number;
  suspensionRestLen: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  dragCoeff: number;
  downforceCoeff: number;
  isTwoWheeler: boolean;
}

export function getVehiclePhysicsSpec(def: VehicleDef): VehiclePhysicsSpec {
  const isBike = def.category === 'motorcycle' && def.modelShape !== 'atv';
  let massKg = 1450;
  if (def.modelShape === 'cycle') massKg = 25;
  else if (isBike) massKg = def.modelShape === 'cruiser_bike' ? 230 : 195;
  else if (def.modelShape === 'atv') massKg = 340;
  else if (def.modelShape === 'rickshaw') massKg = 380;
  else if (def.category === 'car') massKg = def.modelShape === 'hypercar' || def.modelShape === 'supercar' ? 1420 : 1650;
  else if (def.category === 'suv') massKg = 2350;
  else if (def.modelShape === 'tractor') massKg = 4200;
  else if (def.modelShape === 'jcb') massKg = 7800;
  else if (def.modelShape === 'monster_truck') massKg = 4900;
  else if (def.modelShape === 'bus') massKg = 12500;
  else if (def.modelShape === 'truck' || def.modelShape === 'fire_truck') massKg = 10500;
  else if (def.modelShape === 'truck_trailer') massKg = 16500;
  else if (def.modelShape === 'tank') massKg = 42000;
  else if (def.modelShape === 'helicopter' || def.modelShape === 'apache') massKg = 2400;
  else if (def.modelShape === 'heicarrier') massKg = 18000;
  else if (def.modelShape === 'airplane') massKg = 3400;
  else if (def.modelShape === 'boat') massKg = 1900;
  else if (def.category === 'creature') massKg = def.id === 'elephant' || def.id === 'trex' ? 4500 : 650;

  const restLen = def.modelShape === 'monster_truck' ? 0.55 : isBike ? 0.28 : 0.35;
  const gripBase = isBike ? 13.0 : def.category === 'car' ? 12.5 : def.category === 'suv' ? 10.5 : 8.8;

  return {
    massKg,
    maxLateralGrip: gripBase * def.suspensionStiffness,
    driftLateralGrip: gripBase * 0.24,
    suspensionRestLen: restLen,
    suspensionStiffness: 42 * def.suspensionStiffness,
    suspensionDamping: 6.5,
    dragCoeff: def.category === 'heavy' ? 0.0042 : 0.0018,
    downforceCoeff: def.modelShape === 'hypercar' || def.modelShape === 'supercar' ? 2.4 : 0.65,
    isTwoWheeler: isBike
  };
}

export interface RapierVehicleHandle {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  spec: VehiclePhysicsSpec;
  localMinY: number;
}

export interface RapierPlayerHandle {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  capsuleCenterOffsetY: number;
}

export class PhysicsWorld {
  readonly rapier: RAPIER.World;
  private doorColliders = new Map<string, RAPIER.Collider>();
  private tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private tmpQuat = new THREE.Quaternion();

  private constructor(worldBuilder: WorldBuilder) {
    this.rapier = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.rapier.timestep = 1 / 60;
    this.rapier.maxCcdSubsteps = 4;
    this.rapier.numSolverIterations = 6;
    this.buildStaticGeometry(worldBuilder);
  }

  static async create(worldBuilder: WorldBuilder): Promise<PhysicsWorld> {
    await ensureRapierInit();
    return new PhysicsWorld(worldBuilder);
  }

  private buildStaticGeometry(worldBuilder: WorldBuilder): void {
    // 1. Exact Terrain Trimesh + Safety Flat Ground Plane below sea level
    if (worldBuilder.terrainMeshData && worldBuilder.terrainMeshData.vertices.length > 0) {
      const terrainDesc = RAPIER.ColliderDesc.trimesh(
        worldBuilder.terrainMeshData.vertices,
        worldBuilder.terrainMeshData.indices
      )
        .setFriction(0.85)
        .setRestitution(0.05)
        .setCollisionGroups(makeGroups(GROUP_WORLD, GROUP_ALL));
      this.rapier.createCollider(terrainDesc);
    } else {
      const floorDesc = RAPIER.ColliderDesc.cuboid(520, 0.5, 520)
        .setTranslation(0, -0.5, 0)
        .setFriction(0.85)
        .setCollisionGroups(makeGroups(GROUP_WORLD, GROUP_ALL));
      this.rapier.createCollider(floorDesc);
    }

    // 2. Exact 3D Static Boxes (Buildings, Walls, Bridges, Flyovers, Ramps, Mansion, Doors)
    for (const box of worldBuilder.staticBoxes) {
      this.addStaticBox(box);
    }

    // 3. Exact 3D Static Cylinders (Trees, ATC Tower, Helipad, Light Poles)
    for (const cyl of worldBuilder.staticCylinders) {
      const desc = RAPIER.ColliderDesc.cylinder(cyl.halfHeight, cyl.radius)
        .setTranslation(cyl.x, cyl.y, cyl.z)
        .setFriction(0.5)
        .setRestitution(0.1)
        .setCollisionGroups(makeGroups(GROUP_WORLD, GROUP_ALL));
      this.rapier.createCollider(desc);
    }
  }

  private addStaticBox(box: StaticBoxCollider): void {
    this.tmpEuler.set(box.rotX ?? 0, box.rotY ?? 0, box.rotZ ?? 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);

    const group = box.isDoor ? GROUP_DOOR : GROUP_WORLD;
    const desc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.05, box.hx),
      Math.max(0.05, box.hy),
      Math.max(0.05, box.hz)
    )
      .setTranslation(box.cx, box.cy, box.cz)
      .setRotation({ x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w })
      .setFriction(0.55)
      .setRestitution(0.08)
      .setCollisionGroups(makeGroups(group, GROUP_ALL));

    const col = this.rapier.createCollider(desc);
    if (box.isDoor && box.id) {
      this.doorColliders.set(box.id, col);
    }
  }

  setDoorOpen(id: string, open: boolean): void {
    const col = this.doorColliders.get(id);
    if (col) {
      col.setEnabled(!open);
    }
  }

  createPlayerController(x: number, y: number, z: number): RapierPlayerHandle {
    const capsuleCenterOffsetY = 0.82; // halfHeight 0.44 + radius 0.38 = 0.82m from feet
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + capsuleCenterOffsetY, z);
    const body = this.rapier.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.capsule(0.44, 0.38)
      .setCollisionGroups(makeGroups(GROUP_PLAYER, GROUP_WORLD | GROUP_DOOR | GROUP_VEHICLE | GROUP_TRAFFIC));
    const collider = this.rapier.createCollider(colDesc, body);

    const controller = this.rapier.createCharacterController(0.04);
    controller.enableAutostep(0.58, 0.25, true);
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((58 * Math.PI) / 180);
    controller.enableSnapToGround(0.28);
    controller.setSlideEnabled(true);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(78);

    return { body, collider, controller, capsuleCenterOffsetY };
  }

  createVehicleBody(def: VehicleDef, x: number, y: number, z: number, rotY: number): RapierVehicleHandle {
    const spec = getVehiclePhysicsSpec(def);
    this.tmpEuler.set(0, rotY, 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setRotation({ x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w })
      .setCcdEnabled(true)
      .setSoftCcdPrediction(1.8)
      .setLinearDamping(def.canFly ? 0.35 : 0.05)
      .setAngularDamping(def.canFly ? 4.0 : 2.8);

    const body = this.rapier.createRigidBody(bodyDesc);

    // Match visible chassis geometry tightly without oversized invisible boxes
    const hx = Math.max(0.32, def.width * 0.44);
    const hz = Math.max(0.65, def.length * 0.46);
    const localMinY = def.canFly ? 0.08 : Math.min(0.45, Math.max(0.22, def.wheelRadius * 0.62));
    const localMaxY = Math.max(localMinY + 0.65, def.height * 0.94);
    const hy = (localMaxY - localMinY) / 2;
    const localCenterY = localMinY + hy;

    const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(0, localCenterY, 0)
      .setMass(spec.massKg)
      .setFriction(0.04) // Lateral & longitudinal tire grip is computed explicitly by wheel solver
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(0.12)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(makeGroups(GROUP_VEHICLE, GROUP_WORLD | GROUP_DOOR | GROUP_VEHICLE | GROUP_TRAFFIC | GROUP_PLAYER));

    const collider = this.rapier.createCollider(colDesc, body);

    // Prevent bikes / upright aircraft from tipping onto their sides via lock or torque
    if (spec.isTwoWheeler) {
      body.setEnabledRotations(true, true, true, true);
    }

    return { body, collider, spec, localMinY };
  }

  createKinematicTrafficBody(width: number, height: number, length: number, x: number, y: number, z: number, rotY: number): RAPIER.RigidBody {
    this.tmpEuler.set(0, rotY, 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, y, z)
      .setRotation({ x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w });
    const body = this.rapier.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(width * 0.44, height * 0.45, length * 0.45)
      .setTranslation(0, height * 0.48, 0)
      .setFriction(0.2)
      .setRestitution(0.15)
      .setCollisionGroups(makeGroups(GROUP_TRAFFIC, GROUP_VEHICLE | GROUP_PLAYER));
    this.rapier.createCollider(colDesc, body);
    return body;
  }

  updateKinematicBody(body: RAPIER.RigidBody, x: number, y: number, z: number, rotY: number): void {
    this.tmpEuler.set(0, rotY, 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);
    body.setNextKinematicTranslation({ x, y, z });
    body.setNextKinematicRotation({ x: this.tmpQuat.x, y: this.tmpQuat.y, z: this.tmpQuat.z, w: this.tmpQuat.w });
  }

  removeBody(body: RAPIER.RigidBody | undefined | null): void {
    if (!body) return;
    if (this.rapier.bodies.contains(body.handle)) {
      this.rapier.removeRigidBody(body);
    }
  }

  castWheelRay(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    excludeBody: RAPIER.RigidBody
  ): { toi: number; normal: { x: number; y: number; z: number } } | null {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    const hit = this.rapier.castRayAndGetNormal(
      ray,
      maxDist,
      true,
      undefined,
      makeGroups(GROUP_ALL, GROUP_WORLD | GROUP_DOOR | GROUP_VEHICLE | GROUP_TRAFFIC),
      undefined,
      excludeBody
    );
    if (!hit) return null;
    return { toi: hit.timeOfImpact, normal: hit.normal };
  }

  castCameraRay(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number
  ): number | null {
    const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.rapier.castRay(
      ray,
      maxDist,
      true,
      undefined,
      makeGroups(GROUP_ALL, GROUP_WORLD | GROUP_DOOR)
    );
    return hit ? hit.timeOfImpact : null;
  }

  castGroundHeightRay(x: number, fromY: number, z: number, maxDist = 200): number | null {
    const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
    const hit = this.rapier.castRay(
      ray,
      maxDist,
      true,
      undefined,
      makeGroups(GROUP_ALL, GROUP_WORLD | GROUP_DOOR)
    );
    return hit ? fromY - hit.timeOfImpact : null;
  }

  step(dt: number): void {
    this.rapier.timestep = dt;
    this.rapier.step();
  }

  free(): void {
    this.rapier.free();
  }
}
