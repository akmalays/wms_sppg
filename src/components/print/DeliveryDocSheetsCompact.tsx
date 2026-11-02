import React from 'react';
import { DeliveryClassRow, SheetProps } from './DeliveryDocSheets';
import { QrSvg } from '../common/QrSvg';

// Format ringkas dokumen pengiriman: 2 halaman per sekolah (cukup 1 kertas bila dicetak bolak-balik).
// Halaman 1 menggabungkan Surat Jalan dan Berita Acara Serah Terima: keduanya ditandatangani driver dan PIC
// sekolah untuk kiriman yang sama, jadi tabel kelas, jumlah porsi, dan tanda tangan cukup ditulis sekali.
// Halaman 2 memakai Uji Hedonik format standar apa adanya; bila uji hedonik lewat QR, QR-nya dicetak di halaman 1
// dan halaman 2 tidak perlu dicetak. Format standar dan lama tidak diubah.

// Satu lembar setinggi A4 (padding cetak 8mm/10mm sudah termasuk, sisa 2mm agar tidak tumpah ke halaman berikutnya).
// Ruang lebih diserap kotak serah terima, jadi ruang tanda tangan basah ikut lega.
const SHEET =
  'bg-white p-7 shadow-md rounded-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print-page-break text-slate-900 font-sans text-[11px] leading-snug flex flex-col print:min-h-[295mm]';
const CELL_BORDER = 'border border-slate-700 px-2';
const CELL = `${CELL_BORDER} py-1`;
const LABEL = 'text-slate-600';
// Ruang tanda tangan basah di kotak serah terima: memanjang mengisi kotak, nama tetap di bawah.
const HANDOVER_SIGN = 'flex-1 min-h-12';
// Tanda tangan petugas (gambar) di baris bawah dibuat besar agar goresan tipis tetap jelas.
const OFFICER_SIGN = 'h-24';

const Dots: React.FC<{ w?: string; value?: string }> = ({ w = 'w-28', value }) => (
  <span className={`inline-block ${w} border-b border-dotted border-slate-700 align-bottom px-1 font-semibold`}>{value || ' '}</span>
);

const Sign: React.FC<{ role: string; name?: string; signature?: string; height?: string }> = ({ role, name, signature, height = 'h-16' }) => {
  return (
    <div className="text-center flex flex-col flex-1">
      <div className="font-semibold leading-tight text-[10.5px]">{role}</div>
      <div className={`${height} flex items-center justify-center`}>
        {signature && <img src={signature} alt={`Tanda tangan ${role}`} className="max-h-full h-full w-auto object-contain" />}
      </div>
      <div className="font-semibold underline underline-offset-2 min-h-[1.2em] text-[10.5px] leading-tight">{name || '(..............................)'}</div>
    </div>
  );
};

const HandoverBox: React.FC<{ title: string; children: React.ReactNode; from: React.ReactNode; to: React.ReactNode }> = ({
  title,
  children,
  from,
  to,
}) => (
  <div className="border border-slate-700 flex flex-col">
    <div className="bg-slate-100 border-b border-slate-700 px-2 py-1 font-semibold">{title}</div>
    <div className="px-2 py-1.5 space-y-1.5">{children}</div>
    {/* Ruang tanda tangan basah memanjang mengikuti sisa halaman */}
    <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-2 flex-1">
      <div className="flex flex-col">
        <div className={`${LABEL} text-center text-[10px]`}>Yang menyerahkan,</div>
        {from}
      </div>
      <div className="flex flex-col">
        <div className={`${LABEL} text-center text-[10px]`}>Yang menerima,</div>
        {to}
      </div>
    </div>
  </div>
);

const Footer: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-right text-[8.5px] text-slate-400 mt-2 font-mono">{text}</div>
);

// Uji hedonik diisi sekolah di portal SIPGN BGN, QR cukup mengarah ke halaman loginnya
const SIPGN_LOGIN_URL = 'https://pm-sipgn.bgn.go.id/auth/login';

export const SuratJalanBastSheetCompact: React.FC<
  SheetProps & { docNo: string; deliveryTime?: string; classes: DeliveryClassRow[]; hedonicQr?: boolean }
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
  hedonicQr,
}) => {
  const total = totalPortions > 0 ? totalPortions.toLocaleString('id-ID') : '';
  // Tinggi baris kelas dibagi dari ruang 72mm (sisa halaman setelah bagian lain): SD (9 baris) sekitar 8mm,
  // PAUD/SMP lebih tinggi, maksimal 14mm. Lebih dari 12 baris memakai teks lebih kecil agar tetap satu halaman.
  const rowCount = classes.length + 1;
  const dense = rowCount > 12;
  const rowHeight = dense ? undefined : `${Math.min(14, 72 / rowCount).toFixed(1)}mm`;
  const rowCell = dense ? `${CELL_BORDER} py-0.5 text-[10px]` : CELL;
  // Lembar padat: jarak antarbagian dan ruang tanda tangan basah dirapatkan
  const gap = dense ? 'mb-2' : 'mb-4';
  const handoverSign = dense ? 'flex-1 min-h-8' : HANDOVER_SIGN;
  return (
    <div className={SHEET}>
      {kop}
      <div className={`text-center ${dense ? 'mt-2' : 'mt-4'} ${gap}`}>
        <h2 className="text-[14px] font-bold uppercase underline underline-offset-4">Surat Jalan dan Berita Acara Serah Terima</h2>
        <p className="mt-1 text-[11px] text-slate-700">Makan Bergizi Gratis (MBG) · SPPG Malang Tumpang Jeru</p>
        <p className="mt-0.5 text-[11px]">
          Nomor: <span className="font-semibold">{docNo}</span>
        </p>
      </div>

      <table className={`w-full border-collapse border border-slate-700 ${gap}`}>
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

      <table className={`w-full border-collapse border border-slate-700 ${gap}`}>
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
            <tr key={`${c.className}-${i}`} style={{ height: rowHeight }}>
              <td className={`${rowCell} text-center`}>{i + 1}</td>
              <td className={rowCell}>{c.className}</td>
              <td className={`${rowCell} text-center`}>{c.portions !== undefined ? c.portions.toLocaleString('id-ID') : ''}</td>
              <td className={rowCell}></td>
              <td className={rowCell}></td>
              <td className={rowCell}></td>
            </tr>
          ))}
          <tr className="font-bold bg-slate-50" style={{ height: rowHeight }}>
            <td colSpan={2} className={`${rowCell} text-right`}>Total</td>
            <td className={`${rowCell} text-center`}>{total}</td>
            <td className={rowCell}></td>
            <td className={rowCell}></td>
            <td className={rowCell}></td>
          </tr>
        </tbody>
      </table>

      <div className={`border-2 border-red-600 text-red-700 font-bold text-center py-1.5 ${gap} text-xs`}>
        Makanan baik dikonsumsi sebelum pukul {officers.consumeBefore || '11:00'} WIB
      </div>

      {/* Serah terima: saat makanan diantar dan saat alat makan dijemput */}
      <div className={`grid grid-cols-2 gap-3 flex-1 ${dense ? '' : 'min-h-[52mm]'}`}>
        <HandoverBox
          title="I. Paket makanan (saat diantar)"
          from={<Sign role="Driver" name={officers.driverName} height={handoverSign} />}
          to={<Sign role="PIC sekolah" height={handoverSign} />}
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
          from={<Sign role="PIC sekolah" height={handoverSign} />}
          to={<Sign role="Driver" name={officers.driverName} height={handoverSign} />}
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

      {/* Jarak dari kotak serah terima supaya baris Diperiksa/Mengetahui dan QR tidak menempel */}
      <div className={`grid ${hedonicQr ? 'grid-cols-4' : 'grid-cols-3'} gap-4 ${dense ? 'mt-3' : 'mt-6'} items-start`}>
        <div>
          <div className={`${LABEL} text-center`}>Diperiksa oleh,</div>
          <Sign role="Ahli Gizi SPPG Malang Tumpang Jeru" name={officers.nutritionistName} signature={officers.nutritionistSignature} height={OFFICER_SIGN} />
        </div>
        <div>
          <div className={`${LABEL} text-center`}>Diperiksa oleh,</div>
          <Sign role="Asisten Lapangan SPPG Malang Tumpang Jeru" name={officers.fieldAssistantName} signature={officers.fieldAssistantSignature} height={OFFICER_SIGN} />
        </div>
        <div>
          <div className={`${LABEL} text-center`}>Mengetahui,</div>
          <Sign role="Kepala SPPG Malang Tumpang Jeru" name={officers.headName} signature={officers.headSignature} height={OFFICER_SIGN} />
        </div>
        {hedonicQr && (
          <div className="border border-slate-700 p-2 flex gap-2 items-start h-fit self-start">
            <QrSvg value={SIPGN_LOGIN_URL} className="w-[22mm] h-[22mm] shrink-0" />
            <div className="min-w-0 text-[9.5px] leading-tight">
              <div className="font-bold">Uji hedonik</div>
              <div>Pindai untuk membuka SIPGN BGN, lalu isi uji hedonik menu hari ini.</div>
              {/* Alamat tertulis untuk yang tidak bisa memindai QR */}
              <div className="mt-0.5 font-mono text-[8.5px] text-slate-600 break-all">pm-sipgn.bgn.go.id</div>
            </div>
          </div>
        )}
      </div>
      <Footer text={footer} />
    </div>
  );
};
