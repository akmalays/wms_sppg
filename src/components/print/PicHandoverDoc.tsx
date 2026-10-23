import React, { useEffect, useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
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
  detectColumns,
  downloadTemplate,
  headerOptions,
  readGrids,
} from '../../utils/excelTable';
import { signerName } from '../../db/storage';
import ttdKepalaImg from '../../assets/ttd rizky rapat.png';
import ttdAkuntanImg from '../../assets/ttd alfiana.png';

// Kuitansi serah terima insentif PIC sekolah, dibuat massal dari file Excel "Daftar Penerima PIC".
// File hanya dibaca di browser (tidak diunggah). Kolom dikenali dari judulnya (urutan bebas) dan bisa dipilih manual.

type Field = 'school' | 'pic' | 'head' | 'amount' | 'period' | 'date';

interface Recipient {
  key: string;
  school: string;
  pic: string;
  head: string;
  amount: number;
  period: string;
  date: string;
}

// "PERIODE 28 SEPTEMBER-10 OKTOBER 2026" -> "28 September – 10 Oktober 2026"
function cleanPeriod(raw: string): string {
  const s = norm(raw).replace(/^periode\s*/i, '');
  if (!s) return '';
  return titleCase(s).replace(/\s*[-–]\s*/g, ' – ');
}

const COLUMN_RULES: ColumnRule<Field>[] = [
  { key: 'school', label: 'Nama sekolah / lembaga', required: true, weight: 2, test: h => /nama sekolah|^sekolah$|asal sekolah|posyandu|lembaga/.test(h) },
  { key: 'pic', label: 'Nama PIC (penerima)', required: true, weight: 2, test: h => /^nama( pic)?$|nama pic|^pic$|penerima/.test(h) },
  { key: 'head', label: 'Nama kepala sekolah', test: h => /kepala sekolah|nama kader/.test(h) },
  { key: 'amount', label: 'Nominal', required: true, weight: 2, test: h => /nominal|jumlah uang|^total$/.test(h) && !/tarif/.test(h), prefer: h => h === 'nominal' },
  { key: 'period', label: 'Periode', test: h => /periode/.test(h) && !/nominal|tarif/.test(h) },
  { key: 'date', label: 'Tanggal penyerahan', test: h => /tanggal|\btgl\b/.test(h) },
];

const TEMPLATE_HEADERS = ['No', 'Nama Sekolah', 'Nama Kepala Sekolah', 'Nama PIC', 'Nominal', 'Periode', 'Tanggal Pemberian'];
const TEMPLATE_EXAMPLE = [1, 'SMPN 1 Tumpang', 'Umi Chapsah, S.Pd, M.Pd', 'Syafril Hidayah Arif', 600000, '28 September - 10 Oktober 2026', '10 Oktober 2026'];

function buildRows(sheet: SheetGrid, headerRow: number, cols: ColumnMap<Field>): Recipient[] {
  // Periode dari judul lembar (mis. baris 2 "PERIODE 28 SEPTEMBER-10 OKTOBER 2026") bila tidak ada kolomnya
  const titlePeriod = sheet.grid.slice(0, headerRow).flat().map(cellText).find(v => /^periode\s/i.test(v));
  const get = (row: unknown[], key: Field) => (cols[key] === undefined ? '' : row[cols[key]!]);
  const rows: Recipient[] = [];
  sheet.grid.slice(headerRow + 1).forEach((row, i) => {
    const school = cellText(get(row, 'school'));
    const pic = cellText(get(row, 'pic')) || cellText(get(row, 'head'));
    const amount = parseAmount(get(row, 'amount'));
    if (!school || !pic || amount <= 0) return; // baris kosong atau baris total
    rows.push({
      key: `${sheet.name}-${headerRow + 2 + i}`,
      school,
      pic: titleCase(pic),
      head: cellText(get(row, 'head')),
      amount,
      period: cleanPeriod(cellText(get(row, 'period')) || titlePeriod || ''),
      date: formatDateId(get(row, 'date')),
    });
  });
  return rows;
}

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface PicHandoverDocProps {
  onCountChange: (count: number) => void;
}

export const PicHandoverDoc: React.FC<PicHandoverDocProps> = ({ onCountChange }) => {
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetGrid[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [overrides, setOverrides] = useState<ColumnOverrides<Field>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [purpose, setPurpose] = useState('Insentif Harian Penanggung Jawab (PIC) Satuan Pendidikan');
  const [periodOverride, setPeriodOverride] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [startNo, setStartNo] = useState(1);
  const [perPage, setPerPage] = useState<1 | 2>(2);
  const [withRecap, setWithRecap] = useState(true);
  const [withSignatures, setWithSignatures] = useState(true);

  // Deteksi kolom per lembar; jumlah penerima per lembar untuk pilihan lembar
  const detected = useMemo(
    () => sheets.map(sh => {
      const d = detectColumns(sh.grid, COLUMN_RULES);
      return { sheet: sh, ...d, count: buildRows(sh, d.headerRow, d.cols).length };
    }),
    [sheets]
  );
  const current = detected.find(d => d.sheet.name === sheetName);
  const cols = useMemo(() => applyOverrides(current?.cols || {}, overrides), [current, overrides]);
  const rows = useMemo(
    () =>
      (current ? buildRows(current.sheet, current.headerRow, cols) : []).map(r => ({
        ...r,
        period: periodOverride.trim() || r.period,
        date: dateOverride.trim() || r.date,
      })),
    [current, cols, periodOverride, dateOverride]
  );
  const toPrint = rows.filter(r => !excluded.includes(r.key));
  const total = toPrint.reduce((sum, r) => sum + r.amount, 0);

  const pages: (typeof toPrint)[] = [];
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
      // Lembar paling lengkap (punya kolom PIC, nominal, periode, tanggal) dipilih otomatis
      const best = grids
        .map(g => {
          const d = detectColumns(g.grid, COLUMN_RULES);
          return { name: g.name, score: d.score, count: buildRows(g, d.headerRow, d.cols).length };
        })
        .sort((a, b) => b.score - a.score || b.count - a.count)[0];
      setFileName(file.name);
      setSheets(grids);
      setSheetName(best.name);
      setOverrides({});
      setExcluded([]);
    } catch {
      setError('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .xls.');
    }
  };

  // Nomor kuitansi: 001/INS-PIC/X/2026, bulan dan tahun dari tanggal penyerahan
  const receiptNo = (r: Recipient, idx: number) => {
    const month = monthIndexOf(r.date);
    const year = r.date.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    return `${String(startNo + idx).padStart(3, '0')}/INS-PIC/${getRomanMonth(month === null ? new Date() : month + 1)}/${year}`;
  };

  const accountant = signerName('AKUNTAN');
  const head = signerName('KEPALA_SPPG');

  const renderKop = (compact = false) => (
    <div className={`border-b-2 border-slate-900 flex items-center gap-3 ${compact ? 'pb-1.5' : 'pb-3'}`}>
      <SppgLogo size={compact ? 'md' : 'lg'} variant="color" showText={false} />
      <KopText />
    </div>
  );

  const renderReceipt = (r: Recipient, idx: number) => (
    <article className={`bg-white text-slate-900 flex flex-col ${perPage === 2 ? 'print:h-[133mm]' : ''}`}>
      {renderKop(perPage === 2)}
      <div className="text-center mt-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wide">Kuitansi Serah Terima Insentif PIC</h2>
        <p className="text-[11px] text-slate-700 font-mono mt-0.5">No. {receiptNo(r, idx)}</p>
      </div>

      <table className="w-full mt-3 text-xs">
        <tbody className="[&_td]:py-1 [&_td]:align-top">
          <tr>
            <td className="w-40 text-slate-600">Telah terima dari</td>
            <td className="w-3">:</td>
            <td className="font-semibold">SPPG Malang Tumpang Jeru</td>
          </tr>
          <tr>
            <td className="text-slate-600">Nama penerima (PIC)</td>
            <td>:</td>
            <td className="font-bold">{r.pic}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Asal sekolah / lembaga</td>
            <td>:</td>
            <td className="font-semibold">{r.school}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Uang sejumlah</td>
            <td>:</td>
            <td>
              <span className="inline-block border-2 border-slate-900 px-3 py-0.5 text-sm font-bold font-mono">{formatRp(r.amount)}</span>
            </td>
          </tr>
          <tr>
            <td className="text-slate-600">Terbilang</td>
            <td>:</td>
            <td className="italic font-semibold bg-slate-100 px-2">{angkaTerbilang(r.amount)}</td>
          </tr>
          <tr>
            <td className="text-slate-600">Untuk pembayaran</td>
            <td>:</td>
            <td>
              {purpose}
              {r.period && <> periode <span className="font-semibold">{r.period}</span></>}
            </td>
          </tr>
          <tr>
            <td className="text-slate-600">Tanggal penyerahan</td>
            <td>:</td>
            <td className="font-semibold">{r.date || '....................................'}</td>
          </tr>
        </tbody>
      </table>

      {/* Urutan tanda tangan: Akuntan (kiri), PIC penerima (tengah), Kepala SPPG (kanan) */}
      <div className="mt-auto pt-3 grid grid-cols-3 gap-3 text-center text-[11px]">
        <div>
          <p>Yang Menyerahkan,</p>
          <p className="text-slate-600">Akuntan SPPG</p>
          <div className="h-16 flex items-center justify-center">
            {withSignatures && <img src={ttdAkuntanImg} alt="Tanda tangan Akuntan" className="h-14 w-auto object-contain" />}
          </div>
          <p className="font-bold underline underline-offset-2">{accountant}</p>
        </div>
        <div>
          <p>Yang Menerima,</p>
          <p className="text-slate-600">PIC {r.school}</p>
          <div className="h-16" />
          <p className="font-bold underline underline-offset-2">{r.pic}</p>
        </div>
        <div>
          <p>Mengetahui,</p>
          <p className="text-slate-600">Kepala SPPG</p>
          <div className="h-16 flex items-center justify-center">
            {withSignatures && <img src={ttdKepalaImg} alt="Tanda tangan Kepala SPPG" className="h-16 w-auto object-contain" />}
          </div>
          <p className="font-bold underline underline-offset-2">{head}</p>
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      <style>{'@media print { .pic-page { break-after: page; page-break-after: always; } .pic-page:last-child { break-after: auto; page-break-after: auto; } }'}</style>

      {/* Pengaturan (hanya di layar) */}
      <div className="no-print space-y-3 text-xs">
        <ExcelSource
          fileName={fileName}
          summary={current ? `${rows.length} penerima dari lembar ${current.sheet.name}` : undefined}
          title="Pilih file Excel daftar penerima PIC"
          hint="Kolom yang dibaca: nama sekolah, nama PIC, nominal, periode, dan tanggal pemberian. File hanya dibaca di perangkat ini, tidak diunggah."
          error={error}
          onFile={handleFile}
          onDownloadTemplate={() => downloadTemplate('Template Serah Terima Insentif PIC.xlsx', TEMPLATE_HEADERS, TEMPLATE_EXAMPLE)}
        />

        {sheets.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="pic-sheet" className={FIELD_LABEL}>Lembar Excel</label>
                <Select id="pic-sheet" className="w-full" size="sm" value={sheetName} onChange={e => { setSheetName(e.target.value); setOverrides({}); setExcluded([]); }}>
                  {detected.map(d => (
                    <option key={d.sheet.name} value={d.sheet.name}>{d.sheet.name} ({d.count} penerima)</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="pic-layout" className={FIELD_LABEL}>Ukuran</label>
                <Select id="pic-layout" className="w-full" size="sm" value={String(perPage)} onChange={e => setPerPage(Number(e.target.value) as 1 | 2)}>
                  <option value="2">2 kuitansi per A4 (dipotong jadi A5)</option>
                  <option value="1">1 kuitansi per A4</option>
                </Select>
              </div>
              <div>
                <label htmlFor="pic-start" className={FIELD_LABEL}>Nomor kuitansi mulai dari</label>
                <input id="pic-start" type="number" min={1} value={startNo} onChange={e => setStartNo(Math.max(1, Number(e.target.value) || 1))} className={FIELD_INPUT} />
              </div>
              <div className="flex flex-col justify-end gap-1.5 text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withRecap} onChange={e => setWithRecap(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Sertakan lembar rekap
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withSignatures} onChange={e => setWithSignatures(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Tanda tangan Akuntan & Kepala SPPG tercetak
                </label>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pic-purpose" className={FIELD_LABEL}>Untuk pembayaran</label>
                <input id="pic-purpose" type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="pic-period" className={FIELD_LABEL}>Periode</label>
                <input id="pic-period" type="text" value={periodOverride} onChange={e => setPeriodOverride(e.target.value)} placeholder={rows[0]?.period || 'Ikuti Excel'} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="pic-date" className={FIELD_LABEL}>Tanggal penyerahan</label>
                <input id="pic-date" type="text" value={dateOverride} onChange={e => setDateOverride(e.target.value)} placeholder={rows[0]?.date || 'Ikuti Excel'} className={FIELD_INPUT} />
              </div>
            </div>

            {current && (
              <ColumnMapper
                rules={COLUMN_RULES}
                cols={cols}
                options={headerOptions(current.sheet.grid, current.headerRow)}
                onChange={(key, index) => { setOverrides(prev => ({ ...prev, [key]: index })); setExcluded([]); }}
                onReset={() => setOverrides({})}
                hasOverrides={Object.keys(overrides).length > 0}
              />
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
                        onChange={() => setExcluded(excluded.length === 0 ? rows.map(r => r.key) : [])}
                        className="w-4 h-4 accent-emerald-700"
                        aria-label="Pilih semua penerima"
                      />
                    </th>
                    <th className="p-2">Sekolah / lembaga</th>
                    <th className="p-2">Nama PIC</th>
                    <th className="p-2 text-right">Nominal</th>
                    <th className="p-2">Periode</th>
                    <th className="p-2">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    const on = !excluded.includes(r.key);
                    return (
                      <tr key={r.key} className={on ? '' : 'opacity-50'}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setExcluded(on ? [...excluded, r.key] : excluded.filter(k => k !== r.key))}
                            className="w-4 h-4 accent-emerald-700"
                            aria-label={`Cetak kuitansi ${r.school}`}
                          />
                        </td>
                        <td className="p-2 font-medium text-slate-900">{r.school}</td>
                        <td className="p-2">{r.pic}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{formatRp(r.amount)}</td>
                        <td className={`p-2 ${r.period ? '' : 'text-amber-700'}`}>{r.period || 'Kosong'}</td>
                        <td className={`p-2 ${r.date ? '' : 'text-amber-700'}`}>{r.date || 'Kosong'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-900">
                  <tr>
                    <td className="p-2" />
                    <td className="p-2" colSpan={2}>{toPrint.length} kuitansi dicetak</td>
                    <td className="p-2 text-right font-mono tabular-nums">{formatRp(total)}</td>
                    <td className="p-2" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {sheets.length === 0 ? (
        <p className="no-print py-10 text-center text-slate-500 text-xs">Kuitansi akan muncul di sini setelah file Excel dipilih.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {/* Lembar rekap: daftar tanda terima semua penerima, untuk arsip akuntansi */}
          {withRecap && toPrint.length > 0 && (
            <section className="pic-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 max-w-[210mm] mx-auto">
              {renderKop()}
              <div className="text-center mt-3">
                <h2 className="text-sm font-bold uppercase tracking-wide">Rekap Serah Terima Insentif PIC</h2>
                {toPrint[0].period && <p className="text-xs text-slate-700">Periode {toPrint[0].period}</p>}
              </div>
              <table className="w-full mt-3 border-collapse border border-slate-400 table-print text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-400 p-1.5 w-8">No</th>
                    <th className="border border-slate-400 p-1.5 text-left">Sekolah / lembaga</th>
                    <th className="border border-slate-400 p-1.5 text-left">Nama PIC</th>
                    <th className="border border-slate-400 p-1.5 text-right w-28">Nominal</th>
                    <th className="border border-slate-400 p-1.5 w-32">Tanggal</th>
                    <th className="border border-slate-400 p-1.5 w-24">Paraf</th>
                  </tr>
                </thead>
                <tbody>
                  {toPrint.map((r, i) => (
                    <tr key={r.key}>
                      <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5">{r.school}</td>
                      <td className="border border-slate-400 p-1.5">{r.pic}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(r.amount)}</td>
                      <td className="border border-slate-400 p-1.5 text-center">{r.date}</td>
                      <td className="border border-slate-400 p-1.5 h-8" />
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="border border-slate-400 p-1.5 text-center" colSpan={3}>TOTAL</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono tabular-nums">{formatRp(total)}</td>
                    <td className="border border-slate-400 p-1.5" colSpan={2} />
                  </tr>
                </tbody>
              </table>
              <p className="mt-1.5 text-[11px] italic text-slate-700">Terbilang: {angkaTerbilang(total)}</p>
              <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[11px]">
                <div>
                  <p>Yang Menyerahkan,</p>
                  <p className="text-slate-600">Akuntan SPPG</p>
                  <div className="h-20 flex items-center justify-center">
                    {withSignatures && <img src={ttdAkuntanImg} alt="Tanda tangan Akuntan" className="h-16 w-auto object-contain" />}
                  </div>
                  <p className="font-bold underline underline-offset-2">{accountant}</p>
                </div>
                <div>
                  <p>Mengetahui,</p>
                  <p className="text-slate-600">Kepala SPPG</p>
                  <div className="h-20 flex items-center justify-center">
                    {withSignatures && <img src={ttdKepalaImg} alt="Tanda tangan Kepala SPPG" className="h-20 w-auto object-contain" />}
                  </div>
                  <p className="font-bold underline underline-offset-2">{head}</p>
                </div>
              </div>
            </section>
          )}

          {pages.map((page, pageIdx) => (
            <section key={pageIdx} className="pic-page bg-white border border-slate-200 p-[8mm] print:p-0 print:border-0 max-w-[210mm] mx-auto flex flex-col">
              {page.map((r, i) => {
                const idx = pageIdx * perPage + i;
                return (
                  <React.Fragment key={r.key}>
                    {i > 0 && (
                      <div className="my-3 print:my-[3mm] flex items-center gap-2 text-[9px] text-slate-500 select-none">
                        <Scissors className="w-3.5 h-3.5 rotate-90 shrink-0" />
                        <span className="flex-1 border-b border-dashed border-slate-400" />
                        <span>Potong di sini</span>
                        <span className="flex-1 border-b border-dashed border-slate-400" />
                      </div>
                    )}
                    {renderReceipt(r, idx)}
                  </React.Fragment>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
