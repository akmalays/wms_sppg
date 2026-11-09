import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { FormDialog, BTN_SECONDARY, FOCUS_RING } from './FormDialog';
import { useConfirm } from '../../context/ConfirmContext';
import { deleteCmsImage, findCmsImageUsage, listCmsImages, uploadCmsMedia } from '../../db/websiteConfigStorage';
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

const Tile: React.FC<{
  url: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  deleteDisabled?: boolean;
}> = ({ url, label, selected, onSelect, onDelete, deleting, deleteDisabled }) => (
  <div className="relative min-w-0">
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`block w-full rounded-lg border-2 p-1 text-left cursor-pointer ${FOCUS_RING} ${selected ? 'border-emerald-700 bg-emerald-50' : 'border-transparent hover:bg-slate-100'}`}
    >
      <img src={url} alt="" loading="lazy" className="w-full aspect-square rounded-md bg-slate-100 object-contain" />
      <span className="block mt-0.5 text-[11px] text-slate-700 leading-tight truncate">{label}</span>
    </button>
    {onDelete && (
      // Area sentuh 44px, ikonnya tetap kecil supaya gambar tidak tertutup. Selalu terlihat karena HP tidak punya hover.
      <button
        type="button"
        onClick={onDelete}
        disabled={deleteDisabled}
        aria-label={`Hapus ${label} dari bank`}
        className={`group absolute top-0 right-0 w-11 h-11 flex items-start justify-end p-1.5 rounded-lg cursor-pointer disabled:cursor-not-allowed ${FOCUS_RING}`}
      >
        <span className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-white text-rose-700 group-hover:bg-rose-50 group-disabled:text-slate-400 group-disabled:bg-white">
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </span>
      </button>
    )}
  </div>
);

const USAGE_MESSAGE = {
  website: 'Gambar ini masih dipakai di website. Ganti dulu gambarnya di Atur Website, lalu hapus dari bank.',
  poster: 'Gambar ini masih dipakai di poster menu. Ganti dulu fotonya di poster, lalu hapus dari bank.',
};

export const ImageBankDialog: React.FC<{ onPick: (url: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const askConfirm = useConfirm();
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [deletingUrl, setDeletingUrl] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const isUploading = progress !== null;

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
      // Konfirmasi hapus sedang terbuka: Escape hanya menutup konfirmasinya.
      if (document.querySelector('[role="alertdialog"]')) return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    const added: { name: string; url: string }[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({ current: i + 1, total: files.length });
      try {
        if (!file.type.startsWith('image/')) continue;
        const result = await uploadCmsMedia(file, 'menu');
        // Cadangan data URL hanya hidup di browser ini, jadi tidak dihitung masuk bank.
        if (!result.isCloudStorage) continue;
        const item = { name: result.url.split('/').pop() || file.name, url: result.url };
        added.push(item);
        setUploads(prev => [item, ...prev]);
      } catch {
        // Dihitung gagal di bawah; berkas berikutnya tetap dicoba.
      }
    }
    setProgress(null);
    if (added.length === 1) setSelected(added[0].url);
    const failed = files.length - added.length;
    if (failed > 0) {
      setError(
        files.length === 1
          ? 'Gambar gagal disimpan ke bank. Periksa sinyal internet lalu coba lagi.'
          : `${failed} dari ${files.length} gambar gagal disimpan ke bank. Periksa sinyal internet lalu coba lagi.`
      );
    }
  };

  const handleDelete = async (item: { name: string; url: string }) => {
    setError('');
    setDeletingUrl(item.url);
    try {
      const usage = await findCmsImageUsage(item.name);
      if (usage) {
        setError(USAGE_MESSAGE[usage]);
        return;
      }
      const ok = await askConfirm({
        title: 'Hapus gambar ini dari bank?',
        message: 'Gambar dihapus permanen dan tidak bisa dikembalikan.',
        confirmText: 'Hapus gambar',
        variant: 'danger',
      });
      if (!ok) return;
      await deleteCmsImage(item.name);
      setUploads(prev => prev.filter(u => u.url !== item.url));
      setSelected(prev => (prev === item.url ? '' : prev));
    } catch {
      setError('Gambar gagal dihapus. Periksa sinyal internet lalu coba lagi.');
    } finally {
      setDeletingUrl('');
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
      description="Pilih gambar untuk konten ini, atau kelola unggahan di bank."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isApplying ? 'Menyiapkan...' : 'Pakai gambar'}
      submitDisabled={!selected || isApplying || isUploading || Boolean(deletingUrl)}
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
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" tabIndex={-1} aria-hidden="true" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading} className={BTN_SECONDARY}>
            <Upload className="w-4 h-4" />
            {progress ? `Mengunggah ${progress.current} dari ${progress.total}...` : 'Tambah ke bank'}
          </button>
        </div>
        {/* Di sini, bukan di puncak dialog: tombol tambah dan hapus ada jauh di bawah gambar bawaan, pesan di atas tidak terlihat. */}
        {error && (
          <p role="alert" className="mb-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
            {error}
          </p>
        )}
        {status === 'loading' && <p className="text-xs text-slate-600">Memuat gambar...</p>}
        {status === 'error' && <p className="text-xs text-rose-800">Daftar unggahan gagal dimuat. Gambar bawaan tetap bisa dipakai.</p>}
        {status === 'ready' && uploads.length === 0 && <p className="text-xs text-slate-600">Belum ada unggahan. Gambar yang diunggah atau dibuat AI akan muncul di sini.</p>}
        {uploads.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
            {uploads.map((u, i) => (
              <Tile
                key={u.url}
                url={u.url}
                label={`Gambar ${uploads.length - i}`}
                selected={selected === u.url}
                onSelect={() => setSelected(u.url)}
                onDelete={() => handleDelete(u)}
                deleting={deletingUrl === u.url}
                deleteDisabled={Boolean(deletingUrl) || isUploading || isApplying}
              />
            ))}
          </div>
        )}
      </section>
    </FormDialog>,
    document.body
  );
};
