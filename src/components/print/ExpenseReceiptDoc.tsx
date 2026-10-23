import React, { useEffect, useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { Select } from '../common/Select';
import { FIELD_LABEL } from '../common/FormDialog';
import { ExcelSource, ColumnMapper } from './ExcelImportPanel';
import { angkaTerbilang } from '../../utils/numberToWords';
import { getRomanMonth } from '../../utils/poNumberGenerator';
import { titleCase, parseAmount, monthIndexOf, MONTHS_ID } from '../../utils/excelCells';
import {
  ColumnMap,
  ColumnOverrides,
  ColumnRule,
  SheetGrid,
  applyOverrides,
  cellText,
  detectColumns,
  downloadTemplate,
  headerOptions,
  readGrids,
} from '../../utils/excelTable';
import { signerName } from '../../db/storage';
import ttdAkuntanImg from '../../assets/ttd alfiana.png';

// Kuitansi pengeluaran dadakan (format .../KULBanPer/<bulan>/<tahun>), dibuat massal dari Excel
// "KWITANSI PENGELUARAN DADAKAN" (nama file dari akuntansi). Isi sama dengan template Word mail merge yang dipakai sebelumnya.
// File hanya dibaca di browser (tidak diunggah). Kolom dikenali dari judulnya dan bisa dipilih manual.

interface ExpenseReceipt {
  key: string;
  no: string;
  from: string;
  amount: number;
  purpose: string;
  phone: string;
  date: string; // "12 Januari 2026"
  monthLabel: string; // "Januari 2026", untuk filter
  roman: string;
  year: string;
  staff: string;
  receiver: string;
}

type Field = 'no' | 'from' | 'amount' | 'purpose' | 'phone' | 'date' | 'staff' | 'receiver' | 'roman';

// Urutan penting: kolom HP dicek sebelum penerima ("Nomor Hp Penerima Uang")
const COLUMN_RULES: ColumnRule<Field>[] = [
  { key: 'amount', label: 'Uang sejumlah', required: true, weight: 2, test: h => /uang sejumlah|nominal|jumlah uang|^jumlah$|besaran|biaya/.test(h) },
  { key: 'purpose', label: 'Untuk pembayaran', required: true, weight: 2, test: h => /untuk pembayaran|keperluan|keterangan|uraian/.test(h) },
  { key: 'no', label: 'Nomor kuitansi', test: h => /nomor ku?w?itansi|no\.? ?ku?w?itansi/.test(h) },
  { key: 'phone', label: 'Nomor HP penerima', test: h => /\bhp\b|tlp|telp|telepon|whatsapp|\bwa\b/.test(h) },
  { key: 'from', label: 'Sudah terima dari', test: h => /terima dari/.test(h) },
  { key: 'date', label: 'Tanggal TTD', test: h => /tanggal|\btgl\b/.test(h) },
  { key: 'staff', label: 'Nama staf akuntansi', test: h => /^staf|akuntan/.test(h) },
  { key: 'receiver', label: 'Yang menerima', test: h => /yang menerima|penerima/.test(h) },
  { key: 'roman', label: 'Bulan kuitansi (romawi)', test: h => /bulan/.test(h) },
];

const TEMPLATE_HEADERS = ['No', 'Sudah Terima dari', 'Uang Sejumlah', 'Untuk Pembayaran', 'Nomor Hp Penerima Uang', 'Tanggal TTD', 'Staf Akuntansi SPPG Malang Tumpang Jeru', 'Yang Menerima', 'Bulan Kuitansi', 'Nomor Kuitansi'];
const TEMPLATE_EXAMPLE = [1, 'Staf Akuntansi SPPG Malang Tumpang Jeru', 24000, 'Galon air minum relawan', '082121524536', 'Malang, 12 Januari 2026', 'Alfiana Viransa, S.Tr.Ak', 'Nama Penerima', 'I', '001'];

function buildRows(sheet: SheetGrid, headerRow: number, cols: ColumnMap<Field>): ExpenseReceipt[] {
  const raw = (row: unknown[], key: Field) => (cols[key] === undefined ? '' : row[cols[key]!]);
  const get = (row: unknown[], key: Field) => cellText(raw(row, key));
  const rows: ExpenseReceipt[] = [];
  sheet.grid.slice(headerRow + 1).forEach((row, i) => {
    const amount = parseAmount(raw(row, 'amount'));
    const purpose = get(row, 'purpose');
    if (amount <= 0 || !purpose) return; // baris template yang belum diisi
    // Tanggal Excel asli langsung dibaca; teks "Malang, 12 Januari 2026" -> "12 Januari 2026"
    const dateCell = raw(row, 'date');
    const date = dateCell instanceof Date ? cellText(dateCell) : titleCase(get(row, 'date').replace(/^[^,\d]*,\s*/, ''));
    const month = monthIndexOf(date);
    const year = date.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    const phoneRaw = get(row, 'phone').replace(/\s/g, '');
    const noRaw = get(row, 'no');
    rows.push({
      key: `${sheet.name}-${headerRow + 2 + i}`,
      // Nomor yang tersimpan sebagai angka (1) dikembalikan ke format 001
      no: noRaw ? (/^\d+$/.test(noRaw) ? noRaw.padStart(3, '0') : noRaw) : String(rows.length + 1).padStart(3, '0'),
      from: get(row, 'from') || 'Staf Akuntansi SPPG Malang Tumpang Jeru',
      amount,
      purpose,
      // Nomor HP yang tersimpan sebagai angka kehilangan nol di depan
      phone: /^8\d{7,}$/.test(phoneRaw) ? `0${phoneRaw}` : phoneRaw,
      date,
      monthLabel: month === null ? 'Tanpa tanggal' : `${MONTHS_ID[month]} ${year}`,
      roman: get(row, 'roman').toUpperCase() || getRomanMonth(month === null ? new Date() : month + 1),
      year,
      staff: get(row, 'staff'),
      receiver: get(row, 'receiver'),
    });
  });
  return rows;
}

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const DOTS = '....................................';

interface ExpenseReceiptDocProps {
  onCountChange: (count: number) => void;
}

export const ExpenseReceiptDoc: React.FC<ExpenseReceiptDocProps> = ({ onCountChange }) => {
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetGrid[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [overrides, setOverrides] = useState<ColumnOverrides<Field>>({});
  const [month, setMonth] = useState('ALL');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [perPage, setPerPage] = useState<2 | 3>(3);
  const [withRecap, setWithRecap] = useState(true);
  const [withSignature, setWithSignature] = useState(true);

  const detected = useMemo(
    () => sheets.map(sh => {
      const d = detectColumns(sh.grid, COLUMN_RULES);
      return { sheet: sh, ...d, count: buildRows(sh, d.headerRow, d.cols).length };
    }),
    [sheets]
  );
  const current = detected.find(d => d.sheet.name === sheetName);
  const cols = useMemo(() => applyOverrides(current?.cols || {}, overrides), [current, overrides]);
  const rows = useMemo(() => (current ? buildRows(current.sheet, current.headerRow, cols) : []), [current, cols]);

  // Bulan muncul sesuai urutan di Excel; bawaan bulan terakhir karena biasanya yang baru dicetak
  const months = useMemo(() => [...new Set(rows.map(r => r.monthLabel))], [rows]);
  const shown = useMemo(() => (month === 'ALL' ? rows : rows.filter(r => r.monthLabel === month)), [rows, month]);
  const toPrint = shown.filter(r => !excluded.includes(r.key));
  const total = toPrint.reduce((sum, r) => sum + r.amount, 0);

  const pages: ExpenseReceipt[][] = [];
  for (let i = 0; i < toPrint.length; i += perPage) pages.push(toPrint.slice(i, i + perPage));

  useEffect(() => {
    onCountChange(toPrint.length);
  }, [toPrint.length, onCountChange]);

  const handleFile = async (file: File) => {
    setError('');
    try {
      const grids = readGrids(await file.arrayBuffer()).filter(g => g.grid.length > 0);
      if (!grids.length) {
        setError('File ini tidak berisi data.');
        return;
      }
      const best = grids
        .map(g => {
          const d = detectColumns(g.grid, COLUMN_RULES);
          return { sheet: g, score: d.score, rows: buildRows(g, d.headerRow, d.cols) };
        })
        .sort((a, b) => b.score - a.score || b.rows.length - a.rows.length)[0];
      setFileName(file.name);
      setSheets(grids);
      setSheetName(best.sheet.name);
      setOverrides({});
      const monthList = [...new Set(best.rows.map(r => r.monthLabel))];
      setMonth(monthList[monthList.length - 1] || 'ALL');
      setExcluded([]);
    } catch {
      setError('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .xls.');
    }
  };

  const compact = perPage === 3;
  const fallbackStaff = signerName('AKUNTAN');

  const renderReceipt = (r: ExpenseReceipt) => (
    <article className={`bg-white text-slate-900 flex flex-col ${compact ? 'print:h-[88mm]' : 'print:h-[133mm]'}`}>
      <div className={`border-b-2 border-slate-900 flex items-center gap-3 ${compact ? 'pb-1' : 'pb-2'}`}>
        <SppgLogo size="md" variant="color" showText={false} />
        <KopText />
      </div>

      <div className={`text-center ${compact ? 'mt-1.5' : 'mt-3'}`}>
        <h2 className={`${compact ? 'text-sm' : 'text-base'} font-bold tracking-[0.4em] pl-[0.4em]`}>KUITANSI</h2>
        <p className="text-[11px] font-mono text-slate-700">
          {r.no}/KULBanPer/{r.roman}/{r.year}
        </p>
      </div>

      <table className={`w-full text-xs ${compact ? 'mt-1.5' : 'mt-3'}`}>
        <tbody className={compact ? '[&_td]:py-[1px] [&_td]:align-top' : '[&_td]:py-1 [&_td]:align-top'}>
          <tr>
            <td className="w-36 text-slate-600">Sudah terima dari</td>
            <td className="w-3">:</td>
            <td>{r.from}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Yang menerima</td>
            <td>:</td>
            <td className="font-bold">{r.receiver || DOTS}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Uang sejumlah</td>
            <td>:</td>
            <td>
              <span className="font-bold font-mono">{formatRp(r.amount)}</span>
              <span className="italic text-slate-700"> ({angkaTerbilang(r.amount)})</span>
            </td>
          </tr>
          <tr>
            <td className="text-slate-600">Untuk pembayaran</td>
            <td>:</td>
            <td className="font-semibold">{r.purpose}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Nomor Tlp/WA</td>
            <td>:</td>
            <td className="font-mono">{r.phone || DOTS}</td>
          </tr>
        </tbody>
      </table>

      <div className={`mt-auto grid grid-cols-2 gap-6 text-center text-[11px] ${compact ? 'pt-1' : 'pt-3'}`}>
        <div>
          <p className="invisible">Malang,</p>
          <p>Staf Akuntansi SPPG Malang Tumpang Jeru</p>
          <div className={`${compact ? 'h-11' : 'h-14'} flex items-center justify-center`}>
            {withSignature && <img src={ttdAkuntanImg} alt="Tanda tangan Staf Akuntansi" className={`${compact ? 'h-10' : 'h-14'} w-auto object-contain`} />}
          </div>
          <p className="font-bold underline underline-offset-2">{r.staff || fallbackStaff}</p>
        </div>
        <div>
          <p>Malang, {r.date || DOTS}</p>
          <p>Yang Menerima</p>
          <div className={compact ? 'h-11' : 'h-14'} />
          <p className="font-bold underline underline-offset-2">{r.receiver || DOTS}</p>
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      <style>{'@media print { .kw-page { break-after: page; page-break-after: always; } .kw-page:last-child { break-after: auto; page-break-after: auto; } }'}</style>

      {/* Pengaturan (hanya di layar) */}
      <div className="no-print space-y-3 text-xs">
        <ExcelSource
          fileName={fileName}
          summary={current ? `${rows.length} kuitansi dari lembar ${current.sheet.name}` : undefined}
          title="Pilih file Excel kuitansi pengeluaran"
          hint="Kolom yang dibaca: Uang Sejumlah, Untuk Pembayaran, Yang Menerima, Nomor HP, Tanggal TTD, Bulan, dan Nomor Kuitansi. File hanya dibaca di perangkat ini, tidak diunggah."
          error={error}
          onFile={handleFile}
          onDownloadTemplate={() => downloadTemplate('Template Kuitansi Pengeluaran.xlsx', TEMPLATE_HEADERS, TEMPLATE_EXAMPLE)}
        />

        {current && (
          <>
            <ColumnMapper
              rules={COLUMN_RULES}
              cols={cols}
              options={headerOptions(current.sheet.grid, current.headerRow)}
              onChange={(key, index) => { setOverrides(prev => ({ ...prev, [key]: index })); setExcluded([]); }}
              onReset={() => setOverrides({})}
              hasOverrides={Object.keys(overrides).length > 0}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {detected.length > 1 && (
                <div>
                  <label htmlFor="kw-sheet" className={FIELD_LABEL}>Lembar Excel</label>
                  <Select id="kw-sheet" className="w-full" size="sm" value={sheetName} onChange={e => { setSheetName(e.target.value); setOverrides({}); setMonth('ALL'); setExcluded([]); }}>
                    {detected.map(d => (
                      <option key={d.sheet.name} value={d.sheet.name}>{d.sheet.name} ({d.count} kuitansi)</option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <label htmlFor="kw-month" className={FIELD_LABEL}>Bulan</label>
                <Select id="kw-month" className="w-full" size="sm" value={month} onChange={e => { setMonth(e.target.value); setExcluded([]); }}>
                  {months.map(m => (
                    <option key={m} value={m}>{m} ({rows.filter(r => r.monthLabel === m).length} kuitansi)</option>
                  ))}
                  <option value="ALL">Semua bulan ({rows.length} kuitansi)</option>
                </Select>
              </div>
              <div>
                <label htmlFor="kw-layout" className={FIELD_LABEL}>Ukuran</label>
                <Select id="kw-layout" className="w-full" size="sm" value={String(perPage)} onChange={e => setPerPage(Number(e.target.value) as 2 | 3)}>
                  <option value="3">3 kuitansi per A4 (hemat kertas)</option>
                  <option value="2">2 kuitansi per A4 (A5)</option>
                </Select>
              </div>
              <div className="sm:col-span-2 flex flex-col justify-end gap-1.5 text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withRecap} onChange={e => setWithRecap(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Sertakan lembar rekap
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withSignature} onChange={e => setWithSignature(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Tanda tangan Staf Akuntansi tercetak
                </label>
              </div>
            </div>

            {/* Cek data sebelum cetak */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        checked={excluded.length === 0}
                        onChange={() => setExcluded(excluded.length === 0 ? shown.map(r => r.key) : [])}
                        className="w-4 h-4 accent-emerald-700"
                        aria-label="Pilih semua kuitansi"
                      />
                    </th>
                    <th className="p-2">No.</th>
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Untuk pembayaran</th>
                    <th className="p-2">Yang menerima</th>
                    <th className="p-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map(r => {
                    const on = !excluded.includes(r.key);
                    return (
                      <tr key={r.key} className={on ? '' : 'opacity-50'}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setExcluded(on ? [...excluded, r.key] : excluded.filter(k => k !== r.key))}
                            className="w-4 h-4 accent-emerald-700"
                            aria-label={`Cetak kuitansi ${r.no}`}
                          />
                        </td>
                        <td className="p-2 font-mono">{r.no}</td>
                        <td className="p-2 whitespace-nowrap">{r.date}</td>
                        <td className="p-2">{r.purpose}</td>
                        <td className={`p-2 ${r.receiver ? '' : 'text-amber-700'}`}>{r.receiver || 'Kosong'}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{formatRp(r.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-900 sticky bottom-0">
                  <tr>
                    <td className="p-2" />
                    <td className="p-2" colSpan={4}>{toPrint.length} kuitansi dicetak</td>
                    <td className="p-2 text-right font-mono tabular-nums">{formatRp(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="no-print py-10 text-center text-slate-500 text-xs">Kuitansi akan muncul di sini setelah file Excel dipilih.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {/* Lembar rekap untuk arsip akuntansi */}
          {withRecap && toPrint.length > 0 && (
            <section className="kw-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 max-w-[210mm] mx-auto">
              <div className="border-b-2 border-slate-900 pb-3 flex items-center gap-3">
                <SppgLogo size="lg" variant="color" showText={false} />
                <KopText />
              </div>
              <div className="text-center mt-3">
                <h2 className="text-sm font-bold uppercase tracking-wide">Rekap Kuitansi Pengeluaran</h2>
                <p className="text-xs text-slate-700">{month === 'ALL' ? `${toPrint[0].date} – ${toPrint[toPrint.length - 1].date}` : month}</p>
              </div>
              <table className="w-full mt-3 border-collapse border border-slate-400 table-print text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-400 p-1.5 w-8">No</th>
                    <th className="border border-slate-400 p-1.5 w-36">No. kuitansi</th>
                    <th className="border border-slate-400 p-1.5 w-28">Tanggal</th>
                    <th className="border border-slate-400 p-1.5 text-left">Untuk pembayaran</th>
                    <th className="border border-slate-400 p-1.5 text-left w-32">Yang menerima</th>
                    <th className="border border-slate-400 p-1.5 text-right w-24">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {toPrint.map((r, i) => (
                    <tr key={r.key} className="break-inside-avoid">
                      <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{r.no}/KULBanPer/{r.roman}/{r.year}</td>
                      <td className="border border-slate-400 p-1.5">{r.date}</td>
                      <td className="border border-slate-400 p-1.5">{r.purpose}</td>
                      <td className="border border-slate-400 p-1.5">{r.receiver}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="border border-slate-400 p-1.5 text-center" colSpan={5}>TOTAL</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(total)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-1.5 text-[11px] italic text-slate-700">Terbilang: {angkaTerbilang(total)}</p>
              <div className="mt-6 ml-auto w-64 text-center text-[11px]">
                <p>Staf Akuntansi SPPG Malang Tumpang Jeru</p>
                <div className="h-16 flex items-center justify-center">
                  {withSignature && <img src={ttdAkuntanImg} alt="Tanda tangan Staf Akuntansi" className="h-14 w-auto object-contain" />}
                </div>
                <p className="font-bold underline underline-offset-2">{toPrint[0].staff || fallbackStaff}</p>
              </div>
            </section>
          )}

          {pages.map((page, pageIdx) => (
            <section key={pageIdx} className="kw-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 max-w-[210mm] mx-auto flex flex-col">
              {page.map((r, i) => (
                <React.Fragment key={r.key}>
                  {i > 0 && (
                    <div className={`${compact ? 'my-2 print:my-[2mm]' : 'my-3 print:my-[3mm]'} flex items-center gap-2 text-[9px] text-slate-500 select-none`}>
                      <Scissors className="w-3.5 h-3.5 rotate-90 shrink-0" />
                      <span className="flex-1 border-b border-dashed border-slate-400" />
                      <span>Potong di sini</span>
                      <span className="flex-1 border-b border-dashed border-slate-400" />
                    </div>
                  )}
                  {renderReceipt(r)}
                </React.Fragment>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
