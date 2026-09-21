import React, { useState } from 'react';
import { warehouseDb } from '../db/storage';
import { AuditLogEntry } from '../types/warehouse';
import { Shield, Search, FileText, UserCheck, Clock, CheckCircle2 } from 'lucide-react';

export const AuditLogModule: React.FC = () => {
  const [logs] = useState<AuditLogEntry[]>(() => warehouseDb.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntity, setFilterEntity] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      log.userName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q);

    const matchesEntity = filterEntity === 'ALL' || log.entity === filterEntity;

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Log Audit Aktivitas (Audit Trail)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              Read-Only • Unalterable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Jejak digital seluruh aksi operasional gudang: Siapa, Apa, Kapan, Entitas, dan Rincian Transaksi.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama staf, tindakan, nomor dokumen, atau rincian..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Entitas</option>
            <option value="RECEIVING">RECEIVING (Penerimaan)</option>
            <option value="STOCK_OPNAME">STOCK OPNAME</option>
            <option value="CONSUMPTION">CONSUMPTION (Pengeluaran)</option>
            <option value="EQUIPMENT">EQUIPMENT (Peralatan)</option>
            <option value="ITEM">ITEM (Master Barang)</option>
            <option value="SUPPLIER">SUPPLIER</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Waktu Kejadian</th>
                <th className="py-3 px-4">Petugas / User</th>
                <th className="py-3 px-4">Entitas</th>
                <th className="py-3 px-4">ID Dokumen / Aset</th>
                <th className="py-3 px-4">Tindakan (Action)</th>
                <th className="py-3 px-4">Rincian Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Tidak ada catatan audit yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{log.timestamp.split(' ')[0]}</div>
                      <div className="text-slate-400 text-[10px]">{log.timestamp.split(' ')[1]} WIB</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-500">{log.userRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {log.entity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{log.action}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
