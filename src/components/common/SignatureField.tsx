import React, { useState } from 'react';
import { SignaturePad } from '../SignaturePad';
import { BTN_SECONDARY, FOCUS_RING } from './FormDialog';

// Tanda tangan penanda tangan dokumen: unggah foto/scan atau gambar langsung. Kosong = kotak dicetak kosong untuk tanda tangan basah.
export function SignatureField({ role, value, onChange }: { role: string; value?: string; onChange: (v: string) => void }) {
  const [isDrawing, setIsDrawing] = useState(false);
  return (
    <div className="space-y-2">
      {isDrawing ? (
        <SignaturePad
          label="Gambar tanda tangan"
          signatoryName={role}
          allowQuickConfirm={false}
          onSave={data => {
            if (data === '' || data.startsWith('data:image')) onChange(data);
          }}
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2">
          {value ? (
            <img src={value} alt={`Tanda tangan ${role}`} className="h-20 max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-slate-500">Belum ada tanda tangan. Kotaknya dicetak kosong.</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className={`${BTN_SECONDARY} cursor-pointer focus-within:ring-2 focus-within:ring-emerald-600`}>
          Unggah gambar
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 500 * 1024) {
                window.alert('Gambar terlalu besar (maks. 500 KB). Potong atau kecilkan dulu.');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                onChange(String(reader.result || ''));
                setIsDrawing(false);
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setIsDrawing(d => !d)}
          className={`min-h-[36px] px-1 text-[11px] font-semibold text-slate-700 hover:underline cursor-pointer rounded-md ${FOCUS_RING}`}
        >
          {isDrawing ? 'Selesai menggambar' : 'Gambar langsung'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsDrawing(false);
            }}
            className={`min-h-[36px] px-1 text-[11px] font-semibold text-rose-700 hover:underline cursor-pointer rounded-md ${FOCUS_RING}`}
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}
