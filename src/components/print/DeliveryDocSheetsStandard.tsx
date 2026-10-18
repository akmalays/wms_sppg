import React from 'react';
import { DeliveryClassRow, SheetProps } from './DeliveryDocSheets';

// Format standar dokumen pengiriman: isi sama dengan format kertas lama (DeliveryDocSheets.tsx),
// wording dirapikan dan tata letak dibuat seragam. Format lama tetap bisa dipilih di modal cetak.

const SHEET =
  'bg-white p-8 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-[11.5px] leading-snug';
const CELL = 'border border-slate-700 px-2 py-1.5';
const LABEL = 'text-slate-600';

const Dots: React.FC<{ w?: string; value?: string }> = ({ w = 'w-32', value }) => (
  <span className={`inline-block ${w} border-b border-dotted border-slate-700 align-bottom px-1 font-semibold`}>{value || ' '}</span>
);

const DocTitle: React.FC<{ title: string; subtitle?: string; docNo?: string }> = ({ title, subtitle, docNo }) => (
  <div className="text-center mt-4 mb-4">
    <h2 className="text-[14px] font-bold uppercase tracking-wide underline underline-offset-4">{title}</h2>
    {subtitle && <p className="mt-1 text-[11.5px] text-slate-700">{subtitle}</p>}
    {docNo && <p className="mt-0.5 text-[11px]">Nomor: <span className="font-semibold">{docNo}</span></p>}
  </div>
);

// Kolom tanda tangan: peran di atas, ruang tanda tangan, nama bergaris bawah, keterangan di bawah
const Signer: React.FC<{ caption: string; role: string; name?: string; note?: string; signature?: string }> = ({
  caption,
  role,
  name,
  note,
  signature,
}) => (
  <div className="text-center">
    <div className={LABEL}>{caption}</div>
    <div className="font-semibold">{role}</div>
    <div className="h-16 flex items-center justify-center">
      {signature?.startsWith('data:image') && <img src={signature} alt={`Tanda tangan ${role}`} className="max-h-16 object-contain" />}
    </div>
    <div className="font-semibold underline underline-offset-2 min-h-[1.2em]">{name || '(.................................)'}</div>
    {note && <div className="text-[10.5px] text-slate-600">{note}</div>}
  </div>
);

const InfoTable: React.FC<{ rows: [string, React.ReactNode, string, React.ReactNode][] }> = ({ rows }) => (
  <table className="w-full border-collapse border border-slate-700 mb-4">
    <tbody>
      {rows.map(([l1, v1, l2, v2]) => (
        <tr key={l1}>
          <td className={`${CELL} ${LABEL} w-28`}>{l1}</td>
          <td className={`${CELL} font-semibold`}>{v1}</td>
          <td className={`${CELL} ${LABEL} w-28`}>{l2}</td>
          <td className={`${CELL} font-semibold`}>{v2}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Footer: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-right text-[8.5px] text-slate-400 mt-4 font-mono">{text}</div>
);

const portionsText = (n: number) => (n > 0 ? `${n.toLocaleString('id-ID')} porsi` : '');

// ---------------------------------------------------------------------------
// LEMBAR 1: SURAT JALAN
// ---------------------------------------------------------------------------
export const SuratJalanSheetStandard: React.FC<SheetProps & { docNo: string; deliveryTime?: string; classes: DeliveryClassRow[] }> = ({
  school,
  longDate,
  totalPortions,
  officers,
  kop,
  footer,
  docNo,
  deliveryTime,
  classes,
}) => (
  <div className={SHEET}>
    {kop}
    <DocTitle title="Surat Jalan" subtitle="Pengiriman Makan Bergizi Gratis (MBG) · SPPG Malang Tumpang Jeru" docNo={docNo} />

    <InfoTable
      rows={[
        ['Kepada', school.schoolName, 'Hari, tanggal', longDate],
        ['Jumlah', portionsText(totalPortions) || <Dots />, 'Waktu kirim', deliveryTime ? `${deliveryTime.replace(/\s*WIB\s*$/i, '')} WIB` : <><Dots w="w-16" /> WIB</>],
        ['Driver', officers.driverName || <Dots w="w-40" />, 'Dimakan sebelum', `Pukul ${officers.consumeBefore || '11:00'} WIB`],
      ]}
    />

    <table className="w-full border-collapse border border-slate-700 mb-2">
      <thead className="bg-slate-100">
        <tr className="text-center font-semibold">
          <th rowSpan={2} className={`${CELL} w-9`}>No</th>
          <th rowSpan={2} className={CELL}>Kelas / Kelompok</th>
          <th rowSpan={2} className={`${CELL} w-20`}>Jumlah Porsi</th>
          <th colSpan={2} className={CELL}>Jumlah Alat Makan</th>
          <th rowSpan={2} className={`${CELL} w-32`}>Keterangan</th>
        </tr>
        <tr className="text-center font-semibold">
          <th className={`${CELL} w-24`}>Saat dikirim</th>
          <th className={`${CELL} w-24`}>Saat kembali</th>
        </tr>
      </thead>
      <tbody>
        {classes.map((c, i) => (
          <tr key={`${c.className}-${i}`} className="h-8">
            <td className={`${CELL} text-center`}>{i + 1}</td>
            <td className={CELL}>{c.className}</td>
            <td className={`${CELL} text-center`}>{c.portions !== undefined ? c.portions.toLocaleString('id-ID') : ''}</td>
            <td className={CELL}></td>
            <td className={CELL}></td>
            <td className={CELL}></td>
          </tr>
        ))}
        <tr className="h-8 font-bold bg-slate-50">
          <td colSpan={2} className={`${CELL} text-right`}>Total</td>
          <td className={`${CELL} text-center`}>{totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : ''}</td>
          <td className={CELL}></td>
          <td className={CELL}></td>
          <td className={CELL}></td>
        </tr>
      </tbody>
    </table>
    <p className="text-[10.5px] text-slate-600 mb-6">
      Alat makan dihitung dua kali: saat diserahkan ke sekolah dan saat dijemput kembali. Selisih dicatat di kolom Keterangan.
    </p>

    <div className="grid grid-cols-4 gap-3">
      <Signer caption="Diperiksa oleh," role="Ahli Gizi SPPG" name={officers.nutritionistName} />
      <Signer caption="Diperiksa oleh," role="Asisten Lapangan" name={officers.fieldAssistantName} />
      <Signer caption="Diterima oleh," role="Pihak Sekolah" note={school.schoolName} />
      <Signer caption="Mengetahui," role="Kepala SPPG" name={officers.headName} signature={officers.headSignature} />
    </div>
    <Footer text={footer} />
  </div>
);

// ---------------------------------------------------------------------------
// LEMBAR 2: BERITA ACARA SERAH TERIMA (paket makanan + alat makan)
// ---------------------------------------------------------------------------
const PartyBox: React.FC<{ title: string; party: string; rows: [string, React.ReactNode][] }> = ({ title, party, rows }) => (
  <div className="border border-slate-700">
    <div className="bg-slate-100 border-b border-slate-700 px-2 py-1 font-semibold">{title}</div>
    <div className="px-2 py-1.5 space-y-1">
      <div className="font-semibold">{party}</div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <span className={`${LABEL} w-20 shrink-0`}>{label}</span>
          <span>: {value}</span>
        </div>
      ))}
    </div>
  </div>
);

export const BeritaAcaraSheetStandard: React.FC<SheetProps & { docNo: string }> = ({
  school,
  dayName,
  longDate,
  totalPortions,
  officers,
  kop,
  footer,
  docNo,
}) => {
  const dateOnly = longDate.replace(/^[^,]+,\s*/, '');
  const total = totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : '........';
  return (
    <div className={SHEET}>
      {kop}
      <DocTitle title="Berita Acara Serah Terima" subtitle="Paket Makanan dan Alat Makan Program Makan Bergizi Gratis" docNo={docNo} />

      {/* I. Paket makanan: driver → sekolah */}
      <section className="mb-4">
        <h3 className="font-bold mb-1">I. Serah Terima Paket Makanan</h3>
        <p className="text-justify mb-2">
          Pada hari ini <b>{dayName}</b>, tanggal <b>{dateOnly}</b>, pukul <Dots w="w-14" /> WIB, telah diserahkan{' '}
          <b>{total} paket</b> Makanan Bergizi Gratis dari SPPG Malang Tumpang Jeru kepada <b>{school.schoolName}</b> dalam
          keadaan baik dan layak dikonsumsi.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <PartyBox title="Yang menyerahkan" party="Driver SPPG Malang Tumpang Jeru" rows={[['Nama', officers.driverName || <Dots />], ['No. telepon', <Dots />]]} />
          <PartyBox title="Yang menerima" party={school.schoolName} rows={[['PIC', <Dots />], ['No. telepon', school.phone || <Dots />]]} />
        </div>
        <div className="border-2 border-red-600 text-red-700 font-bold text-center py-1.5 mb-2 uppercase tracking-wide">
          Makanan baik dikonsumsi sebelum pukul {officers.consumeBefore || '11:00'} WIB
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Signer caption="Yang menyerahkan," role="Driver" name={officers.driverName} />
          <Signer caption="Yang menerima," role="PIC Sekolah" />
        </div>
      </section>

      <div className="border-t border-dashed border-slate-400 my-3" />

      {/* II. Alat makan: sekolah → driver */}
      <section className="mb-4">
        <h3 className="font-bold mb-1">II. Serah Terima Alat Makan</h3>
        <p className="text-justify mb-2">
          Pada hari dan tanggal yang sama, pukul <Dots w="w-14" /> WIB, <b>{school.schoolName}</b> telah menyerahkan kembali alat
          makan sebanyak <Dots w="w-14" /> dari <b>{total} set</b> yang dikirim kepada SPPG Malang Tumpang Jeru melalui driver.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-2">
          <span className={LABEL}>Kondisi alat makan:</span>
          <span>☐ Lengkap</span>
          <span>☐ Kurang <Dots w="w-10" /> set</span>
          <span>☐ Rusak <Dots w="w-10" /> set</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <PartyBox title="Yang menyerahkan" party={school.schoolName} rows={[['PIC', <Dots />], ['No. telepon', school.phone || <Dots />]]} />
          <PartyBox title="Yang menerima" party="Driver SPPG Malang Tumpang Jeru" rows={[['Nama', officers.driverName || <Dots />], ['No. telepon', <Dots />]]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Signer caption="Yang menyerahkan," role="PIC Sekolah" />
          <Signer caption="Yang menerima," role="Driver" name={officers.driverName} />
        </div>
      </section>

      <div className="flex justify-center mt-2">
        <div className="w-60">
          <Signer caption="Mengetahui," role="Kepala SPPG Malang Tumpang Jeru" name={officers.headName} signature={officers.headSignature} />
        </div>
      </div>
      <Footer text={footer} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// LEMBAR 3: FORMULIR UJI ORGANOLEPTIK (UJI HEDONIK)
// ---------------------------------------------------------------------------
const SAMPLES: [string, string][] = [
  ['MP', 'Makanan pokok'],
  ['LH', 'Lauk hewani'],
  ['LN', 'Lauk nabati'],
  ['S', 'Sayur'],
  ['B', 'Buah'],
];
const PARAMS = ['Rasa', 'Warna', 'Aroma', 'Tekstur'];
const SCALE = ['Tidak suka', 'Kurang suka', 'Sedikit suka', 'Suka', 'Sangat suka'];

export const UjiHedonikSheetStandard: React.FC<SheetProps> = ({ school, longDate, kop, footer }) => (
  <div className={SHEET}>
    {kop}
    <DocTitle title="Formulir Uji Organoleptik" subtitle="Uji Hedonik (Tingkat Kesukaan) Makan Bergizi Gratis" />

    <InfoTable rows={[['Nama sekolah', school.schoolName, 'Tanggal uji', longDate]]} />

    <h3 className="font-bold mb-1">Petunjuk pengisian</h3>
    <ol className="list-decimal pl-5 space-y-0.5 mb-3">
      <li>Di hadapan Anda terdapat 5 jenis sampel: makanan pokok, lauk hewani, lauk nabati, sayur, dan buah.</li>
      <li>
        Beri nilai <b>rasa, warna, aroma, dan tekstur</b> setiap sampel dengan menuliskan angka <b>1–5</b> sesuai skala di bawah.
      </li>
    </ol>

    <div className="grid grid-cols-5 border border-slate-700 mb-4 text-center">
      {SCALE.map((label, i) => (
        <div key={label} className={`py-1.5 ${i > 0 ? 'border-l border-slate-700' : ''}`}>
          <div className="text-[14px] font-bold">{i + 1}</div>
          <div className="text-[10.5px]">{label}</div>
        </div>
      ))}
    </div>

    <table className="w-full border-collapse border border-slate-700 mb-4">
      <thead className="bg-slate-100">
        <tr className="text-center font-semibold">
          <th rowSpan={2} className={`${CELL} w-14`}>Kode</th>
          <th rowSpan={2} className={`${CELL} text-left`}>Jenis sampel</th>
          <th colSpan={4} className={CELL}>Penilaian (1–5)</th>
        </tr>
        <tr className="text-center font-semibold">
          {PARAMS.map(p => (
            <th key={p} className={`${CELL} w-20`}>{p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SAMPLES.map(([code, label]) => (
          <tr key={code} className="h-9">
            <td className={`${CELL} text-center font-bold`}>{code}</td>
            <td className={CELL}>{label}</td>
            {PARAMS.map(p => (
              <td key={p} className={CELL}></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>

    <h3 className="font-bold mb-1">Kritik &amp; saran</h3>
    <div className="border border-slate-700 px-3 pb-2 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-dotted border-slate-500 h-7" />
      ))}
    </div>

    <div className="flex justify-end">
      <div className="w-56">
        <Signer caption="Penilai," role="Perwakilan Sekolah" />
      </div>
    </div>
    <Footer text={footer} />
  </div>
);
