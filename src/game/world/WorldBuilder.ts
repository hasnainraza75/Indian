import * as THREE from 'three';
import { PROPERTIES } from '../data/propertiesData';
import { GraphicsQuality, WeatherType } from '../types';

export interface WorldCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY: number;
  label?: string;
}

export interface StaticBoxCollider {
  id?: string;
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  isDoor?: boolean;
  label?: string;
}

export interface StaticCylinderCollider {
  x: number;
  y: number;
  z: number;
  radius: number;
  halfHeight: number;
  label?: string;
}

export interface TerrainMeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface InteractiveDoor {
  id: string;
  label: string;
  pivot: THREE.Group;
  x: number;
  z: number;
  open: boolean;
  targetAngle: number;
}

export interface TrafficSignalNode {
  x: number;
  z: number;
  nsGreen: boolean;
  redMeshNS: THREE.Mesh;
  greenMeshNS: THREE.Mesh;
  redMeshEW: THREE.Mesh;
  greenMeshEW: THREE.Mesh;
}

export interface WorldZones {
  petrolPumps: Array<{ id: string; x: number; z: number; radius: number }>;
  hospital: { x: number; z: number; radius: number };
  policeStation: { x: number; z: number; radius: number };
  weaponShop: { x: number; z: number; radius: number };
  showroom: { x: number; z: number; radius: number };
  garages: Array<{ propertyId: string; x: number; z: number; radius: number }>;
  poolBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  mansionSafeBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

function opaqueStdMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    ...params,
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide
  });
}

function opaqueBasicMat(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    ...params,
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide
  });
}

export class WorldBuilder {
  readonly scene: THREE.Scene;
  readonly colliders: WorldCollider[] = [];
  readonly staticBoxes: StaticBoxCollider[] = [];
  readonly staticCylinders: StaticCylinderCollider[] = [];
  terrainMeshData: TerrainMeshData | null = null;

  readonly doors: InteractiveDoor[] = [];
  readonly trafficSignals: TrafficSignalNode[] = [];
  readonly zones: WorldZones;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private streetLightMeshes: THREE.MeshBasicMaterial[] = [];
  private windowMat!: THREE.MeshStandardMaterial;
  private roadMat!: THREE.MeshStandardMaterial;
  private rainPoints!: THREE.Points;
  private rainPositions!: Float32Array;
  private cloudGroup = new THREE.Group();
  private lightningFlash = 0;
  private signalTimer = 0;
  private signalPhase = 0; // 0: NS green, 1: EW green

  private skyColor = new THREE.Color('#38BDF8');
  private fogColor = new THREE.Color('#7DD3FC');

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.zones = {
      petrolPumps: [
        { id: 'pump_city', x: -72, z: 22, radius: 11 },
        { id: 'pump_highway', x: 118, z: -98, radius: 11 },
        { id: 'pump_village', x: 265, z: -215, radius: 11 }
      ],
      hospital: { x: -75, z: -25, radius: 16 },
      policeStation: { x: 65, z: 55, radius: 18 },
      weaponShop: { x: 78, z: -32, radius: 12 },
      showroom: { x: 45, z: -80, radius: 14 },
      garages: PROPERTIES.map((p) => ({
        propertyId: p.id,
        x: p.garageX,
        z: p.garageZ,
        radius: 9
      })),
      poolBounds: { minX: -168, maxX: -152, minZ: -124, maxZ: -112 },
      mansionSafeBounds: { minX: -172, maxX: -118, minZ: -156, maxZ: -110 }
    };
  }

  build(quality: GraphicsQuality): void {
    this.setupLightingAndSky(quality);
    this.buildTerrainAndRoads();
    this.buildWaterAndBridges();
    this.buildCityBuildings();
    this.buildLandmarks();
    this.buildLuxuryPlayerHouse();
    this.buildPurchasableHouses();
    this.buildAirport();
    this.buildVillageAndRamps();
    this.buildHighwayGuardrails();
    this.buildInstancedFoliage(quality);
    this.buildTrafficSignalsAndStreetLights();
    this.buildWeatherParticles(quality);
  }

  private addBoxCollider(box: StaticBoxCollider, registerAabb = true): void {
    this.staticBoxes.push(box);
    if (registerAabb && !box.rotX && !box.rotZ) {
      const cos = Math.abs(Math.cos(box.rotY ?? 0));
      const sin = Math.abs(Math.sin(box.rotY ?? 0));
      const ex = box.hx * cos + box.hz * sin;
      const ez = box.hx * sin + box.hz * cos;
      this.colliders.push({
        minX: box.cx - ex,
        maxX: box.cx + ex,
        minZ: box.cz - ez,
        maxZ: box.cz + ez,
        minY: box.cy - box.hy,
        maxY: box.cy + box.hy,
        label: box.label
      });
    }
  }

  private addCylinderCollider(cyl: StaticCylinderCollider): void {
    this.staticCylinders.push(cyl);
    this.colliders.push({
      minX: cyl.x - cyl.radius,
      maxX: cyl.x + cyl.radius,
      minZ: cyl.z - cyl.radius,
      maxZ: cyl.z + cyl.radius,
      minY: cyl.y - cyl.halfHeight,
      maxY: cyl.y + cyl.halfHeight,
      label: cyl.label
    });
  }

  private setupLightingAndSky(quality: GraphicsQuality): void {
    this.scene.background = this.skyColor;
    this.scene.fog = new THREE.FogExp2('#7DD3FC', quality === 'low' ? 0.0028 : 0.0018);

    this.hemiLight = new THREE.HemisphereLight('#E0F2FE', '#334155', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#FFFBEB', 1.45);
    this.sunLight.position.set(140, 220, 120);
    if (quality !== 'low') {
      this.sunLight.castShadow = true;
      const mapSize = quality === 'high' ? 2048 : 1024;
      this.sunLight.shadow.mapSize.set(mapSize, mapSize);
      this.sunLight.shadow.camera.near = 20;
      this.sunLight.shadow.camera.far = 480;
      const d = 160;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  private buildTerrainAndRoads(): void {
    // Base sculpted terrain mesh with mountain hills in SW/NW ghat sector
    const geo = new THREE.PlaneGeometry(1040, 1040, 88, 88);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const h = this.getMountainBaseHeight(vx, vz);
      pos.setY(i, h);

      const c = new THREE.Color();
      if (h > 3.5) {
        c.set('#3F6212'); // Ghat highland green/rock
      } else if (vx > 200 && vz < -120) {
        c.set('#4D7C0F'); // Village farmland
      } else if (vx > 125 && vz > 40) {
        c.set('#D6C08D'); // Sandy riverbed/beach
      } else {
        c.set('#22543D'); // Lush urban/park grass
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Store exact trimesh buffers for Rapier terrain collider
    const indexAttr = geo.getIndex();
    this.terrainMeshData = {
      vertices: new Float32Array(pos.array as ArrayLike<number>),
      indices: indexAttr ? new Uint32Array(indexAttr.array as ArrayLike<number>) : new Uint32Array(0)
    };

    const terrainMat = opaqueStdMat({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Asphalt Road Network
    this.roadMat = opaqueStdMat({
      color: '#1E293B',
      roughness: 0.85,
      metalness: 0.08
    });

    const dashMat = opaqueBasicMat({ color: '#FACC15' });
    const addRoad = (x: number, z: number, w: number, l: number, y = 0.04, rotY = 0) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, l), this.roadMat);
      road.position.set(x, y, z);
      road.rotation.y = rotY;
      road.receiveShadow = true;
      this.scene.add(road);

      // Dashed yellow center line
      const dashCount = Math.max(2, Math.floor(Math.max(w, l) / 14));
      const alongZ = l >= w;
      const span = alongZ ? l : w;
      for (let i = 0; i < dashCount; i++) {
        const offset = -span / 2 + (i + 0.5) * (span / dashCount);
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(alongZ ? 0.35 : 4.2, 0.02, alongZ ? 4.2 : 0.35),
          dashMat
        );
        dash.position.set(
          x + (alongZ ? 0 : offset * Math.cos(rotY)),
          y + 0.05,
          z + (alongZ ? offset : -offset * Math.sin(rotY))
        );
        dash.rotation.y = rotY;
        this.scene.add(dash);
      }
    };

    // Main city grid avenues (spacing 90m)
    [-90, 0, 90].forEach((coord) => {
      addRoad(coord, -10, 16, 360);
      addRoad(0, coord, 360, 16);
    });

    // Outer Ring Highway
    addRoad(0, -185, 580, 18);
    addRoad(0, 185, 520, 18);
    addRoad(-190, 0, 18, 390);

    // Airport Connector Road
    addRoad(-240, -185, 160, 16);
    addRoad(-280, -225, 16, 100);

    // Village East Highway
    addRoad(250, -185, 220, 14);
    addRoad(320, -235, 14, 130);

    // Ghat Mountain Road (sloped segments with matching physics boxes)
    const ghatPts = [
      { x: -195, z: 145, h: 0.2 },
      { x: -240, z: 175, h: 2.5 },
      { x: -280, z: 215, h: 5.5 },
      { x: -330, z: 265, h: 11.2 },
      { x: -370, z: 320, h: 16.0 }
    ];
    for (let i = 0; i < ghatPts.length - 1; i++) {
      const a = ghatPts[i];
      const b = ghatPts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const midY = (a.h + b.h) / 2;
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.atan2(b.h - a.h, dist);
      const segLen = dist + 4;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, segLen), this.roadMat);
      seg.position.set(midX, midY, midZ);
      seg.rotation.order = 'YXZ';
      seg.rotation.y = yaw;
      seg.rotation.x = pitch;
      seg.receiveShadow = true;
      this.scene.add(seg);

      this.addBoxCollider(
        {
          cx: midX,
          cy: midY,
          cz: midZ,
          hx: 6.5,
          hy: 0.2,
          hz: segLen / 2,
          rotY: yaw,
          rotX: pitch,
          label: 'Ghat Road'
        },
        false
      );
    }
  }

  private buildWaterAndBridges(): void {
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#0284C7',
      roughness: 0.16,
      metalness: 0.45,
      transparent: true,
      opacity: 0.86,
      depthWrite: true,
      depthTest: true
    });

    // Eastern River / Bay
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(320, 560), waterMat);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(295, -0.35, 215);
    this.scene.add(bay);

    // Rural Lake near Village
    const lake = new THREE.Mesh(new THREE.CircleGeometry(42, 24), waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(365, -0.25, -135);
    this.scene.add(lake);

    // Cable-Stayed Sea Link Bridge spanning from (110, 60) -> (265, 200)
    const bridgeMat = opaqueStdMat({ color: '#475569', roughness: 0.7 });
    const deckYaw = Math.atan2(130, 145);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 210), bridgeMat);
    deck.position.set(180, 4.2, 115);
    deck.rotation.y = deckYaw;
    deck.receiveShadow = true;
    deck.castShadow = true;
    this.scene.add(deck);

    // Bridge road deck + approach ramp colliders (drivable over and flyable above/under!)
    this.addBoxCollider(
      { cx: 180, cy: 4.2, cz: 115, hx: 8, hy: 0.45, hz: 82, rotY: deckYaw, label: 'Sea Link Deck' },
      false
    );
    const bridgeRampPitch = 0.2;
    [-93.5, 93.5].forEach((offset) => {
      const rx = 180 + Math.sin(deckYaw) * offset;
      const rz = 115 + Math.cos(deckYaw) * offset;
      const pitch = offset < 0 ? -bridgeRampPitch : bridgeRampPitch;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 24), bridgeMat);
      ramp.position.set(rx, 2.0, rz);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = deckYaw;
      ramp.rotation.x = pitch;
      ramp.receiveShadow = true;
      this.scene.add(ramp);

      this.addBoxCollider(
        {
          cx: rx,
          cy: 2.0,
          cz: rz,
          hx: 8,
          hy: 0.4,
          hz: 12,
          rotY: deckYaw,
          rotX: pitch,
          label: 'Sea Link Ramp'
        },
        false
      );
    });

    // Bridge side guardrails
    const railConcreteMat = opaqueStdMat({ color: '#CBD5E1', roughness: 0.6 });
    [-7.65, 7.65].forEach((sideX) => {
      const gx = 180 + Math.cos(deckYaw) * sideX;
      const gz = 115 - Math.sin(deckYaw) * sideX;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 164), railConcreteMat);
      rail.position.set(gx, 5.15, gz);
      rail.rotation.y = deckYaw;
      this.scene.add(rail);
      this.addBoxCollider(
        { cx: gx, cy: 5.15, cz: gz, hx: 0.3, hy: 0.55, hz: 82, rotY: deckYaw, label: 'Bridge Guardrail' },
        false
      );
    });

    // Twin Cable-Stayed Pylons
    const pylonMat = opaqueStdMat({ color: '#F8FAFC', roughness: 0.5 });
    const cableMat = opaqueBasicMat({ color: '#38BDF8' });
    [-35, 35].forEach((offset) => {
      const px = 180 + Math.sin(deckYaw) * offset;
      const pz = 115 + Math.cos(deckYaw) * offset;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 34, 2.2), pylonMat);
      tower.position.set(px, 17, pz);
      tower.rotation.y = deckYaw;
      tower.castShadow = true;
      this.scene.add(tower);

      this.addBoxCollider({
        cx: px,
        cy: 17,
        cz: pz,
        hx: 1.1,
        hy: 17,
        hz: 1.1,
        rotY: deckYaw,
        label: 'Bridge Pylon'
      });

      // Suspension cables
      [-26, -14, 14, 26].forEach((cOff) => {
        const cx = px + Math.sin(deckYaw) * cOff;
        const cz = pz + Math.cos(deckYaw) * cOff;
        const len = Math.hypot(cOff, 26);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 4), cableMat);
        cable.position.set((px + cx) / 2, 18, (pz + cz) / 2);
        cable.lookAt(cx, 4.5, cz);
        cable.rotateX(Math.PI / 2);
        this.scene.add(cable);
      });
    });

    // Downtown Flyover Overpass along Z = 45
    const flyover = new THREE.Mesh(new THREE.BoxGeometry(110, 0.7, 12), bridgeMat);
    flyover.position.set(0, 4.8, 45);
    flyover.receiveShadow = true;
    this.scene.add(flyover);
    this.addBoxCollider(
      { cx: 0, cy: 4.8, cz: 45, hx: 55, hy: 0.35, hz: 6, label: 'Downtown Flyover' },
      false
    );

    // Flyover edge guardrails
    [-5.75, 5.75].forEach((fz) => {
      const gr = new THREE.Mesh(new THREE.BoxGeometry(110, 0.9, 0.45), railConcreteMat);
      gr.position.set(0, 5.55, 45 + fz);
      this.scene.add(gr);
      this.addBoxCollider(
        { cx: 0, cy: 5.55, cz: 45 + fz, hx: 55, hy: 0.45, hz: 0.225, label: 'Flyover Guardrail' },
        false
      );
    });

    [-68, 68].forEach((rx) => {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 12), bridgeMat);
      ramp.position.set(rx, 2.4, 45);
      ramp.rotation.z = rx < 0 ? 0.16 : -0.16;
      this.scene.add(ramp);
      this.addBoxCollider(
        {
          cx: rx,
          cy: 2.4,
          cz: 45,
          hx: 15,
          hy: 0.3,
          hz: 6,
          rotZ: rx < 0 ? 0.16 : -0.16,
          label: 'Flyover Ramp'
        },
        false
      );
    });
  }

  private buildCityBuildings(): void {
    this.windowMat = opaqueStdMat({
      color: '#0F172A',
      emissive: new THREE.Color('#FDE047'),
      emissiveIntensity: 0.15,
      roughness: 0.25,
      metalness: 0.6
    });

    const palette = ['#334155', '#475569', '#1E293B', '#64748B', '#273549', '#3F3F46'];
    const blocks = [
      { x: -45, z: -45, w: 22, d: 22, h: 42 },
      { x: -45, z: -135, w: 24, d: 20, h: 32 },
      { x: 45, z: -135, w: 26, d: 22, h: 52 },
      { x: 135, z: -45, w: 24, d: 24, h: 46 },
      { x: -45, z: 135, w: 24, d: 24, h: 36 },
      { x: 45, z: 135, w: 22, d: 22, h: 60 },
      { x: -135, z: 45, w: 22, d: 24, h: 38 },
      { x: -135, z: 135, w: 24, d: 24, h: 28 },
      { x: 135, z: -135, w: 26, d: 22, h: 30 },
      { x: -24, z: -42, w: 14, d: 14, h: 24 },
      { x: 38, z: 24, w: 18, d: 16, h: 28 },
      { x: 135, z: 45, w: 20, d: 20, h: 48 }
    ];

    blocks.forEach((b, idx) => {
      const mat = opaqueStdMat({
        color: palette[idx % palette.length],
        roughness: 0.65,
        metalness: 0.2
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Glowing glass band accent (solid opaque)
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.3, b.h * 0.72, b.d + 0.3),
        this.windowMat
      );
      band.position.set(b.x, b.h * 0.52, b.z);
      this.scene.add(band);

      // Neon rooftop trim for modern skyline
      if (b.h >= 40) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(b.w + 0.5, 0.5, b.d + 0.5),
          opaqueBasicMat({ color: idx % 2 === 0 ? '#06B6D4' : '#F97316' })
        );
        neon.position.set(b.x, b.h + 0.25, b.z);
        this.scene.add(neon);
      }

      // Exact matching collider encompassing outer band width/height
      this.addBoxCollider({
        cx: b.x,
        cy: b.h / 2,
        cz: b.z,
        hx: (b.w + 0.3) / 2,
        hy: b.h / 2,
        hz: (b.d + 0.3) / 2,
        label: 'Building'
      });
    });

    // Gateway-Inspired Central Arch Monument at (0, -28)
    const archMat = opaqueStdMat({ color: '#D97706', roughness: 0.7 });
    [-6, 6].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 16, 4), archMat);
      pillar.position.set(px, 8, -28);
      pillar.castShadow = true;
      this.scene.add(pillar);
      this.addBoxCollider({
        cx: px,
        cy: 8,
        cz: -28,
        hx: 1.6,
        hy: 8,
        hz: 2,
        label: 'Arch Pillar'
      });
    });
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 4.4), archMat);
    archTop.position.set(0, 15.5, -28);
    this.scene.add(archTop);
    // Overhead arch lintel collider (cars drive under y < 13.25; helicopters collide if hitting 13.25..17.75!)
    this.addBoxCollider(
      { cx: 0, cy: 15.5, cz: -28, hx: 8, hy: 2.25, hz: 2.2, label: 'Arch Top' },
      false
    );
  }

  private buildLandmarks(): void {
    // 1. City Hospital (-75, -25) + Safe Zone Ring
    this.createLandmarkBuilding(-75, -25, 22, 18, 12, '#F8FAFC', '#EF4444', 'HOSPITAL');
    this.createZoneRing(-75, -25, 6, '#22C55E');

    // 2. Police HQ (65, 55) + Rooftop Helipad
    this.createLandmarkBuilding(65, 55, 24, 20, 11, '#1E3A8A', '#38BDF8', 'POLICE HQ');
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 0.3, 20),
      opaqueStdMat({ color: '#334155' })
    );
    pad.position.set(65, 11.2, 55);
    this.scene.add(pad);
    this.addCylinderCollider({ x: 65, y: 11.2, z: 55, radius: 7.5, halfHeight: 0.15, label: 'Police Helipad' });
    this.createZoneRing(65, 11.4, 5.5, '#FACC15', 55);

    // 3. Vehicle Showroom (45, -80)
    this.createLandmarkBuilding(45, -80, 22, 16, 8, '#0F172A', '#F97316', 'SHOWROOM');
    this.createZoneRing(45, -67, 5, '#F97316');

    // 4. Bharat Armory Weapon Shop (78, -32)
    this.createLandmarkBuilding(78, -32, 16, 14, 7, '#27272A', '#F43F5E', 'ARMORY');
    this.createZoneRing(78, -21, 4.2, '#F43F5E');

    // 5. Shopping Bazaar Stalls (82..109, -145)
    const stallColors = ['#EA580C', '#0EA5E9', '#16A34A', '#EC4899'];
    for (let i = 0; i < 4; i++) {
      const sx = 82 + i * 9;
      const sz = -145;
      const stall = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3.2, 5),
        opaqueStdMat({ color: '#CBD5E1' })
      );
      stall.position.set(sx, 1.6, sz);
      this.scene.add(stall);
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(6.6, 0.4, 5.8),
        opaqueStdMat({ color: stallColors[i] })
      );
      canopy.position.set(sx, 3.5, sz);
      this.scene.add(canopy);
      this.addBoxCollider({
        cx: sx,
        cy: 1.85,
        cz: sz,
        hx: 3.3,
        hy: 1.85,
        hz: 2.9,
        label: 'Bazaar Stall'
      });
    }

    // 6. 3 Petrol Pumps (canopy high above so cars drive through, solid columns & dispenser)
    const canopyMat = opaqueStdMat({ color: '#EA580C' });
    const colMat = opaqueStdMat({ color: '#F8FAFC' });
    const dispMat = opaqueStdMat({ color: '#16A34A' });

    this.zones.petrolPumps.forEach((p) => {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.7, 10), canopyMat);
      canopy.position.set(p.x, 5.2, p.z);
      canopy.castShadow = true;
      this.scene.add(canopy);
      this.addBoxCollider(
        { cx: p.x, cy: 5.2, cz: p.z, hx: 7, hy: 0.35, hz: 5, label: 'Pump Canopy' },
        false
      );

      [-5, 5].forEach((ox) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.6), colMat);
        col.position.set(p.x + ox, 2.6, p.z);
        this.scene.add(col);
        this.addBoxCollider({
          cx: p.x + ox,
          cy: 2.6,
          cz: p.z,
          hx: 0.3,
          hy: 2.6,
          hz: 0.3,
          label: 'Pump Pillar'
        });
      });

      const dispenser = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 1.0), dispMat);
      dispenser.position.set(p.x, 1.0, p.z);
      this.scene.add(dispenser);
      this.addBoxCollider({
        cx: p.x,
        cy: 1.0,
        cz: p.z,
        hx: 1.1,
        hy: 1.0,
        hz: 0.5,
        label: 'Fuel Dispenser'
      });

      this.createZoneRing(p.x, p.z + 5, 4, '#22C55E');
    });
  }

  private createLandmarkBuilding(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    wallColor: string,
    trimColor: string,
    label: string
  ): void {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      opaqueStdMat({ color: wallColor, roughness: 0.6 })
    );
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 1.1, d + 0.4),
      opaqueBasicMat({ color: trimColor })
    );
    trim.position.set(x, h - 0.6, z);
    this.scene.add(trim);

    this.addBoxCollider({
      cx: x,
      cy: h / 2,
      cz: z,
      hx: w / 2,
      hy: h / 2,
      hz: d / 2,
      label
    });
  }

  private createZoneRing(x: number, z: number, radius: number, color: string, customY = 0.12, zOverride?: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.45, radius, 28),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, zOverride !== undefined ? customY : 0.12, zOverride ?? z);
    this.scene.add(ring);
  }

  private buildLuxuryPlayerHouse(): void {
    // Flagship Walkable Mansion at (-145, -135)
    const hx = -145;
    const hz = -135;

    const wallMat = opaqueStdMat({ color: '#F1F5F9', roughness: 0.55 });
    const marbleMat = opaqueStdMat({ color: '#E2E8F0', roughness: 0.35 });
    const woodMat = opaqueStdMat({ color: '#78350F', roughness: 0.7 });
    const accentMat = opaqueStdMat({ color: '#0F172A', roughness: 0.4 });
    const fabricMat = opaqueStdMat({ color: '#0EA5E9', roughness: 0.85 });

    // Ground Floor Marble Slab (22 x 18)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 18), marbleMat);
    floor.position.set(hx, 0.12, hz);
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.addBoxCollider({ cx: hx, cy: 0.12, cz: hz, hx: 11, hy: 0.125, hz: 9, label: 'Mansion Floor' }, false);

    // Outer Mansion Walls with Front Doorway gap at (hx, hz + 9)
    const addWall = (cx: number, cy: number, cz: number, w: number, h: number, d: number, mat = wallMat, label = 'Mansion Wall') => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(cx, cy, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.addBoxCollider({ cx, cy, cz, hx: w / 2, hy: h / 2, hz: d / 2, label });
    };

    // Back wall, Left wall, Right wall
    addWall(hx, 2.2, hz - 9, 22, 4.4, 0.5);
    addWall(hx - 11, 2.2, hz, 0.5, 4.4, 18);
    addWall(hx + 11, 2.2, hz, 0.5, 4.4, 18);
    // Front wall split for 3.6m doorway
    addWall(hx - 6.4, 2.2, hz + 9, 9.2, 4.4, 0.5);
    addWall(hx + 6.4, 2.2, hz + 9, 9.2, 4.4, 0.5);

    // Front Swinging Door (toggles solid vs open in PhysicsWorld!)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(hx - 1.8, 0.25, hz + 9);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 0.18), woodMat);
    doorMesh.position.set(1.7, 1.8, 0);
    doorPivot.add(doorMesh);
    this.scene.add(doorPivot);
    this.doors.push({
      id: 'mansion_front_door',
      label: 'Mansion Front Door',
      pivot: doorPivot,
      x: hx,
      z: hz + 9,
      open: false,
      targetAngle: 0
    });
    this.addBoxCollider(
      {
        id: 'mansion_front_door',
        cx: hx,
        cy: 2.05,
        cz: hz + 9,
        hx: 1.7,
        hy: 1.8,
        hz: 0.12,
        isDoor: true,
        label: 'Mansion Door'
      },
      false
    );

    // Interior Furniture (solid props with colliders):
    const addProp = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, label: string) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.addBoxCollider({ cx: x, cy: y, cz: z, hx: w / 2, hy: h / 2, hz: d / 2, label }, false);
    };

    // Living Room (Left Front)
    addProp(4.2, 0.9, 1.5, fabricMat, hx - 6.5, 0.65, hz + 4.5, 'Sofa');
    addProp(3.5, 1.8, 0.4, accentMat, hx - 6.5, 1.4, hz + 0.5, 'TV Stand');
    // Kitchen (Left Back)
    addProp(5.5, 1.1, 1.4, accentMat, hx - 6.5, 0.75, hz - 6.8, 'Kitchen Counter');
    addProp(1.2, 2.6, 1.2, marbleMat, hx - 9.5, 1.5, hz - 6.8, 'Fridge');
    // Bedroom (Right Back)
    addProp(3.4, 0.75, 4.2, fabricMat, hx + 6.5, 0.55, hz - 5.2, 'Bed');
    addProp(1.1, 2.6, 3.2, woodMat, hx + 9.8, 1.5, hz - 5.2, 'Wardrobe');
    // Bathroom (Right Front)
    addProp(2.6, 0.75, 1.6, wallMat, hx + 7.5, 0.55, hz + 5.2, 'Bathtub');

    // Walkable Staircase (center right leading up to Roof Terrace y=4.45)
    for (let s = 0; s < 10; s++) {
      const sy = 0.22 + s * 0.44;
      const sz = hz + 4 - s * 0.8;
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.44, 0.9), woodMat);
      step.position.set(hx + 1.5, sy, sz);
      this.scene.add(step);
    }
    const stairRise = 4.32;
    const stairRun = 8.4;
    const stairAngle = Math.atan2(stairRise, stairRun);
    const stairLen = Math.hypot(stairRun, stairRise);
    this.addBoxCollider(
      {
        cx: hx + 1.5,
        cy: 0.22 + stairRise / 2,
        cz: hz + 0.35,
        hx: 1.4,
        hy: 0.22,
        hz: stairLen / 2,
        rotX: stairAngle,
        label: 'Mansion Stair Ramp'
      },
      false
    );

    // Second-Floor Roof Terrace (solid slabs leaving stair opening clear)
    const addRoofSlab = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), marbleMat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = true;
      this.scene.add(m);
      this.addBoxCollider({ cx: x, cy: y, cz: z, hx: w / 2, hy: h / 2, hz: d / 2, label: 'Mansion Roof' }, false);
    };
    addRoofSlab(11, 0.3, 18, hx - 5.5, 4.45, hz);
    addRoofSlab(7.5, 0.3, 18, hx + 7.25, 4.45, hz);
    addRoofSlab(3.5, 0.3, 5, hx + 1.75, 4.45, hz - 6.5);

    // Balcony Railing (solid & opaque stone/steel parapet so no transparency glitch)
    const railMat = opaqueStdMat({ color: '#38BDF8', roughness: 0.35, metalness: 0.4 });
    const frontRail = new THREE.Mesh(new THREE.BoxGeometry(22, 1.1, 0.22), railMat);
    frontRail.position.set(hx, 5.15, hz + 9);
    this.scene.add(frontRail);
    this.addBoxCollider({ cx: hx, cy: 5.15, cz: hz + 9, hx: 11, hy: 0.55, hz: 0.11, label: 'Balcony Rail' }, false);

    // Swimming Pool (-168..-152, -124..-112)
    const poolWater = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 12),
      new THREE.MeshBasicMaterial({ color: '#06B6D4', transparent: true, opacity: 0.82, depthWrite: true })
    );
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.set(-160, 0.08, -118);
    this.scene.add(poolWater);

    // Mansion Garage (-124, -139)
    const garageBox = new THREE.Mesh(
      new THREE.BoxGeometry(10, 4.2, 12),
      opaqueStdMat({ color: '#1E293B', roughness: 0.6 })
    );
    garageBox.position.set(-124, 2.1, -139);
    garageBox.castShadow = true;
    this.scene.add(garageBox);
    this.addBoxCollider({ cx: -124, cy: 2.1, cz: -139, hx: 5, hy: 2.1, hz: 6, label: 'Mansion Garage' });
    this.createZoneRing(-124, -131, 4.2, '#38BDF8');

    // Garden Palm Trees with solid trunk colliders
    const trunkMat = opaqueStdMat({ color: '#78350F' });
    const crownMat = opaqueStdMat({ color: '#16A34A' });
    [
      [-168, -145],
      [-168, -110],
      [-120, -115]
    ].forEach(([px, pz]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 5.5, 6), trunkMat);
      trunk.position.set(px, 2.75, pz);
      this.scene.add(trunk);
      this.addCylinderCollider({ x: px, y: 2.75, z: pz, radius: 0.38, halfHeight: 2.75, label: 'Palm Tree' });

      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.0, 7), crownMat);
      crown.position.set(px, 6.0, pz);
      this.scene.add(crown);
    });
  }

  private buildPurchasableHouses(): void {
    PROPERTIES.filter((p) => !p.isStarter).forEach((prop) => {
      const baseY = this.getMountainBaseHeight(prop.x, prop.z);
      const villa = new THREE.Mesh(
        new THREE.BoxGeometry(16, 6.5, 14),
        opaqueStdMat({ color: '#F8FAFC', roughness: 0.5 })
      );
      villa.position.set(prop.x, baseY + 3.25, prop.z);
      villa.castShadow = true;
      villa.receiveShadow = true;
      this.scene.add(villa);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(17, 0.8, 15),
        opaqueStdMat({ color: '#EA580C' })
      );
      roof.position.set(prop.x, baseY + 6.9, prop.z);
      this.scene.add(roof);

      this.addBoxCollider({
        cx: prop.x,
        cy: baseY + 3.65,
        cz: prop.z,
        hx: 8.5,
        hy: 3.65,
        hz: 7.5,
        label: prop.name
      });

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.8, 4.3, 24),
        new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(prop.garageX, baseY + 0.16, prop.garageZ);
      this.scene.add(ring);
    });
  }

  private buildAirport(): void {
    // Runway (-304..-276, -360..-200)
    const runway = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.12, 160),
      opaqueStdMat({ color: '#0F172A', roughness: 0.75 })
    );
    runway.position.set(-290, 0.06, -280);
    runway.receiveShadow = true;
    this.scene.add(runway);
    this.addBoxCollider({ cx: -290, cy: 0.06, cz: -280, hx: 14, hy: 0.06, hz: 80, label: 'Runway' }, false);

    // Control Tower
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 22, 10),
      opaqueStdMat({ color: '#E2E8F0' })
    );
    tower.position.set(-255, 11, -260);
    tower.castShadow = true;
    this.scene.add(tower);
    this.addCylinderCollider({ x: -255, y: 11, z: -260, radius: 4.1, halfHeight: 11, label: 'ATC Tower' });

    // Hangar
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(26, 9, 22),
      opaqueStdMat({ color: '#475569' })
    );
    hangar.position.set(-325, 4.5, -240);
    hangar.castShadow = true;
    this.scene.add(hangar);
    this.addBoxCollider({ cx: -325, cy: 4.5, cz: -240, hx: 13, hy: 4.5, hz: 11, label: 'Hangar' });
  }

  private buildVillageAndRamps(): void {
    // Rural Village Houses in Kisanpur (280..380, -310..-210)
    const hutColors = ['#FDE68A', '#FDBA74', '#FCA5A5', '#A7F3D0'];
    const huts = [
      [295, -265],
      [330, -280],
      [355, -225],
      [285, -220],
      [315, -210]
    ];
    huts.forEach(([hx, hz], idx) => {
      const hut = new THREE.Mesh(
        new THREE.BoxGeometry(8, 4.2, 7),
        opaqueStdMat({ color: hutColors[idx % hutColors.length] })
      );
      hut.position.set(hx, 2.1, hz);
      hut.castShadow = true;
      hut.receiveShadow = true;
      this.scene.add(hut);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(6.2, 2.6, 4),
        opaqueStdMat({ color: '#9A3412' })
      );
      roof.position.set(hx, 5.5, hz);
      roof.rotation.y = Math.PI / 4;
      this.scene.add(roof);
      this.addBoxCollider({ cx: hx, cy: 3.3, cz: hz, hx: 4, hy: 3.3, hz: 3.5, label: 'Village Hut' });
    });

    // Stunt Ramps along Highway & Waterfront (exact rotated Rapier boxes)
    const rampMat = opaqueStdMat({ color: '#F97316', roughness: 0.5 });
    [
      { x: -30, z: -95, rotY: Math.PI / 2 },
      { x: 55, z: -95, rotY: Math.PI / 2 },
      { x: 110, z: 0, rotY: 0 }
    ].forEach((r) => {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 14), rampMat);
      ramp.position.set(r.x, 1.35, r.z);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = r.rotY;
      ramp.rotation.x = -0.22;
      this.scene.add(ramp);
      this.addBoxCollider(
        {
          cx: r.x,
          cy: 1.35,
          cz: r.z,
          hx: 4,
          hy: 0.25,
          hz: 7,
          rotY: r.rotY,
          rotX: -0.22,
          label: 'Stunt Ramp'
        },
        false
      );
    });
  }

  private buildHighwayGuardrails(): void {
    // Low perimeter concrete guardrails at outer highway corners & waterfront edge
    const barrierMat = opaqueStdMat({ color: '#94A3B8', roughness: 0.7 });
    const segments = [
      { x: 0, z: -195, w: 380, d: 0.8 },
      { x: 0, z: 195, w: 360, d: 0.8 },
      { x: -200, z: 0, w: 0.8, d: 260 },
      { x: 158, z: -70, w: 0.8, d: 110 }
    ];
    for (const s of segments) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, 1.0, s.d), barrierMat);
      mesh.position.set(s.x, 0.5, s.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addBoxCollider({
        cx: s.x,
        cy: 0.5,
        cz: s.z,
        hx: s.w / 2,
        hy: 0.5,
        hz: s.d / 2,
        label: 'Highway Barrier'
      });
    }
  }

  private buildInstancedFoliage(quality: GraphicsQuality): void {
    const count = quality === 'low' ? 70 : quality === 'medium' ? 130 : 210;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 4.2, 6);
    const crownGeo = new THREE.ConeGeometry(2.6, 5.2, 7);
    const trunkMat = opaqueStdMat({ color: '#78350F', roughness: 0.9 });
    const crownMat = opaqueStdMat({ color: '#15803D', roughness: 0.85 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
    const dummy = new THREE.Object3D();

    let placed = 0;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    while (placed < count) {
      const tx = (rand() - 0.5) * 820;
      const tz = (rand() - 0.5) * 820;
      // Keep out of central city asphalt, outer highways & water
      if (Math.abs(tx) < 175 && Math.abs(tz) < 175) continue;
      if (Math.abs(tz + 185) < 16 || Math.abs(tz - 185) < 16 || Math.abs(tx + 190) < 16) continue;
      if (tx > 140 && tz > 40) continue;
      if (tx < -220 && tx > -360 && tz < -190 && tz > -360) continue;

      const ty = this.getMountainBaseHeight(tx, tz);
      const scale = 0.85 + rand() * 0.7;
      dummy.position.set(tx, ty + 2.1 * scale, tz);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(tx, ty + 5.8 * scale, tz);
      dummy.updateMatrix();
      crowns.setMatrixAt(placed, dummy.matrix);

      // Exact tree trunk cylinder collider
      this.addCylinderCollider({
        x: tx,
        y: ty + 2.4 * scale,
        z: tz,
        radius: 0.45 * scale,
        halfHeight: 2.4 * scale,
        label: 'Tree'
      });

      placed++;
    }
    this.scene.add(trunks, crowns);
  }

  private buildTrafficSignalsAndStreetLights(): void {
    const intersections = [
      [-90, -90],
      [0, -90],
      [90, -90],
      [-90, 0],
      [0, 0],
      [90, 0],
      [-90, 90],
      [0, 90],
      [90, 90]
    ];
    const poleMat = opaqueStdMat({ color: '#334155' });
    const bulbGeo = new THREE.SphereGeometry(0.45, 6, 6);

    intersections.forEach(([ix, iz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 6), poleMat);
      pole.position.set(ix + 10, 3.1, iz + 10);
      this.scene.add(pole);
      this.addCylinderCollider({ x: ix + 10, y: 3.1, z: iz + 10, radius: 0.24, halfHeight: 3.1, label: 'Signal Pole' });

      const redNS = new THREE.Mesh(bulbGeo, opaqueBasicMat({ color: '#EF4444' }));
      redNS.position.set(ix + 10, 5.9, iz + 10.4);
      const greenNS = new THREE.Mesh(bulbGeo, opaqueBasicMat({ color: '#22C55E' }));
      greenNS.position.set(ix + 10, 5.2, iz + 10.4);

      const redEW = new THREE.Mesh(bulbGeo, opaqueBasicMat({ color: '#EF4444' }));
      redEW.position.set(ix + 10.4, 5.9, iz + 10);
      const greenEW = new THREE.Mesh(bulbGeo, opaqueBasicMat({ color: '#22C55E' }));
      greenEW.position.set(ix + 10.4, 5.2, iz + 10);

      this.scene.add(redNS, greenNS, redEW, greenEW);
      this.trafficSignals.push({
        x: ix,
        z: iz,
        nsGreen: true,
        redMeshNS: redNS,
        greenMeshNS: greenNS,
        redMeshEW: redEW,
        greenMeshEW: greenEW
      });
    });

    // Street lights along main avenues
    const lampMat = opaqueBasicMat({ color: '#FEF08A' });
    this.streetLightMeshes.push(lampMat);
    for (let z = -160; z <= 160; z += 40) {
      [-10, 10].forEach((x) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 5), poleMat);
        post.position.set(x, 3.25, z);
        this.scene.add(post);
        this.addCylinderCollider({ x, y: 3.25, z, radius: 0.18, halfHeight: 3.25, label: 'Light Post' });

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.4), lampMat);
        bulb.position.set(x > 0 ? x - 0.6 : x + 0.6, 6.5, z);
        this.scene.add(bulb);
      });
    }
  }

  private buildWeatherParticles(quality: GraphicsQuality): void {
    const rainCount = quality === 'low' ? 280 : quality === 'medium' ? 650 : 1100;
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      this.rainPositions[i * 3 + 1] = Math.random() * 32;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: '#BAE6FD',
      size: 0.26,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Decorative sky clouds
    const cloudMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    for (let i = 0; i < 18; i++) {
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(28, 4.5, 16), cloudMat);
      cloud.position.set((Math.random() - 0.5) * 700, 88 + Math.random() * 25, (Math.random() - 0.5) * 700);
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);
  }

  update(
    dt: number,
    timeOfDay: number,
    weather: WeatherType,
    playerPos: THREE.Vector3,
    onThunder?: () => void
  ): void {
    // Traffic light cycle every 7 seconds
    this.signalTimer += dt;
    if (this.signalTimer > 7) {
      this.signalTimer = 0;
      this.signalPhase = 1 - this.signalPhase;
      const nsGreen = this.signalPhase === 0;
      for (const sig of this.trafficSignals) {
        sig.nsGreen = nsGreen;
        sig.greenMeshNS.visible = nsGreen;
        sig.redMeshNS.visible = !nsGreen;
        sig.greenMeshEW.visible = !nsGreen;
        sig.redMeshEW.visible = nsGreen;
      }
    }

    // Door smooth open/close animations
    for (const door of this.doors) {
      const dist = Math.hypot(playerPos.x - door.x, playerPos.z - door.z);
      door.open = dist < 4.5;
      door.targetAngle = door.open ? Math.PI * 0.48 : 0;
      door.pivot.rotation.y += (door.targetAngle - door.pivot.rotation.y) * Math.min(1, dt * 7);
    }

    // Sun & Sky Day/Night cycle
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(angle);
    const isNight = sunElev < 0.05;

    this.sunLight.position.set(
      playerPos.x + Math.cos(angle) * 160,
      Math.max(24, sunElev * 190 + 30),
      playerPos.z + 90
    );
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    if (sunElev > 0.35) {
      this.skyColor.set(weather === 'rain' || weather === 'thunderstorm' ? '#475569' : '#38BDF8');
      this.sunLight.intensity = weather === 'clear' ? 1.45 : 0.85;
      this.sunLight.color.set('#FFFBEB');
      this.hemiLight.intensity = 0.85;
    } else if (sunElev > -0.1) {
      this.skyColor.set('#FB923C');
      this.sunLight.intensity = 0.95;
      this.sunLight.color.set('#FDBA74');
      this.hemiLight.intensity = 0.6;
    } else {
      this.skyColor.set('#090D16');
      this.sunLight.intensity = 0.25;
      this.sunLight.color.set('#64748B');
      this.hemiLight.intensity = 0.34;
    }

    // Thunderstorm lightning flash
    if (weather === 'thunderstorm' && Math.random() < dt * 0.14) {
      this.lightningFlash = 1.0;
      onThunder?.();
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.5);
      this.sunLight.intensity += this.lightningFlash * 2.5;
      this.skyColor.lerp(new THREE.Color('#E0F2FE'), this.lightningFlash * 0.65);
    }

    this.fogColor.copy(this.skyColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.density =
        weather === 'fog' ? 0.0085 : weather === 'thunderstorm' ? 0.0045 : weather === 'rain' ? 0.0032 : 0.0018;
    }

    // Night street lights & building windows
    if (this.windowMat) {
      this.windowMat.emissiveIntensity = isNight ? 1.1 : 0.1;
    }
    for (const mat of this.streetLightMeshes) {
      mat.color.set(isNight ? '#FEF08A' : '#64748B');
    }

    // Wet road glossiness in rain
    if (this.roadMat) {
      const wet = weather === 'rain' || weather === 'thunderstorm';
      this.roadMat.roughness = wet ? 0.24 : 0.85;
      this.roadMat.metalness = wet ? 0.38 : 0.08;
    }

    // Rain particle update around player
    const isRaining = weather === 'rain' || weather === 'thunderstorm';
    this.rainPoints.visible = isRaining;
    if (isRaining) {
      this.rainPoints.position.set(playerPos.x, 0, playerPos.z);
      const count = this.rainPositions.length / 3;
      for (let i = 0; i < count; i++) {
        this.rainPositions[i * 3 + 1] -= dt * 34;
        if (this.rainPositions[i * 3 + 1] < 0) {
          this.rainPositions[i * 3 + 1] = 28 + Math.random() * 6;
        }
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Drift clouds gently
    this.cloudGroup.position.x = ((this.cloudGroup.position.x + dt * 2.2 + 300) % 600) - 300;
  }

  getMountainBaseHeight(x: number, z: number): number {
    if (x < -190 && z > 130) {
      const dx = Math.max(0, -190 - x);
      const dz = Math.max(0, z - 130);
      const dist = Math.min(260, Math.hypot(dx, dz));
      return Math.pow(dist / 260, 1.35) * 19;
    }
    return 0;
  }

  getGroundHeight(x: number, z: number, currentY = 0): number {
    let h = this.getMountainBaseHeight(x, z);

    // Sea Link Bridge Deck
    const dxBridge = x - 180;
    const dzBridge = z - 115;
    const angle = Math.atan2(130, 145);
    const localZ = dxBridge * Math.sin(angle) + dzBridge * Math.cos(angle);
    const localX = dxBridge * Math.cos(angle) - dzBridge * Math.sin(angle);
    if (Math.abs(localX) < 8.5 && Math.abs(localZ) < 105) {
      const rampSlope = Math.max(0, 1 - Math.max(0, Math.abs(localZ) - 82) / 23);
      h = Math.max(h, 4.65 * rampSlope);
    }

    // Downtown Flyover at z: 39..51, x: -82..82
    if (Math.abs(z - 45) < 6.5 && Math.abs(x) < 83) {
      if (Math.abs(x) <= 55) {
        if (currentY >= 2.2) h = Math.max(h, 5.15);
      } else {
        const rampT = 1 - (Math.abs(x) - 55) / 28;
        h = Math.max(h, 5.15 * Math.max(0, rampT));
      }
    }

    // Stunt Ramps
    const ramps = [
      { x: -30, z: -95 },
      { x: 55, z: -95 }
    ];
    for (const r of ramps) {
      if (Math.abs(z - r.z) < 4.5 && Math.abs(x - r.x) < 7.2) {
        const t = (x - (r.x - 7)) / 14;
        h = Math.max(h, Math.max(0, t) * 3.1);
      }
    }

    // Player Mansion Staircase & Roof Terrace (-145, -135)
    const hx = -145;
    const hz = -135;
    if (x >= hx - 0.2 && x <= hx + 3.2 && z >= hz - 4 && z <= hz + 4.5) {
      const stairProgress = Math.min(1, Math.max(0, (hz + 4 - z) / 8));
      h = Math.max(h, 0.25 + stairProgress * 4.35);
    } else if (
      currentY >= 3.3 &&
      x >= hx - 11 &&
      x <= hx + 11 &&
      z >= hz - 9 &&
      z <= hz + 9
    ) {
      h = Math.max(h, 4.6);
    } else if (x >= hx - 11 && x <= hx + 11 && z >= hz - 9 && z <= hz + 9) {
      h = Math.max(h, 0.25);
    }

    return h;
  }

  isWaterAt(x: number, z: number): boolean {
    if (x > 160 && z > -20) {
      const onBridge = this.getGroundHeight(x, z, 5) > 2.2;
      if (!onBridge) return true;
    }
    if (Math.hypot(x - 365, z + 135) < 40) return true;
    const p = this.zones.poolBounds;
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return true;
    return false;
  }

  isSignalRedForDirection(x: number, z: number, movingAlongZ: boolean): boolean {
    for (const sig of this.trafficSignals) {
      if (Math.hypot(x - sig.x, z - sig.z) < 16) {
        return movingAlongZ ? !sig.nsGreen : sig.nsGreen;
      }
    }
    return false;
  }

  resolveHorizontalCollision(
    x: number,
    z: number,
    y: number,
    radius: number,
    height = 1.8
  ): { x: number; z: number; hit: boolean } {
    let rx = x;
    let rz = z;
    let hit = false;
    const minObjY = y + 0.25;
    const maxObjY = y + height;

    for (const c of this.colliders) {
      const cMinY = c.minY ?? -10;
      if (maxObjY <= cMinY || minObjY >= c.maxY) continue;

      const closestX = THREE.MathUtils.clamp(rx, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, c.minZ, c.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          const dLeft = Math.abs(rx - c.minX);
          const dRight = Math.abs(c.maxX - rx);
          const dTop = Math.abs(rz - c.minZ);
          const dBottom = Math.abs(c.maxZ - rz);
          const minD = Math.min(dLeft, dRight, dTop, dBottom);
          if (minD === dLeft) rx = c.minX - radius;
          else if (minD === dRight) rx = c.maxX + radius;
          else if (minD === dTop) rz = c.minZ - radius;
          else rz = c.maxZ + radius;
        }
      }
    }

    return { x: rx, z: rz, hit };
  }

  getZoneName(x: number, z: number): string {
    if (Math.hypot(x + 145, z + 135) < 34) return 'Marina Luxury Mansion';
    if (Math.hypot(x - 65, z - 55) < 25) return 'Police HQ District';
    if (Math.hypot(x + 75, z + 25) < 25) return 'City Hospital Safe Zone';
    if (x < -220 && z < -190) return 'Mumbai International Airport';
    if (x < -190 && z > 130) return 'Sahyadri Mountain Ghats';
    if (x > 220 && z < -110) return 'Kisanpur Rural Village';
    if (x > 155 && z > 40) return 'Bandra Sea Link Waterfront';
    return 'Central Mumbai Metro';
  }
}
