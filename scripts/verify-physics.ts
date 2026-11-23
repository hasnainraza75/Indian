import * as THREE from 'three';
import { VEHICLES } from '../src/game/data/vehiclesData';
import { createVehicleRig } from '../src/game/entities/MeshFactory';
import { PhysicsWorld } from '../src/game/physics/PhysicsWorld';
import { CameraSystem } from '../src/game/systems/CameraSystem';
import { PlayerController } from '../src/game/systems/PlayerController';
import { TrafficAndNpcSystem } from '../src/game/systems/TrafficAndNpcSystem';
import { VehicleInputState, VehicleSystem } from '../src/game/systems/VehiclePhysics';
import { WorldBuilder } from '../src/game/world/WorldBuilder';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

const ZERO_CHEATS = {
  infinityHealth: false,
  superJump: false,
  ultraSuperJump: false,
  slowMotion: false,
  moonGravity: false,
  nightMode: false
};

const EMPTY_VEH_INPUT: VehicleInputState = {
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

function stepGroundVehicle(
  vSystem: VehicleSystem,
  physics: PhysicsWorld,
  world: WorldBuilder,
  vId: string,
  steps: number,
  input: VehicleInputState,
  startX = 0,
  startZ = 0,
  rotY = 0
) {
  const startY = world.getGroundHeight(startX, startZ, 2) + 0.12;
  const v = vSystem.spawnVehicle(vId, startX, startY, startZ, rotY)!;
  assert(Boolean(v), `Failed to spawn ${vId}`);
  const dt = 1 / 60;
  let impacts = 0;
  for (let i = 0; i < steps; i++) {
    const prevVel = v.vel.clone();
    vSystem.prepareVehiclePhysicsStep(v, dt, input, world);
    physics.step(dt);
    vSystem.syncPostPhysicsStep(v, dt, prevVel, input, world, i * dt, () => {
      impacts++;
    });
  }
  return { v, impacts };
}

async function run() {
  console.log('=== 1. BUILDING WORLD & RAPIER 3D PHYSICS ===');
  const scene = new THREE.Scene();
  const world = new WorldBuilder(scene);
  world.build('high');
  const physics = await PhysicsWorld.create(world);

  // Test 1: Material solidity & opacity on all world buildings/objects + vehicles
  let transparentSolidMeshes = 0;
  scene.traverse((obj) => {
    const m = (obj as THREE.Mesh).material;
    if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    for (const mat of mats) {
      const isStandardBuildingMat = mat instanceof THREE.MeshStandardMaterial && obj.type === 'Mesh';
      const isWater = isStandardBuildingMat && mat.color.getHexString() === '0284c7';
      if (isStandardBuildingMat && !isWater && (mat.transparent || mat.opacity < 0.99 || !mat.depthWrite || !mat.depthTest)) {
        transparentSolidMeshes++;
      }
    }
  });
  assert(transparentSolidMeshes === 0, `Found ${transparentSolidMeshes} unexpectedly transparent solid world meshes!`);
  console.log('PASS: All world buildings, walls, floors, roofs & bridges are 100% opaque & depthWrite=true.');

  for (const def of VEHICLES) {
    if (def.isInvisible) continue;
    const rig = createVehicleRig(def);
    rig.group.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          assert(!mat.transparent && mat.opacity === 1 && mat.depthWrite, `Vehicle ${def.id} has transparent material!`);
        }
      }
    });
  }
  console.log(`PASS: Verified opaque solid materials across all ${VEHICLES.length} vehicles.`);

  // Test 2: Player building collision, Mansion door toggle, and Staircase climb
  console.log('\n=== 2. PLAYER WALL COLLISION, DOOR TOGGLE & STAIRCASE ===');
  const player = new PlayerController(scene);
  player.attachPhysics(physics);

  // Walk straight into Mansion back wall at z = -144 (from outside z = -148 facing +Z -> moveY=1 with camYaw=Math.PI)
  player.setPosition(-145, 0.2, -148);
  for (let i = 0; i < 120; i++) {
    player.update(1 / 60, { moveX: 0, moveY: 1, sprint: true, jumpPressed: false, crouchToggle: false }, Math.PI, world, ZERO_CHEATS, 'fists', false);
    physics.step(1 / 60);
  }
  assert(player.pos.z < -144.2, `Player clipped through Mansion back wall! pos.z=${player.pos.z}`);
  console.log(`PASS: Player stopped solidly outside Mansion back wall (z=${player.pos.z.toFixed(2)} < -144.2).`);

  // Walk into skyscraper at (-45, -45), bounds x: -56.15..-33.85, z: -56.15..-33.85
  player.setPosition(-45, 0.2, -62);
  for (let i = 0; i < 120; i++) {
    player.update(1 / 60, { moveX: 0, moveY: 1, sprint: true, jumpPressed: false, crouchToggle: false }, Math.PI, world, ZERO_CHEATS, 'fists', false);
    physics.step(1 / 60);
  }
  assert(player.pos.z < -56.15, `Player clipped into Skyscraper (-45,-45)! pos.z=${player.pos.z}`);
  console.log(`PASS: Player stopped solidly outside Skyscraper (z=${player.pos.z.toFixed(2)} < -56.15).`);

  // Closed door blocks entry vs Open door allows entry + stair climb
  player.setPosition(-145, 0.25, -123.5);
  physics.setDoorOpen('mansion_front_door', false);
  for (let i = 0; i < 90; i++) {
    player.update(1 / 60, { moveX: 0, moveY: 1, sprint: false, jumpPressed: false, crouchToggle: false }, 0, world, ZERO_CHEATS, 'fists', false);
    physics.step(1 / 60);
  }
  assert(player.pos.z > -126.1, `Player walked through closed Mansion door! z=${player.pos.z}`);

  physics.setDoorOpen('mansion_front_door', true);
  for (let i = 0; i < 120; i++) {
    player.update(1 / 60, { moveX: 0, moveY: 1, sprint: false, jumpPressed: false, crouchToggle: false }, 0, world, ZERO_CHEATS, 'fists', false);
    physics.step(1 / 60);
  }
  assert(player.pos.z < -127.5, `Player could not enter Mansion with open door! z=${player.pos.z}`);

  // Climb Mansion stairs from bottom approach (x=-143.5, z=-129.2) toward top (z=-139)
  player.setPosition(-143.5, 0.26, -129.2);
  for (let i = 0; i < 180; i++) {
    player.update(1 / 60, { moveX: 0, moveY: 1, sprint: false, jumpPressed: false, crouchToggle: false }, 0, world, ZERO_CHEATS, 'fists', false);
    physics.step(1 / 60);
  }
  assert(player.pos.y > 3.5, `Player failed to climb Mansion stairs! y=${player.pos.y}, z=${player.pos.z}`);
  console.log(`PASS: Player Mansion door open/closed + stair climb works cleanly (climbed to y=${player.pos.y.toFixed(2)}m).`);

  // Test 3: Every single vehicle in VEHICLES + Building/Barrier/Tree/Traffic Collision + Speeds
  console.log('\n=== 3. ALL VEHICLES PHYSICS, SPEEDS & BUILDING COLLISION ===');
  const vSystem = new VehicleSystem(scene, physics);

  // Verify every single vehicle in VEHICLES accelerates, steers, reverses, and never falls through ground
  const speedMap = new Map<string, number>();
  for (const def of VEHICLES) {
    vSystem.clearAll();
    const startX = def.canFloat ? 210 : 0;
    const startZ = def.canFloat ? 40 : -120;
    const { v } = stepGroundVehicle(
      vSystem,
      physics,
      world,
      def.id,
      150, // 2.5s acceleration
      { ...EMPTY_VEH_INPUT, throttle: true, ascend: def.canFly && !['helicopter', 'police_helicopter', 'apache'].includes(def.id) },
      startX,
      startZ,
      0
    );
    if (v.isHelicopter) {
      // Helicopter engine off should stay parked on ground
      assert(v.altitudeM < 1.0, `Helicopter ${def.id} lifted off with engine OFF!`);
      speedMap.set(def.id, 0);
      continue;
    }
    const kmh = Math.abs(v.speed) * 3.6;
    assert(kmh > 5, `Vehicle ${def.id} failed to accelerate! kmh=${kmh}`);
    assert(v.pos.y > -5, `Vehicle ${def.id} fell through world! y=${v.pos.y}`);
    speedMap.set(def.id, kmh);

    // Test brake + reverse on non-flying ground vehicles
    if (!def.canFly && !def.canFloat) {
      for (let i = 0; i < 180; i++) {
        const prevVel = v.vel.clone();
        vSystem.prepareVehiclePhysicsStep(v, 1 / 60, { ...EMPTY_VEH_INPUT, brakeReverse: true }, world);
        physics.step(1 / 60);
        vSystem.syncPostPhysicsStep(v, 1 / 60, prevVel, { ...EMPTY_VEH_INPUT, brakeReverse: true }, world, 0, () => {});
      }
      assert(v.speed < -0.5 && v.gear === 0, `Vehicle ${def.id} failed to reverse! speed=${v.speed}, gear=${v.gear}`);
    }
  }
  console.log(`PASS: All ${VEHICLES.length} vehicles accelerated, maintained ground contact, and reversed cleanly.`);

  // Verify balanced top speed hierarchy (supercar > suv > tractor/bus)
  assert((speedMap.get('lamborghini') ?? 0) > (speedMap.get('fortuner') ?? 0), 'Lamborghini should outpace Fortuner!');
  assert((speedMap.get('fortuner') ?? 0) > (speedMap.get('tractor') ?? 0), 'Fortuner should outpace Tractor!');
  assert((speedMap.get('ninja_h2r') ?? 0) > (speedMap.get('city_bus') ?? 0), 'Ninja H2R should outpace BEST Bus!');
  console.log(
    `PASS: Distinct balanced vehicle speeds verified (H2R 2.5s=${speedMap.get('ninja_h2r')?.toFixed(1)} km/h, ` +
    `Lambo=${speedMap.get('lamborghini')?.toFixed(1)} km/h, Bus=${speedMap.get('city_bus')?.toFixed(1)} km/h, ` +
    `Tractor=${speedMap.get('tractor')?.toFixed(1)} km/h).`
  );

  // Ram representative vehicles of EVERY type at full speed + Nitro into Skyscraper (-45, -45) (z <= -56.15)
  const crashTestIds = [
    'bugatti_chiron',
    'lamborghini',
    'fortuner',
    'thar',
    'ninja_h2r',
    'bullet',
    'city_bus',
    'truck',
    'monster_truck',
    'tractor',
    'police_jeep',
    'atv'
  ];
  for (const id of crashTestIds) {
    vSystem.clearAll();
    // Start at (-45, -90) facing +Z toward Skyscraper (-45, -45) whose North wall is at z = -56.15
    const { v, impacts } = stepGroundVehicle(
      vSystem,
      physics,
      world,
      id,
      240, // 4 full seconds at full throttle + nitro straight into wall!
      { ...EMPTY_VEH_INPUT, throttle: true, nitro: true },
      -45,
      -95,
      0
    );
    assert(v.pos.z < -56.15, `Vehicle ${id} TUNNELED through Skyscraper! pos.z=${v.pos.z}`);
    assert(impacts > 0, `Vehicle ${id} registered zero collision impact against Skyscraper!`);
  }
  console.log(`PASS: All ${crashTestIds.length} representative vehicle classes collided solidly without CCD tunneling through skyscraper.`);

  // Test collision against kinematic traffic vehicle (including city_bus!)
  vSystem.clearAll();
  const trafficSys = new TrafficAndNpcSystem(scene, physics);
  trafficSys.initPopulation();
  assert(trafficSys.traffic.some((t) => t.body !== undefined), 'Traffic units missing Rapier kinematic bodies!');
  const targetTraffic = trafficSys.traffic[0];
  targetTraffic.pos.set(0, 0, 20);
  physics.updateKinematicBody(targetTraffic.body!, 0, 0, 20, 0);
  const ramCar = vSystem.spawnVehicle('fortuner', 0, 0.2, 4, 0)!;
  let ramImpacts = 0;
  for (let i = 0; i < 120; i++) {
    const pv = ramCar.vel.clone();
    vSystem.prepareVehiclePhysicsStep(ramCar, 1 / 60, { ...EMPTY_VEH_INPUT, throttle: true }, world);
    physics.updateKinematicBody(targetTraffic.body!, 0, 0, 20, 0);
    physics.step(1 / 60);
    vSystem.syncPostPhysicsStep(ramCar, 1 / 60, pv, { ...EMPTY_VEH_INPUT, throttle: true }, world, i / 60, () => {
      ramImpacts++;
    });
  }
  assert(ramImpacts > 0 && ramCar.pos.z < 20.5, `Vehicle passed through kinematic traffic vehicle! z=${ramCar.pos.z}, impacts=${ramImpacts}`);
  console.log('PASS: Player vehicle collides solidly with kinematic Traffic cars/buses.');

  // Test 4: Complete 8-Step Helicopter Flight Lifecycle
  console.log('\n=== 4. HELICOPTER 3D FLIGHT CONTROLLER LIFECYCLE ===');
  vSystem.clearAll();
  const heli = vSystem.spawnVehicle('helicopter', -275, 0.2, -235, 0)!;
  const stepHeli = (steps: number, input: VehicleInputState) => {
    for (let i = 0; i < steps; i++) {
      const pv = heli.vel.clone();
      vSystem.prepareVehiclePhysicsStep(heli, 1 / 60, input, world);
      physics.step(1 / 60);
      vSystem.syncPostPhysicsStep(heli, 1 / 60, pv, input, world, i / 60, () => {});
    }
  };

  // Step 1: Engine OFF -> Ascend does NOT lift off
  stepHeli(60, { ...EMPTY_VEH_INPUT, ascend: true });
  assert(heli.altitudeM < 0.6 && !heli.heliEngineOn, `Heli lifted with engine off! alt=${heli.altitudeM}`);

  // Step 2: Engine Start -> Rotor spools up
  vSystem.toggleHelicopterEngine(heli);
  assert(heli.heliEngineOn, 'Heli engine failed to start');
  stepHeli(120, EMPTY_VEH_INPUT); // 2 seconds spool up
  assert(heli.heliRotorRpm > 0.9, `Heli rotor failed to spool up! rpm=${heli.heliRotorRpm}`);

  // Step 3: Vertical takeoff & climb above skyscrapers (h = 42m at -45,-45)
  stepHeli(300, { ...EMPTY_VEH_INPUT, ascend: true }); // 5 seconds climb
  assert(heli.altitudeM > 45, `Heli failed to climb high enough! alt=${heli.altitudeM.toFixed(1)}m`);
  const climbAlt = heli.altitudeM;

  // Step 4: Hover stability check (2s hands-off)
  stepHeli(120, EMPTY_VEH_INPUT);
  assert(Math.abs(heli.altitudeM - climbAlt) < 1.5, `Heli failed to hover stably! delta=${(heli.altitudeM - climbAlt).toFixed(2)}m`);

  // Step 5: Fly directly OVER Skyscraper (-45, -45) while staying above roof (h = 42m)
  vSystem.teleportVehicle(heli, -45, 52, -90, 0);
  heli.heliEngineOn = true;
  heli.heliRotorRpm = 1.0;
  heli.heliHoverTargetY = 52;
  stepHeli(240, { ...EMPTY_VEH_INPUT, heliCyclicY: 1 }); // Fly forward (+Z) over building (-56..-34)
  assert(heli.pos.z > -30, `Heli was blocked above skyscraper! pos.z=${heli.pos.z.toFixed(1)}, y=${heli.pos.y.toFixed(1)}`);

  // Step 6: Backward, Left, Right cyclic & Yaw rotation
  const zAfterFwd = heli.pos.z;
  stepHeli(180, { ...EMPTY_VEH_INPUT, heliCyclicY: -1 });
  assert(heli.pos.z < zAfterFwd - 2, 'Heli backward flight failed!');
  const xBeforeStrafe = heli.pos.x;
  stepHeli(90, { ...EMPTY_VEH_INPUT, heliCyclicX: -1 });
  assert(heli.pos.x > xBeforeStrafe + 2, 'Heli left strafe failed!'); // -rightX = +X when yaw=0
  const yawBefore = heli.rotY;
  stepHeli(60, { ...EMPTY_VEH_INPUT, heliYaw: 1 });
  assert(Math.abs(heli.rotY - yawBefore) > 0.5, 'Heli yaw rotation failed!');

  // Step 7: Physical collision when flying BELOW skyscraper top into side wall
  vSystem.teleportVehicle(heli, -45, 12, -85, 0);
  heli.heliEngineOn = true;
  heli.heliRotorRpm = 1.0;
  heli.heliHoverTargetY = 12;
  stepHeli(240, { ...EMPTY_VEH_INPUT, heliCyclicY: 1 });
  assert(heli.pos.z < -56.15, `Low-flying helicopter clipped INTO skyscraper! pos.z=${heli.pos.z.toFixed(1)}`);

  // Step 8: Descend & Auto-Land safely on clear Airport apron (-275, -235)
  vSystem.teleportVehicle(heli, -275, 22, -235, 0);
  heli.heliEngineOn = true;
  heli.heliRotorRpm = 1.0;
  vSystem.triggerHelicopterLand(heli);
  stepHeli(480, EMPTY_VEH_INPUT); // 8 seconds auto landing
  assert(heli.altitudeM < 0.7, `Heli failed to land cleanly! alt=${heli.altitudeM.toFixed(2)}m`);
  vSystem.toggleHelicopterEngine(heli);
  stepHeli(180, EMPTY_VEH_INPUT);
  assert(!heli.heliEngineOn && heli.heliRotorRpm < 0.25, `Heli rotor failed to spool down after shutdown! rpm=${heli.heliRotorRpm}`);
  console.log('PASS: Full 8-step Helicopter flight lifecycle verified (Engine Start, Spool, Climb >45m, Hover, Fly Over Skyscraper, Cyclic/Yaw, Solid Wall Collision, Auto-Land & Shutdown).');

  // Test 5: Camera Collision Raycast
  console.log('\n=== 5. CAMERA COLLISION RAYCAST ===');
  const camSys = new CameraSystem(16 / 9);
  camSys.setPhysicsWorld(physics);
  // Target standing just outside north wall of Skyscraper (-45, -57.5), camera behind player toward skyscraper (+Z)
  camSys.yaw = 0; // desiredPos sits at targetPos.z + horizDist (inside skyscraper -56.15..-33.85!)
  camSys.pitch = 0.2;
  for (let i = 0; i < 60; i++) {
    camSys.update(1 / 60, new THREE.Vector3(-45, 0.2, -57.5), 0, false, false, 1, 1.75, 0, false, false, false, true);
  }
  assert(camSys.camera.position.z < -56.15, `Camera clipped inside skyscraper! cam.z=${camSys.camera.position.z}`);
  console.log(`PASS: Camera collision raycast kept camera outside Skyscraper wall (cam.z=${camSys.camera.position.z.toFixed(2)} < -56.15).`);

  physics.free();
  console.log('\nALL PHYSICS, COLLISION, VEHICLE, HELICOPTER & CAMERA VERIFICATION TESTS PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
