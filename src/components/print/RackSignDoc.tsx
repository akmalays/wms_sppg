import React, { useEffect, useMemo, useState } from 'react';
import { Edit3 } from 'lucide-react';
import type { WarehouseRack } from '../ToolsPrintModule';
import { ItemMaster } from '../../types/warehouse';
import { matchItemToRackId } from '../../utils/warehouseRacks';
import { isMedicineItem } from '../../utils/categoryStandards';
import { GuidePlace, buildAreaGuideUrl, SOPS } from './sopGudangContent';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { QrSvg } from '../common/QrSvg';
import { Select } from '../common/Select';
import { FormDialog, FIELD_INPUT, FIELD_LABEL, BTN_SECONDARY } from '../common/FormDialog';

// Papan nama besar untuk dibaca dari jauh, pasangan plakat rak (yang berisi daftar barang dan dibaca dari dekat).
// Isinya diambil otomatis dari rak dan Master Barang; teks yang diubah disimpan di app_settings.
const SETTING_SIGN_OVERRIDES = 'print_sign_overrides';

type SignSource = 'RACK' | 'CATEGORY' | 'ALL';
type SignSize = 'A4' | 'A5';

interface SignText {
  title: string;
  subtitle: string;
  footer: string;
}

interface Sign extends SignText {
  key: string;
  kind: 'RACK' | 'CATEGORY';
  area: string;
  code: string;
  cold: boolean;
  medical: boolean;
  qrValue?: string;
}

const isColdRack = (rack: WarehouseRack) =>
  /freezer|chiller/i.test(`${rack.id} ${rack.name} ${rack.zone}`) || rack.id.startsWith('BIN-FRZ') || rack.id.startsWith('BIN-CHL');

// "Rak N4 - Non-Food: P3K & Obat-obatan" -> judul "Rak N4", keterangan "P3K & Obat-obatan"
function splitRackName(name: string): { title: string; subtitle: string } {
  const idx = name.indexOf(' - ');
  if (idx < 0) return { title: name.replace(/^Rak \/ Area:\s*/i, ''), subtitle: '' };
  return { title: name.slice(0, idx).trim(), subtitle: name.slice(idx + 3).replace(/^Non-Food:\s*/i, '').trim() };
}

// QR papan nama membuka Panduan Area (SOP versi HP, tanpa login) sesuai tempat raknya.
// QR di plakat rak tetap untuk info rak dan daftar barang.
function guidePlaceFor(rack: { id: string; name: string; zone?: string }): GuidePlace {
  const text = `${rack.id} ${rack.name} ${rack.zone || ''}`;
  if (/sisa/i.test(text)) return 'LEFTOVER';
  if (/freezer/i.test(text) || rack.id.startsWith('BIN-FRZ')) return 'FREEZER';
  if (/chiller/i.test(text) || rack.id.startsWith('BIN-CHL')) return 'CHILLER';
  if (/krat|retur/i.test(text)) return 'CRATE';
  if (/-N\d/.test(rack.id) || /non-food/i.test(text)) return 'NONFOOD';
  return 'DRY';
}

// Ukuran huruf mengikuti lebar papan (cqw) dan panjang teks, supaya judul pendek tampil sebesar mungkin
// dan judul panjang tetap muat.
const titleSize = (text: string) => {
  const n = text.length;
  if (n <= 7) return 17;
  if (n <= 11) return 13;
  if (n <= 16) return 10;
  if (n <= 24) return 7.5;
  return 6;
};
const subtitleSize = (text: string) => {
  const n = text.length;
  if (n <= 24) return 6;
  if (n <= 40) return 4.6;
  if (n <= 70) return 3.6;
  return 3;
};

const MedicalCross: React.FC = () => (
  <svg viewBox="0 0 24 24" className="shrink-0" style={{ width: '14cqw', height: '14cqw' }} role="img" aria-label="Simbol P3K">
    <rect width="24" height="24" rx="3" fill="#047857" />
    <path d="M9.5 4.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z" fill="#ffffff" />
  </svg>
);

const SignCard: React.FC<{ sign: Sign; size: SignSize; showQr: boolean }> = ({ sign, size, showQr }) => {
  const tone = sign.cold ? 'sky' : 'emerald';
  return (
    <article
      className={`w-full bg-white rounded-md border-4 overflow-hidden flex flex-col aspect-[297/210] print:aspect-auto print:rounded-none ${
        tone === 'sky' ? 'border-sky-700' : 'border-emerald-800'
      } ${size === 'A4' ? 'print:h-[190mm]' : 'print:h-[134mm]'}`}
      style={{ containerType: 'inline-size' }}
    >
      <div
        className={`flex items-center justify-between gap-[2cqw] text-white font-semibold ${tone === 'sky' ? 'bg-sky-700' : 'bg-emerald-800'}`}
        style={{ padding: '1.4cqw 3cqw', fontSize: '2.3cqw' }}
      >
        <span className="truncate">SPPG Tumpang Jeru · {sign.area}</span>
        <span className={`shrink-0 ${sign.kind === 'RACK' ? 'font-mono' : ''}`}>{sign.code}</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center" style={{ padding: '0 4cqw', gap: '1.6cqw' }}>
        <div className="flex items-center" style={{ gap: '3cqw' }}>
          {sign.medical && <MedicalCross />}
          <h2 className="font-black text-slate-950 tracking-tight break-words min-w-0" style={{ fontSize: `${titleSize(sign.title)}cqw`, lineHeight: 0.98 }}>
            {sign.title}
          </h2>
        </div>
        {sign.subtitle && (
          <p className="font-bold text-slate-800 leading-tight break-words" style={{ fontSize: `${subtitleSize(sign.subtitle)}cqw` }}>
            {sign.subtitle}
          </p>
        )}
      </div>

      <div className="flex items-end justify-between text-slate-700" style={{ padding: '0 3cqw 2.4cqw 4cqw', gap: '3cqw', fontSize: '2.5cqw' }}>
        <span className="font-medium leading-snug">{sign.footer}</span>
        {showQr && sign.qrValue && (
          <div className="shrink-0 flex flex-col items-center" style={{ gap: '0.6cqw' }}>
            <div style={{ width: '15cqw', height: '15cqw' }}>
              <QrSvg value={sign.qrValue} className="block w-full h-full" />
            </div>
            <span className="font-semibold text-slate-800 whitespace-nowrap" style={{ fontSize: '1.9cqw' }}>Pindai: panduan area</span>
          </div>
        )}
      </div>
    </article>
  );
};

interface RackSignDocProps {
  racks: WarehouseRack[];
  items: ItemMaster[];
  customRacks: { id: string; name: string }[];
  onCountChange: (count: number) => void;
}

export const RackSignDoc: React.FC<RackSignDocProps> = ({ racks, items, customRacks, onCountChange }) => {
  const { currentUser } = useAuth();
  const [source, setSource] = useState<SignSource>('RACK');
  const [size, setSize] = useState<SignSize>('A4');
  const [showQr, setShowQr] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<SignText>>>(() =>
    warehouseDb.getAppSetting<Record<string, Partial<SignText>>>(SETTING_SIGN_OVERRIDES, {})
  );
  const [editing, setEditing] = useState<{ sign: Sign; draft: SignText } | null>(null);

  useEffect(() => {
    const reload = () => setOverrides(warehouseDb.getAppSetting<Record<string, Partial<SignText>>>(SETTING_SIGN_OVERRIDES, {}));
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
  }, []);

  const autoSigns = useMemo<Sign[]>(() => {
    const rackById = new Map(racks.map(r => [r.id, r]));

    const rackSigns: Sign[] = racks.map(rack => {
      const { title, subtitle } = splitRackName(rack.name);
      const cold = isColdRack(rack);
      return {
        key: `RACK:${rack.id}`,
        kind: 'RACK',
        area: rack.warehouseName,
        code: rack.id,
        title,
        subtitle,
        footer: cold ? `Suhu ${rack.temperatureGuide.split(' (')[0]}` : rack.zone,
        cold,
        medical: /p3k|obat/i.test(rack.name),
        qrValue: buildAreaGuideUrl(guidePlaceFor(rack)),
      };
    });

    // Area krat bukan rak (tidak ada di plakat rak), jadi papannya diambil dari SOP Krat & Wadah Retur:
    // satu papan area dan satu papan per palet, mis. "Palet A: Krat roti" -> "Palet A" / "Krat roti".
    const crate = SOPS.CRATE;
    const crateGuide = buildAreaGuideUrl('CRATE');
    const areaSigns: Sign[] = [
      {
        key: 'AREA:CRATE',
        kind: 'RACK',
        area: 'Gudang',
        code: 'AREA-KRAT',
        title: 'Area Krat',
        subtitle: 'Krat & Wadah Retur',
        footer: crate.standard,
        cold: false,
        medical: false,
        qrValue: crateGuide,
      },
      ...crate.layout.map(row => {
        const idx = row.place.indexOf(':');
        return {
          key: `AREA:CRATE:${row.place}`,
          kind: 'RACK' as const,
          area: 'Area Krat',
          code: 'AREA-KRAT',
          title: idx < 0 ? row.place : row.place.slice(0, idx).trim(),
          subtitle: idx < 0 ? '' : row.place.slice(idx + 1).trim(),
          footer: row.fallback,
          cold: false,
          medical: false,
          qrValue: crateGuide,
        };
      }),
    ];

    // Kategori: subkategori bila ada (lebih spesifik, mis. "Bumbu Dapur & Rempah"), selain itu kategori barang.
    const groups = new Map<string, ItemMaster[]>();
    items
      .filter(i => i.isActive)
      .forEach(i => {
        const key = (i.subcategory || i.category || '').trim() || 'Lainnya';
        groups.set(key, [...(groups.get(key) || []), i]);
      });

    const categorySigns: Sign[] = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'id'))
      .map(([category, list]) => {
        // Lokasi = rak yang paling banyak menampung barang kategori ini
        const rackCount = new Map<string, { count: number; rack?: WarehouseRack }>();
        list.forEach(i => {
          const id = matchItemToRackId(i.location, i.category, i.name, i.id, customRacks) || '';
          const rack = rackById.get(id);
          const label = rack ? splitRackName(rack.name).title : (i.location || '').trim();
          if (label) rackCount.set(label, { count: (rackCount.get(label)?.count || 0) + 1, rack });
        });
        const [topRack, top] = [...rackCount.entries()].sort((a, b) => b[1].count - a[1].count)[0] || [];
        const examples = list.slice(0, 5).map(i => i.name).join(', ');
        const cold = list.filter(i => /chiller|freezer/i.test(i.location || '')).length > list.length / 2;
        const medical = list.some(i => isMedicineItem(i.category, '')) || /p3k|obat/i.test(category);
        const guidePlace: GuidePlace = top?.rack ? guidePlaceFor(top.rack) : cold ? 'CHILLER' : medical ? 'NONFOOD' : 'DRY';
        return {
          key: `CAT:${category}`,
          kind: 'CATEGORY',
          area: cold ? 'Gudang Basah' : 'Gudang',
          code: 'Kategori barang',
          title: category,
          subtitle: examples ? `${examples}${list.length > 5 ? ', dll.' : ''}` : '',
          footer: topRack ? `Lokasi: ${topRack} · ${list.length} jenis barang` : `${list.length} jenis barang`,
          cold,
          medical,
          qrValue: buildAreaGuideUrl(guidePlace),
        };
      });

    return [...rackSigns, ...areaSigns, ...categorySigns];
  }, [racks, items, customRacks]);

  const signs = useMemo(
    () =>
      autoSigns
        .filter(s => source === 'ALL' || s.kind === source)
        .map(s => ({ ...s, ...overrides[s.key] })),
    [autoSigns, source, overrides]
  );
  const toPrint = signs.filter(s => !excluded.includes(s.key));

  useEffect(() => {
    onCountChange(toPrint.length);
  }, [toPrint.length, onCountChange]);

  const commitOverrides = (next: Record<string, Partial<SignText>>) => {
    setOverrides(next);
    warehouseDb.saveAppSetting(SETTING_SIGN_OVERRIDES, next, currentUser || undefined);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const auto = autoSigns.find(s => s.key === editing.sign.key);
    const changed: Partial<SignText> = {};
    (['title', 'subtitle', 'footer'] as const).forEach(f => {
      if (editing.draft[f] !== auto?.[f]) changed[f] = editing.draft[f];
    });
    const next = { ...overrides };
    if (Object.keys(changed).length) next[editing.sign.key] = changed;
    else delete next[editing.sign.key];
    commitOverrides(next);
    setEditing(null);
  };

  const handleReset = () => {
    if (!editing) return;
    const next = { ...overrides };
    delete next[editing.sign.key];
    commitOverrides(next);
    setEditing(null);
  };

  const pages: Sign[][] = [];
  const perPage = size === 'A4' ? 1 : 2;
  for (let i = 0; i < toPrint.length; i += perPage) pages.push(toPrint.slice(i, i + perPage));

  const allSelected = excluded.length === 0;

  return (
    <div className="space-y-4">
      {size === 'A4' && <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>}
      <style>{'@media print { .sign-page { break-after: page; page-break-after: always; } .sign-page:last-child { break-after: auto; page-break-after: auto; } }'}</style>

      {/* Pengaturan (hanya di layar) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label htmlFor="sign-source" className={FIELD_LABEL}>Papan nama untuk</label>
          <Select id="sign-source" className="w-full" size="sm" value={source} onChange={e => { setSource(e.target.value as SignSource); setExcluded([]); }}>
            <option value="RACK">Rak</option>
            <option value="CATEGORY">Kategori barang</option>
            <option value="ALL">Rak dan kategori barang</option>
          </Select>
        </div>
        <div>
          <label htmlFor="sign-size" className={FIELD_LABEL}>Ukuran</label>
          <Select id="sign-size" className="w-full" size="sm" value={size} onChange={e => setSize(e.target.value as SignSize)}>
            <option value="A4">Besar: 1 papan per A4 mendatar</option>
            <option value="A5">Sedang: 2 papan per A4 (dipotong jadi A5)</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 sm:pt-5 text-slate-700 cursor-pointer">
          <input type="checkbox" checked={showQr} onChange={e => setShowQr(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
          Tampilkan QR panduan area (dibuka tanpa login)
        </label>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-700">
          <span className="font-semibold text-slate-900">{toPrint.length}</span> dari {signs.length} papan nama akan dicetak. Hapus centang untuk melewati.
        </span>
        <button
          type="button"
          onClick={() => setExcluded(allSelected ? signs.map(s => s.key) : [])}
          disabled={signs.length === 0}
          className={BTN_SECONDARY}
        >
          {allSelected ? 'Hapus semua centang' : 'Pilih semua'}
        </button>
      </div>

      {/* Pratinjau di layar */}
      {signs.length === 0 ? (
        <p className="no-print py-12 text-center text-slate-500 text-xs">Belum ada rak atau barang aktif untuk dibuatkan papan nama.</p>
      ) : (
        <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
          {signs.map(sign => {
            const selected = !excluded.includes(sign.key);
            return (
              <div key={sign.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setExcluded(selected ? [...excluded, sign.key] : excluded.filter(k => k !== sign.key))}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">{sign.title}</span>
                    {overrides[sign.key] && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-800 border border-slate-300 shrink-0">Diubah</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing({ sign, draft: { title: sign.title, subtitle: sign.subtitle, footer: sign.footer } })}
                    className={BTN_SECONDARY}
                    aria-label={`Ubah papan nama ${sign.title}`}
                  >
                    <Edit3 className="w-3 h-3" />
                    Ubah
                  </button>
                </div>
                <div className={selected ? '' : 'opacity-40'}>
                  <SignCard sign={sign} size={size} showQr={showQr} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Versi cetak: hanya papan yang dicentang, dikelompokkan per lembar */}
      <div className="hidden print:block">
        {pages.map((page, idx) => (
          <div key={idx} className="sign-page flex flex-col" style={{ gap: '8mm' }}>
            {page.map(sign => (
              <SignCard key={sign.key} sign={sign} size={size} showQr={showQr} />
            ))}
          </div>
        ))}
      </div>

      {editing && (
        <div className="no-print">
          <FormDialog
            title="Ubah papan nama"
            description={editing.sign.kind === 'RACK' ? <span className="font-mono">{editing.sign.code}</span> : 'Kategori barang'}
            onClose={() => setEditing(null)}
            onSubmit={handleSave}
            submitLabel="Simpan papan nama"
            submitDisabled={!editing.draft.title.trim()}
          >
            <div className="space-y-3">
              <div>
                <label htmlFor="sign-title" className={FIELD_LABEL}>Judul besar</label>
                <input
                  id="sign-title"
                  type="text"
                  value={editing.draft.title}
                  onChange={e => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })}
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label htmlFor="sign-subtitle" className={FIELD_LABEL}>Keterangan</label>
                <input
                  id="sign-subtitle"
                  type="text"
                  value={editing.draft.subtitle}
                  onChange={e => setEditing({ ...editing, draft: { ...editing.draft, subtitle: e.target.value } })}
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label htmlFor="sign-footer" className={FIELD_LABEL}>Baris bawah</label>
                <input
                  id="sign-footer"
                  type="text"
                  value={editing.draft.footer}
                  onChange={e => setEditing({ ...editing, draft: { ...editing.draft, footer: e.target.value } })}
                  className={FIELD_INPUT}
                />
              </div>
              {overrides[editing.sign.key] && (
                <button type="button" onClick={handleReset} className={BTN_SECONDARY}>
                  Kembalikan ke isi otomatis
                </button>
              )}
            </div>
          </FormDialog>
        </div>
      )}
    </div>
  );
};
