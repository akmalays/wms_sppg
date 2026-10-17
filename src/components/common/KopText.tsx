import React from 'react';

export const SPPG_OFFICIAL_NAME = 'Satuan Pelayanan Pemenuhan Gizi (SPPG) Tumpang Jeru';
export const SPPG_ADDRESS = 'Jl. Pattimura No. 107, Dsn. Krajan, Ds. Jeru, Kec. Tumpang, Kab. Malang';

// Teks kop surat untuk semua dokumen cetak: instansi induk, nama SPPG, alamat.
// Ditaruh di samping logo; logo dan sisi kanan kop tetap diatur masing-masing dokumen.
export const KopText: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <p className="text-[11px] font-bold text-slate-900 leading-tight">BADAN GIZI NASIONAL</p>
    <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight mt-0.5">{SPPG_OFFICIAL_NAME}</h1>
    <p className="text-[10px] text-slate-600 mt-0.5">{SPPG_ADDRESS}</p>
  </div>
);
