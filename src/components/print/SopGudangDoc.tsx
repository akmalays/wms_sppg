import React, { useMemo } from 'react';
import { ItemMaster } from '../../types/warehouse';
import { matchItemToRackId } from '../../utils/warehouseRacks';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { warehouseDb } from '../../db/storage';
import { SopPlace, SopDefinition, SOPS, APD_BY_SECTION } from './sopGudangContent';

export { SOP_PLACE_OPTIONS } from './sopGudangContent';
export type { SopPlace } from './sopGudangContent';

// SOP penanganan bahan, satu dokumen per tempat simpan agar bisa ditempel di lokasinya.
// Isi tiap rak/unit diambil dari Master Barang dengan aturan rak yang sama seperti Plakat Rak.

interface SopGudangDocProps {
  items: ItemMaster[];
  place: SopPlace | 'ALL';
  effectiveDate: string; // sudah diformat
  printedDate: string; // sudah diformat
  printedBy: string;
}

// Nama diambil dari data Karyawan (lengkap dengan gelar), sama dengan dokumen cetak lain.
const signers = () => [
  { label: 'Disusun oleh', role: 'Asisten Lapangan', name: warehouseDb.getSignerName('ASLAP') || 'M. Ali Akbar Fathoni, S.Pd.' },
  { label: 'Diperiksa oleh', role: 'Akuntan', name: warehouseDb.getSignerName('AKUNTAN') || 'Alfiana Viransa, S.Tr.Ak.' },
];

const Section: React.FC<{ no: number; title: string; children: React.ReactNode }> = ({ no, title, children }) => (
  <section className="sop-section space-y-1.5">
    <h3 className="text-xs font-bold text-slate-900 border-b border-slate-300 pb-1">
      {no}. {title}
    </h3>
    {children}
  </section>
);

const List: React.FC<{ items: React.ReactNode[]; ordered?: boolean }> = ({ items, ordered }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-0.5 text-[11px] leading-snug text-slate-800`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </Tag>
  );
};

const TH = 'border border-slate-300 p-1.5 text-left';
const TD = 'border border-slate-300 p-1.5';

// Kop di setiap SOP agar tiap lembar bisa ditempel sendiri
const SopHeader: React.FC<{ title: string; printedDate: string; printedBy: string }> = ({ title, printedDate, printedBy }) => (
  <>
    <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <SppgLogo size="lg" variant="color" showText={false} />
        <KopText />
      </div>
      <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
        <div>Dicetak: {printedDate}</div>
        <div>Oleh: {printedBy}</div>
      </div>
    </div>

    <div className="text-center">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Standar Operasional Prosedur</h2>
      <p className="text-sm font-bold text-slate-900">{title}</p>
    </div>
  </>
);

const SopSigners: React.FC = () => (
  <div className="sop-avoid grid grid-cols-2 gap-6 pt-5 text-center text-xs">
    {signers().map(s => (
      <div key={s.name}>
        <p className="text-slate-700">{s.label},</p>
        <p className="text-slate-700">{s.role}</p>
        <div className="h-16" />
        <p className="font-semibold text-slate-900 underline underline-offset-2">{s.name}</p>
      </div>
    ))}
  </div>
);

const SopPage: React.FC<{
  sop: SopDefinition;
  contentsOf: (rackId: string | undefined, fallback: string) => string;
  effectiveDate: string;
  printedDate: string;
  printedBy: string;
  breakAfter: boolean;
}> = ({ sop, contentsOf, effectiveDate, printedDate, printedBy, breakAfter }) => {
  let n = 0;
  return (
    <div className={`space-y-3.5 text-xs ${breakAfter ? 'page-break pb-8 mb-8 border-b border-dashed border-slate-300 print:border-0 print:pb-0 print:mb-0' : ''}`}>
      <SopHeader title={sop.title} printedDate={printedDate} printedBy={printedBy} />

      <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
        <tbody>
          <tr>
            <td className={`${TD} text-slate-600 w-28`}>No. dokumen</td>
            <td className={`${TD} font-semibold`}>{sop.docNo}</td>
            <td className={`${TD} text-slate-600 w-28`}>Tanggal berlaku</td>
            <td className={`${TD} font-semibold`}>{effectiveDate}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tempat</td>
            <td className={TD} colSpan={3}>{sop.location}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Standar</td>
            <td className={`${TD} font-semibold`} colSpan={3}>{sop.standard}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tujuan</td>
            <td className={TD} colSpan={3}>{sop.purpose}</td>
          </tr>
        </tbody>
      </table>

      <Section no={++n} title={sop.layoutTitle}>
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-40`}>Tempat</th>
              <th className={`${TH} w-[38%]`}>Isi</th>
              <th className={TH}>Cara simpan</th>
            </tr>
          </thead>
          <tbody>
            {sop.layout.map(r => (
              <tr key={r.place} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{r.place}</td>
                <td className={`${TD} text-slate-700`}>{contentsOf(r.rackId, r.fallback)}</td>
                <td className={`${TD} text-slate-800`}>{r.rules}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Tidak boleh disimpan di sini">
        <List items={sop.notAllowed} />
      </Section>

      {sop.steps.map(step => (
        <Section key={step.title} no={++n} title={step.title}>
          <List items={step.items} ordered />
        </Section>
      ))}

      <Section no={++n} title="Pemeriksaan & kebersihan rutin">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <tbody>
            {sop.routine.map(r => (
              <tr key={r.when} className="align-top">
                <td className={`${TD} font-semibold text-slate-900 w-36`}>{r.when}</td>
                <td className={`${TD} text-slate-800`}>{r.tasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Bila terjadi masalah">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-[35%]`}>Masalah</th>
              <th className={TH}>Yang harus dilakukan</th>
            </tr>
          </thead>
          <tbody>
            {sop.problems.map(p => (
              <tr key={p.issue} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{p.issue}</td>
                <td className={`${TD} text-slate-800`}>{p.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Batas simpan & tanda harus dibuang">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={TH}>Bahan</th>
              <th className={TH}>Batas simpan</th>
              <th className={TH}>Buang bila</th>
            </tr>
          </thead>
          <tbody>
            {sop.shelfLife.map(r => (
              <tr key={r.item} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{r.item}</td>
                <td className={`${TD} text-slate-800`}>{r.limit}</td>
                <td className={`${TD} text-slate-800`}>{r.discard}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-600">
          {sop.shelfLife.some(r => r.limit.includes('*'))
            ? '* Atau sampai tanggal kedaluwarsa kemasan bila lebih cepat. '
            : ''}
          Bahan yang dibuang dicatat di Rekap Limbah.
        </p>
      </Section>

      <SopSigners />
    </div>
  );
};

// SOP pemakaian APD: untuk semua petugas dapur, ditempel di pintu masuk dapur dan wastafel cuci tangan.

const APD_CHANGE: { what: string; when: string }[] = [
  { what: 'Sarung tangan plastik', when: 'Setelah memegang bahan mentah (ayam, telur), sampah, uang, HP, wajah, atau rambut; bila sobek; setiap ganti tugas; dan setelah istirahat.' },
  { what: 'Masker', when: 'Bila basah atau kotor, setelah 4 jam dipakai, dan setelah istirahat makan.' },
  { what: 'Penutup kepala', when: 'Bila kotor atau sobek. Yang sekali pakai diganti setiap hari kerja.' },
  { what: 'Celemek', when: 'Bila kotor atau basah. Celemek kain dicuci setiap hari.' },
];

const ApdSopPage: React.FC<{
  effectiveDate: string;
  printedDate: string;
  printedBy: string;
  breakAfter: boolean;
}> = ({ effectiveDate, printedDate, printedBy, breakAfter }) => {
  let n = 0;
  return (
    <div className={`space-y-3.5 text-xs ${breakAfter ? 'page-break pb-8 mb-8 border-b border-dashed border-slate-300 print:border-0 print:pb-0 print:mb-0' : ''}`}>
      <SopHeader title="Pemakaian Alat Pelindung Diri (APD) di Dapur" printedDate={printedDate} printedBy={printedBy} />

      <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
        <tbody>
          <tr>
            <td className={`${TD} text-slate-600 w-28`}>No. dokumen</td>
            <td className={`${TD} font-semibold`}>SOP/DPR/01</td>
            <td className={`${TD} text-slate-600 w-28`}>Tanggal berlaku</td>
            <td className={`${TD} font-semibold`}>{effectiveDate}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Berlaku untuk</td>
            <td className={TD} colSpan={3}>Semua petugas yang masuk area dapur: persiapan, pengolahan, pemorsian, cuci ompreng, staf, dan tamu</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tempat tempel</td>
            <td className={TD} colSpan={3}>Pintu masuk dapur dan dekat wastafel cuci tangan</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tujuan</td>
            <td className={TD} colSpan={3}>Mencegah makanan tercemar rambut, keringat, ludah, atau kotoran dari tangan petugas.</td>
          </tr>
        </tbody>
      </table>

      <Section no={++n} title="APD wajib per bagian">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-32`}>Bagian</th>
              <th className={`${TH} w-[38%]`}>APD wajib</th>
              <th className={TH}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {APD_BY_SECTION.map(r => (
              <tr key={r.section} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{r.section}</td>
                <td className={`${TD} text-slate-800`}>{r.apd}</td>
                <td className={`${TD} text-slate-700`}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Sebelum memakai APD">
        <List
          items={[
            'Badan sehat. Petugas yang diare, demam, muntah, atau batuk pilek tidak boleh menangani makanan dan wajib lapor ke pengawas.',
            'Luka di tangan ditutup plester tahan air, lalu pakai sarung tangan.',
            'Kuku pendek dan bersih, tanpa kuteks atau kuku palsu.',
            'Lepas cincin, gelang, dan jam tangan. Rambut panjang diikat.',
            'HP, dompet, dan barang pribadi disimpan di loker, tidak dibawa ke area dapur.',
          ]}
        />
      </Section>

      <Section no={++n} title="Urutan memakai APD">
        <List
          ordered
          items={[
            <>Cuci tangan dengan sabun dan air mengalir minimal <b>20 detik</b>.</>,
            'Pakai penutup kepala sampai seluruh rambut tertutup. Bagi yang berhijab, ujung hijab dimasukkan ke dalam celemek.',
            'Pakai masker sampai menutup hidung dan mulut.',
            'Pakai celemek dan ikat talinya.',
            'Cuci tangan sekali lagi.',
            'Pakai sarung tangan sesaat sebelum mulai kerja.',
          ]}
        />
      </Section>

      <Section no={++n} title="Kapan APD harus diganti">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <tbody>
            {APD_CHANGE.map(r => (
              <tr key={r.what} className="align-top">
                <td className={`${TD} font-semibold text-slate-900 w-36`}>{r.what}</td>
                <td className={`${TD} text-slate-800`}>{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Tidak boleh">
        <List
          items={[
            'Keluar dapur (ke toilet, halaman, atau lobi) masih memakai APD.',
            'Menurunkan masker ke dagu atau membiarkan hidung terbuka.',
            'Memakai ulang masker atau sarung tangan sekali pakai.',
            'Memakai sarung tangan sebagai pengganti cuci tangan.',
            'Makan, minum, merokok, atau memainkan HP di area pengolahan dan pemorsian.',
          ]}
        />
      </Section>

      <Section no={++n} title="Urutan melepas & membuang APD">
        <List
          ordered
          items={[
            'Lepas sarung tangan dengan membalik bagian dalamnya ke luar.',
            'Lepas celemek. Celemek kain ditaruh di keranjang cucian.',
            'Lepas masker dengan memegang talinya saja, jangan bagian depannya.',
            'Lepas penutup kepala.',
            'Buang APD sekali pakai ke tempat sampah tertutup.',
            'Cuci tangan dengan sabun.',
          ]}
        />
      </Section>

      <Section no={++n} title="Bila terjadi masalah">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-[35%]`}>Masalah</th>
              <th className={TH}>Yang harus dilakukan</th>
            </tr>
          </thead>
          <tbody>
            {[
              { issue: 'Sarung tangan sobek saat bekerja', action: 'Berhenti, ganti sarung tangan, lalu periksa makanan yang tersentuh. Buang makanan bila ada sobekan sarung tangan di dalamnya.' },
              { issue: 'Tangan terluka saat bekerja', action: 'Berhenti, cuci luka, tutup dengan plester tahan air, pakai sarung tangan baru, dan lapor ke pengawas.' },
              { issue: 'Rambut atau benda asing ditemukan di makanan', action: 'Buang porsi itu, lapor ke pengawas, dan periksa penutup kepala semua petugas di bagian itu.' },
              { issue: 'Stok APD di dapur habis', action: 'Ambil di Gudang Non-Food Rak N3 dan catat pengambilannya. Bila stok gudang juga menipis, lapor ke Asisten Lapangan.' },
            ].map(p => (
              <tr key={p.issue} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{p.issue}</td>
                <td className={`${TD} text-slate-800`}>{p.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Pengawasan">
        <List
          items={[
            'Kepala bagian memeriksa APD setiap petugas sebelum mulai kerja.',
            'Petugas yang APD-nya tidak lengkap belum boleh mulai bekerja sampai APD-nya dilengkapi.',
          ]}
        />
      </Section>

      <SopSigners />
    </div>
  );
};

export const SopGudangDoc: React.FC<SopGudangDocProps> = ({ items, place, effectiveDate, printedDate, printedBy }) => {
  // Nama barang per rak/unit dari Master Barang (maks. 8 nama agar ringkas)
  const namesByRack = useMemo(() => {
    const map: Record<string, string[]> = {};
    items
      .filter(i => i.isActive)
      .forEach(i => {
        const rackId = matchItemToRackId(i.location, i.category, i.name, i.id);
        if (rackId) (map[rackId] = map[rackId] || []).push(i.name);
      });
    return map;
  }, [items]);

  const contentsOf = (rackId: string | undefined, fallback: string) => {
    const names = rackId ? [...(namesByRack[rackId] || [])].sort((a, b) => a.localeCompare(b)) : [];
    if (names.length === 0) return fallback;
    const shown = names.slice(0, 8).join(', ');
    return names.length > 8 ? `${shown}, dan ${names.length - 8} barang lain` : shown;
  };

  const places: SopPlace[] = place === 'ALL' ? ['DRY', 'NONFOOD', 'CHILLER', 'FREEZER', 'LEFTOVER', 'CRATE', 'APD'] : [place];

  return (
    <>
      {places.map((p, i) =>
        p === 'APD' ? (
          <ApdSopPage
            key={p}
            effectiveDate={effectiveDate}
            printedDate={printedDate}
            printedBy={printedBy}
            breakAfter={i < places.length - 1}
          />
        ) : (
          <SopPage
            key={p}
            sop={SOPS[p]}
            contentsOf={contentsOf}
            effectiveDate={effectiveDate}
            printedDate={printedDate}
            printedBy={printedBy}
            breakAfter={i < places.length - 1}
          />
        ),
      )}
    </>
  );
};
