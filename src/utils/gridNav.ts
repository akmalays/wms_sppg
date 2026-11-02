import type React from 'react';

/**
 * Navigasi seperti spreadsheet untuk tabel isian. Tiap baris ditandai data-grid-rowel, tiap sel yang bisa
 * difokus ditandai data-grid-col (urutan kolom). Baris diambil dari urutan di layar (DOM), jadi baris yang
 * dikelompokkan (mis. per supplier) tetap berurutan.
 *
 * - Panah atas/bawah: baris sebelumnya/berikutnya, kolom sama atau terdekat.
 * - Enter / Shift+Enter di kotak teks: sama dengan panah bawah/atas.
 * - Panah kiri/kanan: kolom sebelumnya/berikutnya; di kotak teks hanya bila kursor sudah di ujung.
 * - Dropdown dan tombol pemilih: panah selalu pindah sel; Enter/Spasi/ketik tetap membuka pilihannya.
 *
 * Pasang di onKeyDownCapture pembungkus tabel: tahap capture mendahului pemilih yang membuka daftar saat panah bawah.
 */
export function handleGridKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const el = e.target as HTMLElement;
  if (el.dataset.gridCol === undefined) return;
  const rowEl = el.closest<HTMLElement>('[data-grid-rowel]');
  if (!rowEl) return;
  const col = Number(el.dataset.gridCol);
  const isText = el instanceof HTMLInputElement;
  const container = e.currentTarget;
  const cellsOf = (row: Element) =>
    Array.from(row.querySelectorAll<HTMLElement>('[data-grid-col]'))
      .filter(c => !(c as HTMLInputElement).disabled)
      .map(c => ({ el: c, col: Number(c.dataset.gridCol) }));

  let target: HTMLElement | undefined;
  const vertical =
    e.key === 'ArrowDown' || e.key === 'ArrowUp' ? (e.key === 'ArrowUp' ? -1 : 1) : e.key === 'Enter' && isText ? (e.shiftKey ? -1 : 1) : 0;

  if (vertical) {
    const rows = Array.from(container.querySelectorAll('[data-grid-rowel]'));
    const next = rows[rows.indexOf(rowEl) + vertical];
    if (next) target = cellsOf(next).sort((a, b) => Math.abs(a.col - col) - Math.abs(b.col - col))[0]?.el;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (isText) {
      const input = el as HTMLInputElement;
      // Input angka tidak punya posisi kursor (null): selalu pindah kolom
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const allSelected = start === 0 && end === input.value.length;
      const atEdge =
        start === null || allSelected || (e.key === 'ArrowLeft' ? start === 0 && end === 0 : start === input.value.length);
      if (!atEdge) return;
    }
    const cells = cellsOf(rowEl).sort((a, b) => a.col - b.col);
    target = e.key === 'ArrowLeft' ? [...cells].reverse().find(c => c.col < col)?.el : cells.find(c => c.col > col)?.el;
    if (!target) return;
  } else {
    return;
  }

  // Panah atas/bawah dan Enter selalu ditahan, juga di baris pertama/terakhir: panah mengubah nilai input
  // angka dan pilihan dropdown, Enter di kotak teks mengirim form.
  e.preventDefault();
  e.stopPropagation();
  if (!target) return;
  target.focus();
  if (target instanceof HTMLInputElement) target.select();
}
