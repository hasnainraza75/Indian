import * as THREE from 'three';
import { CharacterRig, createCharacterRig } from '../entities/MeshFactory';
import { PhysicsWorld, RapierPlayerHandle } from '../physics/PhysicsWorld';
import { CheatFlagKey, WeaponId } from '../types';
import { WorldBuilder } from '../world/WorldBuilder';

export interface PlayerInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  sprint: boolean;
  jumpPressed: boolean;
  crouchToggle: boolean;
}

export class PlayerController {
  readonly rig: CharacterRig;
  readonly pos = new THREE.Vector3(-130, 0.2, -116);
  readonly vel = new THREE.Vector3();
  rotY = 0;
  health = 100;
  maxHealth = 100;
  armor = 50;

  isGrounded = true;
  isCrouching = false;
  isSwimming = false;
  inVehicle = false;
  animTime = 0;
  attackAnimTimer = 0;

  private physicsHandle: RapierPlayerHandle | null = null;

  constructor(scene: THREE.Scene) {
    this.rig = createCharacterRig('#F97316', '#1E293B', '#C68642', false, false);
    this.rig.group.position.copy(this.pos);
    scene.add(this.rig.group);
  }

  attachPhysics(physics: PhysicsWorld): void {
    this.physicsHandle = physics.createPlayerController(this.pos.x, this.pos.y, this.pos.z);
  }

  setPosition(x: number, y: number, z: number): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (this.physicsHandle) {
      const offset = this.physicsHandle.capsuleCenterOffsetY;
      this.physicsHandle.body.setTranslation({ x, y: y + offset, z }, true);
      this.physicsHandle.body.setNextKinematicTranslation({ x, y: y + offset, z });
    }
    this.rig.group.position.copy(this.pos);
  }

  setInVehicle(inside: boolean): void {
    this.inVehicle = inside;
    if (this.physicsHandle) {
      this.physicsHandle.collider.setEnabled(!inside);
    }
  }

  setVisible(visible: boolean): void {
    this.rig.group.visible = visible;
  }

  update(
    dt: number,
    input: PlayerInputState,
    cameraYaw: number,
    world: WorldBuilder,
    activeCheats: Record<CheatFlagKey, boolean>,
    activeWeapon: WeaponId,
    isAiming: boolean
  ): void {
    if (activeCheats.infinityHealth) {
      this.health = this.maxHealth;
    }

    if (this.inVehicle) {
      this.animateSeated();
      return;
    }

    if (input.crouchToggle) {
      this.isCrouching = !this.isCrouching;
    }

    const inputMag = Math.min(1, Math.hypot(input.moveX, input.moveY));
    const inWater = world.isWaterAt(this.pos.x, this.pos.z) && this.pos.y < 0.85;
    this.isSwimming = inWater;

    const baseSpeed = this.isSwimming
      ? 5.2
      : this.isCrouching
        ? 3.1
        : input.sprint
          ? 11.4
          : 6.4;

    if (inputMag > 0.08) {
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      const moveDirX = forwardX * input.moveY + rightX * input.moveX;
      const moveDirZ = forwardZ * input.moveY + rightZ * input.moveX;
      const len = Math.max(0.001, Math.hypot(moveDirX, moveDirZ));
      const nx = moveDirX / len;
      const nz = moveDirZ / len;

      this.vel.x = nx * baseSpeed * inputMag;
      this.vel.z = nz * baseSpeed * inputMag;

      const targetRot = isAiming ? cameraYaw + Math.PI : Math.atan2(nx, nz);
      let diff = targetRot - this.rotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rotY += diff * Math.min(1, dt * 12);
    } else {
      this.vel.x *= Math.max(0, 1 - dt * 12);
      this.vel.z *= Math.max(0, 1 - dt * 12);
      if (isAiming) {
        const targetRot = cameraYaw + Math.PI;
        let diff = targetRot - this.rotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotY += diff * Math.min(1, dt * 14);
      }
    }

    const gravity = activeCheats.moonGravity ? 6.5 : 22.0;
    if (input.jumpPressed && (this.isGrounded || this.isSwimming)) {
      const jumpPower = activeCheats.ultraSuperJump
        ? 28
        : activeCheats.superJump
          ? 18
          : 9.2;
      this.vel.y = jumpPower;
      this.isGrounded = false;
      this.isCrouching = false;
    }

    if (this.isSwimming) {
      this.vel.y = Math.max(-1.5, this.vel.y - gravity * 0.2 * dt);
    } else {
      this.vel.y -= gravity * dt;
    }

    if (this.physicsHandle) {
      const { body, collider, controller, capsuleCenterOffsetY } = this.physicsHandle;
      // Disable snap to ground while jumping upward
      if (this.vel.y > 0.5) {
        controller.disableSnapToGround();
      } else {
        controller.enableSnapToGround(0.28);
      }

      const desiredDelta = {
        x: this.vel.x * dt,
        y: this.vel.y * dt,
        z: this.vel.z * dt
      };

      controller.computeColliderMovement(collider, desiredDelta);
      const corrected = controller.computedMovement();
      const prevY = this.vel.y;
      const t = body.translation();

      let nextCenterX = THREE.MathUtils.clamp(t.x + corrected.x, -460, 460);
      let nextCenterY = t.y + corrected.y;
      let nextCenterZ = THREE.MathUtils.clamp(t.z + corrected.z, -460, 460);

      const feetY = nextCenterY - capsuleCenterOffsetY;

      if (this.isSwimming && feetY < -0.22) {
        nextCenterY = -0.22 + capsuleCenterOffsetY;
        this.vel.y = Math.max(0, this.vel.y);
        this.isGrounded = true;
      } else {
        const grounded = controller.computedGrounded() && this.vel.y <= 0.1;
        if (grounded) {
          if (
            prevY < -19 &&
            !activeCheats.infinityHealth &&
            !activeCheats.superJump &&
            !activeCheats.ultraSuperJump
          ) {
            const fallDmg = Math.min(45, (-prevY - 18) * 3.5);
            this.applyDamage(fallDmg);
          }
          this.vel.y = 0;
        }
        this.isGrounded = grounded;
      }

      body.setNextKinematicTranslation({ x: nextCenterX, y: nextCenterY, z: nextCenterZ });
      this.pos.set(nextCenterX, nextCenterY - capsuleCenterOffsetY, nextCenterZ);
    } else {
      // Fallback if physics handle unavailable
      this.pos.x = THREE.MathUtils.clamp(this.pos.x + this.vel.x * dt, -460, 460);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z + this.vel.z * dt, -460, 460);
      this.pos.y += this.vel.y * dt;
      const gh = world.getGroundHeight(this.pos.x, this.pos.z, this.pos.y);
      if (this.pos.y <= gh) {
        this.pos.y = gh;
        this.vel.y = 0;
        this.isGrounded = true;
      }
    }

    this.rig.group.position.copy(this.pos);
    this.rig.group.rotation.y = this.rotY;

    this.animateOnFoot(dt, inputMag, input.sprint, activeWeapon, isAiming);
  }

  applyDamage(amount: number): void {
    if (amount <= 0) return;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.65);
      this.armor = Math.max(0, this.armor - absorbed);
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
  }

  triggerAttackAnim(): void {
    this.attackAnimTimer = 0.25;
  }

  private animateSeated(): void {
    this.rig.weaponMesh.visible = false;
    this.rig.leftLeg.rotation.x = -1.25;
    this.rig.rightLeg.rotation.x = -1.25;
    this.rig.leftArm.rotation.x = -0.75;
    this.rig.rightArm.rotation.x = -0.75;
    this.rig.torso.position.y = 1.02;
    this.rig.group.scale.y = 1;
  }

  private animateOnFoot(
    dt: number,
    inputMag: number,
    sprint: boolean,
    activeWeapon: WeaponId,
    isAiming: boolean
  ): void {
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.animTime += dt * (horizSpeed > 0.5 ? horizSpeed * 1.45 : 2.0);
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);

    this.rig.weaponMesh.visible = activeWeapon !== 'fists';
    this.rig.group.scale.y = this.isCrouching ? 0.72 : 1.0;

    if (this.isSwimming) {
      const stroke = Math.sin(this.animTime * 2.2) * 0.9;
      this.rig.leftArm.rotation.x = -1.2 + stroke;
      this.rig.rightArm.rotation.x = -1.2 - stroke;
      this.rig.leftLeg.rotation.x = stroke * 0.5;
      this.rig.rightLeg.rotation.x = -stroke * 0.5;
      return;
    }

    if (!this.isGrounded) {
      this.rig.leftLeg.rotation.x = -0.45;
      this.rig.rightLeg.rotation.x = 0.35;
      this.rig.leftArm.rotation.x = -0.7;
      this.rig.rightArm.rotation.x = -0.7;
      return;
    }

    if (horizSpeed > 0.6 && inputMag > 0.05) {
      const amp = sprint ? 0.85 : 0.55;
      const swing = Math.sin(this.animTime) * amp;
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.leftArm.rotation.x = -swing * 0.8;
      this.rig.rightArm.rotation.x = isAiming || activeWeapon !== 'fists' ? -1.45 : swing * 0.8;
    } else {
      const breath = Math.sin(this.animTime) * 0.03;
      this.rig.leftLeg.rotation.x = 0;
      this.rig.rightLeg.rotation.x = 0;
      this.rig.leftArm.rotation.x = breath;
      this.rig.rightArm.rotation.x = isAiming || activeWeapon !== 'fists' ? -1.45 : -breath;
    }

    if (this.attackAnimTimer > 0) {
      const punch = Math.sin((this.attackAnimTimer / 0.25) * Math.PI) * 1.4;
      this.rig.rightArm.rotation.x = -1.3 - punch * 0.4;
    }
  }
}
