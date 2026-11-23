import React, { useEffect, useRef } from 'react';
import { MinimapMarker } from '../game/types';

interface MiniMapProps {
  playerX: number;
  playerZ: number;
  playerRotY: number;
  markers: MinimapMarker[];
  onClick?: () => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerX,
  playerZ,
  playerRotY,
  markers,
  onClick
}) => {
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
    const scale = 0.42;

    ctx.clearRect(0, 0, w, h);

    // Circular radar background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    // Transform relative to player pos & heading
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(playerRotY);

    // Water East Bay
    ctx.fillStyle = '#0369A1';
    ctx.fillRect((160 - playerX) * scale, (-20 - playerZ) * scale, 320 * scale, 420 * scale);

    // Main city road grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    [-90, 0, 90].forEach((coord) => {
      ctx.beginPath();
      ctx.moveTo((coord - playerX) * scale, (-180 - playerZ) * scale);
      ctx.lineTo((coord - playerX) * scale, (180 - playerZ) * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo((-180 - playerX) * scale, (coord - playerZ) * scale);
      ctx.lineTo((180 - playerX) * scale, (coord - playerZ) * scale);
      ctx.stroke();
    });

    // Ring highway
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.strokeRect((-190 - playerX) * scale, (-185 - playerZ) * scale, 380 * scale, 370 * scale);

    // Sea Link Bridge
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo((115 - playerX) * scale, (55 - playerZ) * scale);
    ctx.lineTo((245 - playerX) * scale, (175 - playerZ) * scale);
    ctx.stroke();

    // Markers
    for (const m of markers) {
      const mx = (m.x - playerX) * scale;
      const mz = (m.z - playerZ) * scale;
      const dist = Math.hypot(mx, mz);
      const clampedDist = Math.min(dist, cx - 8);
      const ang = Math.atan2(mz, mx);
      const px = Math.cos(ang) * clampedDist;
      const py = Math.sin(ang) * clampedDist;

      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(px, py, m.type === 'mission' || m.type === 'waypoint' ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Center player arrow
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Outer border ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [playerX, playerZ, playerRotY, markers]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Full World Map"
      style={{
        width: 98,
        height: 98,
        borderRadius: '50%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer'
      }}
      className="btn-press"
    >
      <canvas ref={canvasRef} width={98} height={98} />
    </button>
  );
};
