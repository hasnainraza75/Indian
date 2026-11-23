import * as THREE from 'three';
import { MISSIONS } from '../data/missionsData';
import { ActiveMissionState, MissionDef } from '../types';

export class MissionSystem {
  readonly scene: THREE.Scene;
  private beaconGroup: THREE.Group;
  private beaconRing: THREE.Mesh;
  private beaconBeam: THREE.Mesh;

  activeDef: MissionDef | null = null;
  checkpointIdx = 0;
  timeRemaining = 0;
  killsDone = 0;
  airtimeDone = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.beaconGroup = new THREE.Group();

    this.beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 5.4, 28),
      new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide })
    );
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.22;

    this.beaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 24, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#FACC15',
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      })
    );
    this.beaconBeam.position.y = 12;
    this.beaconGroup.add(this.beaconRing, this.beaconBeam);
    this.beaconGroup.visible = false;
    this.scene.add(this.beaconGroup);
  }

  startMission(missionId: string): MissionDef | null {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return null;
    this.activeDef = def;
    this.checkpointIdx = 0;
    this.timeRemaining = def.timeLimitSec;
    this.killsDone = 0;
    this.airtimeDone = 0;
    this.updateBeaconPosition();
    return def;
  }

  abortMission(): void {
    this.activeDef = null;
    this.beaconGroup.visible = false;
  }

  recordHostileKill(): void {
    if (!this.activeDef) return;
    this.killsDone++;
  }

  recordAirtime(dt: number): void {
    if (!this.activeDef || !this.activeDef.targetAirtimeSec) return;
    this.airtimeDone += dt;
  }

  private updateBeaconPosition(): void {
    if (!this.activeDef) {
      this.beaconGroup.visible = false;
      return;
    }
    const cp = this.activeDef.checkpoints[this.checkpointIdx];
    if (!cp) {
      this.beaconGroup.visible = false;
      return;
    }
    this.beaconGroup.position.set(cp.x, cp.y, cp.z);
    const scale = cp.radius / 5;
    this.beaconRing.scale.setScalar(scale);
    this.beaconGroup.visible = true;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    wantedStars: number
  ): {
    status: 'idle' | 'active' | 'completed' | 'failed';
    reward: number;
    bonus: number;
    title: string;
    reason: string;
  } {
    if (!this.activeDef) {
      return { status: 'idle', reward: 0, bonus: 0, title: '', reason: '' };
    }

    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      const title = this.activeDef.title;
      this.abortMission();
      return { status: 'failed', reward: 0, bonus: 0, title, reason: 'Time expired!' };
    }

    this.beaconGroup.rotation.y += dt * 1.8;

    const cp = this.activeDef.checkpoints[this.checkpointIdx];
    const dist = cp ? Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z) : 999;

    const killsOk =
      !this.activeDef.targetKills || this.killsDone >= this.activeDef.targetKills;
    const airOk =
      !this.activeDef.targetAirtimeSec || this.airtimeDone >= this.activeDef.targetAirtimeSec;
    const wantedClearedOk =
      !this.activeDef.minWantedStars || wantedStars === 0;

    if (cp && dist <= cp.radius) {
      const isLast = this.checkpointIdx >= this.activeDef.checkpoints.length - 1;
      if (!isLast) {
        this.checkpointIdx++;
        this.updateBeaconPosition();
      } else if (killsOk && airOk && wantedClearedOk) {
        const wonDef = this.activeDef;
        const speedBonus = this.timeRemaining > wonDef.timeLimitSec * 0.3 ? wonDef.bonus : Math.round(wonDef.bonus * 0.4);
        this.abortMission();
        return {
          status: 'completed',
          reward: wonDef.reward,
          bonus: speedBonus,
          title: wonDef.title,
          reason: 'All objectives accomplished!'
        };
      }
    }

    return { status: 'active', reward: 0, bonus: 0, title: this.activeDef.title, reason: '' };
  }

  getActiveState(): ActiveMissionState | null {
    if (!this.activeDef) return null;
    const cp = this.activeDef.checkpoints[this.checkpointIdx] ?? this.activeDef.checkpoints[0];
    let objectiveText = `Reach ${cp.label}`;
    if (this.activeDef.targetKills && this.killsDone < this.activeDef.targetKills) {
      objectiveText = `Eliminate hostiles (${this.killsDone}/${this.activeDef.targetKills}) & reach ${cp.label}`;
    } else if (
      this.activeDef.targetAirtimeSec &&
      this.airtimeDone < this.activeDef.targetAirtimeSec
    ) {
      objectiveText = `Stunt airtime (${this.airtimeDone.toFixed(1)}s/${this.activeDef.targetAirtimeSec}s) & reach ${cp.label}`;
    } else if (this.activeDef.minWantedStars) {
      objectiveText = `Evade Police & reach ${cp.label}`;
    }

    return {
      missionId: this.activeDef.id,
      title: this.activeDef.title,
      category: this.activeDef.category,
      objectiveText,
      checkpointIndex: this.checkpointIdx,
      totalCheckpoints: this.activeDef.checkpoints.length,
      targetX: cp.x,
      targetZ: cp.z,
      timeRemainingSec: Math.max(0, Math.ceil(this.timeRemaining)),
      progress: this.checkpointIdx / this.activeDef.checkpoints.length,
      killsDone: this.killsDone,
      killsRequired: this.activeDef.targetKills ?? 0,
      airtimeDone: this.airtimeDone,
      airtimeRequired: this.activeDef.targetAirtimeSec ?? 0
    };
  }
}
