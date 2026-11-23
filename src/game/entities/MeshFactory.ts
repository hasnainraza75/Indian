import * as THREE from 'three';
import { VehicleDef } from '../types';

export interface CharacterRig {
  group: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMesh: THREE.Group;
  muzzleFlash: THREE.Mesh;
}

export interface VehicleRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheelPivots: THREE.Object3D[];
  rotorMain?: THREE.Object3D;
  rotorTail?: THREE.Object3D;
  turret?: THREE.Object3D;
  wings?: THREE.Object3D[];
  nitroFlames: THREE.Mesh[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  sirenBar?: { red: THREE.Mesh; blue: THREE.Mesh };
  electricAura?: THREE.Mesh;
}

const sharedWheelGeo = new THREE.CylinderGeometry(1, 1, 0.42, 14);
sharedWheelGeo.rotateZ(Math.PI / 2);

const sharedRimGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 10);
sharedRimGeo.rotateZ(Math.PI / 2);

export function createCharacterRig(
  shirtColor = '#F97316',
  pantsColor = '#1E293B',
  skinColor = '#C68642',
  isPolice = false,
  isZombie = false
): CharacterRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: isZombie ? '#4D7C0F' : skinColor,
    roughness: 0.7
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: isPolice ? '#D4B483' : isZombie ? '#3F3F46' : shirtColor,
    roughness: 0.65
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: isPolice ? '#B89763' : pantsColor,
    roughness: 0.75
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.3), shirtMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);

  // Hair or Police Cap
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.11, 0.36),
    new THREE.MeshStandardMaterial({ color: isPolice ? '#1E3A8A' : '#111827', roughness: 0.7 })
  );
  cap.position.y = 0.17;
  head.add(cap);

  if (isPolice) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.12), darkMat);
    visor.position.set(0, 0.12, 0.2);
    head.add(visor);
  }

  const armGeo = new THREE.BoxGeometry(0.17, 0.56, 0.17);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.37, 1.35, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
  leftArmMesh.position.y = -0.24;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.37, 1.35, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
  rightArmMesh.position.y = -0.24;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  group.add(rightArm);

  // Weapon mount on right hand
  const weaponMesh = new THREE.Group();
  weaponMesh.position.set(0, -0.46, 0.18);
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.3 })
  );
  gunBody.position.z = 0.14;
  weaponMesh.add(gunBody);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#FACC15' })
  );
  muzzleFlash.position.set(0, 0.03, 0.4);
  muzzleFlash.visible = false;
  weaponMesh.add(muzzleFlash);
  weaponMesh.visible = false;
  rightArm.add(weaponMesh);

  const legGeo = new THREE.BoxGeometry(0.21, 0.68, 0.22);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.76, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
  leftLegMesh.position.y = -0.34;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.76, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rightLegMesh.position.y = -0.34;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);
  group.add(rightLeg);

  return {
    group,
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMesh,
    muzzleFlash
  };
}

function makeWheel(radius: number, tireColor = '#111827', rimColor = '#94A3B8', isGlowing = false): THREE.Group {
  const w = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: tireColor,
    roughness: 0.85,
    emissive: isGlowing ? new THREE.Color(rimColor) : new THREE.Color('#000000'),
    emissiveIntensity: isGlowing ? 0.5 : 0
  });
  const tire = new THREE.Mesh(sharedWheelGeo, tireMat);
  tire.scale.set(radius * 0.9, radius, radius);
  tire.castShadow = true;
  w.add(tire);

  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    metalness: 0.7,
    roughness: 0.25,
    emissive: isGlowing ? new THREE.Color(rimColor) : new THREE.Color('#000000'),
    emissiveIntensity: isGlowing ? 1.4 : 0
  });
  const rim = new THREE.Mesh(sharedRimGeo, rimMat);
  rim.scale.set(radius * 0.95, radius, radius);
  w.add(rim);
  return w;
}

export function createVehicleRig(def: VehicleDef, overrideColor?: string): VehicleRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const primary = overrideColor ?? def.primaryColor;
  const bodyMat = def.isInvisible
    ? new THREE.MeshStandardMaterial({
        color: primary,
        transparent: true,
        opacity: 0.22,
        wireframe: false,
        roughness: 0.1,
        metalness: 0.9
      })
    : new THREE.MeshStandardMaterial({
        color: primary,
        metalness: def.category === 'creature' ? 0.1 : 0.55,
        roughness: def.category === 'creature' ? 0.8 : 0.32
      });

  const accentMat = new THREE.MeshStandardMaterial({
    color: def.accentColor,
    metalness: 0.45,
    roughness: 0.35,
    emissive: def.isElectric || def.isSpecial ? new THREE.Color(def.accentColor) : new THREE.Color('#000000'),
    emissiveIntensity: def.modelShape === 'tron_bike' || def.modelShape === 'ghost_bike' ? 1.6 : def.isElectric ? 0.55 : 0
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    metalness: 0.85,
    roughness: 0.12,
    transparent: true,
    opacity: def.isInvisible ? 0.2 : 0.78
  });

  const darkMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.8 });
  const headMat = new THREE.MeshBasicMaterial({ color: '#FEF08A' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#EF4444' });
  const flameMat = new THREE.MeshBasicMaterial({ color: def.isElectric ? '#00F0FF' : '#38BDF8' });

  const wheels: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Object3D[] = [];
  const nitroFlames: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const wings: THREE.Object3D[] = [];

  let rotorMain: THREE.Object3D | undefined;
  let rotorTail: THREE.Object3D | undefined;
  let turret: THREE.Object3D | undefined;
  let sirenBar: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
  let electricAura: THREE.Mesh | undefined;

  const isBike =
    def.modelShape === 'cruiser_bike' ||
    def.modelShape === 'sport_bike' ||
    def.modelShape === 'naked_bike' ||
    def.modelShape === 'scooter' ||
    def.modelShape === 'cycle' ||
    def.modelShape === 'tron_bike' ||
    def.modelShape === 'ghost_bike';

  if (isBike) {
    const isGlowing = def.modelShape === 'tron_bike' || def.modelShape === 'ghost_bike';
    const rimCol = isGlowing ? def.accentColor : '#94A3B8';

    // Front & Rear wheels
    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, def.wheelRadius, def.length * 0.36);
    const fw = makeWheel(def.wheelRadius, '#111827', rimCol, isGlowing);
    frontPivot.add(fw);
    group.add(frontPivot);
    frontWheelPivots.push(frontPivot);
    wheels.push(fw);

    const rw = makeWheel(def.wheelRadius, '#111827', rimCol, isGlowing);
    rw.position.set(0, def.wheelRadius, -def.length * 0.36);
    group.add(rw);
    wheels.push(rw);

    // Frame & Tank
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.34, def.length * 0.62),
      def.modelShape === 'cycle' ? accentMat : darkMat
    );
    chassis.position.set(0, def.wheelRadius + 0.16, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, def.length * 0.34),
      bodyMat
    );
    tank.position.set(0, def.wheelRadius + 0.42, 0.18);
    tank.castShadow = true;
    bodyGroup.add(tank);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, def.length * 0.34),
      darkMat
    );
    seat.position.set(0, def.wheelRadius + 0.36, -0.32);
    bodyGroup.add(seat);

    if (def.modelShape === 'sport_bike' || def.modelShape === 'tron_bike') {
      const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.56), bodyMat);
      fairing.position.set(0, def.wheelRadius + 0.45, def.length * 0.25);
      fairing.rotation.x = 0.28;
      bodyGroup.add(fairing);
    }

    if (def.modelShape === 'tron_bike') {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, def.length * 0.78), accentMat);
      neonStrip.position.set(0, def.wheelRadius + 0.3, 0);
      bodyGroup.add(neonStrip);
    }

    // Handlebar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), accentMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, def.wheelRadius + 0.64, def.length * 0.26);
    bodyGroup.add(bar);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.08), headMat);
    hl.position.set(0, def.wheelRadius + 0.5, def.length * 0.4);
    bodyGroup.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), tailMat);
    tl.position.set(0, def.wheelRadius + 0.38, -def.length * 0.46);
    bodyGroup.add(tl);
    taillights.push(tl);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(0, def.wheelRadius + 0.2, -def.length * 0.65);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  } else if (def.modelShape === 'helicopter' || def.modelShape === 'apache' || def.modelShape === 'heicarrier') {
    const isCarrier = def.modelShape === 'heicarrier';
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(def.width * 0.72, def.height * 0.46, def.length * 0.62),
      bodyMat
    );
    hull.position.set(0, def.height * 0.48, 0);
    hull.castShadow = true;
    bodyGroup.add(hull);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(def.width * 0.66, def.height * 0.32, def.length * 0.26),
      glassMat
    );
    cockpit.position.set(0, def.height * 0.52, def.length * 0.26);
    bodyGroup.add(cockpit);

    if (!isCarrier) {
      const tailBoom = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.42, def.length * 0.45),
        accentMat
      );
      tailBoom.position.set(0, def.height * 0.54, -def.length * 0.45);
      bodyGroup.add(tailBoom);

      // Skids
      [-0.78, 0.78].forEach((sx) => {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, def.length * 0.56), darkMat);
        skid.position.set(sx, 0.14, 0.2);
        bodyGroup.add(skid);
      });
    } else {
      // Twin turbine pods for Helicarrier
      [-def.width * 0.44, def.width * 0.44].forEach((px) => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), accentMat);
        pod.position.set(px, def.height * 0.55, 0);
        bodyGroup.add(pod);
      });
    }

    const mainHub = new THREE.Group();
    mainHub.position.set(0, def.height * 0.85, 0);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(def.length * 1.15, 0.06, 0.28), darkMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, def.length * 1.15), darkMat);
    mainHub.add(blade1, blade2);
    bodyGroup.add(mainHub);
    rotorMain = mainHub;

    const tailHub = new THREE.Group();
    tailHub.position.set(0.32, def.height * 0.62, -def.length * 0.66);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.16), darkMat);
    tailHub.add(tb);
    bodyGroup.add(tailHub);
    rotorTail = tailHub;

    if (def.isPolice) {
      const bar = createSirenLights(0, def.height * 0.25, def.length * 0.28);
      bodyGroup.add(bar.group);
      sirenBar = { red: bar.red, blue: bar.blue };
    }
  } else if (def.modelShape === 'airplane') {
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.55, def.length, 12),
      bodyMat
    );
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 1.1, 0);
    fuselage.castShadow = true;
    bodyGroup.add(fuselage);

    const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(def.width, 0.16, 1.6), accentMat);
    wingMesh.position.set(0, 1.05, 0.4);
    wingMesh.castShadow = true;
    bodyGroup.add(wingMesh);

    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.9), accentMat);
    tailWing.position.set(0, 1.25, -def.length * 0.42);
    bodyGroup.add(tailWing);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 1.0), accentMat);
    fin.position.set(0, 1.85, -def.length * 0.42);
    bodyGroup.add(fin);

    const prop = new THREE.Group();
    prop.position.set(0, 1.1, def.length * 0.52);
    prop.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.08), darkMat));
    bodyGroup.add(prop);
    rotorMain = prop;

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 1.5), glassMat);
    cockpit.position.set(0, 1.55, 1.1);
    bodyGroup.add(cockpit);
  } else if (def.modelShape === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(def.width, 0.85, def.length), bodyMat);
    hull.position.set(0, 0.55, 0);
    hull.castShadow = true;
    bodyGroup.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(def.width * 0.55, 1.6, 4), accentMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.65, def.length * 0.5 + 0.5);
    bodyGroup.add(bow);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.8, 0.48, 0.8), glassMat);
    windshield.position.set(0, 1.15, 0.5);
    windshield.rotation.x = -0.35;
    bodyGroup.add(windshield);
  } else if (def.modelShape === 'ufo') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.4, 0.45, 20), bodyMat);
    disc.position.y = 0.9;
    disc.castShadow = true;
    bodyGroup.add(disc);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10), accentMat);
    dome.position.y = 1.2;
    bodyGroup.add(dome);
  } else if (def.modelShape === 'balloon') {
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), darkMat);
    basket.position.y = 0.6;
    bodyGroup.add(basket);
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 12), bodyMat);
    envelope.position.y = 4.5;
    envelope.castShadow = true;
    bodyGroup.add(envelope);
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(2.34, 14, 8, 0, Math.PI * 2, 1.1, 0.8), accentMat);
    stripe.position.y = 4.5;
    bodyGroup.add(stripe);
  } else if (def.modelShape === 'jetpack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), bodyMat);
    pack.position.y = 1.05;
    bodyGroup.add(pack);
    [-0.22, 0.22].forEach((tx) => {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.65, 8), accentMat);
      thruster.position.set(tx, 0.95, -0.18);
      bodyGroup.add(thruster);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), flameMat);
      fl.rotation.x = Math.PI;
      fl.position.set(tx, 0.42, -0.18);
      fl.visible = false;
      bodyGroup.add(fl);
      nitroFlames.push(fl);
    });
  } else if (def.modelShape === 'dragon') {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 3.2), bodyMat);
    torso.position.y = 1.6;
    bodyGroup.add(torso);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 1.6), bodyMat);
    neck.position.set(0, 2.25, 1.9);
    neck.rotation.x = -0.35;
    bodyGroup.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.1), accentMat);
    head.position.set(0, 2.6, 2.7);
    bodyGroup.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 6), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 1.5, -2.6);
    bodyGroup.add(tail);

    [-1, 1].forEach((side) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.55, 1.95, 0.2);
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.5), accentMat);
      wingBlade.position.x = side * 1.3;
      wingPivot.add(wingBlade);
      bodyGroup.add(wingPivot);
      wings.push(wingPivot);
    });
  } else if (def.modelShape === 'dinosaur' || def.modelShape === 'quadruped' || def.modelShape === 'robot_ai') {
    const isDino = def.modelShape === 'dinosaur';
    const isRobot = def.modelShape === 'robot_ai';
    const h = def.height;
    const w = def.width;
    const l = def.length;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.65, h * 0.38, l * 0.58),
      bodyMat
    );
    torso.position.y = h * 0.52;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.42, h * 0.24, l * 0.24),
      isRobot ? accentMat : bodyMat
    );
    head.position.set(0, h * (isDino ? 0.78 : isRobot ? 0.88 : 0.68), l * 0.34);
    bodyGroup.add(head);

    if (!isRobot) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, h * 0.18, l * 0.35), accentMat);
      tail.position.set(0, h * 0.48, -l * 0.38);
      bodyGroup.add(tail);
    }

    const legH = h * 0.44;
    const legOffsets = isDino || isRobot
      ? [
          [-w * 0.24, 0],
          [w * 0.24, 0]
        ]
      : [
          [-w * 0.26, l * 0.2],
          [w * 0.26, l * 0.2],
          [-w * 0.26, -l * 0.2],
          [w * 0.26, -l * 0.2]
        ];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, legH, w * 0.18), accentMat);
      leg.position.set(lx, legH * 0.5, lz);
      bodyGroup.add(leg);
      wheels.push(leg);
    });
  } else {
    // 4-wheel (or 3-wheel rickshaw / 6-wheel trailer) ground vehicles
    const isRickshaw = def.modelShape === 'rickshaw';
    const isTank = def.modelShape === 'tank';
    const isJcb = def.modelShape === 'jcb';
    const isTruck = def.modelShape === 'truck' || def.modelShape === 'truck_trailer' || def.modelShape === 'fire_truck';
    const isSuper = def.modelShape === 'supercar' || def.modelShape === 'hypercar';
    const isTractor = def.modelShape === 'tractor';

    const wheelZFront = def.length * 0.33;
    const wheelZRear = -def.length * 0.33;
    const wheelX = def.width * 0.47;

    if (isRickshaw) {
      const fp = new THREE.Group();
      fp.position.set(0, def.wheelRadius, wheelZFront);
      const fw = makeWheel(def.wheelRadius);
      fp.add(fw);
      group.add(fp);
      frontWheelPivots.push(fp);
      wheels.push(fw);
    } else {
      [-wheelX, wheelX].forEach((wx) => {
        const fp = new THREE.Group();
        fp.position.set(wx, def.wheelRadius, wheelZFront);
        const fw = makeWheel(isTractor ? def.wheelRadius * 0.65 : def.wheelRadius);
        fp.add(fw);
        group.add(fp);
        frontWheelPivots.push(fp);
        wheels.push(fw);
      });
    }

    [-wheelX, wheelX].forEach((wx) => {
      const rw = makeWheel(def.wheelRadius);
      rw.position.set(wx, def.wheelRadius, wheelZRear);
      group.add(rw);
      wheels.push(rw);
    });

    if (def.modelShape === 'truck_trailer') {
      [-wheelX, wheelX].forEach((wx) => {
        const mw = makeWheel(def.wheelRadius);
        mw.position.set(wx, def.wheelRadius, -def.length * 0.08);
        group.add(mw);
        wheels.push(mw);
      });
    }

    const chassisY = def.wheelRadius + (def.modelShape === 'monster_truck' ? 0.35 : 0.14);
    const bodyHeight = isSuper ? def.height * 0.42 : isTruck ? def.height * 0.58 : def.height * 0.46;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(def.width * 0.94, bodyHeight, def.length * 0.96),
      bodyMat
    );
    base.position.set(0, chassisY + bodyHeight * 0.5, 0);
    base.castShadow = true;
    bodyGroup.add(base);

    // Cabin / Canopy
    if (isTruck) {
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(def.width * 0.9, def.height * 0.38, def.length * 0.28),
        bodyMat
      );
      cab.position.set(0, chassisY + bodyHeight + def.height * 0.18, def.length * 0.28);
      bodyGroup.add(cab);
      const ws = new THREE.Mesh(
        new THREE.BoxGeometry(def.width * 0.84, def.height * 0.22, 0.12),
        glassMat
      );
      ws.position.set(0, chassisY + bodyHeight + def.height * 0.22, def.length * 0.42);
      bodyGroup.add(ws);

      if (def.modelShape === 'truck_trailer') {
        const cargo = new THREE.Mesh(
          new THREE.BoxGeometry(def.width * 0.96, def.height * 0.56, def.length * 0.62),
          accentMat
        );
        cargo.position.set(0, chassisY + bodyHeight + def.height * 0.26, -def.length * 0.16);
        bodyGroup.add(cargo);
      } else if (def.modelShape === 'fire_truck') {
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, def.length * 0.6), accentMat);
        ladder.position.set(0, chassisY + bodyHeight + 0.35, -def.length * 0.12);
        bodyGroup.add(ladder);
      }
    } else if (isTank) {
      const turretGroup = new THREE.Group();
      turretGroup.position.set(0, chassisY + bodyHeight + 0.35, 0);
      const turretHead = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 2.5), accentMat);
      turretGroup.add(turretHead);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.6, 8), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 2.4);
      turretGroup.add(barrel);
      bodyGroup.add(turretGroup);
      turret = turretGroup;
    } else if (isJcb) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.35, 1.5), glassMat);
      cab.position.set(0, chassisY + bodyHeight + 0.65, -0.35);
      bodyGroup.add(cab);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.8), accentMat);
      boom.position.set(0, chassisY + bodyHeight + 0.45, 1.6);
      boom.rotation.x = -0.35;
      bodyGroup.add(boom);
      const bucket = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.75, 0.85), darkMat);
      bucket.position.set(0, chassisY + 0.35, def.length * 0.58);
      bodyGroup.add(bucket);
    } else if (def.modelShape === 'bull_kart') {
      const bull = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 1.6), bodyMat);
      bull.position.set(0, 0.85, 1.1);
      bodyGroup.add(bull);
      [-0.4, 0.4].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), accentMat);
        horn.position.set(hx, 1.4, 1.75);
        horn.rotation.x = 0.4;
        bodyGroup.add(horn);
      });
    } else {
      const cabinHeight = isSuper ? def.height * 0.36 : def.height * 0.42;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(def.width * 0.8, cabinHeight, def.length * 0.48),
        isRickshaw ? darkMat : glassMat
      );
      cabin.position.set(0, chassisY + bodyHeight + cabinHeight * 0.45, -def.length * 0.06);
      bodyGroup.add(cabin);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(def.width * 0.78, 0.08, def.length * 0.46),
        isRickshaw ? darkMat : bodyMat
      );
      roof.position.set(0, chassisY + bodyHeight + cabinHeight * 0.92, -def.length * 0.06);
      bodyGroup.add(roof);

      if (isSuper) {
        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.88, 0.1, 0.35), accentMat);
        spoiler.position.set(0, chassisY + bodyHeight + 0.22, -def.length * 0.44);
        bodyGroup.add(spoiler);
      }
    }

    // Headlights & Taillights
    [-def.width * 0.32, def.width * 0.32].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
      hl.position.set(lx, chassisY + bodyHeight * 0.55, def.length * 0.48);
      bodyGroup.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
      tl.position.set(lx, chassisY + bodyHeight * 0.55, -def.length * 0.48);
      bodyGroup.add(tl);
      taillights.push(tl);
    });

    // Nitro exhaust flames
    [-def.width * 0.2, def.width * 0.2].forEach((fx) => {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.95, 6), flameMat);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(fx, chassisY + 0.18, -def.length * 0.58);
      fl.visible = false;
      bodyGroup.add(fl);
      nitroFlames.push(fl);
    });

    if (def.isPolice) {
      const bar = createSirenLights(0, chassisY + bodyHeight + def.height * 0.42, -def.length * 0.06);
      bodyGroup.add(bar.group);
      sirenBar = { red: bar.red, blue: bar.blue };
    }
  }

  if (def.isElectric || def.isSpecial) {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(def.width * 0.6, def.width * 0.82, 20),
      new THREE.MeshBasicMaterial({
        color: def.accentColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42
      })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.08;
    aura.visible = false;
    bodyGroup.add(aura);
    electricAura = aura;
  }

  return {
    group,
    bodyGroup,
    wheels,
    frontWheelPivots,
    rotorMain,
    rotorTail,
    turret,
    wings,
    nitroFlames,
    headlights,
    taillights,
    sirenBar,
    electricAura
  };
}

function createSirenLights(x: number, y: number, z: number): {
  group: THREE.Group;
  red: THREE.Mesh;
  blue: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.14, 0.22),
    new THREE.MeshBasicMaterial({ color: '#EF4444' })
  );
  red.position.x = -0.22;
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.14, 0.22),
    new THREE.MeshBasicMaterial({ color: '#3B82F6' })
  );
  blue.position.x = 0.22;
  group.add(red, blue);
  return { group, red, blue };
}
