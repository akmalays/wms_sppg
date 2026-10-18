import React from 'react';
import { SchoolBeneficiaryAllocation } from '../../types/warehouse';

// Tiga lembar dokumen pengiriman per sekolah. Ada dua format:
// - Legacy: sama dengan format kertas lama SPPG Malang Tumpang Jeru (disimpan untuk jaga-jaga).
// - Standar: isi sama, wording dan tampilan dirapikan (lihat bagian bawah file).
// Format kertas lama:
// 1. Surat Jalan, 2. Berita Acara Penerimaan Paket Makanan + Penyerahan Alat Makan, 3. Uji Organoleptik (Hedonik).
// Isi dan susunan teks dipertahankan; yang distandarkan hanya kop, nomor, tanggal, dan nama yang terisi otomatis.

export interface DeliveryDocOfficers {
  nutritionistName: string;
  fieldAssistantName: string;
  headName: string;
  driverName: string;
  consumeBefore: string;
  /** Gambar tanda tangan Kepala SPPG (data URL), dicetak di kotak Mengetahui. */
  headSignature?: string;
}

export interface DeliveryClassRow {
  className: string;
  /** Kosong = dicetak kosong untuk diisi tangan. */
  portions?: number;
}

export interface SheetProps {
  school: SchoolBeneficiaryAllocation;
  /** Hari, mis. "Senin" */
  dayName: string;
  /** Tanggal pendek, mis. "28-9-26" */
  shortDate: string;
  /** Tanggal panjang, mis. "Senin, 28 September 2026" */
  longDate: string;
  totalPortions: number;
  officers: DeliveryDocOfficers;
  kop: React.ReactNode;
  footer: string;
}

const SHEET = 'bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-xs';
const LINE = 'inline-block border-b border-slate-700 align-bottom';
const CELL = 'border border-slate-800 px-2 py-1.5';

const Blank: React.FC<{ w: string; value?: string; center?: boolean }> = ({ w, value, center }) => (
  <span className={`${LINE} ${w} ${center ? 'text-center' : 'px-1'} font-semibold min-h-[1.1em]`}>{value || ' '}</span>
);

const SignLine: React.FC<{ name?: string }> = ({ name }) => (
  <div className="mt-12 flex items-end gap-1 w-56">
    <span>(</span>
    <span className="flex-1 border-b border-slate-800 text-center font-semibold pb-0.5">{name || ' '}</span>
    <span>)</span>
  </div>
);

const Footer: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-right text-[8.5px] text-slate-400 mt-3 font-mono">{text}</div>
);

// ---------------------------------------------------------------------------
// LEMBAR 1: SURAT JALAN
// ---------------------------------------------------------------------------
export const SuratJalanSheetLegacy: React.FC<SheetProps & { docNo: string; deliveryTime?: string; classes: DeliveryClassRow[] }> = ({
  school,
  dayName,
  shortDate,
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
    <div className="text-center font-bold leading-snug mt-4 mb-5 text-[13px] uppercase">
      <div>Surat Jalan</div>
      <div>Program Makan Bergizi Gratis</div>
      <div>SPPG Malang Tumpang Jeru</div>
    </div>

    <div className="grid grid-cols-2 gap-6 mb-5 text-[12px]">
      <div>
        Kepada: <span className="font-semibold">{school.schoolName}</span>
      </div>
      <table className="text-left">
        <tbody>
          <tr>
            <td className="pr-3 py-0.5 w-36">Nomor Surat</td>
            <td className="pr-2">:</td>
            <td className="font-semibold">{docNo}</td>
          </tr>
          <tr>
            <td className="pr-3 py-0.5">Hari/Tanggal</td>
            <td className="pr-2">:</td>
            <td>{dayName} / {shortDate}</td>
          </tr>
          <tr>
            <td className="pr-3 py-0.5">Waktu Pengiriman</td>
            <td className="pr-2">:</td>
            <td>{deliveryTime ? deliveryTime.replace(/\s*WIB\s*$/i, '') + ' WIB' : <Blank w="w-32" />}</td>
          </tr>
          <tr>
            <td className="pr-3 py-0.5">Driver</td>
            <td className="pr-2">:</td>
            <td>{officers.driverName || <Blank w="w-32" />}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <table className="w-full border-collapse border border-slate-800 text-[12px] mb-8">
      <thead>
        <tr className="font-bold text-center">
          <th rowSpan={2} className={`${CELL} w-10`}>No.</th>
          <th rowSpan={2} className={CELL}>Kelas</th>
          <th rowSpan={2} className={`${CELL} w-20`}>Jumlah Porsi</th>
          <th colSpan={2} className={CELL}>Jumlah Alat Makan</th>
          <th rowSpan={2} className={`${CELL} w-36`}>Keterangan</th>
        </tr>
        <tr className="font-bold text-center">
          <th className={`${CELL} w-24`}>Sebelum</th>
          <th className={`${CELL} w-24`}>Sesudah</th>
        </tr>
      </thead>
      <tbody>
        {classes.map((c, i) => (
          <tr key={`${c.className}-${i}`} className="h-9">
            <td className={`${CELL} text-center`}>{i + 1}</td>
            <td className={`${CELL} text-center`}>{c.className}</td>
            <td className={`${CELL} text-center`}>{c.portions !== undefined ? c.portions.toLocaleString('id-ID') : ''}</td>
            <td className={CELL}></td>
            <td className={CELL}></td>
            <td className={CELL}></td>
          </tr>
        ))}
        <tr className="h-9 font-bold">
          <td colSpan={2} className={`${CELL} text-center`}>Total</td>
          <td className={`${CELL} text-center`}>{totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : ''}</td>
          <td className={CELL}></td>
          <td className={CELL}></td>
          <td className={CELL}></td>
        </tr>
      </tbody>
    </table>

    <div className="grid grid-cols-3 gap-4 text-[12px]">
      <div className="col-span-2 text-center">Diperiksa Oleh,</div>
      <div>Diterima Oleh,</div>
      <div>
        <div>Ahli Gizi SPPG,</div>
        <div className="h-20" />
        <div className="font-semibold">{officers.nutritionistName || ' '}</div>
      </div>
      <div>
        <div>Asisten Lapangan,</div>
        <div className="h-20" />
        <div className="font-semibold">{officers.fieldAssistantName || ' '}</div>
      </div>
      <div>
        <div>Pihak Sekolah,</div>
        <div className="h-20" />
        <div className="border-b border-dotted border-slate-800 w-44" />
      </div>
    </div>
    <Footer text={footer} />
  </div>
);

// ---------------------------------------------------------------------------
// LEMBAR 2: BERITA ACARA PENERIMAAN PAKET MAKANAN + PENYERAHAN ALAT MAKAN
// ---------------------------------------------------------------------------
const HeadSignature: React.FC<{ src?: string; className?: string }> = ({ src, className = 'h-14' }) =>
  src?.startsWith('data:image') ? (
    <img src={src} alt="Tanda tangan Kepala SPPG" className={`${className} object-contain`} />
  ) : (
    <div className={className} />
  );

const MengetahuiBox: React.FC<{ headName: string; headSignature?: string }> = ({ headName, headSignature }) => (
  <div className="border border-slate-800 p-3 w-64 text-[11.5px]">
    <div>Mengetahui:</div>
    <HeadSignature src={headSignature} />
    <div className="font-semibold underline">{headName || ' '}</div>
    <div>Kepala SPPG Malang JERU</div>
  </div>
);

const BaTitle: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center font-bold uppercase text-[12.5px] text-slate-900 mb-3">{text}</div>
);

const BaOpening: React.FC<{ dayName: string; shortDate: string; totalPortions: number; kind: 'FOOD' | 'TOOLS' }> = ({
  dayName,
  shortDate,
  totalPortions,
  kind,
}) => (
  <p className="text-[11.5px] leading-7">
    Pada Hari <Blank w="w-20" value={dayName} center /> tanggal <Blank w="w-28" value={shortDate} center /> jam <Blank w="w-16" />{' '}
    {kind === 'FOOD' ? (
      <>
        telah diterima paket makanan sejumlah :{' '}
        <Blank w="w-14" value={totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : ''} center /> Paket Makanan Bergizi dari
        Satuan Pelayanan Pemenuhan Gizi (SPPG) Malang Jeru
      </>
    ) : (
      <>
        telah diserahkan kembali alat makan sejumlah : <Blank w="w-14" /> dari{' '}
        <Blank w="w-14" value={totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : ''} center /> set yang dikirim, kepada Satuan
        Pelayanan Pemenuhan Gizi (SPPG) Malang Jeru
      </>
    )}
  </p>
);

const PartyRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <tr>
    <td className="py-0.5 pr-3 w-36 align-top">{label}</td>
    <td className="pr-2 align-top">:</td>
    <td className="align-top">{value}</td>
  </tr>
);

export const BeritaAcaraSheetLegacy: React.FC<SheetProps> = ({ school, dayName, shortDate, totalPortions, officers, kop, footer }) => (
  <div className={SHEET}>
    {kop}

    {/* A. Penerimaan paket makanan: driver menyerahkan, sekolah menerima */}
    <div className="mt-4">
      <BaTitle text="Berita Acara Penerimaan Paket Makanan Program Makan Bergizi" />
      <BaOpening dayName={dayName} shortDate={shortDate} totalPortions={totalPortions} kind="FOOD" />
      <table className="text-[11.5px] mt-2">
        <tbody>
          <PartyRow label="Yang menyerahkan" value="Driver" />
          <PartyRow label="Nomor Telpon" value={<Blank w="w-44" />} />
        </tbody>
      </table>
      <SignLine name={officers.driverName} />

      <div className="flex items-start justify-between gap-6 mt-4">
        <div>
          <table className="text-[11.5px]">
            <tbody>
              <PartyRow label="Diterima oleh" value={<span className="font-semibold">{school.schoolName}</span>} />
              <PartyRow label="" value={<div><Blank w="w-52" /><div>PIC</div></div>} />
              <PartyRow label="Nomor Telpon" value={<Blank w="w-44" value={school.phone} />} />
            </tbody>
          </table>
          <SignLine />
        </div>
        <div className="flex flex-col items-end gap-4">
          <MengetahuiBox headName={officers.headName} headSignature={officers.headSignature} />
          <div className="text-red-600 font-bold text-[14px] uppercase">
            Baik dimakan sebelum pukul {officers.consumeBefore || '11:00'}
          </div>
        </div>
      </div>
    </div>

    <div className="border-t border-dashed border-slate-400 my-5" />

    {/* B. Penyerahan alat makan: sekolah menyerahkan, driver menerima */}
    <div>
      <BaTitle text="Berita Acara Penyerahan Alat Makan Program Makan Bergizi" />
      <BaOpening dayName={dayName} shortDate={shortDate} totalPortions={totalPortions} kind="TOOLS" />
      <div className="flex items-start justify-between gap-6 mt-2">
        <div>
          <table className="text-[11.5px]">
            <tbody>
              <PartyRow label="Yang menyerahkan" value={<span className="font-semibold">{school.schoolName}</span>} />
              <PartyRow label="PIC" value={<Blank w="w-44" />} />
              <PartyRow label="Nomor Telpon" value={<Blank w="w-44" value={school.phone} />} />
            </tbody>
          </table>
          <SignLine />
          <table className="text-[11.5px] mt-4">
            <tbody>
              <PartyRow label="Diterima oleh" value={<div><Blank w="w-52" value={officers.driverName} /><div>Driver</div></div>} />
              <PartyRow label="Nomor Telpon" value={<Blank w="w-44" />} />
            </tbody>
          </table>
          <SignLine name={officers.driverName} />
        </div>
        <div className="pt-24">
          <MengetahuiBox headName={officers.headName} headSignature={officers.headSignature} />
        </div>
      </div>
    </div>
    <Footer text={footer} />
  </div>
);

// ---------------------------------------------------------------------------
// LEMBAR 3: FORMULIR UJI ORGANOLEPTIK (UJI HEDONIK)
// ---------------------------------------------------------------------------
const HEDONIC_CODES = ['MP', 'LH', 'LN', 'S', 'B'];
const HEDONIC_PARAMS = ['Rasa', 'Warna', 'Aroma', 'Tekstur'];
const HEDONIC_SCALE = ['Tidak suka', 'Kurang suka', 'Sedikit suka', 'Suka', 'Sangat suka'];

export const UjiHedonikSheetLegacy: React.FC<SheetProps> = ({ school, longDate, kop, footer }) => (
  <div className={SHEET}>
    {kop}
    <div className="text-center font-bold uppercase text-[13px] mt-4 mb-5">Formulir Uji Organoleptik (Uji Hedonik)</div>

    <table className="text-[12px] mb-3">
      <tbody>
        <PartyRow label="Nama sekolah" value={<span className="font-semibold">{school.schoolName}</span>} />
        <PartyRow label="Tanggal Pengujian" value={longDate} />
        <PartyRow label="Petunjuk" value="" />
      </tbody>
    </table>
    <ol className="list-decimal pl-14 pr-4 space-y-1 text-[12px] leading-snug mb-5">
      <li>Dihadapan anda telah diajukan 5 macam jenis (makanan pokok, lauk hewani, lauk nabati, sayur, dan buah)</li>
      <li>
        Nyatakan pilihan anda terhadap <b>rasa, warna, aroma dan tekstur</b> masing masing sampel dengan menuliskan angka
        yang tertera di keterangan
      </li>
    </ol>

    <div className="text-[12px] mb-1">Parameter</div>
    <table className="w-full border-collapse border border-slate-800 text-[12px] mb-5">
      <thead>
        <tr className="text-center">
          <th rowSpan={2} className={`${CELL} font-normal w-40`}>Kode</th>
          <th colSpan={4} className={`${CELL} font-normal`}>Penilaian</th>
        </tr>
        <tr className="text-center">
          {HEDONIC_PARAMS.map(p => (
            <th key={p} className={`${CELL} font-normal`}>{p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {HEDONIC_CODES.map(code => (
          <tr key={code} className="h-8 text-center">
            <td className={CELL}>{code}</td>
            {HEDONIC_PARAMS.map(p => (
              <td key={p} className={CELL}></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>

    <div className="flex gap-3 text-[12px] mb-6">
      <span>Keterangan :</span>
      <ol className="space-y-1.5">
        {HEDONIC_SCALE.map((label, i) => (
          <li key={label}>{i + 1}.{label}</li>
        ))}
      </ol>
    </div>

    <div className="text-[12px]">
      <div className="mb-3">Kritik &amp; Saran :</div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-b border-dotted border-slate-700 h-7" />
      ))}
    </div>
    <Footer text={footer} />
  </div>
);
