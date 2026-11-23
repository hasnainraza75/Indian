import React, { useMemo, useState } from 'react';
import {
  Phone,
  PhoneCall,
  Delete,
  X,
  Zap,
  History,
  BookOpen,
  CloudRain,
  Sun,
  Moon,
  Search
} from 'lucide-react';
import { CHEAT_CODES } from '../game/data/cheatsData';
import { CheatEntry, CheatHistoryItem, WeatherType } from '../game/types';

interface MobilePhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDial: (code: string) => { status: 'activated' | 'duplicate' | 'invalid'; message: string; options?: CheatEntry[] };
  onSelectDuplicate: (entry: CheatEntry) => void;
  duplicatePrompt: { code: string; options: CheatEntry[] } | null;
  onDismissDuplicate: () => void;
  cheatHistory: CheatHistoryItem[];
  weather: WeatherType;
  onChangeWeather: (w: WeatherType) => void;
  timeOfDay: number;
  onChangeTime: (hour: number) => void;
}

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export const MobilePhoneModal: React.FC<MobilePhoneModalProps> = ({
  isOpen,
  onClose,
  onDial,
  onSelectDuplicate,
  duplicatePrompt,
  onDismissDuplicate,
  cheatHistory,
  weather,
  onChangeWeather,
  timeOfDay,
  onChangeTime
}) => {
  const [tab, setTab] = useState<'dial' | 'directory' | 'history' | 'env'>('dial');
  const [number, setNumber] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [search, setSearch] = useState('');

  const filteredCheats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CHEAT_CODES;
    return CHEAT_CODES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isOpen) return null;

  const handleCall = (codeToDial = number) => {
    if (!codeToDial.trim()) return;
    const res = onDial(codeToDial.trim());
    if (res.status === 'activated') {
      setFeedback({ ok: true, msg: res.message });
      setNumber('');
    } else if (res.status === 'invalid') {
      setFeedback({ ok: false, msg: res.message });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(2, 6, 23, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: 'min(410px, 95vw)',
          maxHeight: '90vh',
          borderRadius: 26,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
          border: '2px solid rgba(56, 189, 248, 0.35)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={18} color="#38BDF8" />
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>BHARAT SMARTPHONE</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Phone Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { id: 'dial', label: 'Dialer', Icon: Phone },
            { id: 'directory', label: 'Cheats', Icon: BookOpen },
            { id: 'history', label: 'History', Icon: History },
            { id: 'env', label: 'Weather', Icon: CloudRain }
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as typeof tab)}
              style={{
                padding: '7px 4px',
                borderRadius: 10,
                border: 'none',
                background: tab === id ? '#0284C7' : 'rgba(30, 41, 59, 0.85)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              background: feedback.ok ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.22)',
              border: `1px solid ${feedback.ok ? '#22C55E' : '#EF4444'}`,
              color: feedback.ok ? '#86EFAC' : '#FCA5A5'
            }}
          >
            {feedback.msg}
          </div>
        )}

        {/* Duplicate Code Selector */}
        {duplicatePrompt && (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: 'rgba(249, 115, 22, 0.16)',
              border: '1px solid #F97316',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FDBA74' }}>
              Code {duplicatePrompt.code} has multiple cheats. Choose one:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {duplicatePrompt.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const res = onSelectDuplicate(opt);
                    setFeedback({ ok: true, msg: `Activated ${opt.name}!` });
                    setNumber('');
                    void res;
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#F97316',
                    color: '#0F172A',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  #{opt.priority} — {opt.name} ({opt.category})
                </button>
              ))}
              <button
                type="button"
                onClick={onDismissDuplicate}
                style={{
                  padding: '5px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: '#CBD5E1',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {tab === 'dial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid rgba(148, 163, 184, 0.25)'
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: '#38BDF8',
                  minHeight: 28
                }}
              >
                {number || 'ENTER CODE'}
              </span>
              <button
                type="button"
                onClick={() => setNumber((p) => p.slice(0, -1))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <Delete size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {DIAL_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="btn-press"
                  onClick={() => setNumber((p) => (p.length < 8 ? p + k : p))}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    background: 'rgba(30, 41, 59, 0.88)',
                    color: '#F8FAFC',
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-press"
              onClick={() => handleCall()}
              style={{
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <PhoneCall size={18} />
              ACTIVATE CHEAT
            </button>
          </div>
        )}

        {tab === 'directory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color="#94A3B8"
                style={{ position: 'absolute', left: 10, top: 10 }}
              />
              <input
                type="text"
                placeholder="Search 85+ cheats (e.g. Thar, Tron, 9999)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 10,
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 240, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {filteredCheats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectDuplicate(c);
                    setFeedback({ ok: true, msg: `Activated ${c.name} (${c.code})!` });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    background: 'rgba(30, 41, 59, 0.72)',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.category}</div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: 13,
                      color: '#38BDF8',
                      background: 'rgba(56, 189, 248, 0.12)',
                      padding: '3px 8px',
                      borderRadius: 6
                    }}
                  >
                    {c.code}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div style={{ overflowY: 'auto', maxHeight: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cheatHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 24 }}>
                No cheats activated yet. Dial a code or pick from Cheats tab!
              </div>
            ) : (
              cheatHistory.map((h, i) => (
                <div
                  key={`${h.code}_${h.timestamp}_${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.7)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={14} color="#FACC15" />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{h.name}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8' }}>{h.code}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'env' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 6 }}>
                WEATHER CONTROL
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(['clear', 'cloudy', 'rain', 'thunderstorm', 'fog'] as WeatherType[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onChangeWeather(w)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 8,
                      border: 'none',
                      background: weather === w ? '#0EA5E9' : 'rgba(30, 41, 59, 0.8)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 6 }}>
                TIME OF DAY ({Math.floor(timeOfDay).toString().padStart(2, '0')}:00)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[
                  { label: 'Dawn', h: 6.5, Icon: Sun },
                  { label: 'Noon', h: 12.5, Icon: Sun },
                  { label: 'Sunset', h: 18.2, Icon: Sun },
                  { label: 'Night', h: 23.0, Icon: Moon }
                ].map(({ label, h, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onChangeTime(h)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'rgba(30, 41, 59, 0.85)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <Icon size={12} color="#FACC15" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
