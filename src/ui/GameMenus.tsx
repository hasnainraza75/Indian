import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Car,
  Flag,
  MapPin,
  User,
  Settings,
  Save,
  Volume2,
  VolumeX,
  Sliders,
  Check,
  Home,
  Swords,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Power
} from 'lucide-react';
import { MISSIONS } from '../game/data/missionsData';
import { PROPERTIES } from '../game/data/propertiesData';
import { VEHICLES } from '../game/data/vehiclesData';
import { WEAPON_ORDER, WEAPONS } from '../game/data/weaponsData';
import {
  GameScreen,
  GameSettings,
  GraphicsQuality,
  HudSnapshot,
  OrientationMode,
  SaveData,
  SteeringMode,
  VehicleCategory,
  WeaponId
} from '../game/types';

interface GameMenusProps {
  screen: GameScreen;
  hasSave: boolean;
  hud: HudSnapshot;
  saveSnapshot: SaveData;
  onNavigate: (s: GameScreen) => void;
  onNewGame: () => void;
  onContinue: () => void;
  onSaveGame: () => void;
  onResetSave: () => void;
  onUpdateSettings: (s: GameSettings) => void;
  onBuyOrSpawnVehicle: (id: string, color?: string) => { ok: boolean; msg: string };
  onStartMission: (id: string) => void;
  onAbortMission: () => void;
  onBuyProperty: (id: string) => { ok: boolean; msg: string };
  onBuyWeaponOrAmmo: (id: WeaponId) => { ok: boolean; msg: string };
  onSetWaypoint: (x: number | null, z: number | null) => void;
  onExitApp: () => void;
}

const PAINT_SWATCHES = ['#F97316', '#EF4444', '#0EA5E9', '#22C55E', '#FACC15', '#A855F7', '#0F172A', '#F8FAFC'];

export const GameMenus: React.FC<GameMenusProps> = ({
  screen,
  hasSave,
  hud,
  saveSnapshot,
  onNavigate,
  onNewGame,
  onContinue,
  onSaveGame,
  onResetSave,
  onUpdateSettings,
  onBuyOrSpawnVehicle,
  onStartMission,
  onAbortMission,
  onBuyProperty,
  onBuyWeaponOrAmmo,
  onSetWaypoint,
  onExitApp
}) => {
  const [garageCat, setGarageCat] = useState<'all' | VehicleCategory>('all');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'wallet' | 'houses' | 'armory'>('wallet');

  const notify = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 2600);
  };

  const filteredVehicles = useMemo(() => {
    if (garageCat === 'all') return VEHICLES;
    return VEHICLES.filter((v) => v.category === garageCat);
  }, [garageCat]);

  if (screen === 'playing') return null;

  if (screen === 'main_menu') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          background: 'linear-gradient(95deg, rgba(9, 13, 22, 0.92) 0%, rgba(9, 13, 22, 0.55) 55%, rgba(9, 13, 22, 0.28) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 36px'
        }}
      >
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(249, 115, 22, 0.2)',
                border: '1px solid #F97316',
                color: '#FDBA74',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2
              }}
            >
              OPEN WORLD ACTION SANDBOX
            </div>
            <h1
              style={{
                margin: '8px 0 4px',
                fontSize: 'clamp(26px, 4vw, 42px)',
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -0.5,
                background: 'linear-gradient(135deg, #FFFFFF 20%, #38BDF8 65%, #F97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              INDIAN OPEN WORLD 3D
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', lineHeight: 1.5 }}>
              Explore the modern Indian city, villages, Sea Link bridge, mountain ghats, luxury mansion, 60+ bikes & supercars, missions, police chases & mobile cheats.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {hasSave && (
              <MenuBtn
                icon={<Play size={18} />}
                label="Continue Game"
                primary
                onClick={onContinue}
              />
            )}
            <MenuBtn
              icon={<RotateCcw size={18} />}
              label="New Game"
              primary={!hasSave}
              onClick={onNewGame}
            />
            <MenuBtn icon={<Car size={18} />} label="Garage & Rides" onClick={() => onNavigate('garage')} />
            <MenuBtn icon={<Flag size={18} />} label="Story Missions" onClick={() => onNavigate('missions')} />
            <MenuBtn icon={<MapPin size={18} />} label="World Map" onClick={() => onNavigate('map')} />
            <MenuBtn icon={<User size={18} />} label="Profile & Shop" onClick={() => onNavigate('profile')} />
            <MenuBtn icon={<Settings size={18} />} label="Settings" onClick={() => onNavigate('settings')} />
            <MenuBtn icon={<Power size={18} />} label="Exit Game" onClick={onExitApp} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: 16,
            borderRadius: 18,
            width: 245,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', letterSpacing: 1 }}>
            PLAYER STATUS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#94A3B8' }}>Wallet</span>
            <span style={{ color: '#4ADE80', fontWeight: 900, fontFamily: 'monospace' }}>
              ${saveSnapshot.money.toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#94A3B8' }}>Vehicles Owned</span>
            <span style={{ fontWeight: 800 }}>{saveSnapshot.ownedVehicles.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#94A3B8' }}>Properties</span>
            <span style={{ fontWeight: 800 }}>{saveSnapshot.ownedProperties.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#94A3B8' }}>Missions Done</span>
            <span style={{ fontWeight: 800 }}>{saveSnapshot.completedMissions.length} / {MISSIONS.length}</span>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'paused') {
    return (
      <ModalShell title="GAME PAUSED" onBack={() => onNavigate('playing')} backLabel="Resume">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
          <MenuBtn icon={<Play size={18} />} label="Resume Gameplay" primary onClick={() => onNavigate('playing')} />
          <MenuBtn
            icon={<Save size={18} />}
            label="Save Progress"
            onClick={() => {
              onSaveGame();
              notify('Game saved!');
            }}
          />
          <MenuBtn icon={<Car size={18} />} label="Garage & Vehicles" onClick={() => onNavigate('garage')} />
          <MenuBtn icon={<Flag size={18} />} label="Missions" onClick={() => onNavigate('missions')} />
          <MenuBtn icon={<MapPin size={18} />} label="World Map" onClick={() => onNavigate('map')} />
          <MenuBtn icon={<User size={18} />} label="Profile, Armory & Houses" onClick={() => onNavigate('profile')} />
          <MenuBtn icon={<Settings size={18} />} label="Settings" onClick={() => onNavigate('settings')} />
          <MenuBtn icon={<Home size={18} />} label="Main Menu" onClick={() => onNavigate('main_menu')} />
        </div>
        {statusBanner && <Banner text={statusBanner} />}
      </ModalShell>
    );
  }

  if (screen === 'garage') {
    return (
      <ModalShell
        title={`GARAGE & VEHICLE SHOWROOM · $${hud.money.toLocaleString()}`}
        onBack={() => onNavigate('playing')}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'motorcycle', 'car', 'suv', 'heavy', 'aircraft', 'watercraft', 'special', 'creature'] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setGarageCat(cat)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: 'none',
                  background: garageCat === cat ? '#F97316' : 'rgba(30, 41, 59, 0.9)',
                  color: garageCat === cat ? '#0F172A' : '#E2E8F0',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            )
          )}
        </div>

        {/* Custom Paint Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>PAINT COLOR:</span>
          {PAINT_SWATCHES.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setSelectedColor(selectedColor === col ? '' : col)}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: col,
                border: selectedColor === col ? '3px solid #38BDF8' : '1px solid rgba(255,255,255,0.4)',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>

        {statusBanner && <Banner text={statusBanner} />}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
            gap: 10,
            overflowY: 'auto',
            maxHeight: '56vh',
            paddingRight: 4
          }}
        >
          {filteredVehicles.map((v) => {
            const owned = saveSnapshot.ownedVehicles.includes(v.id);
            return (
              <div
                key={v.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{v.name}</span>
                  {v.isElectric && <Zap size={14} color="#22D3EE" />}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>
                  {v.category} · Top {v.topSpeedKmh} km/h · HP {v.maxHealth}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = onBuyOrSpawnVehicle(v.id, selectedColor || undefined);
                    if (!res.ok) notify(res.msg);
                  }}
                  style={{
                    marginTop: 'auto',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: owned ? '#0EA5E9' : '#22C55E',
                    color: '#0F172A',
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {owned ? 'SPAWN / DELIVER' : `BUY $${v.price.toLocaleString()}`}
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  if (screen === 'missions') {
    return (
      <ModalShell title="STORY CAMPAIGN & MISSIONS" onBack={() => onNavigate('playing')}>
        {hud.activeMission && (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid #FACC15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#FACC15' }}>
                ACTIVE: {hud.activeMission.title}
              </div>
              <div style={{ fontSize: 11 }}>{hud.activeMission.objectiveText}</div>
            </div>
            <button
              type="button"
              onClick={onAbortMission}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#EF4444',
                color: '#fff',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Abort
            </button>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 10,
            overflowY: 'auto',
            maxHeight: '62vh'
          }}
        >
          {MISSIONS.map((m) => {
            const done = saveSnapshot.completedMissions.includes(m.title);
            return (
              <div
                key={m.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: done ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase' }}>
                    {m.category.replace('_', ' ')}
                  </span>
                  {done && <Check size={15} color="#22C55E" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{m.description}</div>
                <div style={{ fontSize: 11, color: '#4ADE80', fontWeight: 800, fontFamily: 'monospace' }}>
                  Reward: ${m.reward.toLocaleString()} (+${m.bonus.toLocaleString()} bonus)
                </div>
                <button
                  type="button"
                  onClick={() => onStartMission(m.id)}
                  style={{
                    marginTop: 'auto',
                    padding: '8px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#F97316',
                    color: '#0F172A',
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {done ? 'REPLAY MISSION' : 'START MISSION'}
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  if (screen === 'map') {
    return (
      <WorldMapModal
        hud={hud}
        onSetWaypoint={onSetWaypoint}
        onBack={() => onNavigate('playing')}
      />
    );
  }

  if (screen === 'profile') {
    return (
      <ModalShell
        title={`PLAYER PROFILE · $${hud.money.toLocaleString()}`}
        onBack={() => onNavigate('playing')}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'wallet', label: 'Wallet & Ledger' },
            { id: 'houses', label: 'Houses & Properties' },
            { id: 'armory', label: 'Weapon Armory' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setProfileTab(t.id as typeof profileTab)}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: 'none',
                background: profileTab === t.id ? '#0EA5E9' : 'rgba(30, 41, 59, 0.85)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {statusBanner && <Banner text={statusBanner} />}

        {profileTab === 'wallet' && (
          <div style={{ overflowY: 'auto', maxHeight: '58vh', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {saveSnapshot.transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.85)'
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{tx.label}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: tx.type === 'earn' ? '#4ADE80' : '#F87171'
                  }}
                >
                  {tx.type === 'earn' ? '+' : '-'}${tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {profileTab === 'houses' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, overflowY: 'auto', maxHeight: '58vh' }}>
            {PROPERTIES.map((prop) => {
              const owned = saveSnapshot.ownedProperties.includes(prop.id);
              return (
                <div
                  key={prop.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: 12,
                    padding: 12,
                    border: owned ? '1px solid #22C55E' : '1px solid rgba(148, 163, 184, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{prop.name}</div>
                  <div style={{ fontSize: 11, color: '#38BDF8', fontWeight: 700 }}>{prop.district}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{prop.description}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = onBuyProperty(prop.id);
                      notify(res.msg);
                    }}
                    style={{
                      marginTop: 'auto',
                      padding: '8px',
                      borderRadius: 8,
                      border: 'none',
                      background: owned ? '#0EA5E9' : '#22C55E',
                      color: '#0F172A',
                      fontWeight: 900,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    {owned ? 'FAST TRAVEL TO PROPERTY' : `BUY $${prop.price.toLocaleString()}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {profileTab === 'armory' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 10, overflowY: 'auto', maxHeight: '58vh' }}>
            {WEAPON_ORDER.map((wId) => {
              const def = WEAPONS[wId];
              const inv = saveSnapshot.weapons[wId];
              return (
                <div
                  key={wId}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: 12,
                    padding: 11,
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{def.name}</span>
                    {def.isElectric ? <Zap size={14} color="#22D3EE" /> : <Swords size={14} color="#F97316" />}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    DMG {def.damage} · Range {def.range}m {inv.owned && !def.isMelee ? `· Ammo ${inv.magAmmo}/${inv.reserveAmmo}` : ''}
                  </div>
                  {!def.isMelee && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = onBuyWeaponOrAmmo(wId);
                        notify(res.msg);
                      }}
                      style={{
                        marginTop: 'auto',
                        padding: '7px',
                        borderRadius: 8,
                        border: 'none',
                        background: inv.owned ? '#38BDF8' : '#22C55E',
                        color: '#0F172A',
                        fontWeight: 900,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      {inv.owned ? `BUY AMMO ($${def.ammoCost})` : `BUY WEAPON ($${def.price.toLocaleString()})`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ModalShell>
    );
  }

  // SETTINGS SCREEN
  const settings = saveSnapshot.settings;
  const updateSound = (patch: Partial<GameSettings['sound']>) =>
    onUpdateSettings({ ...settings, sound: { ...settings.sound, ...patch } });

  return (
    <ModalShell title="SETTINGS & SAVE DATA" onBack={() => onNavigate('playing')}>
      {statusBanner && <Banner text={statusBanner} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, overflowY: 'auto', maxHeight: '64vh' }}>
        {/* Sound Settings */}
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#38BDF8' }}>AUDIO MIXER</span>
            <button
              type="button"
              onClick={() => updateSound({ muted: !settings.sound.muted })}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: 'none',
                background: settings.sound.muted ? '#EF4444' : '#22C55E',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              {settings.sound.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {settings.sound.muted ? 'MUTED' : 'ON'}
            </button>
          </div>
          <SliderRow label="Engine Volume" value={settings.sound.engine} onChange={(v) => updateSound({ engine: v })} />
          <SliderRow label="Environment Volume" value={settings.sound.environment} onChange={(v) => updateSound({ environment: v })} />
          <SliderRow label="Effects Volume" value={settings.sound.effects} onChange={(v) => updateSound({ effects: v })} />
          <SliderRow label="Music Volume" value={settings.sound.music} onChange={(v) => updateSound({ music: v })} />
        </div>

        {/* Graphics & Controls */}
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#F97316', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={14} /> GRAPHICS & CONTROLS
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Graphics Quality</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, graphics: q })}
                  style={{
                    padding: '7px',
                    borderRadius: 8,
                    border: 'none',
                    background: settings.graphics === q ? '#0EA5E9' : '#1E293B',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Vehicle Steering Mode</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['buttons', 'joystick'] as SteeringMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, controls: { ...settings.controls, steeringMode: m } })}
                  style={{
                    padding: '7px',
                    borderRadius: 8,
                    border: 'none',
                    background: settings.controls.steeringMode === m ? '#0EA5E9' : '#1E293B',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Screen Orientation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['landscape', 'auto'] as OrientationMode[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, controls: { ...settings.controls, orientation: o } })}
                  style={{
                    padding: '7px',
                    borderRadius: 8,
                    border: 'none',
                    background: settings.controls.orientation === o ? '#0EA5E9' : '#1E293B',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  {o === 'auto' ? 'Auto-Rotate' : 'Landscape Lock'}
                </button>
              ))}
            </div>
          </div>

          <SliderRow
            label="Camera Sensitivity"
            value={settings.controls.cameraSensitivity / 2}
            onChange={(v) =>
              onUpdateSettings({
                ...settings,
                controls: { ...settings.controls, cameraSensitivity: Math.max(0.3, v * 2) }
              })
            }
          />
        </div>

        {/* Save Management */}
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} /> PERSISTENT SAVE DATA
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            Last saved: {new Date(saveSnapshot.lastSavedAt).toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => {
              onSaveGame();
              notify('Progress saved to device storage!');
            }}
            style={{
              padding: '9px',
              borderRadius: 8,
              border: 'none',
              background: '#22C55E',
              color: '#0F172A',
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            MANUAL SAVE NOW
          </button>
          <button
            type="button"
            onClick={() => {
              onResetSave();
              notify('Save wiped & started fresh game.');
            }}
            style={{
              padding: '9px',
              borderRadius: 8,
              border: '1px solid #EF4444',
              background: 'rgba(239, 68, 68, 0.16)',
              color: '#FCA5A5',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            RESET SAVE DATA
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const WorldMapModal: React.FC<{
  hud: HudSnapshot;
  onSetWaypoint: (x: number | null, z: number | null) => void;
  onBack: () => void;
}> = ({ hud, onSetWaypoint, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.52; // maps -450..450 onto 520px

    ctx.fillStyle = '#0B1324';
    ctx.fillRect(0, 0, w, h);

    // Mountain Ghat region
    ctx.fillStyle = '#1E3A1E';
    ctx.fillRect(0, cy + 130 * scale, cx - 190 * scale, h);

    // Water Bay & Lake
    ctx.fillStyle = '#0369A1';
    ctx.fillRect(cx + 160 * scale, cy - 20 * scale, 300, 300);
    ctx.beginPath();
    ctx.arc(cx + 365 * scale, cy - 135 * scale, 40 * scale, 0, Math.PI * 2);
    ctx.fill();

    // City Roads
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    [-90, 0, 90].forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(cx + c * scale, cy - 185 * scale);
      ctx.lineTo(cx + c * scale, cy + 185 * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 185 * scale, cy + c * scale);
      ctx.lineTo(cx + 185 * scale, cy + c * scale);
      ctx.stroke();
    });
    ctx.strokeRect(cx - 190 * scale, cy - 185 * scale, 380 * scale, 370 * scale);

    // Airport Runway
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 304 * scale, cy - 360 * scale, 28 * scale, 160 * scale);

    // Labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('MUMBAI METRO', cx - 35, cy - 10);
    ctx.fillText('AIRPORT', cx - 310 * scale, cy - 260 * scale);
    ctx.fillText('KISANPUR VILLAGE', cx + 245 * scale, cy - 245 * scale);
    ctx.fillText('SAHYADRI GHATS', cx - 350 * scale, cy + 250 * scale);
    ctx.fillText('SEA LINK', cx + 150 * scale, cy + 115 * scale);

    for (const m of hud.markers) {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(cx + m.x * scale, cy + m.z * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Dot
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(cx + hud.playerX * scale, cy + hud.playerZ * scale, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hud]);

  const handleTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width / rect.width;
    const scaleY = e.currentTarget.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const wx = (px - e.currentTarget.width / 2) / 0.52;
    const wz = (py - e.currentTarget.height / 2) / 0.52;
    onSetWaypoint(wx, wz);
  };

  return (
    <ModalShell title="OPEN WORLD GPS MAP (TAP TO SET WAYPOINT)" onBack={onBack}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <canvas
          ref={canvasRef}
          width={520}
          height={360}
          onClick={handleTap}
          style={{
            width: 'min(520px, 72vw)',
            height: 'auto',
            borderRadius: 14,
            border: '2px solid rgba(56, 189, 248, 0.35)',
            cursor: 'crosshair'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <Legend dot="#F97316" label="Player Position" />
          <Legend dot="#22C55E" label="Owned Houses" />
          <Legend dot="#FACC15" label="Mission / Properties" />
          <Legend dot="#FB923C" label="Petrol Pumps" />
          <Legend dot="#F43F5E" label="Bharat Armory" />
          <Legend dot="#3B82F6" label="Police Pursuit" />
          <Legend dot="#A855F7" label="GPS Waypoint" />
          {hud.waypoint && (
            <button
              type="button"
              onClick={() => onSetWaypoint(null, null)}
              style={{
                marginTop: 8,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#EF4444',
                color: '#fff',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Clear Waypoint
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

const Legend: React.FC<{ dot: string; label: string }> = ({ dot, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block' }} />
    <span>{label}</span>
  </div>
);

const ModalShell: React.FC<{
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
}> = ({ title, onBack, backLabel = 'Back to Game', children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 35,
      background: 'rgba(2, 6, 23, 0.86)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}
  >
    <div
      className="glass-panel"
      style={{
        width: 'min(900px, 95vw)',
        maxHeight: '90vh',
        borderRadius: 20,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.2)', paddingBottom: 10 }}>
        <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: 0.6 }}>{title}</span>
        <button
          type="button"
          onClick={onBack}
          className="btn-press"
          style={{
            padding: '7px 14px',
            borderRadius: 10,
            border: 'none',
            background: '#0EA5E9',
            color: '#0F172A',
            fontWeight: 900,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={14} />
          {backLabel}
        </button>
      </div>
      {children}
    </div>
  </div>
);

const MenuBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  onClick: () => void;
}> = ({ icon, label, primary, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn-press"
    style={{
      padding: '11px 14px',
      borderRadius: 12,
      border: primary ? 'none' : '1px solid rgba(148, 163, 184, 0.25)',
      background: primary ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'rgba(15, 23, 42, 0.85)',
      color: primary ? '#0F172A' : '#F8FAFC',
      fontWeight: 800,
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      cursor: 'pointer'
    }}
  >
    {icon}
    {label}
  </button>
);

const SliderRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label,
  value,
  onChange
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: '#CBD5E1' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: '#38BDF8' }}>{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={Math.max(0, Math.min(1, value))}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: '100%', accentColor: '#38BDF8' }}
    />
  </div>
);

const Banner: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      padding: '7px 12px',
      borderRadius: 10,
      background: 'rgba(56, 189, 248, 0.2)',
      border: '1px solid #38BDF8',
      fontSize: 12,
      fontWeight: 700,
      color: '#BAE6FD'
    }}
  >
    {text}
  </div>
);
