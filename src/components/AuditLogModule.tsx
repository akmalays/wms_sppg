import React, { useEffect, useMemo, useState } from 'react';
import { Select } from './common/Select';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { AuditLog } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { Search } from 'lucide-react';
import { BTN_SECONDARY, FIELD_INPUT, FIELD_LABEL } from './common/FormDialog';
import { ROLE_INFO } from './UserManagementModule';

// Kode area (entity) yang dicatat storage, ditampilkan dalam bahasa sehari-hari.
const AREA_LABEL: Record<string, string> = {
  RECEIVING: 'Penerimaan & PO',
  INVENTORY: 'Stok & pemakaian',
  STOCK_OPNAME: 'Stok opname',
  ITEM_MASTER: 'Data barang',
  SUPPLIER: 'Supplier',
  EQUIPMENT: 'Aset dapur',
  OPERATIONAL: 'Operasional',
  STAFF: 'Karyawan',
  ATTENDANCE: 'Absensi',
  USER: 'Akun aplikasi',
  SETTINGS: 'Pengaturan',
  AUTH: 'Login',
};

const ACTION_LABEL: Record<string, string> = {
  RECEIVING_CREATED_POSTED: 'Penerimaan barang dicatat',
  PO_CREATED: 'PO dibuat',
  PO_UPDATED: 'PO diubah',
  PO_DELETED: 'PO dihapus',
  PO_DELETED_BY_MENU: 'PO dihapus (dari menu)',
  PO_RECEIVED_COMPLETED: 'PO selesai diterima',
  STOCK_CONSUMED: 'Barang keluar',
  STOCK_ADJUSTED: 'Stok disesuaikan',
  STOCK_OPNAME_CREATED: 'Opname dibuat',
  STOCK_OPNAME_APPROVED: 'Opname disetujui',
  ITEM_MASTER_CREATED: 'Barang ditambahkan',
  ITEM_MASTER_UPDATED: 'Barang diubah',
  ITEM_MASTER_DELETED: 'Barang dihapus',
  ITEMS_BATCH_SAVED: 'Beberapa barang disimpan',
  SUPPLIER_CREATED: 'Supplier ditambahkan',
  SUPPLIER_UPDATED: 'Supplier diubah',
  SUPPLIER_DELETED: 'Supplier dihapus',
  EQUIPMENT_CREATED: 'Aset ditambahkan',
  EQUIPMENT_UPDATED: 'Aset diubah',
  EQUIPMENT_CONDITION_CHANGED: 'Kondisi aset dicek',
  NONFOOD_EXPENSE_RECORDED: 'Pengeluaran dicatat',
  NONFOOD_EXPENSES_BATCH_RECORDED: 'Beberapa pengeluaran dicatat',
  NONFOOD_EXPENSE_DELETED: 'Pengeluaran dihapus',
  MENU_ORDER_CREATED: 'Menu dibuat',
  MENU_ORDER_UPDATED: 'Menu diubah',
  MENU_ORDER_DELETED: 'Menu dihapus',
  MENU_ORDER_STATUS_CHANGED: 'Status menu diubah',
  WASTE_BATCH_RECORDED: 'Limbah dicatat',
  WASTE_DAILY_RECORDED: 'Limbah harian dicatat',
  WASTE_DAILY_UPDATED: 'Limbah harian diubah',
  WASTE_DAILY_DELETED: 'Limbah harian dihapus',
  WASTE_DELETED: 'Limbah dihapus',
  BENEFICIARY_CREATED: 'Penerima manfaat ditambahkan',
  BENEFICIARY_UPDATED: 'Penerima manfaat diubah',
  BENEFICIARY_DELETED: 'Penerima manfaat dihapus',
  TODO_CREATED: 'Tugas harian dibuat',
  TODO_COMPLETED: 'Tugas harian selesai',
  TODO_REOPENED: 'Tugas harian dibuka lagi',
  TODO_DELETED: 'Tugas harian dihapus',
  USER_CREATED: 'Akun dibuat',
  USER_UPDATED: 'Akun diubah',
  USER_DELETED: 'Akun dihapus',
  CREATE: 'Ditambahkan',
  UPDATE: 'Diubah',
  DELETE: 'Dihapus',
};

// Kode yang belum ada di daftar tetap terbaca: "WASTE_DAILY_UPDATED" -> "Waste daily updated".
const actionText = (code: string) => {
  if (ACTION_LABEL[code]) return ACTION_LABEL[code];
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const PAGE_SIZE = 100;

export const AuditLogModule: React.FC = () => {
  const { can } = useAuth();
  const [version, setVersion] = useState(0);
  const logs = useMemo(() => warehouseDb.getAuditLogs(), [version]);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('ALL');
  const [person, setPerson] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    const onChange = () => setVersion(v => v + 1);
    window.addEventListener('sppg_audit_changed', onChange);
    window.addEventListener('sppg_storage_items_changed', onChange);
    return () => {
      window.removeEventListener('sppg_audit_changed', onChange);
      window.removeEventListener('sppg_storage_items_changed', onChange);
    };
  }, []);

  useEffect(() => setLimit(PAGE_SIZE), [query, area, person, from, to]);

  // Pilihan filter hanya dari data yang benar-benar ada, agar tidak ada pilihan yang selalu kosong.
  const areas = useMemo(() => Array.from(new Set(logs.map(l => l.entity))).sort((a, b) => (AREA_LABEL[a] || a).localeCompare(AREA_LABEL[b] || b, 'id')), [logs]);
  const people = useMemo(() => Array.from(new Set(logs.map(l => l.userName))).sort((a, b) => a.localeCompare(b, 'id')), [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(l => {
      const day = (l.timestamp || '').slice(0, 10);
      if (area !== 'ALL' && l.entity !== area) return false;
      if (person !== 'ALL' && l.userName !== person) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [l.userName, l.details, l.entityId, actionText(l.action), l.action].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [logs, query, area, person, from, to]);

  const visible = filtered.slice(0, limit);
  const hasFilter = query || area !== 'ALL' || person !== 'ALL' || from || to;

  if (!can('VIEW_AUDIT')) {
    return (
      <p className="py-10 text-center text-xs text-slate-600 bg-white rounded-xl border border-slate-200">
        Riwayat aktivitas hanya bisa dilihat oleh Superadmin, Kepala SPPG, Admin Gudang, dan Akuntan.
      </p>
    );
  }

  const resetFilters = () => {
    setQuery('');
    setArea('ALL');
    setPerson('ALL');
    setFrom('');
    setTo('');
  };

  const setToday = () => {
    const today = localDateIso();
    setFrom(today);
    setTo(today);
  };

  // Baris dikelompokkan per hari.
  let lastDay = '';

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Riwayat Aktivitas</h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Siapa melakukan apa dan kapan. Tersimpan di browser ini, {logs.length.toLocaleString('id-ID')} catatan (maksimal 2.000 terakhir).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
        <div className="lg:col-span-2">
          <label htmlFor="aud-q" className={FIELD_LABEL}>Cari</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="aud-q"
              type="search"
              placeholder="Nama barang, nomor dokumen, atau rincian"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={`${FIELD_INPUT} pl-8`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="aud-area" className={FIELD_LABEL}>Bagian</label>
          <Select className="w-full" id="aud-area" value={area} onChange={e => setArea(e.target.value)}>
            <option value="ALL">Semua bagian</option>
            {areas.map(a => (
              <option key={a} value={a}>{AREA_LABEL[a] || a}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="aud-person" className={FIELD_LABEL}>Petugas</label>
          <Select className="w-full" id="aud-person" value={person} onChange={e => setPerson(e.target.value)}>
            <option value="ALL">Semua petugas</option>
            {people.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="aud-from" className={FIELD_LABEL}>Dari</label>
            <input id="aud-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label htmlFor="aud-to" className={FIELD_LABEL}>Sampai</label>
            <input id="aud-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className={FIELD_INPUT} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-700">
          {hasFilter ? `${filtered.length.toLocaleString('id-ID')} catatan cocok` : `${logs.length.toLocaleString('id-ID')} catatan`}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={setToday} className={BTN_SECONDARY}>Hari ini</button>
          {hasFilter && (
            <button type="button" onClick={resetFilters} className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}>
              Hapus filter
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold w-16">Jam</th>
                <th className="py-2.5 px-3 font-semibold w-44">Petugas</th>
                <th className="py-2.5 px-3 font-semibold w-48">Aktivitas</th>
                <th className="py-2.5 px-4 font-semibold">Rincian</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-600">
                    Belum ada aktivitas tercatat. Riwayat muncul setelah ada data yang ditambah, diubah, atau dihapus.
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-600">
                    Tidak ada aktivitas yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                visible.map((l: AuditLog) => {
                  const day = (l.timestamp || '').slice(0, 10);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  return (
                    <React.Fragment key={l.id}>
                      {showDay && (
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <th colSpan={4} scope="colgroup" className="py-1.5 px-4 text-left text-[11px] font-semibold text-slate-700">
                            {formatDay(day)}
                          </th>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100 hover:bg-slate-50 align-top">
                        <td className="py-2.5 px-4 font-mono text-slate-800 whitespace-nowrap">{(l.timestamp || '').slice(11, 16)}</td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-900 font-medium">{l.userName}</div>
                          <div className="text-[11px] text-slate-600">{ROLE_INFO[l.userRole]?.label || l.userRole}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-900 font-medium">{actionText(l.action)}</div>
                          <div className="text-[11px] text-slate-600">{AREA_LABEL[l.entity] || l.entity}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">
                          {l.details}
                          {l.entityId && <div className="text-[11px] text-slate-600 font-mono mt-0.5">{l.entityId}</div>}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-700">
              Menampilkan {limit.toLocaleString('id-ID')} dari {filtered.length.toLocaleString('id-ID')}
            </span>
            <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)} className={BTN_SECONDARY}>
              Tampilkan {Math.min(PAGE_SIZE, filtered.length - limit)} lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
