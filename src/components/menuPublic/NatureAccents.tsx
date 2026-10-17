import React from 'react';

/* ------------------------------------------------------------------ */
/* Hiasan bertema kebun & sawah untuk halaman Menu MBG Hari Ini.        */
/* Temanya mengikuti asal bahan makanan (sawah, kebun, peternakan).     */
/* Semua aria-hidden; animasi memakai motion-safe agar mati otomatis    */
/* bila pengguna memilih mengurangi gerakan.                            */
/* ------------------------------------------------------------------ */

const INK = '#1f4d2f';
// Rotasi/skala elemen SVG bertumpu pada kotaknya sendiri, bukan pada pojok kanvas.
const box = (origin = 'center'): React.CSSProperties => ({ transformBox: 'fill-box', transformOrigin: origin });

export const Butterfly: React.FC<{ className?: string; wander?: boolean }> = ({ className = '', wander = true }) => (
  <svg viewBox="0 0 48 40" aria-hidden="true" focusable="false" className={`pointer-events-none overflow-visible ${className}`}>
    <g className={wander ? 'motion-safe:animate-[wander_9s_ease-in-out_infinite]' : ''} style={box()}>
      <g className="motion-safe:animate-[flutter_0.35s_ease-in-out_infinite]" style={box('100% 50%')}>
        <path d="M24 20 C 14 4, 2 6, 4 16 C 5 22, 14 22, 24 20 Z" fill="#fcd34d" stroke={INK} strokeWidth="1.5" />
        <path d="M24 21 C 15 24, 7 30, 11 35 C 15 38, 21 30, 24 21 Z" fill="#fb923c" stroke={INK} strokeWidth="1.5" />
        <circle cx="11" cy="14" r="2.2" fill="#fb923c" />
      </g>
      <g className="motion-safe:animate-[flutter_0.35s_ease-in-out_infinite]" style={box('0% 50%')}>
        <path d="M24 20 C 34 4, 46 6, 44 16 C 43 22, 34 22, 24 20 Z" fill="#fcd34d" stroke={INK} strokeWidth="1.5" />
        <path d="M24 21 C 33 24, 41 30, 37 35 C 33 38, 27 30, 24 21 Z" fill="#fb923c" stroke={INK} strokeWidth="1.5" />
        <circle cx="37" cy="14" r="2.2" fill="#fb923c" />
      </g>
      <rect x="22.5" y="12" width="3" height="18" rx="1.5" fill={INK} />
      <path d="M23 12 C 21 8, 19 6, 17 5 M25 12 C 27 8, 29 6, 31 5" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  </svg>
);

export const Bee: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 44 36" aria-hidden="true" focusable="false" className={`pointer-events-none overflow-visible ${className}`}>
    <g className="motion-safe:animate-[bob_2.4s_ease-in-out_infinite]">
      <g className="motion-safe:animate-[flutter_0.15s_linear_infinite]" style={box('50% 100%')}>
        <ellipse cx="18" cy="9" rx="7" ry="9" fill="#e0f2fe" stroke={INK} strokeWidth="1.3" opacity="0.9" />
        <ellipse cx="27" cy="10" rx="6" ry="8" fill="#e0f2fe" stroke={INK} strokeWidth="1.3" opacity="0.9" />
      </g>
      <ellipse cx="22" cy="23" rx="13" ry="9" fill="#fcd34d" stroke={INK} strokeWidth="1.5" />
      <path d="M17 15 C 15 19, 15 27, 17 31 M24 14.5 C 22 19, 22 27, 24 31.5" fill="none" stroke={INK} strokeWidth="3" />
      <circle cx="32" cy="21" r="1.6" fill={INK} />
      <path d="M9 23 L 5 23" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>
);

const Tree: React.FC<{ x: number; y: number; s?: number; delay?: string }> = ({ x, y, s = 1, delay = '0s' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g className="motion-safe:animate-[sway_6s_ease-in-out_infinite]" style={{ ...box('50% 100%'), animationDelay: delay }}>
      <rect x="-4" y="-26" width="8" height="28" rx="3" fill="#8a5a2b" />
      <circle cx="0" cy="-40" r="20" fill="#3f9a5a" />
      <circle cx="-13" cy="-30" r="13" fill="#58b06f" />
      <circle cx="12" cy="-29" r="14" fill="#4aa463" />
      <circle cx="-5" cy="-48" r="4" fill="#fb923c" />
      <circle cx="8" cy="-36" r="3.5" fill="#fb923c" />
    </g>
  </g>
);

const Chicken: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-6 0 L -6 7 M 4 0 L 4 7" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
    <g className="motion-safe:animate-[peck_3.2s_ease-in-out_infinite]" style={box('40% 100%')}>
      <path d="M-18 -8 C -22 -18, -14 -24, -10 -16" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <ellipse cx="-2" cy="-8" rx="15" ry="10" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <circle cx="12" cy="-18" r="7" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <path d="M9 -25 C 10 -30, 13 -30, 13 -26 C 15 -30, 18 -28, 16 -24" fill="#ef4444" />
      <path d="M18 -18 L 24 -16 L 18 -14 Z" fill="#f59e0b" />
      <circle cx="13" cy="-19" r="1.3" fill={INK} />
      <path d="M-6 -9 C -2 -4, 4 -4, 6 -9" fill="none" stroke={INK} strokeWidth="1.3" />
    </g>
  </g>
);

const Cloud: React.FC<{ x: number; y: number; s?: number; dur: string }> = ({ x, y, s = 1, dur }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g className="nature-drift" style={{ '--dur': dur } as React.CSSProperties}>
      <path d="M0 0 C -2 -14, 16 -20, 24 -10 C 30 -24, 54 -20, 54 -6 C 66 -8, 70 6, 60 8 L 4 8 C -6 8, -8 0, 0 0 Z" fill="#ffffff" opacity="0.9" />
    </g>
  </g>
);

const Bird: React.FC<{ y: number; dur: string; delay: string }> = ({ y, dur, delay }) => (
  <g className="nature-fly" style={{ '--dur': dur, animationDelay: delay } as React.CSSProperties}>
    <path d={`M-60 ${y} q 7 -7 14 0 q 7 -7 14 0`} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
  </g>
);

/**
 * Pemandangan sawah dan kebun di atas footer. Bukit paling depan berwarna sama
 * dengan footer sehingga keduanya menyatu.
 */
export const FarmLandscape: React.FC<{ footerColor: string }> = ({ footerColor }) => (
  <div aria-hidden="true" className="relative h-36 sm:h-40 lg:h-48 overflow-hidden -mb-px">
    <svg viewBox="0 0 1440 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
      <g transform="translate(960 52)">
        <g className="motion-safe:animate-[spin-slow_40s_linear_infinite]" style={box()}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-2" y="-46" width="4" height="12" rx="2" fill="#fcd34d" transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <circle r="26" fill="#fcd34d" stroke="#f59e0b" strokeWidth="2" />
      </g>
      <Cloud x={260} y={50} s={1.1} dur="14s" />
      <Cloud x={820} y={34} s={0.8} dur="18s" />
      <Bird y={70} dur="38s" delay="0s" />
      <Bird y={46} dur="46s" delay="-20s" />

      <path d="M0 120 C 220 70, 420 80, 620 112 C 820 140, 1040 72, 1240 86 C 1340 92, 1400 104, 1440 110 L 1440 200 L 0 200 Z" fill="#cfe6c8" />
      <path d="M0 150 C 180 118, 380 120, 560 140 C 760 162, 980 116, 1200 128 C 1300 134, 1380 142, 1440 146 L 1440 200 L 0 200 Z" fill="#9fd09a" />
      {/* Petak sawah */}
      <g stroke="#7fbf7a" strokeWidth="2" fill="none" opacity="0.8">
        <path d="M640 160 C 760 150, 880 140, 1000 138" />
        <path d="M620 172 C 760 162, 900 152, 1040 150" />
        <path d="M700 150 L 690 178 M 780 146 L 772 176 M 860 142 L 854 172 M 940 140 L 936 168" />
      </g>
      {/* Layar sempit hanya menampilkan bagian tengah (kira-kira x 450 sampai 990), jadi matahari, satu pohon, ayam, dan sawah ditaruh di sana. */}
      <Tree x={150} y={146} s={1.05} />
      <Tree x={600} y={148} s={0.9} delay="-4s" />
      <Tree x={232} y={142} s={0.8} delay="-2s" />
      <Tree x={1130} y={134} s={0.95} delay="-1s" />
      <Tree x={1330} y={146} s={1.1} delay="-3s" />
      <Chicken x={510} y={152} />
      <Chicken x={1230} y={150} />

      <path d="M0 178 C 240 160, 480 168, 720 176 C 960 184, 1200 162, 1440 170 L 1440 200 L 0 200 Z" fill={footerColor} />
    </svg>
    <Butterfly className="absolute left-[38%] top-6 w-8 sm:w-10" />
  </div>
);

/** Sinar matahari berputar di belakang logo header; logonya sendiri tidak diubah. */
export const SunRays: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false" className={`pointer-events-none ${className}`}>
    <circle r="27" fill="#fde68a" />
    <g className="motion-safe:animate-[spin-slow_24s_linear_infinite]" style={box()}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="-2.5" y="-48" width="5" height="11" rx="2.5" fill="#fcd34d" transform={`rotate(${i * 30})`} />
      ))}
    </g>
  </svg>
);

const SmallFlower: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="-12 -12 24 30" aria-hidden="true" focusable="false" className="w-3 h-4 overflow-visible">
    <path d="M0 4 L 0 17" stroke="#3f9a5a" strokeWidth="2" strokeLinecap="round" />
    {[[0, -5], [4.8, -1.5], [3, 4], [-3, 4], [-4.8, -1.5]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.6" fill={color} />)}
    <circle r="2.4" fill="#f59e0b" />
  </svg>
);

/** Langit header: awan bergeser (layar sedang ke atas) dan garis rumput berbunga sebagai batas bawah. */
export const HeaderSky: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    {[
      { left: '34%', top: '10px', w: 'w-14', dur: '16s' },
      { left: '58%', top: '22px', w: 'w-10', dur: '21s' }
    ].map(c => (
      <svg key={c.left} viewBox="-4 -24 78 34" className={`hidden md:block absolute ${c.w}`} style={{ left: c.left, top: c.top }}>
        <g className="nature-drift" style={{ '--dur': c.dur } as React.CSSProperties}>
          <path d="M0 0 C -2 -14, 16 -20, 24 -10 C 30 -24, 54 -20, 54 -6 C 66 -8, 70 6, 60 8 L 4 8 C -6 8, -8 0, 0 0 Z" fill="#ffffff" stroke="#e9e0cc" strokeWidth="1.5" />
        </g>
      </svg>
    ))}
    <svg viewBox="0 0 1440 10" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-2.5">
      <path d="M0 10 L0 5 C 60 1, 120 1, 180 5 C 240 9, 300 9, 360 5 C 420 1, 480 1, 540 5 C 600 9, 660 9, 720 5 C 780 1, 840 1, 900 5 C 960 9, 1020 9, 1080 5 C 1140 1, 1200 1, 1260 5 C 1320 9, 1380 9, 1440 5 L 1440 10 Z" fill="#9fd09a" />
    </svg>
    {/* Bunga hanya di ruang kosong: di HP teks sampai sekitar 57% dan tombol mulai 70%, di desktop teks sampai sekitar 31%. */}
    {[
      { left: '45%', color: '#f9a8d4', cls: 'hidden md:block' },
      { left: '62%', color: '#fcd34d', cls: '' },
      { left: '98%', color: '#f9a8d4', cls: 'hidden md:block' }
    ].map(f => (
      <div key={f.left} className={`absolute bottom-0.5 origin-bottom motion-safe:animate-[sway_4s_ease-in-out_infinite] ${f.cls}`} style={{ left: f.left }}>
        <SmallFlower color={f.color} />
      </div>
    ))}
  </div>
);
