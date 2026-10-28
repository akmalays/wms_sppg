import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package, Warehouse, Wrench, FileText, MapPin, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { EquipmentCondition, EquipmentStatus, ItemMaster } from '../types/warehouse';
import { resolveScan, ScanTarget, isNonFoodIssueTarget } from '../utils/scanCode';
import { BASE_RACKS_CONFIG, matchItemToRackId } from '../utils/warehouseRacks';
import { ScanButton } from './common/QrScannerDialog';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const INPUT_CLS =
  'w-full px-2.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
const KITCHEN_LOCATION = 'Dapur SPPG Tumpang Jeru';

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const TX_LABEL: Record<string, string> = {
  RECEIVING: 'Masuk',
  ISSUE_CONSUMPTION: 'Keluar',
  ADJUSTMENT: 'Penyesuaian',
  STOCK_OPNAME_ADJUSTMENT: 'Opname',
};
const CONDITION_LABEL: Record<EquipmentCondition, string> = { GOOD: 'Baik', NEEDS_INSPECTION: 'Perlu dicek', DAMAGED: 'Rusak' };
const STATUS_LABEL: Record<EquipmentStatus, string> = { ACTIVE: 'Dipakai', IN_REPAIR: 'Diperbaiki', LOST: 'Hilang', RETIRED: 'Tidak dipakai' };

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`bg-white rounded-xl border border-slate-200 p-4 sm:p-5 ${className}`}>{children}</section>
);

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] text-slate-600">{label}</dt>
    <dd className="text-xs font-semibold text-slate-900 mt-0.5">{children}</dd>
  </div>
);

interface ScanResultModuleProps {
  target: ScanTarget | null;
  onTargetChange: (target: ScanTarget) => void;
  onNavigate: (tab: string) => void;
}

export const ScanResultModule: React.FC<ScanResultModuleProps> = ({ target, onTargetChange, onNavigate }) => {
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const onSync = () => setDataVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    window.addEventListener('sppg_warehouse_sync', onSync);
    // Plakat rak yang diubah di Cetak Form tersimpan di app_settings
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onSync);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onSync);
      window.removeEventListener('sppg_storage_items_changed', onSync);
      window.removeEventListener('sppg_warehouse_sync', onSync);
    };
  }, []);

  const resolved = useMemo(() => (target ? resolveScan(target) : null), [target, dataVersion]);
  const refresh = () => setDataVersion(v => v + 1);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hasil Pindai</h1>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            {target ? (
              <>
                Kode <span className="font-mono font-semibold text-slate-800">{target.code}</span>
                {target.gr && <> · penerimaan <span className="font-mono">{target.gr}</span></>}
              </>
            ) : (
              'Pindai QR pada label barang, rak, tag, atau aset.'
            )}
          </p>
        </div>
        <ScanButton label="Pindai lagi" onResult={onTargetChange} />
      </div>

      {!resolved && (
        <Card>
          <p className="text-xs text-slate-700">Belum ada kode yang dipindai.</p>
        </Card>
      )}
      {resolved?.type === 'unknown' && isNonFoodIssueTarget({ code: resolved.code }) ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <div className="space-y-2 flex-1">
              <h2 className="text-sm font-bold text-slate-900">Form Pengambilan Barang Non-Food</h2>
              <p className="text-xs text-slate-700">
                Kode QR ini ditujukan untuk membuka formulir penyalinan form kertas pengambilan barang operasional (tisu, sabun, ATK, gas, dll.) ke aplikasi.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('daily_flow')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer ${FOCUS}`}
              >
                Buka Barang Keluar &gt; Operasional
              </button>
            </div>
          </div>
        </Card>
      ) : resolved?.type === 'unknown' ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>
              Kode <strong className="font-mono">{resolved.code}</strong> tidak ditemukan di barang, rak, aset, atau dokumen penerimaan. Bisa jadi barangnya sudah
              dihapus, atau labelnya dicetak dari data lain.
            </span>
          </p>
        </Card>
      ) : null}
      {resolved?.type === 'item' && <ItemView key={resolved.item.id} item={resolved.item} receivingId={resolved.receiving?.id} onDone={refresh} onNavigate={onNavigate} />}
      {resolved?.type === 'rack' && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">{resolved.rack.name}</h2>
              <p className="text-[11px] text-slate-600 font-mono">{resolved.rack.id}</p>
            </div>
          </div>
          {'storageRule' in resolved.rack && (
            <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Fact label="Gudang">{resolved.rack.warehouseName}</Fact>
              <Fact label="Suhu">{resolved.rack.temperatureGuide}</Fact>
              <Fact label="Rotasi">{resolved.rack.rotationMethod === 'FEFO' ? 'FEFO (yang kedaluwarsa duluan keluar duluan)' : 'FIFO (yang datang duluan keluar duluan)'}</Fact>
              <div className="col-span-2 sm:col-span-3">
                <Fact label="Aturan simpan">{resolved.rack.storageRule}</Fact>
              </div>
            </dl>
          )}
          <h3 className="mt-5 text-xs font-semibold text-slate-800">Barang di rak ini ({resolved.items.length + resolved.otherItems.length})</h3>
          {resolved.items.length + resolved.otherItems.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">Belum ada barang yang lokasinya di rak ini.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {resolved.items.map(i => {
                const low = i.currentStock <= i.minimumStock;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onTargetChange({ code: i.id })}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[48px] text-left hover:bg-slate-50 cursor-pointer ${FOCUS}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-900 truncate">{i.name}</span>
                        <span className="block text-[11px] text-slate-600 font-mono">{i.id}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-mono tabular-nums font-semibold ${low ? 'text-amber-800' : 'text-slate-900'}`}>
                          {fmt(i.currentStock)} {i.baseUnit}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </span>
                    </button>
                  </li>
                );
              })}
              {resolved.otherItems.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5 min-h-[48px]">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-900 truncate">{i.name}</span>
                    <span className="block text-[11px] text-slate-600 font-mono">{i.id}</span>
                  </span>
                  <span className="text-[11px] text-slate-600 shrink-0">Tidak ada di Master Barang</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {resolved?.type === 'asset' && <AssetView key={resolved.asset.id} assetId={resolved.asset.id} onDone={refresh} onNavigate={onNavigate} />}
      {resolved?.type === 'receiving' && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Penerimaan {resolved.receiving.id}</h2>
              <p className="text-xs text-slate-600">
                {resolved.receiving.supplierName} · {longDate(resolved.receiving.date)}, {resolved.receiving.arrivalTime}
                {resolved.receiving.deliveryNoteNo && ` · Nota ${resolved.receiving.deliveryNoteNo}`}
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {resolved.receiving.lines.map(l => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onTargetChange({ code: l.itemId, gr: resolved.receiving.id })}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[48px] text-left hover:bg-slate-50 cursor-pointer ${FOCUS}`}
                >
                  <span className="text-xs font-semibold text-slate-900">{l.itemName}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-800">
                    +{fmt(l.quantity)} {l.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

const ItemView: React.FC<{ item: ItemMaster; receivingId?: string; onDone: () => void; onNavigate: (tab: string) => void }> = ({
  item,
  receivingId,
  onDone,
  onNavigate,
}) => {
  const { currentUser, can } = useAuth();
  const isFood = item.itemType === 'FOOD_DAILY_FLOW' || item.itemType === 'FOOD_CARRYING_STOCK';
  const [qty, setQty] = useState('');
  const [usedFor, setUsedFor] = useState(isFood ? KITCHEN_LOCATION : '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const receiving = receivingId ? warehouseDb.getReceivings().find(r => r.id === receivingId) : undefined;
  const receivedLine = receiving?.lines.find(l => l.itemId === item.id);
  const ageDays = receiving
    ? Math.max(0, Math.floor((Date.now() - new Date(`${receiving.date}T00:00:00`).getTime()) / 86400000))
    : null;
  const rackId = matchItemToRackId(item.location, item.category, item.name, item.id);
  const rack = BASE_RACKS_CONFIG.find(r => r.id === rackId);
  const history = warehouseDb
    .getTransactions()
    .filter(tx => tx.itemId === item.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);
  const low = item.currentStock <= item.minimumStock;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const amount = parseFloat(qty.replace(',', '.'));
    if (!(amount > 0)) return setError('Jumlah harus lebih dari 0.');
    if (amount > item.currentStock) return setError(`Stok tinggal ${fmt(item.currentStock)} ${item.baseUnit}.`);
    if (!usedFor.trim()) return setError('Isi dipakai untuk apa atau oleh siapa.');
    try {
      warehouseDb.recordConsumption(item.id, amount, usedFor.trim(), currentUser, isFood ? 'Pemakaian dapur (pindai QR)' : 'Barang keluar (pindai QR)', receivingId);
      setMessage(`${fmt(amount)} ${item.baseUnit} keluar untuk ${usedFor.trim()}.`);
      setQty('');
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Gagal mencatat barang keluar.');
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">{item.name}</h2>
            <p className="text-[11px] text-slate-600">
              <span className="font-mono">{item.id}</span> · {item.category}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold font-mono tabular-nums ${low ? 'text-amber-800' : 'text-slate-900'}`}>{fmt(item.currentStock)}</div>
            <div className="text-[11px] text-slate-600">{item.baseUnit} di gudang</div>
          </div>
        </div>
        {low && <p className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Stok di bawah batas minimum ({fmt(item.minimumStock)} {item.baseUnit}).</p>}
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fact label="Lokasi">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {rack ? rack.name : item.location || '-'}
            </span>
          </Fact>
          {rack && <Fact label="Rotasi">{rack.rotationMethod}</Fact>}
        </dl>
      </Card>

      {receiving && (
        <Card>
          <h3 className="text-xs font-semibold text-slate-800">Dari penerimaan {receiving.id}</h3>
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact label="Supplier">{receiving.supplierName}</Fact>
            <Fact label="Datang">
              {longDate(receiving.date)}, {receiving.arrivalTime}
            </Fact>
            <Fact label="Umur barang">{ageDays === 0 ? 'Hari ini' : `${ageDays} hari`}</Fact>
            <Fact label="Diterima">{receivedLine ? `${fmt(receivedLine.quantity)} ${receivedLine.unit}` : '-'}</Fact>
            {receiving.deliveryNoteNo && <Fact label="No. nota">{receiving.deliveryNoteNo}</Fact>}
          </dl>
        </Card>
      )}

      {can('RECORD_CONSUMPTION') && (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-800">Catat barang keluar</h3>
            {message && (
              <p role="status" className="flex items-start gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="scan-qty" className="block text-[11px] font-medium text-slate-700 mb-1">Jumlah ({item.baseUnit})</label>
                <input id="scan-qty" type="number" min="0" step="any" inputMode="decimal" autoFocus value={qty} onChange={e => setQty(e.target.value)} className={`${INPUT_CLS} text-right font-mono tabular-nums`} />
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="scan-for" className="block text-[11px] font-medium text-slate-700 mb-1">Dipakai untuk / oleh</label>
                <input id="scan-for" value={usedFor} onChange={e => setUsedFor(e.target.value)} placeholder="Contoh: Kantor, Area cuci" className={INPUT_CLS} />
              </div>
              <div className="sm:col-span-3 flex items-end">
                <button type="submit" className={`w-full min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer ${FOCUS}`}>
                  Catat keluar
                </button>
              </div>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800">Mutasi terakhir</h3>
          {can('CREATE_OPNAME') && (
            <button type="button" onClick={() => onNavigate('stock_opname')} className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer ${FOCUS}`}>
              <ClipboardCheck className="w-4 h-4 text-emerald-700" />
              Buka Opname
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">Belum ada mutasi untuk barang ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {history.map(tx => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900">{TX_LABEL[tx.transactionType] || tx.transactionType}</span>
                  <span className="text-slate-600"> · {tx.timestamp.slice(0, 16).replace(' ', ', ')} · {tx.userName}</span>
                </span>
                <span className={`font-mono tabular-nums font-semibold shrink-0 ${tx.quantity < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
                  {tx.quantity > 0 ? '+' : ''}
                  {fmt(tx.quantity)} {tx.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

const AssetView: React.FC<{ assetId: string; onDone: () => void; onNavigate: (tab: string) => void }> = ({ assetId, onDone, onNavigate }) => {
  const { currentUser, can } = useAuth();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const asset = warehouseDb.getEquipment().find(e => e.id === assetId);
  if (!asset) return null;

  const update = (condition: EquipmentCondition, status: EquipmentStatus, label: string) => {
    setError('');
    if (condition === 'DAMAGED' && !note.trim()) return setError('Tulis kerusakannya di catatan.');
    try {
      warehouseDb.updateEquipmentCondition(asset.id, condition, status, note.trim() || 'Dicek lewat pindai QR', currentUser);
      setMessage(`Kondisi dicatat: ${label}.`);
      setNote('');
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan kondisi.');
    }
  };

  const tone = asset.condition === 'GOOD' ? 'text-emerald-800 bg-emerald-50' : asset.condition === 'DAMAGED' ? 'text-rose-800 bg-rose-50' : 'text-amber-800 bg-amber-50';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">{asset.name}</h2>
          <p className="text-[11px] text-slate-600">
            <span className="font-mono">{asset.id}</span> · {asset.category}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${tone}`}>{CONDITION_LABEL[asset.condition]}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fact label="Status">{STATUS_LABEL[asset.status]}</Fact>
        <Fact label="Jumlah">
          {asset.quantity} {asset.unit}
        </Fact>
        <Fact label="Lokasi">{asset.location || '-'}</Fact>
        <Fact label="Terakhir dicek">{asset.lastInspectedDate ? longDate(asset.lastInspectedDate) : '-'}</Fact>
      </dl>
      {asset.notes && <p className="mt-3 text-xs text-slate-700">{asset.notes}</p>}

      {can('MANAGE_EQUIPMENT') && (
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-semibold text-slate-800">Catat pengecekan</h3>
          {message && (
            <p role="status" className="flex items-start gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <label htmlFor="asset-note" className="block text-[11px] font-medium text-slate-700">Catatan</label>
          <input id="asset-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Wajib bila rusak, mis. motor blender mati" className={INPUT_CLS} />
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => update('GOOD', 'ACTIVE', 'baik')} className={`min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer ${FOCUS}`}>
              Kondisi baik
            </button>
            <button type="button" onClick={() => update('NEEDS_INSPECTION', 'ACTIVE', 'perlu dicek')} className={`min-h-[44px] sm:min-h-[34px] rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold cursor-pointer ${FOCUS}`}>
              Perlu dicek
            </button>
            <button type="button" onClick={() => update('DAMAGED', 'IN_REPAIR', 'rusak, diperbaiki')} className={`min-h-[44px] sm:min-h-[34px] rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-semibold cursor-pointer ${FOCUS}`}>
              Rusak
            </button>
          </div>
        </div>
      )}
      <button type="button" onClick={() => onNavigate('equipment')} className={`mt-4 text-xs font-semibold text-emerald-800 hover:underline cursor-pointer rounded ${FOCUS}`}>
        Buka di Aset Dapur
      </button>
    </Card>
  );
};
