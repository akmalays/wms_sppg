import React, { useMemo } from 'react';
import QRCode from 'qrcode';

// QR asli (bisa dipindai) berisi tautan /s/<kode> ke halaman hasil pindai (tag mini: kode saja agar
// tidak terlalu padat). Digambar sebagai SVG agar tajam saat dicetak.
export const QrSvg: React.FC<{ value: string; className?: string; color?: string }> = ({ value, className, color = '#0f172a' }) => {
  const qr = useMemo(() => {
    try {
      return QRCode.create(value || '-', { errorCorrectionLevel: 'M' });
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;
  const size = qr.modules.size;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} fill={color} role="img" aria-label={`QR ${value}`} shapeRendering="crispEdges">
      {cells}
    </svg>
  );
};
