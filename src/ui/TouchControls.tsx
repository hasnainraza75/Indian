import React, { useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Flame,
  Fuel,
  RotateCw,
  Shield,
  Volume2,
  Zap,
  Car,
  LogOut,
  Pause,
  Phone,
  Star,
  MapPin,
  Swords,
  ChevronUp,
  ChevronDown,
  Wrench,
  ShoppingBag,
  Flag
} from 'lucide-react';
import { ControlInputBridge } from '../game/GameEngine';
import { HudSnapshot, SteeringMode } from '../game/types';
import { MiniMap } from './MiniMap';

interface TouchControlsProps {
  hud: HudSnapshot;
  steeringMode: SteeringMode;
  onInput: (patch: Partial<ControlInputBridge>) => void;
  onCameraDrag: (dx: number, dy: number) => void;
  onCameraEnd: () => void;
  onEnterExit: () => void;
  onHorn: () => void;
  onReload: () => void;
  onCycleWeapon: () => void;
  onRefuel: () => void;
  onOpenPhone: () => void;
  onOpenMap: () => void;
  onOpenPause: () => void;
  onOpenGarage: () => void;
  onOpenArmory: () => void;
  onStartMission: (id: string) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  hud,
  steeringMode,
  onInput,
  onCameraDrag,
  onCameraEnd,
  onEnterExit,
  onHorn,
  onReload,
  onCycleWeapon,
  onRefuel,
  onOpenPhone,
  onOpenMap,
  onOpenPause,
  onOpenGarage,
  onOpenArmory,
  onStartMission
}) => {
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const camPointerId = useRef<number | null>(null);
  const camLast = useRef({ x: 0, y: 0 });
  const [sprintOn, setSprintOn] = useState(false);

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    if (hud.inVehicle) {
      onInput({ steer: 0 });
    } else {
      onInput({ moveX: 0, moveY: 0 });
    }
  };

  const updateJoystick = (cx: number, cy: number) => {
    const maxR = 44;
    const dx = cx - joyCenter.current.x;
    const dy = cy - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clamped;
    const ky = Math.sin(ang) * clamped;
    setJoyKnob({ x: kx, y: ky });

    const nx = kx / maxR;
    const ny = -ky / maxR;
    if (hud.inVehicle) {
      onInput({ steer: nx });
    } else {
      onInput({ moveX: nx, moveY: ny, sprint: sprintOn || dist > maxR * 0.85 });
    }
  };

  const handleCamDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerId.current !== null) return;
    camPointerId.current = e.pointerId;
    camLast.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCamMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerId.current !== e.pointerId) return;
    const dx = e.clientX - camLast.current.x;
    const dy = e.clientY - camLast.current.y;
    camLast.current = { x: e.clientX, y: e.clientY };
    onCameraDrag(dx, dy);
  };

  const handleCamUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerId.current !== e.pointerId) return;
    camPointerId.current = null;
    onCameraEnd();
  };

  const timeFormatted = `${Math.floor(hud.timeOfDay).toString().padStart(2, '0')}:${Math.floor(
    (hud.timeOfDay % 1) * 60
  )
    .toString()
    .padStart(2, '0')}`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
      {/* Camera Swipe Surface (Right & Center Background) */}
      <div
        className="touch-none"
        onPointerDown={handleCamDown}
        onPointerMove={handleCamMove}
        onPointerUp={handleCamUp}
        onPointerCancel={handleCamUp}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto'
        }}
      />

      {/* Damage Flash Vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle, transparent 45%, rgba(239, 68, 68, ${hud.damageFlash * 0.72}) 100%)`,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* TOP LEFT HUD: Health, Armor, Wanted Stars, Zone */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'auto'
        }}
      >
        <div
          className="glass-panel"
          style={{
            borderRadius: 14,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div style={{ minWidth: 112 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800 }}>
              <span style={{ color: '#22C55E' }}>HP {hud.health}</span>
              <span style={{ color: '#38BDF8' }}>ARM {hud.armor}</span>
            </div>
            <div style={{ height: 6, background: '#1E293B', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%`,
                  height: '100%',
                  background: hud.activeCheats.infinityHealth
                    ? 'linear-gradient(90deg, #FACC15, #22C55E)'
                    : 'linear-gradient(90deg, #EF4444, #22C55E)'
                }}
              />
            </div>
            <div style={{ height: 4, background: '#1E293B', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, hud.armor))}%`,
                  height: '100%',
                  background: '#38BDF8'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={15}
                fill={s <= hud.wantedStars ? '#FACC15' : 'transparent'}
                color={s <= hud.wantedStars ? '#FACC15' : '#475569'}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700
          }}
        >
          <span
            className="glass-panel"
            style={{ padding: '3px 9px', borderRadius: 999, color: '#E2E8F0' }}
          >
            {hud.zoneName}
          </span>
          <span
            className="glass-panel"
            style={{ padding: '3px 8px', borderRadius: 999, color: '#38BDF8' }}
          >
            {timeFormatted} · {hud.weather.toUpperCase()} · {hud.fps} FPS
          </span>
          {hud.inSafeZone && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(34, 197, 94, 0.22)',
                border: '1px solid #22C55E',
                color: '#86EFAC'
              }}
            >
              SAFE ZONE
            </span>
          )}
        </div>

        {/* Active Mission Banner */}
        {hud.activeMission && (
          <div
            className="glass-panel"
            style={{
              padding: '7px 10px',
              borderRadius: 12,
              borderLeft: '3px solid #FACC15',
              maxWidth: 270
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800 }}>
              <span style={{ color: '#FACC15' }}>{hud.activeMission.title}</span>
              <span style={{ color: '#FCA5A5', fontFamily: 'monospace' }}>
                {hud.activeMission.timeRemainingSec}s
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#E2E8F0', marginTop: 2 }}>
              {hud.activeMission.objectiveText}
            </div>
          </div>
        )}
      </div>

      {/* TOP RIGHT HUD: Money, Minimap, Phone & Pause */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              borderRadius: 12,
              fontFamily: 'monospace',
              fontSize: 17,
              fontWeight: 900,
              color: '#4ADE80',
              letterSpacing: 0.5
            }}
          >
            ${hud.money.toLocaleString()}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <CircleHudBtn onClick={onOpenPhone} label="Mobile Phone" bg="rgba(14, 165, 233, 0.85)">
              <Phone size={18} />
            </CircleHudBtn>
            <CircleHudBtn onClick={onOpenMap} label="World Map" bg="rgba(30, 41, 59, 0.88)">
              <MapPin size={18} />
            </CircleHudBtn>
            <CircleHudBtn onClick={onOpenPause} label="Pause Menu" bg="rgba(30, 41, 59, 0.88)">
              <Pause size={18} />
            </CircleHudBtn>
          </div>
        </div>

        <MiniMap
          playerX={hud.playerX}
          playerZ={hud.playerZ}
          playerRotY={hud.playerRotY}
          markers={hud.markers}
          onClick={onOpenMap}
        />
      </div>

      {/* CENTER TOAST / STUNT / CONTEXTUAL PROMPTS */}
      {(hud.toast || hud.stuntBanner) && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none'
          }}
        >
          {hud.toast && (
            <div
              className="glass-panel"
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                border:
                  hud.toast.kind === 'cheat'
                    ? '1px solid #A855F7'
                    : hud.toast.kind === 'success'
                      ? '1px solid #22C55E'
                      : '1px solid #38BDF8',
                color: '#F8FAFC'
              }}
            >
              {hud.toast.text}
            </div>
          )}
          {hud.stuntBanner && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: '#fff',
                fontWeight: 900,
                fontSize: 13
              }}
            >
              {hud.stuntBanner}
            </div>
          )}
        </div>
      )}

      {/* CONTEXTUAL WORLD INTERACTION BUTTONS */}
      <div
        style={{
          position: 'absolute',
          bottom: 132,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto'
        }}
      >
        {!hud.inVehicle && hud.nearbyVehicleName && (
          <ActionChip
            icon={<Car size={15} />}
            label={`Enter ${hud.nearbyVehicleName}`}
            color="#0EA5E9"
            onClick={onEnterExit}
          />
        )}
        {hud.nearbyPump && hud.inVehicle && (
          <ActionChip
            icon={<Fuel size={15} />}
            label="Refuel & Repair ($150)"
            color="#22C55E"
            onClick={onRefuel}
          />
        )}
        {hud.nearbyGarageId && (
          <ActionChip
            icon={<Wrench size={15} />}
            label="Open Garage"
            color="#F97316"
            onClick={onOpenGarage}
          />
        )}
        {hud.nearbyWeaponShop && (
          <ActionChip
            icon={<ShoppingBag size={15} />}
            label="Bharat Armory"
            color="#F43F5E"
            onClick={onOpenArmory}
          />
        )}
        {hud.nearbyMissionId && !hud.activeMission && (
          <ActionChip
            icon={<Flag size={15} />}
            label="Start Mission"
            color="#EAB308"
            onClick={() => onStartMission(hud.nearbyMissionId!)}
          />
        )}
      </div>

      {/* BOTTOM LEFT: JOYSTICK OR STEERING BUTTONS */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 18,
          pointerEvents: 'auto'
        }}
      >
        {hud.inVehicle && steeringMode === 'buttons' ? (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <HoldControlBtn
              label="Steer Left"
              size={66}
              onHoldStart={() => onInput({ steer: -1 })}
              onHoldEnd={() => onInput({ steer: 0 })}
            >
              <ArrowLeft size={28} />
            </HoldControlBtn>
            <HoldControlBtn
              label="Steer Right"
              size={66}
              onHoldStart={() => onInput({ steer: 1 })}
              onHoldEnd={() => onInput({ steer: 0 })}
            >
              <ArrowRight size={28} />
            </HoldControlBtn>
          </div>
        ) : (
          <div
            className="touch-none"
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerCancel={handleJoyUp}
            style={{
              width: 122,
              height: 122,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.55)',
              border: '2px solid rgba(148, 163, 184, 0.35)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #38BDF8, #0284C7)',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.45)',
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`
              }}
            />
          </div>
        )}
      </div>

      {/* BOTTOM RIGHT: VEHICLE CONTROLS + SPEEDOMETER OR ON-FOOT COMBAT CONTROLS */}
      {hud.inVehicle ? (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 16,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            pointerEvents: 'auto'
          }}
        >
          {/* Speedometer & Fuel Card */}
          <div
            className="glass-panel"
            style={{
              padding: '8px 12px',
              borderRadius: 14,
              minWidth: 132,
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 900, color: '#38BDF8' }}>
                {hud.speedKmh}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>
                KM/H · G{hud.gear}
              </span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: hud.isElectric ? '#22D3EE' : '#F8FAFC' }}>
              {hud.vehicleName} {hud.isElectric ? '⚡EV' : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9, color: '#94A3B8' }}>
              <span>FUEL</span>
              <div style={{ flex: 1, height: 4, background: '#1E293B', borderRadius: 3 }}>
                <div
                  style={{
                    width: `${(hud.fuel / Math.max(1, hud.maxFuel)) * 100}%`,
                    height: '100%',
                    background: hud.fuel < 20 ? '#EF4444' : '#FACC15',
                    borderRadius: 3
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9, color: '#94A3B8' }}>
              <span>NITRO</span>
              <div style={{ flex: 1, height: 4, background: '#1E293B', borderRadius: 3 }}>
                <div
                  style={{
                    width: `${hud.nitroCharge}%`,
                    height: '100%',
                    background: '#06B6D4',
                    borderRadius: 3
                  }}
                />
              </div>
            </div>
          </div>

          {/* Utility Cluster (Exit, Horn, Nitro, Handbrake, Aircraft Altitude) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {hud.canFly && (
                <>
                  <HoldControlBtn
                    label="Ascend"
                    size={48}
                    bg="rgba(14, 165, 233, 0.78)"
                    onHoldStart={() => onInput({ ascend: true })}
                    onHoldEnd={() => onInput({ ascend: false })}
                  >
                    <ChevronUp size={22} />
                  </HoldControlBtn>
                  <HoldControlBtn
                    label="Descend"
                    size={48}
                    bg="rgba(100, 116, 139, 0.78)"
                    onHoldStart={() => onInput({ descend: true })}
                    onHoldEnd={() => onInput({ descend: false })}
                  >
                    <ChevronDown size={22} />
                  </HoldControlBtn>
                </>
              )}
              {(hud.vehicleId === 'tank' || hud.vehicleId === 'apache') && (
                <HoldControlBtn
                  label="Fire Cannon"
                  size={48}
                  bg="rgba(244, 63, 94, 0.85)"
                  onHoldStart={() => onInput({ fire: true })}
                  onHoldEnd={() => onInput({ fire: false })}
                >
                  <Crosshair size={20} />
                </HoldControlBtn>
              )}
              <CircleHudBtn onClick={onHorn} label="Horn" bg="rgba(234, 179, 8, 0.85)" size={48}>
                <Volume2 size={18} />
              </CircleHudBtn>
              <HoldControlBtn
                label="Nitro Boost"
                size={48}
                bg={hud.isElectric ? 'rgba(6, 182, 212, 0.88)' : 'rgba(249, 115, 22, 0.88)'}
                onHoldStart={() => onInput({ nitro: true })}
                onHoldEnd={() => onInput({ nitro: false })}
              >
                <Flame size={20} />
              </HoldControlBtn>
              <CircleHudBtn onClick={onEnterExit} label="Exit Vehicle" bg="rgba(239, 68, 68, 0.85)" size={48}>
                <LogOut size={18} />
              </CircleHudBtn>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <HoldControlBtn
                label="Handbrake"
                size={52}
                bg="rgba(71, 85, 105, 0.88)"
                onHoldStart={() => onInput({ handbrake: true })}
                onHoldEnd={() => onInput({ handbrake: false })}
              >
                <span style={{ fontSize: 11, fontWeight: 900 }}>DRIFT</span>
              </HoldControlBtn>
              <HoldControlBtn
                label="Brake / Reverse"
                size={58}
                bg="rgba(220, 38, 38, 0.85)"
                onHoldStart={() => onInput({ brakeReverse: true })}
                onHoldEnd={() => onInput({ brakeReverse: false })}
              >
                <ArrowDown size={24} />
              </HoldControlBtn>
              <HoldControlBtn
                label="Accelerate"
                size={68}
                bg="rgba(34, 197, 94, 0.88)"
                onHoldStart={() => onInput({ throttle: true })}
                onHoldEnd={() => onInput({ throttle: false })}
              >
                <ArrowUp size={28} />
              </HoldControlBtn>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            pointerEvents: 'auto'
          }}
        >
          {/* Active Weapon Pill */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={onCycleWeapon}
              className="glass-panel btn-press"
              style={{
                padding: '6px 11px',
                borderRadius: 10,
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Swords size={14} color="#F97316" />
              <span>{hud.weaponName}</span>
              {hud.activeWeapon !== 'fists' && (
                <span style={{ fontFamily: 'monospace', color: '#38BDF8' }}>
                  {hud.isReloading ? 'RELOAD...' : `${hud.weaponMag}/${hud.weaponReserve}`}
                </span>
              )}
            </button>
            {hud.activeWeapon !== 'fists' && (
              <CircleHudBtn onClick={onReload} label="Reload" bg="rgba(30, 41, 59, 0.88)" size={42}>
                <RotateCw size={16} />
              </CircleHudBtn>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CircleHudBtn
                onClick={() => {
                  const next = !sprintOn;
                  setSprintOn(next);
                  onInput({ sprint: next });
                }}
                label="Sprint Toggle"
                bg={sprintOn ? 'rgba(249, 115, 22, 0.92)' : 'rgba(30, 41, 59, 0.85)'}
                size={48}
              >
                <Zap size={18} />
              </CircleHudBtn>
              <CircleHudBtn
                onClick={() => onInput({ crouch: true })}
                label="Crouch Toggle"
                bg={hud.isCrouching ? 'rgba(56, 189, 248, 0.9)' : 'rgba(30, 41, 59, 0.85)'}
                size={48}
              >
                <Shield size={18} />
              </CircleHudBtn>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <HoldControlBtn
                label="Aim"
                size={50}
                bg={hud.isAiming ? 'rgba(56, 189, 248, 0.92)' : 'rgba(30, 41, 59, 0.85)'}
                onHoldStart={() => onInput({ aim: true })}
                onHoldEnd={() => onInput({ aim: false })}
              >
                <Crosshair size={20} />
              </HoldControlBtn>
              <CircleHudBtn
                onClick={() => onInput({ jump: true })}
                label="Jump"
                bg="rgba(14, 165, 233, 0.85)"
                size={54}
              >
                <ArrowUp size={22} />
              </CircleHudBtn>
            </div>

            <HoldControlBtn
              label="Attack / Fire"
              size={72}
              bg="rgba(239, 68, 68, 0.88)"
              onHoldStart={() => onInput({ fire: true })}
              onHoldEnd={() => onInput({ fire: false })}
            >
              <Crosshair size={28} />
            </HoldControlBtn>
          </div>
        </div>
      )}
    </div>
  );
};

const CircleHudBtn: React.FC<{
  onClick: () => void;
  label: string;
  bg: string;
  size?: number;
  children: React.ReactNode;
}> = ({ onClick, label, bg, size = 44, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="btn-press"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '1px solid rgba(255, 255, 255, 0.22)',
      background: bg,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }}
  >
    {children}
  </button>
);

const HoldControlBtn: React.FC<{
  label: string;
  size?: number;
  bg?: string;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  children: React.ReactNode;
}> = ({ label, size = 60, bg = 'rgba(30, 41, 59, 0.82)', onHoldStart, onHoldEnd, children }) => (
  <button
    type="button"
    aria-label={label}
    className="touch-none btn-press"
    onPointerDown={(e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onHoldStart();
    }}
    onPointerUp={(e) => {
      e.stopPropagation();
      onHoldEnd();
    }}
    onPointerCancel={() => onHoldEnd()}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '2px solid rgba(255, 255, 255, 0.24)',
      background: bg,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }}
  >
    {children}
  </button>
);

const ActionChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}> = ({ icon, label, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn-press"
    style={{
      padding: '8px 14px',
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.28)',
      background: color,
      color: '#0F172A',
      fontWeight: 900,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0,0,0,0.45)'
    }}
  >
    {icon}
    {label}
  </button>
);
