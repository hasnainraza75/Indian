import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CameraMode } from '../types';

export class CameraSystem {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.28;
  mode: CameraMode = 'third_person';
  zoomOffset = 0;

  private physics: PhysicsWorld | null = null;
  private currentPos = new THREE.Vector3(-130, 6, -128);
  private currentTarget = new THREE.Vector3(-130, 1.5, -116);
  private shakeIntensity = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.2, 540);
  }

  setPhysicsWorld(physics: PhysicsWorld): void {
    this.physics = physics;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.5, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  cycleMode(): CameraMode {
    const order: CameraMode[] = ['third_person', 'far', 'first_person'];
    const idx = order.indexOf(this.mode);
    this.mode = order[(idx + 1) % order.length];
    return this.mode;
  }

  adjustZoom(delta: number): void {
    this.zoomOffset = THREE.MathUtils.clamp(this.zoomOffset + delta, -2.0, 5.5);
  }

  addInput(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * 0.0055 * sensitivity;
    this.pitch = Math.max(-0.22, Math.min(1.15, this.pitch + dy * 0.0045 * sensitivity));
  }

  addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.9, this.shakeIntensity + amount);
  }

  snapBehind(target: THREE.Vector3, rotY: number): void {
    this.yaw = rotY + Math.PI;
    this.currentTarget.copy(target);
    this.currentPos.set(
      target.x + Math.sin(this.yaw) * 7,
      target.y + 3.2,
      target.z + Math.cos(this.yaw) * 7
    );
  }

  update(
    dt: number,
    targetPos: THREE.Vector3,
    targetYaw: number,
    inVehicle: boolean,
    isHelicopter: boolean,
    vehicleLength: number,
    vehicleHeight: number,
    speedKmh: number,
    isAiming: boolean,
    nitroActive: boolean,
    isIndoors: boolean,
    hasManualCameraInput: boolean
  ): void {
    // Auto-follow behind vehicle smoothly when driving without manual camera drag
    if (inVehicle && !hasManualCameraInput && (speedKmh > 6 || this.mode === 'first_person' || isHelicopter)) {
      const desiredYaw = targetYaw + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const followRate = this.mode === 'first_person' ? 8.5 : isHelicopter ? 3.2 : 2.4;
      this.yaw += diff * Math.min(1, dt * followRate);
    }

    const targetFov = nitroActive
      ? 78
      : isAiming
        ? 48
        : this.mode === 'first_person'
          ? 70
          : 62 + Math.min(11, speedKmh / 32);

    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    // First-person cockpit / eye view
    if (this.mode === 'first_person' && !isAiming) {
      const eyeHeight = inVehicle ? Math.max(1.25, vehicleHeight * 0.62) : 1.62;
      const fwdX = Math.sin(targetYaw);
      const fwdZ = Math.cos(targetYaw);
      const cabOffset = inVehicle ? (isHelicopter ? 0.85 : 0.25) : 0.15;

      const eyePos = new THREE.Vector3(
        targetPos.x + fwdX * cabOffset,
        targetPos.y + eyeHeight,
        targetPos.z + fwdZ * cabOffset
      );

      const lookDirX = -Math.sin(this.yaw);
      const lookDirZ = -Math.cos(this.yaw);
      const lookAt = new THREE.Vector3(
        eyePos.x + lookDirX * 18,
        eyePos.y - Math.sin(this.pitch - 0.18) * 12,
        eyePos.z + lookDirZ * 18
      );

      this.currentPos.lerp(eyePos, Math.min(1, dt * 20));
      this.currentTarget.lerp(lookAt, Math.min(1, dt * 20));
      this.camera.position.copy(this.currentPos);
      this.applyShake(dt);
      this.camera.lookAt(this.currentTarget);
      return;
    }

    // 3rd person or Far chase distance
    let baseDist = inVehicle
      ? isHelicopter
        ? Math.max(11.5, vehicleLength * 1.45 + 3.2)
        : Math.max(6.2, vehicleLength * 1.42 + 2.4)
      : isAiming
        ? 3.1
        : isIndoors
          ? 3.8
          : 5.8;

    if (this.mode === 'far') {
      baseDist += inVehicle ? 4.4 : 2.6;
    }
    baseDist = THREE.MathUtils.clamp(baseDist + this.zoomOffset, 2.5, 22);

    const lookOffset = new THREE.Vector3(
      targetPos.x + (isAiming ? Math.cos(this.yaw) * 0.65 : 0),
      targetPos.y + (isHelicopter ? 1.8 : inVehicle ? 1.5 : isAiming ? 1.52 : 1.45),
      targetPos.z - (isAiming ? Math.sin(this.yaw) * 0.65 : 0)
    );

    const horizDist = baseDist * Math.cos(this.pitch);
    const vertDist = baseDist * Math.sin(this.pitch) + (isHelicopter ? 2.1 : inVehicle ? 1.25 : 0.75);

    const desiredPos = new THREE.Vector3(
      lookOffset.x + Math.sin(this.yaw) * horizDist,
      Math.max(lookOffset.y + 0.35, lookOffset.y + vertDist),
      lookOffset.z + Math.cos(this.yaw) * horizDist
    );

    // Rapier raycast collision check so camera never clips inside/behind buildings or terrain
    if (this.physics) {
      const toCam = desiredPos.clone().sub(lookOffset);
      const dist = toCam.length();
      if (dist > 0.25) {
        const dir = toCam.divideScalar(dist);
        const hitToi = this.physics.castCameraRay(lookOffset, dir, dist + 0.45);
        if (hitToi !== null && hitToi < dist) {
          const safeDist = Math.max(0.75, hitToi - 0.38);
          desiredPos.copy(lookOffset).addScaledVector(dir, safeDist);
        }
      }

      const groundBelowCam = this.physics.castGroundHeightRay(desiredPos.x, desiredPos.y + 4, desiredPos.z, 25);
      if (groundBelowCam !== null && desiredPos.y < groundBelowCam + 0.48) {
        desiredPos.y = groundBelowCam + 0.48;
      }
    }

    const smooth = Math.min(1, dt * (inVehicle ? 12 : 14));
    this.currentPos.lerp(desiredPos, smooth);
    this.currentTarget.lerp(lookOffset, Math.min(1, dt * 16));

    this.camera.position.copy(this.currentPos);
    this.applyShake(dt);
    this.camera.lookAt(this.currentTarget);
  }

  private applyShake(dt: number): void {
    if (this.shakeIntensity > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.8);
    }
  }
}

