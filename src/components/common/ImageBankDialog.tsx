import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload } from 'lucide-react';
import { FormDialog, BTN_SECONDARY, FOCUS_RING } from './FormDialog';
import { listCmsImages, uploadCmsMedia } from '../../db/websiteConfigStorage';
import ayamImg from '../../assets/ayam_bumbu_kuning.jpg';
import anakSehatImg from '../../assets/anak_sehat_mbg.jpg';
import buahPisangImg from '../../assets/buah_pisang.jpg';
import cuciTanganImg from '../../assets/cuci_tangan_mbg.jpg';
import kebunSayurImg from '../../assets/kebun_sayur.jpg';
import nasiPutihImg from '../../assets/nasi_putih_bowl.jpg';
import peternakanAyamImg from '../../assets/peternakan_ayam.jpg';
import sawahPadiImg from '../../assets/sawah_padi.jpg';
import sayurSopImg from '../../assets/sayur_sop.jpg';
import wortelMaskotImg from '../../assets/sayur_wortel_mbg.jpg';
import tempeBacemImg from '../../assets/tempe_bacem.jpg';
import tempeMaskotImg from '../../assets/tempe_maskot_mbg.jpg';
import tempeMentahImg from '../../assets/tempe_mentah.jpg';

// Cadangan saat gambar AI gagal: aset bawaan yang cocok untuk konten anak, ditambah unggahan dan hasil AI sebelumnya.
const BUILT_IN: { url: string; label: string }[] = [
  { url: tempeMaskotImg, label: 'Maskot tempe' },
  { url: wortelMaskotImg, label: 'Maskot wortel' },
  { url: anakSehatImg, label: 'Anak sehat' },
  { url: cuciTanganImg, label: 'Cuci tangan' },
  { url: nasiPutihImg, label: 'Nasi putih' },
  { url: ayamImg, label: 'Ayam bumbu kuning' },
  { url: tempeBacemImg, label: 'Tempe bacem' },
  { url: tempeMentahImg, label: 'Tempe mentah' },
  { url: sayurSopImg, label: 'Sayur sop' },
  { url: buahPisangImg, label: 'Pisang' },
  { url: sawahPadiImg, label: 'Sawah padi' },
  { url: kebunSayurImg, label: 'Kebun sayur' },
  { url: peternakanAyamImg, label: 'Peternakan ayam' },
];

const isBuiltIn = (url: string) => BUILT_IN.some(b => b.url === url);

const Tile: React.FC<{ url: string; label: string; selected: boolean; onSelect: () => void }> = ({ url, label, selected, onSelect }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    className={`min-w-0 rounded-lg border-2 p-1 text-left cursor-pointer ${FOCUS_RING} ${selected ? 'border-emerald-700 bg-emerald-50' : 'border-transparent hover:bg-slate-100'}`}
  >
    <img src={url} alt="" loading="lazy" className="w-full aspect-square rounded-md bg-slate-100 object-contain" />
    <span className="block mt-0.5 text-[11px] text-slate-700 leading-tight truncate">{label}</span>
  </button>
);

export const ImageBankDialog: React.FC<{ onPick: (url: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    listCmsImages()
      .then(list => {
        if (!active) return;
        setUploads(list);
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, []);

  // Bank bisa dibuka di atas dialog lain: Escape hanya menutup bank, supaya isian dialog di bawahnya tidak hilang.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const result = await uploadCmsMedia(file, 'menu');
      setUploads(prev => [{ name: file.name, url: result.url }, ...prev]);
      setSelected(result.url);
    } catch {
      setError('Gambar gagal diunggah. Periksa sinyal internet lalu coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  // Aset bawaan berukuran besar: diperkecil dulu supaya tidak memberatkan HP pembaca halaman menu.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // React meneruskan submit lewat portal; tanpa ini formulir dialog di bawahnya ikut tersimpan.
    e.stopPropagation();
    if (!selected || isApplying) return;
    setIsApplying(true);
    let url = selected;
    if (isBuiltIn(selected)) {
      try {
        const blob = await (await fetch(selected)).blob();
        const result = await uploadCmsMedia(new File([blob], 'bank.jpg', { type: blob.type || 'image/jpeg' }), 'visual');
        if (result.isCloudStorage) url = result.url;
      } catch {
        // Tetap memakai berkas aslinya; hanya ukurannya yang lebih besar.
      }
    }
    onPick(url);
    onClose();
  };

  return createPortal(
    <FormDialog
      title="Bank gambar"
      description="Pilih gambar yang sudah tersedia untuk konten ini."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isApplying ? 'Menyiapkan...' : 'Pakai gambar'}
      submitDisabled={!selected || isApplying || isUploading}
      error={error}
    >
      <section>
        <h3 className="text-xs font-semibold text-slate-800 mb-1">Gambar bawaan</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
          {BUILT_IN.map(b => (
            <Tile key={b.url} url={b.url} label={b.label} selected={selected === b.url} onSelect={() => setSelected(b.url)} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-semibold text-slate-800">Unggahan dan hasil AI</h3>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" tabIndex={-1} aria-hidden="true" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading} className={BTN_SECONDARY}>
            <Upload className="w-4 h-4" />
            {isUploading ? 'Mengunggah...' : 'Tambah ke bank'}
          </button>
        </div>
        {status === 'loading' && <p className="text-xs text-slate-600">Memuat gambar...</p>}
        {status === 'error' && <p className="text-xs text-rose-800">Daftar unggahan gagal dimuat. Gambar bawaan tetap bisa dipakai.</p>}
        {status === 'ready' && uploads.length === 0 && <p className="text-xs text-slate-600">Belum ada unggahan. Gambar yang diunggah atau dibuat AI akan muncul di sini.</p>}
        {uploads.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
            {uploads.map((u, i) => (
              <Tile key={u.url} url={u.url} label={`Gambar ${uploads.length - i}`} selected={selected === u.url} onSelect={() => setSelected(u.url)} />
            ))}
          </div>
        )}
      </section>
    </FormDialog>,
    document.body
  );
};
