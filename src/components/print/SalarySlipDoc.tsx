import React, { useEffect, useMemo, useState } from 'react';
import { SppgLogo } from '../SppgLogo';
import { SPPG_OFFICIAL_NAME } from '../common/KopText';
import { Select } from '../common/Select';
import { FIELD_INPUT, FIELD_LABEL } from '../common/FormDialog';
import { ExcelSource, ColumnMapper } from './ExcelImportPanel';
import { angkaTerbilang } from '../../utils/numberToWords';
import { getRomanMonth } from '../../utils/poNumberGenerator';
import { norm, titleCase, parseAmount, formatDateId, monthIndexOf } from '../../utils/excelCells';
import {
  ColumnMap,
  ColumnOverrides,
  ColumnRule,
  SheetGrid,
  applyOverrides,
  cellText,
  columnLetter,
  detectColumns,
  downloadTemplate,
  headerOptions,
  readGrids,
} from '../../utils/excelTable';
import { signerName } from '../../db/storage';
import ttdKepalaImg from '../../assets/ttd rizky rapat.png';
import { OfficerSignatureImg } from '../common/OfficerSignatureImg';

// Slip gaji relawan/karyawan, dibuat massal dari file Excel daftar gaji dan dicetak 2 sampai 4 slip per A4.
// File hanya dibaca di browser (tidak diunggah). Kolom identitas dikenali dari judulnya; kolom angka lain
// dianggap komponen gaji (penerimaan atau potongan) dan jenisnya bisa diubah sebelum cetak.

type Field = 'name' | 'position' | 'nip' | 'rate' | 'days' | 'net' | 'account' | 'period' | 'date';
type ComponentKind = 'EARN' | 'DEDUCT' | 'IGNORE';
type SlipSize = 'A6' | 'THIRD' | 'A5';

interface Line {
  label: string;
  amount: number;
}

interface Slip {
  key: string;
  name: string;
  position: string;
  nip: string;
  account: string;
  period: string;
  date: string;
  days: number;
  earnings: Line[];
  deductions: Line[];
  earnTotal: number;
  deductTotal: number;
  net: number;
  /** Total diterima menurut kolom Excel, bila ada; dipakai untuk memeriksa hitungan. */
  excelNet: number | null;
}

const COLUMN_RULES: ColumnRule<Field>[] = [
  { key: 'name', label: 'Nama penerima', required: true, weight: 2, test: h => /^nama( lengkap| karyawan| relawan| pegawai| penerima)?$/.test(h) },
  { key: 'position', label: 'Jabatan / bagian', test: h => /jabatan|posisi|bagian|divisi|tugas|^peran$/.test(h) },
  { key: 'nip', label: 'NIP / nomor induk', test: h => /\bnip\b|no\.? ?induk|^id (karyawan|relawan|pegawai)/.test(h) },
  { key: 'rate', label: 'Honor per hari', test: h => /(honor|upah|gaji|tarif).*(hari|harian)|per hari/.test(h) },
  { key: 'days', label: 'Jumlah hari kerja', test: h => /hari kerja|jumlah hari|jml\.? hari|^hari$|kehadiran|^hadir|jumlah masuk/.test(h) },
  { key: 'net', label: 'Total diterima', weight: 2, test: h => /diterima|bersih|take home|\bthp\b|dibayar|netto|^total$/.test(h) },
  { key: 'account', label: 'Nomor rekening', test: h => /rekening|no\.? ?rek\b/.test(h) },
  { key: 'period', label: 'Periode', test: h => /periode|^bulan$/.test(h) },
  { key: 'date', label: 'Tanggal pembayaran', test: h => /tanggal|\btgl\b/.test(h) },
];

// Jenis awal komponen dari judul kolom. Subtotal diabaikan karena total dihitung ulang dari komponennya.
const SUBTOTAL_RE = /^total|^jumlah( gaji| penerimaan| pendapatan| potongan)?$|bruto|subtotal|kotor/;
const DEDUCT_RE = /potong|kasbon|pinjam|utang|hutang|bpjs|pph|pajak|denda|iuran|cicil|absen|alpa|terlambat/;
const NOT_MONEY_RE = /^no\.?$|^nomor|urut|\bhp\b|telp|telepon|whatsapp|\bwa\b|\brek\b|\bnik\b|npwp|kode|^id\b|tahun|umur|usia/;

const TEMPLATE_HEADERS = ['No', 'Nama', 'Jabatan', 'Hari Kerja', 'Honor per Hari', 'Tunjangan', 'Lembur', 'Kasbon', 'Total Diterima', 'Periode', 'Tanggal Bayar'];
const TEMPLATE_EXAMPLE = [1, 'Nama Relawan', 'Juru Masak', 22, 100000, 150000, 50000, 200000, 2200000, 'Oktober 2026', '31 Oktober 2026'];

// Tinggi slip mengikuti tinggi cetak A4 (281 mm setelah margin 8 mm) dibagi jumlah baris slip
const SIZES: Record<SlipSize, { label: string; perPage: number; cols: 1 | 2; height: string; wide: boolean; maxLines: number }> = {
  A6: { label: '4 slip per A4 (ukuran A6)', perPage: 4, cols: 2, height: 'h-[139mm]', wide: false, maxLines: 10 },
  THIRD: { label: '3 slip per A4 (memanjang)', perPage: 3, cols: 1, height: 'h-[92mm]', wide: true, maxLines: 7 },
  A5: { label: '2 slip per A4 (ukuran A5)', perPage: 2, cols: 1, height: 'h-[139mm]', wide: true, maxLines: 14 },
};

const isMoneyCell = (v: unknown) => typeof v === 'number' || /^(rp\.?\s*)?-?[\d.,]+$/i.test(norm(v));
const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

// "PERIODE OKTOBER 2026" -> "Oktober 2026"
function cleanPeriod(raw: string): string {
  const s = norm(raw).replace(/^periode\s*/i, '');
  return s ? titleCase(s).replace(/\s*[-–]\s*/g, ' – ') : '';
}

const dataRows = (sheet: SheetGrid, headerRow: number, cols: ColumnMap<Field>) =>
  sheet.grid
    .slice(headerRow + 1)
    .map((row, i) => ({ row, line: headerRow + 2 + i }))
    .filter(({ row }) => {
      const name = cols.name === undefined ? '' : cellText(row[cols.name]);
      return name && !/^(total|jumlah)\b/i.test(name);
    });

interface ComponentColumn {
  index: number;
  label: string;
  auto: ComponentKind;
  reason?: string;
}

// Kolom angka di luar kolom identitas = komponen gaji
function detectComponents(sheet: SheetGrid, headerRow: number, cols: ColumnMap<Field>): ComponentColumn[] {
  const header = sheet.grid[headerRow] || [];
  const rows = dataRows(sheet, headerRow, cols);
  const used = new Set(Object.values(cols));
  const width = Math.max(header.length, ...rows.map(r => r.row.length));
  const result: ComponentColumn[] = [];
  for (let c = 0; c < width; c++) {
    if (used.has(c)) continue;
    const label = cellText(header[c]);
    const h = label.toLowerCase();
    if (!label || NOT_MONEY_RE.test(h)) continue;
    const values = rows.map(r => r.row[c]).filter(v => norm(v) !== '');
    if (!values.length || !values.every(isMoneyCell) || !values.some(v => parseAmount(v) > 0)) continue;
    let auto: ComponentKind = DEDUCT_RE.test(h) ? 'DEDUCT' : 'EARN';
    let reason: string | undefined;
    if (SUBTOTAL_RE.test(h)) {
      auto = 'IGNORE';
      reason = 'subtotal, dihitung ulang';
    } else if (cols.days !== undefined && cols.rate !== undefined) {
      // Kolom "Jumlah Honor" yang isinya hari x tarif tidak dihitung dua kali
      const same = rows.every(({ row }) => {
        const v = row[c];
        return norm(v) === '' || parseAmount(v) === parseAmount(row[cols.days!]) * parseAmount(row[cols.rate!]);
      });
      if (same) {
        auto = 'IGNORE';
        reason = 'sama dengan hari kerja × honor per hari';
      }
    }
    result.push({ index: c, label: label.charAt(0).toUpperCase() + label.slice(1), auto, reason });
  }
  return result;
}

function buildSlips(
  sheet: SheetGrid,
  headerRow: number,
  cols: ColumnMap<Field>,
  components: ComponentColumn[],
  kinds: Record<number, ComponentKind>
): Slip[] {
  // Periode dari judul lembar (mis. baris 2 "PERIODE OKTOBER 2026") bila tidak ada kolomnya
  const titlePeriod = sheet.grid.slice(0, headerRow).flat().map(cellText).find(v => /^periode\s/i.test(v));
  const get = (row: unknown[], key: Field) => (cols[key] === undefined ? '' : row[cols[key]!]);
  const slips: Slip[] = [];
  dataRows(sheet, headerRow, cols).forEach(({ row, line }) => {
    const days = parseAmount(get(row, 'days'));
    const rate = parseAmount(get(row, 'rate'));
    const earnings: Line[] = [];
    const deductions: Line[] = [];
    if (days > 0 && rate > 0) earnings.push({ label: `Honor ${days} hari × ${formatRp(rate)}`, amount: days * rate });
    components.forEach(comp => {
      const kind = kinds[comp.index] ?? comp.auto;
      const amount = parseAmount(row[comp.index]);
      if (kind === 'IGNORE' || amount <= 0) return;
      (kind === 'EARN' ? earnings : deductions).push({ label: comp.label, amount });
    });
    const netCell = get(row, 'net');
    const excelNet = norm(netCell) === '' ? null : parseAmount(netCell);
    // Excel hanya berisi total: slip tetap punya satu baris penerimaan
    if (!earnings.length && excelNet) earnings.push({ label: 'Gaji periode ini', amount: excelNet });
    const earnTotal = earnings.reduce((s, l) => s + l.amount, 0);
    const deductTotal = deductions.reduce((s, l) => s + l.amount, 0);
    if (earnTotal <= 0) return;
    slips.push({
      key: `${sheet.name}-${line}`,
      name: titleCase(cellText(get(row, 'name'))),
      position: cellText(get(row, 'position')),
      nip: cellText(get(row, 'nip')),
      account: cellText(get(row, 'account')),
      period: cleanPeriod(cellText(get(row, 'period')) || titlePeriod || ''),
      date: formatDateId(get(row, 'date')),
      days,
      earnings,
      deductions,
      earnTotal,
      deductTotal,
      net: earnTotal - deductTotal,
      excelNet,
    });
  });
  return slips;
}

interface SalarySlipDocProps {
  onCountChange: (count: number) => void;
}

export const SalarySlipDoc: React.FC<SalarySlipDocProps> = ({ onCountChange }) => {
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetGrid[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [overrides, setOverrides] = useState<ColumnOverrides<Field>>({});
  const [kinds, setKinds] = useState<Record<number, ComponentKind>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [size, setSize] = useState<SlipSize>('A6');
  const [periodOverride, setPeriodOverride] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [startNo, setStartNo] = useState(1);
  const [withRecap, setWithRecap] = useState(true);
  const [withSignature, setWithSignature] = useState(true);

  const detected = useMemo(
    () => sheets.map(sh => {
      const d = detectColumns(sh.grid, COLUMN_RULES);
      return { sheet: sh, ...d, count: dataRows(sh, d.headerRow, d.cols).length };
    }),
    [sheets]
  );
  const current = detected.find(d => d.sheet.name === sheetName);
  const cols = useMemo(() => applyOverrides(current?.cols || {}, overrides), [current, overrides]);
  const components = useMemo(() => (current ? detectComponents(current.sheet, current.headerRow, cols) : []), [current, cols]);
  const slips = useMemo(
    () =>
      (current ? buildSlips(current.sheet, current.headerRow, cols, components, kinds) : []).map(s => ({
        ...s,
        period: periodOverride.trim() || s.period,
        date: dateOverride.trim() || s.date,
      })),
    [current, cols, components, kinds, periodOverride, dateOverride]
  );
  const toPrint = slips.filter(s => !excluded.includes(s.key));
  const total = toPrint.reduce((sum, s) => sum + s.net, 0);
  const sizeCfg = SIZES[size];

  const pages: Slip[][] = [];
  for (let i = 0; i < toPrint.length; i += sizeCfg.perPage) pages.push(toPrint.slice(i, i + sizeCfg.perPage));

  useEffect(() => {
    onCountChange(toPrint.length);
  }, [toPrint.length, onCountChange]);

  const resetSelections = () => {
    setOverrides({});
    setKinds({});
    setExcluded([]);
  };

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
          return { name: g.name, score: d.score, count: dataRows(g, d.headerRow, d.cols).length };
        })
        .sort((a, b) => b.score - a.score || b.count - a.count)[0];
      setFileName(file.name);
      setSheets(grids);
      setSheetName(best.name);
      resetSelections();
    } catch {
      setError('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .xls.');
    }
  };

  // Nomor slip: 001/SLIP/X/2026, bulan dan tahun dari periode (atau tanggal bayar)
  const slipNo = (s: Slip, idx: number) => {
    const ref = `${s.period} ${s.date}`;
    const month = monthIndexOf(ref);
    const year = ref.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    return `${String(startNo + idx).padStart(3, '0')}/SLIP/${getRomanMonth(month === null ? new Date() : month + 1)}/${year}`;
  };

  const issues = (s: Slip): string[] => {
    const out: string[] = [];
    if (s.excelNet !== null && s.excelNet !== s.net) out.push(`Excel menulis ${formatRp(s.excelNet)}`);
    if (s.earnings.length + s.deductions.length > sizeCfg.maxLines) out.push('Komponen terlalu banyak untuk ukuran ini');
    return out;
  };

  const accountant = signerName('AKUNTAN');
  const head = signerName('KEPALA_SPPG');

  const lineTable = (title: string, lines: Line[], subtotal: number, sign = '') => (
    <table className="w-full">
      <thead>
        <tr>
          <th colSpan={2} className="text-left font-bold border-b border-slate-900 pb-0.5">{title}</th>
        </tr>
      </thead>
      <tbody className="[&_td]:py-[1px] [&_td]:align-top">
        {lines.length ? (
          lines.map((l, i) => (
            <tr key={i}>
              <td className="pr-2">{l.label}</td>
              <td className="text-right font-mono tabular-nums whitespace-nowrap">{sign}{formatRp(l.amount)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={2} className="text-slate-600">Tidak ada</td>
          </tr>
        )}
        <tr className="font-semibold">
          <td className="border-t border-slate-300 pt-0.5">Jumlah</td>
          <td className="border-t border-slate-300 pt-0.5 text-right font-mono tabular-nums whitespace-nowrap">{subtotal ? sign : ''}{formatRp(subtotal)}</td>
        </tr>
      </tbody>
    </table>
  );

  const renderSlip = (s: Slip, idx: number) => {
    const identity = (
      <table className="w-full">
        <tbody className="[&_td]:py-[1px] [&_td]:align-top">
          <tr>
            <td className="w-[22mm] text-slate-600">Nama</td>
            <td className="font-bold">{s.name}</td>
          </tr>
          {s.position && (
            <tr>
              <td className="text-slate-600">Jabatan</td>
              <td>{s.position}</td>
            </tr>
          )}
          {s.nip && (
            <tr>
              <td className="text-slate-600">NIP</td>
              <td className="font-mono">{s.nip}</td>
            </tr>
          )}
          <tr>
            <td className="text-slate-600">Periode</td>
            <td className="font-semibold">{s.period || '..............................'}</td>
          </tr>
          {s.days > 0 && (
            <tr>
              <td className="text-slate-600">Hari kerja</td>
              <td>{s.days} hari</td>
            </tr>
          )}
          {s.account && (
            <tr>
              <td className="text-slate-600">Rekening</td>
              <td className="font-mono">{s.account}</td>
            </tr>
          )}
        </tbody>
      </table>
    );

    const netBox = (
      <div className="border-2 border-slate-900 px-2 py-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold">Total diterima</span>
          <span className="text-[1.25em] font-bold font-mono tabular-nums">{formatRp(s.net)}</span>
        </div>
        <p className="italic text-slate-700 leading-snug">{angkaTerbilang(s.net)}</p>
      </div>
    );

    const signatures = (
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p>Dibayarkan oleh,</p>
          <div className="h-[13mm] flex items-center justify-center">
            {withSignature && <OfficerSignatureImg officer="AKUNTAN" className="h-[12mm]" />}
          </div>
          <p className="font-bold underline underline-offset-2">{accountant}</p>
          <p className="text-slate-600">Akuntan SPPG</p>
        </div>
        <div>
          <p>Diterima oleh,</p>
          <div className="h-[13mm]" />
          <p className="font-bold underline underline-offset-2">{s.name}</p>
          <p className="text-slate-600">{s.date ? `Tanggal ${s.date}` : 'Tanggal ..........................'}</p>
        </div>
      </div>
    );

    return (
      <article className={`bg-white text-slate-900 flex flex-col overflow-hidden p-[4mm] ${sizeCfg.height} ${size === 'A5' ? 'text-[11px]' : 'text-[9.5px]'} leading-tight`}>
        <header className="flex items-center gap-2 border-b-2 border-slate-900 pb-1.5">
          <SppgLogo size="sm" variant="color" showText={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold">BADAN GIZI NASIONAL</p>
            <p className="font-bold leading-snug">{SPPG_OFFICIAL_NAME}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[1.35em] font-bold">Slip Gaji</p>
            <p className="font-mono text-slate-700">No. {slipNo(s, idx)}</p>
          </div>
        </header>

        {sizeCfg.wide ? (
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_1.2fr] gap-[5mm] mt-2">
            <div className="flex flex-col gap-2">
              {identity}
              <div className="mt-auto">{signatures}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              {lineTable('Penerimaan', s.earnings, s.earnTotal)}
              {lineTable('Potongan', s.deductions, s.deductTotal, '− ')}
              <div className="mt-auto">{netBox}</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-1.5 mt-2">
            {identity}
            {lineTable('Penerimaan', s.earnings, s.earnTotal)}
            {lineTable('Potongan', s.deductions, s.deductTotal, '− ')}
            {netBox}
            <div className="mt-auto">{signatures}</div>
          </div>
        )}
      </article>
    );
  };

  // Garis potong: tiap slip dibingkai garis putus-putus, garis bersama tidak dobel
  const cellBorder = (i: number, count: number) => {
    const cls = ['border-slate-400', 'border-dashed'];
    if (sizeCfg.cols === 2) {
      if (i % 2 === 0) cls.push('border-r');
      if (i < 2 && count > 2) cls.push('border-b');
    } else if (i < count - 1) cls.push('border-b');
    return cls.join(' ');
  };

  return (
    <div className="space-y-4">
      <style>{'@media print { .slip-page { break-after: page; page-break-after: always; } .slip-page:last-child { break-after: auto; page-break-after: auto; } .slip-page article { break-inside: avoid; } }'}</style>

      {/* Pengaturan (hanya di layar) */}
      <div className="no-print space-y-3 text-xs">
        <ExcelSource
          fileName={fileName}
          summary={current ? `${slips.length} slip dari lembar ${current.sheet.name}` : undefined}
          title="Pilih file Excel daftar gaji"
          hint="Satu baris per orang: nama, jabatan, hari kerja, honor per hari, tunjangan, potongan, dan total diterima. File hanya dibaca di perangkat ini, tidak diunggah."
          error={error}
          onFile={handleFile}
          onDownloadTemplate={() => downloadTemplate('Template Slip Gaji.xlsx', TEMPLATE_HEADERS, TEMPLATE_EXAMPLE)}
        />

        {sheets.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="slip-sheet" className={FIELD_LABEL}>Lembar Excel</label>
                <Select id="slip-sheet" className="w-full" size="sm" value={sheetName} onChange={e => { setSheetName(e.target.value); resetSelections(); }}>
                  {detected.map(d => (
                    <option key={d.sheet.name} value={d.sheet.name}>{d.sheet.name} ({d.count} baris)</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="slip-size" className={FIELD_LABEL}>Ukuran slip</label>
                <Select id="slip-size" className="w-full" size="sm" value={size} onChange={e => setSize(e.target.value as SlipSize)}>
                  {(Object.keys(SIZES) as SlipSize[]).map(k => (
                    <option key={k} value={k}>{SIZES[k].label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="slip-period" className={FIELD_LABEL}>Periode</label>
                <input id="slip-period" type="text" value={periodOverride} onChange={e => setPeriodOverride(e.target.value)} placeholder={slips[0]?.period || 'Mis. Oktober 2026'} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="slip-date" className={FIELD_LABEL}>Tanggal pembayaran</label>
                <input id="slip-date" type="text" value={dateOverride} onChange={e => setDateOverride(e.target.value)} placeholder={slips[0]?.date || 'Kosong: diisi tangan'} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="slip-start" className={FIELD_LABEL}>Nomor slip mulai dari</label>
                <input id="slip-start" type="number" min={1} value={startNo} onChange={e => setStartNo(Math.max(1, Number(e.target.value) || 1))} className={FIELD_INPUT} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex flex-col justify-end gap-1.5 text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                  <input type="checkbox" checked={withSignature} onChange={e => setWithSignature(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Tanda tangan Akuntan & Kepala SPPG tercetak
                </label>
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                  <input type="checkbox" checked={withRecap} onChange={e => setWithRecap(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Sertakan lembar rekap A4 untuk paraf penerima
                </label>
              </div>
            </div>

            {current && (
              <ColumnMapper
                rules={COLUMN_RULES}
                cols={cols}
                options={headerOptions(current.sheet.grid, current.headerRow)}
                onChange={(key, index) => { setOverrides(prev => ({ ...prev, [key]: index })); setKinds({}); setExcluded([]); }}
                onReset={() => setOverrides({})}
                hasOverrides={Object.keys(overrides).length > 0}
              />
            )}

            {/* Komponen gaji: kolom angka lain di Excel, jenisnya bisa diubah */}
            {components.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <p className="font-semibold text-slate-900">Komponen gaji dari Excel</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {cols.days !== undefined && cols.rate !== undefined ? 'Honor dihitung dari hari kerja × honor per hari. ' : ''}
                  Kolom angka lain di bawah ini masuk ke slip sesuai jenisnya.
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                  {components.map(comp => (
                    <div key={comp.index} className="flex items-center gap-2">
                      <label htmlFor={`slip-comp-${comp.index}`} className="flex-1 min-w-0">
                        <span className="block truncate text-slate-800">
                          <span className="font-mono text-slate-500">{columnLetter(comp.index)}</span> {comp.label}
                        </span>
                        {comp.reason && (kinds[comp.index] ?? comp.auto) === 'IGNORE' && (
                          <span className="block text-[11px] text-slate-500">Tidak dipakai: {comp.reason}</span>
                        )}
                      </label>
                      <Select
                        id={`slip-comp-${comp.index}`}
                        size="sm"
                        className="w-32 shrink-0"
                        value={kinds[comp.index] ?? comp.auto}
                        onChange={e => setKinds(prev => ({ ...prev, [comp.index]: e.target.value as ComponentKind }))}
                      >
                        <option value="EARN">Penerimaan</option>
                        <option value="DEDUCT">Potongan</option>
                        <option value="IGNORE">Tidak dipakai</option>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cek data sebelum cetak */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        checked={excluded.length === 0}
                        onChange={() => setExcluded(excluded.length === 0 ? slips.map(s => s.key) : [])}
                        className="w-4 h-4 accent-emerald-700"
                        aria-label="Pilih semua slip"
                      />
                    </th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Jabatan</th>
                    <th className="p-2 text-right">Penerimaan</th>
                    <th className="p-2 text-right">Potongan</th>
                    <th className="p-2 text-right">Diterima</th>
                    <th className="p-2">Periksa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slips.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-3 text-center text-amber-800">
                        Belum ada baris yang bisa dibuat slip. Periksa kolom nama dan nominal di pengaturan kolom.
                      </td>
                    </tr>
                  )}
                  {slips.map(s => {
                    const on = !excluded.includes(s.key);
                    const notes = issues(s);
                    return (
                      <tr key={s.key} className={on ? '' : 'opacity-50'}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setExcluded(on ? [...excluded, s.key] : excluded.filter(k => k !== s.key))}
                            className="w-4 h-4 accent-emerald-700"
                            aria-label={`Cetak slip ${s.name}`}
                          />
                        </td>
                        <td className="p-2 font-medium text-slate-900">{s.name}</td>
                        <td className="p-2">{s.position || '-'}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{formatRp(s.earnTotal)}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{s.deductTotal ? formatRp(s.deductTotal) : '-'}</td>
                        <td className="p-2 text-right font-mono tabular-nums font-semibold text-slate-900">{formatRp(s.net)}</td>
                        <td className={`p-2 ${notes.length ? 'text-amber-800' : 'text-slate-500'}`}>{notes.length ? notes.join('. ') : 'Sesuai'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {slips.length > 0 && (
                  <tfoot className="bg-slate-50 font-semibold text-slate-900">
                    <tr>
                      <td className="p-2" />
                      <td className="p-2" colSpan={4}>
                        {toPrint.length} slip, {pages.length} lembar A4
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">{formatRp(total)}</td>
                      <td className="p-2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>

      {sheets.length === 0 ? (
        <p className="no-print py-10 text-center text-slate-500 text-xs">Slip gaji akan muncul di sini setelah file Excel dipilih.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {pages.map((page, pageIdx) => (
            <section key={pageIdx} className="slip-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 w-[210mm] print:w-auto mx-auto">
              <div className={`grid border border-dashed border-slate-400 ${sizeCfg.cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {page.map((s, i) => (
                  <div key={s.key} className={cellBorder(i, page.length)}>
                    {renderSlip(s, pageIdx * sizeCfg.perPage + i)}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Lembar rekap: daftar tanda terima semua penerima, untuk arsip akuntansi */}
          {withRecap && toPrint.length > 0 && (
            <section className="slip-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 w-[210mm] print:w-auto mx-auto text-slate-900">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center gap-3">
                <SppgLogo size="md" variant="color" showText={false} />
                <div>
                  <p className="text-[11px] font-bold">BADAN GIZI NASIONAL</p>
                  <p className="text-sm font-bold">{SPPG_OFFICIAL_NAME}</p>
                </div>
              </div>
              <div className="text-center mt-3">
                <h2 className="text-sm font-bold">Rekap Pembayaran Gaji</h2>
                {toPrint[0].period && <p className="text-xs text-slate-700">Periode {toPrint[0].period}</p>}
              </div>
              <table className="w-full mt-3 border-collapse border border-slate-400 table-print text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-400 p-1.5 w-8">No</th>
                    <th className="border border-slate-400 p-1.5 text-left">Nama</th>
                    <th className="border border-slate-400 p-1.5 text-left">Jabatan</th>
                    <th className="border border-slate-400 p-1.5 text-right w-28">Penerimaan</th>
                    <th className="border border-slate-400 p-1.5 text-right w-24">Potongan</th>
                    <th className="border border-slate-400 p-1.5 text-right w-28">Diterima</th>
                    <th className="border border-slate-400 p-1.5 w-20">Paraf</th>
                  </tr>
                </thead>
                <tbody>
                  {toPrint.map((s, i) => (
                    <tr key={s.key}>
                      <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5">{s.name}</td>
                      <td className="border border-slate-400 p-1.5">{s.position}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(s.earnTotal)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{s.deductTotal ? formatRp(s.deductTotal) : '-'}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums font-semibold">{formatRp(s.net)}</td>
                      <td className="border border-slate-400 p-1.5 h-8" />
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="border border-slate-400 p-1.5 text-center" colSpan={5}>Total</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(total)}</td>
                    <td className="border border-slate-400 p-1.5" />
                  </tr>
                </tbody>
              </table>
              <p className="mt-1.5 text-[11px] italic text-slate-700">Terbilang: {angkaTerbilang(total)}</p>
              <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[11px]">
                <div>
                  <p>Dibayarkan oleh,</p>
                  <p className="text-slate-600">Akuntan SPPG Malang Tumpang Jeru</p>
                  <div className="h-20 flex items-center justify-center">
                    {withSignature && <OfficerSignatureImg officer="AKUNTAN" className="h-20" />}
                  </div>
                  <p className="font-bold underline underline-offset-2">{accountant}</p>
                </div>
                <div>
                  <p>Mengetahui,</p>
                  <p className="text-slate-600">Kepala SPPG Malang Tumpang Jeru</p>
                  <div className="h-20 flex items-center justify-center">
                    {withSignature && <OfficerSignatureImg officer="KEPALA_SPPG" className="h-20" defaultVariant={ttdKepalaImg} />}
                  </div>
                  <p className="font-bold underline underline-offset-2">{head}</p>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
