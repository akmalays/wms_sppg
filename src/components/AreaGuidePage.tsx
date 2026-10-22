import React, { useEffect } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import { SOPS, AREA_GUIDE_PATH, AREA_GUIDE_SLUGS, GuidePlace, areaGuidePlaceFromPath } from './print/sopGudangContent';

// Halaman Panduan Area (/panduan/<area>): dibuka dari QR papan nama rak, tanpa login.
// Isinya SOP Gudang versi layar HP, jadi tidak memuat data gudang, stok, atau harga.

const PLACE_ORDER: GuidePlace[] = ['DRY', 'NONFOOD', 'CHILLER', 'FREEZER', 'LEFTOVER', 'CRATE'];
const PLACE_NAME: Record<GuidePlace, string> = {
  DRY: 'Gudang Kering',
  NONFOOD: 'Non-Food',
  CHILLER: 'Chiller',
  FREEZER: 'Freezer',
  LEFTOVER: 'Palet Sisa',
  CRATE: 'Area Krat',
};
const isCold = (p: GuidePlace) => p === 'CHILLER' || p === 'FREEZER';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2.5">
    <h2 className="text-base font-bold text-slate-900">{title}</h2>
    {children}
  </section>
);

const Card: React.FC<{ children: React.ReactNode; tone?: 'plain' | 'rose' }> = ({ children, tone = 'plain' }) => (
  <div className={`rounded-xl border p-3.5 text-sm leading-relaxed ${tone === 'rose' ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-white border-slate-200 text-slate-800'}`}>
    {children}
  </div>
);

const AreaNav: React.FC<{ current?: GuidePlace }> = ({ current }) => (
  <nav aria-label="Panduan area lain" className="flex flex-wrap gap-2">
    {PLACE_ORDER.map(p => (
      <a
        key={p}
        href={`${AREA_GUIDE_PATH}${AREA_GUIDE_SLUGS[p]}`}
        aria-current={p === current ? 'page' : undefined}
        className={`inline-flex items-center px-3 min-h-[44px] rounded-lg border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
          p === current ? 'bg-emerald-800 border-emerald-800 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
        }`}
      >
        {PLACE_NAME[p]}
      </a>
    ))}
  </nav>
);

const AreaGuidePage: React.FC = () => {
  const place = areaGuidePlaceFromPath(window.location.pathname) ?? null;
  const sop = place ? SOPS[place] : null;

  useEffect(() => {
    document.title = sop ? `Panduan ${PLACE_NAME[place!]} · SPPG Tumpang Jeru` : 'Panduan Area Gudang · SPPG Tumpang Jeru';
  }, [sop, place]);

  const band = place && isCold(place) ? 'bg-sky-700' : 'bg-emerald-800';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className={`${band} text-white`}>
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
          <div className="flex items-center gap-2.5 text-sm font-medium opacity-90">
            <img src={logoSppgImg} alt="" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" />
            <span>SPPG Tumpang Jeru · Panduan Area</span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{sop ? sop.title : 'Pilih area gudang'}</h1>
          {sop && <p className="text-sm opacity-90">{sop.location}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {!sop ? (
          <>
            <p className="text-sm text-slate-700">Panduan cara menyimpan dan mengambil barang di setiap area gudang.</p>
            <AreaNav />
          </>
        ) : (
          <>
            <div className={`rounded-xl border p-3.5 ${isCold(place!) ? 'bg-sky-50 border-sky-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-xs font-semibold text-slate-600">Standar area ini</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{sop.standard}</p>
              <p className="text-sm text-slate-700 mt-1.5">{sop.purpose}</p>
            </div>

            <Section title={sop.layoutTitle}>
              <div className="space-y-2">
                {sop.layout.map(r => (
                  <Card key={r.place}>
                    <p className="font-bold text-slate-900">{r.place}</p>
                    <p className="text-slate-600 mt-0.5">{r.fallback}</p>
                    <p className="mt-1.5">{r.rules}</p>
                  </Card>
                ))}
              </div>
            </Section>

            <Section title="Tidak boleh disimpan di sini">
              <Card tone="rose">
                <ul className="list-disc pl-5 space-y-1">
                  {sop.notAllowed.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </Card>
            </Section>

            {sop.steps.map(step => (
              <Section key={step.title} title={step.title}>
                <Card>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    {step.items.map((it, i) => <li key={i}>{it}</li>)}
                  </ol>
                </Card>
              </Section>
            ))}

            <Section title="Bila terjadi masalah">
              <div className="space-y-2">
                {sop.problems.map(p => (
                  <Card key={p.issue}>
                    <p className="font-bold text-slate-900">{p.issue}</p>
                    <p className="mt-0.5">{p.action}</p>
                  </Card>
                ))}
              </div>
            </Section>

            <Section title="Pemeriksaan & kebersihan rutin">
              <Card>
                <dl className="space-y-2">
                  {sop.routine.map(r => (
                    <div key={r.when}>
                      <dt className="font-bold text-slate-900">{r.when}</dt>
                      <dd>{r.tasks}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Section>

            <Section title="Batas simpan & tanda harus dibuang">
              <div className="space-y-2">
                {sop.shelfLife.map(r => (
                  <Card key={r.item}>
                    <p className="font-bold text-slate-900">{r.item}</p>
                    <p className="mt-0.5"><span className="text-slate-600">Batas simpan:</span> {r.limit}</p>
                    <p><span className="text-slate-600">Buang bila:</span> {r.discard}</p>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                {sop.shelfLife.some(r => r.limit.includes('*')) ? '* Atau sampai tanggal kedaluwarsa kemasan bila lebih cepat. ' : ''}
                Bahan yang dibuang dicatat di Rekap Limbah.
              </p>
            </Section>

            <div className="pt-2 border-t border-slate-300 space-y-3">
              <p className="text-xs text-slate-600">
                Ringkasan dari {sop.docNo}. Daftar barang per rak ada di plakat rak; pindai QR di plakat untuk melihat isi rak terbaru.
              </p>
              <p className="text-sm font-semibold text-slate-800">Panduan area lain</p>
              <AreaNav current={place!} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AreaGuidePage;
