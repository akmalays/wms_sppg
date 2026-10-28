import React from 'react';
import { DeliveryClassRow, SheetProps } from './DeliveryDocSheets';
import { QrSvg } from '../common/QrSvg';

// Format ringkas dokumen pengiriman: 2 halaman per sekolah (cukup 1 kertas bila dicetak bolak-balik).
// Halaman 1 menggabungkan Surat Jalan dan Berita Acara Serah Terima: keduanya ditandatangani driver dan PIC
// sekolah untuk kiriman yang sama, jadi tabel kelas, jumlah porsi, dan tanda tangan cukup ditulis sekali.
// Halaman 2 memakai Uji Hedonik format standar apa adanya; bila uji hedonik lewat QR, QR-nya dicetak di halaman 1
// dan halaman 2 tidak perlu dicetak. Format standar dan lama tidak diubah.

const SHEET =
  'bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-[11px] leading-snug';
const CELL = 'border border-slate-700 px-2 py-1';
const LABEL = 'text-slate-600';

const Dots: React.FC<{ w?: string; value?: string }> = ({ w = 'w-28', value }) => (
  <span className={`inline-block ${w} border-b border-dotted border-slate-700 align-bottom px-1 font-semibold`}>{value || ' '}</span>
);

// Tanda tangan ringkas: peran, ruang tanda tangan, nama (atau garis untuk ditulis tangan)
const Sign: React.FC<{ role: string; name?: string; signature?: string; height?: string }> = ({ role, name, signature, height = 'h-12' }) => (
  <div className="text-center">
    <div className="font-semibold">{role}</div>
    <div className={`${height} flex items-center justify-center`}>
      {signature?.startsWith('data:image') && <img src={signature} alt={`Tanda tangan ${role}`} className="max-h-12 object-contain" />}
    </div>
    <div className="font-semibold underline underline-offset-2 min-h-[1.2em]">{name || '(..............................)'}</div>
  </div>
);

const HandoverBox: React.FC<{ title: string; children: React.ReactNode; from: React.ReactNode; to: React.ReactNode }> = ({
  title,
  children,
  from,
  to,
}) => (
  <div className="border border-slate-700 flex flex-col">
    <div className="bg-slate-100 border-b border-slate-700 px-2 py-1 font-semibold">{title}</div>
    <div className="px-2 py-1.5 space-y-1 flex-1">{children}</div>
    <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1">
      <div>
        <div className={`${LABEL} text-center text-[10px]`}>Yang menyerahkan,</div>
        {from}
      </div>
      <div>
        <div className={`${LABEL} text-center text-[10px]`}>Yang menerima,</div>
        {to}
      </div>
    </div>
  </div>
);

const Footer: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-right text-[8.5px] text-slate-400 mt-2 font-mono">{text}</div>
);

interface HedonicQrInfo {
  url: string;
  token: string;
  daysOpen: number;
}

export const SuratJalanBastSheetCompact: React.FC<
  SheetProps & { docNo: string; deliveryTime?: string; classes: DeliveryClassRow[]; hedonic?: HedonicQrInfo }
> = ({
  school,
  longDate,
  totalPortions,
  officers,
  kop,
  footer,
  docNo,
  deliveryTime,
  classes,
  hedonic,
}) => {
  const total = totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : '';
  return (
    <div className={SHEET}>
      {kop}
      <div className="text-center mt-3 mb-3">
        <h2 className="text-[13.5px] font-bold uppercase underline underline-offset-4">Surat Jalan dan Berita Acara Serah Terima</h2>
        <p className="mt-0.5 text-[11px] text-slate-700">Makan Bergizi Gratis (MBG) · SPPG Malang Tumpang Jeru</p>
        <p className="mt-0.5 text-[10.5px]">
          Nomor: <span className="font-semibold">{docNo}</span>
        </p>
      </div>

      <table className="w-full border-collapse border border-slate-700 mb-3">
        <tbody>
          <tr>
            <td className={`${CELL} ${LABEL} w-24`}>Kepada</td>
            <td className={`${CELL} font-semibold`}>{school.schoolName}</td>
            <td className={`${CELL} ${LABEL} w-24`}>Hari, tanggal</td>
            <td className={`${CELL} font-semibold`}>{longDate}</td>
          </tr>
          <tr>
            <td className={`${CELL} ${LABEL}`}>Driver</td>
            <td className={`${CELL} font-semibold`}>{officers.driverName || <Dots w="w-36" />}</td>
            <td className={`${CELL} ${LABEL}`}>Waktu kirim</td>
            <td className={`${CELL} font-semibold`}>
              {deliveryTime ? `${deliveryTime.replace(/\s*WIB\s*$/i, '')} WIB` : <><Dots w="w-14" /> WIB</>}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-slate-700 mb-3">
        <thead className="bg-slate-100">
          <tr className="text-center font-semibold">
            <th rowSpan={2} className={`${CELL} w-8`}>No</th>
            <th rowSpan={2} className={CELL}>Kelas / Kelompok</th>
            <th rowSpan={2} className={`${CELL} w-20`}>Jumlah porsi</th>
            <th colSpan={2} className={CELL}>Jumlah alat makan</th>
            <th rowSpan={2} className={`${CELL} w-32`}>Keterangan</th>
          </tr>
          <tr className="text-center font-semibold">
            <th className={`${CELL} w-20`}>Saat dikirim</th>
            <th className={`${CELL} w-20`}>Saat kembali</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => (
            <tr key={`${c.className}-${i}`} className="h-7">
              <td className={`${CELL} text-center`}>{i + 1}</td>
              <td className={CELL}>{c.className}</td>
              <td className={`${CELL} text-center`}>{c.portions !== undefined ? c.portions.toLocaleString('id-ID') : ''}</td>
              <td className={CELL}></td>
              <td className={CELL}></td>
              <td className={CELL}></td>
            </tr>
          ))}
          <tr className="h-7 font-bold bg-slate-50">
            <td colSpan={2} className={`${CELL} text-right`}>Total</td>
            <td className={`${CELL} text-center`}>{total}</td>
            <td className={CELL}></td>
            <td className={CELL}></td>
            <td className={CELL}></td>
          </tr>
        </tbody>
      </table>

      <div className="border-2 border-red-600 text-red-700 font-bold text-center py-1 mb-3">
        Makanan baik dikonsumsi sebelum pukul {officers.consumeBefore || '11:00'} WIB
      </div>

      {/* Serah terima: saat makanan diantar dan saat alat makan dijemput */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <HandoverBox
          title="I. Paket makanan (saat diantar)"
          from={<Sign role="Driver" name={officers.driverName} />}
          to={<Sign role="PIC sekolah" />}
        >
          <p>
            Telah diterima <b>{total || <Dots w="w-12" />} paket</b> makanan dalam keadaan baik dan layak dikonsumsi, pukul{' '}
            <Dots w="w-12" /> WIB.
          </p>
          <p>
            <span className={LABEL}>PIC sekolah:</span> <Dots w="w-32" />
          </p>
          <p>
            <span className={LABEL}>No. telepon:</span> <Dots w="w-32" value={school.phone} />
          </p>
        </HandoverBox>
        <HandoverBox
          title="II. Alat makan (saat dijemput)"
          from={<Sign role="PIC sekolah" />}
          to={<Sign role="Driver" name={officers.driverName} />}
        >
          <p>
            Telah dikembalikan <Dots w="w-12" /> dari <b>{total || <Dots w="w-12" />} set</b> alat makan yang dikirim, pukul{' '}
            <Dots w="w-12" /> WIB.
          </p>
          <p className="flex flex-wrap gap-x-3">
            <span className={LABEL}>Kondisi:</span>
            <span>☐ Lengkap</span>
            <span>☐ Kurang <Dots w="w-8" /> set</span>
            <span>☐ Rusak <Dots w="w-8" /> set</span>
          </p>
        </HandoverBox>
      </div>

      <div className={`grid ${hedonic ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
        <div>
          <div className={`${LABEL} text-center`}>Diperiksa oleh,</div>
          <Sign role="Ahli Gizi SPPG" name={officers.nutritionistName} />
        </div>
        <div>
          <div className={`${LABEL} text-center`}>Diperiksa oleh,</div>
          <Sign role="Asisten Lapangan" name={officers.fieldAssistantName} />
        </div>
        <div>
          <div className={`${LABEL} text-center`}>Mengetahui,</div>
          <Sign role="Kepala SPPG" name={officers.headName} signature={officers.headSignature} />
        </div>
        {hedonic && (
          <div className="border border-slate-700 p-1.5 flex gap-1.5 items-start">
            <QrSvg value={hedonic.url} className="w-[22mm] h-[22mm] shrink-0" />
            <div className="text-[9.5px] leading-tight">
              <div className="font-bold">Uji hedonik</div>
              <div>Pindai untuk menilai menu dan menulis kritik/saran.</div>
              <div className="mt-0.5 text-slate-600">Dibuka sampai H+{hedonic.daysOpen}</div>
              <div className="font-mono text-[8.5px] text-slate-600">{hedonic.token}</div>
            </div>
          </div>
        )}
      </div>
      <Footer text={footer} />
    </div>
  );
};
