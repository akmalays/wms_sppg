import React from 'react';
import { DOODLE_PATHS, doodleRand } from '../print/menuPosterDesigns';

const CELL = 92;
const SIZE = 46;

// Doodle makanan poster menu untuk latar halaman. Induknya perlu `relative overflow-hidden`, dan isi yang ingin
// tetap terbaca perlu `relative`. Warna dan tingkat transparan diatur lewat className (text-* dan opacity-*).
export const FoodDoodles: React.FC<{ width: number; height: number; seed?: number; className?: string }> = ({
  width,
  height,
  seed = 0,
  className = '',
}) => {
  const rows = Math.ceil(height / CELL) + 1;
  const cols = Math.ceil(width / CELL) + 1;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`absolute pointer-events-none ${className}`}
    >
      {Array.from({ length: rows }).flatMap((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const c = col + seed * 11;
          const r = row + seed * 7;
          const x = col * CELL + (row % 2 ? CELL / 2 : 0) + (doodleRand(c, r, 1) - 0.5) * 22;
          const y = row * CELL + (doodleRand(c, r, 2) - 0.5) * 22;
          const scale = (SIZE / 24) * (0.85 + doodleRand(c, r, 4) * 0.35);
          const angle = (doodleRand(c, r, 5) - 0.5) * 52;
          const path = DOODLE_PATHS[(c * 5 + r * 7 + Math.floor(doodleRand(c, r, 3) * 3)) % DOODLE_PATHS.length];
          return <path key={`${row}-${col}`} d={path} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale}) translate(-12 -12)`} />;
        })
      )}
    </svg>
  );
};
