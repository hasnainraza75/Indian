import * as THREE from 'three';

export class CameraSystem {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.28;
  private currentPos = new THREE.Vector3(-130, 6, -128);
  private currentTarget = new THREE.Vector3(-130, 1.5, -116);
  private shakeIntensity = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.2, 520);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.5, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  addInput(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * 0.0055 * sensitivity;
    this.pitch = Math.max(-0.15, Math.min(1.15, this.pitch + dy * 0.0045 * sensitivity));
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
    vehicleLength: number,
    speedKmh: number,
    isAiming: boolean,
    nitroActive: boolean,
    isIndoors: boolean,
    hasManualCameraInput: boolean
  ): void {
    // Auto-follow behind vehicle smoothly when driving without manual camera drag
    if (inVehicle && !hasManualCameraInput && speedKmh > 6) {
      const desiredYaw = targetYaw + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 2.2);
    }

    const baseDist = inVehicle
      ? Math.max(6.2, vehicleLength * 1.45 + 2.4)
      : isAiming
        ? 3.1
        : isIndoors
          ? 4.2
          : 5.8;

    const targetFov = nitroActive ? 76 : isAiming ? 48 : 62 + Math.min(10, speedKmh / 35);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    const lookOffset = new THREE.Vector3(
      targetPos.x + (isAiming ? Math.cos(this.yaw) * 0.65 : 0),
      targetPos.y + (inVehicle ? 1.55 : isAiming ? 1.52 : 1.45),
      targetPos.z - (isAiming ? Math.sin(this.yaw) * 0.65 : 0)
    );

    const horizDist = baseDist * Math.cos(this.pitch);
    const vertDist = baseDist * Math.sin(this.pitch) + (inVehicle ? 1.2 : 0.7);

    const desiredPos = new THREE.Vector3(
      lookOffset.x + Math.sin(this.yaw) * horizDist,
      Math.max(lookOffset.y + 0.35, lookOffset.y + vertDist),
      lookOffset.z + Math.cos(this.yaw) * horizDist
    );

    const smooth = Math.min(1, dt * (inVehicle ? 11 : 13));
    this.currentPos.lerp(desiredPos, smooth);
    this.currentTarget.lerp(lookOffset, Math.min(1, dt * 16));

    this.camera.position.copy(this.currentPos);
    if (this.shakeIntensity > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.8);
    }

    this.camera.lookAt(this.currentTarget);
  }
}
